const fs = require('fs');
let code = fs.readFileSync('src/components/editor/PcbElements.tsx', 'utf-8');

code = code.replace(
  'const isConnector = sym.includes("header") || sym.includes("connector") || sym.includes("terminal") || sym.includes("jack") || sym.includes("usb") || ref.startsWith("j");',
  'const isConnector = sym.includes("header") || sym.includes("connector") || sym.includes("terminal") || sym.includes("jack") || sym.includes("usb") || ref.startsWith("j") || sym.includes("conn_");'
);

fs.writeFileSync('src/components/editor/PcbElements.tsx', code);
