const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ThreeDRealModels.tsx', 'utf-8');

code = code.replace(
  '    if (fpH > 3) {\n      rows = 2;\n      cols = pins / 2;\n    }',
  '    const uniqueYs = Array.from(new Set(padsY.map(y => Math.round(y * 10) / 10)));\n    rows = Math.max(1, uniqueYs.length);\n    cols = Math.ceil(pins / rows);'
);

fs.writeFileSync('src/components/editor/ThreeDRealModels.tsx', code);
