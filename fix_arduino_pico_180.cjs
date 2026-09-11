const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove the Math.PI inner rotation from Nano, Uno, Pico
function removeInnerRotation(name) {
  const regex = new RegExp(`export const ${name} = \\(\\{[\\s\\S]*?\\{/\\* Visual Board Group - Rotated 180 degrees \\*/\\}\\s*<group rotation=\\{\\[0, 0, Math\\.PI\\]\\}>`, 'm');
  const match = content.match(regex);
  if (match) {
    content = content.replace(regex, match[0].replace('{/* Visual Board Group - Rotated 180 degrees */}\n      <group rotation={[0, 0, Math.PI]}>', '{/* Visual Board Group */}\n      <group>'));
    console.log(`Reverted inner group of ${name}`);
  }
}

removeInnerRotation('ArduinoNano3D');
removeInnerRotation('ArduinoUno3D');
removeInnerRotation('RaspberryPico3D');

// 2. Add the global rotation back for Arduino and Pico
const findESP = `  if (isESP) {
    // Restore original 180 degree global rotation for ESP32
    finalRot[2] += Math.PI;
  }`;

const replacement = `  if (isESP) {
    // Restore original 180 degree global rotation for ESP32
    finalRot[2] += Math.PI;
  }

  const isBoardController = [
    "arduino_nano", "arduino_mini", "arduino_uno", "raspberry_pico"
  ].includes(model.type) || model.type.includes("arduino") || model.type.includes("pico");

  if (isBoardController) {
    // Add 180 degrees (Math.PI) to match the PCB editor orientation
    finalRot[2] += Math.PI;
  }`;

if (!content.includes('const isBoardController')) {
  content = content.replace(findESP, replacement);
  console.log('Added global 180 rotation for Arduino and Pico');
}

fs.writeFileSync(file, content);
