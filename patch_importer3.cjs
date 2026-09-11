const fs = require('fs');
const file = fs.readFileSync('src/lib/importKiCadPcb.ts', 'utf8');

let newFile = file.replace(/else if \(subHead === "fp_text"\) \{[\s\S]*?\}/, `else if (subHead === "fp_text") {
            if (sub[1] === "reference") fpRef = (sub[2] as string) || "";
            if (sub[1] === "value") fpVal = (sub[2] as string) || "";
            
            const textVal = (typeof sub[2] === "string" ? sub[2] : "TEXT");
            let tx = 0, ty = 0, rot: 0 | 90 | 180 | 270 = 0;
            let layer: import("./pcb").PcbLayerId = "silkscreen";
            let size = 1.0;

            for (const fpSub of sub) {
              if (!Array.isArray(fpSub)) continue;
              if (fpSub[0] === "at") {
                tx = parseFloat(fpSub[1] as string) || 0;
                ty = parseFloat(fpSub[2] as string) || 0;
                const rVal = parseFloat(fpSub[3] as string) || 0;
                if (rVal === 90 || rVal === 180 || rVal === 270) rot = rVal;
              } else if (fpSub[0] === "layer") {
                layer = mapKiCadPcbLayer(fpSub[1] as string);
              } else if (fpSub[0] === "effects") {
                for (const effSub of fpSub) {
                  if (Array.isArray(effSub) && effSub[0] === "font") {
                    for (const fontSub of effSub) {
                      if (Array.isArray(fontSub) && fontSub[0] === "size") {
                        size = parseFloat(fontSub[1] as string) || 1.0;
                      }
                    }
                  }
                }
              }
            }

            const rad = (frot * Math.PI) / 180;
            const absTx = fx + (tx * Math.cos(rad) - ty * Math.sin(rad));
            const absTy = fy + (tx * Math.sin(rad) + ty * Math.cos(rad));
            const absRot = (frot + rot) % 360;
            const finalRot = (absRot === 90 || absRot === 180 || absRot === 270) ? absRot : 0;

            registerPoint(absTx, absTy);
            
            // Only push non-reference/value text to avoid duplicating the renderer's text
            if (sub[1] !== "reference" && sub[1] !== "value") {
              texts.push({
                id: \`text-fp-\${Math.random().toString(36).substring(2, 9)}\`,
                text: textVal,
                x: absTx,
                y: absTy,
                size,
                layer,
                rotation: finalRot,
              });
            }
          }`);

fs.writeFileSync('src/lib/importKiCadPcb.ts', newFile);
