import { describe, expect, it } from "vitest";
import { emptyDoc } from "./schematic";
import { buildNetIndex } from "./netlist";
import { buildPhysicalComponentGroups, applyPhysicalUnitAliases } from "./componentLink";
import { emptyPcbDoc } from "./pcb";
import { runDesignChecks } from "./designRules";

const node = (id: string, unit?: number, unitGroupId?: string) => ({
  id, symbol: "resistor", x: 0, y: 0, rotation: 0 as const, reference: "U1", value: "X", unit, unitGroupId,
});

describe("V8.5 integration", () => {
  it("builds an empty net index for a brand-new schematic", () => {
    const idx = buildNetIndex(emptyDoc());
    expect(idx.nets).toEqual([]);
    expect(idx.labelNet).toBeInstanceOf(Map);
    expect(idx.labelNet.size).toBe(0);
  });

  it("consolidates multi-unit nodes into one physical group", () => {
    const groups = buildPhysicalComponentGroups([node("a", 1, "g"), node("b", 2, "g")]);
    expect(groups).toHaveLength(1);
    expect(groups[0].owner.id).toBe("a");
    expect(groups[0].units).toHaveLength(2);
  });

  it("names a connected net from a schematic label", () => {
    const doc = emptyDoc();
    doc.nodes = [node("r1")];
    doc.wires = [{ id: "w1", points: [{ x: 0, y: 1 }, { x: 2, y: 1 }], color: "black" }];
    doc.netLabels = [{ id: "l1", text: "VCC", x: 1, y: 1, scope: "local" }];
    const idx = buildNetIndex(doc);
    expect(idx.nets.some(n => n.name === "VCC")).toBe(true);
  });

  it("runs ERC/DRC without throwing on an empty project", () => {
    const result = runDesignChecks(emptyDoc(), emptyPcbDoc());
    expect(Array.isArray(result.erc)).toBe(true);
    expect(Array.isArray(result.drc)).toBe(true);
  });
});
