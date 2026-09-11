import type { KicadFootprintModel, KicadFootprintPad, KicadFootprintGraphic } from "../../footprint";
import { createSmdPad, createThtPad } from "../core/pads";
import { createSilkLine, createSilkCircle } from "../core/silk";
import { createFabRect, createFabCircle } from "../core/fab";
import { createCourtyardRect, createCourtyardCircle } from "../core/courtyard";
import { createReferenceText, createValueText } from "../core/text";
import { createCapNegativeBand, createPolarityPlus } from "../core/polarity";
import { buildNativeFootprintModel } from "../rules/kicad";
import { IPC_PASSIVES } from "../rules/ipc";
import { KLC_RULES } from "../rules/klc";

export type PassivePackageType =
  | "SMD_Chip"
  | "SMD_Tantalum"
  | "SMD_Array"
  | "SMD_Trimmer"
  | "Axial_THT"
  | "Radial_THT"
  | "Disc_THT"
  | "Box_THT"
  | "Cement_THT"
  | "Potentiometer_THT"
  | "SIP_Network_THT";

export interface PassiveParams {
  categoryGroup?: "resistor" | "capacitor";
  packageType?: "SMD" | "THT";
  subtype?: PassivePackageType;
  technologyType?: string;
  chipSize?: string;
  packageSize?: string;
  pitch?: number;        // center-to-center distance for SMD / lead spacing for THT
  padWidth?: number;     // pad length in X
  padHeight?: number;    // pad width in Y
  drill?: number;        // for THT (e.g. 0.8mm)
  bodyDiameter?: number; // for Radial / Disc Cap or Axial Resistor
  bodyLength?: number;   // for Axial Resistor or Box Film Cap
  bodyWidth?: number;    // for Box Film Cap
  pinCount?: number;     // for SIP / Arrays / Pots
  polarized?: boolean;   // true for electrolytic & tantalum caps
  componentType?: "Resistor" | "Capacitor" | "Inductor";
  orientation?: "horizontal" | "vertical";
  reference?: string;
  value?: string;
}

export const CHIP_METRIC_NAMES: Record<string, string> = {
  "01005": "0402Metric",
  "0201": "0603Metric",
  "0402": "1005Metric",
  "0603": "1608Metric",
  "0805": "2012Metric",
  "1206": "3216Metric",
  "1210": "3225Metric",
  "1806": "4516Metric",
  "1812": "4532Metric",
  "2010": "5025Metric",
  "2220": "5750Metric",
  "2512": "6332Metric",
  "2712": "7032Metric",
  "2920": "7550Metric",
};

export interface ResistorPackageItem {
  id: string;
  name: string;
  nameAr?: string;
  techType: "metal-film" | "carbon-film" | "power" | "shunt" | "pot" | "network";
  pitch: number;
  padWidth: number;
  padHeight?: number;
  bodyLength?: number;
  bodyWidth?: number;
  bodyDiameter?: number;
  drill?: number;
  pinCount?: number;
  subtype?: PassivePackageType;
}

