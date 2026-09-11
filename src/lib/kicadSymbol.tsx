/**
 * CirZuit KiCad Symbol Environment.
 *
 * This module is intentionally structured as a KiCad-compatible symbol
 * runtime, not as a one-off file converter:
 *
 *   .kicad_sym -> S-expression reader -> KiCad symbol object model
 *               -> unit/body-style selection -> geometry/text transforms
 *               -> CirZuit SVG renderer
 *
 * The reader is only the file-I/O boundary. The rest of the application
 * works with KiCad-style symbol objects.
 *
 * Based on the official KiCad S-expression symbol library format
 * (https://dev-docs.kicad.org/en/file-formats/sexpr-symbol-lib/)
 * and the drawing model used by KiCad / KiCanvas (graphics primitives:
 * polyline, rectangle, circle, arc, text + pins with electrical type).
 *
 * Coordinate system: KiCad schematic symbols use millimetres with Y
 * increasing upward in the file; we flip Y when converting to our
 * SVG-friendly top-left origin so the symbol appears un-mirrored.
 *
 * Scaling: 1 KiCad mm ≈ KICAD_SCALE schematic units so that a typical
 * 2.54 mm pin length maps cleanly onto the existing grid.
 */

import type { JSX } from "react";
import type { PinDef, SymbolDef, SymbolCategory } from "./symbols";
import { makeNativeKiCadDrawFn } from "./kicadRenderer";
import { WORLD_UNITS_PER_KICAD_MM, kicadPointToWorld } from "./kicadCoordinateSystem";

function kx(x: number, bbox: { minX: number; minY: number; maxX: number; maxY: number }): number {
  return (x - bbox.minX) * WORLD_UNITS_PER_KICAD_MM;
}
function ky(y: number, bbox: { minX: number; minY: number; maxX: number; maxY: number }): number {
  return (bbox.maxY - y) * WORLD_UNITS_PER_KICAD_MM;
}

// ---------------------------------------------------------------------------
// S-expression tokenizer / parser (compatible with KiCad quoting)
// ---------------------------------------------------------------------------

type SExprToken = { type: "paren" | "string" | "atom"; value: string };
type SExpr = string | SExpr[];

function tokenizeSExpr(text: string): SExprToken[] {
  const tokens: SExprToken[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
    } else if (ch === '"') {
      let str = "";
      i++;
      while (i < text.length) {
        if (text[i] === "\\" && i + 1 < text.length) {
          // KiCad escapes: \" \\ \n \r \t
          const next = text[i + 1];
          if (next === "n") str += "\n";
          else if (next === "r") str += "\r";
          else if (next === "t") str += "\t";
          else str += next;
          i += 2;
        } else if (text[i] === '"') {
          i++;
          break;
        } else {
          str += text[i];
          i++;
        }
      }
      tokens.push({ type: "string", value: str });
    } else if (/\s/.test(ch) || ch === "#") {
      // skip whitespace and full-line comments starting with #
      if (ch === "#") {
        while (i < text.length && text[i] !== "\n") i++;
      } else {
        i++;
      }
    } else {
      let atom = "";
      while (i < text.length && !/\s|\(|\)|"/.test(text[i])) {
        atom += text[i];
        i++;
      }
      tokens.push({ type: "atom", value: atom });
    }
  }
  return tokens;
}

function parseSExpr(tokens: SExprToken[]): SExpr {
  let index = 0;
  function parseNode(): SExpr {
    const list: SExpr[] = [];
    if (index >= tokens.length || tokens[index].type !== "paren" || tokens[index].value !== "(") {
      return list;
    }
    index++; // skip '('
    while (index < tokens.length) {
      const tok = tokens[index];
      if (tok.type === "paren" && tok.value === ")") {
        index++;
        break;
      }
      if (tok.type === "paren" && tok.value === "(") {
        list.push(parseNode());
      } else {
        list.push(tok.value);
        index++;
      }
    }
    return list;
  }
  // skip leading junk until first (
  while (index < tokens.length && (tokens[index].type !== "paren" || tokens[index].value !== "(")) index++;
  return parseNode();
}

function isList(x: SExpr): x is SExpr[] {
  return Array.isArray(x);
}

function head(x: SExpr): string | null {
  return isList(x) && typeof x[0] === "string" ? (x[0] as string) : null;
}

function findChild(list: SExpr[], name: string): SExpr[] | null {
  for (const item of list) {
    if (isList(item) && head(item) === name) return item as SExpr[];
  }
  return null;
}

function findAll(list: SExpr[], name: string): SExpr[][] {
  const out: SExpr[][] = [];
  for (const item of list) {
    if (isList(item) && head(item) === name) out.push(item as SExpr[]);
  }
  return out;
}

function hasAtom(list: SExpr[] | null | undefined, value: string): boolean {
  return !!list?.some(item => !isList(item) && String(item) === value);
}

function num(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : fallback;
}

// ---------------------------------------------------------------------------
// Geometry model (after parsing, in KiCad mm, Y-up)
// ---------------------------------------------------------------------------

export type KiCadStroke = { width: number; type: string };
export type KiCadFill = { type: "none" | "outline" | "background" | string };

export interface KiCadBezier {
  type: "bezier";
  pts: { x: number; y: number }[];
  stroke: KiCadStroke;
  fill: KiCadFill;
  unit?: number;
  bodyStyle?: number;
}

export interface KicadTextJustification {
  horizontal?: "left" | "center" | "right";
  vertical?: "top" | "center" | "bottom";
  mirror?: boolean;
}

export interface KicadFont {
  face?: string;
  size: { x: number; y: number };
  thickness?: number;
  bold?: boolean;
  italic?: boolean;
}

export interface KicadTextEffects {
  font: KicadFont;
  justify: KicadTextJustification;
  lineSpacing?: number;
  hidden?: boolean;
}

export interface KiCadText {
  type: "text";
  text: string;
  at: { x: number; y: number; angle: number };
  effects: KicadTextEffects;
  hide?: boolean;
  unit?: number;
  bodyStyle?: number;
}

export interface KiCadProperty {
  name: string;
  value: string;
  at: { x: number; y: number; angle: number };
  effects: KicadTextEffects;
  hide: boolean;
}

export interface KiCadPolyline {
  type: "polyline";
  pts: { x: number; y: number }[];
  stroke: KiCadStroke;
  fill: KiCadFill;
  unit?: number;
  bodyStyle?: number;
}

export interface KiCadRectangle {
  type: "rectangle";
  start: { x: number; y: number };
  end: { x: number; y: number };
  stroke: KiCadStroke;
  fill: KiCadFill;
  unit?: number;
  bodyStyle?: number;
}

