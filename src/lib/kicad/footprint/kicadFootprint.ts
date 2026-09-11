/**
 * Native KiCad Footprint Environment for CirZuit.
 *
 * This module keeps KiCad footprint semantics as structured objects instead of
 * flattening .kicad_mod files into images or generic shapes.  The S-expression
 * reader is an implementation detail of this environment; the rest of CirZuit
 * consumes the native model below.
 */

export const KICAD_FOOTPRINT_PROJECT_ID = "kicad%2Flibraries%2Fkicad-footprints";
export const KICAD_FOOTPRINT_REPOSITORY = "https://gitlab.com/kicad/libraries/kicad-footprints.git";
export const KICAD_GITLAB_API = "https://gitlab.com/api/v4";

import { readKicadFootprintDefinition } from "./kicadFootprintReader";
import { createDefaultFallbackFootprint } from "../generator/generator";

export type KicadFootprintLayer = string;
export type KicadPadType = "thru_hole" | "smd" | "connect" | "np_thru_hole" | "unknown";
export type KicadPadShape = "circle" | "rect" | "oval" | "roundrect" | "trapezoid" | "custom" | "unknown";

export interface KicadFootprintPoint { x: number; y: number; }

export interface KicadFootprintStroke {
  width: number;
  type?: string;
  color?: string;
}

export interface KicadFootprintGraphicBase {
  kind: string;
  layer: KicadFootprintLayer;
  stroke?: KicadFootprintStroke;
  locked?: boolean;
}

export interface KicadFootprintLine extends KicadFootprintGraphicBase {
  kind: "line";
  start: KicadFootprintPoint;
  end: KicadFootprintPoint;
}

export interface KicadFootprintRect extends KicadFootprintGraphicBase {
  kind: "rect";
  start: KicadFootprintPoint;
  end: KicadFootprintPoint;
  fill?: "none" | "solid";
  radius?: number;
}

export interface KicadFootprintCircle extends KicadFootprintGraphicBase {
  kind: "circle";
  center: KicadFootprintPoint;
  end: KicadFootprintPoint;
  fill?: "none" | "solid";
}

export interface KicadFootprintArc extends KicadFootprintGraphicBase {
  kind: "arc";
  start: KicadFootprintPoint;
  mid?: KicadFootprintPoint;
  end: KicadFootprintPoint;
  center?: KicadFootprintPoint;
  startAngle?: number;
  angle?: number;
}

export interface KicadFootprintPoly extends KicadFootprintGraphicBase {
  kind: "poly";
  points: KicadFootprintPoint[];
  fill?: "none" | "solid";
}

export interface KicadFootprintCurve extends KicadFootprintGraphicBase {
  kind: "curve";
  points: KicadFootprintPoint[];
}


export interface KicadFootprintText extends KicadFootprintGraphicBase {
  kind: "text" | "text_box";
  text: string;
  position: KicadFootprintPoint;
  size: { x: number; y: number };
  thickness?: number;
  rotation?: number;
  justify?: string[];
  italic?: boolean;
  bold?: boolean;
  mirror?: boolean;
  visible?: boolean;
  width?: number;
  height?: number;
  end?: KicadFootprintPoint;
  boxPoints?: KicadFootprintPoint[];
  angle?: number;
  fill?: "none" | "solid";
  role?: "reference" | "value" | "user" | "other";
}

export type KicadFootprintGraphic =
  | KicadFootprintLine
  | KicadFootprintRect
  | KicadFootprintCircle
  | KicadFootprintArc
  | KicadFootprintPoly
  | KicadFootprintCurve
  | KicadFootprintText;

export interface KicadPadLayerOverride {
  layer: string;
  shape?: KicadPadShape;
  size?: { x: number; y: number };
  rotation?: number;
  offset?: KicadFootprintPoint;
  roundrectRatio?: number;
  chamferRatio?: number;
  chamferCorners?: string[];
  rectDelta?: KicadFootprintPoint;
  customGraphics?: KicadFootprintGraphic[];
  clearance?: "outline" | "convexhull";
}

