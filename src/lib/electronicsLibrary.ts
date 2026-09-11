import { guessFootprintConfigFromSymbol } from "./kicad/generator/generator";
import { FOOTPRINT_FAMILIES } from "./kicad/generator/registry/footprintFamilies";

export type PackageType = "SMD" | "DIP" | "GENERATOR";

export interface ComponentPackage {
  id: string;
  name: string;
  type: PackageType;
  familyId?: string;
  presetId?: string;
  params?: Record<string, any>;
}

/**
 * Returns available Footprint Generator presets for a given symbol.
 * All footprints are strictly produced via KiCad Footprint Generator.
 */
export function getPackagesForSymbol(symbolId: string | undefined | null): ComponentPackage[] {
  if (!symbolId || typeof symbolId !== "string") {
    return [
      { id: "gen_dip_8", name: "DIP-8 (مولد البصمات)", type: "DIP", familyId: "dip", presetId: "dip-8" },
      { id: "gen_smd_0805", name: "SMD 0805 (مولد البصمات)", type: "SMD", familyId: "passive", presetId: "r-0805" },
    ];
  }

  const s = symbolId.toLowerCase();
  if (s.includes("resistor") || s.includes("res")) {
    return [
      { id: "r-axial-7mm", name: "Axial 7.62mm (THT قياسي الأشهر)", type: "DIP", familyId: "passive", presetId: "r-axial-7mm" },
      { id: "r-axial-10mm", name: "Axial 10.16mm (THT قدرة)", type: "DIP", familyId: "passive", presetId: "r-axial-10mm" },
      { id: "r-0805", name: "SMD 0805 (سطحي)", type: "SMD", familyId: "passive", presetId: "r-0805" },
      { id: "r-0603", name: "SMD 0603 (سطحي)", type: "SMD", familyId: "passive", presetId: "r-0603" },
      { id: "r-1206", name: "SMD 1206 (سطحي)", type: "SMD", familyId: "passive", presetId: "r-1206" },
      { id: "r-0402", name: "SMD 0402 (سطحي)", type: "SMD", familyId: "passive", presetId: "r-0402" },
    ];
  }

  if (s.includes("capacitor_polar") || s.includes("polar") || s.includes("electrolytic") || s === "cp") {
    return [
      { id: "cp-radial-5mm", name: "Radial 5.0mm (THT كيميائي كهربائي قياسي)", type: "DIP", familyId: "passive", presetId: "cp-radial-5mm" },
      { id: "cp-radial-6.3mm", name: "Radial 6.3mm (THT كيميائي كهربائي متوسط)", type: "DIP", familyId: "passive", presetId: "cp-radial-6mm" },
      { id: "cp-radial-8mm", name: "Radial 8.0mm (THT كيميائي كهربائي كبير)", type: "DIP", familyId: "passive", presetId: "cp-radial-8mm" },
      { id: "c-tantalum-a", name: "SMD Tantalum EIA-3216 (تانتالوم سطحي)", type: "SMD", familyId: "passive", presetId: "c-tantalum-a" },
      { id: "c-tantalum-b", name: "SMD Tantalum EIA-3528 (تانتالوم سطحي كبير)", type: "SMD", familyId: "passive", presetId: "c-tantalum-b" },
    ];
  }

  if (s.includes("capacitor") || s.includes("cap") || s === "c") {
    return [
      { id: "disc-d5-p2.54", name: "Disc 5.0mm Pitch 2.54mm (THT سيراميك قرصي قياسي)", type: "DIP", familyId: "passive", presetId: "disc-d5-p2.54" },
      { id: "disc-d5-p5.08", name: "Disc 5.0mm Pitch 5.08mm (THT سيراميك قرصي 100nF)", type: "DIP", familyId: "passive", presetId: "disc-d5-p5.08" },
      { id: "film-l7.2-p5.0", name: "Box Film 7.2mm (THT فيلم/بوليستر)", type: "DIP", familyId: "passive", presetId: "film-l7.2-p5.0" },
      { id: "c-0805", name: "SMD 0805 MLCC (سيراميك سطحي)", type: "SMD", familyId: "passive", presetId: "c-0805" },
      { id: "c-0603", name: "SMD 0603 MLCC (سيراميك سطحي)", type: "SMD", familyId: "passive", presetId: "c-0603" },
      { id: "c-1206", name: "SMD 1206 MLCC (سيراميك سطحي)", type: "SMD", familyId: "passive", presetId: "c-1206" },
    ];
  }

  if (s.includes("diode") || s.includes("led")) {
    if (s.includes("led")) {
      return [
        { id: "led-tht-5mm", name: "LED 5mm (THT ثقبي قياسي الأشهر)", type: "DIP", familyId: "diode", presetId: "led-tht-5mm" },
        { id: "led-tht-3mm", name: "LED 3mm (THT ثقبي)", type: "DIP", familyId: "diode", presetId: "led-tht-3mm" },
        { id: "led-0805", name: "LED 0805 (سطحي SMD)", type: "SMD", familyId: "diode", presetId: "led-0805" },
        { id: "led-1206", name: "LED 1206 (سطحي SMD)", type: "SMD", familyId: "diode", presetId: "led-1206" },
      ];
    }
    return [
      { id: "d-do41", name: "DO-41 (1N4007 THT ثقبي قياسي الأشهر)", type: "DIP", familyId: "diode", presetId: "d-do41" },
      { id: "d-do35", name: "DO-35 (1N4148 / Zener THT ثقبي)", type: "DIP", familyId: "diode", presetId: "d-do35" },
      { id: "d-sma", name: "SMA (سطحي SMD)", type: "SMD", familyId: "diode", presetId: "d-sma" },
      { id: "d-smb", name: "SMB (سطحي SMD)", type: "SMD", familyId: "diode", presetId: "d-smb" },
      { id: "d-sod123", name: "SOD-123 (سطحي SMD)", type: "SMD", familyId: "diode", presetId: "d-sod123" },
    ];
  }

  if (s.includes("transistor") || s.includes("mosfet") || s.includes("bjt") || s.includes("npn") || s.includes("pnp")) {
    return [
      { id: "to-92", name: "TO-92 (THT ثقبي قياسي الأشهر)", type: "DIP", familyId: "transistor", presetId: "to-92" },
      { id: "to-220", name: "TO-220 (THT ثقبي قدرة)", type: "DIP", familyId: "transistor", presetId: "to-220" },
      { id: "sot-23", name: "SOT-23 (سطحي SMD)", type: "SMD", familyId: "transistor", presetId: "sot-23" },
      { id: "sot-223", name: "SOT-223 (سطحي SMD)", type: "SMD", familyId: "transistor", presetId: "sot-223" },
      { id: "dpak", name: "TO-252 DPAK (سطحي SMD)", type: "SMD", familyId: "transistor", presetId: "dpak" },
    ];
  }

  if (s.includes("regulator") || s.includes("7805") || s.includes("7812") || s.includes("lm317") || s.includes("ams1117")) {
    return [
      { id: "to-220", name: "TO-220 (THT ثقبي قياسي 7805/LM317)", type: "DIP", familyId: "transistor", presetId: "to-220" },
      { id: "to-92", name: "TO-92 (THT ثقبي 78L05)", type: "DIP", familyId: "transistor", presetId: "to-92" },
      { id: "sot-223", name: "SOT-223 (سطحي AMS1117)", type: "SMD", familyId: "transistor", presetId: "sot-223" },
      { id: "dpak", name: "TO-252 DPAK (سطحي SMD)", type: "SMD", familyId: "transistor", presetId: "dpak" },
    ];
  }

  if (s.includes("ic") || s.includes("opamp") || s.includes("mcu") || s.includes("timer") || s.includes("gate")) {
    return [
      { id: "dip-8", name: "DIP-8 (THT ثقبي قياسي)", type: "DIP", familyId: "dip", presetId: "dip-8" },
      { id: "dip-14", name: "DIP-14 (THT ثقبي قياسي)", type: "DIP", familyId: "dip", presetId: "dip-14" },
      { id: "dip-16", name: "DIP-16 (THT ثقبي قياسي)", type: "DIP", familyId: "dip", presetId: "dip-16" },
      { id: "dip-28", name: "DIP-28 (THT ثقبي ATmega328)", type: "DIP", familyId: "dip", presetId: "dip-28" },
      { id: "dip-40", name: "DIP-40 (THT ثقبي MCU/CPU)", type: "DIP", familyId: "dip", presetId: "dip-40" },
      { id: "soic-8", name: "SOIC-8 (سطحي SMD)", type: "SMD", familyId: "soic", presetId: "soic-8" },
      { id: "soic-14", name: "SOIC-14 (سطحي SMD)", type: "SMD", familyId: "soic", presetId: "soic-14" },
      { id: "soic-16", name: "SOIC-16 (سطحي SMD)", type: "SMD", familyId: "soic", presetId: "soic-16" },
    ];
  }

  // General fallback - estimate using the smart generator
  const guess = guessFootprintConfigFromSymbol({ symbolName: symbolId });
  const fam = FOOTPRINT_FAMILIES[guess.familyId];
  return [
    {
      id: guess.presetId || `${guess.familyId}-auto`,
      name: `${fam?.name || guess.familyId} (مولد البصمات)`,
      type: guess.params.subtype?.includes("THT") || guess.familyId === "dip" ? "DIP" : "SMD",
      familyId: guess.familyId,
      presetId: guess.presetId,
      params: guess.params,
    },
  ];
}
