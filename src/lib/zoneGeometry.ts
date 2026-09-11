import { PcbZone, PcbZonePoint, PcbZonePolygon, PcbZoneFilledPolygon, PcbLayer, PcbLayerId, isCopperLayer } from "./pcb";
import { getLayerColor } from "./layerUtils";

/**
 * Checks if a zone exists on or touches a specific layer.
 * Standard KiCad zones have a single primary layer or a list of layers (e.g. multi-layer keepout).
 */
export function isZoneOnLayer(zone: PcbZone, layerId: string, layerStack?: PcbLayer[]): boolean {
  if (!zone) return false;
  if (zone.layer === layerId) return true;
  if (zone.layers && zone.layers.includes(layerId as PcbLayerId)) return true;

  // Handle copper layer mapping aliases (e.g. F.Cu <-> top_copper, B.Cu <-> bottom_copper)
  if (
    (zone.layer === "F.Cu" && layerId === "top_copper") ||
    (zone.layer === "top_copper" && layerId === "F.Cu") ||
    (zone.layer === "B.Cu" && layerId === "bottom_copper") ||
    (zone.layer === "bottom_copper" && layerId === "B.Cu")
  ) {
    return true;
  }

  // Check if zone has filled polygons on this specific layer
  if (zone.filledPolygons && zone.filledPolygons.length > 0) {
    const hasLayerFill = zone.filledPolygons.some((fp) => {
      if (!fp.layer) return zone.layer === layerId;
      if (fp.layer === layerId) return true;
      if (
        (fp.layer === "F.Cu" && layerId === "top_copper") ||
        (fp.layer === "top_copper" && layerId === "F.Cu") ||
        (fp.layer === "B.Cu" && layerId === "bottom_copper") ||
        (fp.layer === "bottom_copper" && layerId === "B.Cu")
      ) {
        return true;
      }
      return false;
    });
    if (hasLayerFill) return true;
  }

  return false;
}

/**
 * Determines whether a zone is visible based on the active set of visible layers.
 */
export function isZoneVisible(
  zone: PcbZone,
  visibleLayerIds: Set<string> | string[],
  layerStack?: PcbLayer[]
): boolean {
  if (!zone) return false;
  const visibleSet = visibleLayerIds instanceof Set ? visibleLayerIds : new Set(visibleLayerIds);

  if (visibleSet.has(zone.layer)) return true;
  if (zone.layer === "F.Cu" && visibleSet.has("top_copper")) return true;
  if (zone.layer === "top_copper" && visibleSet.has("F.Cu")) return true;
  if (zone.layer === "B.Cu" && visibleSet.has("bottom_copper")) return true;
  if (zone.layer === "bottom_copper" && visibleSet.has("B.Cu")) return true;

  if (zone.layers) {
    for (const l of zone.layers) {
      if (visibleSet.has(l)) return true;
      if (l === "F.Cu" && visibleSet.has("top_copper")) return true;
      if (l === "top_copper" && visibleSet.has("F.Cu")) return true;
      if (l === "B.Cu" && visibleSet.has("bottom_copper")) return true;
      if (l === "bottom_copper" && visibleSet.has("B.Cu")) return true;
    }
  }

  if (zone.filledPolygons) {
    for (const fp of zone.filledPolygons) {
      if (fp.layer && visibleSet.has(fp.layer)) return true;
    }
  }

  return false;
}

/**
 * Generates an SVG path `d` string for a polygon with optional holes/cutouts using even-odd fill rule.
 */
