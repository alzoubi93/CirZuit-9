import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad } from "../core/pads";
import { createSilkLine, createSilkPin1Dot } from "../core/silk";
import { createFabBeveledBody } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { createExposedThermalPad } from "../core/thermal";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface QfnParams {
  pinCount: number;      // standard 16, 20, 24, 28, 32, 40, 48, 64
  pitch?: number;        // standard 0.5mm, 0.4mm, 0.65mm
  bodySize?: number;     // e.g. 4.0mm, 5.0mm, 7.0mm
  padWidth?: number;     // e.g. 0.25mm
  padLength?: number;    // e.g. 0.55mm
  thermalPadSize?: number; // e.g. 2.6mm
  reference?: string;
  value?: string;
}

export function generateQfn(params: QfnParams): KicadFootprintModel {
  const pinCount = Math.max(8, Math.floor(params.pinCount / 4) * 4);
  const sideCount = pinCount / 4;
  const pitch = params.pitch || 0.5;
  const bodySize = params.bodySize || (sideCount * pitch + 1.5);
  const padWidth = params.padWidth || (pitch * 0.55);
  const padLength = params.padLength || 0.60;
  const thermalPadSize = params.thermalPadSize ?? (bodySize - 1.4);

  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  let pinNum = 1;

  // QFN pad center is positioned so pad outer edge touches/slightly extends past nominal body edge
  const padCenterOffset = bodySize / 2 - padLength / 2 + 0.1;

  // 1. Left side (Pins 1..sideCount)
  for (let i = 0; i < sideCount; i++) {
    const py = (i - (sideCount - 1) / 2) * pitch;
    pads.push(
      createSmdPad({
        number: String(pinNum++),
        x: -padCenterOffset,
        y: py,
        width: padLength,
        height: padWidth,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );
  }

  // 2. Bottom side
  for (let i = 0; i < sideCount; i++) {
    const px = (i - (sideCount - 1) / 2) * pitch;
    pads.push(
      createSmdPad({
        number: String(pinNum++),
        x: px,
        y: padCenterOffset,
        width: padWidth,
        height: padLength,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );
  }

  // 3. Right side
  for (let i = 0; i < sideCount; i++) {
    const py = ((sideCount - 1 - i) - (sideCount - 1) / 2) * pitch;
    pads.push(
      createSmdPad({
        number: String(pinNum++),
        x: padCenterOffset,
        y: py,
        width: padLength,
        height: padWidth,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );
  }

  // 4. Top side
  for (let i = 0; i < sideCount; i++) {
    const px = ((sideCount - 1 - i) - (sideCount - 1) / 2) * pitch;
    pads.push(
      createSmdPad({
        number: String(pinNum++),
        x: px,
        y: -padCenterOffset,
        width: padWidth,
        height: padLength,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );
  }

  // Center Exposed Thermal Pad (standard on QFN)
  if (thermalPadSize > 0) {
    const epPads = createExposedThermalPad({
      padNumber: String(pinCount + 1),
      width: thermalPadSize,
      height: thermalPadSize,
      viaCountX: Math.max(2, Math.floor(thermalPadSize / 1.0)),
      viaCountY: Math.max(2, Math.floor(thermalPadSize / 1.0)),
    });
    pads.push(...epPads);
  }

  // Body Outlines (F.Fab)
  const hs = bodySize / 2;
  const chamfer = Math.min(0.8, hs * 0.25);
  graphics.push(createFabBeveledBody(-hs, -hs, hs, hs, chamfer));

  // Reference & Value Text
  graphics.push(createReferenceText(0, -hs - 0.9));
  graphics.push(createValueText(0, hs + 0.9, params.value || `QFN-${pinCount}`));

  // Silkscreen corner ticks (leaving space around corners for KLC)
  const cLen = Math.max(0.4, (hs - (sideCount - 1) / 2 * pitch - padWidth / 2) - 0.2);
  // Top-left Pin 1 corner
  graphics.push(createSilkLine(-hs + chamfer, -hs, -hs + chamfer + cLen, -hs));
  graphics.push(createSilkLine(-hs, -hs + chamfer, -hs + chamfer, -hs));
  graphics.push(createSilkLine(-hs, -hs + chamfer, -hs, -hs + chamfer + cLen));

  // Top-right
  graphics.push(createSilkLine(hs - cLen, -hs, hs, -hs));
  graphics.push(createSilkLine(hs, -hs, hs, -hs + cLen));

  // Bottom-right
  graphics.push(createSilkLine(hs, hs - cLen, hs, hs));
  graphics.push(createSilkLine(hs, hs, hs - cLen, hs));

  // Bottom-left
  graphics.push(createSilkLine(-hs, hs - cLen, -hs, hs));
  graphics.push(createSilkLine(-hs, hs, -hs + cLen, hs));

  // Silk Pin 1 dot outside body
  graphics.push(createSilkPin1Dot(-hs - 0.5, -(sideCount - 1) / 2 * pitch));

  // Courtyard
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  const name = `QFN-${pinCount}-1EP_${bodySize.toFixed(1)}x${bodySize.toFixed(1)}mm_P${pitch.toFixed(2)}mm_EP${thermalPadSize.toFixed(1)}x${thermalPadSize.toFixed(1)}mm`;
  return buildNativeFootprintModel({
    name,
    referencePrefix: params.reference || "U",
    value: params.value || name,
    description: `Quad Flat No-Lead (QFN) ${pinCount} pins, ${bodySize}x${bodySize}mm, pitch ${pitch}mm with thermal pad`,
    tags: ["QFN", "MLF", "DFN", "SMD", "Leadless"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "qfn",
    generatorParams: params,
  });
}
