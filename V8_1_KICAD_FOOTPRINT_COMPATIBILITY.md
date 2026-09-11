# CirZuit V8.1 — KiCad Footprint Compatibility Foundation

V8.1 restarts footprint rendering from the V8 baseline. The goal is not to redraw KiCad footprints using CirZuit heuristics. KiCad-origin footprints remain native KiCad semantic objects and are rendered through the KiCad Footprint Runtime.

## Architectural rule

```text
Official KiCad .kicad_mod
        |
        v
KiCad Footprint Environment
        |
        +-- Footprint
        +-- Pad / Padstack
        +-- Graphics
        +-- Text
        +-- Layers
        +-- 3D model references
        +-- Geometry / transforms
        |
        v
CirZuit Layer Presentation Adapter
        |
        v
CirZuit PCB Renderer
```

The reader is an input boundary. The PCB editor never reconstructs an imported KiCad footprint from the component name, package name, pad count, or hand-drawn heuristics.

## V8.1 changes

1. **Native KiCad rendering is now the actual PCB-editor path.** Imported footprints carrying `nativeKicadFootprint` bypass the legacy CirZuit package-shape renderer.
2. **Native footprint pads are no longer duplicated by the canvas pad layer.** The KiCad renderer owns their display and hit testing.
3. **KiCad wildcard copper layers are side-aware.** `*.Cu` resolves to CirZuit `top_copper` by default and to `bottom_copper` when the user explicitly selects `bottom_copper`.
4. **Explicit KiCad layers remain semantically distinct.** `F.Cu`, `B.Cu`, `F.SilkS`, `B.SilkS`, `F.Mask`, `B.Mask`, `F.Paste`, `B.Paste`, `F.CrtYd`, `B.CrtYd`, `F.Fab`, and `B.Fab` are not rewritten in the native model.
5. **Mask/Paste geometry does not paint over copper in the normal copper editing view.** It remains available through the layer presentation policy.
6. **Courtyard/Fab are rendered from the native geometry with no artificial 0.68 opacity.** If a footprint has no courtyard geometry, CirZuit does not invent one.
7. **Native bounding boxes use the Geometry Runtime.** Pad-only and component-name estimates are not used for KiCad-origin footprints.
8. **The CirZuit native footprint path is unchanged.** Only footprints with `nativeKicadFootprint` enter the KiCad path.
9. **Pad numbers are editor overlays.** They are not inserted into the KiCad footprint geometry model.
10. **Physical units remain millimetres.** No V8.1 scale multiplier is introduced.

## Reference footprint

The primary regression target is:

`Capacitor_THT:CP_Axial_L11.0mm_D6.0mm_P18.00mm_Horizontal`

The official repository contains this footprint in `Capacitor_THT.pretty`. The official KiCad footprint repository currently states that its main branch is intended for KiCad 10; version-specific commits exist for older KiCad releases. CirZuit must preserve the source version/commit metadata instead of silently converting it.

## Non-regression rule

Changes to the KiCad environment must not alter `PcbFootprint` objects that do not contain `nativeKicadFootprint`.

## What is deliberately not claimed

V8.1 does not claim byte-for-byte parity with KiCad's C++ renderer. The objective is semantic/geometry parity of imported footprint data and transforms, with CirZuit's own presentation palette and editor interaction layer.
