import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad, createNpthHole } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabRect, createFabLine, createFabCircle } from "../core/fab";
import { createCourtyardRect, createCourtyardCircle } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export type TransistorType = "BJT" | "MOSFET" | "JFET" | "IGBT" | "Darlington" | "Power Transistor";
export type TransistorPolarity = "NPN" | "PNP" | "N-Channel" | "P-Channel";
export type TransistorMounting = "SMD" | "THT";

export interface TransistorParams {
  packageType?: string;
  packageSize?: string;
  transistorType?: TransistorType;
  polarity?: TransistorPolarity;
  mounting?: TransistorMounting;
  reference?: string;
  value?: string;

  // Custom / Manual & Override fields
  pitch?: number;          // pin pitch / spacing (mm)
  padSize?: number;        // THT pad outer size (mm)
  padWidth?: number;       // SMD pad width or custom width (mm)
  padHeight?: number;      // SMD pad height (mm)
  drill?: number;          // THT hole drill diameter (mm)
  bodyWidth?: number;      // Package body width X (mm)
  bodyLength?: number;     // Package body length / depth Y (mm)
  pins?: number;           // Pin count (2, 3, 4, 5, 6, 7, 8)
  pinConfig?: string;      // Pinout label: e.g. "EBC", "BCE", "GDS", etc.
  thtStyle?: "inline" | "can" | "tabbed" | "diamond";
}

export interface TransistorThtSpec {
  id: string;
  name: string;
  nameAr: string;
  category: "quick" | "more" | "custom";
  pitch: number;
  pins: number;
  padSize: number;
  drill: number;
  bodyWidth: number;
  bodyLength: number;
  description: string;
}

export interface TransistorSmdSpec {
  id: string;
  name: string;
  nameAr: string;
  category: "standard" | "power" | "custom";
  pitch: number;
  pins: number;
  padWidth: number;
  padHeight: number;
  bodyWidth: number;
  bodyLength: number;
  description: string;
}

/**
 * Quick Standard Packages (THT) as explicitly requested:
 * TO-18, TO-39, TO-92, TO-126, TO-220, TO-247, TO-3, TO-264
 */
export const QUICK_STANDARD_THT_PACKAGES = [
  { id: "TO-92", name: "TO-92 (2N2222)", category: "quick", pitch: 1.27, pins: 3, padSize: 1.4, drill: 0.75, bodyWidth: 4.6, bodyLength: 3.8, description: "Small Signal Inline" },
  { id: "TO-18", name: "TO-18 (Metal)", category: "quick", pitch: 2.54, pins: 3, padSize: 1.4, drill: 0.75, bodyWidth: 4.7, bodyLength: 4.7, description: "Small Metal Can" },
  { id: "TO-39", name: "TO-39 (Metal)", category: "quick", pitch: 5.08, pins: 3, padSize: 1.6, drill: 0.85, bodyWidth: 8.5, bodyLength: 8.5, description: "Medium Metal Can" },
  { id: "TO-126", name: "TO-126 (BD139)", category: "quick", pitch: 2.28, pins: 3, padSize: 1.8, drill: 1.0, bodyWidth: 7.8, bodyLength: 3.0, description: "Medium Power" },
  { id: "TO-220", name: "TO-220 (IRF540)", category: "quick", pitch: 2.54, pins: 3, padSize: 1.8, drill: 1.0, bodyWidth: 10.2, bodyLength: 4.5, description: "Power Tabbed" },
  { id: "TO-247", name: "TO-247 (High Pwr)", category: "quick", pitch: 5.45, pins: 3, padSize: 2.4, drill: 1.3, bodyWidth: 15.8, bodyLength: 5.0, description: "High Power" },
  { id: "TO-3", name: "TO-3 (Diamond)", category: "quick", pitch: 10.92, pins: 2, padSize: 3.0, drill: 1.5, bodyWidth: 39.0, bodyLength: 26.0, description: "Large Metal Can" },
  { id: "TO-264", name: "TO-264 (Extreme)", category: "quick", pitch: 5.45, pins: 3, padSize: 2.6, drill: 1.4, bodyWidth: 20.0, bodyLength: 5.2, description: "Extreme Power" },
];

export const MORE_STANDARD_THT_PACKAGES = [
  { id: "TO-92L", name: "TO-92L (Long)", category: "more", pitch: 1.27, pins: 3, padSize: 1.4, drill: 0.75, bodyWidth: 5.0, bodyLength: 4.0, description: "Long TO-92" },
  { id: "TO-220F", name: "TO-220F (Iso)", category: "more", pitch: 2.54, pins: 3, padSize: 1.8, drill: 1.0, bodyWidth: 10.2, bodyLength: 4.7, description: "Fully Isolated" },
  { id: "TO-251", name: "TO-251 (IPAK)", category: "more", pitch: 2.28, pins: 3, padSize: 1.6, drill: 0.9, bodyWidth: 6.6, bodyLength: 6.1, description: "THT version of DPAK" },
  { id: "TO-218", name: "TO-218", category: "more", pitch: 5.45, pins: 3, padSize: 2.4, drill: 1.3, bodyWidth: 15.3, bodyLength: 4.8, description: "High Power Plastic" },
  { id: "TO-66", name: "TO-66 (Metal)", category: "more", pitch: 5.08, pins: 2, padSize: 2.5, drill: 1.2, bodyWidth: 31.0, bodyLength: 18.0, description: "Medium Diamond" },
  { id: "TO-220-5", name: "TO-220-5", category: "more", pitch: 1.7, pins: 5, padSize: 1.5, drill: 0.9, bodyWidth: 10.2, bodyLength: 4.5, description: "5-Lead Power" },
  { id: "SIP-3", name: "SIP-3 / SIL-3", category: "more", pitch: 2.54, pins: 3, padSize: 1.6, drill: 0.85, bodyWidth: 7.6, bodyLength: 2.5, description: "Single In-Line" },
];

export const STANDARD_TRANSISTOR_PACKAGES = [
  ...QUICK_STANDARD_THT_PACKAGES,
  ...MORE_STANDARD_THT_PACKAGES,
];


