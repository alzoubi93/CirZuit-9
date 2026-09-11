// Universal Schematic Exporter for KiCad (.kicad_sch), EasyEDA JSON, Eagle SCH (.sch), and SPICE Netlist (.cir/.net/.spice)
import { SchematicDoc } from "./schematic";
import { SYMBOLS, transformedPins } from "./symbols";
import { buildNetIndex } from "./netlist";
import { toEasyEDA } from "./exportEasyEDA";

// Helper for file downloading
function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ==========================================
// 1. KiCad Schematic Exporter (.kicad_sch)
// ==========================================

export function generateKiCadSch(doc: SchematicDoc, title: string = "project"): string {
  const SCALE = 2.54; // Map grid units to mm (1 grid = 2.54mm / 100 mil)

  function mapLibId(symId: string): string {
    switch (symId) {
      case "resistor": return "Device:R";
      case "capacitor": return "Device:C";
      case "inductor": return "Device:L";
      case "diode2": return "Device:D";
      case "zener": return "Device:D_Zener";
      case "led": return "Device:LED";
      case "transistor": return "Transistor_BJT:2N2222";
      case "mosfet": return "Transistor_FET:2N7000";
      case "opamp4": return "Amplifier_Operational:LM358";
      case "gnd": return "power:GND";
      case "vcc": return "power:VCC";
      case "battery": return "Device:Battery_Cell";
      case "switch": return "Switch:SW_Push";
      case "fuse": return "Device:Fuse";
      case "transformer": return "Device:Transformer_1P_1S";
      default: return `Device:${symId.toUpperCase()}`;
    }
  }

  const lines: string[] = [];
  lines.push(`(kicad_schematic (version 20211123) (generator "CirZuit")`);
  lines.push(`  (uuid "${crypto.randomUUID()}")`);
  lines.push(`  (paper "A4")`);
  lines.push(`  (title_block`);
  lines.push(`    (title "${title}")`);
  lines.push(`  )`);
  lines.push(`  (lib_symbols)`);

  // Export Wires
  for (const w of doc.wires) {
    if (!w.points || w.points.length < 2) continue;
    for (let i = 0; i < w.points.length - 1; i++) {
      const p1 = w.points[i];
      const p2 = w.points[i + 1];
      const x1 = (p1.x * SCALE).toFixed(2);
      const y1 = (p1.y * SCALE).toFixed(2);
      const x2 = (p2.x * SCALE).toFixed(2);
      const y2 = (p2.y * SCALE).toFixed(2);
      lines.push(`  (wire`);
      lines.push(`    (pts (xy ${x1} ${y1}) (xy ${x2} ${y2}))`);
      lines.push(`    (stroke (width 0) (type default) (color 0 0 0 0))`);
      lines.push(`    (uuid "${crypto.randomUUID()}")`);
      lines.push(`  )`);
    }
  }

  // Export Components
  let refCount = 1;
  for (const n of doc.nodes) {
    const sym = SYMBOLS[n.symbol];
    const libId = mapLibId(n.symbol);
    const x = (n.x * SCALE).toFixed(2);
    const y = (n.y * SCALE).toFixed(2);
    const rot = n.rotation || 0;
    const ref = n.reference || `${n.symbol[0].toUpperCase()}${refCount++}`;
    const val = n.value || sym?.name || n.symbol;

    lines.push(`  (symbol (lib_id "${libId}") (at ${x} ${y} ${rot}) (unit 1)`);
    lines.push(`    (in_bom yes) (on_board yes)`);
    lines.push(`    (uuid "${crypto.randomUUID()}")`);
    lines.push(`    (property "Reference" "${ref}" (id 0) (at ${x} ${(n.y * SCALE - 2.54).toFixed(2)} 0)`);
    lines.push(`      (effects (font (size 1.27 1.27)))`);
    lines.push(`    )`);
    lines.push(`    (property "Value" "${val}" (id 1) (at ${x} ${(n.y * SCALE + 2.54).toFixed(2)} 0)`);
    lines.push(`      (effects (font (size 1.27 1.27)))`);
    lines.push(`    )`);
    lines.push(`    (property "Footprint" "" (id 2) (at ${x} ${y} 0)`);
    lines.push(`      (effects (font (size 1.27 1.27)) hide)`);
    lines.push(`    )`);
    lines.push(`    (property "Datasheet" "~" (id 3) (at ${x} ${y} 0)`);
    lines.push(`      (effects (font (size 1.27 1.27)) hide)`);
    lines.push(`    )`);
    lines.push(`  )`);
  }

  lines.push(`)`);
  return lines.join("\n");
}

