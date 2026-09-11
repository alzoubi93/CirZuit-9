import { SYMBOLS } from './src/lib/symbols';
for (const [id, sym] of Object.entries(SYMBOLS)) {
  if (sym && sym.pins) {
    sym.pins.forEach((p, i) => {
      if (!p || p.x === undefined || p.y === undefined) {
        console.log(`Symbol ${id} has undefined pin or missing x/y at index ${i}`, p);
      }
    });
  }
}
console.log("Check complete.");