export interface KiCadCircle {
  type: "circle";
  center: { x: number; y: number };
  radius: number;
  stroke: KiCadStroke;
  fill: KiCadFill;
  unit?: number;
  bodyStyle?: number;
}

export interface KiCadArc {
  type: "arc";
  start: { x: number; y: number };
  mid: { x: number; y: number };
  end: { x: number; y: number };
  stroke: KiCadStroke;
  fill: KiCadFill;
  unit?: number;
  bodyStyle?: number;
}

export interface KiCadTextBox {
  type: "text_box";
  text: string;
  at: { x: number; y: number; angle: number };
  size: { x: number; y: number };
  stroke: KiCadStroke;
  fill: KiCadFill;
  effects: KicadTextEffects;
  hide?: boolean;
  unit?: number;
  bodyStyle?: number;
}

export type KiCadGraphic =
  | KiCadPolyline
  | KiCadRectangle
  | KiCadCircle
  | KiCadArc
  | KiCadBezier
  | KiCadText
  | KiCadTextBox;

export interface KiCadPin {
  electrical: string;
  shape: string;
  at: { x: number; y: number; angle: number };
  length: number;
  name: string;
  number: string;
  nameEffects: KicadTextEffects;
  numberEffects: KicadTextEffects;
  hide?: boolean;
  unit?: number;
  bodyStyle?: number;
}

export interface KicadTransform {
  x: number;
  y: number;
  rotation: number;
  mirrorX: boolean;
  mirrorY: boolean;
}

export interface KicadSymbolUnit {
  unit: number;
  style: number;
  graphics: KiCadGraphic[];
  pins: KiCadPin[];
}

