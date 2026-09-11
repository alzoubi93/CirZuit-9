import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad } from "../core/pads";
import { createSilkLine, createSilkPin1Dot } from "../core/silk";
import { createFabBeveledBody } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { createExposedThermalPad } from "../core/thermal";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface SoicParams {
  pinCount: number;
  pitch?: number;        // standard 1.27mm for SOIC, 0.65mm for TSSOP, 0.5mm for MSOP
  rowSpacing?: number;   // pad center-to-center span (e.g. 5.4mm for SOIC-narrow, 9.4mm for SOIC-wide)
  padWidth?: number;     // pad length in X (e.g. 1.55mm)
  padHeight?: number;    // pad width in Y (e.g. 0.6mm)
  bodyWidth?: number;    // nominal plastic body width (e.g. 3.9mm)
  hasThermalPad?: boolean;
  thermalPadWidth?: number;
  thermalPadHeight?: number;
  packageSubtype?: "SOIC" | "TSSOP" | "MSOP" | "SO";
  reference?: string;
  value?: string;
}

export function generateSoic(params: SoicParams): KicadFootprintModel {
  const pinCount = Math.max(4, Math.floor(params.pinCount / 2) * 2);
  const pitch = params.pitch || (params.packageSubtype === "TSSOP" ? 0.65 : params.packageSubtype === "MSOP" ? 0.5 : 1.27);
  const rowSpacing = params.rowSpacing || (params.packageSubtype === "TSSOP" ? 6.4 : params.packageSubtype === "MSOP" ? 4.9 : 5.4);
  const padWidth = params.padWidth || (params.packageSubtype === "TSSOP" ? 1.45 : params.packageSubtype === "MSOP" ? 1.0 : 1.55);
  const padHeight = params.padHeight || (params.packageSubtype === "TSSOP" ? 0.45 : params.packageSubtype === "MSOP" ? 0.3 : 0.6);
  const half = pinCount / 2;

  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];

  // 1. Left Row: Pins 1..half from top to bottom
  for (let i = 0; i < half; i++) {
    const py = (i - (half - 1) / 2) * pitch;
    const px = -rowSpacing / 2;
    pads.push(
      createSmdPad({
        number: String(i + 1),
        x: px,
        y: py,
        width: padWidth,
        height: padHeight,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );
  }

  // 2. Right Row: Pins (half + 1)..pinCount from bottom to top
  for (let i = 0; i < half; i++) {
    const py = ((half - 1 - i) - (half - 1) / 2) * pitch;
    const px = rowSpacing / 2;
    pads.push(
      createSmdPad({
        number: String(half + i + 1),
        x: px,
        y: py,
        width: padWidth,
        height: padHeight,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );
  }

  // Optional Exposed Thermal Pad (EP)
  if (params.hasThermalPad && params.thermalPadWidth && params.thermalPadHeight) {
    const epPads = createExposedThermalPad({
      padNumber: String(pinCount + 1),
      width: params.thermalPadWidth,
      height: params.thermalPadHeight,
      viaCountX: 2,
      viaCountY: 2,
    });
    pads.push(...epPads);
  }

  // Body Dimensions
  const innerPadEdge = Math.max(0.6, rowSpacing / 2 - padWidth / 2);
  const maxBodyWidth = Math.max(1.0, (innerPadEdge - 0.15) * 2);
  const bodyWidth = Math.min(params.bodyWidth || 3.9, maxBodyWidth);
  const bodyHeight = (half - 0.15) * pitch;

  const leftX = -bodyWidth / 2;
  const rightX = bodyWidth / 2;
  const topY = -bodyHeight / 2;
  const botY = bodyHeight / 2;
  const chamfer = Math.min(0.8, bodyWidth * 0.25);

  // 1. F.Fab - Nominal Body Outline with 45-degree chamfer for Pin 1
  graphics.push(createFabBeveledBody(leftX, topY, rightX, botY, chamfer));

  // 2. F.SilkS - Top & bottom horizontal bars outside pad area
  const padOuterY = (half - 1) / 2 * pitch + padHeight / 2;
  const silkTopY = Math.min(topY - 0.15, -padOuterY - 0.2);
  const silkBotY = Math.max(botY + 0.15, padOuterY + 0.2);

  // Value text on F.Fab directly below footprint body
  graphics.push(createValueText(0, silkBotY + 0.9, params.value || `SOIC-${pinCount}`));

  graphics.push(createSilkLine(leftX, silkTopY, rightX, silkTopY));
  graphics.push(createSilkLine(leftX, silkBotY, rightX, silkBotY));

  // Pin 1 indicator dot on Silkscreen
  const padOuterX = rowSpacing / 2 + padWidth / 2;
  const p1DotX = -padOuterX - 0.5;
  const p1DotY = -(half - 1) / 2 * pitch;
  graphics.push(createSilkPin1Dot(p1DotX, p1DotY));

  // Reference text on F.SilkS
  graphics.push(createReferenceText(0, silkTopY - 0.9));

  // 3. F.CrtYd - Courtyard Boundary (0.25mm IPC Level B clearance)
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  const subtype = params.packageSubtype || "SOIC";
  const name = `${subtype}-${pinCount}_${bodyWidth.toFixed(1)}x${bodyHeight.toFixed(1)}mm_P${pitch.toFixed(2)}mm`;
  return buildNativeFootprintModel({
    name,
    referencePrefix: params.reference || "U",
    value: params.value || name,
    description: `${subtype} ${pinCount} pins, pitch ${pitch}mm, body ${bodyWidth}x${bodyHeight}mm`,
    tags: [subtype, "SO", "SMD", "Surface Mount"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "soic",
    generatorParams: params,
  });
}
