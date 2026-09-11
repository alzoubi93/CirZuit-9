import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle } from "../core/silk";
import { createFabRect, createFabCircle } from "../core/fab";
import { createCourtyardRect, createCourtyardCircle } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { createDiodeCathodeBar } from "../core/polarity";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export type DiodePackageType = string;

export interface DiodeParams {
  packageType?: DiodePackageType;
  packageSize?: string;
  reference?: string;
  value?: string;
  isLed?: boolean;
  pitch?: number;
  padSize?: number;
  padWidth?: number;
  padHeight?: number;
  drill?: number;
  bodyDiameter?: number;
  bodyLength?: number;
  bodyWidth?: number;
  diameter?: number;
  pins?: number;
}

export interface DiodeSmdSizeSpec {
  id: string;
  name: string;
  nameAr?: string;
  pitch: number;
  padWidth: number;
  padHeight: number;
  bodyLength: number;
  bodyWidth: number;
}

export const STANDARD_SMD_DIODE_SIZES: DiodeSmdSizeSpec[] = [
  { id: "SOD-523", name: "SOD-523 (0603 Metric - 1.20 × 0.80 mm)", nameAr: "SOD-523 (0603 Metric - 1.20 × 0.80 mm)", pitch: 1.4, padWidth: 0.60, padHeight: 0.40, bodyLength: 1.20, bodyWidth: 0.80 },
  { id: "SOD-323", name: "SOD-323 (1005 Metric - 1.70 × 1.25 mm)", nameAr: "SOD-323 (1005 Metric - 1.70 × 1.25 mm)", pitch: 2.2, padWidth: 0.90, padHeight: 0.60, bodyLength: 1.70, bodyWidth: 1.25 },
  { id: "SOD-123", name: "SOD-123 (1608 Metric - 2.70 × 1.60 mm)", nameAr: "SOD-123 (1608 Metric - 2.70 × 1.60 mm)", pitch: 3.4, padWidth: 0.90, padHeight: 1.20, bodyLength: 2.70, bodyWidth: 1.60 },
  { id: "SOD-80", name: "SOD-80 / MiniMELF (3.50 × 1.50 mm)", nameAr: "SOD-80 / MiniMELF (3.50 × 1.50 mm)", pitch: 3.3, padWidth: 1.10, padHeight: 1.70, bodyLength: 3.50, bodyWidth: 1.50 },
  { id: "SMA", name: "SMA (DO-214AC - 4.30 × 2.60 mm)", nameAr: "SMA (DO-214AC - 4.30 × 2.60 mm)", pitch: 4.0, padWidth: 1.50, padHeight: 1.70, bodyLength: 4.50, bodyWidth: 2.60 },
  { id: "SMB", name: "SMB (DO-214AA - 4.50 × 3.60 mm)", nameAr: "SMB (DO-214AA - 4.50 × 3.60 mm)", pitch: 4.6, padWidth: 2.10, padHeight: 2.20, bodyLength: 4.60, bodyWidth: 3.60 },
  { id: "SMC", name: "SMC (DO-214AB - 6.80 × 5.90 mm)", nameAr: "SMC (DO-214AB - 6.80 × 5.90 mm)", pitch: 6.0, padWidth: 2.30, padHeight: 3.00, bodyLength: 6.80, bodyWidth: 5.90 },
];

