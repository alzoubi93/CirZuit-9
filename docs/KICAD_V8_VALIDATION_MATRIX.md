# V8 validation matrix

| Family | What V8 must preserve | Primary runtime check |
|---|---|---|
| DIP | Through-hole pads, `*.Cu`/`*.Mask`, pad pitch, pin count, 3D reference | Padstack + transform + native renderer |
| SOIC | Roundrect SMD pads, F.Cu/F.Mask/F.Paste, rotation, courtyard/silkscreen | Roundrect path + layer resolver |
| QFP | Four pad banks, repeated rotations, fab/courtyard graphics | Pad geometry + transforms |
| QFN | Dense pads + exposed thermal pad | Roundrect/custom + layer resolver |
| BGA | Repeated circular/round pads, dense grid | Circle/roundrect + selection |
| USB | Mixed graphics, dense pads, custom/mechanical geometry | Custom geometry + text box + hit testing |
| CP_Axial | Two through-hole pads at 0/18 mm, axial body graphics | Official structural profile + geometry bounds |

A family is considered validated only after comparing the same `.kicad_mod` loaded by CirZuit with KiCad's visual result and checking pad coordinates, sizes, rotations, layers, graphics, text boxes, and 3D references.
