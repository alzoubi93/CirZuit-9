import { fetchOfficialKiCadLib, parseKiCadSymbolLib } from './src/lib/kicadSymbol.tsx';
import { kicadToSymbolDef } from './src/lib/kicadSymbol.tsx';

async function test() {
  const text = await fetchOfficialKiCadLib("power");
  const parsed = parseKiCadSymbolLib(text);
  const gnd = parsed.find(s => s.name.includes("GND"));
  
  if (gnd) {
    const def = kicadToSymbolDef(gnd);
    console.log("GND Original parsed pins:", gnd.pins.length, gnd.pins[0].hide);
    console.log("GND SymbolDef pins:", def.pins.length);
  }
}

test();
