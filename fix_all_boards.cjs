const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

function fixBoard(name, defaultW, defaultH) {
  const regex = new RegExp(`export const ${name} = \\(\\{ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered \\}: any\\) => \\{[\\s\\S]*?^  \\);[\\n\\r]+^\\};`, 'm');
  const match = content.match(regex);
  if (!match) return;
  
  let code = match[0];
  
  // Replace boardW and boardH definitions
  code = code.replace(/const boardW = [^;]+;/, `const boardW = size.w || ${defaultW};`);
  code = code.replace(/const boardH = [^;]+;/, `const boardH = size.h || ${defaultH};`);
  
  // Replace the group rotation to orient the visual components
  // We want to detect if the board is placed horizontally (width > height)
  // If horizontal, we rotate the internal components by -90 degrees
  
  content = content.replace(regex, code);
  console.log(`Fixed ${name}`);
}

// I won't use fixBoard blindly because the internals of each model are complex.
// Instead, I will write a custom regex replacement for STM32 first to just use size.w for W and size.h for H.
