import { parseKiCadPcb } from './src/lib/importKiCadPcb';
const pcb = `
(kicad_pcb
  (footprint "Test"
    (at 0 0 90)
    (fp_text reference "R1" (at 0 0))
    (fp_text value "10k" (at 0 0))
    (fp_text user "Hello" (at 1 1 90) (layer "F.SilkS") (effects (font (size 2 2))))
  )
)
`;
const r = parseKiCadPcb(pcb);
console.log(JSON.stringify(r.doc.pcb.texts, null, 2));
