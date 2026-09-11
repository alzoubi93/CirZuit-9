const fs = require('fs');
let code = fs.readFileSync('src/lib/pcbSync.ts', 'utf-8');

code = code.replace(
  '    fp.pads.forEach(pad => {\n      const worldX = fp.x + (pad.x * cos - pad.y * sin);',
  '    fp.pads.forEach(pad => {\n      if (!pad) return;\n      const worldX = fp.x + (pad.x * cos - pad.y * sin);'
);

code = code.replace(
  '      const pad0 = fp.pads[0];\n      const pad1 = fp.pads[fp.pads.length - 1];\n      const d = Math.hypot(pad0.x - pad1.x, pad0.y - pad1.y);',
  '      const pad0 = fp.pads[0];\n      const pad1 = fp.pads[fp.pads.length - 1];\n      if (!pad0 || !pad1) return { x: fp.x - 1, y: fp.y - 1, w: 2, h: 2 };\n      const d = Math.hypot(pad0.x - pad1.x, pad0.y - pad1.y);'
);

fs.writeFileSync('src/lib/pcbSync.ts', code);
