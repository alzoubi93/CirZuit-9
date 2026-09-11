import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  FolderOpen,
  Library,
  RefreshCw,
  Search,
  Sparkles,
  X,
  Eye,
  Box,
  Cpu,
  Cable,
  Zap,
  Sliders,
  Microchip,
  Radio,
  Layers,
  Loader2,
  Check,
  Plus,
  FileUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useI18n } from "@/i18n";
import {
  classifyFootprintMountingType,
  kicadFootprintLibrary,
  kicadFootprintRuntime,
  readKicadFootprintDefinition,
  type KicadFootprintLibraryEntry,
  type KicadFootprintModel,
  type KicadFootprintRuntime,
} from "@/lib/kicad/footprint";
import { KicadFootprintRenderer, nativeFootprintBounds } from "./KicadFootprintRenderer";
import {
  FOOTPRINT_FAMILIES,
  generateFootprint,
  guessFootprintConfigFromSymbol,
  type FootprintFamilyDefinition,
} from "@/lib/kicad/generator";
import {
  STANDARD_SMD_RESISTOR_SIZES,
  STANDARD_THT_RESISTOR_SIZES,
  STANDARD_SMD_CAPACITOR_SIZES,
  STANDARD_THT_CAPACITOR_SIZES,
  CHIP_METRIC_NAMES,
  QUICK_STANDARD_THT_RESISTOR_PACKAGES,
  MORE_STANDARD_THT_RESISTOR_PACKAGES,
  QUICK_STANDARD_THT_CAPACITOR_PACKAGES,
  MORE_STANDARD_THT_CAPACITOR_PACKAGES,
} from "@/lib/kicad/generator/families/passive";
import {
  STANDARD_SMD_DIODE_SIZES,
  STANDARD_SMD_LED_SIZES,
  STANDARD_THT_DIODE_SIZES,
  STANDARD_THT_LED_SIZES,
  QUICK_STANDARD_THT_DIODE_PACKAGES,
  MORE_STANDARD_THT_DIODE_PACKAGES,
} from "@/lib/kicad/generator/families/diode";
import {
  QUICK_STANDARD_THT_INDUCTOR_PACKAGES,
  MORE_STANDARD_THT_INDUCTOR_PACKAGES,
  STANDARD_SMD_INDUCTOR_PACKAGES,
} from "@/lib/kicad/generator/families/inductor";
import {
  QUICK_STANDARD_THT_PACKAGES,
  MORE_STANDARD_THT_PACKAGES,
  ALL_THT_TRANSISTOR_PACKAGES,
  STANDARD_SMD_TRANSISTOR_PACKAGES,
  type TransistorType,
  type TransistorPolarity,
} from "@/lib/kicad/generator/families/transistor";
import {
  STANDARD_SMD_CRYSTAL_PACKAGES,
  QUICK_STANDARD_THT_CRYSTAL_PACKAGES,
  MORE_STANDARD_THT_CRYSTAL_PACKAGES,
} from "@/lib/kicad/generator/families/crystal";
import {
  STANDARD_SMD_SWITCH_PACKAGES,
  QUICK_STANDARD_THT_SWITCH_PACKAGES,
  MORE_STANDARD_THT_SWITCH_PACKAGES,
} from "@/lib/kicad/generator/families/switchRelay";
import {
  STANDARD_SMD_FUSE_PACKAGES,
  QUICK_STANDARD_THT_FUSE_PACKAGES,
  MORE_STANDARD_THT_FUSE_PACKAGES,
} from "@/lib/kicad/generator/families/fuseProtection";
import {
  STANDARD_SMD_POTENTIOMETER_PACKAGES,
  QUICK_STANDARD_THT_POTENTIOMETER_PACKAGES,
  MORE_STANDARD_THT_POTENTIOMETER_PACKAGES,
} from "@/lib/kicad/generator/families/potentiometer";
import {
  STANDARD_SMD_OPTOCOUPLER_PACKAGES,
  QUICK_STANDARD_THT_OPTOCOUPLER_PACKAGES,
  MORE_STANDARD_THT_OPTOCOUPLER_PACKAGES,
} from "@/lib/kicad/generator/families/optocoupler";
import {
  STANDARD_SMD_BATTERY_PACKAGES,
  QUICK_STANDARD_THT_BATTERY_PACKAGES,
  MORE_STANDARD_THT_BATTERY_PACKAGES,
} from "@/lib/kicad/generator/families/batteriesPower";
import {
  FootprintLayerToggles,
  DEFAULT_LAYER_VISIBILITY,
} from "./FootprintLayerToggles";
import { CrystalFamilySection } from "./footprint-families/CrystalFamilySection";
import { SwitchRelayFamilySection } from "./footprint-families/SwitchRelayFamilySection";
import { FuseProtectionFamilySection } from "./footprint-families/FuseProtectionFamilySection";
import { PotentiometerFamilySection } from "./footprint-families/PotentiometerFamilySection";
import { OptocouplerFamilySection } from "./footprint-families/OptocouplerFamilySection";
import { BatteriesPowerFamilySection } from "./footprint-families/BatteriesPowerFamilySection";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport?: (footprint: KicadFootprintModel) => void;
  onGenerate?: (footprint?: KicadFootprintModel) => void;
  /** Assignment mode selects a library footprint for a schematic component without placing it on the PCB. */
  selectionOnly?: boolean;
  onSelect?: (footprint: KicadFootprintModel) => void;
  initialTab?: "import" | "generator";
  initialFamily?: string;
  initialPreset?: string;
  initialParams?: Record<string, any>;
  symbolContext?: {
    symbol?: string;
    reference?: string;
    value?: string;
    pinCount?: number;
  };
}

type FootprintCategory = "all" | "ic_packages" | "connectors" | "passives" | "semiconductors" | "switches" | "modules";

/**
 * Backwards-compatible export for PcbEditor.tsx and other callers.
 */
export function buildGeneratorModel(params: {
  packageType: string;
  pinCount?: number;
  pitch?: number;
  rowSpacing?: number;
  padWidth?: number;
  padHeight?: number;
  drill?: number;
  prefix?: string;
  value?: string;
  [key: string]: any;
}): KicadFootprintModel {
  const pkg = (params.packageType || "dip").toLowerCase();
  const familyId =
    pkg === "radialcap"
      ? "passive"
      : pkg === "passive"
      ? "passive"
      : FOOTPRINT_FAMILIES[pkg]
      ? pkg
      : "dip";

  const extra =
    pkg === "radialcap"
      ? { subtype: "Radial_THT", polarized: true, bodyDiameter: 6.3 }
      : {};

  return generateFootprint(familyId, {
    ...params,
    ...extra,
    reference: params.prefix || params.reference || "U",
    value: params.value || params.packageType,
  });
}

function classifyFootprintLibrary(name: string): FootprintCategory {
  const lower = name.toLowerCase();
  if (
    lower.startsWith("package_") ||
    lower.includes("bga") ||
    lower.includes("qfp") ||
    lower.includes("qfn") ||
    lower.includes("soic") ||
    lower.includes("dip") ||
    lower.includes("lqfp") ||
    lower.includes("tssop") ||
    lower.includes("dfn") ||
    lower.includes("son") ||
    lower.includes("sip")
  ) {
    return "ic_packages";
  }
  if (
    lower.startsWith("connector") ||
    lower.includes("pinheader") ||
    lower.includes("pinsocket") ||
    lower.includes("terminalblock") ||
    lower.includes("socket") ||
    lower.includes("plug") ||
    lower.includes("jack") ||
    lower.includes("usb") ||
    lower.includes("rj45") ||
    lower.includes("molex") ||
    lower.includes("jst")
  ) {
    return "connectors";
  }
  if (
    lower.startsWith("resistor") ||
    lower.startsWith("capacitor") ||
    lower.startsWith("inductor") ||
    lower.startsWith("transformer") ||
    lower.startsWith("potentiometer") ||
    lower.includes("ferrite")
  ) {
    return "passives";
  }
  if (
    lower.startsWith("diode") ||
    lower.startsWith("led") ||
    lower.startsWith("transistor") ||
    lower.startsWith("display") ||
    lower.startsWith("crystal") ||
    lower.startsWith("oscillator") ||
    lower.includes("optodevice") ||
    lower.includes("sensor")
  ) {
    return "semiconductors";
  }
  if (
    lower.startsWith("button") ||
    lower.startsWith("relay") ||
    lower.startsWith("fuse") ||
    lower.startsWith("buzzer") ||
    lower.includes("switch")
  ) {
    return "switches";
  }
  if (
    lower.startsWith("module") ||
    lower.startsWith("rf_") ||
    lower.startsWith("battery") ||
    lower.includes("converter") ||
    lower.includes("shield") ||
    lower.includes("esp32") ||
    lower.includes("arduino")
  ) {
    return "modules";
  }
  return "all";
}

