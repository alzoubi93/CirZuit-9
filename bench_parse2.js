import { fetchOfficialKiCadLib, importKiCadSymbolLibrary } from './src/lib/kicadSymbol.tsx';
async function test() {
  const text = await fetchOfficialKiCadLib("MCU_ST_STM32F4");
  const start = Date.now();
  importKiCadSymbolLibrary(text, "MCU_ST_STM32F4");
  console.log("Parse Time taken:", Date.now() - start, "ms");
}
test();
