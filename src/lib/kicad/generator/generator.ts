import type { KicadFootprintModel } from "../footprint";
import { FOOTPRINT_FAMILIES, getFootprintFamily } from "./registry/footprintFamilies";
import { parseCapacitanceuF, getElectrolyticSize } from "../../electrolytic";

export interface GuessOptions {
  symbolName?: string;
  reference?: string;
  value?: string;
  pinCount?: number;
  packageHint?: string;
}

/**
 * Universal footprint generator dispatcher.
 */
export function generateFootprint(familyId: string, params: Record<string, any> = {}): KicadFootprintModel {
  const family = getFootprintFamily(familyId);
  if (!family) {
    // Fallback to DIP or Passive
    if (params.pinCount && params.pinCount > 2) {
      return FOOTPRINT_FAMILIES.dip.generate({ pinCount: params.pinCount, ...params });
    }
    return FOOTPRINT_FAMILIES.passive.generate(params);
  }
  let presetParams: Record<string, any> = {};
  if (params.presetId) {
    const preset = family.presets?.find(p => p.id === params.presetId);
    if (preset?.params) {
      presetParams = preset.params;
    }
  }
  const mergedParams = { ...family.defaultParams, ...presetParams, ...params };
  return family.generate(mergedParams);
}

/**
 * Intelligent capacitor dimension analyzer:
 * Defaults to Radial THT Electrolytic capacitor for polarized / standard electrolytic capacitors,
 * sizing body diameter, lead pitch, pad width, and drill according to standard industry component specs.
 */
export function analyzeCapacitor(val: string, name: string, ref: string) {
  const isPolarExplicit =
    name === "capacitor_polar" ||
    name.includes("polar") ||
    name.includes("electrolytic") ||
    ref.startsWith("CP") ||
    val.includes("polar") ||
    val.includes("elec") ||
    val.includes("elko") ||
    val.includes("tant") ||
    name === "cap_polar" ||
    name === "c_polar";

  // Parse capacitance value
  const capUf = parseCapacitanceuF(val);

  if (isPolarExplicit) {
    const elSize = getElectrolyticSize(val || "10uF");
    const packageType = `CP_Radial_D${elSize.w.toFixed(1)}mm_P${elSize.pitch.toFixed(2)}mm`;
    return {
      familyId: "passive",
      presetId: `cp-radial-${Math.round(elSize.w)}mm`,
      params: {
        subtype: "Radial_THT",
        componentType: "Capacitor",
        polarized: true,
        bodyDiameter: elSize.w,
        pitch: elSize.pitch,
        drill: elSize.drill,
        padWidth: elSize.padDia,
        padHeight: elSize.padDia,
        packageType,
      },
    };
  }

  // Non-polarized capacitor -> default to Standard Ceramic Disc or Film Through-Hole (THT)
  // For larger values (e.g., >= 1.0uF), use a larger pitch or box film format to represent larger caps.
  let pitch = 2.54;
  let bodyDiameter = 5.0;
  let bodyWidth = 2.5;
  let bodyLength = 5.0;
  let subtype: "Disc_THT" | "Box_THT" = "Disc_THT";
  let presetId = "disc-d5-p2.54";

  if (capUf !== undefined) {
    if (capUf >= 10.0) {
      // Large film capacitor or big disc
      pitch = 15.0;
      bodyLength = 18.0;
      bodyWidth = 5.0;
      subtype = "Box_THT";
      presetId = "film-l18-p15.0";
    } else if (capUf >= 1.0) {
      // Medium film or disc
      pitch = 7.5;
      bodyLength = 10.0;
      bodyWidth = 4.0;
      subtype = "Box_THT";
      presetId = "film-l10-p7.5";
    } else if (capUf >= 0.1) {
      // Standard 100nF disc
      pitch = 5.08;
      bodyDiameter = 5.0;
      bodyWidth = 2.5;
      subtype = "Disc_THT";
      presetId = "disc-d5-p5.08";
    }
  } else {
    // If we can't parse but the string implies a microfarad value (e.g., "1u", "10u")
    if (val.includes("u") || val.includes("µ")) {
      pitch = 7.5;
      bodyLength = 10.0;
      bodyWidth = 4.0;
      subtype = "Box_THT";
      presetId = "film-l10-p7.5";
    }
  }

  const packageType = subtype === "Box_THT" 
    ? `C_Rect_L${bodyLength.toFixed(1)}mm_W${bodyWidth.toFixed(1)}mm_P${pitch.toFixed(2)}mm`
    : `C_Disc_D${bodyDiameter.toFixed(1)}mm_W2.5mm_P${pitch.toFixed(2)}mm`;

  return {
    familyId: "passive",
    presetId,
    params: {
      subtype,
      componentType: "Capacitor",
      polarized: false,
      bodyDiameter: subtype === "Disc_THT" ? bodyDiameter : undefined,
      bodyLength: subtype === "Box_THT" ? bodyLength : undefined,
      bodyWidth: subtype === "Box_THT" ? bodyWidth : 2.5,
      pitch,
      drill: 0.8,
      padWidth: 1.6,
      padHeight: 1.6,
      packageType,
    },
  };
}

