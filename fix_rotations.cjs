const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

const searchStr = `{/* Visual Board Group - Rotated 180 degrees */}
      <group rotation={[0, 0, Math.PI]}>`;
const replaceStr = `{/* Visual Board Group */}
      <group>`;

let count = 0;
while(content.includes(searchStr)) {
  content = content.replace(searchStr, replaceStr);
  count++;
}
console.log(`Replaced inner rotation in ${count} places.`);

const globalRotSearch = `  const isAxial = ["resistor", "diode", "fuse", "inductor"].includes(model.type);
  const finalRot = [...rot] as [number, number, number];`;

const globalRotReplace = `  const isAxial = ["resistor", "diode", "fuse", "inductor"].includes(model.type);
  const finalRot = [...rot] as [number, number, number];

  const isESP = ["esp32", "esp8266", "nodemcu"].includes(model.type) || model.type.includes("esp");
  if (isESP) {
    // Restore original 180 degree global rotation for ESP32
    finalRot[2] += Math.PI;
  }`;

if (content.includes(globalRotSearch)) {
  content = content.replace(globalRotSearch, globalRotReplace);
  console.log('Added global rotation back for ESP32.');
} else {
  console.log('Could not find global rotation insertion point!');
}

fs.writeFileSync(file, content);
