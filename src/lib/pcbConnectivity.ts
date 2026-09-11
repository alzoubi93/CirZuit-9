import {
  PcbDoc,
  PcbTrack,
  PcbVia,
  PcbPad,
  PcbZone,
  PcbFootprint,
  PcbFootprintPad,
  PcbLayer,
  PcbLayerId,
  isCopperLayer,
  isTopCopper,
  isBottomCopper,
  getCopperLayerOrdinal,
} from "./pcb";
import { getViaSpannedLayers } from "./viaGeometry";
import { SchematicDoc } from "./schematic";
import { buildNetIndex } from "./netlist";

export interface RatsnestLine {
  netId: number;
  netName?: string;
  color?: string;
  a: { x: number; y: number; padNumber?: string; ref?: string; footprintId?: string };
  b: { x: number; y: number; padNumber?: string; ref?: string; footprintId?: string };
}

export interface CopperElement {
  id: string;
  type: "pad" | "track" | "via" | "zone";
  netId?: number;
  netName?: string;
  layers: string[];
  x: number;
  y: number;
  // Pad details
  padWidth?: number;
  padHeight?: number;
  padShape?: "rect" | "circle" | "oval";
  padRotation?: number;
  footprintId?: string;
  padNumber?: string;
  ref?: string;
  // Track details
  trackWidth?: number;
  points?: { x: number; y: number }[];
  // Via details
  viaDrill?: number;
  viaDiameter?: number;
  viaType?: string;
  // Zone details
  zonePolygons?: { pts: { x: number; y: number }[]; holes?: { x: number; y: number }[][] }[];
  refObj?: any;
}

export interface CopperIsland {
  id: string;
  elementIds: Set<string>;
  elements: CopperElement[];
  netIds: Set<number>;
  pads: CopperElement[];
  anchor: { x: number; y: number; padNumber?: string; ref?: string; footprintId?: string };
}

// ==========================================
// Geometry & Layer Math Utilities
// ==========================================

export function normalizeLayerId(layerId: string): string {
  const l = (layerId || "").trim();
  if (l === "F.Cu" || l === "top_copper") return "top_copper";
  if (l === "B.Cu" || l === "bottom_copper") return "bottom_copper";
  return l;
}

export function areLayersShared(layersA: string[], layersB: string[]): boolean {
  if (!layersA.length || !layersB.length) return false;
  const setA = new Set(layersA.map(normalizeLayerId));
  const setB = new Set(layersB.map(normalizeLayerId));

  if (setA.has("multi_layer") || setA.has("*.cu") || setB.has("multi_layer") || setB.has("*.cu")) {
    return true;
  }

  for (const l of setA) {
    if (setB.has(l)) return true;
  }
  return false;
}

export function rotatePoint(pt: { x: number; y: number }, angleDeg: number): { x: number; y: number } {
  if (!angleDeg) return { x: pt.x, y: pt.y };
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: pt.x * cos - pt.y * sin,
    y: pt.x * sin + pt.y * cos,
  };
}