export const ALL_THT_TRANSISTOR_PACKAGES: TransistorThtSpec[] = [
  ...QUICK_STANDARD_THT_PACKAGES,
  ...MORE_STANDARD_THT_PACKAGES,
  {
    id: "Custom",
    name: "Custom THT Transistor",
    nameAr: "ترانزستور ثقبي مخصص (Custom Manual)",
    category: "custom",
    pitch: 2.54,
    pins: 3,
    padSize: 1.8,
    drill: 1.0,
    bodyWidth: 10.0,
    bodyLength: 4.5,
    description: "Custom Through-Hole Transistor with Manual Dimensions",
  },
];

/**
 * Standard SMD Packages for Transistors & Power
 */
export const STANDARD_SMD_TRANSISTOR_PACKAGES: TransistorSmdSpec[] = [
  {
    id: "SOT-23",
    name: "SOT-23 (TO-236AB)",
    nameAr: "SOT-23 (إشارة صغيرة قياسي 3 أرجل)",
    category: "standard",
    pitch: 0.95,
    pins: 3,
    padWidth: 0.8,
    padHeight: 0.9,
    bodyWidth: 2.9,
    bodyLength: 1.3,
    description: "SOT-23-3 Standard Small Signal Surface Mount Transistor",
  },
  {
    id: "SOT-23-5",
    name: "SOT-23-5",
    nameAr: "SOT-23-5 (5 أرجل للترانزستورات المزدوجة)",
    category: "standard",
    pitch: 0.95,
    pins: 5,
    padWidth: 0.7,
    padHeight: 1.0,
    bodyWidth: 2.9,
    bodyLength: 1.6,
    description: "SOT-23-5 (SC-74A) 5-Lead Package",
  },
  {
    id: "SOT-23-6",
    name: "SOT-23-6",
    nameAr: "SOT-23-6 (6 أرجل لمصفوفة ترانزستور)",
    category: "standard",
    pitch: 0.95,
    pins: 6,
    padWidth: 0.7,
    padHeight: 1.0,
    bodyWidth: 2.9,
    bodyLength: 1.6,
    description: "SOT-23-6 Dual Transistor Array Package",
  },
  {
    id: "SOT-223",
    name: "SOT-223 (Tab Pin 4)",
    nameAr: "SOT-223 (طاقة متوسطة مع مشتت حراري)",
    category: "power",
    pitch: 2.3,
    pins: 4,
    padWidth: 1.0,
    padHeight: 1.8,
    bodyWidth: 6.5,
    bodyLength: 3.5,
    description: "SOT-223-3 with large thermal tab (Pin 4)",
  },
  {
    id: "SOT-89",
    name: "SOT-89 (TO-243)",
    nameAr: "SOT-89 (حزمة طاقة مدمجة مع مشتت وسطي)",
    category: "power",
    pitch: 1.5,
    pins: 3,
    padWidth: 0.8,
    padHeight: 1.4,
    bodyWidth: 4.5,
    bodyLength: 2.5,
    description: "SOT-89 Medium Power SMT with center heat tab",
  },
  {
    id: "SOT-323",
    name: "SOT-323 (SC-70-3)",
    nameAr: "SOT-323 / SC-70 (فائق الصغر 2.0x1.25mm)",
    category: "standard",
    pitch: 0.65,
    pins: 3,
    padWidth: 0.5,
    padHeight: 0.6,
    bodyWidth: 2.0,
    bodyLength: 1.25,
    description: "SOT-323 (SC-70) Ultra-compact 3-pin Transistor",
  },
  {
    id: "SOT-363",
    name: "SOT-363 (SC-88)",
    nameAr: "SOT-363 / SC-88 (مزدوج فائق الصغر 6 أرجل)",
    category: "standard",
    pitch: 0.65,
    pins: 6,
    padWidth: 0.4,
    padHeight: 0.6,
    bodyWidth: 2.0,
    bodyLength: 1.25,
    description: "SOT-363 Ultra-compact Dual Transistor Package",
  },
  {
    id: "DPAK",
    name: "DPAK / TO-252-2",
    nameAr: "DPAK / TO-252 (موسفيت طاقة سطحي قياسي)",
    category: "power",
    pitch: 4.56,
    pins: 3,
    padWidth: 1.4,
    padHeight: 2.2,
    bodyWidth: 6.6,
    bodyLength: 6.1,
    description: "TO-252-2 (DPAK) Surface Mount Power MOSFET / Transistor",
  },
  {
    id: "D2PAK",
    name: "D2PAK / TO-263-2",
    nameAr: "D2PAK / TO-263 (طاقة عالية جداً مع مشتت كبير)",
    category: "power",
    pitch: 5.08,
    pins: 3,
    padWidth: 1.6,
    padHeight: 3.4,
    bodyWidth: 10.2,
    bodyLength: 9.2,
    description: "TO-263-2 (D2PAK) High Power Surface Mount Package",
  },
  {
    id: "SO-8",
    name: "SO-8 (Power MOSFET SOIC-8)",
    nameAr: "SO-8 (موسفيت قدرة 8 أرجل 1-3 S, 4 G, 5-8 D)",
    category: "power",
    pitch: 1.27,
    pins: 8,
    padWidth: 0.6,
    padHeight: 1.5,
    bodyWidth: 4.9,
    bodyLength: 3.9,
    description: "SO-8 Standard Power MOSFET Footprint (Pins 1-3 Source, 4 Gate, 5-8 Drain)",
  },
  {
    id: "PowerPAK-56",
    name: "PowerPAK-56 (DFN 5x6)",
    nameAr: "PowerPAK-56 / DFN 5x6 (موسفيت طاقة حديث فائق الكفاءة)",
    category: "power",
    pitch: 1.27,
    pins: 8,
    padWidth: 0.6,
    padHeight: 0.7,
    bodyWidth: 5.0,
    bodyLength: 6.0,
    description: "PowerPAK 5x6 Low-Rds Power MOSFET with Thermal Pad",
  },
  {
    id: "LFPAK56",
    name: "LFPAK56 (SOT-669)",
    nameAr: "LFPAK56 (حزمة سيارات وطاقة مدمجة)",
    category: "power",
    pitch: 1.27,
    pins: 5,
    padWidth: 0.6,
    padHeight: 1.1,
    bodyWidth: 5.0,
    bodyLength: 5.3,
    description: "LFPAK56 (SOT-669) High Performance Automotive Power MOSFET",
  },
  {
    id: "Custom_SMD",
    name: "Custom SMD Transistor",
    nameAr: "ترانزستور سطحي مخصص (Custom SMD)",
    category: "custom",
    pitch: 1.27,
    pins: 3,
    padWidth: 1.0,
    padHeight: 1.5,
    bodyWidth: 5.0,
    bodyLength: 4.0,
    description: "Custom Surface Mount Transistor with Manual Dimensions",
  },
];

