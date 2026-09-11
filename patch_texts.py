import re
with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

old_text = """              {(pcb.texts || []).map((t) => {
                const layer = pcb.layers.find((l) => l.id === t.layer);
                if (layer && !layer.visible) return null;
                const sel = selection?.kind === "text" && selection.id === t.id;
                const col = groupSelected?.texts.includes(t.id) ? "#f59e0b" : sel ? "#3b82f6" : (t.layer === "silkscreen" || t.layer === "bottom_silkscreen" ? "#22c55e" : (layer ? layer.color : "#22c55e"));
                return (
                  <g key={t.id}
                    transform={`translate(${t.x},${t.y}) rotate(${t.rotation})`}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (tool === "select" || tool === "group_select") {
                        registerPointer(e);
                        startDragGroup(e, "text", t.id);
                      }
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setPropsOpen(true);
                    }}
                    style={{ cursor: (tool === "select" || tool === "group_select") ? "move" : "default" }}
                  >
                    <rect
                      x={-t.text.length * t.size * 0.3 - 0.2}
                      y={-t.size * 0.5 - 0.2}
                      width={t.text.length * t.size * 0.6 + 0.4}
                      height={t.size + 0.4}
                      fill="transparent"
                    />
                    <text
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={t.size}
                      fill={col}
                      fontWeight="bold"
                      fontFamily="monospace"
                      style={{ pointerEvents: "none" }}
                    >
                      {t.text}
                    </text>
                  </g>
                );
              })}"""

new_text = """              {(pcb.texts || []).map((t) => {
                const layer = pcb.layers.find((l) => l.id === t.layer);
                const sel = selection?.kind === "text" && selection.id === t.id;
                const isGroupSel = groupSelected?.texts.includes(t.id) || false;
                const isMoveTool = tool === "select" || tool === "group_select";
                return <MemoizedPcbText key={t.id} text={t} layer={layer} sel={sel} isGroupSel={isGroupSel} isMoveTool={isMoveTool} onPointerDown={onTextPointerDown} onDoubleClick={onTextDoubleClick} />;
              })}"""
content = content.replace(old_text, new_text)

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)
