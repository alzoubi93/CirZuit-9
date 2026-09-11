import re

file_path = 'src/components/editor/PcbElements.tsx'
with open(file_path, 'r') as f:
    content = f.read()

start_marker = "    // 4. Transistor, MOSFET, or Voltage Regulator"
end_marker = "    // 6. Resistor"

start_idx = content.find(start_marker)
end_idx = content.find(end_marker)

new_render_code = """    // 4. Transistor, MOSFET, or Voltage Regulator (Standard Packages)
    if (isTransistor || isRegulator) {
      if (fp.pads.length === 3) {
        const isSmd = fp.pads[0].shape === "rect"; // heuristic for SMD
        if (isSmd) {
           // SOT-23 / DPAK
           return (
             <g style={{ pointerEvents: "none" }}>
               {/* Body */}
               <rect x={rectX + 0.2} y={rectY + 0.5} width={rectW - 0.4} height={rectH - 1.0} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
               <line x1={rectX + 0.2} y1={rectY + 0.8} x2={rectX + 0.6} y2={rectY + 0.5} stroke={silkColor} strokeWidth={0.15} />
               {/* Tab for DPAK if large */}
               {rectW > 5.0 && (
                 <rect x={rectX + rectW*0.2} y={rectY - 0.8} width={rectW*0.6} height={0.8} fill="none" stroke={silkColor} strokeWidth={0.15} />
               )}
               {/* Pin designation labels */}
               {fp.pads.map((p) => {
                 if (p.number || p.name) {
                   return (
                     <text
                       key={p.pinIndex}
                       x={p.x + (p.x < nonPolarCx ? -1.5 : 1.5)}
                       y={p.y}
                       fill={silkColor}
                       fontSize={0.8}
                       fontWeight="bold"
                       fontFamily="monospace"
                       textAnchor="middle"
                       dominantBaseline="middle"
                       style={{ pointerEvents: "none", opacity: 0.9 }}
                     >
                        {p.number || p.name}
                      </text>
                   );
                 }
                 return null;
               })}
             </g>
           );
        } else {
           const isTO220 = fp.packageId === "to220" || rectW > 6.0;
           if (isTO220) {
              // TO-220 outline (Standing up)
              // Standard width is ~10.5mm, depth is ~4.5mm
              const isVerticalFlat = Math.abs(fp.pads[0].x - fp.pads[1].x) < 0.5;
              const padSpaceX = maxPX - minPX;
              const padSpaceY = maxPY - minPY;
              
              let rx = minPX - 1.5;
              let ry = minPY - 2.5;
              let rw = padSpaceX + 3.0;
              let rh = padSpaceY + 4.0;
              
              if (isVerticalFlat) {
                rx = minPX - 2.5;
                ry = minPY - 1.5;
                rw = padSpaceX + 4.0;
                rh = padSpaceY + 3.0;
              }

              return (
                <g style={{ pointerEvents: "none" }}>
                  {/* Main Plastic Body */}
                  <rect x={rx} y={ry} width={rw} height={rh} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.2} />
                  
                  {/* Metal Heatsink Tab Marker (Double line on one side) */}
                  {isVerticalFlat ? (
                    <line x1={rx + 0.8} y1={ry} x2={rx + 0.8} y2={ry + rh} stroke={silkColor} strokeWidth={0.15} />
                  ) : (
                    <line x1={rx} y1={ry + 0.8} x2={rx + rw} y2={ry + 0.8} stroke={silkColor} strokeWidth={0.15} />
                  )}
                  
                  {/* Pin designation labels */}
                  {fp.pads.map((p) => {
                    if (p.number || p.name) {
                      return (
                        <text
                          key={p.pinIndex}
                          x={p.x + (isVerticalFlat ? 2.5 : 0)}
                          y={p.y + (isVerticalFlat ? 0 : 3.0)}
                          fill={silkColor}
                          fontSize={1.2}
                          fontWeight="bold"
                          fontFamily="monospace"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ pointerEvents: "none", opacity: 0.9 }}
                        >
                          {p.number || p.name}
                        </text>
                      );
                    }
                    return null;
                  })}
                </g>
              );
           } else {
              // TO-92 (D-shape) standard
              const pad0 = fp.pads[0];
              const pad1 = fp.pads[1];
              
              const isVerticalFlat = Math.abs(pad0.x - pad1.x) < 0.5; // Pins are vertically aligned
              
              let pathD = "";
              const arcR = Math.max(rectW, rectH) / 1.5;
              
              if (isVerticalFlat) {
                // Flat edge on the left, curved on the right
                pathD = `M ${minPX - 1.0} ${minPY - 1.5} 
                         L ${minPX + 1.0} ${minPY - 1.5} 
                         A ${arcR} ${arcR} 0 0 1 ${minPX + 1.0} ${maxPY + 1.5} 
                         L ${minPX - 1.0} ${maxPY + 1.5} Z`;
              } else {
                // Flat edge on bottom, curved on top
                pathD = `M ${minPX - 1.5} ${maxPY + 1.0} 
                         L ${maxPX + 1.5} ${maxPY + 1.0} 
                         A ${arcR} ${arcR} 0 0 1 ${maxPX + 1.5} ${maxPY - 1.0} 
                         L ${minPX - 1.5} ${maxPY - 1.0} Z`;
              }

              return (
                <g style={{ pointerEvents: "none" }}>
                  <path
                    d={pathD}
                    fill="none"
                    stroke={silkColor}
                    strokeWidth={0.2}
                  />
                  {/* Pin designation labels placed neatly beside the pads */}
                  {fp.pads.map((p) => {
                    if (p.number || p.name) {
                      return (
                        <text
                          key={p.pinIndex}
                          x={p.x + (isVerticalFlat ? -2.5 : 0)}
                          y={p.y + (isVerticalFlat ? 0 : 2.5)}
                          fill={silkColor}
                          fontSize={1.2}
                          fontWeight="bold"
                          fontFamily="monospace"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ pointerEvents: "none", opacity: 0.9 }}
                        >
                          {p.number || p.name}
                        </text>
                      );
                    }
                    return null;
                  })}
                </g>
              );
           }
        }
      }
    }

"""

if start_idx != -1 and end_idx != -1:
    content = content[:start_idx] + new_render_code + content[end_idx:]
    with open(file_path, 'w') as f:
        f.write(content)
    print("Patched successfully")
else:
    print("Could not find markers")
