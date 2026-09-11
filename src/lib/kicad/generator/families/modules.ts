import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabRect } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export type ModulesPackageType =
  | "Module_ESP32_WROOM_32"
  | "Module_ESP8266_ESP12E"
  | "Module_Arduino_Nano_Header"
  | "Module_RaspberryPi_Pico"
  | "Module_Buck_LM2596"
  | "Module_Buck_Mini360"
  | "Module_TP4056_Charger";

export interface ModulesParams {
  packageType?: ModulesPackageType;
  reference?: string;
  value?: string;
  [key: string]: any;
}

export function generateModules(params: ModulesParams): KicadFootprintModel {
  const pkg = params.packageType || "Module_ESP32_WROOM_32";
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const ref = params.reference || "U";

  // 1. ESP32-WROOM-32 / ESP32D (38 Castellated Pads, 18.0mm x 25.5mm, 1.27mm pitch)
  // Left side: 14 pins, Bottom side: 10 pins, Right side: 14 pins, Center Thermal Pad
  if (pkg === "Module_ESP32_WROOM_32") {
    const pitch = 1.27;
    const padW = 2.0;
    const padH = 0.9;
    const width = 18.0;
    const height = 25.5;

    // Pin 1..14 (Left side, from top to bottom)
    for (let i = 0; i < 14; i++) {
      const py = -4.0 + i * pitch;
      pads.push(createSmdPad({ number: String(i + 1), x: -width / 2, y: py, width: padW, height: padH, shape: "roundrect" }));
    }
    // Pin 15..24 (Bottom side, from left to right)
    for (let i = 0; i < 10; i++) {
      const px = -5.715 + i * pitch;
      pads.push(createSmdPad({ number: String(i + 15), x: px, y: height / 2 - 3.5, width: padH, height: padW, shape: "roundrect" }));
    }
    // Pin 25..38 (Right side, from bottom to top)
    for (let i = 0; i < 14; i++) {
      const py = -4.0 + (13 - i) * pitch;
      pads.push(createSmdPad({ number: String(i + 25), x: width / 2, y: py, width: padW, height: padH, shape: "roundrect" }));
    }
    // Center Thermal Pad 39
    pads.push(createSmdPad({ number: "39", x: 0, y: 1.5, width: 6.0, height: 6.0, shape: "roundrect" }));

    // Antenna keepout line
    graphics.push(...createFabRect(-width / 2, -height / 2, width / 2, height / 2));
    graphics.push(createSilkLine(-width / 2, -height / 2 + 5.5, width / 2, -height / 2 + 5.5)); // PCB antenna line
    graphics.push(createSilkPin1Dot(-width / 2 - 1.5, -4.0));
    graphics.push(createReferenceText(0, -height / 2 - 1.5));
    graphics.push(createValueText(0, height / 2 + 1.5, params.value || "ESP32-WROOM-32"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "RF_Module_ESP32-WROOM-32",
      referencePrefix: ref,
      value: params.value || "ESP32-WROOM-32",
      description: "Espressif ESP32-WROOM-32 Wi-Fi & Bluetooth Module 38-Castellated SMD",
      tags: ["Module", "ESP32", "WiFi", "Bluetooth", "SMD", "Espressif"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "modules",
      generatorParams: params,
    });
  }

  // 2. Arduino Nano Header (2 rows of 15 pins, 15.24mm spacing, 2.54mm pitch)
  if (pkg === "Module_Arduino_Nano_Header") {
    const pitch = 2.54;
    const rowSpacing = 15.24;
    const drill = 1.0;
    const padSize = 1.7;

    for (let i = 0; i < 15; i++) {
      const py = (i - 7) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: -rowSpacing / 2, y: py, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
      pads.push(createThtPad({ number: String(30 - i), x: rowSpacing / 2, y: py, width: padSize, height: padSize, shape: "oval", drill }));
    }

    // Nano Board Outline 17.8mm x 43.2mm
    graphics.push(...createFabRect(-8.9, -21.6, 8.9, 21.6));
    // Mini-B / Type-C connector outline at top
    graphics.push(...createFabRect(-4.0, -22.5, 4.0, -17.0));
    graphics.push(createSilkPin1Dot(-rowSpacing / 2 - 1.3, -7 * pitch));
    graphics.push(createReferenceText(0, -23.5));
    graphics.push(createValueText(0, 23.5, params.value || "Arduino_Nano"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Module_Arduino_Nano",
      referencePrefix: ref,
      value: params.value || "Arduino_Nano",
      description: "Arduino Nano Development Board Pin Socket Footprint (2x15 15.24mm spacing)",
      tags: ["Module", "Arduino", "Nano", "Microcontroller", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "modules",
      generatorParams: params,
    });
  }

  // 3. Raspberry Pi Pico (2 rows of 20 castellated/THT pads, 17.78mm spacing)
  if (pkg === "Module_RaspberryPi_Pico") {
    const pitch = 2.54;
    const rowSpacing = 17.78;
    const drill = 1.0;
    const padSize = 1.8;

    for (let i = 0; i < 20; i++) {
      const py = (i - 9.5) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: -rowSpacing / 2, y: py, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
      pads.push(createThtPad({ number: String(40 - i), x: rowSpacing / 2, y: py, width: padSize, height: padSize, shape: "oval", drill }));
    }

    // 3 SWD debug pads at bottom
    pads.push(createThtPad({ number: "SW1", x: -pitch, y: 12.0 * pitch - 9.5 * pitch, width: 1.4, height: 1.4, shape: "oval", drill: 0.8 }));
    pads.push(createThtPad({ number: "SW2", x: 0, y: 12.0 * pitch - 9.5 * pitch, width: 1.4, height: 1.4, shape: "oval", drill: 0.8 }));
    pads.push(createThtPad({ number: "SW3", x: pitch, y: 12.0 * pitch - 9.5 * pitch, width: 1.4, height: 1.4, shape: "oval", drill: 0.8 }));

    // Board Outline 21.0mm x 51.0mm
    graphics.push(...createFabRect(-10.5, -25.5, 10.5, 25.5));
    graphics.push(createSilkPin1Dot(-rowSpacing / 2 - 1.3, -9.5 * pitch));
    graphics.push(createReferenceText(0, -27.0));
    graphics.push(createValueText(0, 27.5, params.value || "RPi_Pico"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Module_RaspberryPi_Pico",
      referencePrefix: ref,
      value: params.value || "RPi_Pico",
      description: "Raspberry Pi Pico RP2040 Microcontroller Module 40-Pin Header",
      tags: ["Module", "RaspberryPi", "Pico", "RP2040", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "modules",
      generatorParams: params,
    });
  }

  // 4. LM2596 DC-DC Buck Converter Module (4 Corner THT pads: IN+, IN-, OUT+, OUT-)
  if (pkg === "Module_Buck_LM2596") {
    const drill = 1.4;
    const padSize = 3.0;

    pads.push(createThtPad({ number: "IN+", x: -20.0, y: -9.0, width: padSize, height: padSize, shape: "rect", drill }));
    pads.push(createThtPad({ number: "IN-", x: -20.0, y: 9.0, width: padSize, height: padSize, shape: "oval", drill }));
    pads.push(createThtPad({ number: "OUT+", x: 20.0, y: -9.0, width: padSize, height: padSize, shape: "oval", drill }));
    pads.push(createThtPad({ number: "OUT-", x: 20.0, y: 9.0, width: padSize, height: padSize, shape: "oval", drill }));

    // PCB 43.5mm x 21.0mm
    graphics.push(...createFabRect(-21.75, -10.5, 21.75, 10.5));
    graphics.push(createSilkLine(-21.85, -10.6, 21.85, -10.6));
    graphics.push(createSilkLine(21.85, -10.6, 21.85, 10.6));
    graphics.push(createSilkLine(21.85, 10.6, -21.85, 10.6));
    graphics.push(createSilkLine(-21.85, 10.6, -21.85, -10.6));
    graphics.push(createSilkPin1Dot(-20.0, -6.5));
    graphics.push(createReferenceText(0, -12.0));
    graphics.push(createValueText(0, 12.0, params.value || "LM2596_Module"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Module_DC-DC_Buck_LM2596",
      referencePrefix: "MOD",
      value: params.value || "LM2596",
      description: "LM2596 Step-Down DC-DC Buck Converter Adjustable Module",
      tags: ["Module", "Power", "Buck", "DC-DC", "LM2596", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "modules",
      generatorParams: params,
    });
  }

  // 5. Mini-360 DC-DC Buck Converter (4 SMD corner pads)
  if (pkg === "Module_Buck_Mini360") {
    pads.push(createSmdPad({ number: "IN+", x: -7.0, y: -4.5, width: 2.0, height: 2.0, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "IN-", x: -7.0, y: 4.5, width: 2.0, height: 2.0, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "OUT+", x: 7.0, y: -4.5, width: 2.0, height: 2.0, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "OUT-", x: 7.0, y: 4.5, width: 2.0, height: 2.0, shape: "roundrect" }));

    graphics.push(...createFabRect(-8.5, -5.5, 8.5, 5.5));
    graphics.push(createSilkPin1Dot(-7.0, -2.5));
    graphics.push(createReferenceText(0, -6.8));
    graphics.push(createValueText(0, 6.8, params.value || "Mini360_Buck"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "Module_DC-DC_Buck_Mini-360",
      referencePrefix: "MOD",
      value: params.value || "Mini-360",
      description: "Mini-360 Ultra-Small Synchronous Buck Converter Module SMD",
      tags: ["Module", "Power", "Buck", "DC-DC", "Mini-360", "SMD"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "modules",
      generatorParams: params,
    });
  }

  // Default: TP4056 Li-Ion Battery Charger Module
  const drill = 1.2;
  const padSize = 2.4;
  pads.push(createThtPad({ number: "IN+", x: -12.0, y: -8.0, width: padSize, height: padSize, shape: "rect", drill }));
  pads.push(createThtPad({ number: "IN-", x: -12.0, y: 8.0, width: padSize, height: padSize, shape: "oval", drill }));
  pads.push(createThtPad({ number: "B+", x: 12.0, y: -4.0, width: padSize, height: padSize, shape: "oval", drill }));
  pads.push(createThtPad({ number: "B-", x: 12.0, y: 4.0, width: padSize, height: padSize, shape: "oval", drill }));
  pads.push(createThtPad({ number: "OUT+", x: 12.0, y: -8.0, width: padSize, height: padSize, shape: "oval", drill }));
  pads.push(createThtPad({ number: "OUT-", x: 12.0, y: 8.0, width: padSize, height: padSize, shape: "oval", drill }));

  graphics.push(...createFabRect(-13.5, -9.0, 13.5, 9.0));
  graphics.push(createSilkPin1Dot(-12.0, -5.5));
  graphics.push(createReferenceText(0, -10.2));
  graphics.push(createValueText(0, 10.5, params.value || "TP4056_Charger"));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

  return buildNativeFootprintModel({
    name: "Module_Battery_Charger_TP4056_Type-C",
    referencePrefix: "MOD",
    value: params.value || "TP4056",
    description: "TP4056 Li-Ion Battery Charger Module with Protection and USB-C",
    tags: ["Module", "Battery", "Charger", "TP4056", "Li-Ion", "THT"],
    pads,
    graphics,
    mountingType: "THT",
    generatorFamily: "modules",
    generatorParams: params,
  });
}
