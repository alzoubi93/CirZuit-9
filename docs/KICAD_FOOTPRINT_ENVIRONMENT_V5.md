# CirZuit — KiCad Footprint Environment V5

## Critical renderer/parser correction

V4 exposed a fundamental S-expression indexing bug. KiCad S-expression nodes contain their keyword as item 0, so coordinate/value vectors must start at item 1. The previous implementation accidentally interpreted the keyword (`start`, `at`, `layers`, `drill`, etc.) as numeric data. This caused imported footprints to collapse into incorrect lines/text and caused pad positions/layers to be wrong.

V5 fixes this at the native model boundary.

### Fixed

- `start/end/center/xy/at/xyz` coordinates now skip the S-expression keyword.
- pad number/type/shape parsing corrected.
- pad layers corrected.
- round/oval drill parsing corrected.
- net fields corrected.
- footprint attributes/properties corrected.
- legacy `width` stroke syntax supported.
- `gr_*` primitives are accepted for custom pad geometry.
- text role (`reference`, `value`, `user`) preserved.
- `${REFERENCE}`, `%R`, `${VALUE}`, `%V` substitutions supported by the renderer.

## Native renderer

Imported `.kicad_mod` footprints are now rendered directly from `KicadFootprintModel` in both:

- Footprint Browser Preview
- PCB Editor

The previous component-name heuristic renderer is no longer used for imported KiCad footprints.

Flow:

`.kicad_mod -> S-expression model -> Native KiCad Footprint Model -> Native Renderer -> Preview / PCB`

This keeps the real KiCad geometry instead of inventing a capacitor/diode/IC shape from the symbol name.

## Geometry supported by the renderer

- lines
- rectangles
- circles
- arcs (three-point arcs and center-based fallback)
- polygons
- Bezier curves
- footprint text
- text placeholders
- circle/oval/roundrect/rect/trapezoid pads
- custom pad primitives
- round and oval drills
- pad rotation

## Official source

The authoritative library remains:

https://gitlab.com/kicad/libraries/kicad-footprints.git

No footprint is imported automatically as part of Symbol import.
