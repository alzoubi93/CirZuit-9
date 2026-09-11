const fs = require('fs');
let file = fs.readFileSync('src/lib/importKiCadPcb.ts', 'utf8');

// Update pad parsing to extract pad rotation (prot)
file = file.replace(/let px = 0, py = 0;/, "let px = 0, py = 0, prot = 0;");
file = file.replace(/px = parseFloat\(padSub\[1\] as string\) \|\| 0;\s*py = parseFloat\(padSub\[2\] as string\) \|\| 0;/, "px = parseFloat(padSub[1] as string) || 0; py = parseFloat(padSub[2] as string) || 0; prot = parseFloat(padSub[3] as string) || 0;");

// Update pad properties to include rotation
file = file.replace(/shape,\s*layer: padLayers,/, "shape, layer: padLayers, rotation: prot,");
file = file.replace(/shape,\s*layer: padLayers === "bottom_copper" \? "bottom_copper" : "top_copper",/, "shape, layer: padLayers === \"bottom_copper\" ? \"bottom_copper\" : \"top_copper\",");

// Apply pad rotation to primitives
file = file.replace(/const pxLocal = p\.x \+ px;\s*const pyLocal = p\.y \+ py;/, `const padRad = (prot * Math.PI) / 180;
                        const rotatedPdx = p.x * Math.cos(padRad) - p.y * Math.sin(padRad);
                        const rotatedPdy = p.x * Math.sin(padRad) + p.y * Math.cos(padRad);
                        const pxLocal = rotatedPdx + px;
                        const pyLocal = rotatedPdy + py;`);

fs.writeFileSync('src/lib/importKiCadPcb.ts', file);
