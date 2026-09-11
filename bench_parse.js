import { fetchOfficialKiCadLib, importKiCadSymbolLibrary } from './src/lib/kicadSymbol.tsx';
async function test() {
  const text = await fetchOfficialKiCadLib("MCU_Espressif");
  const start = Date.now();
  importKiCadSymbolLibrary(text, "MCU_Espressif");
  console.log("Parse Time taken:", Date.now() - start, "ms");
}
test();
