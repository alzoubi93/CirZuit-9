// Universal Schematic Importer for KiCad (.kicad_sch), EasyEDA JSON, Eagle SCH (.sch), and SPICE Netlist (.cir/.net/.spice/.sp/.txt)
import { SchematicDoc, SchematicNode, SchematicWire, WireColor, emptyDoc, nextReference, SymbolId } from "./schematic";
import { SYMBOLS } from "./symbols";
import { importEasyEDA } from "./importEasyEDA";

// Helper to map symbol name/reference/value to catalog symbol
export function guessSymbolFromRefOrVal(alias: string | undefined, ref?: string, val?: string): SymbolId {
  const combined = `${alias || ""} ${ref || ""} ${val || ""}`.toLowerCase();
  
  if (/\b(res|resistor)\b|^r[0-9]/i.test(combined)) return "resistor";
  if (/\b(cap|capacitor)\b|^c[0-9]/i.test(combined)) return "capacitor";
  if (/\b(ind|inductor|coil)\b|^l[0-9]/i.test(combined)) return "inductor";
  if (/\b(led)\b/i.test(combined)) return "led";
  if (/\b(diode|1n4148|1n4007)\b|^d[0-9]/i.test(combined)) return "diode2";
  if (/\b(zener)\b/i.test(combined)) return "zener";
  if (/\b(fuse)\b|^f[0-9]/i.test(combined)) return "fuse";
  if (/\b(mosfet|n-ch|p-ch|2nl)\b|^m[0-9]/i.test(combined)) return "mosfet";
  if (/\b(transistor|bjt|2n2222|2n3904|bc547|npn|pnp)\b|^q[0-9]/i.test(combined)) return "transistor";
  if (/\b(opamp|lm358|ne5532|tl072|op-amp)\b|^u[0-9]/i.test(combined)) return "opamp4";
  if (/\b(esp32)\b/i.test(combined)) return "esp32";
  if (/\b(lm2596)\b/i.test(combined)) return "lm2596";
  if (/\b(lm1117|ldo|regulator)\b/i.test(combined)) return "lm1117";
  if (/\b(gnd|ground|0)\b/i.test(combined)) return "gnd";
  if (/\b(vcc|vdd|3v3|5v|12v|power)\b/i.test(combined)) return "vcc";
  if (/\b(sw|switch|pushbutton|btn)\b|^sw[0-9]/i.test(combined)) return "switch";
  if (/\b(bat|battery|cell)\b|^bat[0-9]/i.test(combined)) return "battery";
  if (/\b(transformer)\b/i.test(combined)) return "transformer";
  
  return "resistor";
}

// ==========================================
// 1. KiCad Schematic Parser (.kicad_sch)
// ==========================================

