const fs = require('fs');
let file = fs.readFileSync('src/lib/importKiCadPcb.ts', 'utf8');

// Add bezierToPolyline
if (!file.includes('bezierToPolyline')) {
    const bezierCode = `
function bezierToPolyline(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}, p4: {x: number, y: number}, segments = 16): {x: number, y: number}[] {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const x = mt*mt*mt*p1.x + 3*mt*mt*t*p2.x + 3*mt*t*t*p3.x + t*t*t*p4.x;
    const y = mt*mt*mt*p1.y + 3*mt*mt*t*p2.y + 3*mt*t*t*p3.y + t*t*t*p4.y;
    pts.push({x, y});
  }
  return pts;
}
`;
    file = file.replace('// Helpers for Geometry Interpolation', '// Helpers for Geometry Interpolation\n' + bezierCode);
}

// Fix parsing for gr_curve
file = file.replace(/\} else if \(head === "gr_arc" && hasAngle\) \{[\s\S]*?\} else if \(head !== "gr_poly"\) \{/g, `} else if (head === "gr_arc" && hasAngle) {
          pts = centerArcToPolyline(x1, y1, x2, y2, angle);
        } else if (head === "gr_curve" && polyPts.length === 4) {
          pts = bezierToPolyline(polyPts[0], polyPts[1], polyPts[2], polyPts[3]);
        } else if (head !== "gr_poly") {`);

file = file.replace(/\} else if \(subHead === "fp_arc" && hasAngle\) \{[\s\S]*?\} else if \(subHead !== "fp_poly"\) \{/g, `} else if (subHead === "fp_arc" && hasAngle) {
              pts = centerArcToPolyline(x1, y1, x2, y2, angle);
            } else if (subHead === "fp_curve" && polyPts.length === 4) {
              pts = bezierToPolyline(polyPts[0], polyPts[1], polyPts[2], polyPts[3]);
            } else if (subHead !== "fp_poly") {`);

// Add custom pad primitives
// Find: } else if (padSub[0] === "net") { netId = parseInt(padSub[1] as string, 10); }
// Add primitives block right after
const customPadCode = `} else if (padSub[0] === "net") {
                netId = parseInt(padSub[1] as string, 10);
              } else if (padSub[0] === "primitives") {
                for (const prim of padSub) {
                  if (!Array.isArray(prim)) continue;
                  const pHead = prim[0];
                  if (pHead === "gr_poly" || pHead === "gr_line" || pHead === "gr_arc" || pHead === "gr_circle" || pHead === "gr_curve") {
                    let cx1 = 0, cy1 = 0, cx2 = 0, cy2 = 0, cx3 = 0, cy3 = 0, cWidth = 0.15;
                    let cHasMid = false;
                    let cAngle = 0;
                    let cHasAngle = false;
                    let cPolyPts: {x: number, y: number}[] = [];
                    for (const ps of prim) {
                      if (!Array.isArray(ps)) continue;
                      if (ps[0] === "start" || ps[0] === "center") {
                        cx1 = parseFloat(ps[1] as string) || 0; cy1 = parseFloat(ps[2] as string) || 0;
                      } else if (ps[0] === "mid") {
                        cx3 = parseFloat(ps[1] as string) || 0; cy3 = parseFloat(ps[2] as string) || 0;
                        cHasMid = true;
                      } else if (ps[0] === "end") {
                        cx2 = parseFloat(ps[1] as string) || 0; cy2 = parseFloat(ps[2] as string) || 0;
                      } else if (ps[0] === "angle") {
                        cAngle = parseFloat(ps[1] as string) || 0;
                        cHasAngle = true;
                      } else if (ps[0] === "width" || ps[0] === "stroke") {
                        if (ps[0] === "stroke") {
                          const wSub = ps.find(s => Array.isArray(s) && s[0] === "width") as any[];
                          if (wSub) cWidth = parseFloat(wSub[1] as string) || 0.15;
                        } else {
                          cWidth = parseFloat(ps[1] as string) || 0.15;
                        }
                      } else if (ps[0] === "pts") {
                        for (const xy of ps) {
                          if (Array.isArray(xy) && xy[0] === "xy") {
                            cPolyPts.push({ x: parseFloat(xy[1] as string) || 0, y: parseFloat(xy[2] as string) || 0 });
                          }
                        }
                      }
                    }
                    let cPts: {x: number, y: number}[] = [];
                    if (pHead === "gr_poly") {
                      cPts = cPolyPts;
                      if (cPts.length > 0 && (cPts[0].x !== cPts[cPts.length-1].x || cPts[0].y !== cPts[cPts.length-1].y)) cPts.push({...cPts[0]});
                    } else if (pHead === "gr_curve" && cPolyPts.length === 4) {
                      cPts = bezierToPolyline(cPolyPts[0], cPolyPts[1], cPolyPts[2], cPolyPts[3]);
                    } else if (pHead === "gr_circle") {
                      cPts = circleToPolyline(cx1, cy1, cx2, cy2);
                    } else if (pHead === "gr_arc" && cHasMid) {
                      cPts = arcToPolyline(cx1, cy1, cx3, cy3, cx2, cy2);
                    } else if (pHead === "gr_arc" && cHasAngle) {
                      cPts = centerArcToPolyline(cx1, cy1, cx2, cy2, cAngle);
                    } else if (pHead !== "gr_poly") {
                      cPts = [{ x: cx1, y: cy1 }, { x: cx2, y: cy2 }];
                    }
                    if (cPts.length > 0) {
                      // Apply pad transform and then footprint transform
                      const radRot = (frot * Math.PI) / 180;
                      const absPts = cPts.map(p => {
                        // local to pad
                        const pxLocal = p.x + px;
                        const pyLocal = p.y + py;
                        // local to footprint
                        const absX = fx + (pxLocal * Math.cos(radRot) - pyLocal * Math.sin(radRot));
                        const absY = fy + (pxLocal * Math.sin(radRot) + pyLocal * Math.cos(radRot));
                        registerPoint(absX, absY);
                        return { x: absX, y: absY };
                      });
                      tracks.push({
                        id: \`custompad-\${Math.random().toString(36).substring(2, 9)}\`,
                        layer: padLayers,
                        width: cWidth > 0 ? cWidth : 0.1,
                        points: absPts,
                        netId
                      });
                    }
                  }
                }
              }`;

file = file.replace(/\} else if \(padSub\[0\] === "net"\) \{[\s\S]*?netId = parseInt\(padSub\[1\] as string, 10\);\s*\}/, customPadCode);

fs.writeFileSync('src/lib/importKiCadPcb.ts', file);