export interface KicadFootprintPad {
  number: string;
  type: KicadPadType;
  shape: KicadPadShape;
  position: KicadFootprintPoint;
  size: { x: number; y: number };
  rotation: number;
  layers: string[];
  drill?: number;
  drillX?: number;
  drillY?: number;
  offset?: KicadFootprintPoint;
  roundrectRatio?: number;
  chamferRatio?: number;
  chamferCorners?: string[];
  rectDelta?: KicadFootprintPoint;
  net?: { number?: number; name?: string };
  pinfunction?: string;
  pinstype?: string;
  removeUnusedLayers?: boolean;
  locked?: boolean;
  properties?: Record<string,string>;
  customGraphics?: KicadFootprintGraphic[];
  layerOverrides?: Record<string, KicadPadLayerOverride>;
  clearanceMode?: "outline" | "convexhull";
  anchorShape?: "rect" | "circle";
  customShapeInZoneMode?: "outline" | "convexhull";
  keepEndLayers?: boolean;
  thermalWidth?: number;
  thermalGap?: number;
}

export interface KicadFootprintModel {
  id: string;
  library: string;
  name: string;
  fullName: string;
  version?: number;
  generator?: string;
  layer: string;
  position: KicadFootprintPoint;
  rotation: number;
  description?: string;
  tags?: string[];
  properties: Record<string, string>;
  graphics: KicadFootprintGraphic[];
  pads: KicadFootprintPad[];
  models: Array<{ path: string; offset?: KicadFootprintPoint; scale?: KicadFootprintPoint; rotate?: KicadFootprintPoint }>;
  source: {
    type: "kicad-official" | "user" | "generated" | "imported";
    repository?: string;
    path?: string;
    commit?: string;
  };
  diagnostics: string[];
  attributes?: string[];
  mountingType?: "SMD" | "THT" | "Mixed";
  uuid?: string;
  clearance?: number;
  solderMaskMargin?: number;
  solderPasteMargin?: number;
  solderPasteRatio?: number;
  zoneConnect?: number;
  thermalWidth?: number;
  thermalGap?: number;
}

export interface KicadFootprintLibraryEntry {
  library: string;
  path: string;
  name: string;
  source: "kicad-official";
  cached: boolean;
}

interface SNode { value?: string; items: SNode[]; }

