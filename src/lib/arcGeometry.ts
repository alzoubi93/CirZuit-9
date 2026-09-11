/**
 * CirZuit PCB Native Arc Architecture & Geometric Analysis Engine
 * 
 * Provides analytical representation, exact geometric calculations, Canvas 2D / SVG
 * rendering, distance calculation, bounding box derivation, and Gerber arc interpolation
 * for KiCad native 3-point arcs and center-angle arcs.
 */

export interface ArcGeometry {
  center: { x: number; y: number };
  radius: number;
  startAngle: number; // radians [-PI, PI] or [0, 2PI)
  endAngle: number;   // radians
  midAngle?: number;
  sweepAngle: number; // signed angular traversal in radians
  anticlockwise: boolean; // Canvas 2D ctx.arc parameter
  largeArcFlag: number;   // SVG Arc A command: 0 or 1
  sweepFlag: number;      // SVG Arc A command: 0 or 1
  start: { x: number; y: number };
  mid?: { x: number; y: number };
  end: { x: number; y: number };
  length: number;
}

const TWO_PI = Math.PI * 2;

export function normalizeAngle(a: number): number {
  return ((a % TWO_PI) + TWO_PI) % TWO_PI;
}

/**
 * Computes exact arc geometry from 3 points on circumference (Start, Mid, End).
 * Returns null if points are collinear or degenerate.
 */
export function compute3PointArc(
  start: { x: number; y: number },
  mid: { x: number; y: number },
  end: { x: number; y: number }
): ArcGeometry | null {
  const x1 = start.x, y1 = start.y;
  const x2 = mid.x,   y2 = mid.y;
  const x3 = end.x,   y3 = end.y;

  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 1e-8) {
    return null; // Collinear
  }

  const Ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
  const Uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;
  const center = { x: Ux, y: Uy };
  const radius = Math.hypot(x1 - Ux, y1 - Uy);

  if (radius < 1e-6) return null;

  const a1 = Math.atan2(y1 - Uy, x1 - Ux);
  const a2 = Math.atan2(y2 - Uy, x2 - Ux);
  const a3 = Math.atan2(y3 - Uy, x3 - Ux);

  const a1n = normalizeAngle(a1);
  const a2n = normalizeAngle(a2);
  const a3n = normalizeAngle(a3);

  const sweep12 = normalizeAngle(a2n - a1n);
  const sweep13 = normalizeAngle(a3n - a1n);

  // In screen space (Y-down), if sweep12 < sweep13, angle increases along the path from S to M to E.
  const isPositiveSweep = sweep12 < sweep13;

  let sweepAngle: number;
  let anticlockwise: boolean;
  let sweepFlag: number;
  let largeArcFlag: number;

  if (isPositiveSweep) {
    sweepAngle = sweep13; // > 0
    anticlockwise = false; // Canvas: false means clockwise in screen coordinates (increasing angle)
    sweepFlag = 1;
    largeArcFlag = sweepAngle > Math.PI ? 1 : 0;
  } else {
    sweepAngle = -(TWO_PI - sweep13); // < 0
    anticlockwise = true; // Canvas: true means counter-clockwise in screen coordinates (decreasing angle)
    sweepFlag = 0;
    largeArcFlag = Math.abs(sweepAngle) > Math.PI ? 1 : 0;
  }

  const length = Math.abs(sweepAngle) * radius;

  return {
    center,
    radius,
    startAngle: a1,
    endAngle: a3,
    midAngle: a2,
    sweepAngle,
    anticlockwise,
    largeArcFlag,
    sweepFlag,
    start: { x: x1, y: y1 },
    mid: { x: x2, y: y2 },
    end: { x: x3, y: y3 },
    length,
  };
}

/**
 * Computes exact arc geometry from Center, Start point, and Sweep Angle in degrees.
 */
