import { describe, expect, it } from "vitest";
import { kicadFootprintRuntime } from "./kicadFootprintKernel";

describe("KiCad native footprint environment", () => {
  it("preserves real footprint primitives and pad semantics", () => {
    const text = `(footprint "Test:TEST" (version 20240108) (generator pcbnew)
      (layer "F.Cu")
      (fp_rect (start -2 -1) (end 2 1) (stroke (width 0.2)) (fill yes) (layer "F.SilkS"))
      (fp_arc (start 2 0) (mid 2.5 0.5) (end 2 1) (stroke (width 0.2)) (layer "F.SilkS"))
      (fp_curve (pts (xy 0 0) (xy 1 0) (xy 1 1) (xy 2 1)) (stroke (width 0.1)) (layer "F.Fab"))
      (fp_text reference "REF**" (at 0 -2) (layer "F.SilkS") (effects (font (size 1 1) (thickness 0.15))))
      (pad "1" smd roundrect (at 0 0 90) (size 1.5 1) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.2))
      (pad "2" thru_hole oval (at 3 0) (size 2 1.5) (drill oval 1 0.8) (layers "*.Cu" "*.Mask"))
    )`;
    const fp = kicadFootprintRuntime.loadText(text);
    expect(fp.fullName).toBe("Test:TEST");
    expect(fp.graphics.some(g => g.kind === "rect" && g.fill === "solid")).toBe(true);
    expect(fp.graphics.some(g => g.kind === "arc")).toBe(true);
    expect(fp.graphics.some(g => g.kind === "curve")).toBe(true);
    expect(fp.pads[0].shape).toBe("roundrect");
    expect(fp.pads[0].rotation).toBe(90);
    expect(fp.pads[1].shape).toBe("oval");
    expect(fp.pads[1].drill).toBeUndefined();
    expect(fp.pads[1].drillX).toBe(1);
    expect(fp.pads[1].drillY).toBe(0.8);
    const line = fp.graphics.find(g => g.kind === "rect") as any;
    expect(line.start.x).toBe(-2);
    expect(line.start.y).toBe(-1);
  });
});
