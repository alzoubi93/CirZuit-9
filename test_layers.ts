import { parseKiCadPcb } from './src/lib/importKiCadPcb';
const pcb = `
(kicad_pcb
  (footprint "Test"
    (at 0 0)
    (pad "1" thru_hole circle (at 0 0) (size 1 1) (drill 0.5) (layers "*.Cu" "F.SilkS"))
    (pad "2" smd rect (at 2 2) (size 1 1) (layers "F.Cu" "F.Paste" "F.Mask"))
    (pad "3" smd rect (at 4 4) (size 1 1) (layers "B.Cu" "B.Paste" "B.Mask"))
  )
)
`;
const r = parseKiCadPcb(pcb);
console.log(JSON.stringify(r.doc.pcb.pads, null, 2));
