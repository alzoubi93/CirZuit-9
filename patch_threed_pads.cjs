const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ThreeDRealModels.tsx', 'utf-8');

code = code.replace(
  '    fp.pads.forEach((pad: any) => {',
  '    fp.pads.forEach((pad: any) => {\n      if (!pad) return;'
);

code = code.replace(
  '    const padXs = fp.pads.map((p: any) => Number(p.x || 0));',
  '    const padXs = fp.pads.filter((p: any) => !!p).map((p: any) => Number(p.x || 0));'
);

code = code.replace(
  '    const padYs = fp.pads.map((p: any) => Number(p.y || 0));',
  '    const padYs = fp.pads.filter((p: any) => !!p).map((p: any) => Number(p.y || 0));'
);

fs.writeFileSync('src/components/editor/ThreeDRealModels.tsx', code);
