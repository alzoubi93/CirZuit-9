# CirZuit — V7 Release Notes

V7 is the geometry-runtime stage of the KiCad Footprint Environment.

### Architectural change

Before V7:

```text
KiCad .kicad_mod
  -> internal reader
  -> native model
  -> renderer interprets model geometry
```

V7:

```text
KiCad .kicad_mod
  -> internal reader
  -> KicadFootprintModel
  -> KicadFootprintRuntime
  -> KicadGeometryEngine
  -> renderer
```

The React renderer no longer contains KiCad footprint geometry algorithms.

### New runtime layer

```text
src/lib/kicad/footprint/
├── geometry/
│   ├── types.ts
│   ├── engine.ts
│   └── index.ts
├── kicadFootprint.ts
├── kicadFootprintReader.ts
├── kicadFootprintRuntime.ts
└── kicadFootprintKernel.ts
```

### V7 geometry support

- line
- rectangle
- rounded rectangle
- circle
- start/mid/end arc
- polygon
- cubic Bézier curve
- text
- text boxes
- oval/capsule pads
- circular pads
- rectangular pads
- trapezoid pads using KiCad delta semantics
- roundrect/chamfered pad semantics (polygonal approximation for selected chamfers)
- custom pad primitives
- drill holes, including oval drills
- pad rotation
- pad offset
- footprint translation/rotation/scale/flip
- geometry bounds

### Important design rule

Do not add new KiCad geometry behavior to `KicadFootprintRenderer.tsx`.
New geometry must be represented in the runtime/model and implemented by
`KicadGeometryEngine`, then rendered generically.