/**
 * Generate complete KiCad Native Footprint Model for Transistors & Power
 */
export function generateTransistor(params: TransistorParams): KicadFootprintModel {
  const reqPkg = (params.packageType || params.packageSize || "TO-92").trim();
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];

  // Determine mounting (THT vs SMD)
  const isExplicitSmd = params.mounting === "SMD" || STANDARD_SMD_TRANSISTOR_PACKAGES.some(s => s.id === reqPkg);
  const isExplicitTht = params.mounting === "THT" || ALL_THT_TRANSISTOR_PACKAGES.some(t => t.id === reqPkg);
  const mountingType: "SMD" | "THT" = isExplicitSmd && !isExplicitTht ? "SMD" : isExplicitTht ? "THT" : (reqPkg.startsWith("TO-") || reqPkg === "SIP-3" ? "THT" : "SMD");

  const transistorType = params.transistorType || "BJT";
  const polarity = params.polarity || (transistorType === "MOSFET" || transistorType === "JFET" || transistorType === "IGBT" ? "N-Channel" : "NPN");
  const prefix = params.reference || "Q";

  // =========================================================================
  // 1. THT TRANSISTOR GENERATION
  // =========================================================================
  if (mountingType === "THT") {
    // -----------------------------------------------------------------------
    // CASE A: TO-18 (Small Metal Can with Emitter Index Tab)
    // -----------------------------------------------------------------------
    if (reqPkg === "TO-18") {
      const pitchCircleR = 1.27; // 2.54mm circle
      const drill = params.drill ?? 0.75;
      const padSize = params.padSize ?? 1.4;
      const canDia = params.bodyWidth ?? 4.7;
      const canR = canDia / 2;

      // Pins in triangle: Pin 1 (Emitter, rectangular pad with index tab nearby)
      pads.push(createThtPad({ number: "1", x: -pitchCircleR, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: 0, y: pitchCircleR, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: 0, y: -pitchCircleR, width: padSize, height: padSize, shape: "oval", drill }));

      // F.Fab Body Outline
      graphics.push(createFabCircle(0, 0, canR));
      // Index Tab at Pin 1 (angle 180° / left side)
      graphics.push(createFabLine(-canR, 0.4, -canR - 0.7, 0.4));
      graphics.push(createFabLine(-canR - 0.7, 0.4, -canR - 0.7, -0.4));
      graphics.push(createFabLine(-canR - 0.7, -0.4, -canR, -0.4));

      // F.SilkS Body Outline + Tab
      graphics.push(createSilkCircle(0, 0, canR + 0.15));
      graphics.push(createSilkLine(-canR - 0.15, 0.45, -canR - 0.85, 0.45));
      graphics.push(createSilkLine(-canR - 0.85, 0.45, -canR - 0.85, -0.45));
      graphics.push(createSilkLine(-canR - 0.85, -0.45, -canR - 0.15, -0.45));
      graphics.push(createSilkPin1Dot(-canR - 1.2, 0));

      graphics.push(createReferenceText(0, -canR - 1.2));
      graphics.push(createValueText(0, canR + 1.2, params.value || "TO-18"));
      graphics.push(createCourtyardCircle(0, 0, canR + 0.6, KLC_RULES.clearance.courtyardTht));

      const name = `TO-18-3_D${canDia}mm`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: prefix,
        value: params.value || name,
        description: `TO-18 Metal Can Transistor (${transistorType} ${polarity})`,
        tags: ["Transistor", "TO-18", "Metal Can", transistorType, polarity, "Through-Hole"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "transistor",
        generatorParams: params,
      });
    }

    // -----------------------------------------------------------------------
    // CASE B: TO-39 / TO-5 (Medium Metal Can)
    // -----------------------------------------------------------------------
    if (reqPkg === "TO-39" || reqPkg === "TO-5") {
      const pitchCircleR = 2.54; // 5.08mm circle
      const drill = params.drill ?? 0.85;
      const padSize = params.padSize ?? 1.6;
      const canDia = params.bodyWidth ?? 8.5;
      const canR = canDia / 2;

      // Pin 1: Emitter (Rect), Pin 2: Base (Oval), Pin 3: Collector (Oval)
      pads.push(createThtPad({ number: "1", x: -pitchCircleR, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: 0, y: pitchCircleR, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: 0, y: -pitchCircleR, width: padSize, height: padSize, shape: "oval", drill }));

      // F.Fab Circle + Tab
      graphics.push(createFabCircle(0, 0, canR));
      graphics.push(createFabLine(-canR, 0.6, -canR - 1.0, 0.6));
      graphics.push(createFabLine(-canR - 1.0, 0.6, -canR - 1.0, -0.6));
      graphics.push(createFabLine(-canR - 1.0, -0.6, -canR, -0.6));

      // F.SilkS
      graphics.push(createSilkCircle(0, 0, canR + 0.15));
      graphics.push(createSilkLine(-canR - 0.15, 0.65, -canR - 1.15, 0.65));
      graphics.push(createSilkLine(-canR - 1.15, 0.65, -canR - 1.15, -0.65));
      graphics.push(createSilkLine(-canR - 1.15, -0.65, -canR - 0.15, -0.65));
      graphics.push(createSilkPin1Dot(-canR - 1.5, 0));

      graphics.push(createReferenceText(0, -canR - 1.3));
      graphics.push(createValueText(0, canR + 1.3, params.value || "TO-39"));
      graphics.push(createCourtyardCircle(0, 0, canR + 0.6, KLC_RULES.clearance.courtyardTht));

      const name = `TO-39-3_D${canDia}mm`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: prefix,
        value: params.value || name,
        description: `TO-39 Metal Can Transistor (${transistorType} ${polarity})`,
        tags: ["Transistor", "TO-39", "TO-5", transistorType, polarity, "Through-Hole"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "transistor",
        generatorParams: params,
      });
    }

    // -----------------------------------------------------------------------
    // CASE C: TO-92 & TO-92L (Classic Half-Cylinder)
    // -----------------------------------------------------------------------
    if (reqPkg === "TO-92" || reqPkg === "TO-92L") {
      const isL = reqPkg === "TO-92L";
      const pitch = params.pitch ?? 1.27;
      const drill = params.drill ?? 0.75;
      const padSize = params.padSize ?? 1.4;
      const halfW = (params.bodyWidth ?? (isL ? 5.0 : 4.6)) / 2;
      const depth = params.bodyLength ?? (isL ? 4.0 : 3.8);

      pads.push(createThtPad({ number: "1", x: -pitch, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: 0, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: pitch, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      const flatY = -depth * 0.35;
      const arcMaxY = depth * 0.65;

      // F.Fab Half Cylinder Outline
      graphics.push(createFabLine(-halfW, flatY, halfW, flatY));
      graphics.push({
        kind: "arc",
        layer: KLC_RULES.layers.fab,
        start: { x: halfW, y: flatY },
        mid: { x: 0, y: arcMaxY },
        end: { x: -halfW, y: flatY },
        stroke: { width: KLC_RULES.strokeWidth.fab },
      });

      // F.SilkS
      graphics.push(createSilkLine(-halfW - 0.1, flatY - 0.1, halfW + 0.1, flatY - 0.1));
      graphics.push({
        kind: "arc",
        layer: KLC_RULES.layers.silk,
        start: { x: halfW + 0.1, y: flatY - 0.1 },
        mid: { x: 0, y: arcMaxY + 0.15 },
        end: { x: -halfW - 0.1, y: flatY - 0.1 },
        stroke: { width: KLC_RULES.strokeWidth.silkscreen },
      });
      graphics.push(createSilkPin1Dot(-pitch, flatY - 0.7));

      graphics.push(createReferenceText(0, flatY - 1.3));
      graphics.push(createValueText(0, arcMaxY + 1.2, params.value || reqPkg));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      const name = `${reqPkg}_Inline`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: prefix,
        value: params.value || name,
        description: `${reqPkg} Inline 3-Lead Package (${transistorType} ${polarity})`,
        tags: ["Transistor", reqPkg, transistorType, polarity, "Through-Hole"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "transistor",
        generatorParams: params,
      });
    }

    // -----------------------------------------------------------------------
    // CASE D: TO-126 / SOT-32 (Medium Power with Mounting Hole)
    // -----------------------------------------------------------------------
    if (reqPkg === "TO-126" || reqPkg === "SOT-32") {
      const pitch = params.pitch ?? 2.28;
      const drill = params.drill ?? 1.0;
      const padSize = params.padSize ?? 1.8;
      const bodyW = params.bodyWidth ?? 7.8;
      const bodyT = params.bodyLength ?? 3.0;

      pads.push(createThtPad({ number: "1", x: -pitch, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: 0, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: pitch, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      const halfW = bodyW / 2;
      const halfT = bodyT / 2;

      // F.Fab Body Rectangle
      graphics.push(...createFabRect(-halfW, -halfT, halfW, halfT));
      // Mounting hole indication on Fab
      graphics.push(createFabCircle(0, 0, 1.6));

      // F.SilkS
      graphics.push(createSilkLine(-halfW - 0.1, -halfT - 0.1, halfW + 0.1, -halfT - 0.1));
      graphics.push(createSilkLine(halfW + 0.1, -halfT - 0.1, halfW + 0.1, halfT + 0.1));
      graphics.push(createSilkLine(halfW + 0.1, halfT + 0.1, -halfW - 0.1, halfT + 0.1));
      graphics.push(createSilkLine(-halfW - 0.1, halfT + 0.1, -halfW - 0.1, -halfT - 0.1));
      graphics.push(createSilkPin1Dot(-pitch, halfT + 0.8));

      graphics.push(createReferenceText(0, -halfT - 1.2));
      graphics.push(createValueText(0, halfT + 1.2, params.value || "TO-126"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      const name = `TO-126-3_Vertical`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: prefix,
        value: params.value || name,
        description: `TO-126 (SOT-32) 3-Lead Medium Power Package (${transistorType} ${polarity})`,
        tags: ["Transistor", "TO-126", "SOT-32", transistorType, polarity, "Through-Hole"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "transistor",
        generatorParams: params,
      });
    }

    // -----------------------------------------------------------------------
    // CASE E: TO-220, TO-220F, TO-220-5 (High Power Tabbed Package)
    // -----------------------------------------------------------------------
    if (reqPkg === "TO-220" || reqPkg === "TO-220F" || reqPkg === "TO-220-5") {
      const is5Pin = reqPkg === "TO-220-5";
      const isF = reqPkg === "TO-220F";
      const pitch = params.pitch ?? (is5Pin ? 1.70 : 2.54);
      const drill = params.drill ?? (is5Pin ? 0.9 : 1.0);
      const padSize = params.padSize ?? (is5Pin ? 1.5 : 1.8);
      const bodyW = params.bodyWidth ?? 10.2;
      const bodyT = params.bodyLength ?? (isF ? 4.7 : 4.5);

      if (is5Pin) {
        // 5 pins inline: -2*pitch, -pitch, 0, pitch, 2*pitch
        for (let i = 0; i < 5; i++) {
          const px = (i - 2) * pitch;
          pads.push(createThtPad({
            number: String(i + 1),
            x: px,
            y: 0,
            width: padSize,
            height: padSize,
            shape: i === 0 ? "rect" : "oval",
            drill,
          }));
        }
      } else {
        // 3 pins standard
        pads.push(createThtPad({ number: "1", x: -pitch, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
        pads.push(createThtPad({ number: "2", x: 0, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
        pads.push(createThtPad({ number: "3", x: pitch, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
      }

      const halfW = bodyW / 2;
      const halfT = bodyT / 2;

      // F.Fab Body Rectangle
      graphics.push(...createFabRect(-halfW, -halfT, halfW, halfT));
      // Heat tab line behind if not isolated TO-220F
      if (!isF) {
        graphics.push(createFabLine(-halfW, -halfT + 1.2, halfW, -halfT + 1.2));
      }

      // F.SilkS
      graphics.push(createSilkLine(-halfW - 0.1, -halfT - 0.1, halfW + 0.1, -halfT - 0.1));
      graphics.push(createSilkLine(halfW + 0.1, -halfT - 0.1, halfW + 0.1, halfT + 0.1));
      graphics.push(createSilkLine(halfW + 0.1, halfT + 0.1, -halfW - 0.1, halfT + 0.1));
      graphics.push(createSilkLine(-halfW - 0.1, halfT + 0.1, -halfW - 0.1, -halfT - 0.1));
      if (!isF) {
        graphics.push(createSilkLine(-halfW - 0.1, -halfT + 1.2, halfW + 0.1, -halfT + 1.2));
      }
      graphics.push(createSilkPin1Dot(is5Pin ? -2 * pitch : -pitch, halfT + 0.8));

      graphics.push(createReferenceText(0, -halfT - 1.2));
      graphics.push(createValueText(0, halfT + 1.2, params.value || reqPkg));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      const name = `${reqPkg}_Vertical`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: prefix,
        value: params.value || name,
        description: `${reqPkg} Power Transistor (${transistorType} ${polarity})`,
        tags: ["Transistor", reqPkg, "Power", transistorType, polarity, "Through-Hole"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "transistor",
        generatorParams: params,
      });
    }

    // -----------------------------------------------------------------------
    // CASE F: TO-247 & TO-264 & TO-218 (Very High Power Packages)
    // -----------------------------------------------------------------------
    if (reqPkg === "TO-247" || reqPkg === "TO-264" || reqPkg === "TO-218") {
      const is264 = reqPkg === "TO-264";
      const pitch = params.pitch ?? 5.45;
      const drill = params.drill ?? (is264 ? 1.4 : 1.3);
      const padSize = params.padSize ?? (is264 ? 2.6 : 2.4);
      const bodyW = params.bodyWidth ?? (is264 ? 20.0 : reqPkg === "TO-218" ? 15.3 : 15.8);
      const bodyT = params.bodyLength ?? (is264 ? 5.2 : reqPkg === "TO-218" ? 4.8 : 5.0);

      pads.push(createThtPad({ number: "1", x: -pitch, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: 0, y: 0, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: pitch, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      const halfW = bodyW / 2;
      const halfT = bodyT / 2;

      // F.Fab Body
      graphics.push(...createFabRect(-halfW, -halfT, halfW, halfT));
      graphics.push(createFabLine(-halfW, -halfT + 1.5, halfW, -halfT + 1.5));

      // F.SilkS
      graphics.push(createSilkLine(-halfW - 0.15, -halfT - 0.15, halfW + 0.15, -halfT - 0.15));
      graphics.push(createSilkLine(halfW + 0.15, -halfT - 0.15, halfW + 0.15, halfT + 0.15));
      graphics.push(createSilkLine(halfW + 0.15, halfT + 0.15, -halfW - 0.15, halfT + 0.15));
      graphics.push(createSilkLine(-halfW - 0.15, halfT + 0.15, -halfW - 0.15, -halfT - 0.15));
      graphics.push(createSilkLine(-halfW - 0.15, -halfT + 1.5, halfW + 0.15, -halfT + 1.5));
      graphics.push(createSilkPin1Dot(-pitch, halfT + 1.1));

      graphics.push(createReferenceText(0, -halfT - 1.4));
      graphics.push(createValueText(0, halfT + 1.4, params.value || reqPkg));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      const name = `${reqPkg}_Vertical`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: prefix,
        value: params.value || name,
        description: `${reqPkg} High Power Package (${transistorType} ${polarity})`,
        tags: ["Transistor", reqPkg, "Power", transistorType, polarity, "Through-Hole"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "transistor",
        generatorParams: params,
      });
    }

    // -----------------------------------------------------------------------
    // CASE G: TO-3 & TO-66 (Iconic Diamond Metal Can High Power)
    // -----------------------------------------------------------------------
    if (reqPkg === "TO-3" || reqPkg === "TO-66") {
      const is66 = reqPkg === "TO-66";
      const screwDistX = is66 ? 12.2 : 15.05; // 24.4mm vs 30.1mm hole spacing
      const pinDistY = is66 ? 2.54 : 5.46;    // pin offset in Y
      const screwHoleDia = is66 ? 3.2 : 4.2;
      const pinDrill = params.drill ?? (is66 ? 1.2 : 1.5);
      const padSize = params.padSize ?? (is66 ? 2.5 : 3.0);
      const bodyW = params.bodyWidth ?? (is66 ? 31.0 : 39.0);
      const bodyH = params.bodyLength ?? (is66 ? 18.0 : 26.0);

      // Pins 1 and 2 (Base and Emitter)
      pads.push(createThtPad({ number: "1", x: 0, y: -pinDistY, width: padSize, height: padSize, shape: "rect", drill: pinDrill }));
      pads.push(createThtPad({ number: "2", x: 0, y: pinDistY, width: padSize, height: padSize, shape: "oval", drill: pinDrill }));

      // Mounting Holes (Screws, Collector/Case connection)
      pads.push(createNpthHole(-screwDistX, 0, screwHoleDia));
      pads.push(createNpthHole(screwDistX, 0, screwHoleDia));

      // Diamond Outline approximation: Center ellipse/circle + two rounded lobes
      const halfW = bodyW / 2;
      const halfH = bodyH / 2;
      // F.Fab Diamond Lobe lines
      graphics.push(createFabLine(-screwDistX, halfH * 0.4, -halfW, 0));
      graphics.push(createFabLine(-halfW, 0, -screwDistX, -halfH * 0.4));
      graphics.push(createFabLine(-screwDistX, -halfH * 0.4, 0, -halfH));
      graphics.push(createFabLine(0, -halfH, screwDistX, -halfH * 0.4));
      graphics.push(createFabLine(screwDistX, -halfH * 0.4, halfW, 0));
      graphics.push(createFabLine(halfW, 0, screwDistX, halfH * 0.4));
      graphics.push(createFabLine(screwDistX, halfH * 0.4, 0, halfH));
      graphics.push(createFabLine(0, halfH, -screwDistX, halfH * 0.4));

      // F.SilkS Outline
      graphics.push(createSilkLine(-screwDistX, halfH * 0.4, -halfW, 0));
      graphics.push(createSilkLine(-halfW, 0, -screwDistX, -halfH * 0.4));
      graphics.push(createSilkLine(-screwDistX, -halfH * 0.4, 0, -halfH));
      graphics.push(createSilkLine(0, -halfH, screwDistX, -halfH * 0.4));
      graphics.push(createSilkLine(screwDistX, -halfH * 0.4, halfW, 0));
      graphics.push(createSilkLine(halfW, 0, screwDistX, halfH * 0.4));
      graphics.push(createSilkLine(screwDistX, halfH * 0.4, 0, halfH));
      graphics.push(createSilkLine(0, halfH, -screwDistX, halfH * 0.4));
      graphics.push(createSilkPin1Dot(0, -pinDistY - 2.0));

      graphics.push(createReferenceText(0, -halfH - 1.5));
      graphics.push(createValueText(0, halfH + 1.5, params.value || reqPkg));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      const name = `${reqPkg}_Diamond`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: prefix,
        value: params.value || name,
        description: `${reqPkg} Diamond Metal Can Power Package (${transistorType} ${polarity})`,
        tags: ["Transistor", reqPkg, "Diamond", "Power", transistorType, polarity, "Through-Hole"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "transistor",
        generatorParams: params,
      });
    }

    // -----------------------------------------------------------------------
    // CASE H: TO-251 / IPAK & SIP-3 & Custom THT Transistor
    // -----------------------------------------------------------------------
    const isCustom = reqPkg === "Custom" || reqPkg.startsWith("Custom");
    const pitch = params.pitch ?? (reqPkg === "TO-251" ? 2.28 : 2.54);
    const pinCount = params.pins ?? 3;
    const drill = params.drill ?? 1.0;
    const padSize = params.padSize ?? 1.8;
    const bodyW = params.bodyWidth ?? (pinCount * pitch + 2.5);
    const bodyT = params.bodyLength ?? 4.5;

    const startX = -((pinCount - 1) * pitch) / 2;
    for (let i = 0; i < pinCount; i++) {
      const px = startX + i * pitch;
      pads.push(createThtPad({
        number: String(i + 1),
        x: px,
        y: 0,
        width: padSize,
        height: padSize,
        shape: i === 0 ? "rect" : "oval",
        drill,
      }));
    }

    const halfW = bodyW / 2;
    const halfT = bodyT / 2;

    // F.Fab Body Outline
    graphics.push(...createFabRect(-halfW, -halfT, halfW, halfT));
    if (params.thtStyle === "tabbed" || reqPkg === "TO-251") {
      graphics.push(createFabLine(-halfW, -halfT + 1.0, halfW, -halfT + 1.0));
    }

    // F.SilkS Body Outline
    graphics.push(createSilkLine(-halfW - 0.1, -halfT - 0.1, halfW + 0.1, -halfT - 0.1));
    graphics.push(createSilkLine(halfW + 0.1, -halfT - 0.1, halfW + 0.1, halfT + 0.1));
    graphics.push(createSilkLine(halfW + 0.1, halfT + 0.1, -halfW - 0.1, halfT + 0.1));
    graphics.push(createSilkLine(-halfW - 0.1, halfT + 0.1, -halfW - 0.1, -halfT - 0.1));
    graphics.push(createSilkPin1Dot(startX, halfT + 0.8));

    graphics.push(createReferenceText(0, -halfT - 1.2));
    graphics.push(createValueText(0, halfT + 1.2, params.value || (isCustom ? `THT_${pinCount}P_P${pitch}mm` : reqPkg)));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    const name = isCustom ? `Transistor_THT_${pinCount}P_P${pitch}mm` : `${reqPkg}_Vertical`;
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `${reqPkg} Through-Hole Transistor (${transistorType} ${polarity})`,
      tags: ["Transistor", reqPkg, transistorType, polarity, "Through-Hole"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "transistor",
      generatorParams: params,
    });
  }

  // =========================================================================
  // 2. SMD TRANSISTOR & POWER PACKAGES
  // =========================================================================

  // -------------------------------------------------------------------------
  // CASE 1: SOT-23 / SOT-23-3 & SOT-323
  // -------------------------------------------------------------------------
  if (reqPkg === "SOT-23" || reqPkg === "SOT-323") {
    const is323 = reqPkg === "SOT-323";
    const pitch = is323 ? 0.65 : 0.95;
    const padW = params.padWidth ?? (is323 ? 0.5 : 0.8);
    const padH = params.padHeight ?? (is323 ? 0.6 : 0.9);
    const posY = is323 ? 0.9 : 1.0;
    const bodyW = is323 ? 2.0 : 2.9;
    const bodyH = is323 ? 1.25 : 1.3;

    // Pad 1: bottom-left, Pad 2: bottom-right, Pad 3: top-center
    pads.push(createSmdPad({ number: "1", x: -pitch, y: posY, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: pitch, y: posY, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "3", x: 0, y: -posY, width: padW, height: padH, shape: "roundrect" }));

    // F.Fab Body Outline
    graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
    // F.SilkS
    graphics.push(createSilkLine(-bodyW / 2 - 0.1, -bodyH / 2 - 0.1, -bodyW / 2 - 0.1, bodyH / 2 + 0.1));
    graphics.push(createSilkLine(bodyW / 2 + 0.1, -bodyH / 2 - 0.1, bodyW / 2 + 0.1, bodyH / 2 + 0.1));
    graphics.push(createSilkPin1Dot(-pitch, posY + 0.7));

    graphics.push(createReferenceText(0, -posY - 0.9));
    graphics.push(createValueText(0, posY + 0.9, params.value || reqPkg));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    const name = `${reqPkg}_Standard`;
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `${reqPkg} Small Signal Surface Mount Transistor (${transistorType} ${polarity})`,
      tags: ["Transistor", reqPkg, "SMD", transistorType, polarity],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "transistor",
      generatorParams: params,
    });
  }

  // -------------------------------------------------------------------------
  // CASE 2: SOT-23-5 & SOT-23-6 & SOT-363
  // -------------------------------------------------------------------------
  if (reqPkg === "SOT-23-5" || reqPkg === "SOT-23-6" || reqPkg === "SOT-363") {
    const is363 = reqPkg === "SOT-363";
    const is5 = reqPkg === "SOT-23-5";
    const pitch = is363 ? 0.65 : 0.95;
    const padW = params.padWidth ?? (is363 ? 0.4 : 0.7);
    const padH = params.padHeight ?? (is363 ? 0.6 : 1.0);
    const posY = is363 ? 0.9 : 1.1;
    const bodyW = is363 ? 2.0 : 2.9;
    const bodyH = is363 ? 1.25 : 1.6;

    // Bottom row: Pins 1, 2, 3
    pads.push(createSmdPad({ number: "1", x: -pitch, y: posY, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: 0, y: posY, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "3", x: pitch, y: posY, width: padW, height: padH, shape: "roundrect" }));

    // Top row:
    if (is5) {
      // 5-pin has Pin 4 top-right, Pin 5 top-left
      pads.push(createSmdPad({ number: "4", x: pitch, y: -posY, width: padW, height: padH, shape: "roundrect" }));
      pads.push(createSmdPad({ number: "5", x: -pitch, y: -posY, width: padW, height: padH, shape: "roundrect" }));
    } else {
      // 6-pin: Pins 4, 5, 6
      pads.push(createSmdPad({ number: "4", x: pitch, y: -posY, width: padW, height: padH, shape: "roundrect" }));
      pads.push(createSmdPad({ number: "5", x: 0, y: -posY, width: padW, height: padH, shape: "roundrect" }));
      pads.push(createSmdPad({ number: "6", x: -pitch, y: -posY, width: padW, height: padH, shape: "roundrect" }));
    }

    graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
    graphics.push(createSilkPin1Dot(-pitch, posY + 0.8));

    graphics.push(createReferenceText(0, -posY - 1.0));
    graphics.push(createValueText(0, posY + 1.0, params.value || reqPkg));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    const name = `${reqPkg}_Transistor`;
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `${reqPkg} Surface Mount Transistor Package (${transistorType} ${polarity})`,
      tags: ["Transistor", reqPkg, "SMD", transistorType, polarity],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "transistor",
      generatorParams: params,
    });
  }

  // -------------------------------------------------------------------------
  // CASE 3: SOT-223 (Medium Power with Tab Pin 4)
  // -------------------------------------------------------------------------
  if (reqPkg === "SOT-223") {
    pads.push(createSmdPad({ number: "1", x: -2.3, y: 3.1, width: 1.0, height: 1.8, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: 0, y: 3.1, width: 1.0, height: 1.8, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "3", x: 2.3, y: 3.1, width: 1.0, height: 1.8, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "4", x: 0, y: -3.1, width: 3.3, height: 1.8, shape: "roundrect" }));

    graphics.push(...createFabRect(-3.25, -1.75, 3.25, 1.75));
    graphics.push(createSilkLine(-3.35, -1.85, -3.35, 1.85));
    graphics.push(createSilkLine(3.35, -1.85, 3.35, 1.85));
    graphics.push(createSilkPin1Dot(-2.3, 4.3));

    graphics.push(createReferenceText(0, -4.3));
    graphics.push(createValueText(0, 4.3, params.value || "SOT-223"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    const name = "SOT-223-3_TabPin4";
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `SOT-223-3 with large heat tab (Pin 4) (${transistorType} ${polarity})`,
      tags: ["Transistor", "SOT-223", "Power", "SMD", transistorType, polarity],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "transistor",
      generatorParams: params,
    });
  }

  // -------------------------------------------------------------------------
  // CASE 4: SOT-89 (Compact Power SOT with Center Tab)
  // -------------------------------------------------------------------------
  if (reqPkg === "SOT-89") {
    pads.push(createSmdPad({ number: "1", x: -1.5, y: 1.8, width: 0.8, height: 1.4, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: 0, y: 0.9, width: 1.8, height: 2.5, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "3", x: 1.5, y: 1.8, width: 0.8, height: 1.4, shape: "roundrect" }));

    graphics.push(...createFabRect(-2.25, -1.25, 2.25, 1.25));
    graphics.push(createSilkLine(-2.35, -1.35, -2.35, 1.35));
    graphics.push(createSilkLine(2.35, -1.35, 2.35, 1.35));
    graphics.push(createSilkPin1Dot(-1.5, 2.8));

    graphics.push(createReferenceText(0, -2.8));
    graphics.push(createValueText(0, 2.8, params.value || "SOT-89"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    const name = "SOT-89-3";
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `SOT-89 Power SMT Transistor (${transistorType} ${polarity})`,
      tags: ["Transistor", "SOT-89", "Power", "SMD", transistorType, polarity],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "transistor",
      generatorParams: params,
    });
  }

  // -------------------------------------------------------------------------
  // CASE 5: DPAK / TO-252 & D2PAK / TO-263 (Power Transistors & MOSFETs)
  // -------------------------------------------------------------------------
  if (reqPkg === "DPAK" || reqPkg === "TO-252" || reqPkg === "D2PAK" || reqPkg === "TO-263") {
    const isD2 = reqPkg === "D2PAK" || reqPkg === "TO-263";
    const pitch = isD2 ? 2.54 : 2.28;
    const leadPadW = isD2 ? 1.6 : 1.4;
    const leadPadH = isD2 ? 3.4 : 2.2;
    const leadPosY = isD2 ? 5.4 : 3.7;
    const tabW = isD2 ? 10.5 : 6.6;
    const tabH = isD2 ? 10.0 : 6.8;
    const tabPosY = isD2 ? -3.0 : -2.0;
    const bodyW = isD2 ? 10.2 : 6.6;
    const bodyH = isD2 ? 9.2 : 6.1;

    // Pin 1 (Gate/Base, x=-pitch), Pin 3 (Source/Emitter, x=pitch), Pin 2 (Drain/Collector large tab)
    pads.push(createSmdPad({ number: "1", x: -pitch, y: leadPosY, width: leadPadW, height: leadPadH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "3", x: pitch, y: leadPosY, width: leadPadW, height: leadPadH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: 0, y: tabPosY, width: tabW, height: tabH, shape: "roundrect" }));

    graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
    graphics.push(createSilkPin1Dot(-pitch, leadPosY + 1.6));

    graphics.push(createReferenceText(0, tabPosY - tabH / 2 - 1.2));
    graphics.push(createValueText(0, leadPosY + 1.6, params.value || reqPkg));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    const name = isD2 ? "TO-263-2_D2PAK" : "TO-252-2_DPAK";
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `${reqPkg} Surface Mount Power Transistor (${transistorType} ${polarity})`,
      tags: ["Transistor", reqPkg, "Power", "MOSFET", transistorType, polarity, "SMD"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "transistor",
      generatorParams: params,
    });
  }

  // -------------------------------------------------------------------------
  // CASE 6: SO-8 & PowerPAK-56 & LFPAK56 & Custom SMD
  // -------------------------------------------------------------------------
  if (reqPkg === "SO-8" || reqPkg === "PowerPAK-56" || reqPkg === "LFPAK56") {
    // 8-lead standard power MOSFET pinout: Pins 1,2,3 Source, 4 Gate, 5,6,7,8 Drain
    const pitch = 1.27;
    const posY = reqPkg === "SO-8" ? 2.6 : 2.4;
    const padW = 0.6;
    const padH = reqPkg === "SO-8" ? 1.5 : 0.8;

    // Bottom pins 1, 2, 3, 4
    for (let i = 0; i < 4; i++) {
      const px = (i - 1.5) * pitch;
      pads.push(createSmdPad({ number: String(i + 1), x: px, y: posY, width: padW, height: padH, shape: "roundrect" }));
    }
    // Top pins 5, 6, 7, 8 (or large drain tab in PowerPAK/LFPAK)
    if (reqPkg === "SO-8") {
      for (let i = 0; i < 4; i++) {
        const px = (1.5 - i) * pitch;
        pads.push(createSmdPad({ number: String(i + 5), x: px, y: -posY, width: padW, height: padH, shape: "roundrect" }));
      }
    } else {
      // Large thermal drain tab in center
      pads.push(createSmdPad({ number: "5", x: 0, y: -0.6, width: 4.2, height: 3.4, shape: "roundrect" }));
      pads.push(createSmdPad({ number: "6", x: pitch * 1.5, y: -posY, width: padW, height: padH, shape: "roundrect" }));
      pads.push(createSmdPad({ number: "7", x: pitch * 0.5, y: -posY, width: padW, height: padH, shape: "roundrect" }));
      pads.push(createSmdPad({ number: "8", x: -pitch * 0.5, y: -posY, width: padW, height: padH, shape: "roundrect" }));
    }

    graphics.push(...createFabRect(-2.5, -2.5, 2.5, 2.5));
    graphics.push(createSilkPin1Dot(-pitch * 1.5, posY + 1.2));

    graphics.push(createReferenceText(0, -3.4));
    graphics.push(createValueText(0, 3.4, params.value || reqPkg));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    const name = `${reqPkg}_PowerMOSFET`;
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `${reqPkg} Power MOSFET Package (${transistorType} ${polarity})`,
      tags: ["Transistor", reqPkg, "Power", "MOSFET", transistorType, polarity, "SMD"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "transistor",
      generatorParams: params,
    });
  }

  // -------------------------------------------------------------------------
  // CASE 7: Custom SMD Transistor
  // -------------------------------------------------------------------------
  const padW = params.padWidth ?? 1.0;
  const padH = params.padHeight ?? 1.5;
  const pitch = params.pitch ?? 1.27;
  const pinCount = params.pins ?? 3;
  const bodyW = params.bodyWidth ?? (pinCount * pitch + 1.5);
  const bodyH = params.bodyLength ?? 4.0;

  const startX = -((Math.ceil(pinCount / 2) - 1) * pitch) / 2;
  const halfPin = Math.floor(pinCount / 2);

  // Bottom row
  for (let i = 0; i < (pinCount - halfPin); i++) {
    pads.push(createSmdPad({
      number: String(i + 1),
      x: startX + i * pitch,
      y: bodyH / 2 + padH / 4,
      width: padW,
      height: padH,
      shape: "roundrect",
    }));
  }
  // Top row
  for (let i = 0; i < halfPin; i++) {
    pads.push(createSmdPad({
      number: String(pinCount - i),
      x: startX + i * pitch,
      y: -bodyH / 2 - padH / 4,
      width: padW,
      height: padH,
      shape: "roundrect",
    }));
  }

  graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
  graphics.push(createSilkPin1Dot(startX, bodyH / 2 + padH / 2 + 0.5));

  graphics.push(createReferenceText(0, -bodyH / 2 - padH / 2 - 1.0));
  graphics.push(createValueText(0, bodyH / 2 + padH / 2 + 1.0, params.value || "SMD_Transistor"));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  const name = `Transistor_SMD_${pinCount}P_P${pitch}mm`;
  return buildNativeFootprintModel({
    name,
    referencePrefix: prefix,
    value: params.value || name,
    description: `Custom Surface Mount Transistor (${transistorType} ${polarity})`,
    tags: ["Transistor", "Custom", "SMD", transistorType, polarity],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "transistor",
    generatorParams: params,
  });
}
