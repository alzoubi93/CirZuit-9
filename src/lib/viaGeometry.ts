/**
 * CirZuit PCB Native Via Architecture & Layer Spans Engine
 *
 * Provides analytical representation, exact geometric calculations, layer-span
 * traversal, visibility filtering, annular ring clearance analysis, and multi-layer
 * NC Drill / Gerber tooling for KiCad native vias (through-hole, blind, buried, microvias).
 */

import { PcbLayer, PcbLayerId, PcbVia, isCopperLayer, isTopCopper, isBottomCopper, getCopperLayerOrdinal, getCopperLayerStandardColor } from "./pcb";

export type PcbViaType = "through" | "blind" | "micro";

/**
 * Normalizes layer identifier into canonical KiCad / CirZuit form.
 */
export function normalizeLayerId(layerId: string): PcbLayerId {
  const l = layerId.trim();
  if (l === "F.Cu" || l === "top_copper") return "top_copper";
  if (l === "B.Cu" || l === "bottom_copper") return "bottom_copper";
  return l as PcbLayerId;
}

/**
 * Resolves the explicit or inferred via classification:
 * - "through": spans top to bottom copper (e.g., F.Cu -> B.Cu)
 * - "blind": spans from external to internal layer or internal to internal (buried)
 * - "micro": laser microvia between adjacent HDI layers
 */
export function determineViaType(
  via: {
    viaType?: PcbViaType;
    layers?: [string, string];
    drill?: number;
    diameter?: number;
  },
  layerStack?: PcbLayer[]
): PcbViaType {
  if (via.viaType === "micro" || via.viaType === "blind" || via.viaType === "through") {
    return via.viaType;
  }

  if (!via.layers || via.layers.length < 2) {
    return "through";
  }

  const [l1, l2] = via.layers.map(normalizeLayerId);
  const isL1Top = isTopCopper(l1);
  const isL2Bottom = isBottomCopper(l2);
  const isL1Bottom = isBottomCopper(l1);
  const isL2Top = isTopCopper(l2);

  // If spans from Top to Bottom (or vice versa), it is a standard through-hole via
  if ((isL1Top && isL2Bottom) || (isL1Bottom && isL2Top)) {
    return "through";
  }

  // If microvia is indicated by small drill (<= 0.25mm) on adjacent layers
  const drill = via.drill || 0.3;
  const o1 = getCopperLayerOrdinal(l1);
  const o2 = getCopperLayerOrdinal(l2);
  if (Math.abs(o1 - o2) === 1 && drill <= 0.25) {
    return "micro";
  }

  return "blind";
}

/**
 * Returns all ordered copper layers present in the board stack, sorted from Top (0) to Bottom (31).
 */
export function getOrderedCopperLayers(layerStack: PcbLayer[]): PcbLayer[] {
  const copperLayers = (layerStack || []).filter((l) => isCopperLayer(l.id));
  return [...copperLayers].sort((a, b) => {
    const ordA = a.ordinal !== undefined ? a.ordinal : getCopperLayerOrdinal(a.id);
    const ordB = b.ordinal !== undefined ? b.ordinal : getCopperLayerOrdinal(b.id);
    return ordA - ordB;
  });
}

/**
 * Computes all copper layers that a via spans through according to the board's layer stack.
 */
export function getViaSpannedLayers(via: PcbVia, layerStack: PcbLayer[]): PcbLayerId[] {
  const ordered = getOrderedCopperLayers(layerStack);
  if (ordered.length === 0) {
    return ["top_copper", "bottom_copper"];
  }

  if (!via.layers || via.layers.length < 2) {
    // Default through-hole via spans all copper layers in the board
    return ordered.map((l) => l.id);
  }

  const l1Norm = normalizeLayerId(via.layers[0]);
  const l2Norm = normalizeLayerId(via.layers[1]);

  const ord1 = getCopperLayerOrdinal(l1Norm);
  const ord2 = getCopperLayerOrdinal(l2Norm);
  const minOrd = Math.min(ord1, ord2);
  const maxOrd = Math.max(ord1, ord2);

  const spanned = ordered
    .filter((l) => {
      const ord = l.ordinal !== undefined ? l.ordinal : getCopperLayerOrdinal(l.id);
      return ord >= minOrd && ord <= maxOrd;
    })
    .map((l) => l.id);

  if (spanned.length === 0) {
    return [l1Norm, l2Norm];
  }

  return spanned;
}

