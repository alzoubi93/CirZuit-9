// PCB module data schema — Phase 1: KiCad Multilayer Copper & Native Track/Segment Support
export type PcbUnit = "mm" | "inch";

export type KicadCopperLayer =
  | "F.Cu"
  | "B.Cu"
  | "In1.Cu"  | "In2.Cu"  | "In3.Cu"  | "In4.Cu"  | "In5.Cu"
  | "In6.Cu"  | "In7.Cu"  | "In8.Cu"  | "In9.Cu"  | "In10.Cu"
  | "In11.Cu" | "In12.Cu" | "In13.Cu" | "In14.Cu" | "In15.Cu"
  | "In16.Cu" | "In17.Cu" | "In18.Cu" | "In19.Cu" | "In20.Cu"
  | "In21.Cu" | "In22.Cu" | "In23.Cu" | "In24.Cu" | "In25.Cu"
  | "In26.Cu" | "In27.Cu" | "In28.Cu" | "In29.Cu" | "In30.Cu";

export type KicadTechnicalLayer =
  | "B.Adhes" | "F.Adhes"
  | "B.Paste" | "F.Paste"
  | "B.SilkS" | "F.SilkS"
  | "B.Mask"  | "F.Mask"
  | "Dwgs.User" | "User.Drawings"
  | "Cmts.User" | "User.Comments"
  | "Eco1.User" | "User.Eco1"
  | "Eco2.User" | "User.Eco2"
  | "Edge.Cuts" | "Margin"
  | "B.CrtYd" | "F.CrtYd"
  | "B.Fab"   | "F.Fab"
  | "User.1"  | "User.2" | "User.3" | "User.4" | "User.5"
  | "User.6"  | "User.7" | "User.8" | "User.9";

export type LegacyPcbLayerId =
  | "top_copper"
  | "bottom_copper"
  | "multi_layer"
  | "silkscreen"
  | "bottom_silkscreen"
  | "solder_mask"
  | "bottom_solder_mask"
  | "drill"
  | "outline";

export type PcbLayerId = LegacyPcbLayerId | KicadCopperLayer | KicadTechnicalLayer | (string & {});

export interface PcbLayer {
  id: PcbLayerId;
  name: string;
  color: string;
  visible: boolean;
  type?: "signal" | "power" | "mixed" | "jumper" | "user";
  userName?: string;
  ordinal?: number;
}

// Layer classification helpers
export function isCopperLayer(layerId?: string): boolean {
  if (!layerId) return false;
  const l = layerId.trim();
  if (l === "top_copper" || l === "bottom_copper" || l === "multi_layer") return true;
  if (l === "F.Cu" || l === "B.Cu" || l === "*.Cu" || l.endsWith(".Cu")) return true;
  if (/^in\d+\.cu$/i.test(l)) return true;
  if (l.includes("copper")) return true;
  return false;
}

export function isTopCopper(layerId?: string): boolean {
  if (!layerId) return false;
  const l = layerId.trim();
  return l === "top_copper" || l === "F.Cu";
}

export function isBottomCopper(layerId?: string): boolean {
  if (!layerId) return false;
  const l = layerId.trim();
  return l === "bottom_copper" || l === "B.Cu";
}

export function isInnerCopper(layerId?: string): boolean {
  if (!layerId) return false;
  const l = layerId.trim();
  return /^in\d+\.cu$/i.test(l);
}

export const isInnerCopperLayer = isInnerCopper;

/**
 * Maps KiCad layer IDs to their official PCB_LAYER_ID enum ordinal (include/layer_ids.h)
 */
export function getCopperLayerOrdinal(layerId: string): number {
  const l = layerId.trim();
  if (l === "F.Cu" || l === "top_copper") return 0;
  if (l === "B.Cu" || l === "bottom_copper") return 31;
  const m = l.match(/^in(\d+)\.cu$/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 30) return n;
  }
  return 0;
}

/**
 * Standard vibrant PCB palette colors for KiCad / Altium copper layers
 */
