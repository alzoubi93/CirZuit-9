import { describe, expect, it } from "vitest";
import { KicadFootprintEnvironment, KicadFootprintRuntime, transformPoint } from "./kicadFootprintRuntime";
import type { KicadFootprintModel } from "./kicadFootprint";

const model: KicadFootprintModel = {
  id: "Test:FP", library: "Test", name: "FP", fullName: "Test:FP", layer: "F.Cu",
  position: { x: 0, y: 0 }, rotation: 0, properties: {}, graphics: [], pads: [
    { number: "1", type: "smd", shape: "rect", position: { x: 1, y: 2 }, size: { x: 1, y: 1 }, rotation: 0, layers: ["F.Cu", "F.Paste", "F.Mask"] }
  ], models: [], source: { type: "kicad-official" }, diagnostics: []
};

describe("KiCad Footprint Runtime V6", () => {
  it("exposes KiCad-like footprint and pad objects", () => {
    const fp = new KicadFootprintRuntime(model);
    expect(fp.GetPads()).toHaveLength(1);
    expect(fp.FindPadByNumber("1")?.isSmd()).toBe(true);
    expect(fp.GetOrientation()).toBe(0);
  });

  it("keeps child geometry in footprint coordinates and applies TRS at the boundary", () => {
    const fp = new KicadFootprintRuntime(model);
    fp.SetPosition({ x: 10, y: 20 });
    fp.SetOrientation(90);
    const p = fp.TransformPoint({ x: 1, y: 0 });
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(21);
  });

  it("resolves library:name and name through one environment", () => {
    const env = new KicadFootprintEnvironment();
    env.register(model);
    expect(env.resolve("Test:FP")).toBeDefined();
    expect(env.resolve("FP", "Test")).toBeDefined();
    expect(env.resolve("FP")).toBeDefined();
  });

  it("supports non-uniform scale before rotation", () => {
    const p = transformPoint({ x: 2, y: 3 }, { position: { x: 1, y: 1 }, rotation: 0, scaleX: 2, scaleY: 3, flipped: false });
    expect(p).toEqual({ x: 5, y: 10 });
  });
});
