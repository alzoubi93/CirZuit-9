const fs = require('fs');
let code = fs.readFileSync('src/lib/symbols.tsx', 'utf-8');

// replace `export const SYMBOLS: Record<SymbolId, SymbolDef> = {` with `const _SYMBOLS: Record<SymbolId, SymbolDef> = {`
code = code.replace(
  /export const SYMBOLS: Record<SymbolId, SymbolDef> = \{/,
  'const _SYMBOLS: Record<SymbolId, SymbolDef> = {'
);

// find `export const SYMBOL_LIST = Object.values(SYMBOLS);`
// replace SYMBOLS with _SYMBOLS here and below it, inject the proxy.
const proxyCode = `
export const SYMBOLS = new Proxy(_SYMBOLS, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    if (typeof prop === 'string' && prop.startsWith('CONN_')) {
      const sym = ensureDynamicSymbol(prop);
      if (sym) target[prop] = sym;
      return sym;
    }
    return undefined;
  },
  set(target, prop: string, value) {
    target[prop] = value;
    return true;
  },
  ownKeys(target) {
    return Reflect.ownKeys(target);
  },
  getOwnPropertyDescriptor(target, prop) {
    return Reflect.getOwnPropertyDescriptor(target, prop);
  }
});

`;

// Note: ensureDynamicSymbol uses SYMBOLS[id], which we need to change to _SYMBOLS or let it go through Proxy. 
// If it uses SYMBOLS, it goes to Proxy and might loop if not careful.
// Let's modify ensureDynamicSymbol to not use SYMBOLS directly.
code = code.replace(
  /if \(SYMBOLS\[id\]\) return SYMBOLS\[id\];/g,
  'if (_SYMBOLS[id]) return _SYMBOLS[id];'
);
code = code.replace(
  /SYMBOLS\[id\] = sym;/g,
  '_SYMBOLS[id] = sym;'
);

code = code.replace(
  /export const SYMBOL_LIST = Object.values\(SYMBOLS\);/g,
  proxyCode + '\nexport const SYMBOL_LIST = Object.values(_SYMBOLS);'
);

fs.writeFileSync('src/lib/symbols.tsx', code);