export const COPPER_LAYER_COLORS: Record<string, string> = {
  "F.Cu": "#ef4444",       // Layer 0: Front Copper (Red)
  "top_copper": "#ef4444",
  "In1.Cu": "#f59e0b",     // Layer 1: Inner 1 (Amber / Gold)
  "In2.Cu": "#06b6d4",     // Layer 2: Inner 2 (Cyan)
  "In3.Cu": "#a855f7",     // Layer 3: Inner 3 (Purple)
  "In4.Cu": "#84cc16",     // Layer 4: Inner 4 (Lime)
  "In5.Cu": "#fb923c",     // Layer 5: Inner 5 (Orange)
  "In6.Cu": "#ec4899",     // Layer 6: Inner 6 (Pink)
  "In7.Cu": "#10b981",     // Layer 7: Inner 7 (Emerald)
  "In8.Cu": "#6366f1",     // Layer 8: Inner 8 (Indigo)
  "In9.Cu": "#14b8a6",     // Layer 9: Inner 9 (Teal)
  "In10.Cu": "#d946ef",    // Layer 10: Inner 10 (Fuchsia)
  "In11.Cu": "#eab308",    // Layer 11: Inner 11 (Yellow)
  "In12.Cu": "#38bdf8",    // Layer 12: Inner 12 (Sky Blue)
  "In13.Cu": "#a3e635",    // Layer 13: Inner 13 (Bright Lime)
  "In14.Cu": "#f43f5e",    // Layer 14: Inner 14 (Rose)
  "In15.Cu": "#8b5cf6",    // Layer 15: Inner 15 (Violet)
  "In16.Cu": "#2dd4bf",    // Layer 16: Inner 16 (Aquamarine)
  "In17.Cu": "#fb7185",    // Layer 17: Inner 17 (Coral)
  "In18.Cu": "#c084fc",    // Layer 18: Inner 18 (Lavender)
  "In19.Cu": "#4ade80",    // Layer 19: Inner 19 (Green)
  "In20.Cu": "#facc15",    // Layer 20: Inner 20 (Gold)
  "In21.Cu": "#67e8f9",    // Layer 21: Inner 21 (Light Cyan)
  "In22.Cu": "#f472b6",    // Layer 22: Inner 22 (Light Pink)
  "In23.Cu": "#818cf8",    // Layer 23: Inner 23 (Periwinkle)
  "In24.Cu": "#34d399",    // Layer 24: Inner 24 (Sea Green)
  "In25.Cu": "#fdba74",    // Layer 25: Inner 25 (Peach)
  "In26.Cu": "#e879f9",    // Layer 26: Inner 26 (Orchid)
  "In27.Cu": "#93c5fd",    // Layer 27: Inner 27 (Soft Blue)
  "In28.Cu": "#a7f3d0",    // Layer 28: Inner 28 (Mint)
  "In29.Cu": "#fde047",    // Layer 29: Inner 29 (Light Yellow)
  "In30.Cu": "#cbd5e1",    // Layer 30: Inner 30 (Silver Copper)
  "B.Cu": "#3b82f6",       // Layer 31: Back Copper (Blue)
  "bottom_copper": "#3b82f6",
};

export function getCopperLayerStandardColor(layerId: string): string {
  if (COPPER_LAYER_COLORS[layerId]) return COPPER_LAYER_COLORS[layerId];
  const m = layerId.match(/^in(\d+)\.cu$/i);
  if (m) {
    const key = `In${m[1]}.Cu`;
    if (COPPER_LAYER_COLORS[key]) return COPPER_LAYER_COLORS[key];
  }
  return "#f59e0b"; // fallback amber
}

export const DEFAULT_LAYERS: PcbLayer[] = [
  { id: "outline",           name: "Board Outline",      color: "#eab308",   visible: true, ordinal: 44 },
  { id: "top_copper",        name: "Top Copper (F.Cu)",  color: "#ef4444",   visible: true, ordinal: 0 },
  { id: "bottom_copper",     name: "Bottom Copper (B.Cu)", color: "#3b82f6", visible: true, ordinal: 31 },
  { id: "multi_layer",       name: "Multi Layer (*.Cu)", color: "#ef4444",   visible: true },
  { id: "silkscreen",        name: "Top Silkscreen (F.SilkS)", color: "#fde047", visible: true, ordinal: 37 },
  { id: "bottom_silkscreen", name: "Bottom Silkscreen (B.SilkS)", color: "#fde047", visible: true, ordinal: 36 },
  { id: "solder_mask",       name: "Top Solder Mask (F.Mask)", color: "#10b98180", visible: true, ordinal: 39 },
  { id: "bottom_solder_mask",name: "Bottom Solder Mask (B.Mask)", color: "#04785780", visible: true, ordinal: 38 },
  { id: "drill",             name: "Drill Holes",        color: "#000000",   visible: true },
];

