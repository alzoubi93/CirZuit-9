/**
 * KiCad Library Conventions (KLC) Rules & Constants
 * Reference: https://klc.kicad.org/
 */

export const KLC_RULES = {
  // Line widths (mm)
  strokeWidth: {
    silkscreen: 0.12,   // F.SilkS nominal stroke width
    fab: 0.10,          // F.Fab nominal stroke width
    courtyard: 0.05,    // F.CrtYd nominal stroke width
    detail: 0.08,
  },

  // Clearances (mm)
  clearance: {
    silkToPad: 0.20,      // Minimum clearance between silkscreen and exposed copper/mask
    courtyardSmd: 0.25,   // Standard SMD courtyard expansion (IPC-7351 Level B)
    courtyardTht: 0.50,   // Standard Through-Hole courtyard expansion
    courtyardConnector: 0.50,
    courtyardGrid: 0.05,  // Courtyard dimensions rounded to 0.05mm grid
  },

  // Typography
  text: {
    reference: {
      layer: "F.SilkS",
      size: { x: 1.0, y: 1.0 },
      thickness: 0.15,
      role: "reference" as const,
      text: "${REFERENCE}",
    },
    value: {
      layer: "F.Fab",
      size: { x: 1.0, y: 1.0 },
      thickness: 0.15,
      role: "value" as const,
      text: "${VALUE}",
    },
    pin1Label: {
      size: { x: 0.8, y: 0.8 },
      thickness: 0.12,
    },
  },

  // Pin 1 indicators
  pin1: {
    dotRadius: 0.25,
    dotDistance: 0.6,
    chamferRatio: 0.25, // 25% of body width or max 1.0mm
    chamferMax: 1.0,
  },

  // Layers standard
  layers: {
    smdPad: ["F.Cu", "F.Mask", "F.Paste"],
    thtPad: ["B.Cu", "F.Cu", "F.Mask", "B.Mask"],
    npthPad: ["*.Cu", "*.Mask"],
    silk: "F.SilkS",
    fab: "F.Fab",
    courtyard: "F.CrtYd",
  },
} as const;

export function roundToGrid(val: number, grid: number = 0.05): number {
  return Math.round(val / grid) * grid;
}
