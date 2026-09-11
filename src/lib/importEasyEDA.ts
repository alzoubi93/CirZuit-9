// Best-effort EasyEDA JSON import.
import { SchematicDoc, SchematicNode, SchematicWire, WireColor, emptyDoc, nextReference, SymbolId } from "./schematic";
import { SYMBOLS } from "./symbols";

const COLOR_MAP: { hex: RegExp; color: WireColor }[] = [
  { hex: /^#?(000|111|222)/i, color: "black" },
  { hex: /^#?(dc2626|f00|ff0000|e00|d00)/i, color: "red" },
  { hex: /^#?(16a34a|0f0|00ff00|0a0|080)/i, color: "green" },
  { hex: /^#?(2563eb|00f|0000ff|00a|03f)/i, color: "blue" },
  { hex: /^#?(eab308|ff0|ffff00|fc0|fd0)/i, color: "yellow" },
];

function matchColor(hex: string | undefined): WireColor {
  if (!hex) return "black";
  for (const c of COLOR_MAP) if (c.hex.test(hex)) return c.color;
  return "black";
}

function guessSymbolId(alias: string | undefined): SymbolId {
  const a = (alias ?? "").toLowerCase();
  const known = Object.keys(SYMBOLS) as SymbolId[];
  for (const k of known) if (a === k) return k;
  if (/res|r[0-9]/.test(a)) return "resistor";
  if (/cap|c[0-9]/.test(a)) return "capacitor";
  if (/ind|l[0-9]/.test(a)) return "inductor";
  if (/diode|^d[0-9]/.test(a)) return "diode2";
  if (/led/.test(a)) return "led";
  if (/fuse/.test(a)) return "fuse";
  if (/mos|fet/.test(a)) return "mosfet";
  if (/trans|q[0-9]|bjt/.test(a)) return "transistor";
  if (/op[\s_-]?amp/.test(a)) return "opamp4";
  if (/esp32/.test(a)) return "esp32";
  if (/lm2596/.test(a)) return "lm2596";
  if (/lm1117|ldo/.test(a)) return "lm1117";
  if (/gnd|ground/.test(a)) return "gnd";
  if (/vcc|vdd|3v3|5v|power/.test(a)) return "vcc";
  if (/sw/.test(a)) return "switch";
  if (/bat/.test(a)) return "battery";
  return "resistor";
}

export function importEasyEDA(text: string): SchematicDoc | null {
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const shapes: string[] =
    json?.shape ??
    json?.schematics?.[0]?.shape ??
    json?.dataStr?.shape ??
    [];
  if (!Array.isArray(shapes) || !shapes.length) return null;

  const U = 10; // inverse of export scale
  const doc: SchematicDoc = emptyDoc();
  const wires: SchematicWire[] = [];
  const nodes: SchematicNode[] = [];

  for (const sh of shapes) {
    if (typeof sh !== "string") continue;
    const parts = sh.split("~");
    const kind = parts[0];

    if (kind === "W" || kind === "PL") {
      // W~x1 y1 x2 y2 ...~color~width~...
      const ptsStr = parts[1] ?? "";
      const color = matchColor(parts[2]);
      const nums = ptsStr.trim().split(/\s+/).map(Number).filter((n) => !Number.isNaN(n));
      const points: { x: number; y: number }[] = [];
      for (let i = 0; i + 1 < nums.length; i += 2) {
        points.push({ x: nums[i] / U, y: nums[i + 1] / U });
      }
      if (points.length >= 2) wires.push({ id: crypto.randomUUID(), points, color });
    } else if (kind === "LIB") {
      // LIB~x~y~attrs~rot~...~~~ + nested may be after
      const x = parseFloat(parts[1] ?? "0") / U;
      const y = parseFloat(parts[2] ?? "0") / U;
      const rotRaw = parseInt(parts[4] ?? "0", 10) || 0;
      const rotation = (((Math.round(rotRaw / 90) * 90) % 360) + 360) % 360 as 0 | 90 | 180 | 270;
      const attrs = parts[3] ?? "";
      // attrs use backticks: a`b`c`d ...  look for nameAlias
      const tokens = attrs.split("`");
      let alias: string | undefined;
      for (let i = 0; i < tokens.length - 1; i++) {
        if (tokens[i] === "nameAlias") { alias = tokens[i + 1]; break; }
        if (tokens[i] === "spiceSymbolName" && !alias) alias = tokens[i + 1];
      }
      const symbol = guessSymbolId(alias);
      const sym = SYMBOLS[symbol];
      const ref = sym.prefix ? nextReference({ ...doc, nodes }, sym.prefix) : undefined;
      nodes.push({
        id: crypto.randomUUID(),
        symbol,
        x: isNaN(x) ? 5 : x,
        y: isNaN(y) ? 5 : y,
        rotation,
        reference: ref,
        value: sym.defaultValue,
      });
    }
  }
  doc.wires = wires;
  doc.nodes = nodes;
  return doc;
}
