# V8.5.1 — Runtime Hotfix

## Fixed
- Fixed `ReferenceError: labelNet is not defined` in `src/lib/netlist.ts`.
- `buildNetIndex()` now initializes and returns its `labelNet` map before processing net groups.
- Added a regression test covering a brand-new empty schematic so the editor can initialize without a runtime exception.
- Fixed `ReferenceError: getSymbolPinNumbers is not defined` in `src/lib/pcbSync.ts`.
- Added missing import of `getSymbolPinNumbers` from `./componentLink` (used inside `buildPcbNetRegistry`).

## Impact
This fixes the startup crash that occurred when creating or opening a project and caused the ErrorBoundary to show the runtime-error screen instead of the Schematic editor.
