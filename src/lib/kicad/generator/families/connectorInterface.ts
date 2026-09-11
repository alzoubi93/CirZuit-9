import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabRect, createFabCircle } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export type ConnectorInterfacePackageType =
  | "USB_C_Receptacle_16Pin"
  | "USB_A_Receptacle_Female_THT"
  | "Micro_USB_B_Receptacle_SMD"
  | "BarrelJack_DC_2.1mm_PJ002A"
  | "RJ45_MagJack_Ethernet_8P"
  | "JST_XH_2Pin_2.54mm"
  | "JST_XH_3Pin_2.54mm"
  | "JST_XH_4Pin_2.54mm"
  | "JST_PH_2Pin_2.00mm"
  | "JST_PH_3Pin_2.00mm"
  | "AudioJack_3.5mm_SJ43514";

export interface ConnectorInterfaceParams {
  packageType?: ConnectorInterfacePackageType;
  reference?: string;
  value?: string;
  [key: string]: any;
}

export function generateConnectorInterface(params: ConnectorInterfaceParams): KicadFootprintModel {
  const pkg = params.packageType || "USB_C_Receptacle_16Pin";
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const ref = params.reference || "J";

  // 1. USB Type-C 16-Pin Receptacle (Standard Mid-Mount / Top SMD with 4 shield legs)
  if (pkg === "USB_C_Receptacle_16Pin") {
    // 12 SMD signal pins: A1/B12(GND), A4/B9(VBUS), A5(CC1), A6(DP1), A7(DN1), A8(SBU1), B8(SBU2), B7(DN2), B6(DP2), B5(CC2)
    const pins = [
      { id: "A1", x: -3.2, y: -0.5 }, { id: "A4", x: -2.4, y: -0.5 }, { id: "B9", x: -1.75, y: 0.5 },
      { id: "A5", x: -1.2, y: -0.5 }, { id: "B8", x: -0.75, y: 0.5 }, { id: "A6", x: -0.4, y: -0.5 },
      { id: "A7", x: 0.4, y: -0.5 }, { id: "B7", x: 0.75, y: 0.5 }, { id: "A8", x: 1.2, y: -0.5 },
      { id: "B6", x: 1.75, y: 0.5 }, { id: "B5", x: 2.4, y: -0.5 }, { id: "B1", x: 3.2, y: -0.5 },
    ];
    pins.forEach((p) => {
      pads.push(createSmdPad({ number: p.id, x: p.x, y: p.y, width: 0.35, height: 1.15, shape: "roundrect" }));
    });

    // 4 Heavy Shield Through-Hole tabs
    pads.push(createThtPad({ number: "SH1", x: -4.32, y: -1.5, width: 1.4, height: 2.2, shape: "oval", drill: 0.9 }));
    pads.push(createThtPad({ number: "SH2", x: 4.32, y: -1.5, width: 1.4, height: 2.2, shape: "oval", drill: 0.9 }));
    pads.push(createThtPad({ number: "SH3", x: -4.32, y: 2.5, width: 1.4, height: 2.2, shape: "oval", drill: 0.9 }));
    pads.push(createThtPad({ number: "SH4", x: 4.32, y: 2.5, width: 1.4, height: 2.2, shape: "oval", drill: 0.9 }));

    graphics.push(...createFabRect(-4.5, -3.5, 4.5, 3.8));
    graphics.push(createSilkLine(-4.5, -3.6, 4.5, -3.6));
    graphics.push(createSilkPin1Dot(-3.5, -1.5));
    graphics.push(createReferenceText(0, -4.5));
    graphics.push(createValueText(0, 4.8, params.value || "USB_C_16P"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "USB_C_Receptacle_16Pin_SMD_THT",
      referencePrefix: ref,
      value: params.value || "USB_C",
      description: "USB Type-C 16-Pin Receptacle Hybrid SMD with 4 THT Shield Tabs",
      tags: ["Connector", "USB", "USB-C", "Type-C"],
      pads,
      graphics,
      mountingType: "Both",
      generatorFamily: "connector_interface",
      generatorParams: params,
    });
  }

  // 2. USB Type-A Receptacle Female Right-Angle (4-Pin THT + 2 Shield Tabs)
  if (pkg === "USB_A_Receptacle_Female_THT") {
    // 4 Signal pins: VBUS, D-, D+, GND (Pitch ~2.0mm/2.5mm)
    pads.push(createThtPad({ number: "1", x: -3.5, y: 2.7, width: 1.8, height: 1.8, shape: "rect", drill: 1.0 }));
    pads.push(createThtPad({ number: "2", x: -1.0, y: 2.7, width: 1.8, height: 1.8, shape: "oval", drill: 1.0 }));
    pads.push(createThtPad({ number: "3", x: 1.0, y: 2.7, width: 1.8, height: 1.8, shape: "oval", drill: 1.0 }));
    pads.push(createThtPad({ number: "4", x: 3.5, y: 2.7, width: 1.8, height: 1.8, shape: "oval", drill: 1.0 }));

    // 2 Shell Shield tabs
    pads.push(createThtPad({ number: "SH1", x: -6.55, y: 0.0, width: 2.5, height: 3.5, shape: "oval", drill: 2.3 }));
    pads.push(createThtPad({ number: "SH2", x: 6.55, y: 0.0, width: 2.5, height: 3.5, shape: "oval", drill: 2.3 }));

    graphics.push(...createFabRect(-7.0, -10.5, 7.0, 3.8));
    graphics.push(createSilkLine(-7.1, -10.6, 7.1, -10.6));
    graphics.push(createSilkPin1Dot(-3.5, 4.0));
    graphics.push(createReferenceText(0, -11.5));
    graphics.push(createValueText(0, 5.0, params.value || "USB_A_Female"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "USB_A_Receptacle_Female_Horizontal_THT",
      referencePrefix: ref,
      value: params.value || "USB_A",
      description: "USB Type-A Female Receptacle Right-Angle Through-Hole",
      tags: ["Connector", "USB", "USB-A", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "connector_interface",
      generatorParams: params,
    });
  }

  // 3. Micro-USB Type-B 5-Pin SMD (4 Shield tabs)
  if (pkg === "Micro_USB_B_Receptacle_SMD") {
    // 5 Signal pins: 0.65mm pitch
    const pitch = 0.65;
    for (let i = 0; i < 5; i++) {
      const px = (i - 2) * pitch;
      pads.push(createSmdPad({ number: String(i + 1), x: px, y: 2.65, width: 0.4, height: 1.35, shape: "roundrect" }));
    }
    // 4 Retention shield pads
    pads.push(createThtPad({ number: "SH1", x: -3.6, y: 2.4, width: 1.8, height: 1.8, shape: "oval", drill: 1.1 }));
    pads.push(createThtPad({ number: "SH2", x: 3.6, y: 2.4, width: 1.8, height: 1.8, shape: "oval", drill: 1.1 }));
    pads.push(createThtPad({ number: "SH3", x: -3.6, y: -0.4, width: 1.8, height: 1.8, shape: "oval", drill: 1.1 }));
    pads.push(createThtPad({ number: "SH4", x: 3.6, y: -0.4, width: 1.8, height: 1.8, shape: "oval", drill: 1.1 }));

    graphics.push(...createFabRect(-4.0, -2.5, 4.0, 3.2));
    graphics.push(createSilkPin1Dot(-1.3, 3.6));
    graphics.push(createReferenceText(0, -3.5));
    graphics.push(createValueText(0, 4.5, params.value || "Micro_USB_B"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "USB_Micro-B_Amphenol_10103594",
      referencePrefix: ref,
      value: params.value || "Micro-USB",
      description: "Micro-USB Type-B 5-Pin SMD Receptacle",
      tags: ["Connector", "USB", "Micro-B", "SMD"],
      pads,
      graphics,
      mountingType: "Both",
      generatorFamily: "connector_interface",
      generatorParams: params,
    });
  }

  // 4. DC Barrel Jack 2.1mm / 5.5mm (PJ-002A)
  // 3 Pins: Pin 1 (Center +), Pin 2 (Sleeve -), Pin 3 (Switch)
  if (pkg === "BarrelJack_DC_2.1mm_PJ002A") {
    pads.push(createThtPad({ number: "1", x: 0.0, y: 0.0, width: 3.0, height: 3.0, shape: "rect", drill: 1.8 }));
    pads.push(createThtPad({ number: "2", x: 4.8, y: 0.0, width: 3.0, height: 3.0, shape: "oval", drill: 1.8 }));
    pads.push(createThtPad({ number: "3", x: 2.4, y: 4.7, width: 3.0, height: 3.0, shape: "oval", drill: 1.8 }));

    graphics.push(...createFabRect(-2.0, -4.5, 11.5, 4.5));
    graphics.push(createSilkLine(-2.1, -4.6, 11.6, -4.6));
    graphics.push(createSilkLine(11.6, -4.6, 11.6, 4.6));
    graphics.push(createSilkLine(11.6, 4.6, -2.1, 4.6));
    graphics.push(createSilkLine(-2.1, 4.6, -2.1, -4.6));
    graphics.push(createSilkPin1Dot(0, -2.0));
    graphics.push(createReferenceText(4.5, -5.5));
    graphics.push(createValueText(4.5, 5.8, params.value || "DC_Jack_2.1mm"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "BarrelJack_Horizontal_2.1x5.5mm_PJ-002A",
      referencePrefix: ref,
      value: params.value || "Barrel_Jack",
      description: "DC Power Barrel Jack 2.1mm ID / 5.5mm OD Horizontal",
      tags: ["Connector", "BarrelJack", "Power", "DC", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "connector_interface",
      generatorParams: params,
    });
  }

  // 5. RJ45 MagJack Ethernet 8P8C
  if (pkg === "RJ45_MagJack_Ethernet_8P") {
    const pitch = 1.02;
    for (let i = 0; i < 8; i++) {
      const px = (i - 3.5) * pitch;
      const py = (i % 2 === 0) ? -2.54 : 0;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: py, width: 1.5, height: 1.5, shape: i === 0 ? "rect" : "oval", drill: 0.9 }));
    }
    // 2 LED pins or Shield pins
    pads.push(createThtPad({ number: "SH1", x: -8.1, y: 3.5, width: 2.2, height: 2.2, shape: "oval", drill: 1.6 }));
    pads.push(createThtPad({ number: "SH2", x: 8.1, y: 3.5, width: 2.2, height: 2.2, shape: "oval", drill: 1.6 }));

    graphics.push(...createFabRect(-8.5, -11.0, 8.5, 5.5));
    graphics.push(createSilkPin1Dot(-4.5, -3.5));
    graphics.push(createReferenceText(0, -12.0));
    graphics.push(createValueText(0, 6.8, params.value || "RJ45_MagJack"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "RJ45_Amphenol_RJMG1BD388101R_Horizontal",
      referencePrefix: ref,
      value: params.value || "RJ45",
      description: "RJ45 8P8C Modular Jack with Integrated Magnetics (MagJack)",
      tags: ["Connector", "RJ45", "Ethernet", "MagJack", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "connector_interface",
      generatorParams: params,
    });
  }

  // 6. JST-XH (2P, 3P, 4P) Pitch 2.54mm Keyed Shrouded Header
  if (pkg.startsWith("JST_XH_")) {
    const pinCount = pkg.includes("2Pin") ? 2 : pkg.includes("3Pin") ? 3 : 4;
    const pitch = 2.54;
    const drill = 1.0;
    const padSize = 1.7;

    for (let i = 0; i < pinCount; i++) {
      const px = (i - (pinCount - 1) / 2) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: 0, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }

    const boxW = (pinCount + 1) * pitch + 2.4;
    graphics.push(...createFabRect(-boxW / 2, -2.8, boxW / 2, 3.0));
    graphics.push(createSilkLine(-boxW / 2 - 0.1, -2.9, boxW / 2 + 0.1, -2.9));
    graphics.push(createSilkLine(boxW / 2 + 0.1, -2.9, boxW / 2 + 0.1, 3.1));
    graphics.push(createSilkLine(boxW / 2 + 0.1, 3.1, -boxW / 2 - 0.1, 3.1));
    graphics.push(createSilkLine(-boxW / 2 - 0.1, 3.1, -boxW / 2 - 0.1, -2.9));
    graphics.push(createSilkPin1Dot(-(pinCount - 1) / 2 * pitch, -1.8));
    graphics.push(createReferenceText(0, -3.8));
    graphics.push(createValueText(0, 4.0, params.value || `JST_XH_${pinCount}P`));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: `JST_XH_B${pinCount}B-XH-A_1x${pinCount}_P2.54mm_Vertical`,
      referencePrefix: ref,
      value: params.value || `JST_XH_${pinCount}P`,
      description: `JST XH series ${pinCount}-Pin Keyed Shrouded Header 2.54mm Pitch`,
      tags: ["Connector", "JST", "XH", `${pinCount}Pin`, "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "connector_interface",
      generatorParams: params,
    });
  }

  // 7. JST-PH (2P, 3P) Pitch 2.00mm
  if (pkg.startsWith("JST_PH_")) {
    const pinCount = pkg.includes("2Pin") ? 2 : 3;
    const pitch = 2.00;
    const drill = 0.8;
    const padSize = 1.4;

    for (let i = 0; i < pinCount; i++) {
      const px = (i - (pinCount - 1) / 2) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: 0, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }

    const boxW = (pinCount + 1) * pitch + 1.8;
    graphics.push(...createFabRect(-boxW / 2, -2.5, boxW / 2, 2.5));
    graphics.push(createSilkPin1Dot(-(pinCount - 1) / 2 * pitch, -1.5));
    graphics.push(createReferenceText(0, -3.4));
    graphics.push(createValueText(0, 3.4, params.value || `JST_PH_${pinCount}P`));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: `JST_PH_B${pinCount}B-PH-K_1x${pinCount}_P2.00mm_Vertical`,
      referencePrefix: ref,
      value: params.value || `JST_PH_${pinCount}P`,
      description: `JST PH series ${pinCount}-Pin Keyed Shrouded Header 2.00mm Pitch`,
      tags: ["Connector", "JST", "PH", `${pinCount}Pin`, "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "connector_interface",
      generatorParams: params,
    });
  }

  // 8. 3.5mm Stereo Audio Jack (SJ-43514 / PJ-320D)
  pads.push(createThtPad({ number: "1", x: -3.5, y: -2.5, width: 2.0, height: 2.0, shape: "rect", drill: 1.2 }));
  pads.push(createThtPad({ number: "2", x: -3.5, y: 2.5, width: 2.0, height: 2.0, shape: "oval", drill: 1.2 }));
  pads.push(createThtPad({ number: "3", x: 3.5, y: -2.5, width: 2.0, height: 2.0, shape: "oval", drill: 1.2 }));
  pads.push(createThtPad({ number: "4", x: 3.5, y: 2.5, width: 2.0, height: 2.0, shape: "oval", drill: 1.2 }));
  pads.push(createThtPad({ number: "5", x: 0.0, y: 3.5, width: 2.0, height: 2.0, shape: "oval", drill: 1.2 }));

  graphics.push(...createFabRect(-6.0, -3.5, 6.0, 4.5));
  graphics.push(createSilkPin1Dot(-3.5, -4.2));
  graphics.push(createReferenceText(0, -5.2));
  graphics.push(createValueText(0, 5.8, params.value || "AudioJack_3.5mm"));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

  return buildNativeFootprintModel({
    name: "AudioJack_3.5mm_CUI_SJ-43514_Horizontal",
    referencePrefix: ref,
    value: params.value || "AudioJack",
    description: "3.5mm Stereo Audio Jack TRRS Through-Hole Horizontal",
    tags: ["Connector", "Audio", "3.5mm", "TRRS", "THT"],
    pads,
    graphics,
    mountingType: "THT",
    generatorFamily: "connector_interface",
    generatorParams: params,
  });
}
