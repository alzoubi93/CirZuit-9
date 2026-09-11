import React, { useState, useMemo, useRef, Suspense, useEffect, Component } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  Environment,
  ContactShadows,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Text,
} from "@react-three/drei";
import {
  X,
  RotateCcw,
  Eye,
  EyeOff,
  Layers,
  Box,
  Gauge,
  Cpu,
  Sun,
  Grid3x3,
  Zap,
  Palette,
  Sliders,
  Play,
  Pause,
  Ruler,
  Upload,
  Trash2,
  Info,
  ArrowUpFromLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import * as THREE from "three";
import {
  MASK_COLORS,
  COPPER_COLOR,
  COPPER_METAL,
  detectComponent,
  resolveRotation,
  extractComponentMeasurements,
  SolderPad,
  SilkScreenLayer,
  SmartRenderComponent,
  InstancedResistorSMD,
  InstancedCapacitorSMD,
  InstancedLED,
  BoardConfigContext,
  TrackMaterial,
} from "./ThreeDRealModels";

export interface ThreeDPreviewProps {
  pcb: any;
  schematic: any;
  onClose: () => void;
  lang?: string;
  onUpdateFootprint?: (id: string, updates: any) => void;
}

const PRESET_VIEWS: Record<string, { position: [number, number, number]; target: [number, number, number] }> = {
  TOP:        { position: [0, 0, 100],    target: [0, 0, 0] },
  BOTTOM:     { position: [0, 0, -100],   target: [0, 0, 0] },
  FRONT:      { position: [0, -100, 0],   target: [0, 0, 0] },
  SIDE:       { position: [100, 0, 0],    target: [0, 0, 0] },
  ISO_DEFAULT:{ position: [60, -70, 60],  target: [0, 0, 0] },
};

interface SafeEnvProps {
  children: React.ReactNode;
}

interface SafeEnvState {
  hasError: boolean;
}

class SafeEnvironmentErrorBoundary extends Component<SafeEnvProps, SafeEnvState> {
  constructor(props: SafeEnvProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(err: any) {
    console.warn("Failed to load environment preset HDR, using fallback lights:", err);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

function Ruler3DRenderer({ p1, p2 }: { p1: THREE.Vector3; p2: THREE.Vector3 }) {
  const dir = useMemo(() => new THREE.Vector3().subVectors(p2, p1), [p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);
  const len = dir.length();

  const mid = useMemo(() => new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5), [p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);

  const quaternion = useMemo(() => {
    if (len < 0.001) return new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const normalizedDir = dir.clone().normalize();
    return new THREE.Quaternion().setFromUnitVectors(up, normalizedDir);
  }, [dir.x, dir.y, dir.z, len]);

  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);

  const cornerX = p2.x;
  const cornerY = p1.y;
  const cornerZ = (p1.z + p2.z) / 2;

  const lenX = dx;
  const lenY = dy;

  const midX = useMemo(() => new THREE.Vector3((p1.x + cornerX) / 2, (p1.y + cornerY) / 2, (p1.z + cornerZ) / 2), [p1.x, p1.y, p1.z, cornerX, cornerY, cornerZ]);
  const midY = useMemo(() => new THREE.Vector3((cornerX + p2.x) / 2, (cornerY + p2.y) / 2, (cornerZ + p2.z) / 2), [p2.x, p2.y, p2.z, cornerX, cornerY, cornerZ]);

  const quatX = useMemo(() => {
    if (lenX < 0.01) return new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const dX = new THREE.Vector3(cornerX - p1.x, cornerY - p1.y, cornerZ - p1.z).normalize();
    return new THREE.Quaternion().setFromUnitVectors(up, dX);
  }, [p1.x, p1.y, p1.z, cornerX, cornerY, cornerZ, lenX]);

  const quatY = useMemo(() => {
    if (lenY < 0.01) return new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const dY = new THREE.Vector3(p2.x - cornerX, p2.y - cornerY, p2.z - cornerZ).normalize();
    return new THREE.Quaternion().setFromUnitVectors(up, dY);
  }, [p2.x, p2.y, p2.z, cornerX, cornerY, cornerZ, lenY]);

  const isDrawn = len >= 0.05;

  return (
    <group renderOrder={999}>
      {/* P1 Marker (Always visible as soon as clicked) */}
      <mesh position={p1}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.9} />
      </mesh>
      <mesh position={p1} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1.4, 32]} />
        <meshBasicMaterial color="#facc15" side={THREE.DoubleSide} transparent opacity={0.8} />
      </mesh>

      {isDrawn && (
        <>
          {/* P2 Marker */}
          <mesh position={p2}>
            <sphereGeometry args={[0.8, 16, 16]} />
            <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.9} />
          </mesh>

          {/* Direct Distance Line Tube */}
          <mesh position={mid} quaternion={quaternion}>
            <cylinderGeometry args={[0.22, 0.22, len, 12]} />
            <meshStandardMaterial color="#facc15" emissive="#facc15" emissiveIntensity={0.6} />
          </mesh>

          {/* ΔX Projection Leg */}
          {lenX > 1.0 && (
            <mesh position={midX} quaternion={quatX}>
              <cylinderGeometry args={[0.08, 0.08, lenX, 8]} />
              <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} />
            </mesh>
          )}

          {/* ΔY Projection Leg */}
          {lenY > 1.0 && (
            <mesh position={midY} quaternion={quatY}>
              <cylinderGeometry args={[0.08, 0.08, lenY, 8]} />
              <meshBasicMaterial color="#22d3ee" transparent opacity={0.6} />
            </mesh>
          )}

          {/* Midpoint Distance Text */}
          <Text
            position={[mid.x, mid.y, mid.z + 1.2]}
            fontSize={1.8}
            color="#ffffff"
            outlineWidth={0.06}
            outlineColor="#000000"
            anchorX="center"
            anchorY="middle"
            polygonOffset
            polygonOffsetFactor={-20}
            renderOrder={1000}
          >
            {`${len.toFixed(2)} mm`}
          </Text>

          {/* ΔX Label */}
          {lenX > 3.0 && (
            <Text
              position={[midX.x, midX.y - 1.0, midX.z + 0.5]}
              fontSize={1.1}
              color="#22d3ee"
              anchorX="center"
              anchorY="middle"
            >
              {`ΔX: ${lenX.toFixed(1)}mm`}
            </Text>
          )}

          {/* ΔY Label */}
          {lenY > 3.0 && (
            <Text
              position={[midY.x + 1.2, midY.y, midY.z + 0.5]}
              fontSize={1.1}
              color="#22d3ee"
              anchorX="center"
              anchorY="middle"
            >
              {`ΔY: ${lenY.toFixed(1)}mm`}
            </Text>
          )}
        </>
      )}
    </group>
  );
}

