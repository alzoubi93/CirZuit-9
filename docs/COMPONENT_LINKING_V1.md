# CirZuit V8.3 — Component Linking Foundation

This release begins the real logical link between the Schematic Symbol environment and the PCB Footprint environment.

## Completed in this batch

1. **Unified Component identity**
   - The existing Schematic node `id` remains the stable component identity and is reused as the PCB footprint id.
   - A dedicated `FootprintAssignment` model records whether the physical footprint comes from KiCad or CirZuit.

2. **KiCad Symbol → Footprint assignment**
   - Imported KiCad symbols can expose their KiCad `Footprint` property.
   - A schematic component can explicitly choose an official KiCad footprint from the Footprint Browser without placing a second independent PCB object.

3. **CirZuit Footprint assignment**
   - Native CirZuit package choices are represented by the same assignment model.
   - Existing package-generation logic remains the fallback physical implementation for native CirZuit components.

4. **Pin ↔ Pad mapping**
   - Pin-to-pad association is resolved by logical pin/pad number, not visual order.
   - Native KiCad footprints are remapped so their `pinIndex` matches the corresponding schematic pin index.
   - Missing and duplicate pad numbers are reported in the component-link metadata.

5. **Schematic → PCB synchronization**
   - A registered KiCad footprint assignment is materialized into the PCB using its native KiCad model.
   - Existing native KiCad geometry is preserved when the assignment still matches.
   - Changing back to a CirZuit footprint removes the native KiCad geometry and uses the CirZuit package generator.
   - If the assigned KiCad library model is not loaded, the logical assignment is retained and the PCB records `missing-kicad-model` instead of silently replacing the assignment.

6. **Unified rendering remains intact**
   - KiCad geometry continues to use the existing KiCad runtime + CirZuit visual renderer.
   - CirZuit-generated footprints continue to use the normal CirZuit footprint renderer.
   - The component-link layer does not duplicate either renderer.

## Remaining phases

### Phase 5 — Net transfer
Build the explicit Symbol Pin → Component → Footprint Pad → PCB Net graph and move named schematic nets into PCB connectivity.

### Phase 6 — Update PCB from Schematic
Turn the current ECO reconciliation into a full assignment-aware update operation with add/change/remove reports.

### Phase 7 — Bidirectional synchronization
Define which side owns logical data (Schematic) and physical placement/routing (PCB), then implement safe reverse updates.

### Phase 8 — Multi-unit symbols
Add explicit unit identity to component links so several KiCad symbol units share one physical footprint correctly.

### Phase 9 — Validation / ERC-style checks
Add unresolved-footprint, missing-pad, duplicate-pad, pin-number mismatch and net-connectivity diagnostics.

### Phase 10 — Library association and production workflow
Connect symbol library metadata, footprint browser filtering, saved project assignments, BOM and export pipelines.
