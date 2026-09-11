import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Update Pad Color
old_pad_color = """                          const padColor = isPadSelected 
                            ? "#60a5fa" 
                            : isPadHi 
                              ? "#3b82f6" 
                              : (pad.layer === "bottom_copper" 
                                ? "#3b82f6" 
                                : "#22c55e");"""

new_pad_color = """                          const padColor = isPadSelected 
                            ? "#60a5fa" 
                            : (pad.layer === "bottom_copper" 
                                ? "#3b82f6" 
                                : "#ef4444");"""
content = content.replace(old_pad_color, new_pad_color)

# Update Pad Rect highlight
old_rect = """                                {pad.shape === "rect" ? (
                                  <rect 
                                    x={pad.x - pad.width/2} 
                                    y={pad.y - pad.height/2} 
                                    width={pad.width} 
                                    height={pad.height} 
                                    fill={padColor} 
                                    stroke={isPadSelected ? "#3b82f6" : isPadHi ? "#93c5fd" : "none"}
                                    strokeWidth={0.15}
                                  />
                                ) : ("""

new_rect = """                                {isPadHi && pad.shape === "rect" && (
                                  <rect x={pad.x - pad.width/2 - 0.5} y={pad.y - pad.height/2 - 0.5} width={pad.width + 1} height={pad.height + 1} fill="none" stroke="#3b82f6" strokeWidth={0.8} opacity={0.5} />
                                )}
                                {isPadHi && pad.shape === "round" && (
                                  <circle cx={pad.x} cy={pad.y} r={Math.max(pad.width, pad.height)/2 + 0.5} fill="none" stroke="#3b82f6" strokeWidth={0.8} opacity={0.5} />
                                )}
                                {pad.shape === "rect" ? (
                                  <rect 
                                    x={pad.x - pad.width/2} 
                                    y={pad.y - pad.height/2} 
                                    width={pad.width} 
                                    height={pad.height} 
                                    fill={padColor} 
                                    stroke={isPadSelected ? "#ffffff" : "none"}
                                    strokeWidth={0.15}
                                  />
                                ) : ("""
content = content.replace(old_rect, new_rect)

# Update Pad Circle highlight
old_circ = """                                  <circle
                                    cx={pad.x}
                                    cy={pad.y}
                                    r={Math.max(pad.width, pad.height)/2}
                                    fill={padColor}
                                    stroke={isPadSelected ? "#3b82f6" : isPadHi ? "#93c5fd" : "none"}
                                    strokeWidth={0.15}
                                  />
                                )}"""

new_circ = """                                  <circle
                                    cx={pad.x}
                                    cy={pad.y}
                                    r={Math.max(pad.width, pad.height)/2}
                                    fill={padColor}
                                    stroke={isPadSelected ? "#ffffff" : "none"}
                                    strokeWidth={0.15}
                                  />
                                )}"""
content = content.replace(old_circ, new_circ)

# Update Ratsnest
old_rats = """                  return (
                    <line
                      key={i}
                      x1={line.p1.x}
                      y1={line.p1.y}
                      x2={line.p2.x}
                      y2={line.p2.y}
                      stroke={isHi ? "#3b82f6" : "rgba(100, 100, 100, 0.5)"}
                      strokeWidth={isHi ? 0.3 : 0.12}
                      strokeDasharray={isHi ? "" : "0.6 0.4"}
                      opacity={dim ? 0.15 : isHi ? 1 : 0.85}
                    />
                  );"""

new_rats = """                  return (
                    <g key={i}>
                      {isHi && (
                        <line
                          x1={line.p1.x}
                          y1={line.p1.y}
                          x2={line.p2.x}
                          y2={line.p2.y}
                          stroke="#3b82f6"
                          strokeWidth={0.6}
                          opacity={0.4}
                        />
                      )}
                      <line
                        x1={line.p1.x}
                        y1={line.p1.y}
                        x2={line.p2.x}
                        y2={line.p2.y}
                        stroke={isHi ? "#2563eb" : "rgba(100, 100, 100, 0.5)"}
                        strokeWidth={isHi ? 0.15 : 0.12}
                        strokeDasharray={isHi ? "" : "0.6 0.4"}
                        opacity={dim ? 0.15 : isHi ? 1 : 0.85}
                      />
                    </g>
                  );"""
content = content.replace(old_rats, new_rats)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
