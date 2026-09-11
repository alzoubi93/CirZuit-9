// Netlist computation via union-find over wire points + pin positions.
import { SchematicDoc, SchematicWire, SchematicNetLabel, pointToSegmentDistance } from "./schematic";
import { SYMBOLS, transformedPins, type SymbolDef } from "./symbols";
import { getImportedKiCadParsedSymbol, kicadToSymbolDef, resolveKicadUnit } from "./kicadSymbol";

const EPS = 0.45;

interface PinRef { nodeId: string; pinIndex: number; x: number; y: number; }
interface LabelRef { id: string; text: string; x: number; y: number; scope: "local" | "global"; }

export interface Net {
  id: number;
  /** Stable identity derived from component UUID + pin index membership. */
  key: string;
  /** User-facing fallback name until explicit net labels are supported. */
  name: string;
  wireIds: Set<string>;
  pins: PinRef[];
  labelIds: string[];
  labels: string[];
}

export interface NetIndex {
  nets: Net[];
  wireNet: Map<string, number>;
  pinNet: Map<string, number>; // key = `${nodeId}:${pinIndex}`
  gridNet: Map<string, number>; // key = `${x*10},${y*10}`
  labelNet: Map<string, number>;
}

class UF {
  parent = new Map<string, string>();
  find(x: string): string {
    const p = this.parent.get(x);
    if (!p || p === x) { this.parent.set(x, x); return x; }
    const r = this.find(p);
    this.parent.set(x, r);
    return r;
  }
  union(a: string, b: string) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }
}

