const fs = require('fs');
const file = fs.readFileSync('src/lib/importKiCadPcb.ts', 'utf8');

// Find the start and end of parseKiCadPcb function.
// Actually, it's easier to replace the function entirely.

const startIndex = file.indexOf('export function parseKiCadPcb');
const beforeCode = file.substring(0, startIndex);

const newFunction = `export function parseKiCadPcb(
  fileContent: string,
  filename: string = "kicad_pcb_board",
  lang: "ar" | "en" = "en"
): { doc: SchematicDoc; name: string } {
  const tracks: PcbTrack[] = [];
  const vias: PcbVia[] = [];
  const pads: PcbPad[] = [];
  const footprints: PcbFootprint[] = [];
  const texts: PcbText[] = [];
  
  const kicadNets = new Map<number, string>();
  const docNets: import("./pcb").PcbNet[] = [];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function registerPoint(x: number, y: number) {
    if (isNaN(x) || isNaN(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  try {
    const tokens = tokenizeSExpr(fileContent);
    const ast = parseSExprAST(tokens);

    // Find main (kicad_pcb ...) root node
    let mainNode: SExprAST | null = null;
    for (const item of ast) {
      if (Array.isArray(item) && item[0] === "kicad_pcb") {
        mainNode = item;
        break;
      }
    }

    const rootList = mainNode || ast;

    for (const node of rootList) {
      if (!Array.isArray(node)) continue;
      const head = node[0];
      
      if (head === "net") {
        const netId = parseInt(node[1] as string, 10);
        const netName = node[2] as string;
        if (!isNaN(netId) && netName) {
          kicadNets.set(netId, netName);
          docNets.push({
            id: netId,
            key: netName,
            name: netName,
            members: [],
            source: "imported",
          });
        }
      }

      // 1. Tracks / Segments: (segment (start X Y) (end X Y) (width W) (layer L) ...)
      if (head === "segment") {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0, width = 0.25;
        let layer: PcbLayerId = "top_copper";
        let netId: number | undefined;

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "start") {
            x1 = parseFloat(sub[1] as string) || 0;
            y1 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "end") {
            x2 = parseFloat(sub[1] as string) || 0;
            y2 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "width") {
            width = parseFloat(sub[1] as string) || 0.25;
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (sub[0] === "net") {
            netId = parseInt(sub[1] as string, 10);
          }
        }

        registerPoint(x1, y1);
        registerPoint(x2, y2);

        tracks.push({
          id: \`track-kicad-\${Math.random().toString(36).substring(2, 9)}\`,
          layer,
          width,
          points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
          netId,
        });
      }

      // 2. Arcs: (arc (start X Y) (mid X Y) (end X Y) (width W) (layer L) ...)
      else if (head === "arc") {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0, width = 0.25;
        let layer: PcbLayerId = "top_copper";
        let hasMid = false;
        let angle = 0;
        let hasAngle = false;
        let netId: number | undefined;

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "start") {
            x1 = parseFloat(sub[1] as string) || 0;
            y1 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "mid") {
            x3 = parseFloat(sub[1] as string) || 0;
            y3 = parseFloat(sub[2] as string) || 0;
            hasMid = true;
          } else if (sub[0] === "end") {
            x2 = parseFloat(sub[1] as string) || 0;
            y2 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "angle") {
            angle = parseFloat(sub[1] as string) || 0;
            hasAngle = true;
          } else if (sub[0] === "width") {
            width = parseFloat(sub[1] as string) || 0.25;
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (sub[0] === "net") {
            netId = parseInt(sub[1] as string, 10);
          }
        }

        let pts: {x: number, y: number}[] = [];
        if (hasMid) {
          pts = arcToPolyline(x1, y1, x3, y3, x2, y2);
          pts.forEach(p => registerPoint(p.x, p.y));
        } else if (hasAngle) {
          pts = centerArcToPolyline(x1, y1, x2, y2, angle);
          pts.forEach(p => registerPoint(p.x, p.y));
        } else {
          registerPoint(x1, y1);
          registerPoint(x2, y2);
          pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        }

        tracks.push({
          id: \`track-arc-kicad-\${Math.random().toString(36).substring(2, 9)}\`,
          layer,
          width,
          points: pts,
          netId,
        });
      }

      // 3. Vias: (via (at X Y) (size S) (drill D) ...)
      else if (head === "via") {
        let vx = 0, vy = 0, size = 0.8, drill = 0.4;
        let netId: number | undefined;
        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "at") {
            vx = parseFloat(sub[1] as string) || 0;
            vy = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "size") {
            size = parseFloat(sub[1] as string) || 0.8;
          } else if (sub[0] === "drill") {
            drill = parseFloat(sub[1] as string) || size * 0.5;
          } else if (sub[0] === "net") {
            netId = parseInt(sub[1] as string, 10);
          }
        }

        registerPoint(vx, vy);

        vias.push({
          id: \`via-kicad-\${Math.random().toString(36).substring(2, 9)}\`,
          x: vx,
          y: vy,
          diameter: size,
          drill,
          shape: "circle",
          netId,
        });
      }

      // 4. Graphical Elements (Lines, Arcs, Rects, Circles, Polygons)
      else if (head === "gr_line" || head === "gr_arc" || head === "gr_rect" || head === "gr_circle" || head === "gr_poly") {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0, width = 0.15;
        let layer: PcbLayerId = "outline";
        let hasMid = false;
        let angle = 0;
        let hasAngle = false;
        let polyPts: {x: number, y: number}[] = [];

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "start" || sub[0] === "center") {
            x1 = parseFloat(sub[1] as string) || 0;
            y1 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "mid") {
            x3 = parseFloat(sub[1] as string) || 0;
            y3 = parseFloat(sub[2] as string) || 0;
            hasMid = true;
          } else if (sub[0] === "end") {
            x2 = parseFloat(sub[1] as string) || 0;
            y2 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "angle") {
            angle = parseFloat(sub[1] as string) || 0;
            hasAngle = true;
          } else if (sub[0] === "width" || sub[0] === "stroke") {
            if (sub[0] === "stroke") {
              const wSub = sub.find(s => Array.isArray(s) && s[0] === "width") as any[];
              if (wSub) width = parseFloat(wSub[1] as string) || 0.15;
            } else {
              width = parseFloat(sub[1] as string) || 0.15;
            }
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (sub[0] === "pts") {
            for (const xy of sub) {
              if (Array.isArray(xy) && xy[0] === "xy") {
                polyPts.push({ x: parseFloat(xy[1] as string) || 0, y: parseFloat(xy[2] as string) || 0 });
              }
            }
          }
        }

        let pts: {x: number, y: number}[] = [];
        if (head === "gr_poly") {
          pts = polyPts;
          if (pts.length > 0 && (pts[0].x !== pts[pts.length-1].x || pts[0].y !== pts[pts.length-1].y)) {
             pts.push({...pts[0]});
          }
        } else if (head === "gr_circle") {
          pts = circleToPolyline(x1, y1, x2, y2);
        } else if (head === "gr_rect") {
          pts = [
            { x: x1, y: y1 },
            { x: x2, y: y1 },
            { x: x2, y: y2 },
            { x: x1, y: y2 },
            { x: x1, y: y1 } // close it
          ];
        } else if (head === "gr_arc" && hasMid) {
          pts = arcToPolyline(x1, y1, x3, y3, x2, y2);
        } else if (head === "gr_arc" && hasAngle) {
          pts = centerArcToPolyline(x1, y1, x2, y2, angle);
        } else if (head !== "gr_poly") {
          pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        }
        
        if (pts.length > 0) {
          pts.forEach(p => registerPoint(p.x, p.y));

          tracks.push({
            id: \`gr-\${head}-\${Math.random().toString(36).substring(2, 9)}\`,
            layer,
            width,
            points: pts,
          });
        }
      }
      
      // 4b. Zones
      else if (head === "zone") {
        let layer: PcbLayerId = "top_copper";
        let netId: number | undefined;
        let polyLists: {x: number, y: number}[][] = [];
        
        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (sub[0] === "net") {
            netId = parseInt(sub[1] as string, 10);
          } else if (sub[0] === "polygon" || sub[0] === "filled_polygon") {
            for (const pSub of sub) {
              if (Array.isArray(pSub) && pSub[0] === "pts") {
                let pts: {x: number, y: number}[] = [];
                for (const xy of pSub) {
                  if (Array.isArray(xy) && xy[0] === "xy") {
                    const x = parseFloat(xy[1] as string) || 0;
                    const y = parseFloat(xy[2] as string) || 0;
                    pts.push({ x, y });
                  }
                }
                if (pts.length > 0) polyLists.push(pts);
              }
            }
          }
        }
        
        polyLists.forEach(polyPts => {
           if (polyPts.length > 0) {
             if (polyPts[0].x !== polyPts[polyPts.length-1].x || polyPts[0].y !== polyPts[polyPts.length-1].y) {
               polyPts.push({ ...polyPts[0] });
             }
             polyPts.forEach(p => registerPoint(p.x, p.y));
             tracks.push({
               id: \`zone-\${Math.random().toString(36).substring(2, 9)}\`,
               layer,
               width: 0.15, 
               points: polyPts,
               netId,
             });
           }
        });
      }

      // 5. Graphic Text: (gr_text "TEXT" (at X Y [ROT]) (layer L) ...)
      else if (head === "gr_text") {
        const textVal = (typeof node[1] === "string" ? node[1] : "TEXT");
        let tx = 0, ty = 0, rot: 0 | 90 | 180 | 270 = 0;
        let layer: PcbLayerId = "silkscreen";
        let size = 1.2;

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "at") {
            tx = parseFloat(sub[1] as string) || 0;
            ty = parseFloat(sub[2] as string) || 0;
            const rVal = parseFloat(sub[3] as string) || 0;
            if (rVal === 90 || rVal === 180 || rVal === 270) rot = rVal;
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (sub[0] === "effects") {
            for (const effSub of sub) {
              if (Array.isArray(effSub) && effSub[0] === "font") {
                for (const fontSub of effSub) {
                  if (Array.isArray(fontSub) && fontSub[0] === "size") {
                    size = parseFloat(fontSub[1] as string) || 1.2;
                  }
                }
              }
            }
          }
        }

        registerPoint(tx, ty);

        texts.push({
          id: \`text-kicad-\${Math.random().toString(36).substring(2, 9)}\`,
          text: textVal,
          x: tx,
          y: ty,
          size,
          layer,
          rotation: rot,
        });
      }

      // 6. Footprints / Modules: (footprint "NAME" ...) or (module "NAME" ...)
      else if (head === "footprint" || head === "module") {
        let fx = 0, fy = 0, frot = 0;
        let fpRef = "";
        let fpVal = "";
        let fpSymbol = "ic";
        const fpPads: PcbFootprintPad[] = [];

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          const subHead = sub[0];

          if (subHead === "at") {
            fx = parseFloat(sub[1] as string) || 0;
            fy = parseFloat(sub[2] as string) || 0;
            frot = parseFloat(sub[3] as string) || 0;
          } else if (subHead === "property" && sub[1] === "Reference") {
            fpRef = (sub[2] as string) || "";
          } else if (subHead === "property" && sub[1] === "Value") {
            fpVal = (sub[2] as string) || "";
          } else if (subHead === "fp_text") {
            if (sub[1] === "reference") fpRef = (sub[2] as string) || "";
            if (sub[1] === "value") fpVal = (sub[2] as string) || "";
          }

          // Pads inside footprint
          else if (subHead === "pad") {
            const padNum = (sub[1] as string) || "1";
            const padType = (sub[2] as string) || "smd";
            const padShapeStr = (sub[3] as string) || "rect";

            let px = 0, py = 0;
            let pw = 1.0, ph = 1.0;
            let drill: number | undefined = undefined;
            let padLayers: ("top_copper" | "bottom_copper" | "multi_layer") = padType === "smd" ? "top_copper" : "multi_layer";
            let netId: number | undefined;
            
            for (const padSub of sub) {
              if (!Array.isArray(padSub)) continue;
              if (padSub[0] === "at") {
                px = parseFloat(padSub[1] as string) || 0;
                py = parseFloat(padSub[2] as string) || 0;
              } else if (padSub[0] === "size") {
                pw = parseFloat(padSub[1] as string) || 1.0;
                ph = parseFloat(padSub[2] as string) || 1.0;
              } else if (padSub[0] === "drill") {
                drill = parseFloat(padSub[1] as string) || 0.8;
              } else if (padSub[0] === "layers") {
                const layerList = padSub.slice(1).map((l) => String(l).toLowerCase());
                const hasFront = layerList.some((l) => l.includes("f.cu") || l.includes("top") || l === "*.cu");
                const hasBack = layerList.some((l) => l.includes("b.cu") || l.includes("bottom") || l === "*.cu");
                if (hasFront && hasBack) padLayers = "multi_layer";
                else if (hasBack) padLayers = "bottom_copper";
                else padLayers = "top_copper";
              } else if (padSub[0] === "net") {
                netId = parseInt(padSub[1] as string, 10);
              }
            }

            // Calculate absolute position of pad
            const rad = (frot * Math.PI) / 180;
            const absPx = fx + (px * Math.cos(rad) - py * Math.sin(rad));
            const absPy = fy + (px * Math.sin(rad) + py * Math.cos(rad));

            registerPoint(absPx, absPy);

            const shape: "rect" | "circle" = (padShapeStr === "circle" || padShapeStr === "oval") ? "circle" : "rect";

            fpPads.push({
              pinIndex: parseInt(padNum, 10) || 1,
              number: padNum,
              name: padNum,
              x: px,
              y: py,
              width: pw,
              height: ph,
              shape,
              layer: padLayers,
              drill,
              netId,
            });

            pads.push({
              id: \`pad-kicad-\${Math.random().toString(36).substring(2, 9)}\`,
              x: absPx,
              y: absPy,
              width: pw,
              height: ph,
              shape,
              layer: padLayers === "bottom_copper" ? "bottom_copper" : "top_copper",
              drill,
              number: padNum,
              netId,
            });
          }

          // Silkscreen / graphics inside footprint
          else if (subHead === "fp_line" || subHead === "fp_arc" || subHead === "fp_rect" || subHead === "fp_circle" || subHead === "fp_poly") {
            let x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0, width = 0.15;
            let layer: PcbLayerId = "silkscreen";
            let hasMid = false;
            let angle = 0;
            let hasAngle = false;
            let polyPts: {x: number, y: number}[] = [];

            for (const fpSub of sub) {
              if (!Array.isArray(fpSub)) continue;
              if (fpSub[0] === "start" || fpSub[0] === "center") {
                x1 = parseFloat(fpSub[1] as string) || 0;
                y1 = parseFloat(fpSub[2] as string) || 0;
              } else if (fpSub[0] === "mid") {
                x3 = parseFloat(fpSub[1] as string) || 0;
                y3 = parseFloat(fpSub[2] as string) || 0;
                hasMid = true;
              } else if (fpSub[0] === "end") {
                x2 = parseFloat(fpSub[1] as string) || 0;
                y2 = parseFloat(fpSub[2] as string) || 0;
              } else if (fpSub[0] === "angle") {
                angle = parseFloat(fpSub[1] as string) || 0;
                hasAngle = true;
              } else if (fpSub[0] === "width" || fpSub[0] === "stroke") {
                if (fpSub[0] === "stroke") {
                  const wSub = fpSub.find(s => Array.isArray(s) && s[0] === "width") as any[];
                  if (wSub) width = parseFloat(wSub[1] as string) || 0.15;
                } else {
                  width = parseFloat(fpSub[1] as string) || 0.15;
                }
              } else if (fpSub[0] === "layer") {
                layer = mapKiCadPcbLayer(fpSub[1] as string);
              } else if (fpSub[0] === "pts") {
                for (const xy of fpSub) {
                  if (Array.isArray(xy) && xy[0] === "xy") {
                    polyPts.push({ x: parseFloat(xy[1] as string) || 0, y: parseFloat(xy[2] as string) || 0 });
                  }
                }
              }
            }

            let pts: {x: number, y: number}[] = [];
            if (subHead === "fp_poly") {
              pts = polyPts;
              if (pts.length > 0 && (pts[0].x !== pts[pts.length-1].x || pts[0].y !== pts[pts.length-1].y)) {
                 pts.push({...pts[0]});
              }
            } else if (subHead === "fp_circle") {
              pts = circleToPolyline(x1, y1, x2, y2);
            } else if (subHead === "fp_rect") {
              pts = [
                { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }, { x: x1, y: y1 }
              ];
            } else if (subHead === "fp_arc" && hasMid) {
              pts = arcToPolyline(x1, y1, x3, y3, x2, y2);
            } else if (subHead === "fp_arc" && hasAngle) {
              pts = centerArcToPolyline(x1, y1, x2, y2, angle);
            } else if (subHead !== "fp_poly") {
              pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
            }
            
            if (pts.length > 0) {
              const rad = (frot * Math.PI) / 180;
              const absPts = pts.map(p => {
                const absX = fx + (p.x * Math.cos(rad) - p.y * Math.sin(rad));
                const absY = fy + (p.x * Math.sin(rad) + p.y * Math.cos(rad));
                registerPoint(absX, absY);
                return { x: absX, y: absY };
              });
  
              tracks.push({
                id: \`fp-\${subHead}-\${Math.random().toString(36).substring(2, 9)}\`,
                layer,
                width,
                points: absPts,
              });
            }
          }
        }

        registerPoint(fx, fy);

        if (fpRef) {
          if (/^r[0-9]/i.test(fpRef)) fpSymbol = "resistor";
          else if (/^c[0-9]/i.test(fpRef)) fpSymbol = "capacitor";
          else if (/^l[0-9]/i.test(fpRef)) fpSymbol = "inductor";
          else if (/^d[0-9]/i.test(fpRef)) fpSymbol = "diode2";
          else if (/^q[0-9]/i.test(fpRef)) fpSymbol = "transistor";
          else if (/^u[0-9]/i.test(fpRef)) fpSymbol = "opamp4";
        }

        footprints.push({
          id: \`fp-\${Math.random().toString(36).substring(2, 9)}\`,
          reference: fpRef || undefined,
          value: fpVal || undefined,
          symbol: fpSymbol,
          x: fx,
          y: fy,
          rotation: frot,
          pads: fpPads,
        });
      }
    }
  } catch (err) {
    console.warn("KiCad PCB AST parse warning, falling back to regex scanner", err);
  }

  // Regex fallback scanner if AST missed segments or points
  if (tracks.length === 0 && pads.length === 0 && vias.length === 0) {
    // Regex for segments
    const segMatches = fileContent.matchAll(/\\(segment\\s+\\(start\\s+([\\d.-]+)\\s+([\\d.-]+)\\)\\s+\\(end\\s+([\\d.-]+)\\s+([\\d.-]+)\\)\\s+\\(width\\s+([\\d.-]+)\\)\\s+\\(layer\\s+"?([^"\\s)]+)"?\\)/gi);
    for (const m of segMatches) {
      const x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
      const x2 = parseFloat(m[3]), y2 = parseFloat(m[4]);
      const width = parseFloat(m[5]) || 0.25;
      const layer = mapKiCadPcbLayer(m[6] || "F.Cu");

      registerPoint(x1, y1);
      registerPoint(x2, y2);

      tracks.push({
        id: \`track-fb-\${Math.random().toString(36).substring(2, 9)}\`,
        layer,
        width,
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
      });
    }

    // Regex for vias
    const viaMatches = fileContent.matchAll(/\\(via\\s+\\(at\\s+([\\d.-]+)\\s+([\\d.-]+)\\)\\s+\\(size\\s+([\\d.-]+)\\)(?:\\s+\\(drill\\s+([\\d.-]+)\\))?/gi);
    for (const m of viaMatches) {
      const vx = parseFloat(m[1]), vy = parseFloat(m[2]);
      const size = parseFloat(m[3]) || 0.8;
      const drill = parseFloat(m[4]) || size * 0.5;

      registerPoint(vx, vy);

      vias.push({
        id: \`via-fb-\${Math.random().toString(36).substring(2, 9)}\`,
        x: vx,
        y: vy,
        diameter: size,
        drill,
        shape: "circle",
      });
    }
  }

  // Calculate board dimensions and offset
  if (minX === Infinity || minY === Infinity) {
    minX = 0; minY = 0; maxX = 100; maxY = 80;
  }

  const offsetX = -minX + 5; // 5mm margin
  const offsetY = -minY + 5;

  const boardWidth = Number(Math.max(20, (maxX - minX) + 10).toFixed(2));
  const boardHeight = Number(Math.max(20, (maxY - minY) + 10).toFixed(2));

  // Offset all elements so min coordinate is at margin
  tracks.forEach((t) => {
    t.points = t.points.map((p) => ({
      x: Number((p.x + offsetX).toFixed(3)),
      y: Number((p.y + offsetY).toFixed(3)),
    }));
  });

  pads.forEach((p) => {
    p.x = Number((p.x + offsetX).toFixed(3));
    p.y = Number((p.y + offsetY).toFixed(3));
  });

  vias.forEach((v) => {
    v.x = Number((v.x + offsetX).toFixed(3));
    v.y = Number((v.y + offsetY).toFixed(3));
  });

  footprints.forEach((f) => {
    f.x = Number((f.x + offsetX).toFixed(3));
    f.y = Number((f.y + offsetY).toFixed(3));
  });

  texts.forEach((t) => {
    t.x = Number((t.x + offsetX).toFixed(3));
    t.y = Number((t.y + offsetY).toFixed(3));
  });

  const pcbDoc: PcbDoc = {
    version: 1,
    unit: "mm",
    width: boardWidth,
    height: boardHeight,
    gridMm: 1,
    layers: DEFAULT_LAYERS,
    tracks,
    vias,
    pads,
    footprints,
    texts,
    nets: docNets,
    measures: [],
    ratsnestVisible: false,
    isImportedGerber: true,
    isImportedKiCadPcb: true,
    disableDrc: true,
  };

  const cleanProjName = filename.replace(/\\.(kicad_pcb|kicad_sch|zip|json|xml)$/i, "");

  return {
    name: cleanProjName,
    doc: {
      nodes: [],
      wires: [],
      canvasColor: "white",
      defaultWireColor: "black",
      pcb: pcbDoc,
    },
  };
}
`;

fs.writeFileSync('src/lib/importKiCadPcb.ts', beforeCode + newFunction);
