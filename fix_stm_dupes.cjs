const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix STM32 duplicate
content = content.replace('const isHorizontal = size.w > size.h;\n  const isHorizontal = size.w > size.h; // True if long side is X', 'const isHorizontal = size.w > size.h;');

// Let's check Nano, Pico, Uno if they have duplicate or any issues
// Nano had: `const boardW = size.h || 17.78;` -> `const isHorizontal...; const boardW...`
// Uno had: `const boardW = size.h || 53.34;`
// Pico had: `const boardW = size.h || 21.0;`

// Let's also simplify the RoundedBox args in STM32 if it's there
content = content.replace('args={[boardW > boardH ? boardH : boardW, boardW > boardH ? boardW : boardH, boardD]}', 'args={[boardW, boardH, boardD]}');

// Let's fix the components positions in STM32 which were using Math.max(boardW, boardH)
// Since boardH is ALWAYS the max now, we can just use boardH.
content = content.replace(/Math\.max\(boardW, boardH\)/g, 'boardH');
content = content.replace(/Math\.min\(boardW, boardH\)/g, 'boardW');

fs.writeFileSync(file, content);
console.log('Fixed dupes');
