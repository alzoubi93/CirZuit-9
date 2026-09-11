import React from "react";
import { PcbTrack, PcbFootprint, PcbVia, PcbPad, PcbZone, PcbMeasure, PcbText, PcbLayer, PcbGraphic, PcbDimension, PcbTarget, checkIfPolarizedCapacitor, isCopperLayer, determineViaType, getViaClassificationLabel, getCopperLayerStandardColor } from "@/lib/pcb";
import { getTrackSvgPath } from "@/lib/arcGeometry";
import { polygonToSvgPath, getZoneBoundingBox } from "@/lib/zoneGeometry";
import { footprintBBox } from "@/lib/pcbSync";
import { toDisplay, fmt } from "@/lib/pcb";
import { getElectrolyticSize } from "./ThreeDRealModels";
import { KicadFootprintRenderer, nativeFootprintBounds } from "./KicadFootprintRenderer";

export const MemoizedPcbTrack = React.memo(({ 
  track, layer, sel, isHi, isGroupSel,
  onPointerDown, onDoubleClick
}: {
  track: PcbTrack, layer: PcbLayer | undefined, sel: boolean, isHi: boolean, isGroupSel: boolean,
  onPointerDown: (e: React.PointerEvent, tr: PcbTrack) => void,
  onDoubleClick: (e: React.MouseEvent, tr: PcbTrack) => void
}) => {
  if (!layer?.visible) return null;
  const d = getTrackSvgPath(track);
  if (!d) return null;
  const isCopper = isCopperLayer(track.layer);
  let strokeColor = "";
  if (!isCopper) {
    strokeColor = layer?.color || (track.layer === "outline" ? "#ffd166" : track.layer === "silkscreen" ? "#eab308" : "#22c55e");
  } else {
    strokeColor = sel ? "#3b82f6" : (isHi ? "#2563eb" : (layer?.color || (track.layer === "bottom_copper" ? "#3b82f6" : "#ef4444")));
  }

  return (
    <g>
      {/* Wider transparent overlay for easy selection clicking */}
      <path d={d} stroke="transparent" strokeWidth={track.width + 1.2} fill="none" strokeLinecap="round" strokeLinejoin="round"
        onPointerDown={(e) => onPointerDown(e, track)}
        onDoubleClick={(e) => onDoubleClick(e, track)}
        style={{ cursor: "pointer" }}
      />
      {/* Neon glow effect for highlighted track */}
      {isHi && isCopper && (
        <path d={d} stroke="#3b82f6" strokeWidth={track.width * 2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.5} style={{ pointerEvents: "none" }} />
      )}
      {/* Group selection amber glow */}
      {isGroupSel && isCopper && (
        <path d={d} stroke="#f59e0b" strokeWidth={track.width + 2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} style={{ pointerEvents: "none" }} />
      )}
      {/* Semi-transparent blue selection highlight outline */}
      {sel && isCopper && (
        <path d={d} stroke="rgba(59, 130, 246, 0.6)" strokeWidth={track.width + 0.8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} style={{ pointerEvents: "none" }} />
      )}
      <path d={d} stroke={strokeColor} strokeWidth={sel && isCopper ? track.width * 1.5 : track.width}
        fill="none" strokeLinecap="round" strokeLinejoin="round"
        style={{ pointerEvents: "none" }}
      />
    </g>
  );
});

export const MemoizedPcbVia = React.memo(({
  via, layer, sel, isGroupSel,
  onPointerDown, onDoubleClick
}: {
  via: PcbVia, layer: PcbLayer | undefined, sel: boolean, isGroupSel: boolean,
  onPointerDown: (e: React.PointerEvent, v: PcbVia) => void,
  onDoubleClick: (e: React.MouseEvent, v: PcbVia) => void
}) => {
  const isSquare = via.shape === "square";
  const radius = (via.diameter || 0.8) / 2;
  const drillRadius = (via.drill || 0.4) / 2;
  const viaType = determineViaType(via);
  const label = getViaClassificationLabel(via);

  // Offset drill center if microvia offset exists
  const holeX = via.x + (via.drillOffset?.x || 0);
  const holeY = via.y + (via.drillOffset?.y || 0);

  let color = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : ((layer?.color && layer.color !== "#000000") ? layer.color : "#22c55e");
  if (!sel && !isGroupSel) {
    if (viaType === "micro") {
      color = "#ec4899";
    } else if (viaType === "blind") {
      const l1 = via.layers ? via.layers[0] : "top_copper";
      color = getCopperLayerStandardColor(l1);
    }
  }

  const strokeColor = isGroupSel ? "#f59e0b" : sel ? "#60a5fa" : (viaType === "blind" ? "#06b6d4" : viaType === "micro" ? "#f43f5e" : "#475569");
  const strokeW = isGroupSel || sel ? 0.15 : 0.08;

  return (
    <g onPointerDown={(e) => onPointerDown(e, via)} onDoubleClick={(e) => onDoubleClick(e, via)} data-via-id={via.id}>
      <title>{label}</title>
      {isSquare ? (
        <>
          <rect x={via.x - radius - 0.8} y={via.y - radius - 0.8} width={via.diameter + 1.6} height={via.diameter + 1.6} fill="transparent" style={{ cursor: "pointer" }} />
          <rect x={via.x - radius} y={via.y - radius} width={via.diameter} height={via.diameter} fill={color} stroke={strokeColor} strokeWidth={strokeW} />
          {isGroupSel && (
            <rect x={via.x - radius - 0.3} y={via.y - radius - 0.3} width={via.diameter + 0.6} height={via.diameter + 0.6} fill="none" stroke="#f59e0b" strokeWidth={0.12} style={{ pointerEvents: "none" }} />
          )}
        </>
      ) : (
        <>
          <circle cx={via.x} cy={via.y} r={radius + 0.8} fill="transparent" style={{ cursor: "pointer" }} />
          <circle cx={via.x} cy={via.y} r={radius} fill={color} stroke={strokeColor} strokeWidth={strokeW} />
          {isGroupSel && (
            <circle cx={via.x} cy={via.y} r={radius + 0.3} fill="none" stroke="#f59e0b" strokeWidth={0.12} style={{ pointerEvents: "none" }} />
          )}
        </>
      )}

      {/* Drill Hole */}
      <circle cx={holeX} cy={holeY} r={drillRadius} fill="#000000" />

      {/* Visual Accent Glyphs */}
      {viaType === "micro" && (
        <circle cx={holeX} cy={holeY} r={(radius + drillRadius) / 2} fill="none" stroke="#ffffff" strokeWidth={0.05} style={{ pointerEvents: "none" }} />
      )}
      {viaType === "blind" && (
        <g stroke="rgba(6, 182, 212, 0.8)" strokeWidth={0.06} style={{ pointerEvents: "none" }}>
          <line x1={holeX - radius * 0.7} y1={holeY} x2={holeX + radius * 0.7} y2={holeY} />
          <line x1={holeX} y1={holeY - radius * 0.7} x2={holeX} y2={holeY + radius * 0.7} />
        </g>
      )}
    </g>
  );
});