export interface KiCadParsedSymbol {
  name: string;
  libNickname?: string;
  reference: string;
  value: string;
  description?: string;
  keywords?: string;
  footprint?: string;
  properties: KiCadProperty[];
  pinNamesOffset: number;
  pinNamesHide: boolean;
  pinNumbersHide: boolean;
  units: KicadSymbolUnit[];
  selectedUnit: number;
  selectedBodyStyle: number;
  extends?: string;
  isPower?: boolean;
  excludeFromSim?: boolean;
  inBom?: boolean;
  onBoard?: boolean;
  unitNames?: Record<number, string>;
  bodyGraphics: KiCadGraphic[];
  pins: KiCadPin[];
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface KicadSymbolEnvironment {
  version: number;
  symbols: Map<string, KiCadParsedSymbol>;
  resolve(name: string, library?: string): KiCadParsedSymbol | undefined;
}

// ---------------------------------------------------------------------------
// Parsing helpers for stroke / fill / pts
// ---------------------------------------------------------------------------

function parseStroke(node: SExpr[] | null): KiCadStroke {
  if (!node) return { width: 0, type: "default" };
  const w = findChild(node, "width");
  const t = findChild(node, "type");
  return {
    width: num(w?.[1], 0),
    type: String(t?.[1] ?? "default"),
  };
}

function parseFill(node: SExpr[] | null): KiCadFill {
  if (!node) return { type: "none" };
  const t = findChild(node, "type");
  return { type: String(t?.[1] ?? "none") };
}

function parsePts(node: SExpr[] | null): { x: number; y: number }[] {
  if (!node) return [];
  const pts: { x: number; y: number }[] = [];
  for (const item of node) {
    if (isList(item) && head(item) === "xy") {
      pts.push({ x: num(item[1]), y: num(item[2]) });
    }
  }
  return pts;
}

function parseAt(node: SExpr[] | null): { x: number; y: number; angle: number } {
  if (!node) return { x: 0, y: 0, angle: 0 };
  return { x: num(node[1]), y: num(node[2]), angle: num(node[3], 0) };
}

function parseJustification(node: SExpr[] | null): KicadTextJustification {
  if (!node) return {};
  const values = node.slice(1).map(String);
  const result: KicadTextJustification = {};
  for (const value of values) {
    if (value === "left" || value === "right") result.horizontal = value;
    else if (value === "top" || value === "bottom") result.vertical = value;
    else if (value === "mirror") result.mirror = true;
  }
  if (!result.horizontal) result.horizontal = "center";
  if (!result.vertical) result.vertical = "center";
  return result;
}

function parseTextEffects(node: SExpr[] | null, defaultSize = 1.27): KicadTextEffects {
  const font = findChild(node || [], "font");
  const sizeNode = findChild(font || [], "size");
  const sizeX = num(sizeNode?.[1], defaultSize);
  const sizeY = num(sizeNode?.[2], sizeX);
  const thicknessNode = findChild(font || [], "thickness");
  const faceNode = findChild(font || [], "face");
  const lineSpacingNode = findChild(node || [], "line_spacing");

  return {
    font: {
      face: typeof faceNode?.[1] === "string" ? String(faceNode[1]) : undefined,
      size: { x: sizeX, y: sizeY },
      thickness: thicknessNode ? num(thicknessNode[1]) : undefined,
      bold: !!findChild(font || [], "bold"),
      italic: !!findChild(font || [], "italic"),
    },
    justify: parseJustification(findChild(node || [], "justify")),
    lineSpacing: lineSpacingNode ? num(lineSpacingNode[1]) : undefined,
    hidden: hasAtom(node, "hide") || !!findChild(node || [], "hide"),
  };
}

function parseTextNode(item: SExpr[], unit?: number, bodyStyle?: number): KiCadText | null {
  if (head(item) !== "text") return null;
  const textVal = typeof item[1] === "string" ? item[1] : "";
  const at = parseAt(findChild(item, "at"));
  const effects = parseTextEffects(findChild(item, "effects"));
  const hidden = effects.hidden || !!findChild(item, "hide");
  return {
    type: "text",
    text: textVal,
    at,
    effects,
    hide: hidden,
    unit,
    bodyStyle,
  };
}

function parsePropertyNode(item: SExpr[]): KiCadProperty | null {
  if (head(item) !== "property") return null;
  const name = String(item[1] ?? "");
  const value = String(item[2] ?? "");
  const at = parseAt(findChild(item, "at"));
  const effects = parseTextEffects(findChild(item, "effects"));
  return {
    name,
    value,
    at,
    effects,
    hide: hasAtom(item, "hide") || !!findChild(item, "hide") || !!effects.hidden,
  };
}

function parseTextBoxNode(item: SExpr[], unit?: number, bodyStyle?: number): KiCadTextBox | null {
  if (head(item) !== "text_box") return null;
  const text = typeof item[1] === "string" ? item[1] : "";
  const at = parseAt(findChild(item, "at"));
  const size = findChild(item, "size");
  return {
    type: "text_box",
    text,
    at,
    size: { x: num(size?.[1]), y: num(size?.[2]) },
    stroke: parseStroke(findChild(item, "stroke")),
    fill: parseFill(findChild(item, "fill")),
    effects: parseTextEffects(findChild(item, "effects")),
    hide: hasAtom(item, "hide") || !!findChild(item, "hide"),
    unit,
    bodyStyle,
  };
}

function parseGraphic(item: SExpr[]): KiCadGraphic | null {
  const kind = head(item);
  if (!kind) return null;

  if (kind === "polyline") {
    return {
      type: "polyline",
      pts: parsePts(findChild(item, "pts")),
      stroke: parseStroke(findChild(item, "stroke")),
      fill: parseFill(findChild(item, "fill")),
    };
  }
  if (kind === "rectangle") {
    const start = findChild(item, "start");
    const end = findChild(item, "end");
    return {
      type: "rectangle",
      start: { x: num(start?.[1]), y: num(start?.[2]) },
      end: { x: num(end?.[1]), y: num(end?.[2]) },
      stroke: parseStroke(findChild(item, "stroke")),
      fill: parseFill(findChild(item, "fill")),
    };
  }
  if (kind === "circle") {
    const center = findChild(item, "center");
    const radius = findChild(item, "radius");
    return {
      type: "circle",
      center: { x: num(center?.[1]), y: num(center?.[2]) },
      radius: num(radius?.[1]),
      stroke: parseStroke(findChild(item, "stroke")),
      fill: parseFill(findChild(item, "fill")),
    };
  }
  if (kind === "arc") {
    const start = findChild(item, "start");
    const mid = findChild(item, "mid");
    const end = findChild(item, "end");
    return {
      type: "arc",
      start: { x: num(start?.[1]), y: num(start?.[2]) },
      mid: { x: num(mid?.[1]), y: num(mid?.[2]) },
      end: { x: num(end?.[1]), y: num(end?.[2]) },
      stroke: parseStroke(findChild(item, "stroke")),
      fill: parseFill(findChild(item, "fill")),
    };
  }
  if (kind === "bezier") {
    return {
      type: "bezier",
      pts: parsePts(findChild(item, "pts")),
      stroke: parseStroke(findChild(item, "stroke")),
      fill: parseFill(findChild(item, "fill")),
    };
  }
  if (kind === "text") {
    return parseTextNode(item);
  }
  if (kind === "text_box") {
    return parseTextBoxNode(item);
  }
  return null;
}

function parsePin(item: SExpr[], unit?: number, bodyStyle?: number): KiCadPin | null {
  if (head(item) !== "pin") return null;
  const electrical = String(item[1] ?? "passive");
  const shape = String(item[2] ?? "line");
  const at = parseAt(findChild(item, "at"));
  const lengthNode = findChild(item, "length");
  const length = num(lengthNode?.[1], 2.54);
  const nameNode = findChild(item, "name");
  const numberNode = findChild(item, "number");
  const name = typeof nameNode?.[1] === "string" ? nameNode[1] : "~";
  const number = typeof numberNode?.[1] === "string" ? numberNode[1] : "";
  const nameEffects = parseTextEffects(findChild(nameNode || [], "effects"), 1.27);
  const numberEffects = parseTextEffects(findChild(numberNode || [], "effects"), 1.27);
  const hide = hasAtom(item, "hide") || !!findChild(item, "hide");
  return {
    electrical,
    shape,
    at,
    length,
    name,
    number,
    nameEffects,
    numberEffects,
    hide,
    unit,
    bodyStyle,
  };
}

/**
 * Parse a single top-level (symbol "Name" ...) node.
 */
function parseOneSymbol(symNode: SExpr[], libNickname?: string): KiCadParsedSymbol | null {
  if (head(symNode) !== "symbol") return null;
  const name = String(symNode[1] ?? "");
  if (!name || /_\d+_\d+$/.test(name)) return null;

  let reference = "";
  let value = "";
  let description = "";
  let keywords = "";
  let footprint = "";
  let pinNamesOffset = 0.508;
  let pinNamesHide = false;
  let pinNumbersHide = false;
  let extendsName: string | undefined;
  let isPower = false;
  let excludeFromSim = false;
  let inBom = true;
  let onBoard = true;
  const unitNames: Record<number, string> = {};

  const properties: KiCadProperty[] = [];
  const unitsMap = new Map<string, KicadSymbolUnit>();

  const ensureUnit = (unit: number, style: number): KicadSymbolUnit => {
    const key = `${unit}_${style}`;
    const existing = unitsMap.get(key);
    if (existing) return existing;
    const created: KicadSymbolUnit = { unit, style, graphics: [], pins: [] };
    unitsMap.set(key, created);
    return created;
  };

  for (const item of symNode) {
    if (!isList(item)) continue;
    const h = head(item);

    if (h === "property") {
      const prop = parsePropertyNode(item);
      if (prop) {
        properties.push(prop);
        if (prop.name === "Reference") reference = prop.value;
        else if (prop.name === "Value") value = prop.value;
        else if (prop.name === "Description") description = prop.value;
        else if (prop.name === "ki_keywords") keywords = prop.value;
        else if (prop.name === "Footprint") footprint = prop.value;
      }
    } else if (h === "pin_names") {
      const off = findChild(item, "offset");
      if (off) pinNamesOffset = num(off[1], 0.508);
      if (hasAtom(item, "hide") || findChild(item, "hide")) pinNamesHide = true;
    } else if (h === "pin_numbers") {
      if (hasAtom(item, "hide") || findChild(item, "hide")) pinNumbersHide = true;
    } else if (h === "extends") {
      extendsName = String(item[1] ?? "");
    } else if (h === "power") {
      isPower = true;
    } else if (h === "exclude_from_sim") {
      excludeFromSim = String(item[1] ?? "no") === "yes";
    } else if (h === "in_bom") {
      inBom = String(item[1] ?? "yes") !== "no";
    } else if (h === "on_board") {
      onBoard = String(item[1] ?? "yes") !== "no";
    } else if (h === "symbol") {
      const unitName = String(item[1] ?? "");
      const m = unitName.match(/_(\d+)_(\d+)$/);
      const unit = m ? parseInt(m[1], 10) : 0;
      const style = m ? parseInt(m[2], 10) : 1;
      const target = ensureUnit(unit, style);

      for (const child of item) {
        if (!isList(child)) continue;
        const ch = head(child);
        if (ch === "unit_name") {
          unitNames[unit] = String(child[1] ?? "");
        } else if (ch === "pin") {
          const p = parsePin(child, unit, style);
          if (p) target.pins.push(p);
        } else {
          const g = parseGraphic(child as SExpr[]);
          if (g) {
            (g as KiCadGraphic & { unit?: number; bodyStyle?: number }).unit = unit;
            (g as KiCadGraphic & { unit?: number; bodyStyle?: number }).bodyStyle = style;
            target.graphics.push(g);
          }
        }
      }
    } else if (h === "pin") {
      const target = ensureUnit(1, 1);
      const p = parsePin(item, 1, 1);
      if (p) target.pins.push(p);
    }
  }

  // Symbols without explicit Reference/Value properties use KiCad defaults.
  // Derived symbols deliberately keep these empty so the environment can
  // inherit the base symbol's metadata.
  if (!extendsName) {
    if (!reference) reference = "U";
    if (!value) value = name;
  }

  // KiCad's library representation keeps common body graphics in unit 0.
  // At runtime we resolve the requested electrical unit plus common unit 0.
  const allCommonUnits = Array.from(unitsMap.values()).filter(u => u.unit === 0);
  const primaryUnits = Array.from(unitsMap.values()).filter(u => u.unit === 1);
  const primary = primaryUnits.find(u => u.style === 1) || primaryUnits[0] || Array.from(unitsMap.values())[0] || ensureUnit(1, 1);

  const bodyGraphics: KiCadGraphic[] = [
    ...allCommonUnits.flatMap(u => u.graphics),
    ...primaryUnits.flatMap(u => u.graphics),
  ];
  const pins = [
    ...allCommonUnits.flatMap(u => u.pins),
    ...primaryUnits.flatMap(u => u.pins),
  ];

  const bbox = computeKicadBoundingBox(bodyGraphics, pins);

  return {
    name,
    libNickname,
    reference,
    value,
    description,
    keywords,
    footprint,
    properties,
    pinNamesOffset,
    pinNamesHide,
    pinNumbersHide,
    units: Array.from(unitsMap.values()),
    selectedUnit: primary.unit,
    selectedBodyStyle: primary.style,
    extends: extendsName,
    isPower,
    excludeFromSim,
    inBom,
    onBoard,
    unitNames,
    bodyGraphics,
    pins,
    bbox,
  };
}

/**
 * Parse an entire .kicad_sym library file.
 * Returns every top-level symbol (skips nested unit definitions).
 */
export function parseKiCadSymbolLib(text: string, libNickname?: string): KiCadParsedSymbol[] {
  if (!text || typeof text !== "string") return [];
  if (!text.includes("kicad_symbol_lib") && !text.includes("(symbol ")) return [];

  const tokens = tokenizeSExpr(text);
  const ast = parseSExpr(tokens);
  if (!isList(ast)) return [];

  const symbols: KiCadParsedSymbol[] = [];
  const root = head(ast) === "kicad_symbol_lib" ? ast : ([["kicad_symbol_lib"], ...[ast]] as SExpr[]);

  for (const item of root as SExpr[]) {
    if (!isList(item) || head(item) !== "symbol") continue;
    // only top-level symbols whose name does NOT end with _N_M
    const symName = String(item[1] ?? "");
    if (/_\d+_\d+$/.test(symName)) continue;
    const parsed = parseOneSymbol(item as SExpr[], libNickname);
    if (parsed) symbols.push(parsed);
  }
  return symbols;
}

// ---------------------------------------------------------------------------
// SVG rendering (faithful to KiCad)
// ---------------------------------------------------------------------------

/** Schematic units per KiCad millimetre. Chosen so 2.54 mm pin ≈ 1.0 unit. */
export const KICAD_SCALE = WORLD_UNITS_PER_KICAD_MM;

/**
 * Legacy compatibility entry point. The actual renderer now lives in
 * kicadRenderer.tsx and consumes the native KiCad object model directly.
 * This function remains only so existing CirZuit callers do not break.
 */
export function makeKiCadDrawFn(sym: KiCadParsedSymbol): (stroke: string) => JSX.Element {
  return makeNativeKiCadDrawFn(sym);
}

/**
 * Convert a parsed KiCad symbol into the project's SymbolDef so it plugs
 * straight into Canvas / SymbolPreview / placement without any special cases.
 */
export function kicadToSymbolDef(parsed: KiCadParsedSymbol, idOverride?: string): SymbolDef {
  const { bbox, pins, reference, value, name } = parsed;
  const width = Math.max(0.5, (bbox.maxX - bbox.minX) * KICAD_SCALE);
  const height = Math.max(0.5, (bbox.maxY - bbox.minY) * KICAD_SCALE);

  const pinDefs: PinDef[] = pins.map((p) => {
    // The electrical connection point is KiCad's `at` coordinate.
    // Pin length extends inward toward the symbol body.
    return {
      x: kx(p.at.x, bbox),
      y: ky(p.at.y, bbox),
      number: p.number || undefined,
      name: p.name && p.name !== "~" ? p.name : p.number || undefined,
      hide: p.hide,
    };
  });

  const id = idOverride || `kicad:${parsed.libNickname ? parsed.libNickname + ":" : ""}${name}`;

  // Guess category from keywords / name
  let category: SymbolCategory = parsed.isPower ? "power" : "ic";
  const kw = `${name} ${parsed.keywords || ""} ${value}`.toLowerCase();
  if (/resistor|device:r\b|^r_/.test(kw)) category = "passive";
  else if (/capacitor|device:c\b/.test(kw)) category = "passive";
  else if (/inductor|device:l\b/.test(kw)) category = "passive";
  else if (/diode|led|zener/.test(kw)) category = "semi";
  else if (/transistor|mosfet|bjt|fet/.test(kw)) category = "semi";
  else if (/connector|pin_header|socket/.test(kw)) category = "connector";
  else if (/opamp|amplifier/.test(kw)) category = "amplifier";
  else if (/mcu|microcontroller|stm32|esp32|arduino/.test(kw)) category = "mcu";
  else if (/gnd|ground|pwr|vcc|vdd|power/.test(kw)) category = "power";
  else if (/switch|button|relay/.test(kw)) category = "control";
  else if (/fuse|varistor|tvs|protection/.test(kw)) category = "protection";

  return {
    id,
    category,
    width,
    height,
    pins: pinDefs,
    prefix: reference.replace(/[^A-Za-z]/g, "") || "U",
    defaultValue: value || name,
    draw: makeKiCadDrawFn(parsed),
  };
}

// ---------------------------------------------------------------------------
// KiCad Symbol Environment
// ---------------------------------------------------------------------------

/**
 * Runtime environment mirroring the conceptual KiCad LIB_SYMBOL model:
 * library symbol definitions contain units/body styles; a selected runtime
 * view is then rendered without flattening the source into a generic
 * hand-drawn SymbolDef.
 */
export function createKicadSymbolEnvironment(
  parsedSymbols: KiCadParsedSymbol[],
): KicadSymbolEnvironment {
  const raw = new Map<string, KiCadParsedSymbol>();
  for (const symbol of parsedSymbols) {
    raw.set(
      symbol.libNickname ? `${symbol.libNickname}:${symbol.name}` : symbol.name,
      symbol,
    );
    raw.set(symbol.name, symbol);
  }

  const cache = new Map<string, KiCadParsedSymbol>();
  const resolving = new Set<string>();

  const cloneSymbol = (s: KiCadParsedSymbol): KiCadParsedSymbol => ({
    ...s,
    properties: s.properties.map(p => ({
      ...p,
      at: { ...p.at },
      effects: {
        ...p.effects,
        font: { ...p.effects.font, size: { ...p.effects.font.size } },
        justify: { ...p.effects.justify },
      },
    })),
    units: s.units.map(u => ({
      ...u,
      graphics: [...u.graphics],
      pins: u.pins.map(p => ({
        ...p,
        at: { ...p.at },
        nameEffects: {
          ...p.nameEffects,
          font: { ...p.nameEffects.font, size: { ...p.nameEffects.font.size } },
          justify: { ...p.nameEffects.justify },
        },
        numberEffects: {
          ...p.numberEffects,
          font: { ...p.numberEffects.font, size: { ...p.numberEffects.font.size } },
          justify: { ...p.numberEffects.justify },
        },
      })),
    })),
    bodyGraphics: [...s.bodyGraphics],
    pins: [...s.pins],
    unitNames: { ...(s.unitNames ?? {}) },
    bbox: { ...s.bbox },
  });

  const resolve = (name: string, library?: string): KiCadParsedSymbol | undefined => {
    const key = library ? `${library}:${name}` : name;
    const direct = raw.get(key) ?? raw.get(name);
    if (!direct) return undefined;
    const cacheKey = direct.libNickname ? `${direct.libNickname}:${direct.name}` : direct.name;
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    if (resolving.has(cacheKey)) return direct; // defensive cycle break

    resolving.add(cacheKey);
    const result = cloneSymbol(direct);

    if (direct.extends) {
      const base =
        raw.get(direct.extends) ??
        (direct.libNickname ? raw.get(`${direct.libNickname}:${direct.extends}`) : undefined);

      if (base) {
        const resolvedBase = resolve(base.name, base.libNickname);
        if (resolvedBase) {
          const ownUnits = result.units;
          const mergedUnits = new Map<string, KicadSymbolUnit>();

          for (const u of resolvedBase.units) {
            mergedUnits.set(`${u.unit}_${u.style}`, {
              unit: u.unit,
              style: u.style,
              graphics: [...u.graphics],
              pins: [...u.pins],
            });
          }
          for (const u of ownUnits) {
            const keyU = `${u.unit}_${u.style}`;
            const existing = mergedUnits.get(keyU);
            if (existing) {
              existing.graphics.push(...u.graphics);
              if (u.pins.length) existing.pins = [...u.pins];
            } else {
              mergedUnits.set(keyU, {
                unit: u.unit,
                style: u.style,
                graphics: [...u.graphics],
                pins: [...u.pins],
              });
            }
          }

          result.units = Array.from(mergedUnits.values());
          const allCommonUnits = result.units.filter(u => u.unit === 0);
          const primaryUnits = result.units.filter(u => u.unit === (direct.selectedUnit || 1))
            .length > 0
              ? result.units.filter(u => u.unit === (direct.selectedUnit || 1))
              : result.units.filter(u => u.unit === 1).length > 0
                ? result.units.filter(u => u.unit === 1)
                : result.units;

          result.bodyGraphics = [
            ...allCommonUnits.flatMap(u => u.graphics),
            ...primaryUnits.flatMap(u => u.graphics),
          ];
          result.pins = [
            ...allCommonUnits.flatMap(u => u.pins),
            ...primaryUnits.flatMap(u => u.pins),
          ];
          result.bbox = computeKicadBoundingBox(result.bodyGraphics, result.pins, result.properties);
          result.reference = direct.reference || resolvedBase.reference;
          result.value = direct.value || resolvedBase.value;
          result.description = direct.description || resolvedBase.description;
          result.keywords = direct.keywords || resolvedBase.keywords;
          result.footprint = direct.footprint || resolvedBase.footprint;
          result.properties = [
            ...resolvedBase.properties.filter(bp =>
              !direct.properties.some(dp => dp.name === bp.name)
            ),
            ...direct.properties,
          ];
          result.isPower = direct.isPower || resolvedBase.isPower;
          result.excludeFromSim = direct.excludeFromSim ?? resolvedBase.excludeFromSim;
          result.inBom = direct.inBom ?? resolvedBase.inBom;
          result.onBoard = direct.onBoard ?? resolvedBase.onBoard;
          result.unitNames = { ...(resolvedBase.unitNames ?? {}), ...(direct.unitNames ?? {}) };
        }
      }
    }

    resolving.delete(cacheKey);
    cache.set(cacheKey, result);
    return result;
  };

  return {
    version: 1,
    symbols: raw,
    resolve,
  };
}

/** Pin body end point (connection point + length along pin angle). */
function pinBodyEnd(pin: KiCadPin) {
  // KiCad pin `at` is the electrical connection point. The pin body extends
  // in the direction specified by `angle` for `length` millimetres.
  const r = (pin.at.angle * Math.PI) / 180;
  return {
    x: pin.at.x + Math.cos(r) * pin.length,
    y: pin.at.y + Math.sin(r) * pin.length,
  };
}

/** Recompute a conservative geometric bounding box from the effective KiCad unit view. */
export function computeKicadBoundingBox(
  graphics: KiCadGraphic[],
  pins: KiCadPin[],
  _properties: KiCadProperty[] = [],
): KiCadParsedSymbol["bbox"] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };
  for (const g of graphics) {
    if (g.type === "polyline") g.pts.forEach(p => expand(p.x, p.y));
    else if (g.type === "rectangle") {
      expand(g.start.x, g.start.y); expand(g.end.x, g.end.y);
    } else if (g.type === "circle") {
      expand(g.center.x - g.radius, g.center.y - g.radius);
      expand(g.center.x + g.radius, g.center.y + g.radius);
    } else if (g.type === "arc") {
      expand(g.start.x, g.start.y); expand(g.mid.x, g.mid.y); expand(g.end.x, g.end.y);
    } else if (g.type === "bezier") {
      g.pts.forEach(p => expand(p.x, p.y));
    } else if (g.type === "text" && !g.hide) {
      expand(g.at.x, g.at.y);
    }
  }
  for (const p of pins) {
    if (p.hide) continue;
    expand(p.at.x, p.at.y);
    const end = pinBodyEnd(p);
    expand(end.x, end.y);
  }
  if (!Number.isFinite(minX)) return { minX: -2.54, minY: -2.54, maxX: 2.54, maxY: 2.54 };
  const pad = 0.254; // 10 mil safety padding
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