/**
 * Intelligent resistor analyzer:
 * Defaults to the world's most standard Through-Hole 1/4W (0.25W) DIN0207 Axial Resistor (pitch 7.62mm / 300 mil),
 * expanding automatically if higher wattage is specified.
 */
export function analyzeResistor(val: string, name: string, ref: string) {
  // LDR sensor
  if (name.includes("ldr") || val.includes("ldr")) {
    return { familyId: "sensor", presetId: "sens-ldr", params: { packageType: "Sensor_LDR_5mm_Radial" } };
  }
  // Potentiometer / Trimmer
  if (name.includes("potentiometer") || name.includes("trimmer") || ref.startsWith("VR") || ref.startsWith("POT") || ref.startsWith("RV")) {
    return { familyId: "potentiometer", presetId: "pot-3362p", params: { packageType: "Potentiometer_Trimmer_3362P", pitch: 2.54, drill: 0.8 } };
  }

  // Check power wattage from value
  let pitch = 7.62;
  let bodyLength = 6.3;
  let bodyDiameter = 2.4;
  let drill = 0.8;
  let padWidth = 1.8;

  const wattMatch = val.match(/(\d+(\.\d+)?)\s*w\b/);
  if (wattMatch) {
    const w = parseFloat(wattMatch[1]);
    if (w >= 5) {
      pitch = 25.40;
      bodyLength = 22.0;
      bodyDiameter = 9.5;
      drill = 1.2;
      padWidth = 2.6;
    } else if (w >= 2) {
      pitch = 15.24;
      bodyLength = 14.0;
      bodyDiameter = 5.0;
      drill = 1.0;
      padWidth = 2.2;
    } else if (w >= 1) {
      pitch = 12.70;
      bodyLength = 11.5;
      bodyDiameter = 4.5;
      drill = 1.0;
      padWidth = 2.0;
    } else if (w >= 0.5) {
      pitch = 10.16;
      bodyLength = 9.0;
      bodyDiameter = 3.2;
    }
  } else if (val.includes("0.5w") || val.includes("1/2w") || val.includes("0.5 w") || val.includes("1/2 w")) {
    pitch = 10.16;
    bodyLength = 9.0;
    bodyDiameter = 3.2;
  } else if (val.includes("1w") || val.includes("1 w")) {
    pitch = 12.70;
    bodyLength = 11.5;
    bodyDiameter = 4.5;
    drill = 1.0;
    padWidth = 2.0;
  } else if (val.includes("2w") || val.includes("2 w")) {
    pitch = 15.24;
    bodyLength = 14.0;
    bodyDiameter = 5.0;
    drill = 1.0;
    padWidth = 2.2;
  } else if (val.includes("5w") || val.includes("5 w") || val.includes("10w") || val.includes("10 w")) {
    pitch = 25.40;
    bodyLength = 22.0;
    bodyDiameter = 9.5;
    drill = 1.2;
    padWidth = 2.6;
  }

  const packageType = `R_Axial_DIN0207_L${bodyLength.toFixed(1)}mm_D${bodyDiameter.toFixed(1)}mm_P${pitch.toFixed(2)}mm_Horizontal`;

  return {
    familyId: "passive",
    presetId: pitch >= 10 ? "r-axial-10mm" : "r-axial-7mm",
    params: {
      subtype: "Axial_THT",
      pitch,
      bodyLength,
      bodyDiameter,
      drill,
      padWidth,
      padHeight: padWidth,
      componentType: "Resistor",
      packageType,
    },
  };
}

/**
 * Intelligent diode analyzer:
 * Defaults to Through-Hole DO-41 (1N4007) or DO-35 (1N4148 / Zener).
 */
export function analyzeDiode(val: string, name: string, ref: string) {
  // Small signal / Zener (1N4148, BZX, etc.)
  if (name.includes("zener") || val.includes("4148") || val.includes("bzx") || val.includes("zener") || val.includes("signal")) {
    return { familyId: "diode", presetId: "d-do35", params: { packageType: "DO-35", isLed: false, pitch: 7.62, drill: 0.8 } };
  }
  // High current (1N5400..1N5408, 3A-5A)
  if (val.includes("1n540") || val.includes("3a") || val.includes("5a")) {
    return { familyId: "diode", presetId: "d-do201", params: { packageType: "DO-201", isLed: false, pitch: 15.24, drill: 1.2 } };
  }
  // Default standard diode: DO-41 (1N4001 - 1N4007 / 1A Rectifier) - Most common in the world!
  return { familyId: "diode", presetId: "d-do41", params: { packageType: "DO-41", isLed: false, pitch: 10.16, drill: 1.0 } };
}

/**
 * Intelligent LED analyzer:
 * Defaults to Standard 5mm Through-Hole LED.
 */
