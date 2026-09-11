/**
 * CirZuit KiCad Footprint Runtime (V8.1)
 *
 * Architectural note:
 * This module intentionally mirrors KiCad's object-oriented PCB model instead
 * of exposing a file parser to the rest of the application. The file reader
 * remains an internal loader detail. Consumers work with KiCad-like runtime
 * objects: Footprint, Pad, graphic items, transforms, layers and properties.
 *
 * The object boundaries are based on KiCad pcbnew's FOOTPRINT/PAD/FP_SHAPE/
 * PCB_TEXT concepts. They are an independent TypeScript implementation, not a
 * source-code copy of KiCad.
 */
import { kicadGeometryEngine } from "./geometry";
import { KicadPadstackRuntime } from "./kicadPadstackRuntime";
import type { KicadGeometryItem, KicadHitResult } from "./geometry";
import type {
  KicadFootprintGraphic,
  KicadFootprintModel,
  KicadFootprintPad,
  KicadFootprintPoint,
} from "./kicadFootprint";

export interface KicadFootprintTransform {
  position: KicadFootprintPoint;
  rotation: number;
  scaleX: number;
  scaleY: number;
  flipped: boolean;
}

export type KicadFootprintItem = KicadFootprintPad | KicadFootprintGraphic;

export function clonePoint(p: KicadFootprintPoint): KicadFootprintPoint {
  return { x: p.x, y: p.y };
}