export const STANDARD_SMD_RESISTOR_SIZES: ResistorPackageItem[] = [
  // 1. Metal Film (General Purpose & Precision 1%)
  { id: "01005", name: "01005 (0402 Metric - 0.40 × 0.20 mm - 1%)", nameAr: "01005 (0402 متري - 0.40 × 0.20 مم)", techType: "metal-film", pitch: 0.35, padWidth: 0.20, padHeight: 0.22, bodyLength: 0.40, bodyWidth: 0.20, subtype: "SMD_Chip" },
  { id: "0201", name: "0201 (0603 Metric - 0.60 × 0.30 mm - 1%)", nameAr: "0201 (0603 متري - 0.60 × 0.30 مم)", techType: "metal-film", pitch: 0.55, padWidth: 0.35, padHeight: 0.35, bodyLength: 0.60, bodyWidth: 0.30, subtype: "SMD_Chip" },
  { id: "0402", name: "0402 (1005 Metric - 1.00 × 0.50 mm - 1%)", nameAr: "0402 (1005 متري - 1.00 × 0.50 مم)", techType: "metal-film", pitch: 0.95, padWidth: 0.55, padHeight: 0.60, bodyLength: 1.00, bodyWidth: 0.50, subtype: "SMD_Chip" },
  { id: "0603", name: "0603 (1608 Metric - 1.60 × 0.80 mm - 1%)", nameAr: "0603 (1608 متري - 1.60 × 0.80 مم)", techType: "metal-film", pitch: 1.60, padWidth: 0.80, padHeight: 0.90, bodyLength: 1.60, bodyWidth: 0.80, subtype: "SMD_Chip" },
  { id: "0805", name: "0805 (2012 Metric - 2.00 × 1.25 mm - 1%)", nameAr: "0805 (2012 متري - 2.00 × 1.25 مم)", techType: "metal-film", pitch: 1.90, padWidth: 1.00, padHeight: 1.30, bodyLength: 2.00, bodyWidth: 1.25, subtype: "SMD_Chip" },
  { id: "1206", name: "1206 (3216 Metric - 3.20 × 1.60 mm - 1%)", nameAr: "1206 (3216 متري - 3.20 × 1.60 مم)", techType: "metal-film", pitch: 3.00, padWidth: 1.10, padHeight: 1.70, bodyLength: 3.20, bodyWidth: 1.60, subtype: "SMD_Chip" },
  { id: "1210", name: "1210 (3225 Metric - 3.20 × 2.50 mm - 1%)", nameAr: "1210 (3225 متري - 3.20 × 2.50 مم)", techType: "metal-film", pitch: 3.00, padWidth: 1.10, padHeight: 2.60, bodyLength: 3.20, bodyWidth: 2.50, subtype: "SMD_Chip" },

  // 2. Carbon Film (Standard 5%)
  { id: "0402-cf", name: "0402 Carbon (1005 Metric - 1.00 × 0.50 mm - 5%)", nameAr: "0402 كربون (1005 متري - 5%)", techType: "carbon-film", pitch: 0.95, padWidth: 0.55, padHeight: 0.60, bodyLength: 1.00, bodyWidth: 0.50, subtype: "SMD_Chip" },
  { id: "0603-cf", name: "0603 Carbon (1608 Metric - 1.60 × 0.80 mm - 5%)", nameAr: "0603 كربون (1608 متري - 5%)", techType: "carbon-film", pitch: 1.60, padWidth: 0.80, padHeight: 0.90, bodyLength: 1.60, bodyWidth: 0.80, subtype: "SMD_Chip" },
  { id: "0805-cf", name: "0805 Carbon (2012 Metric - 2.00 × 1.25 mm - 5%)", nameAr: "0805 كربون (2012 متري - 5%)", techType: "carbon-film", pitch: 1.90, padWidth: 1.00, padHeight: 1.30, bodyLength: 2.00, bodyWidth: 1.25, subtype: "SMD_Chip" },
  { id: "1206-cf", name: "1206 Carbon (3216 Metric - 3.20 × 1.60 mm - 5%)", nameAr: "1206 كربون (3216 متري - 5%)", techType: "carbon-film", pitch: 3.00, padWidth: 1.10, padHeight: 1.70, bodyLength: 3.20, bodyWidth: 1.60, subtype: "SMD_Chip" },
  { id: "1210-cf", name: "1210 Carbon (3225 Metric - 3.20 × 2.50 mm - 5%)", nameAr: "1210 كربون (3225 متري - 5%)", techType: "carbon-film", pitch: 3.00, padWidth: 1.10, padHeight: 2.60, bodyLength: 3.20, bodyWidth: 2.50, subtype: "SMD_Chip" },

  // 3. Power Resistor (High Wattage SMD)
  { id: "1812", name: "1812 Power (4532 Metric - 4.50 × 3.20 mm - 0.75W)", nameAr: "1812 قدرة (4532 متري - 0.75W)", techType: "power", pitch: 4.30, padWidth: 1.20, padHeight: 3.40, bodyLength: 4.50, bodyWidth: 3.20, subtype: "SMD_Chip" },
  { id: "2010", name: "2010 Power (5025 Metric - 5.00 × 2.50 mm - 1.0W)", nameAr: "2010 قدرة (5025 متري - 1.0W)", techType: "power", pitch: 4.80, padWidth: 1.30, padHeight: 2.70, bodyLength: 5.00, bodyWidth: 2.50, subtype: "SMD_Chip" },
  { id: "2512", name: "2512 Power (6332 Metric - 6.30 × 3.20 mm - 2.0W)", nameAr: "2512 قدرة (6332 متري - 2.0W)", techType: "power", pitch: 6.10, padWidth: 1.40, padHeight: 3.40, bodyLength: 6.30, bodyWidth: 3.20, subtype: "SMD_Chip" },
  { id: "2712", name: "2712 Power (7032 Metric - 7.00 × 3.20 mm - 2.5W)", nameAr: "2712 قدرة (7032 متري - 2.5W)", techType: "power", pitch: 6.80, padWidth: 1.50, padHeight: 3.40, bodyLength: 7.00, bodyWidth: 3.20, subtype: "SMD_Chip" },
  { id: "2920", name: "2920 Power (7550 Metric - 7.50 × 5.00 mm - 3.0W)", nameAr: "2920 قدرة (7550 متري - 3.0W)", techType: "power", pitch: 7.30, padWidth: 1.60, padHeight: 5.30, bodyLength: 7.50, bodyWidth: 5.00, subtype: "SMD_Chip" },

  // 4. Current Shunt (Low-Ohm Sensing)
  { id: "shunt-1206", name: "1206 Shunt (3216 Metric - 0.05Ω Sense)", nameAr: "1206 شنت تحسس تيار (0.05Ω)", techType: "shunt", pitch: 3.00, padWidth: 1.20, padHeight: 1.80, bodyLength: 3.20, bodyWidth: 1.60, subtype: "SMD_Chip" },
  { id: "shunt-2010", name: "2010 Shunt (5025 Metric - 0.02Ω 1W)", nameAr: "2010 شنت تحسس تيار (0.02Ω 1W)", techType: "shunt", pitch: 4.80, padWidth: 1.40, padHeight: 2.80, bodyLength: 5.00, bodyWidth: 2.50, subtype: "SMD_Chip" },
  { id: "shunt-2512", name: "2512 Shunt (6332 Metric - 0.01Ω 2W)", nameAr: "2512 شنت تحسس تيار (0.01Ω 2W)", techType: "shunt", pitch: 6.10, padWidth: 1.60, padHeight: 3.60, bodyLength: 6.30, bodyWidth: 3.20, subtype: "SMD_Chip" },
  { id: "shunt-2712", name: "2712 Shunt (7032 Metric - 0.005Ω 3W)", nameAr: "2712 شنت تحسس فائق الدقة (3W)", techType: "shunt", pitch: 6.80, padWidth: 1.80, padHeight: 3.60, bodyLength: 7.00, bodyWidth: 3.20, subtype: "SMD_Chip" },
  { id: "shunt-2920", name: "2920 Shunt (7550 Metric - 0.001Ω 5W)", nameAr: "2920 شنت تحسس قدرة عالية (5W)", techType: "shunt", pitch: 7.30, padWidth: 2.00, padHeight: 5.40, bodyLength: 7.50, bodyWidth: 5.00, subtype: "SMD_Chip" },

  // 5. Trimmer / Potentiometer
  { id: "pot-smd-tc33", name: "TC33 (Bourns 3.8 × 3.6 mm SMD Trimmer)", nameAr: "TC33 مقاومة متغيرة سطحية (3.8×3.6 مم)", techType: "pot", pitch: 2.50, padWidth: 1.20, padHeight: 1.20, bodyLength: 3.80, bodyWidth: 3.60, subtype: "SMD_Trimmer", pinCount: 3 },
  { id: "pot-smd-3314g", name: "Bourns 3314G (4.5 × 4.5 mm SMD Trimmer)", nameAr: "Bourns 3314G مقاومة متغيرة (4.5×4.5 مم)", techType: "pot", pitch: 2.54, padWidth: 1.40, padHeight: 1.30, bodyLength: 4.50, bodyWidth: 4.50, subtype: "SMD_Trimmer", pinCount: 3 },
  { id: "pot-smd-3314j", name: "Bourns 3314J (4.5 × 4.5 mm J-Lead Trimmer)", nameAr: "Bourns 3314J أرجل J-Lead (4.5×4.5 مم)", techType: "pot", pitch: 2.54, padWidth: 1.40, padHeight: 1.30, bodyLength: 4.50, bodyWidth: 4.50, subtype: "SMD_Trimmer", pinCount: 3 },

  // 6. Resistor Array (Network)
  { id: "array-0402x4", name: "0402×4 Array (0804 Metric - 8-Pad Convex)", nameAr: "مصفوفة 0402×4 (8 وسادات محدبة)", techType: "network", pitch: 0.50, padWidth: 0.30, padHeight: 0.45, bodyLength: 2.00, bodyWidth: 1.00, subtype: "SMD_Array", pinCount: 8 },
  { id: "array-0603x4", name: "0603×4 Array (1206 Metric - 8-Pad Convex)", nameAr: "مصفوفة 0603×4 (8 وسادات محدبة)", techType: "network", pitch: 0.80, padWidth: 0.45, padHeight: 0.70, bodyLength: 3.20, bodyWidth: 1.60, subtype: "SMD_Array", pinCount: 8 },
  { id: "array-0805x4", name: "0805×4 Array (1608 Metric - 8-Pad Concave)", nameAr: "مصفوفة 0805×4 (8 وسادات مقعرة)", techType: "network", pitch: 1.27, padWidth: 0.65, padHeight: 0.90, bodyLength: 5.10, bodyWidth: 2.20, subtype: "SMD_Array", pinCount: 8 },
  { id: "array-1206x4", name: "1206×4 Array (2512 Metric - 8-Pad Convex)", nameAr: "مصفوفة 1206×4 (8 وسادات قدرة)", techType: "network", pitch: 1.27, padWidth: 0.70, padHeight: 1.20, bodyLength: 6.40, bodyWidth: 3.20, subtype: "SMD_Array", pinCount: 8 },
];

