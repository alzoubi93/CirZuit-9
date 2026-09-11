const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ThreeDPreview.tsx', 'utf-8');

code = code.replace(
  '      for (let j = 0; j < pts.length - 1; j++) {\n        const p1 = pts[j], p2 = pts[j + 1];\n        const dx = p2.x - p1.x, dy = -(p2.y - p1.y);',
  '      for (let j = 0; j < pts.length - 1; j++) {\n        const p1 = pts[j], p2 = pts[j + 1];\n        if (!p1 || !p2) continue;\n        const dx = p2.x - p1.x, dy = -(p2.y - p1.y);'
);

fs.writeFileSync('src/components/editor/ThreeDPreview.tsx', code);
