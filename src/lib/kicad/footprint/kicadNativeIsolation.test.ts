import { describe, expect, it } from "vitest";
import { footprintToPcbFootprint } from "./kicadFootprint";
import { KicadFootprintRuntime } from "./kicadFootprintRuntime";
import type { KicadFootprintModel } from "./kicadFootprint";

const model: KicadFootprintModel = {
  id: "Capacitor_THT:CP_Axial_L11.0mm_D6.0mm_P18.00mm_Horizontal",
  library: "Capacitor_THT", name: "CP_Axial_L11.0mm_D6.0mm_P18.00mm_Horizontal",
  fullName: "Capacitor_THT:CP_Axial_L11.0mm_D6.0mm_P18.00mm_Horizontal",
  layer: "F.Cu", position: { x: 0, y: 0 }, rotation: 0,
  properties: {}, graphics: [], models: [], diagnostics: [], source: { type: "kicad-official" },
  pads: [
    { number: "1", type: "thru_hole", shape: "roundrect", position: { x: 0, y: 0 }, size: { x: 2.4, y: 2.4 }, rotation: 0, layers: ["*.Cu", "*.Mask"], drill: 1.2, roundrectRatio: 0.104167 },
    { number: "2", type: "thru_hole", shape: "roundrect", position: { x: 18, y: 0 }, size: { x: 2.4, y: 2.4 }, rotation: 0, layers: ["*.Cu", "*.Mask"], drill: 1.2, roundrectRatio: 0.104167 },
  ],
};

describe("KiCad native footprint isolation", () => {
  it("keeps exact pad pitch in the native runtime", () => {
    const runtime = new KicadFootprintRuntime(model);
    const pads = runtime.GetPads();
    expect(pads[1].position.x - pads[0].position.x).toBe(18);
  });

  it("marks the board projection as native without replacing geometry", () => {
    const projected = footprintToPcbFootprint(model, "native-test");
    expect(projected.nativeKicadFootprint).toBe(model);
    expect(projected.pads[0].nativePad).toBe(model.pads[0]);
  });
});