export const QUICK_STANDARD_THT_RESISTOR_PACKAGES: ResistorPackageItem[] = [
  // 1. Metal Film (General Purpose & Precision 1%)
  { id: "axial-0204", name: "Axial DIN0204 (1/8W 1% P5.08mm)", nameAr: "0204 محورية (1/8W 1% مسافة 5.08مم)", techType: "metal-film", pitch: 5.08, bodyLength: 3.6, bodyDiameter: 1.6, drill: 0.7, padWidth: 1.5, subtype: "Axial_THT" },
  { id: "axial-0207", name: "Axial DIN0207 (1/4W 1% P7.62mm Standard)", nameAr: "0207 محورية قياسية (1/4W 1% مسافة 7.62مم)", techType: "metal-film", pitch: 7.62, bodyLength: 6.3, bodyDiameter: 2.4, drill: 0.8, padWidth: 1.8, subtype: "Axial_THT" },
  { id: "axial-0309", name: "Axial DIN0309 (1/2W 1% P10.16mm)", nameAr: "0309 محورية (1/2W 1% مسافة 10.16مم)", techType: "metal-film", pitch: 10.16, bodyLength: 9.0, bodyDiameter: 3.2, drill: 0.8, padWidth: 1.8, subtype: "Axial_THT" },
  { id: "axial-0411", name: "Axial DIN0411 (1.0W 1% P12.70mm)", nameAr: "0411 محورية (1.0W 1% مسافة 12.70مم)", techType: "metal-film", pitch: 12.70, bodyLength: 11.5, bodyDiameter: 4.5, drill: 0.9, padWidth: 2.0, subtype: "Axial_THT" },

  // 2. Carbon Film (Standard 5%)
  { id: "axial-0204-c", name: "Axial 0204 Carbon (1/8W 5% P5.08mm)", nameAr: "0204 كربونية (1/8W 5% مسافة 5.08مم)", techType: "carbon-film", pitch: 5.08, bodyLength: 3.6, bodyDiameter: 1.6, drill: 0.7, padWidth: 1.5, subtype: "Axial_THT" },
  { id: "axial-0207-c", name: "Axial 0207 Carbon (1/4W 5% P7.62mm)", nameAr: "0207 كربونية قياسية (1/4W 5% مسافة 7.62مم)", techType: "carbon-film", pitch: 7.62, bodyLength: 6.3, bodyDiameter: 2.4, drill: 0.8, padWidth: 1.8, subtype: "Axial_THT" },
  { id: "axial-0309-c", name: "Axial 0309 Carbon (1/2W 5% P10.16mm)", nameAr: "0309 كربونية (1/2W 5% مسافة 10.16مم)", techType: "carbon-film", pitch: 10.16, bodyLength: 9.0, bodyDiameter: 3.2, drill: 0.8, padWidth: 1.8, subtype: "Axial_THT" },

  // 3. Power Resistor (Cement / Wirewound / High Wattage)
  { id: "axial-0414", name: "Axial 0414 Power (2.0W P15.24mm)", nameAr: "0414 قدرة محورية (2.0W مسافة 15.24مم)", techType: "power", pitch: 15.24, bodyLength: 14.0, bodyDiameter: 5.0, drill: 1.0, padWidth: 2.2, subtype: "Axial_THT" },
  { id: "axial-0617", name: "Axial 0617 Power (3.0W P17.78mm)", nameAr: "0617 قدرة محورية (3.0W مسافة 17.78مم)", techType: "power", pitch: 17.78, bodyLength: 17.0, bodyDiameter: 6.0, drill: 1.0, padWidth: 2.4, subtype: "Axial_THT" },
  { id: "cement-5w", name: "Cement 5W Ceramic (P25.40mm)", nameAr: "مقاومة أسمنتية خزفية 5W (مسافة 25.40مم)", techType: "power", pitch: 25.40, bodyLength: 22.0, bodyDiameter: 9.5, drill: 1.2, padWidth: 2.6, subtype: "Cement_THT" },
  { id: "cement-10w", name: "Cement 10W Ceramic (P35.56mm)", nameAr: "مقاومة أسمنتية خزفية 10W (مسافة 35.56مم)", techType: "power", pitch: 35.56, bodyLength: 32.0, bodyDiameter: 10.0, drill: 1.3, padWidth: 2.8, subtype: "Cement_THT" },

  // 4. Current Shunt (Low Ohm Sense)
  { id: "shunt-5w", name: "Shunt Sense 5W (0.01Ω - 0.1Ω P25.40mm)", nameAr: "شنت تحسس تيار خزفي 5W (مسافة 25.40مم)", techType: "shunt", pitch: 25.40, bodyLength: 22.0, bodyDiameter: 9.5, drill: 1.2, padWidth: 2.6, subtype: "Cement_THT" },
  { id: "shunt-10w", name: "Shunt Sense 10W (0.005Ω - 0.05Ω P35.56mm)", nameAr: "شنت تحسس تيار خزفي 10W (مسافة 35.56مم)", techType: "shunt", pitch: 35.56, bodyLength: 32.0, bodyDiameter: 10.0, drill: 1.3, padWidth: 2.8, subtype: "Cement_THT" },
  { id: "axial-0414-shunt", name: "Axial 0414 Low-Ohm Sense (2.0W P15.24mm)", nameAr: "0414 تحسس محوري منخفض الأوم (2W)", techType: "shunt", pitch: 15.24, bodyLength: 14.0, bodyDiameter: 5.0, drill: 1.0, padWidth: 2.2, subtype: "Axial_THT" },

  // 5. Trimmer / Potentiometer
  { id: "pot-3296w", name: "Bourns 3296W Trimmer (3-pin Inline P2.54mm)", nameAr: "Bourns 3296W مقاومة متغيرة دقيقة (3 أرجل)", techType: "pot", pitch: 2.54, bodyLength: 9.5, bodyWidth: 4.8, drill: 0.8, padWidth: 1.6, subtype: "Potentiometer_THT", pinCount: 3 },
  { id: "pot-3362p", name: "Bourns 3362P Trimmer (3-pin Triangle P2.54mm)", nameAr: "Bourns 3362P تريمر مثلثي (3 أرجل)", techType: "pot", pitch: 2.54, bodyLength: 6.8, bodyWidth: 6.8, drill: 0.8, padWidth: 1.6, subtype: "Potentiometer_THT", pinCount: 3 },
  { id: "pot-rk09", name: "Alps RK09 Rotary Pot (3-pin P5.0mm)", nameAr: "Alps RK09 بوتنشيومتر دوار بمحور (3 أرجل)", techType: "pot", pitch: 5.00, bodyLength: 9.8, bodyWidth: 11.0, drill: 1.0, padWidth: 2.0, subtype: "Potentiometer_THT", pinCount: 3 },

  // 6. Resistor Array (Network)
  { id: "sip-4", name: "SIP-4 Resistor Network (4-pin P2.54mm)", nameAr: "SIP-4 شبكة مقاومات خطية (4 أرجل)", techType: "network", pitch: 2.54, bodyLength: 10.16, bodyWidth: 2.5, drill: 0.8, padWidth: 1.6, subtype: "SIP_Network_THT", pinCount: 4 },
  { id: "sip-6", name: "SIP-6 Resistor Network (6-pin P2.54mm)", nameAr: "SIP-6 شبكة مقاومات خطية (6 أرجل)", techType: "network", pitch: 2.54, bodyLength: 15.24, bodyWidth: 2.5, drill: 0.8, padWidth: 1.6, subtype: "SIP_Network_THT", pinCount: 6 },
  { id: "sip-8", name: "SIP-8 Resistor Network (8-pin P2.54mm)", nameAr: "SIP-8 شبكة مقاومات خطية (8 أرجل)", techType: "network", pitch: 2.54, bodyLength: 20.32, bodyWidth: 2.5, drill: 0.8, padWidth: 1.6, subtype: "SIP_Network_THT", pinCount: 8 },
  { id: "sip-10", name: "SIP-10 Resistor Network (10-pin P2.54mm)", nameAr: "SIP-10 شبكة مقاومات خطية (10 أرجل)", techType: "network", pitch: 2.54, bodyLength: 25.40, bodyWidth: 2.5, drill: 0.8, padWidth: 1.6, subtype: "SIP_Network_THT", pinCount: 10 },
];

