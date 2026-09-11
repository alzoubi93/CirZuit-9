# KiCad Footprint Environment V2

## What changed

The previous Footprint Browser depended on one large recursive GitLab repository-tree request. That is fragile for a very large KiCad repository and can result in an empty browser when the request is truncated, paginated unexpectedly, or blocked by a browser/proxy.

V2 uses the official KiCad GitLab repository in a staged way:

1. Resolve the official project using its stable GitLab project ID `21601606`.
2. Read the repository root to discover every `.pretty` footprint library.
3. Populate the library selector immediately from that catalog.
4. Index footprint files inside a library only when that library is selected.
5. Pre-index common package libraries so the browser is populated immediately.
6. Use the official GitLab raw URL to download a selected `.kicad_mod`, with the GitLab API raw-file endpoint as fallback.
7. Cache the parsed native footprint in memory.

The official repository is:

https://gitlab.com/kicad/libraries/kicad-footprints

The current official repository uses the `master` branch and contains `.pretty` libraries with `.kicad_mod` footprint files.

## Important separation

KiCad Symbol import remains independent from Footprint import.

Importing a Symbol does **not** automatically download or assign a Footprint.

Footprints are selected/imported from the PCB Footprint Browser or later assigned through the synchronization/assignment workflow.

## Current architecture

```text
KiCad GitLab Footprint Repository
              |
              v
       Library Catalog
              |
      +-------+--------+
      |                |
      v                v
 Library Browser   Search/Filter
      |
      v
 Lazy library index
      |
      v
 .kicad_mod download
      |
      v
 Native KiCad Footprint Model
      |
      +-------------------+
      |                   |
      v                   v
 PCB Footprint       Existing CirZuit
 Renderer             Footprint Generator
```

## Not implemented yet

- Automatic Symbol → Footprint assignment during Symbol import: intentionally disabled.
- Full 3D model downloading/rendering: later phase.
- Full KiCad custom-pad geometry: later compatibility phase.
- Persistent IndexedDB footprint cache: planned after the network/index workflow is verified.
