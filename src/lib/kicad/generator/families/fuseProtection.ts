import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabRect, createFabCircle } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface FuseProtectionStandardPackage {
  id: string;
  name: string;
  category: "fuse_smd" | "tvs_smd" | "cartridge_tht" | "ptc_tht" | "varistor_tht" | "gdt_tht";
  desc: string;
  mounting: "SMD" | "THT";
}

export const QUICK_STANDARD_THT_FUSE_PACKAGES = [
  { id: "Fuseholder_5x20mm_THT", name: "Fuse 5x20", mounting: "THT" },
  { id: "Varistor_MOV_10D", name: "Var MOV 10D", mounting: "THT" },
];

export const MORE_STANDARD_THT_FUSE_PACKAGES = [
  { id: "Fuseholder_6.3x32mm", name: "Fuse 6.3x32", mounting: "THT" },
  { id: "Varistor_MOV_7D", name: "Var MOV 7D", mounting: "THT" },
  { id: "Varistor_MOV_14D", name: "Var MOV 14D", mounting: "THT" },
  { id: "GDT_2Pin_P5mm", name: "GDT 2P", mounting: "THT" },
];

export const STANDARD_SMD_FUSE_PACKAGES = [
  { id: "Fuse_SMD_0603", name: "Fuse 0603", mounting: "SMD" },
  { id: "Fuse_SMD_0805", name: "Fuse 0805", mounting: "SMD" },
  { id: "Fuse_SMD_1206", name: "Fuse 1206", mounting: "SMD" },
  { id: "Fuse_SMD_1812", name: "Fuse 1812", mounting: "SMD" },
  { id: "TVS_SMAJ", name: "TVS SMAJ", mounting: "SMD" },
  { id: "TVS_SMBJ", name: "TVS SMBJ", mounting: "SMD" },
];

export const STANDARD_FUSE_PACKAGES = [
  ...QUICK_STANDARD_THT_FUSE_PACKAGES,
  ...STANDARD_SMD_FUSE_PACKAGES
];

export const ALL_FUSE_PACKAGES = STANDARD_FUSE_PACKAGES;

