const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the global rotation for isBoardController
const globalSearch = `  const isBoardController = [
    "arduino_nano", "arduino_mini", "arduino_uno", "raspberry_pico"
  ].includes(model.type) || model.type.includes("arduino") || model.type.includes("pico");

  if (isBoardController) {
    // Add 180 degrees (Math.PI) to match the PCB editor orientation
    finalRot[2] += Math.PI;
  }`;

content = content.replace(globalSearch, '');

// 2. Add rotation to Visual Board Groups
function rotateInnerGroup(name) {
  const regex = new RegExp(`export const ${name} = \\(\\{[\\s\\S]*?\\{/\\* Visual Board Group \\*/\\}\\s*<group>`, 'm');
  const match = content.match(regex);
  if (match) {
    content = content.replace(regex, match[0].replace('{/* Visual Board Group */}\n      <group>', '{/* Visual Board Group - Rotated 180 degrees */}\n      <group rotation={[0, 0, Math.PI]}>'));
    console.log(`Rotated inner group of ${name}`);
  } else {
    console.log(`Could not find inner group of ${name}`);
  }
}

rotateInnerGroup('ArduinoNano3D');
rotateInnerGroup('ArduinoUno3D');
rotateInnerGroup('RaspberryPico3D');

fs.writeFileSync(file, content);
