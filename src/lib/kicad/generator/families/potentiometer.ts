import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabRect, createFabCircle } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface PotentiometerStandardPackage {
  id: string;
  name: string;
  category: "trimmer" | "rotary" | "slide" | "smd";
  desc: string;
  mounting: "SMD" | "THT";
}

export const QUICK_STANDARD_THT_POTENTIOMETER_PACKAGES = [
  { id: "Potentiometer_Trimmer_3296W", name: "Trim 3296W", mounting: "THT" },
  { id: "Potentiometer_Trimmer_3362P", name: "Trim 3362P", mounting: "THT" },
];

export const MORE_STANDARD_THT_POTENTIOMETER_PACKAGES = [
  { id: "Potentiometer_Rotary_Alpha16mm", name: "Rot Alpha 16mm", mounting: "THT" },
  { id: "Potentiometer_Rotary_9mm", name: "Rot 9mm", mounting: "THT" },
  { id: "Potentiometer_Slide_30mm", name: "Slide 30mm", mounting: "THT" },
];

export const STANDARD_SMD_POTENTIOMETER_PACKAGES = [
  { id: "Potentiometer_Bourns_3314G_SMD", name: "3314G SMD", mounting: "SMD" },
  { id: "Potentiometer_Bourns_3314J_SMD", name: "3314J SMD", mounting: "SMD" },
];

export const STANDARD_POTENTIOMETER_PACKAGES = [
  ...QUICK_STANDARD_THT_POTENTIOMETER_PACKAGES,
  ...STANDARD_SMD_POTENTIOMETER_PACKAGES
];

export const ALL_POTENTIOMETER_PACKAGES = STANDARD_POTENTIOMETER_PACKAGES;

export interface PotentiometerParams {
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
  [key: string]: any;
}