export function computeCenterArc(
  center: { x: number; y: number },
  start: { x: number; y: number },
  angleDeg: number
): ArcGeometry {
  const cx = center.x, cy = center.y;
  const sx = start.x,  sy = start.y;

  const radius = Math.hypot(sx - cx, sy - cy);
  const startAngle = Math.atan2(sy - cy, sx - cx);
  const sweepAngle = (angleDeg * Math.PI) / 180;
  const endAngle = startAngle + sweepAngle;
  const midAngle = startAngle + sweepAngle / 2;

  const ex = cx + radius * Math.cos(endAngle);
  const ey = cy + radius * Math.sin(endAngle);
  const mx = cx + radius * Math.cos(midAngle);
  const my = cy + radius * Math.sin(midAngle);

  const isPositive = sweepAngle >= 0;
  const anticlockwise = !isPositive;
  const sweepFlag = isPositive ? 1 : 0;
  const largeArcFlag = Math.abs(sweepAngle) > Math.PI ? 1 : 0;
  const length = Math.abs(sweepAngle) * radius;

  return {
    center: { x: cx, y: cy },
    radius,
    startAngle,
    endAngle,
    midAngle,
    sweepAngle,
    anticlockwise,
    largeArcFlag,
    sweepFlag,
    start: { x: sx, y: sy },
    mid: { x: mx, y: my },
    end: { x: ex, y: ey },
    length,
  };
}

/**
 * Resolves arc geometry for any PcbTrack if it represents an arc.
 */
export function getTrackArcGeometry(track: {
  kind?: string;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  mid?: { x: number; y: number };
  center?: { x: number; y: number };
  angle?: number;
  points?: { x: number; y: number }[];
}): ArcGeometry | null {
  if (track.kind === "arc" || (track.mid && track.start && track.end)) {
    if (track.start && track.mid && track.end) {
      return compute3PointArc(track.start, track.mid, track.end);
    }
    if (track.center && track.start && track.angle !== undefined) {
      return computeCenterArc(track.center, track.start, track.angle);
    }
  }
  return null;
}

/**
 * Derives an exact SVG path `d` string for a PcbTrack, using analytical SVG arc `A`
 * commands when the track is an arc, or `M ... L ...` commands for straight lines.
 */
export function getTrackSvgPath(track: {
  kind?: string;
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  mid?: { x: number; y: number };
  center?: { x: number; y: number };
  angle?: number;
  points?: { x: number; y: number }[];
}): string {
  const arc = getTrackArcGeometry(track);
  if (arc) {
    const r = arc.radius.toFixed(4);
    const ex = arc.end.x.toFixed(4);
    const ey = arc.end.y.toFixed(4);
    const sx = arc.start.x.toFixed(4);
    const sy = arc.start.y.toFixed(4);
    return `M ${sx} ${sy} A ${r} ${r} 0 ${arc.largeArcFlag} ${arc.sweepFlag} ${ex} ${ey}`;
  }

  const pts = track.points || [];
  if (pts.length === 0) {
    if (track.start && track.end) {
      return `M ${track.start.x} ${track.start.y} L ${track.end.x} ${track.end.y}`;
    }
    return "";
  }

  return pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

/**
 * Draws a track to a Canvas 2D context using exact analytical curves:
 * `ctx.arc(...)` for native arcs, or `ctx.lineTo(...)` for linear segments.
 */
export function drawTrackPathToCanvas(
  ctx: CanvasRenderingContext2D,
  track: {
    kind?: string;
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    mid?: { x: number; y: number };
    center?: { x: number; y: number };
    angle?: number;
    points?: { x: number; y: number }[];
  }
): void {
  const arc = getTrackArcGeometry(track);
  if (arc) {
    ctx.arc(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle, arc.anticlockwise);
    return;
  }

  const pts = track.points || [];
  if (pts.length > 0) {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
  } else if (track.start && track.end) {
    ctx.moveTo(track.start.x, track.start.y);
    ctx.lineTo(track.end.x, track.end.y);
  }
}

/**
 * Computes exact analytical bounding box of an arc, accounting for circular extrema
 * (0, 90, 180, 270 degrees) within the arc's angular range.
 */
export function getArcBoundingBox(
  arc: ArcGeometry,
  padding = 0
): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Math.min(arc.start.x, arc.end.x);
  let maxX = Math.max(arc.start.x, arc.end.x);
  let minY = Math.min(arc.start.y, arc.end.y);
  let maxY = Math.max(arc.start.y, arc.end.y);

  if (arc.mid) {
    minX = Math.min(minX, arc.mid.x);
    maxX = Math.max(maxX, arc.mid.x);
    minY = Math.min(minY, arc.mid.y);
    maxY = Math.max(maxY, arc.mid.y);
  }

  // Check critical cardinal angles: 0 (+X), PI/2 (+Y), PI (-X), 3PI/2 (-Y)
  const cardinalAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
  for (const ca of cardinalAngles) {
    if (isAngleBetween(ca, arc.startAngle, arc.endAngle, arc.anticlockwise)) {
      const px = arc.center.x + arc.radius * Math.cos(ca);
      const py = arc.center.y + arc.radius * Math.sin(ca);
      minX = Math.min(minX, px);
      maxX = Math.max(maxX, px);
      minY = Math.min(minY, py);
      maxY = Math.max(maxY, py);
    }
  }

  return {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
  };
}