export const MORE_STANDARD_THT_RESISTOR_PACKAGES: ResistorPackageItem[] = [
  // Metal Film
  { id: "axial-0204-prec", name: "Axial 0204 Ultra-Prec 0.1% P5.08mm", nameAr: "0204 فائقة الدقة 0.1% مسافة 5.08مم", techType: "metal-film", pitch: 5.08, bodyLength: 3.6, bodyDiameter: 1.6, drill: 0.7, padWidth: 1.5, subtype: "Axial_THT" },
  { id: "axial-0207-vert", name: "Axial 0207 Vertical High Density P5.08mm", nameAr: "0207 عمودية عالية الكثافة مسافة 5.08مم", techType: "metal-film", pitch: 5.08, bodyLength: 6.3, bodyDiameter: 2.4, drill: 0.8, padWidth: 1.8, subtype: "Axial_THT" },

  // Carbon Film
  { id: "axial-0207-vert-c", name: "Axial 0207 Vertical Carbon 5% P5.08mm", nameAr: "0207 كربونية عمودية مسافة 5.08مم", techType: "carbon-film", pitch: 5.08, bodyLength: 6.3, bodyDiameter: 2.4, drill: 0.8, padWidth: 1.8, subtype: "Axial_THT" },

  // Power
  { id: "axial-high-voltage", name: "High Voltage Resistor 10kV P22.86mm", nameAr: "مقاومة جهد عالي 10kV مسافة 22.86مم", techType: "power", pitch: 22.86, bodyLength: 19.0, bodyDiameter: 6.0, drill: 1.0, padWidth: 2.2, subtype: "Axial_THT" },
  { id: "axial-wirewound-7w", name: "Wirewound 7W High Power P30.48mm", nameAr: "مقاومة سلكية ملفوفة 7W مسافة 30.48مم", techType: "power", pitch: 30.48, bodyLength: 26.0, bodyDiameter: 8.5, drill: 1.2, padWidth: 2.6, subtype: "Axial_THT" },

  // Shunt
  { id: "shunt-wirewound-7w", name: "Wirewound Low-Ohm Shunt 7W P30.48mm", nameAr: "شنت سلكي ملفوف 7W مسافة 30.48مم", techType: "shunt", pitch: 30.48, bodyLength: 26.0, bodyDiameter: 8.5, drill: 1.2, padWidth: 2.6, subtype: "Axial_THT" },

  // Potentiometer
  { id: "pot-3386p", name: "Bourns 3386P Cermet Trimmer (3-pin P2.54mm)", nameAr: "Bourns 3386P مقاومة متغيرة مربعة (3 أرجل)", techType: "pot", pitch: 2.54, bodyLength: 9.5, bodyWidth: 9.5, drill: 0.8, padWidth: 1.6, subtype: "Potentiometer_THT", pinCount: 3 },
  { id: "pot-wh148", name: "WH148 16mm Rotary Potentiometer (P5.08mm)", nameAr: "WH148 بوتنشيومتر دوار 16مم لوحي", techType: "pot", pitch: 5.08, bodyLength: 16.0, bodyWidth: 16.0, drill: 1.0, padWidth: 2.0, subtype: "Potentiometer_THT", pinCount: 3 },

  // Network
  { id: "sip-9", name: "SIP-9 Resistor Network (9-pin P2.54mm)", nameAr: "SIP-9 شبكة مقاومات خطية (9 أرجل)", techType: "network", pitch: 2.54, bodyLength: 22.86, bodyWidth: 2.5, drill: 0.8, padWidth: 1.6, subtype: "SIP_Network_THT", pinCount: 9 },
];

export const STANDARD_THT_RESISTOR_SIZES = [
  ...QUICK_STANDARD_THT_RESISTOR_PACKAGES,
  ...MORE_STANDARD_THT_RESISTOR_PACKAGES,
];

export const STANDARD_SMD_CAPACITOR_SIZES = [
  // Ceramic MLCC
  { id: "01005", name: "01005 MLCC (0402 Metric - 0.40 × 0.20 mm)", nameAr: "01005 MLCC (0402 Metric - 0.40 × 0.20 mm)", pitch: 0.35, padWidth: 0.20, padHeight: 0.22, bodyLength: 0.40, bodyWidth: 0.20, polarized: false },
  { id: "0201", name: "0201 MLCC (0603 Metric - 0.60 × 0.30 mm)", nameAr: "0201 MLCC (0603 Metric - 0.60 × 0.30 mm)", pitch: 0.55, padWidth: 0.35, padHeight: 0.35, bodyLength: 0.60, bodyWidth: 0.30, polarized: false },
  { id: "0402", name: "0402 MLCC (1005 Metric - 1.00 × 0.50 mm)", nameAr: "0402 MLCC (1005 Metric - 1.00 × 0.50 mm)", pitch: 0.95, padWidth: 0.55, padHeight: 0.60, bodyLength: 1.00, bodyWidth: 0.50, polarized: false },
  { id: "0603", name: "0603 MLCC (1608 Metric - 1.60 × 0.80 mm)", nameAr: "0603 MLCC (1608 Metric - 1.60 × 0.80 mm)", pitch: 1.60, padWidth: 0.80, padHeight: 0.90, bodyLength: 1.60, bodyWidth: 0.80, polarized: false },
  { id: "0805", name: "0805 MLCC (2012 Metric - 2.00 × 1.25 mm)", nameAr: "0805 MLCC (2012 Metric - 2.00 × 1.25 mm)", pitch: 1.90, padWidth: 1.00, padHeight: 1.30, bodyLength: 2.00, bodyWidth: 1.25, polarized: false },
  { id: "1206", name: "1206 MLCC (3216 Metric - 3.20 × 1.60 mm)", nameAr: "1206 MLCC (3216 Metric - 3.20 × 1.60 mm)", pitch: 3.00, padWidth: 1.10, padHeight: 1.70, bodyLength: 3.20, bodyWidth: 1.60, polarized: false },
  { id: "1210", name: "1210 MLCC (3225 Metric - 3.20 × 2.50 mm)", nameAr: "1210 MLCC (3225 Metric - 3.20 × 2.50 mm)", pitch: 3.00, padWidth: 1.10, padHeight: 2.60, bodyLength: 3.20, bodyWidth: 2.50, polarized: false },
  { id: "1806", name: "1806 MLCC (4516 Metric - 4.50 × 1.60 mm)", nameAr: "1806 MLCC (4516 Metric - 4.50 × 1.60 mm)", pitch: 4.20, padWidth: 1.20, padHeight: 1.80, bodyLength: 4.50, bodyWidth: 1.60, polarized: false },
  { id: "1812", name: "1812 MLCC (4532 Metric - 4.50 × 3.20 mm)", nameAr: "1812 MLCC (4532 Metric - 4.50 × 3.20 mm)", pitch: 4.30, padWidth: 1.20, padHeight: 3.40, bodyLength: 4.50, bodyWidth: 3.20, polarized: false },
  { id: "2220", name: "2220 MLCC (5750 Metric - 5.70 × 5.00 mm)", nameAr: "2220 MLCC (5750 Metric - 5.70 × 5.00 mm)", pitch: 5.50, padWidth: 1.40, padHeight: 5.30, bodyLength: 5.70, bodyWidth: 5.00, polarized: false },
  // Tantalum Molded (Polarized)
  { id: "EIA-3216-18", name: "EIA-3216-18 (Case A - 3.2 × 1.6 mm)", nameAr: "EIA-3216-18 (Case A - 3.2 × 1.6 mm)", pitch: 2.50, padWidth: 1.40, padHeight: 1.20, bodyLength: 3.20, bodyWidth: 1.60, polarized: true },
  { id: "EIA-3528-21", name: "EIA-3528-21 (Case B - 3.5 × 2.8 mm)", nameAr: "EIA-3528-21 (Case B - 3.5 × 2.8 mm)", pitch: 2.80, padWidth: 1.40, padHeight: 2.20, bodyLength: 3.50, bodyWidth: 2.80, polarized: true },
  { id: "EIA-6032-28", name: "EIA-6032-28 (Case C - 6.0 × 3.2 mm)", nameAr: "EIA-6032-28 (Case C - 6.0 × 3.2 mm)", pitch: 4.80, padWidth: 2.00, padHeight: 2.20, bodyLength: 6.00, bodyWidth: 3.20, polarized: true },
  { id: "EIA-7343-31", name: "EIA-7343-31 (Case D - 7.3 × 4.3 mm)", nameAr: "EIA-7343-31 (Case D - 7.3 × 4.3 mm)", pitch: 5.80, padWidth: 2.40, padHeight: 2.40, bodyLength: 7.30, bodyWidth: 4.30, polarized: true },
  { id: "EIA-7343-43", name: "EIA-7343-43 (Case E - 7.3 × 4.3 mm)", nameAr: "EIA-7343-43 (Case E - 7.3 × 4.3 mm)", pitch: 5.80, padWidth: 2.40, padHeight: 2.40, bodyLength: 7.30, bodyWidth: 4.30, polarized: true },
];

