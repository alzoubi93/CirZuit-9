import type { KicadFootprintModel } from "../../footprint";
import { generateDip, DipParams } from "../families/dip";
import { generateSoic, SoicParams } from "../families/soic";
import { generateQfp, QfpParams } from "../families/qfp";
import { generateQfn, QfnParams } from "../families/qfn";
import { generateBga, BgaParams } from "../families/bga";
import { generatePassive, PassiveParams } from "../families/passive";
import { generateConnector, ConnectorParams } from "../families/connector";
import { generateTransistor, TransistorParams } from "../families/transistor";
import { generateDiode, DiodeParams } from "../families/diode";
import { generateCrystal, CrystalParams } from "../families/crystal";
import { generateInductor, InductorParams } from "../families/inductor";
import { generateSwitchRelay, SwitchRelayParams } from "../families/switchRelay";
import { generateFuseProtection, FuseProtectionParams } from "../families/fuseProtection";
import { generatePotentiometer, PotentiometerParams } from "../families/potentiometer";
import { generateOptocoupler, OptocouplerParams } from "../families/optocoupler";
import { generateConnectorInterface, ConnectorInterfaceParams } from "../families/connectorInterface";
import { generateDisplay, DisplayParams } from "../families/display";
import { generateSensor, SensorParams } from "../families/sensor";
import { generateRfAntenna, RfAntennaParams } from "../families/rfAntenna";
import { generateModules, ModulesParams } from "../families/modules";
import { generateTestMechanical, TestMechanicalParams } from "../families/testMechanical";
import { generateBatteriesPower, BatteriesPowerParams } from "../families/batteriesPower";

export interface FamilyPreset {
  id: string;
  name: string;
  nameAr?: string;
  description?: string;
  params: Record<string, any>;
}

export interface FootprintFamilyDefinition {
  id: string;
  name: string;
  nameAr: string;
  category: string;
  categoryAr: string;
  mounting: "SMD" | "THT" | "Both";
  defaultParams: Record<string, any>;
  presets: FamilyPreset[];
  generate: (params: any) => KicadFootprintModel;
}

/**
 * Registry of footprint generator families divided strictly according to the user specification:
 * 1. DIP
 * 2. SOIC / SOP / TSSOP
 * 3. QFP / LQFP / TQFP
 * 4. QFN / DFN
 * 5. BGA
 * 6. Passives (R/C)
 * 7. Pin Headers & Terminal Blocks
 * 8. Transistors & Power
 * 9. Diodes & LEDs
 * 10. Crystals & Oscillators
 * 11. Inductors & Ferrites
 * 12. Switches & Relays
 * 13. Fuses & Protection
 * 14. Potentiometers
 * 15. Optocouplers
 * 16. Connectors & Interfaces
 * 17. Displays
 * 18. Sensors
 * 19. RF & Antennas
 * 20. Modules
 * 21. Test & Mechanical
 * 22. Batteries & Power
 */
