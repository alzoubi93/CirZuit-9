/**
 * CirZuit KiCad Geometry Runtime V8.
 *
 * Geometry is represented as semantic KiCad-like primitives.  The renderer is
 * intentionally downstream of this layer: it must never reinterpret KiCad
 * footprint semantics (padstack, chamfers, text boxes, transforms, etc.).
 */

export interface GeoPoint { x: number; y: number; }
export interface GeoSize { x: number; y: number; }
export interface GeoTransform {
  position: GeoPoint;
  rotation: number;
  scaleX: number;
  scaleY: number;
  flipped: boolean;
}
export interface GeoStroke { width: number; type?: string; }

export interface GeoLine { kind: "line"; start: GeoPoint; end: GeoPoint; stroke: GeoStroke; }
export interface GeoRect {
  kind: "rect"; start: GeoPoint; end: GeoPoint; radius: number; rotation: number;
  fill: boolean; stroke: GeoStroke;
}
export interface GeoRoundRect {
  kind: "roundrect";
  center: GeoPoint;
  size: GeoSize;
  rotation: number;
  radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  fill: boolean;
  stroke: GeoStroke;
}
export interface GeoChamferRect {
  kind: "chamferrect";
  center: GeoPoint;
  size: GeoSize;
  rotation: number;
  chamfers: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  radii: { topLeft: number; topRight: number; bottomRight: number; bottomLeft: number };
  fill: boolean;
  stroke: GeoStroke;
}
export interface GeoCircle {
  kind: "circle"; center: GeoPoint; radius: number; fill: boolean; stroke: GeoStroke;
}
export interface GeoArc {
  kind: "arc"; start: GeoPoint; mid: GeoPoint; end: GeoPoint; center: GeoPoint;
  radius: number; sweepRadians: number; stroke: GeoStroke;
}
export interface GeoPolygon { kind: "polygon"; points: GeoPoint[]; fill: boolean; stroke: GeoStroke; }
export interface GeoBezier { kind: "bezier"; points: GeoPoint[]; stroke: GeoStroke; }
export interface GeoText {
  kind: "text"; text: string; position: GeoPoint; size: GeoSize; rotation: number;
  thickness: number; anchor: "start" | "middle" | "end"; mirror: boolean;
  italic: boolean; bold: boolean; visible: boolean; boxEnd?: GeoPoint;
  boxPoints?: GeoPoint[]; boxFill?: boolean; boxAngle?: number; stroke: GeoStroke;
  role?: "reference" | "value" | "user" | "other";
}
export interface GeoCapsule {
  kind: "capsule"; start: GeoPoint; end: GeoPoint; radius: number;
  rotation: number; fill: boolean; stroke: GeoStroke;
}
export interface GeoHole { kind: "hole"; center: GeoPoint; size: GeoSize; rotation: number; oval: boolean; }

export type KicadGeometryPrimitive =
  | GeoLine | GeoRect | GeoRoundRect | GeoChamferRect | GeoCircle | GeoArc
  | GeoPolygon | GeoBezier | GeoText | GeoCapsule | GeoHole;

export interface KicadGeometryItem {
  primitive: KicadGeometryPrimitive;
  /** Original KiCad layer token. This is never rewritten by the CirZuit adapter. */
  layer: string;
  /** Effective display layer is resolved only by the renderer/adapter. */
  displayLayer?: string;
  source: "graphic" | "pad" | "drill" | "custom-pad" | "text-box";
  id?: string;
  ownerId?: string;
  selectable?: boolean;
  metadata?: Record<string, unknown>;
}

export interface KicadGeometryBounds { minX: number; minY: number; maxX: number; maxY: number; }

export interface KicadHitResult {
  hit: boolean;
  distance: number;
  item?: KicadGeometryItem;
  kind?: KicadGeometryPrimitive["kind"];
}
