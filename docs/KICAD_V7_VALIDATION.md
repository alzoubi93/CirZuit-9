# V7 validation record

## Static validation performed in this build environment

The following TypeScript modules were type-checked directly with the available global TypeScript compiler:

- `kicadFootprint.ts`
- `kicadFootprintReader.ts`
- `kicadFootprintRuntime.ts`
- `kicadFootprintKernel.ts`
- `geometry/types.ts`
- `geometry/engine.ts`

Result: no TypeScript errors in the V7 footprint runtime/geometry modules.

A CommonJS compilation smoke test was also run against the same modules. It loaded a KiCad-style `Capacitor_THT:CP_Axial_L11.0mm_D6.0mm_P18.00mm_Horizontal` definition and verified:

- two pads at `(0,0)` and `(18,0)`;
- footprint geometry generation;
- geometry bounds;
- oval-pad capsule construction;
- KiCad trapezoid delta construction;
- pad rotation and pad-offset behavior.

The full React/Vite dependency tree was not installed in this build environment, so a complete `npm run build` could not be executed here. The renderer was syntax/type-checked as far as the available project dependencies permit.

## Required device-side acceptance tests

After installing dependencies and starting CirZuit, test at minimum:

1. `Capacitor_THT:CP_Axial_L11.0mm_D6.0mm_P18.00mm_Horizontal`
2. `Package_DIP:DIP-8_W7.62mm`
3. `Package_SO:SOIC-8_3.9x4.9mm_P1.27mm`
4. one QFP with a pin-1 chamfer
5. one QFN/DFN with a center exposed pad
6. one footprint containing `fp_arc`
7. one footprint containing `fp_curve`
8. one footprint containing a custom pad
9. one footprint containing `fp_text_box`
10. one bottom-side footprint/mirrored instance

The acceptance criterion is not merely that the file loads: the pad centers, rotations, outline geometry, arcs, text placement and layer-specific graphics must visually and dimensionally agree with KiCad.