/** Return the unit/body-style view without destroying the original definition. */
export function resolveKicadUnit(
  symbol: KiCadParsedSymbol,
  unit = symbol.selectedUnit || 1,
  bodyStyle = symbol.selectedBodyStyle || 1,
): { graphics: KiCadGraphic[]; pins: KiCadPin[] } {
  const common =
    symbol.units.find(u => u.unit === 0 && u.style === bodyStyle) ??
    symbol.units.find(u => u.unit === 0) ??
    null;
  const selected =
    symbol.units.find(u => u.unit === unit && u.style === bodyStyle) ??
    symbol.units.find(u => u.unit === unit) ??
    null;

  return {
    graphics: [
      ...(common?.graphics ?? []),
      ...(selected?.graphics ?? []),
    ],
    pins: [...(selected?.pins ?? [])],
  };
}

// ---------------------------------------------------------------------------
// Runtime registry for imported symbols with LocalStorage persistence
// ---------------------------------------------------------------------------

const importedRegistry = new Map<string, SymbolDef>();
const importedParsed = new Map<string, KiCadParsedSymbol>();

// Auto-load persisted KiCad symbols from localStorage on startup
if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
  try {
    const stored = localStorage.getItem("cirzuit_kicad_environment_v2");
    if (stored) {
      const parsedList: KiCadParsedSymbol[] = JSON.parse(stored);
      if (Array.isArray(parsedList)) {
        for (const p of parsedList) {
          try {
            const def = kicadToSymbolDef(p);
            importedRegistry.set(def.id, def);
            importedParsed.set(def.id, p);
          } catch {
            /* ignore corrupted individual symbol */
          }
        }
      }
    }
  } catch (e) {
    console.warn("Failed to load persisted KiCad symbols:", e);
  }
}

