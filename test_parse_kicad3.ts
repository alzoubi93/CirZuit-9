import { parseKiCadSch, tokenizeSExpr } from "./src/lib/importSchematicFormats";

const text = `(kicad_symbol_lib (version 20211014) (generator kicad_symbol_editor)`;
console.log(tokenizeSExpr(text));