export function generatePotentiometer(params: PotentiometerParams): KicadFootprintModel {
  const pkg = (params.packageSize || params.packageType || "Potentiometer_Trimmer_3362P").trim();
  const isTht = params.mounting === "THT" || !pkg.includes("SMD");
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const ref = params.reference || "RV";

  // ==========================================
  // THT Packages
  // ==========================================
  if (isTht) {
    // 1. Trimmer 3362P (Square 6.8x6.8mm, 3 pins in-line 2.54mm pitch)
    if (pkg.includes("3362P")) {
      const pitch = typeof params.pitch === "number" ? params.pitch : 2.54;
      const drill = typeof params.drill === "number" ? params.drill : 0.8;
      const padSize = typeof params.padSize === "number" ? params.padSize : 1.6;

      pads.push(createThtPad({ number: "1", x: -pitch, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: 0, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: pitch, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(...createFabRect(-3.4, -3.4, 3.4, 3.4));
      graphics.push(createFabCircle(0, 0, 1.5));
      graphics.push(createSilkLine(-3.5, -3.5, 3.5, -3.5));
      graphics.push(createSilkLine(3.5, -3.5, 3.5, 3.5));
      graphics.push(createSilkLine(3.5, 3.5, -3.5, 3.5));
      graphics.push(createSilkLine(-3.5, 3.5, -3.5, -3.5));
      graphics.push(createSilkCircle(0, 0, 1.5));
      graphics.push(createSilkPin1Dot(-pitch, -1.5));
      graphics.push(createReferenceText(0, -4.5));
      graphics.push(createValueText(0, 4.5, params.value || "Trimmer_3362P"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "Potentiometer_Bourns_3362P_Vertical",
        referencePrefix: ref,
        value: params.value || "3362P",
        description: "Trimmer Potentiometer Bourns 3362P Square 6.8mm Top-Adjust 2.54mm pitch",
        tags: ["Potentiometer", "Trimmer", "3362P", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "potentiometer",
        generatorParams: params,
      });
    }

    // 2. Trimmer 3296W or 3296Y (Multi-turn 9.5x4.8mm)
    if (pkg.includes("3296")) {
      const is3296Y = pkg.includes("3296Y");
      const drill = typeof params.drill === "number" ? params.drill : 0.8;
      const padSize = typeof params.padSize === "number" ? params.padSize : 1.6;

      if (is3296Y) {
        // Triangle pinout
        pads.push(createThtPad({ number: "1", x: -2.54, y: 1.27, width: padSize, height: padSize, shape: "rect", drill }));
        pads.push(createThtPad({ number: "2", x: 0.0, y: -1.27, width: padSize, height: padSize, shape: "oval", drill }));
        pads.push(createThtPad({ number: "3", x: 2.54, y: 1.27, width: padSize, height: padSize, shape: "oval", drill }));
      } else {
        // In-line pinout (3296W)
        pads.push(createThtPad({ number: "1", x: -2.54, y: 1.27, width: padSize, height: padSize, shape: "rect", drill }));
        pads.push(createThtPad({ number: "2", x: 0.0, y: -1.27, width: padSize, height: padSize, shape: "oval", drill }));
        pads.push(createThtPad({ number: "3", x: 2.54, y: 1.27, width: padSize, height: padSize, shape: "oval", drill }));
      }

      graphics.push(...createFabRect(-4.75, -2.4, 4.75, 2.4));
      graphics.push(createFabCircle(-3.2, 0, 1.1));
      graphics.push(createSilkLine(-4.9, -2.5, 4.9, -2.5));
      graphics.push(createSilkLine(4.9, -2.5, 4.9, 2.5));
      graphics.push(createSilkLine(4.9, 2.5, -4.9, 2.5));
      graphics.push(createSilkLine(-4.9, 2.5, -4.9, -2.5));
      graphics.push(createSilkCircle(-3.2, 0, 1.1));
      graphics.push(createSilkPin1Dot(-2.54, 2.5));
      graphics.push(createReferenceText(0, -3.5));
      graphics.push(createValueText(0, 3.5, params.value || (is3296Y ? "Trimmer_3296Y" : "Trimmer_3296W")));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: is3296Y ? "Potentiometer_Bourns_3296Y_Vertical" : "Potentiometer_Bourns_3296W_Vertical",
        referencePrefix: ref,
        value: params.value || (is3296Y ? "3296Y" : "3296W"),
        description: `Trimmer Potentiometer Bourns ${is3296Y ? "3296Y" : "3296W"} Multi-Turn Top-Adjust`,
        tags: ["Potentiometer", "Trimmer", "3296", "THT", "Multi-Turn"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "potentiometer",
        generatorParams: params,
      });
    }

    // 3. Trimmer 3386P (Square 9.5x9.5mm Single Turn)
    if (pkg.includes("3386P")) {
      const drill = 0.8;
      const padSize = 1.6;

      pads.push(createThtPad({ number: "1", x: -2.54, y: 2.54, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: 0.0, y: -2.54, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: 2.54, y: 2.54, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(...createFabRect(-4.75, -4.75, 4.75, 4.75));
      graphics.push(createFabCircle(0, 0, 2.2));
      graphics.push(createSilkPin1Dot(-2.54, 3.5));
      graphics.push(createReferenceText(0, -5.5));
      graphics.push(createValueText(0, 5.5, params.value || "3386P"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "Potentiometer_Bourns_3386P_Vertical",
        referencePrefix: ref,
        value: params.value || "3386P",
        description: "Trimmer Potentiometer Bourns 3386P 9.5mm Square Top Adjust",
        tags: ["Potentiometer", "Trimmer", "3386P", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "potentiometer",
        generatorParams: params,
      });
    }

    // 4. Rotary Potentiometers (Alpha 16mm or Bourns 9mm)
    if (pkg.includes("Rotary") || pkg.includes("Alpha") || pkg.includes("9mm")) {
      const is9mm = pkg.includes("9mm");
      const pitch = is9mm ? 2.54 : 5.08;
      const drill = is9mm ? 1.0 : 1.3;
      const padSize = is9mm ? 1.8 : 2.4;
      const bodyRadius = is9mm ? 4.8 : 8.5;

      pads.push(createThtPad({ number: "1", x: -pitch, y: is9mm ? 4.0 : 7.0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: 0, y: is9mm ? 4.0 : 7.0, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: pitch, y: is9mm ? 4.0 : 7.0, width: padSize, height: padSize, shape: "oval", drill }));

      if (!is9mm) {
        // Alpha 16mm side mounting bracket tabs
        pads.push(createThtPad({ number: "MP1", x: -7.5, y: 0, width: 3.0, height: 3.0, shape: "oval", drill: 1.8 }));
        pads.push(createThtPad({ number: "MP2", x: 7.5, y: 0, width: 3.0, height: 3.0, shape: "oval", drill: 1.8 }));
      }

      graphics.push(createFabCircle(0, 0, bodyRadius));
      graphics.push(createSilkCircle(0, 0, bodyRadius + 0.2));
      graphics.push(createSilkPin1Dot(-pitch, is9mm ? 5.5 : 9.0));
      graphics.push(createReferenceText(0, -bodyRadius - 1.2));
      graphics.push(createValueText(0, is9mm ? 6.5 : 10.5, params.value || (is9mm ? "Pot_9mm" : "Pot_Alpha16mm")));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: is9mm ? "Potentiometer_Bourns_PTV09A_Vertical" : "Potentiometer_Alpha_RV16AF-41_Vertical",
        referencePrefix: ref,
        value: params.value || (is9mm ? "Pot_9mm" : "Pot_16mm"),
        description: `Rotary Potentiometer ${is9mm ? "Bourns 9mm" : "Alpha 16mm"} Round Body Panel Mount`,
        tags: ["Potentiometer", "Rotary", "PanelMount", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "potentiometer",
        generatorParams: params,
      });
    }

    // 5. Slide Potentiometers (30mm / 60mm Travel)
    if (pkg.includes("Slide")) {
      const is60 = pkg.includes("60mm");
      const spanX = is60 ? 35.0 : 15.0;
      const bodyL = is60 ? 75.0 : 35.0;
      const drill = 1.2;
      const padSize = 2.0;

      pads.push(createThtPad({ number: "1", x: -spanX, y: -2.5, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: -spanX, y: 2.5, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: spanX, y: 0.0, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(...createFabRect(-bodyL / 2, -4.5, bodyL / 2, 4.5));
      graphics.push(createSilkLine(-bodyL / 2 - 0.2, -4.7, bodyL / 2 + 0.2, -4.7));
      graphics.push(createSilkLine(bodyL / 2 + 0.2, -4.7, bodyL / 2 + 0.2, 4.7));
      graphics.push(createSilkLine(bodyL / 2 + 0.2, 4.7, -bodyL / 2 - 0.2, 4.7));
      graphics.push(createSilkLine(-bodyL / 2 - 0.2, 4.7, -bodyL / 2 - 0.2, -4.7));
      graphics.push(createSilkPin1Dot(-spanX, -4.0));
      graphics.push(createReferenceText(0, -5.8));
      graphics.push(createValueText(0, 5.8, params.value || (is60 ? "Slide_60mm" : "Slide_30mm")));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: is60 ? "Potentiometer_Slide_60mm_Travel" : "Potentiometer_Slide_30mm_Travel",
        referencePrefix: ref,
        value: params.value || (is60 ? "Slide_60mm" : "Slide_30mm"),
        description: `Slide Potentiometer ${is60 ? "60mm" : "30mm"} Travel Console Fader`,
        tags: ["Potentiometer", "Slide", "Fader", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "potentiometer",
        generatorParams: params,
      });
    }

    // Fallback Custom THT Potentiometer
    const pitch = typeof params.pitch === "number" ? params.pitch : 2.54;
    const drill = typeof params.drill === "number" ? params.drill : 0.8;
    const padSize = typeof params.padSize === "number" ? params.padSize : 1.6;

    pads.push(createThtPad({ number: "1", x: -pitch, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
    pads.push(createThtPad({ number: "2", x: 0, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
    pads.push(createThtPad({ number: "3", x: pitch, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

    graphics.push(...createFabRect(-pitch * 1.6, -3.0, pitch * 1.6, 3.0));
    graphics.push(createReferenceText(0, -4.0));
    graphics.push(createValueText(0, 4.0, params.value || "Pot_Custom"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "Potentiometer_Custom_THT",
      referencePrefix: ref,
      value: params.value || "Pot_Custom",
      description: "Custom Parametric Potentiometer Through-Hole",
      tags: ["Potentiometer", "Custom", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "potentiometer",
      generatorParams: params,
    });
  }

  // ==========================================
  // SMD Packages
  // ==========================================

  // 1. Bourns 3314G / 3314J SMD Trimmer
  if (pkg.includes("3314")) {
    const isJ = pkg.includes("3314J");
    pads.push(createSmdPad({ number: "1", x: -1.7, y: isJ ? 1.2 : 1.5, width: 1.3, height: 1.1, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: 0.0, y: isJ ? -1.4 : -1.7, width: 1.5, height: 1.1, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "3", x: 1.7, y: isJ ? 1.2 : 1.5, width: 1.3, height: 1.1, shape: "roundrect" }));

    graphics.push(...createFabRect(-2.25, -2.25, 2.25, 2.25));
    graphics.push(createFabCircle(0, 0, 1.2));
    graphics.push(createSilkPin1Dot(-2.5, 1.5));
    graphics.push(createReferenceText(0, -3.2));
    graphics.push(createValueText(0, 3.2, params.value || pkg));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: isJ ? "Potentiometer_Bourns_3314J_SMD" : "Potentiometer_Bourns_3314G_SMD",
      referencePrefix: ref,
      value: params.value || (isJ ? "3314J" : "3314G"),
      description: `Surface Mount Trimmer Potentiometer Bourns ${isJ ? "3314J (J-Hook)" : "3314G (Gullwing)"}`,
      tags: ["Potentiometer", "Trimmer", "SMD", "Bourns"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "potentiometer",
      generatorParams: params,
    });
  }

  // 2. SMD 3x3mm or 4x4mm Trimmer or Custom SMD
  const is3x3 = pkg.includes("3x3");
  const padW = params.padWidth || (is3x3 ? 1.0 : 1.2);
  const padH = params.padHeight || (is3x3 ? 0.9 : 1.0);
  const spanX = is3x3 ? 1.3 : 1.6;
  const spanY = is3x3 ? 1.3 : 1.6;
  const bodyW = is3x3 ? 3.0 : 4.0;
  const bodyH = is3x3 ? 3.0 : 4.0;

  pads.push(createSmdPad({ number: "1", x: -spanX, y: spanY, width: padW, height: padH, shape: "roundrect" }));
  pads.push(createSmdPad({ number: "2", x: 0.0, y: -spanY, width: padW * 1.2, height: padH, shape: "roundrect" }));
  pads.push(createSmdPad({ number: "3", x: spanX, y: spanY, width: padW, height: padH, shape: "roundrect" }));

  graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
  graphics.push(createFabCircle(0, 0, bodyW / 3.5));
  graphics.push(createSilkPin1Dot(-spanX - 0.6, spanY));
  graphics.push(createReferenceText(0, -bodyH / 2 - 1.0));
  graphics.push(createValueText(0, bodyH / 2 + 1.0, params.value || pkg));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  return buildNativeFootprintModel({
    name: `Potentiometer_SMD_${is3x3 ? "3x3mm" : "4x4mm"}`,
    referencePrefix: ref,
    value: params.value || "Trimmer_SMD",
    description: `Surface Mount Cermet Trimmer ${bodyW}x${bodyH}mm`,
    tags: ["Potentiometer", "Trimmer", "SMD"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "potentiometer",
    generatorParams: params,
  });
}