function persistImportedSymbols() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;
  try {
    const list = Array.from(importedParsed.values());
    localStorage.setItem("cirzuit_kicad_environment_v2", JSON.stringify(list));
  } catch (e) {
    console.warn("Failed to persist KiCad symbols:", e);
  }
}

export function registerKiCadSymbol(def: SymbolDef, parsed?: KiCadParsedSymbol) {
  importedRegistry.set(def.id, def);
  if (parsed) {
    importedParsed.set(def.id, parsed);
    persistImportedSymbols();
  }
  // also inject into the global SYMBOLS proxy target if available
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const symbolsMod = require("./symbols") as { SYMBOLS: Record<string, SymbolDef> };
    if (symbolsMod?.SYMBOLS) {
      (symbolsMod.SYMBOLS as any)[def.id] = def;
    }
  } catch {
    /* ignore circular during init */
  }
}

export function getImportedKiCadSymbols(): SymbolDef[] {
  return Array.from(importedRegistry.values());
}

export function getImportedKiCadSymbol(id: string): SymbolDef | undefined {
  return importedRegistry.get(id);
}

/** Return the native parsed KiCad symbol behind an imported SymbolDef. */
export function getImportedKiCadParsedSymbol(id: string): KiCadParsedSymbol | undefined {
  return importedParsed.get(id);
}

