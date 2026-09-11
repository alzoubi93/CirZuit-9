import React, { useRef } from "react";
import {
  X,
  Crosshair,
  Layers,
  Cpu,
  Compass,
  Maximize2,
  SlidersHorizontal,
  Info,
  Upload,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PcbDoc, PcbFootprint } from "@/lib/pcb";

interface ThreeDComponentCardProps {
  footprint: PcbFootprint | null;
  onClose: () => void;
  onCenterCamera: () => void;
  lang?: string;
  onUpdateFootprint?: (id: string, updates: Partial<PcbFootprint>) => void;
}

export function ThreeDComponentCard({
  footprint,
  onClose,
  onCenterCamera,
  lang = "en",
  onUpdateFootprint,
}: ThreeDComponentCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!footprint) return null;

  const isAr = lang === "ar";

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      onUpdateFootprint(footprint.id, {
        custom3DModel: dataUrl,
        custom3DModelType: type
      });
    };
    reader.readAsDataURL(file);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveModel = () => {
    if (onUpdateFootprint) {
      onUpdateFootprint(footprint.id, {
        custom3DModel: undefined,
        custom3DModelType: undefined
      });
    }
  };

  return (
    <div className="absolute top-16 right-4 z-40 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-xl shadow-2xl p-4 text-slate-100 animate-in fade-in slide-in-from-right-4 duration-200 pointer-events-auto">
      <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Cpu className="size-4 text-emerald-400" />
          <span className="font-bold text-sm text-white">
            {footprint.reference || footprint.symbol}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-6 w-6 text-slate-400 hover:text-white"
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400">{isAr ? "القيمة" : "Value"}:</span>
          <span className="font-mono font-semibold text-emerald-300">
            {footprint.value || "—"}
          </span>
        </div>

        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400">{isAr ? "الرمز" : "Symbol"}:</span>
          <span className="font-mono text-slate-200">{footprint.symbol}</span>
        </div>

        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400">
            {isAr ? "المغلف (Footprint)" : "Footprint"}:
          </span>
          <span className="font-mono text-slate-200">
            {footprint.packageId || footprint.symbol}
          </span>
        </div>

        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400">{isAr ? "الإحداثيات" : "Position"}:</span>
          <span className="font-mono text-slate-200">
            X: {footprint.x.toFixed(2)}mm, Y: {footprint.y.toFixed(2)}mm
          </span>
        </div>

        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400">{isAr ? "الدوران" : "Rotation"}:</span>
          <span className="font-mono text-slate-200">{footprint.rotation}°</span>
        </div>

        <div className="flex justify-between py-1 border-b border-slate-800/60">
          <span className="text-slate-400">{isAr ? "عدد الأطراف" : "Pads"}:</span>
          <span className="font-mono text-slate-200">{footprint.pads.length}</span>
        </div>

        {/* Custom 3D Model Upload Section */}
        <div className="py-2 mt-2">
          <span className="text-slate-400 block mb-2">{isAr ? "نموذج 3D مخصص" : "Custom 3D Model"}:</span>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload}
            accept=".stp,.step,.glb" 
            className="hidden" 
          />
          
          <div className="flex flex-col gap-2">
            {!footprint.custom3DModel ? (
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                size="sm" 
                variant="outline" 
                className="w-full h-8 text-xs bg-slate-800 hover:bg-slate-700 border-slate-700 hover:border-slate-600 text-slate-300"
              >
                <Upload className="size-3.5 mr-2" />
                {isAr ? "استيراد STP / GLB" : "Import STP / GLB"}
              </Button>
            ) : (
              <div className="flex items-center justify-between bg-slate-800/50 p-2 rounded border border-slate-700">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className="size-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
                  <span className="truncate font-mono text-[10px] text-emerald-400">
                    {footprint.custom3DModelType?.toUpperCase()} {isAr ? "محمل" : "Loaded"}
                  </span>
                </div>
                <Button 
                  onClick={handleRemoveModel} 
                  size="icon" 
                  variant="ghost" 
                  className="size-5 h-5 w-5 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            )}
            
            {!footprint.custom3DModel && (
              <div className="flex items-start gap-1.5 text-[10px] text-slate-500 leading-tight">
                <Info className="size-3 shrink-0 mt-0.5" />
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

      <Button
        onClick={onCenterCamera}
        size="sm"
        className="w-full mt-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium gap-1.5 shadow-md shadow-emerald-600/20"
      >
        <Crosshair className="size-3.5" />
        <span>{isAr ? "تركيز الكاميرا" : "Center Camera"}</span>
      </Button>
    </div>
  );
}

interface ThreeDBoardStatsHudProps {
  pcb: PcbDoc;
  lang?: string;
  surfaceFinish: string;
}

export function ThreeDBoardStatsHud({
  pcb,
  lang = "en",
  surfaceFinish,
}: ThreeDBoardStatsHudProps) {
  const isAr = lang === "ar";

  return (
    <div className="absolute top-16 left-4 z-30 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-xl px-3.5 py-2.5 shadow-lg text-xs space-y-1.5 pointer-events-auto">
      <div className="flex items-center gap-2 font-bold text-slate-200 border-b border-slate-800 pb-1.5">
        <Layers className="size-3.5 text-blue-400" />
        <span>{isAr ? "إحصائيات لوحة PCB" : "Board Specifications"}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-400">
        <div>
          <span className="text-slate-500">{isAr ? "الأبعاد:" : "Size:"} </span>
          <span className="text-slate-200 font-mono">
            {pcb.width.toFixed(1)} × {pcb.height.toFixed(1)} mm
          </span>
        </div>

        <div>
          <span className="text-slate-500">{isAr ? "السمك:" : "Thickness:"} </span>
          <span className="text-slate-200 font-mono">1.6 mm FR4</span>
        </div>

        <div>
          <span className="text-slate-500">{isAr ? "العناصر:" : "Parts:"} </span>
          <span className="text-slate-200 font-mono">{pcb.footprints.length}</span>
        </div>

        <div>
          <span className="text-slate-500">{isAr ? "المسارات:" : "Tracks:"} </span>
          <span className="text-slate-200 font-mono">{pcb.tracks.length}</span>
        </div>

        <div>
          <span className="text-slate-500">{isAr ? "العابر (Vias):" : "Vias:"} </span>
          <span className="text-slate-200 font-mono">{pcb.vias.length}</span>
        </div>

        <div>
          <span className="text-slate-500">{isAr ? "الطلاء:" : "Finish:"} </span>
          <span className="text-amber-400 font-semibold">{surfaceFinish}</span>
        </div>
      </div>
    </div>
  );
}

interface ThreeDViewPresetsBarProps {
  onSelectPreset: (preset: "iso" | "top" | "bottom" | "front" | "side") => void;
  activePreset?: string;
  lang?: string;
}

export function ThreeDViewPresetsBar({
  onSelectPreset,
  activePreset = "iso",
  lang = "en",
}: ThreeDViewPresetsBarProps) {
  const isAr = lang === "ar";

  const presets = [
    { id: "iso", label: isAr ? "منظور (3D)" : "Isometric", title: "Tilt 55°, Rotate -30°" },
    { id: "top", label: isAr ? "من الأعلى" : "Top View", title: "Tilt 0°, Rotate 0°" },
    { id: "bottom", label: isAr ? "من الأسفل" : "Bottom View", title: "Tilt 180°, Rotate 0°" },
    { id: "front", label: isAr ? "أمامي" : "Front Edge", title: "Tilt 75°, Rotate 0°" },
    { id: "side", label: isAr ? "جانبي" : "Side Edge", title: "Tilt 75°, Rotate 90°" },
  ] as const;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-full shadow-lg">
      <div className="flex items-center gap-1.5 px-2.5 text-[10px] uppercase font-bold text-slate-400 border-r border-slate-800">
        <Compass className="size-3 text-emerald-400" />
        <span className="hidden sm:inline">{isAr ? "الزاوية" : "Presets"}</span>
      </div>
      {presets.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelectPreset(p.id)}
          title={p.title}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
            activePreset === p.id
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/50 shadow-sm"
              : "text-slate-300 hover:text-white hover:bg-slate-800/60"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