export function distToSegment(
  p: { x: number; y: number },
  v: { x: number; y: number },
  w: { x: number; y: number }
): number {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

export function distToBox(p: { x: number; y: number }, halfW: number, halfH: number): number {
  const dx = Math.max(0, Math.abs(p.x) - halfW);
  const dy = Math.max(0, Math.abs(p.y) - halfH);
  return Math.hypot(dx, dy);
}

function ccw(a: { x: number; y: number }, b: { x: number; y: number }, c: { x: number; y: number }): boolean {
  return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}

export function doSegmentsIntersect(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
): boolean {
  return ccw(a1, b1, b2) !== ccw(a2, b1, b2) && ccw(a1, a2, b1) !== ccw(a1, a2, b2);
}

export function distSegmentToSegment(
  a1: { x: number; y: number },
  a2: { x: number; y: number },
  b1: { x: number; y: number },
  b2: { x: number; y: number }
): number {
  if (doSegmentsIntersect(a1, a2, b1, b2)) return 0;
  return Math.min(
    distToSegment(a1, b1, b2),
    distToSegment(a2, b1, b2),
    distToSegment(b1, a1, a2),
    distToSegment(b2, a1, a2)
  );
}

export function isPointInPolygon(
  pt: { x: number; y: number },
  poly: { x: number; y: number }[]
): boolean {
  if (!poly || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function isPointInZonePolygon(
  pt: { x: number; y: number },
  polygon: { pts: { x: number; y: number }[]; holes?: { x: number; y: number }[][] }
): boolean {
  if (!isPointInPolygon(pt, polygon.pts)) return false;
  if (polygon.holes) {
    for (const hole of polygon.holes) {
      if (isPointInPolygon(pt, hole)) return false;
    }
  }
  return true;
}

// ==========================================
// Contact Analysis Engine
// ==========================================

export function doCopperElementsTouch(
  e1: CopperElement,
  e2: CopperElement,
  tol: number = 0.05
): boolean {
  if (!areLayersShared(e1.layers, e2.layers)) return false;

  // Helper for Point (Via or Circle Pad) vs Segment (Track)
  const circleVsSegment = (c: CopperElement, s: CopperElement): boolean => {
    const radius = ((c.viaDiameter || c.padWidth || 0.8) / 2);
    const halfWidth = (s.trackWidth || 0.25) / 2;
    const pts = s.points || [];
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distToSegment({ x: c.x, y: c.y }, pts[i], pts[i + 1]);
      if (d <= radius + halfWidth + tol) return true;
    }
    return false;
  };

  // Helper for Circle vs Circle
  const circleVsCircle = (c1: CopperElement, c2: CopperElement): boolean => {
    const r1 = (c1.viaDiameter || c1.padWidth || 0.8) / 2;
    const r2 = (c2.viaDiameter || c2.padWidth || 0.8) / 2;
    return Math.hypot(c1.x - c2.x, c1.y - c2.y) <= r1 + r2 + tol;
  };

  // Helper for Circle vs Rotated Rect Box Pad
  const circleVsRectPad = (c: CopperElement, p: CopperElement): boolean => {
    const radius = (c.viaDiameter || c.padWidth || 0.8) / 2;
    const halfW = (p.padWidth || 1.0) / 2;
    const halfH = (p.padHeight || 1.0) / 2;
    const local = rotatePoint({ x: c.x - p.x, y: c.y - p.y }, -(p.padRotation || 0));
    const d = distToBox(local, halfW, halfH);
    return d <= radius + tol;
  };

  // Helper for Segment vs Segment
  const segmentVsSegment = (s1: CopperElement, s2: CopperElement): boolean => {
    const hw1 = (s1.trackWidth || 0.25) / 2;
    const hw2 = (s2.trackWidth || 0.25) / 2;
    const pts1 = s1.points || [];
    const pts2 = s2.points || [];
    for (let i = 0; i < pts1.length - 1; i++) {
      for (let j = 0; j < pts2.length - 1; j++) {
        const d = distSegmentToSegment(pts1[i], pts1[i + 1], pts2[j], pts2[j + 1]);
        if (d <= hw1 + hw2 + tol) return true;
      }
    }
    return false;
  };

  // Helper for Segment vs Rotated Rect Box Pad
  const segmentVsRectPad = (s: CopperElement, p: CopperElement): boolean => {
    const halfTrackW = (s.trackWidth || 0.25) / 2;
    const halfW = (p.padWidth || 1.0) / 2;
    const halfH = (p.padHeight || 1.0) / 2;
    const rot = p.padRotation || 0;
    const pts = s.points || [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p1Local = rotatePoint({ x: pts[i].x - p.x, y: pts[i].y - p.y }, -rot);
      const p2Local = rotatePoint({ x: pts[i + 1].x - p.x, y: pts[i + 1].y - p.y }, -rot);

      // Check endpoints first
      if (distToBox(p1Local, halfW, halfH) <= halfTrackW + tol) return true;
      if (distToBox(p2Local, halfW, halfH) <= halfTrackW + tol) return true;

      // Sample interior points along track segment
      const segLen = Math.hypot(p2Local.x - p1Local.x, p2Local.y - p1Local.y);
      const steps = Math.max(2, Math.ceil(segLen / 0.2));
      for (let k = 1; k < steps; k++) {
        const t = k / steps;
        const ptLocal = {
          x: p1Local.x + t * (p2Local.x - p1Local.x),
          y: p1Local.y + t * (p2Local.y - p1Local.y),
        };
        if (distToBox(ptLocal, halfW, halfH) <= halfTrackW + tol) return true;
      }
    }
    return false;
  };

  // Helper for Zone vs Element
  const zoneVsElement = (z: CopperElement, e: CopperElement): boolean => {
    if (!z.zonePolygons || !z.zonePolygons.length) return false;

    if (e.type === "via" || (e.type === "pad" && e.padShape === "circle")) {
      const pt = { x: e.x, y: e.y };
      for (const poly of z.zonePolygons) {
        if (isPointInZonePolygon(pt, poly)) return true;
      }
    } else if (e.type === "pad") {
      const pt = { x: e.x, y: e.y };
      for (const poly of z.zonePolygons) {
        if (isPointInZonePolygon(pt, poly)) return true;
      }
    } else if (e.type === "track") {
      const pts = e.points || [];
      for (const pt of pts) {
        for (const poly of z.zonePolygons) {
          if (isPointInZonePolygon(pt, poly)) return true;
        }
      }
    }
    return false;
  };

  // 1. Zone checks
  if (e1.type === "zone") return zoneVsElement(e1, e2);
  if (e2.type === "zone") return zoneVsElement(e2, e1);

  // 2. Track vs Track
  if (e1.type === "track" && e2.type === "track") {
    return segmentVsSegment(e1, e2);
  }

  // 3. Via / Circle Pad vs Track
  const isCircle1 = e1.type === "via" || (e1.type === "pad" && e1.padShape === "circle");
  const isCircle2 = e2.type === "via" || (e2.type === "pad" && e2.padShape === "circle");

  if (isCircle1 && e2.type === "track") return circleVsSegment(e1, e2);
  if (isCircle2 && e1.type === "track") return circleVsSegment(e2, e1);

  // 4. Circle vs Circle
  if (isCircle1 && isCircle2) return circleVsCircle(e1, e2);

  // 5. Circle vs Rect Pad
  if (isCircle1 && e2.type === "pad") return circleVsRectPad(e1, e2);
  if (isCircle2 && e1.type === "pad") return circleVsRectPad(e2, e1);

  // 6. Track vs Rect Pad
  if (e1.type === "track" && e2.type === "pad") return segmentVsRectPad(e1, e2);
  if (e2.type === "track" && e1.type === "pad") return segmentVsRectPad(e2, e1);

  // 7. Rect Pad vs Rect Pad
  if (e1.type === "pad" && e2.type === "pad") {
    const halfW1 = (e1.padWidth || 1.0) / 2;
    const halfH1 = (e1.padHeight || 1.0) / 2;
    const halfW2 = (e2.padWidth || 1.0) / 2;
    const halfH2 = (e2.padHeight || 1.0) / 2;
    const d = Math.hypot(e1.x - e2.x, e1.y - e2.y);
    return d <= Math.max(halfW1, halfH1) + Math.max(halfW2, halfH2) + tol;
  }

  return false;
}

// ==========================================
// Extract Copper Elements
// ==========================================

export function extractCopperElements(pcb: PcbDoc): CopperElement[] {
  const elements: CopperElement[] = [];

  // 1. Footprint pads
  (pcb.footprints || []).forEach((fp) => {
    (fp.pads || []).forEach((pad, padIdx) => {
      const rad = ((fp.rotation || 0) * Math.PI) / 180;
      const absX = fp.x + (pad.x * Math.cos(rad) - pad.y * Math.sin(rad));
      const absY = fp.y + (pad.x * Math.sin(rad) + pad.y * Math.cos(rad));

      let layers: string[] = [];
      if (pad.layer === "multi_layer" || !pad.layer) {
        layers = (pcb.layers || [])
          .filter((l) => isCopperLayer(l.id))
          .map((l) => l.id);
        if (!layers.length) layers = ["top_copper", "bottom_copper"];
      } else {
        layers = [pad.layer];
      }

      elements.push({
        id: `pad-${fp.id}-${pad.pinIndex ?? padIdx}`,
        type: "pad",
        netId: pad.netId,
        netName: pad.netName,
        layers,
        x: absX,
        y: absY,
        padWidth: pad.width,
        padHeight: pad.height,
        padShape: pad.shape || "rect",
        padRotation: (fp.rotation || 0) + (pad.rotation || 0),
        footprintId: fp.id,
        padNumber: pad.number || pad.name || String((pad.pinIndex ?? padIdx) + 1),
        ref: fp.reference,
        refObj: pad,
      });
    });
  });

  // 2. Standalone pads
  (pcb.pads || []).forEach((pad, idx) => {
    let layers: string[] = [];
    if (pad.layer === "multi_layer" || !pad.layer) {
      layers = (pcb.layers || [])
        .filter((l) => isCopperLayer(l.id))
        .map((l) => l.id);
      if (!layers.length) layers = ["top_copper", "bottom_copper"];
    } else {
      layers = [pad.layer];
    }

    elements.push({
      id: pad.id || `pad-standalone-${idx}`,
      type: "pad",
      netId: pad.netId,
      netName: pad.netName,
      layers,
      x: pad.x,
      y: pad.y,
      padWidth: pad.width,
      padHeight: pad.height,
      padShape: pad.shape || "rect",
      padRotation: pad.rotation || 0,
      padNumber: pad.number || pad.name,
      refObj: pad,
    });
  });

  // 3. Tracks & Arcs
  (pcb.tracks || []).forEach((tr) => {
    if (!isCopperLayer(tr.layer)) return;
    const pts = tr.points || [];
    if (pts.length < 2) return;

    elements.push({
      id: tr.id,
      type: "track",
      netId: tr.netId,
      netName: tr.netName,
      layers: [tr.layer],
      x: pts[0].x,
      y: pts[0].y,
      trackWidth: tr.width || 0.25,
      points: pts,
      refObj: tr,
    });
  });

  // 4. Vias
  (pcb.vias || []).forEach((v) => {
    const spanned = getViaSpannedLayers(v, pcb.layers || []);

    elements.push({
      id: v.id,
      type: "via",
      netId: v.netId,
      netName: v.netName,
      layers: spanned.map((l) => String(l)),
      x: v.x,
      y: v.y,
      viaDrill: v.drill || 0.4,
      viaDiameter: v.diameter || 0.8,
      viaType: v.viaType || "through",
      refObj: v,
    });
  });

  // 5. Zones
  (pcb.zones || []).forEach((z) => {
    if (z.isKeepout || !isCopperLayer(z.layer)) return;
    const zPolys: { pts: { x: number; y: number }[]; holes?: { x: number; y: number }[][] }[] = [];

    if (z.filledPolygons && z.filledPolygons.length > 0) {
      z.filledPolygons.forEach((fp) => {
        if (fp.pts && fp.pts.length >= 3) {
          zPolys.push({ pts: fp.pts, holes: fp.holes });
        }
      });
    } else if (z.boundary && z.boundary.pts && z.boundary.pts.length >= 3) {
      zPolys.push({ pts: z.boundary.pts, holes: z.boundary.holes });
    }

    if (!zPolys.length) return;

    const layers = z.layers ? z.layers.map(String) : [String(z.layer)];

    elements.push({
      id: z.id,
      type: "zone",
      netId: z.netId,
      netName: z.netName,
      layers,
      x: zPolys[0].pts[0].x,
      y: zPolys[0].pts[0].y,
      zonePolygons: zPolys,
      refObj: z,
    });
  });

  return elements;
}

// ==========================================
// Compute Connected Copper Islands
// ==========================================

export function computeCopperIslands(pcb: PcbDoc): CopperIsland[] {
  const elements = extractCopperElements(pcb);
  const n = elements.length;
  if (n === 0) return [];

  // Union-Find data structure
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(i: number): number {
    if (parent[i] === i) return i;
    return (parent[i] = find(parent[i]));
  }
  function union(i: number, j: number) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  }

  // Spatial Grid Partitioning for fast contact evaluation
  const gridCellSize = 5.0; // mm
  const grid = new Map<string, number[]>();

  for (let i = 0; i < n; i++) {
    const el = elements[i];
    let minX = el.x, maxX = el.x, minY = el.y, maxY = el.y;

    if (el.points) {
      for (const p of el.points) {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
      }
    } else if (el.zonePolygons) {
      for (const poly of el.zonePolygons) {
        for (const p of poly.pts) {
          if (p.x < minX) minX = p.x;
          if (p.x > maxX) maxX = p.x;
          if (p.y < minY) minY = p.y;
          if (p.y > maxY) maxY = p.y;
        }
      }
    } else {
      const radius = ((el.viaDiameter || el.padWidth || 1.0) / 2) + 0.5;
      minX = el.x - radius;
      maxX = el.x + radius;
      minY = el.y - radius;
      maxY = el.y + radius;
    }

    const minGX = Math.floor(minX / gridCellSize);
    const maxGX = Math.floor(maxX / gridCellSize);
    const minGY = Math.floor(minY / gridCellSize);
    const maxGY = Math.floor(maxY / gridCellSize);

    for (let gx = minGX; gx <= maxGX; gx++) {
      for (let gy = minGY; gy <= maxGY; gy++) {
        const key = `${gx}:${gy}`;
        if (!grid.has(key)) grid.set(key, []);
        grid.get(key)!.push(i);
      }
    }
  }

  // Evaluate candidate pairs from grid cells
  const testedPairs = new Set<string>();
  grid.forEach((indices) => {
    for (let a = 0; a < indices.length; a++) {
      for (let b = a + 1; b < indices.length; b++) {
        const i = indices[a];
        const j = indices[b];
        const pairKey = i < j ? `${i}:${j}` : `${j}:${i}`;
        if (testedPairs.has(pairKey)) continue;
        testedPairs.add(pairKey);

        if (find(i) !== find(j)) {
          if (doCopperElementsTouch(elements[i], elements[j])) {
            union(i, j);
          }
        }
      }
    }
  });

  // Group elements into islands
  const islandMap = new Map<number, CopperElement[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!islandMap.has(root)) islandMap.set(root, []);
    islandMap.get(root)!.push(elements[i]);
  }

  const islands: CopperIsland[] = [];
  let islandCounter = 1;

  islandMap.forEach((groupEls, root) => {
    const elementIds = new Set(groupEls.map((e) => e.id));
    const netIds = new Set<number>();
    const pads: CopperElement[] = [];

    groupEls.forEach((e) => {
      if (e.netId !== undefined) netIds.add(e.netId);
      if (e.type === "pad") pads.push(e);
    });

    let anchor = { x: groupEls[0].x, y: groupEls[0].y };
    if (pads.length > 0) {
      anchor = {
        x: pads[0].x,
        y: pads[0].y,
        padNumber: pads[0].padNumber,
        ref: pads[0].ref,
        footprintId: pads[0].footprintId,
      };
    }

    islands.push({
      id: `island-${islandCounter++}`,
      elementIds,
      elements: groupEls,
      netIds,
      pads,
      anchor,
    });
  });

  return islands;
}