export function analyzeLed(val: string, name: string, ref: string) {
  if (val.includes("3mm") || name.includes("3mm")) {
    return { familyId: "diode", presetId: "led-tht-3mm", params: { packageType: "LED_THT_3mm", isLed: true, pitch: 2.54, diameter: 3.0, drill: 0.8 } };
  }
  if (val.includes("8mm") || name.includes("8mm")) {
    return { familyId: "diode", presetId: "led-tht-8mm", params: { packageType: "LED_THT_8mm", isLed: true, pitch: 2.54, diameter: 8.0, drill: 0.9 } };
  }
  if (val.includes("10mm") || name.includes("10mm")) {
    return { familyId: "diode", presetId: "led-tht-10mm", params: { packageType: "LED_THT_10mm", isLed: true, pitch: 2.54, diameter: 10.0, drill: 1.0 } };
  }
  // Default: Standard 5mm Through-Hole LED!
  return { familyId: "diode", presetId: "led-tht-5mm", params: { packageType: "LED_THT_5mm", isLed: true, pitch: 2.54, diameter: 5.0, drill: 0.8 } };
}

/**
 * Intelligent transistor analyzer:
 * Defaults to standard TO-92 Through-Hole (or TO-220 for power).
 */
export function analyzeTransistor(val: string, name: string, ref: string) {
  // Power transistors / regulators
  if (val.includes("irf") || val.includes("tip") || val.includes("bd13") || val.includes("7805") || val.includes("7812") || val.includes("lm317") || name.includes("power") || name.includes("regulator")) {
    return { familyId: "transistor", presetId: "to-220", params: { packageType: "TO-220", mounting: "THT", pitch: 2.54, drill: 1.0 } };
  }
  // High power
  if (val.includes("247") || name.includes("to-247")) {
    return { familyId: "transistor", presetId: "to-247", params: { packageType: "TO-247", mounting: "THT", pitch: 5.45, drill: 1.3 } };
  }
  // Default: Standard TO-92 Through-Hole (2N2222, 2N3904, BC547, 2N7000, etc.)
  return { familyId: "transistor", presetId: "to-92", params: { packageType: "TO-92", mounting: "THT", pitch: 1.27, drill: 0.75 } };
}

/**
 * Intelligent IC, MCU, and pin count analyzer:
 * Automatically reads pin count from schematic symbols and generates the standard DIP through-hole package (DIP-4..DIP-40).
 * If pin count exceeds standard DIP (> 40 pins), falls back to SMD (QFP/LQFP).
 */
