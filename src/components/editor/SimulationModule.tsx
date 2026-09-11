import { useState, useMemo, useEffect } from "react";
import {
  Play,
  Pause,
  Square,
  Settings2,
  Activity,
  Ruler,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Trash2,
  Plus,
  Zap,
  Info,
  Download,
  Share2,
  BarChart3,
  Thermometer,
  Waves,
  X,
  RotateCw,
  AlertTriangle,
  ShieldAlert,
  Radio,
  Bookmark,
  Camera,
  ChevronRight,
  Save,
  Layout,
  Hand,
  MousePointer2,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AnalysisType,
  SimulationSettings,
  generateSpiceNetlist,
  runSimulation,
  SimulationResult,
  getComponentRef,
} from "@/lib/simulation";
import { SchematicDoc, Fault, Bookmark as BookmarkType } from "@/lib/schematic";
import { buildNetIndex } from "@/lib/netlist";
import { SYMBOLS } from "@/lib/symbols";
import { Canvas } from "./Canvas";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";

interface SimulationModuleProps {
  doc: SchematicDoc;
  setDoc: (updater: (d: SchematicDoc) => SchematicDoc) => void;
  onClose: () => void;
  lang: string;
  onLocateNode?: (nodeId: string) => void;
}

export function SimulationModule({
  doc,
  setDoc,
  onClose,
  lang,
  onLocateNode,
}: SimulationModuleProps) {
  const [settings, setSettings] = useState<SimulationSettings>({
    analysisType: "TRAN",
    tranStop: 0.1,
    tranStep: 0.001,
    acStartFreq: 1,
    acStopFreq: 1000000,
    acPoints: 100,
  });

  const [status, setStatus] = useState<
    "idle" | "running" | "paused" | "completed" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [results, setResults] = useState<SimulationResult[]>([]);
  const [filter, setFilter] = useState<{
    voltage: boolean;
    current: boolean;
    power: boolean;
  }>({
    voltage: false,
    current: false,
    power: false,
  });
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isBottomMenuHidden, setIsBottomMenuHidden] = useState(false);
  const [history, setHistory] = useState<
    { id: string; timestamp: number; results: SimulationResult[] }[]
  >([]);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("probes");
  const [simTool, setSimTool] = useState<"select" | "pan">("pan");
  const [showCanvasProbes, setShowCanvasProbes] = useState(false);
  const [locateSignal, setLocateSignal] = useState<{ id: string; t: number } | null>(null);

  const netIndex = useMemo(() => buildNetIndex(doc), [doc]);

  const warnings = useMemo(() => {
    const list: {
      id: string;
      msg: string;
      type: "warning" | "error" | "info";
    }[] = [];
    if (status !== "completed" || results.length === 0) return list;

    doc.nodes.forEach((n) => {
      const ref = getComponentRef(n, doc);
      const res = results.find((r) => r.node === ref && r.type === "current");
      if (!res) return;

      const maxI = Math.max(...res.values.map((v) => Math.abs(v.v)));

      if (n.symbol === "led" && maxI > 0.025) {
        list.push({
          id: `led-${n.id}`,
          type: "warning",
          msg: `${lang === "ar" ? "تيار LED مرتفع جداً" : "LED current too high"}: ${ref} (${(maxI * 1000).toFixed(1)}mA)`,
        });
      }

      if (n.symbol === "resistor") {
        if (maxI > 0.5) {
          list.push({
            id: `res-${n.id}`,
            type: "warning",
            msg: `${lang === "ar" ? "تجاوز قدرة المقاومة" : "Resistor power exceeded"}: ${ref}`,
          });
        }
      }

      if ((n.symbol === "vsource" || n.symbol === "battery") && maxI > 10) {
        list.push({
          id: `short-${n.id}`,
          type: "error",
          msg: `${lang === "ar" ? "احتمال وجود قصر في الدائرة" : "Possible short circuit detected"}: ${ref}`,
        });
      }
    });

    doc.nodes.forEach((n) => {
      const sym = SYMBOLS[n.symbol];
      if (!sym) return;
      sym.pins.forEach((_, i) => {
        const netId = netIndex.pinNet.get(`${n.id}:${i}`);
        if (netId !== undefined) {
          const net = netIndex.nets[netId];
          if (net && net.wireIds.size === 0 && net.pins.length === 1) {
            list.push({
              id: `float-${n.id}-${i}`,
              type: "info",
              msg: `${lang === "ar" ? "دبوس غير متصل" : "Floating pin detected"}: ${n.reference || n.id} (Pin ${i})`,
            });
          }
        }
      });
    });

    return list;
  }, [results, status, doc.nodes, lang, netIndex]);

  useEffect(() => {
    let interval: any;
    if (status === "completed" && settings.analysisType === "TRAN") {
      interval = setInterval(() => {
        setCurrentTime((prev) => {
          const next = prev + (settings.tranStep || 0.01) * playbackSpeed * 5;
          return next > (settings.tranStop || 1) ? 0 : next;
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [
    status,
    settings.analysisType,
    settings.tranStop,
    settings.tranStep,
    playbackSpeed,
  ]);

  const netlist = useMemo(() => generateSpiceNetlist(doc), [doc]);

  const blackCanvasDoc = useMemo(() => ({
    ...doc,
    canvasColor: "black" as const,
  }), [doc]);

  const handleRun = async (silent = false) => {
    if (!silent) {
      setStatus("running");
      setCurrentTime(0);
      setResultsOpen(false);
    }
    setErrorMsg(null);
    try {
      const res = await runSimulation(netlist, settings);
      setResults(res);
      setStatus("completed");
      if (!silent) {
        setHistory((prev) =>
          [
            {
              id: Math.random().toString(36).substr(2, 9),
              timestamp: Date.now(),
              results: res,
            },
            ...prev,
          ].slice(0, 5),
        );
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || "Unknown Simulation Error");
      setStatus("error");
    }
  };

  useEffect(() => {
    handleRun();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "completed") {
      handleRun(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [netlist]);

  const circuitStats = useMemo(() => {
    const powerRes = results.filter((r) => r.type === "power");
    const totalPower = powerRes.reduce((sum, r) => {
      const vals = r.values.map((v) => v.v);
      const avg = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      return sum + (avg < 0 ? -avg : 0); // Only positive power consumption
    }, 0);

    return {
      components: doc.nodes.length,
      nets: netIndex.nets.length,
      wires: doc.wires.length,
      totalPower: totalPower,
      faults: doc.faults?.length || 0,
    };
  }, [doc, results, netIndex]);

  const stats = useMemo(() => {
    return results.map((res) => {
      const vals = res.values.map((v) => v.v);
      if (vals.length === 0) {
        return {
          node: res.node,
          type: res.type,
          max: 0,
          min: 0,
          avg: 0,
          rms: 0,
          unit: "",
          history: [],
        };
      }
      const max = Math.max(...vals);
      const min = Math.min(...vals);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const rms = Math.sqrt(vals.reduce((a, b) => a + b * b, 0) / vals.length);
      const unit =
        res.type === "voltage" ? "V" : res.type === "current" ? "A" : "W";
      return { node: res.node, type: res.type, max, min, avg, rms, unit, history: res.values };
    });
  }, [results]);

  const filteredResults = useMemo(() => {
    return results.filter((r) => {
      if (settings.analysisType === "AC") {
        return r.type === "ac_mag" || r.type === "ac_phase";
      }
      return filter[r.type as keyof typeof filter];
    });
  }, [results, filter, settings.analysisType]);

  const chartData = useMemo(() => {
    if (filteredResults.length === 0) return [];
    let points = filteredResults[0]?.values || [];
    
    if (settings.analysisType === "TRAN") {
      points = points.filter(p => p.t <= currentTime);
    }

    return points.map((p, idx) => {
      const entry: any = {
        time: p.t.toFixed(settings.analysisType === "AC" ? 0 : 4),
        t: p.t,
      };
      filteredResults.forEach((res) => {
        entry[
          res.node +
            (settings.analysisType === "AC"
              ? ` (${res.type === "ac_mag" ? "dB" : "°"})`
              : "")
        ] = res.values[idx]?.v || 0;
      });
      return entry;
    });
  }, [filteredResults, settings.analysisType, currentTime]);

  const handleAddFault = (nodeId: string, type: Fault["type"]) => {
    setDoc((d) => ({
      ...d,
      faults: [
        ...(d.faults || []),
        { id: crypto.randomUUID(), type, targetId: nodeId },
      ],
    }));
  };

  const handleRemoveFault = (faultId: string) => {
    setDoc((d) => ({
      ...d,
      faults: d.faults?.filter((f) => f.id !== faultId),
    }));
  };

  const handleUpdateSignal = (nodeId: string, value: string) => {
    setDoc((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === nodeId ? { ...n, value } : n)),
    }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col font-sans overflow-hidden">
      {/* Simulation Toolbar */}
      <div className="h-11 border-b bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20"
          >
            <X className="size-4 stroke-[2.5]" />
          </Button>
          <div className="flex flex-col">
            <span className="text-sm font-bold leading-none">
              {lang === "ar"
                ? "محاكي الدوائر الاحترافي"
                : "Professional Circuit Simulator"}
            </span>
            <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest mt-1">
              {lang === "ar" ? "محرك MNA نشط" : "Active MNA Engine"}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {status === "idle" || status === "error" ? (
            <Button
              variant="default"
              size="icon"
              onClick={() => handleRun()}
              className="h-9 w-9 bg-emerald-600 hover:bg-emerald-500 text-white rounded-full shadow-lg shadow-emerald-900/20"
              title={lang === "ar" ? "بدء المحاكاة" : "Run Simulation"}
            >
              <Play className="size-4 fill-current" />
            </Button>
          ) : (
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setStatus("idle");
                setResults([]);
                setErrorMsg(null);
              }}
              className="h-9 w-9 border-red-500/30 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-full bg-red-500/5 shadow-lg shadow-red-900/10"
              title={lang === "ar" ? "إيقاف" : "Stop"}
            >
              <Square className="size-4 fill-current" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Main Content Area */}
        <div className="flex-1 bg-slate-950 flex flex-col relative overflow-hidden">
          {/* Circuit Preview Area */}
          <div className="flex-1 relative overflow-hidden">
            <div className="absolute inset-0">
              <Canvas
                doc={blackCanvasDoc}
                setDoc={setDoc}
                commitHistory={() => {}}
                tool={simTool}
                setTool={setSimTool as any}
                locateSignal={locateSignal}
                selectedIds={[]}
                setSelectedIds={() => {}}
                selectedWireIds={[]}
                setSelectedWireIds={() => {}}
                clipboard={null}
                setClipboard={() => {}}
                wireColor="black"
                isSimulating={true}
                simulationResults={results}
                currentTime={currentTime}
                showProbes={showCanvasProbes}
              />
            </div>

            {status === "error" && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center z-40">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="max-w-md w-[90%] p-6 rounded-2xl bg-red-500/10 border border-red-500/30 text-center space-y-4"
                >
                  <div className="size-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                    <AlertTriangle className="size-6 text-red-500" />
                  </div>
                  <h3 className="text-lg font-bold text-red-400">
                    {lang === "ar" ? "فشل المحاكاة" : "Simulation Failed"}
                  </h3>
                  <p className="text-xs text-red-300/80 font-mono leading-relaxed">
                    {errorMsg}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-500/30 text-red-400 hover:bg-red-500/20"
                    onClick={handleRun}
                  >
                    {lang === "ar" ? "إعادة المحاولة" : "Retry Simulation"}
                  </Button>
                </motion.div>
              </div>
            )}

            {status === "running" && (
              <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px] flex items-center justify-center z-40 pointer-events-none">
                <div className="text-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: "linear",
                    }}
                    className="size-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full mx-auto mb-4"
                  />
                  <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-400 font-bold">
                    {lang === "ar"
                      ? "جاري الحساب..."
                      : "Computing MNA Matrix..."}
                  </p>
                </div>
              </div>
            )}

            {/* Float HUD */}
            <div className="absolute top-4 left-4 flex flex-col gap-2 z-40">
              <div className="bg-slate-900/80 backdrop-blur-md border border-white/5 rounded-xl p-3 flex items-center gap-3 shadow-xl">
                <div
                  className={`size-2.5 rounded-full ${status === "completed" ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" : "bg-slate-700"}`}
                />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-white uppercase tracking-wider">
                    {status === "completed"
                      ? lang === "ar"
                        ? "تحليل مباشر"
                        : "Live Analysis"
                      : lang === "ar"
                        ? "بانتظار البدء"
                        : "Ready to Start"}
                  </span>
                  <span className="text-[8px] text-slate-500 font-bold uppercase">
                    {settings.analysisType} DOMAIN
                  </span>
                </div>
              </div>
            </div>
            {/* Toggle Bottom Menu Button */}
            <div className="absolute bottom-4 right-4 z-40">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsBottomMenuHidden(!isBottomMenuHidden)}
                className="h-8 px-2.5 rounded-lg bg-slate-900/60 hover:bg-slate-900/80 text-slate-300 hover:text-white border border-white/5 backdrop-blur-md text-[10px] gap-1 font-sans transition-all duration-300 shadow-lg"
              >
                {isBottomMenuHidden ? (
                  <>
                    <ChevronUp className="size-3.5" />
                    <span>{lang === "ar" ? "إظهار لوحة التحكم" : "Show Controls"}</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="size-3.5" />
                    <span>{lang === "ar" ? "إخفاء لوحة التحكم" : "Hide Controls"}</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Analysis Settings & Playback Controls - Re-designed for Maximum Space */}
          {!isBottomMenuHidden && (
            <div className="w-full shrink-0 z-40 bg-slate-950 border-t border-slate-800">
              <div className="w-full max-w-7xl mx-auto flex flex-col items-center">
                
                {/* Compact TRAN Controls - Optimized for Space */}
                {settings.analysisType === "TRAN" && (
                  <div className="w-full flex items-center gap-3 px-4 py-1.5 border-b border-white/5 bg-slate-900/40 animate-in fade-in slide-in-from-bottom-1 duration-300">
                    
                    {/* 1. Play/Pause (Small) - First on Left */}
                    {status === "completed" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setPlaybackSpeed(playbackSpeed === 0 ? 1 : 0)}
                        className={`size-8 rounded-full shrink-0 transition-all ${
                          playbackSpeed > 0 ? "bg-emerald-500/20 text-emerald-400" : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {playbackSpeed === 0 ? <Play className="size-4 fill-current" /> : <Pause className="size-4 fill-current" />}
                      </Button>
                    )}

                    {/* 2. Timeline Slider (Flexible - Expands to fill) */}
                    {status === "completed" && (
                      <div className="flex-1 flex items-center gap-2">
                        <span className="text-[9px] font-mono text-slate-500 w-10 text-right">{(currentTime * 1000).toFixed(0)}ms</span>
                        <div className="flex-1 relative h-4 flex items-center">
                          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-500/30 transition-all"
                              style={{ width: `${(currentTime / (settings.tranStop && !isNaN(settings.tranStop) ? settings.tranStop : 0.1)) * 100}%` }}
                            />
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={settings.tranStop && !isNaN(settings.tranStop) ? settings.tranStop : 0.1}
                            step={settings.tranStep && !isNaN(settings.tranStep) ? settings.tranStep : 0.001}
                            value={currentTime}
                            onChange={(e) => {
                              setCurrentTime(parseFloat(e.target.value));
                              setPlaybackSpeed(0);
                            }}
                            className="absolute inset-0 w-full h-4 bg-transparent appearance-none cursor-pointer accent-emerald-500 z-10"
                          />
                        </div>
                        <span className="text-[9px] font-mono text-slate-500 w-10">
                          {((settings.tranStop && !isNaN(settings.tranStop) ? settings.tranStop : 0.1) * 1000).toFixed(0)}ms
                        </span>
                      </div>
                    )}

                    {/* 3. Speed Selector (Compact) */}
                    {status === "completed" && (
                      <div className="flex items-center gap-2 bg-slate-950/30 px-2 py-1 rounded-lg border border-slate-800/50 shrink-0">
                        <input
                          type="range"
                          min={0.1}
                          max={5}
                          step={0.1}
                          value={playbackSpeed}
                          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                          className="w-16 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <span className="text-[9px] font-mono text-emerald-400 w-7">{playbackSpeed.toFixed(1)}x</span>
                      </div>
                    )}

                    {/* 4. Stop Time (Minimal) - Far Right */}
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-950/50 rounded-lg border border-slate-800 shrink-0">
                      <span className="text-[8px] font-bold text-slate-500 uppercase">{lang === "ar" ? "المدة:" : "Stop:"}</span>
                      <input
                        type="number"
                        step="0.001"
                        value={isNaN(settings.tranStop ?? NaN) ? "" : settings.tranStop}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setSettings({ ...settings, tranStop: val });
                        }}
                        className="w-12 h-5 bg-transparent text-[9px] font-mono text-emerald-400 outline-none text-center border-b border-white/5"
                      />
                    </div>
                  </div>
                )}

                {/* Main Selection Bar (Always Visible) */}
                <div className="w-full h-14 flex items-center justify-center relative">
                  <div className="flex items-center gap-2 p-1 bg-slate-900/50 rounded-xl border border-white/5 shadow-inner">
                    {(["DC", "AC", "TRAN"] as AnalysisType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setSettings({ ...settings, analysisType: type })}
                        className={`px-10 py-2 rounded-lg text-[11px] font-black transition-all duration-200 ${
                          settings.analysisType === type
                            ? "bg-slate-700 text-white shadow-lg scale-105"
                            : "text-slate-500 hover:text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Tabs */}
        <div className="w-full md:w-80 border-t md:border-t-0 md:border-l bg-card shrink-0 flex flex-col shadow-xl z-20">
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1 flex flex-col"
          >
            <TabsList className="grid grid-cols-4 h-12 bg-muted/30 rounded-none border-b shrink-0">
              <TabsTrigger
                value="probes"
                className="text-[10px] uppercase font-bold"
              >
                <Activity className="size-3.5" />
              </TabsTrigger>
              <TabsTrigger
                value="faults"
                className="text-[10px] uppercase font-bold"
              >
                <ShieldAlert className="size-3.5" />
              </TabsTrigger>
              <TabsTrigger
                value="signals"
                className="text-[10px] uppercase font-bold"
              >
                <Radio className="size-3.5" />
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="text-[10px] uppercase font-bold"
              >
                <BarChart3 className="size-3.5" />
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 overflow-hidden">
              <div className="p-4 space-y-6">
                <TabsContent value="probes" className="m-0 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {lang === "ar" ? "المجسات النشطة" : "Active Probes"}
                      </h4>
                      <Button
                        id="probes-canvas-toggle"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200"
                        onClick={() => setShowCanvasProbes(!showCanvasProbes)}
                        title={
                          lang === "ar"
                            ? showCanvasProbes
                              ? "إخفاء على المخطط"
                              : "إظهار على المخطط"
                            : showCanvasProbes
                              ? "Hide on canvas"
                              : "Show on canvas"
                        }
                      >
                        {showCanvasProbes ? (
                          <Eye className="size-3.5" />
                        ) : (
                          <EyeOff className="size-3.5" />
                        )}
                      </Button>
                    </div>
                    {stats.length > 0 ? (
                      <div className="space-y-2">
                        {stats
                          .filter((s) => filter[s.type as keyof typeof filter])
                          .map((s) => (
                            <div
                              key={`${s.node}:${s.type}`}
                              className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 space-y-2 group hover:border-emerald-500/30 transition-all"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`size-2 rounded-full ${s.type === "voltage" ? "bg-emerald-500" : s.type === "current" ? "bg-blue-500" : "bg-purple-500"}`}
                                  />
                                  <span className="text-xs font-bold font-mono">
                                    {s.node}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${s.type === "voltage" ? "text-emerald-400 bg-emerald-500/10" : s.type === "current" ? "text-blue-400 bg-blue-500/10" : "text-purple-400 bg-purple-500/10"}`}
                                >
                                  {Math.abs(s.avg) < 1e-3
                                    ? (s.avg * 1e6).toFixed(1) + "u"
                                    : Math.abs(s.avg) < 1
                                      ? (s.avg * 1000).toFixed(1) + "m"
                                      : s.avg.toFixed(2)}
                                  {s.unit}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 text-[9px] text-muted-foreground font-mono">
                                <div className="flex justify-between">
                                  <span>MAX:</span>{" "}
                                  <span className="text-slate-300">
                                    {s.max.toFixed(2)}
                                    {s.unit}
                                  </span>
                                </div>
                                <div className="flex justify-between">
                                  <span>RMS:</span>{" "}
                                  <span className="text-slate-300">
                                    {s.rms.toFixed(2)}
                                    {s.unit}
                                  </span>
                                </div>
                              </div>
                              <div className="h-12 mt-2 w-full opacity-80">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={s.history.filter(h => h.t <= currentTime)}>
                                    <Line
                                      type="monotone"
                                      dataKey="v"
                                      stroke={s.type === "voltage" ? "#34d399" : s.type === "current" ? "#60a5fa" : "#c084fc"}
                                      strokeWidth={1.5}
                                      dot={false}
                                      isAnimationActive={false}
                                    />
                                    <YAxis domain={['auto', 'auto']} hide />
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl">
                        <p className="text-[10px] text-slate-600 uppercase tracking-widest">
                          {lang === "ar"
                            ? "لا توجد بيانات قياس"
                            : "No probe data"}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Smart Warnings - Ultra Compact Grouping */}
                  <AnimatePresence>
                    {warnings.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-2 pt-3 border-t border-slate-800"
                      >
                        <div className="flex items-center justify-between px-1">
                          <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <AlertTriangle className="size-3 text-amber-500" />
                            {lang === "ar" ? "تنبيهات النظام الذكية" : "System Alerts"}
                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-800 text-[9px] text-slate-400">
                              {warnings.length}
                            </span>
                          </h4>
                        </div>
                        
                        <div className="space-y-1 max-h-[120px] overflow-y-auto pr-1 custom-scrollbar">
                          {warnings.map((w) => (
                            <div
                              key={w.id}
                              className={`group relative p-2 rounded-lg border flex items-start gap-2 transition-all hover:bg-white/5 cursor-pointer ${
                                w.type === "error"
                                  ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40"
                                  : "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40"
                              }`}
                              onClick={() => {
                                const nodeId = w.id.split('-')[1];
                                if (nodeId) {
                                  setLocateSignal({ id: nodeId, t: Date.now() });
                                  if (onLocateNode) onLocateNode(nodeId);
                                }
                              }}
                            >
                              <div className={`mt-0.5 size-1.5 rounded-full shrink-0 ${
                                w.type === "error" ? "bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]" : "bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.5)]"
                              }`} />
                              
                              <span className={`text-[10px] leading-tight flex-1 ${
                                w.type === "error" ? "text-red-200/90" : "text-amber-200/90"
                              }`}>
                                {w.msg}
                              </span>

                              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-1/2 -translate-y-1/2">
                                <div className="text-[9px] font-bold text-muted-foreground bg-slate-900/80 px-1.5 py-0.5 rounded border border-slate-700">
                                  {lang === "ar" ? "عرض" : "Go"}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TabsContent>

                <TabsContent value="faults" className="m-0 space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {lang === "ar" ? "حقن الأعطال" : "Fault Injection"}
                    </h4>
                    <div className="space-y-2">
                      {doc.faults?.map((f) => (
                        <div
                          key={f.id}
                          className="p-3 bg-red-950/20 border border-red-900/30 rounded-xl flex items-center justify-between"
                        >
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-red-400 uppercase">
                              {f.type.replace("_", " ")}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {f.targetId}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500"
                            onClick={() => handleRemoveFault(f.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="pt-2">
                        <p className="text-[9px] text-muted-foreground mb-2">
                          {lang === "ar"
                            ? "اختر عنصراً لحقن عطل"
                            : "Select component to inject fault"}
                        </p>
                        <ScrollArea className="h-48 border rounded-lg p-2">
                          {doc.nodes.map((n) => (
                            <div
                              key={n.id}
                              className="flex items-center justify-between py-1.5 border-b border-slate-800 last:border-0"
                            >
                              <span className="text-[10px] font-mono">
                                {n.reference || n.id}
                              </span>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[8px] px-2"
                                  onClick={() => handleAddFault(n.id, "open")}
                                >
                                  OPEN
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 text-[8px] px-2"
                                  onClick={() =>
                                    handleAddFault(n.id, "high_resistance")
                                  }
                                >
                                  H-RES
                                </Button>
                              </div>
                            </div>
                          ))}
                        </ScrollArea>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="signals" className="m-0 space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {lang === "ar" ? "حقن الإشارات" : "Signal Injection"}
                    </h4>
                    <div className="space-y-4">
                      {doc.nodes
                        .filter((n) =>
                          ["vsource", "battery", "ac_source"].includes(
                            n.symbol,
                          ),
                        )
                        .map((n) => (
                          <div
                            key={n.id}
                            className="p-4 bg-slate-900/60 border border-slate-800 rounded-xl space-y-3"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">
                                {n.reference || n.id}
                              </span>
                              <Zap className="size-3 text-amber-500" />
                            </div>
                            <div className="space-y-2">
                              <label className="text-[9px] font-bold uppercase text-slate-500">
                                Signal String (SPICE)
                              </label>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={n.value}
                                  onChange={(e) =>
                                    handleUpdateSignal(n.id, e.target.value)
                                  }
                                  className="flex-1 h-8 bg-slate-950 border border-slate-800 rounded px-2 text-[10px] font-mono"
                                  placeholder="e.g. SIN(0 5 1k)"
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0"
                                  onClick={handleRun}
                                >
                                  <RotateCw className="size-4 text-emerald-500" />
                                </Button>
                              </div>
                              <p className="text-[8px] text-slate-500">
                                Example: SIN(offset amp freq) or PULSE(v1 v2 td
                                tr tf pw per)
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="stats" className="m-0 space-y-6">
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      {lang === "ar"
                        ? "إحصائيات الدائرة"
                        : "Circuit Statistics"}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        {
                          label: "Nodes",
                          val: circuitStats.nets,
                          icon: Activity,
                        },
                        {
                          label: "Elements",
                          val: circuitStats.components,
                          icon: Zap,
                        },
                        {
                          label: "Total Power",
                          val:
                            (circuitStats.totalPower * 1000).toFixed(1) + "mW",
                          icon: Thermometer,
                        },
                        {
                          label: "Faults",
                          val: circuitStats.faults,
                          icon: ShieldAlert,
                        },
                      ].map((i) => (
                        <div
                          key={i.label}
                          className="p-3 bg-slate-900/60 rounded-xl border border-slate-800 flex items-center gap-3"
                        >
                          <i.icon className="size-4 text-slate-500" />
                          <div className="flex flex-col">
                            <span className="text-[8px] font-bold text-slate-500 uppercase">
                              {i.label}
                            </span>
                            <span className="text-xs font-bold font-mono">
                              {i.val}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </Tabs>
        </div>
      </div>

      {/* Results Panel */}
      <motion.div
        layout
        className={`bg-card border-t shrink-0 flex flex-col shadow-[0_-10px_30px_rgba(0,0,0,0.5)] transition-all duration-500 ${resultsOpen ? "h-1/2" : "h-12"}`}
      >
        <div
          className="h-12 px-6 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-all shrink-0 border-b border-white/5"
          onClick={() => setResultsOpen(!resultsOpen)}
        >
          <div className="flex items-center gap-3">
            <BarChart3
              className={`size-4 ${results.length > 0 ? "text-emerald-500" : "text-muted-foreground"}`}
            />
            <span className="text-[11px] font-black uppercase tracking-[0.1em]">
              {lang === "ar" ? "محلل الإشارات" : "Signal Analyzer"}
            </span>
          </div>
          <div className="flex items-center gap-4">
            {results.length > 0 && (
              <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-800 gap-1">
                {(["voltage", "current", "power"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFilter({ ...filter, [type]: !filter[type] });
                    }}
                    className={`px-3 py-1 rounded-md text-[9px] font-bold transition-all ${
                      filter[type]
                        ? "bg-slate-700 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-400"
                    }`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1">
              {resultsOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronUp className="size-4" />
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {resultsOpen && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-1 p-6 overflow-hidden flex flex-col"
            >
              {results.length > 0 ? (
                <div className="w-full h-full flex flex-col">
                  <div className="flex-1 min-h-0 bg-slate-900/30 rounded-2xl border border-slate-800/50 p-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={chartData}
                        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke="#1e293b"
                          vertical={false}
                        />
                        <XAxis
                          dataKey="t"
                          scale={
                            settings.analysisType === "AC" ? "log" : "auto"
                          }
                          domain={
                            settings.analysisType === "AC"
                              ? [settings.acStartFreq!, settings.acStopFreq!]
                              : [0, settings.tranStop || "auto"]
                          }
                          type="number"
                          stroke="#475569"
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) =>
                            settings.analysisType === "AC"
                              ? v >= 1000
                                ? (v / 1000).toFixed(0) + "k"
                                : v.toFixed(0)
                              : v.toFixed(3)
                          }
                        />
                        {filteredResults.some(r => r.type === "voltage" || r.type === "ac_mag") && (
                          <YAxis
                            yAxisId="voltage"
                            orientation="left"
                            stroke="#34d399"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => v.toFixed(2) + (settings.analysisType === "AC" ? "dB" : "V")}
                          />
                        )}
                        {filteredResults.some(r => r.type === "current" || r.type === "ac_phase") && (
                          <YAxis
                            yAxisId="current"
                            orientation="right"
                            stroke="#60a5fa"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => (v < 1 && v > -1 && v !== 0 ? (v * 1000).toFixed(1) + "m" : v.toFixed(2)) + (settings.analysisType === "AC" ? "°" : "A")}
                          />
                        )}
                        {filteredResults.some(r => r.type === "power") && (
                          <YAxis
                            yAxisId="power"
                            orientation="right"
                            stroke="#f59e0b"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => (v < 1 && v > -1 && v !== 0 ? (v * 1000).toFixed(1) + "m" : v.toFixed(2)) + "W"}
                          />
                        )}
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "rgba(15, 23, 42, 0.95)",
                            border: "1px solid rgba(148, 163, 184, 0.1)",
                            borderRadius: "12px",
                            fontSize: "10px",
                          }}
                          labelFormatter={(v) =>
                            settings.analysisType === "AC"
                              ? `${v} Hz`
                              : `${v} s`
                          }
                        />
                        <Legend
                          wrapperStyle={{
                            fontSize: "10px",
                            fontWeight: "bold",
                            paddingTop: "20px",
                          }}
                        />
                        {filteredResults.map((res, i) => (
                          <Line
                            key={`${res.node}-${res.type}`}
                            yAxisId={
                              res.type === "voltage" || res.type === "ac_mag"
                                ? "voltage"
                                : res.type === "current" || res.type === "ac_phase"
                                ? "current"
                                : "power"
                            }
                            type="monotone"
                            dataKey={
                              res.node +
                              (settings.analysisType === "AC"
                                ? ` (${res.type === "ac_mag" ? "dB" : "°"})`
                                : "")
                            }
                            stroke={
                              [
                                "#10b981",
                                "#3b82f6",
                                "#f59e0b",
                                "#ef4444",
                                "#a855f7",
                                "#ec4899",
                                "#06b6d4",
                              ][i % 7]
                            }
                            strokeWidth={2.5}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted-foreground border-2 border-dashed border-slate-800/50 rounded-2xl bg-slate-900/10">
                  <div className="text-center space-y-3">
                    <Waves className="size-12 mx-auto opacity-10" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">
                      {lang === "ar"
                        ? "في انتظار إشارة الدخل"
                        : "Waiting for Input Signal"}
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
