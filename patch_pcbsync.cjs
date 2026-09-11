const fs = require('fs');
let code = fs.readFileSync('src/lib/pcbSync.ts', 'utf-8');

const replacement = `  if (symId.startsWith("CONN_")) {
    const parts = symId.split("_");
    const r_p = parts[2].split("x");
    const rows = parseInt(r_p[0], 10);
    const cols = parseInt(r_p[1], 10);
    const pitch = parseFloat(parts[3]);
    
    let drillHole = 1.00;
    let padDiameter = 1.70;
    
    if (Math.abs(pitch - 1.27) < 0.01) {
      drillHole = 0.65;
      padDiameter = 1.00;
    } else if (Math.abs(pitch - 2.00) < 0.01) {
      drillHole = 0.80;
      padDiameter = 1.30;
    } else {
      drillHole = 1.00;
      padDiameter = 1.70;
    }

    return sym.pins.map((p, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = (c - (cols - 1) / 2) * pitch;
      const y = (r - (rows - 1) / 2) * pitch;

      return {
        pinIndex: i,
        number: p.name,
        name: p.name,
        x,
        y,
        width: padDiameter,
        height: padDiameter,
        shape: i === 0 ? "rect" : "circle",
        layer: "multi_layer",
        drill: drillHole,
      };
    });
  }`;

code = code.replace(
  /  if \(symId\.startsWith\("CONN_"\)\) \{[\s\S]*?    \}\);\n  \}/m,
  replacement
);

fs.writeFileSync('src/lib/pcbSync.ts', code);