export function detectKicadFootprintRefPrefix(name: string, library?: string, properties?: Record<string, string>): string {
  // Check if properties already has a valid non-placeholder custom reference
  const propRef = properties?.Reference || properties?.reference;
  if (propRef && !/^(REF|\*|\?|U|\$\{REFERENCE\}|%R|\s*)+$/i.test(propRef)) {
    const letters = propRef.replace(/[^A-Za-z]/g, "").toUpperCase();
    if (letters && letters !== "REF" && letters !== "U") {
      return letters;
    }
  }

  const libLower = (library || "").toLowerCase();
  const lower = (name || "").toLowerCase();
  const combined = `${libLower} ${lower}`;

  // 1. Capacitors (Check first so C_0805 / C_0603 / CP_Radial are recognized as C)
  if (
    libLower.includes("capacitor") ||
    libLower.includes("cpol") ||
    lower.startsWith("c_") ||
    lower.startsWith("cp_") ||
    lower.startsWith("cap_") ||
    lower.startsWith("cpol_") ||
    lower.includes("capacitor") ||
    lower === "c" ||
    lower.includes("_c_") ||
    lower.includes("c_axial") ||
    lower.includes("c_radial") ||
    lower.includes("cp_radial") ||
    lower.includes("cp_axial") ||
    lower.includes("cp_elec") ||
    lower.includes("c_elec") ||
    lower.includes("c_disc") ||
    lower.includes("c_rect") ||
    lower.includes("c_tantal") ||
    lower.includes("tantal") ||
    lower.includes("elko") ||
    lower.includes("electrolytic") ||
    lower.includes("radial_d") ||
    lower.includes("axial_d") ||
    lower.includes("disc_d") ||
    /^c\d+/i.test(lower) ||
    /^cp\d+/i.test(lower)
  ) {
    if (combined.includes("trimmer") || combined.includes("variable")) {
      return "CV";
    }
    return "C";
  }

  // 2. Resistors & Potentiometers
  if (
    libLower.includes("resistor") ||
    libLower.includes("potentiometer") ||
    libLower.includes("trimmer") ||
    lower.startsWith("r_") ||
    lower.startsWith("res_") ||
    lower.includes("resistor") ||
    lower === "r" ||
    lower.includes("_r_") ||
    ((lower.includes("0402") || lower.includes("0603") || lower.includes("0805") || lower.includes("1206") || lower.includes("1210") || lower.includes("2012") || lower.includes("2512") || lower.includes("axial_din")) && (lower.startsWith("r") || libLower.includes("resistor"))) ||
    /^r\d+/i.test(lower)
  ) {
    if (combined.includes("potentiometer") || combined.includes("trimmer") || combined.includes("varistor")) {
      return "RV";
    }
    if (combined.includes("array") || combined.includes("network")) {
      return "RN";
    }
    return "R";
  }

  // 3. Diodes, LEDs, Rectifiers, Zeners
  if (
    libLower.includes("diode") ||
    libLower.includes("led") ||
    libLower.includes("rectifier") ||
    libLower.includes("opto") ||
    lower.startsWith("d_") ||
    lower.startsWith("led_") ||
    lower.startsWith("diode_") ||
    lower.includes("diode") ||
    lower.includes("led_") ||
    lower.includes("sod-") ||
    lower.includes("sod123") ||
    lower.includes("sod323") ||
    lower.includes("sod523") ||
    lower.includes("do-214") ||
    lower.includes("do-41") ||
    lower.includes("do-35") ||
    lower.includes("sma_") ||
    lower.includes("smb_") ||
    lower.includes("smc_") ||
    lower.includes("melf") ||
    lower.includes("minimelf") ||
    lower === "d" ||
    lower === "led" ||
    lower.includes("bridge_") ||
    /^d\d+/i.test(lower) ||
    /^led\d+/i.test(lower)
  ) {
    if (combined.includes("bridge")) return "BR";
    return "D";
  }

  // 4. Inductors, Chokes, Ferrite beads
  if (
    libLower.includes("inductor") ||
    libLower.includes("choke") ||
    libLower.includes("ferrite") ||
    libLower.includes("coil") ||
    lower.startsWith("l_") ||
    lower.startsWith("ind_") ||
    lower.startsWith("inductor_") ||
    lower.includes("inductor") ||
    lower.includes("choke") ||
    lower.includes("ferrite") ||
    lower.includes("bead") ||
    lower.includes("coil") ||
    lower === "l" ||
    lower.includes("_l_") ||
    /^l\d+/i.test(lower)
  ) {
    if (combined.includes("bead") || combined.includes("ferrite")) return "FB";
    return "L";
  }

  // 5. Transistors, FETs, MOSFETs, Regulators (SOT, TO packages)
  if (
    libLower.includes("transistor") ||
    libLower.includes("to_sot") ||
    libLower.includes("package_to") ||
    libLower.includes("package_sot") ||
    lower.startsWith("q_") ||
    lower.startsWith("transistor_") ||
    lower.includes("transistor") ||
    lower.includes("mosfet") ||
    lower.includes("bjt") ||
    lower.includes("igbt") ||
    lower.includes("jfet") ||
    lower.startsWith("sot-23") ||
    lower.startsWith("sot23") ||
    lower.startsWith("sot-89") ||
    lower.startsWith("sot89") ||
    lower.startsWith("sot-223") ||
    lower.startsWith("sot223") ||
    lower.startsWith("sot-323") ||
    lower.startsWith("sot-363") ||
    lower.startsWith("to-92") ||
    lower.startsWith("to92") ||
    lower.startsWith("to-220") ||
    lower.startsWith("to220") ||
    lower.startsWith("to-247") ||
    lower.startsWith("to-252") ||
    lower.startsWith("to-263") ||
    lower.startsWith("dpak") ||
    lower.startsWith("d2pak") ||
    lower.startsWith("sc-70") ||
    lower.startsWith("sc70") ||
    lower === "q" ||
    /^q\d+/i.test(lower)
  ) {
    return "Q";
  }

  // 6. Connectors, Headers, Terminal blocks, Sockets
  if (
    libLower.includes("connector") ||
    libLower.includes("terminal") ||
    libLower.includes("pinheader") ||
    libLower.includes("pinsocket") ||
    libLower.includes("socket") ||
    libLower.includes("jack") ||
    libLower.includes("plug") ||
    lower.startsWith("j_") ||
    lower.startsWith("conn_") ||
    lower.startsWith("connector_") ||
    lower.startsWith("pinheader_") ||
    lower.startsWith("pinsocket_") ||
    lower.startsWith("terminalblock_") ||
    lower.includes("header") ||
    lower.includes("socket") ||
    lower.includes("terminal") ||
    lower.includes("usb_") ||
    lower.includes("rj45") ||
    lower.includes("jack_") ||
    lower.includes("molex") ||
    lower.includes("jst_") ||
    lower.includes("barrel_jack") ||
    lower.includes("microsd") ||
    lower.includes("sd_card") ||
    lower === "j" ||
    /^j\d+/i.test(lower)
  ) {
    if (combined.includes("terminalblock") || combined.includes("terminal_block")) return "TB";
    return "J";
  }

  // 7. Switches, Push Buttons, Relays
  if (
    libLower.includes("button") ||
    libLower.includes("switch") ||
    libLower.includes("relay") ||
    lower.startsWith("sw_") ||
    lower.startsWith("btn_") ||
    lower.startsWith("button_") ||
    lower.startsWith("switch_") ||
    lower.includes("switch") ||
    lower.includes("pushbutton") ||
    lower.includes("tactile") ||
    lower.includes("rotary") ||
    lower.includes("dip_switch") ||
    lower.includes("relay") ||
    lower === "sw" ||
    /^sw\d+/i.test(lower)
  ) {
    return (libLower.includes("relay") || lower.includes("relay")) ? "K" : "SW";
  }

  // 8. Crystals & Oscillators
  if (
    libLower.includes("crystal") ||
    libLower.includes("oscillator") ||
    libLower.includes("resonator") ||
    lower.startsWith("y_") ||
    lower.startsWith("x_") ||
    lower.startsWith("xtal_") ||
    lower.startsWith("crystal_") ||
    lower.startsWith("oscillator_") ||
    lower.includes("crystal") ||
    lower.includes("oscillator") ||
    lower.includes("resonator") ||
    lower.includes("hc-49") ||
    lower.includes("hc49") ||
    lower === "y" ||
    lower === "x" ||
    /^y\d+/i.test(lower)
  ) {
    return "Y";
  }

  // 9. Fuses & Protection devices
  if (
    libLower.includes("fuse") ||
    libLower.includes("varistor") ||
    libLower.includes("ptc") ||
    libLower.includes("protection") ||
    lower.startsWith("f_") ||
    lower.startsWith("fuse_") ||
    lower.includes("fuse") ||
    lower.includes("polyfuse") ||
    lower.includes("fuseholder") ||
    lower === "f" ||
    /^f\d+/i.test(lower)
  ) {
    return "F";
  }

  // 10. Transformers
  if (
    libLower.includes("transformer") ||
    lower.startsWith("t_") ||
    lower.startsWith("transformer_") ||
    lower.includes("transformer") ||
    lower === "t" ||
    /^t\d+/i.test(lower)
  ) {
    return "T";
  }

  // 11. Test Points
  if (
    libLower.includes("testpoint") ||
    lower.startsWith("tp_") ||
    lower.startsWith("testpoint_") ||
    lower.includes("testpoint") ||
    lower.includes("test_point") ||
    lower === "tp" ||
    /^tp\d+/i.test(lower)
  ) {
    return "TP";
  }

  // 12. Mounting Holes & Mechanical
  if (
    libLower.includes("mounting_hole") ||
    libLower.includes("mountinghole") ||
    libLower.includes("hardware") ||
    libLower.includes("standoff") ||
    lower.startsWith("mountinghole_") ||
    lower.includes("mountinghole") ||
    lower.includes("mounting_hole") ||
    lower.startsWith("h_") ||
    lower === "h" ||
    /^h\d+/i.test(lower)
  ) {
    return "H";
  }

  // 13. Batteries
  if (
    libLower.includes("battery") ||
    lower.startsWith("bt_") ||
    lower.startsWith("battery_") ||
    lower.includes("battery") ||
    lower.includes("cr2032") ||
    lower.includes("cr2016") ||
    lower.includes("cr1220") ||
    lower.includes("18650") ||
    lower === "bt" ||
    /^bt\d+/i.test(lower)
  ) {
    return "BT";
  }

  // 14. Heatsinks
  if (
    libLower.includes("heatsink") ||
    lower.startsWith("hs_") ||
    lower.startsWith("heatsink_") ||
    lower.includes("heatsink") ||
    lower === "hs" ||
    /^hs\d+/i.test(lower)
  ) {
    return "HS";
  }

  // 15. Audio & Buzzers
  if (
    libLower.includes("buzzer") ||
    libLower.includes("speaker") ||
    lower.startsWith("bz_") ||
    lower.startsWith("spk_") ||
    lower.includes("buzzer") ||
    lower.includes("speaker") ||
    lower === "bz" ||
    /^bz\d+/i.test(lower)
  ) {
    return "BZ";
  }

  // 16. Antennas
  if (
    libLower.includes("antenna") ||
    libLower.includes("rf_") ||
    lower.startsWith("ant_") ||
    lower.includes("antenna") ||
    lower === "ant" ||
    /^ant\d+/i.test(lower)
  ) {
    return "ANT";
  }

  // Default fallback for ICs, microcontrollers, and general modules
  return "U";
}

