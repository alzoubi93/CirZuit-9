import re
with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

# Via
old_via = """              {visibleVias.map((v) => {
                const sel = selection?.kind === "via" && selection.id === v.id;
                return (
                  <g key={v.id} 
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (tool === "select" || tool === "group_select") {
                        registerPointer(e);
                        startDragGroup(e, "via", v.id);
                      } else if (tool === "track") {
                        handlePadRouteClick({ x: v.x, y: v.y });
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setPropsOpen(true);
                    }}
                  >
                    {/* Larger transparent hit area */}
                    <circle cx={v.x} cy={v.y} r={v.diameter / 2 + 0.8} fill="transparent" style={{ cursor: "pointer" }} />
                    <circle cx={v.x} cy={v.y} r={v.diameter / 2} fill={groupSelected?.vias.includes(v.id) ? "#f59e0b" : sel ? "#3b82f6" : "#22c55e"} stroke={groupSelected?.vias.includes(v.id) ? "#f59e0b" : sel ? "#60a5fa" : "none"} strokeWidth={0.1} />
                    {groupSelected?.vias.includes(v.id) && (
                      <circle cx={v.x} cy={v.y} r={v.diameter / 2 + 0.3} fill="none" stroke="#f59e0b" strokeWidth={0.12} style={{ pointerEvents: "none" }} />
                    )}
                    <circle cx={v.x} cy={v.y} r={v.drill / 2} fill="#000000" />
                  </g>
                );
              })}"""

new_via = """              {visibleVias.map((v) => {
                const sel = selection?.kind === "via" && selection.id === v.id;
                const isGroupSel = groupSelected?.vias.includes(v.id) || false;
                return <MemoizedPcbVia key={v.id} via={v} sel={sel} isGroupSel={isGroupSel} onPointerDown={onViaPointerDown} onDoubleClick={onViaDoubleClick} />;
              })}"""
content = content.replace(old_via, new_via)


# Measures
old_measure = """              {pcb.measures.map((m) => {
                const dx = m.b.x - m.a.x, dy = m.b.y - m.a.y;
                const dist = Math.hypot(dx, dy);
                const sel = selection?.kind === "measure" && selection.id === m.id;
                return (
                  <g key={m.id} 
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      registerPointer(e);
                      startDragGroup(e, "measure", m.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setPropsOpen(true);
                    }}
                    style={{ cursor: "pointer" }}
                  >
                    <line x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} stroke={sel ? "#3b82f6" : "#ea580c"} strokeWidth={0.18} strokeDasharray="0.6 0.4" />
                    <g>
                      <line x1={m.a.x - 3.5} y1={m.a.y} x2={m.a.x + 3.5} y2={m.a.y} stroke={sel ? "#3b82f6" : "#ea580c"} strokeWidth={0.35} />
                      <line x1={m.a.x} y1={m.a.y - 3.5} x2={m.a.x} y2={m.a.y + 3.5} stroke={sel ? "#3b82f6" : "#ea580c"} strokeWidth={0.35} />
                      <circle cx={m.a.x} cy={m.a.y} r={0.5} fill={sel ? "#3b82f6" : "#ea580c"} />
                    </g>
                    <g>
                      <line x1={m.b.x - 3.5} y1={m.b.y} x2={m.b.x + 3.5} y2={m.b.y} stroke={sel ? "#3b82f6" : "#ea580c"} strokeWidth={0.35} />
                      <line x1={m.b.x} y1={m.b.y - 3.5} x2={m.b.x} y2={m.b.y + 3.5} stroke={sel ? "#3b82f6" : "#ea580c"} strokeWidth={0.35} />
                      <circle cx={m.b.x} cy={m.b.y} r={0.5} fill={sel ? "#3b82f6" : "#ea580c"} />
                    </g>
                    <g transform={`translate(${m.b.x - 5.0}, ${m.b.y - 4.0})`} textAnchor="end">
                      <text x={0} y={0} fontSize={2.0} fill={sel ? "#3b82f6" : "#ea580c"} fontWeight="bold">
                        {fmt(dist, pcb.unit)}
                      </text>
                    </g>
                  </g>
                );
              })}"""
new_measure = """              {pcb.measures.map((m) => {
                const sel = selection?.kind === "measure" && selection.id === m.id;
                return <MemoizedPcbMeasure key={m.id} measure={m} sel={sel} unit={pcb.unit} onPointerDown={onMeasurePointerDown} onDoubleClick={onMeasureDoubleClick} />;
              })}"""
content = content.replace(old_measure, new_measure)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