export function clearImportedKiCadSymbols() {
  importedRegistry.clear();
  importedParsed.clear();
  if (typeof window !== "undefined" && typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem("cirzuit_kicad_environment_v2");
    } catch {
      /* ignore storage errors */
    }
  }
}

/**
 * High-level: parse library text → register every symbol → return the defs.
 */
export function importKiCadSymbolLibrary(
  text: string,
  libNickname?: string,
  autoRegister = false
): { symbols: SymbolDef[]; parsed: KiCadParsedSymbol[]; errors: string[] } {
  const errors: string[] = [];
  let parsed: KiCadParsedSymbol[] = [];
  try {
    parsed = parseKiCadSymbolLib(text, libNickname);
  } catch (e: any) {
    errors.push(String(e?.message || e));
    return { symbols: [], parsed: [], errors };
  }
  if (parsed.length === 0) {
    errors.push("No symbols found in file (is it a valid .kicad_sym?)");
  }
  // Build the KiCad environment before adapting symbols to CirZuit's legacy
  // SymbolDef interface. Derived symbols are materialized here so the
  // renderer receives the effective KiCad symbol, not an empty alias shell.
  const environment = createKicadSymbolEnvironment(parsed);
  parsed = parsed.map(p =>
    environment.resolve(p.name, p.libNickname) ?? p
  );
  const symbols: SymbolDef[] = [];
  for (const p of parsed) {
    try {
      const def = kicadToSymbolDef(p);
      if (autoRegister) {
        registerKiCadSymbol(def, p);
      }
      symbols.push(def);
    } catch (e: any) {
      errors.push(`Failed to convert ${p.name}: ${e?.message || e}`);
    }
  }
  return { symbols, parsed, errors };
}

export interface KiCadImportDiagnostic {
  symbol: string;
  unit: number;
  bodyStyle: number;
  unsupported: string[];
  pinCount: number;
  graphicCount: number;
}

export function diagnoseKiCadSymbol(symbol: KiCadParsedSymbol): KiCadImportDiagnostic {
  const unsupported = new Set<string>();
  const known = new Set(["polyline", "rectangle", "circle", "arc", "bezier", "text", "text_box"]);
  for (const unit of symbol.units) {
    for (const g of unit.graphics) if (!known.has(g.type)) unsupported.add(g.type);
  }
  return {
    symbol: symbol.name,
    unit: symbol.selectedUnit,
    bodyStyle: symbol.selectedBodyStyle,
    unsupported: Array.from(unsupported),
    pinCount: symbol.pins.length,
    graphicCount: symbol.bodyGraphics.length,
  };
}

