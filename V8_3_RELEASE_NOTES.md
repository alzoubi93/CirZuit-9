# CirZuit V8.3 — Component Linking Foundation

## Purpose

V8.3 starts the integration layer between KiCad Symbols in the Schematic editor, KiCad Footprints in the PCB editor, and native CirZuit Footprints.

## Main architectural change

`Symbol` and `Footprint` remain separate domain objects. A new component-link layer connects them through:

- stable component id
- reference
- footprint assignment source
- footprint identifier
- pin ↔ pad mapping
- synchronization metadata

## Included

- `src/lib/componentLink.ts`
- KiCad Symbol pin-number preservation
- KiCad Symbol default Footprint discovery
- Schematic Footprint assignment fields
- KiCad Footprint selection from Schematic Properties
- CirZuit Footprint assignment from Schematic Properties
- KiCad footprint runtime registry for the current session
- assignment-aware Schematic → PCB synchronization
- native KiCad pad remapping by pad number
- component-link metadata on PCB footprints
- release documentation and validation test

## Not yet completed

- full PCB net transfer
- bidirectional synchronization
- multi-unit symbol/one-footprint handling
- complete ERC/PCB connectivity diagnostics
- persistent footprint-library cache independent of the PCB document