export const QUICK_STANDARD_THT_CAPACITOR_PACKAGES = [
  // Non-Polarized: Disc Ceramic
  { id: "disc-d4-p2.54", name: "Disc D4.0 P2.54mm", pitch: 2.54, bodyDiameter: 4.0, bodyWidth: 2.0, drill: 0.7, padWidth: 1.5, polarized: false, subtype: "Disc_THT" },
  { id: "disc-d5-p2.54", name: "Disc D5.0 P2.54mm", pitch: 2.54, bodyDiameter: 5.0, bodyWidth: 2.5, drill: 0.8, padWidth: 1.6, polarized: false, subtype: "Disc_THT" },
  { id: "disc-d5-p5.08", name: "Disc D5.0 P5.08mm", pitch: 5.08, bodyDiameter: 5.0, bodyWidth: 2.5, drill: 0.8, padWidth: 1.6, polarized: false, subtype: "Disc_THT" },
  { id: "disc-d8-p5.08", name: "Disc D8.0 P5.08mm", pitch: 5.08, bodyDiameter: 8.0, bodyWidth: 3.0, drill: 0.8, padWidth: 1.8, polarized: false, subtype: "Disc_THT" },
  // Non-Polarized: Box Film
  { id: "film-l7.2-p5.0", name: "Box Film L7.2 W2.5 P5.0mm (WIMA)", pitch: 5.0, bodyLength: 7.2, bodyWidth: 2.5, drill: 0.8, padWidth: 1.6, polarized: false, subtype: "Box_THT" },
  { id: "film-l10-p7.5", name: "Box Film L10 W4.0 P7.5mm", pitch: 7.5, bodyLength: 10.0, bodyWidth: 4.0, drill: 0.8, padWidth: 1.8, polarized: false, subtype: "Box_THT" },
  { id: "film-l18-p15.0", name: "Box Film L18 W5.0 P15.0mm", pitch: 15.0, bodyLength: 18.0, bodyWidth: 5.0, drill: 0.9, padWidth: 2.0, polarized: false, subtype: "Box_THT" },
  { id: "film-l26-p22.5", name: "Box Film L26 W7.0 P22.5mm", pitch: 22.5, bodyLength: 26.0, bodyWidth: 7.0, drill: 1.0, padWidth: 2.2, polarized: false, subtype: "Box_THT" },
  // Polarized: Radial Electrolytic
  { id: "radial-d5-p2.0", name: "Radial D5.0 P2.0mm", pitch: 2.0, bodyDiameter: 5.0, drill: 0.8, padWidth: 1.6, polarized: true, subtype: "Radial_THT" },
  { id: "radial-d6.3-p2.5", name: "Radial D6.3 P2.5mm", pitch: 2.5, bodyDiameter: 6.3, drill: 0.8, padWidth: 1.6, polarized: true, subtype: "Radial_THT" },
  { id: "radial-d8-p3.5", name: "Radial D8.0 P3.5mm", pitch: 3.5, bodyDiameter: 8.0, drill: 0.8, padWidth: 1.6, polarized: true, subtype: "Radial_THT" },
  { id: "radial-d10-p5.0", name: "Radial D10.0 P5.0mm", pitch: 5.0, bodyDiameter: 10.0, drill: 0.8, padWidth: 1.8, polarized: true, subtype: "Radial_THT" },
  { id: "radial-d12.5-p5.0", name: "Radial D12.5 P5.0mm", pitch: 5.0, bodyDiameter: 12.5, drill: 0.9, padWidth: 2.0, polarized: true, subtype: "Radial_THT" },
  { id: "radial-d16-p7.5", name: "Radial D16.0 P7.5mm", pitch: 7.5, bodyDiameter: 16.0, drill: 1.0, padWidth: 2.2, polarized: true, subtype: "Radial_THT" },
];

export const MORE_STANDARD_THT_CAPACITOR_PACKAGES = [
  // Non-Polarized: Safety & High Voltage
  { id: "safety-x2-p15.0", name: "Safety X2 275V P15.0mm", pitch: 15.0, bodyLength: 18.0, bodyWidth: 6.0, drill: 0.9, padWidth: 2.0, polarized: false, subtype: "Box_THT" },
  { id: "safety-x2-p22.5", name: "Safety X2 275V P22.5mm", pitch: 22.5, bodyLength: 26.5, bodyWidth: 8.5, drill: 1.0, padWidth: 2.2, polarized: false, subtype: "Box_THT" },
  { id: "disc-d10-p7.5", name: "Disc D10.0 P7.5mm", pitch: 7.5, bodyDiameter: 10.0, bodyWidth: 3.5, drill: 0.8, padWidth: 1.8, polarized: false, subtype: "Disc_THT" },
  // Polarized: Power Radial
  { id: "radial-d18-p7.5", name: "Radial D18.0 P7.5mm (High Power)", pitch: 7.5, bodyDiameter: 18.0, drill: 1.0, padWidth: 2.2, polarized: true, subtype: "Radial_THT" },
  { id: "radial-d22-p10.0", name: "Radial D22.0 P10.0mm (Snap-in)", pitch: 10.0, bodyDiameter: 22.0, drill: 1.2, padWidth: 2.5, polarized: true, subtype: "Radial_THT" },
];


export const STANDARD_THT_CAPACITOR_SIZES = [
  ...QUICK_STANDARD_THT_CAPACITOR_PACKAGES,
  ...MORE_STANDARD_THT_CAPACITOR_PACKAGES,
];