/**
 * Determines whether a via penetrates or connects to a given PCB layer.
 */
export function isViaOnLayer(via: PcbVia, layerId: string, layerStack: PcbLayer[]): boolean {
  if (layerId === "drill" || layerId === "multi_layer") return true;
  const spanned = getViaSpannedLayers(via, layerStack);
  const norm = normalizeLayerId(layerId);
  return spanned.includes(norm);
}

/**
 * Determines whether a via should be visible based on active layer visibility set.
 */
export function isViaVisible(
  via: PcbVia,
  visibleLayerIds: Set<string> | string[],
  layerStack: PcbLayer[]
): boolean {
  const visSet = visibleLayerIds instanceof Set ? visibleLayerIds : new Set(visibleLayerIds);
  if (visSet.has("drill")) return true;

  const spanned = getViaSpannedLayers(via, layerStack);
  return spanned.some((lId) => visSet.has(lId) || (lId === "top_copper" && visSet.has("F.Cu")) || (lId === "bottom_copper" && visSet.has("B.Cu")));
}

/**
 * Computes the annular ring radial width in millimeters: (diameter - drill) / 2.
 */
export function getViaAnnularRingWidth(via: PcbVia): number {
  const d = via.diameter || 0.8;
  const drill = via.drill || 0.4;
  return Math.max(0, (d - drill) / 2);
}

/**
 * Checks whether an annular ring should be rendered on a specific layer,
 * accounting for KiCad 7/8 "remove unused inner layers" optimization.
 */
export function shouldRenderViaAnnularRing(
  via: PcbVia,
  layerId: string,
  layerStack: PcbLayer[],
  connectedTracksOrFlag?: boolean | { layer: string; start?: { x: number; y: number }; end?: { x: number; y: number }; points?: { x: number; y: number }[] }[]
): boolean {
  const norm = normalizeLayerId(layerId);
  const spanned = getViaSpannedLayers(via, layerStack);
  if (!spanned.includes(norm)) return false;

  if (!via.removeUnusedLayers) return true;

  // If keepEndLayers is true, always keep start and end layers
  const startLayer = normalizeLayerId(via.layers ? via.layers[0] : "top_copper");
  const endLayer = normalizeLayerId(via.layers ? via.layers[1] : "bottom_copper");
  const isEnd = norm === startLayer || norm === endLayer;

  if (via.keepEndLayers !== false && isEnd) {
    return true;
  }

  if (typeof connectedTracksOrFlag === "boolean") {
    return connectedTracksOrFlag;
  }

  if (Array.isArray(connectedTracksOrFlag)) {
    const eps = 0.05;
    return connectedTracksOrFlag.some((t) => {
      if (normalizeLayerId(t.layer) !== norm) return false;
      if (t.start && Math.hypot(t.start.x - via.x, t.start.y - via.y) < eps) return true;
      if (t.end && Math.hypot(t.end.x - via.x, t.end.y - via.y) < eps) return true;
      if (t.points) {
        return t.points.some((pt) => Math.hypot(pt.x - via.x, pt.y - via.y) < eps);
      }
      return false;
    });
  }

  return false;
}

/**
 * Calculates 3D layer-aware clearances between two vias.
 */
export function calculateViaToViaClearance(
  viaA: PcbVia,
  viaB: PcbVia,
  layerStack: PcbLayer[] = []
): {
  sharesLayer: boolean;
  overlappingLayers: PcbLayerId[];
  distance: number;
  clearance: number;
} {
  const spannedA = getViaSpannedLayers(viaA, layerStack);
  const spannedB = getViaSpannedLayers(viaB, layerStack);
  const overlap = spannedA.filter((l) => spannedB.includes(l));

  const dx = viaA.x - viaB.x;
  const dy = viaA.y - viaB.y;
  const dist = Math.hypot(dx, dy);

  if (overlap.length === 0) {
    return {
      sharesLayer: false,
      overlappingLayers: [],
      distance: dist,
      clearance: Infinity,
    };
  }

  const radA = (viaA.diameter || 0.8) / 2;
  const radB = (viaB.diameter || 0.8) / 2;
  const clearance = dist - (radA + radB);

  return {
    sharesLayer: true,
    overlappingLayers: overlap,
    distance: dist,
    clearance,
  };
}

/**
 * Calculates 3D layer-aware clearances between a via and a track.
 */
