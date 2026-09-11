import React, { useEffect, useMemo, useRef, useState, useCallback, useDeferredValue } from "react";
import {
  Check, MousePointer2, Hand, Minus, Circle as CircleIcon, Square as SquareIcon, Ruler,
  Eye, EyeOff, Trash2, Plus, Minus as MinusIcon, Maximize2, Minimize2, ChevronDown, X, Network,
  Layers as LayersIcon, Settings2, Zap, ArrowLeftRight, AlertTriangle, ShieldCheck, Box, RotateCw, Palette,
  Type, Magnet, Download, HelpCircle, Activity, Cpu, SlidersHorizontal,
  SquareDashed, MousePointerSquareDashed, Undo2, Redo2, CopyPlus, Sparkles,
  LayoutGrid, Disc2, Library as LibraryIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";
import { DesignIssue, isKiCadPcbBoard } from "@/lib/designRules";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PcbDoc, PcbUnit, PcbTrack, PcbVia, PcbPad, PcbZone, PcbMeasure, PcbLayerId, PcbFootprint,
  emptyPcbDoc, toDisplay, fromDisplay, fmt, checkIfPolarizedCapacitor, isCopperLayer,
} from "@/lib/pcb";
import { computeRatsnest, footprintBBox, getRatsnestPads, makePadsForSymbol } from "@/lib/pcbSync";
import { buildNetIndex } from "@/lib/netlist";
import { getPackagesForSymbol } from "@/lib/electronicsLibrary";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";
import { ThreeDPreview } from "./ThreeDPreview";
import { getElectrolyticSize } from "@/lib/electrolytic";
import { MemoizedPcbTrack, MemoizedPcbVia, MemoizedPcbPad, MemoizedPcbZone, MemoizedPcbMeasure, MemoizedPcbText, MemoizedPcbFootprint, MemoizedPcbGraphic, MemoizedPcbDimension, MemoizedPcbTarget } from "./PcbElements";
import { getZoneBoundingBox } from "@/lib/zoneGeometry";
import { PcbCanvasLayer } from "./PcbCanvasLayer";
import { useStableCallback } from "@/hooks/useStableCallback";
import { FootprintBrowser, buildGeneratorModel } from "./FootprintBrowser";
import { KicadFootprintRenderer, nativeFootprintBounds } from "./KicadFootprintRenderer";
import { footprintToPcbFootprint, detectKicadFootprintRefPrefix, registerKicadFootprint } from "@/lib/kicad/footprint";

const TOUCH_LIFT_PX = 57; // ~1.5cm offset at 96dpi so footprints rise above finger during drag

const ThickCircleIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.5"
    {...props}
  >
    <circle cx="12" cy="12" r="7.5" />
  </svg>
);

interface BoardNumberInputProps {
  label: string;
  value: number; // value in mm
  unit: PcbUnit;
  onChange: (mmVal: number) => void;
  step?: string;
  className?: string;
}

export function BoardNumberInput({ label, value, unit, onChange, step = "0.1", className }: BoardNumberInputProps) {
  const displayVal = toDisplay(value, unit);
  const [localVal, setLocalVal] = useState("");
  const isFocused = useRef(false);

  useEffect(() => {
    if (!isFocused.current) {
      setLocalVal(displayVal.toFixed(3).replace(/\.?0+$/, ""));
    }
  }, [value, unit, displayVal]);

  const handleChange = (valStr: string) => {
    const filtered = valStr.replace(/[^0-9.]/g, "");
    setLocalVal(filtered);
    const parsed = parseFloat(filtered);
    if (!isNaN(parsed) && parsed > 0 && isFinite(parsed)) {
      onChange(fromDisplay(parsed, unit));
    }
  };

  const handleBlur = () => {
    isFocused.current = false;
    const parsed = parseFloat(localVal);
    if (!isNaN(parsed) && parsed > 0 && isFinite(parsed)) {
      onChange(fromDisplay(parsed, unit));
      setLocalVal(toDisplay(fromDisplay(parsed, unit), unit).toFixed(3).replace(/\.?0+$/, ""));
    } else {
      setLocalVal(displayVal.toFixed(3).replace(/\.?0+$/, ""));
    }
  };

  return (
    <div className={className}>
      <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5 block">
        {label}
      </Label>
      <div className="relative group">
        <Input
          type="text"
          className="h-9 pr-9 font-mono text-xs focus-visible:ring-1 transition-shadow bg-background/50"
          value={localVal}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { isFocused.current = true; }}
          onBlur={handleBlur}
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground pointer-events-none opacity-40 group-hover:opacity-100 transition-opacity uppercase">
          {unit}
        </div>
      </div>
    </div>
  );
}

type PcbTool = "select" | "pan" | "track" | "via" | "pad" | "measure" | "text" | "group_select";
type PcbSelection =
  | { kind: "track" | "via" | "pad" | "measure" | "footprint" | "text"; id: string }
  | { kind: "net"; id: number };

export function computeTrackNets(schematic: import("@/lib/schematic").SchematicDoc, pcb: PcbDoc) {
  const trackNetMap = new Map<string, number>();
  if (pcb?.isImportedGerber || (pcb?.tracks && pcb.tracks.length > 800)) {
    return trackNetMap;
  }
  const netIndex = buildNetIndex(schematic);
  if (!netIndex.nets || netIndex.nets.length === 0) return trackNetMap;
  const padPos = getRatsnestPads(pcb);

  // Prefer the synchronized PCB net annotation when present. It is refreshed by
  // Schematic→PCB synchronization and avoids recomputing the same connectivity
  // graph on every render. Fall back to geometric inference for legacy documents.
  const copperTracks = (pcb.tracks ?? []).filter(t => isCopperLayer(t.layer));
  const hasStoredNetData = copperTracks.length > 0 && copperTracks.every(t => t.netId !== undefined);
  for (const track of copperTracks) {
    if (track.netId !== undefined) trackNetMap.set(track.id, track.netId);
  }
  if (hasStoredNetData) return trackNetMap;

  for (const net of netIndex.nets) {
    const netPads: { x: number; y: number }[] = [];
    for (const p of net.pins) {
      const pos = padPos.get(`${p.nodeId}:${p.pinIndex}`);
      if (pos) {
        netPads.push({ x: pos.x, y: pos.y });
      }
    }
    if (netPads.length === 0) continue;

    const addedTracks = new Set<string>();
    const searchPoints = [...netPads];
    let foundNew = true;

    while (foundNew) {
      foundNew = false;
      for (const track of pcb.tracks) {
        if (!isCopperLayer(track.layer)) continue;
        if (addedTracks.has(track.id)) continue;
        const tStart = track.points[0];
        const tEnd = track.points[track.points.length - 1];
        if (!tStart || !tEnd) continue;

        const touches = searchPoints.some(pt => 
          Math.hypot(pt.x - tStart.x, pt.y - tStart.y) < 0.4 ||
          Math.hypot(pt.x - tEnd.x, pt.y - tEnd.y) < 0.4
        );

        if (touches) {
          addedTracks.add(track.id);
          searchPoints.push(tStart, tEnd);
          trackNetMap.set(track.id, net.id);
          foundNew = true;
        }
      }
    }
  }

  return trackNetMap;
}

export function distToSegment(p: { x: number; y: number }, v: { x: number; y: number }, w: { x: number; y: number }) {
  const l2 = (w.x - v.x) ** 2 + (w.y - v.y) ** 2;
  if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
}

export function findTrackAtPoint(
  tracks: PcbTrack[],
  x: number,
  y: number,
  tolerance = 1.8,
  activeLayer?: string
): PcbTrack | null {
  let bestTrack: PcbTrack | null = null;
  let minDistance = Infinity;

  for (let i = 0; i < tracks.length; i++) {
    const tr = tracks[i];
    if (!tr.points || tr.points.length < 2) continue;

    const halfWidth = (tr.width || 0.4) / 2;
    const maxAllowedDist = Math.max(halfWidth + tolerance, 1.2);

    for (let j = 0; j < tr.points.length - 1; j++) {
      const p1 = tr.points[j];
      const p2 = tr.points[j + 1];
      if (!p1 || !p2 || typeof p1.x !== "number" || typeof p1.y !== "number" || typeof p2.x !== "number" || typeof p2.y !== "number") continue;

      const d = distToSegment({ x, y }, p1, p2);
      if (d <= maxAllowedDist) {
        const layerBonus = activeLayer && tr.layer === activeLayer ? -0.3 : 0;
        const effectiveDist = d + layerBonus;

        if (effectiveDist < minDistance) {
          minDistance = effectiveDist;
          bestTrack = tr;
        }
      }
    }
  }

  return bestTrack;
}

export function findViaAtPoint(
  vias: PcbVia[],
  x: number,
  y: number,
  tolerance = 0.5
): PcbVia | null {
  let bestVia: PcbVia | null = null;
  let minDist = Infinity;

  for (let i = 0; i < vias.length; i++) {
    const v = vias[i];
    const maxR = v.diameter / 2 + tolerance;
    const d = Math.hypot(x - v.x, y - v.y);
    if (d <= maxR && d < minDist) {
      minDist = d;
      bestVia = v;
    }
  }

  return bestVia;
}

export function findPadAtPoint(
  pads: PcbPad[],
  x: number,
  y: number,
  tolerance = 0.5
): PcbPad | null {
  let bestPad: PcbPad | null = null;
  let minDist = Infinity;

  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    const maxR = Math.max(p.width, p.height) / 2 + tolerance;
    const d = Math.hypot(x - p.x, y - p.y);
    if (d <= maxR && d < minDist) {
      minDist = d;
      bestPad = p;
    }
  }

  return bestPad;
}

export function get45Route(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);
  if (absDx > absDy) {
    const diagLen = absDy;
    const diagDx = diagLen * Math.sign(dx);
    const diagDy = diagLen * Math.sign(dy);
    const midPoint = { x: p1.x + (dx - diagDx), y: p1.y };
    return [p1, midPoint, p2];
  } else {
    const diagLen = absDx;
    const diagDx = diagLen * Math.sign(dx);
    const diagDy = diagLen * Math.sign(dy);
    const midPoint = { x: p1.x, y: p1.y + (dy - diagDy) };
    return [p1, midPoint, p2];
  }
}

export function get90Route(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  if (Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y)) {
    return [p1, { x: p2.x, y: p1.y }, p2];
  } else {
    return [p1, { x: p1.x, y: p2.y }, p2];
  }
}

export function getCurvedRoute(p1: { x: number; y: number }, p2: { x: number; y: number }) {
  const cx = Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y) ? p2.x : p1.x;
  const cy = Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y) ? p1.y : p2.y;
  
  const pts = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cx + t * t * p2.x;
    const y = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cy + t * t * p2.y;
    pts.push({ x, y });
  }
  return pts;
}

export function getDistanceToSegment(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: Math.hypot(p.x - a.x, p.y - a.y), x: a.x, y: a.y };
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return { dist: Math.hypot(p.x - projX, p.y - projY), x: projX, y: projY };
}

interface Props {
  schematic: import("@/lib/schematic").SchematicDoc;
  pcb: PcbDoc | undefined;
  setPcb: (updater: (p: PcbDoc) => PcbDoc, noHistory?: boolean) => void;
  commitHistory: () => void;
  onBackgroundClick?: () => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedWireId: string | null;
  setSelectedWireId: (id: string | null) => void;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  selectedPin: { nodeId: string; pinIndex: number } | null;
  setSelectedPin: (pin: { nodeId: string; pinIndex: number } | null) => void;
  highlightedNetIds: number[];
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  hasEcoChanges?: boolean;
  setEcoOpen?: (open: boolean) => void;
  drc?: DesignIssue[];
  setMode: (mode: 'schematic' | 'realistic' | 'pcb') => void;
}

function detectKicadRefPrefix(name: string, library?: string, properties?: Record<string, string>): string {
  return detectKicadFootprintRefPrefix(name, library, properties);
}

function _unused_old_detectKicadRefPrefix(name: string, library?: string): string {
  const libLower = (library || "").toLowerCase();
  const lower = (name || "").toLowerCase();
  const combined = `${libLower} ${lower}`;

  // 1. Resistors & Potentiometers
  if (
    libLower.includes("resistor") ||
    libLower.includes("potentiometer") ||
    libLower.includes("trimmer") ||
    lower.startsWith("r_") ||
    lower.startsWith("res_") ||
    lower.includes("resistor") ||
    lower === "r" ||
    lower.includes("_r_") ||
    /^r\d+/i.test(lower)
  ) {
    if (combined.includes("potentiometer") || combined.includes("trimmer") || combined.includes("varistor")) {
      return "RV";
    }
    return "R";
  }

  // 2. Capacitors
  if (
    libLower.includes("capacitor") ||
    lower.startsWith("c_") ||
    lower.startsWith("cp_") ||
    lower.startsWith("cap_") ||
    lower.startsWith("cpol_") ||
    lower.includes("capacitor") ||
    lower === "c" ||
    lower.includes("_c_") ||
    lower.includes("c_axial") ||
    lower.includes("c_radial") ||
    lower.includes("c_disc") ||
    lower.includes("c_rect") ||
    lower.includes("c_elec") ||
    lower.includes("tantal") ||
    /^c\d+/i.test(lower)
  ) {
    return "C";
  }

  // 3. Diodes, LEDs, Rectifiers
  if (
    libLower.includes("diode") ||
    libLower.includes("led") ||
    libLower.includes("rectifier") ||
    lower.startsWith("d_") ||
    lower.startsWith("led_") ||
    lower.startsWith("diode_") ||
    lower.includes("diode") ||
    lower.includes("led_") ||
    lower.includes("sod-") ||
    lower.includes("sod123") ||
    lower.includes("sod323") ||
    lower.includes("sod523") ||
    lower.includes("do-214") ||
    lower.includes("do-41") ||
    lower.includes("sma_") ||
    lower.includes("smb_") ||
    lower.includes("smc_") ||
    lower === "d" ||
    lower === "led" ||
    lower.includes("bridge_") ||
    /^d\d+/i.test(lower) ||
    /^led\d+/i.test(lower)
  ) {
    return "D";
  }

  // 4. Inductors, Chokes, Ferrite beads
  if (
    libLower.includes("inductor") ||
    libLower.includes("choke") ||
    libLower.includes("ferrite") ||
    lower.startsWith("l_") ||
    lower.startsWith("ind_") ||
    lower.startsWith("inductor_") ||
    lower.includes("inductor") ||
    lower.includes("choke") ||
    lower.includes("ferrite") ||
    lower === "l" ||
    lower.includes("_l_") ||
    /^l\d+/i.test(lower)
  ) {
    return "L";
  }

  // 5. Transistors, FETs, MOSFETs, Regulators (SOT, TO packages)
  if (
    libLower.includes("transistor") ||
    libLower.includes("to_sot") ||
    libLower.includes("package_to") ||
    lower.startsWith("q_") ||
    lower.startsWith("transistor_") ||
    lower.includes("transistor") ||
    lower.includes("mosfet") ||
    lower.includes("bjt") ||
    lower.includes("igbt") ||
    lower.startsWith("sot-23") ||
    lower.startsWith("sot23") ||
    lower.startsWith("sot-89") ||
    lower.startsWith("sot-223") ||
    lower.startsWith("to-92") ||
    lower.startsWith("to92") ||
    lower.startsWith("to-220") ||
    lower.startsWith("to220") ||
    lower.startsWith("to-247") ||
    lower.startsWith("to-252") ||
    lower.startsWith("dpack") ||
    lower.startsWith("d2pack") ||
    lower === "q" ||
    /^q\d+/i.test(lower)
  ) {
    return "Q";
  }

  // 6. Connectors, Headers, Terminal blocks, Sockets
  if (
    libLower.includes("connector") ||
    libLower.includes("terminal") ||
    libLower.includes("pinheader") ||
    libLower.includes("pinsocket") ||
    libLower.includes("socket") ||
    lower.startsWith("j_") ||
    lower.startsWith("conn_") ||
    lower.startsWith("connector_") ||
    lower.startsWith("pinheader_") ||
    lower.startsWith("pinsocket_") ||
    lower.startsWith("terminalblock_") ||
    lower.includes("header") ||
    lower.includes("socket") ||
    lower.includes("terminal") ||
    lower.includes("usb_") ||
    lower.includes("rj45") ||
    lower.includes("jack_") ||
    lower.includes("molex") ||
    lower.includes("jst_") ||
    lower === "j" ||
    /^j\d+/i.test(lower)
  ) {
    return "J";
  }

  // 7. Switches, Push Buttons, Relays
  if (
    libLower.includes("button") ||
    libLower.includes("switch") ||
    libLower.includes("relay") ||
    lower.startsWith("sw_") ||
    lower.startsWith("btn_") ||
    lower.startsWith("button_") ||
    lower.startsWith("switch_") ||
    lower.includes("switch") ||
    lower.includes("pushbutton") ||
    lower.includes("relay") ||
    lower === "sw" ||
    /^sw\d+/i.test(lower)
  ) {
    return libLower.includes("relay") || lower.includes("relay") ? "K" : "SW";
  }

  // 8. Crystals & Oscillators
  if (
    libLower.includes("crystal") ||
    libLower.includes("oscillator") ||
    libLower.includes("resonator") ||
    lower.startsWith("y_") ||
    lower.startsWith("x_") ||
    lower.startsWith("xtal_") ||
    lower.startsWith("crystal_") ||
    lower.startsWith("oscillator_") ||
    lower.includes("crystal") ||
    lower.includes("oscillator") ||
    lower.includes("resonator") ||
    lower.includes("hc-49") ||
    lower === "y" ||
    lower === "x" ||
    /^y\d+/i.test(lower)
  ) {
    return "Y";
  }

  // 9. Fuses & Protection devices
  if (
    libLower.includes("fuse") ||
    libLower.includes("varistor") ||
    libLower.includes("ptc") ||
    lower.startsWith("f_") ||
    lower.startsWith("fuse_") ||
    lower.includes("fuse") ||
    lower.includes("polyfuse") ||
    lower === "f" ||
    /^f\d+/i.test(lower)
  ) {
    return "F";
  }

  // 10. Transformers
  if (
    libLower.includes("transformer") ||
    lower.startsWith("t_") ||
    lower.startsWith("transformer_") ||
    lower.includes("transformer") ||
    lower === "t" ||
    /^t\d+/i.test(lower)
  ) {
    return "T";
  }

  // 11. Test Points
  if (
    libLower.includes("testpoint") ||
    lower.startsWith("tp_") ||
    lower.startsWith("testpoint_") ||
    lower.includes("testpoint") ||
    lower.includes("test_point") ||
    lower === "tp" ||
    /^tp\d+/i.test(lower)
  ) {
    return "TP";
  }

  // 12. Mounting Holes & Mechanical
  if (
    libLower.includes("mounting_hole") ||
    libLower.includes("mountinghole") ||
    lower.startsWith("mountinghole_") ||
    lower.includes("mountinghole") ||
    lower.includes("mounting_hole") ||
    lower.startsWith("h_") ||
    lower === "h" ||
    /^h\d+/i.test(lower)
  ) {
    return "H";
  }

  // 13. Batteries
  if (
    libLower.includes("battery") ||
    lower.startsWith("bt_") ||
    lower.startsWith("battery_") ||
    lower.includes("battery") ||
    lower === "bt" ||
    /^bt\d+/i.test(lower)
  ) {
    return "BT";
  }

  // 14. Heatsinks
  if (
    libLower.includes("heatsink") ||
    lower.startsWith("hs_") ||
    lower.startsWith("heatsink_") ||
    lower.includes("heatsink") ||
    lower === "hs" ||
    /^hs\d+/i.test(lower)
  ) {
    return "HS";
  }

  // Default fallback for ICs, microcontrollers, and general modules
  return "U";
}

export function PcbEditor(props: Props) {
  const {
    schematic, pcb, setPcb, commitHistory, onBackgroundClick,
    selectedId, setSelectedId,
    selectedWireId, setSelectedWireId,
    selectedTrackId, setSelectedTrackId,
    selectedPin, setSelectedPin,
    highlightedNetIds,
    onUndo, onRedo, canUndo, canRedo,
    hasEcoChanges, setEcoOpen,
    setMode,
    drc = [],
  } = props;
  const [uiLayersOpen, setUiLayersOpen] = useState(false);
  const [uiFootprintGenOpen, setUiFootprintGenOpen] = useState(false);
  const [uiFootprintBrowserOpen, setUiFootprintBrowserOpen] = useState(false);
  const [drcOpen, setDrcOpen] = useState(false);
  useEffect(() => {
    if (!pcb) { setPcb(() => emptyPcbDoc(), true); return; }
    const needs =
      !pcb.footprints || !pcb.layers || !pcb.tracks || !pcb.vias ||
      !pcb.pads || !pcb.measures || pcb.ratsnestVisible === undefined;
    if (needs) {
      const base = emptyPcbDoc();
      setPcb((d) => ({
        ...base, ...d,
        layers: d.layers ?? base.layers,
        tracks: d.tracks ?? [],
        vias: d.vias ?? [],
        pads: d.pads ?? [],
        measures: d.measures ?? [],
        footprints: d.footprints ?? [],
        ratsnestVisible: d.ratsnestVisible ?? true,
      }), true);
    }
  }, [pcb?.footprints, pcb?.layers, pcb?.tracks, pcb?.vias, pcb?.pads, pcb?.measures, pcb?.ratsnestVisible, setPcb]);

  if (!pcb || !pcb.footprints || !pcb.layers) {
    return <div className="h-full grid place-items-center text-sm text-muted-foreground">…</div>;
  }

  return (
    <PcbEditorInner
      schematic={schematic} pcb={pcb} setPcb={setPcb} commitHistory={commitHistory}
      onBackgroundClick={onBackgroundClick}
      selectedId={selectedId} setSelectedId={setSelectedId}
      selectedWireId={selectedWireId} setSelectedWireId={setSelectedWireId}
      selectedTrackId={selectedTrackId} setSelectedTrackId={setSelectedTrackId}
      selectedPin={selectedPin} setSelectedPin={setSelectedPin}
      highlightedNetIds={highlightedNetIds}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      hasEcoChanges={hasEcoChanges}
      setEcoOpen={setEcoOpen}
      setMode={setMode}
      setUiFootprintGenOpen={setUiFootprintGenOpen}
      setUiFootprintBrowserOpen={setUiFootprintBrowserOpen}
      setUiLayersOpen={setUiLayersOpen}
      uiFootprintGenOpen={uiFootprintGenOpen}
      uiFootprintBrowserOpen={uiFootprintBrowserOpen}
      uiLayersOpen={uiLayersOpen}
      drcOpen={drcOpen}
      setDrcOpen={setDrcOpen}
    />
  );
}

const getTranslatedLayerName = (name: string, lang: string) => {
  if (lang !== "ar") return name;
  switch (name) {
    case "Board Outline": return "حدود اللوحة";
    case "Top Copper": return "النحاس العلوي";
    case "Bottom Copper": return "النحاس السفلي";
    case "Silkscreen": return "الطباعة الحريرية";
    case "Top Silkscreen": return "الطباعة الحريرية العلوية";
    case "Bottom Silkscreen": return "الطباعة الحريرية السفلية";
    case "Solder Mask": return "قناع اللحام";
    case "Top Solder Mask": return "قناع اللحام العلوي";
    case "Bottom Solder Mask": return "قناع اللحام السفلي";
    case "Drill": return "الثقوب";
    default: return name;
  }
};

