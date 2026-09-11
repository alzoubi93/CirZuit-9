// Comprehensive XML Import / Export Engine for CirZuit (.xml format)
import { SchematicDoc, SchematicNode, SchematicWire, WireColor, CanvasColor, emptyDoc, nextReference } from "./schematic";
import { PcbDoc, PcbTrack, PcbVia, PcbPad, PcbFootprint, PcbFootprintPad, PcbText, PcbMeasure, emptyPcbDoc } from "./pcb";
import { ParsedZuitResult, ZUIT_MAGIC } from "./projectFile";
import { parseIpc2581, isIpc2581Content } from "./importModernPcb";
import { SYMBOLS } from "./symbols";

export function escapeXml(unsafe: string | number | undefined | null): string {
  if (unsafe === undefined || unsafe === null) return "";
  const str = String(unsafe);
  return str.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case "<": return "&lt;";
      case ">": return "&gt;";
      case "&": return "&amp;";
      case "'": return "&apos;";
      case '"': return "&quot;";
      default: return c;
    }
  });
}

export function unescapeXml(safe: string | undefined | null): string {
  if (!safe) return "";
  return safe
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

/** Check if text is XML content */
export function isXmlString(text: string): boolean {
  if (!text || typeof text !== "string") return false;
  const trimmed = text.trim();
  return (
    trimmed.startsWith("<?xml") ||
    trimmed.startsWith("<project") ||
    trimmed.startsWith("<cirzuit-project") ||
    trimmed.startsWith("<schematic") ||
    trimmed.startsWith("<circuit") ||
    trimmed.startsWith("<IPC-2581") ||
    trimmed.startsWith("<ipc-2581") ||
    (trimmed.startsWith("<") && trimmed.includes("</"))
  );
}

/** Serializes entire CirZuit project into a structured XML string */
export function buildXml(
  doc: SchematicDoc,
  name: string,
  options?: {
    description?: string;
    createdAt?: number | string;
    undoStack?: SchematicDoc[];
    redoStack?: SchematicDoc[];
    simulation?: any;
    realistic?: any;
  }
): string {
  const pcb = doc.pcb || emptyPcbDoc();
  const createdAt = options?.createdAt || Date.now();
  const updatedAt = Date.now();
  const exportedAt = new Date().toISOString();

  const lines: string[] = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<cirzuit-project version="1.0" app="CirZuit" magic="${ZUIT_MAGIC}">`,
    `  <metadata>`,
    `    <name>${escapeXml(name)}</name>`,
    `    <description>${escapeXml(options?.description || "")}</description>`,
    `    <createdAt>${createdAt}</createdAt>`,
    `    <updatedAt>${updatedAt}</updatedAt>`,
    `    <exportedAt>${exportedAt}</exportedAt>`,
    `  </metadata>`,

    `  <!-- Schematic Module -->`,
    `  <schematic canvasColor="${escapeXml(doc.canvasColor || "black")}" defaultWireColor="${escapeXml(doc.defaultWireColor || "black")}" defaultElementColor="${escapeXml(doc.defaultElementColor || "black")}" defaultWireWidth="${doc.defaultWireWidth ?? 0.1}" defaultNodeSize="${doc.defaultNodeSize ?? 1.0}">`,
    `    <nodes>`,
  ];

  for (const n of doc.nodes || []) {
    let pinNamesXml = "";
    if (n.pinNames && Object.keys(n.pinNames).length > 0) {
      const pinItems = Object.entries(n.pinNames)
        .map(([index, nameStr]) => `<pin index="${index}" name="${escapeXml(nameStr)}" />`)
        .join("\n        ");
      pinNamesXml = `\n      <pinNames>\n        ${pinItems}\n      </pinNames>`;
    }

    let customModelXml = "";
    if (n.customModel) {
      const mappings = Object.entries(n.customModel.pinMapping || {})
        .map(([symPin, modPin]) => `<map symPin="${escapeXml(symPin)}" modPin="${escapeXml(modPin)}" />`)
        .join("\n        ");
      customModelXml = `\n      <customModel modelId="${escapeXml(n.customModel.modelId)}">\n        ${mappings}\n      </customModel>`;
    }

    lines.push(
      `      <node id="${escapeXml(n.id)}" symbol="${escapeXml(n.symbol)}" x="${n.x}" y="${n.y}" rotation="${n.rotation}" reference="${escapeXml(n.reference || "")}" value="${escapeXml(n.value || "")}" label="${escapeXml(n.label || "")}" notes="${escapeXml(n.notes || "")}" color="${escapeXml(n.color || "")}" size="${n.size ?? 1.0}">${pinNamesXml}${customModelXml}\n      </node>`
    );
  }

  lines.push(`    </nodes>`);
  lines.push(`    <wires>`);

  for (const w of doc.wires || []) {
    const pts = (w.points || [])
      .map((p) => `        <point x="${p.x}" y="${p.y}" />`)
      .join("\n");
    lines.push(
      `      <wire id="${escapeXml(w.id)}" color="${escapeXml(w.color || "black")}" width="${w.width ?? 0.1}">\n        <points>\n${pts}\n        </points>\n      </wire>`
    );
  }

  lines.push(`    </wires>`);

  // Faults, Bookmarks
  if (doc.faults && doc.faults.length > 0) {
    lines.push(`    <faults>`);
    for (const f of doc.faults) {
      lines.push(`      <fault id="${escapeXml(f.id)}" type="${escapeXml(f.type)}" targetId="${escapeXml(f.targetId)}" description="${escapeXml(f.description || "")}" />`);
    }
    lines.push(`    </faults>`);
  }

  if (doc.bookmarks && doc.bookmarks.length > 0) {
    lines.push(`    <bookmarks>`);
    for (const b of doc.bookmarks) {
      lines.push(`      <bookmark id="${escapeXml(b.id)}" name="${escapeXml(b.name)}" x="${b.x}" y="${b.y}" zoom="${b.zoom}" />`);
    }
    lines.push(`    </bookmarks>`);
  }

  lines.push(`  </schematic>`);

  // PCB Module
  lines.push(`  <!-- PCB Module -->`);
  lines.push(
    `  <pcb version="${pcb.version ?? 1}" unit="${escapeXml(pcb.unit || "mm")}" width="${pcb.width ?? 80}" height="${pcb.height ?? 60}" gridMm="${pcb.gridMm ?? 4}" ratsnestVisible="${pcb.ratsnestVisible !== false}">`
  );

  lines.push(`    <layers>`);
  for (const l of pcb.layers || []) {
    lines.push(`      <layer id="${escapeXml(l.id)}" name="${escapeXml(l.name)}" color="${escapeXml(l.color)}" visible="${l.visible !== false}" />`);
  }
  lines.push(`    </layers>`);

  lines.push(`    <tracks>`);
  for (const t of pcb.tracks || []) {
    const pts = (t.points || []).map((p) => `        <point x="${p.x}" y="${p.y}" />`).join("\n");
    lines.push(`      <track id="${escapeXml(t.id)}" layer="${escapeXml(t.layer)}" width="${t.width}">\n        <points>\n${pts}\n        </points>\n      </track>`);
  }
  lines.push(`    </tracks>`);

  lines.push(`    <vias>`);
  for (const v of pcb.vias || []) {
    lines.push(`      <via id="${escapeXml(v.id)}" x="${v.x}" y="${v.y}" drill="${v.drill}" diameter="${v.diameter}" shape="${escapeXml(v.shape || "circle")}" />`);
  }
  lines.push(`    </vias>`);

  lines.push(`    <pads>`);
  for (const p of pcb.pads || []) {
    lines.push(`      <pad id="${escapeXml(p.id)}" x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" shape="${escapeXml(p.shape)}" layer="${escapeXml(p.layer)}" drill="${p.drill ?? 0}" number="${escapeXml(p.number || "")}" />`);
  }
  lines.push(`    </pads>`);

  lines.push(`    <measures>`);
  for (const m of pcb.measures || []) {
    lines.push(`      <measure id="${escapeXml(m.id)}" ax="${m.a.x}" ay="${m.a.y}" bx="${m.b.x}" by="${m.b.y}" />`);
  }
  lines.push(`    </measures>`);

  if (pcb.texts && pcb.texts.length > 0) {
    lines.push(`    <texts>`);
    for (const tx of pcb.texts) {
      lines.push(`      <text id="${escapeXml(tx.id)}" x="${tx.x}" y="${tx.y}" size="${tx.size}" layer="${escapeXml(tx.layer)}" rotation="${tx.rotation}">${escapeXml(tx.text)}</text>`);
    }
    lines.push(`    </texts>`);
  }

  lines.push(`    <footprints>`);
  for (const fp of pcb.footprints || []) {
    const padItems = (fp.pads || []).map(p => 
      `        <pad pinIndex="${p.pinIndex}" number="${escapeXml(p.number || "")}" name="${escapeXml(p.name || "")}" x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}" shape="${escapeXml(p.shape)}" layer="${escapeXml(p.layer)}" drill="${p.drill ?? 0}" />`
    ).join("\n");
    lines.push(`      <footprint id="${escapeXml(fp.id)}" reference="${escapeXml(fp.reference || "")}" value="${escapeXml(fp.value || "")}" symbol="${escapeXml(fp.symbol)}" packageId="${escapeXml(fp.packageId || "")}" x="${fp.x}" y="${fp.y}" rotation="${fp.rotation}">\n        <pads>\n${padItems}\n        </pads>\n      </footprint>`);
  }
  lines.push(`    </footprints>`);

  lines.push(`  </pcb>`);

  // Realistic settings
  const realistic = options?.realistic || {
    viewMode: "3d_workbench",
    showComponents: true,
    boardColor: "#064e3b",
    copperColor: "#d97706",
    silkscreenColor: "#ffffff",
  };
  lines.push(`  <!-- Realistic 3D Settings -->`);
  lines.push(`  <realistic viewMode="${escapeXml(realistic.viewMode || "3d_workbench")}" showComponents="${realistic.showComponents !== false}" boardColor="${escapeXml(realistic.boardColor || "#064e3b")}" copperColor="${escapeXml(realistic.copperColor || "#d97706")}" silkscreenColor="${escapeXml(realistic.silkscreenColor || "#ffffff")}" />`);

  lines.push(`</cirzuit-project>`);

  return lines.join("\n");
}

