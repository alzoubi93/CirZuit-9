import { describe, it, expect } from "vitest";
import { parseKiCadPcb, mapKiCadPcbLayer } from "./importKiCadPcb";
import { isCopperLayer, isInnerCopperLayer, getCopperLayerStandardColor } from "./pcb";
import { generateGerberLayer } from "./exportGerber";

describe("KiCad PCB Multilayer & Native Track Import V2", () => {
  const sample4LayerKiCadPcb = `(kicad_pcb (version 20221018) (generator pcbnew)
  (general
    (thickness 1.6)
  )
  (layers
    (0 "F.Cu" signal "TopLayer")
    (1 "In1.Cu" power "GND")
    (2 "In2.Cu" signal "VCC")
    (31 "B.Cu" signal "BottomLayer")
    (32 "B.Adhes" user "B.Adhesive")
    (33 "F.Adhes" user "F.Adhesive")
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user "B.Silkscreen")
    (37 "F.SilkS" user "F.Silkscreen")
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (44 "Edge.Cuts" user)
  )
  (net 0 "")
  (net 1 "GND")
  (net 2 "+3V3")
  (net 3 "SIG_IN")

  (segment (start 100 100) (end 120 100) (width 0.25) (layer "F.Cu") (net 3) (tstamp "uuid-1"))
  (segment (start 100 105) (end 130 105) (width 0.5) (layer "In1.Cu") (net 1) (tstamp "uuid-2"))
  (segment (start 100 110) (end 130 110) (width 0.5) (layer "In2.Cu") (net 2) (tstamp "uuid-3"))
  (segment (start 100 115) (end 125 115) (width 0.25) (layer "B.Cu") (net 3) (tstamp "uuid-4"))

  (arc (start 120 100) (mid 123 103) (end 120 106) (width 0.25) (layer "F.Cu") (net 3) (tstamp "uuid-5"))

  (via (at 120 106) (size 0.6) (drill 0.3) (layers "F.Cu" "In1.Cu") (net 1) (tstamp "uuid-6"))
  (via (at 100 110) (size 0.8) (drill 0.4) (layers "In2.Cu" "B.Cu") (net 2) (tstamp "uuid-7"))

  (gr_line (start 90 90) (end 150 90) (stroke (width 0.15) (type solid)) (layer "Edge.Cuts"))
  (gr_line (start 150 90) (end 150 140) (stroke (width 0.15) (type solid)) (layer "Edge.Cuts"))
  (gr_line (start 150 140) (end 90 140) (stroke (width 0.15) (type solid)) (layer "Edge.Cuts"))
  (gr_line (start 90 140) (end 90 90) (stroke (width 0.15) (type solid)) (layer "Edge.Cuts"))
)`;

  it("correctly identifies all copper layers including In1.Cu and In2.Cu without collapsing them", () => {
    expect(mapKiCadPcbLayer("F.Cu")).toBe("top_copper");
    expect(mapKiCadPcbLayer("B.Cu")).toBe("bottom_copper");
    expect(mapKiCadPcbLayer("In1.Cu")).toBe("In1.Cu");
    expect(mapKiCadPcbLayer("In2.Cu")).toBe("In2.Cu");
    expect(mapKiCadPcbLayer("In30.Cu")).toBe("In30.Cu");

    expect(isCopperLayer("top_copper")).toBe(true);
    expect(isCopperLayer("bottom_copper")).toBe(true);
    expect(isCopperLayer("In1.Cu")).toBe(true);
    expect(isCopperLayer("In2.Cu")).toBe(true);
    expect(isCopperLayer("silkscreen")).toBe(false);

    expect(isInnerCopperLayer("In1.Cu")).toBe(true);
    expect(isInnerCopperLayer("top_copper")).toBe(false);
    expect(isInnerCopperLayer("bottom_copper")).toBe(false);
  });

  it("preserves multilayer board layer stack and distinct tracks on In1.Cu and In2.Cu", () => {
    const res = parseKiCadPcb(sample4LayerKiCadPcb, "multiboard.kicad_pcb");
    const pcb = res.doc.pcb;

    expect(pcb).toBeDefined();
    expect(pcb.layers.length).toBeGreaterThan(4);

    // Layer stack should contain In1.Cu and In2.Cu with proper custom names if present
    const in1Layer = pcb.layers.find(l => l.id === "In1.Cu");
    expect(in1Layer).toBeDefined();
    expect(in1Layer?.userName).toBe("GND");

    const in2Layer = pcb.layers.find(l => l.id === "In2.Cu");
    expect(in2Layer).toBeDefined();
    expect(in2Layer?.userName).toBe("VCC");

    // Tracks should exist distinctly on each layer
    const fCuTracks = pcb.tracks.filter(t => t.layer === "top_copper" || t.layer === "F.Cu");
    const in1Tracks = pcb.tracks.filter(t => t.layer === "In1.Cu");
    const in2Tracks = pcb.tracks.filter(t => t.layer === "In2.Cu");
    const bCuTracks = pcb.tracks.filter(t => t.layer === "bottom_copper" || t.layer === "B.Cu");

    expect(fCuTracks.length).toBeGreaterThanOrEqual(1);
    expect(in1Tracks.length).toBe(1);
    expect(in2Tracks.length).toBe(1);
    expect(bCuTracks.length).toBe(1);

    // Tracks must have native geometry properties
    expect(in1Tracks[0].kind).toBe("segment");
    expect(in1Tracks[0].start).toBeDefined();
    expect(in1Tracks[0].end).toBeDefined();
    expect(in1Tracks[0].width).toBe(0.5);
    expect(in1Tracks[0].netId).toBe(1);

    // Arcs must have arc properties
    const arcTrack = pcb.tracks.find(t => t.kind === "arc");
    expect(arcTrack).toBeDefined();
    expect(arcTrack?.mid).toBeDefined();

    // Vias must preserve layer spans
    expect(pcb.vias.length).toBe(2);
    expect(pcb.vias[0].layers).toEqual(["top_copper", "In1.Cu"]);
    expect(pcb.vias[1].layers).toEqual(["In2.Cu", "bottom_copper"]);
  });

  it("exports inner copper layers into Gerber RS-274X/X2 seamlessly", () => {
    const res = parseKiCadPcb(sample4LayerKiCadPcb, "multiboard.kicad_pcb");
    const pcb = res.doc.pcb;

    const dummySchematic = { nodes: [], wires: [], canvasColor: "white", defaultWireColor: "black" } as any;
    const in1Gerber = generateGerberLayer(pcb, "In1.Cu", dummySchematic, "rs274x");
    expect(in1Gerber).toContain("G04 Define Apertures*%");
    expect(in1Gerber).toContain("M02*");
    // Should have plotted track lines
    expect(in1Gerber).toContain("G01*");
  });
});