export function buildNetIndex(doc: SchematicDoc): NetIndex {
  const uf = new UF();
  const wireKey = (id: string) => `W:${id}`;
  const pinKey = (n: string, i: number) => `P:${n}:${i}`;

  // Collect pins. Imported KiCad multi-unit symbols use the selected unit's
  // electrical pins; native CirZuit symbols use the normal SymbolDef path.
  const pins: PinRef[] = [];
  for (const n of doc.nodes) {
    let sym: SymbolDef | undefined = SYMBOLS[n.symbol];
    const parsed = getImportedKiCadParsedSymbol(n.symbol);
    if (parsed && n.unit && n.unit > 0) {
      const resolved = resolveKicadUnit(parsed, n.unit, parsed.selectedBodyStyle || 1);
      if (resolved.pins.length) {
        const unitParsed = { ...parsed, pins: resolved.pins, bodyGraphics: resolved.graphics };
        sym = kicadToSymbolDef(unitParsed, n.symbol);
      }
    }
    if (!sym) continue;
    transformedPins(sym, n.rotation, n.size ?? 1).forEach((p, i) => {
      pins.push({ nodeId: n.id, pinIndex: i, x: n.x + p.x, y: n.y + p.y });
    });
    for (let i = 0; i < sym.pins.length; i++) uf.find(pinKey(n.id, i));
  }
  for (const w of doc.wires) uf.find(wireKey(w.id));
  const labels: LabelRef[] = (doc.netLabels ?? [])
    .filter(l => l.text.trim())
    .map(l => ({ id: l.id, text: l.text.trim(), x: l.x, y: l.y, scope: l.scope ?? "local" }));
  const labelKey = (id: string) => `L:${id}`;
  for (const l of labels) uf.find(labelKey(l.id));

  // Union wires that share any vertex (endpoints or interior).
  const ptKey = (p: { x: number; y: number }) => `${Math.round(p.x * 10)},${Math.round(p.y * 10)}`;
  const wiresByPt = new Map<string, string[]>();
  for (const w of doc.wires) {
    for (const p of w.points) {
      const k = ptKey(p);
      const arr = wiresByPt.get(k) ?? [];
      arr.push(w.id);
      wiresByPt.set(k, arr);
    }
  }
  for (const arr of wiresByPt.values()) {
    for (let i = 1; i < arr.length; i++) uf.union(wireKey(arr[0]), wireKey(arr[i]));
  }

  // Union wires whose segment passes through another wire's vertex (T-junction)
  for (const w of doc.wires) {
    for (let i = 0; i < w.points.length - 1; i++) {
      const a = w.points[i], b = w.points[i + 1];
      for (const ow of doc.wires) {
        if (ow.id === w.id) continue;
        for (const p of ow.points) {
          if (pointToSegmentDistance(p, a, b) <= EPS) {
            uf.union(wireKey(w.id), wireKey(ow.id));
          }
        }
      }
    }
  }

  // Union pins to wires they touch (endpoint coincidence OR mid-segment).
  for (const pr of pins) {
    for (const w of doc.wires) {
      let touched = false;
      for (const p of w.points) {
        if (Math.hypot(p.x - pr.x, p.y - pr.y) < EPS) { touched = true; break; }
      }
      if (!touched) {
        for (let i = 0; i < w.points.length - 1; i++) {
          if (pointToSegmentDistance(pr, w.points[i], w.points[i + 1]) <= EPS) { touched = true; break; }
        }
      }
      if (touched) uf.union(pinKey(pr.nodeId, pr.pinIndex), wireKey(w.id));
    }
  }

  // Attach labels to wires/pins by anchor position.
  for (const l of labels) {
    for (const w of doc.wires) {
      let touched = false;
      for (const p of w.points) {
        if (Math.hypot(p.x - l.x, p.y - l.y) <= EPS) { touched = true; break; }
      }
      if (!touched) {
        for (let i = 0; i < w.points.length - 1; i++) {
          if (pointToSegmentDistance(l, w.points[i], w.points[i + 1]) <= EPS) { touched = true; break; }
        }
      }
      if (touched) uf.union(labelKey(l.id), wireKey(w.id));
    }
    for (const pr of pins) {
      if (Math.hypot(pr.x - l.x, pr.y - l.y) <= EPS) uf.union(labelKey(l.id), pinKey(pr.nodeId, pr.pinIndex));
    }
  }

  // Global labels with the same name are electrically equivalent even when
  // they are placed on disconnected wire islands. Local labels only name the
  // connected island to which they are attached.
  const globalLabels = new Map<string, string>();
  for (const l of labels) {
    if (l.scope !== "global") continue;
    const k = l.text.toLowerCase();
    const first = globalLabels.get(k);
    if (first) uf.union(labelKey(first), labelKey(l.id));
    else globalLabels.set(k, l.id);
  }

  // Group by root
  const groups = new Map<string, { wires: Set<string>; pins: PinRef[]; labels: LabelRef[] }>();
  for (const w of doc.wires) {
    const r = uf.find(wireKey(w.id));
    const g = groups.get(r) ?? { wires: new Set(), pins: [], labels: [] };
    g.wires.add(w.id);
    groups.set(r, g);
  }
  for (const pr of pins) {
    const r = uf.find(pinKey(pr.nodeId, pr.pinIndex));
    const g = groups.get(r) ?? { wires: new Set(), pins: [], labels: [] };
    g.pins.push(pr);
    groups.set(r, g);
  }
  for (const l of labels) {
    const r = uf.find(labelKey(l.id));
    const g = groups.get(r) ?? { wires: new Set(), pins: [], labels: [] };
    g.labels.push(l);
    groups.set(r, g);
  }

  const groupsWithKeys = Array.from(groups.values())
    .filter(g => g.wires.size > 0 || g.pins.length > 0)
    .map(g => {
      const pinKeys = g.pins.map(p => `P:${p.nodeId}:${p.pinIndex}`).sort();
      const wireKeys = Array.from(g.wires).sort().map(id => `W:${id}`);
      const labelKeys = g.labels.map(l => `L:${l.scope}:${l.text.toLowerCase()}`).sort();
      const keyParts = pinKeys.length ? pinKeys : (wireKeys.length ? wireKeys : labelKeys);
      if (labelKeys.length && pinKeys.length) keyParts.push(...labelKeys);
      return { g, key: keyParts.join("|") || "EMPTY" };
    })
    .sort((a, b) => a.key.localeCompare(b.key));

  const nets: Net[] = [];
  const wireNet = new Map<string, number>();
  const pinNet = new Map<string, number>();
  const gridNet = new Map<string, number>();
  const labelNet = new Map<string, number>();
  groupsWithKeys.forEach(({ g, key }, idx) => {
    const uniqueLabelNames = Array.from(new Set(g.labels.map(l => l.text.trim()).filter(Boolean)));
    const net: Net = { id: idx, key, name: uniqueLabelNames[0] || `N${idx + 1}`, wireIds: g.wires, pins: g.pins, labelIds: g.labels.map(l => l.id), labels: uniqueLabelNames };
    nets.push(net);
    for (const wid of g.wires) {
      wireNet.set(wid, idx);
      const wire = doc.wires.find(w => w.id === wid);
      if (wire) {
        wire.points.forEach(p => {
          gridNet.set(`${Math.round(p.x * 10)},${Math.round(p.y * 10)}`, idx);
        });
      }
    }
    for (const pr of g.pins) {
      pinNet.set(`${pr.nodeId}:${pr.pinIndex}`, idx);
      gridNet.set(`${Math.round(pr.x * 10)},${Math.round(pr.y * 10)}`, idx);
    }
    for (const l of g.labels) labelNet.set(l.id, idx);
  });
  return { nets, wireNet, pinNet, gridNet, labelNet };
}

export function netIdForSelection(
  idx: NetIndex,
  sel: { wireId?: string | null; nodeId?: string | null }
): number | null {
  if (sel.wireId) {
    const n = idx.wireNet.get(sel.wireId);
    return n ?? null;
  }
  if (sel.nodeId) {
    // Return first net touching any pin of the node.
    for (const [k, n] of idx.pinNet) {
      if (k.startsWith(sel.nodeId + ":")) return n;
    }
  }
  return null;
}
