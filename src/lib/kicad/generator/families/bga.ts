import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createCirclePad } from "../core/pads";
import { createSilkLine, createSilkPin1Dot } from "../core/silk";
import { createFabBeveledBody } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface BgaParams {
  rows: number;          // e.g. 8, 10, 12, 14, 16
  columns: number;       // e.g. 8, 10, 12, 14, 16
  pitch?: number;        // standard 0.8mm, 1.0mm, 0.5mm
  padDiameter?: number;  // standard 0.4mm (for 0.8 pitch) or 0.5mm (for 1.0 pitch)
  bodyWidth?: number;    // package body width
  bodyLength?: number;   // package body length
  depopulatedCenter?: boolean; // if true, center balls omitted (common in large BGAs)
  reference?: string;
  value?: string;
}

// Letter naming for BGA rows: A, B, C, D, E, F, G, H, J, K, L, M, N, P, R, T, U, V, W, Y (I, O, Q, S, X, Z skipped per JEDEC)
const BGA_ROW_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "P", "R", "T", "U", "V", "W", "Y", "AA", "AB", "AC", "AD"];

export function generateBga(params: BgaParams): KicadFootprintModel {
  const rows = Math.max(2, params.rows);
  const cols = Math.max(2, params.columns);
  const pitch = params.pitch || 0.8;
  const padD = params.padDiameter || (pitch <= 0.5 ? 0.3 : pitch <= 0.8 ? 0.4 : 0.5);
  const bodyW = params.bodyWidth || (cols * pitch + 1.6);
  const bodyL = params.bodyLength || (rows * pitch + 1.6);

  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];

  const centerRowMin = Math.floor(rows / 4);
  const centerRowMax = rows - 1 - centerRowMin;
  const centerColMin = Math.floor(cols / 4);
  const centerColMax = cols - 1 - centerColMin;

  for (let r = 0; r < rows; r++) {
    const rowLabel = BGA_ROW_LETTERS[r] || `R${r + 1}`;
    const py = (r - (rows - 1) / 2) * pitch;

    for (let c = 0; c < cols; c++) {
      const colLabel = String(c + 1);
      const px = (c - (cols - 1) / 2) * pitch;

      // Depopulate center if requested
      if (params.depopulatedCenter && r >= centerRowMin && r <= centerRowMax && c >= centerColMin && c <= centerColMax) {
        continue;
      }

      pads.push(
        createCirclePad({
          number: `${rowLabel}${colLabel}`,
          x: px,
          y: py,
          diameter: padD,
        })
      );
    }
  }

  // F.Fab Body Outline with A1 chamfer
  const hw = bodyW / 2;
  const hl = bodyL / 2;
  const chamfer = Math.min(1.0, hw * 0.25);
  graphics.push(createFabBeveledBody(-hw, -hl, hw, hl, chamfer));
  graphics.push(createValueText(0, hl + 0.9, params.value || `BGA-${pads.length}`));

  // F.SilkS Corners + A1 marker
  const cLen = Math.max(0.6, hw * 0.3);
  graphics.push(createSilkLine(-hw + chamfer, -hl, -hw + chamfer + cLen, -hl));
  graphics.push(createSilkLine(-hw, -hl + chamfer, -hw + chamfer, -hl));
  graphics.push(createSilkLine(-hw, -hl + chamfer, -hw, -hl + chamfer + cLen));

  graphics.push(createSilkLine(hw - cLen, -hl, hw, -hl));
  graphics.push(createSilkLine(hw, -hl, hw, -hl + cLen));

  graphics.push(createSilkLine(hw, hl - cLen, hw, hl));
  graphics.push(createSilkLine(hw, hl, hw - cLen, hl));

  graphics.push(createSilkLine(-hw, hl - cLen, -hw, hl));
  graphics.push(createSilkLine(-hw, hl, -hw + cLen, hl));

  // Silk A1 Indicator Dot outside
  graphics.push(createSilkPin1Dot(-hw - 0.5, -hl - 0.5));

  // Reference Text
  graphics.push(createReferenceText(0, -hl - 0.9));

  // Courtyard
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  const name = `BGA-${pads.length}_${cols}x${rows}_${bodyW.toFixed(1)}x${bodyL.toFixed(1)}mm_P${pitch.toFixed(2)}mm`;
  return buildNativeFootprintModel({
    name,
    referencePrefix: params.reference || "U",
    value: params.value || name,
    description: `Ball Grid Array (BGA) ${pads.length} balls, ${cols}x${rows} grid, pitch ${pitch}mm`,
    tags: ["BGA", "FBGA", "SMD", "Surface Mount"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "bga",
    generatorParams: params,
  });
}