export function polygonToSvgPath(polygon: { pts: PcbZonePoint[]; holes?: PcbZonePoint[][] }): string {
  if (!polygon || !polygon.pts || polygon.pts.length < 3) return "";

  const mainPath = polygon.pts.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x} ${pt.y}`).join(" ") + " Z";

  if (!polygon.holes || polygon.holes.length === 0) {
    return mainPath;
  }

  const holePaths = polygon.holes
    .filter((hole) => hole.length >= 3)
    .map((hole) => hole.map((pt, i) => `${i === 0 ? "M" : "L"}${pt.x} ${pt.y}`).join(" ") + " Z")
    .join(" ");

  return `${mainPath} ${holePaths}`.trim();
}

/**
 * Returns the SVG path representing the boundary outline of the zone.
 */
export function getZoneBoundarySvgPath(zone: PcbZone): string {
  if (!zone || !zone.boundary) return "";
  return polygonToSvgPath(zone.boundary);
}

/**
 * Returns the SVG path representing all filled copper islands of the zone (or the boundary if uncalculated).
 */
export function getZoneFilledSvgPath(zone: PcbZone, targetLayer?: string): string {
  if (!zone) return "";

  // If filled polygons are explicitly present in the model, render them
  if (zone.filledPolygons && zone.filledPolygons.length > 0) {
    const matchingFills = targetLayer
      ? zone.filledPolygons.filter((fp) => {
          if (!fp.layer) return isZoneOnLayer(zone, targetLayer);
          return (
            fp.layer === targetLayer ||
            (fp.layer === "F.Cu" && targetLayer === "top_copper") ||
            (fp.layer === "top_copper" && targetLayer === "F.Cu") ||
            (fp.layer === "B.Cu" && targetLayer === "bottom_copper") ||
            (fp.layer === "bottom_copper" && targetLayer === "B.Cu")
          );
        })
      : zone.filledPolygons;

    if (matchingFills.length > 0) {
      return matchingFills.map((fp) => polygonToSvgPath(fp)).filter(Boolean).join(" ");
    }
  }

  // Fallback: If zone has fill mode enabled or is solid fill, render boundary
  if (zone.fill?.fillMode !== "none" && !zone.isKeepout) {
    return getZoneBoundarySvgPath(zone);
  }

  return "";
}

/**
 * Ray-casting algorithm to test whether a point lies inside a 2D polygon.
 */
export function isPointInPolygon(pt: PcbZonePoint, polygon: PcbZonePoint[]): boolean {
  if (!polygon || polygon.length < 3) return false;
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x,
      yi = polygon[i].y;
    const xj = polygon[j].x,
      yj = polygon[j].y;

    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Tests whether a point is inside a zone's boundary or filled islands (accounting for hole cutouts).
 */
export function isPointInZone(pt: PcbZonePoint, zone: PcbZone, checkFilledOnly: boolean = false): boolean {
  if (!zone) return false;

  // Check filled polygons first if available
  if (zone.filledPolygons && zone.filledPolygons.length > 0) {
    for (const fp of zone.filledPolygons) {
      if (isPointInPolygon(pt, fp.pts)) {
        // Check if inside any hole cutout
        if (fp.holes && fp.holes.some((hole) => isPointInPolygon(pt, hole))) {
          continue;
        }
        return true;
      }
    }
    if (checkFilledOnly) return false;
  }

  if (checkFilledOnly && zone.fill?.fillMode === "none") {
    return false;
  }

  // Check boundary polygon
  if (zone.boundary && zone.boundary.pts) {
    if (isPointInPolygon(pt, zone.boundary.pts)) {
      if (zone.boundary.holes && zone.boundary.holes.some((hole) => isPointInPolygon(pt, hole))) {
        return false;
      }
      return true;
    }
  }

  return false;
}

/**
 * Calculates the bounding box of a zone.
 */
export function calculateZoneBoundingBox(zone: PcbZone): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const includePt = (p: PcbZonePoint) => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };

  if (zone.boundary?.pts) {
    zone.boundary.pts.forEach(includePt);
  }

  if (zone.filledPolygons) {
    zone.filledPolygons.forEach((fp) => {
      fp.pts.forEach(includePt);
    });
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  }

  return { minX, minY, maxX, maxY };
}

export const getZoneBoundingBox = calculateZoneBoundingBox;

/**
 * Calculates the polygonal area of a polygon using the Shoelace formula.
 */
export function calculatePolygonArea(pts: PcbZonePoint[]): number {
  if (!pts || pts.length < 3) return 0;
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += pts[i].x * pts[j].y;
    area -= pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Checks if a PCB element violates a keepout zone rule.
 */
export function checkKeepoutViolation(
  zone: PcbZone,
  element: {
    kind: "track" | "via" | "pad" | "footprint";
    x: number;
    y: number;
    layer: string;
    radius?: number;
  }
): boolean {
  if (!zone.isKeepout || !zone.keepout) return false;
  if (!isZoneOnLayer(zone, element.layer)) return false;

  const keepout = zone.keepout;
  if (element.kind === "track" && !keepout.tracks) return false;
  if (element.kind === "via" && !keepout.vias) return false;
  if (element.kind === "pad" && !keepout.pads) return false;
  if (element.kind === "footprint" && !keepout.footprints) return false;

  return isPointInZone({ x: element.x, y: element.y }, zone);
}

/**
 * Renders a zone onto an HTML5 Canvas 2D context.
 */
export function renderZoneOnCanvas(
  ctx: CanvasRenderingContext2D,
  zone: PcbZone,
  layerColor: string,
  options: {
    isActiveLayer?: boolean;
    isSelected?: boolean;
    isGroupSelected?: boolean;
    dimInactive?: boolean;
  } = {}
) {
  const { isActiveLayer = true, isSelected = false, isGroupSelected = false, dimInactive = false } = options;

  ctx.save();

  const isKeepout = zone.isKeepout;
  const fillMode = zone.fill?.fillMode ?? (isKeepout ? "none" : "solid");

  // Determine fill alpha
  let fillAlpha = 0.35;
  if (isKeepout) {
    fillAlpha = 0.12;
  } else if (zone.filledPolygons && zone.filledPolygons.length > 0) {
    fillAlpha = 0.55;
  }

  if (dimInactive && !isActiveLayer) {
    fillAlpha *= 0.35;
  }

  // Draw filled copper pour if applicable
  if (fillMode !== "none") {
    ctx.fillStyle = isKeepout ? "rgba(239, 68, 68, 0.15)" : layerColor;
    ctx.globalAlpha = fillAlpha;

    const polygonsToFill =
      zone.filledPolygons && zone.filledPolygons.length > 0
        ? zone.filledPolygons
        : zone.boundary?.pts?.length >= 3
        ? [zone.boundary]
        : [];

    polygonsToFill.forEach((poly) => {
      if (!poly.pts || poly.pts.length < 3) return;
      ctx.beginPath();
      ctx.moveTo(poly.pts[0].x, poly.pts[0].y);
      for (let i = 1; i < poly.pts.length; i++) {
        ctx.lineTo(poly.pts[i].x, poly.pts[i].y);
      }
      ctx.closePath();

      // Cut out holes if any
      if (poly.holes) {
        poly.holes.forEach((hole) => {
          if (hole.length < 3) return;
          ctx.moveTo(hole[0].x, hole[0].y);
          for (let i = 1; i < hole.length; i++) {
            ctx.lineTo(hole[i].x, hole[i].y);
          }
          ctx.closePath();
        });
      }

      ctx.fill("evenodd");
    });
  }

  // Draw Zone Boundary Hatching / Outline
  if (zone.boundary?.pts && zone.boundary.pts.length >= 3) {
    ctx.globalAlpha = dimInactive && !isActiveLayer ? 0.3 : 0.85;
    ctx.strokeStyle = isKeepout ? "#ef4444" : isSelected ? "#3b82f6" : layerColor;
    ctx.lineWidth = isSelected ? 0.4 : (zone.minThickness || 0.2);
    ctx.setLineDash(isKeepout ? [0.8, 0.4] : [0.5, 0.25]);

    ctx.beginPath();
    ctx.moveTo(zone.boundary.pts[0].x, zone.boundary.pts[0].y);
    for (let i = 1; i < zone.boundary.pts.length; i++) {
      ctx.lineTo(zone.boundary.pts[i].x, zone.boundary.pts[i].y);
    }
    ctx.closePath();

    if (zone.boundary.holes) {
      zone.boundary.holes.forEach((hole) => {
        if (hole.length < 3) return;
        ctx.moveTo(hole[0].x, hole[0].y);
        for (let i = 1; i < hole.length; i++) {
          ctx.lineTo(hole[i].x, hole[i].y);
        }
        ctx.closePath();
      });
    }

    ctx.stroke();
  }

  // Highlight selection overlay
  if (isSelected || isGroupSelected) {
    ctx.globalAlpha = 0.9;
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 0.5;
    ctx.setLineDash([0.6, 0.3]);
    if (zone.boundary?.pts && zone.boundary.pts.length >= 3) {
      ctx.beginPath();
      ctx.moveTo(zone.boundary.pts[0].x, zone.boundary.pts[0].y);
      for (let i = 1; i < zone.boundary.pts.length; i++) {
        ctx.lineTo(zone.boundary.pts[i].x, zone.boundary.pts[i].y);
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.restore();
}
