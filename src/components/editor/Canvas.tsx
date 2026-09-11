import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  SchematicDoc,
  SchematicNode,
  SchematicWire,
  WireColor,
  GRID,
  computeJunctions,
  computeCrossings,
  findWireHit,
  splitWireAtPoint,
  nextReference,
} from "@/lib/schematic";
import { SYMBOLS, transformedPins, nodeBBox } from "@/lib/symbols";
import { buildNetIndex, netIdForSelection } from "@/lib/netlist";
import { SmartGrid, GridStyle } from "./Grid";
import type { SymbolId } from "@/lib/schematic";
import { useI18n } from "@/i18n";
import { toast } from "sonner";
import {
  generateSpiceNetlist,
  runSimulation,
  SimulationResult,
  getComponentRef,
  getVoltageColor,
} from "@/lib/simulation";
import { motion, AnimatePresence } from "motion/react";
import { RealisticComponent, RealisticDefs } from "./RealisticComponents";

function CurrentFlow({
  path,
  current,
  zoom,
}: {
  path: string;
  current: number;
  zoom: number;
}) {
  const absI = Math.abs(current);
  if (absI < 1e-6) return null;
  if (zoom < 0.4) return null; // Performance optimization for mobile

  const direction = current > 0 ? 1 : -1;
  const cycleLength = 1.2;
  const dashLength = 0.6;
  const gapLength = cycleLength - dashLength;
  
  // Velocity in units per second
  const v = Math.min(15, Math.max(0.5, absI * 250));
  const duration = cycleLength / v;

  return (
    <g style={{ pointerEvents: "none" }}>
      {/* Outer Glow / Trail */}
      <path
        d={path}
        fill="none"
        stroke="#eab308"
        strokeWidth={0.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${dashLength} ${gapLength}`}
        opacity={0.4}
        style={{ filter: "blur(1.5px)" }}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={direction > 0 ? -cycleLength : cycleLength}
          dur={`${duration}s`}
          repeatCount="indefinite"
        />
      </path>

      {/* Inner Core */}
      <path
        d={path}
        fill="none"
        stroke="#fef08a"
        strokeWidth={0.08}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={`${dashLength} ${gapLength}`}
        opacity={0.9}
        style={{ filter: "drop-shadow(0 0 1px #facc15)" }}
      >
        <animate
          attributeName="stroke-dashoffset"
          from="0"
          to={direction > 0 ? -cycleLength : cycleLength}
          dur={`${duration}s`}
          repeatCount="indefinite"
        />
      </path>
    </g>
  );
}

function MiniOscilloscope({
  values,
  currentTime,
  width = 3,
  height = 1.2,
}: {
  values: { t: number; v: number }[];
  currentTime: number;
  width?: number;
  height?: number;
}) {
  if (!values || values.length < 2) return null;

  // Show last 50ms or similar window
  const windowSize = 0.05;
  const startTime = Math.max(0, currentTime - windowSize);
  const filtered = values.filter((v) => v.t >= startTime && v.t <= currentTime);

  if (filtered.length < 2) return null;

  const minV = Math.min(...filtered.map((v) => v.v));
  const maxV = Math.max(...filtered.map((v) => v.v));
  const range = Math.max(0.1, maxV - minV);

  const points = filtered
    .map((v) => {
      const x = ((v.t - startTime) / windowSize) * width;
      const y = height - ((v.v - minV) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <g transform="translate(0.2, 0.8)">
      <rect width={width} height={height} fill="#1e293b" rx={0.1} />
      <polyline
        points={points}
        fill="none"
        stroke="#10b981"
        strokeWidth={0.04}
        strokeLinejoin="round"
      />
      <text
        x={width - 0.1}
        y={height - 0.1}
        fontSize={0.18}
        fill="#94a3b8"
        textAnchor="end"
      >
        {maxV.toFixed(1)}V
      </text>
      <text
        x={width - 0.1}
        y={0.2}
        fontSize={0.18}
        fill="#94a3b8"
        textAnchor="end"
      >
        {minV.toFixed(1)}V
      </text>
    </g>
  );
}

const getHeatColor = (p: number) => {
  if (p < 0.05) return null;
  if (p < 0.2) return "rgba(251, 191, 36, 0.4)"; // Yellow-400 glow
  if (p < 0.6) return "rgba(249, 115, 22, 0.6)"; // Orange-500 glow
  return "rgba(239, 68, 68, 0.8)"; // Red-500 glow
};

function FloatingNodeIndicator({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle
        r={0.25}
        fill="none"
        stroke="#ef4444"
        strokeWidth={0.04}
        opacity={0.6}
      >
        <animate
          attributeName="r"
          values="0.2;0.35;0.2"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      <path
        d="M 0,-0.15 L 0,0.05 M 0,0.12 L 0,0.15"
        stroke="#ef4444"
        strokeWidth={0.06}
        strokeLinecap="round"
      />
    </g>
  );
}

function ComponentStateAnimation({
  node,
  stats,
  isSimulating,
  currentTime,
  doc,
}: {
  node: SchematicNode;
  stats: any;
  isSimulating: boolean;
  currentTime: number;
  doc: SchematicDoc;
}) {
  const sym = SYMBOLS[node.symbol];
  if (!sym) return null;
  const cx = sym.width / 2,
    cy = sym.height / 2;

  const fault = doc.faults?.find((f) => f.targetId === node.id);
  const isDark = doc.canvasColor === "black";

  return (
    <g>
      {fault && (
        <g transform={`translate(${cx} ${cy})`} opacity={0.8}>
          <motion.path
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            d="M -0.4 -0.4 L 0.4 0.4 M 0.4 -0.4 L -0.4 0.4"
            stroke="#ef4444"
            strokeWidth={0.15}
            strokeLinecap="round"
          />
          <circle
            r={0.6}
            fill="none"
            stroke="#ef4444"
            strokeWidth={0.08}
            strokeDasharray="0.2,0.1"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="0.3"
              dur="1s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      )}

      {node.symbol === "switch" && (
        <g>
          {/* Mask original diagonal line */}
          <line
            x1={1}
            y1={1}
            x2={2.2}
            y2={0.3}
            stroke={isDark ? "#0b1220" : "#ffffff"}
            strokeWidth={0.25}
          />
          <motion.line
            x1={1}
            y1={1}
            x2={2.2}
            animate={{
              y2:
                node.value === "on" || node.value === "1" || node.value === "ON"
                  ? 1
                  : 0.3,
            }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            stroke="currentColor"
            strokeWidth={0.12}
            strokeLinecap="round"
          />
        </g>
      )}

      {node.symbol === "led" &&
        isSimulating &&
        stats &&
        Math.abs(stats.current) > 1e-5 && (
          <g transform={`translate(${cx} ${cy})`}>
            {/* Outermost soft light aura / projection */}
            <circle
              r={2.8}
              fill="#ff1e56"
              opacity={Math.min(0.6, Math.abs(stats.current) * 60)}
              style={{ filter: "blur(14px)" }}
            >
              <animate
                attributeName="opacity"
                values={`${Math.min(0.2, Math.abs(stats.current) * 20)};${Math.min(0.6, Math.abs(stats.current) * 60)};${Math.min(0.2, Math.abs(stats.current) * 20)}`}
                dur="1.2s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Middle intense glow */}
            <circle
              r={1.5}
              fill="#ff0000"
              opacity={Math.min(0.85, Math.abs(stats.current) * 90)}
              style={{ filter: "blur(5px)" }}
            />
            {/* Core emission */}
            <circle
              r={0.8}
              fill="#ff6b6b"
              opacity={Math.min(0.95, Math.abs(stats.current) * 110)}
              style={{ filter: "blur(1.5px)" }}
            />
            {/* White-hot diode junction emitter */}
            <circle
              r={0.35}
              fill="#ffffff"
              opacity={Math.min(1.0, Math.abs(stats.current) * 130)}
              style={{ filter: "blur(0.5px)" }}
            />
            {/* Light rays */}
            <g
              stroke="#ff3366"
              strokeWidth={0.22}
              strokeLinecap="round"
              opacity={Math.min(1.0, Math.abs(stats.current) * 60)}
            >
              <line x1={-0.6} y1={-0.6} x2={-1.4} y2={-1.4} />
              <line x1={0} y1={-0.8} x2={0} y2={-1.7} />
              <line x1={0.6} y1={-0.6} x2={1.4} y2={-1.4} />
              <line x1={-0.8} y1={0} x2={-1.6} y2={0} />
              <line x1={0.8} y1={0} x2={1.6} y2={0} />
            </g>
          </g>
        )}

      {node.symbol === "capacitor" && isSimulating && stats && (
        <g transform={`translate(${cx - 0.5} ${cy - 0.6})`}>
          <rect
            width={1}
            height={1.2}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.05}
            opacity={0.2}
          />
          <motion.rect
            width={1}
            animate={{ height: Math.min(1.2, Math.abs(stats.voltage) * 0.1) }}
            y={1.2 - Math.min(1.2, Math.abs(stats.voltage) * 0.1)}
            fill="#3b82f6"
            opacity={0.5}
          />
        </g>
      )}

      {(node.symbol === "nmosfet" ||
        node.symbol === "pmosfet" ||
        node.symbol === "mosfet") &&
        isSimulating &&
        stats && (
          <circle
            cx={cx}
            cy={cy}
            r={0.8}
            fill={Math.abs(stats.current) > 0.001 ? "#10b981" : "none"}
            opacity={0.2}
            style={{ filter: "blur(4px)" }}
          />
        )}

      {node.symbol === "battery" && isSimulating && (
        <g transform={`translate(${cx - 0.6} ${cy - 0.3})`}>
          <rect
            width={1.2}
            height={0.6}
            rx={0.05}
            fill="none"
            stroke="currentColor"
            strokeWidth={0.05}
          />
          <rect
            width={1.0}
            height={0.4}
            x={0.1}
            y={0.1}
            fill="#10b981"
            opacity={0.6}
          />
          <rect
            width={0.15}
            height={0.3}
            x={1.2}
            y={0.15}
            fill="currentColor"
            rx={0.02}
          />
        </g>
      )}
    </g>
  );
}

export type EditorTool = "select" | "wire" | "pan";
export type WireStyle = "ortho" | "diag45" | "curved";

interface Props {
  doc: SchematicDoc;
  setDoc: (
    updater: (d: SchematicDoc) => SchematicDoc,
    noHistory?: boolean,
  ) => void;
  commitHistory: () => void;
  tool: EditorTool;
  setTool: (t: EditorTool) => void;
  locateSignal?: { id: string; t: number } | null;
  selectedIds?: string[];
  setSelectedIds?: (ids: string[]) => void;
  wireColor: WireColor;
  svgRef?: React.RefObject<SVGSVGElement>;
  selectedWireIds?: string[];
  setSelectedWireIds?: (ids: string[]) => void;
  clipboard: { nodes: SchematicNode[]; wires: SchematicWire[] } | null;
  setClipboard: (data: { nodes: SchematicNode[]; wires: SchematicWire[] } | null) => void;
  selectedTrackId?: string | null;
  setSelectedTrackId?: (id: string | null) => void;
  selectedPin?: { nodeId: string; pinIndex: number } | null;
  setSelectedPin?: (pin: { nodeId: string; pinIndex: number } | null) => void;
  highlightedNetIds?: number[];
  /** Ghost placement from library or clipboard */
  placement?: {
    symbol?: SymbolId;
    rotation?: 0 | 90 | 180 | 270;
    multi?: { nodes: SchematicNode[]; wires: SchematicWire[] };
  } | null;
  setPlacement?: (p: {
    symbol?: SymbolId;
    rotation?: 0 | 90 | 180 | 270;
    multi?: { nodes: SchematicNode[]; wires: SchematicWire[] };
  } | null) => void;
  onPlace?: (
    symbol: SymbolId,
    x: number,
    y: number,
    rotation: 0 | 90 | 180 | 270,
    metadata?: any
  ) => void;
  onPlaceMulti?: (data: { nodes: SchematicNode[]; wires: SchematicWire[] }, x: number, y: number) => void;
  onCancelPlace?: () => void;
  onRotatePlacement?: () => void;
  /** Fired when user double-clicks a node — Editor opens the properties panel. */
  onOpenProperties?: (nodeId: string) => void;
  onOpenWireProperties?: (wireId: string) => void;
  wireStyle?: WireStyle;
  gridStyle?: GridStyle;
  showGrid?: boolean;
  gridOpacity?: number;
  snap?: boolean;
  onBackgroundClick?: () => void;
  onCanvasClick?: () => void;
  simulationResults?: SimulationResult[];
  currentTime?: number;
  isSimulating?: boolean;
  realistic?: boolean;
  showProbes?: boolean;
}

const WIRE_COLOR_HEX: Record<WireColor, string> = {
  black: "#111111",
  red: "#dc2626",
  green: "#16a34a",
  blue: "#2563eb",
  yellow: "#eab308",
  white: "#ffffff",
};

const PIN_SNAP = 0.6;
// Lift dragged/placed element about 0.5cm above the finger on touch so it isn't covered.
const TOUCH_LIFT_PX = 57; // ~1.5cm at 96dpi

interface PinHit {
  nodeId: string;
  x: number;
  y: number;
  pinIndex: number;
}

export function Canvas({
  doc,
  setDoc,
  commitHistory,
  tool,
  setTool,
  selectedIds,
  setSelectedIds,
  wireColor,
  svgRef,
  selectedWireIds,
  setSelectedWireIds,
  clipboard,
  setClipboard,
  selectedTrackId,
  setSelectedTrackId,
  selectedPin,
  setSelectedPin,
  highlightedNetIds,
  placement,
  onPlace,
  onPlaceMulti,
  onCancelPlace,
  onRotatePlacement,
  onOpenProperties,
  onOpenWireProperties,
  wireStyle = "ortho",
  gridStyle = "hybrid",
  showGrid = true,
  gridOpacity = 0.9,
  snap = false,
  onBackgroundClick,
  onCanvasClick,
  simulationResults,
  currentTime = 0,
  isSimulating = false,
  realistic = false,
  showProbes = true,
  locateSignal,
}: Props) {
  void setTool;
  const { lang } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const innerSvgRef = useRef<SVGSVGElement>(null);
  const svg = svgRef ?? innerSvgRef;

  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const [size, setSize] = useState({ w: 800, h: 600 });

  const lastProcessedLocateSignalRef = useRef<number | null>(null);

  useEffect(() => {
    if (locateSignal && locateSignal.id && locateSignal.t !== lastProcessedLocateSignalRef.current) {
      lastProcessedLocateSignalRef.current = locateSignal.t;
      const node = doc.nodes.find((n) => n.id === locateSignal.id);
      if (node) {
        // Calculate center of node
        const sym = SYMBOLS[node.symbol];
        if (sym) {
          const cx = node.x + sym.width / 2;
          const cy = node.y + sym.height / 2;
          
          // Pan to it with 2.0 zoom scale
          const newScale = 2.0;
          setView({
            x: size.w / 2 - cx * newScale * GRID,
            y: size.h / 2 - cy * newScale * GRID,
            scale: newScale,
          });
        }
      }
    }
  }, [locateSignal, doc.nodes, size.w, size.h]);

  const [hoverPin, setHoverPin] = useState<PinHit | null>(null);

  const selectedId = selectedIds?.[0] || null;
  const selectedWireId = selectedWireIds?.[0] || null;

  const setSelectedId = useCallback(
    (id: string | null) => {
      setSelectedIds?.(id ? [id] : []);
    },
    [setSelectedIds],
  );

  const setSelectedWireId = useCallback(
    (id: string | null) => {
      setSelectedWireIds?.(id ? [id] : []);
    },
    [setSelectedWireIds],
  );

  const allPins = useMemo<PinHit[]>(() => {
    const list: PinHit[] = [];
    for (const n of doc.nodes) {
      const sym = SYMBOLS[n.symbol];
      if (!sym) continue;
      const pins = transformedPins(sym, n.rotation, n.size);
      pins.forEach((p, i) => {
        if (!sym.pins[i].hide) {
          list.push({ nodeId: n.id, x: n.x + p.x, y: n.y + p.y, pinIndex: i });
        }
      });
    }
    return list;
  }, [doc.nodes]);

  const netIndex = useMemo(() => buildNetIndex(doc), [doc]);

  const gndNetId = useMemo(() => {
    let gndId = -1;
    doc.nodes.forEach((node) => {
      if (node.symbol === "gnd") {
        const netId = netIndex.pinNet.get(`${node.id}:0`);
        if (netId !== undefined) gndId = netId;
      }
    });
    if (gndId === -1 && netIndex.nets.length > 0) {
      gndId = 0;
    }
    return gndId;
  }, [doc.nodes, netIndex]);

  const highlightedNet = useMemo(() => {
    if (highlightedNetIds && highlightedNetIds.length > 0) {
      return highlightedNetIds[0];
    }
    return netIdForSelection(netIndex, {
      wireId: selectedWireIds[0],
      nodeId: selectedIds[0],
    });
  }, [highlightedNetIds, netIndex, selectedWireIds, selectedIds]);

  const [dragInfo, setDragInfo] = useState<{
    nodeId: string;
    x: number;
    y: number;
  } | null>(null);
  const [ghostPos, setGhostPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [snapWireHi, setSnapWireHi] = useState<string | null>(null);

  const getNetVoltage = useCallback(
    (netId: number) => {
      if (netId === gndNetId) return 0;
      if (!simulationResults || simulationResults.length === 0) return 0;
      const nodeName = `net_${netId}`;
      const res = simulationResults.find((r) => r.node === nodeName);
      if (!res) return 0;
      const points = res.values;
      if (points.length === 0) return 0;

      // Find closest time point
      let low = 0,
        high = points.length - 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (points[mid].t < currentTime) low = mid + 1;
        else if (points[mid].t > currentTime) high = mid - 1;
        else return points[mid].v;
      }
      return points[Math.max(0, low - 1)]?.v ?? 0;
    },
    [simulationResults, currentTime, gndNetId],
  );

  const getElementCurrent = useCallback(
    (ref: string) => {
      if (!simulationResults || simulationResults.length === 0) return 0;
      const res = simulationResults.find(
        (r) => r.type === "current" && r.node === ref,
      );
      if (!res) return 0;
      const points = res.values;
      if (points.length === 0) return 0;

      let low = 0,
        high = points.length - 1;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (points[mid].t < currentTime) low = mid + 1;
        else if (points[mid].t > currentTime) high = mid - 1;
        else return points[mid].v;
      }
      return points[Math.max(0, low - 1)]?.v ?? 0;
    },
    [simulationResults, currentTime],
  );

  const getComponentStats = useCallback(
    (node: SchematicNode) => {
      if (!simulationResults || simulationResults.length === 0) return null;
      const ref = getComponentRef(node);

      const net0 = netIndex.pinNet.get(`${node.id}:0`);
      const net1 = netIndex.pinNet.get(`${node.id}:1`);
      const v0 = net0 !== undefined ? getNetVoltage(net0) : 0;
      const v1 = net1 !== undefined ? getNetVoltage(net1) : 0;
      const voltage = v0 - v1;

      const current = getElementCurrent(ref);
      const power = Math.abs(voltage * current);

      return { voltage, current, power, v0, v1 };
    },
    [simulationResults, netIndex, getNetVoltage, getElementCurrent],
  );

  const pinCurrents = useMemo(() => {
    if (!simulationResults || simulationResults.length === 0)
      return new Map<string, number>();
    const m = new Map<string, number>();
    doc.nodes.forEach((n) => {
      const sym = SYMBOLS[n.symbol];
      if (!sym) return;
      const i = getElementCurrent(getComponentRef(n));
      const pins = transformedPins(sym, n.rotation, n.size ?? 1);
      pins.forEach((p, idx) => {
        // Use integer keys to avoid floating point issues, but round to nearest grid/half-grid
        const kx = Math.round((n.x + p.x) * 10);
        const ky = Math.round((n.y + p.y) * 10);
        const key = `${kx},${ky}`;
        const flow = idx === 0 ? i : idx === 1 ? -i : 0;
        m.set(key, (m.get(key) || 0) + flow);
      });
    });
    return m;
  }, [doc.nodes, simulationResults, getElementCurrent]);

  const getWirePinCurrent = (x: number, y: number) => {
    const kx = Math.round(x * 10);
    const ky = Math.round(y * 10);
    return pinCurrents.get(`${kx},${ky}`) || 0;
  };

  const [stickyProbe, setStickyProbe] = useState<{
    id: string;
    type: "node" | "wire" | "pin";
  } | null>(null);
  const [hoverTarget, setHoverTarget] = useState<{
    id: string;
    type: "node" | "wire" | "pin";
    pos: { x: number; y: number };
  } | null>(null);

  const floatingPins = useMemo(() => {
    const list: { nodeId: string; pinIndex: number; x: number; y: number }[] =
      [];
    doc.nodes.forEach((n) => {
      const sym = SYMBOLS[n.symbol];
      if (!sym) return;
      const pins = transformedPins(sym, n.rotation, n.size);
      pins.forEach((p, i) => {
        const netId = netIndex.pinNet.get(`${n.id}:${i}`);
        if (netId !== undefined) {
          const net = netIndex.nets[netId];
          // Isolated if it's the only thing in the net
          if (net && net.wireIds.size === 0 && net.pins.length === 1) {
            list.push({
              nodeId: n.id,
              pinIndex: i,
              x: n.x + p.x,
              y: n.y + p.y,
            });
          }
        }
      });
    });
    return list;
  }, [doc.nodes, netIndex]);

  const activeProbe = showProbes ? (stickyProbe || hoverTarget) : null;

  const probeData = useMemo(() => {
    if (!isSimulating || !simulationResults || !activeProbe) return null;

    if (activeProbe.type === "pin") {
      const [nId, pIdx] = activeProbe.id.split(":");
      const netId = netIndex.pinNet.get(`${nId}:${pIdx}`);
      if (netId !== undefined) {
        const v = getNetVoltage(netId);
        const n = doc.nodes.find((n) => n.id === nId);
        if (n) {
          const sym = SYMBOLS[n.symbol];
          if (!sym) return null;
          const p = transformedPins(sym, n.rotation, n.size)[parseInt(pIdx)];
          const nodeName = `net_${netId}`;
          const res = simulationResults.find((r) => r.node === nodeName);
          return {
            x: n.x + p.x,
            y: n.y + p.y,
            val: v.toFixed(2) + "V",
            type: `Pin ${pIdx}`,
            history: res?.values,
          };
        }
      }
    } else if (activeProbe.type === "node") {
      const n = doc.nodes.find((n) => n.id === activeProbe.id);
      if (n) {
        const stats = getComponentStats(n);
        if (stats) {
          const sym = SYMBOLS[n.symbol];
          const ref = getComponentRef(n);
          // For components, show current waveform if possible
          const iRes = simulationResults.find(
            (r) => r.type === "current" && r.node === ref,
          );
          return {
            x: n.x + (sym?.width ?? 0) / 2,
            y: n.y - 0.5,
            val: `V: ${stats.voltage.toFixed(2)}V\nI: ${(stats.current * 1000).toFixed(1)}mA\nP: ${(stats.power * 1000).toFixed(1)}mW`,
            type: n.reference || "Component",
            history: iRes?.values, // Power or current history
          };
        }
      }
    } else if (activeProbe.type === "wire") {
      const w = doc.wires.find((w) => w.id === activeProbe.id);
      if (w) {
        const netId = netIndex.wireNet.get(w.id);
        if (netId !== undefined) {
          const v = getNetVoltage(netId);
          const nodeName = `net_${netId}`;
          const res = simulationResults.find((r) => r.node === nodeName);
          return {
            x: activeProbe.pos.x,
            y: activeProbe.pos.y,
            val: v.toFixed(2) + "V",
            type: `Net ${netId}`,
            history: res?.values,
          };
        }
      }
    }
    return null;
  }, [
    isSimulating,
    simulationResults,
    activeProbe,
    getNetVoltage,
    doc.nodes,
    getComponentStats,
    doc.wires,
    netIndex,
  ]);

  const autoFit = useCallback(() => {
    if (doc.nodes.length === 0 && doc.wires.length === 0) return;
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    doc.nodes.forEach((n) => {
      const sym = SYMBOLS[n.symbol];
      if (!sym) return;
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + sym.width);
      maxY = Math.max(maxY, n.y + sym.height);
    });
    doc.wires.forEach((w) =>
      w.points.forEach((p) => {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }),
    );

    if (minX === Infinity) return;

    const cw = maxX - minX,
      ch = maxY - minY;
    const padding = 2;
    const s = Math.min(
      size.w / GRID / (cw + padding * 2),
      size.h / GRID / (ch + padding * 2),
    );
    const finalScale = Math.min(2, Math.max(0.2, s));

    setView({
      x: size.w / 2 - (minX + cw / 2) * finalScale * GRID,
      y: size.h / 2 - (minY + ch / 2) * finalScale * GRID,
      scale: finalScale,
    });
  }, [doc, size]);

  const autoFitRef = useRef(autoFit);
  useEffect(() => {
    autoFitRef.current = autoFit;
  }, [autoFit]);

  useEffect(() => {
    if (isSimulating && size.w > 0 && size.h > 0) {
      const timer = setTimeout(() => autoFitRef.current(), 50);
      return () => clearTimeout(timer);
    }
  }, [isSimulating, size.w, size.h]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      setSize((prev) => {
        if (prev.w === w && prev.h === h) return prev;
        return { w, h };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (tool !== "wire") {
      setPendingWire(null);
      setWirePreview(null);
    }
    const onKey = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tgt?.isContentEditable)
        return;

      if (e.key === "Escape") {
        setPendingWire(null);
        setWirePreview(null);
        setSelectedWireIds([]);
        setSelectedIds([]);
        if (placement) onCancelPlace?.();
      }
      if ((e.key === "r" || e.key === "R") && placement) onRotatePlacement?.();
      
      if (e.key === "Delete" || e.key === "Backspace") {
        if (!isSimulating && (selectedIds.length > 0 || selectedWireIds.length > 0)) {
          commitHistory();
          setDoc((d) => ({
            ...d,
            nodes: d.nodes.filter(n => !selectedIds.includes(n.id)),
            wires: d.wires.filter((w) => !selectedWireIds.includes(w.id)),
          }));
          setSelectedWireIds([]);
          setSelectedIds([]);
        }
      }

      // Clipboard shortcuts
      if ((e.ctrlKey || e.metaKey) && (e.key === "c" || e.key === "C")) {
        const nodes = doc.nodes.filter(n => selectedIds.includes(n.id));
        const wires = doc.wires.filter(w => selectedWireIds.includes(w.id));
        if (nodes.length > 0 || wires.length > 0) {
          setClipboard({ nodes: JSON.parse(JSON.stringify(nodes)), wires: JSON.parse(JSON.stringify(wires)) });
          toast.success(lang === "ar" ? "تم النسخ" : "Copied");
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "v" || e.key === "V")) {
        if (clipboard) {
          if (setTool) setTool("select");
          if (setPlacement) setPlacement({ multi: clipboard });
          toast.info(lang === "ar" ? "اختر مكاناً للصق" : "Select location to paste");
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D")) {
        e.preventDefault();
        const nodes = doc.nodes.filter(n => selectedIds.includes(n.id));
        const wires = doc.wires.filter(w => selectedWireIds.includes(w.id));
        if (nodes.length > 0 || wires.length > 0) {
          commitHistory();
          const offset = { x: 1, y: 1 };
          const newNodes: SchematicNode[] = nodes.map(n => ({
            ...n,
            id: crypto.randomUUID(),
            x: n.x + offset.x,
            y: n.y + offset.y,
          }));
          const newWires: SchematicWire[] = wires.map(w => ({
            ...w,
            id: crypto.randomUUID(),
            points: w.points.map(p => ({ x: p.x + offset.x, y: p.y + offset.y }))
          }));

          setDoc(d => {
            const nodesWithRefs = newNodes.map(nn => {
               const sym = SYMBOLS[nn.symbol];
               const prefix = sym?.prefix || "U";
               return { ...nn, reference: nextReference(d, prefix) };
            });
            return {
              ...d,
              nodes: [...d.nodes, ...nodesWithRefs],
              wires: [...d.wires, ...newWires]
            };
          });
          setSelectedIds(newNodes.map(n => n.id));
          setSelectedWireIds(newWires.map(w => w.id));
        }
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "a" || e.key === "A")) {
        e.preventDefault();
        setSelectedIds(doc.nodes.map(n => n.id));
        setSelectedWireIds(doc.wires.map(w => w.id));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    tool,
    selectedIds,
    selectedWireIds,
    setDoc,
    setSelectedIds,
    setSelectedWireIds,
    placement,
    onCancelPlace,
    onRotatePlacement,
    clipboard,
    setClipboard,
    doc,
    isSimulating,
    commitHistory,
    lang,
  ]);

  const isDark = doc.canvasColor === "black";
  const bg = isSimulating
    ? "#000000"
    : (realistic
        ? (isDark ? "radial-gradient(circle, #2d1c10 0%, #170d07 100%)" : "radial-gradient(circle, #fcf6f0 0%, #e8dec9 100%)")
        : (isDark ? "#0b1220" : "#ffffff"));
  const strokeColor = isDark ? "#e6edf6" : "#111827";

  const getWireColorHex = (cName: WireColor) => {
    if (cName === "white" && !isDark) return "#1e293b";
    if (cName === "black" && isDark) return "#f1f5f9";
    return WIRE_COLOR_HEX[cName] || "#111111";
  };

  const screenToWorld = useCallback(
    (sx: number, sy: number) => {
      const rect = containerRef.current!.getBoundingClientRect();
      const x = (sx - rect.left - view.x) / (GRID * view.scale);
      const y = (sy - rect.top - view.y) / (GRID * view.scale);
      return { x, y };
    },
    [view],
  );

  const snapToGrid = useCallback(
    (p: { x: number; y: number }) =>
      snap
        ? { x: Math.round(p.x), y: Math.round(p.y) }
        : { x: Math.round(p.x * 100) / 100, y: Math.round(p.y * 100) / 100 },
    [snap],
  );

  const findPinAt = useCallback(
    (wp: { x: number; y: number }, ignoreNodeId?: string): PinHit | null => {
      let best: PinHit | null = null;
      let bestD = PIN_SNAP * PIN_SNAP;
      for (const p of allPins) {
        if (ignoreNodeId && p.nodeId === ignoreNodeId) continue;
        const d = (p.x - wp.x) ** 2 + (p.y - wp.y) ** 2;
        if (d <= bestD) {
          bestD = d;
          best = p;
        }
      }
      return best;
    },
    [allPins],
  );

  const getPinWorldPos = useCallback(
    (nodeId: string, pinIndex: number, currentNodes: SchematicNode[]) => {
      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node) return null;
      const sym = SYMBOLS[node.symbol];
      if (!sym) return null;
      const pins = transformedPins(sym, node.rotation, node.size);
      const p = pins[pinIndex];
      if (!p) return null;
      return { x: node.x + p.x, y: node.y + p.y };
    },
    [],
  );

  // ---------------- Wire routing ----------------
  const routeOrtho = useCallback(
    (
      start: { x: number; y: number },
      end: { x: number; y: number },
      ignoreIds: Set<string>,
    ): { x: number; y: number }[] => {
      const obstacles = doc.nodes
        .filter((n) => !ignoreIds.has(n.id))
        .map((n) => {
          const b = nodeBBox(n);
          return { x: b.x + 0.1, y: b.y + 0.1, w: b.w - 0.2, h: b.h - 0.2 };
        });
      const hits = (
        a: { x: number; y: number },
        b: { x: number; y: number },
      ) => {
        const minX = Math.min(a.x, b.x),
          maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y),
          maxY = Math.max(a.y, b.y);
        for (const o of obstacles) {
          if (minX > o.x + o.w || maxX < o.x) continue;
          if (minY > o.y + o.h || maxY < o.y) continue;
          return true;
        }
        return false;
      };
      if (hits(start, end)) {
        // Direct path blocked, do manual L-shape
        return [start, { x: start.x, y: end.y }, end];
      }
      return [start, { x: end.x, y: start.y }, end];
    },
    [doc.nodes],
  );

  const routeWire = useCallback(
    (
      start: { x: number; y: number },
      end: { x: number; y: number },
      ignoreIds: Set<string>,
    ): { x: number; y: number }[] => {
      return routeOrtho(start, end, ignoreIds);
    },
    [routeOrtho],
  );

  const gesture = useRef<{
    type: "none" | "pan" | "drag" | "pinch" | "wire" | "wireSeg" | "anchor" | "multi-drag" | "selection";
    startX?: number;
    startY?: number;
    startView?: { x: number; y: number };
    nodeId?: string;
    nodeStart?: { x: number; y: number };
    nodeStarts?: Map<string, { x: number; y: number }>;
    pinchStartDist?: number;
    pinchStartScale?: number;
    pinchCenter?: { x: number; y: number };
    wireStart?: { x: number; y: number };
    wireStartPin?: PinHit | null;
    startPinInfo?: { nodeId: string; pinIndex: number } | null;
    endPinInfo?: { nodeId: string; pinIndex: number } | null;
    moved?: boolean;
    segWireId?: string;
    segIndex?: number;
    segOrient?: "h" | "v";
    segOriginalPoints?: { x: number; y: number }[];
    anchorWireId?: string;
    anchorIndex?: number;
    affected?: {
      wireId: string;
      vertexIndex: number;
      orig: { x: number; y: number }[];
    }[];
    affectedMulti?: {
      wireId: string;
      vertexIndex: number;
      orig: { x: number; y: number }[];
    }[];
    wireStarts?: Map<string, { x: number; y: number }[]>;
    stretchWires?: {
      wireId: string;
      vertexIndex: number;
      orig: { x: number; y: number }[];
    }[];
    attachedNodeId?: string;
    attachedNodeStart?: { x: number; y: number };
    attachedNodeOtherWires?: {
      wireId: string;
      vertexIndex: number;
      orig: { x: number; y: number }[];
    }[];
    currentX?: number;
    currentY?: number;
    pointerType?: string;
  }>({ type: "none" });

  const [wirePreview, setWirePreview] = useState<{
    points: { x: number; y: number }[];
    valid: boolean;
  } | null>(null);
  const [pendingWire, setPendingWire] = useState<{
    x: number;
    y: number;
    nodeId?: string;
  } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const panFrameRequested = useRef(false);
  const dragFrameRequested = useRef(false);
  const mouseCoords = useRef({ x: 0, y: 0 });

  const autoConnect = useCallback(
    (d: SchematicDoc, movedNodeId: string): SchematicDoc => {
      const n = d.nodes.find((nn) => nn.id === movedNodeId);
      if (!n) return d;
      const sym = SYMBOLS[n.symbol];
      if (!sym) return d;
      const pins = transformedPins(sym, n.rotation, n.size).map((p, i) => ({
        x: n.x + p.x,
        y: n.y + p.y,
        hide: sym.pins[i].hide,
      }));
      let wires = d.wires;
      for (const pin of pins) {
        if (!pin.hide) {
          wires = wires.map((w) => splitWireAtPoint(w, pin, 0.18) ?? w);
        }
      }
      return wires === d.wires ? d : { ...d, wires };
    },
    [],
  );

  // Helper to check if a point is connected to any pin of the given nodes
  const isPointConnectedToNodes = (pt: { x: number; y: number }, nodes: SchematicNode[]) => {
    for (const n of nodes) {
      const sym = SYMBOLS[n.symbol];
      if (!sym) continue;
      const pins = transformedPins(sym, n.rotation, n.size).map((p, i) => ({
        x: n.x + p.x,
        y: n.y + p.y,
        hide: sym.pins[i].hide,
      }));
      for (const pin of pins) {
        if (!pin.hide && Math.hypot(pt.x - pin.x, pt.y - pin.y) < 0.45) {
          return true;
        }
      }
    }
    return false;
  };

  // Determine wires "attached" to a given node (any vertex coincides with any pin)
  const findAttachedWires = (node: SchematicNode, currentWires: SchematicWire[]) => {
    const sym = SYMBOLS[node.symbol];
    if (!sym) return [];
    const pins = transformedPins(sym, node.rotation, node.size).map((p) => ({
      x: node.x + p.x,
      y: node.y + p.y,
    }));
    const out: {
      wireId: string;
      vertexIndex: number;
      orig: { x: number; y: number }[];
    }[] = [];
    for (const w of currentWires) {
      for (let i = 0; i < w.points.length; i++) {
        const pt = w.points[i];
        for (const pin of pins) {
          if (Math.hypot(pt.x - pin.x, pt.y - pin.y) < 0.45) {
            out.push({
              wireId: w.id,
              vertexIndex: i,
              orig: w.points.map((p) => ({ ...p })),
            });
            break; // Move to next point in this wire
          }
        }
      }
    }
    return out;
  };

  const stretchWire = (
    pts: { x: number; y: number }[],
    vertexIndices: number | number[],
    dx: number,
    dy: number,
  ): { x: number; y: number }[] => {
    const indices = Array.isArray(vertexIndices) ? vertexIndices : [vertexIndices];
    if (indices.length === 0) return pts;

    if (pts.length === 2 && indices.length === 1) {
      const vertexIndex = indices[0];
      const otherIndex = vertexIndex === 0 ? 1 : 0;
      const A = pts[vertexIndex];
      const B = pts[otherIndex];
      const A_prime = { x: A.x + dx, y: A.y + dy };
      const isHoriz = Math.abs(A.y - B.y) < 1e-6;
      const I = isHoriz ? { x: B.x, y: A_prime.y } : { x: A_prime.x, y: B.y };
      return vertexIndex === 0 ? [A_prime, I, { ...B }] : [{ ...B }, I, A_prime];
    }

    const np = pts.map((p) => ({ ...p }));
    const moved = new Set<number>();
    for (const idx of indices) {
      if (idx >= 0 && idx < np.length) {
        np[idx].x += dx;
        np[idx].y += dy;
        moved.add(idx);
      }
    }

    const propagated = new Set<number>();
    for (const idx of indices) {
      if (idx > 0 && !moved.has(idx - 1) && !propagated.has(idx - 1)) {
        const prev = np[idx - 1];
        const isHoriz = Math.abs(pts[idx].y - pts[idx - 1].y) < 1e-6;
        const isVert = Math.abs(pts[idx].x - pts[idx - 1].x) < 1e-6;
        if (isHoriz) prev.y += dy;
        else if (isVert) prev.x += dx;
        propagated.add(idx - 1);
      }
      if (idx < np.length - 1 && !moved.has(idx + 1) && !propagated.has(idx + 1)) {
        const next = np[idx + 1];
        const isHoriz = Math.abs(pts[idx].y - pts[idx + 1].y) < 1e-6;
        const isVert = Math.abs(pts[idx].x - pts[idx + 1].x) < 1e-6;
        if (isHoriz) next.y += dy;
        else if (isVert) next.x += dx;
        propagated.add(idx + 1);
      }
    }

    return np;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Inform parent that drawing canvas was clicked anywhere to exit sideboxes
    onCanvasClick?.();

    const target = e.target as SVGElement;
    const targetNodeEl = target.closest?.("[data-node-id]");
    const targetWireEl = target.closest?.("[data-wire-id]");
    const targetAnchorEl = target.closest?.("[data-anchor]");
    const targetPinEl = target.closest?.("[data-pin]");
    const isBackground = !targetNodeEl && !targetWireEl && !targetAnchorEl && !targetPinEl;

    if (isBackground) {
      onBackgroundClick?.();
    }

    if (placement) {
      if (e.button === 2) {
        onCancelPlace?.();
        return;
      }
      const lift = e.pointerType === "touch" ? TOUCH_LIFT_PX : 0;
      const wp = screenToWorld(e.clientX, e.clientY - lift);
      const snapped = snapToGrid(wp);
      if (placement.multi) {
        onPlaceMulti?.(placement.multi, snapped.x, snapped.y);
      } else if (placement.symbol) {
        onPlace?.(placement.symbol, snapped.x, snapped.y, placement.rotation ?? 0, (placement as any).metadata);
      }
      return;
    }

    if (pointers.current.size === 2) {
      const pts = Array.from(pointers.current.values());
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const cx = (pts[0].x + pts[1].x) / 2;
      const cy = (pts[0].y + pts[1].y) / 2;
      gesture.current = {
        type: "pinch",
        pinchStartDist: dist,
        pinchStartScale: view.scale,
        pinchCenter: { x: cx, y: cy },
        startView: { x: view.x, y: view.y },
      };
      setWirePreview(null);
      return;
    }

    if (e.button === 1 || tool === "pan" || tool === "select") {
      const target = e.target as SVGElement;
      const isBackground = target === svg.current || target.classList.contains("grid-background");
      const nodeEl = target.closest?.("[data-node-id]") as SVGElement | null;
      const wireEl = target.closest?.("[data-wire-id]") as SVGElement | null;
      
      if (isBackground) {
        gesture.current = {
          type: "pan",
          startX: e.clientX,
          startY: e.clientY,
          startView: { x: view.x, y: view.y },
        };
        return;
      } else if (tool === "pan" && (nodeEl || wireEl)) {
        // User requested that clicking with Hand tool (pan) also selects the element
        const id = nodeEl ? nodeEl.getAttribute("data-node-id") : wireEl?.getAttribute("data-wire-id");
        if (id) {
          if (nodeEl) {
            setSelectedIds?.([id]);
            setSelectedWireIds?.([]);
          } else {
            setSelectedWireIds?.([id]);
            setSelectedIds?.([]);
          }
        }
      }
    }

    const anchorEl = target.closest?.("[data-anchor]") as SVGElement | null;
    const nodeEl = target.closest?.("[data-node-id]") as SVGElement | null;
    const wp = screenToWorld(e.clientX, e.clientY);

    if (tool === "wire" && !isSimulating) {
      const pin = findPinAt(wp);
      const start = pin ? { x: pin.x, y: pin.y } : snapToGrid(wp);
      gesture.current = {
        type: "wire",
        startX: e.clientX,
        startY: e.clientY,
        wireStart: start,
        wireStartPin: pin,
        moved: false,
      };
      setWirePreview({ points: [start, start], valid: true });
      return;
    }

    if ((tool === "select" || tool === "pan") && anchorEl && selectedWireId && !isSimulating) {
      const idx = parseInt(anchorEl.getAttribute("data-anchor") || "-1", 10);
      const wid = anchorEl.getAttribute("data-wire") || "";
      if (idx >= 0 && wid === selectedWireId) {
        const w = doc.wires.find((wi) => wi.id === wid);
        if (w) {
          // Find if this anchor is connected to any component pin
          const pt = w.points[idx];
          let attachedNodeId: string | undefined = undefined;
          let attachedNodeStart: { x: number; y: number } | undefined =
            undefined;
          let attachedNodeOtherWires: any[] = [];
          if (idx === 0 || idx === w.points.length - 1) {
            for (const n of doc.nodes) {
              const sym = SYMBOLS[n.symbol];
              if (!sym) continue;
              const pins = transformedPins(sym, n.rotation, n.size).map(
                (p, i) => ({ x: n.x + p.x, y: n.y + p.y, hide: sym.pins[i].hide }),
              );
              for (const pin of pins) {
                if (!pin.hide && Math.hypot(pt.x - pin.x, pt.y - pin.y) < 0.25) {
                  attachedNodeId = n.id;
                  attachedNodeStart = { x: n.x, y: n.y };
                  // Find other wires connected to this same node so they stretch too (exclude current wire wid)
                  attachedNodeOtherWires = findAttachedWires(n, doc.wires).filter(
                    (aw) => aw.wireId !== wid,
                  );
                  break;
                }
              }
              if (attachedNodeId) break;
            }
          }

          const startPin = findPinAt(w.points[0]);
          const endPin = findPinAt(w.points[w.points.length - 1]);
          const startPinInfo = startPin ? { nodeId: startPin.nodeId, pinIndex: startPin.pinIndex } : null;
          const endPinInfo = endPin ? { nodeId: endPin.nodeId, pinIndex: endPin.pinIndex } : null;

          gesture.current = {
            type: "anchor",
            startX: e.clientX,
            startY: e.clientY,
            anchorWireId: wid,
            anchorIndex: idx,
            segOriginalPoints: w.points.map((p) => ({ ...p })),
            attachedNodeId,
            attachedNodeStart,
            attachedNodeOtherWires,
            startPinInfo,
            endPinInfo,
          };
          return;
        }
      }
    }

    if ((tool === "select" || tool === "pan") && !anchorEl && !nodeEl && isSimulating) {
      const wp = screenToWorld(e.clientX, e.clientY);
      const wireHit = findWireHit(doc.wires, wp, 0.3);
      if (wireHit) {
        setStickyProbe({ id: wireHit.id, type: "wire" });
        return;
      }
      const pin = findPinAt(wp);
      if (pin) {
        setStickyProbe({ id: `${pin.nodeId}:${pin.pinIndex}`, type: "pin" });
        return;
      }
      setStickyProbe(null);
    }

    // Check if we should drag the active selection together
    const hasSelection = (selectedIds && selectedIds.length > 0) || (selectedWireIds && selectedWireIds.length > 0);
    if ((tool === "select" || tool === "pan") && !isSimulating && hasSelection && !e.shiftKey) {
      let selMinX = Infinity;
      let selMinY = Infinity;
      let selMaxX = -Infinity;
      let selMaxY = -Infinity;

      selectedIds?.forEach((sid) => {
        const n = doc.nodes.find((nn) => nn.id === sid);
        if (n) {
          const bbox = nodeBBox(n);
          selMinX = Math.min(selMinX, bbox.x);
          selMinY = Math.min(selMinY, bbox.y);
          selMaxX = Math.max(selMaxX, bbox.x + bbox.w);
          selMaxY = Math.max(selMaxY, bbox.y + bbox.h);
        }
      });

      selectedWireIds?.forEach((wid) => {
        const w = doc.wires.find((wi) => wi.id === wid);
        if (w) {
          w.points.forEach((pt) => {
            selMinX = Math.min(selMinX, pt.x);
            selMinY = Math.min(selMinY, pt.y);
            selMaxX = Math.max(selMaxX, pt.x);
            selMaxY = Math.max(selMaxY, pt.y);
          });
        }
      });

      const isEndpointConnectedToSelectedNode = (pt: { x: number; y: number }) => {
        for (const sid of (selectedIds || [])) {
          const n = doc.nodes.find(nn => nn.id === sid);
          if (!n) continue;
          const sym = SYMBOLS[n.symbol];
          if (!sym) continue;
          const pins = transformedPins(sym, n.rotation, n.size).map((p, i) => ({
            x: n.x + p.x,
            y: n.y + p.y,
            hide: sym.pins[i].hide,
          }));
          for (const pin of pins) {
            if (!pin.hide && Math.hypot(pt.x - pin.x, pt.y - pin.y) < 0.25) {
              return true;
            }
          }
        }
        return false;
      };

      doc.wires.forEach(w => {
        const first = w.points[0];
        const last = w.points[w.points.length - 1];
        if (isEndpointConnectedToSelectedNode(first) && isEndpointConnectedToSelectedNode(last)) {
          w.points.forEach((pt) => {
            selMinX = Math.min(selMinX, pt.x);
            selMinY = Math.min(selMinY, pt.y);
            selMaxX = Math.max(selMaxX, pt.x);
            selMaxY = Math.max(selMaxY, pt.y);
          });
        }
      });

      const padding = 0.5;
      const isInsideBBox = 
        wp.x >= (selMinX - padding) && 
        wp.x <= (selMaxX + padding) && 
        wp.y >= (selMinY - padding) && 
        wp.y <= (selMaxY + padding);

      const clickedUnselectedNode = nodeEl && !selectedIds.includes(nodeEl.getAttribute("data-node-id")!);

      const clickedSelectedNode = nodeEl && selectedIds.includes(nodeEl.getAttribute("data-node-id")!);
      const clickedSelectedWire = (() => {
        const hit = findWireHit(doc.wires, wp, 0.35);
        if (hit) {
          if (selectedWireIds.includes(hit.wireId)) return true;
          const w = doc.wires.find(wi => wi.id === hit.wireId);
          if (w) {
            const first = w.points[0];
            const last = w.points[w.points.length - 1];
            if (isEndpointConnectedToSelectedNode(first) && isEndpointConnectedToSelectedNode(last)) {
              return true;
            }
          }
        }
        return false;
      })();

      if (clickedSelectedNode || clickedSelectedWire || (isInsideBBox && !clickedUnselectedNode && !anchorEl)) {
        const starts = new Map<string, { x: number; y: number }>();
        selectedIds.forEach((sid) => {
          const n = doc.nodes.find((nn) => nn.id === sid);
          if (n) starts.set(sid, { x: n.x, y: n.y });
        });

        const rigidWires = new Set<string>();
        doc.wires.forEach(w => {
          if (selectedWireIds.includes(w.id)) {
            rigidWires.add(w.id);
          } else {
            const first = w.points[0];
            const last = w.points[w.points.length - 1];
            if (isEndpointConnectedToSelectedNode(first) && isEndpointConnectedToSelectedNode(last)) {
              rigidWires.add(w.id);
            }
          }
        });

        const wireStarts = new Map<string, { x: number; y: number }[]>();
        rigidWires.forEach(wid => {
          const w = doc.wires.find(wi => wi.id === wid);
          if (w) {
            wireStarts.set(wid, w.points.map(p => ({ ...p })));
          }
        });

        const stretchWires: { wireId: string; endpoint: "first" | "last"; orig: { x: number; y: number }[] }[] = [];
        doc.wires.forEach(w => {
          if (rigidWires.has(w.id)) return;
          const first = w.points[0];
          const last = w.points[w.points.length - 1];
          const firstConn = isEndpointConnectedToSelectedNode(first);
          const lastConn = isEndpointConnectedToSelectedNode(last);
          if (firstConn) {
            stretchWires.push({
              wireId: w.id,
              endpoint: "first",
              orig: w.points.map(p => ({ ...p }))
            });
          }
          if (lastConn) {
            stretchWires.push({
              wireId: w.id,
              endpoint: "last",
              orig: w.points.map(p => ({ ...p }))
            });
          }
        });

        gesture.current = {
          type: "multi-drag",
          startX: e.clientX,
          startY: e.clientY,
          nodeStarts: starts,
          wireStarts,
          stretchWires,
          moved: false,
        };
        return;
      }
    }

    if ((tool === "select" || tool === "pan") && nodeEl) {
      const id = nodeEl.getAttribute("data-node-id")!;
      const isSelected = selectedIds.includes(id);
      let nextIds = [...selectedIds];

      if (e.shiftKey) {
        if (isSelected) nextIds = nextIds.filter((x) => x !== id);
        else nextIds.push(id);
        setSelectedIds(nextIds);
        setSelectedWireIds([]);
      } else {
        if (!isSelected) {
          nextIds = [id];
          setSelectedIds(nextIds);
          setSelectedWireIds([]);
        }
      }

      if (isSimulating) {
        const node = doc.nodes.find((n) => n.id === id);
        if (
          node &&
          (node.symbol === "switch" ||
            node.symbol === "switch_spst" ||
            node.symbol === "button" ||
            node.symbol === "push_button")
        ) {
          const nextVal = node.value === "1" || node.value === "on" ? "0" : "1";
          setDoc(
            (d) => ({
              ...d,
              nodes: d.nodes.map((n) =>
                n.id === id ? { ...n, value: nextVal } : n,
              ),
            }),
            true,
          );
          return;
        }
        setStickyProbe({ id, type: "node" });
        return;
      }

      if (nextIds.length > 1 || selectedWireIds.length > 0) {
        const starts = new Map<string, { x: number; y: number }>();
        nextIds.forEach((sid) => {
          const n = doc.nodes.find((nn) => nn.id === sid);
          if (n) starts.set(sid, { x: n.x, y: n.y });
        });

        const isPointConnectedToSelectedNode = (pt: { x: number; y: number }) => {
          return isPointConnectedToNodes(pt, doc.nodes.filter(n => nextIds.includes(n.id)));
        };

        const rigidWires = new Set<string>();
        doc.wires.forEach(w => {
          if (selectedWireIds.includes(w.id) || w.points.every(pt => isPointConnectedToSelectedNode(pt))) {
            rigidWires.add(w.id);
          }
        });

        const wireStarts = new Map<string, { x: number; y: number }[]>();
        rigidWires.forEach(wid => {
          const w = doc.wires.find(wi => wi.id === wid);
          if (w) {
            wireStarts.set(wid, w.points.map(p => ({ ...p })));
          }
        });

        const stretchWires: { wireId: string; vertexIndex: number; orig: { x: number; y: number }[] }[] = [];
        doc.wires.forEach(w => {
          if (rigidWires.has(w.id)) return;
          w.points.forEach((pt, idx) => {
            if (isPointConnectedToSelectedNode(pt)) {
              stretchWires.push({
                wireId: w.id,
                vertexIndex: idx,
                orig: w.points.map(p => ({ ...p }))
              });
            }
          });
        });

        gesture.current = {
          type: "multi-drag",
          startX: e.clientX,
          startY: e.clientY,
          nodeStarts: starts,
          wireStarts,
          stretchWires,
          moved: false,
          pointerType: e.pointerType,
        };
      } else {
        const node = doc.nodes.find((n) => n.id === id);
        if (node) {
          gesture.current = {
            type: "drag",
            startX: e.clientX,
            startY: e.clientY,
            nodeId: id,
            nodeStart: { x: node.x, y: node.y },
            moved: false,
            affected: findAttachedWires(node, doc.wires),
            pointerType: e.pointerType,
          };
          setDragInfo({ nodeId: id, x: node.x, y: node.y });
        }
      }
      return;
    }

    if ((tool === "select" || tool === "pan") && !isSimulating) {
      const hit = findWireHit(doc.wires, wp, 0.35);
      if (hit) {
        if (e.shiftKey) {
          if (selectedWireIds.includes(hit.wireId)) {
            setSelectedWireIds(selectedWireIds.filter(wid => wid !== hit.wireId));
          } else {
            setSelectedWireIds([...selectedWireIds, hit.wireId]);
          }
        } else {
          setSelectedWireIds([hit.wireId]);
          setSelectedIds([]);
        }
        const w = doc.wires.find((wi) => wi.id === hit.wireId)!;
        const a = w.points[hit.segIndex],
          b = w.points[hit.segIndex + 1];
        const orient: "h" | "v" = Math.abs(a.y - b.y) < 1e-6 ? "h" : "v";
        const startPin = findPinAt(w.points[0]);
        const endPin = findPinAt(w.points[w.points.length - 1]);
        const startPinInfo = startPin ? { nodeId: startPin.nodeId, pinIndex: startPin.pinIndex } : null;
        const endPinInfo = endPin ? { nodeId: endPin.nodeId, pinIndex: endPin.pinIndex } : null;

        gesture.current = {
          type: "wireSeg",
          startX: e.clientX,
          startY: e.clientY,
          segWireId: hit.wireId,
          segIndex: hit.segIndex,
          segOrient: orient,
          segOriginalPoints: w.points.map((p) => ({ ...p })),
          moved: false,
          startPinInfo,
          endPinInfo,
        };
        return;
      }
    }

    if (tool === "select") {
      if (!e.shiftKey) {
        setSelectedIds([]);
        setSelectedWireIds([]);
      }
      gesture.current = {
        type: "selection",
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
      };
      return;
    }
    if (tool === "pan") {
      if (setSelectedIds) setSelectedIds([]);
      if (setSelectedWireIds) setSelectedWireIds([]);
      if (setSelectedPin) setSelectedPin(null);
      if (setSelectedTrackId) setSelectedTrackId(null);
    }
    gesture.current = {
      type: "pan",
      startX: e.clientX,
      startY: e.clientY,
      startView: { x: view.x, y: view.y },
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    mouseCoords.current = { x: e.clientX, y: e.clientY };
    if (pointers.current.has(e.pointerId))
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const g = gesture.current;

    if (isSimulating && simulationResults && g.type === "none") {
      const wp = screenToWorld(e.clientX, e.clientY);
      const pin = findPinAt(wp);
      if (pin)
        setHoverTarget({
          id: `${pin.nodeId}:${pin.pinIndex}`,
          type: "pin",
          pos: wp,
        });
      else {
        const nodeHit = doc.nodes.find((n) => {
          const bbox = nodeBBox(n);
          return (
            wp.x >= bbox.x &&
            wp.x <= bbox.x + bbox.w &&
            wp.y >= bbox.y &&
            wp.y <= bbox.y + bbox.h
          );
        });
        if (nodeHit) setHoverTarget({ id: nodeHit.id, type: "node", pos: wp });
        else {
          const wireHit = findWireHit(doc.wires, wp, 0.3);
          if (wireHit)
            setHoverTarget({ id: wireHit.id, type: "wire", pos: wp });
          else setHoverTarget(null);
        }
      }
    }

    if (placement && g.type === "none") {
      const lift = e.pointerType === "touch" ? TOUCH_LIFT_PX : 0;
      const wp = screenToWorld(e.clientX, e.clientY - lift);
      setGhostPos(snapToGrid(wp));
      return;
    }

    if (tool === "wire" && g.type === "none") {
      const wp = screenToWorld(e.clientX, e.clientY);
      const pin = findPinAt(wp);
      setHoverPin(pin);
      if (pendingWire) {
        const end = pin ? { x: pin.x, y: pin.y } : snapToGrid(wp);
        const ignoreIds = new Set<string>();
        if (pendingWire.nodeId) ignoreIds.add(pendingWire.nodeId);
        if (pin) ignoreIds.add(pin.nodeId);
        setWirePreview({
          points: routeWire(pendingWire, end, ignoreIds),
          valid: true,
        });
      }
    }

    if (g.type === "pinch" && pointers.current.size >= 2) {
      if (!panFrameRequested.current) {
        panFrameRequested.current = true;
        requestAnimationFrame(() => {
          panFrameRequested.current = false;
          if (gesture.current.type !== "pinch" || !g.pinchCenter || !g.startView || g.pinchStartScale === undefined) return;
          const pts = Array.from(pointers.current.values()).slice(0, 2);
          if (pts.length < 2) return;
          const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
          const ratio = dist / (g.pinchStartDist || dist);
          const newScale = Math.max(
            0.2,
            Math.min(8, (g.pinchStartScale || 1) * ratio),
          );
          const rect = containerRef.current!.getBoundingClientRect();
          const localX = g.pinchCenter.x - rect.left;
          const localY = g.pinchCenter.y - rect.top;
          const sv = g.startView;
          const sScale = g.pinchStartScale;
          const nx = localX - ((localX - sv.x) / sScale) * newScale;
          const ny = localY - ((localY - sv.y) / sScale) * newScale;
          setView({ x: nx, y: ny, scale: newScale });
        });
      }
      return;
    }
    if (g.type === "pan") {
      if (!panFrameRequested.current) {
        panFrameRequested.current = true;
        requestAnimationFrame(() => {
          panFrameRequested.current = false;
          if (gesture.current.type !== "pan" || !g.startView || g.startX === undefined || g.startY === undefined) return;
          const curCoords = mouseCoords.current;
          if (!curCoords) return;
          setView({
            ...view,
            x: g.startView.x + (curCoords.x - g.startX),
            y: g.startView.y + (curCoords.y - g.startY),
          });
        });
      }
      return;
    }
    if (g.type === "multi-drag") {
      if (!dragFrameRequested.current) {
        dragFrameRequested.current = true;
        requestAnimationFrame(() => {
          dragFrameRequested.current = false;
          if (gesture.current.type !== "multi-drag" || g.startX === undefined || g.startY === undefined) return;
          const curCoords = mouseCoords.current;
          if (!curCoords) return;
          const lift = g.pointerType === "touch" ? TOUCH_LIFT_PX : 0;
          const startW = screenToWorld(g.startX!, g.startY!);
          const curW = screenToWorld(curCoords.x, curCoords.y - lift);
          if (!startW || !curW) return;
          const dx = curW.x - startW.x,
            dy = curW.y - startW.y;

          if (!g.moved) {
            commitHistory();
            g.moved = true;
          }

          let dxSnapped = dx;
          let dySnapped = dy;
          if (snap) {
            dxSnapped = Math.round(dx);
            dySnapped = Math.round(dy);
          } else {
            dxSnapped = Math.round(dx * 100) / 100;
            dySnapped = Math.round(dy * 100) / 100;
          }

          const nodeStarts = g.nodeStarts!;
          
          setDoc((d) => ({
            ...d,
            nodes: d.nodes.map((n) => {
              const startPos = nodeStarts.get(n.id);
              if (!startPos) return n;
              return { ...n, x: startPos.x + dxSnapped, y: startPos.y + dySnapped };
            }),
            wires: d.wires.map((w) => {
              // 1. If it is a rigid wire, move it rigidly
              const startPoints = g.wireStarts?.get(w.id);
              if (startPoints) {
                return {
                  ...w,
                  points: startPoints.map(p => ({ x: p.x + dxSnapped, y: p.y + dySnapped }))
                };
              }

              // 2. If it is a stretch wire, stretch its affected vertices
              const stretchEntries = g.stretchWires?.filter(sw => sw.wireId === w.id);
              if (stretchEntries && stretchEntries.length > 0) {
                const origPoints = stretchEntries[0].orig;
                const indices = stretchEntries.map(se => se.vertexIndex);
                const nextPoints = stretchWire(origPoints, indices, dxSnapped, dySnapped);
                return { ...w, points: nextPoints };
              }

              return w;
            }),
          }), true);
        });
      }
      return;
    }

    if (g.type === "selection") {
      g.currentX = e.clientX;
      g.currentY = e.clientY;
      // Force re-render to show box
      setGhostPos(prev => prev ? { ...prev } : { x: 0, y: 0 }); 
      return;
    }

    if (g.type === "drag" && g.nodeId) {
      if (!dragFrameRequested.current) {
        dragFrameRequested.current = true;
        requestAnimationFrame(() => {
          dragFrameRequested.current = false;
          if (gesture.current.type !== "drag" || !gesture.current.nodeId || g.startX === undefined || g.startY === undefined) return;
          const curCoords = mouseCoords.current;
          if (!curCoords) return;
          const lift = g.pointerType === "touch" ? TOUCH_LIFT_PX : 0;
          const startW = screenToWorld(g.startX!, g.startY!);
          const curW = screenToWorld(curCoords.x, curCoords.y - lift);
          if (!startW || !curW) return;
          const dx = curW.x - startW.x,
            dy = curW.y - startW.y;

          if (!g.moved) {
            commitHistory();
            g.moved = true;
          }

          let dxSnapped = dx;
          let dySnapped = dy;
          if (snap) {
            dxSnapped = Math.round(dx);
            dySnapped = Math.round(dy);
          } else {
            dxSnapped = Math.round(dx * 100) / 100;
            dySnapped = Math.round(dy * 100) / 100;
          }

          const id = g.nodeId;
          if (!g.nodeStart) return;
          const nx = g.nodeStart.x + dxSnapped,
            ny = g.nodeStart.y + dySnapped;
          const affected = g.affected ?? [];
          setDoc(
            (d) => ({
              ...d,
              nodes: d.nodes.map((n) => (n.id === id ? { ...n, x: nx, y: ny } : n)),
              wires:
                affected.length === 0
                  ? d.wires
                  : d.wires.map((w) => {
                      const wireAffected = affected.filter((a) => a.wireId === w.id);
                      if (wireAffected.length === 0) return w;
                      const indices = wireAffected.map(a => a.vertexIndex);
                      const origPoints = wireAffected[0].orig;
                      const nextPoints = stretchWire(origPoints, indices, dxSnapped, dySnapped);
                      return { ...w, points: nextPoints };
                    }),
            }),
            true,
          );
          setDragInfo({ nodeId: id, x: nx, y: ny });

          const node = doc.nodes.find((nn) => nn.id === id);
          if (node) {
            const sym = SYMBOLS[node.symbol];
            if (sym) {
              const pins = transformedPins(sym, node.rotation, node.size).map(
                (p, i) => ({ x: node.x + p.x, y: node.y + p.y, hide: sym.pins[i].hide }),
              );
              for (const pin of pins) {
                if (pin.hide) continue;
                for (const w of doc.wires) {
                  if (
                    Math.hypot(w.points[0].x - pin.x, w.points[0].y - pin.y) < 0.45
                  ) {
                    setSnapWireHi(w.id);
                  }
                }
              }
            }
          }
        });
      }
      return;
    }
    if (
      g.type === "anchor" &&
      g.anchorWireId != null &&
      g.anchorIndex != null &&
      g.segOriginalPoints
    ) {
      const startW = screenToWorld(g.startX!, g.startY!);
      const curW = screenToWorld(e.clientX, e.clientY);
      const dx = curW.x - startW.x,
        dy = curW.y - startW.y;

      if (!g.moved) {
        commitHistory();
        g.moved = true;

        const w = doc.wires.find((wi) => wi.id === g.anchorWireId);
        if (w) {
          const pts = g.segOriginalPoints.map((p) => ({ ...p }));
          let idx = g.anchorIndex;
          if (idx === 0 && g.startPinInfo) {
            pts.splice(1, 0, { ...pts[0] });
            idx = 1;
            g.segOriginalPoints = pts;
            g.anchorIndex = idx;
          } else if (idx === pts.length - 1 && g.endPinInfo) {
            pts.splice(pts.length - 1, 0, { ...pts[pts.length - 1] });
            idx = pts.length - 2;
            g.segOriginalPoints = pts;
            g.anchorIndex = idx;
          }
        }
      }

      const wid = g.anchorWireId;
      const idx = g.anchorIndex;
      const original = g.segOriginalPoints;
      g.moved = true;
      setDoc((d) => {
        const nodes =
          g.attachedNodeId && g.attachedNodeStart
            ? d.nodes.map((n) =>
                n.id === g.attachedNodeId
                  ? {
                      ...n,
                      x: g.attachedNodeStart!.x + dx,
                      y: g.attachedNodeStart!.y + dy,
                    }
                  : n,
              )
            : d.nodes;

        const wires = d.wires.map((w) => {
          if (w.id === wid) {
            const pts = original.map((p) => ({ ...p }));
            const moved = { x: pts[idx].x + dx, y: pts[idx].y + dy };
            if (snap) {
              moved.x = Math.round(moved.x);
              moved.y = Math.round(moved.y);
            }
            pts[idx] = moved;

            // Force start/end points to stay on their connected pins!
            if (g.startPinInfo) {
              const startPos = getPinWorldPos(g.startPinInfo.nodeId, g.startPinInfo.pinIndex, d.nodes);
              if (startPos) {
                pts[0] = startPos;
              }
            }
            if (g.endPinInfo) {
              const endPos = getPinWorldPos(g.endPinInfo.nodeId, g.endPinInfo.pinIndex, d.nodes);
              if (endPos) {
                pts[pts.length - 1] = endPos;
              }
            }

            return { ...w, points: pts };
          }
          const other = g.attachedNodeOtherWires?.find(
            (o) => o.wireId === w.id,
          );
          if (other) {
            return {
              ...w,
              points: stretchWire(other.orig, other.vertexIndex, dx, dy),
            };
          }
          return w;
        });

        return { ...d, nodes, wires };
      }, true);
      return;
    }
    if (
      g.type === "wireSeg" &&
      g.segWireId != null &&
      g.segIndex != null &&
      g.segOriginalPoints
    ) {
      const startW = screenToWorld(g.startX!, g.startY!);
      const curW = screenToWorld(e.clientX, e.clientY);
      const dx = curW.x - startW.x,
        dy = curW.y - startW.y;
      if (!g.moved) {
        commitHistory();
        g.moved = true;
        
        const w = doc.wires.find((wi) => wi.id === g.segWireId);
        if (w) {
          const pts = g.segOriginalPoints.map((p) => ({ ...p }));
          let idx = g.segIndex;
          const isStartPin = idx === 0 && g.startPinInfo != null;
          const isEndPin = idx + 1 === pts.length - 1 && g.endPinInfo != null;
          
          if (isStartPin) {
            pts.splice(1, 0, { ...pts[0] });
            idx += 1;
          }
          if (isEndPin) {
            pts.splice(pts.length - 1, 0, { ...pts[pts.length - 1] });
          }
          g.segOriginalPoints = pts;
          g.segIndex = idx;
        }
      }
      const id = g.segWireId;
      const idx = g.segIndex;
      const orient = g.segOrient;
      const original = g.segOriginalPoints;
      setDoc(
        (d) => ({
          ...d,
          wires: d.wires.map((w) => {
            if (w.id !== id) return w;
            const pts = original.map((p) => ({ ...p }));
            if (orient === "h") {
              pts[idx].y += dy;
              pts[idx + 1].y += dy;
            } else {
              pts[idx].x += dx;
              pts[idx + 1].x += dx;
            }

            // Force start/end points to stay on their connected pins!
            if (g.startPinInfo) {
              const startPos = getPinWorldPos(g.startPinInfo.nodeId, g.startPinInfo.pinIndex, d.nodes);
              if (startPos) {
                pts[0] = startPos;
              }
            }
            if (g.endPinInfo) {
              const endPos = getPinWorldPos(g.endPinInfo.nodeId, g.endPinInfo.pinIndex, d.nodes);
              if (endPos) {
                pts[pts.length - 1] = endPos;
              }
            }

            return { ...w, points: pts };
          }),
        }),
        true,
      );
      return;
    }
    if (g.type === "wire" && g.wireStart) {
      const dx = e.clientX - (g.startX ?? e.clientX);
      const dy = e.clientY - (g.startY ?? e.clientY);
      if (Math.hypot(dx, dy) > 4) g.moved = true;
      const wp = screenToWorld(e.clientX, e.clientY);
      const endPin = findPinAt(wp);
      setHoverPin(endPin);
      const end = endPin ? { x: endPin.x, y: endPin.y } : snapToGrid(wp);
      const ignoreIds = new Set<string>();
      if (g.wireStartPin) ignoreIds.add(g.wireStartPin.nodeId);
      if (endPin) ignoreIds.add(endPin.nodeId);
      setWirePreview({
        points: routeWire(g.wireStart, end, ignoreIds),
        valid: true,
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    const g = gesture.current;

    if (g.type === "selection") {
      const rect = containerRef.current!.getBoundingClientRect();
      const x1 = Math.min(g.startX!, g.currentX!);
      const y1 = Math.min(g.startY!, g.currentY!);
      const x2 = Math.max(g.startX!, g.currentX!);
      const y2 = Math.max(g.startY!, g.currentY!);
      
      const w1 = screenToWorld(x1, y1);
      const w2 = screenToWorld(x2, y2);
      
      const selectedNodes = doc.nodes.filter(n => {
        const bbox = nodeBBox(n);
        return bbox.x >= w1.x && (bbox.x + bbox.w) <= w2.x &&
               bbox.y >= w1.y && (bbox.y + bbox.h) <= w2.y;
      }).map(n => n.id);
      
      const selectedWires = doc.wires.filter(w => {
        return w.points.every(p => p.x >= w1.x && p.x <= w2.x && p.y >= w1.y && p.y <= w2.y);
      }).map(w => w.id);
      
      if (e.shiftKey) {
        setSelectedIds(Array.from(new Set([...selectedIds, ...selectedNodes])));
        setSelectedWireIds(Array.from(new Set([...selectedWireIds, ...selectedWires])));
      } else {
        setSelectedIds(selectedNodes);
        setSelectedWireIds(selectedWires);
      }
      
      gesture.current = { type: "none" };
      return;
    }

    if (g.type === "multi-drag") {
      setDoc(d => {
        let nextDoc = d;
        g.nodeStarts?.forEach((_, id) => {
          nextDoc = autoConnect(nextDoc, id);
        });
        return nextDoc;
      }, true);
      setSelectedIds([...selectedIds]); // Trigger refresh
      gesture.current = { type: "none" };
      return;
    }

    if (g.type === "drag") {
      const id = g.nodeId;
      if (id) setDoc((d) => autoConnect(d, id));
      setDragInfo(null);
      setSnapWireHi(null);
    }

    if (g.type === "wire" && g.wireStart) {
      const wp = screenToWorld(e.clientX, e.clientY);
      const endPin = findPinAt(wp);
      const end = endPin ? { x: endPin.x, y: endPin.y } : snapToGrid(wp);
      const same = end.x === g.wireStart.x && end.y === g.wireStart.y;
      if (!g.moved) {
        if (pendingWire) {
          const samePending =
            end.x === pendingWire.x && end.y === pendingWire.y;
          if (!samePending) {
            const ignoreIds = new Set<string>();
            if (pendingWire.nodeId) ignoreIds.add(pendingWire.nodeId);
            if (endPin) ignoreIds.add(endPin.nodeId);
            const points = routeWire(pendingWire, end, ignoreIds).filter(
              (p, i, arr) =>
                i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y,
            );
            setDoc((d) => ({
              ...d,
              wires: [
                ...d.wires,
                {
                  id: crypto.randomUUID(),
                  points,
                  color: wireColor,
                  width: d.defaultWireWidth ?? 0.1,
                },
              ],
            }));
          }
          setPendingWire(null);
          setWirePreview(null);
        } else {
          setPendingWire({
            x: g.wireStart.x,
            y: g.wireStart.y,
            nodeId: g.wireStartPin?.nodeId,
          });
          setWirePreview({ points: [g.wireStart, g.wireStart], valid: true });
        }
      } else if (!same) {
        const ignoreIds = new Set<string>();
        if (g.wireStartPin) ignoreIds.add(g.wireStartPin.nodeId);
        if (endPin) ignoreIds.add(endPin.nodeId);
        const points = routeWire(g.wireStart, end, ignoreIds).filter(
          (p, i, arr) =>
            i === 0 || p.x !== arr[i - 1].x || p.y !== arr[i - 1].y,
        );
        setDoc((d) => ({
          ...d,
          wires: [
            ...d.wires,
            {
              id: crypto.randomUUID(),
              points,
              color: wireColor,
              width: d.defaultWireWidth ?? 0.1,
            },
          ],
        }));
        setPendingWire(null);
        setWirePreview(null);
      } else {
        setWirePreview(null);
      }
    }

    if (pointers.current.size < 2 && g.type === "pinch")
      gesture.current = { type: "none" };
    if (pointers.current.size === 0) {
      gesture.current = { type: "none" };
      setDragInfo(null);
      setSnapWireHi(null);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current!.getBoundingClientRect();
    const localX = e.clientX - rect.left,
      localY = e.clientY - rect.top;
    const delta = -e.deltaY * 0.0015;
    setView((prev) => {
      const newScale = Math.max(0.1, Math.min(10, prev.scale * (1 + delta)));
      const nx = localX - ((localX - prev.x) / prev.scale) * newScale;
      const ny = localY - ((localY - prev.y) / prev.scale) * newScale;
      return { x: nx, y: ny, scale: newScale };
    });
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (placement) {
      e.preventDefault();
      onCancelPlace?.();
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    if (isSimulating) return;
    const target = e.target as SVGElement;
    const nodeEl = target.closest?.("[data-node-id]") as SVGElement | null;
    if (nodeEl && onOpenProperties) {
      const id = nodeEl.getAttribute("data-node-id")!;
      setSelectedId(id);
      setSelectedWireId(null);
      onOpenProperties(id);
      return;
    }

    // Check if double clicked on wire
    const clickWp = screenToWorld(e.clientX, e.clientY);
    const hit = findWireHit(doc.wires, clickWp, 0.45);
    if (hit) {
      setSelectedId(null);
      setSelectedWireId(hit.wireId);
      if (onOpenWireProperties) {
        onOpenWireProperties(hit.wireId);
      }
      return;
    }

    if (!selectedWireId) return;
    const anchorEl = target.closest?.("[data-anchor]") as SVGElement | null;
    if (anchorEl) {
      const idx = parseInt(anchorEl.getAttribute("data-anchor") || "-1", 10);
      const wid = anchorEl.getAttribute("data-wire") || "";
      if (wid === selectedWireId && idx > 0) {
        setDoc((d) => ({
          ...d,
          wires: d.wires.map((w) => {
            if (w.id !== wid || idx >= w.points.length - 1) return w;
            const pts = w.points.filter((_, i) => i !== idx);
            return { ...w, points: pts };
          }),
        }));
        return;
      }
    }
    const wp = screenToWorld(e.clientX, e.clientY);
    const w = doc.wires.find((wi) => wi.id === selectedWireId);
    if (!w) return;
    const split = splitWireAtPoint(
      w,
      snap ? { x: Math.round(wp.x), y: Math.round(wp.y) } : wp,
      0.45,
    );
    if (split)
      setDoc((d) => ({
        ...d,
        wires: d.wires.map((wi) => (wi.id === w.id ? split : wi)),
      }));
  };

  const gridSize = GRID * view.scale;

  const junctions = useMemo(() => computeJunctions(doc.wires), [doc.wires]);
  const crossings = useMemo(() => computeCrossings(doc.wires), [doc.wires]);
  const crossingMap = useMemo(() => {
    const m = new Map<string, { x: number; y: number }[]>();
    for (const c of crossings) {
      const arr = m.get(c.wireId) ?? [];
      arr.push({ x: c.x, y: c.y });
      m.set(c.wireId, arr);
    }
    return m;
  }, [crossings]);

  const renderWirePath = (w: SchematicWire) => {
    if (wireStyle === "curved" && w.points.length >= 3) {
      const r = 0.35;
      let d = `M ${w.points[0].x} ${w.points[0].y}`;
      for (let i = 1; i < w.points.length - 1; i++) {
        const a = w.points[i - 1],
          b = w.points[i],
          c = w.points[i + 1];
        const dirA = { x: Math.sign(b.x - a.x), y: Math.sign(b.y - a.y) };
        const dirC = { x: Math.sign(c.x - b.x), y: Math.sign(c.y - b.y) };
        const lenAB = Math.hypot(b.x - a.x, b.y - a.y);
        const lenBC = Math.hypot(c.x - b.x, c.y - b.y);
        const rr = Math.min(r, lenAB / 2, lenBC / 2);
        const p1 = { x: b.x - dirA.x * rr, y: b.y - dirA.y * rr };
        const p2 = { x: b.x + dirC.x * rr, y: b.y + dirC.y * rr };
        d += ` L ${p1.x} ${p1.y} Q ${b.x} ${b.y} ${p2.x} ${p2.y}`;
      }
      const last = w.points[w.points.length - 1];
      d += ` L ${last.x} ${last.y}`;
      return d;
    }
    const hops = crossingMap.get(w.id) ?? [];
    let d = "";
    const HOP = 0.35;
    for (let i = 0; i < w.points.length; i++) {
      const p = w.points[i];
      if (i === 0) {
        d += `M ${p.x} ${p.y}`;
        continue;
      }
      const prev = w.points[i - 1];
      const isH = Math.abs(prev.y - p.y) < 1e-6;
      if (isH && hops.length) {
        const dir = Math.sign(p.x - prev.x);
        const segHops = hops
          .filter(
            (h) =>
              Math.abs(h.y - p.y) < 1e-6 &&
              (dir > 0 ? h.x > prev.x && h.x < p.x : h.x < prev.x && h.x > p.x),
          )
          .sort((a, b) => dir * (a.x - b.x));
        for (const h of segHops) {
          d += ` L ${h.x - dir * HOP} ${p.y}`;
          d += ` A ${HOP} ${HOP} 0 0 ${dir > 0 ? 1 : 0} ${h.x + dir * HOP} ${p.y}`;
        }
        d += ` L ${p.x} ${p.y}`;
      } else {
        d += ` L ${p.x} ${p.y}`;
      }
    }
    return d;
  };

  const renderPinLabel = (n: SchematicNode, pinIdx: number, color: string) => {
    const sym = SYMBOLS[n.symbol];
    if (!sym || sym.id?.startsWith("kicad:") || n.symbol?.startsWith("kicad:") || (sym as any).isKicad) return null;
    const p = sym.pins[pinIdx];
    const name = n.pinNames?.[pinIdx] ?? p.name;
    if (!name) return null;
    const eps = 0.05;
    let lx = p.x,
      ly = p.y - 0.18;
    let anchor: "start" | "middle" | "end" = "middle";
    if (Math.abs(p.x) < eps) {
      lx = p.x + 0.1;
      ly = p.y - 0.2;
      anchor = "start";
    } else if (Math.abs(p.x - sym.width) < eps) {
      lx = p.x - 0.1;
      ly = p.y - 0.2;
      anchor = "end";
    } else if (Math.abs(p.y) < eps) {
      lx = p.x + 0.15;
      ly = p.y - 0.15;
      anchor = "start";
    } else if (Math.abs(p.y - sym.height) < eps) {
      lx = p.x + 0.15;
      ly = p.y + 0.45;
      anchor = "start";
    }
    return (
      <text
        key={`pn-${pinIdx}`}
        x={lx}
        y={ly}
        fontSize={0.3}
        textAnchor={anchor}
        fill={color}
        opacity={0.95}
        style={{ pointerEvents: "none", fontWeight: 500 }}
      >
        {name}
      </text>
    );
  };

  const dragOverlay = (() => {
    if (!dragInfo) return null;
    const n = doc.nodes.find((nn) => nn.id === dragInfo.nodeId);
    if (!n) return null;
    const sym = SYMBOLS[n.symbol];
    if (!sym) return null;
    const cx = n.x + sym.width / 2,
      cy = n.y + sym.height / 2;
    const sx = cx * GRID * view.scale + view.x,
      sy = cy * GRID * view.scale + view.y;
    return (
      <>
        <line
          x1={0}
          y1={sy}
          x2={size.w}
          y2={sy}
          stroke="#2563eb"
          strokeWidth={0.5}
          strokeDasharray="4,3"
          opacity={0.4}
          pointerEvents="none"
        />
        <line
          x1={sx}
          y1={0}
          x2={sx}
          y2={size.h}
          stroke="#2563eb"
          strokeWidth={0.5}
          strokeDasharray="4,3"
          opacity={0.4}
          pointerEvents="none"
        />
        <g pointerEvents="none">
          <rect
            x={sx + 8}
            y={sy - 28}
            width={96}
            height={22}
            rx={4}
            fill="#0f172a"
            opacity={0.92}
          />
          <text
            x={sx + 56}
            y={sy - 13}
            fontSize={11}
            textAnchor="middle"
            fill="#e6edf6"
            fontFamily="ui-monospace, monospace"
          >
            X {n.x.toFixed(1)} Y {n.y.toFixed(1)}
          </text>
        </g>
      </>
    );
  })();

  const ghostOverlay = (() => {
    if (!placement || !ghostPos) return null;

    if (placement.multi) {
      const { nodes, wires } = placement.multi;
      let minX = Infinity,
        minY = Infinity;
      nodes.forEach((n) => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
      });
      wires.forEach((w) =>
        w.points.forEach((p) => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
        }),
      );

      if (minX === Infinity) return null;

      return (
        <g
          transform={`translate(${ghostPos.x - minX} ${ghostPos.y - minY})`}
          opacity={0.5}
          pointerEvents="none"
        >
          {nodes.map((n) => {
            const sym = SYMBOLS[n.symbol];
            if (!sym) return null;
            return (
              <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
                <g
                  transform={`rotate(${n.rotation} ${sym.width / 2} ${sym.height / 2})`}
                >
                  {sym.draw("#2563eb")}
                </g>
              </g>
            );
          })}
          {wires.map((w) => (
            <polyline
               key={w.id}
               points={w.points.map(p => `${p.x},${p.y}`).join(" ")}
               stroke="#2563eb"
               strokeWidth={0.1}
               fill="none"
               strokeDasharray="0.3,0.2"
             />
          ))}
        </g>
      );
    }

    if (!placement.symbol) return null;
    const sym = SYMBOLS[placement.symbol];
    if (!sym) return null;
    const cx = sym.width / 2,
      cy = sym.height / 2;
    return (
      <g
        transform={`translate(${ghostPos.x} ${ghostPos.y})`}
        opacity={0.55}
        pointerEvents="none"
      >
        <rect
          x={-0.2}
          y={-0.2}
          width={sym.width + 0.4}
          height={sym.height + 0.4}
          fill="none"
          stroke="#2563eb"
          strokeWidth={0.08}
          strokeDasharray="0.3,0.2"
        />
        <g transform={`rotate(${placement.rotation ?? 0} ${cx} ${cy})`}>
          {sym.draw("#2563eb")}
        </g>
      </g>
    );
  })();

  const alignmentOverlay = (() => {
    if (!dragInfo) return null;
    const node = doc.nodes.find((nn) => nn.id === dragInfo.nodeId);
    if (!node) return null;
    const sym = SYMBOLS[node.symbol];
    if (!sym) return null;
    const myPoints = [
      ...transformedPins(sym, node.rotation, node.size).map((p) => ({
        x: node.x + p.x,
        y: node.y + p.y,
      })),
      {
        x: node.x + (sym.width * node.size) / 2,
        y: node.y + (sym.height * node.size) / 2,
      },
      { x: node.x, y: node.y },
      { x: node.x + sym.width * node.size, y: node.y + sym.height * node.size },
    ];
    const others: { x: number; y: number }[] = [];
    for (const n of doc.nodes) {
      if (n.id === node.id) continue;
      const s = SYMBOLS[n.symbol];
      if (!s) continue;
      transformedPins(s, n.rotation, n.size).forEach((p) =>
        others.push({ x: n.x + p.x, y: n.y + p.y }),
      );
      others.push({
        x: n.x + (s.width * n.size) / 2,
        y: n.y + (s.height * n.size) / 2,
      });
      others.push({ x: n.x, y: n.y });
      others.push({ x: n.x + s.width * n.size, y: n.y + s.height * n.size });
    }
    const TOL = 0.05;
    type Match = {
      axis: "h" | "v";
      my: { x: number; y: number };
      other: { x: number; y: number };
    };
    const matches: Match[] = [];
    const seen = new Set<string>();
    for (const mp of myPoints) {
      for (const op of others) {
        if (Math.abs(mp.y - op.y) < TOL) {
          const key = `h:${mp.y.toFixed(2)}`;
          if (!seen.has(key)) {
            seen.add(key);
            matches.push({ axis: "h", my: mp, other: op });
          }
        }
        if (Math.abs(mp.x - op.x) < TOL) {
          const key = `v:${mp.x.toFixed(2)}`;
          if (!seen.has(key)) {
            seen.add(key);
            matches.push({ axis: "v", my: mp, other: op });
          }
        }
      }
    }
    if (matches.length === 0) return null;
    const toScreen = (x: number, y: number) => ({
      sx: x * GRID * view.scale + view.x,
      sy: y * GRID * view.scale + view.y,
    });
    const guide = "#f59e0b";
    return (
      <g pointerEvents="none">
        {matches.slice(0, 6).map((m, i) => {
          const a = toScreen(m.my.x, m.my.y);
          const b = toScreen(m.other.x, m.other.y);
          const dist = Math.hypot(m.my.x - m.other.x, m.my.y - m.other.y);
          const midX = (a.sx + b.sx) / 2,
            midY = (a.sy + b.sy) / 2;
          return (
            <g key={i}>
              {m.axis === "h" ? (
                <line
                  x1={0}
                  y1={a.sy}
                  x2={size.w}
                  y2={a.sy}
                  stroke={guide}
                  strokeWidth={0.7}
                  strokeDasharray="5,3"
                  opacity={0.7}
                />
              ) : (
                <line
                  x1={a.sx}
                  y1={0}
                  x2={a.sx}
                  y2={size.h}
                  stroke={guide}
                  strokeWidth={0.7}
                  strokeDasharray="5,3"
                  opacity={0.7}
                />
              )}
              <line
                x1={a.sx}
                y1={a.sy}
                x2={b.sx}
                y2={b.sy}
                stroke={guide}
                strokeWidth={1.2}
                opacity={0.95}
              />
              <circle cx={a.sx} cy={a.sy} r={3} fill={guide} />
              <circle cx={b.sx} cy={b.sy} r={3} fill={guide} />
              <rect
                x={midX - 22}
                y={midY - 10}
                width={44}
                height={16}
                rx={3}
                fill="#0f172a"
                opacity={0.92}
              />
              <text
                x={midX}
                y={midY + 2}
                fontSize={10}
                textAnchor="middle"
                fill="#fff"
                fontFamily="ui-monospace, monospace"
              >
                {dist.toFixed(2)}
              </text>
            </g>
          );
        })}
      </g>
    );
  })();

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden touch-none no-select"
      style={{
        background: bg,
        cursor: placement
          ? "crosshair"
          : tool === "pan"
            ? "grab"
            : tool === "wire"
              ? "crosshair"
              : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
    >
      <svg
        ref={svg}
        width={size.w}
        height={size.h}
        style={{ display: "block" }}
      >
        <RealisticDefs />
        {realistic && !isSimulating && (
          <rect
            width={size.w}
            height={size.h}
            fill={isDark ? "url(#dark-wood-pattern)" : "url(#wood-pattern)"}
            style={{ pointerEvents: "none" }}
          />
        )}
        {showGrid && (
          <SmartGrid
            width={size.w}
            height={size.h}
            gridSize={gridSize}
            offsetX={view.x}
            offsetY={view.y}
            isDark={isDark || isSimulating}
            style={gridStyle}
            opacity={isSimulating ? gridOpacity * 0.18 : gridOpacity}
            zoom={view.scale}
            isSimulating={isSimulating}
          />
        )}

        <g
          transform={`translate(${view.x} ${view.y}) scale(${view.scale * GRID})`}
        >
          {doc.wires.map((w) => {
            if (!w.points || w.points.length === 0) return null;
            const isSel = selectedWireIds.includes(w.id);
            const wireNetId = netIndex.wireNet.get(w.id);
            const inNet = highlightedNetIds
              ? wireNetId !== undefined && highlightedNetIds.includes(wireNetId)
              : highlightedNet != null && wireNetId === highlightedNet;
            const isSnapHi = w.id === snapWireHi;
            const baseColor = getWireColorHex(w.color);

            const voltage = isSimulating ? getNetVoltage(wireNetId ?? 0) : 0;
            const stroke = isSimulating
              ? (voltage > 0.001 ? "#4ade80" : "#94a3b8")
              : isSnapHi
                ? "#16a34a"
                : inNet
                  ? "#2563eb"
                  : baseColor;

            let wireCurrent = 0;
            if (isSimulating) {
              const sI = getWirePinCurrent(w.points[0].x, w.points[0].y);
              const eI = getWirePinCurrent(
                w.points[w.points.length - 1].x,
                w.points[w.points.length - 1].y,
              );
              wireCurrent = Math.abs(sI) > Math.abs(eI) ? sI : -eI;
            }

            const customWidth = w.width ?? 0.1;
            const sw = isSel
              ? customWidth * 1.8
              : inNet || isSnapHi
                ? customWidth * 1.5
                : isSimulating
                  ? 0.15
                  : customWidth;
            const path = renderWirePath(w);
            return (
              <g key={w.id}>
                <path
                  d={path}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={0.6}
                  style={{ cursor: tool === "select" ? "move" : "default" }}
                />
                {realistic ? (
                  <>
                    {/* Wire realistic drop shadow */}
                    <path
                      d={path}
                      fill="none"
                      stroke="#000000"
                      strokeWidth={0.24}
                      opacity={0.35}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#wire-realistic-shadow)"
                      style={{ pointerEvents: "none" }}
                    />
                    {/* Thick insulated wire sleeve */}
                    <path
                      d={path}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={0.22}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ pointerEvents: "none" }}
                    />
                    {/* Glossy core reflection highlight */}
                    <path
                      d={path}
                      fill="none"
                      stroke="#ffffff"
                      strokeWidth={0.05}
                      opacity={0.65}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ pointerEvents: "none" }}
                    />
                    {/* Solder blob endpoints */}
                    {w.points[0] && (
                      <circle
                        cx={w.points[0].x}
                        cy={w.points[0].y}
                        r={0.18}
                        fill="url(#metal-shimmer-grad)"
                        stroke="#475569"
                        strokeWidth={0.02}
                        filter="url(#realistic-shadow)"
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                    {w.points[w.points.length - 1] && (
                      <circle
                        cx={w.points[w.points.length - 1].x}
                        cy={w.points[w.points.length - 1].y}
                        r={0.18}
                        fill="url(#metal-shimmer-grad)"
                        stroke="#475569"
                        strokeWidth={0.02}
                        filter="url(#realistic-shadow)"
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                  </>
                ) : (
                  <path
                    d={path}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={sw}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ pointerEvents: "none" }}
                  />
                )}
                {isSimulating && (
                  <path
                    d={path}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={sw * 2.5}
                    opacity={0.15}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ filter: "blur(2px)", pointerEvents: "none" }}
                  />
                )}
                {isSimulating && (
                  <CurrentFlow
                    path={path}
                    current={wireCurrent}
                    zoom={view.scale}
                  />
                )}
                {isSel && (
                  <path
                    d={path}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={0.08}
                    strokeDasharray="0.3,0.2"
                    style={{ pointerEvents: "none" }}
                  />
                )}
                {isSimulating && view.scale > 0.6 && (
                  <g
                    transform={`translate(${w.points[0].x + (w.points[w.points.length - 1].x - w.points[0].x) / 2} ${w.points[0].y + (w.points[w.points.length - 1].y - w.points[0].y) / 2 - 0.45})`}
                    pointerEvents="none"
                  >
                    <rect
                      x={-0.85}
                      y={-0.32}
                      width={1.7}
                      height={0.64}
                      rx={0.12}
                      fill="#1c0a00"
                      stroke="#f97316"
                      strokeWidth={0.06}
                      opacity={1.0}
                    />
                    <text
                      x={0}
                      y={0.14}
                      fontSize={0.42}
                      fill="#fdba74"
                      textAnchor="middle"
                      fontWeight="black"
                      fontFamily="ui-monospace"
                    >
                      {voltage.toFixed(1)}V
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Net Labels - Professional International EDA Standard (KiCad / Altium Designer) */}
          {(doc.netLabels ?? []).map((label) => {
            const netId = netIndex.labelNet.get(label.id);
            const isHighlighted = highlightedNetIds?.includes(netId ?? -1);
            const angle = label.rotation ?? 0;
            const isGlobal = label.scope === "global";
            const upperText = label.text.toUpperCase();
            const isGnd = upperText === "GND" || upperText === "AGND" || upperText === "DGND" || upperText === "0V" || upperText.startsWith("GND");
            const isPower = upperText === "VCC" || upperText === "VDD" || upperText === "VBAT" || upperText === "+5V" || upperText === "+3.3V" || upperText === "+12V" || upperText === "+24V" || upperText.startsWith("+");
            
            // Dynamic Voltage during simulation
            const netVoltage = isSimulating && netId !== undefined ? getNetVoltage(netId) : null;

            // Color scheme matching KiCad 8 & Altium standards
            let strokeColor = isGlobal ? "#a855f7" : "#0284c7";
            let bgColor = isDark
              ? (isGlobal ? "rgba(46, 16, 101, 0.92)" : "rgba(8, 47, 73, 0.92)")
              : (isGlobal ? "rgba(250, 245, 255, 0.96)" : "rgba(240, 249, 255, 0.96)");
            let textColor = isGlobal
              ? (isDark ? "#c084fc" : "#7e22ce")
              : (isDark ? "#38bdf8" : "#0369a1");

            if (isGnd) {
              strokeColor = "#10b981";
              bgColor = isDark ? "rgba(6, 78, 59, 0.92)" : "rgba(236, 253, 245, 0.96)";
              textColor = isDark ? "#6ee7b7" : "#047857";
            } else if (isPower) {
              strokeColor = "#f59e0b";
              bgColor = isDark ? "rgba(69, 26, 3, 0.92)" : "rgba(254, 252, 232, 0.96)";
              textColor = isDark ? "#fcd34d" : "#b45309";
            }

            if (isHighlighted) {
              strokeColor = "#3b82f6";
              bgColor = isDark ? "rgba(30, 58, 138, 0.95)" : "rgba(219, 234, 254, 0.98)";
              textColor = isDark ? "#93c5fd" : "#1d4ed8";
            } else if (isSimulating && netVoltage !== null && Math.abs(netVoltage) > 0.05) {
              strokeColor = "#10b981";
              textColor = isDark ? "#4ade80" : "#059669";
            }

            // Measurements for crisp EDA typography
            const charWidth = 0.28;
            const padLeft = isGlobal ? 0.44 : 0.38;
            const padRight = isGlobal ? 0.38 : 0.22;
            const width = Math.max(1.15, padLeft + label.text.length * charWidth + padRight);
            const height = 0.68;
            const halfH = height / 2;

            // Flag paths (KiCad Local chevron vs Global diamond port)
            const localFlagPath = `M 0 0 L 0.32 -${halfH} L ${width} -${halfH} L ${width} ${halfH} L 0.32 ${halfH} Z`;
            const globalPortPath = `M 0 0 L 0.32 -${halfH} L ${width - 0.28} -${halfH} L ${width} 0 L ${width - 0.28} ${halfH} L 0.32 ${halfH} Z`;
            const pathData = isGlobal ? globalPortPath : localFlagPath;

            return (
              <g
                key={`net-label-${label.id}`}
                transform={`translate(${label.x} ${label.y}) rotate(${angle})`}
                opacity={label.visible === false ? 0 : 1}
                style={{ cursor: "pointer", pointerEvents: "all" }}
                onPointerDown={(e) => {
                  if (tool !== "select") return;
                  e.stopPropagation();
                  // Clicking highlights all connected wires of this net
                  if (netId !== undefined) {
                    const matchingWireIds = doc.wires
                      .filter((w) => netIndex.wireNet.get(w.id) === netId)
                      .map((w) => w.id);
                    if (matchingWireIds.length > 0 && setSelectedWireIds) {
                      setSelectedWireIds(matchingWireIds);
                    }
                  }
                }}
              >
                {/* Glow filter when highlighted or active */}
                {isHighlighted && (
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#3b82f6"
                    strokeWidth={0.16}
                    opacity={0.6}
                    style={{ filter: "drop-shadow(0 0 2px #3b82f6)" }}
                  />
                )}

                {/* Banner Body */}
                <path
                  d={pathData}
                  fill={bgColor}
                  stroke={strokeColor}
                  strokeWidth={0.06}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />

                {/* Scope Indicator Detail (KiCad port marker) */}
                {isGlobal && (
                  <path
                    d={`M ${width - 0.22} -0.15 L ${width - 0.08} 0 L ${width - 0.22} 0.15`}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={0.04}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.8}
                  />
                )}

                {/* Label Text */}
                <text
                  x={isGlobal ? (padLeft + width - padRight) / 2 : (padLeft + width - padRight) / 2 + 0.04}
                  y={0.02}
                  fontSize={0.42}
                  fontWeight="700"
                  fontFamily='ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Monaco, Consolas, monospace'
                  letterSpacing="0.02em"
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={textColor}
                  pointerEvents="none"
                >
                  {label.text}
                </text>

                {/* Anchor Snapping Node at Electrical Origin (0, 0) */}
                <g pointerEvents="none">
                  <circle
                    cx={0}
                    cy={0}
                    r={0.08}
                    fill={strokeColor}
                    stroke={isDark ? "#0f172a" : "#ffffff"}
                    strokeWidth={0.03}
                  />
                  <circle cx={0} cy={0} r={0.03} fill="#ffffff" />
                </g>

                {/* Live Voltage Badge during Simulation */}
                {isSimulating && netVoltage !== null && (
                  <g transform={`translate(${width + 0.15}, -0.26)`} pointerEvents="none">
                    <rect
                      x={0}
                      y={0}
                      width={1.1}
                      height={0.52}
                      rx={0.1}
                      fill={isDark ? "#090d16" : "#ffffff"}
                      stroke="#10b981"
                      strokeWidth={0.04}
                      opacity={0.95}
                    />
                    <text
                      x={0.55}
                      y={0.28}
                      fontSize={0.28}
                      fontWeight="bold"
                      fontFamily="ui-monospace, monospace"
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="#10b981"
                    >
                      {netVoltage.toFixed(1)}V
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {selectedWireId &&
            (() => {
              const w = doc.wires.find((wi) => wi.id === selectedWireId);
              if (!w) return null;
              return (
                <g>
                  {w.points.map((p, i) => (
                    <circle
                      key={`a-${i}`}
                      cx={p.x}
                      cy={p.y}
                      r={0.22}
                      fill="#fff"
                      stroke="#2563eb"
                      strokeWidth={0.06}
                      data-anchor={i}
                      data-wire={w.id}
                      style={{ cursor: "grab" }}
                    />
                  ))}
                </g>
              );
            })()}

          {wirePreview &&
            wirePreview.points.length > 1 &&
            (wireStyle === "curved" && wirePreview.points.length >= 3 ? (
              <path
                d={(() => {
                  const pts = wirePreview.points;
                  let d = `M ${pts[0].x} ${pts[0].y}`;
                  for (let i = 1; i < pts.length - 1; i++) {
                    const a = pts[i - 1],
                      b = pts[i],
                      c = pts[i + 1];
                    const dirA = {
                      x: Math.sign(b.x - a.x),
                      y: Math.sign(b.y - a.y),
                    };
                    const dirC = {
                      x: Math.sign(c.x - b.x),
                      y: Math.sign(c.y - b.y),
                    };
                    const rr = Math.min(
                      0.35,
                      Math.hypot(b.x - a.x, b.y - a.y) / 2,
                      Math.hypot(c.x - b.x, c.y - b.y) / 2,
                    );
                    d += ` L ${b.x - dirA.x * rr} ${b.y - dirA.y * rr} Q ${b.x} ${b.y} ${b.x + dirC.x * rr} ${b.y + dirC.y * rr}`;
                  }
                  const last = pts[pts.length - 1];
                  d += ` L ${last.x} ${last.y}`;
                  return d;
                })()}
                fill="none"
                stroke={getWireColorHex(wireColor)}
                strokeWidth={0.1}
                strokeDasharray="0.3,0.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
                pointerEvents="none"
              />
            ) : (
              <polyline
                points={wirePreview.points
                  .map((p) => `${p.x},${p.y}`)
                  .join(" ")}
                fill="none"
                stroke={getWireColorHex(wireColor)}
                strokeWidth={0.1}
                strokeDasharray="0.3,0.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
                pointerEvents="none"
              />
            ))}

          {junctions.map((j, i) => {
            // Find net voltage for junction glow
            const netId = netIndex.gridNet.get(
              `${Math.round(j.x * 10)},${Math.round(j.y * 10)}`,
            );
            const voltage = isSimulating ? getNetVoltage(netId ?? 0) : 0;
            const glowColor = isSimulating ? (voltage > 0.001 ? "#4ade80" : "#94a3b8") : "#000000";

            return (
              <g key={i} pointerEvents="none">
                {isSimulating && Math.abs(voltage) > 0.1 && (
                  <circle
                    cx={j.x}
                    cy={j.y}
                    r={0.6}
                    fill={glowColor}
                    style={{ filter: "blur(4px)" }}
                    opacity={0.4}
                  />
                )}
                <circle cx={j.x} cy={j.y} r={0.28} fill={strokeColor} />
                <circle
                  cx={j.x}
                  cy={j.y}
                  r={0.36}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={0.05}
                  opacity={0.4}
                />
              </g>
            );
          })}

          {doc.nodes.map((n) => {
            const sym = SYMBOLS[n.symbol];
            if (!sym) return null;
            const isSel = selectedIds.includes(n.id);
            const cx = sym.width / 2,
              cy = sym.height / 2;
            const nodeScale = n.size ?? 1;
            const isLedOn = n.symbol === "led" && isSimulating && (() => {
              const i = Math.abs(getElementCurrent(getComponentRef(n)));
              const brightness = i < 0.00001 ? 0 : Math.min(1, i * 100);
              return brightness >= 0.02;
            })();
            const isLedWhiteToRed = n.symbol === "led" && isLedOn && n.color === "white";
            const effectiveColor = isLedWhiteToRed ? "red" : n.color;
            const nodeColor = effectiveColor
              ? getWireColorHex(effectiveColor)
              : getWireColorHex(doc.defaultElementColor || "black");

            const hasNetPin = highlightedNetIds
              ? sym.pins.some((_, i) => {
                  const pNet = netIndex.pinNet.get(`${n.id}:${i}`);
                  return pNet !== undefined && highlightedNetIds.includes(pNet);
                })
              : highlightedNet != null &&
                sym.pins.some(
                  (_, i) =>
                    netIndex.pinNet.get(`${n.id}:${i}`) === highlightedNet,
                );

            const stats = isSimulating ? getComponentStats(n) : null;
            const heatColor = stats ? getHeatColor(stats.power) : null;

            let liveValueStr = "";
            if (isSimulating && stats) {
              if (n.symbol === "voltmeter") {
                const v = stats.voltage;
                const absV = Math.abs(v);
                if (absV >= 1) liveValueStr = `${v.toFixed(2)} V`;
                else if (absV >= 1e-3) liveValueStr = `${(v * 1000).toFixed(1)} mV`;
                else if (absV >= 1e-6) liveValueStr = `${(v * 1e6).toFixed(1)} µV`;
                else liveValueStr = "0.00 V";
              } else if (n.symbol === "ammeter") {
                const i = stats.current;
                const absI = Math.abs(i);
                if (absI >= 1) liveValueStr = `${i.toFixed(2)} A`;
                else if (absI >= 1e-3) liveValueStr = `${(i * 1000).toFixed(1)} mA`;
                else if (absI >= 1e-6) liveValueStr = `${(i * 1e6).toFixed(1)} µA`;
                else liveValueStr = "0.00 A";
              }
            }

            let isDamaged = false;
            if (isSimulating && stats) {
              const absI = Math.abs(stats.current);
              if (n.symbol === "led" && absI > 0.025) isDamaged = true;
              if (n.symbol === "resistor" && absI > 0.5) isDamaged = true;
              if ((n.symbol === "vsource" || n.symbol === "battery") && absI > 10) isDamaged = true;
            }

            return (
              <g
                key={n.id}
                data-node-id={n.id}
                transform={`translate(${n.x} ${n.y})`}
                style={{ cursor: "move" }}
              >
                {isDamaged && (
                  <g transform={`translate(${cx} ${cy})`} pointerEvents="none" className="z-50">
                    <text
                      x={0}
                      y={0.4}
                      fontSize={Math.max(sym.width, sym.height) * 1.5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="animate-pulse"
                      style={{ filter: "drop-shadow(0 0 8px rgba(239, 68, 68, 0.8))" }}
                    >
                      🔥
                    </text>
                  </g>
                )}
                {locateSignal?.id === n.id && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={Math.max(sym.width, sym.height) * 1.5}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={0.2}
                    opacity={0.8}
                    style={{ filter: "drop-shadow(0 0 4px #ef4444)" }}
                  >
                    <animate
                      attributeName="r"
                      from={Math.max(sym.width, sym.height) * 0.5}
                      to={Math.max(sym.width, sym.height) * 2.0}
                      dur="1.5s"
                      repeatCount="3"
                    />
                    <animate
                      attributeName="opacity"
                      from="0.8"
                      to="0"
                      dur="1.5s"
                      repeatCount="3"
                    />
                  </circle>
                )}
                {heatColor && (
                  <rect
                    x={-0.2}
                    y={-0.2}
                    width={sym.width + 0.4}
                    height={sym.height + 0.4}
                    fill={heatColor}
                    style={{ filter: "blur(6px)" }}
                    opacity={0.6}
                  />
                )}
                {n.symbol === "led" &&
                  isSimulating &&
                  (() => {
                    const i = Math.abs(getElementCurrent(getComponentRef(n)));
                    // Lower threshold for visible glow (0.01mA)
                    const brightness = i < 0.00001 ? 0 : Math.min(1, i * 100);
                    if (brightness < 0.02) return null;
                    const glowSize = 0.7 + brightness * 1.5;
                    return (
                      <g>
                        {/* Outermost massive high-blur halo */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={glowSize * 2.2}
                          fill="#ff1e56"
                          style={{ filter: "blur(14px)" }}
                          opacity={brightness * 0.65}
                        />
                        {/* Middle core glow */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={glowSize * 1.3}
                          fill="#ff0000"
                          style={{ filter: "blur(5px)" }}
                          opacity={brightness * 0.85}
                        />
                        {/* Intense core hotspot inside dome */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={0.6}
                          fill="#ff6b6b"
                          style={{ filter: "blur(1.5px)" }}
                          opacity={brightness * 0.95}
                        />
                        {/* Intense emitter junction */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={0.3}
                          fill="#ffb3b3"
                          opacity={brightness}
                        />
                      </g>
                    );
                  })()}
                <rect
                  x={cx - (cx + 0.2) * nodeScale}
                  y={cy - (cy + 0.2) * nodeScale}
                  width={(sym.width + 0.4) * nodeScale}
                  height={(sym.height + 0.4) * nodeScale}
                  fill="rgba(0,0,0,0.001)"
                />
                <g
                  transform={`rotate(${n.rotation} ${cx} ${cy}) translate(${cx} ${cy}) scale(${nodeScale}) translate(${-cx} ${-cy})`}
                >
                  <motion.g
                    animate={
                      n.symbol === "capacitor" && isSimulating
                        ? { scale: [1, 1.08, 1] }
                        : { scale: 1 }
                    }
                    transition={
                      n.symbol === "capacitor" && isSimulating
                        ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
                        : undefined
                    }
                    style={{ transformOrigin: `${cx}px ${cy}px` }}
                  >
                    {realistic ? (
                    <RealisticComponent
                      node={n}
                      width={sym.width}
                      height={sym.height}
                      isSimulating={isSimulating}
                      isGlowing={
                        isSimulating &&
                        (n.symbol === "led" || n.symbol === "switch" || n.symbol === "push_button") &&
                        (() => {
                           const ref = getComponentRef(n);
                           if (!ref) return false;
                           const current = getElementCurrent(ref);
                           return Math.abs(current) > 1e-5;
                        })()
                      }
                      glowColor={
                        n.color === "green"
                          ? "#22c55e"
                          : n.color === "blue"
                            ? "#3b82f6"
                            : n.color === "yellow"
                              ? "#eab308"
                              : n.color === "white"
                                ? "#ef4444"
                                : "#ef4444"
                      }
                      lang={lang}
                      liveValue={liveValueStr}
                    />
                  ) : (() => {
                    let componentColor = hasNetPin ? "#2563eb" : nodeColor;
                    let gradientDef = null;

                    if (isSimulating && !realistic && sym.pins.length > 0 && !hasNetPin) {
                      const pinVoltages = sym.pins.map((pin, i) => {
                        const netId = netIndex.pinNet.get(`${n.id}:${i}`);
                        return netId !== undefined ? getNetVoltage(netId) : 0;
                      });

                      if (sym.pins.length === 2) {
                        const c1 = pinVoltages[0] > 0.001 ? "#4ade80" : "#94a3b8";
                        const c2 = pinVoltages[1] > 0.001 ? "#4ade80" : "#94a3b8";
                        
                        if (c1 !== c2) {
                          const gradId = `grad-${n.id}`;
                          componentColor = `url(#${gradId})`;
                          gradientDef = (
                            <defs>
                              <linearGradient id={gradId} x1={sym.pins[0].x} y1={sym.pins[0].y} x2={sym.pins[1].x} y2={sym.pins[1].y} gradientUnits="userSpaceOnUse">
                                <stop offset="20%" stopColor={c1} />
                                <stop offset="80%" stopColor={c2} />
                              </linearGradient>
                            </defs>
                          );
                        } else {
                          componentColor = c1;
                        }
                      } else {
                        const allPositive = pinVoltages.every(v => v > 0.001);
                        const allNegative = pinVoltages.every(v => v <= 0.001);
                        if (allPositive) componentColor = "#4ade80";
                        else if (allNegative) componentColor = "#94a3b8";
                      }
                    }
                    
                    return (
                      <>
                        {gradientDef}
                        {n.symbol === "text" ? (
                          <text textAnchor="middle" dominantBaseline="middle" fill={componentColor} fontSize={0.6} fontWeight="bold">
                            {n.value || ""}
                          </text>
                        ) : (
                          sym.draw(componentColor)
                        )}
                      </>
                    );
                  })()}
                  <ComponentStateAnimation
                    node={n}
                    stats={stats}
                    isSimulating={isSimulating}
                    currentTime={currentTime}
                    doc={doc}
                  />
                  {isSimulating && stats && sym.pins.length === 2 && view.scale > 0.6 && (() => {
                    const absI = Math.abs(stats.current);
                    if (absI < 1e-6) return null;
                    const path = `M ${sym.pins[0].x} ${sym.pins[0].y} L ${sym.pins[1].x} ${sym.pins[1].y}`;
                    return <CurrentFlow path={path} current={stats.current} zoom={view.scale} />;
                  })()}
                  {!n.symbol.startsWith("kicad:") && !sym.id.startsWith("kicad:") && sym.pins.map((_, i) => renderPinLabel(n, i, nodeColor))}
                  {n.reference && (() => {
                    const refWidth = Math.max(1.0, n.reference.length * 0.45 + 0.4);
                    return (
                      <g style={{ pointerEvents: "none" }}>
                        {/* Purple Highlight Badge for Name */}
                        {isSimulating && (
                          <rect
                            x={cx - refWidth / 2}
                            y={-1.3}
                            width={refWidth}
                            height={0.8}
                            rx={0.15}
                            fill="#f3e8ff"
                            stroke="#c084fc"
                            strokeWidth={0.04}
                            className="dark:fill-[#2e1065] dark:stroke-[#a855f7]"
                          />
                        )}
                        <text
                          x={cx}
                          y={-0.7}
                          fontSize={0.65}
                          textAnchor="middle"
                          fill={isSimulating ? "#7e22ce" : nodeColor}
                          className={isSimulating ? "dark:fill-[#e9d5ff]" : ""}
                          fontWeight="700"
                        >
                          {n.reference}
                        </text>
                      </g>
                    );
                  })()}
                  {(() => {
                    const valText = n.label || liveValueStr || n.value;
                    if (!valText) return null;
                    const valWidth = Math.max(1.2, valText.length * 0.45 + 0.4);
                    return (
                      <g style={{ pointerEvents: "none" }}>
                        {/* Light Green Highlight Badge for Value */}
                        {isSimulating && (
                          <rect
                            x={cx - valWidth / 2}
                            y={sym.height + 0.4}
                            width={valWidth}
                            height={0.8}
                            rx={0.15}
                            fill="#f0fdf4"
                            stroke="#86efac"
                            strokeWidth={0.04}
                            className="dark:fill-[#022c22] dark:stroke-[#34d399]"
                          />
                        )}
                        <text
                          x={cx}
                          y={sym.height + 1.0}
                          fontSize={0.65}
                          textAnchor="middle"
                          fill={isSimulating ? "#16a34a" : nodeColor}
                          className={isSimulating ? "dark:fill-[#a7f3d0]" : ""}
                          fontWeight="700"
                        >
                          {valText}
                        </text>
                      </g>
                    );
                  })()}
                  {isSel && (
                    <rect
                      x={-0.3}
                      y={-0.3}
                      width={sym.width + 0.6}
                      height={sym.height + 0.6}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth={0.08 / nodeScale}
                      strokeDasharray={`${0.3 / nodeScale},${0.2 / nodeScale}`}
                      pointerEvents="none"
                    />
                  )}
                  </motion.g>
                </g>
                {transformedPins(sym, n.rotation, nodeScale).map((p, i) => {
                  if (sym.pins[i].hide) return null;
                  const pNet = netIndex.pinNet.get(`${n.id}:${i}`);
                  const inNet = highlightedNetIds
                    ? pNet !== undefined && highlightedNetIds.includes(pNet)
                    : highlightedNet != null && pNet === highlightedNet;
                  const isSelected =
                    selectedPin?.nodeId === n.id && selectedPin?.pinIndex === i;
                  const isFloating = floatingPins.some(
                    (fp) => fp.nodeId === n.id && fp.pinIndex === i,
                  );

                  return (
                    <g key={i}>
                      <circle
                        cx={p.x}
                        cy={p.y}
                        r={isSelected ? 0.22 : inNet ? 0.18 : 0.12}
                        fill={
                          isSelected ? "#dc2626" : inNet ? "#2563eb" : nodeColor
                        }
                        stroke={
                          isSelected ? "#fca5a5" : inNet ? "#93c5fd" : "none"
                        }
                        strokeWidth={0.06}
                        style={{ cursor: "pointer", pointerEvents: "auto" }}
                        onPointerDown={(e) => {
                          if (tool !== "select") return;
                          e.stopPropagation();
                          if (setSelectedPin)
                            setSelectedPin({ nodeId: n.id, pinIndex: i });
                          setSelectedIds([]);
                          setSelectedWireIds([]);
                          if (setSelectedTrackId) setSelectedTrackId(null);
                        }}
                      />
                      {isFloating && <FloatingNodeIndicator x={p.x} y={p.y} />}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {tool === "wire" && hoverPin && (
            <g pointerEvents="none">
              <circle
                cx={hoverPin.x}
                cy={hoverPin.y}
                r={0.35}
                fill="none"
                stroke="#16a34a"
                strokeWidth={0.08}
              />
              <circle cx={hoverPin.x} cy={hoverPin.y} r={0.15} fill="#16a34a" />
            </g>
          )}
          {tool === "wire" && pendingWire && (
            <g pointerEvents="none">
              <circle
                cx={pendingWire.x}
                cy={pendingWire.y}
                r={0.5}
                fill="none"
                stroke="#2563eb"
                strokeWidth={0.08}
                strokeDasharray="0.2,0.15"
              >
                <animate
                  attributeName="r"
                  values="0.4;0.6;0.4"
                  dur="1.4s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                cx={pendingWire.x}
                cy={pendingWire.y}
                r={0.18}
                fill="#2563eb"
              />
            </g>
          )}

          {ghostOverlay}
          {probeData && (
            <g
              transform={`translate(${probeData.x} ${probeData.y})`}
              pointerEvents="none"
            >
              <rect
                x={0.2}
                y={-0.6}
                width={4.2}
                height={
                  probeData.history
                    ? probeData.val.includes("\n")
                      ? 3.4
                      : 2.8
                    : probeData.val.includes("\n")
                      ? 1.6
                      : 1.0
                }
                rx={0.15}
                fill="#0f172a"
                opacity={0.95}
                stroke="#1e293b"
                strokeWidth={0.05}
              />
              <text
                x={0.4}
                y={-0.2}
                fontSize={0.3}
                fill="#94a3b8"
                fontWeight="bold"
              >
                {probeData.type}
              </text>
              {probeData.val.split("\n").map((line, idx) => (
                <text
                  key={idx}
                  x={0.4}
                  y={0.25 + idx * 0.45}
                  fontSize={0.38}
                  fill="#10b981"
                  fontWeight="black"
                  fontFamily="ui-monospace"
                >
                  {line}
                </text>
              ))}
              {probeData.history && (
                <g transform={`translate(0, ${probeData.val.includes("\n") ? 0.6 : 0.2})`}>
                  <MiniOscilloscope
                    values={probeData.history}
                    currentTime={currentTime}
                    width={3.8}
                    height={1.2}
                  />
                </g>
              )}
            </g>
          )}
          {gesture.current.type === "selection" && (() => {
            const g = gesture.current;
            const x1 = Math.min(g.startX!, g.currentX!);
            const y1 = Math.min(g.startY!, g.currentY!);
            const x2 = Math.max(g.startX!, g.currentX!);
            const y2 = Math.max(g.startY!, g.currentY!);
            
            const w1 = screenToWorld(x1, y1);
            const w2 = screenToWorld(x2, y2);
            
            return (
              <rect
                x={w1.x}
                y={w1.y}
                width={w2.x - w1.x}
                height={w2.y - w1.y}
                fill="#2563eb"
                fillOpacity={0.15}
                stroke="#2563eb"
                strokeWidth={0.05}
                strokeDasharray="0.2,0.1"
                pointerEvents="none"
              />
            );
          })()}
        </g>

        {dragOverlay}
        {alignmentOverlay}
        {placement && (
          <g pointerEvents="none">
            <rect
              x={size.w / 2 - 130}
              y={8}
              width={260}
              height={26}
              rx={6}
              fill="#2563eb"
              opacity={0.92}
            />
            <text
              x={size.w / 2}
              y={26}
              fontSize={12}
              textAnchor="middle"
              fill="#fff"
              fontFamily="system-ui"
            >
              Tap to place · R to rotate · Esc to cancel
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
