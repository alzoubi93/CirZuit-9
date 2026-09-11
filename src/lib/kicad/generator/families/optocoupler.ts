import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkArc, createSilkPin1Dot } from "../core/silk";
import { createFabRect, createFabArc } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface OptocouplerStandardPackage {
  id: string;
  name: string;
  category: "smd_gullwing" | "soic" | "photomos";
  desc: string;
  mounting: "SMD" | "THT";
}

export const STANDARD_SMD_OPTOCOUPLER_PACKAGES: OptocouplerStandardPackage[] = [
  { id: "Optocoupler_SMD-4", name: "SMD-4 Gullwing", category: "smd_gullwing", desc: "4-Pin SMD PC817S (Pitch 2.54mm, Row 10.16mm)", mounting: "SMD" },
  { id: "Optocoupler_SMD-6", name: "SMD-6 Gullwing", category: "smd_gullwing", desc: "6-Pin SMD 4N35S (Pitch 2.54mm, Row 10.16mm)", mounting: "SMD" },
  { id: "Optocoupler_SMD-8", name: "SMD-8 Gullwing", category: "smd_gullwing", desc: "8-Pin SMD 6N137S (Pitch 2.54mm, Row 10.16mm)", mounting: "SMD" },
  { id: "Optocoupler_SOIC-4", name: "SOP-4 Mini-Flat", category: "soic", desc: "4-Pin SOP (TLP291, Pitch 2.54mm, Row 7.0mm)", mounting: "SMD" },
  { id: "Optocoupler_SOIC-8", name: "SOIC-8 Narrow", category: "soic", desc: "8-Pin High Speed (Pitch 1.27mm, Row 6.0mm)", mounting: "SMD" },
  { id: "Optocoupler_PhotoMOS_SOP4", name: "PhotoMOS SOP-4", category: "photomos", desc: "4-Pin Solid State Relay SOP", mounting: "SMD" },
];

export const QUICK_STANDARD_THT_OPTOCOUPLER_PACKAGES = [
  { id: "Optocoupler_DIP-4", name: "DIP-4 Standard", desc: "PC817 / EL817 7.62mm Row Spacing" },
  { id: "Optocoupler_DIP-4_Wide", name: "DIP-4 Wide", desc: "10.16mm Spacing for High Isolation" },
  { id: "Optocoupler_DIP-6", name: "DIP-6 Standard", desc: "4N25 / 4N35 / MOC3021 7.62mm Spacing" },
  { id: "Optocoupler_DIP-6_Wide", name: "DIP-6 Wide", desc: "10.16mm Spacing for Mains Isolation" },
  { id: "Optocoupler_DIP-8", name: "DIP-8 Standard", desc: "6N137 High Speed / Dual Channel" },
  { id: "Optocoupler_DIP-8_Wide", name: "DIP-8 Wide", desc: "10.16mm Spacing for 5kV Isolation" },
  { id: "Optocoupler_DIP-16", name: "DIP-16 Quad Optocoupler", desc: "PC847 / Quad Isolator (16 Pins)" },
  { id: "Optocoupler_SIP-4", name: "SIP-4 Single Line", desc: "4-Pin Single In-line Opto Pitch 2.54mm" },
  { id: "Opto_Interrupter_Slot", name: "Slot Interrupter", desc: "Optical Slot Sensor ITR9608" },
  { id: "Opto_Reflective_Sensor", name: "Reflective Sensor", desc: "Optical Reflective Sensor (TCRT5000)" },
];

export interface OptocouplerParams {
  packageType?: string;
  packageSize?: string;
  technologyType?: string;
  mounting?: "SMD" | "THT";
  reference?: string;
  value?: string;
  pinCount?: number;
  pitch?: number;
  rowSpacing?: number;
  drill?: number;
  padSize?: number;
  padWidth?: number;
  padHeight?: number;
  bodyLength?: number;
  bodyWidth?: number;
  [key: string]: any;
}

