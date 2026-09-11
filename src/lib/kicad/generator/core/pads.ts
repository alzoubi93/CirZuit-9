import type { KicadFootprintPad, KicadPadShape } from "../../footprint";
import { KLC_RULES } from "../rules/klc";

export interface PadOptions {
  number: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  shape?: KicadPadShape;
  drill?: number;
  layers?: string[];
  roundrectRatio?: number;
}

export function createSmdPad(options: PadOptions): KicadFootprintPad {
  return {
    number: options.number,
    type: "smd",
    shape: options.shape || "roundrect",
    position: { x: options.x, y: options.y },
    size: { x: options.width, y: options.height },
    rotation: options.rotation || 0,
    layers: options.layers || [...KLC_RULES.layers.smdPad],
    roundrectRatio: options.roundrectRatio ?? 0.25,
  };
}

export function createThtPad(options: PadOptions & { drill: number }): KicadFootprintPad {
  return {
    number: options.number,
    type: "thru_hole",
    shape: options.shape || (options.number === "1" ? "rect" : "oval"),
    position: { x: options.x, y: options.y },
    size: { x: options.width, y: options.height },
    rotation: options.rotation || 0,
    layers: options.layers || [...KLC_RULES.layers.thtPad],
    drill: options.drill,
  };
}

export function createCirclePad(options: Omit<PadOptions, "shape" | "height"> & { diameter: number }): KicadFootprintPad {
  return {
    number: options.number,
    type: "smd",
    shape: "circle",
    position: { x: options.x, y: options.y },
    size: { x: options.diameter, y: options.diameter },
    rotation: options.rotation || 0,
    layers: options.layers || [...KLC_RULES.layers.smdPad],
  };
}

export function createNpthHole(x: number, y: number, diameter: number): KicadFootprintPad {
  return {
    number: "",
    type: "np_thru_hole",
    shape: "circle",
    position: { x, y },
    size: { x: diameter, y: diameter },
    rotation: 0,
    layers: [...KLC_RULES.layers.npthPad],
    drill: diameter,
  };
}