function FootprintPreview({
  footprint,
  className = "w-full h-full",
  layerVisibility,
}: {
  footprint: KicadFootprintModel | KicadFootprintRuntime | null;
  className?: string;
  layerVisibility?: Record<string, boolean>;
}) {
  if (!footprint) {
    return (
      <div className="h-full grid place-items-center text-xs text-slate-500 font-mono">
        No footprint selected
      </div>
    );
  }
  const b = nativeFootprintBounds(footprint);
  const rawW = b.maxX - b.minX;
  const rawH = b.maxY - b.minY;
  const w = Math.max(1.8, Number.isFinite(rawW) ? rawW : 5);
  const h = Math.max(1.8, Number.isFinite(rawH) ? rawH : 5);
  const pad = Math.max(0.8, Math.max(w, h) * 0.12);
  const minX = Number.isFinite(b.minX) ? b.minX : -w / 2;
  const minY = Number.isFinite(b.minY) ? b.minY : -h / 2;

  return (
    <svg
      viewBox={`${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
    >
      <KicadFootprintRenderer
        footprint={footprint}
        reference="REF**"
        value={footprint.name}
        layerVisibility={layerVisibility}
      />
    </svg>
  );
}

function FootprintListItemRow({
  entry,
  library,
  selectionOnly,
  onInspect,
  onSelect,
}: {
  entry: KicadFootprintLibraryEntry;
  library: string;
  selectionOnly: boolean;
  onInspect: (model: KicadFootprintModel) => void;
  onSelect: (model: KicadFootprintModel) => void;
}) {
  const { lang } = useI18n();
  const [loading, setLoading] = useState(false);

  const handleClick = async (action: "inspect" | "select") => {
    setLoading(true);
    try {
      const model = await kicadFootprintLibrary.load(entry);
      const full = { ...model, library: model.library || library };
      if (action === "inspect") onInspect(full);
      else onSelect(full);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="p-2.5 sm:p-3 hover:bg-slate-800/60 transition-colors group cursor-pointer flex flex-col gap-2"
      onClick={() => handleClick("inspect")}
    >
      <div className="flex items-start gap-2.5 min-w-0 w-full">
        <div className="p-2 rounded-lg bg-slate-950 border border-slate-800 text-blue-400 shrink-0 group-hover:bg-blue-600/20 group-hover:border-blue-500/50 transition-colors mt-0.5">
          <Box className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm font-mono font-bold text-slate-200 group-hover:text-blue-400 transition-colors break-all leading-snug">
            {entry.name}
          </div>
          <div className="text-[10px] text-slate-500 font-mono break-all mt-0.5">
            {library}:{entry.name}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1 justify-end" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant="outline"
          className="h-7 w-8 px-0 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 shrink-0 flex items-center justify-center"
          disabled={loading}
          onClick={() => handleClick("inspect")}
          title={lang === "ar" ? "معاينة البصمة" : "Preview Footprint"}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin text-blue-500" /> : <Eye className="size-3.5 text-blue-400" />}
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 w-8 px-0 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 shrink-0 flex items-center justify-center"
          disabled={loading}
          onClick={() => handleClick("select")}
          title={selectionOnly ? (lang === "ar" ? "تعيين البصمة" : "Assign Footprint") : (lang === "ar" ? "استيراد البصمة" : "Import Footprint")}
        >
          {loading ? <Loader2 className="size-3.5 animate-spin text-blue-500" /> : <Download className="size-3.5 text-blue-400" />}
        </Button>
      </div>
    </div>
  );
}

function FootprintThumbnailCard({
  entry,
  library,
  onSelect,
  onInspect,
  actionLabel,
}: {
  entry: KicadFootprintLibraryEntry;
  library: string;
  onSelect: (model: KicadFootprintModel) => void;
  onInspect: (model: KicadFootprintModel, entry: KicadFootprintLibraryEntry) => void;
  actionLabel?: string;
}) {
  const [model, setModel] = useState<KicadFootprintModel | null>(() => kicadFootprintLibrary.getCached(entry.path) || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    if (!model) {
      setLoading(true);
      kicadFootprintLibrary
        .load(entry)
        .then((m) => {
          if (active) {
            setModel(m);
            setLoading(false);
          }
        })
        .catch(() => {
          if (active) {
            setLoading(false);
          }
        });
    }
    return () => {
      active = false;
    };
  }, [entry, model]);

  const padCount = model ? ("GetPads" in model ? (model as any).GetPads().length : model.pads?.length ?? 0) : 0;
  const mounting = model ? classifyFootprintMountingType("GetRenderModel" in model ? (model as any).GetRenderModel() : model) : null;
  const bounds = model ? nativeFootprintBounds(model) : null;
  const widthMm = bounds ? Math.max(0.1, bounds.maxX - bounds.minX) : 0;
  const heightMm = bounds ? Math.max(0.1, bounds.maxY - bounds.minY) : 0;

  return (
    <div
      className="group relative flex flex-col justify-between p-2 sm:p-2.5 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 hover:border-blue-500/40 transition-all shadow-sm cursor-pointer"
      onClick={() => {
        if (model) onInspect(model, entry);
      }}
    >
      {/* Footprint Visual Preview */}
      <div className="w-full bg-slate-950/80 rounded-lg p-2 flex items-center justify-center min-h-[90px] h-[95px] sm:min-h-[105px] sm:h-[110px] border border-slate-800/80 relative overflow-hidden">
        {model ? (
          <FootprintPreview footprint={model} className="w-full h-full" />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center gap-1 text-slate-500 text-xs">
            <Loader2 className="size-4 animate-spin text-blue-500" />
            <span className="text-[10px] font-mono">Loading…</span>
          </div>
        ) : (
          <div className="text-[10px] text-slate-600 text-center font-mono">Footprint</div>
        )}

        {/* Badges */}
        {model && (
          <>
            <span className="absolute bottom-1 end-1 text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-900/90 border border-slate-700 text-slate-300 shadow-sm">
              {padCount} {padCount === 1 ? "pad" : "pads"}
            </span>
            {mounting && mounting !== "Unknown" && (
              <span
                className={`absolute top-1 start-1 text-[9px] font-semibold px-1.5 py-0.5 rounded border shadow-sm ${
                  mounting === "SMD"
                    ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                    : mounting === "THT"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-purple-500/10 text-purple-400 border-purple-500/30"
                }`}
              >
                {mounting}
              </span>
            )}
          </>
        )}
      </div>

      {/* Footprint Title & Dimensions */}
      <div className="mt-2 space-y-0.5">
        <div className="text-xs font-bold font-mono text-slate-100 truncate" title={entry.name}>
          {entry.name}
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400">
          <span className="truncate font-mono">
            {widthMm > 0 ? `${widthMm.toFixed(1)} × ${heightMm.toFixed(1)} mm` : entry.library}
          </span>
        </div>
      </div>

      {/* Card Action Controls */}
      <div
        className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-end gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 shrink-0"
          onClick={() => {
            if (model) onInspect(model, entry);
            else {
              kicadFootprintLibrary.load(entry).then((m) => onInspect(m, entry));
            }
          }}
          title="معاينة البصمة"
        >
          <Eye className="size-3" />
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10 shrink-0"
          onClick={async () => {
            if (model) {
              const full = { ...model, library: model.library || library };
              onSelect(full);
            } else {
              setLoading(true);
              try {
                const m = await kicadFootprintLibrary.load(entry);
                const full = { ...m, library: m.library || library };
                onSelect(full);
              } finally {
                setLoading(false);
              }
            }
          }}
          title={actionLabel || "استيراد"}
        >
          <Download className="size-3" />
        </Button>
      </div>
    </div>
  );
}

function getDefaultReferenceForFamilyAndPreset(
  familyId: string,
  presetId?: string,
  params?: Record<string, any>
): string {
  switch (familyId) {
    case "passive": {
      const compType = params?.componentType;
      const pid = (presetId || "").toLowerCase();
      if (
        compType === "Capacitor" ||
        pid.startsWith("c-") ||
        pid.startsWith("cp-") ||
        pid.includes("capacitor")
      ) {
        return "C";
      }
      if (
        compType === "Inductor" ||
        pid.startsWith("l-") ||
        pid.includes("inductor")
      ) {
        return "L";
      }
      if (
        compType === "Resistor" ||
        pid.startsWith("r-") ||
        pid.includes("resistor")
      ) {
        return "R";
      }
      return "R";
    }
    case "diode":
      return "D";
    case "transistor":
      return "Q";
    case "connector":
      return "J";
    case "crystal":
      return "Y";
    case "inductor":
      return "L";
    case "switch_relay": {
      const pkg = (params?.packageType || "").toLowerCase();
      return pkg.includes("relay") ? "K" : "SW";
    }
    case "fuse_protection": {
      const pkg = (params?.packageType || "").toLowerCase();
      if (pkg.includes("mov") || pkg.includes("varistor")) return "RV";
      if (pkg.includes("tvs")) return "D";
      return "F";
    }
    case "potentiometer":
      return "RV";
    case "optocoupler":
      return "U";
    case "connector_interface":
      return "J";
    case "display":
      return "DS";
    case "sensor":
      return "U";
    case "rf_antenna": {
      const pkg = (params?.packageType || "").toLowerCase();
      return pkg.includes("antenna") ? "ANT" : "J";
    }
    case "modules":
      return "U";
    case "test_mechanical": {
      const pkg = (params?.packageType || "").toLowerCase();
      if (pkg.includes("testpoint")) return "TP";
      if (pkg.includes("hole")) return "H";
      if (pkg.includes("fiducial")) return "FID";
      return "TP";
    }
    case "batteries_power": {
      const pkg = (params?.packageType || "").toLowerCase();
      return pkg.includes("battery") ? "BT" : "J";
    }
    case "dip":
    case "soic":
    case "qfp":
    case "qfn":
    case "bga":
    default:
      return "U";
  }
}

export function FootprintBrowser({
  open,
  onOpenChange,
  onImport,
  onGenerate,
  selectionOnly = false,
  onSelect,
  initialTab,
  initialFamily,
  initialPreset,
  initialParams,
  symbolContext,
}: Props) {
  const { lang } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const [mainTab, setMainTab] = useState<"import" | "generator">(initialTab || "import");
  const [libraries, setLibraries] = useState<string[]>([]);
  const [library, setLibrary] = useState("");
  const [activeCategory, setActiveCategory] = useState<FootprintCategory>("all");
  const [entries, setEntries] = useState<KicadFootprintLibraryEntry[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<KicadFootprintModel | KicadFootprintRuntime | null>(null);
  const [view, setView] = useState<"libraries" | "footprints" | "preview">("libraries");
  const [footprintsLayout, setFootprintsLayout] = useState<"list" | "grid">("list");
  const [loading, setLoading] = useState(false);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Layer Toggles state (All checked by default as requested)
  const [layerVisibility, setLayerVisibility] = useState<Record<string, boolean>>(DEFAULT_LAYER_VISIBILITY);

  // Initial family & params from context or props
  const guessedConfig = useMemo(() => {
    if (symbolContext) {
      return guessFootprintConfigFromSymbol({
        symbolName: symbolContext.symbol,
        reference: symbolContext.reference,
        value: symbolContext.value,
        pinCount: symbolContext.pinCount,
      });
    }
    return { familyId: initialFamily || "dip", presetId: initialPreset, params: {} };
  }, [symbolContext, initialFamily, initialPreset]);

  // Comprehensive Footprint Generator State
  const [genFamilyId, setGenFamilyId] = useState<string>(initialFamily || guessedConfig.familyId || "dip");
  const [genPresetId, setGenPresetId] = useState<string | undefined>(initialPreset || guessedConfig.presetId);
  const [genParams, setGenParams] = useState<Record<string, any>>(() => {
    const familyId = initialFamily || guessedConfig.familyId || "dip";
    const presetId = initialPreset || guessedConfig.presetId;
    const family = FOOTPRINT_FAMILIES[familyId] || FOOTPRINT_FAMILIES.dip;
    const merged = {
      ...family.defaultParams,
      ...(initialParams || {}),
      ...(guessedConfig.params || {}),
    };
    const defaultRef = getDefaultReferenceForFamilyAndPreset(familyId, presetId, merged);
    return {
      ...merged,
      reference: symbolContext?.reference || defaultRef,
      value: symbolContext?.value || symbolContext?.symbol || family.name,
    };
  });

  // When dialog opens or symbolContext changes, re-initialize generator
  useEffect(() => {
    if (open) {
      if (initialTab) setMainTab(initialTab);
      const targetFamilyId = initialFamily || guessedConfig.familyId || "dip";
      const family = FOOTPRINT_FAMILIES[targetFamilyId] || FOOTPRINT_FAMILIES.dip;
      const targetPresetId = initialPreset || guessedConfig.presetId;
      setGenFamilyId(targetFamilyId);
      setGenPresetId(targetPresetId);

      const merged = {
        ...family.defaultParams,
        ...(guessedConfig.params || {}),
        ...(initialParams || {}),
      };
      const defaultRef = getDefaultReferenceForFamilyAndPreset(targetFamilyId, targetPresetId, merged);

      setGenParams({
        ...merged,
        reference: symbolContext?.reference || defaultRef,
        value: symbolContext?.value || symbolContext?.symbol || family.name,
      });
    }
  }, [open, initialTab, initialFamily, initialPreset, guessedConfig, symbolContext]);

  // Active Family Definition
  const currentFamily: FootprintFamilyDefinition = FOOTPRINT_FAMILIES[genFamilyId] || FOOTPRINT_FAMILIES.dip;

  // Handle Family Switch
  const handleSelectFamily = (familyId: string) => {
    const target = FOOTPRINT_FAMILIES[familyId];
    if (!target) return;
    setGenFamilyId(familyId);
    const newPresetId = target.presets[0]?.id;
    setGenPresetId(newPresetId);
    const merged = { ...target.defaultParams };
    const defaultRef = getDefaultReferenceForFamilyAndPreset(familyId, newPresetId, merged);
    setGenParams({
      ...merged,
      reference: defaultRef,
      value: symbolContext?.value || target.name,
    });
  };

  // Handle Preset Select
  const handleSelectPreset = (presetId: string) => {
    const preset = currentFamily.presets.find((p) => p.id === presetId);
    if (!preset) return;
    setGenPresetId(presetId);
    let mergedParams = { ...genParams, ...preset.params };

    if (genFamilyId === "passive") {
      if (presetId === "resistor-smd") {
        const found = STANDARD_SMD_RESISTOR_SIZES.find((s) => s.id === (mergedParams.chipSize || "0805")) || STANDARD_SMD_RESISTOR_SIZES[4];
        mergedParams = {
          ...mergedParams,
          categoryGroup: "resistor",
          packageType: "SMD",
          componentType: "Resistor",
          subtype: "SMD_Chip",
          chipSize: found.id,
          pitch: found.pitch,
          padWidth: found.padWidth,
          padHeight: found.padHeight,
          bodyLength: found.bodyLength,
          bodyWidth: found.bodyWidth,
          value: `R_${found.id}_${CHIP_METRIC_NAMES[found.id] || "Metric"}`,
          reference: "R",
        };
      } else if (presetId === "capacitor-smd") {
        const found = STANDARD_SMD_CAPACITOR_SIZES.find((s) => s.id === (mergedParams.chipSize || "0805")) || STANDARD_SMD_CAPACITOR_SIZES[4];
        mergedParams = {
          ...mergedParams,
          categoryGroup: "capacitor",
          packageType: "SMD",
          componentType: "Capacitor",
          subtype: "SMD_Chip",
          chipSize: found.id,
          pitch: found.pitch,
          padWidth: found.padWidth,
          padHeight: found.padHeight,
          bodyLength: found.bodyLength,
          bodyWidth: found.bodyWidth,
          polarized: found.polarized,
          value: found.id.startsWith("EIA-") ? `C_${found.id}` : `C_${found.id}_${CHIP_METRIC_NAMES[found.id] || "Metric"}`,
          reference: "C",
        };
      } else if (presetId === "resistor-tht") {
        const found = STANDARD_THT_RESISTOR_SIZES.find((s) => s.id === (mergedParams.packageSize || "axial-0207")) || STANDARD_THT_RESISTOR_SIZES[1];
        mergedParams = {
          ...mergedParams,
          categoryGroup: "resistor",
          packageType: "THT",
          componentType: "Resistor",
          subtype: "Axial_THT",
          packageSize: found.id,
          pitch: found.pitch,
          bodyLength: found.bodyLength,
          bodyDiameter: found.bodyDiameter,
          drill: found.drill,
          padWidth: found.padWidth,
          value: `R_${found.id.toUpperCase()}_P${found.pitch}mm`,
          reference: "R",
        };
      } else if (presetId.startsWith("capacitor-tht")) {
        const defaultId = presetId === "capacitor-tht-disc" ? "disc-d5-p2.54" : presetId === "capacitor-tht-box" ? "film-l7.2-p5.0" : "radial-d8-p3.5";
        const found = STANDARD_THT_CAPACITOR_SIZES.find((s) => s.id === (mergedParams.packageSize || defaultId)) || STANDARD_THT_CAPACITOR_SIZES[3];
        mergedParams = {
          ...mergedParams,
          categoryGroup: "capacitor",
          packageType: "THT",
          componentType: "Capacitor",
          packageSize: found.id,
          subtype: found.subtype,
          pitch: found.pitch,
          bodyDiameter: found.bodyDiameter,
          bodyLength: (found as any).bodyLength,
          bodyWidth: (found as any).bodyWidth,
          drill: found.drill,
          padWidth: found.padWidth,
          polarized: found.polarized,
          value: found.polarized ? `CP_Radial_D${found.bodyDiameter}mm_P${found.pitch}mm` : (found as any).bodyLength ? `C_Film_L${(found as any).bodyLength}mm_P${found.pitch}mm` : `C_${found.id.toUpperCase()}`,
          reference: "C",
        };
      }
    }

    if (genFamilyId === "diode") {
      if (presetId === "diodes-smd") {
        mergedParams = {
          ...mergedParams,
          packageType: "SMA",
          packageSize: "SMA",
          isLed: false,
          value: "D_SMA",
        };
      } else if (presetId === "leds-smd") {
        mergedParams = {
          ...mergedParams,
          packageType: "0805",
          packageSize: "0805",
          isLed: true,
          value: "LED_0805",
        };
      } else if (presetId === "diodes-tht") {
        mergedParams = {
          ...mergedParams,
          packageType: "DO-41",
          packageSize: "DO-41",
          isLed: false,
          value: "D_DO-41",
        };
      } else if (presetId === "leds-tht") {
        mergedParams = {
          ...mergedParams,
          packageType: "5mm",
          packageSize: "5mm",
          isLed: true,
          value: "LED_5mm",
        };
      }
    }

    if (genFamilyId === "transistor") {
      if (presetId === "transistor-smd" || presetId === "sot-23") {
        mergedParams = {
          ...mergedParams,
          mounting: "SMD",
          packageType: "SOT-23",
          packageSize: "SOT-23",
          transistorType: mergedParams.transistorType || "BJT",
          polarity: mergedParams.polarity || "NPN",
          value: "MMBT3904",
          reference: "Q",
        };
      } else if (presetId === "power-smd" || presetId === "dpak") {
        mergedParams = {
          ...mergedParams,
          mounting: "SMD",
          packageType: "DPAK",
          packageSize: "DPAK",
          transistorType: "MOSFET",
          polarity: "N-Channel",
          value: "IRFR120N",
          reference: "Q",
        };
      } else if (presetId === "transistor-tht" || presetId === "to-92") {
        mergedParams = {
          ...mergedParams,
          mounting: "THT",
          packageType: "TO-92",
          packageSize: "TO-92",
          transistorType: mergedParams.transistorType || "BJT",
          polarity: mergedParams.polarity || "NPN",
          value: "2N2222",
          reference: "Q",
        };
      } else if (presetId === "power-tht" || presetId === "to-220") {
        mergedParams = {
          ...mergedParams,
          mounting: "THT",
          packageType: "TO-220",
          packageSize: "TO-220",
          transistorType: "Power Transistor",
          polarity: "NPN",
          value: "TIP120",
          reference: "Q",
        };
      } else if (presetId === "to-247") {
        mergedParams = {
          ...mergedParams,
          mounting: "THT",
          packageType: "TO-247",
          packageSize: "TO-247",
          transistorType: "Power Transistor",
          polarity: "NPN",
          value: "TIP35C",
          reference: "Q",
        };
      }
    }

    const defaultRef = getDefaultReferenceForFamilyAndPreset(genFamilyId, presetId, mergedParams);
    setGenParams({
      ...mergedParams,
      reference: defaultRef,
    });
  };

  // Update a single generator parameter
  const updateGenParam = (key: string, val: any) => {
    setGenParams((prev) => {
      const updated = { ...prev, [key]: val };
      if (key === "componentType" && genFamilyId === "passive") {
        updated.reference = getDefaultReferenceForFamilyAndPreset("passive", genPresetId, updated);
      }
      return updated;
    });
  };

  // Update multiple generator parameters
  const updateGenParams = (partial: Record<string, any>) => {
    setGenParams((prev) => ({
      ...prev,
      ...partial,
    }));
  };

  // Build generated model live
  const generatedModel = useMemo<KicadFootprintModel>(() => {
    try {
      return generateFootprint(genFamilyId, genParams);
    } catch {
      return generateFootprint("dip", { pinCount: 8 });
    }
  }, [genFamilyId, genParams]);

  // Load Library definitions
  const initialize = async () => {
    setLoading(true);
    setError(null);
    try {
      await kicadFootprintLibrary.initialize();
      const libs = kicadFootprintLibrary.libraries();
      setLibraries(libs);
      setLibrary((cur) => cur || libs.find((x) => x === "Package_DIP") || libs[0] || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      if (!kicadFootprintLibrary.isInitialized()) initialize();
      else {
        setLibraries(kicadFootprintLibrary.libraries());
        setView("libraries");
      }
    }
  }, [open]);

  const loadLibrary = async (name: string) => {
    setLibrary(name);
    setLoadingLibrary(true);
    setError(null);
    try {
      const all = await kicadFootprintLibrary.ensureLibrary(name);
      setEntries([...all.filter((e) => e.library === name)]);
      setSelected(null);
      setQuery("");
      setView("footprints");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingLibrary(false);
    }
  };

  const filteredLibraries = useMemo(() => {
    const q = query.trim().toLowerCase();
    return libraries.filter((l) => {
      if (activeCategory !== "all" && classifyFootprintLibrary(l) !== activeCategory) {
        return false;
      }
      if (!q) return true;
      return l.toLowerCase().includes(q);
    });
  }, [libraries, query, activeCategory]);

  const filteredFootprints = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => !q || `${e.library}:${e.name}`.toLowerCase().includes(q)).slice(0, 1000);
  }, [entries, query]);

  const handleInspect = (model: KicadFootprintModel) => {
    const runtime = kicadFootprintRuntime.register(model);
    setSelected(runtime);
    setView("preview");
  };

  const handleSelectFootprint = (model: KicadFootprintModel) => {
    const full = "GetRenderModel" in model ? (model as any).GetRenderModel() : model;
    if (!full.library && library) full.library = library;
    if (selectionOnly) onSelect?.(full);
    else onImport?.(full);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      const model = readKicadFootprintDefinition(content);
      model.library = "Custom_Upload";
      model.fullName = `Custom_Upload:${model.name}`;
      kicadFootprintLibrary.registerCustom(model);
      handleInspect(model);
    } catch (err) {
      setError(lang === "ar" ? "فشل قراءة ملف البصمة (.kicad_mod)" : "Failed to read .kicad_mod footprint file");
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent ref={contentRef} hideCloseButton={true} className="max-w-none w-screen h-[100dvh] sm:w-[95vw] sm:max-w-5xl sm:h-[90vh] sm:max-h-[880px] p-0 flex flex-col gap-0 overflow-hidden bg-slate-950 border-slate-800 text-white rounded-none sm:rounded-2xl">
        {/* Top Bar with Main Tabs OR Sub-library Header */}
        <DialogHeader className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-slate-800 shrink-0 bg-slate-900/90">
          <div className="flex items-center justify-between gap-2 sm:gap-4 w-full">
            {mainTab === "import" && view !== "libraries" ? (
              /* Sub-Library Navigation Header */
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {view === "footprints" && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-600/20 shrink-0 flex items-center justify-center"
                      onClick={() => setView("libraries")}
                      title={lang === "ar" ? "رجوع" : "Back"}
                    >
                      <ArrowLeft className="size-4 text-blue-400" />
                    </Button>
                    <div className="h-4 w-[1px] bg-slate-800 shrink-0" />
                    <div className="font-bold text-xs sm:text-sm text-slate-100 truncate font-mono flex items-center gap-2 min-w-0">
                      <span className="truncate">{library}</span>
                      <span className="text-[10px] font-semibold text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded-full shrink-0">
                        {filteredFootprints.length} {lang === "ar" ? "بصمة" : "footprints"}
                      </span>
                    </div>
                  </>
                )}

                {view === "preview" && selected && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-600/20 shrink-0 flex items-center justify-center"
                      onClick={() => setView("footprints")}
                      title={lang === "ar" ? "رجوع" : "Back"}
                    >
                      <ArrowLeft className="size-4 text-blue-400" />
                    </Button>
                    <div className="h-4 w-[1px] bg-slate-800 shrink-0" />
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span className="font-bold text-xs sm:text-sm text-white truncate font-mono">{selected.name}</span>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded border shrink-0 ${
                          classifyFootprintMountingType("GetRenderModel" in selected ? (selected as any).GetRenderModel() : selected) === "SMD"
                            ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
                            : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                        }`}
                      >
                        {classifyFootprintMountingType("GetRenderModel" in selected ? (selected as any).GetRenderModel() : selected)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              /* Tabs List */
              <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto py-0.5 no-scrollbar shrink min-w-0">
                <button
                  type="button"
                  onClick={() => setMainTab("import")}
                  className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 border shrink-0 whitespace-nowrap ${
                    mainTab === "import"
                      ? "bg-blue-600/25 text-blue-400 border-blue-500/50 shadow-sm shadow-blue-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
                  }`}
                >
                  <Download className="size-3.5 sm:size-4 text-blue-400 shrink-0" />
                  <span>{lang === "ar" ? "استيراد KiCad Footprints" : "Import KiCad Footprints"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMainTab("generator")}
                  className={`px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 sm:gap-2 border shrink-0 whitespace-nowrap ${
                    mainTab === "generator"
                      ? "bg-blue-600/25 text-blue-400 border-blue-500/50 shadow-sm shadow-blue-500/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
                  }`}
                >
                  <Sparkles className="size-3.5 sm:size-4 text-blue-400 shrink-0" />
                  <span>{lang === "ar" ? "مولد البصمات" : "Footprint Generator"}</span>
                </button>
              </div>
            )}

            {/* Dedicated Accessible Close Button */}
            <DialogClose className="h-8 w-8 shrink-0 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <X className="h-4 w-4 stroke-[2.5]" />
              <span className="sr-only">{lang === "ar" ? "إغلاق" : "Close"}</span>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {error && (
            <div className="m-3 p-2.5 rounded-lg border border-red-900/70 bg-red-950/30 text-xs text-red-200 shrink-0 flex items-start gap-2">
              <span className="flex-1 break-words">{error}</span>
              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setError(null)}>
                <X className="size-3.5" />
              </Button>
            </div>
          )}

          {/* TAB 1: FOOTPRINT GENERATOR */}
          {mainTab === "generator" && (
            <div className="h-full flex flex-col md:flex-row min-h-0 overflow-y-auto bg-slate-950">
              {/* Left Column: Family Selector & Parameter Controls */}
              <div className="w-full md:w-[380px] lg:w-[410px] border-b md:border-b-0 md:border-e border-slate-800 p-3.5 sm:p-4 flex flex-col gap-3.5 overflow-y-auto max-h-full bg-slate-900/40 shrink-0">
                {/* Family Category Dropdown */}
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 mb-1.5 block">
                    {lang === "ar" ? "عائلة الحزمة (Footprint Family)" : "Footprint Family"}
                  </label>
                  <select
                    value={genFamilyId}
                    onChange={(e) => handleSelectFamily(e.target.value)}
                    className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                  >
                    {Object.values(FOOTPRINT_FAMILIES).map((fam) => (
                      <option key={fam.id} value={fam.id} className="bg-slate-900 text-slate-100 py-1">
                        {fam.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Presets Dropdown (نوع الحزمة) */}
                {currentFamily.presets && currentFamily.presets.length > 0 && 
                 ![
                   "passive",
                   "transistor",
                   "diode",
                   "crystal",
                   "switch_relay",
                   "inductor",
                   "fuse_protection",
                   "potentiometer",
                   "optocoupler",
                   "connector_interface",
                   "display",
                   "modules",
                   "sensor",
                   "rf_antenna",
                   "test_mechanical",
                   "batteries_power",
                 ].includes(genFamilyId) && (
                  <div>
                    <label className="text-[11px] font-semibold text-slate-300 mb-1.5 flex items-center justify-between">
                      <span>
                        {lang === "ar" ? "نوع الحزمة" : "Package Type"}
                      </span>
                      <span className="text-[10px] text-blue-400 font-mono px-1.5 py-0.5 rounded bg-blue-950/60 border border-blue-800/60 font-semibold">
                        {currentFamily.presets.length} {lang === "ar" ? "أنواع" : "types"}
                      </span>
                    </label>
                    <select
                      value={genPresetId}
                      onChange={(e) => handleSelectPreset(e.target.value)}
                      className="w-full h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors cursor-pointer"
                    >
                      {genFamilyId === "passive" ? (
                        <>
                          <optgroup label="Resistors:" className="bg-slate-950 text-blue-400 font-bold">
                            <option value="resistor-smd" className="bg-slate-900 text-slate-100 py-1 font-mono">
                              Resistor SMD
                            </option>
                            <option value="resistor-tht" className="bg-slate-900 text-slate-100 py-1 font-mono">
                              Resistor THT
                            </option>
                          </optgroup>
                          <option disabled className="text-slate-500 bg-slate-950 text-center py-0.5 font-mono">
                            ───────────────────────────────────
                          </option>
                          <optgroup label="Capacitor:" className="bg-slate-950 text-cyan-400 font-bold">
                            <option value="capacitor-smd" className="bg-slate-900 text-slate-100 py-1 font-mono">
                              Capacitor SMD
                            </option>
                            <option value="capacitor-tht" className="bg-slate-900 text-slate-100 py-1 font-mono">
                              Capacitor THT
                            </option>
                          </optgroup>
                        </>
                      ) : genFamilyId === "diode" ? (
                        <>
                          <optgroup label="Diodes" className="bg-slate-950 text-blue-400 font-extrabold">
                            <option value="diodes-smd" className="bg-slate-900 text-slate-100 py-1 font-mono font-semibold">
                              Diodes SMD
                            </option>
                            <option value="diodes-tht" className="bg-slate-900 text-slate-100 py-1 font-mono font-semibold">
                              Diodes THT
                            </option>
                          </optgroup>
                          
                          <option disabled className="text-slate-500 bg-slate-950 text-center py-0.5 font-mono">
                            ....................
                          </option>

                          <optgroup label="LEDs" className="bg-slate-950 text-teal-400 font-extrabold">
                            <option value="leds-smd" className="bg-slate-900 text-slate-100 py-1 font-mono font-semibold">
                              LEDs SMD
                            </option>
                            <option value="leds-tht" className="bg-slate-900 text-slate-100 py-1 font-mono font-semibold">
                              LEDs THT
                            </option>
                          </optgroup>
                        </>
                      ) : genFamilyId === "transistor" ? (
                        <>
                          <optgroup label="Transistors & Power THT" className="bg-slate-950 text-teal-400 font-extrabold">
                            <option value="transistor-tht" className="bg-slate-900 text-slate-100 py-1 font-mono font-semibold">
                              Transistors THT (TO-92, TO-18, TO-39, TO-126)
                            </option>
                            <option value="power-tht" className="bg-slate-900 text-slate-100 py-1 font-mono font-semibold">
                              Power THT (TO-220, TO-247, TO-3, TO-264)
                            </option>
                          </optgroup>
                          
                          <option disabled className="text-slate-500 bg-slate-950 text-center py-0.5 font-mono">
                            ───────────────────────────────────
                          </option>

                          <optgroup label="Transistors & Power SMD" className="bg-slate-950 text-blue-400 font-extrabold">
                            <option value="transistor-smd" className="bg-slate-900 text-slate-100 py-1 font-mono font-semibold">
                              Transistors SMD (SOT-23, SOT-223, SOT-89)
                            </option>
                            <option value="power-smd" className="bg-slate-900 text-slate-100 py-1 font-mono font-semibold">
                              Power SMD (DPAK, D2PAK, SO-8)
                            </option>
                          </optgroup>
                        </>
                      ) : (
                        currentFamily.presets.map((preset) => (
                          <option key={preset.id} value={preset.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                            {preset.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                )}

                {/* Identity Settings */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400">
                      {lang === "ar" ? "البادئة (Reference)" : "Prefix / Ref"}
                    </label>
                    <Input
                      className="h-8 text-xs font-mono bg-slate-900 border-slate-700 text-white mt-1"
                      value={genParams.reference || "U"}
                      onChange={(e) => updateGenParam("reference", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400">
                      {lang === "ar" ? "القيمة (Value)" : "Value / Name"}
                    </label>
                    <Input
                      className="h-8 text-xs font-mono bg-slate-900 border-slate-700 text-white mt-1"
                      value={genParams.value || currentFamily.name}
                      onChange={(e) => updateGenParam("value", e.target.value)}
                    />
                  </div>
                </div>

                {/* Dynamic Parameter Fields */}
                <div className="space-y-2.5 text-xs">
                  {/* Pin Count / Rows */}
                  {genFamilyId !== "passive" && genFamilyId !== "diode" && genFamilyId !== "crystal" && genFamilyId !== "transistor" && genFamilyId !== "inductor" && genFamilyId !== "optocoupler" && genFamilyId !== "fuse_protection" && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {genParams.pinCount !== undefined && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">
                            {lang === "ar" ? "عدد الأرجل" : "Pin Count"}
                          </label>
                          <Input
                            type="number"
                            min="2"
                            max="256"
                            className="h-8 text-xs font-mono bg-slate-900 border-slate-700 text-white mt-1"
                            value={genParams.pinCount}
                            onChange={(e) => updateGenParam("pinCount", parseInt(e.target.value) || 2)}
                          />
                        </div>
                      )}
                      {genParams.pitch !== undefined && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">
                            {lang === "ar" ? "الخطوة Pitch (mm)" : "Pitch (mm)"}
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-xs font-mono bg-slate-900 border-slate-700 text-white mt-1"
                            value={genParams.pitch}
                            onChange={(e) => updateGenParam("pitch", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Row Spacing / Pad Span opposite Pad Height */}
                  {(genParams.rowSpacing !== undefined || genParams.padSpan !== undefined || genParams.padHeight !== undefined) && genFamilyId !== "inductor" && genFamilyId !== "passive" && genFamilyId !== "transistor" && genFamilyId !== "diode" && genFamilyId !== "crystal" && genFamilyId !== "optocoupler" && genFamilyId !== "switch_relay" && genFamilyId !== "fuse_protection" && genFamilyId !== "potentiometer" && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {genParams.rowSpacing !== undefined ? (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">
                            {lang === "ar" ? "تباعد الصفوف (mm)" : "Row Spacing (mm)"}
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-xs font-mono bg-slate-900 border-slate-700 text-white mt-1"
                            value={genParams.rowSpacing}
                            onChange={(e) => updateGenParam("rowSpacing", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      ) : genParams.padSpan !== undefined ? (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">
                            {lang === "ar" ? "امتداد الوسائد (mm)" : "Pad Span (mm)"}
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-xs font-mono bg-slate-900 border-slate-700 text-white mt-1"
                            value={genParams.padSpan}
                            onChange={(e) => updateGenParam("padSpan", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      ) : <div />}

                      {genParams.padHeight !== undefined && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">
                            {lang === "ar" ? "ارتفاع الوسادة (mm)" : "Pad Height (mm)"}
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-xs font-mono bg-slate-900 border-slate-700 text-white mt-1"
                            value={genParams.padHeight}
                            onChange={(e) => updateGenParam("padHeight", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Pad Width opposite Drill Diameter */}
                  {(genParams.padWidth !== undefined || genParams.drill !== undefined) && genFamilyId !== "inductor" && genFamilyId !== "passive" && genFamilyId !== "transistor" && genFamilyId !== "diode" && genFamilyId !== "crystal" && genFamilyId !== "optocoupler" && genFamilyId !== "switch_relay" && genFamilyId !== "fuse_protection" && genFamilyId !== "potentiometer" && (
                    <div className="grid grid-cols-2 gap-2.5">
                      {genParams.padWidth !== undefined ? (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">
                            {lang === "ar" ? "عرض الوسادة (mm)" : "Pad Width (mm)"}
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-xs font-mono bg-slate-900 border-slate-700 text-white mt-1"
                            value={genParams.padWidth}
                            onChange={(e) => updateGenParam("padWidth", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      ) : <div />}

                      {genParams.drill !== undefined && (
                        <div>
                          <label className="text-[10px] font-semibold text-slate-400">
                            {lang === "ar" ? "قطر الثقب Drill (mm)" : "Drill (mm)"}
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            className="h-8 text-xs font-mono bg-slate-900 border-slate-700 text-white mt-1"
                            value={genParams.drill}
                            onChange={(e) => updateGenParam("drill", parseFloat(e.target.value) || 0)}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {/* Passives (R/C) Dedicated Section */}
                  {genFamilyId === "passive" && (() => {
                    const isCapacitor = genParams.categoryGroup === "capacitor" || genPresetId?.includes("capacitor");
                    const isTht = genParams.packageType === "THT" || genParams.mounting === "THT" || genPresetId?.includes("tht") || genParams.subtype === "Axial_THT";
                    const isCustom = genParams.packageSize === "custom" || genParams.packageType === "custom" || genParams.packageSize === "Custom_SMD";

                    return (
                      <div className="space-y-3.5 border-t border-slate-800 pt-3">
                        {/* 1. Sub-Family Switcher (Resistor vs Capacitor) */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                            <span>{lang === "ar" ? "عائلة المكون الخامل" : "Passive Component Family"}</span>
                          </label>
                          <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                updateGenParams({
                                  categoryGroup: "resistor",
                                  componentType: "Resistor",
                                  reference: "R",
                                  value: isTht ? "R_AXIAL-0207_P7.62mm" : "R_0805_Metric",
                                  packageSize: isTht ? "axial-0207" : "0805",
                                  chipSize: isTht ? undefined : "0805",
                                });
                              }}
                              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                                !isCapacitor
                                  ? "bg-cyan-600 text-white shadow-sm"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {lang === "ar" ? "مقاومات (Resistors)" : "Resistors (R)"}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateGenParams({
                                  categoryGroup: "capacitor",
                                  componentType: "Capacitor",
                                  reference: "C",
                                  value: isTht ? "C_RADIAL-D8-P3.5" : "C_0805_Metric",
                                  packageSize: isTht ? "radial-d8-p3.5" : "0805",
                                  chipSize: isTht ? undefined : "0805",
                                });
                              }}
                              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                                isCapacitor
                                  ? "bg-cyan-600 text-white shadow-sm"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              {lang === "ar" ? "مكثفات (Capacitors)" : "Capacitors (C)"}
                            </button>
                          </div>
                        </div>

                        {/* 2. Technology / Type Selection Grid */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                            <span>{lang === "ar" ? (isCapacitor ? "نوع وتقنية المكثف" : "نوع وتقنية المقاومة") : (isCapacitor ? "Capacitor Technology" : "Resistor Technology")}</span>
                          </label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {(isCapacitor
                              ? [
                                  { id: "mlcc", label: "Ceramic MLCC", desc: "Multilayer Ceramic", polarized: false },
                                  { id: "electrolytic", label: "Electrolytic", desc: "Radial Aluminum Can", polarized: true },
                                  { id: "tantalum", label: "Tantalum", desc: "Polarized SMD / THT", polarized: true },
                                  { id: "film", label: "Film / Box", desc: "Polyester / Polypropylene", polarized: false },
                                  { id: "disc", label: "Ceramic Disc", desc: "High Voltage Disc", polarized: false },
                                  { id: "safety", label: "Safety X2 / Y2", desc: "Mains Suppression", polarized: false },
                                ]
                              : [
                                  { id: "metal-film", label: "Metal Film", desc: "General Purpose / 1%" },
                                  { id: "carbon-film", label: "Carbon Film", desc: "Standard 5% Film" },
                                  { id: "power", label: "Power Resistor", desc: "Cement / Wirewound" },
                                  { id: "shunt", label: "Current Shunt", desc: "Low Ohm Sense" },
                                  { id: "pot", label: "Trimmer / Pot", desc: "Variable Preset" },
                                  { id: "network", label: "Resistor Array", desc: "Multi-element Network" },
                                ]
                            ).map((item) => {
                              const isSelected = (genParams.technologyType || (isCapacitor ? (genParams.polarized ? "electrolytic" : "mlcc") : "metal-film")) === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    if (isCapacitor) {
                                      const isPol = (item as any).polarized === true;
                                      if (isTht) {
                                        if (isPol) {
                                          updateGenParams({
                                            technologyType: item.id,
                                            polarized: true,
                                            packageSize: "radial-d8-p3.5",
                                            subtype: "Radial_THT",
                                            pitch: 3.5,
                                            bodyDiameter: 8.0,
                                            drill: 0.8,
                                            padWidth: 1.6,
                                            value: "CP_Radial_D8.0mm_P3.5mm",
                                          });
                                        } else if (item.id === "film" || item.id === "safety") {
                                          updateGenParams({
                                            technologyType: item.id,
                                            polarized: false,
                                            packageSize: "film-l7.2-p5.0",
                                            subtype: "Box_THT",
                                            pitch: 5.0,
                                            bodyLength: 7.2,
                                            bodyWidth: 2.5,
                                            drill: 0.8,
                                            padWidth: 1.6,
                                            value: "C_Film_L7.2mm_W2.5mm_P5.00mm",
                                          });
                                        } else {
                                          updateGenParams({
                                            technologyType: item.id,
                                            polarized: false,
                                            packageSize: "disc-d5-p2.54",
                                            subtype: "Disc_THT",
                                            pitch: 2.54,
                                            bodyDiameter: 5.0,
                                            bodyWidth: 2.5,
                                            drill: 0.8,
                                            padWidth: 1.6,
                                            value: "C_Disc_D5.0mm_W2.5mm_P2.54mm",
                                          });
                                        }
                                      } else {
                                        // SMD
                                        if (isPol) {
                                          updateGenParams({
                                            technologyType: item.id,
                                            polarized: true,
                                            packageSize: "EIA-3216-18",
                                            chipSize: "EIA-3216-18",
                                            subtype: "SMD_Tantalum",
                                            pitch: 2.5,
                                            padWidth: 1.4,
                                            padHeight: 1.2,
                                            bodyLength: 3.2,
                                            bodyWidth: 1.6,
                                            value: "C_EIA-3216-18",
                                          });
                                        } else {
                                          updateGenParams({
                                            technologyType: item.id,
                                            polarized: false,
                                            packageSize: "0805",
                                            chipSize: "0805",
                                            subtype: "SMD_Chip",
                                            pitch: 1.9,
                                            padWidth: 1.0,
                                            padHeight: 1.3,
                                            bodyLength: 2.0,
                                            bodyWidth: 1.25,
                                            value: "C_0805_2012Metric",
                                          });
                                        }
                                      }
                                    } else {
                                      const techId = item.id;
                                      if (isTht) {
                                        if (techId === "carbon-film") {
                                          updateGenParams({
                                            technologyType: techId,
                                            packageSize: "axial-0411",
                                            subtype: "Axial_THT",
                                            pitch: 10.16,
                                            bodyLength: 9.0,
                                            bodyDiameter: 3.5,
                                            drill: 0.8,
                                            padWidth: 1.8,
                                            value: "R_Axial_DIN0411_P10.16mm",
                                          });
                                        } else if (techId === "power") {
                                          updateGenParams({
                                            technologyType: techId,
                                            packageSize: "cement-5w-p22.5",
                                            subtype: "Cement_THT",
                                            pitch: 22.5,
                                            bodyLength: 22.0,
                                            bodyDiameter: 9.5,
                                            drill: 1.0,
                                            padWidth: 2.2,
                                            value: "R_Cement_5W_P22.5mm",
                                          });
                                        } else if (techId === "shunt") {
                                          updateGenParams({
                                            technologyType: techId,
                                            packageSize: "power-shunt-p15",
                                            subtype: "Axial_THT",
                                            pitch: 15.0,
                                            bodyLength: 14.0,
                                            bodyDiameter: 5.0,
                                            drill: 1.2,
                                            padWidth: 2.4,
                                            value: "R_Shunt_P15.0mm",
                                          });
                                        } else if (techId === "pot") {
                                          updateGenParams({
                                            technologyType: techId,
                                            packageSize: "pot-3296w",
                                            subtype: "Potentiometer_THT",
                                            pitch: 2.54,
                                            bodyLength: 9.5,
                                            bodyWidth: 4.8,
                                            drill: 0.8,
                                            padWidth: 1.6,
                                            value: "RV_Pot_3296W",
                                          });
                                        } else if (techId === "network") {
                                          updateGenParams({
                                            technologyType: techId,
                                            packageSize: "sip-8-p2.54",
                                            subtype: "SIP_Network_THT",
                                            pitch: 2.54,
                                            pinCount: 8,
                                            bodyLength: 21.5,
                                            bodyWidth: 2.5,
                                            drill: 0.8,
                                            padWidth: 1.6,
                                            value: "RN_SIP-8_P2.54mm",
                                          });
                                        } else {
                                          // Default: metal-film
                                          updateGenParams({
                                            technologyType: "metal-film",
                                            packageSize: "axial-0207",
                                            subtype: "Axial_THT",
                                            pitch: 7.62,
                                            bodyLength: 6.3,
                                            bodyDiameter: 2.4,
                                            drill: 0.8,
                                            padWidth: 1.8,
                                            value: "R_Axial_DIN0207_P7.62mm",
                                          });
                                        }
                                      } else {
                                        // SMD Resistors
                                        if (techId === "carbon-film") {
                                          updateGenParams({
                                            technologyType: techId,
                                            packageSize: "1206",
                                            chipSize: "1206",
                                            subtype: "SMD_Chip",
                                            pitch: 3.0,
                                            padWidth: 1.1,
                                            padHeight: 1.75,
                                            bodyLength: 3.2,
                                            bodyWidth: 1.6,
                                            value: "R_1206_3216Metric",
                                          });
                                        } else if (techId === "power") {
                                          updateGenParams({
                                            technologyType: techId,
                                            packageSize: "2512",
                                            chipSize: "2512",
                                            subtype: "SMD_Chip",
                                            pitch: 6.0,
                                            padWidth: 1.3,
                                            padHeight: 3.3,
                                            bodyLength: 6.3,
                                            bodyWidth: 3.2,
                                            value: "R_2512_6332Metric",
                                          });
                                        } else if (techId === "shunt") {
                                          updateGenParams({
                                            technologyType: techId,
                                            packageSize: "shunt-2512",
                                            chipSize: "shunt-2512",
                                            subtype: "SMD_Chip",
                                            pitch: 6.0,
                                            padWidth: 1.6,
                                            padHeight: 3.5,
                                            bodyLength: 6.3,
                                            bodyWidth: 3.2,
                                            value: "R_Shunt_2512",
                                          });
                                        } else if (techId === "pot") {
                                          updateGenParams({
                                            technologyType: techId,
                                            packageSize: "pot-smd-3314g",
                                            chipSize: "pot-smd-3314g",
                                            subtype: "SMD_Trimmer",
                                            pitch: 2.54,
                                            padWidth: 1.4,
                                            padHeight: 1.3,
                                            bodyLength: 4.5,
                                            bodyWidth: 4.5,
                                            value: "RV_SMD_3314G",
                                          });
                                        } else if (techId === "network") {
                                          updateGenParams({
                                            technologyType: techId,
                                            packageSize: "array-0804",
                                            chipSize: "array-0804",
                                            subtype: "SMD_Array",
                                            pitch: 0.8,
                                            padWidth: 0.45,
                                            padHeight: 0.7,
                                            bodyLength: 3.2,
                                            bodyWidth: 1.6,
                                            value: "RN_Array_0804",
                                          });
                                        } else {
                                          // metal-film
                                          updateGenParams({
                                            technologyType: "metal-film",
                                            packageSize: "0805",
                                            chipSize: "0805",
                                            subtype: "SMD_Chip",
                                            pitch: 1.9,
                                            padWidth: 1.0,
                                            padHeight: 1.3,
                                            bodyLength: 2.0,
                                            bodyWidth: 1.25,
                                            value: "R_0805_2012Metric",
                                          });
                                        }
                                      }
                                    }
                                  }}
                                  className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all text-center border ${
                                    isSelected
                                      ? "bg-blue-600/30 border-blue-500 text-blue-200 font-bold shadow-sm shadow-blue-500/20"
                                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 3. Polarity Selection (for Capacitors) */}
                        {isCapacitor && (
                          <div>
                            <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                              <span>{lang === "ar" ? "القطبية (Polarity)" : "Polarity Configuration"}</span>
                            </label>
                            <div className="grid grid-cols-2 gap-1.5">
                              {[
                                { id: false, label: lang === "ar" ? "غير مستقطب (Non-Polarized)" : "Non-Polarized", desc: "Ceramic / Film" },
                                { id: true, label: lang === "ar" ? "مستقطب (+ / - Polarized)" : "Polarized (+ / -)", desc: "Electrolytic / Tantalum" },
                              ].map((pol) => {
                                const isSelected = !!genParams.polarized === pol.id;
                                return (
                                  <button
                                    key={String(pol.id)}
                                    type="button"
                                    onClick={() => {
                                      const isPol = pol.id;
                                      if (isTht) {
                                        if (isPol) {
                                          updateGenParams({
                                            polarized: true,
                                            technologyType: "electrolytic",
                                            packageSize: "radial-d8-p3.5",
                                            subtype: "Radial_THT",
                                            pitch: 3.5,
                                            bodyDiameter: 8.0,
                                            drill: 0.8,
                                            padWidth: 1.6,
                                            value: "CP_Radial_D8.0mm_P3.5mm",
                                          });
                                        } else {
                                          updateGenParams({
                                            polarized: false,
                                            technologyType: "disc",
                                            packageSize: "disc-d5-p2.54",
                                            subtype: "Disc_THT",
                                            pitch: 2.54,
                                            bodyDiameter: 5.0,
                                            bodyWidth: 2.5,
                                            drill: 0.8,
                                            padWidth: 1.6,
                                            value: "C_Disc_D5.0mm_W2.5mm_P2.54mm",
                                          });
                                        }
                                      } else {
                                        // SMD
                                        if (isPol) {
                                          updateGenParams({
                                            polarized: true,
                                            technologyType: "tantalum",
                                            packageSize: "EIA-3216-18",
                                            chipSize: "EIA-3216-18",
                                            subtype: "SMD_Tantalum",
                                            pitch: 2.5,
                                            padWidth: 1.4,
                                            padHeight: 1.2,
                                            bodyLength: 3.2,
                                            bodyWidth: 1.6,
                                            value: "C_EIA-3216-18",
                                          });
                                        } else {
                                          updateGenParams({
                                            polarized: false,
                                            technologyType: "mlcc",
                                            packageSize: "0805",
                                            chipSize: "0805",
                                            subtype: "SMD_Chip",
                                            pitch: 1.9,
                                            padWidth: 1.0,
                                            padHeight: 1.3,
                                            bodyLength: 2.0,
                                            bodyWidth: 1.25,
                                            value: "C_0805_2012Metric",
                                          });
                                        }
                                      }
                                    }}
                                    className={`px-2.5 py-1.5 rounded text-xs font-mono font-semibold transition-all border flex items-center justify-between ${
                                      isSelected
                                        ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10"
                                        : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                    }`}
                                  >
                                    <span>{pol.label}</span>
                                    <span className="text-[9px] font-sans font-normal opacity-70">{pol.desc}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* 4. Mounting Style Selector (THT vs SMD) */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                            <span>{lang === "ar" ? "نوع التثبيت (Mounting Style)" : "Mounting Style"}</span>
                          </label>
                          <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                if (isCapacitor) {
                                  const isPol = !!genParams.polarized;
                                  if (isPol) {
                                    updateGenParams({
                                      mounting: "THT",
                                      packageType: "THT",
                                      packageSize: "radial-d8-p3.5",
                                      chipSize: undefined,
                                      subtype: "Radial_THT",
                                      pitch: 3.5,
                                      bodyDiameter: 8.0,
                                      drill: 0.8,
                                      padWidth: 1.6,
                                      value: "CP_Radial_D8.0mm_P3.5mm",
                                    });
                                  } else {
                                    updateGenParams({
                                      mounting: "THT",
                                      packageType: "THT",
                                      packageSize: "disc-d5-p2.54",
                                      chipSize: undefined,
                                      subtype: "Disc_THT",
                                      pitch: 2.54,
                                      bodyDiameter: 5.0,
                                      bodyWidth: 2.5,
                                      drill: 0.8,
                                      padWidth: 1.6,
                                      value: "C_Disc_D5.0mm_W2.5mm_P2.54mm",
                                    });
                                  }
                                } else {
                                  const techId = genParams.technologyType || "metal-film";
                                  if (techId === "carbon-film") {
                                    updateGenParams({
                                      mounting: "THT",
                                      packageType: "THT",
                                      packageSize: "axial-0411",
                                      chipSize: undefined,
                                      subtype: "Axial_THT",
                                      pitch: 10.16,
                                      bodyLength: 9.0,
                                      bodyDiameter: 3.5,
                                      drill: 0.8,
                                      padWidth: 1.8,
                                      value: "R_Axial_DIN0411_P10.16mm",
                                    });
                                  } else if (techId === "power") {
                                    updateGenParams({
                                      mounting: "THT",
                                      packageType: "THT",
                                      packageSize: "cement-5w-p22.5",
                                      chipSize: undefined,
                                      subtype: "Cement_THT",
                                      pitch: 22.5,
                                      bodyLength: 22.0,
                                      bodyDiameter: 9.5,
                                      drill: 1.0,
                                      padWidth: 2.2,
                                      value: "R_Cement_5W_P22.5mm",
                                    });
                                  } else if (techId === "shunt") {
                                    updateGenParams({
                                      mounting: "THT",
                                      packageType: "THT",
                                      packageSize: "power-shunt-p15",
                                      chipSize: undefined,
                                      subtype: "Axial_THT",
                                      pitch: 15.0,
                                      bodyLength: 14.0,
                                      bodyDiameter: 5.0,
                                      drill: 1.2,
                                      padWidth: 2.4,
                                      value: "R_Shunt_P15.0mm",
                                    });
                                  } else if (techId === "pot") {
                                    updateGenParams({
                                      mounting: "THT",
                                      packageType: "THT",
                                      packageSize: "pot-3296w",
                                      chipSize: undefined,
                                      subtype: "Potentiometer_THT",
                                      pitch: 2.54,
                                      bodyLength: 9.5,
                                      bodyWidth: 4.8,
                                      drill: 0.8,
                                      padWidth: 1.6,
                                      value: "RV_Pot_3296W",
                                    });
                                  } else if (techId === "network") {
                                    updateGenParams({
                                      mounting: "THT",
                                      packageType: "THT",
                                      packageSize: "sip-8-p2.54",
                                      chipSize: undefined,
                                      subtype: "SIP_Network_THT",
                                      pitch: 2.54,
                                      pinCount: 8,
                                      bodyLength: 21.5,
                                      bodyWidth: 2.5,
                                      drill: 0.8,
                                      padWidth: 1.6,
                                      value: "RN_SIP-8_P2.54mm",
                                    });
                                  } else {
                                    updateGenParams({
                                      mounting: "THT",
                                      packageType: "THT",
                                      packageSize: "axial-0207",
                                      chipSize: undefined,
                                      subtype: "Axial_THT",
                                      pitch: 7.62,
                                      bodyLength: 6.3,
                                      bodyDiameter: 2.4,
                                      drill: 0.8,
                                      padWidth: 1.8,
                                      value: "R_Axial_DIN0207_P7.62mm",
                                    });
                                  }
                                }
                              }}
                              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                                isTht
                                  ? "bg-cyan-600 text-white shadow-sm"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              THT (ثقبي عبر اللوح)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (isCapacitor) {
                                  const isPol = !!genParams.polarized;
                                  if (isPol) {
                                    updateGenParams({
                                      mounting: "SMD",
                                      packageType: "SMD",
                                      packageSize: "EIA-3216-18",
                                      chipSize: "EIA-3216-18",
                                      subtype: "SMD_Tantalum",
                                      pitch: 2.5,
                                      padWidth: 1.4,
                                      padHeight: 1.2,
                                      bodyLength: 3.2,
                                      bodyWidth: 1.6,
                                      value: "C_EIA-3216-18",
                                    });
                                  } else {
                                    updateGenParams({
                                      mounting: "SMD",
                                      packageType: "SMD",
                                      packageSize: "0805",
                                      chipSize: "0805",
                                      subtype: "SMD_Chip",
                                      pitch: 1.9,
                                      padWidth: 1.0,
                                      padHeight: 1.3,
                                      bodyLength: 2.0,
                                      bodyWidth: 1.25,
                                      value: "C_0805_2012Metric",
                                    });
                                  }
                                } else {
                                  const techId = genParams.technologyType || "metal-film";
                                  if (techId === "carbon-film") {
                                    updateGenParams({
                                      mounting: "SMD",
                                      packageType: "SMD",
                                      packageSize: "1206",
                                      chipSize: "1206",
                                      subtype: "SMD_Chip",
                                      pitch: 3.0,
                                      padWidth: 1.1,
                                      padHeight: 1.75,
                                      bodyLength: 3.2,
                                      bodyWidth: 1.6,
                                      value: "R_1206_3216Metric",
                                    });
                                  } else if (techId === "power") {
                                    updateGenParams({
                                      mounting: "SMD",
                                      packageType: "SMD",
                                      packageSize: "2512",
                                      chipSize: "2512",
                                      subtype: "SMD_Chip",
                                      pitch: 6.0,
                                      padWidth: 1.3,
                                      padHeight: 3.3,
                                      bodyLength: 6.3,
                                      bodyWidth: 3.2,
                                      value: "R_2512_6332Metric",
                                    });
                                  } else if (techId === "shunt") {
                                    updateGenParams({
                                      mounting: "SMD",
                                      packageType: "SMD",
                                      packageSize: "shunt-2512",
                                      chipSize: "shunt-2512",
                                      subtype: "SMD_Chip",
                                      pitch: 6.0,
                                      padWidth: 1.6,
                                      padHeight: 3.5,
                                      bodyLength: 6.3,
                                      bodyWidth: 3.2,
                                      value: "R_Shunt_2512",
                                    });
                                  } else if (techId === "pot") {
                                    updateGenParams({
                                      mounting: "SMD",
                                      packageType: "SMD",
                                      packageSize: "pot-smd-3314g",
                                      chipSize: "pot-smd-3314g",
                                      subtype: "SMD_Trimmer",
                                      pitch: 2.54,
                                      padWidth: 1.4,
                                      padHeight: 1.3,
                                      bodyLength: 4.5,
                                      bodyWidth: 4.5,
                                      value: "RV_SMD_3314G",
                                    });
                                  } else if (techId === "network") {
                                    updateGenParams({
                                      mounting: "SMD",
                                      packageType: "SMD",
                                      packageSize: "array-0804",
                                      chipSize: "array-0804",
                                      subtype: "SMD_Array",
                                      pitch: 0.8,
                                      padWidth: 0.45,
                                      padHeight: 0.7,
                                      bodyLength: 3.2,
                                      bodyWidth: 1.6,
                                      value: "RN_Array_0804",
                                    });
                                  } else {
                                    updateGenParams({
                                      mounting: "SMD",
                                      packageType: "SMD",
                                      packageSize: "0805",
                                      chipSize: "0805",
                                      subtype: "SMD_Chip",
                                      pitch: 1.9,
                                      padWidth: 1.0,
                                      padHeight: 1.3,
                                      bodyLength: 2.0,
                                      bodyWidth: 1.25,
                                      value: "R_0805_2012Metric",
                                    });
                                  }
                                }
                              }}
                              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                                !isTht
                                  ? "bg-cyan-600 text-white shadow-sm"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              SMD (سطحي SMT)
                            </button>
                          </div>
                        </div>

                        {/* 5. When SMD: Standard Sizes & Manual Input */}
                        {!isTht && (
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between">
                                <span>Quick Standard Packages</span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {isCapacitor && genParams.polarized ? "EIA-7343 / Molded" : "IPC-7351B / EIA"}
                                </span>
                              </label>
                              <select
                                className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors mt-1 cursor-pointer"
                                value={
                                  genParams.chipSize ||
                                  genParams.packageSize ||
                                  (isCapacitor ? (genParams.polarized ? "EIA-3216-18" : "0805") : "0805")
                                }
                                onChange={(e) => {
                                  const sizeId = e.target.value;
                                  const resTech = genParams.technologyType || "metal-film";
                                  const list = isCapacitor
                                    ? STANDARD_SMD_CAPACITOR_SIZES.filter((s) => (genParams.polarized ? s.polarized === true : !s.polarized))
                                    : STANDARD_SMD_RESISTOR_SIZES.filter((s) => s.techType === resTech);
                                  const found = list.find((s) => s.id === sizeId) || STANDARD_SMD_CAPACITOR_SIZES.find((s) => s.id === sizeId) || STANDARD_SMD_RESISTOR_SIZES.find((s) => s.id === sizeId);
                                  if (found) {
                                    updateGenParams({
                                      chipSize: sizeId,
                                      packageSize: sizeId,
                                      pitch: found.pitch,
                                      padWidth: found.padWidth,
                                      padHeight: found.padHeight,
                                      bodyLength: found.bodyLength,
                                      bodyWidth: found.bodyWidth,
                                      polarized: isCapacitor ? !!(found as any).polarized : undefined,
                                      subtype: isCapacitor ? ((found as any).polarized ? "SMD_Tantalum" : "SMD_Chip") : ((found as any).subtype || "SMD_Chip"),
                                      value: isCapacitor
                                        ? (sizeId.startsWith("EIA-") ? `C_${sizeId}` : `C_${sizeId}_${CHIP_METRIC_NAMES[sizeId] || "Metric"}`)
                                        : ((found as any).subtype === "SMD_Array" ? `RN_Array_${sizeId}` : (found as any).subtype === "SMD_Trimmer" ? `RV_SMD_${sizeId}` : `R_${sizeId}_${CHIP_METRIC_NAMES[sizeId] || "Metric"}`),
                                    });
                                  }
                                }}
                              >
                                {isCapacitor ? (
                                  genParams.polarized ? (
                                    <optgroup label="Tantalum Molded (Polarized SMD)" className="bg-slate-950 text-amber-300 font-bold">
                                      {STANDARD_SMD_CAPACITOR_SIZES.filter((s) => s.polarized === true).map((size) => (
                                        <option key={size.id} value={size.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                          {size.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ) : (
                                    <optgroup label="Ceramic MLCC Standard (Non-Polarized SMD)" className="bg-slate-950 text-cyan-300 font-bold">
                                      {STANDARD_SMD_CAPACITOR_SIZES.filter((s) => !s.polarized).map((size) => (
                                        <option key={size.id} value={size.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                          {size.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )
                                ) : (
                                  STANDARD_SMD_RESISTOR_SIZES
                                    .filter((size) => size.techType === (genParams.technologyType || "metal-film"))
                                    .map((size) => (
                                      <option key={size.id} value={size.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                        {size.name}
                                      </option>
                                    ))
                                )}
                              </select>
                            </div>
                          </div>
                        )}

                        {/* 6. When THT: Quick Standard Packages filtered strictly by polarity */}
                        {isTht && (
                          <div className="space-y-3.5">
                            {/* Quick Standard Packages */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                                  <span>Quick Standard Packages</span>
                                </span>
                                <span className="text-[9px] text-slate-400 font-mono">
                                  {isCapacitor
                                    ? (genParams.polarized ? "Radial Electrolytic" : "Disc Ceramic & Box Film")
                                    : "Axial Standard"}
                                </span>
                              </div>
                              <select
                                className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
                                value={
                                  (() => {
                                    const currentResTech = genParams.technologyType || "metal-film";
                                    const allValid = isCapacitor
                                      ? [
                                          ...QUICK_STANDARD_THT_CAPACITOR_PACKAGES.filter((p) => (genParams.polarized ? p.polarized === true : !p.polarized)),
                                          ...MORE_STANDARD_THT_CAPACITOR_PACKAGES.filter((p) => (genParams.polarized ? p.polarized === true : !p.polarized)),
                                        ]
                                      : [
                                          ...QUICK_STANDARD_THT_RESISTOR_PACKAGES.filter((p) => p.techType === currentResTech),
                                          ...MORE_STANDARD_THT_RESISTOR_PACKAGES.filter((p) => p.techType === currentResTech),
                                        ];
                                    return allValid.some((p) => p.id === genParams.packageSize) ? genParams.packageSize : "";
                                  })()
                                }
                                onChange={(e) => {
                                  const pkgId = e.target.value;
                                  const currentResTech = genParams.technologyType || "metal-film";
                                  const list = isCapacitor
                                    ? [
                                        ...QUICK_STANDARD_THT_CAPACITOR_PACKAGES.filter((p) => (genParams.polarized ? p.polarized === true : !p.polarized)),
                                        ...MORE_STANDARD_THT_CAPACITOR_PACKAGES.filter((p) => (genParams.polarized ? p.polarized === true : !p.polarized)),
                                      ]
                                    : [
                                        ...QUICK_STANDARD_THT_RESISTOR_PACKAGES.filter((p) => p.techType === currentResTech),
                                        ...MORE_STANDARD_THT_RESISTOR_PACKAGES.filter((p) => p.techType === currentResTech),
                                      ];
                                  const pkg = list.find((p) => p.id === pkgId) || [...QUICK_STANDARD_THT_CAPACITOR_PACKAGES, ...MORE_STANDARD_THT_CAPACITOR_PACKAGES, ...QUICK_STANDARD_THT_RESISTOR_PACKAGES, ...MORE_STANDARD_THT_RESISTOR_PACKAGES].find((p) => p.id === pkgId);
                                  if (pkg) {
                                    updateGenParams({
                                      packageType: "THT",
                                      packageSize: pkg.id,
                                      mounting: "THT",
                                      pitch: pkg.pitch,
                                      padWidth: (pkg as any).padWidth ?? (pkg as any).padSize ?? 1.8,
                                      drill: pkg.drill,
                                      bodyLength: (pkg as any).bodyLength,
                                      bodyWidth: (pkg as any).bodyWidth,
                                      bodyDiameter: (pkg as any).bodyDiameter,
                                      pinCount: (pkg as any).pinCount,
                                      subtype: (pkg as any).subtype || (isCapacitor ? (pkg.polarized ? "Radial_THT" : "Disc_THT") : "Axial_THT"),
                                      polarized: isCapacitor ? !!pkg.polarized : undefined,
                                      value: isCapacitor
                                        ? (pkg.polarized ? `CP_Radial_D${(pkg as any).bodyDiameter}mm_P${pkg.pitch}mm` : (pkg as any).bodyLength ? `C_Film_L${(pkg as any).bodyLength}mm_W${(pkg as any).bodyWidth || 3.5}mm_P${pkg.pitch}mm` : `C_Disc_D${(pkg as any).bodyDiameter || 5.0}mm_P${pkg.pitch}mm`)
                                        : ((pkg as any).subtype === "SIP_Network_THT" ? `RN_SIP-${(pkg as any).pinCount || 8}_P${pkg.pitch}mm` : (pkg as any).subtype === "Potentiometer_THT" ? `RV_Pot_${pkg.id.toUpperCase()}` : (pkg as any).subtype === "Cement_THT" ? `R_Cement_P${pkg.pitch}mm` : `R_${pkg.id.toUpperCase()}_P${pkg.pitch}mm`),
                                    });
                                  }
                                }}
                              >
                                <option value="" disabled className="text-slate-500">
                                  -- Select Package --
                                </option>

                                {isCapacitor ? (
                                  genParams.polarized ? (
                                    <>
                                      <optgroup label="Quick Standard Polarized (Radial Electrolytic)" className="bg-slate-950 text-teal-400 font-bold">
                                        {QUICK_STANDARD_THT_CAPACITOR_PACKAGES.filter((p) => p.polarized === true).map((pkg) => (
                                          <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                            {pkg.name} ({pkg.pitch}mm pitch)
                                          </option>
                                        ))}
                                      </optgroup>

                                      {MORE_STANDARD_THT_CAPACITOR_PACKAGES.filter((p) => p.polarized === true).length > 0 && (
                                        <optgroup label="More Polarized Packages (Power)" className="bg-slate-950 text-blue-400 font-bold">
                                          {MORE_STANDARD_THT_CAPACITOR_PACKAGES.filter((p) => p.polarized === true).map((pkg) => (
                                            <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                              {pkg.name} ({pkg.pitch}mm pitch)
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                    </>
                                  ) : (
                                    <>
                                      <optgroup label="Quick Standard Non-Polarized (Disc & Box Film)" className="bg-slate-950 text-teal-400 font-bold">
                                        {QUICK_STANDARD_THT_CAPACITOR_PACKAGES.filter((p) => !p.polarized).map((pkg) => (
                                          <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                            {pkg.name} ({pkg.pitch}mm pitch)
                                          </option>
                                        ))}
                                      </optgroup>

                                      {MORE_STANDARD_THT_CAPACITOR_PACKAGES.filter((p) => !p.polarized).length > 0 && (
                                        <optgroup label="More Non-Polarized Packages (Safety X2)" className="bg-slate-950 text-blue-400 font-bold">
                                          {MORE_STANDARD_THT_CAPACITOR_PACKAGES.filter((p) => !p.polarized).map((pkg) => (
                                            <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                              {pkg.name} ({pkg.pitch}mm pitch)
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                    </>
                                  )
                                ) : (
                                  (() => {
                                    const currentResTech = genParams.technologyType || "metal-film";
                                    const quickResList = QUICK_STANDARD_THT_RESISTOR_PACKAGES.filter((p) => p.techType === currentResTech);
                                    const moreResList = MORE_STANDARD_THT_RESISTOR_PACKAGES.filter((p) => p.techType === currentResTech);
                                    return (
                                      <>
                                        {quickResList.length > 0 && (
                                          <optgroup label="Quick Standard Packages" className="bg-slate-950 text-teal-400 font-bold">
                                            {quickResList.map((pkg) => (
                                              <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                                {pkg.name} ({pkg.pitch}mm pitch)
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}

                                        {moreResList.length > 0 && (
                                          <optgroup label="More Standard Packages" className="bg-slate-950 text-blue-400 font-bold">
                                            {moreResList.map((pkg) => (
                                              <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                                {pkg.name}
                                              </option>
                                            ))}
                                          </optgroup>
                                        )}
                                      </>
                                    );
                                  })()
                                )}
                              </select>
                            </div>

                            {/* ⚙ Custom / Manual Option Button */}
                            <div className="pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isCustom) {
                                    updateGenParams({ technologyType: "", packageType: "", packageSize: "" });
                                  } else {
                                    updateGenParams({
                                      packageType: "custom",
                                      packageSize: "custom",
                                    });
                                  }
                                }}
                                className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                                  isCustom
                                    ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10"
                                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span>⚙</span>
                                  <span>{lang === "ar" ? "إدخال يدوي مخصص (Custom / Manual)" : "Custom / Manual"}</span>
                                </span>
                                <span className="text-[10px] font-mono opacity-80">
                                  {isCustom ? "Active" : "Click to edit"}
                                </span>
                              </button>
                            </div>

                            {/* Custom THT Dimensions */}
                            {isCustom && (
                              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "تباعد الأرجل Pitch (mm)" : "Lead Spacing (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.pitch ?? (isCapacitor ? 3.5 : 7.62)}
                                      onChange={(e) => updateGenParam("pitch", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "قطر الثقب Drill (mm)" : "Drill Hole (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.drill ?? 0.8}
                                      onChange={(e) => updateGenParam("drill", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "قطر الوسادة (mm)" : "Pad Width (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.padWidth ?? (genParams.padSize ?? 1.8)}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        updateGenParams({ padWidth: val, padSize: val });
                                      }}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "طول الجسم (mm)" : "Body L (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.bodyLength ?? (isCapacitor ? 8.0 : 6.3)}
                                      onChange={(e) => updateGenParam("bodyLength", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "قطر الجسم (mm)" : "Body Dia (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.bodyDiameter ?? (isCapacitor ? 8.0 : 2.4)}
                                      onChange={(e) => updateGenParam("bodyDiameter", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Diodes & LEDs Dedicated Section */}
                  {genFamilyId === "diode" && (() => {
                    const isLed = !!(genParams.isLed || genPresetId?.includes("led"));
                    const isTht = genParams.mounting === "THT" || genParams.packageType === "THT" || genPresetId?.includes("tht") || (genParams.packageSize && (STANDARD_THT_DIODE_SIZES.some((s) => s.id === genParams.packageSize) || STANDARD_THT_LED_SIZES.some((s) => s.id === genParams.packageSize)));
                    const isCustom = genParams.packageSize === "Custom" || genParams.packageType === "Custom" || genParams.packageSize === "Custom_SMD";

                    return (
                      <div className="space-y-3.5 border-t border-slate-800 pt-3">
                        {/* 1. Diode & LED Technology Type Selection (8 Options) */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                            <span>{lang === "ar" ? "نوع وتقنية الدايود / الـ LED" : "Diode & LED Technology"}</span>
                          </label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: "rectifier", label: "Rectifier", isLed: false, desc: "Standard 1N400x" },
                              { id: "schottky", label: "Schottky", isLed: false, desc: "Low VF / Fast" },
                              { id: "zener", label: "Zener", isLed: false, desc: "Voltage Reg" },
                              { id: "tvs", label: "TVS Diode", isLed: false, desc: "ESD Protection" },
                              { id: "led-std", label: "Std LED", isLed: true, desc: "Indicator Light" },
                              { id: "led-power", label: "Power LED", isLed: true, desc: "High Lumen" },
                              { id: "led-rgb", label: "RGB LED", isLed: true, desc: "Multi-Color" },
                              { id: "bridge", label: "Bridge", isLed: false, desc: "Full Wave 4-Pin" },
                            ].map((item) => {
                              const isSelected = (genParams.diodeType || (isLed ? "led-std" : "rectifier")) === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    updateGenParams({
                                      diodeType: item.id,
                                      isLed: item.isLed,
                                      pins: item.id === "led-rgb" ? 4 : item.id === "bridge" ? 4 : 2,
                                      value: item.isLed ? "LED_5mm" : "D_DO-41",
                                    });
                                  }}
                                  className={`px-1.5 py-1.5 rounded text-[11px] font-medium transition-all text-center border ${
                                    isSelected
                                      ? "bg-blue-600/30 border-blue-500 text-blue-200 font-bold shadow-sm shadow-blue-500/20"
                                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                                  }`}
                                >
                                  <div className="truncate">{item.label}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Mounting Style Selector (THT vs SMD) */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                            <span>{lang === "ar" ? "نوع التثبيت (Mounting Style)" : "Mounting Style"}</span>
                          </label>
                          <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                const defaultTht = isLed ? "5mm" : "DO-41";
                                updateGenParams({
                                  mounting: "THT",
                                  packageType: defaultTht,
                                  packageSize: defaultTht,
                                  pitch: isLed ? 2.54 : 10.16,
                                  drill: isLed ? 0.85 : 1.0,
                                  padSize: isLed ? 1.8 : 2.0,
                                  isLed,
                                  value: isLed ? `LED_${defaultTht}` : `D_${defaultTht}`,
                                });
                              }}
                              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                                isTht
                                  ? "bg-cyan-600 text-white shadow-sm"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              THT (ثقبي عبر اللوح)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const defaultSmd = isLed ? "0805" : "SMA";
                                updateGenParams({
                                  mounting: "SMD",
                                  packageType: defaultSmd,
                                  packageSize: defaultSmd,
                                  isLed,
                                  value: isLed ? `LED_${defaultSmd}` : `D_${defaultSmd}`,
                                });
                              }}
                              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                                !isTht
                                  ? "bg-cyan-600 text-white shadow-sm"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              SMD (سطحي SMT)
                            </button>
                          </div>
                        </div>

                        {/* 3. When SMD: All Standard Global Sizes & Manual Input */}
                        {!isTht && (
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between">
                                <span>{lang === "ar" ? (isLed ? "القياسات العالمية للـ LED السطحي" : "القياسات العالمية للدايود السطحي") : (isLed ? "Standard SMD LED Packages" : "Standard SMD Diode Packages")}</span>
                                <span className="text-[9px] text-slate-400 font-mono">{isLed ? "Chip / PLCC" : "SOD / SMA / SMB"}</span>
                              </label>
                              <select
                                className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors mt-1 cursor-pointer"
                                value={genParams.packageSize || genParams.packageType || (isLed ? "0805" : "SMA")}
                                onChange={(e) => {
                                  const sizeId = e.target.value;
                                  if (sizeId === "Custom_SMD") {
                                    updateGenParams({ packageSize: "Custom_SMD", packageType: "Custom_SMD" });
                                    return;
                                  }
                                  const list = isLed ? STANDARD_SMD_LED_SIZES : STANDARD_SMD_DIODE_SIZES;
                                  const found = list.find((s) => s.id === sizeId);
                                  if (found) {
                                    updateGenParams({
                                      packageType: sizeId,
                                      packageSize: sizeId,
                                      pitch: found.pitch,
                                      padWidth: found.padWidth,
                                      padHeight: found.padHeight,
                                      bodyLength: found.bodyLength,
                                      bodyWidth: found.bodyWidth,
                                      isLed,
                                      value: isLed ? `LED_${sizeId}` : `D_${sizeId}`,
                                    });
                                  }
                                }}
                              >
                                {(isLed ? STANDARD_SMD_LED_SIZES : STANDARD_SMD_DIODE_SIZES).map((size) => (
                                  <option key={size.id} value={size.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                    {size.name}
                                  </option>
                                ))}
                                <option value="Custom_SMD" className="bg-slate-900 text-emerald-400 py-1 font-mono">
                                  ⚙ Custom / Manual SMD
                                </option>
                              </select>
                            </div>

                            {/* Custom SMD Dimensions */}
                            {genParams.packageSize === "Custom_SMD" && (
                              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2.5">
                                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                                  <span>Custom SMD Dimensions</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "عرض الوسادة Pad W (mm)" : "Pad Width (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.padWidth ?? 1.2}
                                      onChange={(e) => updateGenParam("padWidth", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "طول الوسادة Pad H (mm)" : "Pad Height (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.padHeight ?? 1.5}
                                      onChange={(e) => updateGenParam("padHeight", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "التباعد Pitch" : "Pitch (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.pitch ?? 2.5}
                                      onChange={(e) => updateGenParam("pitch", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "طول الهيكل Body L" : "Body L (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.bodyLength ?? 3.2}
                                      onChange={(e) => updateGenParam("bodyLength", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "عرض الهيكل Body W" : "Body W (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.bodyWidth ?? 2.0}
                                      onChange={(e) => updateGenParam("bodyWidth", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. When THT: Quick Presets (8 buttons) vs More Standard vs Custom Manual */}
                        {isTht && (
                          <div className="space-y-3.5">
                            {/* Quick Standard Packages */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                                  <span>Quick Standard Packages</span>
                                </span>
                              </div>
                              <select
                                className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
                                value={
                                  QUICK_STANDARD_THT_DIODE_PACKAGES.some((p) => p.id === genParams.packageSize) 
                                    ? genParams.packageSize 
                                    : MORE_STANDARD_THT_DIODE_PACKAGES.some((p) => p.id === genParams.packageSize)
                                      ? genParams.packageSize
                                      : ""
                                }
                                onChange={(e) => {
                                  const pkgId = e.target.value;
                                  if (!pkgId) return;
                                  const pkg = [...QUICK_STANDARD_THT_DIODE_PACKAGES, ...MORE_STANDARD_THT_DIODE_PACKAGES].find((p) => p.id === pkgId);
                                  if (pkg) {
                                    updateGenParams({
                                      packageType: pkg.id,
                                      packageSize: pkg.id,
                                      mounting: "THT",
                                      pitch: pkg.pitch,
                                      padSize: pkg.padSize,
                                      drill: pkg.drill,
                                      bodyLength: (pkg as any).bodyLength,
                                      bodyDiameter: (pkg as any).bodyDiameter,
                                      diameter: (pkg as any).diameter,
                                      pins: (pkg as any).pins ?? 2,
                                      isLed: pkg.isLed,
                                      value: pkg.isLed ? `LED_${pkg.id}` : `D_${pkg.id}`,
                                    });
                                  }
                                }}
                              >
                                <option value="" disabled className="text-slate-500">
                                  -- Select Package --
                                </option>
                                <optgroup label="Quick Standard Packages" className="bg-slate-950 text-teal-400 font-bold">
                                  {QUICK_STANDARD_THT_DIODE_PACKAGES.map((pkg) => (
                                    <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                      {pkg.name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="More Standard Packages" className="bg-slate-950 text-blue-400 font-bold">
                                  {MORE_STANDARD_THT_DIODE_PACKAGES.map((pkg) => (
                                    <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                      {pkg.name}
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>

                            {/* ⚙ Custom / Manual Option Button */}
                            <div className="pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isCustom) {
                                    updateGenParams({ technologyType: "", packageType: "", packageSize: "" });
                                  } else {
                                    updateGenParams({
                                      packageType: "Custom",
                                      packageSize: "Custom",
                                    });
                                  }
                                }}
                                className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                                  isCustom
                                    ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10"
                                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span>⚙</span>
                                  <span>{lang === "ar" ? "إدخال يدوي مخصص (Custom / Manual)" : "Custom / Manual"}</span>
                                </span>
                                <span className="text-[10px] font-mono opacity-80">
                                  {isCustom ? "Active" : "Click to edit"}
                                </span>
                              </button>
                            </div>

                            {/* Custom THT Dimensions */}
                            {isCustom && (
                              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2.5">
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "تباعد الأرجل Pitch (mm)" : "Lead Spacing (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.pitch ?? (isLed ? 2.54 : 10.16)}
                                      onChange={(e) => updateGenParam("pitch", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "قطر الثقب Drill (mm)" : "Drill Hole (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.drill ?? (isLed ? 0.85 : 1.0)}
                                      onChange={(e) => updateGenParam("drill", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "قطر الوسادة (mm)" : "Pad Size (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.padSize ?? 2.0}
                                      onChange={(e) => updateGenParam("padSize", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "طول الجسم (mm)" : "Body L (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.bodyLength ?? 4.3}
                                      onChange={(e) => updateGenParam("bodyLength", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "قطر الجسم (mm)" : "Body Dia (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.bodyDiameter ?? (genParams.diameter ?? 2.6)}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        updateGenParams({ bodyDiameter: val, diameter: val });
                                      }}
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "عدد الأطراف / Pins" : "Number of Pins (Leads)"}
                                  </label>
                                  <select
                                    className="w-full h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors mt-1 cursor-pointer"
                                    value={genParams.pins ?? 2}
                                    onChange={(e) => updateGenParam("pins", parseInt(e.target.value, 10) || 2)}
                                  >
                                    <option value={2}>2 Pins (Single Diode / LED)</option>
                                    <option value={3}>3 Pins (Bi-Color LED / Dual Diode)</option>
                                    <option value={4}>4 Pins (RGB LED / Bridge Rectifier)</option>
                                  </select>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Transistors & Power Dynamic Controls */}
                  {genFamilyId === "transistor" && (
                    <div className="space-y-3.5 border-t border-slate-800 pt-3">
                      {/* 1. Transistor Type Selection (BJT, MOSFET, JFET, IGBT, Darlington, Power Transistor) */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                          <span>{lang === "ar" ? "نوع الترانزستور / التقنية" : "Transistor & Power Type"}</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1.5">
                          {(["BJT", "MOSFET", "JFET", "IGBT", "Darlington", "Power Transistor"] as TransistorType[]).map((tType) => {
                            const isSelected = (genParams.transistorType || "BJT") === tType;
                            return (
                              <button
                                key={tType}
                                type="button"
                                onClick={() => {
                                  let newPol = genParams.polarity;
                                  if (tType === "BJT" || tType === "Darlington") {
                                    if (newPol !== "NPN" && newPol !== "PNP") newPol = "NPN";
                                  } else {
                                    if (newPol !== "N-Channel" && newPol !== "P-Channel") newPol = "N-Channel";
                                  }
                                  updateGenParams({
                                    transistorType: tType,
                                    polarity: newPol,
                                  });
                                }}
                                className={`px-2 py-1.5 rounded text-[11px] font-medium transition-all text-center border ${
                                  isSelected
                                    ? "bg-blue-600/30 border-blue-500 text-blue-200 font-bold shadow-sm shadow-blue-500/20"
                                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                                }`}
                              >
                                {tType}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 2. Polarity / Channel Selection */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                          <span>{lang === "ar" ? "القطبية أو نوع القناة" : "Polarity / Channel Configuration"}</span>
                        </label>
                        <div className="grid grid-cols-2 gap-1.5">
                          {((genParams.transistorType === "BJT" || genParams.transistorType === "Darlington")
                            ? [
                                { id: "NPN", label: "NPN", desc: "Negative-Positive-Negative" },
                                { id: "PNP", label: "PNP", desc: "Positive-Negative-Positive" },
                              ]
                            : [
                                { id: "N-Channel", label: "N-Channel", desc: "N-Ch Electron Flow" },
                                { id: "P-Channel", label: "P-Channel", desc: "P-Ch Hole Flow" },
                              ]
                          ).map((pol) => {
                            const isSelected = (genParams.polarity || (genParams.transistorType === "BJT" || genParams.transistorType === "Darlington" ? "NPN" : "N-Channel")) === pol.id;
                            return (
                              <button
                                key={pol.id}
                                type="button"
                                onClick={() => updateGenParam("polarity", pol.id)}
                                className={`px-2.5 py-1.5 rounded text-xs font-mono font-semibold transition-all border flex items-center justify-between ${
                                  isSelected
                                    ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10"
                                    : "bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                                }`}
                              >
                                <span>{pol.label}</span>
                                <span className="text-[9px] font-sans font-normal opacity-70">{pol.id === "NPN" || pol.id === "N-Channel" ? "N-Type" : "P-Type"}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* 3. Mounting Selector (THT vs SMD) */}
                      <div>
                        <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                          <span>{lang === "ar" ? "نوع التثبيت (Mounting Style)" : "Mounting Style"}</span>
                        </label>
                        <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                          <button
                            type="button"
                            onClick={() => {
                              updateGenParams({
                                mounting: "THT",
                                packageType: genParams.packageType && ALL_THT_TRANSISTOR_PACKAGES.some(p => p.id === genParams.packageType) ? genParams.packageType : "TO-92",
                                packageSize: genParams.packageType && ALL_THT_TRANSISTOR_PACKAGES.some(p => p.id === genParams.packageType) ? genParams.packageType : "TO-92",
                              });
                            }}
                            className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                              (genParams.mounting !== "SMD")
                                ? "bg-cyan-600 text-white shadow-sm"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            THT (ثقبي عبر اللوح)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              updateGenParams({
                                mounting: "SMD",
                                packageType: genParams.packageType && STANDARD_SMD_TRANSISTOR_PACKAGES.some(p => p.id === genParams.packageType) ? genParams.packageType : "SOT-23",
                                packageSize: genParams.packageType && STANDARD_SMD_TRANSISTOR_PACKAGES.some(p => p.id === genParams.packageType) ? genParams.packageType : "SOT-23",
                              });
                            }}
                            className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                              genParams.mounting === "SMD"
                                ? "bg-cyan-600 text-white shadow-sm"
                                : "text-slate-400 hover:text-slate-200"
                            }`}
                          >
                            SMD (سطحي SMT)
                          </button>
                        </div>
                      </div>

                      {/* 4. SMD PACKAGES (when SMD is active) */}
                      {genParams.mounting === "SMD" && (
                        <div className="space-y-3">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between">
                              <span>{lang === "ar" ? "القياسات العالمية للترانزستور السطحي (SMD Packages)" : "Standard SMD Transistor Packages"}</span>
                              <span className="text-[9px] text-slate-400 font-mono">SOT / DPAK / DFN</span>
                            </label>
                            <select
                              className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors mt-1 cursor-pointer"
                              value={genParams.packageSize || genParams.packageType || "SOT-23"}
                              onChange={(e) => {
                                const pkgId = e.target.value;
                                const found = STANDARD_SMD_TRANSISTOR_PACKAGES.find(p => p.id === pkgId);
                                updateGenParams({
                                  packageType: pkgId,
                                  packageSize: pkgId,
                                  mounting: "SMD",
                                  pitch: found ? found.pitch : (genParams.pitch ?? 0.95),
                                  padWidth: found ? found.padWidth : (genParams.padWidth ?? 0.8),
                                  padHeight: found ? found.padHeight : (genParams.padHeight ?? 0.9),
                                  bodyWidth: found ? found.bodyWidth : (genParams.bodyWidth ?? 2.9),
                                  bodyLength: found ? found.bodyLength : (genParams.bodyLength ?? 1.3),
                                  pins: found ? found.pins : (genParams.pins ?? 3),
                                  value: pkgId === "Custom_SMD" ? "SMD_Transistor" : pkgId,
                                });
                              }}
                            >
                              <optgroup label="Small Signal SMD (إشارة صغيرة)" className="bg-slate-950 text-blue-400 font-bold">
                                {STANDARD_SMD_TRANSISTOR_PACKAGES.filter(p => p.category === "standard").map(pkg => (
                                  <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                    {pkg.name}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Power SMD (طاقة ومشتت حراري)" className="bg-slate-950 text-amber-400 font-bold">
                                {STANDARD_SMD_TRANSISTOR_PACKAGES.filter(p => p.category === "power").map(pkg => (
                                  <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                    {pkg.name}
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="Custom / Manual (مخصص)" className="bg-slate-950 text-emerald-400 font-bold">
                                <option value="Custom_SMD" className="bg-slate-900 text-slate-100 py-1 font-mono">
                                  ⚙ Custom SMD Transistor (إدخال يدوي)
                                </option>
                              </optgroup>
                            </select>
                          </div>

                          {/* Custom SMD Manual Inputs */}
                          {(genParams.packageSize === "Custom_SMD" || genParams.packageType === "Custom_SMD") && (
                            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2.5">
                              <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                                <span>{lang === "ar" ? "القياسات اليدوية للترانزستور السطحي (Manual SMD Dimensions)" : "Manual SMD Dimensions"}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "عرض الوسادة Pad W (mm)" : "Pad Width (mm)"}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                    value={genParams.padWidth ?? 0.8}
                                    onChange={(e) => updateGenParam("padWidth", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "طول الوسادة Pad H (mm)" : "Pad Height (mm)"}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                    value={genParams.padHeight ?? 0.9}
                                    onChange={(e) => updateGenParam("padHeight", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "تباعد الأرجل Pitch (mm)" : "Pin Pitch (mm)"}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                    value={genParams.pitch ?? 0.95}
                                    onChange={(e) => updateGenParam("pitch", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "عدد الأرجل Pins" : "Number of Pins"}
                                  </label>
                                  <select
                                    className="w-full h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs font-mono text-white mt-1"
                                    value={genParams.pins ?? 3}
                                    onChange={(e) => updateGenParam("pins", parseInt(e.target.value, 10) || 3)}
                                  >
                                    <option value={3}>3 Pins</option>
                                    <option value={4}>4 Pins</option>
                                    <option value={5}>5 Pins</option>
                                    <option value={6}>6 Pins</option>
                                    <option value={8}>8 Pins</option>
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "عرض الهيكل Body W (mm)" : "Body Width (mm)"}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                    value={genParams.bodyWidth ?? 2.9}
                                    onChange={(e) => updateGenParam("bodyWidth", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "طول الهيكل Body L (mm)" : "Body Length (mm)"}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                    value={genParams.bodyLength ?? 1.3}
                                    onChange={(e) => updateGenParam("bodyLength", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* 5. THT PACKAGES (when THT is active) */}
                      {genParams.mounting !== "SMD" && (
                        <div className="space-y-3.5">
                          {/* Quick Standard Packages */}
                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                                <span>Quick Standard Packages</span>
                              </span>
                            </div>
                            <select
                              className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
                              value={
                                [...QUICK_STANDARD_THT_PACKAGES, ...MORE_STANDARD_THT_PACKAGES].some((p) => p.id === genParams.packageSize) 
                                  ? genParams.packageSize 
                                  : ""
                              }
                              onChange={(e) => {
                                const pkgId = e.target.value;
                                if (!pkgId) return;
                                const found = [...QUICK_STANDARD_THT_PACKAGES, ...MORE_STANDARD_THT_PACKAGES].find((p) => p.id === pkgId);
                                if (found) {
                                  updateGenParams({
                                    packageType: found.id,
                                    packageSize: found.id,
                                    mounting: "THT",
                                    pitch: found.pitch,
                                    padSize: found.padSize,
                                    drill: found.drill,
                                    bodyWidth: found.bodyWidth,
                                    bodyLength: found.bodyLength,
                                    pins: found.pins,
                                    value: found.id,
                                  });
                                }
                              }}
                            >
                              <option value="" disabled className="text-slate-500">
                                -- Select Package --
                              </option>
                              <optgroup label="Quick Standard Packages" className="bg-slate-950 text-teal-400 font-bold">
                                {QUICK_STANDARD_THT_PACKAGES.map((pkg) => (
                                  <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                    {pkg.name} ({pkg.pitch}mm pitch)
                                  </option>
                                ))}
                              </optgroup>
                              <optgroup label="More Standard Packages" className="bg-slate-950 text-blue-400 font-bold">
                                {MORE_STANDARD_THT_PACKAGES.map((pkg) => (
                                  <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                    {pkg.name} ({pkg.pitch}mm pitch)
                                  </option>
                                ))}
                              </optgroup>
                            </select>
                          </div>


                          {/* ⚙ Custom / Manual Option Button */}
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                const active = genParams.packageType === "Custom" || genParams.packageSize === "Custom" || genParams.packageSize === "Custom_SMD";
                                if (active) {
                                  updateGenParams({ technologyType: "", packageType: "", packageSize: "" });
                                } else {
                                  updateGenParams({
                                    packageType: "Custom",
                                    packageSize: "Custom",
                                    mounting: "THT",
                                    pitch: genParams.pitch ?? 2.54,
                                    padSize: genParams.padSize ?? 1.8,
                                    drill: genParams.drill ?? 1.0,
                                    bodyWidth: genParams.bodyWidth ?? 10.0,
                                    bodyLength: genParams.bodyLength ?? 4.5,
                                    pins: genParams.pins ?? 3,
                                    value: "Custom_THT_Transistor",
                                  });
                                }
                              }}
                              className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                                genParams.packageType === "Custom" || genParams.packageSize === "Custom"
                                  ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10"
                                  : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <span>⚙</span>
                                <span>{lang === "ar" ? "إدخال يدوي مخصص (Custom / Manual)" : "Custom / Manual"}</span>
                              </span>
                              <span className="text-[10px] font-mono opacity-80">
                                {genParams.packageType === "Custom" || genParams.packageSize === "Custom" ? "Active" : "Click to edit"}
                              </span>
                            </button>
                          </div>

                          {/* Custom THT Transistor Manual Parameters */}
                          {(genParams.packageType === "Custom" || genParams.packageSize === "Custom") && (
                            <div className="p-3 bg-slate-900/90 border border-amber-500/30 rounded-lg space-y-2.5">
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "تباعد الأرجل Pitch (mm)" : "Lead Spacing (mm)"}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                    value={genParams.pitch ?? 2.54}
                                    onChange={(e) => updateGenParam("pitch", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "قطر الثقب Drill (mm)" : "Drill Hole (mm)"}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                    value={genParams.drill ?? 1.0}
                                    onChange={(e) => updateGenParam("drill", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "حجم الوسادة Pad Size (mm)" : "Pad Size (mm)"}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                    value={genParams.padSize ?? 1.8}
                                    onChange={(e) => updateGenParam("padSize", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "عدد الأرجل Pins" : "Number of Pins"}
                                  </label>
                                  <select
                                    className="w-full h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs font-mono text-white mt-1"
                                    value={genParams.pins ?? 3}
                                    onChange={(e) => updateGenParam("pins", parseInt(e.target.value, 10) || 3)}
                                  >
                                    <option value={2}>2 Pins (TO-3 / Power Diode)</option>
                                    <option value={3}>3 Pins (Standard Inline / Can)</option>
                                    <option value={4}>4 Pins (Dual-Gate / Shielded)</option>
                                    <option value={5}>5 Pins (Regulator / TO-220-5)</option>
                                  </select>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "عرض الهيكل Body W (mm)" : "Body Width (mm)"}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                    value={genParams.bodyWidth ?? 10.0}
                                    onChange={(e) => updateGenParam("bodyWidth", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "طول/عمق الهيكل Body L (mm)" : "Body Length (mm)"}
                                  </label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                    value={genParams.bodyLength ?? 4.5}
                                    onChange={(e) => updateGenParam("bodyLength", parseFloat(e.target.value) || 0)}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Inductors & Ferrites Dedicated Unified Section */}
                  {genFamilyId === "inductor" && (() => {
                    const isTht = genParams.mounting === "THT" || (genParams.packageType && (genParams.packageType.toLowerCase().includes("tht") || genParams.packageType.toLowerCase().includes("axial") || genParams.packageType.toLowerCase().includes("radial") || genParams.packageType.toLowerCase().includes("toroid")));
                    const isCustom = genParams.packageSize === "custom" || genParams.packageType === "custom" || genParams.packageSize === "Custom_SMD" || genParams.packageType === "Custom";

                    return (
                      <div className="space-y-3.5 border-t border-slate-800 pt-3">
                        {/* 1. Inductor Technology / Sub-Type Grid */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                            <span>{lang === "ar" ? "نوع وتقنية الملف / الخانق" : "Inductor & Choke Technology"}</span>
                          </label>
                          <div className="grid grid-cols-3 gap-1.5">
                            {[
                              { id: "power", label: "Power Inductor", isThtOpt: false, desc: "Shielded Drum / High Saturation" },
                              { id: "chip", label: "SMD Chip", isThtOpt: false, desc: "Multilayer / Wirewound" },
                              { id: "ferrite", label: "Ferrite Bead", isThtOpt: false, desc: "EMI Noise Suppression" },
                              { id: "cmc", label: "Common Mode", isThtOpt: false, desc: "Dual Coil Line Filter" },
                              { id: "axial", label: "Axial Leaded", isThtOpt: true, desc: "Color Code Inductor" },
                              { id: "radial", label: "Radial Choke", isThtOpt: true, desc: "Drum Core Power Choke" },
                              { id: "toroid", label: "Toroidal Core", isThtOpt: true, desc: "Ring Core High Current" },
                            ].map((item) => {
                              const isSelected = (genParams.technologyType || (isTht ? "axial" : "power")) === item.id;
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => {
                                    if (item.id === "axial") {
                                      updateGenParams({
                                        technologyType: "axial",
                                        mounting: "THT",
                                        packageType: "axial-l5",
                                        packageSize: "axial-l5",
                                        pitch: 7.62,
                                        bodyLength: 5.0,
                                        bodyDiameter: 2.5,
                                        drill: 0.8,
                                        padSize: 1.6,
                                        value: "L_Axial_P7.62mm",
                                      });
                                    } else if (item.id === "radial") {
                                      updateGenParams({
                                        technologyType: "radial",
                                        mounting: "THT",
                                        packageType: "radial-d8",
                                        packageSize: "radial-d8",
                                        pitch: 5.0,
                                        diameter: 8.0,
                                        bodyDiameter: 8.0,
                                        bodyLength: 10.0,
                                        drill: 0.9,
                                        padSize: 1.8,
                                        value: "L_Radial_D8mm_P5mm",
                                      });
                                    } else if (item.id === "toroid") {
                                      updateGenParams({
                                        technologyType: "toroid",
                                        mounting: "THT",
                                        packageType: "toroid-d15",
                                        packageSize: "toroid-d15",
                                        pitch: 10.0,
                                        diameter: 15.0,
                                        outerDiameter: 15.0,
                                        innerDiameter: 7.0,
                                        drill: 1.0,
                                        padSize: 2.0,
                                        value: "L_Toroid_D15mm_P10mm",
                                      });
                                    } else if (item.id === "cmc") {
                                      const defaultCmc = isTht ? "cmc-uu9.8" : "SMD-4_6.5x6mm";
                                      updateGenParams({
                                        technologyType: "cmc",
                                        packageType: defaultCmc,
                                        packageSize: defaultCmc,
                                        pins: 4,
                                        value: isTht ? "CMC_THT_UU9.8" : "CMC_SMD_6.5x6mm",
                                      });
                                    } else if (item.id === "ferrite") {
                                      updateGenParams({
                                        technologyType: "ferrite",
                                        mounting: "SMD",
                                        packageType: "Ferrite Bead",
                                        packageSize: "0805",
                                        value: "FB_0805",
                                      });
                                    } else if (item.id === "chip") {
                                      updateGenParams({
                                        technologyType: "chip",
                                        mounting: "SMD",
                                        packageType: "SMD",
                                        packageSize: "0805",
                                        value: "L_0805",
                                      });
                                    } else if (item.id === "power") {
                                      updateGenParams({
                                        technologyType: "power",
                                        mounting: "SMD",
                                        packageType: "Power Inductor",
                                        packageSize: "CDRH104",
                                        value: "L_CDRH104",
                                      });
                                    } else if (item.id === "custom") {
                                      if (isSelected) {
                                        updateGenParams({ technologyType: "", packageType: "", packageSize: "" });
                                      } else {
                                        updateGenParams({
                                          technologyType: "custom",
                                          packageType: "custom",
                                          packageSize: "custom",
                                        });
                                      }
                                    }
                                  }}
                                  className={`px-1.5 py-1.5 rounded text-[11px] font-medium transition-all text-center border ${
                                    isSelected
                                      ? "bg-blue-600/30 border-blue-500 text-blue-200 font-bold shadow-sm shadow-blue-500/20"
                                      : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                                  }`}
                                >
                                  <div className="truncate">{item.label}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Mounting Style Selector (THT vs SMD) */}
                        <div>
                          <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
                            <span>{lang === "ar" ? "نوع التثبيت (Mounting Style)" : "Mounting Style"}</span>
                          </label>
                          <div className="grid grid-cols-2 gap-1.5 p-0.5 bg-slate-950 rounded-lg border border-slate-800">
                            <button
                              type="button"
                              onClick={() => {
                                updateGenParams({
                                  mounting: "THT",
                                  packageType: "axial-l5",
                                  packageSize: "axial-l5",
                                  pitch: 7.62,
                                  drill: 0.8,
                                  padSize: 1.6,
                                  bodyLength: 5.0,
                                  bodyDiameter: 2.5,
                                  value: "L_Axial_P7.62mm",
                                });
                              }}
                              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                                isTht
                                  ? "bg-cyan-600 text-white shadow-sm"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              THT (ثقبي عبر اللوح)
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                updateGenParams({
                                  mounting: "SMD",
                                  packageType: "Power Inductor",
                                  packageSize: "CDRH104",
                                  value: "L_CDRH104",
                                });
                              }}
                              className={`py-1.5 text-xs font-semibold rounded-md transition-all ${
                                !isTht
                                  ? "bg-cyan-600 text-white shadow-sm"
                                  : "text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              SMD (سطحي SMT)
                            </button>
                          </div>
                        </div>

                        {/* 3. When SMD: All Standard Global Sizes & Manual Input */}
                        {!isTht && (
                          <div className="space-y-3">
                            <div>
                              <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between">
                                <span>{lang === "ar" ? "القياسات العالمية للملف السطحي" : "Standard SMD Inductor Packages"}</span>
                                <span className="text-[9px] text-slate-400 font-mono">EIA / Power / CMC</span>
                              </label>
                              <select
                                className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-mono text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors mt-1 cursor-pointer"
                                value={genParams.packageSize || genParams.packageType || "CDRH104"}
                                onChange={(e) => {
                                  const sizeId = e.target.value;
                                  if (sizeId === "Custom_SMD") {
                                    updateGenParams({ packageSize: "Custom_SMD", packageType: "Custom_SMD" });
                                    return;
                                  }
                                  const found = STANDARD_SMD_INDUCTOR_PACKAGES.find((s) => s.id === sizeId);
                                  if (found) {
                                    const pkgType = found.category === "cmc" ? "Common Mode Choke" : found.category === "power" ? "Power Inductor" : "SMD";
                                    updateGenParams({
                                      packageType: pkgType,
                                      packageSize: sizeId,
                                      chipSize: sizeId,
                                      mounting: "SMD",
                                      value: `L_${sizeId}`,
                                    });
                                  }
                                }}
                              >
                                <optgroup label="Power Inductors (طاقة ومشتت)" className="bg-slate-950 text-amber-400 font-bold">
                                  {STANDARD_SMD_INDUCTOR_PACKAGES.filter((p) => p.category === "power").map((size) => (
                                    <option key={size.id} value={size.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                      {size.name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Chip Inductors & Ferrites (إشارة وخوانق)" className="bg-slate-950 text-blue-400 font-bold">
                                  {STANDARD_SMD_INDUCTOR_PACKAGES.filter((p) => p.category === "chip").map((size) => (
                                    <option key={size.id} value={size.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                      {size.name} ({size.desc})
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Common Mode Chokes (فلتر ثنائي)" className="bg-slate-950 text-cyan-400 font-bold">
                                  {STANDARD_SMD_INDUCTOR_PACKAGES.filter((p) => p.category === "cmc").map((size) => (
                                    <option key={size.id} value={size.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                      {size.name}
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="Custom / Manual (مخصص)" className="bg-slate-950 text-emerald-400 font-bold">
                                  <option value="Custom_SMD" className="bg-slate-900 text-emerald-400 py-1 font-mono">
                                    ⚙ Custom / Manual SMD Inductor
                                  </option>
                                </optgroup>
                              </select>
                            </div>

                            {/* Custom SMD Dimensions */}
                            {(genParams.packageSize === "Custom_SMD" || genParams.packageType === "Custom_SMD") && (
                              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2.5">
                                <div className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
                                  <span>{lang === "ar" ? "القياسات اليدوية للملف السطحي" : "Custom SMD Dimensions"}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "عرض الوسادة Pad W (mm)" : "Pad Width (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.padWidth ?? 1.2}
                                      onChange={(e) => updateGenParam("padWidth", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "طول الوسادة Pad H (mm)" : "Pad Height (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.padHeight ?? 1.5}
                                      onChange={(e) => updateGenParam("padHeight", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "التباعد Pitch" : "Pitch (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.pitch ?? 2.5}
                                      onChange={(e) => updateGenParam("pitch", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "طول الهيكل Body L" : "Body L (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.bodyLength ?? 2.5}
                                      onChange={(e) => updateGenParam("bodyLength", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "عرض الهيكل Body W" : "Body W (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.bodyWidth ?? 2.0}
                                      onChange={(e) => updateGenParam("bodyWidth", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* 4. When THT: Unified Quick Standard Packages vs Custom Manual */}
                        {isTht && (
                          <div className="space-y-3.5">
                            {/* Quick Standard Packages (Unified) */}
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                                  <span>Quick Standard Packages</span>
                                </span>
                              </div>
                              <select
                                className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
                                value={
                                  QUICK_STANDARD_THT_INDUCTOR_PACKAGES.some((p) => p.id === genParams.packageSize) 
                                    ? genParams.packageSize 
                                    : MORE_STANDARD_THT_INDUCTOR_PACKAGES.some((p) => p.id === genParams.packageSize)
                                      ? genParams.packageSize
                                      : ""
                                }
                                onChange={(e) => {
                                  const pkgId = e.target.value;
                                  const pkg = [...QUICK_STANDARD_THT_INDUCTOR_PACKAGES, ...MORE_STANDARD_THT_INDUCTOR_PACKAGES].find((p) => p.id === pkgId);
                                  if (pkg) {
                                    updateGenParams({
                                      packageType: pkg.id,
                                      packageSize: pkg.id,
                                      mounting: "THT",
                                      pitch: pkg.pitch,
                                      padSize: (pkg as any).padSize,
                                      drill: (pkg as any).drill,
                                      bodyLength: (pkg as any).bodyLength,
                                      bodyDiameter: (pkg as any).bodyDiameter,
                                      diameter: (pkg as any).bodyDiameter,
                                      outerDiameter: (pkg as any).bodyDiameter,
                                      innerDiameter: (pkg as any).bodyDiameter ? (pkg as any).bodyDiameter * 0.5 : undefined,
                                      bodyWidth: (pkg as any).bodyWidth,
                                      pins: (pkg as any).pins ?? 2,
                                      value: `L_${pkg.name.replace(/\s+/g, "_")}`,
                                    });
                                  }
                                }}
                              >
                                <option value="" disabled className="text-slate-500">
                                  -- Select Package --
                                </option>
                                <optgroup label="Quick Standard Packages" className="bg-slate-950 text-teal-400 font-bold">
                                  {QUICK_STANDARD_THT_INDUCTOR_PACKAGES.map((pkg) => (
                                    <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                      {pkg.name} ({pkg.pitch}mm pitch)
                                    </option>
                                  ))}
                                </optgroup>
                                <optgroup label="More Standard Packages" className="bg-slate-950 text-blue-400 font-bold">
                                  {MORE_STANDARD_THT_INDUCTOR_PACKAGES.map((pkg) => (
                                    <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                                      {pkg.name} ({pkg.pitch}mm pitch)
                                    </option>
                                  ))}
                                </optgroup>
                              </select>
                            </div>

                            {/* ⚙ Custom / Manual Option Button */}
                            <div className="pt-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  if (isCustom) {
                                    updateGenParams({ technologyType: "", packageType: "", packageSize: "" });
                                  } else {
                                    updateGenParams({
                                      packageType: "Custom",
                                      packageSize: "Custom",
                                      mounting: "THT",
                                    });
                                  }
                                }}
                                className={`w-full py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                                  isCustom
                                    ? "bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm shadow-amber-500/10"
                                    : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700"
                                }`}
                              >
                                <span className="flex items-center gap-2">
                                  <span>⚙</span>
                                  <span>{lang === "ar" ? "إدخال يدوي مخصص (Custom / Manual)" : "Custom / Manual"}</span>
                                </span>
                                <span className="text-[10px] font-mono opacity-80">
                                  {isCustom ? "Active" : "Click to edit"}
                                </span>
                              </button>
                            </div>

                            {/* Custom THT Dimensions */}
                            {isCustom && (
                              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2.5">
                                <div>
                                  <label className="text-[10px] font-semibold text-slate-400">
                                    {lang === "ar" ? "طراز الملف الثقبي" : "Choke Geometry Type"}
                                  </label>
                                  <select
                                    className="w-full h-8 rounded-md border border-slate-700 bg-slate-950 px-2.5 text-xs font-mono text-white mt-1 cursor-pointer"
                                    value={genParams.thtType || (genParams.packageSize?.includes("Radial") ? "radial" : genParams.packageSize?.includes("Toroid") ? "toroid" : "axial")}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      updateGenParams({
                                        thtType: val,
                                        packageType: `Custom_${val}`,
                                        packageSize: `Custom_${val}`,
                                        pins: val === "cmc" ? 4 : 2,
                                      });
                                    }}
                                  >
                                    <option value="axial">Axial Leaded Choke</option>
                                    <option value="radial">Radial Drum Choke</option>
                                    <option value="toroid">Toroidal Core</option>
                                    <option value="cmc">Common Mode Choke 4-Pin</option>
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2.5">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "تباعد الأرجل Pitch (mm)" : "Lead Spacing (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.pitch ?? 7.62}
                                      onChange={(e) => updateGenParam("pitch", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "قطر الثقب Drill (mm)" : "Drill Hole (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.drill ?? 0.8}
                                      onChange={(e) => updateGenParam("drill", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "قطر الوسادة Pad (mm)" : "Pad Dia (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.padSize ?? 1.8}
                                      onChange={(e) => updateGenParam("padSize", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "طول الجسم (mm)" : "Body L (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.bodyLength ?? 6.0}
                                      onChange={(e) => updateGenParam("bodyLength", parseFloat(e.target.value) || 0)}
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] font-semibold text-slate-400">
                                      {lang === "ar" ? "قطر الجسم (mm)" : "Body Dia (mm)"}
                                    </label>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                                      value={genParams.bodyDiameter ?? (genParams.diameter ?? 3.0)}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        updateGenParams({ bodyDiameter: val, diameter: val, outerDiameter: val });
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Crystals & Oscillators Dedicated Unified Section */}
                  {genFamilyId === "crystal" && (
                    <CrystalFamilySection
                      genParams={genParams}
                      updateGenParams={updateGenParams}
                      updateGenParam={updateGenParam}
                      lang={lang}
                    />
                  )}

                  {/* Switches & Relays Dedicated Unified Section */}
                  {genFamilyId === "switch_relay" && (
                    <SwitchRelayFamilySection
                      genParams={genParams}
                      updateGenParams={updateGenParams}
                      updateGenParam={updateGenParam}
                      lang={lang}
                    />
                  )}

                  {/* Fuses & Protection Dedicated Unified Section */}
                  {genFamilyId === "fuse_protection" && (
                    <FuseProtectionFamilySection
                      genParams={genParams}
                      updateGenParams={updateGenParams}
                      updateGenParam={updateGenParam}
                      lang={lang}
                    />
                  )}

                  {/* Potentiometers & Trimmers Dedicated Unified Section */}
                  {genFamilyId === "potentiometer" && (
                    <PotentiometerFamilySection
                      genParams={genParams}
                      updateGenParams={updateGenParams}
                      updateGenParam={updateGenParam}
                      lang={lang}
                    />
                  )}

                  {/* Optocouplers & Isolators Dedicated Unified Section */}
                  {genFamilyId === "optocoupler" && (
                    <OptocouplerFamilySection
                      genParams={genParams}
                      updateGenParams={updateGenParams}
                      updateGenParam={updateGenParam}
                      lang={lang}
                    />
                  )}

                  {/* Batteries & Power Dedicated Unified Section */}
                  {genFamilyId === "batteries_power" && (
                    <BatteriesPowerFamilySection
                      genParams={genParams}
                      updateGenParams={updateGenParams}
                      updateGenParam={updateGenParam}
                      lang={lang}
                    />
                  )}

                  {/* Generic Package Type for families with packageType presets */}
                  {genParams.packageType !== undefined &&
                    ![
                      "transistor",
                      "diode",
                      "inductor",
                      "passive",
                      "crystal",
                      "switch_relay",
                      "fuse_protection",
                      "potentiometer",
                      "optocoupler",
                      "batteries_power",
                    ].includes(genFamilyId) &&
                    currentFamily.presets.some((p) => p.params?.packageType) && (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400">
                        {lang === "ar" ? "طراز الحزمة" : "Package Type"}
                      </label>
                      <select
                        className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors mt-1 cursor-pointer"
                        value={genParams.packageType}
                        onChange={(e) => {
                          const val = e.target.value;
                          const foundPreset = currentFamily.presets.find((p) => p.params?.packageType === val);
                          if (foundPreset) {
                            handleSelectPreset(foundPreset.id);
                          } else {
                            updateGenParam("packageType", val);
                          }
                        }}
                      >
                        {currentFamily.presets
                          .filter((p) => p.params?.packageType)
                          .map((p) => (
                            <option key={p.id} value={p.params.packageType}>
                              {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Action Button to Assign / Insert */}
                <Button
                  className="w-full h-10 text-xs font-bold gap-2 bg-blue-600 hover:bg-blue-500 text-white mt-2 shadow-lg shadow-blue-900/30 active:scale-[0.99] transition-all"
                  onClick={() => handleSelectFootprint(generatedModel)}
                >
                  <Sparkles className="size-4 text-blue-200" />
                  <span>
                    {selectionOnly
                      ? lang === "ar"
                        ? "تعيين هذه البصمة المولدة للعنصر"
                        : "Assign Generated Footprint"
                      : lang === "ar"
                      ? "توليد وإضافة للوحة (PCB)"
                      : "Generate & Add to PCB"}
                  </span>
                </Button>
              </div>

              {/* Right Column: Live Interactive Visual Preview with Requested Layer Toggles */}
              <div className="flex-1 min-h-[320px] p-3 sm:p-4 flex flex-col gap-2.5 bg-slate-950 overflow-hidden">
                {/* Header with Title & Stats */}
                <div className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-200">
                      {lang === "ar" ? "معاينة هندسية مباشرة للبصمة" : "Live Visual Footprint"}
                    </span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400">
                    {(() => {
                      const b = nativeFootprintBounds(generatedModel);
                      const w = Math.max(0, b.maxX - b.minX);
                      const h = Math.max(0, b.maxY - b.minY);
                      return `${w.toFixed(2)} × ${h.toFixed(2)} mm`;
                    })()}
                  </div>
                </div>

                {/* The Visual Stage with Layer Toggles on the Left */}
                <div className="flex-1 flex flex-row gap-2.5 min-h-0 overflow-hidden" dir="ltr">
                  {/* Layer Toggles Panel on the Left */}
                  <div className="shrink-0 flex flex-col justify-start">
                    <FootprintLayerToggles
                      visibility={layerVisibility}
                      onChange={setLayerVisibility}
                      orientation="vertical"
                    />
                  </div>

                  {/* Canvas Container */}
                  <div className="flex-1 border border-slate-800 rounded-xl bg-slate-950 p-2 sm:p-4 relative overflow-hidden flex items-center justify-center shadow-inner min-h-[220px]">
                    <FootprintPreview
                      footprint={generatedModel}
                      layerVisibility={layerVisibility}
                      className="w-full h-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: IMPORT KICAD FOOTPRINTS */}
          {mainTab === "import" && (
            <div className="h-full flex flex-col min-h-0 overflow-hidden" dir="ltr">
              {/* VIEW 1: LIBRARIES LIST */}
              {view === "libraries" && (
                <div className="h-full flex flex-col min-h-0">
                  {/* Search & Category Tabs */}
                  <div className="p-2.5 sm:p-3 border-b border-slate-800 space-y-2 shrink-0 bg-slate-900/30">
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 sm:size-4 text-slate-500" />
                        <Input
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder={
                            lang === "ar"
                              ? "بحث في المكتبات (مثل Package_DIP, Connector, Resistor)..."
                              : "Search libraries (e.g. DIP, Connector, Resistor)..."
                          }
                          className="h-8 sm:h-9 ps-8 sm:ps-9 text-xs sm:text-sm bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
                        />
                      </div>

                      <input
                        ref={fileRef}
                        type="file"
                        accept=".kicad_mod"
                        className="hidden"
                        onChange={handleFileUpload}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 sm:h-9 text-xs gap-1.5 border-slate-700 text-slate-300 hover:text-white shrink-0"
                        onClick={() => fileRef.current?.click()}
                        title="تحميل ملف .kicad_mod"
                      >
                        <FileUp className="size-3.5 text-blue-500" />
                        <span className="hidden sm:inline">{lang === "ar" ? "ملف بصمة" : "Upload .kicad_mod"}</span>
                      </Button>
                    </div>

                    {/* Categories Pills */}
                    <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-xs">
                      <button
                        onClick={() => setActiveCategory("all")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors shrink-0 ${
                          activeCategory === "all"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {lang === "ar" ? "الكل" : "All"} ({libraries.length})
                      </button>

                      <button
                        onClick={() => setActiveCategory("ic_packages")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors shrink-0 ${
                          activeCategory === "ic_packages"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {lang === "ar" ? "دوائر متكاملة (ICs)" : "IC Packages"}
                      </button>

                      <button
                        onClick={() => setActiveCategory("passives")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors shrink-0 ${
                          activeCategory === "passives"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {lang === "ar" ? "مقاومات ومكثفات" : "Passives (R/C)"}
                      </button>

                      <button
                        onClick={() => setActiveCategory("connectors")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors shrink-0 ${
                          activeCategory === "connectors"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {lang === "ar" ? "موصلات ورؤوس" : "Connectors"}
                      </button>

                      <button
                        onClick={() => setActiveCategory("semiconductors")}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors shrink-0 ${
                          activeCategory === "semiconductors"
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {lang === "ar" ? "أشباه موصلات" : "Semiconductors"}
                      </button>
                    </div>
                  </div>

                  {/* Libraries Grid */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
                    {loading ? (
                      <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="size-6 animate-spin text-blue-500" />
                        <span className="text-xs">{lang === "ar" ? "جاري تحميل المكتبات…" : "Loading libraries…"}</span>
                      </div>
                    ) : filteredLibraries.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
                        {lang === "ar" ? "لا توجد مكتبات مطابقة" : "No matching libraries found"}
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                        {filteredLibraries.map((libName) => (
                          <div
                            key={libName}
                            onClick={() => loadLibrary(libName)}
                            className="flex items-center justify-between p-3 hover:bg-slate-800/60 transition-all cursor-pointer group"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="p-2 rounded-lg bg-blue-950/50 border border-blue-900/50 text-blue-400 group-hover:bg-blue-600 group-hover:text-white transition-colors shrink-0">
                                <FolderOpen className="size-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-blue-400 transition-colors truncate">
                                  {libName}
                                </div>
                                <div className="text-[10px] text-slate-500">KiCad Footprint Library</div>
                              </div>
                            </div>
                            <ChevronRight className="size-4 text-slate-600 group-hover:text-slate-300 shrink-0" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 2: FOOTPRINTS IN LIBRARY */}
              {view === "footprints" && (
                <div className="h-full flex flex-col min-h-0">
                  {/* Library Search Bar */}
                  <div className="p-2.5 sm:p-3 border-b border-slate-800 shrink-0 bg-slate-900/40 flex items-center gap-2.5">
                    <div className="relative flex-1">
                      <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={lang === "ar" ? "بحث في البصمات..." : "Search footprints..."}
                        className="h-8 ps-8 text-xs bg-slate-900 border-slate-700 text-white w-full"
                      />
                    </div>
                    <div className="text-xs font-mono text-slate-400 bg-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-800 shrink-0 font-medium">
                      {filteredFootprints.length} {lang === "ar" ? "بصمة" : "footprints"}
                    </div>
                  </div>

                  {/* Footprints Content */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-3 sm:p-4">
                    {loadingLibrary ? (
                      <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                        <Loader2 className="size-6 animate-spin text-blue-500" />
                        <span className="text-xs font-mono">{lang === "ar" ? "تحميل بصمات المكتبة…" : "Loading footprints…"}</span>
                      </div>
                    ) : filteredFootprints.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-slate-500 text-xs font-mono">
                        {lang === "ar" ? "لا توجد بصمات في هذه المكتبة" : "No footprints found"}
                      </div>
                    ) : (
                      /* Clean Vertical List View */
                      <div className="divide-y divide-slate-800/80 rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
                        {filteredFootprints.map((entry) => (
                          <FootprintListItemRow
                            key={entry.path}
                            entry={entry}
                            library={library}
                            selectionOnly={selectionOnly}
                            onInspect={(model) => handleInspect(model)}
                            onSelect={(model) => handleSelectFootprint(model)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 3: INSPECT FOOTPRINT PREVIEW */}
              {view === "preview" && selected && (
                <div className="h-full flex flex-col min-h-0">
                  {/* Responsive Viewport with Layer Toggles */}

                  {/* Responsive Viewport with Layer Toggles */}
                  <div className="flex-1 min-h-0 overflow-y-auto p-2.5 sm:p-4 grid grid-cols-1 md:grid-cols-[1fr_320px] gap-3 sm:gap-4">
                    {/* Visual Stage + Layer Toggles on the Left */}
                    <div className="flex flex-row gap-2.5 min-h-[240px]" dir="ltr">
                      {/* Attached Layer Toggles on the Left */}
                      <div className="shrink-0 flex flex-col justify-start">
                        <FootprintLayerToggles
                          visibility={layerVisibility}
                          onChange={setLayerVisibility}
                          orientation="vertical"
                        />
                      </div>

                      {/* Canvas Container */}
                      <div className="flex-1 min-h-[220px] rounded-xl bg-slate-950 border border-slate-800 p-2 sm:p-4 flex items-center justify-center relative overflow-hidden shadow-inner">
                        <FootprintPreview
                          footprint={selected}
                          layerVisibility={layerVisibility}
                          className="w-full h-full"
                        />
                        <div className="absolute top-2 start-2 text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/90 border border-slate-800 text-slate-300">
                          {(() => {
                            const b = nativeFootprintBounds(selected);
                            const w = Math.max(0, b.maxX - b.minX);
                            const h = Math.max(0, b.maxY - b.minY);
                            return `${w.toFixed(2)} × ${h.toFixed(2)} mm`;
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Details & Action Button */}
                    <div className="flex flex-col justify-between border border-slate-800 rounded-xl bg-slate-900/60 p-3 sm:p-4 space-y-3 sm:space-y-4">
                      <div className="space-y-3">
                        <div>
                          <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            {lang === "ar" ? "المواصفات الهندسية" : "Footprint Specs"}
                          </div>
                          <div className="font-mono text-xs sm:text-sm font-bold text-white mt-0.5 break-all">
                            {selected.name}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                            <div className="text-[10px] text-slate-400">{lang === "ar" ? "عدد الأرجل" : "Pad count"}</div>
                            <div className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5 font-mono">
                              {selected && ("GetPads" in selected ? (selected as any).GetPads().length : selected.pads?.length ?? 0)}
                            </div>
                          </div>

                          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                            <div className="text-[10px] text-slate-400">{lang === "ar" ? "نوع التركيب" : "Mounting"}</div>
                            <div className="text-xs sm:text-sm font-bold text-slate-200 mt-0.5">
                              {selected && classifyFootprintMountingType("GetRenderModel" in selected ? (selected as any).GetRenderModel() : selected)}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-2 border-t border-slate-800">
                        <Button
                          size="lg"
                          className="w-full h-10 sm:h-11 text-xs sm:text-sm font-bold gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-900/20 active:scale-[0.99] transition-transform"
                          onClick={() => {
                            const full = "GetRenderModel" in selected ? (selected as any).GetRenderModel() : selected;
                            handleSelectFootprint(full);
                          }}
                        >
                          <Download className="size-4" />
                          <span>
                            {selectionOnly
                              ? lang === "ar"
                                ? "تعيين هذه البصمة للعنصر"
                                : "Assign This Footprint"
                              : lang === "ar"
                              ? "استيراد وإضافة للوحة (PCB)"
                              : "Import to PCB"}
                          </span>
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