export const STANDARD_SMD_LED_SIZES: DiodeSmdSizeSpec[] = [
  { id: "0201", name: "0201 (0603 Metric - 0.60 × 0.30 mm)", nameAr: "0201 (0603 Metric - 0.60 × 0.30 mm)", pitch: 0.60, padWidth: 0.35, padHeight: 0.40, bodyLength: 0.60, bodyWidth: 0.30 },
  { id: "0402", name: "0402 (1005 Metric - 1.00 × 0.50 mm)", nameAr: "0402 (1005 Metric - 1.00 × 0.50 mm)", pitch: 0.95, padWidth: 0.55, padHeight: 0.60, bodyLength: 1.00, bodyWidth: 0.50 },
  { id: "0603", name: "0603 (1608 Metric - 1.60 × 0.80 mm)", nameAr: "0603 (1608 Metric - 1.60 × 0.80 mm)", pitch: 1.60, padWidth: 0.80, padHeight: 0.90, bodyLength: 1.60, bodyWidth: 0.80 },
  { id: "0805", name: "0805 (2012 Metric - 2.00 × 1.25 mm)", nameAr: "0805 (2012 Metric - 2.00 × 1.25 mm)", pitch: 1.90, padWidth: 1.00, padHeight: 1.30, bodyLength: 2.00, bodyWidth: 1.25 },
  { id: "1206", name: "1206 (3216 Metric - 3.20 × 1.60 mm)", nameAr: "1206 (3216 Metric - 3.20 × 1.60 mm)", pitch: 3.00, padWidth: 1.10, padHeight: 1.70, bodyLength: 3.20, bodyWidth: 1.60 },
  { id: "1210", name: "1210 (3225 Metric - 3.20 × 2.50 mm)", nameAr: "1210 (3225 Metric - 3.20 × 2.50 mm)", pitch: 3.00, padWidth: 1.10, padHeight: 2.60, bodyLength: 3.20, bodyWidth: 2.50 },
  { id: "1812", name: "1812 (4532 Metric - 4.50 × 3.20 mm)", nameAr: "1812 (4532 Metric - 4.50 × 3.20 mm)", pitch: 4.00, padWidth: 1.30, padHeight: 3.40, bodyLength: 4.50, bodyWidth: 3.20 },
  { id: "2010", name: "2010 (5025 Metric - 5.00 × 2.50 mm)", nameAr: "2010 (5025 Metric - 5.00 × 2.50 mm)", pitch: 4.60, padWidth: 1.20, padHeight: 2.70, bodyLength: 5.00, bodyWidth: 2.50 },
  { id: "2512", name: "2512 (6432 Metric - 6.40 × 3.20 mm)", nameAr: "2512 (6432 Metric - 6.40 × 3.20 mm)", pitch: 6.00, padWidth: 1.30, padHeight: 3.40, bodyLength: 6.40, bodyWidth: 3.20 },
  { id: "2835", name: "2835 (PLCC-2 - 2.80 × 3.50 mm)", nameAr: "2835 (PLCC-2 - 2.80 × 3.50 mm)", pitch: 2.60, padWidth: 1.20, padHeight: 2.50, bodyLength: 3.50, bodyWidth: 2.80 },
  { id: "3020", name: "3020 (PLCC-2 - 3.00 × 2.00 mm)", nameAr: "3020 (PLCC-2 - 3.00 × 2.00 mm)", pitch: 2.50, padWidth: 1.10, padHeight: 1.50, bodyLength: 3.00, bodyWidth: 2.00 },
  { id: "3528", name: "3528 (PLCC-2 - 3.50 × 2.80 mm)", nameAr: "3528 (PLCC-2 - 3.50 × 2.80 mm)", pitch: 3.20, padWidth: 1.50, padHeight: 2.20, bodyLength: 3.50, bodyWidth: 2.80 },
  { id: "5050", name: "5050 (PLCC-6 - 5.00 × 5.00 mm)", nameAr: "5050 (PLCC-6 - 5.00 × 5.00 mm)", pitch: 4.40, padWidth: 1.60, padHeight: 1.60, bodyLength: 5.00, bodyWidth: 5.00 },
  { id: "5630", name: "5630 (PLCC-4 - 5.60 × 3.00 mm)", nameAr: "5630 (PLCC-4 - 5.60 × 3.00 mm)", pitch: 4.80, padWidth: 1.40, padHeight: 2.00, bodyLength: 5.60, bodyWidth: 3.00 },
  { id: "5730", name: "5730 (PLCC-2 - 5.70 × 3.00 mm)", nameAr: "5730 (PLCC-2 - 5.70 × 3.00 mm)", pitch: 5.00, padWidth: 1.50, padHeight: 2.00, bodyLength: 5.70, bodyWidth: 3.00 },
];

