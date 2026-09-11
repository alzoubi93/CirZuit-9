import { describe, expect, it } from "vitest";
import { resolveKicadDisplayLayer, isCopperLayer, isInnerLayer, isTopLayer, isBottomLayer } from "./kicadLayerAdapter";

describe("KiCad -> CirZuit layer presentation", () => {
  it("keeps wildcard copper on the active CirZuit side", () => {
    expect(resolveKicadDisplayLayer("*.Cu", "top_copper")).toBe("top_copper");
    expect(resolveKicadDisplayLayer("*.Cu", "bottom_copper")).toBe("bottom_copper");
  });

  it("maps explicit KiCad layers without changing their semantic identity", () => {
    expect(resolveKicadDisplayLayer("F.Cu", "top_copper")).toBe("top_copper");
    expect(resolveKicadDisplayLayer("B.Cu", "top_copper")).toBe("bottom_copper");
    expect(resolveKicadDisplayLayer("F.CrtYd", "top_copper")).toBe("top_courtyard");
    expect(resolveKicadDisplayLayer("B.Fab", "top_copper")).toBe("bottom_fab");
  });

  it("preserves inner copper layers as distinct layer identities", () => {
    expect(resolveKicadDisplayLayer("In1.Cu", "top_copper")).toBe("In1.Cu");
    expect(resolveKicadDisplayLayer("In2.Cu", "top_copper")).toBe("In2.Cu");
    expect(resolveKicadDisplayLayer("In30.Cu", "bottom_copper")).toBe("In30.Cu");
  });

  it("accurately detects copper layer categories", () => {
    expect(isCopperLayer("F.Cu")).toBe(true);
    expect(isCopperLayer("B.Cu")).toBe(true);
    expect(isCopperLayer("In1.Cu")).toBe(true);
    expect(isCopperLayer("In14.Cu")).toBe(true);
    expect(isCopperLayer("In30.Cu")).toBe(true);
    expect(isCopperLayer("top_copper")).toBe(true);
    expect(isCopperLayer("bottom_copper")).toBe(true);
    expect(isCopperLayer("F.SilkS")).toBe(false);
    expect(isCopperLayer("Edge.Cuts")).toBe(false);

    expect(isInnerLayer("In1.Cu")).toBe(true);
    expect(isInnerLayer("In15.Cu")).toBe(true);
    expect(isInnerLayer("F.Cu")).toBe(false);
    expect(isInnerLayer("B.Cu")).toBe(false);

    expect(isTopLayer("F.Cu")).toBe(true);
    expect(isTopLayer("F.SilkS")).toBe(true);
    expect(isTopLayer("top_copper")).toBe(true);
    expect(isTopLayer("In1.Cu")).toBe(false);

    expect(isBottomLayer("B.Cu")).toBe(true);
    expect(isBottomLayer("B.Mask")).toBe(true);
    expect(isBottomLayer("bottom_copper")).toBe(true);
    expect(isBottomLayer("In1.Cu")).toBe(false);
  });
});

