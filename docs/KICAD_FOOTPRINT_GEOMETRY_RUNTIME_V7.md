# CirZuit V7 — KiCad Footprint Geometry Runtime

## Goal

V7 moves footprint geometry out of the React renderer and into a dedicated KiCad-compatible geometry layer. The application now follows:

```text
KicadFootprintRuntime
  ├─ KicadPad
  ├─ KicadShape
  ├─ KicadArc
  ├─ KicadPolygon
  ├─ KicadCurve
  ├─ KicadText
  └─ KicadTransform
          ↓
   KicadGeometryEngine
          ↓
   KicadFootprintRenderer
```

The `.kicad_mod` reader remains an internal loader. Renderer code does not parse S-expressions and does not reconstruct KiCad geometry from file tokens.

## KiCad source references used as behavioral references

- `pcbnew/footprint.h`: KiCad's `FOOTPRINT` owns pads, graphical items, 3D drawings, layer/transform-related state and other footprint properties.
- `pcbnew/pad.h`: KiCad `PAD` owns position, size, orientation, offset, delta/trapezoid geometry, custom pad primitives and pad-stack data.
- `pcbnew/pcb_painter.cpp` and `pcbnew/pcb_shape.cpp`: KiCad uses the `SHAPE_ARC` / start-mid-end representation for PCB arcs and feeds those shapes to the renderer.
- `pcbnew/plot_brditems_plotter.cpp`: the trapezoid pad construction used by V7 follows KiCad's local-coordinate delta construction.
- `pcbnew/board_items_to_polygon_shape_transform.cpp`: KiCad converts arcs/segments/shapes into polygonal geometry when a polygon approximation is required.

V7 is an independent TypeScript implementation of those semantics; it does not copy KiCad C++ source.

## Geometry rules implemented

### Coordinates

Footprint-library geometry remains in KiCad's millimetre coordinate space. Parent-footprint transforms are applied only at the geometry boundary.

### Footprint transform

The runtime applies:

1. local geometry
2. optional pad-local rotation/offset
3. footprint scale
4. footprint flip
5. footprint rotation
6. footprint translation

### Arcs

KiCad's PCB geometry uses start/mid/end points. V7 calculates the circumcenter and the signed sweep passing through the midpoint. This prevents arcs from being silently reduced to straight lines.

### Oval pads

An oval pad is rendered as a capsule (two semicircular ends plus a straight section), not as an ellipse. Equal X/Y dimensions naturally reduce to a circle.

### Trapezoid pads

The local polygon follows KiCad's delta construction:

```text
(-dx - ddy,  dy + ddx)
( dx + ddy,  dy - ddx)
( dx - ddy, -dy + ddx)
(-dx + ddy, -dy - ddx)
```

where `dx=size.x/2`, `dy=size.y/2`, `ddx=delta.x/2`, and `ddy=delta.y/2`.

### Pad offset

KiCad defines pad offset as the offset from the hole/anchor position to the center of the copper pad shape. V7 therefore keeps the drill at `PAD.position` and moves the copper shape by the rotated offset.

### Curves

Four control points are emitted as a cubic Bézier curve, matching KiCad's `fp_curve`/`gr_curve` representation. Three points are handled as quadratic geometry for robustness.

### Text

Text position, rotation, justification, mirror, size, thickness, bold/italic and special reference/value tokens are preserved at the geometry boundary.

## Renderer contract

`KicadFootprintRenderer` consumes `KicadGeometryItem[]` produced by `KicadGeometryEngine`. It does not interpret KiCad S-expressions and it does not contain footprint-specific shape heuristics.

The same runtime geometry can therefore be reused by:

- footprint browser preview
- PCB placement
- PCB selection/hit testing (future V8/V9 work)
- export/plotting (future work)
- 3D association (future work)

## Important scope boundary

V7 does not claim complete KiCad feature parity yet. In particular, the next geometry work should cover the complete custom-pad primitive set, chamfered/rounded pad corner semantics, per-layer pad-stack overrides, exact text-box stroke/fill behavior, and robust hit-testing. Those features must be added to the geometry runtime rather than to the React renderer.