export const MemoizedPcbZone = React.memo(({
  zone, layer, sel, isGroupSel, isZoneHi,
  onPointerDown, onDoubleClick
}: {
  zone: PcbZone,
  layer: PcbLayer | undefined,
  sel: boolean,
  isGroupSel: boolean,
  isZoneHi?: boolean,
  onPointerDown: (e: React.PointerEvent, z: PcbZone) => void,
  onDoubleClick: (e: React.MouseEvent, z: PcbZone) => void,
}) => {
  if (layer && !layer.visible) return null;

  const baseColor = layer?.color || getCopperLayerStandardColor(zone.layer);
  const strokeColor = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : isZoneHi ? "#60a5fa" : (zone.isKeepout ? "#ef4444" : baseColor);
  const boundaryPath = polygonToSvgPath(zone.boundary);

  const isKeepout = zone.isKeepout;
  const fillMode = zone.fill?.fillMode || "solid";
  const hatchStyle = zone.fill?.hatchStyle;

  // Title label for hover tooltip
  const title = isKeepout
    ? `Keepout Zone [${zone.layer}]`
    : `Copper Zone: ${zone.name || (zone.netName ? `Net ${zone.netName}` : `Net ${zone.netId ?? "None"}`)} (${zone.layer})`;

  return (
    <g
      onPointerDown={(e) => onPointerDown(e, zone)}
      onDoubleClick={(e) => onDoubleClick(e, zone)}
      data-zone-id={zone.id}
      style={{ cursor: "pointer" }}
    >
      <title>{title}</title>

      {/* Zone/copper-pour FILL is intentionally not duplicated here: PcbCanvasLayer already
          paints every zone's fill (including filledPolygons with thermal-relief cutouts) on
          an accelerated <canvas> layer beneath this SVG. Re-rendering zone.filledPolygons as
          individual SVG <path> elements here used to add hundreds-to-thousands of extra DOM
          nodes per copper pour on real (KiCad-imported) boards -- the single biggest cause of
          sluggish pan/zoom/selection once a board had ground/power pours. Only the outline
          below is kept in SVG, since it's cheap (one path per zone) and needed for hit-testing
          and the selection highlight. When a zone is selected/group-selected we still tint the
          outline+fill-adjacent glow so the selection remains visually clear even without the
          SVG fill. */}
      {(sel || isGroupSel) && !isKeepout && boundaryPath && (
        <path
          d={boundaryPath}
          fill={isGroupSel ? "rgba(245, 158, 11, 0.18)" : "rgba(59, 130, 246, 0.18)"}
          fillRule="evenodd"
          stroke="none"
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* 3. Keepout Zone Indicator (Diagonal stripe hatching or semi-transparent red) */}
      {isKeepout && boundaryPath && (
        <path
          d={boundaryPath}
          fill="rgba(239, 68, 68, 0.15)"
          fillRule="evenodd"
          stroke="none"
        />
      )}

      {/* 4. Zone Boundary Outline (Dashed when unselected, solid glowing when selected) */}
      {boundaryPath && (
        <>
          {/* Thick invisible click grabber for the boundary line */}
          <path
            d={boundaryPath}
            fill="none"
            stroke="transparent"
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
          {/* Visual Boundary Line */}
          <path
            d={boundaryPath}
            fill="none"
            stroke={strokeColor}
            strokeWidth={sel ? 0.5 : 0.25}
            strokeDasharray={isKeepout ? "1.5, 1.0" : sel ? undefined : "2.0, 1.2"}
            strokeLinejoin="round"
            opacity={sel ? 1.0 : 0.85}
          />
        </>
      )}

      {/* 5. Selected / Highlighted boundary glow */}
      {(sel || isGroupSel) && boundaryPath && (
        <path
          d={boundaryPath}
          fill="none"
          stroke={isGroupSel ? "#f59e0b" : "#60a5fa"}
          strokeWidth={0.8}
          strokeLinejoin="round"
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        />
      )}
    </g>
  );
});

export const MemoizedPcbPad = React.memo(({
  pad, layer, sel, isGroupSel, isPadHi, isPadSel,
  onPointerDown, onPadPointerDown, onDoubleClick, onPadDoubleClick
}: {
  pad: any, layer?: PcbLayer, sel?: boolean, isGroupSel?: boolean, isPadHi?: boolean, isPadSel?: boolean,
  onPointerDown?: (e: React.PointerEvent, p: any) => void,
  onPadPointerDown?: (e: React.PointerEvent, p: any) => void,
  onDoubleClick?: (e: React.MouseEvent, p: any) => void,
  onPadDoubleClick?: (e: React.MouseEvent, p: any) => void
}) => {
  if (layer && !layer.visible) return null;
  const padColor = isGroupSel ? "#f59e0b" : (sel || isPadSel) ? "#8b5cf6" : isPadHi ? "#f97316" : (layer?.color || (pad.layer === "bottom_copper" ? "#3b82f6" : "#ef4444"));
  
  const handlePointerDown = (e: React.PointerEvent) => {
    if (onPointerDown) onPointerDown(e, pad);
    if (onPadPointerDown) onPadPointerDown(e, pad);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (onDoubleClick) onDoubleClick(e, pad);
    if (onPadDoubleClick) onPadDoubleClick(e, pad);
  };

  const label = pad.number || pad.name || (typeof pad.pinIndex === 'number' ? String(pad.pinIndex + 1) : "");

  return (
    <g onPointerDown={handlePointerDown} onDoubleClick={handleDoubleClick}>
      {pad.shape === "rect" ? (
        <rect x={pad.x - (pad.width + 1.2) / 2} y={pad.y - (pad.height + 1.2) / 2} width={pad.width + 1.2} height={pad.height + 1.2} fill="transparent" style={{ cursor: "pointer" }} />
      ) : (
        <circle cx={pad.x} cy={pad.y} r={(pad.width + 1.2) / 2} fill="transparent" style={{ cursor: "pointer" }} />
      )}
      <g transform={`rotate(${pad.rotation || 0} ${pad.x} ${pad.y})`}>
        {pad.nativeShape === "oval" ? (
          <ellipse cx={pad.x} cy={pad.y} rx={Number.isFinite(pad.width) ? pad.width / 2 : 0} ry={Number.isFinite(pad.height) ? pad.height / 2 : 0} fill={padColor} stroke={isGroupSel ? "#f59e0b" : (sel || isPadSel) ? "#3b82f6" : "none"} strokeWidth={isGroupSel ? 0.25 : 0.1} />
        ) : pad.nativeShape === "roundrect" ? (
          <rect x={pad.x-pad.width/2} y={pad.y-pad.height/2} width={pad.width} height={pad.height} rx={Math.min(pad.width,pad.height)*(pad.roundrectRatio || 0.25)} fill={padColor} stroke={isGroupSel ? "#f59e0b" : (sel || isPadSel) ? "#3b82f6" : "none"} strokeWidth={isGroupSel ? 0.25 : 0.1} />
        ) : pad.shape === "rect" ? (
          <rect x={pad.x - pad.width / 2} y={pad.y - pad.height / 2} width={pad.width} height={pad.height} fill={padColor} stroke={isGroupSel ? "#f59e0b" : (sel || isPadSel) ? "#3b82f6" : "none"} strokeWidth={isGroupSel ? 0.25 : 0.1} />
        ) : (
          <circle cx={pad.x} cy={pad.y} r={Math.min(pad.width,pad.height) / 2} fill={padColor} stroke={isGroupSel ? "#f59e0b" : (sel || isPadSel) ? "#3b82f6" : "none"} strokeWidth={isGroupSel ? 0.25 : 0.1} />
        )}
        {pad.drill && <circle cx={pad.x} cy={pad.y} r={pad.drill / 2} fill="#000000" />}
        {label && (
          <text
            x={pad.x}
            y={pad.y}
            fontSize={Math.min(pad.width, pad.height) * 0.6}
            fill="#ffffff"
            textAnchor="middle"
            dominantBaseline="central"
            fontWeight={700}
            fontFamily="monospace"
            style={{ pointerEvents: "none" }}
          >
            {label}
          </text>
        )}
      </g>
    </g>
  );
});

export const MemoizedPcbMeasure = React.memo(({
  measure, sel, unit,
  onPointerDown, onDoubleClick
}: {
  measure: PcbMeasure, sel: boolean, unit: import("@/lib/pcb").PcbUnit,
  onPointerDown: (e: React.PointerEvent, m: PcbMeasure) => void,
  onDoubleClick: (e: React.MouseEvent, m: PcbMeasure) => void
}) => {
  const dx = measure.b.x - measure.a.x, dy = measure.b.y - measure.a.y;
  const dist = Math.hypot(dx, dy);
  return (
    <g
      onPointerDown={(e) => onPointerDown(e, measure)} 
      onDoubleClick={(e) => onDoubleClick(e, measure)}
      style={{ cursor: "pointer" }}
    >
      <line x1={measure.a.x} y1={measure.a.y} x2={measure.b.x} y2={measure.b.y} stroke={sel ? "#3b82f6" : "#ea580c"} strokeWidth={0.18} strokeDasharray="0.6 0.4" />
      <g>
        <line x1={measure.a.x - 3.5} y1={measure.a.y} x2={measure.a.x + 3.5} y2={measure.a.y} stroke={sel ? "#3b82f6" : "#ea580c"} strokeWidth={0.35} />
        <line x1={measure.a.x} y1={measure.a.y - 3.5} x2={measure.a.x} y2={measure.a.y + 3.5} stroke={sel ? "#3b82f6" : "#ea580c"} strokeWidth={0.35} />
        <circle cx={measure.a.x} cy={measure.a.y} r={0.5} fill={sel ? "#3b82f6" : "#ea580c"} />
      </g>
      <g>
        <line x1={measure.b.x - 3.5} y1={measure.b.y} x2={measure.b.x + 3.5} y2={measure.b.y} stroke={sel ? "#3b82f6" : "#ea580c"} strokeWidth={0.35} />
        <line x1={measure.b.x} y1={measure.b.y - 3.5} x2={measure.b.x} y2={measure.b.y + 3.5} stroke={sel ? "#3b82f6" : "#ea580c"} strokeWidth={0.35} />
        <circle cx={measure.b.x} cy={measure.b.y} r={0.5} fill={sel ? "#3b82f6" : "#ea580c"} />
      </g>
      <g transform={`translate(${measure.b.x - 5.0}, ${measure.b.y - 4.0})`} textAnchor="end">
        <text x={0} y={0} fontSize={2.0} fill={sel ? "#3b82f6" : "#ea580c"} fontWeight="bold">
          {fmt(dist, unit)}
        </text>
      </g>
    </g>
  );
});

export const MemoizedPcbText = React.memo(({
  text, layer, sel, isGroupSel, isMoveTool,
  onPointerDown, onDoubleClick
}: {
  text: PcbText, layer: PcbLayer | undefined, sel: boolean, isGroupSel: boolean, isMoveTool: boolean,
  onPointerDown: (e: React.PointerEvent, t: PcbText) => void,
  onDoubleClick: (e: React.MouseEvent, t: PcbText) => void
}) => {
  if (layer && !layer.visible) return null;
  const col = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : (layer?.color || (text.layer === "silkscreen" ? "#fde047" : text.layer === "bottom_silkscreen" ? "#fde047" : "#22c55e"));
  return (
    <g
      transform={`translate(${text.x},${text.y}) rotate(${text.rotation})`}
      onPointerDown={(e) => onPointerDown(e, text)}
      onDoubleClick={(e) => onDoubleClick(e, text)}
      style={{ cursor: isMoveTool ? "move" : "default" }}
    >
      <rect
        x={-text.text.length * text.size * 0.3 - 0.2}
        y={-text.size * 0.5 - 0.2}
        width={text.text.length * text.size * 0.6 + 0.4}
        height={text.size + 0.4}
        fill="transparent"
      />
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={text.size}
        fill={col}
        fontWeight="bold"
        fontFamily="monospace"
        style={{ pointerEvents: "none" }}
      >
        {text.text}
      </text>
    </g>
  );
});


function renderNativeKicadFootprint(fp: PcbFootprint, selected: boolean, groupSelected: boolean) {
  const native = fp.nativeKicadFootprint;
  if (!native) return null;
  return (
    <KicadFootprintRenderer
      footprint={native}
      reference={fp.reference || native.properties?.Reference || "REF**"}
      value={fp.value || native.properties?.Value || native.name}
      selected={selected || groupSelected}
    />
  );
}

export const MemoizedPcbFootprint = React.memo(({
  fp, sel, isGroupSel, netIndex, highlightedNetIds, selectedPin,
  onPointerDown, onDoubleClick, onPadPointerDown, onPadDoubleClick
}: {
  fp: PcbFootprint, sel: boolean, isGroupSel: boolean, netIndex: any, highlightedNetIds: number[], selectedPin: { nodeId: string; pinIndex: number } | null,
  onPointerDown: (e: React.PointerEvent, fp: PcbFootprint) => void,
  onDoubleClick: (e: React.MouseEvent, fp: PcbFootprint) => void,
  onPadPointerDown: (e: React.PointerEvent, fp: PcbFootprint, pad: any) => void,
  onPadDoubleClick: (e: React.MouseEvent, fp: PcbFootprint, pad: any) => void
}) => {
  if (fp.nativeKicadFootprint) {
    const native = fp.nativeKicadFootprint;
    const b = nativeFootprintBounds(native);
    return (
      <g
        transform={`translate(${fp.x} ${fp.y}) rotate(${fp.rotation || 0})`}
        onPointerDown={(e) => onPointerDown(e, fp)}
        onDoubleClick={(e) => onDoubleClick(e, fp)}
      >
        <rect x={b.minX} y={b.minY} width={b.maxX-b.minX} height={b.maxY-b.minY}
          fill={isGroupSel ? "rgba(245, 158, 11, 0.15)" : sel ? "rgba(59, 130, 246, 0.08)" : "rgba(0, 0, 0, 0)"}
          stroke={isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : "none"}
          strokeWidth={isGroupSel ? 0.25 : sel ? 0.4 : 0}
          rx={0.5}
          style={{ pointerEvents: "auto" }} />
        {sel && (
          <rect x={b.minX - 0.4} y={b.minY - 0.4} width={b.maxX - b.minX + 0.8} height={b.maxY - b.minY + 0.8}
            fill="none" stroke="#3b82f6" strokeWidth={0.3} opacity={0.7} rx={0.7}
            style={{ pointerEvents: "none" }}
          />
        )}
        <KicadFootprintRenderer
          footprint={native}
          reference={fp.reference || native.properties?.Reference || "REF**"}
          value={fp.value || native.properties?.Value || native.name}
          selected={sel}
          onGeometryPointerDown={(e, item) => {
            const padNumber = typeof item.metadata?.padNumber === "string" ? item.metadata.padNumber : undefined;
            if (!padNumber) return;
            const pad = fp.pads.find(p => p.number === padNumber);
            if (!pad) return;
            e.stopPropagation();
            onPadPointerDown(e, fp, pad);
          }}
          onGeometryDoubleClick={(e, item) => {
            const padNumber = typeof item.metadata?.padNumber === "string" ? item.metadata.padNumber : undefined;
            if (!padNumber) return;
            const pad = fp.pads.find(p => p.number === padNumber);
            if (!pad) return;
            e.stopPropagation();
            onPadDoubleClick(e, fp, pad);
          }}
        />
        {fp.pads.length === 0 && null}
      </g>
    );
  }

  const bb = footprintBBox(fp);
  const sym = (fp.symbol || "").toLowerCase();
  const ref = (fp.reference || "").toLowerCase();
  const val = (fp.value || "").toLowerCase();
  
  const isPolarCap = checkIfPolarizedCapacitor(fp);
  const isNonPolarCap = (sym.includes("capacitor") || ref.startsWith("c")) && !isPolarCap;
  const isDiode = sym.includes("diode") || ref.startsWith("d");

  const transistorKeywords = ["transistor", "npn", "pnp", "mosfet", "bjt", "fet", "2n2222", "2n3904", "bc547", "bc557", "irf540", "irfz44", "irf9540", "bs170", "2n7000", "ao3400", "c1815", "a1015", "2n3055", "tip31", "tip122", "2n"];
  const regulatorKeywords = ["regulator", "7805", "7812", "7809", "7806", "7815", "7824", "7905", "7912", "lm317", "ams1117", "vreg", "ldo", "tl431", "lm7805", "lm7812"];

  const isTransistor = transistorKeywords.some(k => sym.includes(k) || val.includes(k)) || ref.startsWith("q") || ref.startsWith("m") || ref.startsWith("t") || ref.startsWith("vt") || fp.packageId === "to92" || fp.packageId === "to220" || fp.packageId === "sot23" || fp.packageId === "sot223" || fp.packageId === "dpak";
  const isRegulator = regulatorKeywords.some(k => sym.includes(k) || val.includes(k)) || ref.startsWith("vr") || (ref.startsWith("u") && (sym.includes("reg") || sym.includes("78") || sym.includes("317") || sym.includes("1117") || sym.includes("ams")));

  const isFuse = sym.includes("fuse") || ref.startsWith("f");
  const isResistor = sym.includes("resistor") || ref.startsWith("r");
  const isInductor = sym.includes("inductor") || ref.startsWith("l");
  const isCrystal = sym.includes("crystal") || ref.startsWith("y");
  const isScrewTerminal = sym.startsWith("conn_screw") || sym.includes("screw") || (fp.metadata?.type === "SCREW_TERMINAL");
  const isConnector = !isScrewTerminal && (sym.includes("header") || sym.includes("connector") || sym.includes("terminal") || sym.includes("jack") || sym.includes("usb") || ref.startsWith("j") || sym.includes("conn_"));
  const isSwitch = sym.includes("switch") || sym.includes("button") || ref.startsWith("sw");
  const isLED = sym.includes("led") || (isDiode && sym.includes("light"));
  const isDisplay = sym.includes("display") || sym.includes("lcd") || sym.includes("oled") || sym.includes("7-seg") || ref.startsWith("ds");
  const isDipSocket = sym.includes("dip") || sym.includes("socket") || val.includes("dip") || val.includes("socket") || (fp.packageId && fp.packageId.toLowerCase().includes("dip")) || (fp.footprint && fp.footprint.toLowerCase().includes("dip"));
  const isIC = !isTransistor && !isRegulator && !isDisplay && (sym.includes("ic") || sym.includes("opamp") || sym.includes("logic") || sym.includes("mcu") || sym.includes("ne555") || sym.includes("atmega") || ref.startsWith("u") || isDipSocket);

  const pad0 = fp.pads[0];
  const pad1 = fp.pads[1];
  const capValRaw = fp.value || (fp as any).val || "10uF";
  const capSize = getElectrolyticSize(capValRaw);
  const d = pad0 && pad1 ? Math.hypot(pad0.x - pad1.x, pad0.y - pad1.y) : capSize.pitch;
  const r = isPolarCap ? (capSize.w + 0.5) / 2 : Math.max(d * 0.6, 2.5);
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

  const silkColor = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : "#fde047";
  const fabColor = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : "rgba(148, 163, 184, 0.65)";
  const courtyardColor = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : "#c084fc";
  const bodyFillColor = "rgba(148, 163, 184, 0.28)";
  const bodyFillOpacity = 0.28;

  const renderComponentBody = () => {
    // 1. Polarized Capacitor (Electrolytic / Tantalum)
    if (isPolarCap) {
      const isSmd = fp.pads.length > 0 && fp.pads[0].layer !== "multi_layer";
      if (isSmd) {
        // SMD Tantalum / Electrolytic Cap Outline
        return (
          <g style={{ pointerEvents: "none" }} transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
             {/* F.Courtyard */}
             <rect x={-rectW/2 - 0.25} y={-rectH/2 - 0.25} width={rectW + 0.5} height={rectH + 0.5} rx={0.25} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
             {/* F.Fab */}
             <rect x={-rectW/2} y={-rectH/2} width={rectW} height={rectH} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
             {/* F.Silkscreen */}
             <rect x={-rectW/2} y={-rectH/2} width={rectW} height={rectH} fill="none" stroke={silkColor} strokeWidth={0.20} />
             {/* Negative Polarity Bar on the negative side completely filled in yellow */}
             <rect x={rectW/2 - rectW * 0.28} y={-rectH/2} width={rectW * 0.28} height={rectH} fill={silkColor} fillOpacity={1.0} stroke={silkColor} strokeWidth={0.15} />
          </g>
        );
      } else {
        // Through-hole Electrolytic Cap Outline
        const silkR = r + 0.15;
        const crtR = silkR + 0.25;
        return (
          <g style={{ pointerEvents: "none" }} transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
            {/* F.Courtyard - purple dashed circle directly surrounding the yellow circle with 0.25mm clearance */}
            <circle cx={0} cy={0} r={crtR} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
            {/* F.Fab - grey nominal body circle */}
            <circle cx={0} cy={0} r={r} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
            {/* F.Silkscreen - yellow body circle */}
            <circle cx={0} cy={0} r={silkR} fill="none" stroke={silkColor} strokeWidth={0.20} />
            {/* Negative pole solid yellow fill on Pin 2 side (x >= 0, 100% opacity) */}
            <path
              d={`M 0 ${-silkR} A ${silkR} ${silkR} 0 0 1 0 ${silkR} Z`}
              fill={silkColor}
              fillOpacity={1.0}
              stroke={silkColor}
              strokeWidth={0.15}
            />
            {/* Positive marker (+) near Pin 1 on the left */}
            <g transform={`translate(${-silkR - 0.55}, 0)`}>
              <line x1={-0.35} y1={0} x2={0.35} y2={0} stroke={silkColor} strokeWidth={0.15} />
              <line x1={0} y1={-0.35} x2={0} y2={0.35} stroke={silkColor} strokeWidth={0.15} />
            </g>
          </g>
        );
      }
    }
    
    // 2. Non-Polarized Capacitor (Ceramic / Film)
    if (isNonPolarCap) {
      return (
        <g style={{ pointerEvents: "none" }}>
          {/* F.Courtyard */}
          <rect x={rectX - 0.3} y={rectY - 0.3} width={rectW + 0.6} height={rectH + 0.6} rx={rectH / 3 + 0.3} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
          {/* F.Fab */}
          <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={rectH / 3} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
          {/* F.Silkscreen */}
          <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={rectH / 3} fill="none" stroke={silkColor} strokeWidth={0.20} />
          <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
            {/* Cap schematic symbol embedded in silkscreen */}
            <line x1={-0.6} y1={-rectH * 0.25} x2={-0.6} y2={rectH * 0.25} stroke={silkColor} strokeWidth={0.15} />
            <line x1={0.6} y1={-rectH * 0.25} x2={0.6} y2={rectH * 0.25} stroke={silkColor} strokeWidth={0.15} />
          </g>
        </g>
      );
    }

    // 3. Diode / LED
    if (isDiode || isLED) {
      const bodyL = Math.max(1.5, d - 1.8);
      const bodyH = Math.min(1.8, rectH - 0.4);
      const scaleFactor = Math.min(1.0, bodyL / 3.0);

      return (
        <g style={{ pointerEvents: "none" }}>
          {/* F.Courtyard */}
          <rect x={rectX - 0.3} y={rectY - 0.3} width={rectW + 0.6} height={rectH + 0.6} rx={0.3} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
          {/* F.Fab */}
          <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
          
          {/* Main body rectangle drawn strictly between the pads (no overlap with the copper pads) */}
          <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
            {/* F.Silkscreen */}
            <rect x={-bodyL / 2} y={-bodyH / 2} width={bodyL} height={bodyH} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.20} />
            
            {/* Cathode band on the right */}
            <rect x={bodyL / 2 - 0.45} y={-bodyH / 2} width={0.35} height={bodyH} fill={silkColor} />
            
            {/* Diode Symbol */}
            <g transform={`scale(${scaleFactor})`}>
              <polygon points="-0.5,-0.4 -0.5,0.4 0.1,0" fill="none" stroke={silkColor} strokeWidth={0.15} />
              <line x1="0.1" y1="-0.4" x2="0.1" y2="0.4" stroke={silkColor} strokeWidth={0.15} />
            </g>

            {isLED && (
              <g transform={`translate(0, ${-bodyH / 2 - 0.2}) scale(${scaleFactor})`}>
                <line x1={-0.3} y1={0} x2={0.2} y2={-0.5} stroke={silkColor} strokeWidth={0.15} />
                <polygon points="0.2,-0.5 -0.1,-0.5 0.2,-0.2" fill={silkColor} />
                
                <line x1={0.1} y1={0.2} x2={0.6} y2={-0.3} stroke={silkColor} strokeWidth={0.15} />
                <polygon points="0.6,-0.3 0.3,-0.3 0.6,0.0" fill={silkColor} />
              </g>
            )}
          </g>
        </g>
      );
    }

    // 4. Transistor, MOSFET, or Voltage Regulator (Standard Packages: TO-92, TO-220, SOT-23, SOT-223, DPAK)
    if (isTransistor || isRegulator) {
      const pad0 = fp.pads[0];
      const pad1 = fp.pads[1];

      const isTO220 = fp.packageId === "to220" || rectW > 6.0;
      const isSmd = (fp.pads.length > 0 && fp.pads[0].layer !== "multi_layer") || fp.packageId === "sot23" || fp.packageId === "sot223" || fp.packageId === "dpak";

      if (isSmd) {
        const isDPAKOrSOT223 = rectW > 4.5 || fp.packageId === "sot223" || fp.packageId === "dpak";
        return (
          <g style={{ pointerEvents: "none" }}>
            {/* F.Courtyard */}
            <rect x={rectX - 0.3} y={rectY - 0.3} width={rectW + 0.6} height={rectH + 0.6} rx={0.3} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
            {/* F.Fab */}
            <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
            {/* F.Silkscreen */}
            <rect
              x={rectX + 0.2}
              y={rectY + 0.5}
              width={rectW - 0.4}
              height={rectH - 1.0}
              rx={0.2}
              fill="none"
              stroke={silkColor}
              strokeWidth={0.20}
            />
            <line
              x1={rectX + 0.2}
              y1={rectY + 0.8}
              x2={rectX + 0.6}
              y2={rectY + 0.5}
              stroke={silkColor}
              strokeWidth={0.15}
            />
            {isDPAKOrSOT223 && (
              <rect
                x={rectX + rectW * 0.15}
                y={rectY - 0.8}
                width={rectW * 0.7}
                height={0.8}
                fill="none"
                stroke={silkColor}
                strokeWidth={0.15}
              />
            )}
          </g>
        );
      }

      if (isTO220) {
        const bodyW = Math.max(rectW, 10.2);
        const bodyH = 4.5;
        const bodyX = nonPolarCx - bodyW / 2;
        const bodyY = minPY - 1.5;

        return (
          <g style={{ pointerEvents: "none" }}>
            {/* F.Courtyard */}
            <rect x={bodyX - 0.4} y={bodyY - 2.2} width={bodyW + 0.8} height={bodyH + 4.2} rx={0.4} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
            {/* F.Fab */}
            <rect x={bodyX} y={bodyY - 1.8} width={bodyW} height={bodyH + 1.8} rx={0.2} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
            {/* F.Silkscreen */}
            <rect
              x={bodyX}
              y={bodyY}
              width={bodyW}
              height={bodyH}
              rx={0.2}
              fill="none"
              stroke={silkColor}
              strokeWidth={0.20}
            />
            <rect
              x={bodyX}
              y={bodyY - 1.8}
              width={bodyW}
              height={1.8}
              fill="none"
              stroke={silkColor}
              strokeWidth={0.15}
            />
            <circle
              cx={nonPolarCx}
              cy={bodyY - 0.9}
              r={0.6}
              fill="none"
              stroke={silkColor}
              strokeWidth={0.15}
            />
          </g>
        );
      }

      // TO-92 (D-shape) Standard Footprint
      const isVerticalFlat = pad0 && pad1 ? Math.abs(pad0.x - pad1.x) < 0.5 : true;

      if (isVerticalFlat) {
        const padMinY = Math.min(...fp.pads.map(p => p.y));
        const padMaxY = Math.max(...fp.pads.map(p => p.y));
        const padX = pad0 ? pad0.x : nonPolarCx;

        const flatX = padX - 1.3;
        const topY = padMinY - 1.5;
        const botY = padMaxY + 1.5;
        const height = botY - topY;
        const arcRadius = height / 2;
        const backX = flatX + arcRadius * 1.3;

        const pathD = `M ${flatX} ${topY} L ${backX - arcRadius * 0.3} ${topY} A ${arcRadius} ${arcRadius} 0 0 1 ${backX - arcRadius * 0.3} ${botY} L ${flatX} ${botY} Z`;

        return (
          <g style={{ pointerEvents: "none" }}>
            {/* F.Courtyard */}
            {/* F.Fab */}
            <path d={pathD} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
            {/* F.Silkscreen */}
            <path
              d={pathD}
              fill="none"
              stroke={silkColor}
              strokeWidth={0.20}
            />
            <line
              x1={flatX + 0.3}
              y1={topY + 0.3}
              x2={flatX + 0.3}
              y2={botY - 0.3}
              stroke={silkColor}
              strokeWidth={0.15}
            />
            <circle
              cx={flatX - 0.5}
              cy={padMinY}
              r={0.25}
              fill={silkColor}
            />

            {fp.pads.map((p, idx) => {
              const pinLabel = p.name || p.number || String(idx + 1);
              return (
                <text
                  key={`lbl-to92v-${p.pinIndex ?? idx}-${idx}`}
                  x={flatX - 1.2}
                  y={p.y}
                  fill={silkColor}
                  fontSize={1.0}
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="end"
                  dominantBaseline="middle"
                  style={{ pointerEvents: "none", opacity: 0.95 }}
                >
                  {pinLabel}
                </text>
              );
            })}
          </g>
        );
      } else {
        const padMinX = Math.min(...fp.pads.map(p => p.x));
        const padMaxX = Math.max(...fp.pads.map(p => p.x));
        const padY = pad0 ? pad0.y : nonPolarCy;

        const flatY = padY + 1.3;
        const leftX = padMinX - 1.5;
        const rightX = padMaxX + 1.5;
        const width = rightX - leftX;
        const arcRadius = width / 2;
        const backY = flatY - arcRadius * 1.3;

        const pathD = `M ${leftX} ${flatY} L ${leftX} ${backY + arcRadius * 0.3} A ${arcRadius} ${arcRadius} 0 0 1 ${rightX} ${backY + arcRadius * 0.3} L ${rightX} ${flatY} Z`;

        return (
          <g style={{ pointerEvents: "none" }}>
            {/* F.Courtyard */}
            {/* F.Fab */}
            <path d={pathD} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
            {/* F.Silkscreen */}
            <path
              d={pathD}
              fill="none"
              stroke={silkColor}
              strokeWidth={0.20}
            />
            <line
              x1={leftX + 0.3}
              y1={flatY - 0.3}
              x2={rightX - 0.3}
              y2={flatY - 0.3}
              stroke={silkColor}
              strokeWidth={0.15}
            />
            <circle
              cx={padMinX}
              cy={flatY + 0.5}
              r={0.25}
              fill={silkColor}
            />

            {fp.pads.map((p, idx) => {
              const pinLabel = p.name || p.number || String(idx + 1);
              return (
                <text
                  key={`lbl-to92h-${p.pinIndex ?? idx}-${idx}`}
                  x={p.x}
                  y={flatY + 1.2}
                  fill={silkColor}
                  fontSize={1.0}
                  fontWeight="bold"
                  fontFamily="monospace"
                  textAnchor="middle"
                  dominantBaseline="hanging"
                  style={{ pointerEvents: "none", opacity: 0.95 }}
                >
                  {pinLabel}
                </text>
              );
            })}
          </g>
        );
      }
    }

    // 6. Resistor
    if (isResistor) {
       return (
         <g style={{ pointerEvents: "none" }}>
           {/* F.Courtyard */}
           <rect x={rectX - 0.3} y={rectY - 0.3} width={rectW + 0.6} height={rectH + 0.6} rx={0.3} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
           {/* F.Fab */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
           {/* F.Silkscreen */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.20} />
           {/* Zig-Zag line inside the box */}
           <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
              <polyline points={`${-rectW/3},0 ${-rectW/6},${-rectH/3} 0,${rectH/3} ${rectW/6},${-rectH/3} ${rectW/3},0`} fill="none" stroke={silkColor} strokeWidth={0.15} />
           </g>
         </g>
       );
    }

    // 7. Inductor
    if (isInductor) {
       return (
         <g style={{ pointerEvents: "none" }}>
           {/* F.Courtyard */}
           {/* F.Fab */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={rectH/2} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
           {/* F.Silkscreen */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={rectH/2} fill="none" stroke={silkColor} strokeWidth={0.20} />
           <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
              {/* Coils */}
              <path d={`M ${-rectW/3} 0 A ${rectW/9} ${rectH/3} 0 1 1 ${-rectW/9} 0 A ${rectW/9} ${rectH/3} 0 1 1 ${rectW/9} 0 A ${rectW/9} ${rectH/3} 0 1 1 ${rectW/3} 0`} fill="none" stroke={silkColor} strokeWidth={0.15} />
           </g>
         </g>
       );
    }

    // 8. Fuse
    if (isFuse) {
       return (
         <g style={{ pointerEvents: "none" }}>
           {/* F.Courtyard */}
           <rect x={rectX - 0.3} y={rectY - 0.3} width={rectW + 0.6} height={rectH + 0.6} rx={0.3} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
           {/* F.Fab */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
           {/* F.Silkscreen */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.20} />
           {/* Continuous line through the middle (classic fuse symbol) */}
           <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
             <line x1={-rectW/2} y1={0} x2={rectW/2} y2={0} stroke={silkColor} strokeWidth={0.15} />
           </g>
         </g>
       );
    }

    // 9. Crystal / Oscillator
    if (isCrystal) {
      return (
         <g style={{ pointerEvents: "none" }}>
           {/* F.Courtyard */}
           {/* F.Fab */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={1} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
           {/* F.Silkscreen */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={1} fill="none" stroke={silkColor} strokeWidth={0.20} />
           <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
             <line x1={-0.6} y1={-rectH * 0.25} x2={-0.6} y2={rectH * 0.25} stroke={silkColor} strokeWidth={0.15} />
             <line x1={0.6} y1={-rectH * 0.25} x2={0.6} y2={rectH * 0.25} stroke={silkColor} strokeWidth={0.15} />
             <rect x={-0.3} y={-rectH * 0.3} width={0.6} height={rectH * 0.6} fill="none" stroke={silkColor} strokeWidth={0.15} />
           </g>
         </g>
      );
    }

    // 10. Screw Terminal Block
    if (isScrewTerminal) {
      const courtyardY = rectY + rectH;
      const courtyardH = 3.0;
      return (
         <g style={{ pointerEvents: "none" }}>
           {/* F.Courtyard */}
           {/* F.Fab */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
           {/* F.Silkscreen */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={silkColor} strokeWidth={0.20} />
           {fp.pads.map((p, i) => (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={1.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                <line x1={p.x - 0.7} y1={p.y} x2={p.x + 0.7} y2={p.y} stroke={silkColor} strokeWidth={0.15} />
              </g>
           ))}
           {fp.pads.map((p, i) => (
              <rect key={`w_${i}`} x={p.x - 1.0} y={rectY + rectH - 1.2} width={2.0} height={1.0} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
           ))}
           <rect x={rectX} y={courtyardY} width={rectW} height={courtyardH} fill="rgba(148, 163, 184, 0.08)" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
           <text x={rectX + rectW / 2} y={courtyardY + 2.0} fontSize={0.9} fill={courtyardColor} textAnchor="middle" fontWeight="bold">WIRE KEEP OUT (3mm)</text>
         </g>
      );
    }

    // 10b. Connector / Header
    if (isConnector) {
      return (
         <g style={{ pointerEvents: "none" }}>
           {/* F.Courtyard */}
           <rect x={rectX - 0.3} y={rectY - 0.3} width={rectW + 0.6} height={rectH + 0.6} rx={0.3} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
           {/* F.Fab */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
           {/* F.Silkscreen */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={silkColor} strokeWidth={0.20} />
           {/* Individual pin outlines inside connector */}
           {fp.pads.map((p, i) => (
              <rect key={i} x={p.x - p.width/2 - 0.2} y={p.y - p.height/2 - 0.2} width={p.width + 0.4} height={p.height + 0.4} fill="none" stroke={silkColor} strokeWidth={0.15} />
           ))}
           {/* Pin 1 marker */}
           {fp.pads.length > 0 && (
             <polygon points={`${fp.pads[0].x - fp.pads[0].width/2 - 0.6},${fp.pads[0].y} ${fp.pads[0].x - fp.pads[0].width/2 - 1.2},${fp.pads[0].y - 0.4} ${fp.pads[0].x - fp.pads[0].width/2 - 1.2},${fp.pads[0].y + 0.4}`} fill={silkColor} />
           )}
         </g>
      );
    }

    // 11. Switch / Button
    if (isSwitch) {
      return (
         <g style={{ pointerEvents: "none" }}>
           {/* F.Courtyard */}
           <rect x={rectX - 0.3} y={rectY - 0.3} width={rectW + 0.6} height={rectH + 0.6} rx={0.3} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
           {/* F.Fab */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
           {/* F.Silkscreen */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={silkColor} strokeWidth={0.20} />
           {/* Inner actuator outline (circle for tactile buttons, rect for sliders) */}
           {fp.pads.length <= 4 ? (
              <circle cx={nonPolarCx} cy={nonPolarCy} r={Math.min(rectW, rectH)*0.3} fill="none" stroke={silkColor} strokeWidth={0.15} />
           ) : (
              <rect x={rectX + rectW*0.1} y={rectY + rectH*0.1} width={rectW*0.8} height={rectH*0.8} fill="none" stroke={silkColor} strokeWidth={0.15} />
           )}
         </g>
      );
    }

    // 12. Display (LCD/OLED)
    if (isDisplay) {
      return (
         <g style={{ pointerEvents: "none" }}>
           {/* F.Courtyard */}
           <rect x={rectX - 0.5} y={rectY - 0.5} width={rectW + 1.0} height={rectH + 1.0} rx={1.0} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
           {/* F.Fab */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.5} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
           {/* F.Silkscreen */}
           <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.5} fill="none" stroke={silkColor} strokeWidth={0.20} />
           {/* Screen Bezel */}
           <rect x={rectX + 1.5} y={rectY + 1.5} width={rectW - 3} height={rectH - 3} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
         </g>
      );
    }

    // 13. Integrated Circuit (IC / MCU / DIP Socket)
    if (isIC && fp.pads.length >= 2) {
      const isHorizontal = rectW > rectH;
      const isDip = isDipSocket || sym.includes("dip") || (fp.packageId && fp.packageId.toLowerCase().includes("dip")) || (fp.footprint && fp.footprint.toLowerCase().includes("dip"));
      
      if (isDip) {
        // KiCad standard DIP: pads are through-hole at the left and right sides
        // Body is the centered plastic rectangle
        const padWidth = fp.pads[0]?.width || 1.6;
        const padHeight = fp.pads[0]?.height || 1.6;
        const rowSpacing = Math.max(0.1, maxPX - minPX);
        const bodyW = rowSpacing <= 7.62 ? Math.min(6.35, rowSpacing - 0.4) : Math.max(rowSpacing - 1.27, 2.5);
        const bodyH = (maxPY - minPY) + padHeight * 0.4;
        const bodyLeft = nonPolarCx - bodyW / 2;
        const bodyRight = nonPolarCx + bodyW / 2;
        const bodyTop = nonPolarCy - bodyH / 2;
        const bodyBot = nonPolarCy + bodyH / 2;
        const notchR = Math.min(1.27, bodyW * 0.25);
        const chamfer = Math.min(1.0, bodyW * 0.18);

        const pad1 = fp.pads[0];
        const p1X = pad1 ? pad1.x : minPX;
        const p1Y = pad1 ? pad1.y : minPY;

        // Courtyard: 0.50mm standard IPC clearance
        const crtX1 = Math.min(bodyLeft, minPX - padWidth / 2 - 0.6) - 0.50;
        const crtX2 = Math.max(bodyRight, maxPX + padWidth / 2) + 0.50;
        const crtY1 = Math.min(bodyTop, minPY - padHeight / 2) - 0.50;
        const crtY2 = Math.max(bodyBot, maxPY + padHeight / 2) + 0.50;

        return (
          <g style={{ pointerEvents: "none" }}>
            {/* F.Courtyard - Purple Dashed Outline with 0.50mm clearance */}
            <rect
              x={crtX1}
              y={crtY1}
              width={crtX2 - crtX1}
              height={crtY2 - crtY1}
              fill="none"
              stroke={courtyardColor}
              strokeWidth={0.12}
              strokeDasharray="0.6 0.4"
              opacity={0.9}
            />

            {/* F.Fab - Standard Mechanical Body Outline with Pin 1 chamfer & top notch */}
            <path
              d={`M ${bodyLeft + chamfer} ${bodyTop} L ${nonPolarCx - notchR} ${bodyTop} A ${notchR} ${notchR} 0 0 1 ${nonPolarCx + notchR} ${bodyTop} L ${bodyRight} ${bodyTop} L ${bodyRight} ${bodyBot} L ${bodyLeft} ${bodyBot} L ${bodyLeft} ${bodyTop + chamfer} Z`}
              fill="none"
              stroke={fabColor}
              strokeWidth={0.15}
              opacity={0.65}
            />

            {/* F.Silkscreen - Outline with orientation notch */}
            <path
              d={`M ${bodyLeft} ${bodyTop} L ${nonPolarCx - notchR} ${bodyTop} A ${notchR} ${notchR} 0 0 1 ${nonPolarCx + notchR} ${bodyTop} L ${bodyRight} ${bodyTop} L ${bodyRight} ${bodyBot} L ${bodyLeft} ${bodyBot} L ${bodyLeft} ${bodyTop}`}
              fill="none"
              stroke={silkColor}
              strokeWidth={0.18}
            />

            {/* Pin 1 Silkscreen Indicator Line extending leftwards towards Pin 1 */}
            <line
              x1={bodyLeft}
              y1={bodyTop}
              x2={p1X - padWidth / 2 - 0.4}
              y2={bodyTop}
              stroke={silkColor}
              strokeWidth={0.18}
            />

            {/* Pin 1 Silkscreen Indicator Dot */}
            <circle
              cx={p1X - padWidth / 2 - 0.6}
              cy={p1Y}
              r={0.25}
              fill={silkColor}
            />

            {/* Inner DIP socket recess (if socket) */}
            {isDipSocket && (
              <rect
                x={bodyLeft + 0.6}
                y={bodyTop + 0.6}
                width={Math.max(bodyW - 1.2, 1)}
                height={Math.max(bodyH - 1.2, 1)}
                rx={0.2}
                fill="none"
                stroke={silkColor}
                strokeWidth={0.15}
                strokeDasharray="1,1"
                opacity={0.6}
              />
            )}
          </g>
        );
      }

      const dX = rectX;
      const dY = rectY;
      const dW = rectW;
      const dH = rectH;

      return (
         <g style={{ pointerEvents: "none" }}>
           {/* F.Courtyard */}
           <rect x={dX - 0.4} y={dY - 0.4} width={dW + 0.8} height={dH + 0.8} rx={0.8} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
           {/* F.Fab */}
           <rect x={dX} y={dY} width={dW} height={dH} rx={0.4} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
           {/* F.Silkscreen */}
           <rect x={dX} y={dY} width={dW} height={dH} rx={0.4} fill="none" stroke={silkColor} strokeWidth={0.20} />
           
           {/* Pin 1 Dot */}
           {fp.pads.length > 0 && (
             <circle cx={fp.pads[0].x} cy={fp.pads[0].y} r={0.35} fill={silkColor} />
           )}

           {/* Notch indicating orientation */}
           {isHorizontal ? (
             <path d={`M ${dX} ${nonPolarCy - 0.8} A 0.8 0.8 0 0 1 ${dX} ${nonPolarCy + 0.8}`} fill="none" stroke={silkColor} strokeWidth={0.15} />
           ) : (
             <path d={`M ${nonPolarCx - 0.8} ${dY} A 0.8 0.8 0 0 0 ${nonPolarCx + 0.8} ${dY}`} fill="none" stroke={silkColor} strokeWidth={0.15} />
           )}
         </g>
      );
    }

    // 14. Fallback Default Shapes (Polygons/Lines defined in part library)
    return (
      <g style={{ pointerEvents: "none" }}>
        {/* F.Courtyard */}
        <rect x={rectX - 0.3} y={rectY - 0.3} width={rectW + 0.6} height={rectH + 0.6} rx={0.3} fill="none" stroke={courtyardColor} strokeWidth={0.15} strokeDasharray="0.5 0.3" opacity={0.9} />
        {/* F.Fab */}
        <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={fabColor} strokeWidth={0.15} opacity={0.65} />
        {/* F.Silkscreen */}
        {(fp as any).lines && (fp as any).lines.length > 0 ? (
          (fp as any).lines.map((ln: any, i: number) => (
            <line key={i} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke={silkColor} strokeWidth={0.20} />
          ))
        ) : (!(fp as any).circles || (fp as any).circles.length === 0) ? (
          <>
            {/* Simple bounding box outline for unknown components */}
            <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.20} />
            {fp.pads.length > 0 && <circle cx={fp.pads[0].x} cy={fp.pads[0].y} r={0.3} fill={silkColor} opacity={0.8} />}
          </>
        ) : null}
        {((fp as any).circles || []).map((c: any, i: number) => (
          <circle key={i} cx={c.cx} cy={c.cy} r={c.r} stroke={silkColor} strokeWidth={0.20} fill="none" />
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
        stroke="none"
        strokeWidth={0}
        rx={0.5}
      />
      {sel && (
        <rect x={bb.x - 0.4} y={bb.y - 0.4} width={bb.w + 0.8} height={bb.h + 0.8}
          fill="none" stroke="#3b82f6" strokeWidth={0.3} opacity={0.7} rx={0.7}
          style={{ pointerEvents: "none" }}
        />
      )}
      <g transform={`translate(${fp.x},${fp.y}) rotate(${fp.rotation})`}>
        
        {fp.nativeKicadFootprint ? renderNativeKicadFootprint(fp, sel, isGroupSel) : renderComponentBody()}

        {fp.pads.map((pad, idx) => {
          const netId = netIndex.pinNet.get(`${fp.id}:${pad.pinIndex}`);
          const isPadHi = netId !== undefined && highlightedNetIds.includes(netId);
          const isPadSel = selectedPin?.nodeId === fp.id && selectedPin?.pinIndex === pad.pinIndex;
          return (
            <MemoizedPcbPad
              key={`pad-${pad.id || pad.pinIndex || idx}-${idx}`}
              pad={pad}
              sel={sel}
              isGroupSel={isGroupSel}
              isPadHi={isPadHi}
              isPadSel={isPadSel}
              onPadPointerDown={(e) => onPadPointerDown(e, fp, pad)}
              onPadDoubleClick={(e) => onPadDoubleClick(e, fp, pad)}
            />
          );
        })}
        {!fp.nativeKicadFootprint && (
          <>
            <text x={0} y={minPY - 1.0} fill={silkColor} fontSize={1.0}
              textAnchor="middle" fontFamily="monospace" fontWeight="bold"
              style={{ pointerEvents: "none" }}>
              {fp.reference}
            </text>
            <text x={0} y={maxPY + 1.8} fill={silkColor} fontSize={1.0}
              textAnchor="middle" fontFamily="monospace"
              style={{ pointerEvents: "none" }}>
              {fp.value}
            </text>
          </>
        )}
      </g>
    </g>
  );
});

export const MemoizedPcbGraphic = React.memo(({
  graphic, layer, sel, isGroupSel, onPointerDown, onDoubleClick
}: {
  graphic: PcbGraphic,
  layer: PcbLayer | undefined,
  sel: boolean,
  isGroupSel: boolean,
  onPointerDown: (e: React.PointerEvent, g: PcbGraphic) => void,
  onDoubleClick: (e: React.MouseEvent, g: PcbGraphic) => void,
}) => {
  if (layer && !layer.visible) return null;

  const color = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : (layer?.color || "#ffd166");
  const strokeW = graphic.stroke?.width || graphic.width || 0.2;
  const strokeDash = graphic.stroke?.type === "dash" ? "1 0.5" : graphic.stroke?.type === "dot" ? "0.2 0.3" : undefined;
  const fillCol = graphic.fill === "solid" ? color : "none";

  const renderShape = () => {
    switch (graphic.kind) {
      case "line":
        return <line x1={graphic.start.x} y1={graphic.start.y} x2={graphic.end.x} y2={graphic.end.y} stroke={color} strokeWidth={strokeW} strokeDasharray={strokeDash} strokeLinecap="round" />;
      case "arc": {
        const d = graphic.mid
          ? `M ${graphic.start.x} ${graphic.start.y} Q ${graphic.mid.x} ${graphic.mid.y} ${graphic.end.x} ${graphic.end.y}`
          : `M ${graphic.start.x} ${graphic.start.y} L ${graphic.end.x} ${graphic.end.y}`;
        return <path d={d} stroke={color} strokeWidth={strokeW} strokeDasharray={strokeDash} fill="none" strokeLinecap="round" />;
      }
      case "circle": {
        const r = graphic.radius || Math.hypot(graphic.end.x - graphic.center.x, graphic.end.y - graphic.center.y);
        return <circle cx={graphic.center.x} cy={graphic.center.y} r={r} stroke={color} strokeWidth={strokeW} strokeDasharray={strokeDash} fill={fillCol} />;
      }
      case "rect": {
        const minX = Math.min(graphic.start.x, graphic.end.x);
        const minY = Math.min(graphic.start.y, graphic.end.y);
        const w = Math.abs(graphic.end.x - graphic.start.x);
        const h = Math.abs(graphic.end.y - graphic.start.y);
        return <rect x={minX} y={minY} width={w} height={h} rx={graphic.radius || 0} stroke={color} strokeWidth={strokeW} strokeDasharray={strokeDash} fill={fillCol} />;
      }
      case "poly":
      case "curve": {
        const ptsStr = (graphic.points || []).map(p => `${p.x},${p.y}`).join(" ");
        return <polygon points={ptsStr} stroke={color} strokeWidth={strokeW} strokeDasharray={strokeDash} fill={fillCol} strokeLinejoin="round" strokeLinecap="round" />;
      }
      case "text": {
        return (
          <text
            x={graphic.position.x}
            y={graphic.position.y}
            fill={color}
            fontSize={graphic.size?.y || graphic.size?.x || 1.2}
            fontFamily="monospace"
            fontWeight={graphic.bold ? "bold" : "normal"}
            fontStyle={graphic.italic ? "italic" : "normal"}
            transform={graphic.rotation ? `rotate(${graphic.rotation} ${graphic.position.x} ${graphic.position.y})` : undefined}
          >
            {graphic.text}
          </text>
        );
      }
      case "textbox": {
        return (
          <text
            x={graphic.position.x}
            y={graphic.position.y}
            fill={color}
            fontSize={graphic.size?.y || 1.2}
            fontFamily="monospace"
          >
            {graphic.text}
          </text>
        );
      }
      default:
        return null;
    }
  };

  return (
    <g onPointerDown={(e) => onPointerDown(e, graphic)} onDoubleClick={(e) => onDoubleClick(e, graphic)} style={{ cursor: "pointer" }}>
      {renderShape()}
    </g>
  );
});

export const MemoizedPcbDimension = React.memo(({
  dimension, layer, sel, isGroupSel, onPointerDown, onDoubleClick
}: {
  dimension: PcbDimension,
  layer: PcbLayer | undefined,
  sel: boolean,
  isGroupSel: boolean,
  onPointerDown: (e: React.PointerEvent, d: PcbDimension) => void,
  onDoubleClick: (e: React.MouseEvent, d: PcbDimension) => void,
}) => {
  if (layer && !layer.visible) return null;
  const color = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : (layer?.color || "#06b6d4");
  const pts = dimension.points || [];
  if (pts.length < 2) return null;

  const p1 = pts[0];
  const p2 = pts[1];
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;
  const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
  const textVal = dimension.text || `${len.toFixed(2)} mm`;

  return (
    <g onPointerDown={(e) => onPointerDown(e, dimension)} onDoubleClick={(e) => onDoubleClick(e, dimension)} style={{ cursor: "pointer" }}>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={0.15} strokeDasharray="0.3 0.2" />
      <circle cx={p1.x} cy={p1.y} r={0.25} fill={color} />
      <circle cx={p2.x} cy={p2.y} r={0.25} fill={color} />
      <text x={midX} y={midY - 0.5} fill={color} fontSize={1.0} textAnchor="middle" fontFamily="monospace">
        {textVal}
      </text>
    </g>
  );
});

export const MemoizedPcbTarget = React.memo(({
  target, layer, sel, isGroupSel, onPointerDown, onDoubleClick
}: {
  target: PcbTarget,
  layer: PcbLayer | undefined,
  sel: boolean,
  isGroupSel: boolean,
  onPointerDown: (e: React.PointerEvent, t: PcbTarget) => void,
  onDoubleClick: (e: React.MouseEvent, t: PcbTarget) => void,
}) => {
  if (layer && !layer.visible) return null;
  const color = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : (layer?.color || "#e11d48");
  const s = target.size || 3;
  const r = s / 2;

  return (
    <g onPointerDown={(e) => onPointerDown(e, target)} onDoubleClick={(e) => onDoubleClick(e, target)} style={{ cursor: "pointer" }}>
      <circle cx={target.x} cy={target.y} r={r} fill="none" stroke={color} strokeWidth={0.2} />
      <circle cx={target.x} cy={target.y} r={r * 0.5} fill="none" stroke={color} strokeWidth={0.15} />
      <line x1={target.x - r * 1.3} y1={target.y} x2={target.x + r * 1.3} y2={target.y} stroke={color} strokeWidth={0.15} />
      <line x1={target.x} y1={target.y - r * 1.3} x2={target.x} y2={target.y + r * 1.3} stroke={color} strokeWidth={0.15} />
    </g>
  );
});