// ==========================================
// Real Geometry-Aware Ratsnest Generator
// ==========================================

export function computeGeometryAwareRatsnest(
  pcb: PcbDoc,
  schematic?: SchematicDoc
): RatsnestLine[] {
  if (pcb?.isImportedGerber) return [];

  // Compute physical copper islands
  const islands = computeCopperIslands(pcb);

  // Map net IDs to pads / islands
  const netColorMap: Record<number, string> = {
    1: "#ef4444", // GND / Net 1
    2: "#3b82f6", // VCC / Net 2
    3: "#10b981",
    4: "#f59e0b",
    5: "#a855f7",
    6: "#ec4899",
  };

  const lines: RatsnestLine[] = [];

  // Reconcile schematic nets if present
  let activeNets: { id: number; name?: string }[] = [];
  if (schematic?.nodes?.length) {
    const idx = buildNetIndex(schematic);
    activeNets = idx.nets.map((n) => ({ id: n.id, name: n.name }));
  } else if (pcb.nets && pcb.nets.length > 0) {
    activeNets = pcb.nets.map((n) => ({ id: n.id, name: n.name }));
  } else {
    // Collect unique netIds from copper elements
    const uniqueNets = new Set<number>();
    islands.forEach((isl) => isl.netIds.forEach((nid) => { if (nid > 0) uniqueNets.add(nid); }));
    activeNets = Array.from(uniqueNets).map((id) => ({ id, name: `Net ${id}` }));
  }

  for (const netDef of activeNets) {
    if (netDef.id === 0) continue; // Skip un-connected / no-net (Net 0)

    // Find all islands containing pads assigned to this net
    const netIslands: CopperIsland[] = [];
    for (const isl of islands) {
      const hasNetPad = isl.pads.some((p) => p.netId === netDef.id);
      if (hasNetPad) {
        netIslands.push(isl);
      }
    }

    // If net has <= 1 islands, 0 airwires needed (fully routed!)
    if (netIslands.length <= 1) continue;

    // Build Minimum Spanning Tree (MST) on the M islands
    const m = netIslands.length;
    const used = new Set<number>([0]);
    const remaining = new Set<number>(Array.from({ length: m - 1 }, (_, i) => i + 1));
    const color = netColorMap[netDef.id] || "#60a5fa";

    while (remaining.size > 0) {
      let best: { islandA: number; islandB: number; padA: CopperElement; padB: CopperElement; d: number } | null = null;

      for (const i of used) {
        const islA = netIslands[i];
        const padsA = islA.pads.filter((p) => p.netId === netDef.id);
        if (!padsA.length) continue;

        for (const j of remaining) {
          const islB = netIslands[j];
          const padsB = islB.pads.filter((p) => p.netId === netDef.id);
          if (!padsB.length) continue;

          for (const pa of padsA) {
            for (const pb of padsB) {
              const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
              if (!best || d < best.d) {
                best = { islandA: i, islandB: j, padA: pa, padB: pb, d };
              }
            }
          }
        }
      }

      if (!best) break;

      lines.push({
        netId: netDef.id,
        netName: netDef.name,
        color,
        a: {
          x: best.padA.x,
          y: best.padA.y,
          padNumber: best.padA.padNumber,
          ref: best.padA.ref,
          footprintId: best.padA.footprintId,
        },
        b: {
          x: best.padB.x,
          y: best.padB.y,
          padNumber: best.padB.padNumber,
          ref: best.padB.ref,
          footprintId: best.padB.footprintId,
        },
      });

      used.add(best.islandB);
      remaining.delete(best.islandB);
    }
  }

  return lines;
}