export function footprintToPcbFootprint(fp: KicadFootprintModel, id = `kicad-fp-${Date.now()}`) {
  const copperPads = fp.pads.map((p, index) => {
    const isBottom = p.layers.includes("B.Cu") && !p.layers.includes("F.Cu");
    const shape: "rect" | "circle" = p.shape === "circle" ? "circle" : "rect";
    const layer: "top_copper" | "bottom_copper" | "multi_layer" = p.type === "thru_hole" || p.type === "np_thru_hole" ? "multi_layer" : (isBottom ? "bottom_copper" : "top_copper");
    return {
      id: `${id}-pad-${index}`,
      pinIndex: index,
      number: p.number,
      name: p.pinfunction || p.number,
      x: p.position.x,
      y: p.position.y,
      width: p.size.x,
      height: p.size.y,
      shape,
      layer,
      drill: p.drill,
      drillX: p.drillX,
      drillY: p.drillY,
      rotation: p.rotation,
      nativeShape: p.shape,
      roundrectRatio: p.roundrectRatio,
      chamferRatio: p.chamferRatio,
      chamferCorners: p.chamferCorners ? [...p.chamferCorners] : undefined,
      rectDelta: p.rectDelta ? { ...p.rectDelta } : undefined,
      layers: [...p.layers],
      offset: p.offset ? { ...p.offset } : undefined,
      customGraphics: p.customGraphics ? [...p.customGraphics] : undefined,
      nativePad: p,
      netName: p.net?.name,
    };
  });

  const prefix = detectKicadFootprintRefPrefix(fp.name || fp.fullName || "", fp.library, fp.properties);
  let ref = fp.properties.Reference || prefix;
  if (/^(REF|\*|\?|\$\{REFERENCE\}|%R|\s*)+$/i.test(ref)) {
    ref = prefix;
  }

  return {
    id,
    reference: ref,
    value: fp.properties.Value || fp.name,
    symbol: fp.fullName,
    packageId: fp.fullName,
    footprint: fp.fullName,
    x: 0,
    y: 0,
    rotation: 0,
    pads: copperPads,
    nativeKicadFootprint: fp,
    source: fp.source,
  };
}