function extractTopLevelSymbolExpressions(text: string): string[] {
  const out: string[] = [];
  let depth = 0, start = -1, inString = false, escaped = false, lineComment = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (lineComment) { if (c === "\n") lineComment = false; continue; }
    if (!inString && c === "#" && (i === 0 || text[i - 1] === "\n")) { lineComment = true; continue; }
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') { inString = true; continue; }
    if (c === '(') {
      if (depth === 1 && text.slice(i, i + 8) === "(symbol ") start = i;
      depth++;
    } else if (c === ')') {
      depth--;
      if (depth === 1 && start >= 0) { out.push(text.slice(start, i + 1)); start = -1; }
    }
  }
  return out;
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = 20000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function fetchGitLabJson(url: string): Promise<any> {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`GitLab API HTTP ${res.status}`);
  return res.json();
}

async function fetchRawUrl(url: string): Promise<string> {
  const res = await fetchWithTimeout(url);
  if (!res.ok) throw new Error(`GitLab raw HTTP ${res.status}`);
  return res.text();
}

const KICAD_GITLAB_PROJECT = "kicad%2Flibraries%2Fkicad-symbols";
const KICAD_GITLAB_RAW = "https://gitlab.com/kicad/libraries/kicad-symbols/-/raw";
const KICAD_GITLAB_API = `https://gitlab.com/api/v4/projects/${KICAD_GITLAB_PROJECT}`;

async function listSymdirFiles(libraryName: string, ref = "master"): Promise<any[]> {
  const clean = libraryName.replace(/\.kicad_symdir$/i, "").trim();
  const path = `${clean}.kicad_symdir`;
  const files: any[] = [];
  for (let page = 1; page <= 100; page++) {
    const data = await fetchGitLabJson(
      `${KICAD_GITLAB_API}/repository/tree?ref=${encodeURIComponent(ref)}&path=${encodeURIComponent(path)}&per_page=100&page=${page}`,
    );
    if (!Array.isArray(data) || data.length === 0) break;
    files.push(...data.filter((f: any) => f.type === "blob" && String(f.name).endsWith(".kicad_sym")));
    if (data.length < 100) break;
  }
  return files;
}

async function fetchSymdirSymbol(ref: string, libraryName: string, fileName: string): Promise<string> {
  const clean = libraryName.replace(/\.kicad_symdir$/i, "").trim();
  const path = `${clean}.kicad_symdir/${fileName}`;
  const apiUrl = `${KICAD_GITLAB_API}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(ref)}`;
  try { return await fetchRawUrl(apiUrl); }
  catch { return fetchRawUrl(`${KICAD_GITLAB_RAW}/${encodeURIComponent(ref)}/${clean}.kicad_symdir/${encodeURIComponent(fileName)}`); }
}

/** Fetch the official KiCad library. Current master is KiCad 10.x and uses .kicad_symdir. */
export async function fetchOfficialKiCadLib(libFileName: string): Promise<string> {
  const cleanName = libFileName.replace(/\.kicad_sym(dir)?$/i, "").trim();
  let lastErr = "";

  // 1. Try stable consolidated files first (FAST & RELIABLE - Single request, avoids rate limits)
  const compactRefs = ["9.0.9.1", "9.0.9", "9.0.8", "9.0.7", "8.0.9", "8.0.0", "7.0.11"];
  const name = `${cleanName}.kicad_sym`;

  const attemptUrl = async (url: string) => {
    const text = await fetchRawUrl(url);
    if (text.includes("kicad_symbol_lib") && text.includes("(symbol ")) {
      return text;
    }
    throw new Error("Not a valid KiCad symbol library file");
  };

  const promises: Promise<string>[] = [];
  for (const ref of compactRefs) {
    promises.push(attemptUrl(`${KICAD_GITLAB_RAW}/${encodeURIComponent(ref)}/${encodeURIComponent(name)}`));
    promises.push(attemptUrl(`${KICAD_GITLAB_API}/repository/files/${encodeURIComponent(name)}/raw?ref=${encodeURIComponent(ref)}`));
  }

  try {
    return await Promise.any(promises);
  } catch (e: any) {
    lastErr = "Could not find library in standard releases.";
  }

  // 2. Fall back to master .kicad_symdir directory fetch if no consolidated file was found (SLOW - hundreds of requests)
  try {
    const files = await listSymdirFiles(cleanName, "master");
    if (files.length) {
      const expressions: string[] = [];
      const concurrency = 8;
      for (let i = 0; i < files.length; i += concurrency) {
        const chunk = files.slice(i, i + concurrency);
        const raws = await Promise.all(chunk.map(f => fetchSymdirSymbol("master", cleanName, String(f.name))));
        for (const raw of raws) expressions.push(...extractTopLevelSymbolExpressions(raw));
      }
      if (expressions.length) {
        return `(kicad_symbol_lib (version 20251024) (generator "cirzuit-kicad-environment")\n${expressions.join("\n")}\n)`;
      }
      lastErr = "The official .kicad_symdir was found but contained no symbol expressions";
    }
  } catch (e: any) { 
    lastErr = String(e?.message || e); 
  }

  throw new Error(`Could not fetch official KiCad library '${cleanName}'. ${lastErr}`);
}

