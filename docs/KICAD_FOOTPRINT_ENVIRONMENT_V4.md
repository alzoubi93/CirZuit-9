# KiCad Footprint Environment V4

## Goals

V4 makes the Footprint Browser mobile-first and strengthens the native `.kicad_mod` model/renderer.

### Browser UX

- Full-screen layout on phones.
- Library list is the first screen.
- Tapping a library opens a dedicated footprint list screen.
- Tapping a footprint opens a dedicated preview/details screen.
- Back navigation works between the three screens.
- Import & Place and Generate New Footprint are actions on the footprint details screen.
- Desktop keeps the same flow inside a responsive dialog.

### Native KiCad footprint support

The model now preserves/handles more KiCad semantics:

- `fp_curve` cubic Bézier geometry.
- `fp_text_box` start/end/effects information.
- `yes/no` fill semantics.
- footprint attributes and UUID.
- footprint clearance/mask/paste/zone/thermal metadata.
- pad rotation, locked state, pad properties.
- oval and roundrect pad shape metadata.
- custom-pad graphic primitives where available.
- 3D model XYZ information is preserved in the native model for the later 3D phase.

The renderer uses the same native model for browser preview and PCB placement. Curves, arcs, filled graphics, text effects, and more accurate pad shapes are rendered instead of being replaced by generic component outlines.

## Architectural rule

Symbol import and Footprint import remain independent. Importing a KiCad Symbol never downloads or assigns a Footprint automatically.

## Reference

KiCad's official Footprint Library:

https://gitlab.com/kicad/libraries/kicad-footprints

KiCad Footprint Library File Format:

https://dev-docs.kicad.org/en/file-formats/sexpr-footprint/