export interface PcbTrack {
  id: string;
  layer: PcbLayerId;
  width: number;            // mm
  points: { x: number; y: number }[]; // mm

  /** Native KiCad track / arc / poly geometry */
  kind?: "segment" | "arc" | "poly";
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  mid?: { x: number; y: number };
  center?: { x: number; y: number };
  angle?: number;

  /** Net connectivity */
  netId?: number;
  netKey?: string;
  netName?: string;
  tstamp?: string;
  locked?: boolean;
}

export type PcbViaType = "through" | "blind" | "micro";

export interface PcbVia {
  id: string;
  x: number; y: number;     // mm
  drill: number;            // mm (hole diameter)
  diameter: number;         // mm (annular outer pad diameter)
  shape?: "circle" | "square";
  
  /** Native KiCad via classification (through, blind/buried, micro) */
  viaType?: PcbViaType;

  /** Layer span: [startLayer, endLayer] */
  layers?: [PcbLayerId, PcbLayerId];

  /** KiCad 7/8 annular ring / teardrop features */
  removeUnusedLayers?: boolean;
  keepEndLayers?: boolean;
  free?: boolean;

  /** Offset microvia drill center */
  drillOffset?: { x: number; y: number };

  /** Net connectivity & identity */
  netId?: number;
  netKey?: string;
  netName?: string;
  tstamp?: string;
  status?: number | string;
  locked?: boolean;
}

export interface PcbPad {
  id: string;
  x: number; y: number;     // mm
  width: number;            // mm
  height: number;           // mm
  shape: "rect" | "circle";
  layer: "top_copper" | "bottom_copper";
  drill?: number;           // mm (through-hole if set)
  number?: string;
  netId?: number;
  netKey?: string;
  netName?: string;
}

export interface PcbMeasure {
  id: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
}

/** A pad that belongs to a synchronized footprint (linked to a schematic pin). */
export interface PcbFootprintPad {
  pinIndex: number;
  /** Additional schematic unit pins that physically share this pad. */
  pinAliases?: { componentId: string; pinIndex: number; pinNumber: string; }[];
  number?: string;
  name?: string;
  /** position relative to footprint origin, mm (before footprint rotation) */
  x: number; y: number;
  width: number; height: number;
  shape: "rect" | "circle";
  layer: "top_copper" | "bottom_copper" | "multi_layer";
  drill?: number;
  rotation?: number;
  nativeShape?: string;
  roundrectRatio?: number;
  drillX?: number;
  drillY?: number;
  chamferRatio?: number;
  chamferCorners?: string[];
  rectDelta?: { x:number; y:number };
  offset?: { x:number; y:number };
  layers?: string[];
  customGraphics?: import("./kicad/footprint/kicadFootprint").KicadFootprintGraphic[];
  nativePad?: import("./kicad/footprint/kicadFootprint").KicadFootprintPad;
  /** Electrical net inherited from the linked schematic pin. */
  netId?: number;
  netKey?: string;
  netName?: string;
}

/** A footprint mirrors a schematic component on the PCB. id === schematic node id. */
export interface PcbFootprint {
  id: string;
  reference?: string;
  value?: string;
  symbol: string;
  packageId?: string;
  x: number; y: number;          // mm, footprint origin
  rotation: number;
  pads: PcbFootprintPad[];
  custom3DModel?: string; // base64 or object URL
  custom3DModelType?: "glb" | "stp";
  /** Native KiCad footprint semantics when this footprint originated from a .kicad_mod. */
  nativeKicadFootprint?: import("./kicad/footprint/kicadFootprint").KicadFootprintModel;
  source?: import("./kicad/footprint/kicadFootprint").KicadFootprintModel["source"];
  footprint?: string;
  metadata?: Record<string, unknown>;
}

