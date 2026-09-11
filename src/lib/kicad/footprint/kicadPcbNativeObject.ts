/**
 * V8 bridge between the KiCad Footprint Runtime and CirZuit's PCB document.
 *
 * The native KiCad runtime remains authoritative for geometry.  The PCB record
 * is a board-side identity/placement/connectivity projection, not a second
 * geometry implementation.
 */
import type { PcbFootprint } from "@/lib/pcb";
import { footprintToPcbFootprint } from "./kicadFootprint";
import { KicadFootprintRuntime } from "./kicadFootprintRuntime";
import type { KicadFootprintModel, KicadFootprintPoint } from "./kicadFootprint";

export class KicadPcbNativeObject {
  private boardRecord: PcbFootprint;

  constructor(
    public readonly runtime: KicadFootprintRuntime,
    public readonly id: string,
    boardRecord?: PcbFootprint,
  ) {
    this.boardRecord = boardRecord ?? footprintToPcbFootprint(runtime.native, id);
  }

  get nativeFootprint(): KicadFootprintModel { return this.runtime.native; }
  get pcbFootprint(): PcbFootprint { return this.boardRecord; }
  get geometry() { return this.runtime.GetWorldGeometry(); }
  get bounds() { return this.runtime.GetGeometryBounds(); }

  place(position: KicadFootprintPoint) {
    this.runtime.SetPosition(position);
    this.boardRecord = { ...this.boardRecord, x: position.x, y: position.y };
  }

  rotate(degrees: number) {
    this.runtime.SetOrientation(degrees);
    this.boardRecord = { ...this.boardRecord, rotation: degrees };
  }

  flip() {
    this.runtime.Flip();
    this.boardRecord = { ...this.boardRecord, metadata: { ...(this.boardRecord.metadata ?? {}), flipped: this.runtime.IsFlipped() } };
  }

  hitTest(point: KicadFootprintPoint, tolerance = 0.15) {
    return this.runtime.HitTest(point, tolerance);
  }

  selectAt(point: KicadFootprintPoint, tolerance = 0.15) {
    return this.runtime.SelectGeometryAt(point, tolerance);
  }

  syncBoardRecord(): PcbFootprint {
    this.boardRecord = {
      ...this.boardRecord,
      x: this.runtime.GetPosition().x,
      y: this.runtime.GetPosition().y,
      rotation: this.runtime.GetOrientation(),
      nativeKicadFootprint: this.runtime.native,
    };
    return this.boardRecord;
  }
}

export function createKicadPcbNativeObject(model: KicadFootprintModel, id: string, boardRecord?: PcbFootprint) {
  return new KicadPcbNativeObject(new KicadFootprintRuntime(model), id, boardRecord);
}
