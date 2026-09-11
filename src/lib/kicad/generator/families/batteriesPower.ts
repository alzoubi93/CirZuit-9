import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle, createSilkPin1Dot } from "../core/silk";
import { createFabCircle, createFabRect } from "../core/fab";
import { createCourtyardRect } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { buildNativeFootprintModel } from "../rules/kicad";
import { KLC_RULES } from "../rules/klc";

export interface BatteriesPowerStandardPackage {
  id: string;
  name: string;
  category: "coincell" | "cylindrical" | "dc_jack" | "terminal" | "rc_power";
  desc: string;
  mounting: "SMD" | "THT";
}

export const STANDARD_SMD_BATTERY_PACKAGES: BatteriesPowerStandardPackage[] = [
  { id: "Battery_CR2032_SMD_Keystone1058", name: "CR2032 SMD Retainer", category: "coincell", desc: "Keystone 1058 / BK-912 Surface Mount", mounting: "SMD" },
  { id: "Battery_CR1220_SMD", name: "CR1220 SMD Holder", category: "coincell", desc: "12mm Micro Coin Cell SMT Holder", mounting: "SMD" },
  { id: "Battery_CR2450_SMD", name: "CR2450 SMD Retainer", category: "coincell", desc: "24mm High Capacity Coin Cell SMT", mounting: "SMD" },
  { id: "Connector_DCJack_SMD", name: "DC Barrel Jack 2.1mm SMD", category: "dc_jack", desc: "PJ-002A Surface Mount DC Power Jack", mounting: "SMD" },
];

export const QUICK_STANDARD_THT_BATTERY_PACKAGES = [
  { id: "Battery_CR2032_THT_Keystone3002", name: "CR2032 THT", desc: "Keystone 3002 / Pitch 20.0mm" },
  { id: "Battery_18650_Holder_Keystone1042", name: "18650 Holder", desc: "Li-Ion PCB Holder / Pitch 77.2mm" },
  { id: "Battery_AA_Holder_Keystone2460", name: "AA Holder", desc: "1.5V Cell PCB Holder / Pitch 57.0mm" },
  { id: "Battery_AAA_Holder_Keystone2466", name: "AAA Holder", desc: "1.5V Cell PCB Holder / Pitch 50.0mm" },
  { id: "Connector_DCJack_2.1mm_THT", name: "DC Jack 2.1mm", desc: "Barrel Power Jack PJ-002AH 3-Pin" },
  { id: "Terminal_Block_2Pin_5.08mm", name: "Screw Term 2P", desc: "Terminal Block 2-Pin Pitch 5.08mm" },
  { id: "Connector_Power_XT60_THT", name: "XT60 Male", desc: "High Current 60A DC / Pitch 7.2mm" },
  { id: "Connector_Power_XT30_THT", name: "XT30 Male", desc: "Compact 30A DC / Pitch 5.0mm" },
];

export const MORE_STANDARD_THT_BATTERY_PACKAGES = [
  { id: "Terminal_Block_3Pin_5.08mm", name: "Screw Terminal Block 3-Pin (Pitch 5.08mm)" },
  { id: "Terminal_Block_2Pin_3.81mm", name: "Eurostyle Terminal Block 2-Pin (Pitch 3.81mm)" },
  { id: "Battery_CR2450_THT", name: "CR2450 Coin Cell Retainer THT (Pitch 24mm)" },
  { id: "Battery_9V_Snap_Pins", name: "9V Battery Snap PCB Mount Pins (Pitch 12.7mm)" },
];

