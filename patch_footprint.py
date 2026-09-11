import re

with open('src/components/editor/PcbElements.tsx', 'r') as f:
    content = f.read()

# We need to find `export const MemoizedPcbFootprint = React.memo(({` and replace it up to `});\n\n` or similar.
# Wait, let's use a simpler match.

start_str = "export const MemoizedPcbFootprint = React.memo(({"
end_str = "export const MemoizedPcbVia"

start_idx = content.find(start_str)
end_idx = content.find(end_str)

if start_idx == -1 or end_idx == -1:
    print("Could not find boundaries")
    exit(1)

new_component = """export const MemoizedPcbFootprint = React.memo(({
  fp, sel, isGroupSel, netIndex, highlightedNetIds, selectedPin,
  onPointerDown, onDoubleClick, onPadPointerDown, onPadDoubleClick
}: {
  fp: PcbFootprint, sel: boolean, isGroupSel: boolean, netIndex: any, highlightedNetIds: number[], selectedPin: { nodeId: string; pinIndex: number } | null,
  onPointerDown: (e: React.PointerEvent, fp: PcbFootprint) => void,
  onDoubleClick: (e: React.MouseEvent, fp: PcbFootprint) => void,
  onPadPointerDown: (e: React.PointerEvent, fp: PcbFootprint, pad: any) => void,
  onPadDoubleClick: (e: React.MouseEvent, fp: PcbFootprint, pad: any) => void
}) => {
  const bb = footprintBBox(fp);
  const sym = (fp.symbol || "").toLowerCase();
  const ref = (fp.reference || "").toLowerCase();
  
  const isPolarCap = sym.includes("capacitor_polar") || sym.includes("cpol") || (ref.startsWith("c") && sym.includes("polar"));
  const isNonPolarCap = (sym.includes("capacitor") || ref.startsWith("c")) && !isPolarCap;
  const isCap = isPolarCap || isNonPolarCap;
  const isDiode = sym.includes("diode") || ref.startsWith("d");
  const isTransistor = sym.includes("transistor") || sym.includes("npn") || sym.includes("pnp") || sym.includes("mosfet") || ref.startsWith("q");
  const isRegulator = sym.includes("regulator") || sym.includes("7805") || sym.includes("7812") || sym.includes("lm317") || sym.includes("ams1117");
  const isFuse = sym.includes("fuse") || ref.startsWith("f");
  const isIC = !isTransistor && !isRegulator && (sym.includes("ic") || sym.includes("opamp") || sym.includes("ne555") || sym.includes("atmega") || ref.startsWith("u"));

  const pad0 = fp.pads[0];
  const pad1 = fp.pads[1];
  const d = pad0 && pad1 ? Math.hypot(pad0.x - pad1.x, pad0.y - pad1.y) : 5.08;
  const r = Math.max(d * 0.6, 2.5);
  const cx = pad0 && pad1 ? (pad0.x + pad1.x) / 2 : 0;
  const cy = pad0 && pad1 ? (pad0.y + pad1.y) / 2 : 0;
  const angle = pad0 && pad1 ? Math.atan2(pad1.y - pad0.y, pad1.x - pad0.x) * (180 / Math.PI) : 0;

  let minPX = 0, minPY = 0, maxPX = 0, maxPY = 0;
  fp.pads.forEach((p, idx) => {
    if (idx === 0) {
      minPX = p.x - p.width / 2; maxPX = p.x + p.width / 2;
      minPY = p.y - p.height / 2; maxPY = p.y + p.height / 2;
    } else {
      minPX = Math.min(minPX, p.x - p.width / 2);
      maxPX = Math.max(maxPX, p.x + p.width / 2);
      minPY = Math.min(minPY, p.y - p.height / 2);
      maxPY = Math.max(maxPY, p.y + p.height / 2);
    }
  });

  const borderOffset = 0.5;
  const rectW = maxPX - minPX + borderOffset * 2;
  const rectH = maxPY - minPY + borderOffset * 2;
  const rectX = minPX - borderOffset;
  const rectY = minPY - borderOffset;
  const nonPolarCx = (minPX + maxPX) / 2;
  const nonPolarCy = (minPY + maxPY) / 2;

  const silkColor = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : "#fcd34d";

  const renderComponentBody = () => {
    if (isPolarCap) {
      return (
        <g style={{ pointerEvents: "none" }} transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
          <circle cx={0} cy={0} r={r} fill="none" stroke={silkColor} strokeWidth={0.15} />
          <line x1={r * 0.25} y1={-r * 0.93} x2={r * 0.25} y2={r * 0.93} stroke={silkColor} strokeWidth={0.15} />
          <line x1={r * 0.25} y1={-r * 0.4} x2={r * 0.85} y2={-r * 0.4} stroke={silkColor} strokeWidth={0.15} />
          <line x1={r * 0.25} y1={0} x2={r * 0.95} y2={0} stroke={silkColor} strokeWidth={0.15} />
          <line x1={r * 0.25} y1={r * 0.4} x2={r * 0.85} y2={r * 0.4} stroke={silkColor} strokeWidth={0.15} />
          <line x1={-r * 0.65 - 0.4} y1={r * 0.4} x2={-r * 0.65 + 0.4} y2={r * 0.4} stroke={silkColor} strokeWidth={0.2} />
          <line x1={-r * 0.65} y1={r * 0.4 - 0.4} x2={-r * 0.65} y2={r * 0.4 + 0.4} stroke={silkColor} strokeWidth={0.2} />
        </g>
      );
    }
    
    if (isNonPolarCap) {
      return (
        <g style={{ pointerEvents: "none" }}>
          <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={rectH / 2} fill="none" stroke={silkColor} strokeWidth={0.15} />
          <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
            <line x1={-0.45} y1={-rectH * 0.3} x2={-0.45} y2={rectH * 0.3} stroke={silkColor} strokeWidth={0.15} />
            <line x1={0.45} y1={-rectH * 0.3} x2={0.45} y2={rectH * 0.3} stroke={silkColor} strokeWidth={0.15} />
          </g>
        </g>
      );
    }

    if (isDiode) {
      // Diode outline is typically a rectangle with a cathode bar (line on one side)
      return (
        <g style={{ pointerEvents: "none" }}>
          <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.3} fill="none" stroke={silkColor} strokeWidth={0.15} />
          <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
            {/* Cathode bar: Assuming pad0 is Anode and pad1 is Cathode based on standard 1-2 mapping. 
                Cathode is on the right side if angle is 0. We'll draw it on the right side. */}
            <rect x={rectW/2 - 1.5} y={-rectH/2 + 0.15} width={0.8} height={rectH - 0.3} fill={silkColor} />
            {/* Inner triangle and line */}
            <line x1={-rectW/4} y1={-rectH/3} x2={-rectW/4} y2={rectH/3} stroke={silkColor} strokeWidth={0.15} />
            <polygon points={`${-rectW/4},${-rectH/3} ${-rectW/4},${rectH/3} ${rectW/4},0`} fill="none" stroke={silkColor} strokeWidth={0.15} />
          </g>
        </g>
      );
    }

    if (isTransistor) {
      if (fp.pads.length === 3) {
        // Simple TO-92 like D-shape or SOT-23
        const isSmd = fp.pads[0].shape === "rect"; // heuristic for SMD
        if (isSmd) {
           return (
             <g style={{ pointerEvents: "none" }}>
               <rect x={rectX + 0.2} y={rectY + 0.5} width={rectW - 0.4} height={rectH - 1.0} fill="none" stroke={silkColor} strokeWidth={0.15} />
             </g>
           );
        } else {
           // TO-92 D shape
           // Compute center
           const pCx = (minPX + maxPX) / 2;
           const pCy = (minPY + maxPY) / 2;
           const rad = Math.max(rectW, rectH) / 2;
           return (
             <g style={{ pointerEvents: "none" }} transform={`translate(${pCx}, ${pCy})`}>
                <path d={`M ${-rad},${-rad/2} A ${rad} ${rad} 0 0 1 ${rad} ${-rad/2} L ${rad} ${rad/2} L ${-rad} ${rad/2} Z`} fill="none" stroke={silkColor} strokeWidth={0.15} />
             </g>
           );
        }
      }
    }

    if (isRegulator) {
       // Usually TO-220 shape (rectangle with a metal tab outline)
       return (
         <g style={{ pointerEvents: "none" }}>
           <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={silkColor} strokeWidth={0.15} />
           {/* Tab representation at the top */}
           <rect x={rectX + rectW*0.1} y={rectY - 1} width={rectW*0.8} height={1} fill="none" stroke={silkColor} strokeWidth={0.15} />
         </g>
       );
    }

    if (isFuse) {
       return (
         <g style={{ pointerEvents: "none" }}>
           <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={silkColor} strokeWidth={0.15} />
           {/* Line through the middle */}
           <line x1={rectX} y1={nonPolarCy} x2={rectX + rectW} y2={nonPolarCy} stroke={silkColor} strokeWidth={0.15} />
         </g>
       );
    }

    if (isIC && fp.pads.length >= 4) {
      // Draw IC rectangle with a notch on the left or top
      // Find orientation by pad 1 and pad N positions.
      return (
         <g style={{ pointerEvents: "none" }}>
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.3} fill="none" stroke={silkColor} strokeWidth={0.15} />
           {/* Dot for pin 1 */}
           <circle cx={fp.pads[0].x} cy={fp.pads[0].y} r={0.3} fill={silkColor} />
           {/* Notch in the middle of the left side (assuming standard DIP layout where left side is minX) */}
           <path d={`M ${rectX} ${nonPolarCy - 0.8} A 0.8 0.8 0 0 1 ${rectX} ${nonPolarCy + 0.8}`} fill="none" stroke={silkColor} strokeWidth={0.15} />
         </g>
      );
    }

    // Default shapes
    return (
      <g style={{ pointerEvents: "none" }}>
        {(fp as any).lines && (fp as any).lines.length > 0 ? (
          (fp as any).lines.map((ln: any, i: number) => (
            <line key={i} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke={silkColor} strokeWidth={0.15} />
          ))
        ) : (!(fp as any).circles || (fp as any).circles.length === 0) ? (
          <>
            <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.3} fill="none" stroke={silkColor} strokeWidth={0.15} />
            {fp.pads.length > 0 && <circle cx={rectX + 0.8} cy={rectY + 0.8} r={0.3} fill={silkColor} opacity={0.8} />}
          </>
        ) : null}
        {((fp as any).circles || []).map((c: any, i: number) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} stroke={silkColor} strokeWidth={0.15} fill="none" />
        ))}
      </g>
    );
  };

  return (
    <g
      onPointerDown={(e) => onPointerDown(e, fp)}
      onDoubleClick={(e) => onDoubleClick(e, fp)}
    >
      <rect x={bb.x} y={bb.y} width={bb.w} height={bb.h}
        fill={isGroupSel ? "rgba(245, 158, 11, 0.15)" : sel ? "rgba(59, 130, 246, 0.08)" : "transparent"}
        stroke={isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : "none"}
        strokeWidth={isGroupSel ? 0.25 : sel ? 0.4 : 0.08}
        rx={0.5}
      />
      {sel && (
        <rect x={bb.x - 0.4} y={bb.y - 0.4} width={bb.w + 0.8} height={bb.h + 0.8}
          fill="none" stroke="#3b82f6" strokeWidth={0.3} opacity={0.7} rx={0.7}
          style={{ pointerEvents: "none" }}
        />
      )}
      <g transform={`translate(${fp.x},${fp.y}) rotate(${fp.rotation})`}>
        
        {renderComponentBody()}

        {fp.pads.map((pad) => {
          const netId = netIndex.pinNet.get(`${fp.id}:${pad.pinIndex}`);
          const isPadHi = netId !== undefined && highlightedNetIds.includes(netId);
          const isPadSel = selectedPin?.nodeId === fp.id && selectedPin?.pinIndex === pad.pinIndex;
          return (
            <MemoizedPcbPad
              key={pad.pinIndex}
              pad={pad}
              isPadHi={isPadHi}
              isPadSel={isPadSel}
              onPadPointerDown={(e) => onPadPointerDown(e, fp, pad)}
              onPadDoubleClick={(e) => onPadDoubleClick(e, fp, pad)}
            />
          );
        })}
        {/* Footprint text labels */}
        <text x={0} y={minPY - 1.2} fill={silkColor} fontSize={1.2}
          textAnchor="middle" fontFamily="monospace"
          style={{ pointerEvents: "none" }}>
          {fp.reference}
        </text>
        <text x={0} y={maxPY + 2.2} fill={silkColor} opacity={0.7} fontSize={0.9}
          textAnchor="middle" fontFamily="monospace"
          style={{ pointerEvents: "none" }}>
          {fp.value}
        </text>
      </g>
    </g>
  );
});

"""

new_content = content[:start_idx] + new_component + content[end_idx:]

with open('src/components/editor/PcbElements.tsx', 'w') as f:
    f.write(new_content)

print("Patched!")
