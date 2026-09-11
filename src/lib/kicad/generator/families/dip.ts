import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createThtPad } from "../core/pads";
import { createSilkLine, createSilkArc, createSilkPin1Dot } from "../core/silk";
import { createFabLine, createFabArc } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface DipParams {
  pinCount: number;
  pitch?: number;        // standard 2.54mm (0.1")
  rowSpacing?: number;   // standard 7.62mm (0.3") or 15.24mm (0.6")
  padWidth?: number;     // standard 1.6mm
  padHeight?: number;    // standard 1.6mm
  drill?: number;        // standard 0.8mm
  bodyWidth?: number;    // standard 6.35mm (for 7.62) or 13.97mm (for 15.24)
  reference?: string;
  value?: string;
  packageType?: string;
  footprintName?: string;
}

export function generateDip(params: DipParams): KicadFootprintModel {
  const pinCount = Math.max(4, Math.floor(params.pinCount / 2) * 2);
  const pitch = params.pitch || 2.54;
  const rowSpacing = params.rowSpacing || (pinCount > 24 ? 15.24 : 7.62);
  const padWidth = params.padWidth || 1.6;
  const padHeight = params.padHeight || 1.6;
  const drill = params.drill || 0.8;
  const half = pinCount / 2;

  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];

  // 1. Pads Layout according to KiCad KLC standard:
  // Pin 1 is top-left (rectangular pad), continuing down to 'half'
  for (let i = 0; i < half; i++) {
    const py = (i - (half - 1) / 2) * pitch;
    const px = -rowSpacing / 2;
    pads.push(
      createThtPad({
        number: String(i + 1),
        x: px,
        y: py,
        width: padWidth,
        height: padHeight,
        shape: i === 0 ? "rect" : "oval",
        drill,
      })
    );
  }

  // Right column: Pins (half + 1) .. pinCount from bottom to top
  for (let i = 0; i < half; i++) {
    const py = ((half - 1 - i) - (half - 1) / 2) * pitch;
    const px = rowSpacing / 2;
    pads.push(
      createThtPad({
        number: String(half + i + 1),
        x: px,
        y: py,
        width: padWidth,
        height: padHeight,
        shape: "oval",
        drill,
      })
    );
  }

  // Nominal body dimensions (JEDEC MS-001)
  const bodyWidth = params.bodyWidth || (rowSpacing <= 7.62 ? 6.35 : rowSpacing - 1.27);
  const bodyLength = half * pitch + 0.3;
  const notchR = Math.min(1.27, bodyWidth * 0.22);
  const topY = -bodyLength / 2;
  const botY = bodyLength / 2;
  const leftX = -bodyWidth / 2;
  const rightX = bodyWidth / 2;
  const chamfer = Math.min(1.0, bodyWidth * 0.18);

  // F.Fab Nominal Body Outline with Pin 1 chamfer and notch
  graphics.push(createFabLine(leftX + chamfer, topY, -notchR, topY));
  graphics.push({
    kind: "arc",
    layer: KLC_RULES.layers.fab,
    start: { x: -notchR, y: topY },
    mid: { x: 0, y: topY + notchR },
    end: { x: notchR, y: topY },
    stroke: { width: KLC_RULES.strokeWidth.fab },
  });
  graphics.push(createFabLine(notchR, topY, rightX, topY));
  graphics.push(createFabLine(rightX, topY, rightX, botY));
  graphics.push(createFabLine(rightX, botY, leftX, botY));
  graphics.push(createFabLine(leftX, botY, leftX, topY + chamfer));
  graphics.push(createFabLine(leftX, topY + chamfer, leftX + chamfer, topY));

  // Value text on F.Fab directly below footprint body
  graphics.push(createValueText(0, botY + 1.3, params.value || `DIP-${pinCount}_W${rowSpacing.toFixed(1)}mm`));

  // F.SilkS Body Outline with notch & Pin 1 indicator (KLC clearance >= 0.2mm)
  const silkClearance = 0.25;
  const silkLeftX = -rowSpacing / 2 + padWidth / 2 + silkClearance;
  const silkRightX = rowSpacing / 2 - padWidth / 2 - silkClearance;

  graphics.push(createSilkLine(silkLeftX, topY, -notchR, topY));
  graphics.push(createSilkArc(-notchR, topY, 0, topY + notchR, notchR, topY));
  graphics.push(createSilkLine(notchR, topY, silkRightX, topY));
  graphics.push(createSilkLine(silkRightX, topY, silkRightX, botY));
  graphics.push(createSilkLine(silkRightX, botY, silkLeftX, botY));
  graphics.push(createSilkLine(silkLeftX, botY, silkLeftX, topY));

  // Silk Pin 1 indicator line extending above pad 1
  const pin1X = -rowSpacing / 2;
  const pin1Y = -(half - 1) / 2 * pitch;
  graphics.push(createSilkLine(silkLeftX, topY, pin1X - padWidth / 2 - 0.4, topY));
  graphics.push(createSilkPin1Dot(pin1X - padWidth / 2 - 0.6, pin1Y));

  // Reference text on F.SilkS
  graphics.push(createReferenceText(0, topY - 1.3));

  // F.CrtYd Courtyard Outline (0.50mm clearance for THT)
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

  const name = params.footprintName || params.packageType || `DIP-${pinCount}_W${rowSpacing.toFixed(1)}mm_Socket`;
  return buildNativeFootprintModel({
    name,
    referencePrefix: params.reference || "U",
    value: params.value || name,
    description: `Dual In-line Package (DIP) ${pinCount} pins, row spacing ${rowSpacing}mm, pitch ${pitch}mm`,
    tags: ["DIP", "PDIP", "DIL", "Through-Hole"],
    pads,
    graphics,
    mountingType: "THT",
    generatorFamily: "dip",
    generatorParams: params,
  });
}
