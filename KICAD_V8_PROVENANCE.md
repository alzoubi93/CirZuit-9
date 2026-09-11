# V8 provenance and licensing note

V8 was implemented as an independent TypeScript runtime based on the public behavior and data model exposed by KiCad.

Reference sources:

- https://gitlab.com/kicad/code/kicad/-/blob/master/pcbnew/footprint.h
- https://gitlab.com/kicad/code/kicad/-/blob/master/pcbnew/pad.h
- https://gitlab.com/kicad/code/kicad/-/blob/9b4c1024c922b6e5110eb9991ee9e948ddd786d8/pcbnew/padstack.h
- https://dev-docs.kicad.org/en/file-formats/sexpr-footprint/index.html
- https://dev-docs.kicad.org/en/file-formats/sexpr-intro/index.html
- https://gitlab.com/kicad/libraries/kicad-footprints

No KiCad C++ source file is copied into the CirZuit TypeScript runtime by V8. The implementation uses independently written TypeScript classes and algorithms that model the documented/public behavior.

Before distributing a release that embeds or redistributes any KiCad library files, review the applicable KiCad library license and attribution requirements separately from the KiCad source-code license.