export interface PcbText {
  id: string;
  text: string;
  x: number;
  y: number;
  size: number; // in mm
  layer: PcbLayerId;
  rotation: 0 | 90 | 180 | 270;
  thickness?: number;
  bold?: boolean;
  italic?: boolean;
  mirror?: boolean;
  justify?: string[];
  tstamp?: string;
  locked?: boolean;
  groupId?: string;
}

export type PcbGraphicKind = "line" | "arc" | "circle" | "rect" | "poly" | "curve" | "text" | "textbox";

export interface PcbGraphicStroke {
  width: number;
  type?: "solid" | "dash" | "dot" | "dash_dot" | "dash_dot_dot" | "default";
  color?: string;
}

export interface PcbGraphicBase {
  id: string;
  layer: PcbLayerId;
  stroke?: PcbGraphicStroke;
  width?: number;
  fill?: "none" | "solid";
  tstamp?: string;
  locked?: boolean;
  groupId?: string;
}

export interface PcbGraphicLine extends PcbGraphicBase {
  kind: "line";
  start: { x: number; y: number };
  end: { x: number; y: number };
}

export interface PcbGraphicArc extends PcbGraphicBase {
  kind: "arc";
  start: { x: number; y: number };
  mid?: { x: number; y: number };
  end: { x: number; y: number };
  center?: { x: number; y: number };
  angle?: number;
}

export interface PcbGraphicCircle extends PcbGraphicBase {
  kind: "circle";
  center: { x: number; y: number };
  end: { x: number; y: number };
  radius?: number;
}

export interface PcbGraphicRect extends PcbGraphicBase {
  kind: "rect";
  start: { x: number; y: number };
  end: { x: number; y: number };
  radius?: number;
}

export interface PcbGraphicPoly extends PcbGraphicBase {
  kind: "poly";
  points: { x: number; y: number }[];
}

export interface PcbGraphicCurve extends PcbGraphicBase {
  kind: "curve";
  points: { x: number; y: number }[];
}

export interface PcbGraphicText extends PcbGraphicBase {
  kind: "text";
  text: string;
  position: { x: number; y: number };
  size?: { x: number; y: number };
  rotation?: number;
  justify?: string[];
  bold?: boolean;
  italic?: boolean;
  mirror?: boolean;
  thickness?: number;
}

export interface PcbGraphicTextBox extends PcbGraphicBase {
  kind: "textbox";
  text: string;
  position: { x: number; y: number };
  end?: { x: number; y: number };
  size?: { x: number; y: number };
  rotation?: number;
  justify?: string[];
  bold?: boolean;
  italic?: boolean;
}

export type PcbGraphic =
  | PcbGraphicLine
  | PcbGraphicArc
  | PcbGraphicCircle
  | PcbGraphicRect
  | PcbGraphicPoly
  | PcbGraphicCurve
  | PcbGraphicText
  | PcbGraphicTextBox;

export interface PcbDimension {
  id: string;
  dimensionType: "aligned" | "leader" | "center" | "orthogonal" | "radial";
  layer: PcbLayerId;
  points: { x: number; y: number }[];
  height?: number;
  text?: string;
  value?: number;
  format?: { prefix?: string; suffix?: string; units?: number; precision?: number };
  style?: { thickness?: number; arrowLength?: number; textPosition?: { x: number; y: number } };
  tstamp?: string;
  locked?: boolean;
  groupId?: string;
}

export interface PcbTarget {
  id: string;
  x: number;
  y: number;
  shape?: "plus" | "cross" | "circle";
  size?: number;
  width?: number;
  layer: PcbLayerId;
  tstamp?: string;
  locked?: boolean;
  groupId?: string;
}

export interface PcbGroup {
  id: string;
  name: string;
  members: string[];
  locked?: boolean;
}

export interface PcbZonePoint {
  x: number;
  y: number;
}

export interface PcbZonePolygon {
  pts: PcbZonePoint[];
  holes?: PcbZonePoint[][];
}

export interface PcbZoneFilledPolygon {
  layer?: PcbLayerId;
  pts: PcbZonePoint[];
  holes?: PcbZonePoint[][];
  island?: boolean;
}

