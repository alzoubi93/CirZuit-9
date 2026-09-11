import { describe, it, expect } from "vitest";
import {
  compute3PointArc,
  computeCenterArc,
  getTrackArcGeometry,
  getTrackSvgPath,
  getArcBoundingBox,
  distanceToArc,
  distanceToTrack,
} from "./arcGeometry";
import { parseKiCadPcb } from "./importKiCadPcb";
import { generateGerberLayer } from "./exportGerber";

describe("Native PCB Arc Architecture (Phase 2)", () => {
  describe("Analytical Arc Math", () => {
    it("computes exact 3-point quarter circle arc (CCW)", () => {
      // Circle at center (0, 0) radius 10:
      // Start at (10, 0), Mid at (0, 10), End at (-10, 0) [Semi-circle, angle 0 -> pi/2 -> pi]
      const arc = compute3PointArc({ x: 10, y: 0 }, { x: 0, y: 10 }, { x: -10, y: 0 });
      expect(arc).not.toBeNull();
      if (!arc) return;

      expect(Math.abs(arc.center.x)).toBeLessThan(1e-5);
      expect(Math.abs(arc.center.y)).toBeLessThan(1e-5);
      expect(Math.abs(arc.radius - 10)).toBeLessThan(1e-5);
      expect(arc.sweepFlag).toBe(1);
      expect(arc.largeArcFlag).toBe(0); // 180 deg is not > 180
      expect(Math.abs(arc.length - 10 * Math.PI)).toBeLessThan(1e-4);
    });

    it("computes large arc (>180 deg) correctly", () => {
      // Start (10, 0) -> Mid (0, 10) -> End (0, -10) -> 270 deg traversal
      const arc = compute3PointArc({ x: 10, y: 0 }, { x: 0, y: 10 }, { x: 0, y: -10 });
      expect(arc).not.toBeNull();
      if (!arc) return;

      expect(arc.largeArcFlag).toBe(1);
      expect(arc.sweepFlag).toBe(1);
      expect(Math.abs(arc.length - 10 * 1.5 * Math.PI)).toBeLessThan(1e-4);
    });

    it("computes center-angle arc correctly", () => {
      const arc = computeCenterArc({ x: 50, y: 50 }, { x: 60, y: 50 }, 90);
      expect(arc.radius).toBeCloseTo(10);
      expect(arc.end.x).toBeCloseTo(50);
      expect(arc.end.y).toBeCloseTo(60);
      expect(arc.sweepAngle).toBeCloseTo(Math.PI / 2);
    });

    it("generates exact SVG arc path syntax", () => {
      const track = {
        kind: "arc",
        start: { x: 10, y: 0 },
        mid: { x: 0, y: 10 },
        end: { x: -10, y: 0 },
        points: [],
      };
      const svgPath = getTrackSvgPath(track as any);
      expect(svgPath).toContain("M 10.0000 0.0000 A 10.0000 10.0000 0 0 1 -10.0000 0.0000");
    });

    it("computes exact analytical bounding box incorporating circle extrema", () => {
      // Arc from (10, 0) through (0, 10) to (-10, 0)
      const arc = compute3PointArc({ x: 10, y: 0 }, { x: 0, y: 10 }, { x: -10, y: 0 });
      expect(arc).not.toBeNull();
      if (!arc) return;

      const bbox = getArcBoundingBox(arc);
      expect(bbox.minX).toBeCloseTo(-10);
      expect(bbox.maxX).toBeCloseTo(10);
      expect(bbox.minY).toBeCloseTo(0);
      expect(bbox.maxY).toBeCloseTo(10);
    });

    it("calculates exact distance to arc", () => {
      const arc = compute3PointArc({ x: 10, y: 0 }, { x: 0, y: 10 }, { x: -10, y: 0 });
      expect(arc).not.toBeNull();
      if (!arc) return;

      // Point at (0, 15) -> nearest point on arc is (0, 10) -> distance is 5
      const dist1 = distanceToArc(0, 15, arc);
      expect(dist1).toBeCloseTo(5);

      // Point at (0, 0) -> distance to arc is 10 (radius - 0)
      const dist2 = distanceToArc(0, 0, arc);
      expect(dist2).toBeCloseTo(10);
    });
  });

  describe("KiCad Native Arc Import & Gerber Export", () => {
    const kicadWithArcs = `(kicad_pcb (version 20221018) (generator pcbnew)
  (general (thickness 1.6))
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (44 "Edge.Cuts" user)
  )
  (net 0 "")
  (net 1 "CLK")

  (arc (start 50 50) (mid 57.07 52.93) (end 60 60) (width 0.3) (layer "F.Cu") (net 1) (tstamp "arc-uuid-1"))
  (gr_arc (start 100 100) (mid 110 110) (end 100 120) (width 0.2) (layer "Edge.Cuts") (tstamp "gr-arc-uuid-2"))
)`;

    it("imports native 3-point copper arc with exact metadata", () => {
      const parsed = parseKiCadPcb(kicadWithArcs, "arc_board.kicad_pcb");
      const pcb = parsed.doc.pcb;

      const copperArc = pcb.tracks.find(t => t.layer === "top_copper" && t.kind === "arc");
      expect(copperArc).toBeDefined();
      expect(copperArc?.kind).toBe("arc");
      expect(copperArc?.start).toBeDefined();
      expect(copperArc?.mid).toBeDefined();
      expect(copperArc?.end).toBeDefined();
      expect(copperArc?.width).toBe(0.3);
      expect(copperArc?.netId).toBe(1);

      const arcGeo = getTrackArcGeometry(copperArc as any);
      expect(arcGeo).not.toBeNull();
      expect(arcGeo?.radius).toBeGreaterThan(0);
    });

    it("exports native copper arcs to Gerber G02/G03 circular interpolation", () => {
      const parsed = parseKiCadPcb(kicadWithArcs, "arc_board.kicad_pcb");
      const pcb = parsed.doc.pcb;

      const dummySchematic = { nodes: [], wires: [], canvasColor: "white", defaultWireColor: "black" } as any;
      const gtl = generateGerberLayer(pcb, "top_copper", dummySchematic, "rs274x");

      expect(gtl).toContain("G75*"); // Multi-Quadrant mode
      // Should contain G02* or G03* with I and J center offsets
      expect(gtl.includes("G02*") || gtl.includes("G03*")).toBe(true);
      expect(gtl).toMatch(/I-?\d+J-?\d+D01\*/);
    });
  });
});
