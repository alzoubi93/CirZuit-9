import { kicadGeometryEngine } from "./engine";
import type { GeoPoint, KicadGeometryBounds, KicadGeometryItem } from "./types";

export interface KicadGeometrySelectionState {
  ids: string[];
  items: KicadGeometryItem[];
}

/** Selection utilities intentionally operate on geometry IDs, not renderer DOM nodes. */
export class KicadGeometrySelectionController {
  selectAt(items: KicadGeometryItem[], point: GeoPoint, tolerance = 0.15): KicadGeometrySelectionState {
    const selected = kicadGeometryEngine.selectAtPoint(items, point, tolerance);
    return { ids: selected.map(i => i.id).filter((id): id is string => !!id), items: selected };
  }

  selectInRect(items: KicadGeometryItem[], rect: KicadGeometryBounds, contained = false): KicadGeometrySelectionState {
    const selected = kicadGeometryEngine.selectInRect(items, rect, contained);
    return { ids: selected.map(i => i.id).filter((id): id is string => !!id), items: selected };
  }

  toggle(state: KicadGeometrySelectionState, item: KicadGeometryItem): KicadGeometrySelectionState {
    const id = item.id;
    if (!id) return state;
    const exists = state.ids.includes(id);
    return exists
      ? { ids: state.ids.filter(x => x !== id), items: state.items.filter(x => x.id !== id) }
      : { ids: [...state.ids, id], items: [...state.items, item] };
  }

  clear(): KicadGeometrySelectionState { return { ids: [], items: [] }; }
}

export const kicadGeometrySelection = new KicadGeometrySelectionController();