export function generatePassive(params: PassiveParams): KicadFootprintModel {
  // Determine component category & package
  const compType = params.componentType || (params.categoryGroup === "capacitor" ? "Capacitor" : "Resistor");
  const isTHT = params.packageType === "THT" || params.subtype === "Axial_THT" || params.subtype === "Radial_THT" || params.subtype === "Disc_THT" || params.subtype === "Box_THT" || (params.drill !== undefined && params.drill > 0);
  
  const prefix = params.reference || (compType === "Capacitor" ? "C" : compType === "Inductor" ? "L" : "R");
  const pads: KicadFootprintPad[] = [];
  const graphics: KicadFootprintGraphic[] = [];

  // ==========================================
  // CASE 1: SMD PASSIVES (Resistor / Capacitor / Tantalum / Array / Trimmer)
  // ==========================================
  if (!isTHT) {
    const chipKey = params.chipSize || "0805";
    const isTantalum = chipKey.startsWith("EIA-") || params.subtype === "SMD_Tantalum";
    const isArray = params.subtype === "SMD_Array" || chipKey.startsWith("array-");
    const isTrimmer = params.subtype === "SMD_Trimmer" || chipKey.startsWith("pot-smd");

    // Case 1.1: SMD Resistor Array (8 pads - 4 channels)
    if (isArray) {
      const pinCount = 8;
      const chCount = 4;
      const elementPitch = params.pitch || 0.8;
      const padW = params.padWidth || 0.45;
      const padH = params.padHeight || 0.70;
      const bodyL = params.bodyLength || (chCount * elementPitch + 0.4);
      const bodyW = params.bodyWidth || 1.6;
      const totalSpan = (chCount - 1) * elementPitch;
      const halfSpan = totalSpan / 2;
      const yOffset = (bodyW / 2) + (padH / 2) - 0.15;

      // Top row (pins 8 down to 5: from left to right)
      for (let i = 0; i < chCount; i++) {
        const pinNum = String(pinCount - i);
        const x = -halfSpan + i * elementPitch;
        pads.push(
          createSmdPad({
            number: pinNum,
            x,
            y: -yOffset,
            width: padW,
            height: padH,
            shape: "roundrect",
            roundrectRatio: 0.25,
          })
        );
      }

      // Bottom row (pins 1 to 4: from left to right)
      for (let i = 0; i < chCount; i++) {
        const pinNum = String(i + 1);
        const x = -halfSpan + i * elementPitch;
        pads.push(
          createSmdPad({
            number: pinNum,
            x,
            y: yOffset,
            width: padW,
            height: padH,
            shape: "roundrect",
            roundrectRatio: 0.25,
          })
        );
      }

      graphics.push(...createFabRect(-bodyL / 2, -bodyW / 2, bodyL / 2, bodyW / 2));
      graphics.push(
        createSilkLine(-bodyL / 2, -bodyW / 2, -bodyL / 2, bodyW / 2),
        createSilkLine(bodyL / 2, -bodyW / 2, bodyL / 2, bodyW / 2)
      );
      // Pin 1 dot on silk
      graphics.push(createSilkCircle(-halfSpan, yOffset + padH / 2 + 0.4, 0.2));
      graphics.push(createValueText(0, yOffset + padH / 2 + 1.0, params.value || `RN_Array_${chipKey}`));
      graphics.push(createReferenceText(0, -yOffset - padH / 2 - 1.0));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

      const name = `R_Array_Convex_${chCount}x_${bodyL.toFixed(1)}x${bodyW.toFixed(1)}mm`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: "RN",
        value: params.value || name,
        description: `SMD 4-Resistor Array ${bodyL}x${bodyW}mm Convex`,
        tags: ["Resistor", "Array", "SMD", "Network"],
        pads,
        graphics,
        mountingType: "SMD",
        generatorFamily: "passive",
        generatorParams: params,
      });
    }

    // Case 1.2: SMD Trimmer Potentiometer (3 pads)
    if (isTrimmer) {
      const padW = params.padWidth || 1.4;
      const padH = params.padHeight || 1.3;
      const bodyL = params.bodyLength || 4.5;
      const bodyW = params.bodyWidth || 4.5;
      const p = params.pitch || 2.54;

      // Pin 1 & Pin 3 on top
      pads.push(
        createSmdPad({ number: "1", x: -p / 2, y: -bodyW / 2, width: padW, height: padH, shape: "roundrect", roundrectRatio: 0.25 }),
        createSmdPad({ number: "3", x: p / 2, y: -bodyW / 2, width: padW, height: padH, shape: "roundrect", roundrectRatio: 0.25 })
      );
      // Pin 2 (Wiper) on bottom center
      pads.push(
        createSmdPad({ number: "2", x: 0, y: bodyW / 2, width: padW, height: padH, shape: "roundrect", roundrectRatio: 0.25 })
      );

      graphics.push(...createFabRect(-bodyL / 2, -bodyW / 2, bodyL / 2, bodyW / 2));
      graphics.push(createSilkCircle(0, 0, Math.min(bodyL, bodyW) * 0.35));
      graphics.push(createSilkLine(-bodyL * 0.2, 0, bodyL * 0.2, 0));
      graphics.push(createValueText(0, bodyW / 2 + padH / 2 + 0.8, params.value || `RV_SMD_${chipKey}`));
      graphics.push(createReferenceText(0, -bodyW / 2 - padH / 2 - 0.8));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

      const name = `Potentiometer_Bourns_${chipKey}_SMD`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: "RV",
        value: params.value || name,
        description: `SMD Trimmer Potentiometer ${bodyL}x${bodyW}mm`,
        tags: ["Potentiometer", "Trimmer", "SMD", "Variable"],
        pads,
        graphics,
        mountingType: "SMD",
        generatorFamily: "passive",
        generatorParams: params,
      });
    }

    // Case 1.3: Standard 2-Pad SMD Passives (Chip Resistor / MLCC / Tantalum)
    const ipc = IPC_PASSIVES[chipKey] || IPC_PASSIVES["0805"] || {
      pitch: 1.9,
      padLength: 1.0,
      padWidth: 1.3,
      bodyLength: 2.0,
      bodyWidth: 1.25,
    };

    const pitch = params.pitch ?? ipc.pitch;
    const padW = params.padWidth ?? ipc.padLength;
    const padH = params.padHeight ?? ipc.padWidth;
    const bodyL = params.bodyLength ?? ipc.bodyLength;
    const bodyW = params.bodyWidth ?? ipc.bodyWidth;

    // Pad 1 (Left / Anode for Polarized)
    pads.push(
      createSmdPad({
        number: "1",
        x: -pitch / 2,
        y: 0,
        width: padW,
        height: padH,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );

    // Pad 2 (Right / Cathode)
    pads.push(
      createSmdPad({
        number: "2",
        x: pitch / 2,
        y: 0,
        width: padW,
        height: padH,
        shape: "roundrect",
        roundrectRatio: 0.25,
      })
    );

    // F.Fab Body Outline (exact component body length x width)
    graphics.push(...createFabRect(-bodyL / 2, -bodyW / 2, bodyL / 2, bodyW / 2));

    // F.SilkS top and bottom lines between pads
    const silkSpan = Math.max(0.2, pitch - padW - 0.2);
    const silkY = bodyW / 2 + 0.15;
    if (silkSpan > 0.2) {
      graphics.push(createSilkLine(-silkSpan / 2, -silkY, silkSpan / 2, -silkY));
      graphics.push(createSilkLine(-silkSpan / 2, silkY, silkSpan / 2, silkY));
    }

    // Polarity marker for Tantalum / Polarized SMD Caps
    if (isTantalum || params.polarized) {
      // Bevel / Polarity Bar on Anode (Pin 1 - Left)
      graphics.push(createSilkLine(-bodyL / 2 - 0.2, -bodyW / 2, -bodyL / 2 - 0.2, bodyW / 2));
      graphics.push(...createPolarityPlus(-pitch / 2 - padW / 2 - 0.45, 0, 0.5));
    }

    // Value Text
    graphics.push(createValueText(0, silkY + 0.85, params.value || (compType === "Capacitor" ? `C_${chipKey}` : `R_${chipKey}`)));

    // Reference Text
    graphics.push(createReferenceText(0, -silkY - 0.85));

    // Courtyard
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardSmd));

    const metricSuffix = CHIP_METRIC_NAMES[chipKey] ? `_${CHIP_METRIC_NAMES[chipKey]}` : "";
    const name = `${compType === "Capacitor" ? "C" : compType === "Inductor" ? "L" : "R"}_${chipKey}${metricSuffix}`;

    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `${compType} SMD chip ${chipKey} (${bodyL}x${bodyW}mm, IPC-7351B)`,
      tags: [compType, "SMD", chipKey, "Chip", isTantalum ? "Tantalum" : "MLCC"],
      pads,
      graphics,
      mountingType: "SMD",
      generatorFamily: "passive",
      generatorParams: params,
    });
  }

  // ==========================================
  // CASE 2: THT RESISTORS & NETWORKS & TRIMMERS
  // ==========================================
  if (compType === "Resistor" || params.subtype === "Axial_THT" || params.subtype === "Cement_THT" || params.subtype === "Potentiometer_THT" || params.subtype === "SIP_Network_THT") {
    // 2.1 SIP Resistor Network (4 to 10 pins in a row)
    if (params.subtype === "SIP_Network_THT") {
      const pinCount = params.pinCount || 8;
      const p = params.pitch || 2.54;
      const drill = params.drill || 0.8;
      const padSize = params.padWidth || 1.6;
      const bodyLen = params.bodyLength || (pinCount * p + 1.2);
      const bodyW = params.bodyWidth || 2.5;
      const totalSpan = (pinCount - 1) * p;
      const startX = -totalSpan / 2;

      for (let i = 0; i < pinCount; i++) {
        const x = startX + i * p;
        pads.push(
          createThtPad({
            number: String(i + 1),
            x,
            y: 0,
            width: padSize,
            height: padSize,
            shape: i === 0 ? "rect" : "oval",
            drill,
          })
        );
      }

      graphics.push(...createFabRect(-bodyLen / 2, -bodyW / 2, bodyLen / 2, bodyW / 2));
      graphics.push(
        createSilkLine(-bodyLen / 2, -bodyW / 2, bodyLen / 2, -bodyW / 2),
        createSilkLine(bodyLen / 2, -bodyW / 2, bodyLen / 2, bodyW / 2),
        createSilkLine(bodyLen / 2, bodyW / 2, -bodyLen / 2, bodyW / 2),
        createSilkLine(-bodyLen / 2, bodyW / 2, -bodyLen / 2, -bodyW / 2)
      );
      // Pin 1 dot
      graphics.push(createSilkCircle(startX, bodyW / 2 + 0.6, 0.25));
      graphics.push(createValueText(0, bodyW / 2 + 1.2, params.value || `RN_SIP-${pinCount}_P2.54mm`));
      graphics.push(createReferenceText(0, -bodyW / 2 - 1.2));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      const name = `Resistor_Network_SIP-${pinCount}_P${p.toFixed(2)}mm`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: "RN",
        value: params.value || name,
        description: `SIP-${pinCount} Resistor Network ${pinCount}-pin Pitch ${p}mm`,
        tags: ["Resistor", "Network", "SIP", "Array", "Through-Hole", "THT"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "passive",
        generatorParams: params,
      });
    }

    // 2.2 THT Potentiometer / Trimmer (3 pins)
    if (params.subtype === "Potentiometer_THT") {
      const drill = params.drill || 0.8;
      const padSize = params.padWidth || 1.6;
      const p = params.pitch || 2.54;
      const isTriangle = params.packageSize === "pot-3362p";
      const isRotary = params.packageSize === "pot-rk09" || params.packageSize === "pot-wh148";
      const bodyLen = params.bodyLength || (isRotary ? 10.0 : 9.5);
      const bodyW = params.bodyWidth || (isRotary ? 11.0 : 4.8);

      if (isTriangle) {
        pads.push(
          createThtPad({ number: "1", x: -p / 2, y: -p / 2, width: padSize, height: padSize, shape: "rect", drill }),
          createThtPad({ number: "2", x: 0, y: p / 2, width: padSize, height: padSize, shape: "circle", drill }),
          createThtPad({ number: "3", x: p / 2, y: -p / 2, width: padSize, height: padSize, shape: "circle", drill })
        );
      } else {
        // Inline 1-2-3
        pads.push(
          createThtPad({ number: "1", x: -p, y: 0, width: padSize, height: padSize, shape: "rect", drill }),
          createThtPad({ number: "2", x: 0, y: 0, width: padSize, height: padSize, shape: "circle", drill }),
          createThtPad({ number: "3", x: p, y: 0, width: padSize, height: padSize, shape: "circle", drill })
        );
      }

      graphics.push(...createFabRect(-bodyLen / 2, -bodyW / 2, bodyLen / 2, bodyW / 2));
      graphics.push(
        createSilkLine(-bodyLen / 2, -bodyW / 2, bodyLen / 2, -bodyW / 2),
        createSilkLine(bodyLen / 2, -bodyW / 2, bodyLen / 2, bodyW / 2),
        createSilkLine(bodyLen / 2, bodyW / 2, -bodyLen / 2, bodyW / 2),
        createSilkLine(-bodyLen / 2, bodyW / 2, -bodyLen / 2, -bodyW / 2)
      );
      // Adjustment knob indicator
      graphics.push(createSilkCircle(0, 0, Math.min(bodyLen, bodyW) * 0.3));
      graphics.push(createValueText(0, bodyW / 2 + 1.2, params.value || `RV_Pot_${params.packageSize || "3296W"}`));
      graphics.push(createReferenceText(0, -bodyW / 2 - 1.2));
      graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

      const name = `Potentiometer_THT_${params.packageSize || "3296W"}_P${p.toFixed(2)}mm`;
      return buildNativeFootprintModel({
        name,
        referencePrefix: "RV",
        value: params.value || name,
        description: `Through-Hole Trimmer Potentiometer ${bodyLen}x${bodyW}mm`,
        tags: ["Potentiometer", "Trimmer", "Through-Hole", "THT", "Variable"],
        pads,
        graphics,
        mountingType: "THT",
        generatorFamily: "passive",
        generatorParams: params,
      });
    }

    // 2.3 Cement & Power Resistors / Axial 2-Pad THT
    const leadSpacing = params.pitch || 7.62;
    const padSize = params.padWidth || 1.8;
    const drill = params.drill || 0.8;
    const bodyLen = params.bodyLength || Math.min(leadSpacing - 1.5, 6.3);
    const bodyDia = params.bodyDiameter || (params.subtype === "Cement_THT" ? 9.5 : 2.4);

    pads.push(
      createThtPad({
        number: "1",
        x: -leadSpacing / 2,
        y: 0,
        width: padSize,
        height: padSize,
        shape: "rect",
        drill,
      })
    );

    pads.push(
      createThtPad({
        number: "2",
        x: leadSpacing / 2,
        y: 0,
        width: padSize,
        height: padSize,
        shape: "oval",
        drill,
      })
    );

    // F.Fab Body Rectangle
    graphics.push(...createFabRect(-bodyLen / 2, -bodyDia / 2, bodyLen / 2, bodyDia / 2));
    // Lead lines on F.Fab
    graphics.push({
      kind: "line",
      layer: KLC_RULES.layers.fab,
      start: { x: -leadSpacing / 2, y: 0 },
      end: { x: -bodyLen / 2, y: 0 },
      stroke: { width: KLC_RULES.strokeWidth.fab },
    });
    graphics.push({
      kind: "line",
      layer: KLC_RULES.layers.fab,
      start: { x: bodyLen / 2, y: 0 },
      end: { x: leadSpacing / 2, y: 0 },
      stroke: { width: KLC_RULES.strokeWidth.fab },
    });

    // F.SilkS Body Outline
    const silkClear = 0.2;
    const silkMaxX = Math.max(0.5, leadSpacing / 2 - padSize / 2 - silkClear);
    const sBx = Math.min(bodyLen / 2, silkMaxX);
    graphics.push(
      createSilkLine(-sBx, -bodyDia / 2, sBx, -bodyDia / 2),
      createSilkLine(sBx, -bodyDia / 2, sBx, bodyDia / 2),
      createSilkLine(sBx, bodyDia / 2, -sBx, bodyDia / 2),
      createSilkLine(-sBx, bodyDia / 2, -sBx, -bodyDia / 2)
    );

    // Value Text
    graphics.push(createValueText(0, bodyDia / 2 + 1.0, params.value || (params.subtype === "Cement_THT" ? `R_Cement_P${leadSpacing.toFixed(2)}mm` : `R_Axial_P${leadSpacing.toFixed(2)}mm`)));

    // Reference Text
    graphics.push(createReferenceText(0, -bodyDia / 2 - 1.0));

    // Courtyard
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));

    const prefixName = params.subtype === "Cement_THT" ? "R_Cement" : "R_Axial";
    const name = `${prefixName}_L${bodyLen.toFixed(1)}mm_D${bodyDia.toFixed(1)}mm_P${leadSpacing.toFixed(2)}mm_Horizontal`;
    return buildNativeFootprintModel({
      name,
      referencePrefix: prefix,
      value: params.value || name,
      description: `Through-Hole Resistor length ${bodyLen}mm, pitch ${leadSpacing}mm`,
      tags: ["Resistor", params.subtype === "Cement_THT" ? "Cement" : "Axial", "Through-Hole", "THT"],
      pads,
      graphics,
      mountingType: "THT",
      generatorFamily: "passive",
      generatorParams: params,
    });
  }

  // ==========================================
  // CASE 3: THT CAPACITORS (Radial / Box Film / Disc)
  // ==========================================
  const pitch = params.pitch || 2.54;
  const padW = params.padWidth || 1.6;
  const padH = params.padHeight || 1.6;
  const drill = params.drill || 0.8;
  const isPolarized = params.polarized === true;
  const isBoxFilm = params.subtype === "Box_THT" || (params.bodyLength !== undefined && params.bodyWidth !== undefined && !isPolarized);
  const isDisc = params.subtype === "Disc_THT" || (!isPolarized && !isBoxFilm);

  // Pad 1 (Anode / Positive - Rectangular pad for Polarized, Circle for Non-polarized)
  pads.push(
    createThtPad({
      number: "1",
      x: -pitch / 2,
      y: 0,
      width: padW,
      height: padH,
      shape: isPolarized ? "rect" : "circle",
      drill,
    })
  );

  // Pad 2 (Cathode / Negative - Circle pad)
  pads.push(
    createThtPad({
      number: "2",
      x: pitch / 2,
      y: 0,
      width: padW,
      height: padH,
      shape: "circle",
      drill,
    })
  );

  let name = "";
  let tags = ["Capacitor", "Through-Hole", "THT"];

  if (isBoxFilm) {
    // Box Film Capacitor (WIMA / Rectangular Film)
    const bL = params.bodyLength || 7.2;
    const bW = params.bodyWidth || 3.5;
    graphics.push(...createFabRect(-bL / 2, -bW / 2, bL / 2, bW / 2));
    graphics.push(
      createSilkLine(-bL / 2, -bW / 2, bL / 2, -bW / 2),
      createSilkLine(bL / 2, -bW / 2, bL / 2, bW / 2),
      createSilkLine(bL / 2, bW / 2, -bL / 2, bW / 2),
      createSilkLine(-bL / 2, bW / 2, -bL / 2, -bW / 2)
    );
    graphics.push(createValueText(0, bW / 2 + 0.9, params.value || `C_Film_L${bL.toFixed(1)}mm_P${pitch.toFixed(1)}mm`));
    graphics.push(createReferenceText(0, -bW / 2 - 0.9));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));
    name = `C_Film_L${bL.toFixed(1)}mm_W${bW.toFixed(1)}mm_P${pitch.toFixed(2)}mm`;
    tags = ["Capacitor", "Film", "Box", "Through-Hole", "THT", "Non-Polarized"];
  } else if (isDisc) {
    // Ceramic Disc Non-polarized Capacitor
    const dia = params.bodyDiameter || 5.0;
    const thick = params.bodyWidth || 2.5;
    const halfL = Math.max(dia, pitch + 1.8) / 2;
    const halfT = thick / 2;

    // F.Fab Body Outline (Rounded rectangle/capsule representing ceramic disc thickness)
    graphics.push(...createFabRect(-halfL, -halfT, halfL, halfT));

    // F.SilkS Body Outline
    graphics.push(
      createSilkLine(-halfL, -halfT, halfL, -halfT),
      createSilkLine(halfL, -halfT, halfL, halfT),
      createSilkLine(halfL, halfT, -halfL, halfT),
      createSilkLine(-halfL, halfT, -halfL, -halfT)
    );

    // Centered capacitor schematic plate lines in silkscreen
    const plateH = Math.max(0.8, halfT * 0.7);
    graphics.push(
      createSilkLine(-0.5, -plateH, -0.5, plateH),
      createSilkLine(0.5, -plateH, 0.5, plateH)
    );

    graphics.push(createValueText(0, halfT + 0.9, params.value || `C_Disc_D${dia.toFixed(1)}mm_W${thick.toFixed(1)}mm_P${pitch.toFixed(2)}mm`));
    graphics.push(createReferenceText(0, -halfT - 0.9));
    graphics.push(createCourtyardRect(pads, graphics, KLC_RULES.clearance.courtyardTht));
    name = `C_Disc_D${dia.toFixed(1)}mm_W${thick.toFixed(1)}mm_P${pitch.toFixed(2)}mm`;
    tags = ["Capacitor", "Ceramic", "Disc", "Through-Hole", "THT", "Non-Polarized"];
  } else {
    // Radial Electrolytic Polarized Capacitor
    const dia = params.bodyDiameter || Math.max(pitch * 2, 6.3);
    const radius = dia / 2;
    const silkR = radius + 0.15;

    graphics.push(createFabCircle(0, 0, radius));
    graphics.push(createSilkCircle(0, 0, silkR));

    // Negative polarity stripe on Pin 2 side (right)
    graphics.push(createCapNegativeBand(silkR));
    // Positive marker (+) near Pin 1 on the left
    graphics.push(...createPolarityPlus(-silkR - 0.6, 0, 0.7));

    graphics.push(createValueText(0, silkR + 0.9, params.value || `CP_Radial_D${dia.toFixed(1)}mm_P${pitch.toFixed(2)}mm`));
    graphics.push(createReferenceText(0, -silkR - 0.9));
    graphics.push(createCourtyardCircle(0, 0, silkR, KLC_RULES.clearance.courtyardTht));
    name = `CP_Radial_D${dia.toFixed(1)}mm_P${pitch.toFixed(2)}mm`;
    tags = ["Capacitor", "Electrolytic", "Polarized", "Radial", "Through-Hole", "THT"];
  }

  return buildNativeFootprintModel({
    name,
    referencePrefix: prefix,
    value: params.value || name,
    description: `Through-Hole Capacitor (Pitch ${pitch}mm, ${isPolarized ? "Electrolytic Radial (Polarized)" : isBoxFilm ? "Film Box (Non-Polarized)" : "Disc Ceramic (Non-Polarized)"})`,
    tags,
    pads,
    graphics,
    mountingType: "THT",
    generatorFamily: "passive",
    generatorParams: {
      ...params,
      polarized: isPolarized,
    },
  });
}

