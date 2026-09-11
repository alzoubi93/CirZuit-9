# CirZuit V8 — KiCad Footprint Geometry Runtime

## Goal

V8 moves CirZuit further away from a "parse then draw" architecture. The public application model is now a KiCad-like footprint runtime with a dedicated geometry engine and a PCB-native object bridge.

```text
.kicad_mod / board footprint data
              |
              v
      KicadFootprintRuntime
              |
      +-------+--------+
      |                |
  KicadPad        Kicad graphics
      |
 KicadPadstackRuntime
      |
      +-----------------------------+
                                    |
                         KicadGeometryEngine
                                    |
          +-------------------------+----------------------+
          |                         |                      |
       Renderer                Hit Testing           Selection
          |                         |                      |
          +-------------------------+----------------------+
                                    |
                         KicadPcbNativeObject
                                    |
                              PcbFootprint
```

The reader remains an internal file-loading boundary. The application does not operate on parser nodes.

## V8 changes

### Complete custom-pad geometry

Custom pads now keep their primitive list as native geometry. Supported primitives flow through the same geometry engine as ordinary footprint graphics:

- lines
- rectangles
- circles
- arcs
- polygons
- curves
- text/text-box annotations when present

The pad layer is supplied by the padstack rather than being inferred from a custom primitive's layer token.

### Exact roundrect/chamfer representation

V7 approximated some pad corners with a polygon. V8 introduces semantic geometry primitives:

- `GeoRoundRect`
- `GeoChamferRect`

The SVG renderer generates rounded/corner-cut paths from these primitives instead of replacing them with a generic rectangle. This preserves corner intent and keeps hit testing tied to the same semantic object.

### Per-layer padstack resolution

`KicadPadstackRuntime` resolves effective pad geometry for a concrete layer. Normal KiCad library footprints commonly share one pad geometry across their listed layers; V8 also accepts normalized layer-specific overrides for board-native padstacks.

The runtime understands:

- layer list / wildcards
- shape
- size
- rotation
- offset
- roundrect ratio
- chamfer ratio/corners
- trapezoid delta
- custom primitives
- clearance mode

### Exact text-box geometry

`fp_text_box` now retains its four `pts` when present. Cardinal text boxes can use `start/end`; non-cardinal boxes use the four-point polygon. The renderer draws the actual box outline/fill instead of treating a text box as ordinary text.

### Hit testing and selection

The geometry engine now exposes:

- `hitTestPoint`
- `selectAtPoint`
- `selectInRect`

The runtime exposes:

- `HitTest`
- `SelectGeometryAt`
- `SelectGeometryInRect`

The renderer can emit geometry IDs and geometry-level pointer callbacks, so PCB pad selection no longer depends on a coarse rectangular overlay.

### KiCad Footprint ↔ PCB native object

`KicadPcbNativeObject` binds the KiCad footprint runtime to the existing CirZuit `PcbFootprint` record. The native footprint remains authoritative for geometry; the PCB document owns board placement/connectivity state.

The binding supports:

- placement
- rotation
- flip state
- geometry access
- hit testing
- geometry selection
- board-record synchronization

## Official KiCad reference

V8 behavior was checked against the KiCad source concepts for `FOOTPRINT`, `PAD`, `PADSTACK`, and the official footprint S-expression specification.

- KiCad source: `pcbnew/footprint.h`
- KiCad source: `pcbnew/pad.h`
- KiCad source: `pcbnew/padstack.h`
- KiCad developer documentation: Footprint Library File Format
- KiCad developer documentation: S-Expression / Board Common Syntax

The official footprint library remains:

`https://gitlab.com/kicad/libraries/kicad-footprints.git`

## Validation families

The validation layer contains structural profiles for representative official-library families:

- `Package_DIP:DIP-8_W7.62mm`
- `Package_SO:SOIC-8_3.9x4.9mm_P1.27mm`
- `Capacitor_THT:CP_Axial_L11.0mm_D6.0mm_P18.00mm_Horizontal`

The CP Axial profile specifically verifies pad 1 at `(0,0)` and pad 2 at `(18,0)`, because this is the footprint that exposed the original V4/V5 rendering failure.

## Important scope statement

V8 is not claimed to be a complete clone of pcbnew. It establishes the correct object/geometry boundaries and implements the important footprint geometry paths needed for the official library. Advanced KiCad behavior still needs incremental validation, especially custom-pad boolean/clearance behavior, padstack layer modes, DRC/zone semantics, font rendering, and board-level rules.
