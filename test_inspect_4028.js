import { fetchOfficialKiCadLib, parseKiCadSymbolLib, kicadToSymbolDef } from './src/lib/kicadSymbol.tsx';

async function inspect4028() {
  const text = await fetchOfficialKiCadLib("4xxx");
  const parsedLib = parseKiCadSymbolLib(text);
  const sym4028 = parsedLib.find(s => s.name === "4028");
  console.log("Symbol 4028 parsed:", {
    name: sym4028?.name,
    bbox: sym4028?.bbox,
    properties: sym4028?.properties,
    pinsCount: sym4028?.pins.length,
    bodyGraphicsCount: sym4028?.bodyGraphics.length,
  });
  console.log("Body graphics:");
  console.log(JSON.stringify(sym4028?.bodyGraphics, null, 2));

  console.log("Pins detail of 4028:");
  sym4028?.pins.forEach(p => {
    console.log(`Pin ${p.number} (${p.name}): at=(${p.at.x}, ${p.at.y}, rot=${p.at.rotation}), length=${p.length}`);
  });

  const native = kicadToSymbolDef(sym4028);
  console.log("Converted native symbol 4028:", {
    id: native.id,
    width: native.width,
    height: native.height,
    pinsCount: native.pins.length,
  });
  console.log("Native pins:");
  native.pins.forEach(p => {
    console.log(`Native pin ${p.id} (${p.name}): x=${p.x}, y=${p.y}`);
  });
}

inspect4028();