/** Download XML project file to client browser */
export function downloadXmlProject(
  doc: SchematicDoc,
  name: string,
  options?: {
    description?: string;
    createdAt?: number | string;
    undoStack?: SchematicDoc[];
    redoStack?: SchematicDoc[];
    simulation?: any;
    realistic?: any;
  }
) {
  const xmlText = buildXml(doc, name, options);
  const blob = new Blob([xmlText], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = name.trim().replace(/\s+/g, "_") || "project";
  a.download = `${safeName}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Helper function to get text content or attribute from XML DOM element */
function getXmlVal(el: Element | null, attrNames: string[]): string | null {
  if (!el) return null;
  for (const attr of attrNames) {
    if (el.hasAttribute(attr)) return el.getAttribute(attr);
    const child = el.getElementsByTagName(attr)[0];
    if (child && child.textContent !== null) return child.textContent.trim();
  }
  return null;
}

function getXmlFloat(el: Element | null, attrNames: string[], defaultVal = 0): number {
  const val = getXmlVal(el, attrNames);
  if (val === null) return defaultVal;
  const num = parseFloat(val);
  return isNaN(num) ? defaultVal : num;
}

function getXmlInt(el: Element | null, attrNames: string[], defaultVal = 0): number {
  const val = getXmlVal(el, attrNames);
  if (val === null) return defaultVal;
  const num = parseInt(val, 10);
  return isNaN(num) ? defaultVal : num;
}

/** Parses XML string into ParsedZuitResult */
export function readXmlProject(xmlText: string, defaultName = "Imported XML Project", lang: "ar" | "en" = "en"): ParsedZuitResult | null {
  try {
    if (!xmlText || typeof xmlText !== "string") return null;

    // Check if it is IPC-2581 format
    if (isIpc2581Content(xmlText)) {
      const { doc, name } = parseIpc2581(xmlText, defaultName, lang);
      return {
        doc,
        name,
        undoStack: [],
        redoStack: [],
      };
    }

    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");

    // Check DOM parser errors
    const parserError = xmlDoc.getElementsByTagName("parsererror")[0];
    if (parserError) {
      console.warn("DOMParser reported XML error, attempting lenient fallback regex parsing...", parserError.textContent);
    }

    // Root project details
    const rootEl =
      xmlDoc.getElementsByTagName("cirzuit-project")[0] ||
      xmlDoc.getElementsByTagName("project")[0] ||
      xmlDoc.getElementsByTagName("circuit")[0] ||
      xmlDoc.getElementsByTagName("schematic")[0] ||
      xmlDoc.documentElement;

    let projName = defaultName;
    let projDescription = "";

    const metaNameEl = xmlDoc.getElementsByTagName("name")[0];
    if (metaNameEl && metaNameEl.textContent) projName = metaNameEl.textContent.trim();
    else if (rootEl && rootEl.hasAttribute("name")) projName = rootEl.getAttribute("name") || defaultName;

    const metaDescEl = xmlDoc.getElementsByTagName("description")[0];
    if (metaDescEl && metaDescEl.textContent) projDescription = metaDescEl.textContent.trim();

    // Schematic parse
    const schematicEl =
      xmlDoc.getElementsByTagName("schematic")[0] ||
      xmlDoc.getElementsByTagName("circuit")[0] ||
      rootEl;

    const canvasColor = (getXmlVal(schematicEl, ["canvasColor", "canvas_color", "bg"]) || "black") as CanvasColor;
    const defaultWireColor = (getXmlVal(schematicEl, ["defaultWireColor", "wireColor"]) || "black") as WireColor;
    const defaultElementColor = (getXmlVal(schematicEl, ["defaultElementColor", "elementColor"]) || "black") as WireColor;
    const defaultWireWidth = getXmlFloat(schematicEl, ["defaultWireWidth", "wireWidth"], 0.1);
    const defaultNodeSize = getXmlFloat(schematicEl, ["defaultNodeSize", "nodeSize"], 1.0);

    const docNodes: SchematicNode[] = [];
    const docWires: SchematicWire[] = [];

    // Parse Nodes / Components / Symbols
    const nodeElements = Array.from(xmlDoc.getElementsByTagName("node"))
      .concat(Array.from(xmlDoc.getElementsByTagName("component")))
      .concat(Array.from(xmlDoc.getElementsByTagName("symbol")))
      .concat(Array.from(xmlDoc.getElementsByTagName("part")));

    for (const el of nodeElements) {
      const id = getXmlVal(el, ["id", "uuid", "key"]) || crypto.randomUUID();
      let symbol = getXmlVal(el, ["symbol", "type", "kind", "model", "nameAlias"]) || "resistor";

      // Match symbol to catalog if needed
      const knownSymbols = Object.keys(SYMBOLS);
      if (!knownSymbols.includes(symbol)) {
        const lower = symbol.toLowerCase();
        if (lower.includes("res") || lower.includes("r")) symbol = "resistor";
        else if (lower.includes("cap") || lower.includes("c")) symbol = "capacitor";
        else if (lower.includes("led")) symbol = "led";
        else if (lower.includes("diode")) symbol = "diode2";
        else if (lower.includes("trans") || lower.includes("q") || lower.includes("npn") || lower.includes("pnp")) symbol = "transistor";
        else if (lower.includes("gnd") || lower.includes("ground")) symbol = "gnd";
        else if (lower.includes("vcc") || lower.includes("vdd") || lower.includes("power")) symbol = "vcc";
        else if (lower.includes("opamp")) symbol = "opamp4";
        else if (lower.includes("switch") || lower.includes("sw")) symbol = "switch";
        else symbol = "resistor";
      }

      const x = getXmlFloat(el, ["x", "pos_x", "posX"], 0);
      const y = getXmlFloat(el, ["y", "pos_y", "posY"], 0);
      const rotRaw = getXmlInt(el, ["rotation", "rot", "angle"], 0);
      const rotation = (((Math.round(rotRaw / 90) * 90) % 360) + 360) % 360 as 0 | 90 | 180 | 270;

      const reference = getXmlVal(el, ["reference", "ref", "designator", "label_ref"]) || undefined;
      const value = getXmlVal(el, ["value", "val", "param"]) || undefined;
      const label = getXmlVal(el, ["label", "title", "text"]) || undefined;
      const notes = getXmlVal(el, ["notes", "comment"]) || undefined;
      const color = (getXmlVal(el, ["color", "elementColor"]) || undefined) as WireColor | undefined;
      const size = getXmlFloat(el, ["size", "scale"], 1.0);

      // Pin names
      const pinNamesMap: Record<number, string> = {};
      const pinNameEls = el.getElementsByTagName("pin");
      for (let i = 0; i < pinNameEls.length; i++) {
        const pEl = pinNameEls[i];
        const pIdx = getXmlInt(pEl, ["index", "idx", "num"], i);
        const pName = getXmlVal(pEl, ["name", "label", "pinName"]);
        if (pName) pinNamesMap[pIdx] = pName;
      }

      docNodes.push({
        id,
        symbol,
        x,
        y,
        rotation,
        reference,
        value,
        label,
        notes,
        color,
        size,
        pinNames: Object.keys(pinNamesMap).length > 0 ? pinNamesMap : undefined,
      });
    }

    // Parse Wires / Connections / Segments
    const wireElements = Array.from(xmlDoc.getElementsByTagName("wire"))
      .concat(Array.from(xmlDoc.getElementsByTagName("connection")))
      .concat(Array.from(xmlDoc.getElementsByTagName("net")));

    for (const el of wireElements) {
      const id = getXmlVal(el, ["id", "key"]) || crypto.randomUUID();
      const color = (getXmlVal(el, ["color", "stroke"]) || defaultWireColor) as WireColor;
      const width = getXmlFloat(el, ["width", "thickness"], defaultWireWidth);

      const points: { x: number; y: number }[] = [];
      const pointEls = el.getElementsByTagName("point");

      for (let i = 0; i < pointEls.length; i++) {
        const pEl = pointEls[i];
        const px = getXmlFloat(pEl, ["x", "pos_x"], 0);
        const py = getXmlFloat(pEl, ["y", "pos_y"], 0);
        points.push({ x: px, y: py });
      }

      // If points weren't nested in <point>, check x1, y1, x2, y2 attributes
      if (points.length === 0 && el.hasAttribute("x1")) {
        const x1 = getXmlFloat(el, ["x1"], 0);
        const y1 = getXmlFloat(el, ["y1"], 0);
        const x2 = getXmlFloat(el, ["x2"], 0);
        const y2 = getXmlFloat(el, ["y2"], 0);
        points.push({ x: x1, y: y1 });
        points.push({ x: x2, y: y2 });
      }

      if (points.length >= 2) {
        docWires.push({ id, color, width, points });
      }
    }

    // PCB parse
    const pcbEl = xmlDoc.getElementsByTagName("pcb")[0] || xmlDoc.getElementsByTagName("board")[0];
    let pcbDoc: PcbDoc | undefined;

    if (pcbEl) {
      const pcb = emptyPcbDoc();
      pcb.unit = (getXmlVal(pcbEl, ["unit"]) || "mm") as any;
      pcb.width = getXmlFloat(pcbEl, ["width", "w"], 80);
      pcb.height = getXmlFloat(pcbEl, ["height", "h"], 60);
      pcb.gridMm = getXmlFloat(pcbEl, ["gridMm", "grid"], 4);
      const ratsnestVal = getXmlVal(pcbEl, ["ratsnestVisible", "ratsnest"]);
      if (ratsnestVal !== null) pcb.ratsnestVisible = ratsnestVal !== "false";

      // Layers
      const layerEls = pcbEl.getElementsByTagName("layer");
      if (layerEls.length > 0) {
        pcb.layers = [];
        for (let i = 0; i < layerEls.length; i++) {
          const lEl = layerEls[i];
          const lId = getXmlVal(lEl, ["id", "name"]) as any;
          const lName = getXmlVal(lEl, ["name", "label"]) || lId;
          const lColor = getXmlVal(lEl, ["color", "hex"]) || "#3b82f6";
          const lVis = getXmlVal(lEl, ["visible", "show"]) !== "false";
          if (lId) pcb.layers.push({ id: lId, name: lName, color: lColor, visible: lVis });
        }
      }

      // Tracks
      const trackEls = pcbEl.getElementsByTagName("track");
      for (let i = 0; i < trackEls.length; i++) {
        const trEl = trackEls[i];
        const trId = getXmlVal(trEl, ["id"]) || crypto.randomUUID();
        const trLayer = (getXmlVal(trEl, ["layer"]) || "top_copper") as any;
        const trWidth = getXmlFloat(trEl, ["width", "thickness"], 0.5);

        const pts: { x: number; y: number }[] = [];
        const ptEls = trEl.getElementsByTagName("point");
        for (let j = 0; j < ptEls.length; j++) {
          pts.push({ x: getXmlFloat(ptEls[j], ["x"], 0), y: getXmlFloat(ptEls[j], ["y"], 0) });
        }
        if (pts.length >= 2) pcb.tracks.push({ id: trId, layer: trLayer, width: trWidth, points: pts });
      }

      // Vias
      const viaEls = pcbEl.getElementsByTagName("via");
      for (let i = 0; i < viaEls.length; i++) {
        const vEl = viaEls[i];
        pcb.vias.push({
          id: getXmlVal(vEl, ["id"]) || crypto.randomUUID(),
          x: getXmlFloat(vEl, ["x"], 0),
          y: getXmlFloat(vEl, ["y"], 0),
          drill: getXmlFloat(vEl, ["drill"], 0.4),
          diameter: getXmlFloat(vEl, ["diameter", "size"], 0.8),
          shape: (getXmlVal(vEl, ["shape"]) || "circle") as any,
        });
      }

      // Pads
      const padEls = pcbEl.getElementsByTagName("pad");
      for (let i = 0; i < padEls.length; i++) {
        const pdEl = padEls[i];
        pcb.pads.push({
          id: getXmlVal(pdEl, ["id"]) || crypto.randomUUID(),
          x: getXmlFloat(pdEl, ["x"], 0),
          y: getXmlFloat(pdEl, ["y"], 0),
          width: getXmlFloat(pdEl, ["width", "w"], 1.5),
          height: getXmlFloat(pdEl, ["height", "h"], 1.5),
          shape: (getXmlVal(pdEl, ["shape"]) || "circle") as any,
          layer: (getXmlVal(pdEl, ["layer"]) || "top_copper") as any,
          drill: getXmlFloat(pdEl, ["drill"], 0),
          number: getXmlVal(pdEl, ["number", "num", "pin"]) || undefined,
        });
      }

      // Footprints
      const fpEls = pcbEl.getElementsByTagName("footprint");
      for (let i = 0; i < fpEls.length; i++) {
        const fpEl = fpEls[i];
        const pads: PcbFootprintPad[] = [];
        const fpPads = fpEl.getElementsByTagName("pad");
        for (let j = 0; j < fpPads.length; j++) {
          const p = fpPads[j];
          pads.push({
            pinIndex: getXmlInt(p, ["pinIndex", "index"], j),
            number: getXmlVal(p, ["number", "num"]) || undefined,
            name: getXmlVal(p, ["name", "label"]) || undefined,
            x: getXmlFloat(p, ["x"], 0),
            y: getXmlFloat(p, ["y"], 0),
            width: getXmlFloat(p, ["width", "w"], 1.5),
            height: getXmlFloat(p, ["height", "h"], 1.5),
            shape: (getXmlVal(p, ["shape"]) || "circle") as any,
            layer: (getXmlVal(p, ["layer"]) || "multi_layer") as any,
            drill: getXmlFloat(p, ["drill"], 0),
          });
        }

        pcb.footprints.push({
          id: getXmlVal(fpEl, ["id"]) || crypto.randomUUID(),
          reference: getXmlVal(fpEl, ["reference", "ref"]) || undefined,
          value: getXmlVal(fpEl, ["value", "val"]) || undefined,
          symbol: getXmlVal(fpEl, ["symbol"]) || "resistor",
          packageId: getXmlVal(fpEl, ["packageId", "pkg"]) || undefined,
          x: getXmlFloat(fpEl, ["x"], 0),
          y: getXmlFloat(fpEl, ["y"], 0),
          rotation: getXmlFloat(fpEl, ["rotation", "rot"], 0),
          pads,
        });
      }

      pcbDoc = pcb;
    }

    const schematicDoc: SchematicDoc = {
      nodes: docNodes,
      wires: docWires,
      canvasColor,
      defaultWireColor,
      defaultElementColor,
      defaultWireWidth,
      defaultNodeSize,
      pcb: pcbDoc,
    };

    return {
      doc: schematicDoc,
      name: projName,
      description: projDescription,
      undoStack: [],
      redoStack: [],
    };
  } catch (err) {
    console.error("Failed to parse XML project:", err);
    return null;
  }
}