function PcbEditorInner({
  schematic, pcb, setPcb, commitHistory, onBackgroundClick,
  selectedId, setSelectedId,
  selectedWireId, setSelectedWireId,
  selectedTrackId, setSelectedTrackId,
  selectedPin, setSelectedPin,
  highlightedNetIds,
  onUndo, onRedo, canUndo, canRedo,
  hasEcoChanges, setEcoOpen, setMode, setUiFootprintGenOpen, setUiFootprintBrowserOpen, setUiLayersOpen, uiFootprintGenOpen, uiFootprintBrowserOpen, uiLayersOpen,
  drcOpen, setDrcOpen,
}: {
  schematic: import("@/lib/schematic").SchematicDoc;
  pcb: PcbDoc;
  setPcb: (u: (p: PcbDoc) => PcbDoc, noHistory?: boolean) => void;
  commitHistory: () => void;
  onBackgroundClick?: () => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selectedWireId: string | null;
  setSelectedWireId: (id: string | null) => void;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  selectedPin: { nodeId: string; pinIndex: number } | null;
  setSelectedPin: (pin: { nodeId: string; pinIndex: number } | null) => void;
  highlightedNetIds: number[];
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  hasEcoChanges?: boolean;
  setEcoOpen?: (open: boolean) => void;
  setMode: (mode: 'schematic' | 'realistic' | 'pcb') => void;
  setUiFootprintGenOpen: (open: boolean) => void;
  setUiFootprintBrowserOpen: (open: boolean) => void;
  setUiLayersOpen: (open: boolean) => void;
  uiFootprintGenOpen: boolean;
  uiFootprintBrowserOpen: boolean;
  uiLayersOpen: boolean;
  drcOpen: boolean;
  setDrcOpen: (open: boolean) => void;
}) {
  const { t, lang } = useI18n();
  const { theme, setTheme } = useTheme();
  const unit = pcb.unit;
  const deferredPcb = useDeferredValue(pcb);
  const deferredSchematic = useDeferredValue(schematic);
  const schematicNetIndex = useMemo(() => buildNetIndex(deferredSchematic), [deferredSchematic]);
  const svgRef = useRef<SVGSVGElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [containerDim, setContainerDim] = useState({ width: 1200, height: 800 });

  useEffect(() => {
    if (!viewportRef.current) return;
    const updateSize = () => {
      if (viewportRef.current) {
        setContainerDim({
          width: viewportRef.current.clientWidth || 1200,
          height: viewportRef.current.clientHeight || 800,
        });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(viewportRef.current);
    return () => ro.disconnect();
  }, []);
  const rafId = useRef<number | null>(null);
  const pendingPan = useRef<{x:number, y:number} | null>(null);
  const pendingZoom = useRef<number | null>(null);
  const dragFrameRequested = useRef(false);
  const mousePos = useRef<{ x: number; y: number; pointerType: string } | null>(null);
  const [dragGroup, setDragGroup] = useState<{
    start: { x: number; y: number };
    clickedId?: string;
    clickedKind?: string;
    origFootprints: { id: string; x: number; y: number }[];
    origTracks: { id: string; points: { x: number; y: number }[] }[];
    origVias: { id: string; x: number; y: number }[];
    origPads: { id: string; x: number; y: number }[];
    origTexts: { id: string; x: number; y: number }[];
    connectedTracks: {
      trackId: string;
      pointIndex: number;
      fpId: string;
      padPinIndex: number;
      relX: number; // offset from pad center if any, or just 0
      relY: number;
    }[];
    moved: boolean;
  } | null>(null);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [dragResize, setDragResize] = useState<{ type: "both" | "width" | "height"; start: { x: number; y: number }; origSize: { width: number; height: number }; moved: boolean } | null>(null);
  const [guides, setGuides] = useState<{ x?: number; y?: number; x2?: number; y2?: number; type: "alignment" | "dimension"; label?: string; refX?: number; refY?: number }[]>([]);

  const showToolInfo = (item: "track" | "via" | "label" | "fontSize" | "snap") => {
    let title = "";
    let desc = "";

    if (lang === "ar") {
      switch (item) {
        case "track":
          title = "عرض المسار الافتراضي (Default Track Width)";
          desc = "يحدد سماكة خطوط النحاس (المسارات)؛ يمكنك رسم المسارات بالنقر خطوة بخطوة أو بالسحب المباشر (Drag-to-route) من نقطة إلى أخرى.";
          break;
        case "via":
          title = "حجم عبر النحاس (Via Drill/Diameter)";
          desc = "ثقب مطلي بالنحاس يربط كهربائياً بين طبقتي اللوحة (العلوية والسفلية). يمثل القطر الداخلي (Drill) ثقب الحفر، ويمثل القطر الخارجي (Diameter) الحلقة النحاسية المحيطة به.";
          break;
        case "label":
          title = "نص الملصق (Label Text)";
          desc = "كتابة نصوص أو أسماء الشبكات كعلامات توضيحية (مثل GND, VCC) تُطبع باللون الأبيض على طبقة الحرير (Silkscreen) لتسهيل القراءة وتحديد أطراف التوصيل.";
          break;
        case "fontSize":
          title = "حجم خط الملصق (Font Size)";
          desc = "يتحكم في الارتفاع الفعلي للحروف والرموز المطبوعة على اللوحة بالمليمتر لضمان سهولة قراءتها ووضوحها للعين البشرية بعد تصنيع لوحة الـ PCB.";
          break;
        case "snap":
          title = "المحاذاة المغناطيسية (Magnetic Snapping)";
          desc = "ميزة ذكية تجذب مؤشر الماوس تلقائياً إلى نقاط شبكة العمل (Grid) أو مراكز وسادات العناصر (Pads). تساعد في رسم المسارات ومحاذاة القطع بدقة متناهية لمنع تماس المسارات المختلفة.";
          break;
      }
    } else {
      switch (item) {
        case "track":
          title = "Default Track Width";
          desc = "Specifies copper track thickness. You can create tracks either by clicking point-by-point or by dragging the cursor directly from start to end.";
          break;
        case "via":
          title = "Via Drill/Diameter";
          desc = "A copper-plated hole that routes electrical paths between the top and bottom layers of the board. Drill is the hole size; Diameter is the outer copper pad ring.";
          break;
        case "label":
          title = "Label Text";
          desc = "Text annotations (like GND, VCC) printed on the white silkscreen layer of the PCB board, making it easy to reference pins and assemble elements.";
          break;
        case "fontSize":
          title = "Font Size";
          desc = "Determines the physical height of characters printed on the PCB silkscreen. Keep it large enough to be easily readable post-production.";
          break;
        case "snap":
          title = "Magnetic Snapping";
          desc = "A smart assistance feature that pulls the cursor to grid points or component pads. Helps align elements perfectly to avoid design clearance errors.";
          break;
      }
    }

    toast(title, {
      description: desc,
      duration: 6000,
    });
  };
  
  const activePointers = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const registerPointer = (e: React.PointerEvent) => {
    svgRef.current?.setPointerCapture(e.pointerId);
    activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
  };

  const [tool, setTool] = useState<PcbTool>("select");
  
  // Footprint Generator state
  const [genType, setGenType] = useState<"DIP" | "SOIC" | "QFP" | "Passive">("DIP");
  const [genPinCount, setGenPinCount] = useState<number>(8);
  const [genPitch, setGenPitch] = useState<number>(2.54);
  const [genRowSpacing, setGenRowSpacing] = useState<number>(7.62);
  const [genPadWidth, setGenPadWidth] = useState<number>(1.5);
  const [genPadHeight, setGenPadHeight] = useState<number>(1.5);
  const [genDrill, setGenDrill] = useState<number>(0.8);
  const [genPrefix, setGenPrefix] = useState<string>("U");
  const [genValue, setGenValue] = useState<string>("DIP-8");

  useEffect(() => {
    if (genType === "DIP") {
      setGenPinCount(8);
      setGenPitch(2.54);
      setGenRowSpacing(7.62);
      setGenPadWidth(1.5);
      setGenPadHeight(1.5);
      setGenDrill(0.8);
      setGenPrefix("U");
      setGenValue("DIP-8");
    } else if (genType === "SOIC") {
      setGenPinCount(8);
      setGenPitch(1.27);
      setGenRowSpacing(5.0);
      setGenPadWidth(1.5);
      setGenPadHeight(0.6);
      setGenDrill(0);
      setGenPrefix("U");
      setGenValue("SOIC-8");
    } else if (genType === "QFP") {
      setGenPinCount(32);
      setGenPitch(0.8);
      setGenRowSpacing(10.0);
      setGenPadWidth(1.2);
      setGenPadHeight(0.4);
      setGenDrill(0);
      setGenPrefix("U");
      setGenValue("QFP-32");
    } else if (genType === "Passive") {
      setGenPinCount(2);
      setGenPitch(2.0);
      setGenRowSpacing(0);
      setGenPadWidth(1.0);
      setGenPadHeight(1.2);
      setGenDrill(0);
      setGenPrefix("R");
      setGenValue("10k");
    } else if (genType === "RadialCap") {
      setGenPinCount(2);
      setGenPitch(2.54);
      setGenRowSpacing(0);
      setGenPadWidth(1.5);
      setGenPadHeight(1.5);
      setGenDrill(0.8);
      setGenPrefix("C");
      setGenValue("10uF");
    }
  }, [genType]);

  const generatePads = (params: {
    packageType: "DIP" | "SOIC" | "QFP" | "Passive" | "RadialCap";
    pinCount: number;
    pitch: number;
    rowSpacing: number;
    padWidth: number;
    padHeight: number;
    drill: number;
  }) => {
    const pads: any[] = [];
    const { packageType, pinCount, pitch, rowSpacing, padWidth, padHeight, drill } = params;

    if (packageType === "DIP" || packageType === "SOIC") {
      const half = Math.floor(pinCount / 2);
      for (let i = 0; i < half; i++) {
        const py = (i - (half - 1) / 2) * pitch;
        const px = -rowSpacing / 2;
        pads.push({
          id: `pad-${i + 1}-${Date.now()}`,
          pinIndex: i,
          number: String(i + 1),
          name: `P${i + 1}`,
          x: px,
          y: py,
          width: padWidth,
          height: padHeight,
          shape: packageType === "DIP" ? "circle" : "rect",
          layer: packageType === "DIP" ? "multi_layer" : "top_copper",
          drill: packageType === "DIP" ? drill : undefined,
        });
      }
      for (let i = 0; i < half; i++) {
        const py = ((half - 1 - i) - (half - 1) / 2) * pitch;
        const px = rowSpacing / 2;
        const padNum = half + i + 1;
        pads.push({
          id: `pad-${padNum}-${Date.now()}`,
          pinIndex: padNum - 1,
          number: String(padNum),
          name: `P${padNum}`,
          x: px,
          y: py,
          width: padWidth,
          height: padHeight,
          shape: packageType === "DIP" ? "circle" : "rect",
          layer: packageType === "DIP" ? "multi_layer" : "top_copper",
          drill: packageType === "DIP" ? drill : undefined,
        });
      }
    } else if (packageType === "QFP") {
      const sideCount = Math.floor(pinCount / 4);
      let pinNum = 1;
      
      // Left side (going down)
      for (let i = 0; i < sideCount; i++) {
        const py = (i - (sideCount - 1) / 2) * pitch;
        const px = -rowSpacing / 2;
        pads.push({
          id: `pad-${pinNum}-${Date.now()}`,
          pinIndex: pinNum - 1,
          number: String(pinNum),
          name: `P${pinNum}`,
          x: px,
          y: py,
          width: padHeight,
          height: padWidth,
          shape: "rect",
          layer: "top_copper",
        });
        pinNum++;
      }
      // Bottom side (going right)
      for (let i = 0; i < sideCount; i++) {
        const px = (i - (sideCount - 1) / 2) * pitch;
        const py = rowSpacing / 2;
        pads.push({
          id: `pad-${pinNum}-${Date.now()}`,
          pinIndex: pinNum - 1,
          number: String(pinNum),
          name: `P${pinNum}`,
          x: px,
          y: py,
          width: padWidth,
          height: padHeight,
          shape: "rect",
          layer: "top_copper",
        });
        pinNum++;
      }
      // Right side (going up)
      for (let i = 0; i < sideCount; i++) {
        const py = ((sideCount - 1 - i) - (sideCount - 1) / 2) * pitch;
        const px = rowSpacing / 2;
        pads.push({
          id: `pad-${pinNum}-${Date.now()}`,
          pinIndex: pinNum - 1,
          number: String(pinNum),
          name: `P${pinNum}`,
          x: px,
          y: py,
          width: padHeight,
          height: padWidth,
          shape: "rect",
          layer: "top_copper",
        });
        pinNum++;
      }
      // Top side (going left)
      for (let i = 0; i < sideCount; i++) {
        const px = ((sideCount - 1 - i) - (sideCount - 1) / 2) * pitch;
        const py = -rowSpacing / 2;
        pads.push({
          id: `pad-${pinNum}-${Date.now()}`,
          pinIndex: pinNum - 1,
          number: String(pinNum),
          name: `P${pinNum}`,
          x: px,
          y: py,
          width: padWidth,
          height: padHeight,
          shape: "rect",
          layer: "top_copper",
        });
        pinNum++;
      }
    } else if (packageType === "RadialCap") {
      // Pin 1 (Rect) on left, Pin 2 (Circle) on right
      pads.push({
        id: `pad-1-${Date.now()}`,
        pinIndex: 0,
        number: "1",
        name: "+",
        x: -pitch / 2,
        y: 0,
        width: padWidth,
        height: padHeight,
        shape: "rect",
        layer: "multi_layer",
        drill: drill,
      });
      pads.push({
        id: `pad-2-${Date.now()}`,
        pinIndex: 1,
        number: "2",
        name: "-",
        x: pitch / 2,
        y: 0,
        width: padWidth,
        height: padHeight,
        shape: "circle",
        layer: "multi_layer",
        drill: drill,
      });
    } else {
      // Passive
      pads.push({
        id: `pad-1-${Date.now()}`,
        pinIndex: 0,
        number: "1",
        name: "1",
        x: -pitch / 2,
        y: 0,
        width: padWidth,
        height: padHeight,
        shape: "rect",
        layer: "top_copper",
      });
      pads.push({
        id: `pad-2-${Date.now()}`,
        pinIndex: 1,
        number: "2",
        name: "2",
        x: pitch / 2,
        y: 0,
        width: padWidth,
        height: padHeight,
        shape: "rect",
        layer: "top_copper",
      });
    }
    return pads;
  };

  const handleGenerateFootprint = () => {
    let num = 1;
    while (pcb.footprints?.some(f => f.reference === `${genPrefix}${num}`)) {
      num++;
    }
    const reference = `${genPrefix}${num}`;
    const genModel = buildGeneratorModel({
      packageType: genType,
      pinCount: genPinCount,
      pitch: genPitch,
      rowSpacing: genRowSpacing,
      padWidth: genPadWidth,
      padHeight: genPadHeight,
      drill: genDrill,
      prefix: genPrefix,
      value: genValue,
    });

    const pads = generatePads({
      packageType: genType,
      pinCount: genPinCount,
      pitch: genPitch,
      rowSpacing: genRowSpacing,
      padWidth: genPadWidth,
      padHeight: genPadHeight,
      drill: genDrill,
    });

    const newFp: PcbFootprint = {
      id: genModel.id || `custom-fp-${Date.now()}`,
      reference,
      value: genValue,
      symbol: genType,
      x: pcb.width / 2,
      y: pcb.height / 2,
      rotation: 0,
      pads,
      nativeKicadFootprint: {
        ...genModel,
        properties: {
          ...genModel.properties,
          Reference: reference,
          Value: genValue,
        },
      },
    };

    setPcb(d => ({
      ...d,
      footprints: [...(d.footprints || []), newFp]
    }));
    
    setUiFootprintGenOpen(false);
  };
  const [activeLayer, setActiveLayer] = useState<PcbLayerId>("top_copper");
  const [dimInactiveLayers, setDimInactiveLayers] = useState(false);
  const [zoom, setZoom] = useState(4); // px per mm
  const [pan, setPan] = useState({ x: 40, y: 40 });
  const [boardRotation, setBoardRotation] = useState(0);

  const gestureStart = useRef<{
    distance: number;
    angle: number;
    center: { x: number; y: number };
    zoom: number;
    pan: { x: number; y: number };
    boardRotation: number;
  } | null>(null);

  const footprintGenRef = useRef<HTMLElement | null>(null);


  const [activeDrcError, setActiveDrcError] = useState<{ id: string; x: number; y: number; msg: string } | null>(null);
  const [threeDOpen, setThreeDOpen] = useState(false);

  const [selectedTrackWidth, setSelectedTrackWidth] = useState<string | number>(0.25);
  const [routingMode, setRoutingMode] = useState<"45" | "90" | "curve">("45");
  const [routingNetId, setRoutingNetId] = useState<number | null>(null);
  const [widthPreset, setWidthPreset] = useState<string>("0.25");
  const [dragVertexIndex, setDragVertexIndex] = useState<number | null>(null);
  const [isInsertingVertex, setIsInsertingVertex] = useState<boolean>(false);
  const [selectedViaSize, setSelectedViaSize] = useState<{ drill: number; diameter: number }>({ drill: 0.6, diameter: 1.5 });
  const [selectedViaShape, setSelectedViaShape] = useState<"circle" | "square">("circle");
  const [hasPlacedVia, setHasPlacedVia] = useState<boolean>(false);

  useEffect(() => {
    setHasPlacedVia(false);
  }, [tool]);

  const [inputText, setInputText] = useState<string>("GND");
  const [inputTextSize, setInputTextSize] = useState<string | number>(2.0);
  const [snappingEnabled, setSnappingEnabled] = useState<boolean>(true);
  const [dragText, setDragText] = useState<{ id: string; start: { x: number; y: number }; orig: { x: number; y: number }; moved: boolean } | null>(null);

  const [popupBtnPos, setPopupBtnPos] = useState<{ x: number; y: number } | null>(null);
  const [groupSelected, setGroupSelected] = useState<{ footprints: string[]; tracks: string[]; vias: string[]; pads: string[]; texts: string[] } | null>(null);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeEnd, setMarqueeEnd] = useState<{ x: number; y: number } | null>(null);

  const performMarqueeSelection = (p1: { x: number; y: number }, p2: { x: number; y: number }) => {
    const minX = Math.min(p1.x, p2.x);
    const maxX = Math.max(p1.x, p2.x);
    const minY = Math.min(p1.y, p2.y);
    const maxY = Math.max(p1.y, p2.y);

    const footprints: string[] = [];
    const tracks: string[] = [];
    const vias: string[] = [];
    const pads: string[] = [];
    const texts: string[] = [];

    // 1. Footprints
    deferredPcb.footprints.forEach((f) => {
      if (f.x >= minX && f.x <= maxX && f.y >= minY && f.y <= maxY) {
        footprints.push(f.id);
      }
    });

    // 2. Tracks
    deferredPcb.tracks.forEach((t) => {
      const layer = pcb.layers.find(l => l.id === t.layer);
      if (layer && !layer.visible) return; // Do not select hidden layers
      
      const anyPointIn = t.points.some(p => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY);
      if (anyPointIn) {
        tracks.push(t.id);
      }
    });

    // 3. Vias
    pcb.vias?.forEach((v) => {
      if (v.x >= minX && v.x <= maxX && v.y >= minY && v.y <= maxY) {
        vias.push(v.id);
      }
    });

    // 4. Pads
    pcb.pads?.forEach((p) => {
      if (p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY) {
        pads.push(p.id);
      }
    });

    // 5. Texts
    (pcb.texts || []).forEach((txt) => {
      if (txt.x >= minX && txt.x <= maxX && txt.y >= minY && txt.y <= maxY) {
        texts.push(txt.id);
      }
    });

    const hasAny = footprints.length > 0 || tracks.length > 0 || vias.length > 0 || pads.length > 0 || texts.length > 0;
    if (hasAny) {
      setGroupSelected({ footprints, tracks, vias, pads, texts });
    } else {
      setGroupSelected(null);
    }
  };

  const deleteSelectedElements = () => {
    if (!groupSelected) return;
    setPcb((d) => {
      const fps = d.footprints.filter(f => !groupSelected.footprints.includes(f.id));
      const trs = d.tracks.filter(t => !groupSelected.tracks.includes(t.id));
      const vs = d.vias.filter(v => !groupSelected.vias.includes(v.id));
      const pds = d.pads.filter(p => !groupSelected.pads.includes(p.id));
      const txts = (d.texts || []).filter(t => !groupSelected.texts.includes(t.id));

      return {
        ...d,
        footprints: fps,
        tracks: trs,
        vias: vs,
        pads: pds,
        texts: txts
      };
    });
    setGroupSelected(null);
  };

  const trackNetMap = useMemo(() => computeTrackNets(deferredSchematic, deferredPcb), [deferredSchematic, deferredPcb]);

  const layerColorsMap = useMemo(() => Object.fromEntries((pcb.layers || []).map(l => [l.id, l.color])), [pcb.layers]);
  const layerVisibilityMap = useMemo(() => Object.fromEntries((pcb.layers || []).map(l => [l.id, l.visible])), [pcb.layers]);

  const drcErrors = useMemo(() => {
    if (deferredPcb.isImportedKiCadPcb || deferredPcb.disableDrc || deferredPcb.isImportedGerber || isKiCadPcbBoard(deferredPcb)) return [];
    const errors: { id: string; type: "clearance" | "boundary" | "unconnected" | "schematic_mismatch"; msg: string; x: number; y: number; netId?: number }[] = [];
    const netIndex = schematicNetIndex;
    
    // 1. Boundary checking
    deferredPcb.footprints.forEach(fp => {
      if (fp.x < 0 || fp.x > pcb.width || fp.y < 0 || fp.y > pcb.height) {
        errors.push({
          id: `bounds-fp-${fp.id}`,
          type: "boundary",
          msg: lang === "ar" ? `العنصر ${fp.reference} يقع خارج حدود اللوحة` : `Component ${fp.reference} is outside board outline`,
          x: fp.x,
          y: fp.y
        });
      }
    });

    pcb.pads.forEach(p => {
      if (p.x < 0 || p.x > pcb.width || p.y < 0 || p.y > pcb.height) {
        errors.push({
          id: `bounds-pad-${p.id}`,
          type: "boundary",
          msg: lang === "ar" ? `الوسادة ${p.number || ""} تقع خارج حدود اللوحة` : `Pad ${p.number || ""} is outside board outline`,
          x: p.x,
          y: p.y
        });
      }
    });

    deferredPcb.vias.forEach(v => {
      if (v.x < 0 || v.x > pcb.width || v.y < 0 || v.y > pcb.height) {
        errors.push({
          id: `bounds-via-${v.id}`,
          type: "boundary",
          msg: lang === "ar" ? `عبر النحاس (Via) يقع خارج حدود اللوحة` : `Via is outside board outline`,
          x: v.x,
          y: v.y
        });
      }
    });

    // 2. Clearance checking
    for (let i = 0; i < pcb.tracks.length; i++) {
      const t1 = pcb.tracks[i];
      const n1 = trackNetMap.get(t1.id);
      if (n1 === undefined) continue;

      for (let j = i + 1; j < pcb.tracks.length; j++) {
        const t2 = pcb.tracks[j];
        const n2 = trackNetMap.get(t2.id);
        if (n2 === undefined || n1 === n2) continue;

        for (const pt1 of t1.points) {
          for (const pt2 of t2.points) {
            const dist = Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y);
            if (dist < 0.3) {
              errors.push({
                id: `clearance-tr-${t1.id}-${t2.id}`,
                type: "clearance",
                msg: lang === "ar" ? `خطر التماس: مسارات شبكات مختلفة قريبة جداً (${dist.toFixed(2)}mm)` : `Short risk: tracks of different nets are too close (${dist.toFixed(2)}mm)`,
                x: (pt1.x + pt2.x) / 2,
                y: (pt1.y + pt2.y) / 2,
                netId: n1
              });
              break;
            }
          }
        }
      }
    }

    // 3. Unconnected Nets (Remaining airwires)
    const rats = computeRatsnest(schematic, pcb);
    const unconnectedNets = new Set<number>();
    rats.forEach(line => {
      unconnectedNets.add(line.netId);
    });

    unconnectedNets.forEach(netId => {
      const net = netIndex.nets.find(n => n.id === netId);
      if (net) {
        const pos = getRatsnestPads(pcb);
        let avgX = pcb.width / 2;
        let avgY = pcb.height / 2;
        let count = 0;
        for (const pin of net.pins) {
          const coord = pos.get(`${pin.nodeId}:${pin.pinIndex}`);
          if (coord) {
            avgX += coord.x;
            avgY += coord.y;
            count++;
          }
        }
        if (count > 0) {
          avgX = (avgX - pcb.width / 2) / count;
          avgY = (avgY - pcb.height / 2) / count;
        }

        errors.push({
          id: `unconnected-net-${netId}`,
          type: "unconnected",
          msg: lang === "ar" ? `الشبكة #${netId} غير موصولة بالكامل` : `Net #${netId} is unconnected`,
          x: avgX,
          y: avgY,
          netId
        });
      }
    });

    // 4. Custom Footprints schematic mismatch checking (manually added elements)
    deferredPcb.footprints.forEach(fp => {
      const existsInSchematic = schematic.nodes.some(n => n.id === fp.id);
      if (!existsInSchematic) {
        errors.push({
          id: `custom-fp-warn-${fp.id}`,
          type: "schematic_mismatch",
          msg: lang === "ar" 
            ? `العنصر ${fp.reference || fp.symbol} (مضاف يدويًا) لا يتفق مع المخطط الرئيسي` 
            : `Component ${fp.reference || fp.symbol} (manually added) does not match the main schematic`,
          x: fp.x,
          y: fp.y
        });
      }
    });

    // 5. Manual tracks schematic mismatch checking
    const trackGroups: PcbTrack[][] = [];
    const visited = new Set<string>();
    
    for (const track of pcb.tracks) {
      if (visited.has(track.id)) continue;
      const group: PcbTrack[] = [];
      const queue = [track];
      visited.add(track.id);
      while (queue.length > 0) {
        const current = queue.shift()!;
        group.push(current);
        for (const other of pcb.tracks) {
          if (visited.has(other.id)) continue;
          let touches = false;
          for (const p1 of current.points) {
            for (const p2 of other.points) {
              if (Math.hypot(p1.x - p2.x, p1.y - p2.y) < 0.4) {
                touches = true;
                break;
              }
            }
            if (touches) break;
          }
          if (touches) {
            visited.add(other.id);
            queue.push(other);
          }
        }
      }
      trackGroups.push(group);
    }

    const allPads: {
      fp: PcbFootprint;
      pad: PcbFootprintPad;
      worldX: number;
      worldY: number;
      netId?: number;
    }[] = [];

    deferredPcb.footprints.forEach(fp => {
      const rad = (fp.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      const existsInSchematic = schematic.nodes.some(n => n.id === fp.id);

      fp.pads.forEach(pad => {
        const worldX = fp.x + (pad.x * cos - pad.y * sin);
        const worldY = fp.y + (pad.x * sin + pad.y * cos);
        const pinKey = `${fp.id}:${pad.pinIndex}`;
        const netId = existsInSchematic ? netIndex.pinNet.get(pinKey) : undefined;
        
        allPads.push({
          fp,
          pad,
          worldX,
          worldY,
          netId
        });
      });
    });

    trackGroups.forEach((group, gIdx) => {
      const touchedPads = allPads.filter(ap => {
        return group.some(t => {
          return t.points.some(pt => Math.hypot(pt.x - ap.worldX, pt.y - ap.worldY) < 0.6);
        });
      });

      if (touchedPads.length > 0) {
        const uniqueNets = Array.from(new Set(touchedPads.map(p => p.netId).filter(id => id !== undefined)));
        const hasCustom = touchedPads.some(p => !schematic.nodes.some(n => n.id === p.fp.id));
        const hasUnconnected = touchedPads.some(p => p.netId === undefined && schematic.nodes.some(n => n.id === p.fp.id));

        let isMismatch = false;
        let msg = "";

        if (hasCustom) {
          isMismatch = true;
          msg = lang === "ar"
            ? `المسار يتصل بالعنصر المضاف يدويًا ${touchedPads.find(p => !schematic.nodes.some(n => n.id === p.fp.id))?.fp.reference || ""} ولا يتفق مع المخطط الرئيسي`
            : `Track connects to manually added component ${touchedPads.find(p => !schematic.nodes.some(n => n.id === p.fp.id))?.fp.reference || ""} which does not match schematic`;
        } else if (uniqueNets.length > 1) {
          isMismatch = true;
          const netNames = uniqueNets.map(id => netIndex.nets.find(n => n.id === id)?.name || `#${id}`);
          msg = lang === "ar"
            ? `المسار يدمج شبكات مختلفة (${netNames.join(" و ")}) وهذا لا يتفق مع المخطط الرئيسي`
            : `Track merges different nets (${netNames.join(" & ")}) which does not match the main schematic`;
        } else if (uniqueNets.length === 1 && hasUnconnected) {
          isMismatch = true;
          msg = lang === "ar"
            ? `المسار يوصل دبوساً غير متصل في المخطط مع الشبكة #${uniqueNets[0]}`
            : `Track connects an unconnected pin to net #${uniqueNets[0]} which does not match schematic`;
        }

        if (isMismatch) {
          let avgX = 0, avgY = 0, ptCount = 0;
          group.forEach(t => t.points.forEach(p => { avgX += p.x; avgY += p.y; ptCount++; }));
          if (ptCount > 0) { avgX /= ptCount; avgY /= ptCount; }

          errors.push({
            id: `track-mismatch-${gIdx}`,
            type: "schematic_mismatch",
            msg,
            x: avgX,
            y: avgY
          });
        }
      }
    });

    return errors;
  }, [pcb, schematic, lang, trackNetMap, schematicNetIndex]);

  const selection = useMemo<PcbSelection | null>(() => {
    if (selectedId) {
      if (pcb.footprints?.some(f => f.id === selectedId)) {
        return { kind: "footprint", id: selectedId };
      }
      if (pcb.vias?.some(v => v.id === selectedId)) {
        return { kind: "via", id: selectedId };
      }
      if (pcb.pads?.some(p => p.id === selectedId)) {
        return { kind: "pad", id: selectedId };
      }
      if (pcb.measures?.some(m => m.id === selectedId)) {
        return { kind: "measure", id: selectedId };
      }
      if (pcb.texts?.some(t => t.id === selectedId)) {
        return { kind: "text", id: selectedId };
      }
    }
    if (selectedTrackId) {
      return { kind: "track", id: selectedTrackId };
    }
    if (selectedPin) {
      const netIndex = schematicNetIndex;
      const netId = netIndex.pinNet.get(`${selectedPin.nodeId}:${selectedPin.pinIndex}`);
      if (netId !== undefined) {
        return { kind: "net", id: netId };
      }
    }
    return null;
  }, [selectedId, selectedTrackId, selectedPin, pcb.footprints, pcb.vias, pcb.pads, pcb.measures, pcb.texts, schematic, schematicNetIndex]);

  useEffect(() => {
    // Helper to compute bounding box ONLY of selected electronic components (footprints)
    const getBBox = (): { x: number; y: number; w: number; h: number } | null => {
      // 1. Group Selection (only if footprints are present in group)
      if (groupSelected && groupSelected.footprints && groupSelected.footprints.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        groupSelected.footprints.forEach(id => {
          const fp = pcb.footprints.find(f => f.id === id);
          if (fp) {
            const bb = footprintBBox(fp);
            minX = Math.min(minX, bb.x);
            minY = Math.min(minY, bb.y);
            maxX = Math.max(maxX, bb.x + bb.w);
            maxY = Math.max(maxY, bb.y + bb.h);
          }
        });
        if (minX !== Infinity && maxX >= minX && maxY >= minY) {
          return { x: minX, y: minY, w: Math.max(0.2, maxX - minX), h: Math.max(0.2, maxY - minY) };
        }
      }

      // 2. Check if selected Pin belongs to a footprint
      if (selectedPin) {
        const fp = pcb.footprints.find(f => f.id === selectedPin.nodeId);
        if (fp) return footprintBBox(fp);
      }

      // 3. Single Footprint Selection (via selectedId or dragGroup)
      const targetId = selectedId || (dragGroup ? dragGroup.clickedId : null);
      if (targetId) {
        const fp = pcb.footprints.find(f => f.id === targetId);
        if (fp) return footprintBBox(fp);
      }

      return null;
    };

    const bb = getBBox();
    let newGuides: any[] = [];

    if (bb && (bb.w > 0 || bb.h > 0)) {
      const offset = 2.0;
      const wStr = fmt(bb.w, unit);
      const hStr = fmt(bb.h, unit);

      newGuides = [
        {
          x: bb.x, y: bb.y - offset,
          x2: bb.x + bb.w, y2: bb.y - offset,
          refY: bb.y,
          type: "dimension",
          label: wStr
        },
        {
          x: bb.x - offset, y: bb.y,
          x2: bb.x - offset, y2: bb.y + bb.h,
          refX: bb.x,
          type: "dimension",
          label: hStr
        }
      ];
    }

    setGuides((prev) => {
      const prevAligns = prev.filter(g => g.type === "alignment");
      const combined = [...prevAligns, ...newGuides];
      if (prev.length === combined.length && JSON.stringify(prev) === JSON.stringify(combined)) {
        return prev;
      }
      return combined;
    });
  }, [
    selectedId,
    selectedPin?.nodeId,
    groupSelected?.footprints,
    dragGroup?.clickedId,
    pcb.footprints,
    unit
  ]);

  const setSelection = (sel: PcbSelection | null) => {
    if (!sel) {
      setSelectedId(null);
      setSelectedTrackId(null);
      setSelectedPin(null);
      setSelectedWireId(null);
      return;
    }
    if (sel.kind === "footprint" || sel.kind === "via" || sel.kind === "pad" || sel.kind === "measure" || sel.kind === "text") {
      setSelectedId(sel.id);
      setSelectedTrackId(null);
      setSelectedPin(null);
      setSelectedWireId(null);
    } else if (sel.kind === "track") {
      setSelectedTrackId(sel.id);
      setSelectedId(null);
      setSelectedPin(null);
      setSelectedWireId(null);
    } else if (sel.kind === "net") {
      const netIndex = schematicNetIndex;
      const net = netIndex.nets.find(n => n.id === sel.id);
      if (net && net.pins.length > 0) {
        setSelectedPin({ nodeId: net.pins[0].nodeId, pinIndex: net.pins[0].pinIndex });
      }
      setSelectedId(null);
      setSelectedTrackId(null);
      setSelectedWireId(null);
    }
  };
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
  const [propsOpen, setPropsOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [pcbLeftMenuOpen, setPcbLeftMenuOpen] = useState(false);

  const closeSidePanels = () => {
    setPropsOpen(false);
    setPcbLeftMenuOpen(false);
    setUiFootprintGenOpen(false);
    setUiFootprintBrowserOpen(false);
    setUiLayersOpen(false);
    setUnitDialogOpen(false);
    setDrcOpen(false);
  };

  const [draftTrack, setDraftTrack] = useState<{ x: number; y: number }[] | null>(null);
  const [unconfirmedTracks, setUnconfirmedTracks] = useState<PcbTrack[]>([]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [measureA, _setMeasureA] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingMeasure, setIsDraggingMeasure] = useState(false);
  const measureARef = useRef<{ x: number; y: number } | null>(null);
  const setMeasureA = (val: { x: number; y: number } | null) => {
    measureARef.current = val;
    _setMeasureA(val);
    if (val === null) {
      setIsDraggingMeasure(false);
    }
  };
  const longPressTimerRef = useRef<any>(null);
  const pendingDragRef = useRef<any>(null);
  const isDragActiveRef = useRef<boolean>(false);
  const measureStartedOnThisDown = useRef(false);
  const trackPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingTrackRef = useRef<boolean>(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number; pan: { x: number; y: number } } | null>(null);

  const initiateActualDrag = (e: React.PointerEvent, clickedKind: string, clickedId: string) => {
    if (tool !== "select" && tool !== "group_select") return;
    
    let footprintsToDrag: string[] = [];
    let tracksToDrag: string[] = [];
    let viasToDrag: string[] = [];
    let padsToDrag: string[] = [];
    let textsToDrag: string[] = [];
    
    const isClickedInGroup = groupSelected && (
      (clickedKind === "footprint" && groupSelected.footprints?.includes(clickedId)) ||
      (clickedKind === "track" && groupSelected.tracks?.includes(clickedId)) ||
      (clickedKind === "via" && groupSelected.vias?.includes(clickedId)) ||
      (clickedKind === "pad" && groupSelected.pads?.includes(clickedId)) ||
      (clickedKind === "text" && groupSelected.texts?.includes(clickedId))
    );
    
    if (isClickedInGroup && groupSelected) {
      footprintsToDrag = groupSelected.footprints || [];
      tracksToDrag = groupSelected.tracks || [];
      viasToDrag = groupSelected.vias || [];
      padsToDrag = groupSelected.pads || [];
      textsToDrag = groupSelected.texts || [];
    } else {
      if (clickedKind === "footprint") footprintsToDrag = [clickedId];
      if (clickedKind === "track") tracksToDrag = [clickedId];
      if (clickedKind === "via") viasToDrag = [clickedId];
      if (clickedKind === "pad") padsToDrag = [clickedId];
      if (clickedKind === "text") textsToDrag = [clickedId];
      
      if (clickedKind === "footprint") {
        setSelection({ kind: "footprint", id: clickedId });
        setSelectedId(clickedId);
        setSelectedPin(null);
        setSelectedWireId(null);
      } else if (clickedKind === "track") {
        setSelectedTrackId(clickedId);
        setSelection({ kind: "track", id: clickedId });
        setSelectedId(null);
        setSelectedPin(null);
        setSelectedWireId(null);
      } else if (clickedKind === "via") {
        setSelection({ kind: "via", id: clickedId });
        setSelectedId(clickedId);
        setSelectedPin(null);
        setSelectedWireId(null);
      } else if (clickedKind === "pad") {
        setSelection({ kind: "pad", id: clickedId });
        setSelectedId(clickedId);
        setSelectedPin(null);
        setSelectedWireId(null);
      } else if (clickedKind === "text") {
        setSelection({ kind: "text", id: clickedId });
        setSelectedId(clickedId);
        setSelectedPin(null);
        setSelectedWireId(null);
      }
    }
    
    const startP = screenToMm(e.clientX, e.clientY);
    
    const origFps = pcb.footprints
      .filter((f) => footprintsToDrag.includes(f.id))
      .map((f) => ({ id: f.id, x: f.x, y: f.y }));
      
    const origTracks = pcb.tracks
      .filter((t) => tracksToDrag.includes(t.id))
      .map((t) => ({ id: t.id, points: t.points.map((pt) => ({ x: pt.x, y: pt.y })) }));
      
    const origVias = pcb.vias
      .filter((v) => viasToDrag.includes(v.id))
      .map((v) => ({ id: v.id, x: v.x, y: v.y }));
      
    const origPads = pcb.pads
      .filter((p) => padsToDrag.includes(p.id))
      .map((p) => ({ id: p.id, x: p.x, y: p.y }));
      
    const origTexts = (pcb.texts || [])
      .filter((t) => textsToDrag.includes(t.id))
      .map((t) => ({ id: t.id, x: t.x, y: t.y }));
      
    const connectedTracks: {
      trackId: string;
      pointIndex: number;
      fpId: string;
      padPinIndex: number;
      relX: number;
      relY: number;
    }[] = [];

    deferredPcb.tracks.forEach(track => {
      if (tracksToDrag.includes(track.id)) return;
      [0, track.points.length - 1].forEach(ptIdx => {
        const pt = track.points[ptIdx];
        footprintsToDrag.forEach(fpId => {
          const fp = pcb.footprints.find(f => f.id === fpId);
          if (!fp) return;
          const rad = (fp.rotation * Math.PI) / 180;
          const cos = Math.cos(rad), sin = Math.sin(rad);
          fp.pads.forEach(pad => {
            const px = fp.x + (pad.x * cos - pad.y * sin);
            const py = fp.y + (pad.x * sin + pad.y * cos);
            if (Math.hypot(pt.x - px, pt.y - py) < 0.25) {
              connectedTracks.push({
                trackId: track.id,
                pointIndex: ptIdx,
                fpId: fp.id,
                padPinIndex: pad.pinIndex,
                relX: pt.x - px,
                relY: pt.y - py
              });
            }
          });
        });
      });
    });

    setDragGroup({
      start: startP,
      clickedId: clickedId,
      clickedKind: clickedKind,
      origFootprints: origFps,
      origTracks: origTracks,
      origVias: origVias,
      origPads: origPads,
      origTexts: origTexts,
      connectedTracks: connectedTracks,
      moved: false,
    });
  };

  const startDragGroup = (e: React.PointerEvent, clickedKind: string, clickedId: string) => {
    if (tool !== "select" && tool !== "group_select") return;
    initiateActualDrag(e, clickedKind, clickedId);
  };

  useEffect(() => {
    if (selection?.id && selection?.kind) {
      setPcbLeftMenuOpen(true);
    } else {
      setPcbLeftMenuOpen(false);
    }
  }, [selection?.id, selection?.kind]);

  useEffect(() => {
    setDraftTrack(null);
    setMeasureA(null);
    setUnconfirmedTracks([]);
  }, [tool]);

  const rotateLocal = (p: { x: number; y: number }, rot: number) => {
    const r = (rot * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
    return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
  };

  const fpPointsCache = useRef(new WeakMap<PcbFootprint, { xs: number[]; ys: number[]; points: { x: number; y: number; isPin: boolean }[] }>());

  const getFpPoints = (f: PcbFootprint) => {
    const cached = fpPointsCache.current.get(f);
    if (cached) return cached;
    const bbox = footprintBBox(f);
    const round = (v: number) => Math.round(v * 1000) / 1000;
    const xs = new Set([round(bbox.x), round(bbox.x + bbox.w / 2), round(bbox.x + bbox.w)]);
    const ys = new Set([round(bbox.y), round(bbox.y + bbox.h / 2), round(bbox.y + bbox.h)]);
    const points: { x: number; y: number; isPin: boolean }[] = [];

    // Footprint center
    points.push({ x: round(f.x), y: round(f.y), isPin: false });

    f.pads.forEach(p => {
      const r = rotateLocal({ x: p.x, y: p.y }, f.rotation);
      const px = round(f.x + r.x);
      const py = round(f.y + r.y);
      xs.add(px);
      ys.add(py);
      points.push({ x: px, y: py, isPin: true });
    });
    const result = { xs: Array.from(xs), ys: Array.from(ys), points };
    fpPointsCache.current.set(f, result);
    return result;
  };

  useEffect(() => {
    if (selectedId) {
      const exists = 
        pcb.footprints?.some(f => f.id === selectedId) ||
        pcb.vias?.some(v => v.id === selectedId) ||
        pcb.pads?.some(p => p.id === selectedId) ||
        pcb.measures?.some(m => m.id === selectedId) ||
        (pcb.texts || []).some(t => t.id === selectedId);
      if (!exists) {
        setSelection(null);
      }
    } else if (selectedTrackId) {
      const exists = pcb.tracks?.some(t => t.id === selectedTrackId);
      if (!exists) {
        setSelection(null);
      }
    }
  }, [selectedId, selectedTrackId, pcb.footprints, pcb.vias, pcb.pads, pcb.measures, pcb.texts, pcb.tracks]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInputActive = document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "SELECT" || document.activeElement?.tagName === "TEXTAREA";
      if (isInputActive) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        if (groupSelected) {
          setPcb((d) => ({
            ...d,
            footprints: d.footprints.filter(f => !groupSelected.footprints?.includes(f.id)),
            tracks: d.tracks.filter(t => !groupSelected.tracks?.includes(t.id)),
            vias: d.vias.filter(v => !groupSelected.vias?.includes(v.id)),
            pads: d.pads.filter(p => !groupSelected.pads?.includes(p.id)),
            texts: (d.texts || []).filter(t => !groupSelected.texts?.includes(t.id)),
            zones: (d.zones || []).filter(z => !groupSelected.zones?.includes(z.id)),
            graphics: (d.graphics || []).filter(g => !groupSelected.graphics?.includes(g.id)),
            dimensions: (d.dimensions || []).filter(dim => !groupSelected.dimensions?.includes(dim.id)),
            targets: (d.targets || []).filter(tgt => !groupSelected.targets?.includes(tgt.id)),
          }));
          setGroupSelected(null);
          setSelection(null);
          return;
        }

        if (selection) {
          if (selection.kind === "track") {
            setPcb((d) => ({ ...d, tracks: d.tracks.filter((t) => t.id !== selection.id) }));
            setSelection(null);
          } else if (selection.kind === "via") {
            setPcb((d) => ({ ...d, vias: d.vias.filter((v) => v.id !== selection.id) }));
            setSelection(null);
          } else if (selection.kind === "pad") {
            setPcb((d) => ({ ...d, pads: d.pads.filter((p) => p.id !== selection.id) }));
            setSelection(null);
          } else if (selection.kind === "text") {
            setPcb((d) => ({ ...d, texts: (d.texts || []).filter((t) => t.id !== selection.id) }));
            setSelection(null);
          } else if (selection.kind === "measure") {
            setPcb((d) => ({ ...d, measures: d.measures.filter((m) => m.id !== selection.id) }));
            setSelection(null);
          } else if (selection.kind === "footprint") {
            setPcb((d) => ({ ...d, footprints: d.footprints.filter((f) => f.id !== selection.id) }));
            setSelection(null);
          } else if (selection.kind === "zone") {
            setPcb((d) => ({ ...d, zones: (d.zones || []).filter((z) => z.id !== selection.id) }));
            setSelection(null);
          } else if (selection.kind === "graphic") {
            setPcb((d) => ({ ...d, graphics: (d.graphics || []).filter((g) => g.id !== selection.id) }));
            setSelection(null);
          } else if (selection.kind === "dimension") {
            setPcb((d) => ({ ...d, dimensions: (d.dimensions || []).filter((dim) => dim.id !== selection.id) }));
            setSelection(null);
          } else if (selection.kind === "target") {
            setPcb((d) => ({ ...d, targets: (d.targets || []).filter((tgt) => tgt.id !== selection.id) }));
            setSelection(null);
          }
        }
      } else if ((e.key === "r" || e.key === "R") && !e.ctrlKey && !e.metaKey) {
        if (selection?.kind === "footprint" && selection.id) {
          const step = e.shiftKey ? 45 : 90;
          setPcb((d) => ({
            ...d,
            footprints: d.footprints.map((f) => f.id === selection.id ? { ...f, rotation: ((f.rotation || 0) + step) % 360 } : f)
          }));
        }
      } else if ((e.key === "f" || e.key === "F") && !e.ctrlKey && !e.metaKey) {
        fit();
      } else if (e.key === "+" || e.key === "=") {
        setZoom(z => Math.min(60, z * 1.2));
      } else if (e.key === "-" || e.key === "_") {
        setZoom(z => Math.max(0.2, z / 1.2));
      } else if (e.key === "0" && !e.ctrlKey && !e.metaKey) {
        fit();
      } else if ((e.key === "s" || e.key === "S") && !e.ctrlKey && !e.metaKey) {
        setTool("select");
      } else if ((e.key === "t" || e.key === "T") && !e.ctrlKey && !e.metaKey) {
        setTool("track");
      } else if ((e.key === "v" || e.key === "V") && !e.ctrlKey && !e.metaKey) {
        setTool("via");
      } else if ((e.key === "h" || e.key === "H") && !e.ctrlKey && !e.metaKey) {
        setTool("pan");
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : (pcb.gridMm || 0.5);
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;

        if (selection?.kind === "footprint" && selection.id) {
          setPcb(d => ({
            ...d,
            footprints: d.footprints.map(f => f.id === selection.id ? { ...f, x: Math.round((f.x + dx) * 100) / 100, y: Math.round((f.y + dy) * 100) / 100 } : f)
          }));
        } else if (selection?.kind === "via" && selection.id) {
          setPcb(d => ({
            ...d,
            vias: d.vias.map(v => v.id === selection.id ? { ...v, x: Math.round((v.x + dx) * 100) / 100, y: Math.round((v.y + dy) * 100) / 100 } : v)
          }));
        } else if (selection?.kind === "pad" && selection.id) {
          setPcb(d => ({
            ...d,
            pads: d.pads.map(p => p.id === selection.id ? { ...p, x: Math.round((p.x + dx) * 100) / 100, y: Math.round((p.y + dy) * 100) / 100 } : p)
          }));
        } else if (selection?.kind === "text" && selection.id) {
          setPcb(d => ({
            ...d,
            texts: (d.texts || []).map(t => t.id === selection.id ? { ...t, x: Math.round((t.x + dx) * 100) / 100, y: Math.round((t.y + dy) * 100) / 100 } : t)
          }));
        } else if (selection?.kind === "target" && selection.id) {
          setPcb(d => ({
            ...d,
            targets: (d.targets || []).map(tgt => tgt.id === selection.id ? { ...tgt, x: Math.round((tgt.x + dx) * 100) / 100, y: Math.round((tgt.y + dy) * 100) / 100 } : tgt)
          }));
        } else if (groupSelected) {
          setPcb(d => ({
            ...d,
            footprints: d.footprints.map(f => groupSelected.footprints?.includes(f.id) ? { ...f, x: Math.round((f.x + dx) * 100) / 100, y: Math.round((f.y + dy) * 100) / 100 } : f),
            tracks: d.tracks.map(t => groupSelected.tracks?.includes(t.id) ? { ...t, points: t.points.map(p => ({ x: Math.round((p.x + dx) * 100) / 100, y: Math.round((p.y + dy) * 100) / 100 })) } : t),
            vias: d.vias.map(v => groupSelected.vias?.includes(v.id) ? { ...v, x: Math.round((v.x + dx) * 100) / 100, y: Math.round((v.y + dy) * 100) / 100 } : v),
            pads: d.pads.map(p => groupSelected.pads?.includes(p.id) ? { ...p, x: Math.round((p.x + dx) * 100) / 100, y: Math.round((p.y + dy) * 100) / 100 } : p),
            texts: (d.texts || []).map(t => groupSelected.texts?.includes(t.id) ? { ...t, x: Math.round((t.x + dx) * 100) / 100, y: Math.round((t.y + dy) * 100) / 100 } : t),
            targets: (d.targets || []).map(tgt => groupSelected.targets?.includes(tgt.id) ? { ...tgt, x: Math.round((tgt.x + dx) * 100) / 100, y: Math.round((tgt.y + dy) * 100) / 100 } : tgt),
          }));
        } else {
          // Pan viewport
          const panStep = e.shiftKey ? 100 : 40;
          setPan(p => ({
            x: p.x + (e.key === "ArrowLeft" ? panStep : e.key === "ArrowRight" ? -panStep : 0),
            y: p.y + (e.key === "ArrowUp" ? panStep : e.key === "ArrowDown" ? -panStep : 0)
          }));
        }
      } else if (e.key === "Escape") {
        setDraftTrack(null);
        setMeasureA(null);
        setUnconfirmedTracks([]);
        setGroupSelected(null);
        setSelection(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selection?.id, selection?.kind, groupSelected, setPcb]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        uiFootprintGenOpen &&
        footprintGenRef.current &&
        !footprintGenRef.current.contains(event.target as Node)
      ) {
        // Exclude the footprint generator button triggers to prevent double toggle
        const target = event.target as HTMLElement;
        if (target.closest("[title*='Generator']") || target.closest("[title*='توليد']")) {
          return;
        }
        setUiFootprintGenOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [uiFootprintGenOpen]);

  useEffect(() => {
    function handleGlobalMousedown(event: MouseEvent) {
      const target = event.target as HTMLElement;
      if (target.closest("[title*='Measure']") || target.closest("[title*='قياس']") || target.closest(".tool-btn")) {
        return;
      }
      if (svgRef.current && !svgRef.current.contains(target)) {
        setPcb((d) => ({ ...d, measures: [] }));
        setMeasureA(null);
      }
    }
    document.addEventListener("mousedown", handleGlobalMousedown);
    return () => {
      document.removeEventListener("mousedown", handleGlobalMousedown);
    };
  }, [setPcb]);

  // Adaptative Ruler Ticks
  const isInch = unit === "inch";
  let tickStep = 1; // mm or inch
  let labelStep = 10;
  
  if (isInch) {
    if (zoom < 8) {
      tickStep = 0.5;
      labelStep = 1.0;
    } else if (zoom < 24) {
      tickStep = 0.1;
      labelStep = 0.5;
    } else {
      tickStep = 0.05;
      labelStep = 0.25;
    }
  } else {
    // mm
    if (zoom < 1.5) {
      tickStep = 10;
      labelStep = 50;
    } else if (zoom < 5) {
      tickStep = 5;
      labelStep = 20;
    } else if (zoom < 12) {
      tickStep = 1;
      labelStep = 10;
    } else {
      tickStep = 0.5;
      labelStep = 5;
    }
  }

  const getRulerTicks = (isVertical: boolean) => {
    const ticks = [];
    const step = tickStep;
    const offset = isVertical ? pan.y : pan.x;
    
    const startMm = Math.floor(-offset / (zoom * step)) * step;
    const endMm = Math.ceil((3000 - offset) / (zoom * step)) * step;
    
    const count = (endMm - startMm) / step;
    if (count > 500) return []; 
    
    for (let val = startMm; val <= endMm; val += step) {
      const isMajor = Math.abs(val % labelStep) < 0.0001 || Math.abs((val % labelStep) - labelStep) < 0.0001;
      ticks.push({
        val,
        pos: offset + val * zoom,
        isMajor
      });
    }
    return ticks;
  };

  const hTicks = getRulerTicks(false);
  const vTicks = getRulerTicks(true);

  const snapMm = (p: { x: number; y: number }, step: number) => {
    return { x: Math.round(p.x / step) * step, y: Math.round(p.y / step) * step };
  };

  const screenToMm = (sx: number, sy: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const r = svgRef.current.getBoundingClientRect();
    const rx = (sx - r.left - pan.x) / zoom;
    const ry = (sy - r.top - pan.y) / zoom;
    const rad = (-boardRotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const x = rx * cos - ry * sin;
    const y = rx * sin + ry * cos;
    return snappingEnabled ? snapMm({ x, y }, pcb.gridMm) : { x, y };
  };

  const getSnappedPosition = (p: { x: number; y: number }) => {
    if (!snappingEnabled) return p;
    
    let closest = { ...p };
    let minDistance = 1.5; // Snap radius in mm

    // 1. Check footprint pads
    const padPositions = getRatsnestPads(pcb);
    padPositions.forEach((pos) => {
      const d = Math.hypot(p.x - pos.x, p.y - pos.y);
      if (d < minDistance) {
        minDistance = d;
        closest = { x: pos.x, y: pos.y };
      }
    });

    // 2. Check free pads
    pcb.pads?.forEach((pad) => {
      const d = Math.hypot(p.x - pad.x, p.y - pad.y);
      if (d < minDistance) {
        minDistance = d;
        closest = { x: pad.x, y: pad.y };
      }
    });

    // 3. Check vias
    pcb.vias?.forEach((via) => {
      const d = Math.hypot(p.x - via.x, p.y - via.y);
      if (d < minDistance) {
        minDistance = d;
        closest = { x: via.x, y: via.y };
      }
    });

    // 4. Check track endpoints
    pcb.tracks?.forEach((track) => {
      if (track.points.length > 0) {
        const p1 = track.points[0];
        const p2 = track.points[track.points.length - 1];
        
        const d1 = Math.hypot(p.x - p1.x, p.y - p1.y);
        if (d1 < minDistance) {
          minDistance = d1;
          closest = { x: p1.x, y: p1.y };
        }
        
        const d2 = Math.hypot(p.x - p2.x, p.y - p2.y);
        if (d2 < minDistance) {
          minDistance = d2;
          closest = { x: p2.x, y: p2.y };
        }
      }
    });

    // 5. If we didn't snap to any pad, via, or endpoint, snap to grid
    if (minDistance === 1.5) {
      closest = {
        x: Math.round(p.x / pcb.gridMm) * pcb.gridMm,
        y: Math.round(p.y / pcb.gridMm) * pcb.gridMm
      };
    }

    return closest;
  };

  const ratsnest = useMemo(() => computeRatsnest(deferredSchematic, pcb), [deferredSchematic, pcb]);

  const selectNetInSchematic = (netId: number) => {
    for (const [wireId, nId] of schematicNetIndex.wireNet.entries()) {
      if (nId === netId) {
        setSelectedWireId(wireId);
        return;
      }
    }
    setSelectedWireId(null);
  };

  const isPointOnPadOrVia = (pt: { x: number; y: number }) => {
    const onIndependentPad = pcb.pads?.some(pad => Math.hypot(pt.x - pad.x, pt.y - pad.y) < 0.2);
    if (onIndependentPad) return true;

    const padPositions = getRatsnestPads(pcb);
    let onFpPad = false;
    padPositions.forEach((pos) => {
      if (Math.hypot(pt.x - pos.x, pt.y - pos.y) < 0.2) {
        onFpPad = true;
      }
    });
    if (onFpPad) return true;

    const onVia = pcb.vias?.some(via => Math.hypot(pt.x - via.x, pt.y - via.y) < 0.2);
    if (onVia) return true;

    return false;
  };

  const getNetAtCoordinate = (pt: { x: number; y: number }) => {
    let closestNetId: number | null = null;
    let minDistance = 1.0; // max threshold of 1.0 mm

    // 1. Check if there's a footprint pad at this position (find closest)
    const padPos = getRatsnestPads(pcb);
    for (const [key, pos] of padPos.entries()) {
      const dist = Math.hypot(pt.x - pos.x, pt.y - pos.y);
      if (dist < minDistance) {
        minDistance = dist;
        const netId = schematicNetIndex.pinNet.get(key);
        if (netId !== undefined) {
          closestNetId = netId;
        }
      }
    }
    if (closestNetId !== null) return closestNetId;

    // 2. Check if there's any independent pad near this position
    if (pcb.pads) {
      for (const pad of pcb.pads) {
        if (Math.hypot(pt.x - pad.x, pt.y - pad.y) < 1.0) {
          return null;
        }
      }
    }
    // 3. Check if there's any via near this position
    if (pcb.vias) {
      for (const via of pcb.vias) {
        if (Math.hypot(pt.x - via.x, pt.y - via.y) < 1.0) {
          // See if there's any track touching this via
          for (const track of pcb.tracks) {
            for (const p of track.points) {
              if (Math.hypot(via.x - p.x, via.y - p.y) < 0.2) {
                const netId = trackNetMap.get(track.id);
                if (netId !== undefined) return netId;
              }
            }
          }
        }
      }
    }
    // 4. Check if there's any track near this position (find closest track)
    let closestTrackNetId: number | null = null;
    let minTrackDist = 0.6;
    for (const track of pcb.tracks) {
      for (const p of track.points) {
        const dist = Math.hypot(pt.x - p.x, pt.y - p.y);
        if (dist < minTrackDist) {
          minTrackDist = dist;
          const netId = trackNetMap.get(track.id);
          if (netId !== undefined) closestTrackNetId = netId;
        }
      }
    }
    return closestTrackNetId;
  };

  const checkHasPadOrViaAtTarget = (pt: { x: number; y: number }) => {
    // Check footprint pads
    const padPos = getRatsnestPads(pcb);
    for (const pos of padPos.values()) {
      if (Math.hypot(pt.x - pos.x, pt.y - pos.y) < 0.6) {
        return true;
      }
    }
    // Check independent pads
    if (pcb.pads) {
      for (const pad of pcb.pads) {
        if (Math.hypot(pt.x - pad.x, pt.y - pad.y) < 0.6) {
          return true;
        }
      }
    }
    // Check vias
    if (pcb.vias) {
      for (const via of pcb.vias) {
        if (Math.hypot(pt.x - via.x, pt.y - via.y) < 0.6) {
          return true;
        }
      }
    }
    return false;
  };

  const handlePadRouteClick = (p: { x: number; y: number }) => {
    const pSnapped = getSnappedPosition(p);
    trackPressStartRef.current = pSnapped;
    isDraggingTrackRef.current = false;
    
    if (!draftTrack) {
      // Start routing
      const startNetId = getNetAtCoordinate(pSnapped);
      setRoutingNetId(startNetId);
      setDraftTrack([pSnapped]);
      setCursor(pSnapped);
      
      const netLabel = startNetId !== null ? `Net ${startNetId}` : (lang === "ar" ? "غير محدد" : "None");
    } else {
      // Continue routing / add corner / complete connection
      const pLast = draftTrack[draftTrack.length - 1];
      const isDifferentPoint = Math.hypot(pSnapped.x - pLast.x, pSnapped.y - pLast.y) > 0.15;
      
      if (!isDifferentPoint) {
        // Clicked on the same point as last (or very close). Finish track!
        setDraftTrack(null);
        setRoutingNetId(null);
        
        return;
      }

      if (isDifferentPoint) {
        let routePts: { x: number; y: number }[] = [];
        if (routingMode === "45") {
          routePts = get45Route(pLast, pSnapped);
        } else if (routingMode === "90") {
          routePts = get90Route(pLast, pSnapped);
        } else {
          routePts = getCurvedRoute(pLast, pSnapped);
        }
        
        const trackId = crypto.randomUUID();
        const newTrack: PcbTrack = {
          id: trackId,
          layer: activeLayer,
          width: Number(selectedTrackWidth) || 0.25,
          points: routePts,
        };
        
        setPcb((d) => ({
          ...d,
          tracks: [...d.tracks, newTrack]
        }));

        if (checkHasPadOrViaAtTarget(pSnapped)) {
          // Finished routing on a pad or via!
          setDraftTrack(null);
          setRoutingNetId(null);
        } else {
          // Keep routing, next segment starts from this new point
          setDraftTrack([pSnapped]);
        }
      }
    }
  };

  const onPointerDownCapture = (e: React.PointerEvent) => {
    const target = e.target as SVGElement;
    if (target?.closest && (target.closest("button") || target.closest("input") || target.closest("select"))) {
      return;
    }

    if (activePointers.current.size >= 1 && !activePointers.current.has(e.pointerId)) {
      // This is the second pointer (or more)
      registerPointer(e);
      
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      pendingDragRef.current = null;
      isDragActiveRef.current = false;

      const pts = Array.from(activePointers.current.values());
      const dx = pts[0].clientX - pts[1].clientX;
      const dy = pts[0].clientY - pts[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const cx = (pts[0].clientX + pts[1].clientX) / 2;
      const cy = (pts[0].clientY + pts[1].clientY) / 2;

      gestureStart.current = {
        distance: dist,
        angle,
        center: { x: cx, y: cy },
        zoom,
        pan: { ...pan },
        boardRotation
      };

      setPanStart(null);
      setDragResize(null);
      setDragGroup(null);
      setDragText(null);
      setDragVertexIndex(null);
      
      e.stopPropagation();
      e.preventDefault();
    }
  };

  const onPointerDown = (e: React.PointerEvent) => {
    setIsPointerDown(true);
    const target = e.target as SVGElement;
    if (target?.closest && (target.closest("button") || target.closest("input") || target.closest("select"))) {
      return;
    }

    registerPointer(e);

    if (activePointers.current.size === 1) {
      closeSidePanels();
      if (tool === "group_select") {
        const rawP = screenToMm(e.clientX, e.clientY);
        setMarqueeStart(rawP);
        setMarqueeEnd(rawP);
        setGroupSelected(null);
        setPopupBtnPos(null);
        return;
      }

      const isInteractiveTarget = !!target.closest("[data-footprint-id], [data-track-id], [data-via-id], [data-pad-id], [data-text-id], [data-measure-id], [data-zone-id]");
      const isBg = !isInteractiveTarget && (target.tagName.toLowerCase() === "svg" || target.id === "pcb-canvas-bg" || target.tagName.toLowerCase() === "rect");
      if (tool === "pan" || e.button === 1 || (tool === "select" && isBg)) {
        setPanStart({ x: e.clientX, y: e.clientY, pan: { ...pan } });
        if (tool === "pan" || e.button === 1) {
          return;
        }
      }
      
      // Check if clicked exactly on background
      if (isBg) {
        setUiLayersOpen(false);
        setPropsOpen(false);
        setUiFootprintGenOpen(false);
        onBackgroundClick?.();
        
        if (tool !== "measure") {
          setPcb((d) => ({ ...d, measures: [] }));
          setMeasureA(null);
        }
      }
      
      const rawP = screenToMm(e.clientX, e.clientY);
      const p = getSnappedPosition(rawP);

      if (isBg && tool === "select") {
        const clickedTrack = findTrackAtPoint(visibleTracks, rawP.x, rawP.y, 1.2, activeLayer);
        if (clickedTrack) {
          if (clickedTrack.layer) setActiveLayer(clickedTrack.layer);
          setSelectedTrackId(clickedTrack.id);
          setSelectedId(null);
          setSelectedPin(null);
          setSelectedWireId(null);
          setSelection({ kind: "track", id: clickedTrack.id });
          startDragGroup(e, "track", clickedTrack.id);
          return;
        }
        const clickedVia = findViaAtPoint(visibleVias, rawP.x, rawP.y, 0.5);
        if (clickedVia) {
          setSelectedId(null);
          setSelectedTrackId(null);
          setSelectedPin(null);
          setSelectedWireId(null);
          setSelection({ kind: "via", id: clickedVia.id });
          startDragGroup(e, "via", clickedVia.id);
          return;
        }
        const clickedPad = findPadAtPoint(visiblePads, rawP.x, rawP.y, 0.5);
        if (clickedPad) {
          setSelectedId(null);
          setSelectedTrackId(null);
          setSelectedPin(null);
          setSelectedWireId(null);
          setSelection({ kind: "pad", id: clickedPad.id });
          startDragGroup(e, "pad", clickedPad.id);
          return;
        }
      }

      // Restore selection logic for components that might not have onPointerDown (though most do now)
      // but also handle clicking on things that don't have individual handlers
      if (tool === "select" || tool === "group_select") {
        const fpEl = target.closest("[data-footprint-id]") as SVGElement;
        const trackEl = target.closest("[data-track-id]") as SVGElement;
        const viaEl = target.closest("[data-via-id]") as SVGElement;
        const padEl = target.closest("[data-pad-id]") as SVGElement;
        const textEl = target.closest("[data-text-id]") as SVGElement;

        if (fpEl) {
          startDragGroup(e, "footprint", fpEl.getAttribute("data-footprint-id")!);
          return;
        }
        if (trackEl) {
          const domTrackId = trackEl.getAttribute("data-track-id")!;
          const closestTrack = findTrackAtPoint(visibleTracks, rawP.x, rawP.y, 1.2, activeLayer);
          const targetTrack = closestTrack || visibleTracks.find(t => t.id === domTrackId);
          if (targetTrack?.layer) setActiveLayer(targetTrack.layer);
          startDragGroup(e, "track", targetTrack ? targetTrack.id : domTrackId);
          return;
        }
        if (viaEl) {
          startDragGroup(e, "via", viaEl.getAttribute("data-via-id")!);
          return;
        }
        if (padEl) {
          startDragGroup(e, "pad", padEl.getAttribute("data-pad-id")!);
          return;
        }
        if (textEl) {
          startDragGroup(e, "text", textEl.getAttribute("data-text-id")!);
          return;
        }
      }

      if (tool === "via") {
        const via: PcbVia = { 
          id: crypto.randomUUID(), 
          x: p.x, 
          y: p.y, 
          drill: selectedViaSize.drill, 
          diameter: selectedViaSize.diameter,
          shape: selectedViaShape
        };
        setPcb((d) => ({ ...d, vias: [...d.vias, via] }));
        setHasPlacedVia(true);
      } else if (tool === "pad") {
        const pad: PcbPad = {
          id: crypto.randomUUID(), x: p.x, y: p.y, width: 1.6, height: 1.6,
          shape: "rect", layer: activeLayer === "bottom_copper" ? "bottom_copper" : "top_copper",
        };
        setPcb((d) => ({ ...d, pads: [...d.pads, pad] }));
      } else if (tool === "track") {
        handlePadRouteClick(p);
      } else if (tool === "measure") {
        const currentStart = measureARef.current;
        if (!currentStart) {
          setPcb((d) => ({ ...d, measures: [] }));
          setMeasureA(p);
          setIsDraggingMeasure(true);
          measureStartedOnThisDown.current = true;
        } else {
          const m: PcbMeasure = { id: crypto.randomUUID(), a: currentStart, b: p };
          setPcb((d) => ({ ...d, measures: [m] }));
          setMeasureA(null);
          measureStartedOnThisDown.current = false;
        }
      } else if (tool === "text") {
        const textLabel: import("@/lib/pcb").PcbText = {
          id: crypto.randomUUID(),
          text: inputText,
          x: p.x,
          y: p.y,
          size: Number(inputTextSize) || 2.0,
          layer: activeLayer === "bottom_copper" ? "bottom_copper" : (activeLayer === "top_copper" ? "top_copper" : activeLayer),
          rotation: 0
        };
        setPcb((d) => ({ ...d, texts: [...(d.texts || []), textLabel] }));
      } else {
        setSelection(null);
      }
    }
  };
  const onPointerMove = (e: React.PointerEvent) => {
    mousePos.current = { x: e.clientX, y: e.clientY, pointerType: e.pointerType };
    if (activePointers.current.has(e.pointerId)) {
      activePointers.current.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    }

    if (!dragFrameRequested.current) {
      dragFrameRequested.current = true;
      requestAnimationFrame(processPointerMove);
    }
  };

  const processPointerMove = () => {
    dragFrameRequested.current = false;
    const m = mousePos.current;
    if (!m) return;

    const screenToMm = (cx: number, cy: number) => {
      if (!svgRef.current) return { x: 0, y: 0 };
      const rect = svgRef.current.getBoundingClientRect();
      const x = (cx - rect.left - pan.x) / zoom;
      const y = (cy - rect.top - pan.y) / zoom;
      return { x, y };
    };

    if (activePointers.current.size === 0) {
      if (tool === "track" || tool === "via" || tool === "pad" || tool === "measure" || tool === "text") {
        setCursor(getSnappedPosition(screenToMm(m.x, m.y)));
      }
      return;
    }

    if (activePointers.current.size === 2 && gestureStart.current) {
      const pts = Array.from(activePointers.current.values());
      if (pts.length < 2) return;
      const dx = pts[0].clientX - pts[1].clientX;
      const dy = pts[0].clientY - pts[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const cx = (pts[0].clientX + pts[1].clientX) / 2;
      const cy = (pts[0].clientY + pts[1].clientY) / 2;

      const g = gestureStart.current;
      const zoomFactor = dist / g.distance;
      const nz = Math.max(0.5, Math.min(60, g.zoom * zoomFactor));
      const dcx = cx - g.center.x;
      const dcy = cy - g.center.y;
      const npx = g.pan.x + dcx;
      const npy = g.pan.y + dcy;

      setZoom(nz);
      setPan({ x: npx, y: npy });
      return;
    }

    if (activePointers.current.size === 1) {
      if (pcb.isImportedGerber && pendingDragRef.current && !isDragActiveRef.current) {
        const dx = m.x - pendingDragRef.current.clientX;
        const dy = m.y - pendingDragRef.current.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 8) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          pendingDragRef.current = null;
        }
      }

      const isTouch = m.pointerType === "touch" || m.pointerType === "pen";
      const isFootprintDrag = !!(dragGroup && (dragGroup.clickedKind === "footprint" || (dragGroup.origFootprints && dragGroup.origFootprints.length > 0)));
      const liftPx = (isTouch || isFootprintDrag) ? TOUCH_LIFT_PX : 0;
      const currentP = screenToMm(m.x, m.y - liftPx);
      if (!currentP) return;
      
      const snappedP = getSnappedPosition(currentP);
      if (tool === "track") {
        setCursor(snappedP);

        const startPt = (draftTrack && draftTrack.length > 0) ? draftTrack[draftTrack.length - 1] : trackPressStartRef.current;
        if (startPt) {
          const dist = Math.hypot(snappedP.x - startPt.x, snappedP.y - startPt.y);
          if (dist > 0.3) {
            isDraggingTrackRef.current = true;
          }

          if (isDraggingTrackRef.current && isPointerDown) {
            if (routingMode === "curved") {
              if (dist > 0.8) {
                setDraftTrack((prev) => prev ? [...prev, snappedP] : [startPt, snappedP]);
              }
            } else if (draftTrack && draftTrack.length > 0) {
              const prevPt = draftTrack.length > 1 ? draftTrack[draftTrack.length - 2] : null;
              if (prevPt) {
                const v1x = startPt.x - prevPt.x;
                const v1y = startPt.y - prevPt.y;
                const v2x = snappedP.x - startPt.x;
                const v2y = snappedP.y - startPt.y;
                const dot = v1x * v2x + v1y * v2y;
                const len1 = Math.hypot(v1x, v1y);
                const len2 = Math.hypot(v2x, v2y);
                if (len1 > 0.5 && len2 > 1.2) {
                  const cosAngle = dot / (len1 * len2);
                  if (cosAngle < 0.8) {
                    setDraftTrack((prev) => prev ? [...prev, startPt] : [startPt]);
                  }
                }
              }
            }
          }
        }
      }

      if (tool === "group_select" && marqueeStart) {
        setMarqueeEnd(currentP);
        return;
      }

      if (dragVertexIndex !== null && selectedTrackId !== null) {
        const p = getSnappedPosition(currentP);
        if (p) {
          setPcb((d) => ({
            ...d,
            tracks: d.tracks.map((t) => t.id === selectedTrackId ? {
              ...t,
              points: t.points.map((pt, idx) => idx === dragVertexIndex ? p : pt)
            } : t)
          }), true);
          setCursor(p);
        }
        return;
      }
      if (panStart) {
        setPan({ x: panStart.pan.x + (m.x - panStart.x), y: panStart.pan.y + (m.y - panStart.y) });
        return;
      }
      if (dragResize && dragResize.start) {
        if (!dragResize.moved) {
          commitHistory();
          dragResize.moved = true;
        }
        const dx = currentP.x - dragResize.start.x;
        const dy = currentP.y - dragResize.start.y;
        
        const grid = pcb.gridMm || 0.5;
        const snapDx = snappingEnabled ? Math.round(dx / grid) * grid : dx;
        const snapDy = snappingEnabled ? Math.round(dy / grid) * grid : dy;

        let newWidth = dragResize.origSize.width;
        let newHeight = dragResize.origSize.height;
        let shiftX = 0;
        let shiftY = 0;

        const type = dragResize.type;
        
        if (type === "both" || type === "width" || type === "right" || type === "bottom_right" || type === "top_right") {
          newWidth = Math.max(10, dragResize.origSize.width + snapDx);
        }
        if (type === "left" || type === "bottom_left" || type === "top_left") {
          newWidth = Math.max(10, dragResize.origSize.width - snapDx);
          shiftX = newWidth - dragResize.origSize.width;
        }
        
        if (type === "both" || type === "height" || type === "bottom" || type === "bottom_right" || type === "bottom_left") {
          newHeight = Math.max(10, dragResize.origSize.height + snapDy);
        }
        if (type === "top" || type === "top_right" || type === "top_left") {
          newHeight = Math.max(10, dragResize.origSize.height - snapDy);
          shiftY = newHeight - dragResize.origSize.height;
        }

        setPcb((d) => {
          const updated = { ...d };
          updated.width = newWidth;
          updated.height = newHeight;

          if (shiftX !== 0 || shiftY !== 0) {
            if (updated.footprints) {
              updated.footprints = updated.footprints.map(f => ({
                ...f,
                x: f.x + shiftX,
                y: f.y + shiftY,
                pads: f.pads.map(pad => ({ ...pad }))
              }));
            }
            if (updated.tracks) {
              updated.tracks = updated.tracks.map(t => ({
                ...t,
                points: t.points.map(pt => ({ x: pt.x + shiftX, y: pt.y + shiftY }))
              }));
            }
            if (updated.vias) {
              updated.vias = updated.vias.map(v => ({
                ...v,
                x: v.x + shiftX,
                y: v.y + shiftY
              }));
            }
            if (updated.pads) {
              updated.pads = updated.pads.map(pad => ({
                ...pad,
                x: pad.x + shiftX,
                y: pad.y + shiftY
              }));
            }
            if (updated.texts) {
              updated.texts = updated.texts.map(txt => ({
                ...txt,
                x: txt.x + shiftX,
                y: txt.y + shiftY
              }));
            }
            if (updated.measures) {
              updated.measures = updated.measures.map(m => ({
                ...m,
                a: { x: m.a.x + shiftX, y: m.a.y + shiftY },
                b: { x: m.b.x + shiftX, y: m.b.y + shiftY }
              }));
            }
          }

          return updated;
        }, true);
        return;
      }
      if (dragGroup && dragGroup.start) {
        const dx = currentP.x - dragGroup.start.x;
        const dy = currentP.y - dragGroup.start.y;
        
        const isTouch = m.pointerType === "touch" || m.pointerType === "pen";
        
        if (!dragGroup.moved) {
          if (isTouch && Math.hypot(dx, dy) < 0.2) {
            return;
          }
          commitHistory();
          dragGroup.moved = true;
        }
        const grid = pcb.gridMm || 0.5;
        const rawDx = dx;
        const rawDy = dy;

        let snapDx = snappingEnabled ? Math.round(rawDx / grid) * grid : rawDx;
        let snapDy = snappingEnabled ? Math.round(rawDy / grid) * grid : rawDy;
        
        // Alignment guides for footprints
        const newGuides: any[] = [];
        if (snappingEnabled && dragGroup.clickedKind === "footprint" && dragGroup.clickedId) {
          const moving = pcb.footprints.find(f => f.id === dragGroup.clickedId);
          const origMoving = dragGroup.origFootprints.find(o => o.id === dragGroup.clickedId);
          if (moving && origMoving) {
            const others = pcb.footprints.filter(f => f.id !== moving.id);
            const tempFpRaw = { ...moving, x: origMoving.x + rawDx, y: origMoving.y + rawDy };
            const movingPointsRaw = getFpPoints(tempFpRaw);
            
            const threshold = 0.5;
            let bestAlignX: number | null = null;
            let bestAlignY: number | null = null;
            let minDx = threshold;
            let minDy = threshold;

            for (const f of others) {
              const otherPoints = getFpPoints(f);
              for (const mx of movingPointsRaw.xs) {
                const localOffset = mx - (origMoving.x + rawDx);
                for (const ox of otherPoints.xs) {
                  const dist = Math.abs(mx - ox);
                  if (dist < minDx) {
                    minDx = dist;
                    bestAlignX = ox - origMoving.x - localOffset;
                  }
                }
              }
              for (const my of movingPointsRaw.ys) {
                const localOffset = my - (origMoving.y + rawDy);
                for (const oy of otherPoints.ys) {
                  const dist = Math.abs(my - oy);
                  if (dist < minDy) {
                    minDy = dist;
                    bestAlignY = oy - origMoving.y - localOffset;
                  }
                }
              }
            }

            if (bestAlignX !== null) snapDx = bestAlignX;
            if (bestAlignY !== null) snapDy = bestAlignY;

            // Generate stable guides based on final snap
            const finalFp = { ...moving, x: origMoving.x + snapDx, y: origMoving.y + snapDy };
            const finalPoints = getFpPoints(finalFp);
            const addedXs = new Set<number>();
            const addedYs = new Set<number>();

            for (const f of others) {
              const otherPoints = getFpPoints(f);
              for (const mx of finalPoints.xs) {
                for (const ox of otherPoints.xs) {
                  const roundedKey = Math.round(ox * 1000);
                  if (Math.abs(mx - ox) < 0.05 && !addedXs.has(roundedKey)) {
                    addedXs.add(roundedKey);
                    const matchedPts: { x: number; y: number; isPin: boolean }[] = [];
                    finalPoints.points.filter(p => Math.abs(p.x - ox) < 0.05).forEach(p => matchedPts.push({ x: ox, y: p.y, isPin: p.isPin }));
                    otherPoints.points.filter(p => Math.abs(p.x - ox) < 0.05).forEach(p => matchedPts.push({ x: ox, y: p.y, isPin: p.isPin }));

                    const ys = matchedPts.map(p => p.y);
                    const minY = ys.length > 0 ? Math.min(...ys) - 3 : -100;
                    const maxY = ys.length > 0 ? Math.max(...ys) + 3 : 100;

                    newGuides.push({
                      type: "alignment",
                      axis: "x",
                      x: ox,
                      y1: minY,
                      y2: maxY,
                      points: matchedPts,
                      label: `X: ${fmt(ox, unit)}`
                    });
                  }
                }
              }
              for (const my of finalPoints.ys) {
                for (const oy of otherPoints.ys) {
                  const roundedKey = Math.round(oy * 1000);
                  if (Math.abs(my - oy) < 0.05 && !addedYs.has(roundedKey)) {
                    addedYs.add(roundedKey);
                    const matchedPts: { x: number; y: number; isPin: boolean }[] = [];
                    finalPoints.points.filter(p => Math.abs(p.y - oy) < 0.05).forEach(p => matchedPts.push({ x: p.x, y: oy, isPin: p.isPin }));
                    otherPoints.points.filter(p => Math.abs(p.y - oy) < 0.05).forEach(p => matchedPts.push({ x: p.x, y: oy, isPin: p.isPin }));

                    const xs = matchedPts.map(p => p.x);
                    const minX = xs.length > 0 ? Math.min(...xs) - 3 : -100;
                    const maxX = xs.length > 0 ? Math.max(...xs) + 3 : 100;

                    newGuides.push({
                      type: "alignment",
                      axis: "y",
                      y: oy,
                      x1: minX,
                      x2: maxX,
                      points: matchedPts,
                      label: `Y: ${fmt(oy, unit)}`
                    });
                  }
                }
              }
            }
          }
        }
        setGuides((prev) => {
          const dims = prev.filter(g => g.type === "dimension");
          return [...dims, ...newGuides];
        });

        setPcb((d) => {
          const movingFpIds = dragGroup.origFootprints.map(o => o.id);
          
          const updatedFootprints = d.footprints.map((f) => {
            const orig = dragGroup.origFootprints.find((o) => o.id === f.id);
            if (orig) {
              return { ...f, x: orig.x + snapDx, y: orig.y + snapDy };
            }
            return f;
          });

          const updatedTracks = d.tracks.map((track) => {
            const origTrack = dragGroup.origTracks.find((o) => o.id === track.id);
            if (origTrack) {
              const points = origTrack.points.map(pt => ({ x: pt.x + snapDx, y: pt.y + snapDy }));
              [0, points.length - 1].forEach(idx => {
                const origPt = origTrack.points[idx];
                const onStaticPad = d.footprints
                  .filter(f => !movingFpIds.includes(f.id))
                  .some(f => {
                    const r = (f.rotation * Math.PI) / 180;
                    return f.pads.some(p => {
                      const rx = p.x * Math.cos(r) - p.y * Math.sin(r);
                      const ry = p.x * Math.sin(r) + p.y * Math.cos(r);
                      return Math.hypot(origPt.x - (f.x + rx), origPt.y - (f.y + ry)) < 0.15;
                    });
                  });
                if (onStaticPad) {
                  points[idx] = { x: origPt.x, y: origPt.y };
                  if (points.length >= 2) {
                    const nextIdx = idx === 0 ? 1 : points.length - 2;
                    const prevPt = points[idx];
                    const isHoriz = Math.abs(origTrack.points[idx].y - origTrack.points[nextIdx].y) < 0.01;
                    const isVert = Math.abs(origTrack.points[idx].x - origTrack.points[nextIdx].x) < 0.01;
                    if (isHoriz) points[nextIdx] = { ...points[nextIdx], y: prevPt.y };
                    else if (isVert) points[nextIdx] = { ...points[nextIdx], x: prevPt.x };
                  }
                }
              });
              return { ...track, points };
            } else {
              const conns = dragGroup.connectedTracks.filter(c => c.trackId === track.id);
              if (conns.length > 0) {
                const points = [...track.points];
                conns.forEach(conn => {
                  const fp = updatedFootprints.find(f => f.id === conn.fpId);
                  if (fp) {
                    const rad = (fp.rotation * Math.PI) / 180;
                    const cos = Math.cos(rad), sin = Math.sin(rad);
                    const pad = fp.pads.find(p => p.pinIndex === conn.padPinIndex);
                    if (pad) {
                      const px = fp.x + (pad.x * cos - pad.y * sin);
                      const py = fp.y + (pad.x * sin + pad.y * cos);
                      const newEnd = { x: px + conn.relX, y: py + conn.relY };
                      points[conn.pointIndex] = newEnd;
                      if (points.length >= 2) {
                        const nextIdx = conn.pointIndex === 0 ? 1 : points.length - 2;
                        const isHoriz = Math.abs(track.points[conn.pointIndex].y - track.points[nextIdx].y) < 0.01;
                        const isVert = Math.abs(track.points[conn.pointIndex].x - track.points[nextIdx].x) < 0.01;
                        if (isHoriz) points[nextIdx] = { ...points[nextIdx], y: newEnd.y };
                        else if (isVert) points[nextIdx] = { ...points[nextIdx], x: newEnd.x };
                      }
                    }
                  }
                });
                return { ...track, points };
              }
              return track;
            }
          });
          
          const updatedVias = d.vias.map((v) => {
            const orig = dragGroup.origVias.find((o) => o.id === v.id);
            if (orig) return { ...v, x: orig.x + snapDx, y: orig.y + snapDy };
            return v;
          });
          const updatedPads = d.pads.map((pd) => {
            const orig = dragGroup.origPads.find((o) => o.id === pd.id);
            if (orig) return { ...pd, x: orig.x + snapDx, y: orig.y + snapDy };
            return pd;
          });
          const updatedTexts = (d.texts || []).map((t) => {
            const orig = dragGroup.origTexts.find((o) => o.id === t.id);
            if (orig) return { ...t, x: orig.x + snapDx, y: orig.y + snapDy };
            return t;
          });
          
          return { ...d, footprints: updatedFootprints, tracks: updatedTracks, vias: updatedVias, pads: updatedPads, texts: updatedTexts };
        }, true);
        return;
      }
      if (dragText) {
        if (!dragText.moved) {
          commitHistory();
          dragText.moved = true;
        }
        const dx = currentP.x - dragText.start.x;
        const dy = currentP.y - dragText.start.y;
        const nx = Math.round((dragText.orig.x + dx) / pcb.gridMm) * pcb.gridMm;
        const ny = Math.round((dragText.orig.y + dy - ((isTouch && !pcb.isImportedGerber) ? 15 : 0)) / pcb.gridMm) * pcb.gridMm;
        setPcb((d) => ({ ...d, texts: (d.texts || []).map((t) => t.id === dragText.id ? { ...t, x: nx, y: ny } : t) }), true);
      }
      setCursor(getSnappedPosition(currentP));
    }
  };
  const onPointerUp = (e: React.PointerEvent) => {
    setIsPointerDown(false);
    (e.target as Element).releasePointerCapture?.(e.pointerId);
    activePointers.current.delete(e.pointerId);

    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pendingDragRef.current = null;
    isDragActiveRef.current = false;

    if (tool === "measure") {
      const currentStart = measureARef.current;
      if (currentStart) {
        const p = getSnappedPosition(screenToMm(e.clientX, e.clientY));
        const dist = Math.hypot(p.x - currentStart.x, p.y - currentStart.y);
        if (dist > 0.8) {
          const m: PcbMeasure = { id: crypto.randomUUID(), a: currentStart, b: p };
          setPcb((d) => ({ ...d, measures: [m] }));
          setMeasureA(null);
        } else {
          setIsDraggingMeasure(false);
          measureStartedOnThisDown.current = false;
        }
      }
    }

    if (tool === "group_select" && marqueeStart && marqueeEnd) {
      performMarqueeSelection(marqueeStart, marqueeEnd);
      setMarqueeStart(null);
      setMarqueeEnd(null);
    }

    if (activePointers.current.size < 2) {
      gestureStart.current = null;
    }

    if (tool === "track") {
      if (isDraggingTrackRef.current && (trackPressStartRef.current || (draftTrack && draftTrack.length > 0))) {
        const rawP = screenToMm(e.clientX, e.clientY);
        const pSnapped = getSnappedPosition(rawP);
        const startPts = draftTrack && draftTrack.length > 0 ? draftTrack : (trackPressStartRef.current ? [trackPressStartRef.current] : []);
        if (startPts.length > 0) {
          const pStart = startPts[startPts.length - 1];
          let routePts: { x: number; y: number }[] = [];
          if (Math.hypot(pSnapped.x - pStart.x, pSnapped.y - pStart.y) > 0.15) {
            if (routingMode === "45") {
              routePts = get45Route(pStart, pSnapped);
            } else if (routingMode === "90") {
              routePts = get90Route(pStart, pSnapped);
            } else {
              routePts = getCurvedRoute(pStart, pSnapped);
            }
          } else {
            routePts = [pStart];
          }

          const fullTrackPoints = [...startPts.slice(0, -1), ...routePts];
          if (fullTrackPoints.length >= 2) {
            const trackId = crypto.randomUUID();
            const startNetId = getNetAtCoordinate(fullTrackPoints[0]);
            const newTrack: PcbTrack = {
              id: trackId,
              layer: activeLayer,
              width: Number(selectedTrackWidth) || 0.25,
              points: fullTrackPoints,
              netId: startNetId ?? routingNetId ?? undefined,
            };

            setPcb((d) => ({
              ...d,
              tracks: [...d.tracks, newTrack]
            }));

            if (checkHasPadOrViaAtTarget(pSnapped)) {
              setDraftTrack(null);
              setRoutingNetId(null);
            } else {
              setDraftTrack([pSnapped]);
            }
          }
        }
      }
      isDraggingTrackRef.current = false;
      trackPressStartRef.current = null;
    }

    setPanStart(null);
    setDragGroup(null);
    setDragText(null);
    setDragResize(null);
    setGuides((prev) => prev.filter((g) => g.type === "dimension"));
    setDragVertexIndex(null);
    setIsInsertingVertex(false);
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isBg = target.tagName.toLowerCase() === "svg" || target.tagName.toLowerCase() === "rect";

    if (tool === "track" && draftTrack) {
      setDraftTrack(null);
      setRoutingNetId(null);
      return;
    }
    
    // Only open props if not clicking background
    if (!isBg) {
      setPropsOpen(true);
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    
    // Smooth touchpad pinch vs standard mouse wheel
    if (e.ctrlKey || e.metaKey) {
      // Touchpad continuous pinch
      const zoomFactor = Math.pow(1.012, -e.deltaY);
      const currentZoom = pendingZoom.current ?? zoom;
      const currentPan = pendingPan.current ?? pan;
      const nz = Math.max(0.2, Math.min(60, currentZoom * zoomFactor));
      const newPan = { x: cx - (cx - currentPan.x) * (nz / currentZoom), y: cy - (cy - currentPan.y) * (nz / currentZoom) };
      pendingPan.current = newPan;
      pendingZoom.current = nz;
    } else if (e.shiftKey) {
      // Horizontal scroll with Shift
      const currentPan = pendingPan.current ?? pan;
      pendingPan.current = { x: currentPan.x - e.deltaY, y: currentPan.y };
    } else {
      // Mouse wheel step zoom
      const factor = e.deltaY < 0 ? 1.14 : 1 / 1.14;
      const currentZoom = pendingZoom.current ?? zoom;
      const currentPan = pendingPan.current ?? pan;
      const nz = Math.max(0.2, Math.min(60, currentZoom * factor));
      const newPan = { x: cx - (cx - currentPan.x) * (nz / currentZoom), y: cy - (cy - currentPan.y) * (nz / currentZoom) };
      pendingPan.current = newPan;
      pendingZoom.current = nz;
    }
    
    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        if (pendingPan.current) setPan(pendingPan.current);
        if (pendingZoom.current !== null) setZoom(pendingZoom.current);
        rafId.current = null;
        pendingPan.current = null;
        pendingZoom.current = null;
      });
    }
  };

  const cancelDraft = () => { setDraftTrack(null); setMeasureA(null); setUnconfirmedTracks([]); };

  const handleAutoRoute = () => {
    const lines = computeRatsnest(schematic, pcb);
    if (lines.length === 0) return;

    const netIdx = schematicNetIndex;

    setPcb((d) => {
      const currentTracks = [...d.tracks];
      
      for (const line of lines) {
        const p1 = line.a;
        const p2 = line.b;
        const net = netIdx.nets.find(n => n.id === line.netId);
        const netName = net?.name?.toUpperCase() || "";
        
        // Power nets get thicker traces
        const isPower = netName.includes("VCC") || netName.includes("GND") || netName.includes("VDD") || netName.includes("VIN") || netName.includes("5V") || netName.includes("3V3");
        const parsedWidth = Number(selectedTrackWidth) || 0.25;
        const trackWidth = isPower ? Math.max(parsedWidth, 0.7) : parsedWidth;

        // Try to route orthogonally: p1 -> { x: p2.x, y: p1.y } -> p2
        const points = [
          { x: p1.x, y: p1.y },
          { x: p2.x, y: p1.y },
          { x: p2.x, y: p2.y }
        ];

        const trackId = crypto.randomUUID();
        const newTrack: PcbTrack = {
          id: trackId,
          layer: activeLayer === "bottom_copper" ? "bottom_copper" : "top_copper",
          width: trackWidth,
          points: points
        };

        const isDuplicate = currentTracks.some(t => 
          t.points.length === points.length &&
          t.points[0].x === points[0].x && t.points[0].y === points[0].y &&
          t.points[t.points.length - 1].x === points[points.length - 1].x && t.points[t.points.length - 1].y === points[points.length - 1].y
        );

        if (!isDuplicate) {
          currentTracks.push(newTrack);
        }
      }

      return {
        ...d,
        tracks: currentTracks
      };
    });
  };

  const fit = () => {
    if (!svgRef.current) return;
    const r = svgRef.current.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const margin = 35;
    
    // Compute actual bounding box including imported KiCad footprints, tracks, vias
    let minX = 0, minY = 0, maxX = pcb.width || 100, maxY = pcb.height || 100;
    if ((pcb.footprints && pcb.footprints.length > 0) || (pcb.tracks && pcb.tracks.length > 0)) {
      let bMinX = Infinity, bMinY = Infinity, bMaxX = -Infinity, bMaxY = -Infinity;
      (pcb.footprints || []).forEach(fp => {
        bMinX = Math.min(bMinX, fp.x - 8);
        bMaxX = Math.max(bMaxX, fp.x + 8);
        bMinY = Math.min(bMinY, fp.y - 8);
        bMaxY = Math.max(bMaxY, fp.y + 8);
      });
      (pcb.tracks || []).forEach(tr => {
        (tr.points || []).forEach(p => {
          bMinX = Math.min(bMinX, p.x);
          bMaxX = Math.max(bMaxX, p.x);
          bMinY = Math.min(bMinY, p.y);
          bMaxY = Math.max(bMaxY, p.y);
        });
      });
      (pcb.vias || []).forEach(v => {
        bMinX = Math.min(bMinX, v.x);
        bMaxX = Math.max(bMaxX, v.x);
        bMinY = Math.min(bMinY, v.y);
        bMaxY = Math.max(bMaxY, v.y);
      });
      (pcb.zones || []).forEach(z => {
        const bbox = getZoneBoundingBox(z);
        bMinX = Math.min(bMinX, bbox.minX);
        bMaxX = Math.max(bMaxX, bbox.maxX);
        bMinY = Math.min(bMinY, bbox.minY);
        bMaxY = Math.max(bMaxY, bbox.maxY);
      });
      if (Number.isFinite(bMinX) && bMaxX > bMinX) {
        minX = bMinX;
        minY = bMinY;
        maxX = bMaxX;
        maxY = bMaxY;
      }
    }
    
    const boardW = Math.max(20, maxX - minX);
    const boardH = Math.max(20, maxY - minY);
    const z = Math.min((r.width - margin * 2) / boardW, (r.height - margin * 2) / boardH);
    const finalZ = Math.max(0.4, Math.min(30, z));
    setZoom(finalZ);
    setPan({
      x: (r.width - boardW * finalZ) / 2 - minX * finalZ,
      y: (r.height - boardH * finalZ) / 2 - minY * finalZ
    });
    setBoardRotation(0);
  };

  useEffect(() => {
    const id = requestAnimationFrame(() => fit());
    return () => cancelAnimationFrame(id);
  }, []);

  const handleExportBOM = () => {
    const rows = [
      ["Reference", "Value", "Package", "Quantity"],
    ];
    
    const components = new Map<string, { value: string; package: string; count: number; refs: string[] }>();
    
    deferredPcb.footprints.forEach(fp => {
      const key = `${fp.symbol}|${fp.value}`;
      if (components.has(key)) {
        const existing = components.get(key)!;
        existing.count++;
        existing.refs.push(fp.reference);
      } else {
        components.set(key, { 
          value: fp.value || "N/A", 
          package: fp.symbol, 
          count: 1, 
          refs: [fp.reference] 
        });
      }
    });

    components.forEach((data) => {
      rows.push([
        data.refs.join(", "),
        data.value,
        data.package,
        data.count.toString()
      ]);
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + rows.map(e => e.join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BOM_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const updateLayer = (id: PcbLayerId, patch: Partial<PcbDoc["layers"][number]>) =>
    setPcb((d) => ({ ...d, layers: d.layers.map((l) => l.id === id ? { ...l, ...patch } : l) }));

  const cloneSelection = () => {
    const hasGroupSel = !!(groupSelected && (
      (groupSelected.footprints || []).length > 0 ||
      (groupSelected.tracks || []).length > 0 ||
      (groupSelected.vias || []).length > 0 ||
      (groupSelected.pads || []).length > 0 ||
      (groupSelected.texts || []).length > 0
    ));

    commitHistory();

    const dx = 10;
    const dy = 10;

    if (hasGroupSel && groupSelected) {
      setPcb((d) => {
        const newFpIds: string[] = [];
        const newTrackIds: string[] = [];
        const newViaIds: string[] = [];
        const newPadIds: string[] = [];
        const newTextIds: string[] = [];

        const getNextRef = (prefix: string, currentFootprints: PcbFootprint[]) => {
          let maxNum = 0;
          const regex = new RegExp(`^${prefix}(\\d+)$`);
          for (const f of currentFootprints) {
            if (f.reference) {
              const match = f.reference.match(regex);
              if (match) {
                maxNum = Math.max(maxNum, parseInt(match[1], 10));
              }
            }
          }
          return `${prefix}${maxNum + 1}`;
        };

        const updatedFootprints = [...d.footprints];
        const clonedFps = d.footprints
          .filter((f) => groupSelected.footprints.includes(f.id))
          .map((f) => {
            const newId = crypto.randomUUID();
            newFpIds.push(newId);
            const prefix = f.reference?.replace(/[0-9]/g, "") || "U";
            const newRef = getNextRef(prefix, updatedFootprints);
            const newFp = {
              ...f,
              id: newId,
              reference: newRef,
              x: Math.min(d.width - 2, f.x + dx),
              y: Math.min(d.height - 2, f.y + dy),
            };
            updatedFootprints.push(newFp);
            return newFp;
          });

        const clonedTracks = d.tracks
          .filter((t) => groupSelected.tracks.includes(t.id))
          .map((t) => {
            const newId = crypto.randomUUID();
            newTrackIds.push(newId);
            return {
              ...t,
              id: newId,
              points: t.points.map((p) => ({
                x: Math.min(d.width - 2, p.x + dx),
                y: Math.min(d.height - 2, p.y + dy),
              })),
            };
          });

        const clonedVias = d.vias
          .filter((v) => groupSelected.vias.includes(v.id))
          .map((v) => {
            const newId = crypto.randomUUID();
            newViaIds.push(newId);
            return {
              ...v,
              id: newId,
              x: Math.min(d.width - 2, v.x + dx),
              y: Math.min(d.height - 2, v.y + dy),
            };
          });

        const clonedPads = d.pads
          .filter((p) => groupSelected.pads.includes(p.id))
          .map((p) => {
            const newId = crypto.randomUUID();
            newPadIds.push(newId);
            return {
              ...p,
              id: newId,
              x: Math.min(d.width - 2, p.x + dx),
              y: Math.min(d.height - 2, p.y + dy),
            };
          });

        const clonedTexts = (d.texts || [])
          .filter((t) => groupSelected.texts.includes(t.id))
          .map((t) => {
            const newId = crypto.randomUUID();
            newTextIds.push(newId);
            return {
              ...t,
              id: newId,
              x: Math.min(d.width - 2, t.x + dx),
              y: Math.min(d.height - 2, t.y + dy),
            };
          });

        setTimeout(() => {
          setGroupSelected({
            footprints: newFpIds,
            tracks: newTrackIds,
            vias: newViaIds,
            pads: newPadIds,
            texts: newTextIds,
          });
        }, 0);

        return {
          ...d,
          footprints: updatedFootprints,
          tracks: [...d.tracks, ...clonedTracks],
          vias: [...d.vias, ...clonedVias],
          pads: [...d.pads, ...clonedPads],
          texts: [...(d.texts || []), ...clonedTexts],
        };
      });
    } else if (selection) {
      setPcb((d) => {
        const getNextRef = (prefix: string, currentFootprints: PcbFootprint[]) => {
          let maxNum = 0;
          const regex = new RegExp(`^${prefix}(\\d+)$`);
          for (const f of currentFootprints) {
            if (f.reference) {
              const match = f.reference.match(regex);
              if (match) {
                maxNum = Math.max(maxNum, parseInt(match[1], 10));
              }
            }
          }
          return `${prefix}${maxNum + 1}`;
        };

        const newId = crypto.randomUUID();

        if (selection.kind === "footprint") {
          const f = d.footprints.find((x) => x.id === selection.id);
          if (!f) return d;
          const prefix = f.reference?.replace(/[0-9]/g, "") || "U";
          const newRef = getNextRef(prefix, d.footprints);
          const cloned = {
            ...f,
            id: newId,
            reference: newRef,
            x: Math.min(d.width - 2, f.x + dx),
            y: Math.min(d.height - 2, f.y + dy),
          };
          setTimeout(() => {
            setSelection({ kind: "footprint", id: newId });
          }, 0);
          return {
            ...d,
            footprints: [...d.footprints, cloned],
          };
        } else if (selection.kind === "text") {
          const t = (d.texts || []).find((x) => x.id === selection.id);
          if (!t) return d;
          const cloned = {
            ...t,
            id: newId,
            x: Math.min(d.width - 2, t.x + dx),
            y: Math.min(d.height - 2, t.y + dy),
          };
          setTimeout(() => {
            setSelection({ kind: "text", id: newId });
          }, 0);
          return {
            ...d,
            texts: [...(d.texts || []), cloned],
          };
        } else if (selection.kind === "via") {
          const v = d.vias.find((x) => x.id === selection.id);
          if (!v) return d;
          const cloned = {
            ...v,
            id: newId,
            x: Math.min(d.width - 2, v.x + dx),
            y: Math.min(d.height - 2, v.y + dy),
          };
          setTimeout(() => {
            setSelection({ kind: "via", id: newId });
          }, 0);
          return {
            ...d,
            vias: [...d.vias, cloned],
          };
        } else if (selection.kind === "pad") {
          const p = d.pads.find((x) => x.id === selection.id);
          if (!p) return d;
          const cloned = {
            ...p,
            id: newId,
            x: Math.min(d.width - 2, p.x + dx),
            y: Math.min(d.height - 2, p.y + dy),
          };
          setTimeout(() => {
            setSelection({ kind: "pad", id: newId });
          }, 0);
          return {
            ...d,
            pads: [...d.pads, cloned],
          };
        } else if (selection.kind === "track") {
          const t = d.tracks.find((x) => x.id === selection.id);
          if (!t) return d;
          const cloned = {
            ...t,
            id: newId,
            points: t.points.map((pt) => ({
              x: Math.min(d.width - 2, pt.x + dx),
              y: Math.min(d.height - 2, pt.y + dy),
            })),
          };
          setTimeout(() => {
            setSelection({ kind: "track", id: newId });
          }, 0);
          return {
            ...d,
            tracks: [...d.tracks, cloned],
          };
        } else if (selection.kind === "measure") {
          const m = d.measures.find((x) => x.id === selection.id);
          if (!m) return d;
          const cloned = {
            ...m,
            id: newId,
            a: { x: Math.min(d.width - 2, m.a.x + dx), y: Math.min(d.height - 2, m.a.y + dy) },
            b: { x: Math.min(d.width - 2, m.b.x + dx), y: Math.min(d.height - 2, m.b.y + dy) },
          };
          setTimeout(() => {
            setSelection({ kind: "measure", id: newId });
          }, 0);
          return {
            ...d,
            measures: [...d.measures, cloned],
          };
        } else if (selection.kind === "zone") {
          const z = (d.zones || []).find((x) => x.id === selection.id);
          if (!z) return d;
          const cloned: PcbZone = {
            ...z,
            id: newId,
            polygon: {
              ...z.polygon,
              pts: z.polygon.pts.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
            },
            polygons: z.polygons?.map((poly) => ({
              ...poly,
              pts: poly.pts.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
            })),
            filledPolygons: z.filledPolygons?.map((fp) => ({
              ...fp,
              pts: fp.pts.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
              islandPts: fp.islandPts?.map((island) => island.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }))),
            })),
          };
          setTimeout(() => {
            setSelection({ kind: "zone", id: newId });
          }, 0);
          return {
            ...d,
            zones: [...(d.zones || []), cloned],
          };
        }
        return d;
      });
    }
  };

  const deleteSelection = () => {
    if (!selection) return;
    setPcb((d) => ({
      ...d,
      tracks: selection.kind === "track" ? d.tracks.filter((x) => x.id !== selection.id) : d.tracks,
      vias: selection.kind === "via" ? d.vias.filter((x) => x.id !== selection.id) : d.vias,
      pads: selection.kind === "pad" ? d.pads.filter((x) => x.id !== selection.id) : d.pads,
      measures: selection.kind === "measure" ? d.measures.filter((x) => x.id !== selection.id) : d.measures,
      footprints: selection.kind === "footprint" ? d.footprints.filter((x) => x.id !== selection.id) : d.footprints,
      texts: selection.kind === "text" ? (d.texts || []).filter((x) => x.id !== selection.id) : d.texts,
      zones: selection.kind === "zone" ? (d.zones || []).filter((x) => x.id !== selection.id) : (d.zones || []),
    }));
    setSelection(null);
  };

  const rotateSelection = () => {
    if (!selection) return;
    if (selection.kind === "footprint") {
      setPcb((d) => {
        const rotatingFp = (d.footprints || []).find((f) => f.id === selection.id);
        if (!rotatingFp) return d;
        
        const nextRotation = (rotatingFp.rotation + 90) % 360;
        
        const oldRad = (rotatingFp.rotation * Math.PI) / 180;
        const oldCos = Math.cos(oldRad);
        const oldSin = Math.sin(oldRad);
        
        const newRad = (nextRotation * Math.PI) / 180;
        const newCos = Math.cos(newRad);
        const newSin = Math.sin(newRad);
        
        const padMappings = rotatingFp.pads.map((pad) => {
          const origX = rotatingFp.x + (pad.x * oldCos - pad.y * oldSin);
          const origY = rotatingFp.y + (pad.x * oldSin + pad.y * oldCos);
          const newX = rotatingFp.x + (pad.x * newCos - pad.y * newSin);
          const newY = rotatingFp.y + (pad.x * newSin + pad.y * newCos);
          return { origX, origY, newX, newY };
        });
        
        const updatedFootprints = d.footprints.map((f) =>
          f.id === selection.id ? { ...f, rotation: nextRotation } : f
        );
        
        const updatedTracks = (d.tracks || []).map((track) => {
          if (!track.points || track.points.length === 0) return track;
          
          const points = [...track.points];
          const pFirst = points[0];
          const pLast = points[points.length - 1];
          
          // Check first point
          for (const map of padMappings) {
            if (Math.hypot(pFirst.x - map.origX, pFirst.y - map.origY) < 0.6) {
              points[0] = { x: map.newX, y: map.newY };
              break;
            }
          }
          
          // Check last point
          for (const map of padMappings) {
            if (Math.hypot(pLast.x - map.origX, pLast.y - map.origY) < 0.6) {
              points[points.length - 1] = { x: map.newX, y: map.newY };
              break;
            }
          }
          
          return { ...track, points };
        });
        
        return {
          ...d,
          footprints: updatedFootprints,
          tracks: updatedTracks
        };
      });
    } else if (selection.kind === "text") {
      setPcb((d) => ({
        ...d,
        texts: (d.texts || []).map((t) =>
          t.id === selection.id ? { ...t, rotation: (t.rotation + 90) % 360 } : t
        ),
      }));
    }
  };

  const deferredPan = useDeferredValue(pan);
  const deferredZoom = useDeferredValue(zoom);
  const viewportBounds = useMemo(() => {
    const width = containerDim.width || 1200;
    const height = containerDim.height || 800;
    const rawMinX = -deferredPan.x / deferredZoom - 60;
    const rawMinY = -deferredPan.y / deferredZoom - 60;
    const rawMaxX = (width - deferredPan.x) / deferredZoom + 60;
    const rawMaxY = (height - deferredPan.y) / deferredZoom + 60;

    // Quantize bounds to 25mm steps so panning within buffer doesn't re-trigger track filtering
    const step = 25;
    return {
      minX: Math.floor(rawMinX / step) * step,
      minY: Math.floor(rawMinY / step) * step,
      maxX: Math.ceil(rawMaxX / step) * step,
      maxY: Math.ceil(rawMaxY / step) * step,
    };
  }, [deferredPan, deferredZoom, containerDim.width, containerDim.height]);

  const visibleTracks = useMemo(() => {
    const tracks = pcb.tracks || [];
    if (!viewportBounds) return tracks;
    const { minX, maxX, minY, maxY } = viewportBounds;

    return tracks.filter((t) => {
      const pts = t.points;
      if (!pts || pts.length === 0) return false;
      let tMinX = pts[0].x, tMaxX = pts[0].x, tMinY = pts[0].y, tMaxY = pts[0].y;
      for (let i = 1; i < pts.length; i++) {
        if (pts[i].x < tMinX) tMinX = pts[i].x;
        if (pts[i].x > tMaxX) tMaxX = pts[i].x;
        if (pts[i].y < tMinY) tMinY = pts[i].y;
        if (pts[i].y > tMaxY) tMaxY = pts[i].y;
      }
      return tMaxX >= minX && tMinX <= maxX && tMaxY >= minY && tMinY <= maxY;
    });
  }, [pcb.tracks, viewportBounds]);

  const tracksToRenderIndividually = useMemo(() => {
    // If visible track count is small (<150), render them for direct hover/selection
    if (visibleTracks.length < 150) return visibleTracks;

    // For large boards (KiCad imports with hundreds/thousands of tracks), groupedVisualTracks
    // renders all visuals with 0 DOM lag. Only individualize tracks with active selection or highlight.
    const selectedSet = new Set<string>();
    if (selectedTrackId) selectedSet.add(selectedTrackId);
    if (groupSelected?.tracks) {
      groupSelected.tracks.forEach(id => selectedSet.add(id));
    }

    return visibleTracks.filter(tr => {
      if (selectedSet.has(tr.id)) return true;
      const trackNetId = trackNetMap.get(tr.id);
      if (trackNetId !== undefined && highlightedNetIds.includes(trackNetId)) return true;
      return false;
    });
  }, [visibleTracks, selectedTrackId, groupSelected?.tracks, trackNetMap, highlightedNetIds]);

  const visibleFootprints = useMemo(() => {
    if (!viewportBounds) return pcb.footprints || [];
    const { minX, maxX, minY, maxY } = viewportBounds;
    return (pcb.footprints || []).filter(f => 
      f.x >= minX - 50 && f.x <= maxX + 50 &&
      f.y >= minY - 50 && f.y <= maxY + 50
    );
  }, [pcb.footprints, viewportBounds]);

  const visibleVias = useMemo(() => {
    if (!viewportBounds) return pcb.vias || [];
    const { minX, maxX, minY, maxY } = viewportBounds;
    return (pcb.vias || []).filter(v => 
      v.x >= minX && v.x <= maxX &&
      v.y >= minY && v.y <= maxY
    );
  }, [pcb.vias, viewportBounds]);

  const visibleTexts = useMemo(() => {
    if (!viewportBounds) return pcb.texts || [];
    const { minX, maxX, minY, maxY } = viewportBounds;
    return (pcb.texts || []).filter(t => 
      t.x >= minX - 10 && t.x <= maxX + 10 &&
      t.y >= minY - 10 && t.y <= maxY + 10
    );
  }, [pcb.texts, viewportBounds]);

  const visiblePads = useMemo(() => {
    if (!viewportBounds) return pcb.pads || [];
    const { minX, maxX, minY, maxY } = viewportBounds;
    return (pcb.pads || []).filter(p => 
      p.x >= minX - 10 && p.x <= maxX + 10 &&
      p.y >= minY - 10 && p.y <= maxY + 10
    );
  }, [pcb.pads, viewportBounds]);

  const visibleZones = useMemo(() => {
    if (!viewportBounds) return pcb.zones || [];
    const { minX, maxX, minY, maxY } = viewportBounds;
    return (pcb.zones || []).filter((z) => {
      const bbox = getZoneBoundingBox(z);
      return (
        bbox.maxX >= minX - 10 &&
        bbox.minX <= maxX + 10 &&
        bbox.maxY >= minY - 10 &&
        bbox.minY <= maxY + 10
      );
    });
  }, [pcb.zones, viewportBounds]);

  const groupedVisualTracks = useMemo(() => {
    const groups = new Map<string, string[]>();
    
    visibleTracks.forEach((tr) => {
      const layer = pcb.layers.find((l) => l.id === tr.layer);
      if (!layer?.visible) return;
      
      if (selectedTrackId === tr.id) return; // Skip any selected track so it can be rendered individually on top
      
      const d = tr.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
      
      const isCopper = tr.layer === "top_copper" || tr.layer === "bottom_copper";
      let strokeColor = "";
      let renderWidth = tr.width;
      if (!isCopper) {
        strokeColor = layer?.color || (tr.layer === "outline" ? "#ffd166" : tr.layer === "silkscreen" ? "#fde047" : "#22c55e");
        if (tr.layer === "silkscreen" || tr.layer === "bottom_silkscreen") {
          renderWidth = Math.max(0.18, tr.width);
        }
      } else {
        const trackNetId = trackNetMap.get(tr.id);
        const isHi = trackNetId !== undefined && highlightedNetIds.includes(trackNetId);
        strokeColor = isHi ? "#2563eb" : (layer?.color || (tr.layer === "bottom_copper" ? "#3b82f6" : "#ef4444"));
      }
      
      const isActive = !dimInactiveLayers || tr.layer === activeLayer;
      const key = `${renderWidth}_${strokeColor}_${isActive}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    });
    
    return Array.from(groups.entries()).map(([key, paths]) => {
      const [widthStr, color, isActiveStr] = key.split("_");
      return { 
        width: parseFloat(widthStr), 
        color, 
        d: paths.join(" "), 
        isActive: isActiveStr === "true" 
      };
    });
  }, [visibleTracks, pcb.layers, trackNetMap, highlightedNetIds, selectedTrackId, activeLayer, dimInactiveLayers]);



  const onTrackPointerDown = useStableCallback((e: React.PointerEvent, tr: import("@/lib/pcb").PcbTrack) => {
    if (tool === "track") {
      e.stopPropagation();
      const rawP = screenToMm(e.clientX, e.clientY);
      const p = getSnappedPosition(rawP);
      handlePadRouteClick(p);
      return;
    }
    if (tool === "select" || tool === "group_select") {
      e.stopPropagation();
      registerPointer(e);
      const rawP = screenToMm(e.clientX, e.clientY);
      const bestTrack = findTrackAtPoint(visibleTracks, rawP.x, rawP.y, 1.2, activeLayer) || tr;
      if (bestTrack.layer) setActiveLayer(bestTrack.layer);
      startDragGroup(e, "track", bestTrack.id);
      selectNetInSchematic(bestTrack.netId);
    }
  });
  
  const onTrackDoubleClick = useStableCallback((e: React.MouseEvent, tr: import("@/lib/pcb").PcbTrack) => {
    e.stopPropagation();
    setPropsOpen(true);
  });

  const onViaPointerDown = useStableCallback((e: React.PointerEvent, v: import("@/lib/pcb").PcbVia) => {
    if (tool === "select" || tool === "group_select") {
      e.stopPropagation();
      registerPointer(e);
      startDragGroup(e, "via", v.id);
    } else if (tool === "track") {
      e.stopPropagation();
      handlePadRouteClick({ x: v.x, y: v.y });
    }
  });
  
  const onViaDoubleClick = useStableCallback((e: React.MouseEvent, v: import("@/lib/pcb").PcbVia) => {
    e.stopPropagation();
    setPropsOpen(true);
  });

  const onPadPointerDown = useStableCallback((e: React.PointerEvent, p: import("@/lib/pcb").PcbPad) => {
    if (tool === "select" || tool === "group_select") {
      e.stopPropagation();
      registerPointer(e);
      startDragGroup(e, "pad", p.id);
      onBackgroundClick?.();
    } else if (tool === "track") {
      e.stopPropagation();
      handlePadRouteClick({ x: p.x, y: p.y });
    }
  });

  const onZonePointerDown = useStableCallback((e: React.PointerEvent, z: import("@/lib/pcb").PcbZone) => {
    if (tool === "select" || tool === "group_select") {
      e.stopPropagation();
      registerPointer(e);
      if (z.layer) setActiveLayer(z.layer);
      setSelection({ kind: "zone", id: z.id });
      setSelectedTrackId(null);
      setSelectedId(null);
      setSelectedPin(null);
      setSelectedWireId(null);
      if (z.netId !== undefined) {
        selectNetInSchematic(z.netId);
      }
    }
  });

  const onZoneDoubleClick = useStableCallback((e: React.MouseEvent, z: import("@/lib/pcb").PcbZone) => {
    e.stopPropagation();
    setPropsOpen(true);
  });

  const onMeasurePointerDown = useStableCallback((e: React.PointerEvent, m: import("@/lib/pcb").PcbMeasure) => {
    if (tool === "select" || tool === "group_select") {
      e.stopPropagation();
      registerPointer(e);
      startDragGroup(e, "measure", m.id);
    }
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
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-0 px-0 h-9 border-b bg-card shrink-0 overflow-x-auto">
        {/* Mouse Pointer (Select) - FIRST button */}
        <ToolBtn active={tool==="select"} onClick={() => { setTool("select"); setGroupSelected(null); }} icon={<MousePointer2 className="size-4" />} label={lang === "ar" ? "تحديد فردي" : "Select"} />

        <ToolBtn active={tool==="group_select"} onClick={() => { setTool("group_select"); setGroupSelected(null); closeSidePanels(); }} icon={<MousePointerSquareDashed className="size-4" />} label={lang === "ar" ? "تحديد متعدد" : "Group Select"} />

        {/* Auto Route (Moved to the right of mouse pointer, styled as plain solid white button) */}
        <Button
          size="sm"
          onClick={handleAutoRoute}
          title={lang === "ar" ? "توجيه تلقائي ذكي" : "Heuristic Auto-Router"}
          className="h-7 gap-0.5 bg-black hover:bg-black/80 text-white border border-slate-700 transition-colors font-semibold shrink-0 text-xs px-1"
        >
          <Zap className="size-4 text-white" />
          <span className="hidden md:inline text-xs">{lang === "ar" ? "توجيه تلقائي" : "Auto-Route"}</span>
        </Button>

        {/* Ratsnest (Show/Hide lines) - Styled blue when active */}
        <Button
          size="sm"
          onClick={() => setPcb((d) => ({ ...d, ratsnestVisible: !d.ratsnestVisible }))}
          title={lang === "ar" ? "تظليل خطوط الربط" : "Toggle Ratsnest lines"}
          className={`h-7 px-1 gap-0.5 text-xs transition-colors ${
            (pcb.ratsnestVisible ?? true) 
              ? "bg-blue-600/40 text-white border border-blue-500/50" 
              : "bg-black text-white hover:bg-black/80 border border-slate-700"
          }`}
        >
          <Network className="size-4" />
          <span className="hidden sm:inline text-xs">{lang === "ar" ? "تظليل" : "Highlight"}</span>
        </Button>

        <ToolBtn active={tool==="track"} onClick={() => setTool("track")} icon={<Activity className="size-4" />} label={lang === "ar" ? "مسار" : "Track"} />
        <ToolBtn active={tool==="via"} onClick={() => setTool("via")} icon={<ThickCircleIcon className="size-4" />} label={lang === "ar" ? "عبر النحاس" : "Via"} />
        <ToolBtn active={tool==="pad"} onClick={() => setTool("pad")} icon={<SquareIcon className="size-4" />} label={lang === "ar" ? "وسادة" : "Pad"} />
        <ToolBtn active={tool==="measure"} onClick={() => setTool("measure")} icon={<Ruler className="size-4" />} label={lang === "ar" ? "قياس" : "Measure"} />
        <ToolBtn active={tool==="text"} onClick={() => setTool("text")} icon={<Type className="size-4" />} label={lang === "ar" ? "نص" : "Text"} />

        <Button
          size="sm"
          onClick={() => setThreeDOpen(true)}
          title={lang === "ar" ? "معاينة ثلاثية الأبعاد" : "3D Preview"}
          className="h-7 px-1 gap-0.5 text-xs bg-black hover:bg-black/80 text-white border border-slate-700 transition-colors"
        >
          <Box className="size-4" />
          <span className="hidden sm:inline text-xs">{lang === "ar" ? "معاينة 3D" : "3D View"}</span>
        </Button>

        <Button
          size="sm"
          onClick={() => setUiFootprintBrowserOpen(true)}
          title={lang === "ar" ? "متصفح وتوليد بصمات KiCad" : "KiCad Footprints & Generator"}
          className="h-7 px-1 gap-0.5 text-xs bg-black hover:bg-black/80 text-white border border-slate-700 transition-colors"
        >
          <LibraryIcon className="size-4" />
          <span className="hidden sm:inline text-xs">{lang === "ar" ? "مكتبة ومولد البصمات" : "FP Library & Generator"}</span>
        </Button>

        <Button
          size="sm"
          onClick={() => setUiLayersOpen(true)}
          title={lang === "ar" ? "الطبقات" : "Layers"}
          className="h-7 px-1 gap-0.5 text-xs bg-black hover:bg-black/80 text-white border border-slate-700"
        >
          <LayersIcon className="size-4" />
          <span className="hidden sm:inline text-xs">{lang === "ar" ? "طبقات" : "Layers"}</span>
        </Button>



        <div className="w-px h-6 bg-border mx-0.5" />

        <div className="ml-auto flex items-center gap-0.5 pr-1">
          {setEcoOpen && !pcb.isImportedGerber && (
            <Button
              size="sm"
              variant="ghost"
              className={`h-8 px-2 rounded-md text-xs font-bold gap-1 transition-all duration-300 relative ${
                hasEcoChanges
                  ? "bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-500 animate-pulse"
                  : "bg-muted/50 hover:bg-muted text-muted-foreground border border-border/60"
              }`}
              onClick={() => setEcoOpen(true)}
              title={lang === "ar" ? "نظام التغيير الهندسي (ECO)" : "Engineering Change Order (ECO) Sync"}
            >
              <ArrowLeftRight className={`size-3.5 ${hasEcoChanges ? "text-red-500" : ""}`} />
              <span>ECO</span>
              {hasEcoChanges && (
                <span className="flex h-2 w-2 rounded-full bg-red-500" />
              )}
            </Button>
          )}

          {(draftTrack || measureA) && (
            <Button size="icon" variant="ghost" onClick={cancelDraft} title={lang === "ar" ? "إلغاء" : "Cancel"}><X className="size-4 text-destructive" /></Button>
          )}
        </div>
      </div>

      {/* Tool Preset Options Bar */}
      {(tool === "track" || tool === "via" || tool === "text") && (
        <div className={`flex items-center ${(tool === "via" || tool === "track") ? "gap-2 px-2 py-0.5" : "gap-4 px-3 py-1.5"} bg-muted/40 border-b text-xs text-muted-foreground shrink-0 select-none overflow-x-auto animate-fade-in`}>
          {tool === "track" && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Width Preset selector */}
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground/90 font-medium shrink-0">
                  {lang === "ar" ? "العرض:" : "Width:"}
                </span>
                <select
                  className="h-7 w-20 rounded border bg-background px-1 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  value={widthPreset}
                  onChange={(e) => {
                    const val = e.target.value;
                    setWidthPreset(val);
                    if (val !== "custom") {
                      setSelectedTrackWidth(parseFloat(val));
                    }
                  }}
                >
                  <option value="0.15">0.15</option>
                  <option value="0.25">0.25 ({lang === "ar" ? "افتراضي" : "Def"})</option>
                  <option value="0.40">0.40</option>
                  <option value="0.60">0.60</option>
                  <option value="1.00">1.00</option>
                  <option value="custom">{lang === "ar" ? "مخصص" : "Cust"}</option>
                </select>

                {widthPreset === "custom" && (
                  <div className="flex items-center gap-1 shrink-0">
                    <input
                      type="number"
                      step="0.01"
                      min="0.05"
                      max="5.0"
                      className="h-7 w-12 rounded border bg-background px-1 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      value={selectedTrackWidth}
                      onChange={(e) => {
                        setSelectedTrackWidth(e.target.value);
                      }}
                      onBlur={() => {
                        const parsed = parseFloat(String(selectedTrackWidth));
                        if (isNaN(parsed) || parsed < 0.05) {
                          setSelectedTrackWidth(0.25);
                        } else if (parsed > 5.0) {
                          setSelectedTrackWidth(5.0);
                        } else {
                          setSelectedTrackWidth(parsed);
                        }
                      }}
                    />
                    <span className="text-[10px]">mm</span>
                  </div>
                )}
              </div>

              {/* Routing Mode segmented control */}
              <div className="flex items-center gap-1 bg-background/60 rounded p-0.5 border shrink-0">
                <button
                  type="button"
                  className={`h-6 px-2 rounded text-xs transition-all ${routingMode === "45" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setRoutingMode("45")}
                  title={lang === "ar" ? "توجيه بزاوية 45 درجة" : "45° routing"}
                >
                  45°
                </button>
                <button
                  type="button"
                  className={`h-6 px-2 rounded text-xs transition-all ${routingMode === "90" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setRoutingMode("90")}
                  title={lang === "ar" ? "توجيه بزاوية 90 درجة" : "90° routing"}
                >
                  90°
                </button>
                <button
                  type="button"
                  className={`h-6 px-2 rounded text-xs transition-all ${routingMode === "curve" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setRoutingMode("curve")}
                  title={lang === "ar" ? "توجيه منحني" : "Curved routing"}
                >
                  {lang === "ar" ? "منحني" : "Curved"}
                </button>
              </div>
            </div>
          )}

          {tool === "via" && (
            <div className="flex items-center gap-2 flex-wrap">
              {lang !== "ar" && (
                <span className="font-semibold text-foreground/80">
                  Via:
                </span>
              )}
              
              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground/90">{lang === "ar" ? "الثقب:" : "Drill:"}</span>
                <select
                  value={selectedViaSize.drill}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setSelectedViaSize(prev => {
                      let diameter = prev.diameter;
                      if (diameter <= val) {
                        const validDiameter = [0.6, 0.8, 1.0, 1.5, 2.0, 2.5, 3.0].find(d => d > val);
                        diameter = validDiameter || (val + 0.2);
                      }
                      return { drill: val, diameter };
                    });
                  }}
                  className="h-6 rounded border bg-background px-1 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary py-0"
                >
                  {[0.3, 0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0].map(v => (
                    <option key={v} value={v}>{v}mm</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-[11px] text-muted-foreground/90">{lang === "ar" ? "القطر:" : "Diameter:"}</span>
                <select
                  value={selectedViaSize.diameter}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setSelectedViaSize(prev => {
                      let drill = prev.drill;
                      if (drill >= val) {
                        const validDrills = [0.3, 0.4, 0.6, 0.8, 1.0, 1.2, 1.5, 2.0].filter(d => d < val);
                        drill = validDrills.length > 0 ? validDrills[validDrills.length - 1] : Math.max(0.1, val - 0.2);
                      }
                      return { drill, diameter: val };
                    });
                  }}
                  className="h-6 rounded border bg-background px-1 text-[11px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary py-0"
                >
                  {[0.6, 0.8, 1.0, 1.5, 2.0, 2.5, 3.0].map(v => (
                    <option key={v} value={v}>{v}mm</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-0.5 bg-background/60 rounded p-0.5 border shrink-0">
                <button
                  type="button"
                  className={`h-5 px-1.5 rounded-[3px] text-[10px] transition-all ${selectedViaShape === "circle" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSelectedViaShape("circle")}
                  title={lang === "ar" ? "مستدير" : "Round"}
                >
                  {lang === "ar" ? "مستدير" : "Round"}
                </button>
                <button
                  type="button"
                  className={`h-5 px-1.5 rounded-[3px] text-[10px] transition-all ${selectedViaShape === "square" ? "bg-primary text-primary-foreground font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setSelectedViaShape("square")}
                  title={lang === "ar" ? "مربع" : "Square"}
                >
                  {lang === "ar" ? "مربع" : "Square"}
                </button>
              </div>
            </div>
          )}

          {tool === "text" && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-foreground/80">
                  {lang === "ar" ? "نص:" : "Text:"}
                </span>
                <input
                  type="text"
                  className="h-7 rounded border bg-background px-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={lang === "ar" ? "اكتب هنا..." : "Type text..."}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="10"
                  className="h-7 w-16 rounded border bg-background px-2 text-xs text-foreground font-mono focus:outline-none focus:ring-1 focus:ring-ring"
                  value={inputTextSize}
                  onChange={(e) => setInputTextSize(e.target.value)}
                  onBlur={() => {
                    const parsed = parseFloat(String(inputTextSize));
                    if (isNaN(parsed) || parsed < 0.1) {
                      setInputTextSize(2.0);
                    } else if (parsed > 10.0) {
                      setInputTextSize(10.0);
                    } else {
                      setInputTextSize(parsed);
                    }
                  }}
                />
                <span className="text-[10px] text-muted-foreground font-mono">mm</span>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 min-h-0 flex relative">

        <div ref={viewportRef} className="flex-1 relative overflow-hidden" style={{ background: "#334155" }}>
          {showRulers && (
            <>
              {/* Unit Toggle Corner Cell */}
              <div 
                className="absolute top-0 left-0 w-6 h-6 bg-[#64748b] border-b border-r border-slate-500 flex items-center justify-center text-[9px] font-bold text-slate-100 font-mono select-none cursor-pointer hover:bg-slate-700 transition-colors z-20"
                onClick={() => setPcb(d => ({ ...d, unit: d.unit === "mm" ? "inch" : "mm" }))}
                title={lang === "ar" ? "اضغط لتغيير وحدة القياس" : "Click to toggle unit"}
              >
                {unit === "inch" ? "in" : "mm"}
              </div>

              {/* Top Ruler */}
              <div className="absolute top-0 left-6 right-0 h-6 bg-[#64748b] border-b border-slate-500 overflow-hidden select-none pointer-events-none z-10">
                <svg className="w-full h-full">
                  {hTicks.map((t, idx) => (
                    <g key={idx}>
                      <line
                        x1={t.pos}
                        y1={t.isMajor ? 10 : 16}
                        x2={t.pos}
                        y2={24}
                        stroke="#cbd5e1"
                        strokeWidth={1}
                      />
                      {t.isMajor && (
                        <text
                          x={t.pos}
                          y={8}
                          fill="#f8fafc"
                          fontSize={8}
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {t.val.toFixed(isInch ? 1 : 0)}
                        </text>
                      )}
                    </g>
                  ))}
                  {/* Cursor position marker */}
                  {cursor && cursor.x !== undefined && (
                    <line
                      x1={pan.x + cursor.x * zoom}
                      y1={0}
                      x2={pan.x + cursor.x * zoom}
                      y2={24}
                      stroke="#ef4444"
                      strokeWidth={1}
                      strokeDasharray="2 1"
                    />
                  )}
                </svg>
              </div>

              {/* Left Ruler */}
              <div className="absolute top-6 left-0 bottom-0 w-6 bg-[#64748b] border-r border-slate-500 overflow-hidden select-none pointer-events-none z-10">
                <svg className="w-full h-full">
                  {vTicks.map((t, idx) => (
                    <g key={idx}>
                      <line
                        x1={t.isMajor ? 10 : 16}
                        y1={t.pos}
                        x2={24}
                        y2={t.pos}
                        stroke="#cbd5e1"
                        strokeWidth={1}
                      />
                      {t.isMajor && (
                        <text
                          x={8}
                          y={t.pos}
                          fill="#f8fafc"
                          fontSize={8}
                          fontFamily="monospace"
                          textAnchor="end"
                          dominantBaseline="middle"
                        >
                          {t.val.toFixed(isInch ? 1 : 0)}
                        </text>
                      )}
                    </g>
                  ))}
                  {/* Cursor position marker */}
                  {cursor && cursor.y !== undefined && (
                    <line
                      x1={0}
                      y1={pan.y + cursor.y * zoom}
                      x2={24}
                      y2={pan.y + cursor.y * zoom}
                      stroke="#ef4444"
                      strokeWidth={1}
                      strokeDasharray="2 1"
                    />
                  )}
                </svg>
              </div>
            </>
          )}

          <div className={showRulers ? "absolute top-6 left-6 w-[calc(100%-24px)] h-[calc(100%-24px)] pointer-events-none z-0" : "absolute top-0 left-0 w-full h-full pointer-events-none z-0"}>
            <PcbCanvasLayer
              pcb={pcb}
              pan={pan}
              zoom={zoom}
              boardRotation={boardRotation}
              selectedTrackId={selectedTrackId}
              selectedId={selectedId}
              selection={selection}
              groupSelected={groupSelected}
              highlightedNetIds={highlightedNetIds}
              trackNetMap={trackNetMap}
              activeLayer={activeLayer}
              dimInactiveLayers={dimInactiveLayers}
              containerWidth={containerDim.width}
              containerHeight={containerDim.height}
            />
          </div>

          <svg
            ref={svgRef}
            className={showRulers ? "absolute top-6 left-6 w-[calc(100%-24px)] h-[calc(100%-24px)] touch-none" : "absolute top-0 left-0 w-full h-full touch-none"}
            style={{ cursor: tool === "pan" ? "grab" : (tool === "select" || tool === "group_select") ? "default" : "crosshair" }}
            onPointerDownCapture={onPointerDownCapture}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onPointerLeave={onPointerUp}
            onDoubleClick={onDoubleClick}
            onWheel={onWheel}
          >
            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom}) rotate(${boardRotation})`}>
              <rect x={0} y={0} width={pcb.width} height={pcb.height} fill="#121214" />

              <PcbGrid width={pcb.width} height={pcb.height} step={pcb.gridMm} zoom={zoom} />

              {pcb.layers.find((l) => l.id === "outline")?.visible && (
                <rect
                  x={0} y={0} width={pcb.width} height={pcb.height}
                  fill="none"
                  stroke={pcb.layers.find((l) => l.id === "outline")!.color}
                  strokeWidth={0.2}
                />
              )}

              {/* Native PCB Zones, Copper Pours, and Keepouts */}
              {visibleZones.map((z) => {
                const layer = pcb.layers.find((l) => l.id === z.layer);
                if (layer && !layer.visible) return null;
                const sel = selection?.kind === "zone" && selection.id === z.id;
                const isZoneHi = z.netId !== undefined && highlightedNetIds.includes(z.netId);
                const isActive = !dimInactiveLayers || z.layer === activeLayer || (z.layers && z.layers.includes(activeLayer));
                return (
                  <g key={z.id} data-zone-id={z.id} style={{ pointerEvents: isActive ? "auto" : "none", opacity: isActive ? 1 : 0.25 }}>
                    <MemoizedPcbZone
                      zone={z}
                      layer={layer}
                      sel={sel}
                      isGroupSel={false}
                      isZoneHi={isZoneHi}
                      onPointerDown={onZonePointerDown}
                      onDoubleClick={onZoneDoubleClick}
                    />
                  </g>
                );
              })}

              {visiblePads.map((p) => {
                const layer = pcb.layers.find((l) => l.id === p.layer);
                const sel = selection?.kind === "pad" && selection.id === p.id;
                const isGroupSel = groupSelected?.pads.includes(p.id) || false;
                const isActive = !dimInactiveLayers || p.layer === activeLayer || p.layer === "multi_layer" || p.drill !== undefined;
                return (
                  <g key={p.id} style={{ pointerEvents: isActive ? "auto" : "none", opacity: isActive ? 1 : 0.25 }}>
                    <MemoizedPcbPad pad={p} layer={layer} sel={sel} isGroupSel={isGroupSel} onPointerDown={onPadPointerDown} />
                  </g>
                );
              })}

              {groupedVisualTracks.map((group, i) => (
                <path
                  key={i}
                  d={group.d}
                  stroke={group.color}
                  strokeWidth={group.width}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ 
                    pointerEvents: "none",
                    opacity: group.isActive ? 1 : 0.25
                  }}
                />
              ))}

              {tracksToRenderIndividually.map((tr) => {
                const layer = pcb.layers.find((l) => l.id === tr.layer);
                if (layer && !layer.visible) return null;

                const sel = selectedTrackId === tr.id;
                const trackNetId = trackNetMap.get(tr.id);
                const isHi = trackNetId !== undefined && highlightedNetIds.includes(trackNetId);
                const isGroupSel = groupSelected?.tracks.includes(tr.id);

                const d = tr.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`).join(" ");
                const isActive = !dimInactiveLayers || tr.layer === activeLayer;
                const trWidth = tr.width || 0.4;
                
                return (
                  <g key={tr.id} data-track-id={tr.id} style={{ opacity: isActive ? 1 : 0.45 }}>
                    {/* Generous hit-test overlay along entire track path for instant selection anywhere */}
                    <path
                      d={d}
                      stroke="rgba(0,0,0,0.001)"
                      strokeWidth={Math.max(trWidth + 2.0, 2.2)}
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        registerPointer(e);
                        if (tr.layer) setActiveLayer(tr.layer);
                        setSelectedTrackId(tr.id);
                        setSelection({ kind: "track", id: tr.id });
                        setSelectedId(null);
                        setSelectedPin(null);
                        setSelectedWireId(null);
                        startDragGroup(e, "track", tr.id);
                        selectNetInSchematic(tr.netId);
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setPropsOpen(true);
                      }}
                      style={{ cursor: "pointer", pointerEvents: "stroke" }}
                    />
                    
                    {/* Selected track indicator */}
                    {sel && (
                      <path d={d} stroke="#3b82f6" strokeWidth={Math.max(trWidth * 1.5, trWidth + 1.0)}
                        fill="none" strokeLinecap="round" strokeLinejoin="round"
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                    
                    {/* Neon glow effect for highlighted track */}
                    {isHi && (
                      <path d={d} stroke="#3b82f6" strokeWidth={trWidth * 2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.5} style={{ pointerEvents: "none" }} />
                    )}
                    {/* Group selection amber glow */}
                    {isGroupSel && (
                      <path d={d} stroke="#f59e0b" strokeWidth={trWidth + 2.5} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.7} style={{ pointerEvents: "none" }} />
                    )}
                    {/* Semi-transparent blue selection highlight outline */}
                    {sel && (
                      <path d={d} stroke="rgba(59, 130, 246, 0.6)" strokeWidth={trWidth + 0.8} fill="none" strokeLinecap="round" strokeLinejoin="round" opacity={0.8} style={{ pointerEvents: "none" }} />
                    )}
                  </g>
                );
              })}

              {visibleVias.map((v) => {
                const sel = selection?.kind === "via" && selection.id === v.id;
                const isGroupSel = groupSelected?.vias.includes(v.id) || false;
                const drillLayer = pcb.layers.find((l) => l.id === "drill");
                if (drillLayer && !drillLayer.visible) return null;
                
                const isActive = !dimInactiveLayers || activeLayer === "top_copper" || activeLayer === "bottom_copper" || activeLayer === "drill" || activeLayer === "outline";
                return (
                  <g key={v.id} data-via-id={v.id} style={{ pointerEvents: isActive ? "auto" : "none", opacity: isActive ? 1 : 0.25 }}>
                    <MemoizedPcbVia key={v.id} via={v} layer={drillLayer} sel={sel} isGroupSel={isGroupSel} onPointerDown={onViaPointerDown} onDoubleClick={onViaDoubleClick} />
                  </g>
                );
              })}

              {pcb.measures.map((m) => {
                const dx = m.b.x - m.a.x, dy = m.b.y - m.a.y;
                const dist = Math.hypot(dx, dy);
                return (
                  <g key={m.id} 
                    onPointerDown={(e) => { 
                      if (tool === "select" || tool === "group_select") {
                        e.stopPropagation(); 
                        setSelection({ kind: "measure", id: m.id }); 
                      }
                    }} 
                    onDoubleClick={(e) => { e.stopPropagation(); setPropsOpen(true); }}
                    style={{ cursor: "pointer" }}
                  >
                    {/* Measurement line */}
                    <line x1={m.a.x} y1={m.a.y} x2={m.b.x} y2={m.b.y} stroke="#ea580c" strokeWidth={0.18} strokeDasharray="0.6 0.4" />
                    
                    {/* Start point - Large Plus sign */}
                    <g>
                      <line x1={m.a.x - 3.5} y1={m.a.y} x2={m.a.x + 3.5} y2={m.a.y} stroke="#ea580c" strokeWidth={0.35} />
                      <line x1={m.a.x} y1={m.a.y - 3.5} x2={m.a.x} y2={m.a.y + 3.5} stroke="#ea580c" strokeWidth={0.35} />
                      <circle cx={m.a.x} cy={m.a.y} r={0.5} fill="#ea580c" />
                    </g>
                    
                    {/* End point - Large Plus sign */}
                    <g>
                      <line x1={m.b.x - 3.5} y1={m.b.y} x2={m.b.x + 3.5} y2={m.b.y} stroke="#ea580c" strokeWidth={0.35} />
                      <line x1={m.b.x} y1={m.b.y - 3.5} x2={m.b.x} y2={m.b.y + 3.5} stroke="#ea580c" strokeWidth={0.35} />
                      <circle cx={m.b.x} cy={m.b.y} r={0.5} fill="#ea580c" />
                    </g>

                    {/* Measurement Info - clear orange text, no shading/background card, translated safely to the left and out of the way */}
                    <g transform={`translate(${m.b.x - 5.0}, ${m.b.y - 4.0})`} textAnchor="end">
                      <text x={0} y={0} fontSize={2.0} fill="#ea580c" fontWeight="bold">
                        {fmt(dist, unit)}
                      </text>
                    </g>
                  </g>
                );
              })}

              {visibleTexts.map((t) => {
                const layer = pcb.layers.find((l) => l.id === t.layer);
                if (layer && !layer.visible) return null;
                const sel = selection?.kind === "text" && selection.id === t.id;
                const isGroupSel = groupSelected?.texts.includes(t.id);
                const col = isGroupSel ? "#f59e0b" : sel ? "#3b82f6" : (layer?.color || (t.layer === "silkscreen" ? "#fde047" : t.layer === "bottom_silkscreen" ? "#fde047" : "#22c55e"));
                const isActive = !dimInactiveLayers || t.layer === activeLayer;
                return (
                  <g
                    key={t.id}
                    data-text-id={t.id}
                    transform={`translate(${t.x},${t.y}) rotate(${t.rotation})`}
                    onPointerDown={(e) => {
                      if (!isActive) return;
                      if (tool !== "select" && tool !== "group_select") return;
                      e.stopPropagation();
                      registerPointer(e);
                      startDragGroup(e, "text", t.id);
                    }}
                    onDoubleClick={(e) => {
                      if (!isActive) return;
                      e.stopPropagation();
                      setPropsOpen(true);
                    }}
                    style={{ 
                      pointerEvents: isActive ? "auto" : "none", 
                      opacity: isActive ? 1 : 0.25,
                      cursor: (tool === "select" || tool === "group_select") && isActive ? "move" : "default" 
                    }}
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
                      pointerEvents="none"
                    >
                      {t.text}
                    </text>
                    {isGroupSel && (
                      <rect
                        x={-t.text.length * t.size * 0.3 - 0.3}
                        y={-t.size * 0.5 - 0.3}
                        width={t.text.length * t.size * 0.6 + 0.6}
                        height={t.size + 0.6}
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth={0.15}
                        strokeDasharray="0.3 0.2"
                      />
                    )}
                    {sel && (
                      <rect
                        x={-t.text.length * t.size * 0.3 - 0.4}
                        y={-t.size * 0.5 - 0.4}
                        width={t.text.length * t.size * 0.6 + 0.8}
                        height={t.size + 0.8}
                        fill="rgba(59, 130, 246, 0.12)"
                        stroke="#3b82f6"
                        strokeWidth={0.3}
                        rx={0.2}
                      />
                    )}
                  </g>
                );
              })}

              {(pcb.graphics || []).map((g) => {
                const layer = pcb.layers.find((l) => l.id === g.layer);
                const sel = selection?.kind === "graphic" && selection.id === g.id;
                const isGroupSel = g.groupId ? groupSelected?.tracks?.includes(g.id) || false : false;
                return (
                  <MemoizedPcbGraphic
                    key={g.id}
                    graphic={g}
                    layer={layer}
                    sel={sel}
                    isGroupSel={isGroupSel}
                    onPointerDown={(e) => {
                      if (tool !== "select" && tool !== "group_select") return;
                      e.stopPropagation();
                      setSelection({ kind: "graphic", id: g.id });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setPropsOpen(true);
                    }}
                  />
                );
              })}

              {(pcb.dimensions || []).map((dim) => {
                const layer = pcb.layers.find((l) => l.id === dim.layer);
                const sel = selection?.kind === "dimension" && selection.id === dim.id;
                const isGroupSel = false;
                return (
                  <MemoizedPcbDimension
                    key={dim.id}
                    dimension={dim}
                    layer={layer}
                    sel={sel}
                    isGroupSel={isGroupSel}
                    onPointerDown={(e) => {
                      if (tool !== "select" && tool !== "group_select") return;
                      e.stopPropagation();
                      setSelection({ kind: "dimension", id: dim.id });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setPropsOpen(true);
                    }}
                  />
                );
              })}

              {(pcb.targets || []).map((tg) => {
                const layer = pcb.layers.find((l) => l.id === tg.layer);
                const sel = selection?.kind === "target" && selection.id === tg.id;
                const isGroupSel = false;
                return (
                  <MemoizedPcbTarget
                    key={tg.id}
                    target={tg}
                    layer={layer}
                    sel={sel}
                    isGroupSel={isGroupSel}
                    onPointerDown={(e) => {
                      if (tool !== "select" && tool !== "group_select") return;
                      e.stopPropagation();
                      setSelection({ kind: "target", id: tg.id });
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setPropsOpen(true);
                    }}
                  />
                );
              })}

              {visibleFootprints.map((fp) => {
                const sel = selection?.kind === "footprint" && selection.id === fp.id;

                // KiCad-origin footprints are rendered exclusively from the KiCad
                // runtime. The legacy CirZuit package heuristics below are never
                // allowed to alter imported KiCad geometry.
                if (fp.nativeKicadFootprint) {
                  const native = fp.nativeKicadFootprint;
                  const b = nativeFootprintBounds(native);
                  const hasBottom = native.pads.some(p => p.layers.includes("B.Cu") && !p.layers.includes("F.Cu"));
                  const fpSideBottom = hasBottom && !native.pads.some(p => p.layers.includes("F.Cu") && !p.layers.includes("B.Cu"));
                  const activeBottom = activeLayer === "bottom_copper" || activeLayer === "bottom_silkscreen" || activeLayer === "bottom_solder_mask";
                  const isFpActive = !dimInactiveLayers || (fpSideBottom === activeBottom);
                  return (
                    <g key={fp.id} data-footprint-id={fp.id}
                      transform={`translate(${fp.x} ${fp.y}) rotate(${fp.rotation || 0})`}
                      style={{ pointerEvents: isFpActive ? "auto" : "none", opacity: isFpActive ? 1 : 0.25, cursor: (tool === "select" || tool === "group_select") && isFpActive ? "move" : "default" }}
                      onPointerDown={(e) => {
                        if (!isFpActive || (tool !== "select" && tool !== "group_select")) return;
                        e.stopPropagation(); registerPointer(e); startDragGroup(e, "footprint", fp.id);
                      }}
                      onDoubleClick={(e) => {
                        if (!isFpActive) return;
                        e.stopPropagation(); setPropsOpen(true);
                      }}>
                      {(() => {
                        const isGroupSel = !!groupSelected?.footprints.includes(fp.id);
                        return (
                          <>
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
                          </>
                        );
                      })()}
                      <KicadFootprintRenderer
                        footprint={native}
                        reference={fp.reference || native.properties?.Reference || "REF**"}
                        value={fp.value || native.properties?.Value || native.name}
                        selected={sel || !!groupSelected?.footprints.includes(fp.id)}
                        activeLayer={activeLayer === "bottom_copper" ? "bottom_copper" : "top_copper"}
                        layerColors={layerColorsMap}
                        layerVisibility={layerVisibilityMap}
                        dimInactiveLayers={dimInactiveLayers}
                        onGeometryPointerDown={(e, item) => {
                          const padNumber = typeof item.metadata?.padNumber === "string" ? item.metadata.padNumber : undefined;
                          if (!padNumber) return;
                          const pad = fp.pads.find(p => p.number === padNumber);
                          if (!pad) return;
                          e.stopPropagation(); onFootprintPadPointerDown(e, fp, pad);
                        }}
                        onGeometryDoubleClick={(e, item) => {
                          const padNumber = typeof item.metadata?.padNumber === "string" ? item.metadata.padNumber : undefined;
                          if (!padNumber) return;
                          const pad = fp.pads.find(p => p.number === padNumber);
                          if (!pad) return;
                          e.stopPropagation(); onFootprintPadDoubleClick(e, fp, pad);
                        }}
                      />
                    </g>
                  );
                }

                const bb = footprintBBox(fp);

                const hasBottomPads = fp.pads.some(pad => pad.layer === "bottom_copper");
                const fpSide = hasBottomPads ? "bottom" : "top";
                const isBottomActive = activeLayer === "bottom_copper" || activeLayer === "bottom_silkscreen" || activeLayer === "bottom_solder_mask";
                const isFpActive = !dimInactiveLayers || ((fpSide === "bottom" && isBottomActive) || (fpSide === "top" && !isBottomActive));

                const silkLayerId = fpSide === "bottom" ? "bottom_silkscreen" : "silkscreen";
                const silkLayer = pcb.layers.find(l => l.id === silkLayerId);
                const isSilkVisible = silkLayer?.visible !== false;

                return (
                  <g key={fp.id}
                    data-footprint-id={fp.id}
                    onPointerDown={(e) => {
                      if (!isFpActive) return;
                      if (tool !== "select" && tool !== "group_select") return;
                      e.stopPropagation();
                      registerPointer(e);
                      startDragGroup(e, "footprint", fp.id);
                    }}
                    onDoubleClick={(e) => {
                      if (!isFpActive) return;
                      e.stopPropagation();
                      setPropsOpen(true);
                    }}
                    style={{ 
                      pointerEvents: isFpActive ? "auto" : "none", 
                      opacity: isFpActive ? 1 : 0.25,
                      cursor: (tool === "select" || tool === "group_select") && isFpActive ? "move" : "default" 
                    }}
                  >
                    {(() => {
                      const sym = (fp.symbol || "").toLowerCase();
                      const ref = (fp.reference || "").toLowerCase();
                      const val = (fp.value || "").toLowerCase();

                      const isPolarCap = checkIfPolarizedCapacitor(fp);
                      const isNonPolarCap = (sym.includes("capacitor") || ref.startsWith("c")) && !isPolarCap;
                      const isCap = isPolarCap || isNonPolarCap;
                      
                      const isDiode = sym.includes("diode") || ref.startsWith("d");

                      const transistorKeywords = ["transistor", "npn", "pnp", "mosfet", "bjt", "fet", "2n2222", "2n3904", "bc547", "bc557", "irf540", "irfz44", "irf9540", "bs170", "2n7000", "ao3400", "c1815", "a1015", "2n3055", "tip31", "tip122", "2n"];
                      const regulatorKeywords = ["regulator", "7805", "7812", "7809", "7806", "7815", "7824", "7905", "7912", "lm317", "ams1117", "vreg", "ldo", "tl431", "lm7805", "lm7812"];

                      const isTransistor = transistorKeywords.some(k => sym.includes(k) || val.includes(k)) || ref.startsWith("q") || ref.startsWith("m") || ref.startsWith("t") || ref.startsWith("vt") || fp.packageId === "to92" || fp.packageId === "to220" || fp.packageId === "sot23" || fp.packageId === "sot223" || fp.packageId === "dpak";
                      const isRegulator = regulatorKeywords.some(k => sym.includes(k) || val.includes(k)) || ref.startsWith("vr") || (ref.startsWith("u") && (sym.includes("reg") || sym.includes("78") || sym.includes("317") || sym.includes("1117") || sym.includes("ams")));
                      const isFuse = sym.includes("fuse") || ref.startsWith("f");
                      const isResistor = sym.includes("resistor") || ref.startsWith("r");
                      const isInductor = sym.includes("inductor") || ref.startsWith("l");
                      const isCrystal = sym.includes("crystal") || ref.startsWith("y");
                      const isESP32 = sym.includes("esp32") || val.includes("esp32");
                      const isESP8266 = sym.includes("esp8266") || val.includes("esp8266") || val.includes("nodemcu");
                      const isArduinoNano = (sym.includes("arduino") && sym.includes("nano")) || (val.includes("arduino") && val.includes("nano"));
                      const isArduinoMini = (sym.includes("arduino") && sym.includes("mini")) || (val.includes("arduino") && val.includes("mini"));
                      const isArduinoUno = (sym.includes("arduino") && (sym.includes("uno") || sym.includes("mega"))) || (val.includes("arduino") && (val.includes("uno") || val.includes("mega")));
                      const isRaspberryPico = sym.includes("pico") || sym.includes("rp2040") || val.includes("pico") || val.includes("rp2040");
                      const isBoardController = isESP32 || isESP8266 || isArduinoNano || isArduinoMini || isArduinoUno || isRaspberryPico;

                      const isScrewTerminal = sym.startsWith("conn_screw") || sym.includes("screw") || (fp.metadata?.type === "SCREW_TERMINAL");
                      const isConnector = !isBoardController && !isScrewTerminal && (sym.includes("header") || sym.includes("connector") || sym.includes("terminal") || sym.includes("jack") || sym.includes("usb") || ref.startsWith("j"));
                      const isSwitch = sym.includes("switch") || sym.includes("button") || ref.startsWith("sw");
                      const isLED = sym.includes("led") || (isDiode && sym.includes("light"));
                      const isDisplay = sym.includes("display") || sym.includes("lcd") || sym.includes("oled") || sym.includes("7-seg") || ref.startsWith("ds");
                      const isDipSocket = sym.includes("dip") || sym.includes("socket") || val.includes("dip") || val.includes("socket") || (fp.packageId && fp.packageId.toLowerCase().includes("dip")) || (fp.footprint && fp.footprint.toLowerCase().includes("dip"));
                      const isIC = !isBoardController && !isTransistor && !isRegulator && !isDisplay && (sym.includes("ic") || sym.includes("opamp") || sym.includes("logic") || sym.includes("mcu") || sym.includes("ne555") || sym.includes("atmega") || ref.startsWith("u") || isDipSocket);

                      let minPX = 0, minPY = 0, maxPX = 0, maxPY = 0;
                      fp.pads.forEach((p, idx) => {
                        if (idx === 0) {
                          minPX = p.x - p.width / 2; maxPX = p.x + p.width / 2;
                          minPY = p.y - p.height / 2; maxPY = p.y + p.height / 2;
                        } else {
                          minPX = Math.min(minPX, p.x - p.width / 2); maxPX = Math.max(maxPX, p.x + p.width / 2);
                          minPY = Math.min(minPY, p.y - p.height / 2); maxPY = Math.max(maxPY, p.y + p.height / 2);
                        }
                      });
                      const borderOffset = 0.5;
                      const rectW = maxPX - minPX + borderOffset * 2;
                      const rectH = maxPY - minPY + borderOffset * 2;
                      const rectX = minPX - borderOffset;
                      const rectY = minPY - borderOffset;
                      const nonPolarCx = (minPX + maxPX) / 2;
                      const nonPolarCy = (minPY + maxPY) / 2;
                      const pad0 = fp.pads[0];
                      const pad1 = fp.pads[1];
                      const angle = pad0 && pad1 ? Math.atan2(pad1.y - pad0.y, pad1.x - pad0.x) * (180 / Math.PI) : 0;
                      const capValRaw = fp.value || (fp as any).val || "10uF";
                      const capSize = getElectrolyticSize(capValRaw);
                      const d = pad0 && pad1 ? Math.hypot(pad0.x - pad1.x, pad0.y - pad1.y) : capSize.pitch;
                      const r = isPolarCap ? (capSize.w + 0.5) / 2 : Math.max(d * 0.6, 2.5);
                      const cx = pad0 && pad1 ? (pad0.x + pad1.x) / 2 : 0;
                      const cy = pad0 && pad1 ? (pad0.y + pad1.y) / 2 : 0;

                      return (
                        <>
                          {isSilkVisible && (
                            <rect x={bb.x} y={bb.y} width={bb.w} height={bb.h}
                              fill={groupSelected?.footprints.includes(fp.id) ? "rgba(245, 158, 11, 0.35)" : sel ? "rgba(59, 130, 246, 0.15)" : "rgba(234, 179, 8, 0.02)"}
                              stroke={groupSelected?.footprints.includes(fp.id) ? "#f59e0b" : sel ? "#3b82f6" : "none"}
                              strokeWidth={groupSelected?.footprints.includes(fp.id) ? 0.25 : sel ? 0.4 : 0.08}
                              rx={0.5}
                            />
                          )}
                          {sel && (
                            <rect x={bb.x - 0.4} y={bb.y - 0.4} width={bb.w + 0.8} height={bb.h + 0.8}
                              fill="none" stroke="#3b82f6" strokeWidth={0.3} opacity={0.7} rx={0.7}
                              style={{ pointerEvents: "none" }}
                            />
                          )}
                          <g transform={`translate(${fp.x},${fp.y}) rotate(${fp.rotation})`}>
                            {isSilkVisible && (() => {
                              const silkColor = silkLayer?.color || (silkLayerId === "bottom_silkscreen" ? "#fde047" : "#fde047");
                              
                              if (isPolarCap) {
                                const isSmd = fp.pads.length > 0 && fp.pads[0].layer !== "multi_layer";
                                if (isSmd) {
                                  return (
                                    <g style={{ pointerEvents: "none" }} transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
                                       <rect x={-rectW/2} y={-rectH/2} width={rectW} height={rectH} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                       <rect x={-rectW/2} y={-rectH/2} width={rectW * 0.2} height={rectH} fill="rgba(148, 163, 184, 0.28)" stroke="rgba(148, 163, 184, 0.5)" strokeWidth={0.15} />
                                       <polygon points={`${-rectW/2},${-rectH/2} ${-rectW/2 - 0.4},${-rectH/4} ${-rectW/2 - 0.4},${rectH/4} ${-rectW/2},${rectH/2}`} fill={silkColor} />
                                    </g>
                                  );
                                } else {
                                  return (
                                    <g style={{ pointerEvents: "none" }} transform={`translate(${cx}, ${cy}) rotate(${angle})`}>
                                      <circle cx={0} cy={0} r={r} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                      {/* Negative Stripe Arc on Pin 2 side - transparent grey */}
                                      <path 
                                        d={`M ${r * Math.cos(-Math.PI/3)} ${r * Math.sin(-Math.PI/3)} A ${r} ${r} 0 0 1 ${r * Math.cos(Math.PI/3)} ${r * Math.sin(Math.PI/3)} L 0 0 Z`} 
                                        fill="rgba(148, 163, 184, 0.28)" 
                                        stroke="rgba(148, 163, 184, 0.5)"
                                        strokeWidth={0.15}
                                      />
                                      {/* Positive marker (+) near Pin 1 */}
                                      <g transform={`translate(${-r - 0.8}, 0)`}>
                                        <line x1={-0.4} y1={0} x2={0.4} y2={0} stroke={silkColor} strokeWidth={0.2} />
                                        <line x1={0} y1={-0.4} x2={0} y2={0.4} stroke={silkColor} strokeWidth={0.2} />
                                      </g>
                                    </g>
                                  );
                                }
                              } else if (isNonPolarCap) {
                                return (
                                  <g style={{ pointerEvents: "none" }}>
                                    <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={rectH / 3} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                    <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
                                      {/* Cap schematic symbol embedded in silkscreen */}
                                      <line x1={-0.6} y1={-rectH * 0.25} x2={-0.6} y2={rectH * 0.25} stroke={silkColor} strokeWidth={0.2} />
                                      <line x1={0.6} y1={-rectH * 0.25} x2={0.6} y2={rectH * 0.25} stroke={silkColor} strokeWidth={0.2} />
                                    </g>
                                  </g>
                                );
                              } else if (isDiode || isLED) {
                                const bodyL = Math.max(1.5, d - 1.8);
                                const bodyH = Math.min(1.8, rectH - 0.4);
                                const scaleFactor = Math.min(1.0, bodyL / 3.0);

                                return (
                                  <g style={{ pointerEvents: "none" }}>
                                    {/* Main body rectangle drawn strictly between the pads (no overlap with copper pads) */}
                                    <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
                                      <rect x={-bodyL / 2} y={-bodyH / 2} width={bodyL} height={bodyH} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                      
                                      {/* Cathode band on the right (Pad 1 side) - slightly wider as requested */}
                                      <rect x={bodyL / 2 - 0.45} y={-bodyH / 2} width={0.35} height={bodyH} fill={silkColor} />
                                      
                                      {/* Diode Symbol centered between pads, scaled if space is tight */}
                                      <g transform={`scale(${scaleFactor})`}>
                                        <polygon points="-0.5,-0.4 -0.5,0.4 0.1,0" fill="none" stroke={silkColor} strokeWidth={0.15} />
                                        <line x1="0.1" y1="-0.4" x2="0.1" y2="0.4" stroke={silkColor} strokeWidth={0.15} />
                                      </g>

                                      {isLED && (
                                        <g transform={`translate(0, ${-bodyH / 2 - 0.2}) scale(${scaleFactor})`}>
                                          {/* Emission arrows */}
                                          <line x1={-0.3} y1={0} x2={0.2} y2={-0.5} stroke={silkColor} strokeWidth={0.1} />
                                          <polygon points="0.2,-0.5 -0.1,-0.5 0.2,-0.2" fill={silkColor} />
                                          
                                          <line x1={0.1} y1={0.2} x2={0.6} y2={-0.3} stroke={silkColor} strokeWidth={0.1} />
                                          <polygon points="0.6,-0.3 0.3,-0.3 0.6,0.0" fill={silkColor} />
                                        </g>
                                      )}
                                    </g>
                                  </g>
                                );
                              } else if (isTransistor) {
                                if (fp.pads.length === 3) {
                                  const isSmd = fp.pads[0].shape === "rect";
                                  if (isSmd) {
                                     return (
                                       <g style={{ pointerEvents: "none" }}>
                                         <rect x={rectX + 0.2} y={rectY + 0.5} width={rectW - 0.4} height={rectH - 1.0} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                         <line x1={rectX + 0.2} y1={rectY + 0.8} x2={rectX + 0.6} y2={rectY + 0.5} stroke={silkColor} strokeWidth={0.15} />
                                         
                                         {/* Pin designation labels for MOSFET/BJT (G, D, S / B, C, E) on silkscreen */}
                                         {fp.pads.map((p) => {
                                           if (p.name && ["G", "D", "S", "B", "C", "E"].includes(p.name)) {
                                             return (
                                               <text
                                                 key={`pad-lbl-smd-${p.number || 0}`}
                                                 x={p.x}
                                                 y={p.y + (p.y > nonPolarCy ? 0.9 : -0.9)}
                                                 fill={silkColor}
                                                 fontSize={0.5}
                                                 fontWeight="bold"
                                                 fontFamily="monospace"
                                                 textAnchor="middle"
                                                 dominantBaseline="middle"
                                                 style={{ pointerEvents: "none", opacity: 0.8 }}
                                               >
                                                 {p.name}
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
                                        // TO-220 outline - standard global representation for Power MOSFETs/BJTs
                                        return (
                                          <g style={{ pointerEvents: "none" }}>
                                            {/* Package Body */}
                                            <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.1} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                            {/* Metal Tab representation at the back */}
                                            <rect x={rectX} y={rectY - 1.2} width={rectW} height={1.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                            {/* Hole in the mounting tab */}
                                            <circle cx={nonPolarCx} cy={rectY - 0.6} r={0.4} fill="none" stroke={silkColor} strokeWidth={0.1} />
                                            
                                            {/* Pin designation labels for MOSFET/BJT (G, D, S / B, C, E) */}
                                            {fp.pads.map((p, pIdx) => {
                                              if (p.name && ["G", "D", "S", "B", "C", "E"].includes(p.name)) {
                                                return (
                                                  <text
                                                    key={`pad-lbl-to220-${p.number || pIdx}-${pIdx}`}
                                                    x={p.x}
                                                    y={p.y + 1.5}
                                                    fill={silkColor}
                                                    fontSize={0.65}
                                                    fontWeight="bold"
                                                    fontFamily="monospace"
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    style={{ pointerEvents: "none", opacity: 0.85 }}
                                                  >
                                                    {p.name}
                                                  </text>
                                                );
                                              }
                                              return null;
                                            })}
                                          </g>
                                        );
                                     } else {
                                        // TO-92 (D-shape)
                                        const pad0 = fp.pads[0];
                                        const pad1 = fp.pads[1];
                                        const pad2 = fp.pads[2];
                                        const avgOtherX = pad1 && pad2 ? (pad1.x + pad2.x) / 2 : nonPolarCx;
                                        const avgOtherY = pad1 && pad2 ? (pad1.y + pad2.y) / 2 : nonPolarCy;

                                        let pathD = "";
                                        const isVerticalFlat = Math.abs(avgOtherY - pad0.y) > Math.abs(avgOtherX - pad0.x);

                                        if (isVerticalFlat) {
                                          if (pad0.x < avgOtherX) {
                                            pathD = `M ${rectX + rectW} ${rectY + rectH} L ${rectX + rectW * 0.3} ${rectY + rectH} A ${rectW * 0.7} ${rectH / 2} 0 0 1 ${rectX + rectW * 0.3} ${rectY} L ${rectX + rectW} ${rectY} Z`;
                                          } else {
                                            pathD = `M ${rectX} ${rectY} L ${rectX + rectW * 0.7} ${rectY} A ${rectW * 0.7} ${rectH / 2} 0 0 1 ${rectX + rectW * 0.7} ${rectY + rectH} L ${rectX} ${rectY + rectH} Z`;
                                          }
                                        } else {
                                          if (pad0.y < avgOtherY) {
                                            pathD = `M ${rectX} ${rectY + rectH} L ${rectX} ${rectY + rectH * 0.3} A ${rectW / 2} ${rectH * 0.7} 0 0 1 ${rectX + rectW} ${rectY + rectH * 0.3} L ${rectX + rectW} ${rectY + rectH} Z`;
                                          } else {
                                            pathD = `M ${rectX + rectW} ${rectY} L ${rectX + rectW} ${rectY + rectH * 0.7} A ${rectW / 2} ${rectH * 0.7} 0 0 1 ${rectX} ${rectY + rectH * 0.7} L ${rectX} ${rectY} Z`;
                                          }
                                        }

                                        return (
                                          <g style={{ pointerEvents: "none" }}>
                                            <path
                                              d={pathD}
                                              fill="none"
                                              stroke={silkColor}
                                              strokeWidth={0.15}
                                            />
                                            {/* Pin 1 indicator - dot inside the envelope near the first pad */}
                                            <circle cx={isVerticalFlat ? (pad0.x < avgOtherX ? minPX + 0.3 : maxPX - 0.3) : nonPolarCx} cy={isVerticalFlat ? nonPolarCy : (pad0.y < avgOtherY ? minPY + 0.3 : maxPY - 0.3)} r={0.2} fill={silkColor} />
                                            
                                            {/* Pin designation labels (G, D, S / B, C, E) inside/next to the TO-92 envelope */}
                                            {fp.pads.map((p, pIdx) => {
                                              if (p.name && ["G", "D", "S", "B", "C", "E"].includes(p.name)) {
                                                return (
                                                  <text
                                                    key={`pad-lbl-to92-${p.number || pIdx}-${pIdx}`}
                                                    x={p.x}
                                                    y={p.y + (isVerticalFlat ? 1.0 : (pad0.y < avgOtherY ? 1.0 : -1.0))}
                                                    fill={silkColor}
                                                    fontSize={0.5}
                                                    fontWeight="bold"
                                                    fontFamily="monospace"
                                                    textAnchor="middle"
                                                    dominantBaseline="middle"
                                                    style={{ pointerEvents: "none", opacity: 0.8 }}
                                                  >
                                                    {p.name}
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
                              } else if (isRegulator) {
                                 const isSmd = fp.pads.length > 0 && fp.pads[0].layer !== "multi_layer";
                                 return (
                                   <g style={{ pointerEvents: "none" }}>
                                     <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     {isSmd ? (
                                       <rect x={rectX + rectW*0.2} y={rectY - 0.8} width={rectW*0.6} height={0.8} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     ) : (
                                       <>
                                         <rect x={rectX} y={rectY - 1.2} width={rectW} height={1.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                         <circle cx={nonPolarCx} cy={rectY - 0.6} r={0.4} fill="none" stroke={silkColor} strokeWidth={0.1} />
                                       </>
                                     )}
                                   </g>
                                 );
                              } else if (isResistor) {
                                 return (
                                   <g style={{ pointerEvents: "none" }}>
                                     <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
                                        <polyline points={`${-rectW/3},0 ${-rectW/6},${-rectH/3} 0,${rectH/3} ${rectW/6},${-rectH/3} ${rectW/3},0`} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     </g>
                                   </g>
                                 );
                              } else if (isInductor) {
                                 return (
                                   <g style={{ pointerEvents: "none" }}>
                                     <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={rectH/2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
                                        <path d={`M ${-rectW/3} 0 A ${rectW/9} ${rectH/3} 0 1 1 ${-rectW/9} 0 A ${rectW/9} ${rectH/3} 0 1 1 ${rectW/9} 0 A ${rectW/9} ${rectH/3} 0 1 1 ${rectW/3} 0`} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     </g>
                                   </g>
                                 );
                              } else if (isFuse) {
                                 return (
                                   <g style={{ pointerEvents: "none" }}>
                                     <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
                                       <line x1={-rectW/2} y1={0} x2={rectW/2} y2={0} stroke={silkColor} strokeWidth={0.15} />
                                     </g>
                                   </g>
                                 );
                              } else if (isCrystal) {
                                return (
                                   <g style={{ pointerEvents: "none" }}>
                                     <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={1} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     <g transform={`translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})`}>
                                       <line x1={-0.6} y1={-rectH * 0.25} x2={-0.6} y2={rectH * 0.25} stroke={silkColor} strokeWidth={0.15} />
                                       <line x1={0.6} y1={-rectH * 0.25} x2={0.6} y2={rectH * 0.25} stroke={silkColor} strokeWidth={0.15} />
                                       <rect x={-0.3} y={-rectH * 0.3} width={0.6} height={rectH * 0.6} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     </g>
                                   </g>
                                );
                              } else if (isScrewTerminal) {
                                const courtyardY = rectY + rectH;
                                const courtyardH = 3.0;
                                return (
                                   <g style={{ pointerEvents: "none" }}>
                                     {/* Silkscreen housing box */}
                                     <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={silkColor} strokeWidth={0.18} />
                                     {/* Screw circles & slot lines for each pad */}
                                     {fp.pads.map((p, i) => (
                                        <g key={i}>
                                          <circle cx={p.x} cy={p.y} r={1.2} fill="none" stroke={silkColor} strokeWidth={0.12} />
                                          <line x1={p.x - 0.7} y1={p.y} x2={p.x + 0.7} y2={p.y} stroke={silkColor} strokeWidth={0.12} />
                                        </g>
                                     ))}
                                     {/* Wire entry cavities on front face */}
                                     {fp.pads.map((p, i) => (
                                        <rect key={`w_${i}`} x={p.x - 1.0} y={rectY + rectH - 1.2} width={2.0} height={1.0} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.1} />
                                     ))}
                                     {/* 3.0mm Wire Access Keepout Courtyard Layer */}
                                     <rect x={rectX} y={courtyardY} width={rectW} height={courtyardH} fill="rgba(245, 158, 11, 0.08)" stroke="#f59e0b" strokeWidth={0.12} strokeDasharray="0.6 0.4" />
                                     <text x={rectX + rectW / 2} y={courtyardY + 2.0} fontSize={0.8} fill="#f59e0b" textAnchor="middle" fontWeight="bold">WIRE KEEP OUT (3mm)</text>
                                   </g>
                                );
                              } else if (isConnector) {
                                return (
                                   <g style={{ pointerEvents: "none" }}>
                                     <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     {fp.pads.map((p, i) => (
                                        <rect key={i} x={p.x - p.width/2 - 0.2} y={p.y - p.height/2 - 0.2} width={p.width + 0.4} height={p.height + 0.4} fill="none" stroke={silkColor} strokeWidth={0.1} />
                                     ))}
                                     {fp.pads.length > 0 && (
                                       <polygon points={`${fp.pads[0].x - fp.pads[0].width/2 - 0.6},${fp.pads[0].y} ${fp.pads[0].x - fp.pads[0].width/2 - 1.2},${fp.pads[0].y - 0.4} ${fp.pads[0].x - fp.pads[0].width/2 - 1.2},${fp.pads[0].y + 0.4}`} fill={silkColor} />
                                     )}
                                   </g>
                                );
                              } else if (isSwitch) {
                                return (
                                   <g style={{ pointerEvents: "none" }}>
                                     <rect x={rectX} y={rectY} width={rectW} height={rectH} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     {fp.pads.length <= 4 ? (
                                        <circle cx={nonPolarCx} cy={nonPolarCy} r={Math.min(rectW, rectH)*0.3} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     ) : (
                                        <rect x={rectX + rectW*0.1} y={rectY + rectH*0.1} width={rectW*0.8} height={rectH*0.8} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     )}
                                   </g>
                                );
                              } else if (isDisplay) {
                                return (
                                   <g style={{ pointerEvents: "none" }}>
                                     <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.5} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     <rect x={rectX + 1.5} y={rectY + 1.5} width={rectW - 3} height={rectH - 3} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                   </g>
                                );
                              } else if (isBoardController) {
                                let bW = rectW;
                                let bH = rectH;
                                let bName = "MODULE";
                                
                                if (isESP32) {
                                  bW = 27.94;
                                  bH = 54.61;
                                  bName = "ESP32 DEVKIT";
                                } else if (isESP8266) {
                                  bW = 25.4;
                                  bH = 48.00;
                                  bName = "NodeMCU";
                                } else if (isArduinoNano) {
                                  bW = 17.78;
                                  bH = 43.18;
                                  bName = "ARDUINO NANO";
                                } else if (isArduinoMini) {
                                  bW = 17.78;
                                  bH = 33.02;
                                  bName = "ARDUINO MINI";
                                } else if (isArduinoUno) {
                                  bW = 53.34;
                                  bH = 68.60;
                                  bName = "ARDUINO UNO";
                                } else if (isRaspberryPico) {
                                  bW = 21.00;
                                  bH = 51.00;
                                  bName = "RPI PICO";
                                }

                                const bX = nonPolarCx - bW / 2;
                                const bY = nonPolarCy - bH / 2;

                                return (
                                  <g style={{ pointerEvents: "none" }}>
                                    {/* Main Board Outline on Silkscreen */}
                                    <rect x={bX} y={bY} width={bW} height={bH} rx={1.2} fill="none" stroke={silkColor} strokeWidth={0.2} />
                                    
                                    {/* Sub-outline grid/details */}
                                    <rect x={bX + 1} y={bY + 1} width={bW - 2} height={bH - 2} rx={0.6} fill="none" stroke={silkColor} strokeWidth={0.1} strokeDasharray="1,1" opacity={0.5} />

                                    {/* Centered Board label */}
                                    <text
                                      x={nonPolarCx}
                                      y={nonPolarCy}
                                      fill={silkColor}
                                      fontSize={1.4}
                                      fontWeight="bold"
                                      fontFamily="monospace"
                                      textAnchor="middle"
                                      dominantBaseline="middle"
                                      opacity={0.7}
                                    >
                                      {bName}
                                    </text>

                                    {/* USB Port representation */}
                                    <rect x={nonPolarCx - 3.75} y={bY - 0.8} width={7.5} height={3.5} rx={0.4} fill="none" stroke={silkColor} strokeWidth={0.15} />

                                    {/* Mounting Holes on 4 corners */}
                                    {(isESP32 || isESP8266 || isArduinoUno || isRaspberryPico) && (
                                      <>
                                        <circle cx={bX + 1.8} cy={bY + 1.8} r={1.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                        <circle cx={bX + bW - 1.8} cy={bY + 1.8} r={1.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                        <circle cx={bX + 1.8} cy={bY + bH - 1.8} r={1.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                        <circle cx={bX + bW - 1.8} cy={bY + bH - 1.8} r={1.2} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                      </>
                                    )}
                                  </g>
                                );
                              } else if (isIC && fp.pads.length >= 2) {
                                const isHorizontal = rectW > rectH;
                                const isDip = isDipSocket || sym.includes("dip") || (fp.packageId && fp.packageId.toLowerCase().includes("dip")) || (fp.footprint && fp.footprint.toLowerCase().includes("dip"));
                                
                                const dX = isDip ? minPX - 1.0 : rectX;
                                const dY = isDip ? minPY - 1.2 : rectY;
                                const dW = isDip ? (maxPX - minPX) + 2.0 : rectW;
                                const dH = isDip ? (maxPY - minPY) + 2.4 : rectH;

                                return (
                                   <g style={{ pointerEvents: "none" }}>
                                     <rect x={dX} y={dY} width={dW} height={dH} rx={0.4} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     {fp.pads.length > 0 && (
                                       <circle cx={fp.pads[0].x} cy={fp.pads[0].y} r={0.35} fill={silkColor} />
                                     )}
                                     {isDipSocket && (
                                       <rect x={dX + 0.6} y={dY + 0.6} width={Math.max(dW - 1.2, 1)} height={Math.max(dH - 1.2, 1)} rx={0.2} fill="none" stroke={silkColor} strokeWidth={0.1} strokeDasharray="1,1" opacity={0.7} />
                                     )}
                                     {isHorizontal ? (
                                       <path d={`M ${dX} ${nonPolarCy - 0.8} A 0.8 0.8 0 0 1 ${dX} ${nonPolarCy + 0.8}`} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     ) : (
                                       <path d={`M ${nonPolarCx - 0.8} ${dY} A 0.8 0.8 0 0 0 ${nonPolarCx + 0.8} ${dY}`} fill="none" stroke={silkColor} strokeWidth={0.15} />
                                     )}
                                   </g>
                                );
                              }
                              
                              return (
                                <g style={{ pointerEvents: "none" }}>
                                  {fp.lines && fp.lines.length > 0 ? (
                                    fp.lines.map((ln, i) => (
                                      <line key={i} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} stroke={silkColor} strokeWidth={0.15} />
                                    ))
                                  ) : (!fp.circles || fp.circles.length === 0) ? (
                                    <>
                                      <rect x={rectX} y={rectY} width={rectW} height={rectH} rx={0.3} fill="none" stroke={silkColor} strokeWidth={0.15} strokeDasharray="1,1" />
                                      {fp.pads.length > 0 && <circle cx={fp.pads[0].x} cy={fp.pads[0].y} r={0.3} fill={silkColor} opacity={0.8} />}
                                    </>
                                  ) : null}
                                  {(fp.circles || []).map((c, i) => (
                                    <circle key={i} cx={c.cx} cy={c.cy} r={c.r} stroke={silkColor} strokeWidth={0.15} fill="none" />
                                  ))}
                                </g>
                              );
                            })()}

                      {(() => {
                        const netIndex = schematicNetIndex;
                        return fp.pads.map((pad, idx) => {
                          const isPadVisible = (() => {
                            if (pad.layer === "multi_layer") {
                              const topVisible = pcb.layers.find(l => l.id === "top_copper")?.visible !== false;
                              const bottomVisible = pcb.layers.find(l => l.id === "bottom_copper")?.visible !== false;
                              return topVisible || bottomVisible;
                            }
                            return pcb.layers.find(l => l.id === pad.layer)?.visible !== false;
                          })();
                          if (!isPadVisible) return null;

                          const netId = netIndex.pinNet.get(`${fp.id}:${pad.pinIndex}`);
                          const isPadHi = netId !== undefined && highlightedNetIds.includes(netId);
                          const isPadSelected = selectedPin?.nodeId === fp.id && selectedPin?.pinIndex === pad.pinIndex;
                          const padLayer = pcb.layers.find(l => l.id === pad.layer);
                          const padColor = isPadSelected 
                            ? "#8b5cf6" 
                            : (isPadHi ? "#f97316" : (padLayer?.color || (pad.layer === "bottom_copper" 
                                ? "#3b82f6" 
                                : "#ef4444")));
                          return (
                            <g key={`fp-pad-${fp.id}-${pad.pinIndex}-${idx}`}
                              onPointerDown={(e) => {
                                  if (!isFpActive) return;
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
                                  if (!isFpActive) return;
                                  e.stopPropagation();
                                  setPropsOpen(true);
                                }}
                                style={{ cursor: isFpActive ? "pointer" : "default" }}
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
                                {(() => {
                                  const label = pad.number || pad.name || (typeof pad.pinIndex === 'number' ? String(pad.pinIndex + 1) : "");
                                  if (!label) return null;
                                  const charCount = Math.max(1, label.length);
                                  const fontSize = Math.min(pad.height * 0.75, pad.width / (charCount * 0.6 + 0.2), 1.0);
                                  if (fontSize < 0.2) return null;
                                  return (
                                    <text 
                                      x={pad.x} 
                                      y={pad.y} 
                                      fontSize={fontSize} 
                                      fill="#ffffff" 
                                      fontWeight="bold" 
                                      fontFamily="monospace"
                                      textAnchor="middle" 
                                      dominantBaseline="central"
                                      style={{ pointerEvents: "none", opacity: 0.95 }}
                                    >
                                      {label}
                                    </text>
                                  );
                                })()}
                              </g>
                            );
                          });
                        })()}
                      </g>
                      <g>
                        {(() => {
                          if (!isSilkVisible) return null;
                          const textStr = (fp.reference ?? "") + (fp.value ? ` · ${fp.value}` : "");
                          if (!textStr) return null;
                          const width = Math.max(3, textStr.length * 0.95 + 1.2);
                          return (
                            <g transform={`translate(${bb.x + bb.w/2} ${bb.y - 1.4})`}>
                              <text 
                                x={0} 
                                y={0.2} 
                                fontSize={1.0} 
                                fill={silkLayer?.color || "#fde047"} 
                                textAnchor="middle" 
                                fontWeight={600} 
                                className="pointer-events-none"
                              >
                                {textStr}
                              </text>
                            </g>
                          );
                      })()}
                    </g>
                    </>
                  );
                })()}
                  </g>
                );
              })}

              {pcb.ratsnestVisible && ratsnest.map((line, i) => {
                // Do not render ratsnest guide line for the net currently being routed
                if (draftTrack && routingNetId !== null && line.netId === routingNetId) return null;
                const isHi = highlightedNetIds.includes(line.netId);
                const dim = highlightedNetIds.length > 0 && !highlightedNetIds.includes(line.netId);
                return (
                  <line
                    key={i}
                    x1={line.a.x} y1={line.a.y} x2={line.b.x} y2={line.b.y}
                    stroke={line.color}
                    strokeWidth={isHi ? 0.3 : 0.12}
                    strokeDasharray={isHi ? "" : "0.6 0.4"}
                    opacity={dim ? 0.15 : isHi ? 1 : 0.85}
                    style={{ cursor: "pointer" }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelection({ kind: "net", id: line.netId });
                      selectNetInSchematic(line.netId);
                    }}
                  />
                );
              })}

              {/* Drawing/Connection Nodes - visible when routing tool is active and pointer is down */}
              {tool === "track" && isPointerDown && (
                <g opacity={0.7} pointerEvents="none">
                  {/* Footprint pads */}
                  {visibleFootprints.flatMap(fp => fp.pads.map((pad, padIdx) => {
                    const rad = (fp.rotation * Math.PI) / 180;
                    const cos = Math.cos(rad), sin = Math.sin(rad);
                    const px = fp.x + (pad.x * cos - pad.y * sin);
                    const py = fp.y + (pad.x * sin + pad.y * cos);
                    return (
                      <circle
                        key={`node-pad-${fp.id}-${pad.pinIndex}-${padIdx}`}
                        cx={px}
                        cy={py}
                        r={0.4}
                        fill="#10b981"
                        className="animate-pulse"
                      />
                    );
                  }))}
                  {/* Standalone pads */}
                  {pcb.pads?.map(pad => (
                    <circle
                      key={`node-pad-standalone-${pad.id}`}
                      cx={pad.x}
                      cy={pad.y}
                      r={0.4}
                      fill="#10b981"
                      className="animate-pulse"
                    />
                  ))}
                  {/* Vias */}
                  {pcb.vias?.map(via => (
                    <circle
                      key={`node-via-${via.id}`}
                      cx={via.x}
                      cy={via.y}
                      r={0.4}
                      fill="#10b981"
                      className="animate-pulse"
                    />
                  ))}
                </g>
              )}

              {draftTrack && draftTrack.length > 0 && cursor && (
                <g pointerEvents="none" key="draft-track-active-preview">
                  {/* Live Interactive Route preview connecting draftTrack points to active cursor */}
                  {(() => {
                    const lastPt = draftTrack[draftTrack.length - 1];
                    let activeSegment: { x: number; y: number }[] = [];
                    if (routingMode === "45") {
                      activeSegment = get45Route(lastPt, cursor);
                    } else if (routingMode === "90") {
                      activeSegment = get90Route(lastPt, cursor);
                    } else {
                      activeSegment = getCurvedRoute(lastPt, cursor);
                    }

                    const fullPoints = [...draftTrack.slice(0, -1), ...activeSegment];
                    const dPath = fullPoints.map((pt, idx) => `${idx === 0 ? "M" : "L"}${pt.x} ${pt.y}`).join(" ");
                    const activeLayerObj = pcb.layers.find((l) => l.id === activeLayer);
                    const layerColor = activeLayerObj?.color || (activeLayer === "bottom_copper" ? "#3b82f6" : "#ef4444");
                    const trackWidth = Number(selectedTrackWidth) || 0.25;

                    return (
                      <>
                        {/* Glowing outer aura for max visibility */}
                        <path
                          d={dPath}
                          stroke={layerColor}
                          strokeWidth={trackWidth + 1.2}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          opacity={0.35}
                          className="animate-pulse"
                        />
                        {/* Main active preview track */}
                        <path
                          d={dPath}
                          stroke={layerColor}
                          strokeWidth={trackWidth}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                        />
                        {/* Dashed high-contrast centerline */}
                        <path
                          d={dPath}
                          stroke="#ffffff"
                          strokeWidth={Math.max(0.08, trackWidth * 0.3)}
                          strokeDasharray="0.8 0.4"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          fill="none"
                          opacity={0.9}
                        />
                      </>
                    );
                  })()}

                  {/* Corner handle dots for each locked vertex along draftTrack */}
                  {draftTrack.map((pt, idx) => (
                    <circle
                      key={`draft-pt-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={0.4}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth={0.15}
                    />
                  ))}

                  {/* Pulsing circular halo around initial start point */}
                  <circle
                    cx={draftTrack[0].x}
                    cy={draftTrack[0].y}
                    r={1.5}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={0.25}
                    className="animate-pulse"
                  />

                  {/* Dynamic tracking head following cursor/finger */}
                  <g transform={`translate(${cursor.x}, ${cursor.y})`}>
                    <circle r={Math.max(0.8, (Number(selectedTrackWidth) || 0.25) * 1.5)} fill="none" stroke="#10b981" strokeWidth={0.25} className="animate-ping" />
                    <circle r={0.5} fill="#10b981" stroke="#ffffff" strokeWidth={0.15} />
                  </g>
                </g>
              )}

              {/* Vertex Editing Handles for Selected Track */}
              {selectedTrackId && (() => {
                const tr = pcb.tracks.find(t => t.id === selectedTrackId);
                if (!tr) return null;
                const layer = pcb.layers.find(l => l.id === tr.layer);
                if (!layer?.visible) return null;
                
                return (
                  <g>
                    {/* Vertex handle circles */}
                    {tr.points.map((p, index) => (
                      <g key={`v-${index}`}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={0.6}
                          fill="#ffffff"
                          stroke="#3b82f6"
                          strokeWidth={0.15}
                          style={{ cursor: "pointer" }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            commitHistory();
                            setDragVertexIndex(index);
                            setIsInsertingVertex(false);
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (tr.points.length > 2) {
                              const newPoints = tr.points.filter((_, idx) => idx !== index);
                              setPcb((d) => ({
                                ...d,
                                tracks: d.tracks.map(t => t.id === tr.id ? { ...t, points: newPoints } : t)
                              }));
                            }
                          }}
                        />
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r={1.0}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth={0.05}
                          opacity={0.3}
                          style={{ pointerEvents: "none" }}
                        />
                      </g>
                    ))}

                    {/* Midpoint handle circles for adding new corners */}
                    {tr.points.slice(0, -1).map((p1, index) => {
                      const p2 = tr.points[index + 1];
                      const midX = (p1.x + p2.x) / 2;
                      const midY = (p1.y + p2.y) / 2;
                      return (
                        <circle
                          key={`mid-${index}`}
                          cx={midX}
                          cy={midY}
                          r={0.4}
                          fill="#3b82f6"
                          stroke="#ffffff"
                          strokeWidth={0.1}
                          opacity={0.7}
                          style={{ cursor: "pointer" }}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            const newPoints = [...tr.points];
                            newPoints.splice(index + 1, 0, { x: midX, y: midY });
                            setPcb((d) => ({
                              ...d,
                              tracks: d.tracks.map(t => t.id === tr.id ? { ...t, points: newPoints } : t)
                            }));
                            setDragVertexIndex(index + 1);
                            setIsInsertingVertex(true);
                          }}
                        />
                      );
                    })}
                  </g>
                );
              })()}
              {measureA && (
                <g>
                  {/* Start point - Large Plus sign */}
                  <g>
                    <line x1={measureA.x - 3.5} y1={measureA.y} x2={measureA.x + 3.5} y2={measureA.y} stroke="#ea580c" strokeWidth={0.35} />
                    <line x1={measureA.x} y1={measureA.y - 3.5} x2={measureA.x} y2={measureA.y + 3.5} stroke="#ea580c" strokeWidth={0.35} />
                    <circle cx={measureA.x} cy={measureA.y} r={0.5} fill="#ea580c" />
                    <text x={measureA.x} y={measureA.y - 4.5} fontSize={1.4} fill="#ea580c" textAnchor="middle" fontWeight="bold">
                      {lang === "ar" ? "البداية" : "Start"}
                    </text>
                  </g>
                  
                  {cursor && isDraggingMeasure && (
                    <>
                      <line x1={measureA.x} y1={measureA.y} x2={cursor.x} y2={cursor.y} stroke="#ea580c" strokeWidth={0.18} strokeDasharray="0.4 0.4" />
                      
                      {/* End point - Large Plus sign in real-time */}
                      <g>
                        <line x1={cursor.x - 3.5} y1={cursor.y} x2={cursor.x + 3.5} y2={cursor.y} stroke="#ea580c" strokeWidth={0.35} />
                        <line x1={cursor.x} y1={cursor.y - 3.5} x2={cursor.x} y2={cursor.y + 3.5} stroke="#ea580c" strokeWidth={0.35} />
                        <circle cx={cursor.x} cy={cursor.y} r={0.5} fill="#ea580c" />
                      </g>

                      {/* Realtime distance indicator directly in clean orange text without background rect */}
                      <g transform={`translate(${(measureA.x + cursor.x) / 2}, ${(measureA.y + cursor.y) / 2 - 3.0})`}>
                        <text x={0} y={0} fontSize={1.5} fill="#ea580c" textAnchor="middle" fontWeight="bold">
                          {fmt(Math.hypot(cursor.x - measureA.x, cursor.y - measureA.y), unit)}
                        </text>
                      </g>
                    </>
                  )}
                </g>
              )}

              {/* Pulsing Active DRC Error highlight indicator */}
              {activeDrcError && (
                <g>
                  <circle
                    cx={activeDrcError.x}
                    cy={activeDrcError.y}
                    r={2.5}
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth={0.3}
                    className="animate-ping"
                    style={{ transformOrigin: `${activeDrcError.x}px ${activeDrcError.y}px` }}
                  />
                  <circle
                    cx={activeDrcError.x}
                    cy={activeDrcError.y}
                    r={0.8}
                    fill="#dc2626"
                  />
                </g>
              )}

              {/* Interactive Board Resize Handlers */}
              {(tool === "select" || tool === "group_select") && (() => {
                const handleSize = Math.max(0.8, 6 / zoom);
                return (
                  <g>
                    {/* Bottom-right corner resize handle */}
                    <rect
                      x={pcb.width - handleSize / 2}
                      y={pcb.height - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      rx={handleSize / 4}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth={1.5 / zoom}
                      className="cursor-se-resize hover:scale-125 transition-transform"
                      style={{ cursor: "se-resize", pointerEvents: "all" }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        registerPointer(e);
                        const p = screenToMm(e.clientX, e.clientY);
                        setDragResize({ type: "both", start: p, origSize: { width: pcb.width, height: pcb.height }, moved: false });
                      }}
                    />
                    
                    {/* Right edge resize handle */}
                    <rect
                      x={pcb.width - handleSize / 2}
                      y={pcb.height / 2 - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      rx={handleSize / 4}
                      fill="#3b82f6"
                      stroke="#ffffff"
                      strokeWidth={1.5 / zoom}
                      className="cursor-e-resize hover:scale-125 transition-transform"
                      style={{ cursor: "e-resize", pointerEvents: "all" }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        registerPointer(e);
                        const p = screenToMm(e.clientX, e.clientY);
                        setDragResize({ type: "width", start: p, origSize: { width: pcb.width, height: pcb.height }, moved: false });
                      }}
                    />
                    
                    {/* Bottom edge resize handle */}
                    <rect
                      x={pcb.width / 2 - handleSize / 2}
                      y={pcb.height - handleSize / 2}
                      width={handleSize}
                      height={handleSize}
                      rx={handleSize / 4}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth={1.5 / zoom}
                      className="cursor-s-resize hover:scale-125 transition-transform"
                      style={{ cursor: "s-resize", pointerEvents: "all" }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        registerPointer(e);
                        const p = screenToMm(e.clientX, e.clientY);
                        setDragResize({ type: "height", start: p, origSize: { width: pcb.width, height: pcb.height }, moved: false });
                      }}
                    />
                  </g>
                );
              })()}

              {/* Alignment and Dimension Guides */}
              {tool !== "track" && !draftTrack && !(groupSelected && ((groupSelected.footprints || []).length > 0 || (groupSelected.tracks || []).length > 0 || (groupSelected.vias || []).length > 0 || (groupSelected.pads || []).length > 0 || (groupSelected.texts || []).length > 0)) && guides.map((g, i) => {
                if (g.type === "alignment") {
                  const isX = g.axis === "x" || g.x !== undefined;
                  const val = isX ? g.x! : g.y!;
                  const lineX1 = isX ? g.x! : (g.x1 ?? -1000);
                  const lineY1 = isX ? (g.y1 ?? -1000) : g.y!;
                  const lineX2 = isX ? g.x! : (g.x2 ?? 1000);
                  const lineY2 = isX ? (g.y2 ?? 1000) : g.y!;
                  const label = g.label || (isX ? `X: ${fmt(val, unit)}` : `Y: ${fmt(val, unit)}`);

                  const labelX = isX ? g.x! : ((lineX1 + lineX2) / 2);
                  const labelY = isX ? ((lineY1 + lineY2) / 2) : g.y!;

                  return (
                    <g key={`guide-align-${i}`} pointerEvents="none" className="select-none">
                      {/* Outer glow line */}
                      <line
                        x1={lineX1}
                        y1={lineY1}
                        x2={lineX2}
                        y2={lineY2}
                        stroke="#00d8ff"
                        strokeWidth={0.5}
                        opacity={0.3}
                      />
                      {/* Main alignment guide line */}
                      <line
                        x1={lineX1}
                        y1={lineY1}
                        x2={lineX2}
                        y2={lineY2}
                        stroke="#00d8ff"
                        strokeWidth={0.22}
                        strokeDasharray="1.2 0.6"
                        opacity={0.95}
                      />

                      {/* Render crosshair markers on aligned pins / points */}
                      {g.points && g.points.map((pt: any, idx: number) => (
                        <g key={`align-pt-${idx}`}>
                          <circle cx={pt.x} cy={pt.y} r={0.7} fill="#00d8ff" stroke="#ffffff" strokeWidth={0.2} opacity={0.9} />
                          <line x1={pt.x - 1.2} y1={pt.y} x2={pt.x + 1.2} y2={pt.y} stroke="#00d8ff" strokeWidth={0.22} />
                          <line x1={pt.x} y1={pt.y - 1.2} x2={pt.x} y2={pt.y + 1.2} stroke="#00d8ff" strokeWidth={0.22} />
                        </g>
                      ))}

                      {/* Coordinate Tag Badge */}
                      <g transform={`translate(${labelX}, ${labelY})`}>
                        <rect
                          x={-label.length * 0.45 - 0.6}
                          y={-1.1}
                          width={label.length * 0.9 + 1.2}
                          height={2.2}
                          rx={0.6}
                          fill="#090d16"
                          stroke="#00d8ff"
                          strokeWidth={0.2}
                          opacity={0.92}
                        />
                        <text
                          x={0}
                          y={0.35}
                          fontSize={1.0}
                          fill="#00d8ff"
                          fontWeight="bold"
                          fontFamily="monospace"
                          textAnchor="middle"
                        >
                          {label}
                        </text>
                      </g>
                    </g>
                  );
                } else if (g.type === "dimension") {
                  const isVert = g.x === g.x2;
                  const midX = ((g.x ?? 0) + (g.x2 ?? g.x ?? 0)) / 2;
                  const midY = ((g.y ?? 0) + (g.y2 ?? g.y ?? 0)) / 2;
                  const labelStr = g.label || "";

                  return (
                    <g key={`guide-dim-${i}`} pointerEvents="none" className="select-none">
                      {/* Extension lines connecting ruler to selected element */}
                      {!isVert && g.refY !== undefined && (
                        <>
                          <line x1={g.x} y1={g.refY} x2={g.x} y2={g.y! - 0.3} stroke="#3b82f6" strokeWidth={0.12} strokeDasharray="0.3 0.3" opacity={0.6} />
                          <line x1={g.x2} y1={g.refY} x2={g.x2} y2={g.y! - 0.3} stroke="#3b82f6" strokeWidth={0.12} strokeDasharray="0.3 0.3" opacity={0.6} />
                        </>
                      )}
                      {isVert && g.refX !== undefined && (
                        <>
                          <line x1={g.refX} y1={g.y} x2={g.x! - 0.3} y2={g.y} stroke="#3b82f6" strokeWidth={0.12} strokeDasharray="0.3 0.3" opacity={0.6} />
                          <line x1={g.refX} y1={g.y2} x2={g.x! - 0.3} y2={g.y2} stroke="#3b82f6" strokeWidth={0.12} strokeDasharray="0.3 0.3" opacity={0.6} />
                        </>
                      )}

                      {/* Main ruler line */}
                      <line x1={g.x} y1={g.y} x2={g.x2} y2={g.y2} stroke="#3b82f6" strokeWidth={0.22} />

                      {/* End Ticks */}
                      {isVert ? (
                        <>
                          <line x1={g.x! - 0.8} y1={g.y} x2={g.x! + 0.8} y2={g.y} stroke="#3b82f6" strokeWidth={0.22} />
                          <line x1={g.x! - 0.8} y1={g.y2} x2={g.x! + 0.8} y2={g.y2} stroke="#3b82f6" strokeWidth={0.22} />
                        </>
                      ) : (
                        <>
                          <line x1={g.x} y1={g.y! - 0.8} x2={g.x} y2={g.y! + 0.8} stroke="#3b82f6" strokeWidth={0.22} />
                          <line x1={g.x2} y1={g.y! - 0.8} x2={g.x2} y2={g.y! + 0.8} stroke="#3b82f6" strokeWidth={0.22} />
                        </>
                      )}

                      {/* Clean Floating Measurement Label (Without frame/box) */}
                      {labelStr && (
                        <>
                          {!isVert ? (
                            <text
                              x={midX}
                              y={midY - 0.6}
                              fill="#60a5fa"
                              fontSize={1.1}
                              textAnchor="middle"
                              fontFamily="monospace"
                              fontWeight="bold"
                            >
                              {labelStr}
                            </text>
                          ) : (
                            <text
                              x={midX - 0.6}
                              y={midY}
                              fill="#60a5fa"
                              fontSize={1.1}
                              textAnchor="middle"
                              fontFamily="monospace"
                              fontWeight="bold"
                              transform={`rotate(-90, ${midX - 0.6}, ${midY})`}
                            >
                              {labelStr}
                            </text>
                          )}
                        </>
                      )}
                    </g>
                  );
                }
                return null;
              })}

              {/* Marquee selection box visualizer */}
              {marqueeStart && marqueeEnd && (
                <rect
                  x={Math.min(marqueeStart.x, marqueeEnd.x)}
                  y={Math.min(marqueeStart.y, marqueeEnd.y)}
                  width={Math.abs(marqueeStart.x - marqueeEnd.x)}
                  height={Math.abs(marqueeStart.y - marqueeEnd.y)}
                  fill="rgba(37, 99, 235, 0.15)"
                  stroke="#2563eb"
                  strokeWidth={0.15}
                  strokeDasharray="0.5 0.3"
                  style={{ pointerEvents: "none" }}
                />
              )}
            </g>
          </svg>

          {/* Floating Confirm Track Button */}
          {(unconfirmedTracks.length > 0 || draftTrack) && tool === "track" && (
            <div className="absolute bottom-6 right-6 z-30">
              <Button
                variant="default"
                size="icon"
                className="size-12 rounded-full shadow-xl shadow-green-900/20 bg-green-600 hover:bg-green-500 text-white border-2 border-green-400/30 transition-transform hover:scale-105"
                onClick={() => {
                  if (unconfirmedTracks.length > 0) {
                    commitHistory();
                    setPcb((d) => ({ ...d, tracks: [...d.tracks, ...unconfirmedTracks] }), true);
                    setUnconfirmedTracks([]);
                  }
                  setDraftTrack(null);
                  setRoutingNetId(null);
                  
                }}
              >
                <Check className="size-6" />
              </Button>
            </div>
          )}

          {/* Floating Left Properties Button & Actions (Matching Schematic) */}
          {(() => {
            const hasGroupSel = !!(groupSelected && (
              (groupSelected.footprints || []).length > 0 ||
              (groupSelected.tracks || []).length > 0 ||
              (groupSelected.vias || []).length > 0 ||
              (groupSelected.pads || []).length > 0 ||
              (groupSelected.texts || []).length > 0
            ));
            return (
              <div 
                className={`absolute flex flex-col z-20 shadow-lg border border-slate-800/80 rounded-2xl overflow-hidden bg-[#090d16]/90 backdrop-blur-sm transition-all duration-300 ${
                  showRulers ? "top-10 left-10" : "top-4 left-4"
                }`}
              >
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 rounded-none text-slate-300 hover:bg-slate-800/50"
                  onClick={() => setUnitDialogOpen(true)}
                  title={lang === "ar" ? "إعدادات وحدة PCB" : "PCB Unit Settings"}
                >
                  <Cpu className="h-5 w-5" />
                </Button>

                <AnimatePresence>
                  {(hasGroupSel || selection) && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex flex-col overflow-hidden bg-slate-900/40"
                    >
                      <div className="h-px w-full bg-slate-800/80" />
                      
                      {/* Properties button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-12 w-12 rounded-none ${propsOpen ? "bg-primary/20 text-primary" : "text-slate-300 hover:bg-slate-800/50"}`}
                        onClick={() => {
                          setPropsOpen(true);
                        }}
                        title={lang === "ar" ? "الخصائص" : "Component Properties"}
                      >
                        <SlidersHorizontal className="h-5 w-5" />
                      </Button>

                      {/* Rotate button - show only for footprints and texts if single selection */}
                      {!hasGroupSel && selection && (selection.kind === "footprint" || selection.kind === "text") && (
                        <>
                          <div className="h-px w-full bg-slate-800/80" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-12 w-12 rounded-none text-slate-300 hover:bg-slate-800/50"
                            onClick={rotateSelection}
                            title={lang === "ar" ? "تدوير (90 درجة)" : "Rotate (90°)"}
                          >
                            <RotateCw className="h-5 w-5 text-white" />
                          </Button>
                        </>
                      )}

                      <div className="h-px w-full bg-slate-800/80" />
                      {/* Clone button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-none text-slate-300 hover:bg-slate-800/50"
                        onClick={hasGroupSel ? cloneSelection : cloneSelection}
                        title={lang === "ar" ? "استنساخ" : "Clone"}
                      >
                        <CopyPlus className="h-5 w-5 text-white" />
                      </Button>

                      <div className="h-px w-full bg-slate-800/80" />
                      {/* Delete button */}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-12 w-12 rounded-none text-red-500 hover:text-red-400 hover:bg-red-500/10"
                        onClick={hasGroupSel ? deleteSelectedElements : deleteSelection}
                        title={lang === "ar" ? "حذف" : "Delete"}
                      >
                        <Trash2 className="h-5 w-5 animate-pulse" />
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })()}

        </div>

        {propsOpen && (
          <aside className="w-80 md:w-96 border-s border-slate-800/80 bg-[#090d16]/95 backdrop-blur-xl flex flex-col overflow-hidden absolute md:relative inset-y-0 end-0 z-40 md:z-auto shadow-2xl transition-all">
            <div className="px-4 py-2 border-b flex items-center justify-between bg-slate-900/50 shrink-0 border-b border-slate-800">
              <div className="font-semibold text-sm flex items-center gap-2">
                <Settings2 className="size-4 text-muted-foreground" />
                {selection ? (lang === "ar" ? "الخصائص" : "Properties") : (lang === "ar" ? "خصائص اللوحة" : "Board Properties")}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setPropsOpen(false)} className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20">
                <X className="size-4 stroke-[2.5]" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {selection && selection.kind !== "net" && selection.kind !== "footprint" && (
                <SelectionInspector pcb={pcb} setPcb={setPcb} selection={selection as { kind: string; id: string }} setSelection={setSelection} lang={lang} />
              )}
              {selection?.kind === "footprint" && (
                <FootprintInspector pcb={pcb} setPcb={setPcb} id={selection.id} lang={lang} />
              )}
              
              {selection?.kind === "net" && (
                (() => {
                  const idx = schematicNetIndex;
                  const net = idx.nets.find((n) => n.id === selection.id);
                  if (!net) return null;
                  return (
                    <div className="space-y-4">
                      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{lang === "ar" ? "معلومات الشبكة" : "Net Info"}</div>
                      <div className="p-3 bg-primary/5 rounded-lg border border-primary/20 ring-1 ring-primary/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Network className="size-4 text-primary" />
                          <div className="text-sm font-bold text-foreground">
                            {lang === "ar" ? `الشبكة #${net.id}` : `Net #${net.id}`}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground leading-tight">
                          {lang === "ar" ? "تم تظليل جميع المسارات والوسادات المرتبطة بهذه الشبكة على اللوحة." : "All tracks and pads connected to this net are highlighted."}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">{lang === "ar" ? "دبابيس العناصر المتصلة" : "Connected Pins"}</div>
                        <div className="space-y-1 max-h-[400px] overflow-y-auto pr-1">
                          {net.pins.map((p, pIdx) => {
                            const node = schematic.nodes.find((n) => n.id === p.nodeId);
                            const ref = node ? node.reference : p.nodeId;
                            return (
                              <div key={pIdx} className="flex justify-between items-center text-[11px] p-2 bg-muted/30 rounded-md border border-border/40 group hover:bg-muted/50 transition-colors">
                                <span className="font-bold text-foreground">{ref}</span>
                                <span className="text-[9px] bg-background px-1.5 py-0.5 rounded border border-border/60 text-muted-foreground group-hover:text-foreground">
                                  {lang === "ar" ? `دبوس ${p.pinIndex + 1}` : `Pin ${p.pinIndex + 1}`}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()
              )}


            </div>
          </aside>
        )}

        {uiLayersOpen && (
          <aside className="w-64 border-s bg-slate-900/95 backdrop-blur-md flex flex-col overflow-hidden absolute md:relative inset-y-0 end-0 z-40 md:z-auto shadow-lg md:shadow-none transition-all border-l border-slate-800">
            <div className="px-4 py-3 border-b flex items-center justify-between bg-slate-900/50 shrink-0 border-b border-slate-800">
              <div className="font-semibold text-sm flex items-center gap-2 text-slate-200">
                <LayersIcon className="size-4" />
                {lang === "ar" ? "الطبقات" : "Layers"}
              </div>
              <Button variant="ghost" size="icon" onClick={() => setUiLayersOpen(false)} className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20">
                <X className="size-4 stroke-[2.5]" />
              </Button>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                <div className="px-1 pb-3 mb-2 border-b border-slate-800/60 flex items-center justify-between gap-2 shrink-0">
                  <span className="text-slate-300 text-[11px] font-medium leading-tight">
                    {lang === "ar" ? "تركيز الطبقة النشطة وتعتيم الباقي" : "Focus Active Layer & Dim Rest"}
                  </span>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={dimInactiveLayers} 
                      onChange={(e) => setDimInactiveLayers(e.target.checked)} 
                    />
                    <div className="w-8 h-4.5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-slate-300 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-400 peer-checked:after:bg-emerald-400 after:border-slate-500 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all dark:bg-slate-700 peer-checked:bg-emerald-950/40"></div>
                  </label>
                </div>

                {pcb.layers.filter(l => l.id !== "multi_layer").map((l) => {
                  const isActive = activeLayer === l.id;
                  return (
                    <div
                      key={l.id}
                      onClick={() => setActiveLayer(l.id)}
                      className={`flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer text-xs transition-colors border ${
                        isActive ? "bg-slate-800 border-slate-700 font-semibold text-white" : "bg-slate-950 border-slate-800 hover:bg-slate-800/50 text-slate-400"
                      }`}
                    >
                      <input
                        type="color"
                        value={l.color.startsWith("rgba") ? "#10b981" : (l.color.length > 7 ? l.color.slice(0, 7) : l.color)}
                        onChange={(e) => {
                          e.stopPropagation();
                          const isSolderMask = l.id.includes("solder_mask");
                          const val = e.target.value;
                          updateLayer(l.id, { color: isSolderMask ? val + "80" : val });
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="size-4 rounded cursor-pointer border-none bg-transparent p-0 shrink-0"
                      />
                      <span className="flex-1 truncate">{getTranslatedLayerName(l.name, lang)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); updateLayer(l.id, { visible: !l.visible }); }}
                        className={`${l.visible ? "text-slate-500 hover:text-white" : "text-slate-700 hover:text-slate-500"} transition-colors`}
                      >
                        {l.visible ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </aside>
        )}

        <FootprintBrowser
          open={uiFootprintBrowserOpen}
          onOpenChange={setUiFootprintBrowserOpen}
          onImport={(nativeFootprint) => {
            registerKicadFootprint(nativeFootprint);
            const detectedPrefix = detectKicadRefPrefix(nativeFootprint.name || nativeFootprint.fullName || "", nativeFootprint.library, nativeFootprint.properties);
            const generated = footprintToPcbFootprint(nativeFootprint, `custom-fp-kicad-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
            
            // Determine refBase: use detected prefix unless footprint has a non-default custom reference
            let refBase = detectedPrefix;
            if (generated.reference && !/^(REF|\*|\?|U|\$\{REFERENCE\}|%R|\s*)+$/i.test(generated.reference)) {
              const customLetters = generated.reference.replace(/[^A-Za-z]/g, "");
              if (customLetters && customLetters !== "U" && customLetters !== "REF") {
                refBase = customLetters;
              }
            }

            // Find next available reference number (e.g. R1, R2, C1, C2, D1, D2...)
            const existingRefs = (pcb.footprints || []).map(f => f.reference || "");
            let nextNum = 1;
            const existingNums = existingRefs
              .filter(r => r.startsWith(refBase))
              .map(r => parseInt(r.slice(refBase.length), 10))
              .filter(n => !isNaN(n) && n > 0);
            if (existingNums.length > 0) {
              nextNum = Math.max(...existingNums) + 1;
            } else {
              while (existingRefs.includes(`${refBase}${nextNum}`)) {
                nextNum++;
              }
            }

            const finalRef = `${refBase}${nextNum}`;
            const placed = {
              ...generated,
              reference: finalRef,
              x: Math.round(pcb.width / 2),
              y: Math.round(pcb.height / 2),
              nativeKicadFootprint: generated.nativeKicadFootprint ? {
                ...generated.nativeKicadFootprint,
                properties: {
                  ...(generated.nativeKicadFootprint.properties || {}),
                  Reference: finalRef,
                }
              } : undefined,
            };
            setPcb(d => ({ ...d, footprints: [...(d.footprints || []), placed] }));
            setUiFootprintBrowserOpen(false);
          }}
        />
      </div>

      {threeDOpen && (
        <ThreeDPreview
          pcb={pcb}
          schematic={schematic}
          onClose={() => setThreeDOpen(false)}
          lang={lang}
          onUpdateFootprint={(id, updates) => {
            setPcb((doc) => {
              const newFootprints = doc.footprints.map(fp => fp.id === id ? { ...fp, ...updates } : fp);
              return { ...doc, footprints: newFootprints };
            }, false);
          }}
        />
      )}

      {/* Unit Dialog */}
      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent hideCloseButton={true} className="max-w-full w-screen h-screen m-0 p-0 sm:max-w-full sm:rounded-none rounded-none bg-slate-950 border-none flex flex-col font-sans">
          <DialogHeader className="py-2.5 sm:py-3.5 px-4 sm:px-6 border-b border-slate-800 bg-slate-900/50 shrink-0">
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-2.5 min-w-0">
                <Cpu className="size-4 sm:size-5 text-primary shrink-0" />
                <DialogTitle className="text-sm sm:text-base font-bold tracking-tight text-white m-0 truncate">
                  {lang === "ar" ? "إعدادات وحدة PCB" : "PCB Unit Settings"}
                </DialogTitle>
              </div>
              <DialogClose className="h-8 w-8 shrink-0 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <X className="h-4 w-4 stroke-[2.5]" />
                <span className="sr-only">{lang === "ar" ? "إغلاق" : "Close"}</span>
              </DialogClose>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 p-4">
            <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pb-2 max-w-7xl mx-auto">
              
              {/* Active Status & Stats */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden col-span-1 md:col-span-2 lg:col-span-4">
                <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 font-semibold text-slate-200 flex items-center justify-between">
                  <span>{lang === "ar" ? "إحصائيات لوحة PCB" : "PCB Board Stats"}</span>
                  <span className="size-2 rounded-full bg-primary animate-pulse" />
                </div>
                <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="flex flex-col gap-1 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400">{lang === "ar" ? "الأداة النشطة" : "Active Tool"}</span>
                    <span className="font-semibold text-primary capitalize">
                      {lang === "ar" ? (tool === "select" ? "تحديد" : tool === "track" ? "مسار" : tool === "via" ? "عبر النحاس" : tool === "pad" ? "وسادة" : tool === "measure" ? "قياس" : "سحب") : tool}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400">{lang === "ar" ? "الطبقة الحالية" : "Active Layer"}</span>
                    <span className="font-semibold text-white truncate">
                      {getTranslatedLayerName(pcb.layers.find(l=>l.id===activeLayer)?.name || "", lang)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400">{lang === "ar" ? "عناصر اللوحة" : "Board Elements"}</span>
                    <span className="font-semibold text-white">
                      {lang === "ar" ? (
                        `${pcb.tracks.length} مسار · ${pcb.vias.length} عبر · ${pcb.pads.length} وسادة`
                      ) : (
                        `${pcb.tracks.length}T · ${pcb.vias.length}V · ${pcb.pads.length}P`
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-xs text-slate-400">{lang === "ar" ? "عدد البصمات" : "Footprints"}</span>
                    <span className="font-semibold text-white">
                      {pcb.footprints?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              {/* Board Setup */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/50 px-3 py-2 border-b border-slate-800 font-semibold text-slate-200">
                  {lang === "ar" ? "أبعاد اللوحة" : "Board Setup"}
                </div>
                <div className="p-3 space-y-3">
                  <BoardNumberInput
                    label={lang === "ar" ? "العرض" : "Width"}
                    value={pcb.width}
                    unit={unit}
                    onChange={(v) => setPcb((d) => ({ ...d, width: v }))}
                    step="0.1"
                  />
                  <BoardNumberInput
                    label={lang === "ar" ? "الارتفاع" : "Height"}
                    value={pcb.height}
                    unit={unit}
                    onChange={(v) => setPcb((d) => ({ ...d, height: v }))}
                    step="0.1"
                  />
                </div>
              </div>

              {/* Grid & Units */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/50 px-3 py-2 border-b border-slate-800 font-semibold text-slate-200">
                  {lang === "ar" ? "إعدادات الشبكة" : "Grid & Units"}
                </div>
                <div className="p-3 space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-400">{lang === "ar" ? "الوحدة" : "Unit"}</Label>
                    <select
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                      value={pcb.unit}
                      onChange={(e) => setPcb((d) => ({ ...d, unit: e.target.value as PcbUnit }))}
                    >
                      <option value="mm">mm</option>
                      <option value="inch">inch</option>
                    </select>
                  </div>
                  <BoardNumberInput
                    label={lang === "ar" ? "خطوة الشبكة" : "Grid Step"}
                    value={pcb.gridMm}
                    unit={unit}
                    onChange={(v) => setPcb((d) => ({ ...d, gridMm: v }))}
                    step="0.01"
                  />
                  <div className="flex items-center justify-between p-2 rounded-lg border border-slate-800 bg-slate-950">
                    <span className="text-sm text-slate-200">{lang === "ar" ? "محاذاة الشبكة" : "Snap to Grid"}</span>
                    <button
                      onClick={() => setSnappingEnabled(!snappingEnabled)}
                      className={`w-11 h-6 rounded-full transition-colors ${snappingEnabled ? "bg-primary" : "bg-slate-700"} relative`}
                    >
                      <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full transition-transform ${snappingEnabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Tools & Actions */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/50 px-3 py-2 border-b border-slate-800 font-semibold text-slate-200">
                  {lang === "ar" ? "إجراءات اللوحة" : "Tools & Actions"}
                </div>
                <div className="p-3 space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    onClick={() => {
                      setShowRulers(!showRulers);
                      setUnitDialogOpen(false);
                    }}
                  >
                    <Ruler className="size-4 mr-3" />
                    {showRulers
                      ? (lang === "ar" ? "إخفاء المساطر" : "Hide Rulers")
                      : (lang === "ar" ? "إظهار المساطر" : "Show Rulers")}
                  </Button>
                </div>
              </div>

              {/* Layers placeholder removed */}
              
            </div>
          </ScrollArea>
          <DialogFooter className="p-3 sm:px-6 border-t border-slate-800 bg-slate-900/60 shrink-0 flex flex-row items-center justify-center gap-3">
            <Button
              type="button"
              onClick={() => setUnitDialogOpen(false)}
              className="px-5 py-2 h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-bold border border-blue-500/40 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:border-blue-400 transition-all shadow-sm shadow-blue-500/10 flex items-center gap-2"
            >
              <span>{lang === "ar" ? "إغلاق" : "Close"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SelectionInspector({
  pcb,
  setPcb,
  selection,
  setSelection,
  lang,
}: {
  pcb: PcbDoc;
  setPcb: (u: (p: PcbDoc) => PcbDoc) => void;
  selection: { kind: string; id: string };
  setSelection: (sel: any) => void;
  lang: string;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  const unit = pcb.unit;
  if (selection.kind === "track") {
    const tr = pcb.tracks.find((x) => x.id === selection.id);
    if (!tr) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "مسار" : "Track"}</div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              setPcb((d) => ({ ...d, tracks: d.tracks.filter((t) => t.id !== tr.id) }));
              setSelection(null);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
        
        <BoardNumberInput
          label={`${lang === "ar" ? "العرض" : "Width"}`}
          value={tr.width}
          unit={unit}
          onChange={(v) => setPcb((d) => ({ ...d, tracks: d.tracks.map((t) => t.id === tr.id ? { ...t, width: v } : t) }))}
          step="0.01"
        />
        
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "الطبقة" : "Layer"}</Label>
          <select 
            className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-xs shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring" 
            value={tr.layer}
            onChange={(e) => setPcb((d) => ({ ...d, tracks: d.tracks.map((t) => t.id === tr.id ? { ...t, layer: e.target.value as any } : t) }))}
          >
            <option value="top_copper">{lang === "ar" ? "النحاس العلوي" : "Top Copper"}</option>
            <option value="bottom_copper">{lang === "ar" ? "النحاس السفلي" : "Bottom Copper"}</option>
          </select>
        </div>
      </div>
    );
  }
  if (selection.kind === "via") {
    const v = pcb.vias.find((x) => x.id === selection.id);
    if (!v) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "عبر النحاس" : "Via"}</div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              setPcb((d) => ({ ...d, vias: d.vias.filter((q) => q.id !== v.id) }));
              setSelection(null);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <BoardNumberInput
            label={lang === "ar" ? "الحفر" : "Drill"}
            value={v.drill}
            unit={unit}
            onChange={(x) => setPcb((d) => ({ ...d, vias: d.vias.map((q) => q.id === v.id ? { ...q, drill: x } : q) }))}
            step="0.01"
          />
          <BoardNumberInput
            label={lang === "ar" ? "القطر" : "Diameter"}
            value={v.diameter}
            unit={unit}
            onChange={(x) => setPcb((d) => ({ ...d, vias: d.vias.map((q) => q.id === v.id ? { ...q, diameter: x } : q) }))}
            step="0.01"
          />
        </div>
      </div>
    );
  }
  if (selection.kind === "pad") {
    const p = pcb.pads.find((x) => x.id === selection.id);
    if (!p) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "وسادة" : "Pad"}</div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              setPcb((d) => ({ ...d, pads: d.pads.filter((q) => q.id !== p.id) }));
              setSelection(null);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <BoardNumberInput
            label={lang === "ar" ? "العرض" : "Width"}
            value={p.width}
            unit={unit}
            onChange={(x) => setPcb((d) => ({ ...d, pads: d.pads.map((q) => q.id === p.id ? { ...q, width: x } : q) }))}
            step="0.01"
          />
          <BoardNumberInput
            label={lang === "ar" ? "الارتفاع" : "Height"}
            value={p.height}
            unit={unit}
            onChange={(x) => setPcb((d) => ({ ...d, pads: d.pads.map((q) => q.id === p.id ? { ...q, height: x } : q) }))}
            step="0.01"
          />
        </div>
        
        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "الشكل" : "Shape"}</Label>
          <select 
            className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-xs shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring" 
            value={p.shape}
            onChange={(e) => setPcb((d) => ({ ...d, pads: d.pads.map((q) => q.id === p.id ? { ...q, shape: e.target.value as any } : q) }))}
          >
            <option value="rect">{lang === "ar" ? "مستطيل" : "Rect"}</option>
            <option value="circle">{lang === "ar" ? "دائري" : "Circle"}</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "الرقم" : "Number"}</Label>
          <Input 
            className="h-9 text-xs bg-background/50" 
            value={p.number ?? ""} 
            onChange={(e) => setPcb((d) => ({ ...d, pads: d.pads.map((q) => q.id === p.id ? { ...q, number: e.target.value } : q) }))} 
          />
        </div>
      </div>
    );
  }
  if (selection.kind === "text") {
    const t = (pcb.texts || []).find((x) => x.id === selection.id);
    if (!t) return null;
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "نص ملصق" : "Text Label"}</div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              setPcb((d) => ({ ...d, texts: (d.texts || []).filter((x) => x.id !== t.id) }));
              setSelection(null);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "محتوى النص" : "Text Content"}</Label>
          <Input
            className="h-9 text-xs bg-background/50"
            value={t.text}
            onChange={(e) => setPcb((d) => ({ ...d, texts: (d.texts || []).map((x) => x.id === t.id ? { ...x, text: e.target.value } : x) }))}
          />
        </div>

        <BoardNumberInput
          label={lang === "ar" ? "حجم الخط" : "Font Size"}
          value={t.size}
          unit={unit}
          onChange={(v) => setPcb((d) => ({ ...d, texts: (d.texts || []).map((x) => x.id === t.id ? { ...x, size: v } : x) }))}
          step="0.1"
        />

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "الطبقة" : "Layer"}</Label>
            <select 
              className="w-full h-9 rounded-md border border-input bg-background/50 px-2 py-1 text-[11px] shadow-sm focus:outline-none focus:ring-1 focus:ring-ring" 
              value={t.layer}
              onChange={(e) => setPcb((d) => ({ ...d, texts: (d.texts || []).map((x) => x.id === t.id ? { ...x, layer: e.target.value as any } : x) }))}
            >
              <option value="silkscreen">{lang === "ar" ? "حريري" : "Silkscreen"}</option>
              <option value="top_copper">{lang === "ar" ? "نحاس علوي" : "Top Cu"}</option>
              <option value="bottom_copper">{lang === "ar" ? "نحاس سفلي" : "Bottom Cu"}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "الدوران" : "Rotation"}</Label>
            <select 
              className="w-full h-9 rounded-md border border-input bg-background/50 px-2 py-1 text-[11px] shadow-sm focus:outline-none focus:ring-1 focus:ring-ring" 
              value={t.rotation}
              onChange={(e) => setPcb((d) => ({ ...d, texts: (d.texts || []).map((x) => x.id === t.id ? { ...x, rotation: parseInt(e.target.value) as any } : x) }))}
            >
              <option value={0}>0°</option>
              <option value={90}>90°</option>
              <option value={180}>180°</option>
              <option value={270}>270°</option>
            </select>
          </div>
        </div>
      </div>
    );
  }
  if (selection.kind === "zone") {
    const z = (pcb.zones || []).find((x) => x.id === selection.id);
    if (!z) return null;
    const isKeepout = z.isKeepout;
    const filledCount = z.filledPolygons?.length || 0;

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {isKeepout ? (lang === "ar" ? "منطقة حظر (Keepout)" : "Keepout Zone") : (lang === "ar" ? "منطقة صب نحاس (Copper Pour Zone)" : "Copper Pour Zone")}
            </div>
            {z.name && <div className="text-xs font-semibold text-slate-200">{z.name}</div>}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => {
              setPcb((d) => ({ ...d, zones: (d.zones || []).filter((x) => x.id !== z.id) }));
              setSelection(null);
            }}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>

        {/* Net & Name info */}
        <div className="p-2.5 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">{lang === "ar" ? "الشبكة المرتبطة" : "Assigned Net"}</span>
            <span className="font-semibold text-blue-400 font-mono">
              {z.netName || (z.netId !== undefined ? `Net #${z.netId}` : (lang === "ar" ? "بدون شبكة" : "No Net"))}
            </span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-muted-foreground">{lang === "ar" ? "جزر النحاس المصبوب" : "Filled Copper Islands"}</span>
            <span className="font-semibold text-emerald-400">{filledCount}</span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "الطبقة" : "Layer"}</Label>
          <select 
            className="w-full h-9 rounded-md border border-input bg-background/50 px-2 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring" 
            value={z.layer}
            onChange={(e) => setPcb((d) => ({ ...d, zones: (d.zones || []).map((x) => x.id === z.id ? { ...x, layer: e.target.value as any } : x) }))}
          >
            {pcb.layers.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <BoardNumberInput
            label={lang === "ar" ? "الأولوية" : "Priority"}
            value={z.priority ?? 0}
            unit=""
            onChange={(v) => setPcb((d) => ({ ...d, zones: (d.zones || []).map((x) => x.id === z.id ? { ...x, priority: Math.round(v) } : x) }))}
            step="1"
          />
          <BoardNumberInput
            label={lang === "ar" ? "الخلوص" : "Clearance"}
            value={z.clearance ?? 0.5}
            unit={unit}
            onChange={(v) => setPcb((d) => ({ ...d, zones: (d.zones || []).map((x) => x.id === z.id ? { ...x, clearance: v } : x) }))}
            step="0.05"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <BoardNumberInput
            label={lang === "ar" ? "الحد الأدنى للسمك" : "Min Thickness"}
            value={z.minThickness ?? 0.2}
            unit={unit}
            onChange={(v) => setPcb((d) => ({ ...d, zones: (d.zones || []).map((x) => x.id === z.id ? { ...x, minThickness: v } : x) }))}
            step="0.05"
          />
          <BoardNumberInput
            label={lang === "ar" ? "فجوة التبديد الحراري" : "Thermal Gap"}
            value={z.fill?.thermalGap ?? 0.5}
            unit={unit}
            onChange={(v) => setPcb((d) => ({ ...d, zones: (d.zones || []).map((x) => x.id === z.id ? { ...x, fill: { ...(x.fill || { fillMode: "solid" }), thermalGap: v } } : x) }))}
            step="0.05"
          />
        </div>

        {isKeepout && z.keepout && (
          <div className="p-3 bg-red-950/30 rounded-lg border border-red-900/40 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-red-400">
              {lang === "ar" ? "قيود منطقة الحظر" : "Keepout Restrictions"}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${z.keepout.tracks ? "bg-red-400" : "bg-slate-600"}`} />
                <span>{lang === "ar" ? "منع المسارات" : "Tracks"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${z.keepout.vias ? "bg-red-400" : "bg-slate-600"}`} />
                <span>{lang === "ar" ? "منع الثقوب (Vias)" : "Vias"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${z.keepout.pads ? "bg-red-400" : "bg-slate-600"}`} />
                <span>{lang === "ar" ? "منع الوسادات" : "Pads"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${z.keepout.copperpour ? "bg-red-400" : "bg-slate-600"}`} />
                <span>{lang === "ar" ? "منع صب النحاس" : "Copper Pour"}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
}

const PcbGrid = React.memo(function PcbGrid({ width, height, step, zoom }: { width: number; height: number; step: number; zoom: number }) {
  if (step * zoom < 4 || step <= 0) return null;
  const patternId = "pcb-grid-pattern-hw";
  const strokeW = Math.max(0.04, 0.4 / Math.max(1, zoom));
  return (
    <g pointerEvents="none">
      <defs>
        <pattern id={patternId} width={step} height={step} patternUnits="userSpaceOnUse">
          <path d={`M ${step} 0 L 0 0 0 ${step}`} fill="none" stroke="#ffffff" strokeWidth={strokeW} opacity={0.35} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={width} height={height} fill={`url(#${patternId})`} />
    </g>
  );
});

function ToolBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Button 
      size="sm" 
      onClick={onClick} 
      title={label} 
      className={`h-7 px-1 gap-0.5 transition-colors border ${
        active 
          ? "bg-blue-600/40 text-white border-blue-500/50" 
          : "bg-black text-white hover:bg-black/80 border-slate-700"
      }`}
    >
      {icon}
      <span className="hidden sm:inline text-xs">{label}</span>
    </Button>
  );
}

function FootprintInspector({ pcb, setPcb, id, lang }: { pcb: PcbDoc; setPcb: (u: (p: PcbDoc) => PcbDoc) => void; id: string; lang: string }) {
  const fp = pcb.footprints.find((f) => f.id === id);
  if (!fp) return null;
  const unit = pcb.unit;
  const update = (patch: Partial<PcbFootprint>) =>
    setPcb((d) => ({ ...d, footprints: d.footprints.map((f) => f.id === id ? { ...f, ...patch } : f) }));

  const pkgs = getPackagesForSymbol(fp.symbol);

  const handlePackageChange = (pkgId: string) => {
    const newPads = makePadsForSymbol(fp.symbol, fp, pkgId);
    update({ packageId: pkgId, pads: newPads });
  };
  
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "بصمة" : "Footprint"}</div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => {
            setPcb((d) => ({ ...d, footprints: d.footprints.filter((f) => f.id !== id) }));
          }}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
        <div className="text-sm font-bold text-foreground mb-0.5">{fp.reference ?? fp.symbol}</div>
        {fp.value && <div className="text-[10px] text-muted-foreground font-mono">{fp.value}</div>}
        <div className="mt-2 text-[10px] text-muted-foreground flex gap-3">
          <span>{lang === "ar" ? `الوسادات: ${fp.pads.length}` : `Pads: ${fp.pads.length}`}</span>
          <span>{lang === "ar" ? `الرمز: ${fp.symbol}` : `Symbol: ${fp.symbol}`}</span>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "نوع المغلف (Package)" : "Package Type"}</Label>
        <select 
          className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-xs shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring" 
          value={fp.packageId || pkgs[0]?.id}
          onChange={(e) => handlePackageChange(e.target.value)}
        >
          {pkgs.map(p => (
            <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <BoardNumberInput
          label={lang === "ar" ? "الموقع X" : "Pos X"}
          value={fp.x}
          unit={unit}
          onChange={(v) => update({ x: v })}
          step="0.1"
        />
        <BoardNumberInput
          label={lang === "ar" ? "الموقع Y" : "Pos Y"}
          value={fp.y}
          unit={unit}
          onChange={(v) => update({ y: v })}
          step="0.1"
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{lang === "ar" ? "الدوران" : "Rotation"}</Label>
        <select 
          className="w-full h-9 rounded-md border border-input bg-background/50 px-3 py-1 text-xs shadow-sm transition-colors focus:outline-none focus:ring-1 focus:ring-ring" 
          value={fp.rotation}
          onChange={(e) => update({ rotation: parseInt(e.target.value) })}
        >
          <option value={0}>0°</option>
          <option value={90}>90°</option>
          <option value={180}>180°</option>
          <option value={270}>270°</option>
        </select>
      </div>
    </div>
  );
}
