/** Open string id — see src/lib/symbols.tsx for the catalog. */
export type SymbolId = string;

export type WireColor = "black" | "red" | "green" | "blue" | "yellow" | "white";
export type CanvasColor = "white" | "black";

export type PinType = "input" | "output" | "io" | "power" | "ground" | "passive" | "nc";

export interface PinMapping {
  [symbolPinName: string]: string; // symbol pin -> model pin
}

export interface CustomModelAssignment {
  modelId: string;
  pinMapping: PinMapping;
}

export interface SchematicNode {
  /** Stable component identity; id is also used as the PCB footprint link key. */
  id: string;
  symbol: SymbolId;
  x: number;
  y: number;
  rotation: 0 | 90 | 180 | 270;
  /** KiCad electrical unit selected for multi-unit symbols (1-based). */
  unit?: number;
  /** Shared identity for multiple unit instances that belong to one physical component. */
  unitGroupId?: string;
  unitCount?: number;
  label?: string;
  reference?: string;
  value?: string;
  notes?: string;
  pinNames?: Record<number, string>;
  color?: WireColor;
  size?: number;
  customModel?: CustomModelAssignment;
  /** Physical footprint assignment shared by Schematic and PCB. */
  footprint?: string;
  footprintAssignment?: import("./componentLink").FootprintAssignment;
  metadata?: any;
}

export interface SchematicWire {
  id: string;
  points: { x: number; y: number }[];
  color: WireColor;
  width?: number;
}

export interface SchematicNetLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  rotation?: 0 | 90 | 180 | 270;
  /** KiCad-style local label semantics. Same text joins matching connected label anchors. */
  scope?: "local" | "global";
  visible?: boolean;
}

export interface Fault {
  id: string;
  type: "open" | "short" | "failure" | "high_resistance";
  targetId: string; // node id or wire id
  description?: string;
}

export interface Bookmark {
  id: string;
  name: string;
  x: number;
  y: number;
  zoom: number;
}

export interface SchematicDoc {
  version?: number;
  nodes: SchematicNode[];
  wires: SchematicWire[];
  netLabels?: SchematicNetLabel[];
  canvasColor: CanvasColor;
  defaultWireColor: WireColor;
  defaultElementColor?: WireColor;
  defaultWireWidth?: number;
  defaultNodeSize?: number;
  pcb?: import("./pcb").PcbDoc;
  faults?: Fault[];
  bookmarks?: Bookmark[];
  userModels?: import("./spice-models").SpiceModel[];
  ignoredIssues?: string[];
}

export const GRID = 10;

export function computeJunctions(wires: SchematicWire[]): { x: number; y: number }[] {
  const points = new Map<string, Set<string>>();
  for (const w of wires) {
    for (const p of w.points) {
      const key = `${Math.round(p.x * 100) / 100},${Math.round(p.y * 100) / 100}`;
      let set = points.get(key);
      if (!set) { set = new Set(); points.set(key, set); }
      set.add(w.id);
    }
  }
  const result: { x: number; y: number }[] = [];
  for (const [k, s] of points.entries()) {
    if (s.size >= 3) {
      const [x, y] = k.split(",").map(Number);
      result.push({ x, y });
    }
  }
  return result;
}

function pointOnSegmentStrict(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const eps = 1e-6;
  if (Math.abs(a.x - b.x) < eps) {
    if (Math.abs(p.x - a.x) > eps) return false;
    const lo = Math.min(a.y, b.y), hi = Math.max(a.y, b.y);
    return p.y > lo + eps && p.y < hi - eps;
  }
  if (Math.abs(a.y - b.y) < eps) {
    if (Math.abs(p.y - a.y) > eps) return false;
    const lo = Math.min(a.x, b.x), hi = Math.max(a.x, b.x);
    return p.x > lo + eps && p.x < hi - eps;
  }
  return false;
}

