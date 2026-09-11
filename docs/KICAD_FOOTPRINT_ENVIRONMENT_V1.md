# CirZuit KiCad Footprint Environment — V1

## Implemented

- Native KiCad footprint model for `.kicad_mod` data.
- Official KiCad Footprint Library browser backed by the official GitLab repository.
- On-demand library indexing and footprint download/cache.
- Native SVG rendering of footprint graphics in the PCB editor.
- Conversion of native KiCad pads into editable CirZuit PCB pads.
- Footprint Browser with search, library filtering, preview, diagnostics and import/place.
- Existing CirZuit Footprint Generator remains intact and is reachable from the Footprint Browser.
- Generated and imported footprints share the CirZuit PCB footprint object model.
- No automatic footprint import or footprint assignment is performed during KiCad Symbol import.

## Official source

https://gitlab.com/kicad/libraries/kicad-footprints.git

The official repository currently identifies itself as the official KiCad footprint library. Its README states that `.pretty` directories contain `.kicad_mod` footprint files and that the current master library targets the current KiCad release.

## Important scope boundary

This phase intentionally does not download or attach 3D models automatically. The `model` references are retained in the native footprint model so the later 3D phase can use the official KiCad Packages3D repository without redesigning the footprint architecture.

## Symbol isolation

The existing Symbol Environment is not modified to import footprints. Symbol import remains a Symbol-only workflow. Footprint assignment is a PCB/Synchronization concern and is user-controlled.

## Known V1 limitations

- Complex custom pad geometry is detected and reported but is not yet fully rendered as arbitrary custom polygons.
- `fp_curve` is diagnosed rather than silently approximated.
- Some advanced KiCad graphic primitives and manufacturing properties require additional implementation before claiming full KiCad footprint compatibility.
- The browser indexes the official repository on demand; production deployments may later benefit from a persistent index service or a version-pinned snapshot.
