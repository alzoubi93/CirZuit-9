const fs = require('fs');

const content = fs.readFileSync('src/components/editor/ThreeDRealModels.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (line.includes('<Text')) {
    console.log(`Line ${i+1}: ${line.trim()}`);
    // print next 3 lines as well
    for (let j = 1; j <= 3; j++) {
      if (lines[i+j]) console.log(`   +${j}: ${lines[i+j].trim()}`);
    }
  }
});
