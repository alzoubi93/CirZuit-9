import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabRect, createFabCircle } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export type InductorPackageType =
  | "SMD"
  | "THT"
  | "Power Inductor"
  | "Ferrite Bead"
  | "Common Mode Choke"
  | string;

export interface InductorParams {
  packageType?: InductorPackageType;
  packageSize?: string;
  chipSize?: string;
  reference?: string;
  value?: string;
  [key: string]: any;
}

export const QUICK_STANDARD_THT_INDUCTOR_PACKAGES = [
  { id: "axial-l5", name: "Ax-L 5mm", pitch: 7.62, mounting: "THT" },
  { id: "radial-d6", name: "Rad-L D6", pitch: 3.0, mounting: "THT" },
  { id: "toroid-d15", name: "Tor-L D15", pitch: 10.0, mounting: "THT" },
];

export const MORE_STANDARD_THT_INDUCTOR_PACKAGES = [
  { id: "axial-l7", name: "Ax-L 7mm", pitch: 10.16, mounting: "THT" },
  { id: "radial-d8", name: "Rad-L D8", pitch: 5.0, mounting: "THT" },
  { id: "radial-d10", name: "Rad-L D10", pitch: 5.0, mounting: "THT" },
  { id: "toroid-d20", name: "Tor-L D20", pitch: 12.0, mounting: "THT" },
  { id: "cmc-uu9.8", name: "CMC UU9.8", pitch: 7.0, mounting: "THT" },
];

export const STANDARD_SMD_INDUCTOR_PACKAGES = [
  { id: "0402", name: "0402", desc: "1.0x0.5mm", category: "chip", mounting: "SMD" },
  { id: "0603", name: "0603", desc: "1.6x0.8mm", category: "chip", mounting: "SMD" },
  { id: "0805", name: "0805", desc: "2.0x1.2mm", category: "chip", mounting: "SMD" },
  { id: "1206", name: "1206", desc: "3.2x1.6mm", category: "chip", mounting: "SMD" },
  { id: "CDRH104", name: "CDRH104", desc: "10x10mm", category: "power", mounting: "SMD" },
  { id: "CDRH127", name: "CDRH127", desc: "12x12mm", category: "power", mounting: "SMD" },
  { id: "NR3015", name: "NR3015", desc: "3x3mm", category: "power", mounting: "SMD" },
  { id: "NR6045", name: "NR6045", desc: "6x6mm", category: "power", mounting: "SMD" },
];

export const STANDARD_INDUCTOR_PACKAGES = [
  ...QUICK_STANDARD_THT_INDUCTOR_PACKAGES,
  ...STANDARD_SMD_INDUCTOR_PACKAGES
];

export const ALL_INDUCTOR_PACKAGES = STANDARD_INDUCTOR_PACKAGES;