/**
 * Checks if target angle `angle` lies along the arc from `startAngle` to `endAngle` in specified direction.
 */
export function isAngleBetween(
  angle: number,
  startAngle: number,
  endAngle: number,
  anticlockwise: boolean
): boolean {
  const normTarget = normalizeAngle(angle);
  const normStart = normalizeAngle(startAngle);
  const normEnd = normalizeAngle(endAngle);

  if (anticlockwise) {
    // decreasing angle: start -> target -> end
    const sweepTotal = normalizeAngle(normStart - normEnd);
    const sweepTarget = normalizeAngle(normStart - normTarget);
    return sweepTarget <= sweepTotal;
  } else {
    // increasing angle: start -> target -> end
    const sweepTotal = normalizeAngle(normEnd - normStart);
    const sweepTarget = normalizeAngle(normTarget - normStart);
    return sweepTarget <= sweepTotal;
  }
}

/**
 * Calculates exact minimum distance from a point `(px, py)` to an arc.
 */
export function distanceToArc(
  px: number,
  py: number,
  arc: ArcGeometry
): number {
  const angleToPt = Math.atan2(py - arc.center.y, px - arc.center.x);
  const distToCenter = Math.hypot(px - arc.center.x, py - arc.center.y);

  if (isAngleBetween(angleToPt, arc.startAngle, arc.endAngle, arc.anticlockwise)) {
    // Nearest point is on the circular curve
    return Math.abs(distToCenter - arc.radius);
  }

  // Nearest point is one of the endpoints
  const distToStart = Math.hypot(px - arc.start.x, py - arc.start.y);
  const distToEnd = Math.hypot(px - arc.end.x, py - arc.end.y);
  return Math.min(distToStart, distToEnd);
}

/**
 * Calculates exact minimum distance from a point `(px, py)` to a linear line segment.
 */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const projX = ax + t * dx;
  const projY = ay + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Computes exact minimum distance from a point `(px, py)` to any PcbTrack.
 */
export function distanceToTrack(
  px: number,
  py: number,
  track: {
    kind?: string;
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    mid?: { x: number; y: number };
    center?: { x: number; y: number };
    angle?: number;
    points?: { x: number; y: number }[];
  }
): number {
  const arc = getTrackArcGeometry(track);
  if (arc) {
    return distanceToArc(px, py, arc);
  }

  const pts = track.points || [];
  if (pts.length >= 2) {
    let minDist = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const d = distanceToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      if (d < minDist) minDist = d;
    }
    return minDist;
  }

  if (track.start && track.end) {
    return distanceToSegment(px, py, track.start.x, track.start.y, track.end.x, track.end.y);
  }

  return Infinity;
}
