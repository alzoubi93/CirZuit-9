# CirZuit KiCad Footprint Environment V6

## Goal

V6 changes the Footprint architecture from a file-conversion boundary into a
KiCad-style runtime/object environment, matching the architectural approach
already used by the CirZuit KiCad Symbol Environment.

The `.kicad_mod` S-expression reader is now an internal file-loading detail.
Application code resolves and manipulates `KicadFootprintRuntime` objects,
`KicadPadRuntime` objects and KiCad-style graphics rather than depending on a
standalone parser API.

## KiCad reference model

The design was checked against the official KiCad source tree, especially:

- `pcbnew/footprint.h` — FOOTPRINT object/container and transform behavior.
- `pcbnew/pad.h` — PAD object, pad types/layers and connected-item semantics.
- KiCad footprint file-format documentation for `.kicad_mod`.

KiCad's current master has moved Footprint placement toward a TRS-style
transform (translation, rotation and scale). CirZuit V6 therefore exposes the
same conceptual transform boundary rather than baking transforms into every
child primitive.

## Runtime boundary

```text
Official .kicad_mod / local footprint / generator
                    |
                    v
          KiCad Footprint Environment
                    |
          +---------+---------+
          |                   |
      Footprint             Pads
      Runtime              Runtime
          |                   |
          +---------+---------+
                    |
                    v
             Native Renderer
              /           \
          Preview        PCB Editor
```

## Main files

- `src/lib/kicad/footprint/kicadFootprint.ts`
  - Existing KiCad data model and official-library transport.
  - The file reader remains an implementation detail.
- `src/lib/kicad/footprint/kicadFootprintRuntime.ts`
  - Native runtime object model.
  - Footprint transform.
  - Pad runtime.
  - Object resolution.
- `src/lib/kicad/footprint/kicadFootprintKernel.ts`
  - Application-level runtime service, analogous to `KiCadSymbolRuntime`.
- `src/lib/kicad/footprint/index.ts`
  - Public environment exports.
- `src/components/editor/KicadFootprintRenderer.tsx`
  - Consumes the runtime/model boundary and applies the runtime transform.

## Important boundary

Do not add application features that call `parseKicadFootprint()` directly.
New features should call:

```ts
kicadFootprintRuntime.loadText(...)
kicadFootprintRuntime.register(...)
kicadFootprintRuntime.resolve(...)
```

For official libraries, use `kicadFootprintLibrary` to acquire the definition
and then register the result in `kicadFootprintRuntime`.

## License / provenance

KiCad source is predominantly GPLv3-or-later, while the official KiCad
Footprint Library is CC-BY-SA 4.0 with its library-specific exception.
V6 does not copy KiCad C++ source into CirZuit; it implements the runtime
concepts independently and records the official sources used as behavioral
references.
