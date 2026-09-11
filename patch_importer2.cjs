const fs = require('fs');
const file = fs.readFileSync('src/lib/importKiCadPcb.ts', 'utf8');

let newFile = file.replace(/head === "gr_line" \|\| head === "gr_arc" \|\| head === "gr_rect" \|\| head === "gr_circle" \|\| head === "gr_poly"/g, 'head === "gr_line" || head === "gr_arc" || head === "gr_rect" || head === "gr_circle" || head === "gr_poly" || head === "gr_curve"');

newFile = newFile.replace(/subHead === "fp_line" \|\| subHead === "fp_arc" \|\| subHead === "fp_rect" \|\| subHead === "fp_circle" \|\| subHead === "fp_poly"/g, 'subHead === "fp_line" || subHead === "fp_arc" || subHead === "fp_rect" || subHead === "fp_circle" || subHead === "fp_poly" || subHead === "fp_curve"');

newFile = newFile.replace(/head === "gr_poly"/g, 'head === "gr_poly" || head === "gr_curve"');
newFile = newFile.replace(/subHead === "fp_poly"/g, 'subHead === "fp_poly" || subHead === "fp_curve"');


fs.writeFileSync('src/lib/importKiCadPcb.ts', newFile);