interface SExprToken {
  type: "paren" | "string" | "atom";
  value: string;
}

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
          str += text[i + 1];
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
    } else if (/\s/.test(ch)) {
      i++;
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

type SExprAST = Array<string | SExprAST>;

function parseSExprAST(tokens: SExprToken[]): SExprAST {
  let index = 0;
  while (index < tokens.length && (tokens[index].type !== "paren" || tokens[index].value !== "(")) index++;
  function parseNode(): SExprAST {
    const list: SExprAST = [];
    if (index >= tokens.length || (tokens[index].type !== "paren" || tokens[index].value !== "(")) return list;
    index++; // skip '('
    while (index < tokens.length) {
      const tok = tokens[index];
      if (tok.type === "paren" && tok.value === ")") {
        index++; // skip ')'
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
  return parseNode();
}

export function parseKiCadSch(text: string): SchematicDoc | null {
  if (!text || typeof text !== "string") return null;

  // Check if legacy KiCad EESchema format
  if (text.includes("EESchema Schematic File Version") || text.includes("$Comp")) {
    return parseLegacyKiCadSch(text);
  }

  // Modern S-expression KiCad 6+ format
  if (!text.includes("kicad_schematic") && !text.includes("kicad_sch")) return null;

  try {
    const tokens = tokenizeSExpr(text);
    const ast = parseSExprAST(tokens);
    if (!Array.isArray(ast) || (ast[0] !== "kicad_schematic" && ast[0] !== "kicad_sch")) return null;

    const doc: SchematicDoc = emptyDoc();
    const nodes: SchematicNode[] = [];
    const wires: SchematicWire[] = [];

    const SCALE = 0.2; // Map mm to schematic grid units

    for (let i = 1; i < ast.length; i++) {
      const item = ast[i];
      if (!Array.isArray(item) || item.length === 0) continue;
      const head = item[0];

      if (head === "symbol") {
        let libId = "";
        let x = 0, y = 0, angle: 0 | 90 | 180 | 270 = 0;
        let reference = "";
        let value = "";

        for (let j = 1; j < item.length; j++) {
          const sub = item[j];
          if (!Array.isArray(sub)) continue;

          if (sub[0] === "lib_id" && typeof sub[1] === "string") {
            libId = sub[1];
          } else if (sub[0] === "at") {
            x = (parseFloat(String(sub[1] || 0)) || 0) * SCALE;
            y = (parseFloat(String(sub[2] || 0)) || 0) * SCALE;
            const rotDeg = parseFloat(String(sub[3] || 0)) || 0;
            const normRot = (((Math.round(rotDeg / 90) * 90) % 360) + 360) % 360;
            angle = normRot as 0 | 90 | 180 | 270;
          } else if (sub[0] === "property") {
            const propName = String(sub[1] || "");
            const propVal = String(sub[2] || "");
            if (propName === "Reference") reference = propVal;
            if (propName === "Value") value = propVal;
          }
        }

        const symbol = guessSymbolFromRefOrVal(libId, reference, value);
        nodes.push({
          id: crypto.randomUUID(),
          symbol,
          x: Math.round(x * 2) / 2,
          y: Math.round(y * 2) / 2,
          rotation: angle,
          reference: reference || undefined,
          value: value || undefined,
        });
      } else if (head === "wire" || head === "bus") {
        const points: { x: number; y: number }[] = [];
        for (let j = 1; j < item.length; j++) {
          const sub = item[j];
          if (Array.isArray(sub) && sub[0] === "pts") {
            for (let k = 1; k < sub.length; k++) {
              const pt = sub[k];
              if (Array.isArray(pt) && pt[0] === "xy") {
                const px = (parseFloat(String(pt[1] || 0)) || 0) * SCALE;
                const py = (parseFloat(String(pt[2] || 0)) || 0) * SCALE;
                points.push({ x: Math.round(px * 2) / 2, y: Math.round(py * 2) / 2 });
              }
            }
          }
        }
        if (points.length >= 2) {
          wires.push({
            id: crypto.randomUUID(),
            points,
            color: "black",
          });
        }
      }
    }

    doc.nodes = nodes;
    doc.wires = wires;
    return doc;
  } catch {
    return null;
  }
}

function parseLegacyKiCadSch(text: string): SchematicDoc {
  const doc = emptyDoc();
  const nodes: SchematicNode[] = [];
  const wires: SchematicWire[] = [];
  const lines = text.split("\n");

  let inComp = false;
  let compRef = "", compVal = "", compLib = "";
  let compX = 0, compY = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith("$Comp")) {
      inComp = true;
      compRef = ""; compVal = ""; compLib = ""; compX = 0; compY = 0;
    } else if (line.startsWith("$EndComp")) {
      inComp = false;
      const symbol = guessSymbolFromRefOrVal(compLib, compRef, compVal);
      nodes.push({
        id: crypto.randomUUID(),
        symbol,
        x: Math.round((compX / 20) * 2) / 2,
        y: Math.round((compY / 20) * 2) / 2,
        rotation: 0,
        reference: compRef || undefined,
        value: compVal || undefined,
      });
    } else if (inComp) {
      if (line.startsWith("L ")) {
        const parts = line.split(/\s+/);
        compLib = parts[1] || "";
        compRef = parts[2] || "";
      } else if (line.startsWith("P ")) {
        const parts = line.split(/\s+/);
        compX = parseFloat(parts[1] || "0");
        compY = parseFloat(parts[2] || "0");
      } else if (line.startsWith("F 0 ")) {
        const match = line.match(/F 0 "(.*?)"/);
        if (match) compRef = match[1];
      } else if (line.startsWith("F 1 ")) {
        const match = line.match(/F 1 "(.*?)"/);
        if (match) compVal = match[1];
      }
    } else if (line.startsWith("Wire Wire Line")) {
      if (i + 1 < lines.length) {
        const ptsLine = lines[i + 1].trim();
        const pts = ptsLine.split(/\s+/).map(Number);
        if (pts.length >= 4) {
          wires.push({
            id: crypto.randomUUID(),
            points: [
              { x: Math.round((pts[0] / 20) * 2) / 2, y: Math.round((pts[1] / 20) * 2) / 2 },
              { x: Math.round((pts[2] / 20) * 2) / 2, y: Math.round((pts[3] / 20) * 2) / 2 },
            ],
            color: "black",
          });
        }
      }
    }
  }

  doc.nodes = nodes;
  doc.wires = wires;
  return doc;
}

// ==========================================
// 2. EasyEDA JSON Parser (Standard & Pro)
// ==========================================

export function parseEasyEdaJson(text: string): SchematicDoc | null {
  if (!text || typeof text !== "string") return null;

  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  // Try standard format via existing importEasyEDA
  const stdDoc = importEasyEDA(text);
  if (stdDoc && (stdDoc.nodes.length > 0 || stdDoc.wires.length > 0)) {
    return stdDoc;
  }

  // Parse Pro or nested EasyEDA JSON
  try {
    const json = JSON.parse(text);
    if (!json || typeof json !== "object") return null;

    const doc = emptyDoc();
    const nodes: SchematicNode[] = [];
    const wires: SchematicWire[] = [];

    // EasyEDA Pro components format
    const comps = json.components || json.schematic?.components || json.data?.components || [];
    if (Array.isArray(comps)) {
      for (const c of comps) {
        const title = c.deviceHeader?.title || c.title || c.name || "";
        const ref = c.properties?.Designator || c.displayTitle || c.ref || "";
        const val = c.properties?.Value || c.value || "";
        const x = (parseFloat(c.x || 0) || 0) / 10;
        const y = (parseFloat(c.y || 0) || 0) / 10;
        const rotRaw = parseInt(c.rotation || 0, 10) || 0;
        const rotation = (((Math.round(rotRaw / 90) * 90) % 360) + 360) % 360 as 0 | 90 | 180 | 270;

        const symbol = guessSymbolFromRefOrVal(title, ref, val);
        nodes.push({
          id: crypto.randomUUID(),
          symbol,
          x: Math.round(x * 2) / 2,
          y: Math.round(y * 2) / 2,
          rotation,
          reference: ref || undefined,
          value: val || undefined,
        });
      }
    }

    // EasyEDA Pro wires
    const wrs = json.wires || json.schematic?.wires || json.data?.wires || [];
    if (Array.isArray(wrs)) {
      for (const w of wrs) {
        const pts = w.points || w.pts || [];
        const points: { x: number; y: number }[] = [];
        if (Array.isArray(pts)) {
          for (let i = 0; i + 1 < pts.length; i += 2) {
            points.push({
              x: Math.round(((parseFloat(pts[i]) || 0) / 10) * 2) / 2,
              y: Math.round(((parseFloat(pts[i + 1]) || 0) / 10) * 2) / 2,
            });
          }
        }
        if (points.length >= 2) {
          wires.push({
            id: crypto.randomUUID(),
            points,
            color: "black",
          });
        }
      }
    }

    if (nodes.length > 0 || wires.length > 0) {
      doc.nodes = nodes;
      doc.wires = wires;
      return doc;
    }
  } catch {
    return null;
  }

  return null;
}

// ==========================================
// 3. EAGLE Schematic Parser (.sch XML)
// ==========================================

export function parseEagleSch(text: string): SchematicDoc | null {
  if (!text || typeof text !== "string") return null;
  if (!text.includes("<eagle") && !text.includes("<schematic")) return null;

  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(text, "text/xml");

    const schematicEl = xmlDoc.getElementsByTagName("schematic")[0];
    if (!schematicEl) return null;

    const doc = emptyDoc();
    const nodes: SchematicNode[] = [];
    const wires: SchematicWire[] = [];

    // 1. Map parts: <part name="R1" library="resistor" deviceset="R-US_" value="10k"/>
    const partMap = new Map<string, { library: string; deviceset: string; value: string }>();
    const partEls = xmlDoc.getElementsByTagName("part");
    for (let i = 0; i < partEls.length; i++) {
      const p = partEls[i];
      const name = p.getAttribute("name");
      if (name) {
        partMap.set(name, {
          library: p.getAttribute("library") || "",
          deviceset: p.getAttribute("deviceset") || "",
          value: p.getAttribute("value") || "",
        });
      }
    }

    // 2. Map instances: <instance part="R1" gate="G$1" x="50.8" y="25.4" rot="R90"/>
    const SCALE = 0.2; // 50.8mm -> ~10.16 grid units
    const instanceEls = xmlDoc.getElementsByTagName("instance");
    for (let i = 0; i < instanceEls.length; i++) {
      const inst = instanceEls[i];
      const partName = inst.getAttribute("part");
      if (!partName) continue;

      const partInfo = partMap.get(partName);
      const x = (parseFloat(inst.getAttribute("x") || "0") || 0) * SCALE;
      const y = (parseFloat(inst.getAttribute("y") || "0") || 0) * SCALE;
      const rotStr = inst.getAttribute("rot") || "R0";

      let angle: 0 | 90 | 180 | 270 = 0;
      const rotMatch = rotStr.match(/R(\d+)/);
      if (rotMatch) {
        const deg = parseInt(rotMatch[1], 10) || 0;
        angle = (((Math.round(deg / 90) * 90) % 360) + 360) % 360 as any;
      }

      const symbol = guessSymbolFromRefOrVal(
        `${partInfo?.library || ""} ${partInfo?.deviceset || ""}`,
        partName,
        partInfo?.value
      );

      nodes.push({
        id: crypto.randomUUID(),
        symbol,
        x: Math.round(x * 2) / 2,
        y: Math.round(y * 2) / 2,
        rotation: angle,
        reference: partName,
        value: partInfo?.value || undefined,
      });
    }

    // 3. Map wires from nets: <net name="N$1"><segment><wire x1=".." y1=".." x2=".." y2=".."/>
    const wireEls = xmlDoc.getElementsByTagName("wire");
    for (let i = 0; i < wireEls.length; i++) {
      const w = wireEls[i];
      const x1 = (parseFloat(w.getAttribute("x1") || "0") || 0) * SCALE;
      const y1 = (parseFloat(w.getAttribute("y1") || "0") || 0) * SCALE;
      const x2 = (parseFloat(w.getAttribute("x2") || "0") || 0) * SCALE;
      const y2 = (parseFloat(w.getAttribute("y2") || "0") || 0) * SCALE;

      if (x1 !== 0 || y1 !== 0 || x2 !== 0 || y2 !== 0) {
        wires.push({
          id: crypto.randomUUID(),
          points: [
            { x: Math.round(x1 * 2) / 2, y: Math.round(y1 * 2) / 2 },
            { x: Math.round(x2 * 2) / 2, y: Math.round(y2 * 2) / 2 },
          ],
          color: "black",
        });
      }
    }

    doc.nodes = nodes;
    doc.wires = wires;
    return doc;
  } catch {
    return null;
  }
}

// ==========================================
// 4. SPICE Netlist Parser (.cir / .net / .spice / .sp)
// ==========================================

export function parseSpiceNetlist(text: string): SchematicDoc | null {
  if (!text || typeof text !== "string") return null;

  // Clean lines and handle continuation '+'
  const rawLines = text.split("\n");
  const lines: string[] = [];
  for (const raw of rawLines) {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("*") || trimmed.startsWith("$")) continue;
    if (trimmed.startsWith("+") && lines.length > 0) {
      lines[lines.length - 1] += " " + trimmed.substring(1).trim();
    } else {
      lines.push(trimmed);
    }
  }

  if (lines.length === 0) return null;

  const doc = emptyDoc();
  const nodes: SchematicNode[] = [];
  const wires: SchematicWire[] = [];

  // Track component placement grid
  let gridX = 4;
  let gridY = 4;
  const GRID_SPACING = 12;
  const MAX_PER_ROW = 5;
  let rowCount = 0;

  // Net connections map: netName -> list of { nodeId, pinIndex, x, y }
  const netPins = new Map<string, { x: number; y: number }[]>();

  function registerPin(netName: string, x: number, y: number) {
    if (!netName) return;
    const norm = netName.toLowerCase();
    const arr = netPins.get(norm) || [];
    arr.push({ x, y });
    netPins.set(norm, arr);
  }

  let parsedCount = 0;

  for (const line of lines) {
    const tokens = line.split(/\s+/);
    if (tokens.length < 2) continue;

    const ref = tokens[0];
    const typeChar = ref[0].toUpperCase();

    // Check if line is a SPICE command like .TRAN, .MODEL, .SUBCKT
    if (ref.startsWith(".")) continue;

    let symbol: SymbolId = "resistor";
    let value = "";
    let nodeNames: string[] = [];

    if (typeChar === "R") {
      symbol = "resistor";
      nodeNames = [tokens[1], tokens[2]];
      value = tokens[3] || "";
    } else if (typeChar === "C") {
      symbol = "capacitor";
      nodeNames = [tokens[1], tokens[2]];
      value = tokens[3] || "";
    } else if (typeChar === "L") {
      symbol = "inductor";
      nodeNames = [tokens[1], tokens[2]];
      value = tokens[3] || "";
    } else if (typeChar === "D") {
      symbol = "diode2";
      nodeNames = [tokens[1], tokens[2]];
      value = tokens[3] || "";
    } else if (typeChar === "Q") {
      symbol = "transistor";
      nodeNames = [tokens[1], tokens[2], tokens[3]]; // C B E
      value = tokens[4] || "NPN";
    } else if (typeChar === "M") {
      symbol = "mosfet";
      nodeNames = [tokens[1], tokens[2], tokens[3]]; // D G S
      value = tokens[5] || "NMOS";
    } else if (typeChar === "V") {
      symbol = "battery";
      nodeNames = [tokens[1], tokens[2]];
      value = tokens.slice(3).join(" ") || "5V";
    } else if (typeChar === "I") {
      symbol = "vcc";
      nodeNames = [tokens[1], tokens[2]];
      value = tokens[3] || "1mA";
    } else if (typeChar === "X") {
      symbol = "opamp4";
      nodeNames = tokens.slice(1, tokens.length - 1);
      value = tokens[tokens.length - 1] || "IC";
    } else if (typeChar === "S" || ref.toUpperCase().startsWith("SW")) {
      symbol = "switch";
      nodeNames = [tokens[1], tokens[2]];
      value = tokens[3] || "";
    } else {
      continue;
    }

    const x = gridX;
    const y = gridY;

    nodes.push({
      id: crypto.randomUUID(),
      symbol,
      x,
      y,
      rotation: 0,
      reference: ref,
      value: value || undefined,
    });

    // Register pins for wiring
    const sym = SYMBOLS[symbol];
    if (sym) {
      for (let i = 0; i < Math.min(nodeNames.length, sym.pins.length); i++) {
        const pin = sym.pins[i];
        registerPin(nodeNames[i], x + pin.x, y + pin.y);
      }
    }

    parsedCount++;
    rowCount++;
    if (rowCount >= MAX_PER_ROW) {
      rowCount = 0;
      gridX = 4;
      gridY += GRID_SPACING;
    } else {
      gridX += GRID_SPACING;
    }
  }

  if (parsedCount === 0) return null;

  // Add GND / VCC symbols for power nets
  for (const [netName, pts] of netPins.entries()) {
    if (netName === "0" || netName === "gnd" || netName === "ground") {
      for (const pt of pts) {
        const gndX = pt.x;
        const gndY = pt.y + 2;
        nodes.push({
          id: crypto.randomUUID(),
          symbol: "gnd",
          x: gndX,
          y: gndY,
          rotation: 0,
        });
        wires.push({
          id: crypto.randomUUID(),
          points: [pt, { x: gndX, y: gndY }],
          color: "black",
        });
      }
    } else if (netName === "vcc" || netName === "vdd" || netName === "+5v") {
      for (const pt of pts) {
        const vccX = pt.x;
        const vccY = pt.y - 2;
        nodes.push({
          id: crypto.randomUUID(),
          symbol: "vcc",
          x: vccX,
          y: vccY,
          rotation: 0,
        });
        wires.push({
          id: crypto.randomUUID(),
          points: [pt, { x: vccX, y: vccY }],
          color: "black",
        });
      }
    } else if (pts.length >= 2) {
      // Connect pins on the same net with a wire line
      for (let i = 0; i < pts.length - 1; i++) {
        wires.push({
          id: crypto.randomUUID(),
          points: [pts[i], pts[i + 1]],
          color: "black",
        });
      }
    }
  }

  doc.nodes = nodes;
  doc.wires = wires;
  return doc;
}