export interface PcbZoneKeepoutSettings {
  tracks?: boolean;      // not_allowed -> true
  vias?: boolean;
  pads?: boolean;
  copperpour?: boolean;
  footprints?: boolean;
}

export interface PcbZoneFillSettings {
  fillMode?: "solid" | "hatched" | "none";
  filled?: boolean;
  thermalGap?: number;
  thermalBridgeWidth?: number;
  smoothing?: "none" | "chamfer" | "fillet";
  smoothingRadius?: number;
  islandRemovalMode?: number; // 0 = always, 1 = never, 2 = min_area
  minIslandArea?: number;
  hatchStyle?: "edge" | "full" | "none";
  hatchPitch?: number;
}

export interface PcbZone {
  id: string;
  netId?: number;
  netKey?: string;
  netName?: string;
  layer: PcbLayerId;
  layers?: PcbLayerId[]; // Multi-layer zone / rule area
  name?: string;
  priority?: number;
  clearance?: number;
  minThickness?: number;
  
  // Outer boundary polygon
  boundary: PcbZonePolygon;
  
  // Filled copper islands / polygons calculated or stored by KiCad
  filledPolygons?: PcbZoneFilledPolygon[];
  
  // Fill settings and thermal parameters
  fill?: PcbZoneFillSettings;
  
  // Keepout / Rule Area restrictions
  isKeepout?: boolean;
  keepout?: PcbZoneKeepoutSettings;
  
  tstamp?: string;
  locked?: boolean;
}

export interface PcbNetMember {
  componentId: string;
  reference?: string;
  pinIndex: number;
  pinNumber: string;
  padIndex?: number;
  padNumber?: string;
}

export interface PcbNet {
  id: number;
  key: string;
  name: string;
  members: PcbNetMember[];
  labels?: string[];
  labelIds?: string[];
  source: "schematic" | "manual" | "imported";
  status?: "complete" | "partial" | "conflict";
}

export interface PcbDoc {
  version: 1;
  unit: PcbUnit;
  width: number;
  height: number;
  gridMm: number;
  layers: PcbLayer[];
  tracks: PcbTrack[];
  vias: PcbVia[];
  pads: PcbPad[];
  measures: PcbMeasure[];
  zones?: PcbZone[];
  texts?: PcbText[];
  graphics?: PcbGraphic[];
  dimensions?: PcbDimension[];
  targets?: PcbTarget[];
  groups?: PcbGroup[];
  /** Synced from schematic. Do not edit manually. */
  footprints: PcbFootprint[];
  /** Electrical net registry mirrored from the schematic. */
  nets?: PcbNet[];
  /** Last successful schematic→PCB synchronization metadata. */
  sync?: {
    schematicVersion?: number;
    synchronizedAt: number;
    componentCount: number;
    netCount: number;
    unresolvedComponents: string[];
    conflicts: string[];
  };
  /** Show the ratsnest overlay (airwires). */
  ratsnestVisible: boolean;
  isImportedGerber?: boolean;
  isImportedKiCadPcb?: boolean;
  disableDrc?: boolean;
}

export function emptyPcbDoc(): PcbDoc {
  return {
    version: 1,
    unit: "mm",
    width: 80,
    height: 60,
    gridMm: 4,
    layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
    tracks: [],
    vias: [],
    pads: [],
    measures: [],
    zones: [],
    texts: [],
    graphics: [],
    dimensions: [],
    targets: [],
    groups: [],
    footprints: [],
    nets: [],
    sync: { synchronizedAt: 0, componentCount: 0, netCount: 0, unresolvedComponents: [], conflicts: [] },
    ratsnestVisible: true,
  };
}

export const MM_PER_INCH = 25.4;
export const toDisplay = (mm: number, unit: PcbUnit) => unit === "mm" ? mm : mm / MM_PER_INCH;
export const fromDisplay = (v: number, unit: PcbUnit) => unit === "mm" ? v : v * MM_PER_INCH;
export const fmt = (mm: number, unit: PcbUnit, d = 2) => `${toDisplay(mm, unit).toFixed(d)} ${unit}`;

