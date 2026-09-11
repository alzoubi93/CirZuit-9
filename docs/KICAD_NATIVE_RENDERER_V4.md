# KiCad Native Renderer V4

V4 is a rendering-focused continuation of the CirZuit KiCad Symbol Environment.

## Guarantees

- KiCad library geometry remains in millimetres until the rendering boundary.
- The coordinate conversion is centralized in `kicadCoordinateSystem.ts`.
- The native renderer consumes `KiCadParsedSymbol` directly.
- `SymbolDef` is not used for native geometry calculation; it is retained only as a compatibility adapter for the legacy CirZuit placement pipeline.
- Unit 0 common geometry and the selected electrical unit are resolved together.
- Pin `at` is the electrical connection point and pin `length` extends along the KiCad pin angle.
- Pin numbers and names are positioned in the pin's local coordinate frame rather than both being placed at the midpoint.
- Arc rendering follows the three-point arc through its midpoint rather than choosing an arbitrary complementary arc.
- Bezier paths support multiple cubic segments.
- Unsupported primitives must be reported by the diagnostics layer instead of silently being converted to invented geometry.

## Remaining integration rule

Any new KiCad primitive should first be added to the native object model and renderer. Do not add per-symbol special cases.