// ==========================================
// Universal Auto-Detector & Master Importer
// ==========================================

export function detectAndParseSchematic(
  text: string,
  filename: string,
  lang: "ar" | "en" = "en"
): { doc: SchematicDoc; name?: string; formatName?: string } | null {
  if (!text || typeof text !== "string") return null;

  const fnLower = filename.toLowerCase();

  // 1. KiCad schematic (.kicad_sch)
  if (fnLower.endsWith(".kicad_sch") || text.includes("kicad_schematic") || text.includes("EESchema Schematic File Version")) {
    const doc = parseKiCadSch(text);
    if (doc) {
      return {
        doc,
        name: filename.replace(/\.kicad_sch$/i, ""),
        formatName: "KiCad Schematic",
      };
    }
  }

  // 2. EAGLE schematic (.sch XML format)
  if (fnLower.endsWith(".sch") || text.includes("<eagle") || text.includes("<schematic")) {
    const doc = parseEagleSch(text);
    if (doc) {
      return {
        doc,
        name: filename.replace(/\.sch$/i, ""),
        formatName: "EAGLE Schematic",
      };
    }
  }

  // 3. EasyEDA JSON (.json)
  if (fnLower.endsWith(".json") || text.includes("shape") || text.includes("dataStr") || text.includes("components")) {
    const doc = parseEasyEdaJson(text);
    if (doc) {
      return {
        doc,
        name: filename.replace(/\.json$/i, ""),
        formatName: "EasyEDA JSON",
      };
    }
  }

  // 4. SPICE Netlist (.cir / .net / .spice / .sp / .txt)
  if (
    fnLower.endsWith(".cir") ||
    fnLower.endsWith(".net") ||
    fnLower.endsWith(".spice") ||
    fnLower.endsWith(".sp") ||
    fnLower.endsWith(".txt") ||
    text.includes(".TRAN") ||
    text.includes(".MODEL") ||
    text.includes(".SUBCKT")
  ) {
    const doc = parseSpiceNetlist(text);
    if (doc && doc.nodes.length > 0) {
      return {
        doc,
        name: filename.replace(/\.(cir|net|spice|sp|txt)$/i, ""),
        formatName: "SPICE Netlist",
      };
    }
  }

  // Fallback check all parsers in sequence if extension didn't match
  const eagleRes = parseEagleSch(text);
  if (eagleRes && (eagleRes.nodes.length > 0 || eagleRes.wires.length > 0)) {
    return { doc: eagleRes, name: filename.split(".")[0], formatName: "EAGLE Schematic" };
  }

  const kiCadRes = parseKiCadSch(text);
  if (kiCadRes) {
    return { doc: kiCadRes, name: filename.split(".")[0], formatName: "KiCad Schematic" };
  }

  const easyEdaRes = parseEasyEdaJson(text);
  if (easyEdaRes) {
    return { doc: easyEdaRes, name: filename.split(".")[0], formatName: "EasyEDA JSON" };
  }

  const spiceRes = parseSpiceNetlist(text);
  if (spiceRes && spiceRes.nodes.length > 0) {
    return { doc: spiceRes, name: filename.split(".")[0], formatName: "SPICE Netlist" };
  }

  return null;
}
