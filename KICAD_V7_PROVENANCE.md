# KiCad V7 Provenance and Licensing Notes

CirZuit V7 was implemented as an independent TypeScript runtime based on public KiCad source behavior and file-format documentation.

References reviewed:

- https://gitlab.com/kicad/code/kicad/-/blob/master/pcbnew/footprint.h
- https://gitlab.com/kicad/code/kicad/-/blob/master/pcbnew/pad.h
- https://gitlab.com/kicad/code/kicad/-/blob/master/pcbnew/pcb_painter.cpp
- https://gitlab.com/kicad/code/kicad/-/blob/master/pcbnew/pcb_shape.cpp
- https://gitlab.com/kicad/code/kicad/-/blob/10.0/pcbnew/plot_brditems_plotter.cpp
- https://gitlab.com/kicad/code/kicad/-/blob/master/pcbnew/board_items_to_polygon_shape_transform.cpp
- https://dev-docs.kicad.org/en/file-formats/sexpr-footprint/index.html

The majority of KiCad source code is GPLv3-or-later. See KiCad's `LICENSE.README` for the source-tree licensing breakdown. CirZuit V7 does not copy KiCad C++ source files; it implements the observed object and geometry semantics independently in TypeScript.