export function footprintLayerVisible(layer: string, visibleLayers?: Record<string, boolean>): boolean {
  return visibleLayers?.[layer] !== false;
}

// Runtime registry for footprints selected from the Footprint Browser.
// The PCB document remains the persistent source of truth after placement;
// this registry is the session bridge used by Schematic -> PCB synchronization.
const assignedFootprints = new Map<string, KicadFootprintModel>();

export function registerKicadFootprint(model: KicadFootprintModel): KicadFootprintModel {
  if (model.fullName) assignedFootprints.set(model.fullName, model);
  if (model.name) assignedFootprints.set(model.name, model);
  return model;
}

export function resolveRegisteredKicadFootprint(identifier: string): KicadFootprintModel | undefined {
  const found = assignedFootprints.get(identifier) ?? assignedFootprints.get(identifier.split(":").pop() || identifier);
  if (found) return found;

  if (identifier.startsWith("Generator:") || identifier.startsWith("generator:")) {
    const rawSpec = identifier.split(":").slice(1).join(":");
    const spec = rawSpec.replace(/\s*\(.*?\)\s*/g, "").trim();
    const model = createDefaultFallbackFootprint({ symbolName: spec, packageHint: spec, value: spec });
    model.fullName = identifier;
    registerKicadFootprint(model);
    return model;
  }
  return undefined;
}

export function clearRegisteredKicadFootprints() {
  assignedFootprints.clear();
}

