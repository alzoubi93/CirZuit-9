/**
 * KiCad <-> CirZuit coordinate contract.
 *
 * KiCad symbol library coordinates are millimetres, with +Y upward.
 * CirZuit's SVG world uses a top-left origin, so Y is inverted at the
 * rendering boundary. No renderer should contain a hard-coded 1/2.54.
 */
export const KICAD_MM_PER_WORLD_UNIT = 2.54;
export const WORLD_UNITS_PER_KICAD_MM = 1 / KICAD_MM_PER_WORLD_UNIT;

export interface KicadPoint { x: number; y: number; }
export interface WorldPoint { x: number; y: number; }

export interface KicadCoordinateTransform {
  origin: KicadPoint;
  scale: number;
  rotation: number;
  mirrorX: boolean;
  mirrorY: boolean;
}

export function kicadMmToWorld(mm: number): number {
  return mm * WORLD_UNITS_PER_KICAD_MM;
}

export function worldToKicadMm(world: number): number {
  return world * KICAD_MM_PER_WORLD_UNIT;
}

/** Convert a KiCad Y-up point to local SVG/world coordinates relative to a bbox. */
export function kicadPointToWorld(
  p: KicadPoint,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
): WorldPoint {
  return {
    x: (p.x - bbox.minX) * WORLD_UNITS_PER_KICAD_MM,
    y: (bbox.maxY - p.y) * WORLD_UNITS_PER_KICAD_MM,
  };
}

export function worldPointToKicad(
  p: WorldPoint,
  bbox: { minX: number; minY: number; maxX: number; maxY: number },
): KicadPoint {
  return {
    x: p.x * KICAD_MM_PER_WORLD_UNIT + bbox.minX,
    y: bbox.maxY - p.y * KICAD_MM_PER_WORLD_UNIT,
  };
}

export function rotateKicadPoint(p: KicadPoint, degrees: number): KicadPoint {
  const r = degrees * Math.PI / 180;
  return { x: p.x * Math.cos(r) - p.y * Math.sin(r), y: p.x * Math.sin(r) + p.y * Math.cos(r) };
}

export function transformKicadPoint(p: KicadPoint, t: KicadCoordinateTransform): KicadPoint {
  let x = p.x - t.origin.x;
  let y = p.y - t.origin.y;
  if (t.mirrorX) x = -x;
  if (t.mirrorY) y = -y;
  const rotated = rotateKicadPoint({ x, y }, t.rotation);
  return { x: rotated.x * t.scale + t.origin.x, y: rotated.y * t.scale + t.origin.y };
}
