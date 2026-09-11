import re
with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

old_fp = """              {visibleFootprints.map((fp) => {
                const sel = selection?.kind === "footprint" && selection.id === fp.id;
                const bb = footprintBBox(fp);
                return (
                  <g key={fp.id}
                    onPointerDown={(e) => {
                      if (tool !== "select" && tool !== "group_select") return;
                      e.stopPropagation();
                      registerPointer(e);
                      startDragGroup(e, "footprint", fp.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setPropsOpen(true);
                    }}
                    style={{ cursor: (tool === "select" || tool === "group_select") ? "move" : "default" }}
                  >
                    <rect x={bb.x} y={bb.y} width={bb.w} height={bb.h}
                      fill={groupSelected?.footprints.includes(fp.id) ? "rgba(245, 158, 11, 0.35)" : sel ? "rgba(59, 130, 246, 0.15)" : "rgba(239, 68, 68, 0.02)"}
                      stroke={groupSelected?.footprints.includes(fp.id) ? "#f59e0b" : sel ? "#3b82f6" : "#ef4444"}
                      strokeWidth={groupSelected?.footprints.includes(fp.id) ? 0.25 : sel ? 0.4 : 0.08}
                      rx={0.5}
                    />
                    {sel && (
                      <rect x={bb.x - 0.4} y={bb.y - 0.4} width={bb.w + 0.8} height={bb.h + 0.8}
                        fill="none" stroke="#3b82f6" strokeWidth={0.3} opacity={0.7} rx={0.7}
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                    <g transform={`translate(${fp.x},${fp.y}) rotate(${fp.rotation})`}>
                      {(() => {
                        const netIndex = schematicNetIndex;
                        return fp.pads.map((pad) => {
                          const netId = netIndex.pinNet.get(`${fp.id}:${pad.pinIndex}`);
                          const isPadHi = netId !== undefined && highlightedNetIds.includes(netId);
                          const isPadSelected = selectedPin?.nodeId === fp.id && selectedPin?.pinIndex === pad.pinIndex;
                          const padColor = isPadSelected 
                            ? "#60a5fa" 
                            : (pad.layer === "bottom_copper" 
                                ? "#3b82f6" 
                                : "#ef4444");
                          return (
                            <g key={pad.pinIndex}
                              onPointerDown={(e) => {
                                  if (tool === "select" || tool === "group_select") {
                                    e.stopPropagation();
                                    setSelectedPin({ nodeId: fp.id, pinIndex: pad.pinIndex });
                                    setSelectedId(fp.id);
                                    setSelectedTrackId(null);
                                    setSelectedWireId(null);
                                    registerPointer(e);
                                    startDragGroup(e, "footprint", fp.id);
                                  } else if (tool === "track") {
                                    e.stopPropagation();
                                    const rad = (fp.rotation * Math.PI) / 180;
                                    const cos = Math.cos(rad);
                                    const sin = Math.sin(rad);
                                    const worldX = fp.x + (pad.x * cos - pad.y * sin);
                                    const worldY = fp.y + (pad.x * sin + pad.y * cos);
                                    handlePadRouteClick({ x: worldX, y: worldY });
                                  }
                                }}
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setPropsOpen(true);
                                }}
                                style={{ cursor: "pointer" }}
                              >
                                {/* Larger transparent hit area for easy selection */}
                                {pad.shape === "rect" ? (
                                  <rect x={pad.x - (pad.width + 0.8) / 2} y={pad.y - (pad.height + 0.8) / 2} width={pad.width + 0.8} height={pad.height + 0.8} fill="transparent" style={{ cursor: "pointer" }} />
                                ) : (
                                  <circle cx={pad.x} cy={pad.y} r={(pad.width + 0.8) / 2} fill="transparent" style={{ cursor: "pointer" }} />
                                )}
                                {isPadHi && pad.shape === "rect" && (
                                  <rect x={pad.x - pad.width/2 - 0.5} y={pad.y - pad.height/2 - 0.5} width={pad.width + 1} height={pad.height + 1} fill="none" stroke="#3b82f6" strokeWidth={0.8} opacity={0.5} />
                                )}
                                {isPadHi && pad.shape === "round" && (
                                  <circle cx={pad.x} cy={pad.y} r={Math.max(pad.width, pad.height)/2 + 0.5} fill="none" stroke="#3b82f6" strokeWidth={0.8} opacity={0.5} />
                                )}
                                {isPadSelected && pad.shape === "rect" && (
                                  <rect x={pad.x - pad.width/2 - 0.35} y={pad.y - pad.height/2 - 0.35} width={pad.width + 0.7} height={pad.height + 0.7} fill="none" stroke="#3b82f6" strokeWidth={0.3} rx={0.2} style={{ pointerEvents: "none" }} />
                                )}
                                {isPadSelected && pad.shape === "round" && (
                                  <circle cx={pad.x} cy={pad.y} r={pad.width/2 + 0.35} fill="none" stroke="#3b82f6" strokeWidth={0.3} style={{ pointerEvents: "none" }} />
                                )}
                                {pad.shape === "rect" ? (
                                  <rect 
                                    x={pad.x - pad.width/2} 
                                    y={pad.y - pad.height/2} 
                                    width={pad.width} 
                                    height={pad.height} 
                                    fill={padColor} 
                                    stroke={isPadSelected ? "#3b82f6" : "none"}
                                    strokeWidth={0.15}
                                  />
                                ) : (
                                  <circle 
                                    cx={pad.x} 
                                    cy={pad.y} 
                                    r={pad.width/2} 
                                    fill={padColor} 
                                    stroke={isPadSelected ? "#3b82f6" : isPadHi ? "#93c5fd" : "none"}
                                    strokeWidth={0.15}
                                  />
                                )}
                                {pad.drill && <circle cx={pad.x} cy={pad.y} r={pad.drill/2} fill="#000000" />}
                                <text x={pad.x} y={pad.y - pad.height/2 - 0.3} fontSize={0.9} fill="#ffffff" textAnchor="middle">{pad.number}</text>
                              </g>
                            );
                          });
                        })()}
                      </g>
                      <text x={fp.x} y={fp.y + bb.h / 2 + 0.2} fontSize={1.2} fill="#94a3b8" textAnchor="middle" fontWeight="bold">
                        {fp.reference}
                      </text>
                      <g style={{ pointerEvents: "none" }}>
                        {fp.lines.map((ln, i) => (
                          <line key={i} x1={fp.x + ln.x1} y1={fp.y + ln.y1} x2={fp.x + ln.x2} y2={fp.y + ln.y2} stroke="#fcd34d" strokeWidth={0.15} />
                        ))}
                        {fp.circles?.map((c, i) => (
                          <circle key={i} cx={fp.x + c.x} cy={fp.y + c.y} r={c.r} fill="none" stroke="#fcd34d" strokeWidth={0.15} />
                        ))}
                      </g>
                    </g>
                  );
                })}"""

new_fp = """              {visibleFootprints.map((fp) => {
                const sel = selection?.kind === "footprint" && selection.id === fp.id;
                const isGroupSel = groupSelected?.footprints.includes(fp.id) || false;
                return <MemoizedPcbFootprint key={fp.id} fp={fp} sel={sel} isGroupSel={isGroupSel} netIndex={schematicNetIndex} highlightedNetIds={highlightedNetIds} selectedPin={selectedPin} onPointerDown={onFootprintPointerDown} onDoubleClick={onFootprintDoubleClick} onPadPointerDown={onFootprintPadPointerDown} onPadDoubleClick={onFootprintPadDoubleClick} />;
              })}"""

content = content.replace(old_fp, new_fp)
with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)