export function generateInductor(params: InductorParams): KicadFootprintModel {
  const rawPkg = params.packageType || "SMD";
  const pkgLower = rawPkg.toLowerCase();
  const subSize = params.packageSize || params.chipSize || "";
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const ref = params.reference || "L";

  // 1. Common Mode Choke (4-Pin Dual Coil)
  if (pkgLower.includes("common") || pkgLower.includes("choke") || pkgLower.includes("cmc") || subSize.toLowerCase().includes("cmc") || params.thtType === "cmc") {
    const isThtUU9 = subSize.includes("UU9") || subSize.includes("uu9") || subSize.includes("cmc-uu9");
    const isThtUU10 = subSize.includes("UU10") || subSize.includes("uu10") || subSize.includes("cmc-uu10");
    const isThtToroid = subSize.includes("Toroid") || subSize.includes("toroid");
    const isThtCustomCMC = params.mounting === "THT" && (subSize.toLowerCase().includes("custom") || params.thtType === "cmc");
    const is9x7 = subSize.includes("9x7");
    const is12x11 = subSize.includes("12x11");

    if (isThtUU9 || isThtUU10 || isThtToroid || isThtCustomCMC || params.mounting === "THT") {
      const pitchX = typeof params.pitch === "number" && params.pitch > 0 ? params.pitch : (isThtUU10 ? 10.0 : 7.0);
      const pitchY = typeof params.pitchY === "number" && params.pitchY > 0 ? params.pitchY : (isThtUU10 ? 13.0 : 8.0);
      const drill = typeof params.drill === "number" && params.drill > 0 ? params.drill : (isThtUU10 ? 0.9 : 0.8);
      const padSize = typeof params.padSize === "number" && params.padSize > 0 ? params.padSize : drill + 0.8;
      const bodyW = typeof params.bodyWidth === "number" && params.bodyWidth > 0 ? params.bodyWidth : (isThtUU10 ? 16.0 : 12.0);
      const bodyH = typeof params.bodyLength === "number" && params.bodyLength > 0 ? params.bodyLength : (isThtUU10 ? 15.0 : 11.0);

      pads.push(createThtPad({ number: "1", x: -pitchX / 2, y: -pitchY / 2, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: pitchX / 2, y: -pitchY / 2, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "3", x: pitchX / 2, y: pitchY / 2, width: padSize, height: padSize, shape: "oval", drill }));
      pads.push(createThtPad({ number: "4", x: -pitchX / 2, y: pitchY / 2, width: padSize, height: padSize, shape: "oval", drill }));

      if (isThtToroid) {
        graphics.push(createFabCircle(0, 0, 15 / 2));
        graphics.push(createSilkCircle(0, 0, 15 / 2 + 0.2));
      } else {
        graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
        graphics.push(createSilkLine(-bodyW / 2, -bodyH / 2, bodyW / 2, -bodyH / 2));
        graphics.push(createSilkLine(-bodyW / 2, bodyH / 2, bodyW / 2, bodyH / 2));
        graphics.push(createSilkLine(-bodyW / 2, -bodyH / 2, -bodyW / 2, bodyH / 2));
        graphics.push(createSilkLine(bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
      }
      graphics.push(createSilkPin1Dot(-pitchX / 2 - 1.2, -pitchY / 2));
      graphics.push(createReferenceText(0, -bodyH / 2 - 1.0));
      graphics.push(createValueText(0, bodyH / 2 + 1.0, params.value || "CMC_THT"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: `Filter_CommonModeChoke_THT_${subSize || "UU9.8"}`,
        referencePrefix: ref,
        value: params.value || "CMC_THT",
        description: `Common Mode Choke THT ${subSize || "UU9.8"}`,
        tags: ["Inductor", "CommonModeChoke", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "inductor_ferrite",
        generatorParams: params,
      });
    }

    // Default SMD CMC
    const spanX = is12x11 ? 9.5 : is9x7 ? 7.0 : 5.0;
    const spanY = is12x11 ? 8.0 : is9x7 ? 5.0 : 4.0;
    const padW = is12x11 ? 2.5 : is9x7 ? 2.0 : 1.6;
    const padH = is12x11 ? 2.0 : is9x7 ? 1.5 : 1.2;
    const bodyW = is12x11 ? 12.0 : is9x7 ? 9.0 : 6.5;
    const bodyH = is12x11 ? 11.0 : is9x7 ? 7.0 : 6.0;

    pads.push(createSmdPad({ number: "1", x: -spanX / 2, y: -spanY / 2, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: spanX / 2, y: -spanY / 2, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "3", x: spanX / 2, y: spanY / 2, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "4", x: -spanX / 2, y: spanY / 2, width: padW, height: padH, shape: "roundrect" }));

    graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
    graphics.push(createSilkLine(-bodyW / 2, -bodyH / 2, bodyW / 2, -bodyH / 2));
    graphics.push(createSilkLine(-bodyW / 2, bodyH / 2, bodyW / 2, bodyH / 2));
    graphics.push(createSilkPin1Dot(-spanX / 2 - 1.2, -spanY / 2));
    graphics.push(createReferenceText(0, -bodyH / 2 - 1.0));
    graphics.push(createValueText(0, bodyH / 2 + 1.0, params.value || "Common_Mode_Choke"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: `Filter_CommonModeChoke_SMD_${subSize || "6.5x6mm"}`,
      referencePrefix: ref,
      value: params.value || "Common_Mode_Choke",
      description: `Common Mode Choke Dual Winding 4-Pin SMD ${subSize || "6.5x6mm"}`,
      tags: ["Inductor", "CommonModeChoke", "Filter", "SMD"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "inductor_ferrite",
      generatorParams: params,
    });
  }

  // 2. Ferrite Bead
  if (pkgLower.includes("ferrite") || pkgLower.includes("bead") || pkgLower.includes("fb")) {
    const sz = subSize || "0805";
    let spanX = 2.0;
    let padW = 1.0;
    let padH = 1.3;
    let bodyW = 2.0;
    let bodyH = 1.25;

    if (sz === "0201") { spanX = 0.8; padW = 0.3; padH = 0.35; bodyW = 0.6; bodyH = 0.3; }
    else if (sz === "0402") { spanX = 1.0; padW = 0.5; padH = 0.6; bodyW = 1.0; bodyH = 0.5; }
    else if (sz === "0603") { spanX = 1.6; padW = 0.8; padH = 0.9; bodyW = 1.6; bodyH = 0.8; }
    else if (sz === "1206") { spanX = 3.2; padW = 1.2; padH = 1.7; bodyW = 3.2; bodyH = 1.6; }
    else if (sz === "1210") { spanX = 3.2; padW = 1.2; padH = 2.6; bodyW = 3.2; bodyH = 2.5; }
    else if (sz === "1812") { spanX = 4.5; padW = 1.5; padH = 3.3; bodyW = 4.5; bodyH = 3.2; }

    pads.push(createSmdPad({ number: "1", x: -spanX / 2, y: 0, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: spanX / 2, y: 0, width: padW, height: padH, shape: "roundrect" }));

    graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
    graphics.push(createSilkPin1Dot(-spanX / 2 - 0.7, 0));
    graphics.push(createReferenceText(0, -padH / 2 - 0.9));
    graphics.push(createValueText(0, padH / 2 + 0.9, params.value || `Ferrite_Bead_${sz}`));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: `FerriteBead_${sz}`,
      referencePrefix: ref.startsWith("FB") ? ref : "FB",
      value: params.value || `Ferrite_Bead_${sz}`,
      description: `SMD Ferrite Bead Chip Inductor ${sz}`,
      tags: ["Ferrite", "Bead", "Filter", "SMD", sz],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "inductor_ferrite",
      generatorParams: params,
    });
  }

  // 3. Power Inductor
  if (pkgLower.includes("power") || pkgLower.includes("cdrh") || pkgLower.includes("shielded")) {
    let size = 10.0;
    let padW = 3.0;
    let padH = 6.8;
    let padX = 3.8;
    let label = subSize || "CDRH104";

    if (subSize.includes("NR3015") || subSize.includes("3x3")) {
      size = 3.0; padW = 1.1; padH = 2.8; padX = 1.1; label = "NR3015";
    } else if (subSize.includes("NR4018") || subSize.includes("4x4")) {
      size = 4.0; padW = 1.4; padH = 3.6; padX = 1.5; label = "NR4018";
    } else if (subSize.includes("CDRH5D28") || subSize.includes("5x5")) {
      size = 5.0; padW = 1.8; padH = 4.5; padX = 2.0; label = "CDRH5D28";
    } else if (subSize.includes("NR6045") || subSize.includes("6x6")) {
      size = 6.0; padW = 2.0; padH = 5.5; padX = 2.3; label = "NR6045";
    } else if (subSize.includes("CDRH74") || subSize.includes("7.3x7.3") || subSize.includes("7x7")) {
      size = 7.3; padW = 2.2; padH = 4.8; padX = 2.75; label = "CDRH74";
    } else if (subSize.includes("CDRH127") || subSize.includes("12x12")) {
      size = 12.0; padW = 3.5; padH = 8.0; padX = 4.6; label = "CDRH127";
    } else if (subSize.includes("15x15")) {
      size = 15.0; padW = 4.0; padH = 10.0; padX = 5.8; label = "15x15mm";
    }

    pads.push(createSmdPad({ number: "1", x: -padX, y: 0, width: padW, height: padH, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: padX, y: 0, width: padW, height: padH, shape: "roundrect" }));

    graphics.push(...createFabRect(-size / 2, -size / 2, size / 2, size / 2));
    graphics.push(createSilkLine(-size / 2 - 0.2, -size / 2 - 0.2, size / 2 + 0.2, -size / 2 - 0.2));
    graphics.push(createSilkLine(-size / 2 - 0.2, size / 2 + 0.2, size / 2 + 0.2, size / 2 + 0.2));
    graphics.push(createSilkPin1Dot(-padX - padW / 2 - 0.5, 0));
    graphics.push(createReferenceText(0, -size / 2 - 1.1));
    graphics.push(createValueText(0, size / 2 + 1.1, params.value || `Power_Inductor_${label}`));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: `Inductor_Power_SMD_${label}`,
      referencePrefix: ref,
      value: params.value || `Power_Inductor_${label}`,
      description: `Shielded Power Inductor SMD ${label}`,
      tags: ["Inductor", "Power", "Shielded", "SMD", label],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "inductor_ferrite",
      generatorParams: params,
    });
  }

  // 4. THT Inductor
  if (pkgLower.includes("tht") || pkgLower.includes("radial") || pkgLower.includes("axial") || pkgLower.includes("toroid")) {
    const isRadial = subSize.includes("Radial") || subSize.includes("radial") || params.thtType === "radial";
    const isToroid = subSize.includes("Toroid") || subSize.includes("toroid") || params.thtType === "toroid";

    if (isRadial) {
      const isD8 = subSize.includes("D8mm");
      const isD10 = subSize.includes("D10mm");
      const defaultPitch = isD10 ? 5.0 : isD8 ? 5.0 : 3.0;
      const defaultDiam = isD10 ? 10.0 : isD8 ? 8.0 : 6.0;
      const defaultDrill = isD10 ? 1.0 : isD8 ? 0.9 : 0.8;

      const pitch = typeof params.pitch === "number" && params.pitch > 0 ? params.pitch : defaultPitch;
      const diam = typeof params.diameter === "number" && params.diameter > 0
        ? params.diameter
        : (typeof params.bodyDiameter === "number" && params.bodyDiameter > 0 ? params.bodyDiameter : defaultDiam);
      const drill = typeof params.drill === "number" && params.drill > 0 ? params.drill : defaultDrill;
      const padSize = typeof params.padSize === "number" && params.padSize > 0
        ? params.padSize
        : (typeof params.padWidth === "number" && params.padWidth > 0 ? params.padWidth : drill + 0.8);

      pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(createFabCircle(0, 0, diam / 2));
      graphics.push(createSilkCircle(0, 0, diam / 2 + 0.2));
      graphics.push(createReferenceText(0, -diam / 2 - 1.0));
      graphics.push(createValueText(0, diam / 2 + 1.0, params.value || `Radial_D${diam}mm`));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      const footprintName = subSize.startsWith("Custom")
        ? `Inductor_Radial_D${diam}mm_P${pitch}mm_Custom`
        : `Inductor_Radial_D${diam}mm_P${pitch}mm`;

      return buildNativeFootprintModel({
        name: footprintName,
        referencePrefix: ref,
        value: params.value || `Radial_D${diam}mm`,
        description: `Radial Leaded Power Inductor Choke D${diam}mm Pitch ${pitch}mm`,
        tags: ["Inductor", "Radial", "THT", "Choke"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "inductor_ferrite",
        generatorParams: params,
      });
    }

    if (isToroid) {
      const isD20 = subSize.includes("D20mm");
      const defaultPitch = isD20 ? 12.0 : 10.0;
      const defaultOuterDiam = isD20 ? 20.0 : 15.0;
      const defaultInnerDiam = isD20 ? 10.0 : 7.0;
      const defaultDrill = isD20 ? 1.5 : 1.2;

      const pitch = typeof params.pitch === "number" && params.pitch > 0 ? params.pitch : defaultPitch;
      const outerDiam = typeof params.outerDiameter === "number" && params.outerDiameter > 0
        ? params.outerDiameter
        : (typeof params.diameter === "number" && params.diameter > 0 ? params.diameter : defaultOuterDiam);
      const innerDiam = typeof params.innerDiameter === "number" && params.innerDiameter > 0
        ? params.innerDiameter
        : defaultInnerDiam;
      const drill = typeof params.drill === "number" && params.drill > 0 ? params.drill : defaultDrill;
      const padSize = typeof params.padSize === "number" && params.padSize > 0
        ? params.padSize
        : (typeof params.padWidth === "number" && params.padWidth > 0 ? params.padWidth : drill + 1.0);

      pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(createFabCircle(0, 0, outerDiam / 2));
      graphics.push(createSilkCircle(0, 0, outerDiam / 2 + 0.2));
      graphics.push(createSilkCircle(0, 0, innerDiam / 2));
      graphics.push(createReferenceText(0, -outerDiam / 2 - 1.2));
      graphics.push(createValueText(0, outerDiam / 2 + 1.2, params.value || `Toroid_D${outerDiam}mm`));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      const footprintName = subSize.startsWith("Custom")
        ? `Inductor_Toroid_D${outerDiam}mm_P${pitch}mm_Custom`
        : `Inductor_Toroid_D${outerDiam}mm_P${pitch}mm`;

      return buildNativeFootprintModel({
        name: footprintName,
        referencePrefix: ref,
        value: params.value || `Toroid_D${outerDiam}mm`,
        description: `Toroidal Core Inductor D${outerDiam}mm Pitch ${pitch}mm`,
        tags: ["Inductor", "Toroid", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "inductor_ferrite",
        generatorParams: params,
      });
    }

    // Default Axial THT
    const isP10 = subSize.includes("P10") || subSize.includes("10.16");
    const defaultPitch = isP10 ? 10.16 : 7.62;
    const defaultBodyLength = isP10 ? 7.0 : 5.0;
    const defaultBodyDiam = isP10 ? 3.0 : 2.5;
    const defaultDrill = isP10 ? 0.9 : 0.8;

    const pitch = typeof params.pitch === "number" && params.pitch > 0 ? params.pitch : defaultPitch;
    const bodyLength = typeof params.bodyLength === "number" && params.bodyLength > 0 ? params.bodyLength : defaultBodyLength;
    const bodyDiam = typeof params.bodyDiameter === "number" && params.bodyDiameter > 0
      ? params.bodyDiameter
      : (typeof params.bodyWidth === "number" && params.bodyWidth > 0 ? params.bodyWidth : defaultBodyDiam);
    const drill = typeof params.drill === "number" && params.drill > 0 ? params.drill : defaultDrill;
    const padSize = typeof params.padSize === "number" && params.padSize > 0
      ? params.padSize
      : (typeof params.padWidth === "number" && params.padWidth > 0 ? params.padWidth : drill + 0.8);

    pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
    pads.push(createThtPad({ number: "2", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

    const halfLen = bodyLength / 2;
    const halfDiam = bodyDiam / 2;

    graphics.push(...createFabRect(-halfLen, -halfDiam, halfLen, halfDiam));
    graphics.push(createSilkLine(-halfLen, -halfDiam, halfLen, -halfDiam));
    graphics.push(createSilkLine(halfLen, -halfDiam, halfLen, halfDiam));
    graphics.push(createSilkLine(halfLen, halfDiam, -halfLen, halfDiam));
    graphics.push(createSilkLine(-halfLen, halfDiam, -halfLen, -halfDiam));

    // Silk lead lines to pads if pitch extends beyond body
    if (-pitch / 2 < -halfLen) {
      graphics.push(createSilkLine(-pitch / 2 + padSize / 2, 0, -halfLen, 0));
    }
    if (pitch / 2 > halfLen) {
      graphics.push(createSilkLine(halfLen, 0, pitch / 2 - padSize / 2, 0));
    }

    graphics.push(createReferenceText(0, -halfDiam - 1.2));
    graphics.push(createValueText(0, halfDiam + 1.2, params.value || `Axial_P${pitch}mm`));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    const footprintName = subSize.startsWith("Custom")
      ? `Inductor_THT_Axial_P${pitch}mm_L${bodyLength}mm_Custom`
      : `Inductor_THT_Axial_P${pitch}mm`;

    return buildNativeFootprintModel({
      name: footprintName,
      referencePrefix: ref,
      value: params.value || `Axial_P${pitch}mm`,
      description: `Axial Leaded Inductor Through-Hole Pitch ${pitch}mm Body ${bodyLength}x${bodyDiam}mm`,
      tags: ["Inductor", "THT", "Axial"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "inductor_ferrite",
      generatorParams: params,
    });
  }

  // 5. Default SMD Chip Inductor
  const sz = subSize || "0805";
  let spanX = 2.0;
  let padW = 1.0;
  let padH = 1.3;
  let bodyW = 2.0;
  let bodyH = 1.25;

  if (sz === "0201") { spanX = 0.8; padW = 0.3; padH = 0.35; bodyW = 0.6; bodyH = 0.3; }
  else if (sz === "0402") { spanX = 1.0; padW = 0.5; padH = 0.6; bodyW = 1.0; bodyH = 0.5; }
  else if (sz === "0603") { spanX = 1.6; padW = 0.8; padH = 0.9; bodyW = 1.6; bodyH = 0.8; }
  else if (sz === "1206") { spanX = 3.2; padW = 1.2; padH = 1.7; bodyW = 3.2; bodyH = 1.6; }
  else if (sz === "1210") { spanX = 3.2; padW = 1.2; padH = 2.6; bodyW = 3.2; bodyH = 2.5; }
  else if (sz === "1812") { spanX = 4.5; padW = 1.5; padH = 3.3; bodyW = 4.5; bodyH = 3.2; }
  else if (sz === "2512") { spanX = 6.3; padW = 1.6; padH = 3.3; bodyW = 6.3; bodyH = 3.2; }

  if (sz === "Custom_SMD" || subSize === "Custom_SMD" || pkgLower === "custom_smd" || (params.mounting === "SMD" && (params.packageSize === "custom" || params.packageType === "custom"))) {
    padW = typeof params.padWidth === "number" && params.padWidth > 0 ? params.padWidth : 1.2;
    padH = typeof params.padHeight === "number" && params.padHeight > 0 ? params.padHeight : 1.5;
    spanX = typeof params.pitch === "number" && params.pitch > 0 ? params.pitch : 2.5;
    bodyW = typeof params.bodyWidth === "number" && params.bodyWidth > 0 ? params.bodyWidth : 2.5;
    bodyH = typeof params.bodyLength === "number" && params.bodyLength > 0 ? params.bodyLength : 2.0;
  }

  pads.push(createSmdPad({ number: "1", x: -spanX / 2, y: 0, width: padW, height: padH, shape: "roundrect" }));
  pads.push(createSmdPad({ number: "2", x: spanX / 2, y: 0, width: padW, height: padH, shape: "roundrect" }));

  graphics.push(...createFabRect(-bodyW / 2, -bodyH / 2, bodyW / 2, bodyH / 2));
  graphics.push(createSilkPin1Dot(-spanX / 2 - 0.8, 0));
  graphics.push(createReferenceText(0, -padH / 2 - 1.0));
  graphics.push(createValueText(0, padH / 2 + 1.0, params.value || `Inductor_SMD_${sz}`));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  return buildNativeFootprintModel({
    name: `Inductor_SMD_${sz}`,
    referencePrefix: ref,
    value: params.value || `Inductor_SMD_${sz}`,
    description: `Standard SMD Chip Inductor ${sz}`,
    tags: ["Inductor", "SMD", "Chip", sz],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "inductor_ferrite",
    generatorParams: params,
  });
}