export function ThreeDPreview({ pcb, schematic, onClose, lang = "en", onUpdateFootprint }: ThreeDPreviewProps) {
  const isAr = lang === "ar";
  const [maskColor, setMaskColor] = useState<string>("green");
  const [envPreset, setEnvPreset] = useState<string>("sunset");
  const [autoRotate, setAutoRotate] = useState<boolean>(false);
  const [showTracks, setShowTracks] = useState<boolean>(true);
  const [showVias, setShowVias] = useState<boolean>(true);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showSilkscreen, setShowSilkscreen] = useState<boolean>(true);
  const [showPads, setShowPads] = useState<boolean>(true);
  const [showComponents, setShowComponents] = useState<boolean>(true);
  const [selectedComponent, setSelectedComponent] = useState<any | null>(null);
  const [hoveredComponent, setHoveredComponent] = useState<any | null>(null);
  const [showStatsPanel, setShowStatsPanel] = useState<boolean>(false);
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);
  const [showStudioMenu, setShowStudioMenu] = useState<boolean>(false);
  const [showElevationMenu, setShowElevationMenu] = useState<boolean>(false);
  const [componentElevation, setComponentElevation] = useState<number>(0);
  const [solderColor, setSolderColor] = useState<string>("#c0c0c0");
  const [trackColor, setTrackColor] = useState<string>(COPPER_COLOR);

  const [rulerActive, setRulerActive] = useState<boolean>(false);
  const [rulerStart, setRulerStart] = useState<THREE.Vector3 | null>(null);
  const [rulerEnd, setRulerEnd] = useState<THREE.Vector3 | null>(null);
  const [rulerCurrent, setRulerCurrent] = useState<THREE.Vector3 | null>(null);

  const controlsRef = useRef<any>(null);

  const boardWidth = pcb?.width || 100;
  const boardHeight = pcb?.height || 80;
  const boardThickness = 1.6;

  const filteredFootprints = useMemo(() => {
    return pcb?.footprints || [];
  }, [pcb?.footprints]);

  const handlePresetView = (presetKey: string) => {
    const preset = PRESET_VIEWS[presetKey];
    if (preset && controlsRef.current) {
      controlsRef.current.object.position.set(...preset.position);
      controlsRef.current.target.set(...preset.target);
      controlsRef.current.update();
    }
  };

  const AutoRotateController = ({ autoRotate: isRotating }: { autoRotate: boolean }) => {
    useFrame(() => {
      if (isRotating && controlsRef.current) {
        const cam = controlsRef.current.object;
        cam.position.applyAxisAngle(new THREE.Vector3(0, 0, 1), 0.005);
        cam.lookAt(controlsRef.current.target);
        controlsRef.current.update();
      }
    });
    return null;
  };

  const trackMeshes = useMemo(() => {
    if (!showTracks || !pcb?.tracks) return null;
    return pcb.tracks.map((track: any, i: number) => {
      const segs = [] as any[];
      const zPos = track.layer === "bottom_copper" ? -boardThickness / 2 - 0.04 : boardThickness / 2 + 0.04;
      const pts = track.points || [];
      for (let j = 0; j < pts.length - 1; j++) {
        const p1 = pts[j], p2 = pts[j + 1];
        if (!p1 || !p2) continue;
        const dx = p2.x - p1.x, dy = -(p2.y - p1.y); // Inverted Y-axis
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 0.001) continue;
        const angle = Math.atan2(dy, dx);
        const mw = (p1.x + p2.x) / 2, my = boardHeight - (p1.y + p2.y) / 2; // Inverted Y-axis
        const width = track?.width || 0.3;
        segs.push(
          <mesh key={`${i}-${j}`} position={[mw, my, zPos]}
            rotation={[0, 0, angle]} castShadow receiveShadow>
            <boxGeometry args={[len, width, 0.05]} />
            <TrackMaterial />
          </mesh>
        );
      }
      return segs;
    }).flat();
  }, [pcb?.tracks, showTracks, boardThickness, boardHeight]);

  const { smdResistorGroups, smdCapacitorGroups, smdLEDGroups, otherComponents } = useMemo(() => {
    const smdResMap = new Map<string, { instances: any[]; baseSize: any }>();
    const smdCapMap = new Map<string, { instances: any[]; baseSize: any }>();
    const smdLEDMap = new Map<string, { instances: any[]; baseSize: any; color: string }>();
    const others: any[] = [];

    const useInstancing = true;

    for (const fp of filteredFootprints) {
      const model = detectComponent(fp);
      const enriched = { ...fp, model, boardThickness };
      if (useInstancing && model.type === "resistor_smd") {
        const key = `${model.w}x${model.h}x${model.d}`;
        if (!smdResMap.has(key)) smdResMap.set(key, { instances: [], baseSize: { w: model.w, h: model.h, d: model.d } });
        smdResMap.get(key)!.instances.push(enriched);
      } else if (useInstancing && model.type === "capacitor_smd") {
        const key = `${model.w}x${model.h}x${model.d}`;
        if (!smdCapMap.has(key)) smdCapMap.set(key, { instances: [], baseSize: { w: model.w, h: model.h, d: model.d } });
        smdCapMap.get(key)!.instances.push(enriched);
      } else if (useInstancing && model.type === "led_smd") {
        const key = `${model.w}x${model.h}x${model.d}-${model.color}`;
        if (!smdLEDMap.has(key)) smdLEDMap.set(key, { instances: [], baseSize: { w: model.w, h: model.h, d: model.d }, color: model.color });
        smdLEDMap.get(key)!.instances.push(enriched);
      } else {
        others.push(enriched);
      }
    }
    return {
      smdResistorGroups: Array.from(smdResMap.entries()).map(([key, val]) => ({ key, ...val })),
      smdCapacitorGroups: Array.from(smdCapMap.entries()).map(([key, val]) => ({ key, ...val })),
      smdLEDGroups: Array.from(smdLEDMap.entries()).map(([key, val]) => ({ key, ...val })),
      otherComponents: others,
    };
  }, [filteredFootprints, boardThickness]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalFootprints = (pcb?.footprints || []).length;
    const totalTracks = (pcb?.tracks || []).length;
    const totalVias = (pcb?.vias || []).length;
    let totalPads = (pcb?.pads || []).length;
    let smdCount = 0;
    let thtCount = 0;

    (pcb?.footprints || []).forEach((fp: any) => {
      totalPads += (fp.pads || []).length;
      const m = detectComponent(fp);
      if (m.mount === "SMD") smdCount++;
      else thtCount++;
    });

    return { totalFootprints, totalTracks, totalVias, totalPads, smdCount, thtCount };
  }, [pcb]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedComponent) setSelectedComponent(null);
        else if (showStatsPanel) setShowStatsPanel(false);
        else onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedComponent, showStatsPanel, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden"
         dir={isAr ? "rtl" : "ltr"}>
      {/* 🔝 HEADER / CONTROLS NAVBAR */}
      {/* 🔴 CLOSE BUTTON AT TOP CORNER OF SCREEN WITH BLUE BORDER */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        title={isAr ? "إغلاق العارض" : "Close Viewer"}
        className="absolute top-2 right-2 sm:right-4 z-50 h-7 w-7 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-md shadow-blue-500/20"
      >
        <X className="w-3.5 h-3.5 stroke-[2.5]" />
      </Button>

      <header className="flex flex-nowrap items-center justify-between gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md z-10 pr-10 sm:pr-16">
        <div className="flex items-center gap-1.5 sm:gap-2.5">
          <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-md shrink-0">
            <Box className="w-3 h-3 text-emerald-400" />
            <span className="text-[10px] font-semibold tracking-tight text-emerald-300">
              PCB 3D
            </span>
          </div>

          <div className="h-3.5 w-px bg-slate-800 hidden sm:block" />

          {/* Preset Views */}
          <div className="hidden md:flex items-center gap-1 bg-slate-800/60 p-0.5 rounded-md border border-slate-700/50">
            {Object.keys(PRESET_VIEWS).map((k) => (
              <Button
                key={k}
                variant="ghost"
                size="sm"
                onClick={() => handlePresetView(k)}
                className="h-6 px-2 text-[10px] font-medium text-slate-300 hover:text-white hover:bg-blue-600/30 hover:border-blue-500/50"
              >
                {k === "ISO_DEFAULT" ? "ISO" : k}
              </Button>
            ))}
          </div>

          {/* Auto Rotate Toggle */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRotate(!autoRotate)}
            className={`h-7 px-2 gap-1 text-xs border-slate-700 transition-all ${
              autoRotate
                ? "bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-500/30 hover:bg-emerald-700"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            {autoRotate ? <Pause className="w-3 h-3 text-white" /> : <Play className="w-3 h-3 text-emerald-400" />}
            <span className="text-[11px] hidden lg:inline">{isAr ? "دوران تلقائي" : "Auto-Rotate"}</span>
          </Button>
        </div>

        {/* Middle / Dropdown filters */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* 📚 Layer visibility dropdown (Moved to where Ruler was) */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowLayerMenu(!showLayerMenu);
                setShowStudioMenu(false);
                setShowElevationMenu(false);
              }}
              className={`h-7 px-2 gap-1 text-xs border-slate-700 transition-all ${
                showLayerMenu
                  ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30 hover:bg-blue-500"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-white" />
              <span className="text-[11px] hidden sm:inline">{isAr ? "الطبقات" : "Layers"}</span>
            </Button>

            {showLayerMenu && (
              <div className="absolute top-10 left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 w-48 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-1">
                <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 border-b border-slate-800">
                  {isAr ? "إظهار / إخفاء الطبقات" : "Toggle Layers"}
                </div>
                {[
                  { label: isAr ? "المسارات النحاسية" : "Tracks", state: showTracks, set: setShowTracks },
                  { label: isAr ? "الفتحات (Vias)" : "Vias", state: showVias, set: setShowVias },
                  { label: isAr ? "نص الشاشة الحريرية" : "Silkscreen", state: showSilkscreen, set: setShowSilkscreen },
                  { label: isAr ? "نقاط اللحام" : "Pads", state: showPads, set: setShowPads },
                  { label: isAr ? "المكونات 3D" : "Components", state: showComponents, set: setShowComponents },
                  { label: isAr ? "الشبكة الأرضية" : "Grid", state: showGrid, set: setShowGrid },
                ].map((l, i) => (
                  <button
                    key={i}
                    onClick={() => l.set(!l.state)}
                    className="flex items-center justify-between px-2 py-1.5 text-xs text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
                  >
                    <span>{l.label}</span>
                    {l.state ? <Eye className="w-3.5 h-3.5 text-blue-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ⬆️ Component Elevation Button */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setShowElevationMenu(!showElevationMenu);
                setShowStudioMenu(false);
                setShowLayerMenu(false);
              }}
              className={`h-7 px-2 gap-1 text-xs border-slate-700 transition-all ${
                componentElevation > 0
                  ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30 hover:bg-blue-500"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
              title={isAr ? "رفع المكونات والعناصر عن لوح الفيبر" : "Elevate components off PCB board"}
            >
              <ArrowUpFromLine className="w-3.5 h-3.5 text-white" />
              <span className="text-[11px] hidden sm:inline">{isAr ? "رفع المكونات" : "Elevation"}</span>
              <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-slate-950/80 text-white border border-slate-700 hidden sm:inline-flex">
                {componentElevation}mm
              </span>
            </Button>

            {showElevationMenu && (
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-3.5 z-50 flex flex-col gap-3.5">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-2">
                    <ArrowUpFromLine className="w-3.5 h-3.5 text-blue-400" />
                    {isAr ? "رفع المكونات عن لوح الفيبر" : "Component Elevation"}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowElevationMenu(false)}
                    className="h-6 w-6 text-slate-400 hover:text-white rounded-md"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>

                {/* Presets */}
                <div className="grid grid-cols-3 gap-1.5">
                  {[0, 2, 5, 10, 15, 20].map((val) => (
                    <button
                      key={val}
                      onClick={() => setComponentElevation(val)}
                      className={`px-2 py-1 text-xs rounded-lg font-mono font-medium border transition-all ${
                        componentElevation === val
                          ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/30 font-bold"
                          : "bg-slate-800/60 text-slate-300 border-slate-700/60 hover:bg-slate-700"
                      }`}
                    >
                      {val === 0 ? (isAr ? "0mm (ملتصق)" : "0mm") : `${val}mm`}
                    </button>
                  ))}
                </div>

                {/* Slider */}
                <div className="flex flex-col gap-1.5 pt-1">
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>0 mm</span>
                    <span className="text-blue-300 font-bold text-xs">{componentElevation} mm</span>
                    <span>30 mm</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    step={0.5}
                    value={componentElevation}
                    onChange={(e) => setComponentElevation(parseFloat(e.target.value))}
                    className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Studio Options Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowStudioMenu(!showStudioMenu); setShowLayerMenu(false); }}
              className={`h-7 px-2 gap-1 text-xs border-slate-700 transition-all ${
                showStudioMenu
                  ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30 hover:bg-blue-500"
                  : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-white" />
              <span className="text-[11px] hidden sm:inline">{isAr ? "استوديو العرض" : "Studio"}</span>
            </Button>
            {showStudioMenu && (
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-3.5 z-50 flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-0.5">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5 text-blue-400" />
                    {isAr ? "إعدادات الاستوديو" : "Studio Settings"}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowStudioMenu(false)}
                    className="h-6 w-6 text-blue-400 border border-blue-500/50 hover:bg-blue-500/20 rounded-md transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
                
                {/* Board Color Setting */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-400" />
                    {isAr ? "لون قناع اللحام (اللوحة)" : "Board Solder Mask Color"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(MASK_COLORS).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setMaskColor(key)}
                        title={val.name}
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${maskColor === key ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110 border border-white/10'}`}
                        style={{ backgroundColor: val.top }}
                      />
                    ))}
                  </div>
                </div>

                {/* Solder Color Setting */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-400" />
                    {isAr ? "لون اللحام" : "Solder Color"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: "#c0c0c0", name: "Silver" },
                      { val: "#d4af37", name: "Gold" },
                      { val: "#a8a8a8", name: "Matte Lead" },
                      { val: "#e5e4e2", name: "Platinum" },
                      { val: "#b87333", name: "Copper" }
                    ].map((c) => (
                      <button
                        key={c.val}
                        onClick={() => setSolderColor(c.val)}
                        title={c.name}
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${solderColor === c.val ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110 border border-white/10'}`}
                        style={{ backgroundColor: c.val }}
                      />
                    ))}
                  </div>
                </div>

                {/* Track Color Setting */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-blue-400" />
                    {isAr ? "لون المسارات النحاسية" : "Track Color"}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { val: COPPER_COLOR, name: "Natural Copper" },
                      { val: "#d4af37", name: "Gold Plated" },
                      { val: "#c0c0c0", name: "Tin Plated" },
                      { val: "#1a1a1a", name: "Carbon" },
                      { val: "#e5e4e2", name: "Platinum" }
                    ].map((c) => (
                      <button
                        key={c.val}
                        onClick={() => setTrackColor(c.val)}
                        title={c.name}
                        className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${trackColor === c.val ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110 border border-white/10'}`}
                        style={{ backgroundColor: c.val }}
                      />
                    ))}
                  </div>
                </div>

                {/* Lighting Setting */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-[10px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-blue-400" />
                    {isAr ? "إضاءة البيئة (HDRI)" : "Environment Lighting"}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {["sunset", "dawn", "night", "studio", "warehouse", "forest", "apartment", "city", "park"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setEnvPreset(p)}
                        className={`px-1.5 py-1 text-[10px] rounded-md transition-colors border ${envPreset === p ? 'bg-blue-600 text-white border-blue-400' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700'}`}
                      >
                        {isAr ? (p === "sunset" ? "غروب" : p === "dawn" ? "فجر" : p === "night" ? "ليل" : p === "studio" ? "استوديو" : p === "warehouse" ? "مستودع" : p === "forest" ? "غابة" : p === "apartment" ? "شقة" : p === "city" ? "مدينة" : "حديقة") : (p.charAt(0).toUpperCase() + p.slice(1))}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Tools */}
        <div className="flex items-center gap-1">
          {/* 📏 Ruler Tool Button (Moved to position where Layers was) */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const next = !rulerActive;
              setRulerActive(next);
              if (!next) {
                setRulerStart(null);
                setRulerEnd(null);
                setRulerCurrent(null);
              }
              setShowStudioMenu(false);
              setShowLayerMenu(false);
              setShowElevationMenu(false);
            }}
            className={`h-7 px-2 gap-1 text-xs border-slate-700 transition-all ${
              rulerActive
                ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30 hover:bg-blue-500"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
            title={isAr ? "مسطرة قياس المسافات بين المكونات" : "Ruler to measure distances between components"}
          >
            <Ruler className="w-3.5 h-3.5 text-white" />
            <span className="text-[11px] hidden sm:inline">{isAr ? "مسطرة القياس" : "Ruler"}</span>
            {rulerActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            )}
          </Button>

          {/* Stats Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowStatsPanel(!showStatsPanel)}
            className={`h-7 px-2 gap-1 text-xs border-slate-700 transition-all ${
              showStatsPanel
                ? "bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/30 hover:bg-blue-500"
                : "bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white"
            }`}
          >
            <Gauge className="w-3.5 h-3.5 text-white" />
            <span className="text-[11px] hidden lg:inline">{isAr ? "الإحصائيات" : "Stats"}</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => handlePresetView("ISO_DEFAULT")}
            title={isAr ? "إعادة ضبط الكاميرا" : "Reset Camera"}
            className="h-7 w-7 text-white hover:text-white hover:bg-blue-600/20"
          >
            <RotateCcw className="w-3.5 h-3.5 text-white" />
          </Button>
        </div>
      </header>

      {/* 🌐 MAIN 3D WEBGL CANVAS STAGE */}
      <div 
        className="relative flex-1 w-full h-full"
        onPointerDown={(e) => {
          // Close menus when clicking the 3D scene (Canvas)
          if ((e.target as HTMLElement).closest('canvas')) {
            setShowStudioMenu(false);
            setShowLayerMenu(false);
            setShowElevationMenu(false);
          }
        }}
      >
        {/* 📏 RULER MEASUREMENT OVERLAY HUD */}
        {rulerActive && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-blue-500/80 backdrop-blur-xl rounded-xl px-3 py-2 shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200 max-w-[95vw] whitespace-nowrap">
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                <Ruler className="w-3.5 h-3.5" />
              </div>
              <div className="text-[11px] font-semibold text-blue-300 whitespace-nowrap leading-none">
                {isAr ? "أداة قياس المسافات 3D" : "3D Measurement Ruler"}
              </div>
            </div>

            {/* Measurement values */}
            {(rulerStart && (rulerEnd || rulerCurrent)) && (() => {
              const p1 = rulerStart;
              const p2 = rulerEnd || rulerCurrent;
              if (!p1 || !p2) return null;
              const dx = Math.abs(p2.x - p1.x);
              const dy = Math.abs(p2.y - p1.y);
              const dz = Math.abs(p2.z - p1.z);
              const dist3D = Math.sqrt(dx * dx + dy * dy + dz * dz);

              return (
                <div className="flex items-center gap-2 pl-2 border-l border-slate-800 shrink-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 hidden sm:inline">
                      {isAr ? "المسافة:" : "Dist:"}
                    </span>
                    <span className="text-xs sm:text-sm font-bold font-mono text-blue-400 whitespace-nowrap">
                      {dist3D.toFixed(2)} mm
                    </span>
                  </div>

                  <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-slate-300 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                    <div><span className="text-slate-500">ΔX:</span> {dx.toFixed(1)}</div>
                    <div><span className="text-slate-500">ΔY:</span> {dy.toFixed(1)}</div>
                    {dz > 0.05 && <div><span className="text-slate-500">ΔZ:</span> {dz.toFixed(1)}</div>}
                  </div>
                </div>
              );
            })()}

            {/* Controls */}
            <div className="flex items-center gap-1 ml-1 shrink-0">
              {(rulerStart || rulerEnd) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRulerStart(null);
                    setRulerEnd(null);
                    setRulerCurrent(null);
                  }}
                  className="h-6 px-1.5 text-[10px] text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border border-blue-500/30 rounded-md"
                >
                  {isAr ? "مسح" : "Reset"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setRulerActive(false);
                  setRulerStart(null);
                  setRulerEnd(null);
                  setRulerCurrent(null);
                }}
                className="h-6 w-6 text-slate-400 hover:text-white rounded-md"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}

        <Canvas
          shadows
          camera={{ position: [60, -70, 60], fov: 42, near: 0.1, far: 2000 }}
          gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
          className="w-full h-full cursor-grab active:cursor-grabbing"
        >
          <BoardConfigContext.Provider value={{ solderColor, trackColor, elevation: componentElevation }}>
          <color attach="background" args={["#030712"]} />
          <ambientLight intensity={0.5} />
          <directionalLight position={[50, -60, 80]} intensity={1.8} castShadow shadow-mapSize={[2048, 2048]} />
          <directionalLight position={[-40, 50, -30]} intensity={0.6} />

          <SafeEnvironmentErrorBoundary key={envPreset}>
            <Suspense fallback={null}>
              <Environment preset={envPreset as any} />
            </Suspense>
          </SafeEnvironmentErrorBoundary>

            {/* 📏 3D RULER MEASUREMENT RENDERER */}
            {rulerActive && rulerStart && (rulerEnd || rulerCurrent) && (
              <Ruler3DRenderer p1={rulerStart} p2={rulerEnd || rulerCurrent!} />
            )}

            {/* INVISIBLE RULER RAYCAST PLANE */}
            {rulerActive && (
              <mesh
                position={[0, 0, boardThickness / 2 + componentElevation]}
                visible={false}
                onPointerMove={(e) => {
                  e.stopPropagation();
                  setRulerCurrent(e.point.clone());
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  const pt = e.point.clone();
                  if (!rulerStart || (rulerStart && rulerEnd)) {
                    setRulerStart(pt);
                    setRulerEnd(null);
                    setRulerCurrent(pt);
                  } else {
                    setRulerEnd(pt);
                  }
                }}
              >
                <planeGeometry args={[boardWidth * 4, boardHeight * 4]} />
                <meshBasicMaterial transparent opacity={0} />
              </mesh>
            )}

            {/* 🖥️ BOARD SUBSTRATE AND COPPER LAYERS */}
            <group
              position={[-boardWidth / 2, -boardHeight / 2, 0]}
              onPointerDown={(e) => {
                if (!rulerActive) return;
                e.stopPropagation();
                const pt = e.point.clone();
                if (!rulerStart || (rulerStart && rulerEnd)) {
                  setRulerStart(pt);
                  setRulerEnd(null);
                  setRulerCurrent(pt);
                } else {
                  setRulerEnd(pt);
                }
              }}
              onPointerMove={(e) => {
                if (!rulerActive) return;
                e.stopPropagation();
                setRulerCurrent(e.point.clone());
              }}
            >
              {/* PCB SUBSTRATE */}
              <mesh position={[boardWidth / 2, boardHeight / 2, 0]} receiveShadow castShadow>
                <boxGeometry args={[boardWidth, boardHeight, boardThickness]} />
                <meshPhysicalMaterial
                  color={MASK_COLORS[maskColor]?.top || MASK_COLORS.green.top}
                  roughness={0.25}
                  metalness={0.08}
                  clearcoat={0.8}
                  clearcoatRoughness={0.15}
                  reflectivity={0.6}
                  sheen={0.3}
                />
              </mesh>

              {/* TRACKS / TRACES */}
              {trackMeshes}

              {/* VIAS */}
              {showVias && (pcb?.vias || []).map((via: any, i: number) => {
                const diam = via.diameter || (via.drill ? via.drill * 1.8 : 1.2);
                const hole = via.drill || 0.6;
                return (
                  <group key={`via-${i}`} position={[via.x, boardHeight - via.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
                    <mesh>
                      <cylinderGeometry args={[diam / 2, diam / 2, boardThickness + 0.08, 20]} />
                      <TrackMaterial />
                    </mesh>
                    <mesh position={[0, 0, 0]}>
                      <cylinderGeometry args={[hole / 2, hole / 2, boardThickness + 0.1, 16]} />
                      <meshStandardMaterial color="#080808" roughness={0.8} />
                    </mesh>
                  </group>
                );
              })}

              {/* SOLDER PADS (Footprint Pads + Standalone Pads) */}
              {showPads && filteredFootprints.flatMap((fp: any) =>
                (fp.pads || []).map((pad: any, i: number) => {
                  const rad_2D = ((fp.rotation || 0) * Math.PI) / 180;
                  const cos_2D = Math.cos(rad_2D);
                  const sin_2D = Math.sin(rad_2D);
                  const absX = fp.x + ((pad.x || 0) * cos_2D - (pad.y || 0) * sin_2D);
                  const absY_2D = fp.y + ((pad.x || 0) * sin_2D + (pad.y || 0) * cos_2D);
                  const absY = boardHeight - absY_2D;
                  
                  // Compute 3D rotation for the pad
                  const padRot = pad.rotation ? (-pad.rotation * Math.PI) / 180 : 0;
                  const finalPadRot = -rad_2D + padRot;
                  
                  return (
                    <SolderPad 
                      key={`pad-${fp.id || "no-id"}-${i}`} 
                      pad={{
                        ...pad, 
                        x: absX, 
                        y: absY,
                        rotation: finalPadRot
                      }} 
                      boardThickness={boardThickness} 
                    />
                  );
                })
              )}
              {showPads && (pcb?.pads || []).map((pad: any, i: number) => (
                <SolderPad key={`std-pad-${pad.id || i}`} pad={{...pad, y: boardHeight - pad.y}} boardThickness={boardThickness} />
              ))}

              {/* SILKSCREEN TEXT / LABELS */}
              {showSilkscreen && filteredFootprints.map((fp: any, i: number) => (
                <SilkScreenLayer key={`silk-${i}`} fp={fp} boardThickness={boardThickness} boardHeight={boardHeight} />
              ))}

              {/* USER ADDED TEXT / LABELS */}
              {showSilkscreen && (pcb?.texts || []).map((t: any, i: number) => {
                const isBottom = t.layer === "bottom_silkscreen";
                const zPos = isBottom ? -boardThickness / 2 - 0.15 : boardThickness / 2 + 0.15;
                const rotZ = isBottom ? (t.rotation * Math.PI) / 180 : (-t.rotation * Math.PI) / 180;
                const rotX = isBottom ? Math.PI : 0;
                return (
                  <Text
                    key={`user-text-${t.id || i}`}
                    position={[t.x, boardHeight - t.y, zPos]}
                    rotation={[rotX, 0, rotZ]}
                    fontSize={t.size || 1.5}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                    fontFamily="monospace"
                    fontWeight="bold"
                    polygonOffset
                    polygonOffsetFactor={-10}
                    polygonOffsetUnits={-10}
                    renderOrder={100}
                  >
                    {t.text}
                  </Text>
                );
              })}

              {/* INSTANCED RENDERING FOR HIGH-DENSITY SMD PASSIVES */}
              {showComponents && smdResistorGroups.map(({ key, instances, baseSize }) => (
                <InstancedResistorSMD key={`inst-r-${key}`} instances={instances} baseSize={baseSize} boardHeight={boardHeight} />
              ))}
              {showComponents && smdCapacitorGroups.map(({ key, instances, baseSize }) => (
                <InstancedCapacitorSMD key={`inst-c-${key}`} instances={instances} baseSize={baseSize} boardHeight={boardHeight} />
              ))}
              {showComponents && smdLEDGroups.map(({ key, instances, baseSize, color }) => (
                <InstancedLED key={`inst-led-${key}`} instances={instances} baseSize={baseSize} color={color} boardHeight={boardHeight} />
              ))}

              {/* STANDALONE SMART RENDERING FOR OTHER COMPONENTS */}
              {showComponents && otherComponents.map((fp: any, i: number) => (
                <SmartRenderComponent
                  key={`comp-${fp.id || fp.reference || i}`}
                  model={fp.model}
                  common={{
                    fp,
                    isSelected: selectedComponent?.reference === fp.reference,
                    isHovered: hoveredComponent?.reference === fp.reference,
                    onSelect: () => setSelectedComponent(fp),
                    onHover: (item: any) => setHoveredComponent(item || null),
                  }}
                  boardThickness={boardThickness}
                  boardHeight={boardHeight}
                />
              ))}
            </group>

            {/* GROUND GRID & SHADOWS - Removed */}

          {/* CAMERA CONTROLS & GIZMO */}
          <OrbitControls
            ref={controlsRef}
            enableDamping
            dampingFactor={0.06}
            minDistance={5}
            maxDistance={800}
            makeDefault
          />
          <AutoRotateController autoRotate={autoRotate} />

          <GizmoHelper alignment="bottom-right" margin={[70, 70]}>
            <GizmoViewport
              axisColors={["#ef4444", "#22c55e", "#3b82f6"]}
              labelColor="#ffffff"
            />
          </GizmoHelper>
          </BoardConfigContext.Provider>
        </Canvas>

        {/* ℹ️ HOVERED COMPONENT TOOLTIP HUD (Top Left) */}
        {hoveredComponent && (() => {
          const meas = extractComponentMeasurements(hoveredComponent, boardHeight);
          return (
            <div className="absolute top-4 left-4 z-30 bg-slate-900/90 border border-slate-700/80 backdrop-blur-md rounded-xl p-3 shadow-xl max-w-xs pointer-events-none animate-in fade-in duration-150">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-sm text-emerald-400">
                    {hoveredComponent.reference || hoveredComponent.symbol}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${meas.packageType === "SMD" ? "bg-cyan-500/20 text-cyan-300" : "bg-purple-500/20 text-purple-300"}`}>
                    {meas.packageType}
                  </span>
                </div>
                <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-mono">
                  {hoveredComponent.footprint || "Generic"}
                </span>
              </div>
              <div className="space-y-0.5 text-xs text-slate-300">
                <div>
                  {isAr ? "القيمة: " : "Value: "}
                  <span className="font-semibold text-white">{hoveredComponent.value || "N/A"}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">{isAr ? "التوجيه:" : "Orientation:"}</span>
                  <span className="font-semibold text-slate-200">
                    {meas.orientation === "Horizontal" ? (isAr ? "أفقي" : "Horizontal") : (isAr ? "عمودي" : "Vertical")} ({meas.rotationAngle}°)
                  </span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">{isAr ? "الأبعاد:" : "Size:"}</span>
                  <span className="text-cyan-300">{meas.length} × {meas.width} mm</span>
                </div>
                <div className="flex justify-between text-[11px] font-mono">
                  <span className="text-slate-400">{isAr ? "الإحداثيات:" : "Pos:"}</span>
                  <span className="text-slate-300">({meas.x}, {meas.y}) mm</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* 🔍 SELECTED COMPONENT INSPECTOR HUD (Bottom Right) */}
        {selectedComponent && (() => {
          const meas = extractComponentMeasurements(selectedComponent, boardHeight);
          return (
            <div className="absolute bottom-6 right-6 z-40 w-80 bg-slate-900/95 border border-slate-700/90 backdrop-blur-xl rounded-2xl p-4 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
              <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span className="font-bold text-sm text-white">
                    {selectedComponent.reference || selectedComponent.symbol}
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${meas.packageType === "SMD" ? "bg-cyan-500/20 text-cyan-300" : "bg-purple-500/20 text-purple-300"}`}>
                    {meas.packageType}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSelectedComponent(null)}
                  className="h-6 w-6 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">{isAr ? "القيمة" : "Value"}:</span>
                  <span className="font-semibold text-white">{selectedComponent.value || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">{isAr ? "الحزمة (Footprint)" : "Footprint"}:</span>
                  <span className="font-mono text-emerald-300">{selectedComponent.footprint || "Standard"}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">{isAr ? "نوع المكون" : "Package Type"}:</span>
                  <span className="font-semibold text-white">
                    {meas.packageType === "SMD" ? (isAr ? "سطحي (SMD)" : "SMD (Surface-Mount)") : (isAr ? "ثاقب (DIP)" : "DIP (Through-Hole)")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">{isAr ? "الأبعاد (L × W)" : "Dimensions (L × W)"}:</span>
                  <span className="font-mono text-cyan-300">
                    {meas.length} × {meas.width} mm
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">{isAr ? "الموقع (X, Y)" : "Position (X, Y)"}:</span>
                  <span className="text-slate-200 font-mono">
                    {meas.x} mm, {meas.y} mm
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">{isAr ? "التوجيه" : "Orientation"}:</span>
                  <span className="text-slate-200 font-semibold">
                    {meas.orientation === "Horizontal" ? (isAr ? "أفقي" : "Horizontal") : (isAr ? "عمودي" : "Vertical")}
                  </span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">{isAr ? "اتجاه التركيب" : "Placement Dir"}:</span>
                  <span className="text-slate-200 font-mono">{meas.placementDirection} ({meas.rotationAngle}°)</span>
                </div>
                
                {/* Custom 3D Model Upload Section */}
                <div className="py-2 mt-2 border-t border-slate-800/60">
                  <span className="text-slate-400 block mb-2">{isAr ? "نموذج 3D مخصص" : "Custom 3D Model"}:</span>
                  <div className="flex flex-col gap-2">
                    {!selectedComponent.custom3DModel ? (
                      <label className="w-full">
                        <input 
                          type="file" 
                          accept=".stp,.step,.glb" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file || !onUpdateFootprint) return;

                            const ext = file.name.split('.').pop()?.toLowerCase();
                            const type = ext === 'stp' || ext === 'step' ? 'stp' : ext === 'glb' ? 'glb' : null;

                            if (!type) {
                              alert(isAr ? "الصيغة غير مدعومة. الرجاء استخدام STP أو GLB." : "Unsupported format. Please use STP or GLB.");
                              return;
                            }

                            const reader = new FileReader();
                            reader.onload = (e) => {
                              const dataUrl = e.target?.result as string;
                              onUpdateFootprint(selectedComponent.id, {
                                custom3DModel: dataUrl,
                                custom3DModelType: type
                              });
                              setSelectedComponent({...selectedComponent, custom3DModel: dataUrl, custom3DModelType: type});
                            };
                            reader.readAsDataURL(file);
                            e.target.value = '';
                          }}
                        />
                        <div className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 text-slate-300 rounded-md flex items-center justify-center cursor-pointer transition-colors shadow-sm">
                          <Upload className="w-3.5 h-3.5 mr-2" />
                          {isAr ? "استيراد STP / GLB" : "Import STP / GLB"}
                        </div>
                      </label>
                    ) : (
                      <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded border border-slate-700">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                          <span className="truncate font-mono text-[10px] text-emerald-400">
                            {selectedComponent.custom3DModelType?.toUpperCase()} {isAr ? "محمل" : "Loaded"}
                          </span>
                        </div>
                        <Button 
                          onClick={() => {
                            if (onUpdateFootprint) {
                              onUpdateFootprint(selectedComponent.id, {
                                custom3DModel: undefined,
                                custom3DModelType: undefined
                              });
                              const newComp = {...selectedComponent};
                              delete newComp.custom3DModel;
                              delete newComp.custom3DModelType;
                              setSelectedComponent(newComp);
                            }
                          }}
                          size="icon" 
                          variant="ghost" 
                          className="w-5 h-5 text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-sm"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                    
                    {!selectedComponent.custom3DModel && (
                      <div className="flex items-start gap-1.5 text-[10px] text-slate-500 leading-tight">
                        <Info className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>
                          {isAr 
                            ? "استبدل المجسم الافتراضي بملف STP أو GLB الخاص بك." 
                            : "Replace default model with your own STP or GLB file."}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          );
        })()}

        {/* 📊 BOARD STATISTICS DIALOG */}
        {showStatsPanel && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-sm bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-800/60 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  <span className="font-bold text-sm text-white">
                    {isAr ? "إحصائيات لوحة PCB" : "PCB Board Statistics"}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowStatsPanel(false)}
                  className="h-6 w-6 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>

              <div className="p-4 flex flex-col gap-2">
                {[
                  { label: isAr ? "إجمالي المكونات" : "Footprints", val: stats.totalFootprints, col: "text-emerald-400" },
                  { label: isAr ? "عناصر SMD" : "SMD Components", val: stats.smdCount, col: "text-cyan-400" },
                  { label: isAr ? "عناصر Through-Hole" : "THT Components", val: stats.thtCount, col: "text-amber-400" },
                  { label: isAr ? "المسارات (Tracks)" : "Copper Tracks", val: stats.totalTracks, col: "text-blue-400" },
                  { label: isAr ? "الفتحات (Vias)" : "Vias", val: stats.totalVias, col: "text-purple-400" },
                  { label: isAr ? "نقاط اللحام (Pads)" : "Total Pads", val: stats.totalPads, col: "text-rose-400" },
                ].map((item, idx) => (
                  <div key={idx} className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-2 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{item.label}</span>
                    <span className={`text-sm font-bold font-mono ${item.col}`}>{item.val}</span>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 bg-slate-950/40 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>{isAr ? "أبعاد اللوحة:" : "Board Dimensions:"}</span>
                <span className="font-mono text-slate-200">
                  {boardWidth} × {boardHeight} mm ({boardThickness} mm {isAr ? "سمك" : "thick"})
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 📐 DIMENSIONS BADGE (Bottom Left) */}
        <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2 px-3 py-1.5 bg-slate-900/80 border border-slate-800 rounded-xl backdrop-blur-md text-xs text-slate-400">
          <Ruler className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {boardWidth} × {boardHeight} mm ({boardThickness} mm)
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse ml-1" />
          <span className="text-slate-300 font-mono text-[11px] uppercase">{maskColor}</span>
        </div>
      </div>
    </div>
  );
}

export default ThreeDPreview;
