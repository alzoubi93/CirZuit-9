# CirZuit KiCad Symbol Environment v2

This release moves KiCad symbol support from a simple conversion path toward a runtime symbol model.

## Runtime layers

1. **KiCad file boundary** — reads the KiCad S-expression format.
2. **KiCad object model** — preserves symbol properties, units, body styles, pins, graphics, text effects, power flags and inheritance.
3. **Unit/body-style resolver** — combines common unit `0` graphics with the requested unit/style without destroying the source model.
4. **KiCad renderer** — renders pin geometry, pin names/numbers, pin graphic annotations, symbol graphics and properties from the KiCad model.
5. **CirZuit compatibility adapter** — exposes the existing `SymbolDef` interface so the rest of CirZuit can place and connect symbols without rewriting the whole editor at once.

## Important KiCad behavior implemented

- Pin `at` is the electrical connection point.
- Pin length extends from the connection point toward the symbol body according to the pin angle.
- Pin name/number placement follows KiCad's default outside-pin layout: horizontal pins use name-above/number-below; vertical pins use name-left/number-right.
- `hide` is recognized both as an atom and as a `(hide yes)` node.
- Common unit `0` and selected unit are composed at render time.
- Alternate body styles are preserved.
- Derived symbols using `extends` inherit base geometry/metadata when available.
- Current KiCad `*.kicad_symdir` libraries are supported in addition to legacy monolithic `.kicad_sym` files.
- Import diagnostics report unsupported primitives instead of silently hiding them.

## KiCad references

The implementation follows the documented KiCad symbol-library model and the structure used by `LIB_SYMBOL`, `SCH_PIN`, and KiCad's schematic pin renderer. It does not copy KiCad C++ source code into CirZuit.
