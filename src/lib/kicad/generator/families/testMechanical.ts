import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkCircle, createSilkLine } from "../core/silk";
import { createFabCircle, createFabRect } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export type TestMechanicalPackageType =
  | "TestPoint_Keystone_5000_THT"
  | "TestPoint_Keystone_5015_SMD"
  | "TestPoint_Pad_1.0mm_SMD"
  | "TestPoint_Pad_1.5mm_SMD"
  | "MountingHole_M2.5"
  | "MountingHole_M3"
  | "MountingHole_M3_Plated_Ground"
  | "MountingHole_M4"
  | "Fiducial_1.0mm_Round"
  | "Fiducial_1.5mm_Round";

export interface TestMechanicalParams {
  packageType?: TestMechanicalPackageType;
  reference?: string;
  value?: string;
  [key: string]: any;
}

export function generateTestMechanical(params: TestMechanicalParams): KicadFootprintModel {
  const pkg = params.packageType || "TestPoint_Keystone_5000_THT";
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const isTP = pkg.startsWith("TestPoint_");
  const isMount = pkg.startsWith("MountingHole_");
  const isFid = pkg.startsWith("Fiducial_");
  const ref = params.reference || (isTP ? "TP" : isMount ? "H" : isFid ? "FID" : "M");

  // 1. Test Point Keystone 5000 / 5001 Through-Hole Color Coded Loop
  if (pkg === "TestPoint_Keystone_5000_THT") {
    pads.push(createThtPad({ number: "1", x: 0, y: 0, width: 2.2, height: 2.2, shape: "circle", drill: 1.0 }));

    graphics.push(createFabCircle(0, 0, 1.5));
    graphics.push(createSilkCircle(0, 0, 1.6));
    graphics.push(createReferenceText(0, -2.5));
    graphics.push(createValueText(0, 2.5, params.value || "TP_Keystone5000"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "TestPoint_Keystone_5000_THT",
      referencePrefix: ref,
      value: params.value || "TP",
      description: "Keystone 5000 / 5001 Series Miniature Test Point Loop Through-Hole",
      tags: ["TestPoint", "Keystone", "5000", "Loop", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "test_mechanical",
      generatorParams: params,
    });
  }

  // 2. Test Point Keystone 5015 Surface Mount Miniature Loop
  if (pkg === "TestPoint_Keystone_5015_SMD") {
    pads.push(createSmdPad({ number: "1", x: 0, y: 0, width: 3.4, height: 1.8, shape: "roundrect" }));

    graphics.push(...createFabRect(-1.7, -0.9, 1.7, 0.9));
    graphics.push(createSilkLine(-1.8, -1.0, 1.8, -1.0));
    graphics.push(createSilkLine(-1.8, 1.0, 1.8, 1.0));
    graphics.push(createReferenceText(0, -2.0));
    graphics.push(createValueText(0, 2.0, params.value || "TP_Keystone5015"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "TestPoint_Keystone_5015_SMD",
      referencePrefix: ref,
      value: params.value || "TP",
      description: "Keystone 5015 Surface Mount Micro Miniature Test Point Loop",
      tags: ["TestPoint", "Keystone", "5015", "SMD"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "test_mechanical",
      generatorParams: params,
    });
  }

  // 3. Test Point Pad 1.0mm / 1.5mm SMD Circular Probe Pad
  if (pkg === "TestPoint_Pad_1.0mm_SMD" || pkg === "TestPoint_Pad_1.5mm_SMD") {
    const diam = pkg === "TestPoint_Pad_1.0mm_SMD" ? 1.0 : 1.5;
    pads.push(createSmdPad({ number: "1", x: 0, y: 0, width: diam, height: diam, shape: "circle" }));

    graphics.push(createFabCircle(0, 0, diam / 2));
    graphics.push(createSilkCircle(0, 0, diam / 2 + 0.25));
    graphics.push(createReferenceText(0, -diam / 2 - 1.0));
    graphics.push(createValueText(0, diam / 2 + 1.0, params.value || `TP_${diam.toFixed(1)}mm`));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: `TestPoint_Pad_D${diam.toFixed(1)}mm`,
      referencePrefix: ref,
      value: params.value || "TP",
      description: `Surface Mount Circular Test Pad D${diam.toFixed(1)}mm for Pogo Pins and Probes`,
      tags: ["TestPoint", "Pad", "SMD", "Probe"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "test_mechanical",
      generatorParams: params,
    });
  }

  // 4. Mounting Hole Non-Plated (M2.5, M3, M4)
  if (pkg === "MountingHole_M2.5" || pkg === "MountingHole_M3" || pkg === "MountingHole_M4") {
    const drill = pkg === "MountingHole_M2.5" ? 2.7 : pkg === "MountingHole_M3" ? 3.2 : 4.3;
    const screwHead = pkg === "MountingHole_M2.5" ? 5.0 : pkg === "MountingHole_M3" ? 6.0 : 8.0;

    // NPTH pad (no copper)
    pads.push({
      number: "1",
      type: "np_thru_hole",
      shape: "circle",
      position: { x: 0, y: 0 },
      size: { width: drill, height: drill },
      drill: { diameter: drill },
      layers: ["*.Cu", "*.Mask"],
    });

    graphics.push(createFabCircle(0, 0, screwHead / 2));
    graphics.push(createSilkCircle(0, 0, screwHead / 2 + 0.2));
    graphics.push(createReferenceText(0, -screwHead / 2 - 1.2));
    graphics.push(createValueText(0, screwHead / 2 + 1.2, params.value || pkg));
    graphics.push(createCourtyardRect(pads, graphics, 0.25));

    return buildNativeFootprintModel({
      name: `MountingHole_${drill}mm_M${pkg.replace("MountingHole_M", "")}`,
      referencePrefix: ref,
      value: params.value || `M${pkg.replace("MountingHole_M", "")}`,
      description: `Mechanical Mounting Hole for M${pkg.replace("MountingHole_M", "")} screw (${drill}mm NPTH)`,
      tags: ["MountingHole", "Mechanical", "NPTH"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "test_mechanical",
      generatorParams: params,
    });
  }

  // 5. Mounting Hole M3 Plated Grounded with Via Stitching
  if (pkg === "MountingHole_M3_Plated_Ground") {
    const drill = 3.2;
    const padDia = 6.4;

    pads.push(createThtPad({ number: "1", x: 0, y: 0, width: padDia, height: padDia, shape: "circle", drill }));
    // 8 Ground Vias around the ring
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const vx = Math.cos(angle) * 2.5;
      const vy = Math.sin(angle) * 2.5;
      pads.push(createThtPad({ number: "1", x: vx, y: vy, width: 0.8, height: 0.8, shape: "circle", drill: 0.4 }));
    }

    graphics.push(createFabCircle(0, 0, padDia / 2));
    graphics.push(createSilkCircle(0, 0, padDia / 2 + 0.3));
    graphics.push(createReferenceText(0, -padDia / 2 - 1.2));
    graphics.push(createValueText(0, padDia / 2 + 1.2, params.value || "MountingHole_M3_GND"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: "MountingHole_3.2mm_M3_Plated_ViaStitch",
      referencePrefix: ref,
      value: params.value || "M3_GND",
      description: "Plated Mounting Hole M3 with Chassis Ground Pad and Via Stitching",
      tags: ["MountingHole", "Plated", "M3", "Ground", "Shield"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "test_mechanical",
      generatorParams: params,
    });
  }

  // 6. Fiducial (1.0mm or 1.5mm round copper dot with mask clearance)
  const fidDia = pkg === "Fiducial_1.5mm_Round" ? 1.5 : 1.0;
  pads.push(createSmdPad({ number: "1", x: 0, y: 0, width: fidDia, height: fidDia, shape: "circle" }));

  graphics.push(createFabCircle(0, 0, fidDia / 2));
  graphics.push(createSilkCircle(0, 0, fidDia / 2 + 0.75));
  graphics.push(createReferenceText(0, -fidDia - 1.0));
  graphics.push(createValueText(0, fidDia + 1.0, params.value || `Fiducial_${fidDia.toFixed(1)}mm`));
  graphics.push(createCourtyardRect(pads, graphics, 0.5));

  return buildNativeFootprintModel({
    name: `Fiducial_${fidDia.toFixed(1)}mm_Mask2.5mm`,
    referencePrefix: "FID",
    value: params.value || "FID",
    description: `Optical Alignment Fiducial Mark D${fidDia.toFixed(1)}mm for Automated Pick and Place`,
    tags: ["Fiducial", "Optical", "SMD", "SMT"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "test_mechanical",
    generatorParams: params,
  });
}
