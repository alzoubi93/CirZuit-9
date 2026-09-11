import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabRect, createFabCircle } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface SwitchRelayStandardPackage {
  id: string;
  name: string;
  category: "tactile" | "slide" | "dip" | "relay" | "ssr";
  desc: string;
  mounting: "SMD" | "THT";
}

export const STANDARD_SMD_SWITCH_PACKAGES: SwitchRelayStandardPackage[] = [
  // Tactile SMD
  { id: "Tactile_6x6mm_SMD", name: "Tactile 6x6mm SMD", category: "tactile", desc: "4-Lead Gullwing 6×6 mm", mounting: "SMD" },
  { id: "Pushbutton_SMD_3x4mm", name: "Tactile 3x4mm SMD", category: "tactile", desc: "2-Lead ultra-miniature 3×4 mm", mounting: "SMD" },
  { id: "Tactile_3x6mm_SMD", name: "Tactile 3x6mm SMD", category: "tactile", desc: "2-Lead miniature side/top", mounting: "SMD" },
  { id: "Tactile_4x4mm_SMD", name: "Tactile 4x4mm SMD", category: "tactile", desc: "4-Lead sealed micro switch", mounting: "SMD" },

  // Slide SMD
  { id: "SlideSwitch_SMD_SPDT", name: "Slide Switch SPDT SMD", category: "slide", desc: "3-Pin SMT miniature slide switch", mounting: "SMD" },

  // DIP Switches SMD
  { id: "DIP_Switch_SMD_2Pos", name: "DIP Switch 2-Pos SMD", category: "dip", desc: "2-Position Gullwing SMT", mounting: "SMD" },
  { id: "DIP_Switch_SMD_4Pos", name: "DIP Switch 4-Pos SMD", category: "dip", desc: "4-Position Gullwing SMT", mounting: "SMD" },
  { id: "DIP_Switch_SMD_8Pos", name: "DIP Switch 8-Pos SMD", category: "dip", desc: "8-Position Gullwing SMT", mounting: "SMD" },

  // Solid State / PhotoMOS SMD
  { id: "Relay_PhotoMOS_SOP4", name: "PhotoMOS Relay SOP-4", category: "ssr", desc: "Solid State Relay 4-Pin SOP", mounting: "SMD" },
];

export const QUICK_STANDARD_THT_SWITCH_PACKAGES = [
  { id: "Tactile_6x6mm_THT", name: "Tactile 6mm", desc: "4-Pin 6.5x4.5mm" },
  { id: "Tactile_12x12mm_THT", name: "Tactile 12mm", desc: "4-Pin 12.5x5.0mm" },
  { id: "SlideSwitch_SPDT_P2.54mm", name: "Slide SPDT", desc: "3-Pin 2.54mm" },
  { id: "DIP_Switch_4Pos", name: "DIP 4P", desc: "Pitch 2.54mm" },
  { id: "DIP_Switch_8Pos", name: "DIP 8P", desc: "Pitch 2.54mm" },
  { id: "Relay_SPDT_Songle_SRD", name: "Songle 10A", desc: "SPDT 5-Pin" },
  { id: "Relay_DPDT_Telecom", name: "Telecom", desc: "DPDT 8-Pin" },
  { id: "Relay_SolidState_SIP4", name: "SSR SIP-4", desc: "4-Pin SIP" },
];

export const MORE_STANDARD_THT_SWITCH_PACKAGES = [
  { id: "Tactile_6x6mm_2Pin", name: "Tactile Switch 6x6mm 2-Pin (Pitch 6.5mm)" },
  { id: "Tactile_RightAngle_6x6mm", name: "Tactile Right-Angle 6x6mm Side Push" },
  { id: "SlideSwitch_DPDT_P2.54mm", name: "Slide Switch DPDT 6-Pin (Pitch 2.54mm)" },
  { id: "DIP_Switch_2Pos", name: "DIP Switch 2-Position THT" },
  { id: "DIP_Switch_6Pos", name: "DIP Switch 6-Position THT" },
  { id: "Relay_Power_G2R_16A", name: "Omron G2R-1 Power Relay 16A 8-Pin" },
];

