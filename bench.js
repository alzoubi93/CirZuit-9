import { fetchOfficialKiCadLib } from './src/lib/kicadSymbol.tsx';
async function test() {
  const start = Date.now();
  await fetchOfficialKiCadLib("MCU_Espressif");
  console.log("Time taken:", Date.now() - start, "ms");
}
test();
