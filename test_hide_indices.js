import { fetchOfficialKiCadLib, parseKiCadSymbolLib } from './src/lib/kicadSymbol.tsx';
import { kicadToSymbolDef } from './src/lib/kicadSymbol.tsx';

async function test() {
  const text = await fetchOfficialKiCadLib("MCU_Espressif");
  const parsed = parseKiCadSymbolLib(text);
  const esp = parsed.find(s => s.name.includes("ESP32-PICO-D4"));
  
  const def = kicadToSymbolDef(esp);
  console.log("Original parsed pins:", esp.pins.length);
  console.log("SymbolDef pins:", def.pins.length);
}

test();
