import { describe, expect, it } from "vitest";
import { kicadMmToWorld, worldToKicadMm, kicadPointToWorld } from "./kicadCoordinateSystem";

describe("KiCad native coordinate contract", () => {
  it("round-trips millimetres", () => {
    expect(worldToKicadMm(kicadMmToWorld(2.54))).toBeCloseTo(2.54, 10);
    expect(worldToKicadMm(kicadMmToWorld(10))).toBeCloseTo(10, 10);
  });

  it("keeps KiCad Y-up geometry deterministic at the SVG boundary", () => {
    const p = kicadPointToWorld({ x: 0, y: 0 }, { minX: -5, minY: -5, maxX: 5, maxY: 5 });
    expect(p.x).toBeCloseTo(5 / 2.54, 10);
    expect(p.y).toBeCloseTo(5 / 2.54, 10);
  });
});
