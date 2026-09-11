import { fetchOfficialKiCadLibList, OFFICIAL_KICAD_LIBS } from './src/lib/kicadSymbol.tsx';
async function test() {
  console.log("Hardcoded count:", OFFICIAL_KICAD_LIBS.length);
  try {
    const live = await fetchOfficialKiCadLibList();
    console.log("Live count:", live.length);
  } catch(e) {
    console.log("Live fetch failed:", e.message);
  }
}
test();