export class KicadFootprintLibraryService {
  private tree: KicadFootprintLibraryEntry[] = [];
  private cache = new Map<string, KicadFootprintModel>();
  private indexedLibraries = new Set<string>();
  private libraryCatalog: string[] = [];
  private defaultBranch = "master";
  private projectId = "21601606";
  private initialized = false;

  /**
   * In browser deployments GitLab can reject direct cross-origin API requests.
   * During Vite development we route through /kicad-gitlab, which is same-origin
   * to the app and then proxied server-side to the official GitLab host.
   * Production can still use direct GitLab endpoints when CORS is available.
   */
  private bases(): string[] {
    const sameOrigin = `${window.location.origin}/kicad-gitlab`;
    return [sameOrigin, KICAD_GITLAB_API];
  }

  private async getJson<T>(path: string): Promise<T> {
    let lastError: unknown;
    for (const base of this.bases()) {
      const url = path.startsWith("http") ? path : `${base}${path}`;
      try {
        const response = await fetch(url, { headers: { Accept: "application/json" } });
        if (!response.ok) {
          let detail = "";
          try { detail = (await response.text()).slice(0, 240); } catch { /* ignore */ }
          throw new Error(`GitLab request failed (${response.status})${detail ? `: ${detail}` : ""}`);
        }
        return await response.json() as T;
      } catch (error) {
        lastError = error;
      }
    }
    throw new Error(`Unable to connect to the official KiCad Footprints repository. ${lastError instanceof Error ? lastError.message : "Network/CORS error"}`);
  }

