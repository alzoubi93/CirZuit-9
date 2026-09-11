import type { KicadFootprintGraphic, KicadFootprintLine, KicadFootprintCircle, KicadFootprintArc } from "../../footprint";
import { KLC_RULES } from "../rules/klc";

export function createSilkLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number = KLC_RULES.strokeWidth.silkscreen
): KicadFootprintLine {
  return {
    kind: "line",
    layer: KLC_RULES.layers.silk,
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    stroke: { width: strokeWidth },
  };
}

export function createSilkRect(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  strokeWidth: number = KLC_RULES.strokeWidth.silkscreen
): KicadFootprintGraphic[] {
  return [
    createSilkLine(x1, y1, x2, y1, strokeWidth),
    createSilkLine(x2, y1, x2, y2, strokeWidth),
    createSilkLine(x2, y2, x1, y2, strokeWidth),
    createSilkLine(x1, y2, x1, y1, strokeWidth),
  ];
}

export function createSilkCircle(
  cx: number,
  cy: number,
  radius: number,
  fill: "none" | "solid" = "none",
  strokeWidth: number = KLC_RULES.strokeWidth.silkscreen
): KicadFootprintCircle {
  return {
    kind: "circle",
    layer: KLC_RULES.layers.silk,
    center: { x: cx, y: cy },
    end: { x: cx + radius, y: cy },
    fill,
    stroke: { width: strokeWidth },
  };
}

export function createSilkArc(
  startX: number,
  startY: number,
  midX: number,
  midY: number,
  endX: number,
  endY: number,
  strokeWidth: number = KLC_RULES.strokeWidth.silkscreen
): KicadFootprintArc {
  return {
    kind: "arc",
    layer: KLC_RULES.layers.silk,
    start: { x: startX, y: startY },
    mid: { x: midX, y: midY },
    end: { x: endX, y: endY },
    stroke: { width: strokeWidth },
  };
}

/** Authentic KiCad Silkscreen Pin 1 Marker (Filled dot outside pad) */
export function createSilkPin1Dot(x: number, y: number, radius: number = 0.25): KicadFootprintCircle {
  return createSilkCircle(x, y, radius, "solid", KLC_RULES.strokeWidth.silkscreen);
}
