const fs = require('fs');
let file = fs.readFileSync('src/lib/importKiCadPcb.ts', 'utf8');

file = file.replace(/\} else if \(head !== "gr_poly"\) \{/g, "} else {");
file = file.replace(/\} else if \(subHead !== "fp_poly"\) \{/g, "} else {");
file = file.replace(/\} else if \(pHead !== "gr_poly"\) \{/g, "} else {");

fs.writeFileSync('src/lib/importKiCadPcb.ts', file);
