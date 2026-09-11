# CirZuit V8 Release Notes

## V8 objective

Promote KiCad footprints from "parsed shapes" to a KiCad-like runtime object model with a shared geometry engine and a native PCB bridge.

## Implemented

- Complete custom-pad primitive flow.
- Semantic roundrect and chamfered-rectangle geometry.
- Layer-resolved padstack runtime with normalized per-layer overrides.
- Exact four-point `fp_text_box` retention and rendering.
- Geometry hit testing.
- Geometry rectangle selection.
- Geometry-level renderer events and stable geometry IDs.
- Native KiCad renderer is now used by the PCB editor for imported KiCad footprints.
- Pad selection no longer depends on a generic rectangular overlay for native KiCad footprints.
- `KicadPcbNativeObject` bridge for board-side placement/rotation/flip/synchronization.
- Structural validation profiles for DIP, SOIC and the CP_Axial reference footprint.

## Validation

- TypeScript project check: PASS (`tsc --noEmit`).
- Syntax/transpile checks of all V8-modified TypeScript/TSX files: PASS.
- Vitest suite: NOT RUN in the build environment because the supplied project archive has no installed `node_modules`/Vitest binary.

## Non-goals of V8

V8 does not claim full pcbnew parity. Advanced DRC, zone fill, exact custom-pad boolean clearance, full font engine parity, and all board-level padstack modes remain later work.