export function calculateViaToTrackClearance(
  via: PcbVia,
  track: { layer: string; start?: { x: number; y: number }; end?: { x: number; y: number }; width?: number; points?: { x: number; y: number }[] },
  layerStack: PcbLayer[] = []
): {
  sharesLayer: boolean;
  clearance: number;
} {
  const normTrackLayer = normalizeLayerId(track.layer);
  const spanned = getViaSpannedLayers(via, layerStack);
  if (!spanned.includes(normTrackLayer)) {
    return {
      sharesLayer: false,
      clearance: Infinity,
    };
  }

  const trackWidth = track.width || 0.25;
  const viaRadius = (via.diameter || 0.8) / 2;
  
  let minDist = Infinity;
  const p1 = track.start;
  const p2 = track.end;
  if (p1 && p2) {
    const l2 = (p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2;
    if (l2 === 0) {
      minDist = Math.hypot(via.x - p1.x, via.y - p1.y);
    } else {
      let t = ((via.x - p1.x) * (p2.x - p1.x) + (via.y - p1.y) * (p2.y - p1.y)) / l2;
      t = Math.max(0, Math.min(1, t));
      const projX = p1.x + t * (p2.x - p1.x);
      const projY = p1.y + t * (p2.y - p1.y);
      minDist = Math.hypot(via.x - projX, via.y - projY);
    }
  }

  const clearance = minDist - (viaRadius + trackWidth / 2);
  return {
    sharesLayer: true,
    clearance,
  };
}

/**
 * Returns human-readable classification string and layer span label for tooltips & inspector.
 */
export function getViaClassificationLabel(via: PcbVia, layerStack: PcbLayer[] = []): string {
  const type = determineViaType(via, layerStack);
  const l1 = via.layers ? via.layers[0] : "top_copper";
  const l2 = via.layers ? via.layers[1] : "bottom_copper";

  const l1Name = l1 === "top_copper" ? "F.Cu" : l1 === "bottom_copper" ? "B.Cu" : l1;
  const l2Name = l2 === "top_copper" ? "F.Cu" : l2 === "bottom_copper" ? "B.Cu" : l2;

  switch (type) {
    case "micro":
      return `Microvia (${l1Name} ↔ ${l2Name})`;
    case "blind":
      return `Blind/Buried Via (${l1Name} ↔ ${l2Name})`;
    case "through":
    default:
      return `Through Via (${l1Name} ↔ ${l2Name})`;
  }
}

/**
 * Computes color styling for rendering a via on a canvas or SVG, including start/end layer visual cues.
 */
export function getViaRenderingStyles(
  via: PcbVia,
  activeLayer: string,
  layerStack: PcbLayer[],
  isSelected = false,
  isGroupSelected = false
): {
  outerColor: string;
  drillColor: string;
  strokeColor: string;
  strokeWidth: number;
  badgeSymbol?: string;
  viaType: PcbViaType;
} {
  const viaType = determineViaType(via, layerStack);

  if (isGroupSelected) {
    return {
      outerColor: "#f59e0b",
      drillColor: "#000000",
      strokeColor: "#fbbf24",
      strokeWidth: 0.15,
      viaType,
    };
  }

  if (isSelected) {
    return {
      outerColor: "#3b82f6",
      drillColor: "#000000",
      strokeColor: "#93c5fd",
      strokeWidth: 0.15,
      viaType,
    };
  }

  // Visual distinction based on via classification
  let outerColor = "#e2e8f0"; // Neutral bright copper
  let strokeColor = "#64748b";
  let strokeWidth = 0.08;

  if (viaType === "micro") {
    outerColor = "#ec4899"; // Pink accent for HDI microvias
    strokeColor = "#f43f5e";
    strokeWidth = 0.12;
  } else if (viaType === "blind") {
    // Blend start and end layer colors
    const l1 = via.layers ? via.layers[0] : "top_copper";
    outerColor = getCopperLayerStandardColor(l1);
    strokeColor = "#06b6d4"; // Cyan accent for blind/buried
    strokeWidth = 0.12;
  } else {
    // Through-hole via
    const norm = normalizeLayerId(activeLayer);
    outerColor = getCopperLayerStandardColor(norm) || "#e2e8f0";
    strokeColor = "#475569";
  }

  return {
    outerColor,
    drillColor: "#09090b",
    strokeColor,
    strokeWidth,
    viaType,
  };
}
