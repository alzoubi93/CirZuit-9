import { fetchOfficialKiCadLib, parseKiCadSymbolLib } from './src/lib/kicadSymbol.tsx';

async function test() {
  const text = await fetchOfficialKiCadLib("MCU_Espressif");
  const parsed = parseKiCadSymbolLib(text);
  const esp = parsed.find(s => s.name.includes("ESP8266EX") || s.name.includes("ESP32-PICO-D4"));
  console.log("Found ESP:", esp.name);
  esp.pins.forEach(p => {
    if (p.hide) {
       console.log("Hidden Pin:", p.number, p.name);
    }
  });
}

test();
