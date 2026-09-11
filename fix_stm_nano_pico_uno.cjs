const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

function fixBoard(name, isSTM, needs180) {
  const regex = new RegExp(`export const ${name} = \\(\\{ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered \\}: any\\) => \\{[\\s\\S]*?^  \\);[\\n\\r]+^\\};`, 'm');
  const match = content.match(regex);
  if (!match) return;
  
  let code = match[0];
  
  // Replace the boardW and boardH logic with internalW and internalH
  code = code.replace(/const boardW = [^;]+;/, 'const isHorizontal = size.w > size.h; // True if long side is X\n  const boardW = isHorizontal ? size.h : size.w;');
  code = code.replace(/const boardH = [^;]+;/, 'const boardH = isHorizontal ? size.w : size.h;');
  
  // Now add the rotation to the Visual Board Group
  // For Nano, Pico, Uno, STM32, we currently have `{/* Visual Board Group */}\n      <group>`
  // Or `{/* Visual Board Group - Rotated 180 degrees */}\n      <group rotation={[0, 0, Math.PI]}>`
  
  // Let's standardise it:
  // We want the group to be:
  // <group rotation={[0, 0, (isHorizontal ? -Math.PI / 2 : 0) + (needs180 ? Math.PI : 0)]}>
  
  let groupRot = `(isHorizontal ? -Math.PI / 2 : 0)`;
  if (needs180) {
    groupRot += ` + Math.PI`;
  }
  
  const visualGroupRegex = /\{\/\* Visual Board Group(?: -.*)? \*\/\}\s*<group(?: rotation=\{[^}]+\})?>/;
  const visualGroupReplace = `{/* Visual Board Group */}
      <group rotation={[0, 0, ${groupRot}]}>`;
      
  code = code.replace(visualGroupRegex, visualGroupReplace);
  
  content = content.replace(regex, code);
  console.log(`Fixed ${name}`);
}

fixBoard('STM32BluePill3D', true, false);
fixBoard('ArduinoNano3D', false, true);
fixBoard('ArduinoUno3D', false, true);
fixBoard('RaspberryPico3D', false, true);

fs.writeFileSync(file, content);
