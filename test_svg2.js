import React from 'react';
import { fetchOfficialKiCadLib, parseKiCadSymbolLib } from './src/lib/kicadSymbol.tsx';
import { renderKiCadSymbol } from './src/lib/kicadRenderer.tsx';
import ReactDOMServer from 'react-dom/server';

async function testSvgOutput() {
  const text = await fetchOfficialKiCadLib("MCU_Espressif");
  const parsed = parseKiCadSymbolLib(text);
  const esp = parsed.find(s => s.name.includes("ESP8266EX"));
  
  const svgString = ReactDOMServer.renderToStaticMarkup(renderKiCadSymbol(esp, "#000"));
  console.log(svgString);
}

testSvgOutput();
