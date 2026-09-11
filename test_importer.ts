import { parseKiCadPcb } from './src/lib/importKiCadPcb';
import fs from 'fs';

const dummyPcb = `
(kicad_pcb (version 20240108) (generator "pcbnew")
  (segment (start 1 1) (end 2 2) (width 0.25) (layer "F.Cu") (net 1) (tstamp "uuid"))
  (arc (start 3 3) (mid 3 4) (end 4 4) (width 0.25) (layer "F.Cu") (net 2) (tstamp "uuid"))
  (zone (net 1) (net_name "GND") (layer "F.Cu") (hatch edge 0.5) (polygon (pts (xy 0 0) (xy 10 0) (xy 10 10) (xy 0 10))))
  (gr_poly (pts (xy 20 20) (xy 30 20) (xy 30 30) (xy 20 30)) (layer "F.Cu") (width 0))
  (footprint "Resistor_SMD:R_0805_2012Metric" (layer "F.Cu")
    (at 5 5 90)
    (fp_poly (pts (xy -1 -1) (xy 1 -1) (xy 1 1) (xy -1 1)) (layer "F.SilkS") (width 0.1))
    (pad "1" smd roundrect (at -1 0 90) (size 1 1) (layers "F.Cu" "F.Paste" "F.Mask") (roundrect_rratio 0.25))
    (pad "2" smd custom (at 1 0 90) (size 1 1) (layers "F.Cu" "F.Paste" "F.Mask") (options (clearance outline) (anchor rect)) (primitives (gr_poly (pts (xy -0.5 -0.5) (xy 0.5 -0.5) (xy 0.5 0.5) (xy -0.5 0.5)))))
  )
)
`;

const res = parseKiCadPcb(dummyPcb, "test");
console.log("Tracks:", res.doc.pcb.tracks.length);
console.log("Pads:", res.doc.pcb.pads.length);
console.log(JSON.stringify(res.doc.pcb.tracks, null, 2));
