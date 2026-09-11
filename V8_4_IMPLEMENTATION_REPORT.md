# CirZuit V8.4 — Schematic ↔ PCB Integration Report

## Baseline

This release is based directly on **V8.3 Component Linking Foundation**.

## Implemented stages

### Stage 7 — Net Transfer

Implemented a persistent PCB-side net registry derived from the schematic net graph.

- Stable net keys are derived from component UUID + pin membership.
- PCB nets preserve a user-facing fallback name (`N1`, `N2`, ...).
- Linked footprint pads receive `netId`, `netKey`, and `netName`.
- Existing PCB tracks are annotated from physical connectivity to linked pads.
- Vias are annotated from nearby pads/tracks when unambiguous.
- Conflicting track groups are reported instead of silently assigned to a wrong net.

### Stage 8 — Full Schematic → PCB ECO foundation

The existing ECO reconciliation now also transfers electrical connectivity.

- New components are provisioned.
- Existing footprints retain PCB position/rotation.
- KiCad native footprints remain the geometry source when resolved.
- CirZuit generated footprints remain supported.
- Reference/Value updates are preserved.
- Footprint assignment changes are detected.
- Pad mapping is refreshed.
- Existing tracks are no longer silently deleted merely because a schematic mismatch is detected; conflicts are reported in `pcb.sync.conflicts`.
- ECO now exposes net additions/removals/member changes.

### Stage 9 — Synchronization policy

Implemented explicit ownership rules:

- Schematic owns logical components, pins, and nets.
- PCB owns footprint position, rotation, routing, board geometry, and physical placement.
- Assignment metadata can be reconciled from PCB back to the schematic.
- PCB position/rotation is intentionally NOT copied into schematic coordinates because the coordinate systems represent different physical domains.

### Stage 10 — Multi-unit foundation

Added persistent unit metadata to schematic nodes:

- `unit`
- `unitGroupId`
- `unitCount`

KiCad imported unit-specific pin resolution is supported by the component-link and netlist layers when a node specifies its unit.

Validation detects:

- conflicting footprint assignments inside one unit group;
- missing explicit unit numbers;
- suspicious one-node unit groups.

Full consolidation of multiple unit instances into one physical PCB footprint is intentionally not performed automatically yet, because it requires a dedicated group-level pin/pad alias model.

### Stage 11 — Validation

Added `validateSchematicPcbLink()`.

It detects:

- missing PCB footprints;
- missing symbol pins/pads;
- duplicate pads;
- extra pads;
- missing assignments;
- unlinked PCB footprints;
- multi-unit assignment conflicts;
- incomplete PCB net mappings;
- schematic/PCB net conflicts.

### Stage 12 — Project integration

The V8.4 data model persists the new connectivity information through the native project object:

- `PcbDoc.nets`
- `PcbDoc.sync`
- pad/track/via net metadata

The existing `.zuit` project persistence automatically carries these fields because the PCB document is serialized as structured project data.

## Rendering integration

No separate KiCad PCB renderer was introduced.

The physical Footprint still follows:

`KiCad/CirZuit source → unified Footprint model → CirZuit PCB renderer`

The new electrical layer is independent of rendering.

## Tests added

- `src/lib/pcbSync.integration.test.ts`
- Existing `src/lib/componentLink.test.ts` retained.

TypeScript project validation passed with:

`tsc --noEmit --project tsconfig.json`

A full Vite/Vitest dependency install could not be completed in the execution environment within the available time, so no claim is made that a production browser bundle was executed here.