export function downloadKiCadSch(doc: SchematicDoc, filename: string) {
  const content = generateKiCadSch(doc, filename);
  downloadBlob(content, `${filename}.kicad_sch`, "text/plain");
}

// ==========================================
// 2. EasyEDA JSON Exporter (.json)
// ==========================================

export function generateEasyEdaJson(doc: SchematicDoc, title: string = "project"): string {
  const obj = toEasyEDA(doc, title);
  return JSON.stringify(obj, null, 2);
}

export function downloadEasyEdaJson(doc: SchematicDoc, filename: string) {
  const content = generateEasyEdaJson(doc, filename);
  downloadBlob(content, `${filename}.easyeda.json`, "application/json");
}

// ==========================================
// 3. EAGLE Schematic Exporter (.sch XML)
// ==========================================

export function generateEagleSch(doc: SchematicDoc, title: string = "project"): string {
  const SCALE = 2.54; // mm per unit

  const partsXml: string[] = [];
  const instancesXml: string[] = [];
  const netsXml: string[] = [];

  let refIdx = 1;
  for (const n of doc.nodes) {
    const sym = SYMBOLS[n.symbol];
    const ref = n.reference || `${n.symbol[0].toUpperCase()}${refIdx++}`;
    const val = n.value || sym?.name || n.symbol;
    const x = (n.x * SCALE).toFixed(2);
    const y = (n.y * SCALE).toFixed(2);
    const rot = `R${n.rotation || 0}`;

    partsXml.push(`        <part name="${ref}" library="rcl" deviceset="${n.symbol.toUpperCase()}" value="${val}"/>`);
    instancesXml.push(`            <instance part="${ref}" gate="G$1" x="${x}" y="${y}" rot="${rot}"/>`);
  }

  let wireNetIdx = 1;
  for (const w of doc.wires) {
    if (!w.points || w.points.length < 2) continue;
    const segments: string[] = [];
    for (let i = 0; i < w.points.length - 1; i++) {
      const p1 = w.points[i];
      const p2 = w.points[i + 1];
      const x1 = (p1.x * SCALE).toFixed(2);
      const y1 = (p1.y * SCALE).toFixed(2);
      const x2 = (p2.x * SCALE).toFixed(2);
      const y2 = (p2.y * SCALE).toFixed(2);
      segments.push(`              <wire x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" width="0.1524" layer="91"/>`);
    }
    netsXml.push(`          <net name="N$${wireNetIdx++}">\n            <segment>\n${segments.join("\n")}\n            </segment>\n          </net>`);
  }

  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE eagle SYSTEM "eagle.dtd">
<eagle version="9.6.2">
  <drawing>
    <settings>
      <setting alwaysvectorfont="no"/>
      <setting verticaltext="up"/>
    </settings>
    <grid distance="0.1" unitdist="inch" unit="inch" style="lines" multiple="1" display="no" altdistance="0.01" altunitdist="inch" altunit="inch"/>
    <layers>
      <layer number="91" name="Nets" color="2" fill="1" visible="yes" active="yes"/>
      <layer number="92" name="Pins" color="2" fill="1" visible="yes" active="yes"/>
      <layer number="94" name="Symbols" color="4" fill="1" visible="yes" active="yes"/>
      <layer number="95" name="Names" color="7" fill="1" visible="yes" active="yes"/>
      <layer number="96" name="Values" color="7" fill="1" visible="yes" active="yes"/>
    </layers>
    <schematic group="1">
      <libraries>
      </libraries>
      <attributes>
      </attributes>
      <variantdefs>
      </variantdefs>
      <classes>
        <class number="0" name="default" width="0" drill="0">
        </class>
      </classes>
      <parts>
${partsXml.join("\n")}
      </parts>
      <sheets>
        <sheet>
          <plain>
          </plain>
          <instances>
${instancesXml.join("\n")}
          </instances>
          <busses>
          </busses>
          <nets>
${netsXml.join("\n")}
          </nets>
        </sheet>
      </sheets>
    </schematic>
  </drawing>
</eagle>`;
}

export function downloadEagleSch(doc: SchematicDoc, filename: string) {
  const content = generateEagleSch(doc, filename);
  downloadBlob(content, `${filename}.sch`, "application/xml");
}

// ==========================================
// 4. SPICE Netlist Exporter (.cir/.net/.spice)
// ==========================================

export function generateSpiceNetlist(doc: SchematicDoc, title: string = "project"): string {
  const netIndex = buildNetIndex(doc);

  function getNetName(netId: number | null | undefined): string {
    if (netId === null || netId === undefined) return "0";
    const net = netIndex.nets[netId];
    if (!net) return "0";

    // Check if net touches GND or VCC symbols
    for (const p of net.pins) {
      const node = doc.nodes.find(n => n.id === p.nodeId);
      if (node) {
        if (node.symbol === "gnd") return "0";
        if (node.symbol === "vcc") return "VCC";
      }
    }
    return `N_${netId + 1}`;
  }

  const lines: string[] = [];
  lines.push(`* SPICE Netlist generated by CirZuit Schematic Editor`);
  lines.push(`* Title: ${title}`);
  lines.push(``);

  let refCounter = 1;

  for (const n of doc.nodes) {
    if (n.symbol === "gnd" || n.symbol === "vcc") continue; // Ground / VCC symbol nodes are power rails

    const sym = SYMBOLS[n.symbol];
    if (!sym) continue;

    const ref = n.reference || `${n.symbol[0].toUpperCase()}${refCounter++}`;
    const val = n.value || "1";

    // Find net names for each pin
    const pinNets: string[] = [];
    for (let pinIdx = 0; pinIdx < sym.pins.length; pinIdx++) {
      const netId = netIndex.pinNet.get(`${n.id}:${pinIdx}`);
      pinNets.push(getNetName(netId));
    }

    // Default pin mapping if unconnected
    while (pinNets.length < sym.pins.length) {
      pinNets.push("0");
    }

    const typeChar = ref[0].toUpperCase();

    if (typeChar === "R") {
      lines.push(`${ref} ${pinNets[0] || "0"} ${pinNets[1] || "0"} ${val}`);
    } else if (typeChar === "C") {
      lines.push(`${ref} ${pinNets[0] || "0"} ${pinNets[1] || "0"} ${val}`);
    } else if (typeChar === "L") {
      lines.push(`${ref} ${pinNets[0] || "0"} ${pinNets[1] || "0"} ${val}`);
    } else if (typeChar === "D") {
      lines.push(`${ref} ${pinNets[0] || "0"} ${pinNets[1] || "0"} D1N4148`);
    } else if (typeChar === "Q") {
      lines.push(`${ref} ${pinNets[0] || "0"} ${pinNets[1] || "0"} ${pinNets[2] || "0"} Q2N2222`);
    } else if (typeChar === "M") {
      lines.push(`${ref} ${pinNets[0] || "0"} ${pinNets[1] || "0"} ${pinNets[2] || "0"} NMOS`);
    } else if (typeChar === "V" || n.symbol === "battery") {
      lines.push(`${ref} ${pinNets[0] || "0"} ${pinNets[1] || "0"} DC ${val}`);
    } else {
      lines.push(`X${ref} ${pinNets.join(" ")} ${val}`);
    }
  }

  lines.push(``);
  lines.push(`.TRAN 1u 10m`);
  lines.push(`.END`);
  return lines.join("\n");
}

export function downloadSpiceNetlist(doc: SchematicDoc, filename: string) {
  const content = generateSpiceNetlist(doc, filename);
  downloadBlob(content, `${filename}.cir`, "text/plain");
}