export function analyzeIcOrPins(pins: number, val: string, name: string, ref: string) {
  const normName = name.toLowerCase().replace(/[\s\-_]/g, "");
  const normVal = val.toLowerCase().replace(/[\s\-_]/g, "");
  const refUpper = ref.toUpperCase();

  // Optocouplers
  if (normName.includes("optocoupler") || normName.includes("opto") || normVal.includes("pc817") || normVal.includes("4n25") || normVal.includes("4n35") || normVal.includes("6n137")) {
    if (pins === 4 || normVal.includes("pc817")) {
      return { familyId: "optocoupler", presetId: "opto-dip4", params: { packageType: "Optocoupler_DIP-4" } };
    }
    return { familyId: "optocoupler", presetId: "opto-dip6", params: { packageType: "Optocoupler_DIP-6" } };
  }

  // OpAmps & Timers
  if (normName.includes("opamp") || normName.includes("comparator") || normVal.includes("lm358") || normVal.includes("ne5532") || normVal.includes("tl072") || normVal.includes("ne555") || normVal.includes("555") || normVal.includes("lm393")) {
    return { familyId: "dip", presetId: "dip-8", params: { pinCount: 8, rowSpacing: 7.62, packageType: "DIP-8" } };
  }
  if (normName.includes("quadopamp") || normVal.includes("lm324") || normVal.includes("tl074")) {
    return { familyId: "dip", presetId: "dip-14", params: { pinCount: 14, rowSpacing: 7.62, packageType: "DIP-14" } };
  }

  // Logic Gates (74xx / CD40xx)
  if (normName.includes("gate") || normName.includes("schmitt") || normName.includes("buffer") || normVal.startsWith("74") || normVal.startsWith("cd40")) {
    let pinCount = pins > 0 ? pins : 14;
    if (pinCount % 2 !== 0) pinCount += 1;
    return { familyId: "dip", presetId: `dip-${pinCount}`, params: { pinCount, rowSpacing: 7.62, packageType: `DIP-${pinCount}` } };
  }

  // Arabic variations of atmega
  const isAtmegaArabic = normVal.includes("اتميغا") || normVal.includes("أتمبغا") || normVal.includes("أتمبجا") || normVal.includes("أتميكا") ||
                         normName.includes("اتميغا") || normName.includes("أتمبغا") || normName.includes("أتمبجا") || normName.includes("أتميكا");
  const isAtmegaEnglish = normVal.includes("atmega") || normName.includes("atmega");
  const has328 = normVal.includes("328") || normName.includes("328");
  const is328Chip = has328 && (refUpper.startsWith("U") || normName.includes("mcu") || normName.includes("ic") || isAtmegaEnglish || isAtmegaArabic);

  // Specific microcontrollers in DIP
  if (is328Chip || (isAtmegaEnglish && has328) || (isAtmegaArabic && has328) || normName.includes("atmega328") || normVal.includes("atmega328") || normVal.includes("mega328") || normVal.includes("mega328p")) {
    return { familyId: "dip", presetId: "dip-28", params: { pinCount: 28, rowSpacing: 15.24, packageType: "DIP-28" } };
  }
  if (normVal.includes("atmega8") || normName.includes("atmega8")) {
    return { familyId: "dip", presetId: "dip-28", params: { pinCount: 28, rowSpacing: 15.24, packageType: "DIP-28" } };
  }
  if (normName.includes("attiny85") || normVal.includes("attiny85") || normVal.includes("tiny85")) {
    return { familyId: "dip", presetId: "dip-8", params: { pinCount: 8, rowSpacing: 7.62, packageType: "DIP-8" } };
  }
  if (normVal.includes("atmega16") || normVal.includes("atmega32") || normVal.includes("8051") || normVal.includes("pic16f877")) {
    return { familyId: "dip", presetId: "dip-40", params: { pinCount: 40, rowSpacing: 15.24, packageType: "DIP-40" } };
  }

  // Connectors / Headers
  if (name.startsWith("conn_") || name.includes("terminal") || name.includes("header") || ref.startsWith("J") || ref.startsWith("TB") || ref.startsWith("P")) {
    if (name.includes("screw") || name.includes("terminal") || ref.startsWith("TB") || val.includes("kf") || val.includes("dg")) {
      const polesMatch = name.match(/(\d+)p/) || val.match(/(\d+)p/);
      const pinCount = polesMatch ? parseInt(polesMatch[1], 10) : (pins > 0 ? pins : 2);
      const pitch = (name.includes("3.5") || val.includes("3.5")) ? 3.5 : (name.includes("5.00") || val.includes("5.00")) ? 5.00 : 5.08;
      return { familyId: "connector", params: { rows: 1, pinCount, pitch, connectorType: "TerminalBlock", packageType: `TerminalBlock_1x${pinCount}_P${pitch.toFixed(2)}mm` } };
    }
    const pinCount = pins > 0 ? pins : 2;
    if (pinCount > 4 && pinCount % 2 === 0 && (name.includes("2x") || name.includes("dual") || name.includes("isp") || name.includes("jtag"))) {
      return { familyId: "connector", params: { rows: 2, pinCount, pitch: 2.54, rowSpacing: 2.54, connectorType: "Header", packageType: `PinHeader_2x${pinCount / 2}_P2.54mm_Vertical` } };
    }
    return { familyId: "connector", params: { rows: 1, pinCount, pitch: 2.54, connectorType: "Header", packageType: `PinHeader_1x${pinCount}_P2.54mm_Vertical` } };
  }

  // General IC or symbol pin count evaluation
  if (pins >= 4 && pins <= 40) {
    let pinCount = pins;
    if (pinCount % 2 !== 0) pinCount += 1;
    const rowSpacing = pinCount >= 28 ? 15.24 : 7.62;
    const packageType = `DIP-${pinCount}`;
    return {
      familyId: "dip",
      presetId: `dip-${pinCount}`,
      params: {
        pinCount,
        rowSpacing,
        pitch: 2.54,
        drill: 0.8,
        padWidth: 1.6,
        padHeight: 1.6,
        packageType,
      },
    };
  }

  // If pins > 40: NO standard THT DIP exists, so fallback to SMD (QFP / LQFP / TQFP) per user rule:
  // "إذا لم توجد بصمة ثقبية يتم تعيين بصمة من نوع smd"
  if (pins > 40) {
    const pinCount = pins % 4 === 0 ? pins : Math.ceil(pins / 4) * 4;
    const presetId = pinCount <= 44 ? "lqfp-44" : pinCount <= 48 ? "lqfp-48" : pinCount <= 64 ? "lqfp-64" : "lqfp-100";
    return { familyId: "qfp", presetId, params: { pinCount, pitch: 0.5, packageType: `LQFP-${pinCount}` } };
  }

  if (pins === 3) {
    return { familyId: "transistor", presetId: "to-92", params: { packageType: "TO-92", mounting: "THT", pitch: 1.27, drill: 0.75 } };
  }

  if (pins === 2) {
    return analyzeResistor(val, name, ref);
  }

  // Default IC fallback: standard DIP-8 (THT)
  return { familyId: "dip", presetId: "dip-8", params: { pinCount: 8, rowSpacing: 7.62, packageType: "DIP-8" } };
}

/**
 * Intelligently suggests the best generator family and parameters
 * based on schematic symbol metadata (name, reference, value, pin count, package).
 * THT-FIRST: Defaults strictly to standard Through-Hole (Axial, Radial, DIP, TO-92, DO-41, etc.)
 * unless explicit SMD hints are provided or no THT package physically exists.
 */