/** Fetch the official library list, including the current *.kicad_symdir layout. */
export async function fetchOfficialKiCadLibList(): Promise<string[]> {
  try {
    const all: string[] = [];
    for (let page = 1; page <= 20; page++) {
      const res = await fetchWithTimeout(`${KICAD_GITLAB_API}/repository/tree?ref=master&per_page=100&page=${page}`);
      if (!res.ok) throw new Error(`GitLab API HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      for (const f of data) {
        const n = String(f.name || "");
        if (f.type === "tree" && n.endsWith(".kicad_symdir")) all.push(n.replace(/\.kicad_symdir$/, ""));
        else if (f.type === "blob" && n.endsWith(".kicad_sym")) all.push(n.replace(/\.kicad_sym$/, ""));
      }
      if (data.length < 100) break;
    }
    if (all.length) return Array.from(new Set(all)).sort();
  } catch (e) { console.warn("Official KiCad library list unavailable; using fallback:", e); }
  return OFFICIAL_KICAD_LIBS;
}

/** Complete list of 221 official libraries in the KiCad GitLab repository. */
export const OFFICIAL_KICAD_LIBS = [
  "4xxx",
  "4xxx_IEEE",
  "74xGxx",
  "74xx",
  "74xx_IEEE",
  "Amplifier_Audio",
  "Amplifier_Buffer",
  "Amplifier_Current",
  "Amplifier_Difference",
  "Amplifier_Instrumentation",
  "Amplifier_Operational",
  "Amplifier_Video",
  "Analog",
  "Analog_ADC",
  "Analog_DAC",
  "Analog_Switch",
  "Audio",
  "Battery_Management",
  "Buffer",
  "CPLD_Altera",
  "CPLD_Microchip",
  "CPLD_Renesas",
  "CPLD_Xilinx",
  "CPU",
  "CPU_NXP_6800",
  "CPU_NXP_68000",
  "CPU_NXP_IMX",
  "CPU_PowerPC",
  "Comparator",
  "Connector",
  "Connector_Audio",
  "Connector_Generic",
  "Connector_Generic_MountingPin",
  "Connector_Generic_Shielded",
  "Converter_ACDC",
  "Converter_DCDC",
  "DSP_AnalogDevices",
  "DSP_Freescale",
  "DSP_Microchip_DSPIC33",
  "DSP_Motorola",
  "DSP_Texas",
  "Device",
  "Diode",
  "Diode_Bridge",
  "Diode_Laser",
  "Display_Character",
  "Display_Graphic",
  "Driver_Display",
  "Driver_FET",
  "Driver_Haptic",
  "Driver_LED",
  "Driver_Motor",
  "Driver_Relay",
  "Driver_TEC",
  "FPGA_CologneChip_GateMate",
  "FPGA_Efinix_Trion",
  "FPGA_Lattice",
  "FPGA_Microsemi",
  "FPGA_Xilinx",
  "FPGA_Xilinx_Artix7",
  "FPGA_Xilinx_Kintex7",
  "FPGA_Xilinx_Spartan6",
  "FPGA_Xilinx_Virtex5",
  "FPGA_Xilinx_Virtex6",
  "FPGA_Xilinx_Virtex7",
  "Fiber_Optic",
  "Filter",
  "GPU",
  "Graphic",
  "Interface",
  "Interface_CAN_LIN",
  "Interface_CurrentLoop",
  "Interface_Ethernet",
  "Interface_Expansion",
  "Interface_HDMI",
  "Interface_HID",
  "Interface_LineDriver",
  "Interface_Optical",
  "Interface_Telecom",
  "Interface_UART",
  "Interface_USB",
  "Isolator",
  "Isolator_Analog",
  "Jumper",
  "LED",
  "Logic_LevelTranslator",
  "Logic_Programmable",
  "MCU_AnalogDevices",
  "MCU_Cypress",
  "MCU_Dialog",
  "MCU_Espressif",
  "MCU_Intel",
  "MCU_Microchip_8051",
  "MCU_Microchip_ATmega",
  "MCU_Microchip_ATtiny",
  "MCU_Microchip_AVR",
  "MCU_Microchip_AVR_Dx",
  "MCU_Microchip_PIC10",
  "MCU_Microchip_PIC12",
  "MCU_Microchip_PIC16",
  "MCU_Microchip_PIC18",
  "MCU_Microchip_PIC24",
  "MCU_Microchip_PIC32",
  "MCU_Microchip_SAMA",
  "MCU_Microchip_SAMD",
  "MCU_Microchip_SAME",
  "MCU_Microchip_SAML",
  "MCU_Microchip_SAMV",
  "MCU_Module",
  "MCU_NXP_ColdFire",
  "MCU_NXP_HC11",
  "MCU_NXP_HC12",
  "MCU_NXP_HCS12",
  "MCU_NXP_Kinetis",
  "MCU_NXP_LPC",
  "MCU_NXP_MAC7100",
  "MCU_NXP_MCore",
  "MCU_NXP_NTAG",
  "MCU_NXP_S08",
  "MCU_Nordic",
  "MCU_Parallax",
  "MCU_RaspberryPi",
  "MCU_Renesas_Synergy_S1",
  "MCU_STC",
  "MCU_ST_STM32C0",
  "MCU_ST_STM32F0",
  "MCU_ST_STM32F1",
  "MCU_ST_STM32F2",
  "MCU_ST_STM32F3",
  "MCU_ST_STM32F4",
  "MCU_ST_STM32F7",
  "MCU_ST_STM32G0",
  "MCU_ST_STM32G4",
  "MCU_ST_STM32H5",
  "MCU_ST_STM32H7",
  "MCU_ST_STM32L0",
  "MCU_ST_STM32L1",
  "MCU_ST_STM32L4",
  "MCU_ST_STM32L5",
  "MCU_ST_STM32MP1",
  "MCU_ST_STM32U5",
  "MCU_ST_STM32WB",
  "MCU_ST_STM32WBA",
  "MCU_ST_STM32WL",
  "MCU_ST_STM8",
  "MCU_SiFive",
  "MCU_SiliconLabs",
  "MCU_Texas",
  "MCU_Texas_MSP430",
  "MCU_Texas_SimpleLink",
  "MCU_WCH_CH32V0",
  "MCU_WCH_CH32V3",
  "Mechanical",
  "Memory_EEPROM",
  "Memory_EPROM",
  "Memory_Flash",
  "Memory_NVRAM",
  "Memory_RAM",
  "Memory_ROM",
  "Memory_UniqueID",
  "Motor",
  "Oscillator",
  "Potentiometer_Digital",
  "Power_Management",
  "Power_Protection",
  "Power_Supervisor",
  "RF",
  "RF_AM_FM",
  "RF_Amplifier",
  "RF_Bluetooth",
  "RF_Filter",
  "RF_GPS",
  "RF_GSM",
  "RF_Mixer",
  "RF_Module",
  "RF_NFC",
  "RF_RFID",
  "RF_Switch",
  "RF_WiFi",
  "RF_ZigBee",
  "Reference_Current",
  "Reference_Voltage",
  "Regulator_Controller",
  "Regulator_Current",
  "Regulator_Linear",
  "Regulator_SwitchedCapacitor",
  "Regulator_Switching",
  "Relay",
  "Relay_SolidState",
  "Security",
  "Sensor",
  "Sensor_Audio",
  "Sensor_Current",
  "Sensor_Distance",
  "Sensor_Energy",
  "Sensor_Gas",
  "Sensor_Humidity",
  "Sensor_Magnetic",
  "Sensor_Motion",
  "Sensor_Optical",
  "Sensor_Pressure",
  "Sensor_Proximity",
  "Sensor_Temperature",
  "Sensor_Touch",
  "Sensor_Voltage",
  "Simulation_SPICE",
  "Switch",
  "Timer",
  "Timer_PLL",
  "Timer_RTC",
  "Transformer",
  "Transistor_Array",
  "Transistor_BJT",
  "Transistor_FET",
  "Transistor_FET_Other",
  "Transistor_IGBT",
  "Transistor_Power_Module",
  "Triac_Thyristor",
  "Valve",
  "Video",
  "power",
];
