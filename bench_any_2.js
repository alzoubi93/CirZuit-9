import { fetchOfficialKiCadLib } from './src/lib/kicadSymbol.tsx';
async function test() {
  const start = Date.now();
  try {
    await fetchOfficialKiCadLib("Does_Not_Exist");
  } catch (e) {}
  console.log("Time taken:", Date.now() - start, "ms");
}
test();
