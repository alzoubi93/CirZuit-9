const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ThreeDRealModels.tsx', 'utf-8');

code = code.replace(
  '{fp.pads?.map((p: any, i: number) => (',
  '{extractComponentMeasurements(fp || {}).holes?.map((hole: any, i: number) => ('
);

code = code.replace(
  '<mesh key={i} position={[p.x, p.y, 0]}>',
  '<mesh key={i} position={[hole.relativeX, hole.relativeY, 0]}>'
);

fs.writeFileSync('src/components/editor/ThreeDRealModels.tsx', code);
