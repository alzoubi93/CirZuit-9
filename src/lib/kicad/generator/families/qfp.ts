import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad } from "../core/pads";
import { createSilkLine, createSilkPin1Dot } from "../core/silk";
import { createFabBeveledBody } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { createExposedThermalPad } from "../core/thermal";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface QfpParams {
  pinCount: number;      // standard 32, 44, 48, 64, 80, 100, 144
  pitch?: number;        // standard 0.8mm, 0.65mm, 0.5mm, 0.4mm
  spanX?: number;        // tip-to-tip pad span X (e.g. 9.0mm for 7x7 body)
  spanY?: number;        // tip-to-tip pad span Y (e.g. 9.0mm)
  padWidth?: number;     // pad width along pitch axis (e.g. 0.3mm for 0.5 pitch)
  padLength?: number;    // pad extension outward (e.g. 1.5mm)
  bodySize?: number;     // nominal package body width/length (e.g. 7.0mm)
  hasThermalPad?: boolean;
  thermalPadSize?: number;
  reference?: string;
  value?: string;
}

export function generateQfp(params: QfpParams): KicadFootprintModel {
  const pinCount = Math.max(8, Math.floor(params.pinCount / 4) * 4);
  const sideCount = pinCount / 4;
  const pitch = params.pitch || (pinCount >= 100 ? 0.5 : 0.8);
  const bodySize = params.bodySize || (sideCount * pitch + 2.0);
  const span = params.spanX || (bodySize + 2.0);
  const padWidth = params.padWidth || (pitch * 0.55);
  const padLength = params.padLength || 1.5;

  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  let pinNum = 1;

  // 1. Left side: Pins 1..sideCount (from top to bottom)
  for (let i = 0; i < sideCount; i++) {
    const py = (i - (sideCount - 1) / 2) * pitch;
    const px = -span / 2;
    pads.push(
      createSmdPad({
        number: String(pinNum++),
        x: px,
        y: py,
        width: padLength,
        height: padWidth,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );
  }

  // 2. Bottom side: Pins (sideCount + 1)..(2 * sideCount) (from left to right)
  for (let i = 0; i < sideCount; i++) {
    const px = (i - (sideCount - 1) / 2) * pitch;
    const py = span / 2;
    pads.push(
      createSmdPad({
        number: String(pinNum++),
        x: px,
        y: py,
        width: padWidth,
        height: padLength,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );
  }

  // 3. Right side: Pins (2*sideCount + 1)..(3 * sideCount) (from bottom to top)
  for (let i = 0; i < sideCount; i++) {
    const py = ((sideCount - 1 - i) - (sideCount - 1) / 2) * pitch;
    const px = span / 2;
    pads.push(
      createSmdPad({
        number: String(pinNum++),
        x: px,
        y: py,
        width: padLength,
        height: padWidth,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );
  }

  // 4. Top side: Pins (3*sideCount + 1)..pinCount (from right to left)
  for (let i = 0; i < sideCount; i++) {
    const px = ((sideCount - 1 - i) - (sideCount - 1) / 2) * pitch;
    const py = -span / 2;
    pads.push(
      createSmdPad({
        number: String(pinNum++),
        x: px,
        y: py,
        width: padWidth,
        height: padLength,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );
  }

  // Center Thermal Pad
  if (params.hasThermalPad && params.thermalPadSize) {
    const epPads = createExposedThermalPad({
      padNumber: String(pinCount + 1),
      width: params.thermalPadSize,
      height: params.thermalPadSize,
      viaCountX: 3,
      viaCountY: 3,
    });
    pads.push(...epPads);
  }

  // Body Outlines (F.Fab)
  const hs = bodySize / 2;
  const chamfer = Math.min(1.0, hs * 0.25);
  graphics.push(createFabBeveledBody(-hs, -hs, hs, hs, chamfer));

  // Silkscreen: 4 corner marks with bevel on Pin 1 corner
  const cLen = Math.max(0.6, hs - (sideCount - 1) / 2 * pitch - 0.4);
  // Top-left Pin 1 corner with 45-deg line
  graphics.push(createSilkLine(-hs + chamfer, -hs, -hs + chamfer + cLen, -hs));
  graphics.push(createSilkLine(-hs, -hs + chamfer, -hs + chamfer, -hs));
  graphics.push(createSilkLine(-hs, -hs + chamfer, -hs, -hs + chamfer + cLen));

  // Top-right corner
  graphics.push(createSilkLine(hs - cLen, -hs, hs, -hs));
  graphics.push(createSilkLine(hs, -hs, hs, -hs + cLen));

  // Bottom-right corner
  graphics.push(createSilkLine(hs, hs - cLen, hs, hs));
  graphics.push(createSilkLine(hs, hs, hs - cLen, hs));

  // Bottom-left corner
  graphics.push(createSilkLine(-hs, hs - cLen, -hs, hs));
  graphics.push(createSilkLine(-hs, hs, -hs + cLen, hs));

  // Pin 1 dot on Silkscreen
  graphics.push(createSilkPin1Dot(-span / 2 - padLength / 2 - 0.5, -(sideCount - 1) / 2 * pitch));

  // Reference & Value Text
  graphics.push(createReferenceText(0, -span / 2 - padLength / 2 - 1.0));
  graphics.push(createValueText(0, span / 2 + padLength / 2 + 1.0, params.value || `QFP-${pinCount}`));

  // Courtyard
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  const name = `LQFP-${pinCount}_${bodySize.toFixed(1)}x${bodySize.toFixed(1)}mm_P${pitch.toFixed(2)}mm`;
  return buildNativeFootprintModel({
    name,
    referencePrefix: params.reference || "U",
    value: params.value || name,
    description: `Low-profile Quad Flat Package (LQFP) ${pinCount} pins, ${bodySize}x${bodySize}mm, pitch ${pitch}mm`,
    tags: ["QFP", "LQFP", "TQFP", "SMD"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "qfp",
    generatorParams: params,
  });
}
