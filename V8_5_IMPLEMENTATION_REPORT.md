# CirZuit V8.5 — Multi-Unit + Net Labels + Advanced ECO + ERC/DRC

## Baseline

V8.5 is based directly on V8.4 and first fixes the V8.4 startup regression that could leave the editor as a blank screen.

## Startup regression fixed

### Root cause addressed

The V8.4 PCB synchronization layer imported `getElectrolyticSize` directly from the React/Three.js `ThreeDRealModels` module. This made the logical PCB synchronization module depend on the heavy 3D runtime and its WASM/browser assets. The pure capacitor sizing helper has been moved to:

`src/lib/electrolytic.ts`

PCB synchronization and PCB editing now import the pure helper instead of importing the 3D scene module.

### Additional startup hardening

- New projects now receive a normalized empty PCB document immediately.
- Legacy projects are normalized with default PCB arrays, net registry and synchronization metadata.
- `netLabels` is initialized for old and new projects.
- A top-level React ErrorBoundary prevents runtime exceptions from producing an unexplained black editor screen.

## Stage 13 — Multi-Unit Physical Component Consolidation

Implemented.

- `unitGroupId` represents one physical component.
- The first unit is selected as the physical owner.
- One physical Footprint is created for the group.
- Additional unit nodes no longer create duplicate PCB Footprints.
- `PcbFootprintPad.pinAliases` records unit-to-pad aliases.
- Pin ↔ Pad lookup understands aliases.
- Ratsnest generation exposes the same physical pad to all aliased unit pins.
- PCB net registry resolves unit pins to the single physical Footprint.
- ECO and validation operate at physical-component level.

This is intentionally different from creating one Footprint per unit.

## Stage 14 — Net Label Management

Implemented at the logical model and renderer level.

New schematic data:

`SchematicDoc.netLabels`

Each label contains:

- id
- text
- x/y anchor
- rotation
- local/global scope
- visibility

Netlist behavior:

- Labels attach to wires/pins by anchor position.
- Global labels with the same name join disconnected schematic islands.
- Label names become the user-facing Net name when attached.
- NetIndex exposes `labelNet`.
- Labels are rendered in the Schematic canvas.

## Stage 15 — Advanced ECO

Implemented.

ECO now reports:

- component additions/removals/updates
- stable net additions/removals/member changes
- Net Label changes
- multi-unit consolidation state
- physically routed Footprints scheduled for removal
- blocked changes requiring manual review

ECO execution is blocked when a destructive change has a physical routing dependency or an unsafe multi-unit consolidation conflict.

## Stage 16 — ERC

Implemented in:

`src/lib/designRules.ts`

Checks include:

- unconnected pins
- multiple output drivers on one net
- power-input nets without a detected driver
- single-pin nets
- conflicting net labels
- multi-unit Footprint assignment conflicts
- duplicate multi-unit numbers
- unattached Net Labels

KiCad imported pin electrical types are used when available.

## Stage 17 — DRC

Implemented in the same design-rule engine.

Checks include:

- duplicate PCB references
- orphan/unlinked Footprints
- duplicate pad numbers
- invalid pad dimensions
- pads referencing missing schematic nets
- Footprints outside board bounds
- invalid track widths
- tracks outside board bounds
- tracks referencing missing nets
- basic different-net pad clearance violations

## Stage 18 — Direct ERC/DRC integration

Implemented in the Editor.

The header contains an ERC/DRC action and the result dialog separates:

- ERC
- DRC
- errors
- warnings

The ECO dialog also displays blocked changes and Net Label changes.

## Architecture

The resulting flow is:

`KiCad Symbol → Schematic Component → Unit Group → Pin → Net/Net Label → Physical Component → KiCad/CirZuit Footprint → Pad Alias → PCB Net → Track/Via`

Rendering remains independent:

`KiCad/CirZuit Footprint geometry → unified PCB model → CirZuit renderer`

## Validation performed

All modified TypeScript/TSX source files were transpiled with the installed TypeScript compiler to detect syntax/JSX diagnostics.

A full Vite production build was not claimed because the archive did not contain `node_modules` and dependency installation could not complete in the execution environment.
