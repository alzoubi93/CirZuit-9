const fs = require('fs');
let code = fs.readFileSync('src/components/editor/Canvas.tsx', 'utf-8');

code = code.replace(
  '        <g\n          transform={`translate(${view.x} ${view.y}) scale(${view.scale * GRID})`}\n        >\n          {doc.wires.map((w) => {',
  '        <g\n          transform={`translate(${view.x} ${view.y}) scale(${view.scale * GRID})`}\n        >\n          {doc.wires.map((w) => {\n            if (!w.points || w.points.length === 0) return null;'
);

fs.writeFileSync('src/components/editor/Canvas.tsx', code);
