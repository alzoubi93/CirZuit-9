/**
 * IPC Standards: IPC-7351B (SMD Land Patterns) and IPC-2221 (Through-Hole Design)
 */

export interface IpcPassiveDimensions {
  bodyLength: number;
  bodyWidth: number;
  bodyHeight: number;
  terminalLength: number;
  padWidth: number;
  padLength: number;
  pitch: number; // Center-to-center distance
}

/** Standard IPC-7351B Nominal Land Patterns for SMD Chip Resistors / Capacitors */
export const IPC_PASSIVES: Record<string, IpcPassiveDimensions> = {
  "01005": {
    bodyLength: 0.40,
    bodyWidth: 0.20,
    bodyHeight: 0.15,
    terminalLength: 0.10,
    padWidth: 0.22,
    padLength: 0.20,
    pitch: 0.35,
  },
  "0201": {
    bodyLength: 0.60,
    bodyWidth: 0.30,
    bodyHeight: 0.30,
    terminalLength: 0.15,
    padWidth: 0.35,
    padLength: 0.35,
    pitch: 0.55,
  },
  "0402": {
    bodyLength: 1.00,
    bodyWidth: 0.50,
    bodyHeight: 0.35,
    terminalLength: 0.25,
    padWidth: 0.60,
    padLength: 0.55,
    pitch: 0.95,
  },
  "0603": {
    bodyLength: 1.60,
    bodyWidth: 0.80,
    bodyHeight: 0.45,
    terminalLength: 0.30,
    padWidth: 0.90,
    padLength: 0.80,
    pitch: 1.60,
  },
  "0805": {
    bodyLength: 2.00,
    bodyWidth: 1.25,
    bodyHeight: 0.60,
    terminalLength: 0.40,
    padWidth: 1.30,
    padLength: 1.00,
    pitch: 1.90,
  },
  "1206": {
    bodyLength: 3.20,
    bodyWidth: 1.60,
    bodyHeight: 0.60,
    terminalLength: 0.50,
    padWidth: 1.70,
    padLength: 1.10,
    pitch: 3.00,
  },
  "1210": {
    bodyLength: 3.20,
    bodyWidth: 2.50,
    bodyHeight: 0.60,
    terminalLength: 0.50,
    padWidth: 2.60,
    padLength: 1.10,
    pitch: 3.00,
  },
  "1806": {
    bodyLength: 4.50,
    bodyWidth: 1.60,
    bodyHeight: 0.60,
    terminalLength: 0.50,
    padWidth: 1.80,
    padLength: 1.20,
    pitch: 4.20,
  },
  "1812": {
    bodyLength: 4.50,
    bodyWidth: 3.20,
    bodyHeight: 0.60,
    terminalLength: 0.50,
    padWidth: 3.40,
    padLength: 1.20,
    pitch: 4.30,
  },
  "2010": {
    bodyLength: 5.00,
    bodyWidth: 2.50,
    bodyHeight: 0.60,
    terminalLength: 0.60,
    padWidth: 2.70,
    padLength: 1.30,
    pitch: 4.80,
  },
  "2220": {
    bodyLength: 5.70,
    bodyWidth: 5.00,
    bodyHeight: 1.00,
    terminalLength: 0.60,
    padWidth: 5.30,
    padLength: 1.40,
    pitch: 5.50,
  },
  "2512": {
    bodyLength: 6.30,
    bodyWidth: 3.20,
    bodyHeight: 0.60,
    terminalLength: 0.60,
    padWidth: 3.40,
    padLength: 1.40,
    pitch: 6.10,
  },
  "2712": {
    bodyLength: 7.00,
    bodyWidth: 3.20,
    bodyHeight: 0.60,
    terminalLength: 0.60,
    padWidth: 3.40,
    padLength: 1.50,
    pitch: 6.80,
  },
  "2920": {
    bodyLength: 7.50,
    bodyWidth: 5.00,
    bodyHeight: 0.80,
    terminalLength: 0.70,
    padWidth: 5.30,
    padLength: 1.60,
    pitch: 7.30,
  },
  // Tantalum SMD / Molded packages (EIA 3216 to 7343)
  "EIA-3216-18": {
    bodyLength: 3.20,
    bodyWidth: 1.60,
    bodyHeight: 1.80,
    terminalLength: 0.80,
    padWidth: 1.20,
    padLength: 1.40,
    pitch: 2.50,
  },
  "EIA-3528-21": {
    bodyLength: 3.50,
    bodyWidth: 2.80,
    bodyHeight: 2.10,
    terminalLength: 0.80,
    padWidth: 2.20,
    padLength: 1.40,
    pitch: 2.80,
  },
  "EIA-6032-28": {
    bodyLength: 6.00,
    bodyWidth: 3.20,
    bodyHeight: 2.80,
    terminalLength: 1.30,
    padWidth: 2.20,
    padLength: 2.00,
    pitch: 4.80,
  },
  "EIA-7343-31": {
    bodyLength: 7.30,
    bodyWidth: 4.30,
    bodyHeight: 3.10,
    terminalLength: 1.30,
    padWidth: 2.40,
    padLength: 2.40,
    pitch: 5.80,
  },
  "EIA-7343-43": {
    bodyLength: 7.30,
    bodyWidth: 4.30,
    bodyHeight: 4.30,
    terminalLength: 1.30,
    padWidth: 2.40,
    padLength: 2.40,
    pitch: 5.80,
  },
};

/** Standard IPC Gullwing Dimensions for SOIC / TSSOP / QFP */
export interface IpcGullwingRules {
  toeFillet: number;   // Outer extension
  heelFillet: number;  // Inner extension
  sideFillet: number;  // Lateral extension
  courtyardClearance: number;
}

export const IPC_GULLWING_LEVEL_B: IpcGullwingRules = {
  toeFillet: 0.35,
  heelFillet: 0.35,
  sideFillet: 0.03,
  courtyardClearance: 0.25,
};

/** Calculate Through-Hole Pad size from lead diameter according to IPC-2221 Level B */
export function calculateThtPad(leadDiameter: number): { drill: number; padDiameter: number } {
  // Drill = Lead diameter + 0.2mm (minimum hole size)
  const drill = Math.round((leadDiameter + 0.25) * 10) / 10;
  // Pad Diameter = Drill + (2 * 0.25 minimum annular ring) + 0.1 fabrication allowance
  const padDiameter = Math.round((drill + 0.70) * 10) / 10;
  return { drill, padDiameter };
}