export interface DiodeThtSizeSpec {
  id: string;
  name: string;
  nameAr?: string;
  pitch: number;
  bodyDiameter: number;
  bodyLength: number;
  drill: number;
  padSize: number;
}

export const STANDARD_THT_DIODE_SIZES: DiodeThtSizeSpec[] = [
  { id: "DO-35", name: "DO-35 (Small Signal / 1N4148)", pitch: 7.62, bodyDiameter: 1.9, bodyLength: 3.8, drill: 0.8, padSize: 1.6 },
  { id: "DO-41", name: "DO-41 (1A Rectifier / 1N4007)", pitch: 10.16, bodyDiameter: 2.6, bodyLength: 4.3, drill: 1.0, padSize: 2.0 },
  { id: "DO-15", name: "DO-15 (2A Rectifier / 1N5399)", pitch: 15.24, bodyDiameter: 3.6, bodyLength: 7.6, drill: 1.0, padSize: 2.0 },
  { id: "DO-201", name: "DO-201 (3A-5A / 1N5408)", pitch: 15.24, bodyDiameter: 5.3, bodyLength: 9.5, drill: 1.2, padSize: 2.4 },
  { id: "Bridge-KBP", name: "Bridge KBP (4-Pin Bridge)", pitch: 3.81, bodyDiameter: 6.0, bodyLength: 14.5, drill: 0.9, padSize: 1.8 },
];

export interface LedThtSizeSpec {
  id: string;
  name: string;
  nameAr?: string;
  pitch: number;
  drill: number;
  padSize: number;
  diameter?: number;
  width?: number;
  length?: number;
  pins?: number;
  isMultiColor?: boolean;
}

export const QUICK_STANDARD_THT_DIODE_PACKAGES = [
  { id: "DO-35", name: "DO-35 (1N4148)", pitch: 7.62, bodyDiameter: 1.9, bodyLength: 3.8, drill: 0.8, padSize: 1.6, isLed: false },
  { id: "DO-41", name: "DO-41 (1N4007)", pitch: 10.16, bodyDiameter: 2.6, bodyLength: 4.3, drill: 1.0, padSize: 2.0, isLed: false },
  { id: "DO-15", name: "DO-15 (1N5399)", pitch: 15.24, bodyDiameter: 3.6, bodyLength: 7.6, drill: 1.0, padSize: 2.0, isLed: false },
  { id: "DO-201", name: "DO-201 (1N5408)", pitch: 15.24, bodyDiameter: 5.3, bodyLength: 9.5, drill: 1.2, padSize: 2.4, isLed: false },
  { id: "3mm", name: "LED 3mm", pitch: 2.54, drill: 0.8, padSize: 1.6, diameter: 3.0, pins: 2, isLed: true },
  { id: "5mm", name: "LED 5mm", pitch: 2.54, drill: 0.85, padSize: 1.8, diameter: 5.0, pins: 2, isLed: true },
  { id: "8mm", name: "LED 8mm", pitch: 2.54, drill: 0.9, padSize: 2.0, diameter: 8.0, pins: 2, isLed: true },
];

export const MORE_STANDARD_THT_DIODE_PACKAGES = [
  { id: "Bridge-KBP", name: "Bridge KBP", pitch: 3.81, drill: 0.9, padSize: 1.8, diameter: 6.0, pins: 4, isLed: false },
  { id: "Axial Power", name: "Axial Power (10A)", pitch: 20.32, bodyDiameter: 8.0, bodyLength: 15.0, drill: 1.5, padSize: 3.0, isLed: false },
  { id: "10mm", name: "LED 10mm", pitch: 2.54, drill: 1.0, padSize: 2.2, diameter: 10.0, pins: 2, isLed: true },
  { id: "Rectangular", name: "LED Rect. (5x2)", pitch: 2.54, drill: 0.8, padSize: 1.6, width: 5.0, length: 2.0, pins: 2, isLed: true },
  { id: "Bi-Color", name: "LED Bi-Color", pitch: 2.54, drill: 0.85, padSize: 1.8, diameter: 5.0, pins: 3, isLed: true },
  { id: "RGB", name: "LED RGB", pitch: 1.27, drill: 0.8, padSize: 1.4, diameter: 5.0, pins: 4, isLed: true },
];

