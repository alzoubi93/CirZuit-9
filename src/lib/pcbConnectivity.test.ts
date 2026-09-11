import { describe, expect, it } from "vitest";
import { parseKiCadPcb } from "./importKiCadPcb";
import {
  CopperElement,
  areLayersShared,
  doCopperElementsTouch,
  computeCopperIslands,
  computeGeometryAwareRatsnest,
} from "./pcbConnectivity";
import { emptyPcbDoc, PcbDoc } from "./pcb";

describe("Phase 6 — KiCad Nets, Connectivity & Ratsnest", () => {
  it("preserves exact KiCad net ordinal IDs and names including Net 0", () => {
    const kicadPcbSample = `
(kicad_pcb (version 20240108) (generator pcbnew)
  (general (thickness 1.6))
  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
  )
  (net 0 "")
  (net 1 "GND")
  (net 2 "+5V")
  (net 3 "NET_LED")

  (footprint "Resistor_THT:R_Axial_DIN0207_L6.3mm_D2.5mm_P7.62mm_Horizontal"
    (at 100 100)
    (property "Reference" "R1" (at 0 0 0))
    (pad "1" thru_hole circle (at -3.81 0) (size 1.6 1.6) (drill 0.8) (layers "*.Cu") (net 1 "GND"))
    (pad "2" thru_hole circle (at 3.81 0) (size 1.6 1.6) (drill 0.8) (layers "*.Cu") (net 2 "+5V"))
  )

  (segment (start 96.19 100) (end 80 100) (width 0.5) (layer "F.Cu") (net 1 "GND"))
  (via (at 80 100) (size 0.8) (drill 0.4) (layers "F.Cu" "B.Cu") (net 1 "GND"))
)
`;

    const parsed = parseKiCadPcb(kicadPcbSample, "test.kicad_pcb");
    const pcb = parsed.doc.pcb!;
    expect(pcb.nets).toHaveLength(4);
    
    // Net 0 preserved
    const net0 = pcb.nets.find(n => n.id === 0);
    expect(net0).toBeDefined();
    expect(net0?.name).toBe("");

    // Net 1 GND
    const net1 = pcb.nets.find(n => n.id === 1);
    expect(net1).toBeDefined();
    expect(net1?.name).toBe("GND");

    // Footprint pads preserve net
    const pad1 = pcb.footprints[0].pads.find(p => p.number === "1");
    expect(pad1?.netId).toBe(1);
    expect(pad1?.netName).toBe("GND");

    // Track preserves net
    expect(pcb.tracks[0].netId).toBe(1);

    // Via preserves net
    expect(pcb.vias[0].netId).toBe(1);
  });

  it("checks physical layer sharing correctly", () => {
    expect(areLayersShared(["top_copper"], ["F.Cu"])).toBe(true);
    expect(areLayersShared(["top_copper"], ["B.Cu"])).toBe(false);
    expect(areLayersShared(["multi_layer"], ["B.Cu"])).toBe(true);
  });

  it("evaluates geometric contact between copper features", () => {
    const padA: CopperElement = {
      id: "pad1",
      type: "pad",
      layers: ["top_copper"],
      x: 10,
      y: 10,
      padWidth: 2.0,
      padHeight: 2.0,
      padShape: "rect",
    };

    const trackTouch: CopperElement = {
      id: "track1",
      type: "track",
      layers: ["top_copper"],
      x: 10,
      y: 10,
      trackWidth: 0.5,
      points: [{ x: 10, y: 10 }, { x: 20, y: 10 }],
    };

    const trackNoTouch: CopperElement = {
      id: "track2",
      type: "track",
      layers: ["top_copper"],
      x: 50,
      y: 50,
      trackWidth: 0.5,
      points: [{ x: 50, y: 50 }, { x: 60, y: 50 }],
    };

    const trackWrongLayer: CopperElement = {
      id: "track3",
      type: "track",
      layers: ["bottom_copper"],
      x: 10,
      y: 10,
      trackWidth: 0.5,
      points: [{ x: 10, y: 10 }, { x: 20, y: 10 }],
    };

    expect(doCopperElementsTouch(padA, trackTouch)).toBe(true);
    expect(doCopperElementsTouch(padA, trackNoTouch)).toBe(false);
    expect(doCopperElementsTouch(padA, trackWrongLayer)).toBe(false);
  });

  it("computes physical copper islands and geometry-aware ratsnest airwires", () => {
    const pcb: PcbDoc = {
      ...emptyPcbDoc(),
      nets: [
        { id: 1, key: "GND", name: "GND", members: [], source: "imported" },
      ],
      footprints: [
        {
          id: "R1",
          reference: "R1",
          footprint: "R_0805",
          x: 10,
          y: 10,
          rotation: 0,
          pads: [
            { pinIndex: 1, number: "1", name: "1", x: -1, y: 0, width: 1, height: 1, shape: "rect", layer: "top_copper", netId: 1, netName: "GND" },
            { pinIndex: 2, number: "2", name: "2", x: 1, y: 0, width: 1, height: 1, shape: "rect", layer: "top_copper", netId: 1, netName: "GND" },
          ],
        },
      ],
      tracks: [],
    };

    // Before routing: Pads are not physically connected -> 1 airwire needed
    let lines = computeGeometryAwareRatsnest(pcb);
    expect(lines).toHaveLength(1);
    expect(lines[0].netId).toBe(1);

    // Add a track connecting Pad 1 (at x=9, y=10) to Pad 2 (at x=11, y=10)
    pcb.tracks = [
      {
        id: "tr1",
        kind: "segment",
        start: { x: 9, y: 10 },
        end: { x: 11, y: 10 },
        points: [{ x: 9, y: 10 }, { x: 11, y: 10 }],
        layer: "top_copper",
        width: 0.5,
        netId: 1,
        netName: "GND",
      },
    ];

    // After routing: Pads are physically connected by track -> 0 airwires needed!
    lines = computeGeometryAwareRatsnest(pcb);
    expect(lines).toHaveLength(0);
  });
});
