const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

// STM32
let stmRegex = /export const STM32BluePill3D = \(\{ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered \}: any\) => \{[\s\S]*?^  \);[\n\r]+^\};/m;
let stmMatch = content.match(stmRegex);
if (stmMatch) {
  let code = stmMatch[0];
  code = code.replace(/const boardW = [^;]+;/, 'const boardW = size.w || 22.9;');
  code = code.replace(/const boardH = [^;]+;/, 'const boardH = size.h || 53.3;');
  
  // If size.w > size.h, the board is horizontal, so rotate the visual components inside the group
  // Actually, just wrapping the visual board group with a rotation depending on size.w > size.h
  // Let's replace the visual group
  let visualGroupRegex = /\{\/\* Visual Board Group \*\/\}\s*<group>/;
  let visualGroupReplace = `{/* Visual Board Group */}
      <group rotation={[0, 0, size.w > size.h ? -Math.PI / 2 : 0]}>`;
  code = code.replace(visualGroupRegex, visualGroupReplace);
  
  // Also we need to make sure the RoundedBox uses the correct W and H because we are rotating it.
  // Wait, if we rotate the whole visual group by 90 degrees, the RoundedBox will be rotated too!
  // If size.w is 53.3 and size.h is 22.9 (horizontal footprint), 
  // boardW = 53.3, boardH = 22.9.
  // If we rotate by -90, the X axis becomes Y, so width becomes 53.3 along Y.
  // But wait! If boardW is 53.3 and we rotate it by 90, it will extend 53.3 along Y.
  // That matches the holes if the holes are along X? No! 
  // If the footprint has size.w = 53.3, the holes are distributed along X. 
  // We want the visual board to be long along X!
  // If we don't rotate it, it is naturally long along X!
  // But all the components inside (MCU, USB) are positioned assuming Y is the long axis!
  // Ah! The components inside are hardcoded with Y as the long axis!
  // E.g. USB port at `boardH / 2 - 2` which is Y axis.
  
  // Let's rewrite STM32 completely to handle this elegantly.
}

