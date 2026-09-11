const fs = require('fs');
let content = fs.readFileSync('src/components/editor/ThreeDPreview.tsx', 'utf8');

content = content.replace(
  /polygonOffsetFactor=\{-10\}(?!\s+polygonOffsetUnits)/g,
  'polygonOffsetFactor={-10}\n                    polygonOffsetUnits={-10}'
);

fs.writeFileSync('src/components/editor/ThreeDPreview.tsx', content);
console.log('Updated ThreeDPreview.tsx polygonOffsetUnits');
