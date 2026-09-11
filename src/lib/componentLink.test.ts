import { describe, expect, it } from "vitest";
import { buildPinPadLinks, applyPinPadMapping } from "./componentLink";
import { registerKiCadSymbol } from "./kicadSymbol";
import type { SchematicNode } from "./schematic";
import type { PcbFootprint } from "./pcb";

const testSymbolId = "kicad:component-link-test";

registerKiCadSymbol({
  id: testSymbolId,
  category: "ic",
  width: 1,
  height: 1,
  pins: [
    { x: 0, y: 0, number: "1", name: "A" },
    { x: 0, y: 1, number: "2", name: "B" },
    { x: 0, y: 2, number: "3", name: "C" },
  ],
  prefix: "U",
  defaultValue: "TEST",
  draw: () => null as any,
});

const node: SchematicNode = {
  id: "component-1",
  symbol: testSymbolId,
  x: 0,
  y: 0,
  rotation: 0,
  reference: "U1",
  value: "TEST",
};

const footprint: PcbFootprint = {
  id: "component-1",
  reference: "U1",
  value: "TEST",
  symbol: testSymbolId,
  x: 0,
  y: 0,
  rotation: 0,
  pads: [
    { id: "p3", pinIndex: 0, number: "3", x: 2, y: 0, width: 1, height: 1, shape: "circle", layer: "multi_layer" },
    { id: "p1", pinIndex: 1, number: "1", x: 0, y: 0, width: 1, height: 1, shape: "circle", layer: "multi_layer" },
    { id: "p2", pinIndex: 2, number: "2", x: 1, y: 0, width: 1, height: 1, shape: "circle", layer: "multi_layer" },
  ],
};

describe("component link pin ↔ pad mapping", () => {
  it("matches pads by logical number instead of array order", () => {
    const result = buildPinPadLinks(node, footprint);
    expect(result.missingSymbolPins).toEqual([]);
    expect(result.duplicatePads).toEqual([]);
    expect(result.links.map(x => x.padNumber)).toEqual(["1", "2", "3"]);

    const mapped = applyPinPadMapping(node, footprint);
    expect(mapped.pads.map(p => p.pinIndex)).toEqual([2, 0, 1]);
  });
});
