import {
  KicadFootprintEnvironment,
  KicadFootprintRuntime,
} from "./kicadFootprintRuntime";
import {
  kicadFootprintLibrary,
  type KicadFootprintModel,
} from "./kicadFootprint";
import { readKicadFootprintDefinition } from "./kicadFootprintReader";

/**
 * Single application-level Footprint Environment, matching the role of the
 * existing KiCad Symbol runtime. Library loading, resolution and rendering
 * now converge on the same runtime object.
 */
export class KicadFootprintRuntimeService {
  readonly environment = new KicadFootprintEnvironment();

  async loadOfficial(path: string): Promise<KicadFootprintRuntime> {
    const entry = kicadFootprintLibrary.listEntries("", "").find(e => e.path === path);
    if (!entry) throw new Error(`Footprint is not indexed: ${path}`);
    const model = await kicadFootprintLibrary.load(entry);
    return this.environment.register(model);
  }

  register(model: KicadFootprintModel) {
    return this.environment.register(model);
  }

  resolve(name: string, library?: string) {
    return this.environment.resolve(name, library);
  }

  loadText(text: string, source: Partial<KicadFootprintModel["source"]> = {}) {
    const model = readKicadFootprintDefinition(text, source);
    return this.environment.register(model);
  }

  clear() { this.environment.clear(); }
  values() { return this.environment.values(); }
}

export const kicadFootprintRuntime = new KicadFootprintRuntimeService();
