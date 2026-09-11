import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Pad
old_pad = """              {visiblePads.map((p) => {
                const layer = pcb.layers.find((l) => l.id === p.layer);
                if (!layer?.visible) return null;
                const sel = selection?.kind === "pad" && selection.id === p.id;
                const isGroupSel = groupSelected?.pads.includes(p.id);
                const padColor = isGroupSel ? "#f59e0b" : sel ? "#60a5fa" : (p.layer === "bottom_copper" ? "#3b82f6" : "#22c55e");
                return (
                  <g key={p.id} onPointerDown={(e) => {
                    e.stopPropagation();
                    if (tool === "select" || tool === "group_select") {
                      registerPointer(e);
                      startDragGroup(e, "pad", p.id);
                      onBackgroundClick?.();
                    } else if (tool === "track") {
                      handlePadRouteClick({ x: p.x, y: p.y });
                    }
                  }}>
                    {/* Larger transparent hit area for easy handling */}
                    {p.shape === "rect" ? (
                      <rect x={p.x - (p.width + 1.2) / 2} y={p.y - (p.height + 1.2) / 2} width={p.width + 1.2} height={p.height + 1.2} fill="transparent" style={{ cursor: "pointer" }} />
                    ) : (
                      <circle cx={p.x} cy={p.y} r={(p.width + 1.2) / 2} fill="transparent" style={{ cursor: "pointer" }} />
                    )}
                    {p.shape === "rect" ? (
                      <rect x={p.x - p.width / 2} y={p.y - p.height / 2} width={p.width} height={p.height} fill={padColor} stroke={isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : "none"} strokeWidth={isGroupSel ? 0.25 : 0.1} />
                    ) : (
                      <circle cx={p.x} cy={p.y} r={p.width / 2} fill={padColor} stroke={isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : "none"} strokeWidth={isGroupSel ? 0.25 : 0.1} />
                    )}
                    {p.drill && <circle cx={p.x} cy={p.y} r={p.drill / 2} fill="#000000" />}
                  </g>
                );
              })}"""

new_pad = """              {visiblePads.map((p) => {
                const layer = pcb.layers.find((l) => l.id === p.layer);
                const sel = selection?.kind === "pad" && selection.id === p.id;
                const isGroupSel = groupSelected?.pads.includes(p.id) || false;
                return <MemoizedPcbPad key={p.id} pad={p} layer={layer} sel={sel} isGroupSel={isGroupSel} onPointerDown={onPadPointerDown} />;
              })}"""

content = content.replace(old_pad, new_pad)

# Track
old_track = """              {visibleTracks.map((tr) => {
                const layer = pcb.layers.find((l) => l.id === tr.layer);
                if (!layer?.visible) return null;
                
                const isCopper = tr.layer === "top_copper" || tr.layer === "bottom_copper";
                if (!isCopper) return null;

                const d = tr.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
                const sel = selectedTrackId === tr.id;
                const trackNetId = trackNetMap.get(tr.id);
                const isHi = trackNetId !== undefined && highlightedNetIds.includes(trackNetId);
                const isGroupSel = groupSelected?.tracks.includes(tr.id);
                
                return (
                  <g key={tr.id}>
                    {/* Wider transparent overlay for easy selection clicking */}
                    <path d={d} stroke="transparent" strokeWidth={tr.width + 12.0} fill="none" strokeLinecap="round" strokeLinejoin="round"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        registerPointer(e);
                        startDragGroup(e, "track", tr.id);
                        selectNetInSchematic(tr.netId);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setPropsOpen(true);
                      }}
                      style={{ cursor: "pointer" }}
                    />
                    
                    {/* Selected track is rendered directly here to overlap grouped paths */}
                    {sel && (
                      <path d={d} stroke="#3b82f6" strokeWidth={tr.width * 1.5}
                        fill="none" strokeLinecap="round" strokeLinejoin="round"
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                    
                    {/* Neon glow effect for highlighted track */}
                    {isHi && (
                      <path d={d} stroke="#3b82f6" strokeWidth={tr.width * 2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.5} style={{ pointerEvents: "none" }} />
                    )}

                    {/* Group selection amber glow */}
                    {isGroupSel && (
                      <path d={d} stroke="#f59e0b" strokeWidth={tr.width + 2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} style={{ pointerEvents: "none" }} />
                    )}
                    
                    {/* Semi-transparent blue selection highlight outline */}
                    {sel && (
                      <path d={d} stroke="rgba(59, 130, 246, 0.6)" strokeWidth={tr.width + 0.8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} style={{ pointerEvents: "none" }} />
                    )}
                  </g>
                );
              })}"""

new_track = """              {visibleTracks.map((tr) => {
                const layer = pcb.layers.find((l) => l.id === tr.layer);
                const sel = selectedTrackId === tr.id;
                const trackNetId = trackNetMap.get(tr.id);
                const isHi = trackNetId !== undefined && highlightedNetIds.includes(trackNetId);
                const isGroupSel = groupSelected?.tracks.includes(tr.id) || false;
                
                return <MemoizedPcbTrack key={tr.id} track={tr} layer={layer} sel={sel} isHi={isHi} isGroupSel={isGroupSel} onPointerDown={onTrackPointerDown} onDoubleClick={onTrackDoubleClick} />;
              })}"""

content = content.replace(old_track, new_track)


with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)

