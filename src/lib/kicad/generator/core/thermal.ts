import type { KicadFootprintPad } from "../../footprint";
import { createSmdPad } from "./pads";

export interface ThermalPadOptions {
  padNumber?: string;
  width: number;
  height: number;
  x?: number;
  y?: number;
  pasteCoverageRatio?: number; // default 0.65 (65% paste window per IPC-7351)
  viaCountX?: number;
  viaCountY?: number;
  viaDrill?: number;
}

export function createExposedThermalPad(options: ThermalPadOptions): KicadFootprintPad[] {
  const padNum = options.padNumber || "EP";
  const cx = options.x || 0;
  const cy = options.y || 0;
  const w = options.width;
  const h = options.height;

  const mainPad = createSmdPad({
    number: padNum,
    x: cx,
    y: cy,
    width: w,
    height: h,
    shape: "roundrect",
    roundrectRatio: 0.1,
  });

  const pads: KicadFootprintPad[] = [mainPad];

  // Optional thermal vias inside the EP
  const vX = options.viaCountX || 0;
  const vY = options.viaCountY || 0;
  if (vX > 0 && vY > 0) {
    const drill = options.viaDrill || 0.3;
    const padD = drill + 0.3;
    const stepX = w / (vX + 1);
    const stepY = h / (vY + 1);

    for (let ix = 1; ix <= vX; ix++) {
      for (let iy = 1; iy <= vY; iy++) {
        const px = cx - w / 2 + ix * stepX;
        const py = cy - h / 2 + iy * stepY;
        pads.push({
          number: padNum,
          type: "thru_hole",
          shape: "circle",
          position: { x: px, y: py },
          size: { x: padD, y: padD },
          rotation: 0,
          layers: ["*.Cu"],
          drill,
        });
      }
    }
  }

  return pads;
}