export const STANDARD_DIODE_PACKAGES = [
  ...QUICK_STANDARD_THT_DIODE_PACKAGES,
  ...MORE_STANDARD_THT_DIODE_PACKAGES,
];


export const STANDARD_THT_LED_SIZES: LedThtSizeSpec[] = [
  { id: "3mm", name: "3mm Round", pitch: 2.54, drill: 0.8, padSize: 1.6, diameter: 3.0, pins: 2 },
  { id: "5mm", name: "5mm Round", pitch: 2.54, drill: 0.85, padSize: 1.8, diameter: 5.0, pins: 2 },
  { id: "8mm", name: "8mm Round", pitch: 2.54, drill: 0.9, padSize: 2.0, diameter: 8.0, pins: 2 },
  { id: "10mm", name: "10mm Round", pitch: 2.54, drill: 1.0, padSize: 2.2, diameter: 10.0, pins: 2 },
  { id: "Rectangular", name: "Rectangular (5x2mm)", pitch: 2.54, drill: 0.8, padSize: 1.6, width: 5.0, length: 2.0, pins: 2 },
  { id: "Bi-Color", name: "Bi-Color (3-Pin)", pitch: 2.54, drill: 0.85, padSize: 1.8, diameter: 5.0, pins: 3, isMultiColor: true },
  { id: "RGB", name: "RGB (4-Pin)", pitch: 1.27, drill: 0.8, padSize: 1.4, diameter: 5.0, pins: 4, isMultiColor: true },
  { id: "Custom", name: "Custom THT LED", pitch: 2.54, drill: 0.85, padSize: 1.8, diameter: 5.0, pins: 2 },
];

