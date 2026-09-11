import type { KicadFootprintGraphic, KicadFootprintLine, KicadFootprintPoly } from "../../footprint";
import { KLC_RULES } from "../rules/klc";

/** Diode Cathode Silk Bar */
export function createDiodeCathodeBar(
  x: number,
  y1: number,
  y2: number,
  layer: string = KLC_RULES.layers.silk
): KicadFootprintLine {
  return {
    kind: "line",
    layer,
    start: { x, y: y1 },
    end: { x, y: y2 },
    stroke: { width: 0.25 }, // Thicker stroke for clear visual polarity
  };
}

/** Electrolytic / Tantalum "+" positive marker */
export function createPolarityPlus(
  cx: number,
  cy: number,
  size: number = 0.8,
  layer: string = KLC_RULES.layers.silk
): KicadFootprintGraphic[] {
  const hs = size / 2;
  return [
    {
      kind: "line",
      layer,
      start: { x: cx - hs, y: cy },
      end: { x: cx + hs, y: cy },
      stroke: { width: KLC_RULES.strokeWidth.silkscreen },
    },
    {
      kind: "line",
      layer,
      start: { x: cx, y: cy - hs },
      end: { x: cx, y: cy + hs },
      stroke: { width: KLC_RULES.strokeWidth.silkscreen },
    },
  ];
}

/** Radial Capacitor Negative Side Hatch / Filled Arc */
export function createCapNegativeBand(
  radius: number,
  layer: string = KLC_RULES.layers.silk
): KicadFootprintPoly {
  const points: { x: number; y: number }[] = [{ x: 0, y: -radius }];
  const steps = 24;
  for (let i = 0; i <= steps; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / steps;
    points.push({
      x: Math.cos(a) * radius,
      y: Math.sin(a) * radius,
    });
  }
  points.push({ x: 0, y: -radius });

  return {
    kind: "poly",
    layer,
    points,
    fill: "solid",
    stroke: { width: KLC_RULES.strokeWidth.silkscreen },
  };
}