export function guessFootprintConfigFromSymbol(options: GuessOptions): {
  familyId: string;
  presetId?: string;
  params: Record<string, any>;
} {
  const name = (options.symbolName || "").toLowerCase();
  const ref = (options.reference || "").toUpperCase();
  const val = (options.value || "").toLowerCase();
  const pkg = (options.packageHint || "").toLowerCase();
  const pins = options.pinCount || 0;

  const normName = name.replace(/[\s\-_]/g, "");
  const normVal = val.replace(/[\s\-_]/g, "");

  // 1. Explicit package hints (including legacy migration hints)
  // Radial Electrolytic Capacitor hint
  if (pkg.includes("cp_radial") || pkg.includes("c_radial") || (pkg.includes("radial") && !pkg.includes("disc"))) {
    const dMatch = pkg.match(/d([\d.]+)mm/i);
    const pMatch = pkg.match(/p([\d.]+)mm/i);
    const bodyDiameter = dMatch ? parseFloat(dMatch[1]) : 6.3;
    const pitch = pMatch ? parseFloat(pMatch[1]) : 2.5;
    const drill = bodyDiameter >= 16 ? 1.2 : bodyDiameter >= 10 ? 1.0 : 0.8;
    const padWidth = bodyDiameter >= 16 ? 2.4 : bodyDiameter >= 10 ? 1.9 : 1.6;
    const packageType = `CP_Radial_D${bodyDiameter.toFixed(1)}mm_P${pitch.toFixed(2)}mm`;
    return {
      familyId: "passive",
      presetId: `cp-radial-${Math.round(bodyDiameter)}mm`,
      params: {
        subtype: "Radial_THT",
        componentType: "Capacitor",
        polarized: true,
        bodyDiameter,
        pitch,
        drill,
        padWidth,
        padHeight: padWidth,
        packageType,
      },
    };
  }

  // Ceramic Disc Capacitor hint
  if (pkg.includes("c_disc") || pkg.includes("disc")) {
    const dMatch = pkg.match(/d([\d.]+)mm/i);
    const pMatch = pkg.match(/p([\d.]+)mm/i);
    const bodyDiameter = dMatch ? parseFloat(dMatch[1]) : 5.0;
    const pitch = pMatch ? parseFloat(pMatch[1]) : 2.54;
    const packageType = `C_Disc_D${bodyDiameter.toFixed(1)}mm_W2.5mm_P${pitch.toFixed(2)}mm`;
    return {
      familyId: "passive",
      presetId: "c-disc-5mm",
      params: {
        subtype: "Radial_THT",
        componentType: "Capacitor",
        polarized: false,
        bodyDiameter,
        pitch,
        drill: 0.8,
        padWidth: 1.6,
        padHeight: 1.6,
        packageType,
      },
    };
  }

  // Axial Resistor hint
  if (pkg.includes("r_axial") || pkg.includes("axial") || pkg.includes("res_dip")) {
    const pMatch = pkg.match(/p([\d.]+)mm/i);
    const pitch = pMatch ? parseFloat(pMatch[1]) : (pkg.includes("1016") ? 10.16 : 7.62);
    const bodyLength = pitch >= 12 ? 11.5 : pitch >= 10 ? 9.0 : 6.3;
    const bodyDiameter = pitch >= 12 ? 4.5 : pitch >= 10 ? 3.2 : 2.4;
    const drill = pitch >= 12 ? 1.0 : 0.8;
    const padWidth = pitch >= 12 ? 2.0 : 1.8;
    const packageType = `R_Axial_DIN0207_L${bodyLength.toFixed(1)}mm_D${bodyDiameter.toFixed(1)}mm_P${pitch.toFixed(2)}mm_Horizontal`;
    return {
      familyId: "passive",
      presetId: pitch >= 10 ? "r-axial-10mm" : "r-axial-7mm",
      params: {
        subtype: "Axial_THT",
        pitch,
        bodyLength,
        bodyDiameter,
        drill,
        padWidth,
        padHeight: padWidth,
        componentType: "Resistor",
        packageType,
      },
    };
  }

  if (pkg.includes("dip") || pkg.includes("pdip") || pkg.includes("dil")) {
    const pMatch = pkg.match(/\d+/);
    let pinCount = pMatch ? parseInt(pMatch[0], 10) : (pins > 0 ? pins : 8);
    if (pinCount % 2 !== 0) pinCount += 1;
    const rowSpacing = pinCount >= 28 || pkg.includes("wide") || pkg.includes("15") ? 15.24 : 7.62;
    const packageType = `DIP-${pinCount}`;
    return {
      familyId: "dip",
      presetId: `dip-${pinCount}`,
      params: {
        pinCount,
        rowSpacing,
        pitch: 2.54,
        drill: 0.8,
        padWidth: 1.6,
        padHeight: 1.6,
        packageType,
      },
    };
  }
  if (pkg.includes("soic") || pkg.includes("sop") || pkg.includes("tssop") || pkg.includes("msop")) {
    const subtype = pkg.includes("tssop") ? "TSSOP" : pkg.includes("msop") ? "MSOP" : "SOIC";
    const pMatch = pkg.match(/\d+/);
    const pinCount = pMatch ? parseInt(pMatch[0], 10) : (pins > 0 ? pins : 8);
    return { familyId: "soic", params: { pinCount, packageSubtype: subtype } };
  }
  if (pkg.includes("qfp") || pkg.includes("lqfp") || pkg.includes("tqfp")) {
    const pMatch = pkg.match(/\d+/);
    const pinCount = pMatch ? parseInt(pMatch[0], 10) : (pins > 0 ? pins : 32);
    return { familyId: "qfp", params: { pinCount } };
  }
  if (pkg.includes("qfn") || pkg.includes("dfn") || pkg.includes("mlf")) {
    const pMatch = pkg.match(/\d+/);
    const pinCount = pMatch ? parseInt(pMatch[0], 10) : (pins > 0 ? pins : 32);
    return { familyId: "qfn", params: { pinCount } };
  }
  if (pkg.includes("bga")) {
    return { familyId: "bga", params: { rows: 8, columns: 8 } };
  }
  if (pkg.includes("sot-23") || pkg.includes("sot23")) {
    return { familyId: "transistor", params: { packageType: "SOT-23" } };
  }
  if (pkg.includes("sot-223") || pkg.includes("sot223")) {
    return { familyId: "transistor", params: { packageType: "SOT-223" } };
  }
  if (pkg.includes("to-92") || pkg.includes("to92")) {
    return { familyId: "transistor", params: { packageType: "TO-92", mounting: "THT" } };
  }
  if (pkg.includes("to-220") || pkg.includes("to220")) {
    return { familyId: "transistor", params: { packageType: "TO-220", mounting: "THT" } };
  }
  if (pkg.includes("dpak") || pkg.includes("to-252")) {
    return { familyId: "transistor", params: { packageType: "DPAK" } };
  }
  if (pkg.includes("sod-123") || pkg.includes("sod123")) {
    return { familyId: "diode", params: { packageType: "SOD-123" } };
  }
  if (pkg.includes("sma") || pkg.includes("smb") || pkg.includes("smc")) {
    return { familyId: "diode", params: { packageType: "SMA" } };
  }
  if (pkg.includes("0402") || pkg.includes("0603") || pkg.includes("0805") || pkg.includes("1206") || pkg.includes("2512")) {
    const size = (pkg.includes("0402") ? "0402" : pkg.includes("0603") ? "0603" : pkg.includes("1206") ? "1206" : pkg.includes("2512") ? "2512" : "0805") as any;
    const isCap = ref.startsWith("C") || name.includes("cap");
    const isInd = ref.startsWith("L") || name.includes("ind");
    return { familyId: "passive", params: { subtype: "SMD_Chip", chipSize: size, componentType: isCap ? "Capacitor" : isInd ? "Inductor" : "Resistor" } };
  }

  // 2. Intelligent Estimation by Component Identity & Schema Type (THT-First)

  // Connectors, Headers & Terminal Blocks
  if (name.startsWith("conn_") || name.includes("terminal") || name.includes("header") || ref.startsWith("J") || ref.startsWith("TB") || ref.startsWith("P")) {
    return analyzeIcOrPins(pins, val, name, ref);
  }

  // Resistors & Potentiometers
  if (ref.startsWith("R") || ref.startsWith("VR") || ref.startsWith("POT") || ref.startsWith("RV") || name.includes("resistor") || name.includes("potentiometer") || name.includes("trimmer") || name.includes("ldr")) {
    return analyzeResistor(val, name, ref);
  }

  // Capacitors (Electrolytic / Ceramic Disc / Film)
  if (ref.startsWith("C") || name.includes("capacitor") || name.includes("cap")) {
    return analyzeCapacitor(val, name, ref);
  }

  // Inductors, Ferrites & Transformers
  if (ref.startsWith("L") || ref.startsWith("FB") || name.includes("inductor") || name.includes("choke") || name.includes("ferrite")) {
    if (name.includes("ferrite") || ref.startsWith("FB") || val.includes("bead")) {
      return { familyId: "inductor", presetId: "ind-ferrite", params: { packageType: "Ferrite Bead" } };
    }
    if (name.includes("common") || name.includes("cmc")) {
      return { familyId: "inductor", presetId: "ind-cmc", params: { packageType: "Common Mode Choke" } };
    }
    if (name.includes("power") || val.includes("cdrh")) {
      return { familyId: "inductor", presetId: "ind-power", params: { packageType: "Power Inductor" } };
    }
    return { familyId: "inductor", presetId: "ind-smd", params: { packageType: "SMD" } };
  }
  if (name.includes("transformer") || ref.startsWith("TR") || ref.startsWith("T")) {
    return { familyId: "connector", params: { rows: 2, pinCount: Math.max(4, pins || 4), pitch: 2.54, rowSpacing: 7.62, connectorType: "Header" } };
  }

  // Fuses, PTC, TVS & Surge Protection
  if (ref.startsWith("F") || ref.startsWith("MOV") || ref.startsWith("TVS") || name.includes("fuse") || name.includes("polyfuse") || name.includes("varistor")) {
    if (name.includes("varistor") || ref.startsWith("MOV")) {
      return { familyId: "fuse_protection", presetId: "mov-7mm", params: { packageType: "Varistor_MOV_7mm_P5mm" } };
    }
    return { familyId: "fuse_protection", presetId: "fuse-1206", params: { packageType: "Fuse_SMD_1206" } };
  }

  // Diodes & LEDs
  if (name.includes("led") || ref.startsWith("LED")) {
    return analyzeLed(val, name, ref);
  }
  if (ref.startsWith("D") || name.includes("diode") || name.includes("zener") || name.includes("schottky")) {
    return analyzeDiode(val, name, ref);
  }

  // Transistors, MOSFETs, Regulators
  if (ref.startsWith("Q") || name.includes("transistor") || name.includes("bjt") || name.includes("mosfet") || name.includes("npn") || name.includes("pnp")) {
    return analyzeTransistor(val, name, ref);
  }
  if (name.includes("regulator") || val.includes("7805") || val.includes("7812") || val.includes("lm317") || val.includes("1117") || val.includes("ams1117")) {
    if (val.includes("1117") || val.includes("ams1117")) {
      return { familyId: "transistor", params: { packageType: "SOT-223" } };
    }
    return { familyId: "transistor", presetId: "to-220", params: { packageType: "TO-220", mounting: "THT" } };
  }

  // Optocouplers
  if (name.includes("optocoupler") || name.includes("opto") || val.includes("pc817") || val.includes("4n25") || val.includes("4n35") || val.includes("6n137")) {
    if (pins === 4 || val.includes("pc817")) {
      return { familyId: "optocoupler", presetId: "opto-dip4", params: { packageType: "Optocoupler_DIP-4" } };
    }
    return { familyId: "optocoupler", presetId: "opto-dip6", params: { packageType: "Optocoupler_DIP-6" } };
  }

  // OpAmps & Comparators & Timers
  if (name.includes("opamp") || name.includes("comparator") || val.includes("lm358") || val.includes("ne5532") || val.includes("tl072") || val.includes("ne555") || val.includes("555") || val.includes("lm393")) {
    return { familyId: "dip", presetId: "dip-8", params: { pinCount: 8, rowSpacing: 7.62 } };
  }
  if (name.includes("quad_opamp") || val.includes("lm324") || val.includes("tl074")) {
    return { familyId: "dip", presetId: "dip-14", params: { pinCount: 14, rowSpacing: 7.62 } };
  }

  // Logic Gates (74xx)
  if (name.includes("gate") || name.includes("schmitt") || name.includes("buffer") || val.startsWith("74")) {
    return { familyId: "dip", presetId: "dip-14", params: { pinCount: 14, rowSpacing: 7.62 } };
  }

  // Microcontrollers & Specialized Modules
  if (name.includes("esp32") || val.includes("esp32")) {
    return { familyId: "modules", presetId: "mod-esp32", params: { packageType: "Module_ESP32_WROOM_32" } };
  }
  if (name.includes("arduino_nano") || val.includes("nano")) {
    return { familyId: "modules", presetId: "mod-nano", params: { packageType: "Module_Arduino_Nano_Header" } };
  }
  if (name.includes("pico") || val.includes("rp2040")) {
    return { familyId: "modules", presetId: "mod-pico", params: { packageType: "Module_RaspberryPi_Pico" } };
  }
  // Arabic variations of atmega
  const isAtmegaArabic = normVal.includes("اتميغا") || normVal.includes("أتمبغا") || normVal.includes("أتمبجا") || normVal.includes("أتميكا") ||
                         normName.includes("اتميغا") || normName.includes("أتمبغا") || normName.includes("أتمبجا") || normName.includes("أتميكا");
  const isAtmegaEnglish = normVal.includes("atmega") || normName.includes("atmega");
  const has328 = normVal.includes("328") || normName.includes("328");
  const is328Chip = has328 && (ref.startsWith("U") || normName.includes("mcu") || normName.includes("ic") || isAtmegaEnglish || isAtmegaArabic);

  if (is328Chip || (isAtmegaEnglish && has328) || (isAtmegaArabic && has328) || normName.includes("atmega328") || normVal.includes("atmega328") || normVal.includes("mega328") || normVal.includes("mega328p")) {
    return { familyId: "dip", presetId: "dip-28", params: { pinCount: 28, rowSpacing: 15.24 } };
  }
  if (name.includes("stm32") || val.includes("stm32")) {
    const pinCount = pins > 0 ? (pins % 4 === 0 ? pins : Math.ceil(pins / 4) * 4) : 48;
    const presetId = pinCount <= 44 ? "lqfp-44" : pinCount <= 48 ? "lqfp-48" : pinCount <= 64 ? "lqfp-64" : "lqfp-100";
    return { familyId: "qfp", presetId, params: { pinCount, pitch: 0.5, packageType: `LQFP-${pinCount}` } };
  }

  // Crystals & Oscillators
  if (ref.startsWith("Y") || ref.startsWith("X") || name.includes("crystal") || name.includes("oscillator")) {
    return { familyId: "crystal", presetId: "xtal-hc49", params: { packageType: "HC-49/US" } };
  }

  // Relays, Switches & Pushbuttons
  if (name.includes("relay") || ref.startsWith("K") || ref.startsWith("RLY")) {
    return { familyId: "switch_relay", presetId: "rly-srd", params: { packageType: "Relay_SPDT_Songle_SRD" } };
  }
  if (name.includes("switch") || name.includes("button") || name.includes("push") || ref.startsWith("SW")) {
    return { familyId: "switch_relay", presetId: "sw-tact-6x6-tht", params: { packageType: "Tactile_6x6mm_THT" } };
  }

  // Interfaces (USB, RJ45, Barrel Jack)
  if (name.includes("usb_c") || name.includes("type-c") || val.includes("type-c")) {
    return { familyId: "connector_interface", presetId: "usb-c-16p", params: { packageType: "USB_C_Receptacle_16Pin" } };
  }
  if (name.includes("usb") || val.includes("usb")) {
    return { familyId: "connector_interface", presetId: "usb-a-female", params: { packageType: "USB_A_Receptacle_Female_THT" } };
  }
  if (name.includes("barrel") || name.includes("power_jack") || val.includes("pj-002")) {
    return { familyId: "connector_interface", presetId: "dc-barrel-jack", params: { packageType: "BarrelJack_DC_2.1mm_PJ002A" } };
  }
  if (name.includes("rj45") || name.includes("ethernet")) {
    return { familyId: "connector_interface", presetId: "rj45-magjack", params: { packageType: "RJ45_MagJack_Ethernet_8P" } };
  }

  // Displays
  if (name.includes("oled") || name.includes("ssd1306")) {
    return { familyId: "display", presetId: "oled-096-i2c", params: { packageType: "Display_OLED_0.96_I2C_4Pin" } };
  }
  if (name.includes("lcd_1602") || name.includes("lcd_2004") || name.includes("1602")) {
    return { familyId: "display", presetId: "lcd-1602", params: { packageType: "Display_LCD1602_Parallel_16Pin" } };
  }
  if (name.includes("seven_segment") || name.includes("7seg")) {
    return { familyId: "display", presetId: "7seg-1d", params: { packageType: "Display_7Segment_1Digit_10Pin" } };
  }

  // Sensors
  if (name.includes("dht11") || name.includes("dht22")) {
    return { familyId: "sensor", presetId: "sens-dht11", params: { packageType: "Sensor_DHT11_DHT22_4Pin" } };
  }
  if (name.includes("sr04") || name.includes("ultrasonic")) {
    return { familyId: "sensor", presetId: "sens-hcsr04", params: { packageType: "Sensor_HCSR04_Ultrasonic_4Pin" } };
  }
  if (name.includes("pir") || name.includes("sr501")) {
    return { familyId: "sensor", presetId: "sens-hcsr501", params: { packageType: "Sensor_HCSR501_PIR_3Pin" } };
  }
  if (name.includes("bme280") || name.includes("bmp280")) {
    return { familyId: "sensor", presetId: "sens-bme280-mod", params: { packageType: "Sensor_BME280_Module_6Pin" } };
  }

  // RF & Antennas
  if (name.includes("antenna") || ref.startsWith("ANT") || name.includes("nrf24")) {
    if (name.includes("nrf24")) {
      return { familyId: "rf_antenna", presetId: "mod-nrf24", params: { packageType: "Module_NRF24L01_Header_2x4" } };
    }
    return { familyId: "rf_antenna", presetId: "rf-sma-edge", params: { packageType: "SMA_Edge_Mount_Jack" } };
  }

  // Batteries & Power Connectors
  if (name.includes("cr2032") || name.includes("coin") || ref.startsWith("BT") || ref.startsWith("BAT") || name.includes("battery")) {
    return { familyId: "batteries_power", presetId: "bat-cr2032-smd", params: { packageType: "Battery_CR2032_SMD_Keystone1058" } };
  }
  if (name.includes("xt60") || name.includes("xt30")) {
    return { familyId: "batteries_power", presetId: name.includes("xt30") ? "conn-xt30" : "conn-xt60", params: { packageType: name.includes("xt30") ? "Connector_Power_XT30_THT" : "Connector_Power_XT60_THT" } };
  }

  // Test Points & Mounting Holes
  if (ref.startsWith("TP") || name.includes("test_point")) {
    return { familyId: "test_mechanical", presetId: "tp-key5000", params: { packageType: "TestPoint_Keystone_5000_THT" } };
  }
  if (ref.startsWith("H") || ref.startsWith("MH") || name.includes("mounting_hole")) {
    return { familyId: "test_mechanical", presetId: "hole-m3", params: { packageType: "MountingHole_M3" } };
  }

  // 3. Fallback based on Pin Count (Intelligent THT-First)
  return analyzeIcOrPins(pins, val, name, ref);
}

/**
 * Creates an automatic fallback footprint if a component has no footprint assigned.
 */
export function createDefaultFallbackFootprint(options: GuessOptions): KicadFootprintModel {
  const config = guessFootprintConfigFromSymbol(options);
  const pkgName = config.params.packageType || (config.familyId === "dip" && config.params.pinCount ? `DIP-${config.params.pinCount}` : undefined);
  const params = {
    ...config.params,
    presetId: config.presetId,
    reference: options.reference || "U",
    value: options.value || options.symbolName || "COMPONENT",
    footprintName: pkgName,
  };
  const model = generateFootprint(config.familyId, params);
  if (pkgName && !model.name.includes(pkgName)) {
    model.name = pkgName;
  }
  if (!model.fullName) {
    model.fullName = `Generator:${model.name}`;
  }
  model.source = "generator";
  return model;
}