  private async getText(path: string): Promise<string> {
    let lastError: unknown;
    const direct = path.startsWith("http") ? [path] : [];
    const urls = direct.length ? direct : [
      `${window.location.origin}/kicad-gitlab${path}`,
      `${KICAD_GITLAB_API}${path}`,
    ];
    for (const url of urls) {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.text();
      } catch (error) { lastError = error; }
    }
    throw new Error(`Unable to download the selected official KiCad footprint. ${lastError instanceof Error ? lastError.message : "Network/CORS error"}`);
  }

  private apiTreeUrl(path?: string, recursive = false, page = 1): string {
    const params = new URLSearchParams({ per_page: "100", page: String(page), ref: this.defaultBranch });
    if (recursive) params.set("recursive", "true");
    if (path) params.set("path", path);
    return `/api/v4/projects/${this.projectId}/repository/tree?${params.toString()}`;
  }

  private addEntries(items: Array<{ path: string; type: string }>) {
    for (const item of items) {
      if (item.type !== "blob" || !item.path.endsWith(".kicad_mod")) continue;
      const pretty = item.path.split("/").find(p => p.endsWith(".pretty"));
      if (!pretty) continue;
      const entry: KicadFootprintLibraryEntry = {
        library: pretty.replace(/\.pretty$/, ""),
        path: item.path,
        name: item.path.split("/").pop()!.replace(/\.kicad_mod$/, ""),
        source: "kicad-official",
        cached: this.cache.has(item.path),
      };
      if (!this.tree.some(e => e.path === entry.path)) this.tree.push(entry);
    }
  }

  private async loadLibraryIndex(library: string): Promise<void> {
    const path = `${library}.pretty`;
    let page = 1;
    while (page <= 100) {
      const data = await this.getJson<Array<{ path: string; type: string }>>(this.apiTreeUrl(path, false, page));
      this.addEntries(data);
      if (data.length < 100) break;
      page++;
    }
    this.indexedLibraries.add(library);
    this.updateCacheFlags();
  }

  private async loadRootLibraries(): Promise<string[]> {
    const libraries: string[] = [];
    let page = 1;
    while (page <= 20) {
      const data = await this.getJson<Array<{ path: string; type: string }>>(this.apiTreeUrl(undefined, false, page));
      for (const item of data) {
        if (item.type === "tree" && item.path.endsWith(".pretty")) libraries.push(item.path.replace(/\.pretty$/, ""));
      }
      if (data.length < 100) break;
      page++;
    }
    return [...new Set(libraries)].sort((a, b) => a.localeCompare(b));
  }

  async initialize(): Promise<KicadFootprintLibraryEntry[]> {
    if (this.initialized && this.libraryCatalog.length) return this.tree;
    const project = await this.getJson<{ default_branch?: string }>(`/api/v4/projects/${this.projectId}`);
    this.defaultBranch = project.default_branch || "master";
    this.libraryCatalog = await this.loadRootLibraries();
    if (!this.libraryCatalog.length) throw new Error("The official KiCad repository responded, but no .pretty libraries were found.");
    this.initialized = true;
    return this.tree;
  }

  async ensureLibrary(library: string): Promise<KicadFootprintLibraryEntry[]> {
    await this.initialize();
    if (!library) return this.tree;
    if (!this.libraryCatalog.includes(library)) throw new Error(`KiCad library not found: ${library}`);
    if (!this.indexedLibraries.has(library)) await this.loadLibraryIndex(library);
    return this.tree;
  }

  async ensureSearchIndex(query: string): Promise<KicadFootprintLibraryEntry[]> {
    await this.initialize();
    const q = query.trim().toLowerCase();
    if (!q) return this.tree;
    const prefix = q.includes(":") ? q.split(":")[0].trim() : "";
    if (prefix && this.libraryCatalog.includes(prefix)) return this.ensureLibrary(prefix);
    const common = [
      "Package_DIP", "Package_SO", "Package_QFP", "Package_QFN", "Package_BGA",
      "Package_DFN_QFN", "Package_SON", "Package_LCC", "Package_SIP",
      "Resistor_SMD", "Resistor_THT", "Capacitor_SMD", "Capacitor_THT",
      "Connector", "Connector_USB", "Diode_SMD", "Diode_THT", "LED_SMD", "LED_THT",
    ];
    await Promise.all(common.filter(name => this.libraryCatalog.includes(name) && !this.indexedLibraries.has(name)).map(name => this.loadLibraryIndex(name)));
    return this.tree;
  }

  private updateCacheFlags() { this.tree = this.tree.map(e => ({ ...e, cached: this.cache.has(e.path) })); }

  listEntries(query = "", library = ""): KicadFootprintLibraryEntry[] {
    const q = query.trim().toLowerCase();
    return this.tree.filter(e => (!library || e.library === library) && (!q || `${e.library}:${e.name}`.toLowerCase().includes(q))).sort((a,b) => a.library.localeCompare(b.library) || a.name.localeCompare(b.name));
  }

  libraries(): string[] { return [...this.libraryCatalog]; }
  isLibraryIndexed(library: string) { return this.indexedLibraries.has(library); }
  isInitialized() { return this.initialized; }

  async load(entry: KicadFootprintLibraryEntry): Promise<KicadFootprintModel> {
    const cached = this.cache.get(entry.path);
    if (cached) return cached;

    const encodedPath = entry.path.split("/").map(encodeURIComponent).join("/");
    const rawPath = `/kicad/libraries/kicad-footprints/-/raw/${encodeURIComponent(this.defaultBranch)}/${encodedPath}`;
    let text: string;
    try {
      text = await this.getText(rawPath);
    } catch {
      const apiPath = `/api/v4/projects/${this.projectId}/repository/files/${encodeURIComponent(entry.path)}/raw?ref=${encodeURIComponent(this.defaultBranch)}`;
      text = await this.getText(apiPath);
    }
    const parsed = readKicadFootprintDefinition(text, { path: entry.path, commit: this.defaultBranch, repository: KICAD_FOOTPRINT_REPOSITORY });
    this.cache.set(entry.path, parsed);
    this.updateCacheFlags();
    return parsed;
  }

  officialLibraryUrl(library?: string) {
    return `https://gitlab.com/kicad/libraries/kicad-footprints/-/tree/${encodeURIComponent(this.defaultBranch)}${library ? `/${encodeURIComponent(library)}.pretty` : ""}`;
  }

  clearCache() { this.cache.clear(); this.updateCacheFlags(); }
  getCached(path: string) { return this.cache.get(path); }
}

export const kicadFootprintLibrary = new KicadFootprintLibraryService();

export function classifyFootprintMountingType(fp: KicadFootprintModel): "SMD" | "THT" | "Mixed" | "Unknown" {
  let smd = false, tht = false;
  for (const p of fp.pads) {
    if (p.type === "smd") smd = true;
    if (p.type === "thru_hole" || p.type === "np_thru_hole") tht = true;
  }
  if (smd && tht) return "Mixed";
  if (smd) return "SMD";
  if (tht) return "THT";
  return "Unknown";
}
