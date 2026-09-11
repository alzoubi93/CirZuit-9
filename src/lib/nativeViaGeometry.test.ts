import { describe, it, expect } from "vitest";
import {
  determineViaType,
  getViaSpannedLayers,
  isViaOnLayer,
  isViaVisible,
  shouldRenderViaAnnularRing,
  calculateViaToViaClearance,
  calculateViaToTrackClearance,
  getViaClassificationLabel,
} from "./viaGeometry";
import { PcbVia, PcbLayer, PcbTrack } from "./pcb";
import { parseKiCadPcb } from "./importKiCadPcb";

describe("Native KiCad PCB Via Architecture & Layer Spans", () => {
  const default4LayerStack: PcbLayer[] = [
    { id: "top_copper", name: "F.Cu", visible: true, color: "#ef4444", type: "copper" },
    { id: "in1.cu", name: "In1.Cu", visible: true, color: "#eab308", type: "copper" },
    { id: "in2.cu", name: "In2.Cu", visible: true, color: "#3b82f6", type: "copper" },
    { id: "bottom_copper", name: "B.Cu", visible: true, color: "#10b981", type: "copper" },
  ];

  it("classifies through, blind/buried, and microvias correctly", () => {
    const throughVia: PcbVia = {
      id: "v1",
      x: 10,
      y: 10,
      drill: 0.4,
      diameter: 0.8,
      layers: ["top_copper", "bottom_copper"],
    };

    const blindVia: PcbVia = {
      id: "v2",
      x: 20,
      y: 20,
      drill: 0.3,
      diameter: 0.6,
      layers: ["top_copper", "in1.cu"],
    };

    const buriedVia: PcbVia = {
      id: "v3",
      x: 30,
      y: 30,
      drill: 0.3,
      diameter: 0.6,
      layers: ["in1.cu", "in2.cu"],
    };

    const microVia: PcbVia = {
      id: "v4",
      x: 40,
      y: 40,
      drill: 0.15,
      diameter: 0.3,
      layers: ["top_copper", "in1.cu"],
      viaType: "micro",
    };

    expect(determineViaType(throughVia, default4LayerStack)).toBe("through");
    expect(determineViaType(blindVia, default4LayerStack)).toBe("blind");
    expect(determineViaType(buriedVia, default4LayerStack)).toBe("blind");
    expect(determineViaType(microVia, default4LayerStack)).toBe("micro");

    expect(getViaClassificationLabel(throughVia)).toContain("Through Via");
    expect(getViaClassificationLabel(blindVia)).toContain("Blind/Buried Via");
    expect(getViaClassificationLabel(microVia)).toContain("Microvia");
  });

  it("calculates exact spanned layers along the stackup", () => {
    const blindVia: PcbVia = {
      id: "v1",
      x: 10,
      y: 10,
      drill: 0.3,
      diameter: 0.6,
      layers: ["top_copper", "in2.cu"],
    };

    const spanned = getViaSpannedLayers(blindVia, default4LayerStack);
    expect(spanned).toEqual(["top_copper", "in1.cu", "in2.cu"]);

    expect(isViaOnLayer(blindVia, "top_copper", default4LayerStack)).toBe(true);
    expect(isViaOnLayer(blindVia, "in1.cu", default4LayerStack)).toBe(true);
    expect(isViaOnLayer(blindVia, "in2.cu", default4LayerStack)).toBe(true);
    expect(isViaOnLayer(blindVia, "bottom_copper", default4LayerStack)).toBe(false);
  });

  it("respects KiCad removeUnusedLayers optimization on inner copper", () => {
    const viaWithRemovedInner: PcbVia = {
      id: "v1",
      x: 10,
      y: 10,
      drill: 0.4,
      diameter: 0.8,
      layers: ["top_copper", "bottom_copper"],
      removeUnusedLayers: true,
      keepEndLayers: true,
    };

    const connectedTracks: PcbTrack[] = [
      { id: "t1", layer: "top_copper", start: { x: 10, y: 10 }, end: { x: 15, y: 10 }, width: 0.25 },
      { id: "t2", layer: "bottom_copper", start: { x: 10, y: 10 }, end: { x: 5, y: 10 }, width: 0.25 },
    ];

    // Annular ring on outer layers is kept
    expect(shouldRenderViaAnnularRing(viaWithRemovedInner, "top_copper", default4LayerStack, connectedTracks)).toBe(true);
    expect(shouldRenderViaAnnularRing(viaWithRemovedInner, "bottom_copper", default4LayerStack, connectedTracks)).toBe(true);

    // In1.Cu has no connected track, so unused annular ring is removed
    expect(shouldRenderViaAnnularRing(viaWithRemovedInner, "in1.cu", default4LayerStack, connectedTracks)).toBe(false);

    // If an inner track connects on In1.Cu:
    const connectedTracksWithInner: PcbTrack[] = [
      ...connectedTracks,
      { id: "t3", layer: "in1.cu", start: { x: 10, y: 10 }, end: { x: 10, y: 15 }, width: 0.25 },
    ];
    expect(shouldRenderViaAnnularRing(viaWithRemovedInner, "in1.cu", default4LayerStack, connectedTracksWithInner)).toBe(true);
  });

  it("calculates 3D layer-aware clearances between vias", () => {
    const viaA: PcbVia = {
      id: "vA",
      x: 10,
      y: 10,
      drill: 0.3,
      diameter: 0.6,
      layers: ["top_copper", "in1.cu"],
    };

    const viaB: PcbVia = {
      id: "vB",
      x: 10,
      y: 10, // Same 2D coordinate!
      drill: 0.3,
      diameter: 0.6,
      layers: ["in2.cu", "bottom_copper"], // Non-overlapping layer span (stacked/buried configuration)
    };

    const clearanceResult = calculateViaToViaClearance(viaA, viaB, default4LayerStack);
    expect(clearanceResult.sharesLayer).toBe(false);
    expect(clearanceResult.clearance).toBe(Infinity);

    // If viaB overlaps in1.cu:
    const overlappingViaB: PcbVia = {
      ...viaB,
      layers: ["in1.cu", "bottom_copper"],
    };
    const overlapResult = calculateViaToViaClearance(viaA, overlappingViaB, default4LayerStack);
    expect(overlapResult.sharesLayer).toBe(true);
    expect(overlapResult.overlappingLayers).toContain("in1.cu");
    expect(overlapResult.clearance).toBeCloseTo(-0.6); // Collision because same (x,y)
  });

  it("parses native KiCad PCB vias with type, offset drills, and remove_unused_layers", () => {
    const kicadPcb = `(kicad_pcb (version 20240108) (generator pcbnew)
      (layers
        (0 "F.Cu" signal)
        (1 "In1.Cu" signal)
        (2 "In2.Cu" signal)
        (31 "B.Cu" signal)
        (44 "Edge.Cuts" user)
      )
      (via (type micro) (at 12.5 18.2) (size 0.3) (drill 0.15 (offset 0.02 0.01)) (layers "F.Cu" "In1.Cu") (remove_unused_layers) (net 1) (tstamp "9d41b63e-1087-43df-bf74-bb283b8b6034"))
      (via (type blind) (at 25.0 30.0) (size 0.5) (drill 0.25) (layers "In1.Cu" "In2.Cu") (net 2) (tstamp "9d41b63e-1087-43df-bf74-bb283b8b6035"))
      (via (at 40.0 50.0) (size 0.8) (drill 0.4) (layers "F.Cu" "B.Cu") (net 3) (tstamp "9d41b63e-1087-43df-bf74-bb283b8b6036") (locked))
    )`;

    const parsed = parseKiCadPcb(kicadPcb);
    expect(parsed.doc.pcb.vias).toBeDefined();
    expect(parsed.doc.pcb.vias.length).toBe(3);

    const microVia = parsed.doc.pcb.vias[0];
    expect(microVia.viaType).toBe("micro");
    expect(microVia.diameter).toBe(0.3);
    expect(microVia.drill).toBe(0.15);
    expect(microVia.drillOffset).toEqual({ x: 0.02, y: 0.01 });
    expect(microVia.removeUnusedLayers).toBe(true);

    const blindVia = parsed.doc.pcb.vias[1];
    expect(blindVia.viaType).toBe("blind");
    expect(blindVia.layers).toEqual(["In1.Cu", "In2.Cu"]);

    const throughVia = parsed.doc.pcb.vias[2];
    expect(throughVia.diameter).toBe(0.8);
    expect(throughVia.drill).toBe(0.4);
    expect(throughVia.locked).toBe(true);
  });
});
