const fs = require('fs');
let code = fs.readFileSync('src/lib/symbols.tsx', 'utf-8');

code = code.replace(
  /export function nodeBBox\(node: \{ x: number; y: number; symbol: SymbolId; rotation: number; size\?: number \}\) \{/g,
  'export function nodeBBox(node: { x: number; y: number; symbol: SymbolId; rotation: number; size?: number; metadata?: any }) {'
);

code = code.replace(
  /const sym = SYMBOLS\[node.symbol\];/g,
  'const sym = SYMBOLS[node.symbol] || ensureDynamicSymbol(node.symbol, node.metadata);'
);

fs.writeFileSync('src/lib/symbols.tsx', code);
