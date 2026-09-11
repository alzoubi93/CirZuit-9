import { parseKiCadSch } from "./src/lib/importSchematicFormats";

const text = `(kicad_schematic (version 20211123) (generator eeschema)
  (paper "A4")
  (symbol (lib_id "Device:R") (at 116.84 57.15 0) (unit 1)
    (in_bom yes) (on_board yes)
    (uuid 6a2c3886-53a5-48b6-9f1e-fbd47b31d2ba)
    (property "Reference" "R1" (id 0) (at 118.618 56.007 0))
    (property "Value" "10k" (id 1) (at 118.618 58.3184 0))
  )
)`;

const res = parseKiCadSch(text);
console.log(JSON.stringify(res, null, 2));
