const fs = require('fs');

let content = fs.readFileSync('src/components/editor/ThreeDRealModels.tsx', 'utf8');

// 1. Line 1072: size.d / 2 + 0.005 -> size.d / 2 + 0.15
content = content.replace(/position=\{\[0, 0, size\.d \/ 2 \+ 0\.005\]\}/g, 'position={[0, 0, size.d / 2 + 0.15]}');

// 2. Line 1158: thickness / 2 + 0.02 -> thickness / 2 + 0.15
content = content.replace(/position=\{\[0, thickness \/ 2 \+ 0\.02, bodyZ\]\}/g, 'position={[0, thickness / 2 + 0.15, bodyZ]}');

// 3. Lines 1419, 1449, 1474: size.d / 2 + 0.01 -> size.d / 2 + 0.18
content = content.replace(/position=\{\[0, 0, size\.d \/ 2 \+ 0\.01\]\}/g, 'position={[0, 0, size.d / 2 + 0.18]}');

// 4. Line 1530: position={[0, 0, 0.86]} -> 0.98
content = content.replace(/position=\{\[0, 0, 0\.86\]\}/g, 'position={[0, 0, 0.98]}');

// 5. Line 1540: position={[0, 0, 0.76]} -> 0.88
content = content.replace(/position=\{\[0, 0, 0\.76\]\}/g, 'position={[0, 0, 0.88]}');

// 6. Line 1689: position={[0, 0, 0.46]} -> 0.58
content = content.replace(/position=\{\[0, 0, 0\.46\]\}/g, 'position={[0, 0, 0.58]}');

// 7. Line 1923 (ATmega328P on Uno): position={[0, 0, 2.05]} -> position={[0, 0, 2.22]}
content = content.replace(/position=\{\[0, 0, 2\.05\]\}/g, 'position={[0, 0, 2.22]}');

// 8. Line 2164 (RP2040): position={[0, 0, 0.31]} -> position={[0, 0, 0.45]}
content = content.replace(/position=\{\[0, 0, 0\.31\]\}/g, 'position={[0, 0, 0.45]}');

// 9. Line 2278 (STM32): position={[0, 0, 0.51]} -> position={[0, 0, 0.62]}
content = content.replace(/position=\{\[0, 0, 0\.51\]\}/g, 'position={[0, 0, 0.62]}');

// 10. Line 2417: size.d / 2 + 0.02 -> size.d / 2 + 0.18
content = content.replace(/position=\{\[0, size\.h \* 0\.2, size\.d \/ 2 \+ 0\.02\]\}/g, 'position={[0, size.h * 0.2, size.d / 2 + 0.18]}');

// 11. Line 2799: size.d / 2 + 0.02 -> size.d / 2 + 0.18
content = content.replace(/position=\{\[0, 0, size\.d \/ 2 \+ 0\.02\]\}/g, 'position={[0, 0, size.d / 2 + 0.18]}');

// 12. Line 3437: size.d / 2 + 0.05 -> size.d / 2 + 0.18
content = content.replace(/position=\{\[0, 0, size\.d \/ 2 \+ 0\.05\]\}/g, 'position={[0, 0, size.d / 2 + 0.18]}');

// Also ensure polygonOffsetUnits={-10} is added wherever polygonOffsetFactor={-10} exists
content = content.replace(/polygonOffsetFactor=\{-10\}(?!\s+polygonOffsetUnits)/g, 'polygonOffsetFactor={-10} polygonOffsetUnits={-10}');

fs.writeFileSync('src/components/editor/ThreeDRealModels.tsx', content);
console.log('Finished updating IC text Z-offsets and polygonOffset props.');