export function rotatePoint(p: KicadFootprintPoint, degrees: number): KicadFootprintPoint {
  const r = degrees * Math.PI / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export function transformPoint(p: KicadFootprintPoint, t: KicadFootprintTransform): KicadFootprintPoint {
  let q = { x: p.x * t.scaleX, y: p.y * t.scaleY };
  if (t.flipped) q.x = -q.x;
  q = rotatePoint(q, t.rotation);
  return { x: q.x + t.position.x, y: q.y + t.position.y };
}

export class KicadPadRuntime {
  private readonly data: KicadFootprintPad;
  private readonly padstack: KicadPadstackRuntime;

  constructor(data: KicadFootprintPad) {
    this.data = data;
    this.padstack = new KicadPadstackRuntime(data);
  }

  get number() { return this.data.number; }
  get type() { return this.data.type; }
  get shape() { return this.data.shape; }
  get position() { return clonePoint(this.data.position); }
  get size() { return { ...this.data.size }; }
  get rotation() { return this.data.rotation; }
  get layers() { return [...this.data.layers]; }
  get drill() { return this.data.drill; }
  get drillX() { return this.data.drillX; }
  get drillY() { return this.data.drillY; }
  get net() { return this.data.net ? { ...this.data.net } : undefined; }
  get pinFunction() { return this.data.pinfunction; }
  get pinType() { return this.data.pinstype; }
  get native() { return this.data; }
  GetPadstack() { return this.padstack; }
  ResolveLayer(layer: string) { return this.padstack.resolve(layer); }

  isThroughHole() { return this.data.type === "thru_hole" || this.data.type === "np_thru_hole"; }
  isSmd() { return this.data.type === "smd"; }
  isCopper() { return this.data.layers.some(l => l === "F.Cu" || l === "B.Cu" || l === "*.Cu"); }
  worldPosition(transform: KicadFootprintTransform) { return transformPoint(this.data.position, transform); }
}

export class KicadFootprintRuntime {
  private readonly model: KicadFootprintModel;
  private readonly padObjects: KicadPadRuntime[];
  private transformState: KicadFootprintTransform;

  constructor(model: KicadFootprintModel) {
    this.model = model;
    this.padObjects = model.pads.map(p => new KicadPadRuntime(p));
    this.transformState = {
      position: clonePoint(model.position),
      rotation: model.rotation,
      scaleX: 1,
      scaleY: 1,
      flipped: model.layer === "B.Cu",
    };
  }

  /** KiCad-style object identity. */
  get uuid() { return this.model.uuid; }
  get name() { return this.model.name; }
  get libraryName() { return this.model.library; }
  get fullName() { return this.model.fullName; }
  get libraryIdentifier() { return this.model.fullName; }
  get graphics() { return this.model.graphics; }
  get pads() { return this.model.pads; }
  get layer() { return this.model.layer; }
  get description() { return this.model.description; }
  get properties() { return { ...this.model.properties }; }
  get attributes() { return [...(this.model.attributes ?? [])]; }
  get diagnostics() { return [...this.model.diagnostics]; }
  get native() { return this.model; }

  GetPosition() { return clonePoint(this.transformState.position); }
  SetPosition(position: KicadFootprintPoint) { this.transformState.position = clonePoint(position); }
  GetOrientation() { return this.transformState.rotation; }
  SetOrientation(degrees: number) { this.transformState.rotation = degrees; }
  GetScale() { return { x: this.transformState.scaleX, y: this.transformState.scaleY }; }
  SetScale(x: number, y = x) { this.transformState.scaleX = x; this.transformState.scaleY = y; }
  IsFlipped() { return this.transformState.flipped; }
  Flip() { this.transformState.flipped = !this.transformState.flipped; }

  GetPads() { return [...this.padObjects]; }
  GetGraphicalItems() { return [...this.model.graphics]; }
  GetModels() { return this.model.models.map(m => ({ ...m })); }
  GetItems(): KicadFootprintItem[] { return [...this.model.graphics, ...this.model.pads]; }

  FindPadByNumber(number: string) { return this.padObjects.find(p => p.number === number); }

  GetTransform(): KicadFootprintTransform { return { ...this.transformState, position: clonePoint(this.transformState.position) }; }

  TransformPoint(point: KicadFootprintPoint) {
    return transformPoint(point, this.transformState);
  }

  /** Renderers consume the immutable library-frame geometry plus this transform. */
  GetRenderModel(): KicadFootprintModel {
    return this.model;
  }

  /** Build the KiCad-local geometry graph. Renderer code should consume this
   * rather than reinterpreting footprint primitives itself. */
  GetGeometry() {
    return kicadGeometryEngine.buildFootprint(this.model.graphics, this.model.pads);
  }

  /** Build geometry in board/world coordinates after footprint transform. */
  GetWorldGeometry() {
    return kicadGeometryEngine.transformed(this.GetGeometry(), this.transformState);
  }

  GetGeometryBounds() {
    return kicadGeometryEngine.bounds(this.GetWorldGeometry());
  }

  /** KiCad-style footprint hit testing: geometry first, bounding box only as a fallback. */
  HitTest(point: KicadFootprintPoint, tolerance = 0.15): KicadHitResult {
    return kicadGeometryEngine.hitTestPoint(this.GetWorldGeometry(), point, tolerance);
  }

  SelectGeometryAt(point: KicadFootprintPoint, tolerance = 0.15): KicadGeometryItem[] {
    return kicadGeometryEngine.selectAtPoint(this.GetWorldGeometry(), point, tolerance);
  }

  SelectGeometryInRect(rect: { minX:number; minY:number; maxX:number; maxY:number }, contained = false): KicadGeometryItem[] {
    return kicadGeometryEngine.selectInRect(this.GetWorldGeometry(), rect, contained);
  }

  CreatePcbObject(id: string) {
    return new KicadPcbFootprintObject(this, id);
  }

}

/** Runtime boundary analogous to the Symbol Environment. */
export class KicadFootprintEnvironment {
  private footprints = new Map<string, KicadFootprintRuntime>();

  register(model: KicadFootprintModel): KicadFootprintRuntime {
    const runtime = new KicadFootprintRuntime(model);
    this.footprints.set(model.fullName || model.name, runtime);
    this.footprints.set(model.name, runtime);
    return runtime;
  }

  resolve(name: string, library?: string): KicadFootprintRuntime | undefined {
    return this.footprints.get(library ? `${library}:${name}` : name)
      ?? this.footprints.get(name);
  }

  remove(name: string, library?: string) {
    const key = library ? `${library}:${name}` : name;
    const runtime = this.footprints.get(key);
    if (!runtime) return;
    for (const [k, value] of this.footprints) if (value === runtime) this.footprints.delete(k);
  }

  clear() { this.footprints.clear(); }
  values() { return [...new Set(this.footprints.values())]; }
}

/**
 * Board-side object adapter.  This is the bridge between the KiCad footprint
 * runtime and CirZuit's PCB document.  The native runtime remains authoritative
 * for geometry; the PCB document only stores placement/connectivity metadata.
 */
export class KicadPcbFootprintObject {
  constructor(public readonly runtime: KicadFootprintRuntime, public readonly pcbId: string) {}

  get uuid() { return this.runtime.uuid; }
  get name() { return this.runtime.name; }
  get pads() { return this.runtime.GetPads(); }
  get geometry() { return this.runtime.GetWorldGeometry(); }
  get bounds() { return this.runtime.GetGeometryBounds(); }

  hitTest(point: KicadFootprintPoint, tolerance = 0.15) {
    return this.runtime.HitTest(point, tolerance);
  }

  selectAt(point: KicadFootprintPoint, tolerance = 0.15) {
    return this.runtime.SelectGeometryAt(point, tolerance);
  }
}