export function generateDiode(params: DiodeParams): KicadFootprintModel {
  const sizeKey = params.packageSize || params.packageType || "SMA";
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  
  // Detect if it is an LED size/package
  let normalizedKey = sizeKey.replace(/^LED_/, "").replace(/^(THT_|SMD_)/, "");
  if (normalizedKey.includes("3mm")) normalizedKey = "3mm";
  else if (normalizedKey.includes("5mm")) normalizedKey = "5mm";
  else if (normalizedKey.includes("8mm")) normalizedKey = "8mm";
  else if (normalizedKey.includes("10mm")) normalizedKey = "10mm";

  const isLed = !!(
    params.isLed || 
    sizeKey.startsWith("LED") || 
    STANDARD_SMD_LED_SIZES.some(s => s.id === normalizedKey) ||
    STANDARD_THT_LED_SIZES.some(s => s.id === normalizedKey)
  );
  
  const prefix = params.reference || (isLed ? "D" : "D");

  const isSmdLED = isLed && STANDARD_SMD_LED_SIZES.some((s) => s.id === normalizedKey);
  const isSmdDiode = !isLed && STANDARD_SMD_DIODE_SIZES.some((s) => s.id === normalizedKey);

  // Detect THT
  const isThtLED = isLed && (
    normalizedKey === "3mm" || 
    normalizedKey === "5mm" || 
    normalizedKey === "8mm" || 
    normalizedKey === "10mm" || 
    normalizedKey === "Rectangular" || 
    normalizedKey === "Bi-Color" || 
    normalizedKey === "RGB" || 
    normalizedKey === "Custom" && isLed
  );

  const isThtDiode = !isLed && (
    normalizedKey === "DO-35" || 
    normalizedKey === "DO-41" || 
    normalizedKey === "DO-15" || 
    normalizedKey === "DO-201" || 
    normalizedKey === "Axial Power" || 
    normalizedKey === "Custom" && !isLed
  );

  // Dynamic footprint generator for SMD sizes
  if (isSmdLED || isSmdDiode) {
    const spec = isSmdLED
      ? (STANDARD_SMD_LED_SIZES.find(s => s.id === normalizedKey) || STANDARD_SMD_LED_SIZES[2])
      : (STANDARD_SMD_DIODE_SIZES.find(s => s.id === normalizedKey) || STANDARD_SMD_DIODE_SIZES[4]);

    const halfPitch = spec.pitch / 2;
    // Pad 1 (Cathode - Left)
    pads.push(createSmdPad({ number: "1", x: -halfPitch, y: 0, width: spec.padWidth, height: spec.padHeight, shape: "roundrect" }));
    // Pad 2 (Anode - Right)
    pads.push(createSmdPad({ number: "2", x: halfPitch, y: 0, width: spec.padWidth, height: spec.padHeight, shape: "roundrect" }));

    const halfL = spec.bodyLength / 2;
    const halfW = spec.bodyWidth / 2;

    // Fab outline
    graphics.push(...createFabRect(-halfL, -halfW, halfL, halfW));

    // Polarity / Cathode bar on Fab
    graphics.push(createDiodeCathodeBar(-halfL + 0.3, -halfW, halfW, KLC_RULES.layers.fab));

    // Silk Cathode indication
    const silkCathodeX = -halfPitch - spec.padWidth / 2 - 0.4;
    graphics.push(createDiodeCathodeBar(silkCathodeX, -halfW, halfW, KLC_RULES.layers.silk));

    // Silk boundaries
    if (spec.pitch > 1.2) {
      graphics.push(createSilkLine(-halfL, -halfW - 0.2, halfL, -halfW - 0.2));
      graphics.push(createSilkLine(-halfL, halfW + 0.2, halfL, halfW + 0.2));
    }

    graphics.push(createReferenceText(0, -halfW - 1.2));
    graphics.push(createValueText(0, halfW + 1.2, params.value || spec.id));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    const name = isLed ? `LED_${spec.id}` : `D_${spec.id}`;
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: isLed ? `SMD LED Package, standard size ${spec.id}` : `SMD Diode Package, standard size ${spec.id}`,
      tags: isLed ? ["LED", spec.id, "SMD"] : ["Diode", spec.id, "SMD"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "diode",
      generatorParams: { ...params, packageSize: spec.id, packageType: spec.id },
    });
  }
  
  if (isThtDiode) {
    const spec = STANDARD_THT_DIODE_SIZES.find(s => s.id === normalizedKey) || STANDARD_THT_DIODE_SIZES[1];
    
    const pitch = params.pitch ?? spec.pitch;
    const padSize = params.padSize ?? params.padWidth ?? spec.padSize;
    const drill = params.drill ?? spec.drill;
    const bodyL = params.bodyLength ?? spec.bodyLength;
    const bodyD = params.bodyDiameter ?? params.bodyWidth ?? spec.bodyDiameter;

    pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
    pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

    graphics.push(...createFabRect(-bodyL / 2, -bodyD / 2, bodyL / 2, bodyD / 2));
    graphics.push(createDiodeCathodeBar(-bodyL / 2 + 0.3 * bodyL, -bodyD / 2, bodyD / 2, KLC_RULES.layers.fab));
    graphics.push(createDiodeCathodeBar(-bodyL / 2 + 0.3 * bodyL, -bodyD / 2, bodyD / 2, KLC_RULES.layers.silk));
    graphics.push(createSilkLine(-bodyL / 2, -bodyD / 2, bodyL / 2, -bodyD / 2));
    graphics.push(createSilkLine(bodyL / 2, -bodyD / 2, bodyL / 2, bodyD / 2));
    graphics.push(createSilkLine(bodyL / 2, bodyD / 2, -bodyL / 2, bodyD / 2));
    graphics.push(createSilkLine(-bodyL / 2, bodyD / 2, -bodyL / 2, -bodyD / 2));

    graphics.push(createReferenceText(0, -bodyD / 2 - 0.9));
    graphics.push(createValueText(0, bodyD / 2 + 0.9, params.value || spec.id));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    const name = `D_${spec.id}_P${pitch}mm_Horizontal`;
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `${spec.name} Axial Diode, ${pitch}mm lead spacing`,
      tags: ["Diode", spec.id, "Axial", "Through-Hole"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "diode",
      generatorParams: { ...params, packageSize: spec.id, packageType: spec.id },
    });
  }
  
  if (isThtLED) {
    const spec = STANDARD_THT_LED_SIZES.find(s => s.id === normalizedKey) || STANDARD_THT_LED_SIZES[1];
    
    const pitch = params.pitch ?? spec.pitch;
    const padSize = params.padSize ?? params.padWidth ?? spec.padSize;
    const drill = params.drill ?? spec.drill;
    const pins = params.pins ?? spec.pins ?? 2;
    const diameter = params.diameter ?? params.bodyDiameter ?? spec.diameter ?? 5.0;

    if (pins === 3) {
      pads.push(createThtPad({ number: "1", x: -pitch, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: 0, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: pitch, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
    } else if (pins === 4) {
      pads.push(createThtPad({ number: "1", x: -pitch * 1.5, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: -pitch * 0.5, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: pitch * 0.5, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "4", x: pitch * 1.5, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
    } else {
      pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "circle", drill }));
    }

    if (spec.id === "Rectangular") {
      const halfW = (spec.width || 5) / 2;
      const halfL = (spec.length || 2) / 2;
      graphics.push(...createFabRect(-halfW, -halfL, halfW, halfL));
      graphics.push(createSilkLine(-halfW, -halfL, halfW, -halfL));
      graphics.push(createSilkLine(halfW, -halfL, halfW, halfL));
      graphics.push(createSilkLine(halfW, halfL, -halfW, halfL));
      graphics.push(createSilkLine(-halfW, halfL, -halfW, -halfL));
      
      graphics.push(createReferenceText(0, -halfL - 1.0));
      graphics.push(createValueText(0, halfL + 1.0, params.value || spec.id));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));
    } else {
      const r = diameter / 2;
      graphics.push(createFabCircle(0, 0, r));
      
      // Draw flat side for cathode (Pad 1)
      graphics.push(createSilkLine(-r * 0.8, -r * 0.6, -r * 0.8, r * 0.6));
      graphics.push(createSilkCircle(0, 0, r + 0.1));

      graphics.push(createReferenceText(0, -r - 1.0));
      graphics.push(createValueText(0, r + 1.0, params.value || spec.id));
      graphics.push(createCourtyardCircle(0, 0, r + 0.1, KLC_RULES.clearance.courtyardTht));
    }

    const name = pins > 2 ? `LED_${spec.id}_P${pitch}mm` : `LED_D${diameter}mm`;
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `LED ${spec.name} Through-Hole package`,
      tags: ["LED", spec.id, "Through-Hole", "Diode"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "diode",
      generatorParams: { ...params, packageSize: spec.id, packageType: spec.id },
    });
  }

  // ==========================================
  // Fallback LED 0805 SMD
  // ==========================================
  pads.push(createSmdPad({ number: "1", x: -0.95, y: 0, width: 1.0, height: 1.3, shape: "roundrect" }));
  pads.push(createSmdPad({ number: "2", x: 0.95, y: 0, width: 1.0, height: 1.3, shape: "roundrect" }));

  graphics.push(...createFabRect(-1.0, -0.625, 1.0, 0.625));
  graphics.push(createDiodeCathodeBar(-0.6, -0.6, 0.6, KLC_RULES.layers.fab));
  graphics.push(createDiodeCathodeBar(-1.6, -0.6, 0.6, KLC_RULES.layers.silk));
  graphics.push(createReferenceText(0, -1.2));
  graphics.push(createValueText(0, 1.2, params.value || "LED_0805"));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  const name = "LED_0805_2012Metric";
  return buildNativeFootprintModel({
    name,
    referencePrefix: prefix,
    value: params.value || name,
    description: "LED 0805 (2012 Metric) Surface Mount",
    tags: ["LED", "0805", "SMD", "Diode"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "diode",
    generatorParams: params,
  });
}