export function computeCrossings(wires: SchematicWire[]): { x: number; y: number; horizontal: boolean; wireId: string }[] {
  const out: { x: number; y: number; horizontal: boolean; wireId: string }[] = [];
  const eps = 1e-6;
  type Seg = { a: { x: number; y: number }; b: { x: number; y: number }; wireId: string; horizontal: boolean };
  const segs: Seg[] = [];
  for (const w of wires) {
    for (let i = 0; i < w.points.length - 1; i++) {
      const a = w.points[i], b = w.points[i + 1];
      if (Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps) continue;
      segs.push({ a, b, wireId: w.id, horizontal: Math.abs(a.y - b.y) < eps });
    }
  }
  const sharesEndpoint = (s1: Seg, s2: Seg) => {
    const pts1 = [s1.a, s1.b], pts2 = [s2.a, s2.b];
    for (const p of pts1) for (const q of pts2) if (Math.abs(p.x - q.x) < eps && Math.abs(p.y - q.y) < eps) return true;
    return false;
  };
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const s1 = segs[i], s2 = segs[j];
      if (s1.wireId === s2.wireId) continue;
      if (s1.horizontal === s2.horizontal) continue;
      if (sharesEndpoint(s1, s2)) continue;
      const h = s1.horizontal ? s1 : s2;
      const v = s1.horizontal ? s2 : s1;
      const y = h.a.y, x = v.a.x;
      const hxLo = Math.min(h.a.x, h.b.x), hxHi = Math.max(h.a.x, h.b.x);
      const vyLo = Math.min(v.a.y, v.b.y), vyHi = Math.max(v.a.y, v.b.y);
      if (x > hxLo + eps && x < hxHi - eps && y > vyLo + eps && y < vyHi - eps) {
        out.push({ x, y, horizontal: true, wireId: h.wireId });
      }
    }
  }
  return out;
}

/** Distance from point p to segment a-b (assumed orthogonal in this app). */
export function pointToSegmentDistance(
  p: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Find which (wireId, segmentIndex) the point lies on, within tol; null if none. */
export function findWireHit(
  wires: SchematicWire[],
  p: { x: number; y: number },
  tol = 0.3
): { wireId: string; segIndex: number } | null {
  let best: { wireId: string; segIndex: number; d: number } | null = null;
  for (const w of wires) {
    for (let i = 0; i < w.points.length - 1; i++) {
      const d = pointToSegmentDistance(p, w.points[i], w.points[i + 1]);
      if (d <= tol && (!best || d < best.d)) best = { wireId: w.id, segIndex: i, d };
    }
  }
  return best ? { wireId: best.wireId, segIndex: best.segIndex } : null;
}

/** If point lies strictly inside an orthogonal segment, return a new wire with the
 *  point inserted as a vertex; otherwise return null. */
export function splitWireAtPoint(
  wire: SchematicWire,
  p: { x: number; y: number },
  tol = 0.15
): SchematicWire | null {
  const eps = 1e-3;
  for (let i = 0; i < wire.points.length - 1; i++) {
    const a = wire.points[i], b = wire.points[i + 1];
    // Skip degenerate
    if (Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps) continue;
    // Already at vertex?
    if (Math.hypot(p.x - a.x, p.y - a.y) < tol || Math.hypot(p.x - b.x, p.y - b.y) < tol) return null;
    if (pointToSegmentDistance(p, a, b) <= tol) {
      const np = [...wire.points];
      np.splice(i + 1, 0, { x: p.x, y: p.y });
      return { ...wire, points: np };
    }
  }
  return null;
}

export function emptyDoc(): SchematicDoc {
  return {
    version: 1,
    nodes: [],
    wires: [],
    netLabels: [],
    canvasColor: "white",
    defaultWireColor: "black",
    defaultElementColor: "black",
  };
}

export function nextReference(doc: SchematicDoc, prefix: string): string {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const n of doc.nodes) {
    const m = n.reference?.match(re);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${max + 1}`;
}

export function compactReferences(doc: SchematicDoc, prefix: string): SchematicDoc {
  const re = new RegExp(`^${prefix}(\\d+)$`);
  const indexed = doc.nodes
    .map((n, i) => {
      const m = n.reference?.match(re);
      return m ? { i, num: parseInt(m[1], 10) } : null;
    })
    .filter((x): x is { i: number; num: number } => !!x)
    .sort((a, b) => a.num - b.num);
  let changed = false;
  const nextRefs = new Map<number, string>();
  indexed.forEach((entry, k) => {
    const desired = `${prefix}${k + 1}`;
    if (doc.nodes[entry.i].reference !== desired) {
      nextRefs.set(entry.i, desired);
      changed = true;
    }
  });
  if (!changed) return doc;
  return {
    ...doc,
    nodes: doc.nodes.map((n, i) =>
      nextRefs.has(i) ? { ...n, reference: nextRefs.get(i)! } : n
    ),
  };
}