export interface BatteriesPowerParams {
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

export function generateBatteriesPower(params: BatteriesPowerParams): KicadFootprintModel {
  const pkg = (params.packageSize || params.packageType || "Battery_CR2032_SMD_Keystone1058").trim();
  const isTht = params.mounting === "THT" || pkg.includes("THT") || pkg.includes("XT60") || pkg.includes("XT30") || pkg.includes("Terminal_Block") || pkg.includes("18650") || pkg.includes("AA_") || pkg.includes("AAA_");
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  const isBat = pkg.startsWith("Battery_");
  const ref = params.reference || (isBat ? "BT" : "J");

  // ==========================================
  // THT Packages
  // ==========================================
  if (isTht) {
    // 1. CR2032 Coin Cell THT Retainer (Keystone 3002)
    if (pkg.includes("CR2032") || pkg.includes("CR2450")) {
      const is2450 = pkg.includes("CR2450");
      const pitch = is2450 ? 24.0 : 20.0;
      const radius = is2450 ? 12.2 : 10.0;
      const drill = 1.3;
      const padSize = 2.4;

      pads.push(createThtPad({ number: "1", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill })); // Positive
      pads.push(createThtPad({ number: "1", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));  // Positive
      pads.push(createSmdPad({ number: "2", x: 0, y: 0, width: 8.0, height: 8.0, shape: "circle" }));                        // Negative

      graphics.push(createFabCircle(0, 0, radius));
      graphics.push(createSilkCircle(0, 0, radius + 0.2));
      graphics.push(createSilkLine(-pitch / 2 - 1.5, 2.0, -pitch / 2 - 1.5, 3.5)); // "+"
      graphics.push(createSilkLine(-pitch / 2 - 2.2, 2.75, -pitch / 2 - 0.8, 2.75));
      graphics.push(createReferenceText(0, -radius - 1.5));
      graphics.push(createValueText(0, radius + 1.5, params.value || (is2450 ? "CR2450" : "CR2032")));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: is2450 ? "BatteryHolder_CR2450_THT" : "BatteryHolder_Keystone_3002_1x2032_THT",
        referencePrefix: ref,
        value: params.value || (is2450 ? "CR2450" : "CR2032"),
        description: `Coin Cell Retainer ${is2450 ? "CR2450" : "CR2032"} Through-Hole (Pitch ${pitch}mm)`,
        tags: ["Battery", "Retainer", "CoinCell", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "batteries_power",
        generatorParams: params,
      });
    }

    // 2. 18650 Li-Ion Single Cell Holder (Keystone 1042)
    if (pkg.includes("18650")) {
      const drill = 1.7;
      const padSize = 3.2;
      const pitch = 77.2;

      pads.push(createThtPad({ number: "+", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "-", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(...createFabRect(-41.5, -10.5, 41.5, 10.5));
      graphics.push(createSilkLine(-41.6, -10.6, 41.6, -10.6));
      graphics.push(createSilkLine(41.6, -10.6, 41.6, 10.6));
      graphics.push(createSilkLine(41.6, 10.6, -41.6, 10.6));
      graphics.push(createSilkLine(-41.6, 10.6, -41.6, -10.6));
      // "+" sign
      graphics.push(createSilkLine(-pitch / 2 + 3.0, -1.0, -pitch / 2 + 3.0, 1.0));
      graphics.push(createSilkLine(-pitch / 2 + 2.0, 0, -pitch / 2 + 4.0, 0));
      graphics.push(createReferenceText(0, -12.0));
      graphics.push(createValueText(0, 12.0, params.value || "18650"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "BatteryHolder_Keystone_1042_1x18650",
        referencePrefix: ref,
        value: params.value || "18650",
        description: "18650 Li-Ion Single Cell Battery Holder Through-Hole (Keystone 1042)",
        tags: ["Battery", "Holder", "18650", "Li-Ion", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "batteries_power",
        generatorParams: params,
      });
    }

    // 3. AA or AAA Battery Holder (Keystone 2460 / 2466)
    if (pkg.includes("AA_") || pkg.includes("AAA_")) {
      const isAaa = pkg.includes("AAA");
      const pitch = isAaa ? 50.0 : 57.0;
      const width = isAaa ? 12.0 : 16.0;
      const drill = 1.3;
      const padSize = 2.4;

      pads.push(createThtPad({ number: "+", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
      pads.push(createThtPad({ number: "-", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

      graphics.push(...createFabRect(-pitch / 2 - 2, -width / 2, pitch / 2 + 2, width / 2));
      graphics.push(createSilkLine(-pitch / 2 - 2, -width / 2, pitch / 2 + 2, -width / 2));
      graphics.push(createSilkLine(pitch / 2 + 2, -width / 2, pitch / 2 + 2, width / 2));
      graphics.push(createSilkLine(pitch / 2 + 2, width / 2, -pitch / 2 - 2, width / 2));
      graphics.push(createSilkLine(-pitch / 2 - 2, width / 2, -pitch / 2 - 2, -width / 2));
      graphics.push(createReferenceText(0, -width / 2 - 1.5));
      graphics.push(createValueText(0, width / 2 + 1.5, params.value || (isAaa ? "1xAAA" : "1xAA")));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: isAaa ? "BatteryHolder_Keystone_2466_1xAAA" : "BatteryHolder_Keystone_2460_1xAA",
        referencePrefix: ref,
        value: params.value || (isAaa ? "1xAAA" : "1xAA"),
        description: `${isAaa ? "AAA" : "AA"} Battery Holder Single Cell Through-Hole`,
        tags: ["Battery", "Holder", isAaa ? "AAA" : "AA", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "batteries_power",
        generatorParams: params,
      });
    }

    // 4. DC Power Barrel Jack 2.1mm THT (PJ-002AH, 3-Pin)
    if (pkg.includes("DCJack") || pkg.includes("DC_Jack")) {
      const drill = 1.6;
      const padSize = 3.0;

      pads.push(createThtPad({ number: "1", x: 0, y: 0, width: padSize, height: padSize, shape: "rect", drill }));       // Center Pin (+)
      pads.push(createThtPad({ number: "2", x: 0, y: 4.8, width: padSize, height: padSize, shape: "oval", drill }));     // Outer Sleeve (-)
      pads.push(createThtPad({ number: "3", x: -4.8, y: 2.0, width: padSize, height: padSize, shape: "oval", drill })); // Shunt Switch

      graphics.push(...createFabRect(-7.5, -4.5, 7.5, 4.5));
      graphics.push(...createFabRect(-14.0, -4.5, -7.5, 4.5)); // Barrel protrusion
      graphics.push(createReferenceText(0, -6.0));
      graphics.push(createValueText(0, 6.0, params.value || "DC_Jack_2.1mm"));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: "Connector_BarrelJack_PJ-002AH_Horizontal",
        referencePrefix: "J",
        value: params.value || "DC_Jack",
        description: "DC Power Barrel Jack 2.1x5.5mm Through-Hole PJ-002AH",
        tags: ["Connector", "BarrelJack", "DC", "Power", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "batteries_power",
        generatorParams: params,
      });
    }

    // 5. Screw Terminal Blocks (2-Pin or 3-Pin, 5.08mm or 3.81mm)
    if (pkg.includes("Terminal_Block") || pkg.includes("Term")) {
      const is3p = pkg.includes("3Pin") || pkg.includes("3P");
      const is381 = pkg.includes("3.81");
      const pitch = is381 ? 3.81 : 5.08;
      const drill = is381 ? 1.2 : 1.4;
      const padSize = is381 ? 2.2 : 2.8;
      const pinCount = is3p ? 3 : 2;

      for (let i = 0; i < pinCount; i++) {
        const px = (i - (pinCount - 1) / 2) * pitch;
        pads.push(createThtPad({ number: String(i + 1), x: px, y: 0, width: padSize, height: padSize, shape: i === 0 ? "rect" : "oval", drill }));
      }

      const bodyL = pinCount * pitch;
      const bodyW = is381 ? 7.5 : 8.5;
      graphics.push(...createFabRect(-bodyL / 2, -bodyW / 2, bodyL / 2, bodyW / 2));
      graphics.push(createSilkPin1Dot(-(pinCount - 1) / 2 * pitch, -bodyW / 2 - 1.0));
      graphics.push(createReferenceText(0, -bodyW / 2 - 1.2));
      graphics.push(createValueText(0, bodyW / 2 + 1.2, params.value || `Terminal_${pinCount}P`));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      return buildNativeFootprintModel({
        name: `TerminalBlock_Phoenix_MPT_${pinCount}x${pitch.toFixed(2)}mm`,
        referencePrefix: "J",
        value: params.value || `Terminal_${pinCount}P`,
        description: `Screw Terminal Block ${pinCount}-Pin Pitch ${pitch}mm`,
        tags: ["TerminalBlock", "Screw", "Power", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "batteries_power",
        generatorParams: params,
      });
    }

    // 6. XT60 / XT30 High-Current Connectors
    const isXt60 = pkg.includes("XT60");
    const pitch = isXt60 ? 7.2 : 5.0;
    const drill = isXt60 ? 4.5 : 2.8;
    const padSize = isXt60 ? 6.2 : 4.2;

    pads.push(createThtPad({ number: "+", x: -pitch / 2, y: 0, width: padSize, height: padSize, shape: "rect", drill }));
    pads.push(createThtPad({ number: "-", x: pitch / 2, y: 0, width: padSize, height: padSize, shape: "oval", drill }));

    graphics.push(...createFabRect(isXt60 ? -7.8 : -5.2, isXt60 ? -4.5 : -3.0, isXt60 ? 7.8 : 5.2, isXt60 ? 4.5 : 3.0));
    graphics.push(createReferenceText(0, isXt60 ? -5.8 : -4.2));
    graphics.push(createValueText(0, isXt60 ? 5.8 : 4.2, params.value || (isXt60 ? "XT60" : "XT30")));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    return buildNativeFootprintModel({
      name: isXt60 ? "Connector_AMASS_XT60-M_Vertical" : "Connector_AMASS_XT30U-M_Vertical",
      referencePrefix: "J",
      value: params.value || (isXt60 ? "XT60" : "XT30"),
      description: `Amass ${isXt60 ? "XT60" : "XT30"} High Current DC Power Connector`,
      tags: ["Connector", "Power", isXt60 ? "XT60" : "XT30", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "batteries_power",
      generatorParams: params,
    });
  }

  // ==========================================
  // SMD Packages
  // ==========================================

  // 1. CR2032 SMD Retainer (Keystone 1058 / BK-912)
  if (pkg.includes("CR2032") || pkg.includes("CR2450")) {
    const is2450 = pkg.includes("CR2450");
    const spanX = is2450 ? 32.0 : 29.2;
    const radius = is2450 ? 12.2 : 10.0;

    pads.push(createSmdPad({ number: "1", x: -spanX / 2, y: 0, width: 3.2, height: 4.5, shape: "roundrect" })); // Positive +
    pads.push(createSmdPad({ number: "1", x: spanX / 2, y: 0, width: 3.2, height: 4.5, shape: "roundrect" }));  // Positive +
    pads.push(createSmdPad({ number: "2", x: 0, y: 0, width: 8.0, height: 8.0, shape: "circle" }));              // Negative -

    graphics.push(createFabCircle(0, 0, radius));
    graphics.push(...createFabRect(-spanX / 2 - 1.0, -7.5, spanX / 2 + 1.0, 7.5));
    graphics.push(createSilkCircle(0, 0, radius + 0.3));
    graphics.push(createReferenceText(0, -9.0));
    graphics.push(createValueText(0, 9.0, params.value || (is2450 ? "CR2450_SMD" : "CR2032_SMD")));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: is2450 ? "BatteryHolder_Keystone_CR2450_SMD" : "BatteryHolder_Keystone_1058_1x2032_SMD",
      referencePrefix: ref,
      value: params.value || (is2450 ? "CR2450" : "CR2032"),
      description: `Coin Cell Battery Holder ${is2450 ? "CR2450" : "CR2032"} Surface Mount`,
      tags: ["Battery", "Holder", "CoinCell", "SMD"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "batteries_power",
      generatorParams: params,
    });
  }

  // 2. CR1220 SMD Holder
  if (pkg.includes("CR1220")) {
    pads.push(createSmdPad({ number: "1", x: -9.5, y: 0, width: 2.2, height: 3.0, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "1", x: 9.5, y: 0, width: 2.2, height: 3.0, shape: "roundrect" }));
    pads.push(createSmdPad({ number: "2", x: 0, y: 0, width: 5.0, height: 5.0, shape: "circle" }));

    graphics.push(createFabCircle(0, 0, 6.2));
    graphics.push(createReferenceText(0, -7.5));
    graphics.push(createValueText(0, 7.5, params.value || "CR1220"));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    return buildNativeFootprintModel({
      name: "BatteryHolder_CR1220_SMD",
      referencePrefix: ref,
      value: params.value || "CR1220",
      description: "Coin Cell Battery Holder CR1220 Surface Mount",
      tags: ["Battery", "Holder", "CR1220", "SMD"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "batteries_power",
      generatorParams: params,
    });
  }

  // 3. DC Jack SMD
  pads.push(createSmdPad({ number: "1", x: 0, y: -4.5, width: 2.8, height: 2.0, shape: "roundrect" }));
  pads.push(createSmdPad({ number: "2", x: 0, y: 4.5, width: 2.8, height: 2.0, shape: "roundrect" }));
  pads.push(createSmdPad({ number: "3", x: 6.0, y: 0, width: 2.2, height: 2.8, shape: "roundrect" }));

  graphics.push(...createFabRect(-7.0, -4.5, 7.0, 4.5));
  graphics.push(createReferenceText(0, -6.0));
  graphics.push(createValueText(0, 6.0, params.value || "DC_Jack_SMD"));
  graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

  return buildNativeFootprintModel({
    name: "Connector_DCJack_SMD",
    referencePrefix: "J",
    value: params.value || "DC_Jack_SMD",
    description: "DC Barrel Power Jack 2.1mm Surface Mount",
    tags: ["Connector", "BarrelJack", "DC", "SMD"],
    pads,
    graphics,
    mountingType: "SMD",
    generatorFamily: "batteries_power",
    generatorParams: params,
  });
}
