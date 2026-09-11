import { describe, expect, it } from "vitest";
import { emptyPcbDoc } from "./pcb";
import { buildNetIndex } from "./netlist";
import { syncPcbWithSchematic, validateSchematicPcbLink, buildPcbNetRegistry } from "./pcbSync";
import type { SchematicDoc } from "./schematic";

const schematic: SchematicDoc = {
  version: 2,
  canvasColor: "white",
  defaultWireColor: "black",
  nodes: [
    { id: "r1", symbol: "resistor", x: 10, y: 10, rotation: 0, reference: "R1", value: "10k", footprint: "res_dip_762", footprintAssignment: { source: "cirzuit", identifier: "res_dip_762", status: "resolved" } },
    { id: "r2", symbol: "resistor", x: 20, y: 10, rotation: 0, reference: "R2", value: "1k", footprint: "res_dip_762", footprintAssignment: { source: "cirzuit", identifier: "res_dip_762", status: "resolved" } },
  ],
  wires: [
    { id: "w1", points: [{ x: 14, y: 10.5 }, { x: 16, y: 10.5 }], color: "black" },
  ],
};

describe("V8.3+ Schematic ↔ PCB integration", () => {
  it("creates deterministic schematic net identities", () => {
    const a = buildNetIndex(schematic);
    const b = buildNetIndex(schematic);
    expect(a.nets.map(n => n.key)).toEqual(b.nets.map(n => n.key));
    expect(a.nets.every(n => /^N\d+$/.test(n.name))).toBe(true);
  });

  it("transfers component footprints and electrical net metadata", () => {
    const pcb = syncPcbWithSchematic(schematic, emptyPcbDoc());
    expect(pcb.footprints).toHaveLength(2);
    expect(pcb.nets?.length).toBeGreaterThan(0);
    expect(pcb.sync?.componentCount).toBe(2);
    expect(pcb.footprints.flatMap(fp => fp.pads).some(p => p.netId !== undefined)).toBe(true);
  });

  it("validates a synchronized design", () => {
    const pcb = syncPcbWithSchematic(schematic, emptyPcbDoc());
    const validation = validateSchematicPcbLink(schematic, pcb);
    expect(validation.components).toBe(2);
    expect(validation.linkedComponents).toBe(2);
    expect(validation.nets).toBeGreaterThan(0);
  });

  it("builds PCB net members using pin ↔ pad mapping", () => {
    const pcb = syncPcbWithSchematic(schematic, emptyPcbDoc());
    const registry = buildPcbNetRegistry(schematic, pcb.footprints);
    expect(registry.nets.every(n => n.members.every(m => m.padIndex !== undefined))).toBe(true);
  });

  it("automatically estimates component type and generates native KiCad footprint when no footprint is assigned", () => {
    const unassignedSchematic: SchematicDoc = {
      version: 2,
      canvasColor: "white",
      defaultWireColor: "black",
      nodes: [
        { id: "c1", symbol: "capacitor", x: 10, y: 10, rotation: 0, reference: "C1", value: "100nF" },
        { id: "u1", symbol: "ic_dip8", x: 30, y: 10, rotation: 0, reference: "U1", value: "NE555" },
        { id: "d1", symbol: "led", x: 50, y: 10, rotation: 0, reference: "D1", value: "RED" },
      ],
      wires: [],
    };

    const pcb = syncPcbWithSchematic(unassignedSchematic, emptyPcbDoc());
    expect(pcb.footprints).toHaveLength(3);

    for (const fp of pcb.footprints) {
      expect(fp.nativeKicadFootprint).toBeDefined();
      expect(fp.pads.length).toBeGreaterThanOrEqual(2);
      expect(fp.source).toBe("generator");
      expect(fp.footprint?.startsWith("Generator:")).toBe(true);
    }

    const c1Fp = pcb.footprints.find(f => f.id === "c1");
    expect(c1Fp?.pads).toHaveLength(2);

    const u1Fp = pcb.footprints.find(f => f.id === "u1");
    expect(u1Fp?.pads).toHaveLength(8);
  });
});
