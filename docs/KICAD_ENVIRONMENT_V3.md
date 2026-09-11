# CirZuit KiCad Symbol Environment v3

This release moves KiCad symbol rendering behind a native KiCad renderer boundary.

## Architecture

```text
.kicad_sym / .kicad_symdir
        |
        v
KiCad S-expression reader (I/O boundary)
        |
        v
KiCad Symbol Object Model
  Symbol / Unit / Body Style / Pin / Graphic / Property / Text
        |
        +--> KiCadCoordinateSystem (mm, Y-up -> CirZuit world)
        |
        v
Native KiCad Renderer
        |
        +--> SVG / React preview
        |
        +--> compatibility adapter -> legacy SymbolDef
```

`SymbolDef` is no longer the renderer's source model. `kicadToSymbolDef()` remains only as a compatibility adapter for existing CirZuit placement code.

## Coordinate contract

KiCad symbol geometry is represented in millimetres. CirZuit keeps the explicit conversion in `kicadCoordinateSystem.ts`:

- `1 KiCad mm = 1 / 2.54` CirZuit world units
- KiCad +Y is upward
- SVG/world +Y is downward
- conversion is centralized; renderers must not hard-code scale factors

## Units and body styles

The renderer resolves:

- common unit `0`
- requested electrical unit
- requested body style
- fallback to available style when a requested style is absent

## Diagnostics

Unsupported primitives are recorded by the KiCad environment instead of silently disappearing. This is intentionally useful for expanding coverage against the official KiCad libraries.

## Compatibility

The public runtime in `kicadSymbolEnvironment.ts` exposes both:

- `render()` / `draw()` for native KiCad rendering
- `toSymbolDef()` for legacy CirZuit code

The latter should be removed only after the editor canvas is migrated to native KiCad symbol objects.
