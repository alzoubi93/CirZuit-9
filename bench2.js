import { fetchOfficialKiCadLibList } from './src/lib/kicadSymbol.tsx';
async function test() {
  const start = Date.now();
  await fetchOfficialKiCadLibList();
  console.log("Time taken:", Date.now() - start, "ms");
}
test();
