import re

with open('src/components/editor/PcbEditor.tsx', 'r') as f:
    content = f.read()

handlers = """
  const onTrackPointerDown = useStableCallback((e: React.PointerEvent, tr: import("@/lib/pcb").PcbTrack) => {
    e.stopPropagation();
    registerPointer(e);
    startDragGroup(e, "track", tr.id);
    selectNetInSchematic(tr.netId);
  });
  
  const onTrackDoubleClick = useStableCallback((e: React.MouseEvent, tr: import("@/lib/pcb").PcbTrack) => {
    e.stopPropagation();
    setPropsOpen(true);
  });

  const onViaPointerDown = useStableCallback((e: React.PointerEvent, v: import("@/lib/pcb").PcbVia) => {
    e.stopPropagation();
    if (tool === "select" || tool === "group_select") {
      registerPointer(e);
      startDragGroup(e, "via", v.id);
    } else if (tool === "track") {
      handlePadRouteClick({ x: v.x, y: v.y });
    }
  });
  
  const onViaDoubleClick = useStableCallback((e: React.MouseEvent, v: import("@/lib/pcb").PcbVia) => {
    e.stopPropagation();
    setPropsOpen(true);
  });

  const onPadPointerDown = useStableCallback((e: React.PointerEvent, p: import("@/lib/pcb").PcbPad) => {
    e.stopPropagation();
    if (tool === "select" || tool === "group_select") {
      registerPointer(e);
      startDragGroup(e, "pad", p.id);
      onBackgroundClick?.();
    } else if (tool === "track") {
      handlePadRouteClick({ x: p.x, y: p.y });
    }
  });

  const onMeasurePointerDown = useStableCallback((e: React.PointerEvent, m: import("@/lib/pcb").PcbMeasure) => {
    e.stopPropagation();
    registerPointer(e);
    startDragGroup(e, "measure", m.id);
  });

  const onMeasureDoubleClick = useStableCallback((e: React.MouseEvent, m: import("@/lib/pcb").PcbMeasure) => {
    e.stopPropagation();
    setPropsOpen(true);
  });
  
  const onTextPointerDown = useStableCallback((e: React.PointerEvent, t: import("@/lib/pcb").PcbText) => {
    e.stopPropagation();
    if (tool === "select" || tool === "group_select") {
      registerPointer(e);
      startDragGroup(e, "text", t.id);
    }
  });

  const onTextDoubleClick = useStableCallback((e: React.MouseEvent, t: import("@/lib/pcb").PcbText) => {
    e.stopPropagation();
    setPropsOpen(true);
  });
  
  const onFootprintPointerDown = useStableCallback((e: React.PointerEvent, fp: import("@/lib/pcb").PcbFootprint) => {
    if (tool !== "select" && tool !== "group_select") return;
    e.stopPropagation();
    registerPointer(e);
    startDragGroup(e, "footprint", fp.id);
  });

  const onFootprintDoubleClick = useStableCallback((e: React.MouseEvent, fp: import("@/lib/pcb").PcbFootprint) => {
    e.stopPropagation();
    setPropsOpen(true);
  });

  const onFootprintPadPointerDown = useStableCallback((e: React.PointerEvent, fp: import("@/lib/pcb").PcbFootprint, pad: any) => {
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
  });

  const onFootprintPadDoubleClick = useStableCallback((e: React.MouseEvent, fp: import("@/lib/pcb").PcbFootprint, pad: any) => {
    e.stopPropagation();
    setPropsOpen(true);
  });
"""

content = content.replace('  return (\n    <div className="flex flex-col h-full bg-background">', handlers + '  return (\n    <div className="flex flex-col h-full bg-background">')

with open('src/components/editor/PcbEditor.tsx', 'w') as f:
    f.write(content)