export interface SwitchRelayParams {
  packageType?: string;
  packageSize?: string;
  technologyType?: string;
  mounting?: "SMD" | "THT";
  reference?: string;
  value?: string;
  pitch?: number;
  drill?: number;
  padSize?: number;
  padWidth?: number;
  padHeight?: number;
  bodyLength?: number;
  bodyWidth?: number;
  pinCount?: number;
  [key: string]: any;
}

export function generateSwitchRelay(params: SwitchRelayParams): KicadFootprintModel {
  const pkg = (params.packageSize || params.packageType || "Tactile_6x6mm_THT").trim();
  const isTht = params.mounting === "THT" || pkg.includes("THT") || pkg.includes("Songle") || pkg.includes("SIP4") || pkg.includes("DIP_Switch_") || pkg.includes("P2.54mm");
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const isRelay = pkg.toLowerCase().includes("relay") || pkg.toLowerCase().includes("ssr");
  const ref = params.reference || (isRelay ? "K" : "SW");

  // ==========================================
  // THT Packages
  // ==========================================
  if (isTht) {
    // 1. Tactile 6x6mm THT (4-Pin Omron B3F)
    if (pkg === "Tactile_6x6mm_THT" || pkg === "Tactile_6x6mm_2Pin") {
      const is2Pin = pkg.includes("2Pin");
      const dx = 3.25;
      const dy = 2.25;
      const drill = typeof params.drill === "number" ? params.drill : 1.0;
      const padSize = typeof params.padSize === "number" ? params.padSize : 1.8;

      if (is2Pin) {
        pads.push(createThtPad({ number: "1", x: -dx, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
        pads.push(createThtPad({ number: "2", x: dx, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
      } else {
        pads.push(createThtPad({ number: "1", x: -dx, y: -dy, width: padSize, height: padSize, shape: "rect", drill }));
        pads.push(createThtPad({ number: "2", x: -dx, y: dy, width: padSize, height: padSize, shape: "oval", drill }));
        pads.push(createThtPad({ number: "3", x: dx, y: -dy, width: padSize, height: padSize, shape: "oval", drill }));
        pads.push(createThtPad({ number: "4", x: dx, y: dy, width: padSize, height: padSize, shape: "oval", drill }));
      }

      graphics.push(...createFabRect(-3.0, -3.0, 3.0, 3.0));
      graphics.push(createFabCircle(0, 0, 1.75));
      graphics.push(createSilkLine(-3.1, -3.1, 3.1, -3.1));
      graphics.push(createSilkLine(3.1, -3.1, 3.1, 3.1));
      graphics.push(createSilkLine(3.1, 3.1, -3.1, 3.1));
      graphics.push(createSilkLine(-3.1, 3.1, -3.1, -3.1));
      graphics.push(createSilkCircle(0, 0, 1.75));
      graphics.push(createSilkPin1Dot(-dx - 1.2, is2Pin ? 0 : -dy));
      graphics.push(createReferenceText(0, -4.0));
      graphics.push(createValueText(0, 4.0, params.value || "SW_Push_6x6mm"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: is2Pin ? "SW_Push_6x6mm_2Pin" : "SW_Push_6x6mm_H5mm",
        referencePrefix: ref,
        value: params.value || "SW_Push",
        description: `Tactile Pushbutton Switch 6x6mm ${is2Pin ? "2-Pin" : "4-Pin"} Through-Hole`,
        tags: ["Switch", "Tactile", "Pushbutton", "THT", "6x6mm"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "switch_relay",
        generatorParams: params,
      });
    }

    // 2. Tactile 12x12mm THT
    if (pkg === "Tactile_12x12mm_THT") {
      const dx = 6.25;
      const dy = 2.5;
      const drill = typeof params.drill === "number" ? params.drill : 1.3;
      const padSize = typeof params.padSize === "number" ? params.padSize : 2.4;

      pads.push(createThtPad({ number: "1", x: -dx, y: -dy, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: -dx, y: dy, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: dx, y: -dy, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "4", x: dx, y: dy, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(...createFabRect(-6.0, -6.0, 6.0, 6.0));
      graphics.push(createFabCircle(0, 0, 3.5));
      graphics.push(createSilkPin1Dot(-dx - 1.5, -dy));
      graphics.push(createReferenceText(0, -7.0));
      graphics.push(createValueText(0, 7.0, params.value || "SW_Push_12x12mm"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "SW_Push_12x12mm",
        referencePrefix: ref,
        value: params.value || "SW_Push_12mm",
        description: "Tactile Pushbutton Switch 12x12mm Through-Hole",
        tags: ["Switch", "Tactile", "Pushbutton", "THT", "12x12mm"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "switch_relay",
        generatorParams: params,
      });
    }

    // 3. Slide Switch SPDT (P2.54mm, 3 Pins) or DPDT (6 Pins)
    if (pkg.includes("SlideSwitch") || pkg.includes("Slide")) {
      const isDpdt = pkg.includes("DPDT");
      const pitch = typeof params.pitch === "number" ? params.pitch : 2.54;
      const drill = typeof params.drill === "number" ? params.drill : 0.9;
      const padSize = typeof params.padSize === "number" ? params.padSize : 1.6;

      pads.push(createThtPad({ number: "1", x: -pitch, y: isDpdt ? -1.5 : 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: 0, y: isDpdt ? -1.5 : 0, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: pitch, y: isDpdt ? -1.5 : 0, width: padSize, height: padSize, shape: "oval", drill }));

      if (isDpdt) {
        pads.push(createThtPad({ number: "4", x: pitch, y: 1.5, width: padSize, height: padSize, shape: "oval", drill }));
        pads.push(createThtPad({ number: "5", x: 0, y: 1.5, width: padSize, height: padSize, shape: "oval", drill }));
        pads.push(createThtPad({ number: "6", x: -pitch, y: 1.5, width: padSize, height: padSize, shape: "oval", drill }));
      }

      graphics.push(...createFabRect(-4.3, -2.5, 4.3, 2.5));
      graphics.push(createSilkPin1Dot(-pitch, -2.2));
      graphics.push(createReferenceText(0, -3.2));
      graphics.push(createValueText(0, 3.2, params.value || "SW_Slide"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: isDpdt ? "SW_Slide_2P2T_DPDT" : "SW_Slide_1P2T_SS12D00",
        referencePrefix: ref,
        value: params.value || "SW_Slide",
        description: `Slide Switch ${isDpdt ? "DPDT (2P2T)" : "SPDT (1P2T)"} 2.54mm Pitch`,
        tags: ["Switch", "Slide", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "switch_relay",
        generatorParams: params,
      });
    }

    // 4. DIP Switches THT (2, 4, 6, 8-Position)
    if (pkg.includes("DIP_Switch") || pkg.includes("DIP_SW")) {
      const positions = pkg.includes("2Pos") ? 2 : pkg.includes("6Pos") ? 6 : pkg.includes("8Pos") ? 8 : 4;
      const pitch = typeof params.pitch === "number" ? params.pitch : 2.54;
      const rowSpacing = 7.62;
      const drill = typeof params.drill === "number" ? params.drill : 0.8;
      const padSize = typeof params.padSize === "number" ? params.padSize : 1.5;

      for (let i = 0; i < positions; i++) {
        const py = (i - (positions - 1) / 2) * pitch;
        pads.push(createThtPad({ number: String(i + 1), x: -rowSpacing / 2, y: py, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
        pads.push(createThtPad({ number: String(positions * 2 - i), x: rowSpacing / 2, y: py, width: padSize, height: padSize, shape: "oval", drill }));
      }

      const bodyL = (positions + 0.8) * pitch;
      graphics.push(...createFabRect(-4.8, -bodyL / 2, 4.8, bodyL / 2));
      graphics.push(createSilkPin1Dot(-rowSpacing / 2 - 1.2, -(positions - 1) / 2 * pitch));
      graphics.push(createReferenceText(0, -bodyL / 2 - 1.0));
      graphics.push(createValueText(0, bodyL / 2 + 1.0, params.value || `SW_DIP_${positions}Pos`));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: `SW_DIP_x${positions}_W7.62mm`,
        referencePrefix: ref,
        value: params.value || `SW_DIP_x${positions}`,
        description: `DIP Switch ${positions}-Position Through-Hole 7.62mm`,
        tags: ["Switch", "DIP", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "switch_relay",
        generatorParams: params,
      });
    }

    // 5. Relay SPDT Songle SRD / Omron G5LE (Standard Sugar Cube)
    if (pkg === "Relay_SPDT_Songle_SRD" || pkg.includes("Songle")) {
      const drill = 1.3;
      const padSize = 2.4;

      pads.push(createThtPad({ number: "1", x: -6.0, y: -6.0, width: padSize, height: padSize, shape: "rect", drill })); // Coil 1
      pads.push(createThtPad({ number: "2", x: -6.0, y: 6.0, width: padSize, height: padSize, shape: "oval", drill }));  // Coil 2
      pads.push(createThtPad({ number: "3", x: -3.8, y: -6.0, width: padSize, height: padSize, shape: "oval", drill })); // NC
      pads.push(createThtPad({ number: "4", x: -3.8, y: 6.0, width: padSize, height: padSize, shape: "oval", drill }));  // NO
      pads.push(createThtPad({ number: "5", x: 6.1, y: 0.0, width: padSize, height: padSize, shape: "oval", drill }));   // COM

      graphics.push(...createFabRect(-7.5, -9.5, 8.0, 9.5));
      graphics.push(createSilkLine(-7.6, -9.6, 8.1, -9.6));
      graphics.push(createSilkLine(8.1, -9.6, 8.1, 9.6));
      graphics.push(createSilkLine(8.1, 9.6, -7.6, 9.6));
      graphics.push(createSilkLine(-7.6, 9.6, -7.6, -9.6));
      graphics.push(createSilkPin1Dot(-7.0, -7.0));
      graphics.push(createReferenceText(0, -10.5));
      graphics.push(createValueText(0, 10.5, params.value || "Relay_Songle_SRD"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "Relay_SPDT_Songle_SRD",
        referencePrefix: ref,
        value: params.value || "Relay_SRD",
        description: "Miniature Sugar Cube SPDT Relay 10A (Songle SRD / Omron G5LE)",
        tags: ["Relay", "SPDT", "Songle", "THT", "Power"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "switch_relay",
        generatorParams: params,
      });
    }

    // 6. Relay DPDT Telecom / Signal Relay (8-pin DIP style)
    if (pkg === "Relay_DPDT_Telecom" || pkg.includes("Telecom")) {
      const pitch = 2.54;
      const rowSpacing = 7.62;
      const drill = 1.0;
      const padSize = 1.8;

      for (let i = 0; i < 4; i++) {
        const py = (i - 1.5) * pitch;
        pads.push(createThtPad({ number: String(i + 1), x: -rowSpacing / 2, y: py, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
        pads.push(createThtPad({ number: String(8 - i), x: rowSpacing / 2, y: py, width: padSize, height: padSize, shape: "oval", drill }));
      }

      graphics.push(...createFabRect(-5.0, -7.0, 5.0, 7.0));
      graphics.push(createSilkPin1Dot(-rowSpacing / 2 - 1.2, -3.81));
      graphics.push(createReferenceText(0, -8.0));
      graphics.push(createValueText(0, 8.0, params.value || "Relay_DPDT_Telecom"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "Relay_DPDT_Telecom_8Pin",
        referencePrefix: ref,
        value: params.value || "Relay_DPDT",
        description: "Miniature Low-Signal Telecom Relay DPDT 8-Pin DIP style",
        tags: ["Relay", "DPDT", "Telecom", "Signal", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "switch_relay",
        generatorParams: params,
      });
    }

    // 7. Solid State Relay SIP-4 (Sharp SSR style)
    if (pkg === "Relay_SolidState_SIP4" || pkg.includes("SIP4")) {
      const pitch = 2.54;
      const drill = 1.1;
      const padSize = 2.0;

      for (let i = 0; i < 4; i++) {
        const px = (i - 1.5) * pitch;
        pads.push(createThtPad({ number: String(i + 1), x: px, y: 0, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
      }

      graphics.push(...createFabRect(-6.5, -3.0, 6.5, 3.0));
      graphics.push(createSilkPin1Dot(-1.5 * pitch - 1.0, 0));
      graphics.push(createReferenceText(0, -4.0));
      graphics.push(createValueText(0, 4.0, params.value || "SSR_SIP4"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "Relay_SolidState_SIP4",
        referencePrefix: ref,
        value: params.value || "SSR_SIP4",
        description: "Solid State Relay SIP-4 Single-In-Line Package",
        tags: ["Relay", "SSR", "SolidState", "SIP4", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "switch_relay",
        generatorParams: params,
      });
    }

    // Custom THT Switch Fallback
    const pitch = typeof params.pitch === "number" ? params.pitch : 5.0;
    const drill = typeof params.drill === "number" ? params.drill : 1.0;
    const padSize = typeof params.padSize === "number" ? params.padSize : 1.8;
    const bodyL = typeof params.bodyLength === "number" ? params.bodyLength : 8.0;
    const bodyW = typeof params.bodyWidth === "number" ? params.bodyWidth : 8.0;

    pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
    pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

    graphics.push(...createFabRect(-bodyL / 2, -bodyW / 2, bodyL / 2, bodyW / 2));
    graphics.push(createReferenceText(0, -bodyW / 2 - 1.2));
    graphics.push(createValueText(0, bodyW / 2 + 1.2, params.value || "SW_Custom"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Switch_Custom_THT",
      referencePrefix: ref,
      value: params.value || "SW_Custom",
      description: "Custom Parametric Switch Through-Hole",
      tags: ["Switch", "Custom", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "switch_relay",
      generatorParams: params,
    });
  }

  // ==========================================
  // SMD Packages
  // ==========================================

  // 1. Tactile 6x6mm SMD (4 Gullwing leads)
  if (pkg === "Tactile_6x6mm_SMD" || (pkg.includes("6x6") && !pkg.includes("THT"))) {
    const dx = 4.5;
    const dy = 2.25;
    const padW = 1.8;
    const padH = 1.4;

    pads.push(createSmdPad({ number: "1", x: -dx, y: -dy, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: -dx, y: dy, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "3", x: dx, y: -dy, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "4", x: dx, y: dy, width: padW, height: padH, shape: "roundrect" }));

    graphics.push(...createFabRect(-3.0, -3.0, 3.0, 3.0));
    graphics.push(createFabCircle(0, 0, 1.75));
    graphics.push(createSilkPin1Dot(-dx - 1.2, -dy));
    graphics.push(createReferenceText(0, -4.0));
    graphics.push(createValueText(0, 4.0, params.value || "SW_Push_6x6mm_SMD"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "SW_Push_6x6mm_SMD",
      referencePrefix: ref,
      value: params.value || "SW_Push_SMD",
      description: "Tactile Pushbutton Switch 6x6mm SMD Gullwing",
      tags: ["Switch", "Tactile", "Pushbutton", "SMD", "6x6mm"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "switch_relay",
      generatorParams: params,
    });
  }

  // 2. Tactile 3x4mm SMD / 3x6mm SMD
  if (pkg.includes("3x4") || pkg.includes("3x6")) {
    const is3x6 = pkg.includes("3x6");
    const padW = 1.4;
    const padH = 1.2;
    const dx = is3x6 ? 3.2 : 2.3;
    const bodyL = is3x6 ? 6.0 : 4.0;
    const bodyW = 3.0;

    pads.push(createSmdPad({ number: "1", x: -dx, y: 0, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: dx, y: 0, width: padW, height: padH, shape: "roundrect" }));

    graphics.push(...createFabRect(-bodyL / 2, -bodyW / 2, bodyL / 2, bodyW / 2));
    graphics.push(createSilkPin1Dot(-dx - 1.0, 0));
    graphics.push(createReferenceText(0, -2.4));
    graphics.push(createValueText(0, 2.4, params.value || pkg));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: `SW_Push_${pkg}`,
      referencePrefix: ref,
      value: params.value || "SW_Push",
      description: `Miniature Tactile SMD Pushbutton ${bodyL}x${bodyW}mm`,
      tags: ["Switch", "Tactile", "SMD", "Miniature"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "switch_relay",
      generatorParams: params,
    });
  }

  // 3. DIP Switch SMD (2, 4, 8-Position Gullwing)
  if (pkg.includes("DIP_Switch_SMD") || (pkg.includes("DIP") && pkg.includes("SMD"))) {
    const positions = pkg.includes("2Pos") ? 2 : pkg.includes("8Pos") ? 8 : 4;
    const pitch = 2.54;
    const spanX = 9.4;
    const padW = 2.0;
    const padH = 1.2;

    for (let i = 0; i < positions; i++) {
      const py = (i - (positions - 1) / 2) * pitch;
      pads.push(createSmdPad({ number: String(i + 1), x: -spanX / 2, y: py, width: padW, height: padH, shape: "roundrect" }));
      pads.push(createSmdPad({ number: String(positions * 2 - i), x: spanX / 2, y: py, width: padW, height: padH, shape: "roundrect" }));
    }

    const bodyL = (positions + 0.8) * pitch;
    graphics.push(...createFabRect(-3.5, -bodyL / 2, 3.5, bodyL / 2));
    graphics.push(createSilkPin1Dot(-spanX / 2 - 1.2, -(positions - 1) / 2 * pitch));
    graphics.push(createReferenceText(0, -bodyL / 2 - 1.2));
    graphics.push(createValueText(0, bodyL / 2 + 1.2, params.value || `SW_DIP_SMD_${positions}P`));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: `SW_DIP_SMD_x${positions}`,
      referencePrefix: ref,
      value: params.value || `SW_DIP_x${positions}`,
      description: `DIP Switch ${positions}-Position Gullwing Surface Mount`,
      tags: ["Switch", "DIP", "SMD"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "switch_relay",
      generatorParams: params,
    });
  }

  // 4. Custom SMD Switch / Fallback
  const padW = params.padWidth || 1.6;
  const padH = params.padHeight || 1.4;
  const pitch = params.pitch || 4.5;
  const bodyL = params.bodyLength || 5.0;
  const bodyW = params.bodyWidth || 5.0;

  pads.push(createSmdPad({ number: "1", x: -pitch / 2, y: 0, width: padW, height: padH, shape: "roundrect" }));
  pads.push(createSmdPad({ number: "2", x: pitch / 2, y: 0, width: padW, height: padH, shape: "roundrect" }));

  graphics.push(...createFabRect(-bodyL / 2, -bodyW / 2, bodyL / 2, bodyW / 2));
  graphics.push(createSilkPin1Dot(-pitch / 2 - 1.0, 0));
  graphics.push(createReferenceText(0, -bodyW / 2 - 1.2));
  graphics.push(createValueText(0, bodyW / 2 + 1.2, params.value || "SW_SMD_Custom"));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  return buildNativeFootprintModel({
    name: "SW_Custom_SMD",
    referencePrefix: ref,
    value: params.value || "SW_SMD",
    description: "Custom Surface Mount Tactile Switch",
    tags: ["Switch", "SMD", "Custom"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "switch_relay",
    generatorParams: params,
  });
}
