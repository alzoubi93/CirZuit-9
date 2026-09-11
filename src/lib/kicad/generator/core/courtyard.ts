import type { KicadFootprintPad, KicadFootprintGraphic, KicadFootprintRect, KicadFootprintCircle } from "../../footprint";
import { KLC_RULES, roundToGrid } from "../rules/klc";

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Compute the bounding box of a collection of pads and graphics */
export function computeEnvelope(
  pads: KicadFootprintPad[],
  graphics: KicadFootprintGraphic[] = []
): BoundingBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const pad of pads) {
    const hw = pad.size.x / 2;
    const hh = pad.size.y / 2;
    minX = Math.min(minX, pad.position.x - hw);
    maxX = Math.max(maxX, pad.position.x + hw);
    minY = Math.min(minY, pad.position.y - hh);
    maxY = Math.max(maxY, pad.position.y + hh);
  }

  for (const g of graphics) {
    // Only consider F.SilkS and F.Fab for courtyard envelope (ignore F.CrtYd or texts)
    if (g.layer !== "F.SilkS" && g.layer !== "F.Fab") continue;
    if (g.kind === "line") {
      minX = Math.min(minX, g.start.x, g.end.x);
      maxX = Math.max(maxX, g.start.x, g.end.x);
      minY = Math.min(minY, g.start.y, g.end.y);
      maxY = Math.max(maxY, g.start.y, g.end.y);
    } else if (g.kind === "circle") {
      const r = Math.hypot(g.end.x - g.center.x, g.end.y - g.center.y);
      minX = Math.min(minX, g.center.x - r);
      maxX = Math.max(maxX, g.center.x + r);
      minY = Math.min(minY, g.center.y - r);
      maxY = Math.max(maxY, g.center.y + r);
    } else if (g.kind === "poly") {
      for (const pt of g.points) {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
      }
    }
  }

  if (!Number.isFinite(minX)) {
    minX = -2;
    maxX = 2;
    minY = -2;
    maxY = 2;
  }

  return { minX, minY, maxX, maxY };
}

/** Create standard rectangular courtyard around pads and graphics */
export function createCourtyardRect(
  pads: KicadFootprintPad[],
  graphics: KicadFootprintGraphic[] = [],
  clearance: number = KLC_RULES.clearance.courtyardSmd
): KicadFootprintRect {
  const env = computeEnvelope(pads, graphics);
  const minX = roundToGrid(env.minX - clearance);
  const maxX = roundToGrid(env.maxX + clearance);
  const minY = roundToGrid(env.minY - clearance);
  const maxY = roundToGrid(env.maxY + clearance);

  return {
    kind: "rect",
    layer: KLC_RULES.layers.courtyard,
    start: { x: minX, y: minY },
    end: { x: maxX, y: maxY },
    stroke: { width: KLC_RULES.strokeWidth.courtyard },
  };
}

/** Create standard circular courtyard (for radial electrolytic caps, circular transistors, etc.) */
export function createCourtyardCircle(
  cx: number,
  cy: number,
  radius: number,
  clearance: number = KLC_RULES.clearance.courtyardTht
): KicadFootprintCircle {
  const totalR = roundToGrid(radius + clearance);
  return {
    kind: "circle",
    layer: KLC_RULES.layers.courtyard,
    center: { x: cx, y: cy },
    end: { x: cx + totalR, y: cy },
    stroke: { width: KLC_RULES.strokeWidth.courtyard },
  };
}
