// Best-effort EasyEDA-compatible schematic JSON export.
import { SchematicDoc, GRID } from "./schematic";
import { SYMBOLS, transformedPins } from "./symbols";

interface EasyEDADoc {
  head: { docType: "1"; editorVersion: string; c_para: Record<string, string> };
  canvas: string;
  shape: string[];
  BBox: { x: number; y: number; width: number; height: number };
  schematics: Array<{
    docType: "1";
    title: string;
    shape: string[];
  }>;
}

export function toEasyEDA(doc: SchematicDoc, title: string): EasyEDADoc {
  // Convert grid units → EasyEDA mils-style coords (10 px per unit).
  const U = 10;
  const shapes: string[] = [];

  // Wires → polylines: "PL~x1 y1 x2 y2 ...~#color~strokeWidth~~"
  const WIRE = { black: "#000000", red: "#dc2626", green: "#16a34a", blue: "#2563eb", yellow: "#eab308" };
  for (const w of doc.wires) {
    const pts = w.points.map((p) => `${(p.x * U).toFixed(1)} ${(p.y * U).toFixed(1)}`).join(" ");
    shapes.push(`W~${pts}~${WIRE[w.color]}~1~~`);
  }

  // Nodes → LIB~ blocks (each component as a library symbol with primitive shapes).
  let gid = 1;
  for (const n of doc.nodes) {
    const sym = SYMBOLS[n.symbol];
    const cx = sym.width / 2, cy = sym.height / 2;
    const inner: string[] = [];
    const pins = transformedPins(sym, n.rotation);
    pins.forEach((p, i) => {
      const name = n.pinNames?.[i] ?? p.name ?? String(i + 1);
      inner.push(`P~show~${i + 1}~${(p.x * U).toFixed(1)}~${(p.y * U).toFixed(1)}~0~~~~^^${name}^^0~^^0~`);
    });
    if (n.reference) inner.push(`T~L~${(cx * U).toFixed(1)}~${(-0.3 * U).toFixed(1)}~0~#111827~Times~7pt~~~~^^${n.reference}^^0~~`);
    if (n.value) inner.push(`T~N~${(cx * U).toFixed(1)}~${((sym.height + 0.7) * U).toFixed(1)}~0~#111827~Times~6pt~~~~^^${n.value}^^0~~`);
    shapes.push(`LIB~${(n.x * U).toFixed(1)}~${(n.y * U).toFixed(1)}~package\`\`nameAlias\`${sym.id}\`spiceSymbolName\`${sym.id}\`~${n.rotation}~~gge${gid++}~0~~`);
    // append child shapes as separate entries (EasyEDA usually nests; flat list keeps it readable)
    for (const s of inner) shapes.push(s);
  }

  return {
    head: {
      docType: "1",
      editorVersion: "CirZuit-1.0",
      c_para: { Prefix: "U", Manufacturer: "" },
    },
    canvas: "CA~1000~800~#FFFFFF~1~~1~yes~#CCCCCC~5~1000~800~line~5~pixel~5~5",
    BBox: { x: 0, y: 0, width: 1000, height: 800 },
    shape: shapes,
    schematics: [{ docType: "1", title, shape: shapes }],
  };
}

export function downloadEasyEDA(doc: SchematicDoc, filename: string) {
  const data = toEasyEDA(doc, filename);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.easyeda.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function downloadCirzuitJson(doc: SchematicDoc, filename: string) {
  const blob = new Blob([JSON.stringify({ app: "CirZuit", version: 1, doc }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${filename}.cirzuit.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function readCirzuitJson(text: string): SchematicDoc | null {
  try {
    const j = JSON.parse(text);
    if (j?.app === "CirZuit" && j.doc) return j.doc as SchematicDoc;
    if (j?.nodes && j?.wires) return j as SchematicDoc;
    return null;
  } catch { return null; }
}
// silence unused
void GRID;