export interface FuseProtectionParams {
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

export function generateFuseProtection(params: FuseProtectionParams): KicadFootprintModel {
  const pkg = (params.packageSize || params.packageType || "Fuse_SMD_1206").trim();
  const isTht = params.mounting === "THT" || pkg.includes("THT") || pkg.includes("Cartridge") || pkg.includes("Radial_PTC") || pkg.includes("Varistor_") || pkg.includes("GDT_") || pkg.includes("Fuseholder_") || pkg.includes("Thermal");
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const isVaristor = pkg.toLowerCase().includes("varistor") || pkg.includes("MOV");
  const isTvs = pkg.toLowerCase().includes("tvs");
  const ref = params.reference || (isVaristor ? "RV" : isTvs ? "D" : "F");

  // ==========================================
  // THT Packages
  // ==========================================
  if (isTht) {
    // 1. Fuseholder 5x20mm Cartridge THT
    if (pkg.includes("5x20mm")) {
      const pitch = typeof params.pitch === "number" ? params.pitch : 22.6;
      const drill = typeof params.drill === "number" ? params.drill : 1.6;
      const padSize = typeof params.padSize === "number" ? params.padSize : 3.0;

      pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(...createFabRect(-13.0, -4.0, 13.0, 4.0));
      graphics.push(...createFabRect(-10.0, -2.5, 10.0, 2.5));
      graphics.push(createSilkLine(-13.2, -4.2, 13.2, -4.2));
      graphics.push(createSilkLine(13.2, -4.2, 13.2, 4.2));
      graphics.push(createSilkLine(13.2, 4.2, -13.2, 4.2));
      graphics.push(createSilkLine(-13.2, 4.2, -13.2, -4.2));
      graphics.push(createReferenceText(0, -5.2));
      graphics.push(createValueText(0, 5.2, params.value || "Fuse_5x20mm"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "Fuseholder_Cartridge_5x20mm_THT",
        referencePrefix: ref,
        value: params.value || "Fuse_5x20mm",
        description: "Cartridge Fuse Holder for 5x20mm fuses Through-Hole",
        tags: ["Fuse", "Fuseholder", "Cartridge", "5x20mm", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "fuse_protection",
        generatorParams: params,
      });
    }

    // 2. Fuseholder 6.3x32mm Cartridge THT
    if (pkg.includes("6.3x32mm")) {
      const pitch = 35.0;
      const drill = 1.8;
      const padSize = 3.6;

      pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(...createFabRect(-19.0, -5.0, 19.0, 5.0));
      graphics.push(...createFabRect(-16.0, -3.2, 16.0, 3.2));
      graphics.push(createSilkLine(-19.2, -5.2, 19.2, -5.2));
      graphics.push(createSilkLine(19.2, -5.2, 19.2, 5.2));
      graphics.push(createSilkLine(19.2, 5.2, -19.2, 5.2));
      graphics.push(createSilkLine(-19.2, 5.2, -19.2, -5.2));
      graphics.push(createReferenceText(0, -6.5));
      graphics.push(createValueText(0, 6.5, params.value || "Fuse_6.3x32mm"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "Fuseholder_Cartridge_6.3x32mm_THT",
        referencePrefix: ref,
        value: params.value || "Fuse_6.3x32mm",
        description: "Cartridge Fuse Holder for 6.3x32mm (1/4x1-1/4\") fuses",
        tags: ["Fuse", "Cartridge", "6.3x32mm", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "fuse_protection",
        generatorParams: params,
      });
    }

    // 3. Radial PTC Resettable PolySwitch
    if (pkg.includes("Radial_PTC") || pkg.includes("PTC")) {
      const is762 = pkg.includes("7.62");
      const pitch = typeof params.pitch === "number" ? params.pitch : (is762 ? 7.62 : 5.08);
      const diam = is762 ? 11.5 : 8.5;
      const drill = typeof params.drill === "number" ? params.drill : 0.9;
      const padSize = typeof params.padSize === "number" ? params.padSize : 1.8;

      pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(...createFabRect(-diam / 2, -1.8, diam / 2, 1.8));
      graphics.push(createSilkLine(-diam / 2, -1.9, diam / 2, -1.9));
      graphics.push(createSilkLine(diam / 2, -1.9, diam / 2, 1.9));
      graphics.push(createSilkLine(diam / 2, 1.9, -diam / 2, 1.9));
      graphics.push(createSilkLine(-diam / 2, 1.9, -diam / 2, -1.9));
      graphics.push(createReferenceText(0, -3.0));
      graphics.push(createValueText(0, 3.0, params.value || "PolySwitch"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: `Fuse_PTC_Radial_D${Math.round(diam)}mm_P${pitch.toFixed(2)}mm`,
        referencePrefix: ref,
        value: params.value || "PTC",
        description: `Radial Resettable PolySwitch PTC Fuse Disc D${diam}mm Pitch ${pitch}mm`,
        tags: ["Fuse", "PTC", "PolySwitch", "Radial", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "fuse_protection",
        generatorParams: params,
      });
    }

    // 4. Varistor MOV (07D, 10D, 14D, 20D)
    if (pkg.includes("Varistor") || pkg.includes("MOV")) {
      const is20d = pkg.includes("20D");
      const is14d = pkg.includes("14D");
      const is10d = pkg.includes("10D");
      const pitch = typeof params.pitch === "number" ? params.pitch : (is20d ? 10.0 : (is14d || is10d) ? 7.5 : 5.0);
      const diam = is20d ? 22.0 : is14d ? 15.5 : is10d ? 11.5 : 8.5;
      const drill = 0.9;
      const padSize = 1.8;

      pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(...createFabRect(-diam / 2, -2.2, diam / 2, 2.2));
      graphics.push(createSilkLine(-diam / 2 - 0.2, -2.3, diam / 2 + 0.2, -2.3));
      graphics.push(createSilkLine(diam / 2 + 0.2, -2.3, diam / 2 + 0.2, 2.3));
      graphics.push(createSilkLine(diam / 2 + 0.2, 2.3, -diam / 2 - 0.2, 2.3));
      graphics.push(createSilkLine(-diam / 2 - 0.2, 2.3, -diam / 2 - 0.2, -2.3));
      graphics.push(createReferenceText(0, -3.5));
      graphics.push(createValueText(0, 3.5, params.value || pkg));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: `Varistor_MOV_D${Math.round(diam)}mm_P${pitch.toFixed(1)}mm`,
        referencePrefix: ref,
        value: params.value || pkg,
        description: `Metal Oxide Varistor (MOV) Disc D${diam}mm Pitch ${pitch}mm`,
        tags: ["Varistor", "MOV", "Protection", "Surge", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "fuse_protection",
        generatorParams: params,
      });
    }

    // 5. Gas Discharge Tube GDT 2-Pin
    const pitch = typeof params.pitch === "number" ? params.pitch : 5.0;
    const drill = typeof params.drill === "number" ? params.drill : 1.0;
    const padSize = typeof params.padSize === "number" ? params.padSize : 2.0;

    pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
    pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

    graphics.push(createFabCircle(0, 0, 4.0));
    graphics.push(createSilkCircle(0, 0, 4.2));
    graphics.push(createReferenceText(0, -5.2));
    graphics.push(createValueText(0, 5.2, params.value || "GDT_2Pin"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "GDT_2Pin_D8.0mm_P5.0mm",
      referencePrefix: ref,
      value: params.value || "GDT",
      description: "Gas Discharge Tube 2-Lead 8mm Dia Pitch 5.0mm",
      tags: ["GDT", "Surge", "Protection", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "fuse_protection",
      generatorParams: params,
    });
  }

  // ==========================================
  // SMD Packages
  // ==========================================

  // 1. TVS Diodes (SMAJ, SMBJ, SMCJ, SOD-123FL)
  if (pkg.includes("TVS") || pkg.includes("SMA") || pkg.includes("SMB") || pkg.includes("SMC") || pkg.includes("SOD")) {
    const isSma = pkg.includes("SMA");
    const isSmc = pkg.includes("SMC");
    const isSod = pkg.includes("SOD");

    const padW = isSod ? 1.0 : isSmc ? 2.3 : isSma ? 1.5 : 2.1;
    const padH = isSod ? 1.4 : isSmc ? 3.0 : isSma ? 1.7 : 2.2;
    const padX = isSod ? 1.6 : isSmc ? 3.1 : isSma ? 2.0 : 2.2;
    const bodyW = isSod ? 2.8 : isSmc ? 7.0 : isSma ? 4.5 : 5.4;
    const bodyH = isSod ? 1.8 : isSmc ? 6.0 : isSma ? 2.6 : 3.6;

    pads.push(createSmdPad({ number: "1", x: -padX, y: 0, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: padX, y: 0, width: padW, height: padH, shape: "roundrect" }));

    graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
    graphics.push(createSilkLine(-bodyW / 2, -bodyH / 2 - 0.2, bodyW / 2, -bodyH / 2 - 0.2));
    graphics.push(createSilkLine(-bodyW / 2, bodyH / 2 + 0.2, bodyW / 2, bodyH / 2 + 0.2));
    graphics.push(createSilkPin1Dot(-padX - padW / 2 - 0.4, 0));
    graphics.push(createReferenceText(0, -bodyH / 2 - 1.0));
    graphics.push(createValueText(0, bodyH / 2 + 1.0, params.value || pkg));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: `TVS_Diode_${pkg.replace("TVS_", "")}`,
      referencePrefix: ref,
      value: params.value || pkg,
      description: `Transient Voltage Suppressor TVS Diode ${pkg.replace("TVS_", "")}`,
      tags: ["TVS", "Diode", "Protection", "Surge", "SMD"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "fuse_protection",
      generatorParams: params,
    });
  }

  // 2. SMD PPTC / Chip Fuses (0603, 0805, 1206, 1812, 2410, 2920) or Custom SMD
  const is0603 = pkg.includes("0603");
  const is0805 = pkg.includes("0805");
  const is1206 = pkg.includes("1206");
  const is1812 = pkg.includes("1812");
  const is2410 = pkg.includes("2410");
  const is2920 = pkg.includes("2920");

  let padW = 1.1;
  let padH = 1.8;
  let spanX = 3.2;
  let bodyW = 3.2;
  let bodyH = 1.6;

  if (is0603) {
    padW = 0.8; padH = 0.9; spanX = 1.6; bodyW = 1.6; bodyH = 0.8;
  } else if (is0805) {
    padW = 1.0; padH = 1.3; spanX = 2.0; bodyW = 2.0; bodyH = 1.25;
  } else if (is1812) {
    padW = 1.4; padH = 3.2; spanX = 4.5; bodyW = 4.5; bodyH = 3.2;
  } else if (is2410) {
    padW = 1.6; padH = 2.8; spanX = 6.1; bodyW = 6.1; bodyH = 2.6;
  } else if (is2920) {
    padW = 1.8; padH = 5.2; spanX = 7.4; bodyW = 7.4; bodyH = 5.1;
  } else if (params.padWidth && params.padHeight) {
    padW = params.padWidth;
    padH = params.padHeight;
    spanX = params.pitch || 3.2;
    bodyW = params.bodyLength || 3.2;
    bodyH = params.bodyWidth || 1.6;
  }

  pads.push(createSmdPad({ number: "1", x: -spanX / 2, y: 0, width: padW, height: padH, shape: "roundrect" }));
  pads.push(createSmdPad({ number: "2", x: spanX / 2, y: 0, width: padW, height: padH, shape: "roundrect" }));

  graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
  graphics.push(createSilkLine(-bodyW / 2, -bodyH / 2 - 0.2, bodyW / 2, -bodyH / 2 - 0.2));
  graphics.push(createSilkLine(-bodyW / 2, bodyH / 2 + 0.2, bodyW / 2, bodyH / 2 + 0.2));
  graphics.push(createReferenceText(0, -bodyH / 2 - 0.9));
  graphics.push(createValueText(0, bodyH / 2 + 0.9, params.value || pkg));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  return buildNativeFootprintModel({
    name: `Fuse_SMD_${pkg.replace("Fuse_SMD_", "")}`,
    referencePrefix: ref,
    value: params.value || pkg,
    description: `SMD Fuse / Resettable PTC ${pkg.replace("Fuse_SMD_", "")}`,
    tags: ["Fuse", "Protection", "SMD"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "fuse_protection",
    generatorParams: params,
  });
}
