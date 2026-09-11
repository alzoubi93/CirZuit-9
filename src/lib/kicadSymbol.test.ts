import { describe, expect, it } from "vitest";
import {
  createKicadSymbolEnvironment,
  kicadToSymbolDef,
  parseKiCadSymbolLib,
} from "./kicadSymbol";

const FOUR_XXX = `
(kicad_symbol_lib (version 20231120) (generator kicad_symbol_editor)
  (symbol "4002"
    (property "Reference" "U" (at 0 10 0) (effects (font (size 1.27 1.27))))
    (property "Value" "4002" (at 0 8 0) (effects (font (size 1.27 1.27))))
    (symbol "4002_0_1"
      (rectangle (start -5.08 5.08) (end 5.08 -5.08)
        (stroke (width 0.1) (type default))
        (fill (type background)))
    )
    (symbol "4002_1_1"
      (pin input line (at -12.7 2.54 0) (length 7.62)
        (name "A" (effects (font (size 1.27 1.27))))
        (number "2" (effects (font (size 1.27 1.27)))))
      (pin output line (at 12.7 0 180) (length 7.62)
        (name "Y" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27)))))
    )
  )
)
`;

describe("KiCad Symbol Environment", () => {
  it("keeps the KiCad pin connection point at `at` and extends the body inward", () => {
    const symbols = parseKiCadSymbolLib(FOUR_XXX, "4xxx");
    expect(symbols).toHaveLength(1);

    const symbol = symbols[0];
    expect(symbol.pins[0].at).toEqual({ x: -12.7, y: 2.54, angle: 0 });
    expect(symbol.pins[0].length).toBeCloseTo(7.62);

    const def = kicadToSymbolDef(symbol);
    // The normalized pin coordinate must represent -12.7 (connection point),
    // not -20.32 (the old, reversed endpoint calculation).
    const minX = symbol.bbox.minX;
    expect(def.pins[0].x).toBeCloseTo((-12.7 - minX) / 2.54, 5);

    const env = createKicadSymbolEnvironment(symbols);
    expect(env.resolve("4002", "4xxx")?.name).toBe("4002");
  });

  it("preserves units and text effects instead of flattening them", () => {
    const symbol = parseKiCadSymbolLib(FOUR_XXX)[0];
    expect(symbol.units).toHaveLength(2);
    expect(symbol.properties.find(p => p.name === "Reference")?.effects.font.size.x)
      .toBeCloseTo(1.27);
    expect(symbol.pins[0].nameEffects.font.size.y).toBeCloseTo(1.27);
    expect(symbol.pins[0].numberEffects.font.size.x).toBeCloseTo(1.27);
  });
});

const CURRENT_STYLE = `
(kicad_symbol_lib (version 20251024) (generator "kicad_symbol_editor") (generator_version "10.0")
  (symbol "+5VL"
    (power)
    (pin_numbers (hide yes))
    (pin_names (offset 0) (hide yes))
    (exclude_from_sim no) (in_bom yes) (on_board yes)
    (property "Reference" "#PWR" (at 0 -3.81 0)
      (effects (font (size 1.27 1.27)) hide))
    (property "Value" "+5VL" (at 0 -2.54 0)
      (effects (font (size 1.27 1.27))))
    (symbol "+5VL_0_1"
      (polyline (pts (xy 0 0) (xy 0 -2.54))
        (stroke (width 0) (type default)) (fill (type none))))
    (symbol "+5VL_1_1"
      (pin power_in line (at 0 0 90) (length 0) hide
        (name "+5VL" (effects (font (size 1.27 1.27))))
        (number "1" (effects (font (size 1.27 1.27))))))
  )
)
`;

describe("KiCad current-format visibility flags", () => {
  it("recognizes hide atoms/nodes used by current KiCad libraries", () => {
    const symbol = parseKiCadSymbolLib(CURRENT_STYLE, "power")[0];
    expect(symbol.pinNamesHide).toBe(true);
    expect(symbol.pinNumbersHide).toBe(true);
    expect(symbol.properties.find(p => p.name === "Reference")?.hide).toBe(true);
    expect(symbol.isPower).toBe(true);
    expect(symbol.pins[0].hide).toBe(true);
  });
});
