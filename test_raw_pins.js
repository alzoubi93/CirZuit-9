import { fetchOfficialKiCadLib, tokenizeSExpr, parseSExpr } from './src/lib/kicadSymbol.tsx';

async function printRawPins() {
  const text = await fetchOfficialKiCadLib("4xxx");
  const tokens = tokenizeSExpr(text);
  const ast = parseSExpr(tokens);
  const sym4028 = ast.find(item => Array.isArray(item) && item[0] === "symbol" && item[1] === "4028");
  console.log("Raw 4028 sub-items:");
  for (const child of sym4028) {
    if (Array.isArray(child) && child[0] === "symbol") {
      console.log("Sub-symbol:", child[1]);
      for (const grandChild of child) {
        if (Array.isArray(grandChild) && grandChild[0] === "pin") {
          console.log("PIN:", JSON.stringify(grandChild));
        }
      }
    }
  }
}
printRawPins();