export function checkIfPolarizedCapacitor(fp: any): boolean {
  if (!fp) return false;

  // 1. Direct explicit metadata
  if (fp.metadata?.polarized !== undefined) {
    return !!fp.metadata.polarized;
  }

  // 2. If we have schematic symbol linking
  const linkedSymId = fp.metadata?.componentLink?.symbolId ? String(fp.metadata.componentLink.symbolId).toLowerCase() : "";
  if (linkedSymId) {
    if (linkedSymId === "capacitor" || linkedSymId === "c" || linkedSymId === "c_small" || linkedSymId === "device:c") {
      return false;
    }
    if (linkedSymId === "capacitor_polar" || linkedSymId.includes("polar") || linkedSymId === "cp" || linkedSymId === "device:c_polar") {
      return true;
    }
  }

  // 3. Generator parameters
  const genParams = fp.nativeKicadFootprint?.generatorParams;
  if (genParams && (genParams.componentType === "Capacitor" || genParams.categoryGroup === "capacitor")) {
    if (genParams.polarized !== undefined) {
      return genParams.polarized === true;
    }
    if (genParams.subtype === "Disc_THT" || genParams.subtype === "Box_THT" || genParams.subtype === "SMD_Chip") {
      return false;
    }
    if (genParams.subtype === "Radial_THT" || genParams.subtype === "SMD_Tantalum") {
      return true;
    }
  }

  // 4. Tags on native footprint
  const tags: string[] = Array.isArray(fp.nativeKicadFootprint?.tags)
    ? fp.nativeKicadFootprint.tags.map((t: string) => String(t).toLowerCase())
    : [];
  if (tags.includes("electrolytic") || tags.includes("tantalum") || tags.includes("cp") || tags.includes("polarized")) {
    return true;
  }
  if (tags.includes("ceramic") || tags.includes("mlcc") || tags.includes("disc") || tags.includes("film") || tags.includes("unpolarized") || tags.includes("non-polarized")) {
    return false;
  }

  // 5. Footprint / Package name heuristics (KiCad standard: CP_* = polarized, C_* = non-polarized)
  const footprintName = (fp.footprint || fp.packageId || fp.nativeKicadFootprint?.name || fp.nativeKicadFootprint?.fullName || "").toLowerCase();
  if (footprintName.includes("cp_") || footprintName.includes("cpol") || footprintName.includes("cap_pol") || footprintName.includes("electrolytic") || footprintName.includes("tantalum")) {
    return true;
  }
  if (footprintName.includes("c_disc") || footprintName.includes("c_film") || footprintName.includes("c_rect") || footprintName.includes("c_0") || footprintName.includes("c_1") || footprintName.includes("c_2") || footprintName.includes("mlcc")) {
    return false;
  }

  // 6. Inspect symbol, reference, value
  const sym = (fp.symbol || "").toLowerCase();
  const ref = (fp.reference || "").toLowerCase();
  const val = (fp.value || "").toLowerCase();

  // If reference does not start with C, it's not a capacitor!
  if (!ref.startsWith("c")) {
    return false;
  }

  // Explicit non-polar symbol / value
  const isNonPolarExplicit =
    sym === "capacitor" ||
    sym === "c" ||
    sym === "c_small" ||
    sym === "device:c" ||
    sym.includes("unpolar") ||
    sym.includes("nonpolar") ||
    sym.includes("ceramic") ||
    sym.includes("disc") ||
    sym.includes("film") ||
    val.includes("unpolar") ||
    val.includes("nonpolar") ||
    val.includes("ceramic") ||
    val.includes("disc") ||
    val.includes("film") ||
    val.includes("mlcc") ||
    val.includes("np");

  if (isNonPolarExplicit) {
    return false;
  }

  // Explicit polar symbol / value
  const isPolarExplicit =
    sym === "capacitor_polar" ||
    sym.includes("capacitor_polar") ||
    sym.includes("cpol") ||
    sym.includes("cap_pol") ||
    sym.includes("polar") ||
    sym === "cp" ||
    sym === "device:c_polar" ||
    ref.startsWith("cp") ||
    val.includes("polar") ||
    val.includes("elec") ||
    val.includes("elko") ||
    val.includes("tant");

  if (isPolarExplicit) {
    return true;
  }

  return false;
}

export * from "./arcGeometry";
export * from "./viaGeometry";


