import type { KicadFootprintGraphic, KicadFootprintLine, KicadFootprintPoly, KicadFootprintCircle, KicadFootprintArc } from "../../footprint";
import { KLC_RULES } from "../rules/klc";

export function createFabLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number = KLC_RULES.strokeWidth.fab
): KicadFootprintLine {
  return {
    kind: "line",
    layer: KLC_RULES.layers.fab,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    stroke: { width: strokeWidth },
  };
}

export function createFabRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number = KLC_RULES.strokeWidth.fab
): KicadFootprintGraphic[] {
  return [
    createFabLine(x1, y1, x2, y1, strokeWidth),
    createFabLine(x2, y1, x2, y2, strokeWidth),
    createFabLine(x2, y2, x1, y2, strokeWidth),
    createFabLine(x1, y2, x1, y1, strokeWidth),
  ];
}

/** Standard KiCad IC Body Outline on F.Fab with 45-degree chamfer for Pin 1 */
export function createFabBeveledBody(
  left: number,
  top: number,
  right: number,
  bottom: number,
  chamfer: number = 1.0,
  strokeWidth: number = KLC_RULES.strokeWidth.fab
): KicadFootprintPoly {
  const c = Math.min(chamfer, Math.abs(right - left) * 0.3, Math.abs(bottom - top) * 0.3);
  return {
    kind: "poly",
    layer: KLC_RULES.layers.fab,
    points: [
      { x: left + c, y: top },
      { x: right, y: top },
      { x: right, y: bottom },
      { x: left, y: bottom },
      { x: left, y: top + c },
    ],
    fill: "none",
    stroke: { width: strokeWidth },
  };
}

export function createFabCircle(
  cx: number,
  cy: number,
  radius: number,
  strokeWidth: number = KLC_RULES.strokeWidth.fab
): KicadFootprintCircle {
  return {
    kind: "circle",
    layer: KLC_RULES.layers.fab,
    center: { x: cx, y: cy },
    end: { x: cx + radius, y: cy },
    fill: "none",
    stroke: { width: strokeWidth },
  };
}

export function createFabArc(
  startX: number,
  startY: number,
  midX: number,
  midY: number,
  endX: number,
  endY: number,
  strokeWidth: number = KLC_RULES.strokeWidth.fab
): KicadFootprintArc {
  return {
    kind: "arc",
    layer: KLC_RULES.layers.fab,
    start: { x: startX, y: startY },
    mid: { x: midX, y: midY },
    end: { x: endX, y: endY },
    stroke: { width: strokeWidth },
  };
}
