const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `  const isBoardController = [
    "arduino_nano", "arduino_mini", "arduino_uno", "raspberry_pico"
  ].includes(model.type) || model.type.includes("arduino") || model.type.includes("pico");
  if (isBoardController) {
    // Add 180 degrees (Math.PI) to match the PCB editor orientation
    finalRot[2] += Math.PI;
  }`;

if (content.includes(target)) {
  content = content.replace(target, '');
  fs.writeFileSync(file, content);
  console.log('Successfully removed isBoardController 180 rotation');
} else {
  console.log('Target string not found, attempting regex match');
  const regex = /\s*const isBoardController = \[\s*"arduino_nano", "arduino_mini", "arduino_uno", "raspberry_pico"\s*\]\.includes\(model\.type\) \|\| model\.type\.includes\("arduino"\) \|\| model\.type\.includes\("pico"\);\s*if \(isBoardController\) \{\s*\/\/ Add 180 degrees \(Math\.PI\) to match the PCB editor orientation\s*finalRot\[2\] \+= Math\.PI;\s*\}/;
  content = content.replace(regex, '');
  fs.writeFileSync(file, content);
  console.log('Regex replace complete');
}
