import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabRect, createFabLine } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export type RfAntennaPackageType =
  | "SMA_Edge_Mount_Jack"
  | "SMA_Vertical_THT"
  | "U.FL_IPEX_SMT"
  | "Antenna_2.4GHz_IFA_PCB"
  | "Antenna_Helical_Wire_1Pin"
  | "Module_NRF24L01_Header_2x4";

export interface RfAntennaParams {
  packageType?: RfAntennaPackageType;
  reference?: string;
  value?: string;
  [key: string]: any;
}

export function generateRfAntenna(params: RfAntennaParams): KicadFootprintModel {
  const pkg = params.packageType || "SMA_Edge_Mount_Jack";
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const isAntenna = pkg.startsWith("Antenna_");
  const ref = params.reference || (isAntenna ? "ANT" : "J");

  // 1. SMA Edge Mount Female Jack (for 1.6mm board edge)
  // Center RF pad at (0, 0), Top/Bottom Ground tabs at (-3.2, 0) and (3.2, 0)
  if (pkg === "SMA_Edge_Mount_Jack") {
    pads.push(createSmdPad({ number: "1", x: 0.0, y: 1.5, width: 1.5, height: 3.5, shape: "roundrect" })); // RF Signal
    pads.push(createSmdPad({ number: "2", x: -3.2, y: 1.5, width: 2.2, height: 4.0, shape: "roundrect" })); // GND Left Top
    pads.push(createSmdPad({ number: "2", x: 3.2, y: 1.5, width: 2.2, height: 4.0, shape: "roundrect" }));  // GND Right Top

    // Bottom layer pads for edge clamp
    pads.push(createSmdPad({ number: "2", x: -3.2, y: 1.5, width: 2.2, height: 4.0, shape: "roundrect", layers: ["B.Cu", "B.Mask"] }));
    pads.push(createSmdPad({ number: "2", x: 3.2, y: 1.5, width: 2.2, height: 4.0, shape: "roundrect", layers: ["B.Cu", "B.Mask"] }));

    // Edge line (y = 0 is PCB edge)
    graphics.push(...createFabRect(-4.5, -9.0, 4.5, 4.0));
    graphics.push(createSilkLine(-4.6, 0, -4.6, -9.1));
    graphics.push(createSilkLine(4.6, 0, 4.6, -9.1));
    graphics.push(createSilkLine(-4.6, -9.1, 4.6, -9.1));
    graphics.push(createSilkPin1Dot(0, 4.0));
    graphics.push(createReferenceText(0, 5.2));
    graphics.push(createValueText(0, -10.2, params.value || "SMA_Edge"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "SMA_Amphenol_132134-11_EdgeMount_1.6mm",
      referencePrefix: ref,
      value: params.value || "SMA_Edge",
      description: "SMA Edge-Mount Female Jack Connector for 1.6mm PCB",
      tags: ["RF", "SMA", "Connector", "EdgeMount", "50-Ohm"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "rf_antenna",
      generatorParams: params,
    });
  }

  // 2. SMA Vertical Through-Hole (Center signal + 4 ground pins 5.08mm)
  if (pkg === "SMA_Vertical_THT") {
    const pitch = 5.08;
    const drill = 1.3;
    const padSize = 2.4;

    pads.push(createThtPad({ number: "1", x: 0.0, y: 0.0, width: 2.0, height: 2.0, shape: "rect", drill: 1.1 })); // Center Signal
    pads.push(createThtPad({ number: "2", x: -pitch / 2, y: -pitch / 2, width: padSize, height: padSize, shape: "oval", drill }));
    pads.push(createThtPad({ number: "2", x: pitch / 2, y: -pitch / 2, width: padSize, height: padSize, shape: "oval", drill }));
    pads.push(createThtPad({ number: "2", x: pitch / 2, y: pitch / 2, width: padSize, height: padSize, shape: "oval", drill }));
    pads.push(createThtPad({ number: "2", x: -pitch / 2, y: pitch / 2, width: padSize, height: padSize, shape: "oval", drill }));

    graphics.push(...createFabRect(-3.5, -3.5, 3.5, 3.5));
    graphics.push(createSilkPin1Dot(-4.0, -pitch / 2));
    graphics.push(createReferenceText(0, -4.5));
    graphics.push(createValueText(0, 4.5, params.value || "SMA_Vertical"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "SMA_Amphenol_132134_Vertical_THT",
      referencePrefix: ref,
      value: params.value || "SMA_Vertical",
      description: "SMA Female Vertical RF Connector Through-Hole 5.08mm",
      tags: ["RF", "SMA", "Connector", "Vertical", "THT", "50-Ohm"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "rf_antenna",
      generatorParams: params,
    });
  }

  // 3. U.FL / IPEX SMT Micro-Coaxial Receptacle (2.0x2.0mm)
  if (pkg === "U.FL_IPEX_SMT") {
    pads.push(createSmdPad({ number: "1", x: 0.0, y: 0.8, width: 0.7, height: 1.0, shape: "roundrect" })); // Signal
    pads.push(createSmdPad({ number: "2", x: -1.05, y: -0.2, width: 1.05, height: 1.8, shape: "roundrect" })); // GND Left
    pads.push(createSmdPad({ number: "2", x: 1.05, y: -0.2, width: 1.05, height: 1.8, shape: "roundrect" }));  // GND Right

    graphics.push(...createFabRect(-1.3, -1.3, 1.3, 1.3));
    graphics.push(createSilkPin1Dot(0, 1.6));
    graphics.push(createReferenceText(0, -2.0));
    graphics.push(createValueText(0, 2.2, params.value || "U.FL_SMT"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "Hirose_U.FL-R-SMT-1_MicroCoaxial",
      referencePrefix: ref,
      value: params.value || "U.FL",
      description: "Hirose U.FL / IPEX Surface Mount Micro-Coaxial RF Receptacle",
      tags: ["RF", "U.FL", "IPEX", "MicroCoaxial", "SMD", "50-Ohm"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "rf_antenna",
      generatorParams: params,
    });
  }

  // 4. 2.4GHz PCB Inverted-F Antenna (IFA) Footprint
  if (pkg === "Antenna_2.4GHz_IFA_PCB") {
    // Pad 1: Feed Pad, Pad 2: Ground Pad (2.0mm pitch)
    pads.push(createSmdPad({ number: "1", x: 0.0, y: 0.0, width: 0.8, height: 1.2, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: 2.0, y: 0.0, width: 0.8, height: 1.2, shape: "roundrect" }));

    // Antenna trace outline in Silk & Fab
    graphics.push(...createFabRect(-2.0, -12.0, 18.0, 1.5));
    // Inverted-F radiator element
    graphics.push(createSilkLine(-1.0, -11.0, 17.0, -11.0));
    graphics.push(createSilkLine(-1.0, -11.0, -1.0, -0.5));
    graphics.push(createSilkLine(2.0, -11.0, 2.0, -0.5));
    graphics.push(createSilkPin1Dot(0, 1.5));
    graphics.push(createReferenceText(8.0, 2.5));
    graphics.push(createValueText(8.0, -13.0, params.value || "Antenna_2.4GHz"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "Antenna_2.4GHz_Inverted-F_PCB_Trace",
      referencePrefix: "ANT",
      value: params.value || "2.4GHz_IFA",
      description: "2.4GHz PCB Inverted-F Antenna (IFA) Trace Keepout & Feed",
      tags: ["Antenna", "RF", "2.4GHz", "WiFi", "Bluetooth", "BLE", "IFA"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "rf_antenna",
      generatorParams: params,
    });
  }

  // 5. Helical Spring Wire Antenna (1-Pin Through-Hole)
  if (pkg === "Antenna_Helical_Wire_1Pin") {
    const drill = 1.0;
    const padSize = 2.0;

    pads.push(createThtPad({ number: "1", x: 0, y: 0, width: padSize, height: padSize, shape: "rect", drill }));

    graphics.push(createSilkCircle(0, 0, 2.5));
    graphics.push(createReferenceText(0, -3.5));
    graphics.push(createValueText(0, 3.5, params.value || "Antenna_Helical"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Antenna_Helical_Wire_D5mm_THT",
      referencePrefix: "ANT",
      value: params.value || "Helical_Ant",
      description: "Single-Pin Through-Hole Pad for 433MHz / 868MHz / 915MHz Helical Wire Spring Antenna",
      tags: ["Antenna", "Helical", "Spring", "RF", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "rf_antenna",
      generatorParams: params,
    });
  }

  // Default: NRF24L01+ 2x4 Header Module Socket
  const pitch = 2.54;
  const rowSpacing = 2.54;
  const drill = 1.0;
  const padSize = 1.7;
  for (let i = 0; i < 4; i++) {
    const py = (i - 1.5) * pitch;
    pads.push(createThtPad({ number: String(i * 2 + 1), x: -rowSpacing / 2, y: py, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    pads.push(createThtPad({ number: String(i * 2 + 2), x: rowSpacing / 2, y: py, width: padSize, height: padSize, shape: "oval", drill }));
  }

  graphics.push(...createFabRect(-2.5, -5.5, 2.5, 5.5));
  // 15x29mm NRF24L01 module outline
  graphics.push(...createFabRect(-7.5, -20.0, 7.5, 9.0));
  graphics.push(createSilkPin1Dot(-rowSpacing / 2 - 1.2, -3.81));
  graphics.push(createReferenceText(0, -21.5));
  graphics.push(createValueText(0, 10.5, params.value || "NRF24L01_Socket"));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

  return buildNativeFootprintModel({
    name: "Module_NRF24L01_Header_2x4_P2.54mm",
    referencePrefix: "MOD",
    value: params.value || "NRF24L01+",
    description: "NRF24L01+ 2.4GHz Transceiver Module 2x4 Pin Header Socket",
    tags: ["RF", "NRF24L01", "2.4GHz", "Wireless", "Transceiver", "THT"],
    pads,
    graphics,
    mountingType: "THT",
    generatorFamily: "rf_antenna",
    generatorParams: params,
  });
}
