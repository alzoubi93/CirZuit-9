import { describe, expect, it } from "vitest";
import { KicadGeometryEngine, arcFromThreePoints, transformPoint } from "./engine";

const engine = new KicadGeometryEngine();

describe("KiCad Geometry Runtime V7", () => {
  it("uses KiCad start/mid/end semantics for arcs", () => {
    const arc = arcFromThreePoints({ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 });
    expect(arc).not.toBeNull();
    expect(arc!.center.x).toBeCloseTo(0);
    expect(arc!.center.y).toBeCloseTo(0);
    expect(arc!.radius).toBeCloseTo(1);
    expect(Math.abs(arc!.sweepRadians)).toBeCloseTo(Math.PI);
  });

  it("creates an oval pad as a capsule, not an ellipse", () => {
    const p = engine.ovalPad({
      number: "1", type: "smd", shape: "oval", position: { x: 10, y: 4 },
      size: { x: 3, y: 1 }, rotation: 0, layers: ["F.Cu"],
    });
    expect(p.kind).toBe("capsule");
    expect(p.radius).toBeCloseTo(0.5);
    expect(p.start.x).toBeCloseTo(-1);
    expect(p.end.x).toBeCloseTo(1);
  });

  it("matches KiCad trapezoid delta construction", () => {
    const p = engine.trapezoidPad({
      number: "1", type: "smd", shape: "trapezoid", position: { x: 0, y: 0 },
      size: { x: 4, y: 2 }, rotation: 0, layers: ["F.Cu"], rectDelta: { x: 0.4, y: 0.2 },
    });
    expect(p.points[0]).toEqual({ x: -2.1, y: 1.2 });
    expect(p.points[1]).toEqual({ x: 2.1, y: 0.8 });
    expect(p.points[2]).toEqual({ x: 1.9, y: -0.8 });
    expect(p.points[3]).toEqual({ x: -1.9, y: -1.2 });
  });

  it("applies pad rotation and offset once", () => {
    const items = engine.padItems({
      number: "1", type: "smd", shape: "rect", position: { x: 10, y: 20 },
      size: { x: 2, y: 1 }, rotation: 90, layers: ["F.Cu"], offset: { x: 1, y: 0 },
    }, "pad:1");
    const rect = items[0].primitive;
    expect(rect.kind).toBe("polygon");
    if (rect.kind === "polygon") {
      const xs = rect.points.map(p => p.x);
      const ys = rect.points.map(p => p.y);
      expect(Math.min(...xs)).toBeCloseTo(9.5);
      expect(Math.max(...xs)).toBeCloseTo(10.5);
      expect(Math.min(...ys)).toBeCloseTo(20);
      expect(Math.max(...ys)).toBeCloseTo(22);
    }
  });

  it("transforms world geometry without mutating library geometry", () => {
    const local = engine.buildFootprint([], [{
      number: "1", type: "smd", shape: "rect", position: { x: 1, y: 0 },
      size: { x: 1, y: 1 }, rotation: 0, layers: ["F.Cu"],
    }]);
    const world = engine.transformed(local, { position: { x: 10, y: 20 }, rotation: 90, scaleX: 1, scaleY: 1, flipped: false });
    const points = engine.primitivePoints(world[0].primitive);
    expect(Math.min(...points.map(p => p.x))).toBeCloseTo(9.5);
    expect(Math.max(...points.map(p => p.x))).toBeCloseTo(10.5);
    expect(Math.min(...points.map(p => p.y))).toBeCloseTo(20.5);
    expect(Math.max(...points.map(p => p.y))).toBeCloseTo(21.5);
  });
});