export function generateOptocoupler(params: OptocouplerParams): KicadFootprintModel {
  const pkg = (params.packageSize || params.packageType || "Optocoupler_DIP-4").trim();
  const isTht = params.mounting === "THT" || pkg.includes("DIP-") || pkg.includes("SIP-") || pkg.includes("Interrupter") || pkg.includes("THT");
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const ref = params.reference || "U";

  // ==========================================
  // THT Packages
  // ==========================================
  if (isTht) {
    // 1. DIP Optocouplers (DIP-4, DIP-6, DIP-8, DIP-16) Standard & Wide
    if (pkg.includes("DIP-")) {
      const pinCount = pkg.includes("DIP-16") ? 16 : pkg.includes("DIP-8") ? 8 : pkg.includes("DIP-6") ? 6 : 4;
      const isWide = pkg.includes("Wide");
      const pitch = typeof params.pitch === "number" ? params.pitch : 2.54;
      const rowSpacing = typeof params.rowSpacing === "number" ? params.rowSpacing : (isWide ? 10.16 : 7.62);
      const drill = typeof params.drill === "number" ? params.drill : 0.8;
      const padSize = typeof params.padSize === "number" ? params.padSize : 1.6;
      const half = pinCount / 2;

      // Left row (Pin 1 to half)
      for (let i = 0; i < half; i++) {
        const py = (i - (half - 1) / 2) * pitch;
        pads.push(createThtPad({ number: String(i + 1), x: -rowSpacing / 2, y: py, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
      }

      // Right row (half+1 to pinCount, bottom to top)
      for (let i = 0; i < half; i++) {
        const py = ((half - 1 - i) - (half - 1) / 2) * pitch;
        pads.push(createThtPad({ number: String(half + i + 1), x: rowSpacing / 2, y: py, width: padSize, height: padSize, shape: "oval", drill }));
      }

      const bodyL = (half + 0.5) * pitch;
      const bodyW = 6.4;
      graphics.push(...createFabRect(-bodyW / 2, -bodyL / 2, bodyW / 2, bodyL / 2));
      graphics.push(createFabArc(0, -bodyL / 2, 1.2, 0, Math.PI)); // notch

      graphics.push(createSilkLine(-bodyW / 2 - 0.1, -bodyL / 2 - 0.1, -1.2, -bodyL / 2 - 0.1));
      graphics.push(createSilkLine(1.2, -bodyL / 2 - 0.1, bodyW / 2 + 0.1, -bodyL / 2 - 0.1));
      graphics.push(createSilkArc(0, -bodyL / 2 - 0.1, 1.2, 0, Math.PI));
      graphics.push(createSilkPin1Dot(-rowSpacing / 2 - 1.2, -(half - 1) / 2 * pitch));
      graphics.push(createReferenceText(0, -bodyL / 2 - 1.2));
      graphics.push(createValueText(0, bodyL / 2 + 1.2, params.value || `DIP-${pinCount}_Opto`));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: `Optocoupler_DIP-${pinCount}_W${rowSpacing.toFixed(2)}mm`,
        referencePrefix: ref,
        value: params.value || (pinCount === 4 ? "PC817" : pinCount === 6 ? "4N25" : "6N137"),
        description: `Optocoupler DIP-${pinCount} Package ${rowSpacing.toFixed(2)}mm Row Spacing`,
        tags: ["Optocoupler", "Isolator", `DIP-${pinCount}`, "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "optocoupler",
        generatorParams: params,
      });
    }

    // 2. Optical Slot Interrupter (4-Pin Pitch 2.54 / 7.62mm)
    if (pkg.includes("Interrupter") || pkg.includes("Slot")) {
      const pitchX = 7.62;
      const pitchY = 2.54;
      const drill = 0.9;
      const padSize = 1.7;

      pads.push(createThtPad({ number: "1", x: -pitchX / 2, y: -pitchY / 2, width: padSize, height: padSize, shape: "rect", drill })); // Anode
      pads.push(createThtPad({ number: "2", x: -pitchX / 2, y: pitchY / 2, width: padSize, height: padSize, shape: "oval", drill }));  // Cathode
      pads.push(createThtPad({ number: "3", x: pitchX / 2, y: pitchY / 2, width: padSize, height: padSize, shape: "oval", drill }));   // Collector
      pads.push(createThtPad({ number: "4", x: pitchX / 2, y: -pitchY / 2, width: padSize, height: padSize, shape: "oval", drill }));  // Emitter

      graphics.push(...createFabRect(-6.0, -5.0, 6.0, 5.0));
      // Slot opening
      graphics.push(...createFabRect(-1.5, -5.0, 1.5, 0));
      graphics.push(createSilkPin1Dot(-pitchX / 2 - 1.2, -pitchY / 2));
      graphics.push(createReferenceText(0, -6.0));
      graphics.push(createValueText(0, 6.0, params.value || "Slot_Interrupter"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "Opto_Interrupter_Slot_ITR9608",
        referencePrefix: ref,
        value: params.value || "ITR9608",
        description: "Optical Slot Interrupter Photo Switch 4-Pin Through-Hole",
        tags: ["Optocoupler", "Slot", "Interrupter", "Sensor", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "optocoupler",
        generatorParams: params,
      });
    }

    // 3. SIP-4 Optocoupler
    const pitch = 2.54;
    const drill = 0.8;
    const padSize = 1.6;
    for (let i = 0; i < 4; i++) {
      const px = (i - 1.5) * pitch;
      pads.push(createThtPad({ number: String(i + 1), x: px, y: 0, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
    }
    graphics.push(...createFabRect(-5.5, -1.8, 5.5, 1.8));
    graphics.push(createSilkPin1Dot(-1.5 * pitch - 1.0, 0));
    graphics.push(createReferenceText(0, -2.8));
    graphics.push(createValueText(0, 2.8, params.value || "SIP-4_Opto"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Optocoupler_SIP-4",
      referencePrefix: ref,
      value: params.value || "SIP4",
      description: "Single-In-Line Optocoupler 4-Pin 2.54mm Pitch",
      tags: ["Optocoupler", "SIP4", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "optocoupler",
      generatorParams: params,
    });
  }

  // ==========================================
  // SMD Packages
  // ==========================================

  // 1. SMD Gullwing (SMD-4, SMD-6, SMD-8)
  if (pkg.includes("SMD-") || pkg.includes("Gullwing")) {
    const pinCount = pkg.includes("SMD-8") ? 8 : pkg.includes("SMD-6") ? 6 : 4;
    const pitch = 2.54;
    const spanX = 9.8;
    const padW = 1.8;
    const padH = 1.3;
    const half = pinCount / 2;

    for (let i = 0; i < half; i++) {
      const py = (i - (half - 1) / 2) * pitch;
      pads.push(createSmdPad({ number: String(i + 1), x: -spanX / 2, y: py, width: padW, height: padH, shape: "roundrect" }));
      pads.push(createSmdPad({ number: String(pinCount - i), x: spanX / 2, y: py, width: padW, height: padH, shape: "roundrect" }));
    }

    const bodyL = (half + 0.5) * pitch;
    graphics.push(...createFabRect(-3.3, -bodyL / 2, 3.3, bodyL / 2));
    graphics.push(createSilkPin1Dot(-spanX / 2 - 1.2, -(half - 1) / 2 * pitch));
    graphics.push(createReferenceText(0, -bodyL / 2 - 1.2));
    graphics.push(createValueText(0, bodyL / 2 + 1.2, params.value || `SMD-${pinCount}_Opto`));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: `Optocoupler_SMD-${pinCount}_Gullwing`,
      referencePrefix: ref,
      value: params.value || (pinCount === 4 ? "PC817S" : pinCount === 6 ? "4N35S" : "6N137S"),
      description: `Optocoupler SMD-${pinCount} Gullwing Leads Surface Mount`,
      tags: ["Optocoupler", "Isolator", `SMD-${pinCount}`, "Gullwing"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "optocoupler",
      generatorParams: params,
    });
  }

  // 2. SOIC / SOP Optocouplers (SOIC-4, SOIC-8)
  const is4 = pkg.includes("SOIC-4") || pkg.includes("SOP-4");
  const pinCount = is4 ? 4 : 8;
  const pitch = is4 ? 2.54 : 1.27;
  const spanX = is4 ? 7.0 : 6.0;
  const padW = params.padWidth || (is4 ? 1.6 : 1.5);
  const padH = params.padHeight || (is4 ? 1.2 : 0.6);
  const half = pinCount / 2;

  for (let i = 0; i < half; i++) {
    const py = (i - (half - 1) / 2) * pitch;
    pads.push(createSmdPad({ number: String(i + 1), x: -spanX / 2, y: py, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: String(pinCount - i), x: spanX / 2, y: py, width: padW, height: padH, shape: "roundrect" }));
  }

  const bodyL = (half + 0.4) * pitch;
  graphics.push(...createFabRect(-2.2, -bodyL / 2, 2.2, bodyL / 2));
  graphics.push(createSilkPin1Dot(-spanX / 2 - 0.9, -(half - 1) / 2 * pitch));
  graphics.push(createReferenceText(0, -bodyL / 2 - 1.0));
  graphics.push(createValueText(0, bodyL / 2 + 1.0, params.value || `SOIC-${pinCount}_Opto`));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  return buildNativeFootprintModel({
    name: `Optocoupler_SOIC-${pinCount}`,
    referencePrefix: ref,
    value: params.value || (is4 ? "TLP291" : "Dual_Opto"),
    description: `Optocoupler SOIC-${pinCount} Surface Mount`,
    tags: ["Optocoupler", "SOIC", "SOP", "SMD"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "optocoupler",
    generatorParams: params,
  });
}