export const FOOTPRINT_FAMILIES: Record<string, FootprintFamilyDefinition> = {
  // 1. DIP
  dip: {
    id: "dip",
    name: "DIP",
    nameAr: "حزم DIP ثنائية الأطراف",
    category: "IC",
    categoryAr: "الدوائر المتكاملة",
    mounting: "THT",
    defaultParams: {
      pinCount: 8,
      pitch: 2.54,
      rowSpacing: 7.62,
      padWidth: 1.6,
      padHeight: 1.6,
      drill: 0.8,
    },
    presets: [
      { id: "dip-4", name: "DIP-4 (Opto/Relay)", nameAr: "DIP-4 (عازل/مرحل)", params: { pinCount: 4, rowSpacing: 7.62 } },
      { id: "dip-8", name: "DIP-8 (Op-Amp / NE555)", nameAr: "DIP-8 (مكبر عمليات / مؤقت 555)", params: { pinCount: 8, rowSpacing: 7.62 } },
      { id: "dip-14", name: "DIP-14 (Logic 74xx)", nameAr: "DIP-14 (بوابات منطقية)", params: { pinCount: 14, rowSpacing: 7.62 } },
      { id: "dip-16", name: "DIP-16 (Shift Reg / Driver)", nameAr: "DIP-16 (مسجل إزاحة / محرك)", params: { pinCount: 16, rowSpacing: 7.62 } },
      { id: "dip-18", name: "DIP-18 (Microcontroller)", nameAr: "DIP-18 (متحكم دقيق)", params: { pinCount: 18, rowSpacing: 7.62 } },
      { id: "dip-20", name: "DIP-20 (Buffer / Driver)", nameAr: "DIP-20 (بافر ومحرك)", params: { pinCount: 20, rowSpacing: 7.62 } },
      { id: "dip-24", name: "DIP-24 (Narrow 7.62mm)", nameAr: "DIP-24 (ضيق 7.62مم)", params: { pinCount: 24, rowSpacing: 7.62 } },
      { id: "dip-28", name: "DIP-28 (Wide 15.24mm - ATmega328)", nameAr: "DIP-28 (عريض - أردوينو)", params: { pinCount: 28, rowSpacing: 15.24 } },
      { id: "dip-40", name: "DIP-40 (Wide 15.24mm - MCU)", nameAr: "DIP-40 (عريض 15.24مم)", params: { pinCount: 40, rowSpacing: 15.24 } },
    ],
    generate: (p) => generateDip(p as DipParams),
  },

  // 2. SOIC / SOP / TSSOP
  soic: {
    id: "soic",
    name: "SOIC / SOP / TSSOP",
    nameAr: "حزم SOIC / SOP / TSSOP السطحية",
    category: "IC",
    categoryAr: "الدوائر المتكاملة",
    mounting: "SMD",
    defaultParams: {
      pinCount: 8,
      packageSubtype: "SOIC",
      pitch: 1.27,
      rowSpacing: 5.4,
      padWidth: 1.55,
      padHeight: 0.6,
      bodyWidth: 3.9,
    },
    presets: [
      { id: "soic-8", name: "SOIC-8 (1.27mm)", nameAr: "SOIC-8 (1.27مم)", params: { pinCount: 8, pitch: 1.27, rowSpacing: 5.4, padWidth: 1.55, padHeight: 0.6, bodyWidth: 3.9, packageSubtype: "SOIC" } },
      { id: "soic-14", name: "SOIC-14 (1.27mm)", nameAr: "SOIC-14 (1.27مم)", params: { pinCount: 14, pitch: 1.27, rowSpacing: 5.4, padWidth: 1.55, padHeight: 0.6, bodyWidth: 3.9, packageSubtype: "SOIC" } },
      { id: "soic-16", name: "SOIC-16 (1.27mm)", nameAr: "SOIC-16 (1.27مم)", params: { pinCount: 16, pitch: 1.27, rowSpacing: 5.4, padWidth: 1.55, padHeight: 0.6, bodyWidth: 3.9, packageSubtype: "SOIC" } },
      { id: "soic-16w", name: "SOIC-16 Wide (7.5mm Body)", nameAr: "SOIC-16 عريض (7.5مم)", params: { pinCount: 16, pitch: 1.27, rowSpacing: 9.4, padWidth: 1.8, padHeight: 0.6, bodyWidth: 7.5, packageSubtype: "SOIC" } },
      { id: "soic-20w", name: "SOIC-20 Wide (7.5mm Body)", nameAr: "SOIC-20 عريض (7.5مم)", params: { pinCount: 20, pitch: 1.27, rowSpacing: 9.4, padWidth: 1.8, padHeight: 0.6, bodyWidth: 7.5, packageSubtype: "SOIC" } },
      { id: "tssop-8", name: "TSSOP-8 (0.65mm)", nameAr: "TSSOP-8 (0.65مم)", params: { pinCount: 8, pitch: 0.65, rowSpacing: 6.4, padWidth: 1.45, padHeight: 0.45, bodyWidth: 4.4, packageSubtype: "TSSOP" } },
      { id: "tssop-16", name: "TSSOP-16 (0.65mm)", nameAr: "TSSOP-16 (0.65مم)", params: { pinCount: 16, pitch: 0.65, rowSpacing: 6.4, padWidth: 1.45, padHeight: 0.45, bodyWidth: 4.4, packageSubtype: "TSSOP" } },
      { id: "tssop-20", name: "TSSOP-20 (0.65mm)", nameAr: "TSSOP-20 (0.65مم)", params: { pinCount: 20, pitch: 0.65, rowSpacing: 6.4, padWidth: 1.45, padHeight: 0.45, bodyWidth: 4.4, packageSubtype: "TSSOP" } },
      { id: "msop-8", name: "MSOP-8 (0.65mm)", nameAr: "MSOP-8 (0.65مم)", params: { pinCount: 8, pitch: 0.65, rowSpacing: 4.9, padWidth: 1.2, padHeight: 0.4, bodyWidth: 3.0, packageSubtype: "MSOP" } },
    ],
    generate: (p) => generateSoic(p as SoicParams),
  },

  // 3. QFP / LQFP / TQFP
  qfp: {
    id: "qfp",
    name: "QFP / LQFP / TQFP",
    nameAr: "حزم QFP رباعية الأطراف",
    category: "IC",
    categoryAr: "الدوائر المتكاملة",
    mounting: "SMD",
    defaultParams: {
      pinCount: 32,
      pitch: 0.8,
      bodySize: 7.0,
      spanX: 9.0,
      spanY: 9.0,
      padWidth: 0.45,
      padLength: 1.5,
    },
    presets: [
      { id: "lqfp-32", name: "LQFP-32 (7x7mm, 0.8mm Pitch)", nameAr: "LQFP-32 (7×7مم، خطوة 0.8مم)", params: { pinCount: 32, pitch: 0.8, bodySize: 7.0, spanX: 9.0, spanY: 9.0, padWidth: 0.45, padLength: 1.5 } },
      { id: "lqfp-44", name: "LQFP-44 (10x10mm, 0.8mm Pitch)", nameAr: "LQFP-44 (10×10مم، خطوة 0.8مم)", params: { pinCount: 44, pitch: 0.8, bodySize: 10.0, spanX: 12.0, spanY: 12.0, padWidth: 0.45, padLength: 1.5 } },
      { id: "lqfp-48", name: "LQFP-48 (7x7mm, 0.5mm Pitch - STM32)", nameAr: "LQFP-48 (7×7مم، STM32)", params: { pinCount: 48, pitch: 0.5, bodySize: 7.0, spanX: 9.0, spanY: 9.0, padWidth: 0.3, padLength: 1.5 } },
      { id: "lqfp-64", name: "LQFP-64 (10x10mm, 0.5mm Pitch)", nameAr: "LQFP-64 (10×10مم، خطوة 0.5مم)", params: { pinCount: 64, pitch: 0.5, bodySize: 10.0, spanX: 12.0, spanY: 12.0, padWidth: 0.3, padLength: 1.5 } },
      { id: "lqfp-100", name: "LQFP-100 (14x14mm, 0.5mm Pitch)", nameAr: "LQFP-100 (14×14مم، خطوة 0.5مم)", params: { pinCount: 100, pitch: 0.5, bodySize: 14.0, spanX: 16.0, spanY: 16.0, padWidth: 0.3, padLength: 1.5 } },
    ],
    generate: (p) => generateQfp(p as QfpParams),
  },

  // 4. QFN / DFN
  qfn: {
    id: "qfn",
    name: "QFN / DFN",
    nameAr: "حزم QFN / DFN عديمة الأرجل",
    category: "IC",
    categoryAr: "الدوائر المتكاملة",
    mounting: "SMD",
    defaultParams: {
      pinCount: 32,
      pitch: 0.5,
      bodySize: 5.0,
      padWidth: 0.25,
      padLength: 0.6,
      thermalPadSize: 3.5,
    },
    presets: [
      { id: "qfn-16", name: "QFN-16 (3x3mm, 0.5mm)", nameAr: "QFN-16 (3×3مم)", params: { pinCount: 16, pitch: 0.5, bodySize: 3.0, thermalPadSize: 1.7 } },
      { id: "qfn-24", name: "QFN-24 (4x4mm, 0.5mm)", nameAr: "QFN-24 (4×4مم)", params: { pinCount: 24, pitch: 0.5, bodySize: 4.0, thermalPadSize: 2.5 } },
      { id: "qfn-32", name: "QFN-32 (5x5mm, 0.5mm - ESP32/ATmega)", nameAr: "QFN-32 (5×5مم، ESP32)", params: { pinCount: 32, pitch: 0.5, bodySize: 5.0, thermalPadSize: 3.5 } },
      { id: "qfn-48", name: "QFN-48 (7x7mm, 0.5mm)", nameAr: "QFN-48 (7×7مم)", params: { pinCount: 48, pitch: 0.5, bodySize: 7.0, thermalPadSize: 5.2 } },
    ],
    generate: (p) => generateQfn(p as QfnParams),
  },

  // 5. BGA
  bga: {
    id: "bga",
    name: "BGA",
    nameAr: "حزم BGA المصفوفية",
    category: "IC",
    categoryAr: "الدوائر المتكاملة",
    mounting: "SMD",
    defaultParams: {
      rows: 8,
      columns: 8,
      pitch: 0.8,
      padDiameter: 0.4,
    },
    presets: [
      { id: "bga-64", name: "BGA-64 (8x8 Grid, 0.8mm)", nameAr: "BGA-64 (مصفوفة 8×8)", params: { rows: 8, columns: 8, pitch: 0.8, padDiameter: 0.4 } },
      { id: "bga-100", name: "BGA-100 (10x10 Grid, 0.8mm)", nameAr: "BGA-100 (مصفوفة 10×10)", params: { rows: 10, columns: 10, pitch: 0.8, padDiameter: 0.4 } },
      { id: "bga-256", name: "BGA-256 (16x16 Grid, 1.0mm)", nameAr: "BGA-256 (مصفوفة 16×16)", params: { rows: 16, columns: 16, pitch: 1.0, padDiameter: 0.5 } },
    ],
    generate: (p) => generateBga(p as BgaParams),
  },

  // 6. Passives (R/C)
  passive: {
    id: "passive",
    name: "Passives (R/C)",
    nameAr: "العناصر الخاملة (مقاومات، مكثفات)",
    category: "Passive",
    categoryAr: "العناصر الخاملة",
    mounting: "Both",
    defaultParams: {
      categoryGroup: "resistor",
      packageType: "THT",
      mounting: "THT",
      componentType: "Resistor",
      subtype: "Axial_THT",
      packageSize: "Axial_DIN0207_P7.62mm",
      pitch: 7.62,
      bodyLength: 6.3,
      bodyDiameter: 2.4,
      drill: 0.8,
      padWidth: 1.8,
      reference: "R",
      value: "R_Axial_DIN0207_P7.62mm",
    },
    presets: [
      {
        id: "resistor-smd",
        name: "Resistor SMD",
        nameAr: "مقاومة سطحية (Resistor SMD)",
        description: "SMD Chip Resistors (01005, 0201, 0402, 0603, 0805, 1206, 1210, 1812, 2010, 2512)",
        params: {
          categoryGroup: "resistor",
          packageType: "SMD",
          componentType: "Resistor",
          subtype: "SMD_Chip",
          chipSize: "0805",
          reference: "R",
          value: "R_0805_2012Metric",
        },
      },
      {
        id: "resistor-tht",
        name: "Resistor THT",
        nameAr: "مقاومة محورية (Resistor THT)",
        description: "Through-Hole Axial Leaded Resistors (DIN 0204 to Power)",
        params: {
          categoryGroup: "resistor",
          packageType: "THT",
          componentType: "Resistor",
          subtype: "Axial_THT",
          packageSize: "Axial_DIN0207_P7.62mm",
          pitch: 7.62,
          bodyLength: 6.3,
          bodyDiameter: 2.4,
          drill: 0.8,
          padWidth: 1.8,
          reference: "R",
          value: "R_Axial_DIN0207_P7.62mm",
        },
      },
      {
        id: "capacitor-smd",
        name: "Capacitor SMD",
        nameAr: "مكثف سطحي (Capacitor SMD)",
        description: "SMD Ceramic MLCC & Tantalum Chip Capacitors (01005 to 2220 / EIA)",
        params: {
          categoryGroup: "capacitor",
          packageType: "SMD",
          componentType: "Capacitor",
          subtype: "SMD_Chip",
          chipSize: "0805",
          polarized: false,
          reference: "C",
          value: "C_0805_2012Metric",
        },
      },
      {
        id: "capacitor-tht-disc",
        name: "Capacitor THT Disc Ceramic",
        nameAr: "مكثف سيراميك قرصي (Disc Ceramic THT)",
        description: "Ceramic Disc Non-Polarized Capacitors (D4mm to D10mm)",
        params: {
          categoryGroup: "capacitor",
          packageType: "THT",
          componentType: "Capacitor",
          subtype: "Disc_THT",
          packageSize: "disc-d5-p2.54",
          pitch: 2.54,
          bodyDiameter: 5.0,
          drill: 0.8,
          padWidth: 1.6,
          polarized: false,
          reference: "C",
          value: "C_Disc_D5.0mm_W2.5mm_P2.54mm",
        },
      },
      {
        id: "capacitor-tht-radial",
        name: "Capacitor THT Electrolytic Radial",
        nameAr: "مكثف كيميائي قطبي (Radial Electrolytic THT)",
        description: "Radial Electrolytic Polarized Capacitors (D5mm to D18mm)",
        params: {
          categoryGroup: "capacitor",
          packageType: "THT",
          componentType: "Capacitor",
          subtype: "Radial_THT",
          packageSize: "radial-d8-p3.5",
          pitch: 3.5,
          bodyDiameter: 8.0,
          drill: 0.8,
          padWidth: 1.6,
          polarized: true,
          reference: "C",
          value: "CP_Radial_D8.0mm_P3.5mm",
        },
      },
      {
        id: "capacitor-tht-box",
        name: "Capacitor THT Box Film",
        nameAr: "مكثف فيلم/بوليستر (Box Film THT)",
        description: "Box Film Non-Polarized Capacitors (WIMA / Polyester)",
        params: {
          categoryGroup: "capacitor",
          packageType: "THT",
          componentType: "Capacitor",
          subtype: "Box_THT",
          packageSize: "film-l7.2-p5.0",
          pitch: 5.0,
          bodyLength: 7.2,
          bodyWidth: 3.5,
          drill: 0.8,
          padWidth: 1.6,
          polarized: false,
          reference: "C",
          value: "C_Film_L7.2mm_W3.5mm_P5.00mm",
        },
      },
      {
        id: "capacitor-tht",
        name: "Capacitor THT",
        nameAr: "مكثف أرجل (Capacitor THT)",
        description: "Radial Electrolytic, Ceramic Disc & Film Through-Hole Capacitors",
        params: {
          categoryGroup: "capacitor",
          packageType: "THT",
          componentType: "Capacitor",
          subtype: "Radial_THT",
          packageSize: "radial-d8-p3.5",
          pitch: 3.5,
          bodyDiameter: 8.0,
          drill: 0.8,
          padWidth: 1.6,
          polarized: true,
          reference: "C",
          value: "CP_Radial_D8.0mm_P3.5mm",
        },
      },
    ],
    generate: (p) => generatePassive(p as PassiveParams),
  },

  // 7. Pin Headers & Terminal Blocks
  connector: {
    id: "connector",
    name: "Pin Headers & Terminal Blocks",
    nameAr: "رؤوس التوصيل والمنافذ اللولبية",
    category: "Connector",
    categoryAr: "الموصلات",
    mounting: "THT",
    defaultParams: {
      rows: 1,
      pinCount: 4,
      pitch: 2.54,
      connectorType: "Header",
    },
    presets: [
      { id: "hdr-1x2", name: "Pin Header 1x2 (2.54mm)", nameAr: "رأس دبابيس 1×2 (2.54مم)", params: { rows: 1, pinCount: 2, pitch: 2.54, connectorType: "Header" } },
      { id: "hdr-1x3", name: "Pin Header 1x3 (2.54mm)", nameAr: "رأس دبابيس 1×3 (2.54مم)", params: { rows: 1, pinCount: 3, pitch: 2.54, connectorType: "Header" } },
      { id: "hdr-1x4", name: "Pin Header 1x4 (I2C / UART)", nameAr: "رأس دبابيس 1×4 (I2C / UART)", params: { rows: 1, pinCount: 4, pitch: 2.54, connectorType: "Header" } },
      { id: "hdr-1x6", name: "Pin Header 1x6 (FTDI / ISP)", nameAr: "رأس دبابيس 1×6 (FTDI / برمجة)", params: { rows: 1, pinCount: 6, pitch: 2.54, connectorType: "Header" } },
      { id: "hdr-1x8", name: "Pin Header 1x8 (Arduino Shield)", nameAr: "رأس دبابيس 1×8 (درع أردوينو)", params: { rows: 1, pinCount: 8, pitch: 2.54, connectorType: "Header" } },
      { id: "hdr-2x3", name: "Pin Header 2x3 (AVR ISP)", nameAr: "رأس دبابيس 2×3 (مقبس ISP)", params: { rows: 2, pinCount: 6, pitch: 2.54, rowSpacing: 2.54, connectorType: "Header" } },
      { id: "hdr-2x5", name: "Pin Header 2x5 (JTAG 10-Pin)", nameAr: "رأس دبابيس 2×5 (مقبس JTAG)", params: { rows: 2, pinCount: 10, pitch: 2.54, rowSpacing: 2.54, connectorType: "Header" } },
      { id: "tb-2p", name: "Terminal Block 2-Pin (5.08mm)", nameAr: "منفذ براغي 2 طرف (5.08مم)", params: { rows: 1, pinCount: 2, pitch: 5.08, connectorType: "TerminalBlock" } },
      { id: "tb-3p", name: "Terminal Block 3-Pin (5.08mm)", nameAr: "منفذ براغي 3 أطراف (5.08مم)", params: { rows: 1, pinCount: 3, pitch: 5.08, connectorType: "TerminalBlock" } },
      { id: "tb-4p", name: "Terminal Block 4-Pin (5.08mm)", nameAr: "منفذ براغي 4 أطراف (5.08مم)", params: { rows: 1, pinCount: 4, pitch: 5.08, connectorType: "TerminalBlock" } },
    ],
    generate: (p) => generateConnector(p as ConnectorParams),
  },

  // 8. Transistors & Power
  transistor: {
    id: "transistor",
    name: "Transistors & Power",
    nameAr: "الترانزستورات وحزم الطاقة",
    category: "Discrete",
    categoryAr: "العناصر المنفصلة",
    mounting: "Both",
    defaultParams: {
      packageType: "TO-92",
      packageSize: "TO-92",
      transistorType: "BJT",
      polarity: "NPN",
      mounting: "THT",
      reference: "Q",
      value: "2N2222",
    },
    presets: [
      { id: "transistor-tht", name: "Transistors THT (TO-92, TO-18, TO-39, TO-126)", nameAr: "ترانزستورات THT الثقبية", params: { packageType: "TO-92", packageSize: "TO-92", mounting: "THT", transistorType: "BJT", polarity: "NPN", value: "2N2222" } },
      { id: "power-tht", name: "Power THT (TO-220, TO-247, TO-3, TO-264)", nameAr: "حزم قدرة THT (TO-220 / TO-247 / TO-3)", params: { packageType: "TO-220", packageSize: "TO-220", mounting: "THT", transistorType: "Power Transistor", polarity: "NPN", value: "TIP120" } },
      { id: "transistor-smd", name: "Transistors SMD (SOT-23, SOT-223, SOT-89)", nameAr: "ترانزستورات SMD السطحية", params: { packageType: "SOT-23", packageSize: "SOT-23", mounting: "SMD", transistorType: "BJT", polarity: "NPN", value: "MMBT3904" } },
      { id: "power-smd", name: "Power SMD (DPAK, D2PAK, SO-8)", nameAr: "حزم قدرة SMD (DPAK / D2PAK)", params: { packageType: "DPAK", packageSize: "DPAK", mounting: "SMD", transistorType: "MOSFET", polarity: "N-Channel", value: "IRFR120N" } },
      { id: "to-92", name: "TO-92 (Classic BJT THT)", nameAr: "TO-92 (ترانزستور كلاسيكي ثقبي)", params: { packageType: "TO-92", packageSize: "TO-92", mounting: "THT", transistorType: "BJT", polarity: "NPN", value: "2N2222" } },
      { id: "to-220", name: "TO-220 (Power Tab THT)", nameAr: "TO-220 (حزمة قدرة ومشتت حراري)", params: { packageType: "TO-220", packageSize: "TO-220", mounting: "THT", transistorType: "MOSFET", polarity: "N-Channel", value: "IRF540N" } },
      { id: "to-247", name: "TO-247 (High Power THT)", nameAr: "TO-247 (قدرة فائقة ثقبية)", params: { packageType: "TO-247", packageSize: "TO-247", mounting: "THT", transistorType: "Power Transistor", polarity: "NPN", value: "TIP35C" } },
      { id: "sot-23", name: "SOT-23 (Small Signal SMD)", nameAr: "SOT-23 (إشارة صغيرة سطحي)", params: { packageType: "SOT-23", packageSize: "SOT-23", mounting: "SMD", transistorType: "BJT", polarity: "NPN", value: "MMBT3904" } },
      { id: "dpak", name: "DPAK / TO-252 (Power MOSFET SMD)", nameAr: "DPAK / TO-252 (موسفيت قدرة سطحي)", params: { packageType: "DPAK", packageSize: "DPAK", mounting: "SMD", transistorType: "MOSFET", polarity: "N-Channel", value: "IRFR120N" } },
    ],
    generate: (p) => generateTransistor(p as TransistorParams),
  },

  // 9. Diodes & LEDs
  diode: {
    id: "diode",
    name: "Diodes & LEDs",
    nameAr: "الدايودات والصمامات الثنائية المضيئة LEDs",
    category: "Discrete",
    categoryAr: "العناصر المنفصلة",
    mounting: "Both",
    defaultParams: {
      packageType: "DO-41",
      isLed: false,
      mounting: "THT",
    },
    presets: [
      { id: "diodes-smd", name: "Diodes SMD", nameAr: "Diodes SMD", params: { packageType: "SMA", isLed: false } },
      { id: "diodes-tht", name: "Diodes THT", nameAr: "Diodes THT", params: { packageType: "DO-41", isLed: false } },
      { id: "leds-smd", name: "LEDs SMD", nameAr: "LEDs SMD", params: { packageType: "0805", isLed: true } },
      { id: "leds-tht", name: "LEDs THT", nameAr: "LEDs THT", params: { packageType: "5mm", isLed: true } },
    ],
    generate: (p) => generateDiode(p as DiodeParams),
  },

  // 10. Crystals & Oscillators
  crystal: {
    id: "crystal",
    name: "Crystals & Oscillators",
    nameAr: "البلورات الكريستالية والمذبذبات",
    category: "Crystal",
    categoryAr: "المذبذبات",
    mounting: "Both",
    defaultParams: {
      packageType: "HC-49/US",
      mounting: "THT",
    },
    presets: [
      { id: "xtal-hc49", name: "HC-49/US (16MHz Arduino THT)", nameAr: "HC-49/US (كريستالة 16MHz ثقبية)", params: { packageType: "HC-49/US" } },
      { id: "xtal-hc49-smd", name: "HC-49/US SMD (Gullwing)", nameAr: "HC-49/US سطحي (أجنحة النورس)", params: { packageType: "HC-49/US_SMD" } },
      { id: "xtal-3225", name: "SMD 3225 4-Pad (3.2x2.5mm)", nameAr: "SMD 3225 (4 أطراف سطحية)", params: { packageType: "SMD-3225" } },
      { id: "xtal-5032", name: "SMD 5032 4-Pad (5.0x3.2mm)", nameAr: "SMD 5032 (4 أطراف سطحية)", params: { packageType: "SMD-5032" } },
      { id: "xtal-rtc", name: "Crystal Tuning Fork 32.768kHz (RTC)", nameAr: "كريستالة ساعة 32.768kHz أسطوانية", params: { packageType: "Cylinder_D2x6mm" } },
    ],
    generate: (p) => generateCrystal(p as CrystalParams),
  },

  // 11. Inductors & Ferrites
  inductor: {
    id: "inductor",
    name: "Inductors & Ferrites",
    nameAr: "الملفات وحلقات الفيريت",
    category: "Inductor",
    categoryAr: "الملفات والمحاثات",
    mounting: "Both",
    defaultParams: {
      packageType: "THT",
      mounting: "THT",
    },
    presets: [
      { id: "ind-smd", name: "SMD", nameAr: "سطحي (SMD)", params: { packageType: "SMD" } },
      { id: "ind-tht", name: "THT", nameAr: "ثقبي (THT)", params: { packageType: "THT" } },
      { id: "ind-power", name: "Power Inductor", nameAr: "ملف قدرة (Power Inductor)", params: { packageType: "Power Inductor" } },
      { id: "ind-ferrite", name: "Ferrite Bead", nameAr: "حلقة فيريت (Ferrite Bead)", params: { packageType: "Ferrite Bead" } },
      { id: "ind-cmc", name: "Common Mode Choke", nameAr: "خانق موحد الاتجاه (Common Mode Choke)", params: { packageType: "Common Mode Choke" } },
    ],
    generate: (p) => generateInductor(p as InductorParams),
  },

  // 12. Switches & Relays
  switch_relay: {
    id: "switch_relay",
    name: "Switches & Relays",
    nameAr: "المفاتيح والمرحلات (Relays)",
    category: "Switch",
    categoryAr: "المفاتيح والمرحلات",
    mounting: "Both",
    defaultParams: {
      packageType: "Tactile_6x6mm_THT",
      mounting: "THT",
    },
    presets: [
      { id: "sw-tact-6x6-tht", name: "Tactile Switch 6x6mm THT (Omron B3F)", nameAr: "زر لمس 6×6مم ثقبي", params: { packageType: "Tactile_6x6mm_THT" } },
      { id: "sw-tact-6x6-smd", name: "Tactile Switch 6x6mm SMD (Gullwing)", nameAr: "زر لمس 6×6مم سطحي", params: { packageType: "Tactile_6x6mm_SMD" } },
      { id: "sw-tact-12x12", name: "Tactile Switch 12x12mm THT", nameAr: "زر لمس 12×12مم ثقبي كبير", params: { packageType: "Tactile_12x12mm_THT" } },
      { id: "sw-slide-spdt", name: "Slide Switch SPDT 2.54mm (SS12D00)", nameAr: "مفتاح منزلق أحادي القطب 2.54مم", params: { packageType: "SlideSwitch_SPDT_P2.54mm" } },
      { id: "sw-dip-4p", name: "DIP Switch 4-Position Piano/Slide", nameAr: "مفتاح DIP رباعي 4 خيارات", params: { packageType: "DIP_Switch_4Pos" } },
      { id: "sw-dip-8p", name: "DIP Switch 8-Position Piano/Slide", nameAr: "مفتاح DIP ثماني 8 خيارات", params: { packageType: "DIP_Switch_8Pos" } },
      { id: "rly-srd", name: "Relay SPDT Songle SRD / Omron G5LE", nameAr: "مرحل أزرق قياسي Songle SRD 10A", params: { packageType: "Relay_SPDT_Songle_SRD" } },
      { id: "rly-telecom", name: "Relay DPDT Telecom Low-Signal 8-Pin", nameAr: "مرحل إشارة واتصالات DPDT 8-Pin", params: { packageType: "Relay_DPDT_Telecom" } },
    ],
    generate: (p) => generateSwitchRelay(p as SwitchRelayParams),
  },

  // 13. Fuses & Protection
  fuse_protection: {
    id: "fuse_protection",
    name: "Fuses & Protection",
    nameAr: "الصمامات وأجهزة الحماية",
    category: "Protection",
    categoryAr: "الحماية والصمامات",
    mounting: "Both",
    defaultParams: {
      packageType: "Fuseholder_5x20mm_THT",
      mounting: "THT",
    },
    presets: [
      { id: "fuse-1206", name: "PTC Resettable Polyfuse 1206 SMD", nameAr: "فيوز حراري مستعاد 1206 سطحي", params: { packageType: "Fuse_SMD_1206" } },
      { id: "fuse-1812", name: "PTC Resettable Polyfuse 1812 SMD", nameAr: "فيوز حراري مستعاد 1812 سطحي", params: { packageType: "Fuse_SMD_1812" } },
      { id: "fuse-2920", name: "PTC Resettable Polyfuse 2920 SMD (High Current)", nameAr: "فيوز حراري 2920 تيار عالي", params: { packageType: "Fuse_SMD_2920" } },
      { id: "fuse-5x20", name: "Fuseholder 5x20mm Cartridge THT", nameAr: "حامل فيوز زجاجي 5×20مم ثقبي", params: { packageType: "Fuseholder_5x20mm_THT" } },
      { id: "tvs-smaj", name: "TVS Diode SMAJ (400W Transient Suppressor)", nameAr: "دايود حماية فرط الجهد SMAJ 400W", params: { packageType: "TVS_SMAJ" } },
      { id: "tvs-smbj", name: "TVS Diode SMBJ (600W Transient Suppressor)", nameAr: "دايود حماية فرط الجهد SMBJ 600W", params: { packageType: "TVS_SMBJ" } },
      { id: "mov-7mm", name: "Varistor MOV 7mm Disc (P5.0mm)", nameAr: "فاريستور حماية الصواعق 7مم خطوة 5مم", params: { packageType: "Varistor_MOV_7mm_P5mm" } },
      { id: "mov-10mm", name: "Varistor MOV 10mm Disc (P7.5mm)", nameAr: "فاريستور حماية الصواعق 10مم خطوة 7.5مم", params: { packageType: "Varistor_MOV_10mm_P7.5mm" } },
      { id: "gdt-5mm", name: "Gas Discharge Tube (GDT) 2-Pin 5mm", nameAr: "أنبوب تفريغ غازي GDT مانع صواعق", params: { packageType: "GDT_2Pin_P5mm" } },
    ],
    generate: (p) => generateFuseProtection(p as FuseProtectionParams),
  },

  // 14. Potentiometers
  potentiometer: {
    id: "potentiometer",
    name: "Potentiometers",
    nameAr: "مقاومات متغيرة ومجزئات الجهد",
    category: "Potentiometer",
    categoryAr: "مقاومات متغيرة",
    mounting: "Both",
    defaultParams: {
      packageType: "Potentiometer_Trimmer_3362P",
      mounting: "THT",
    },
    presets: [
      { id: "pot-3362p", name: "Trimmer 3362P (Square Top-Adjust In-Line)", nameAr: "مقاومة ضبط 3362P صف واحد 2.54مم", params: { packageType: "Potentiometer_Trimmer_3362P" } },
      { id: "pot-3296w", name: "Trimmer 3296W (Multi-Turn Precision)", nameAr: "مقاومة ضبط دقيقة متعددة الدورات 3296W", params: { packageType: "Potentiometer_Trimmer_3296W" } },
      { id: "pot-alpha16", name: "Rotary Potentiometer Alpha 16mm Panel Mount", nameAr: "مقاومة دائرية Alpha 16مم مع سنادة", params: { packageType: "Potentiometer_Rotary_Alpha16mm" } },
      { id: "pot-3314g", name: "Bourns 3314G SMD 4.5mm Micro Trimmer", nameAr: "مقاومة ضبط دقيقة 3314G سطحية", params: { packageType: "Potentiometer_Bourns_3314G_SMD" } },
      { id: "pot-slide30", name: "Slide Potentiometer 30mm Travel Fader", nameAr: "مقاومة منزلقة فادر 30مم", params: { packageType: "Potentiometer_Slide_30mm" } },
    ],
    generate: (p) => generatePotentiometer(p as PotentiometerParams),
  },

  // 15. Optocouplers
  optocoupler: {
    id: "optocoupler",
    name: "Optocouplers",
    nameAr: "العوازل الضوئية (Optocouplers)",
    category: "Optocoupler",
    categoryAr: "العوازل الضوئية",
    mounting: "Both",
    defaultParams: {
      packageType: "Optocoupler_DIP-4",
      mounting: "THT",
    },
    presets: [
      { id: "opto-dip4", name: "Optocoupler DIP-4 (PC817 / EL817)", nameAr: "عازل ضوئي DIP-4 (PC817)", params: { packageType: "Optocoupler_DIP-4" } },
      { id: "opto-smd4", name: "Optocoupler SMD-4 (PC817S Gullwing)", nameAr: "عازل ضوئي سطحي SMD-4 (PC817S)", params: { packageType: "Optocoupler_SMD-4" } },
      { id: "opto-dip6", name: "Optocoupler DIP-6 (4N25 / 4N35 / MOC3021)", nameAr: "عازل ضوئي DIP-6 (4N35 / MOC3021)", params: { packageType: "Optocoupler_DIP-6" } },
      { id: "opto-smd6", name: "Optocoupler SMD-6 (4N35S Gullwing)", nameAr: "عازل ضوئي سطحي SMD-6 (4N35S)", params: { packageType: "Optocoupler_SMD-6" } },
      { id: "opto-dip8", name: "Optocoupler DIP-8 (6N137 High-Speed)", nameAr: "عازل ضوئي سريع DIP-8 (6N137)", params: { packageType: "Optocoupler_DIP-8" } },
      { id: "opto-soic4", name: "Optocoupler SOIC-4 / SOP-4 (TLP291)", nameAr: "عازل ضوئي فائق الصغر SOIC-4", params: { packageType: "Optocoupler_SOIC-4" } },
      { id: "opto-soic8", name: "Optocoupler SOIC-8 Dual Channel", nameAr: "عازل ضوئي مزدوج SOIC-8", params: { packageType: "Optocoupler_SOIC-8" } },
    ],
    generate: (p) => generateOptocoupler(p as OptocouplerParams),
  },

  // 16. Connectors & Interfaces
  connector_interface: {
    id: "connector_interface",
    name: "Connectors & Interfaces",
    nameAr: "المنافذ والموصلات (USB/RJ45/Jack)",
    category: "Connector",
    categoryAr: "منافذ الواجهات",
    mounting: "Both",
    defaultParams: {
      packageType: "JST_XH_2Pin_2.54mm",
      mounting: "THT",
    },
    presets: [
      { id: "usb-c-16p", name: "USB Type-C Receptacle 16-Pin (SMD+THT)", nameAr: "منفذ يو إس بي نوع سي 16 طرف", params: { packageType: "USB_C_Receptacle_16Pin" } },
      { id: "usb-a-female", name: "USB Type-A Female Receptacle Horizontal THT", nameAr: "منفذ USB-A أنثى أفقي ثقبي", params: { packageType: "USB_A_Receptacle_Female_THT" } },
      { id: "usb-micro-b", name: "Micro-USB Type-B 5-Pin Receptacle SMD", nameAr: "منفذ مايكرو يو إس بي Micro-B سطحي", params: { packageType: "Micro_USB_B_Receptacle_SMD" } },
      { id: "dc-barrel-jack", name: "DC Power Barrel Jack 2.1mm (PJ-002A)", nameAr: "مقبس تغذية تيار مستمر 2.1مم PJ-002A", params: { packageType: "BarrelJack_DC_2.1mm_PJ002A" } },
      { id: "rj45-magjack", name: "RJ45 MagJack 8P8C Integrated Magnetics", nameAr: "منفذ شبكة إيثرنت RJ45 مع محول مغناطيسي", params: { packageType: "RJ45_MagJack_Ethernet_8P" } },
      { id: "jst-xh-2p", name: "JST-XH 2-Pin 2.54mm Shrouded Header", nameAr: "موصل JST-XH 2 طرف 2.54مم", params: { packageType: "JST_XH_2Pin_2.54mm" } },
      { id: "jst-xh-3p", name: "JST-XH 3-Pin 2.54mm Shrouded Header", nameAr: "موصل JST-XH 3 أطراف 2.54مم", params: { packageType: "JST_XH_3Pin_2.54mm" } },
      { id: "jst-xh-4p", name: "JST-XH 4-Pin 2.54mm Shrouded Header", nameAr: "موصل JST-XH 4 أطراف 2.54مم", params: { packageType: "JST_XH_4Pin_2.54mm" } },
      { id: "jst-ph-2p", name: "JST-PH 2-Pin 2.00mm (LiPo Battery)", nameAr: "موصل بطارية ليثيوم JST-PH 2.0مم", params: { packageType: "JST_PH_2Pin_2.00mm" } },
      { id: "audio-jack-35", name: "Audio Jack 3.5mm Stereo TRRS (SJ-43514)", nameAr: "مقبس صوت ستيريو 3.5مم TRRS", params: { packageType: "AudioJack_3.5mm_SJ43514" } },
    ],
    generate: (p) => generateConnectorInterface(p as ConnectorInterfaceParams),
  },

  // 17. Displays
  display: {
    id: "display",
    name: "Displays",
    nameAr: "الشاشات ووسائل العرض",
    category: "Display",
    categoryAr: "شاشات العرض",
    mounting: "THT",
    defaultParams: {
      packageType: "Display_OLED_0.96_I2C_4Pin",
    },
    presets: [
      { id: "oled-096-i2c", name: "OLED 0.96 inch 128x64 I2C 4-Pin Header", nameAr: "شاشة أوليد 0.96 بوصة I2C بأربعة أطراف", params: { packageType: "Display_OLED_0.96_I2C_4Pin" } },
      { id: "oled-13-spi", name: "OLED 1.3 inch 128x64 SPI 7-Pin Header", nameAr: "شاشة أوليد 1.3 بوصة SPI بسبعة أطراف", params: { packageType: "Display_OLED_1.3_SPI_7Pin" } },
      { id: "7seg-1d", name: "7-Segment Display 1-Digit 0.56 inch 10-Pin", nameAr: "شاشة سباعية رقم واحد 0.56 بوصة", params: { packageType: "Display_7Segment_1Digit_10Pin" } },
      { id: "7seg-4d", name: "7-Segment Display 4-Digit 0.56 inch 12-Pin", nameAr: "شاشة سباعية 4 أرقام 0.56 بوصة", params: { packageType: "Display_7Segment_4Digit_12Pin" } },
      { id: "lcd-1602", name: "LCD 1602 Parallel 16-Pin Header (80x36mm)", nameAr: "شاشة حرفية LCD1602 ستة عشر طرفاً", params: { packageType: "Display_LCD1602_Parallel_16Pin" } },
      { id: "tft-24-spi", name: "TFT 2.4 inch Color SPI ILI9341 14-Pin Header", nameAr: "شاشة ملونة TFT 2.4 بوصة SPI", params: { packageType: "Display_TFT_2.4_SPI_14Pin" } },
    ],
    generate: (p) => generateDisplay(p as DisplayParams),
  },

  // 18. Sensors
  sensor: {
    id: "sensor",
    name: "Sensors",
    nameAr: "المستشعرات والحساسات",
    category: "Sensor",
    categoryAr: "المستشعرات",
    mounting: "Both",
    defaultParams: {
      packageType: "Sensor_DHT11_DHT22_4Pin",
      mounting: "THT",
    },
    presets: [
      { id: "sens-dht11", name: "DHT11 / DHT22 Humidity & Temp Sensor 4-Pin", nameAr: "مستشعر حرارة ورطوبة DHT11/DHT22", params: { packageType: "Sensor_DHT11_DHT22_4Pin" } },
      { id: "sens-hcsr04", name: "HC-SR04 Ultrasonic Distance Sensor 4-Pin", nameAr: "مستشعر مسافة بالموجات فوق الصوتية HC-SR04", params: { packageType: "Sensor_HCSR04_Ultrasonic_4Pin" } },
      { id: "sens-hcsr501", name: "HC-SR501 PIR Infrared Motion Sensor 3-Pin", nameAr: "مستشعر حركة بالأشعة تحت الحمراء PIR", params: { packageType: "Sensor_HCSR501_PIR_3Pin" } },
      { id: "sens-hall", name: "Hall Effect Sensor TO-92 3-Pin (A3144)", nameAr: "مستشعر مغناطيسي تأثير هول A3144", params: { packageType: "Sensor_Hall_Effect_TO92_3Pin" } },
      { id: "sens-bme280-smd", name: "BME280 / BMP280 Pressure Sensor LGA-8 SMD", nameAr: "مستشعر ضغط جوي BME280 سطحي LGA-8", params: { packageType: "Sensor_BME280_BMP280_SMD" } },
      { id: "sens-bme280-mod", name: "BME280 Breakout Module 6-Pin Header", nameAr: "لوحة مستشعر BME280 سداسية الأطراف", params: { packageType: "Sensor_BME280_Module_6Pin" } },
      { id: "sens-mpu6050", name: "MPU-6050 (GY-521) 6-Axis IMU Module 8-Pin", nameAr: "مستشعر حركة وتسارع 6 محاور MPU-6050", params: { packageType: "Sensor_MPU6050_Module_8Pin" } },
      { id: "sens-ldr", name: "Light Dependent Resistor (LDR) 5mm Radial", nameAr: "مستشعر ضوء LDR مقاومة ضوئية 5مم", params: { packageType: "Sensor_LDR_5mm_Radial" } },
    ],
    generate: (p) => generateSensor(p as SensorParams),
  },

  // 19. RF & Antennas
  rf_antenna: {
    id: "rf_antenna",
    name: "RF & Antennas",
    nameAr: "الهوائيات والترددات الراديوية RF",
    category: "RF",
    categoryAr: "الهوائيات والترددات الراديوية",
    mounting: "Both",
    defaultParams: {
      packageType: "SMA_Vertical_THT",
      mounting: "THT",
    },
    presets: [
      { id: "rf-sma-edge", name: "SMA Edge Mount Female RF Jack 1.6mm", nameAr: "موصل SMA طرفي أفقي لحافة اللوحة 1.6مم", params: { packageType: "SMA_Edge_Mount_Jack" } },
      { id: "rf-sma-vert", name: "SMA Vertical Female RF Jack 5.08mm THT", nameAr: "موصل SMA عمودي ثقبي 5.08مم", params: { packageType: "SMA_Vertical_THT" } },
      { id: "rf-ufl", name: "Hirose U.FL / IPEX SMT Micro Coaxial Receptacle", nameAr: "مقبس كواكسيل ميكرو U.FL / IPEX سطحي", params: { packageType: "U.FL_IPEX_SMT" } },
      { id: "ant-24ghz-ifa", name: "Antenna 2.4GHz Inverted-F (IFA) PCB Trace", nameAr: "هوائي مطبوع 2.4GHz IFA على اللوحة", params: { packageType: "Antenna_2.4GHz_IFA_PCB" } },
      { id: "ant-helical", name: "Antenna Helical Spring Wire 1-Pin THT", nameAr: "هوائي سلكي زنبركي حلزوني طرف واحد", params: { packageType: "Antenna_Helical_Wire_1Pin" } },
      { id: "mod-nrf24", name: "NRF24L01+ 2.4GHz Transceiver Socket 2x4 Header", nameAr: "مقبس موديول لاسلكي NRF24L01+ 2×4", params: { packageType: "Module_NRF24L01_Header_2x4" } },
    ],
    generate: (p) => generateRfAntenna(p as RfAntennaParams),
  },

  // 20. Modules
  modules: {
    id: "modules",
    name: "Modules",
    nameAr: "الوحدات النمطية والمتحكمات",
    category: "Module",
    categoryAr: "الوحدات الجاهزة",
    mounting: "Both",
    defaultParams: {
      packageType: "Module_Arduino_Nano_Header",
      mounting: "THT",
    },
    presets: [
      { id: "mod-esp32", name: "ESP32-WROOM-32 Wi-Fi/BLE Module 38-Pad SMD", nameAr: "وحدة واي فاي وبلوتوث ESP32-WROOM-32", params: { packageType: "Module_ESP32_WROOM_32" } },
      { id: "mod-nano", name: "Arduino Nano Development Board 2x15 Header", nameAr: "لوحة أردوينو نانو صفين 15 طرف", params: { packageType: "Module_Arduino_Nano_Header" } },
      { id: "mod-pico", name: "Raspberry Pi Pico RP2040 Module 40-Pin", nameAr: "لوحة راسبيري باي بيكو RP2040 40 طرف", params: { packageType: "Module_RaspberryPi_Pico" } },
      { id: "mod-lm2596", name: "LM2596 DC-DC Buck Converter Module THT", nameAr: "وحدة تخفيض الجهد LM2596 DC-DC", params: { packageType: "Module_Buck_LM2596" } },
      { id: "mod-mini360", name: "Mini-360 Ultra-Small Synchronous Buck Module SMD", nameAr: "وحدة تخفيض الجهد فائقة الصغر Mini-360", params: { packageType: "Module_Buck_Mini360" } },
      { id: "mod-tp4056", name: "TP4056 Li-Ion Battery Charger Module Type-C", nameAr: "وحدة شحن بطاريات الليثيوم TP4056", params: { packageType: "Module_TP4056_Charger" } },
    ],
    generate: (p) => generateModules(p as ModulesParams),
  },

  // 21. Test & Mechanical
  test_mechanical: {
    id: "test_mechanical",
    name: "Test & Mechanical",
    nameAr: "نقاط الاختبار وثقوب التثبيت",
    category: "Mechanical",
    categoryAr: "الميكانيكا والاختبار",
    mounting: "Both",
    defaultParams: {
      packageType: "TestPoint_Keystone_5000_THT",
      mounting: "THT",
    },
    presets: [
      { id: "tp-key5000", name: "Test Point Keystone 5000 Loop THT", nameAr: "نقطة اختبار حلقة سلكية Keystone 5000", params: { packageType: "TestPoint_Keystone_5000_THT" } },
      { id: "tp-key5015", name: "Test Point Keystone 5015 Loop SMD", nameAr: "نقطة اختبار حلقة سطحية Keystone 5015", params: { packageType: "TestPoint_Keystone_5015_SMD" } },
      { id: "tp-pad-10", name: "Test Point Pad D1.0mm SMD (Pogo / Probe)", nameAr: "وسادة اختبار دائرية قطر 1.0مم للمجسات", params: { packageType: "TestPoint_Pad_1.0mm_SMD" } },
      { id: "tp-pad-15", name: "Test Point Pad D1.5mm SMD", nameAr: "وسادة اختبار دائرية قطر 1.5مم", params: { packageType: "TestPoint_Pad_1.5mm_SMD" } },
      { id: "hole-m25", name: "Mounting Hole M2.5 (2.7mm Drill NPTH)", nameAr: "ثقب تثبيت برغي M2.5 غير مطلي", params: { packageType: "MountingHole_M2.5" } },
      { id: "hole-m3", name: "Mounting Hole M3 (3.2mm Drill NPTH)", nameAr: "ثقب تثبيت برغي M3 غير مطلي", params: { packageType: "MountingHole_M3" } },
      { id: "hole-m3-gnd", name: "Mounting Hole M3 Plated Grounded with Vias", nameAr: "ثقب تثبيت M3 متصل بالأرضي مع حزام فياز", params: { packageType: "MountingHole_M3_Plated_Ground" } },
      { id: "hole-m4", name: "Mounting Hole M4 (4.3mm Drill NPTH)", nameAr: "ثقب تثبيت برغي M4 غير مطلي", params: { packageType: "MountingHole_M4" } },
      { id: "fid-10", name: "Optical Alignment Fiducial Mark D1.0mm", nameAr: "علامة محاذاة بصرية فيدوشال 1.0مم", params: { packageType: "Fiducial_1.0mm_Round" } },
      { id: "fid-15", name: "Optical Alignment Fiducial Mark D1.5mm", nameAr: "علامة محاذاة بصرية فيدوشال 1.5مم", params: { packageType: "Fiducial_1.5mm_Round" } },
    ],
    generate: (p) => generateTestMechanical(p as TestMechanicalParams),
  },

  // 22. Batteries & Power
  batteries_power: {
    id: "batteries_power",
    name: "Batteries & Power",
    nameAr: "البطاريات وموصلات التغذية",
    category: "Power",
    categoryAr: "البطاريات والطاقة",
    mounting: "Both",
    defaultParams: {
      packageType: "Battery_CR2032_THT_Keystone3002",
      mounting: "THT",
    },
    presets: [
      { id: "bat-cr2032-smd", name: "Battery Holder CR2032 SMD (Keystone 1058)", nameAr: "حامل بطارية قرصية CR2032 سطحي", params: { packageType: "Battery_CR2032_SMD_Keystone1058" } },
      { id: "bat-cr2032-tht", name: "Battery Retainer CR2032 THT (Keystone 3002)", nameAr: "حامل بطارية قرصية CR2032 ثقبي", params: { packageType: "Battery_CR2032_THT_Keystone3002" } },
      { id: "bat-18650", name: "Battery Holder 18650 Li-Ion Single Cell THT", nameAr: "حامل بطارية ليثيوم 18650 خلية واحدة ثقبي", params: { packageType: "Battery_18650_Holder_Keystone1042" } },
      { id: "bat-aa", name: "Battery Holder 1xAA 1.5V THT (Keystone 2460)", nameAr: "حامل بطارية قلم 1xAA ثقبي", params: { packageType: "Battery_AA_Holder_Keystone2460" } },
      { id: "bat-aaa", name: "Battery Holder 1xAAA 1.5V THT (Keystone 2466)", nameAr: "حامل بطارية ريموت 1xAAA ثقبي", params: { packageType: "Battery_AAA_Holder_Keystone2466" } },
      { id: "conn-xt60", name: "Connector Amass XT60 High Power 60A THT", nameAr: "موصل تيار عالي Amass XT60 60A", params: { packageType: "Connector_Power_XT60_THT" } },
      { id: "conn-xt30", name: "Connector Amass XT30 High Power 30A THT", nameAr: "موصل تيار عالي Amass XT30 30A", params: { packageType: "Connector_Power_XT30_THT" } },
    ],
    generate: (p) => generateBatteriesPower(p as BatteriesPowerParams),
  },
};

export function getFootprintFamily(familyId: string): FootprintFamilyDefinition | undefined {
  return FOOTPRINT_FAMILIES[familyId.toLowerCase()];
}

export function getAllFootprintFamilies(): FootprintFamilyDefinition[] {
  return Object.values(FOOTPRINT_FAMILIES);
}
