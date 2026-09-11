const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Revert Nano
content = content.replace(/const isHorizontal = size\.w > size\.h;\s*\/\/\s*True if long side is X\s*const boardW = isHorizontal \? size\.h : size\.w;\s*(?:\/\/\s*Width along X in vertical view\s*)?const boardH = isHorizontal \? size\.w : size\.h;\s*(?:\/\/\s*Height along Y in vertical view)?/, 
  'const boardW = size.h || 17.78; // Width along X in vertical view\n  const boardH = size.w || (isMini ? 33.02 : 43.18); // Height along Y in vertical view');
content = content.replace(/\{\/\* Visual Board Group \*\/\}\s*<group rotation=\{\[0, 0, \(isHorizontal \? -Math\.PI \/ 2 : 0\) \+ Math\.PI\]\}>/,
  '{/* Visual Board Group */}\n      <group>');

// 2. Revert Uno
content = content.replace(/const isHorizontal = size\.w > size\.h;\s*\/\/\s*True if long side is X\s*const boardW = isHorizontal \? size\.h : size\.w;\s*(?:\/\/\s*Width along X in vertical view\s*)?const boardH = isHorizontal \? size\.w : size\.h;\s*(?:\/\/\s*Height along Y in vertical view)?/, 
  'const boardW = size.h || 53.34; // Width along X in vertical view\n  const boardH = size.w || 68.6;  // Height along Y in vertical view');
content = content.replace(/\{\/\* Visual Board Group \*\/\}\s*<group rotation=\{\[0, 0, \(isHorizontal \? -Math\.PI \/ 2 : 0\) \+ Math\.PI\]\}>/,
  '{/* Visual Board Group */}\n      <group>');

// 3. Revert Pico
content = content.replace(/const isHorizontal = size\.w > size\.h;\s*\/\/\s*True if long side is X\s*const boardW = isHorizontal \? size\.h : size\.w;\s*const boardH = isHorizontal \? size\.w : size\.h;/, 
  'const boardW = size.h || 21.0;\n  const boardH = size.w || 51.0;');
content = content.replace(/\{\/\* Visual Board Group \*\/\}\s*<group rotation=\{\[0, 0, \(isHorizontal \? -Math\.PI \/ 2 : 0\) \+ Math\.PI\]\}>/,
  '{/* Visual Board Group */}\n      <group>');

// 4. Put back isBoardController in the main finalRot logic
const searchGlobal = `  const isESP = ["esp32", "esp8266", "nodemcu"].includes(model.type) || model.type.includes("esp");
  if (isESP) {
    // Restore original 180 degree global rotation for ESP32
    finalRot[2] += Math.PI;
  }`;

const replaceGlobal = `  const isESP = ["esp32", "esp8266", "nodemcu"].includes(model.type) || model.type.includes("esp");
  if (isESP) {
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

content = content.replace(searchGlobal, replaceGlobal);

fs.writeFileSync(file, content);
