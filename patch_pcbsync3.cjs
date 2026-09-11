const fs = require('fs');
let code = fs.readFileSync('src/lib/pcbSync.ts', 'utf-8');

code = code.replace(
  '        for (const p1 of current.points) {\n          for (const p2 of other.points) {\n            if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 0.4) {',
  '        for (const p1 of current.points) {\n          if (!p1) continue;\n          for (const p2 of other.points) {\n            if (!p2) continue;\n            if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 0.4) {'
);

fs.writeFileSync('src/lib/pcbSync.ts', code);
