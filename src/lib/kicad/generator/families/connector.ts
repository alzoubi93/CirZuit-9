import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createThtPad } from "../core/pads";
import { createSilkLine, createSilkPin1Dot } from "../core/silk";
import { createFabRect } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface ConnectorParams {
  rows?: 1 | 2;
  pinCount: number;      // total pins
  pitch?: number;        // standard 2.54mm, 2.0mm, 1.27mm, 3.5mm, 5.0mm, 5.08mm
  rowSpacing?: number;   // standard 2.54mm for 2-row headers
  padWidth?: number;     // pad size (e.g. 1.7mm)
  padHeight?: number;    // pad size (e.g. 1.7mm)
  drill?: number;        // drill diameter (e.g. 1.0mm)
  connectorType?: "Header" | "Socket" | "TerminalBlock";
  shrouded?: boolean;
  reference?: string;
  value?: string;
}

export function generateConnector(params: ConnectorParams): KicadFootprintModel {
  const rows = params.rows || (params.pinCount > 1 && params.rowSpacing ? 2 : 1);
  const totalPins = Math.max(1, params.pinCount);
  const pinsPerRow = rows === 2 ? Math.ceil(totalPins / 2) : totalPins;
  const pitch = params.pitch || (params.connectorType === "TerminalBlock" ? 5.08 : 2.54);
  const rowSpacing = rows === 2 ? (params.rowSpacing || pitch) : 0;
  const padW = params.padWidth || (params.connectorType === "TerminalBlock" ? 2.5 : 1.7);
  const padH = params.padHeight || (params.connectorType === "TerminalBlock" ? 2.5 : 1.7);
  const drill = params.drill || (params.connectorType === "TerminalBlock" ? 1.3 : 1.0);

  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];

  // ==========================================
  // 1-ROW PIN HEADER / TERMINAL BLOCK
  // ==========================================
  if (rows === 1) {
    for (let i = 0; i < pinsPerRow; i++) {
      const py = (i - (pinsPerRow - 1) / 2) * pitch;
      pads.push(
        createThtPad({
          number: String(i + 1),
          x: 0,
          y: py,
          width: padW,
          height: padH,
          shape: i === 0 ? "rect" : "oval",
          drill,
        })
      );
    }

    const boxW = params.connectorType === "TerminalBlock" ? 8.0 : 2.54;
    const boxH = pinsPerRow * pitch + (params.connectorType === "TerminalBlock" ? 1.0 : 0.5);

    // F.Fab Outline
    graphics.push(...createFabRect(-boxW / 2, -boxH / 2, boxW / 2, boxH / 2));

    // F.SilkS Outline
    const sH = boxH / 2 + 0.1;
    const sW = boxW / 2 + 0.1;
    graphics.push(createSilkLine(-sW, -sH, sW, -sH));
    graphics.push(createSilkLine(sW, -sH, sW, sH));
    graphics.push(createSilkLine(sW, sH, -sW, sH));
    graphics.push(createSilkLine(-sW, sH, -sW, -sH));

    // Value Text
    graphics.push(createValueText(0, sH + 0.9, params.value || `Conn_01x${pinsPerRow}`));

    // Silk Pin 1 Marker
    const p1Y = -(pinsPerRow - 1) / 2 * pitch;
    graphics.push(createSilkPin1Dot(-sW - 0.5, p1Y));

    // Reference Text
    graphics.push(createReferenceText(0, -sH - 0.9));

    // Courtyard
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardConnector));

    const name = `${params.connectorType || "PinHeader"}_1x${pinsPerRow}_P${pitch.toFixed(2)}mm_Vertical`;
    return buildNativeFootprintModel({
      name,
      referencePrefix: params.reference || "J",
      value: params.value || name,
      description: `${params.connectorType || "Connector"} 1 row, ${pinsPerRow} pins, pitch ${pitch}mm`,
      tags: ["Connector", "Header", "PinHeader", "1-Row", "Through-Hole"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "connector",
      generatorParams: params,
    });
  }

  // ==========================================
  // 2-ROW PIN HEADER / SOCKET
  // ==========================================
  // Standard KiCad 2-row numbering:
  // Pin 1 (top-left), Pin 2 (top-right)
  // Pin 3 (second left), Pin 4 (second right)
  let pNum = 1;
  for (let i = 0; i < pinsPerRow; i++) {
    const py = (i - (pinsPerRow - 1) / 2) * pitch;
    // Left pin
    pads.push(
      createThtPad({
        number: String(pNum++),
        x: -rowSpacing / 2,
        y: py,
        width: padW,
        height: padH,
        shape: pNum === 2 ? "rect" : "oval",
        drill,
      })
    );
    // Right pin
    pads.push(
      createThtPad({
        number: String(pNum++),
        x: rowSpacing / 2,
        y: py,
        width: padW,
        height: padH,
        shape: "oval",
        drill,
      })
    );
  }

  const boxW = rowSpacing + 2.54;
  const boxH = pinsPerRow * pitch + 0.5;

  // F.Fab
  graphics.push(...createFabRect(-boxW / 2, -boxH / 2, boxW / 2, boxH / 2));

  // F.SilkS
  const sH = boxH / 2 + 0.1;
  const sW = boxW / 2 + 0.1;
  graphics.push(createSilkLine(-sW, -sH, sW, -sH));
  graphics.push(createSilkLine(sW, -sH, sW, sH));
  graphics.push(createSilkLine(sW, sH, -sW, sH));
  graphics.push(createSilkLine(-sW, sH, -sW, -sH));

  // Value Text
  graphics.push(createValueText(0, sH + 0.9, params.value || `Conn_02x${pinsPerRow}`));

  // Pin 1 indicator
  const p1Y = -(pinsPerRow - 1) / 2 * pitch;
  graphics.push(createSilkPin1Dot(-sW - 0.5, p1Y));

  // Reference Text
  graphics.push(createReferenceText(0, -sH - 0.9));

  // Courtyard
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardConnector));

  const name = `PinHeader_2x${pinsPerRow}_P${pitch.toFixed(2)}mm_Vertical`;
  return buildNativeFootprintModel({
    name,
    referencePrefix: params.reference || "J",
    value: params.value || name,
    description: `Connector 2 rows, ${pinsPerRow * 2} pins, pitch ${pitch}mm`,
    tags: ["Connector", "Header", "PinHeader", "2-Row", "Through-Hole"],
    pads,
    graphics,
    mountingType: "THT",
    generatorFamily: "connector",
    generatorParams: params,
  });
}
