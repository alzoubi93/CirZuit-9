import React from "react";
import { Check, Layers } from "lucide-react";
import { useI18n } from "../../i18n";

export interface LayerToggleConfig {
  key: string;
  label: string;
  labelAr?: string;
  color: string;
  activeColor: string;
}

export const FOOTPRINT_LAYERS: LayerToggleConfig[] = [
  {
    key: "F.silkscreen",
    label: "F.SilkS",
    labelAr: "طباعة الحرير",
    color: "text-amber-400",
    activeColor: "bg-amber-500/15 border-amber-500/40 text-amber-300",
  },
  {
    key: "F.fab",
    label: "F.Fab",
    labelAr: "هيكل التصنيع",
    color: "text-blue-400",
    activeColor: "bg-blue-500/15 border-blue-500/40 text-blue-300",
  },
  {
    key: "F.courtyard",
    label: "F.CrtYd",
    labelAr: "حرم الأمان",
    color: "text-purple-400",
    activeColor: "bg-purple-500/15 border-purple-500/40 text-purple-300",
  },
  {
    key: "Reference",
    label: "Reference",
    labelAr: "رمز المرجع",
    color: "text-emerald-400",
    activeColor: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300",
  },
  {
    key: "Value",
    label: "Value",
    labelAr: "القيمة / الاسم",
    color: "text-cyan-400",
    activeColor: "bg-cyan-500/15 border-cyan-500/40 text-cyan-300",
  },
  {
    key: "body fill",
    label: "Body Fill",
    labelAr: "تعبئة الجسم",
    color: "text-rose-400",
    activeColor: "bg-rose-500/15 border-rose-500/40 text-rose-300",
  },
];

export const DEFAULT_LAYER_VISIBILITY: Record<string, boolean> = {
  "F.silkscreen": true,
  "F.fab": true,
  "F.courtyard": true,
  Reference: true,
  Value: true,
  "body fill": true,
};

interface FootprintLayerTogglesProps {
  visibility: Record<string, boolean>;
  onChange: (visibility: Record<string, boolean>) => void;
  orientation?: "horizontal" | "vertical" | "auto";
  className?: string;
}

export function FootprintLayerToggles({
  visibility,
  onChange,
  orientation = "auto",
  className = "",
}: FootprintLayerTogglesProps) {
  const { lang } = useI18n();

  const toggleLayer = (key: string) => {
    onChange({
      ...visibility,
      [key]: visibility[key] === false ? true : false,
    });
  };

  const isChecked = (key: string) => visibility[key] !== false;

  const orientationClasses =
    orientation === "vertical"
      ? "flex flex-col gap-1.5"
      : orientation === "horizontal"
      ? "flex flex-wrap items-center gap-1.5"
      : "flex flex-col gap-1.5";

  return (
    <div
      className={`p-2 rounded-xl bg-slate-900/90 border border-slate-800/90 backdrop-blur-md shadow-sm select-none ${orientationClasses} ${className}`}
    >
      <div className="flex items-center gap-1.5 px-1 py-0.5 text-[10px] font-mono font-semibold text-slate-400 border-b border-slate-800/60 pb-1 mb-0.5 w-full flex">
        <Layers className="size-3 text-blue-400" />
        <span>{lang === "ar" ? "الطبقات" : "Layers"}</span>
      </div>
      {FOOTPRINT_LAYERS.map((layer) => {
        const checked = isChecked(layer.key);
        return (
          <button
            key={layer.key}
            type="button"
            onClick={() => toggleLayer(layer.key)}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono transition-all border shrink-0 text-start ${
              checked
                ? `${layer.activeColor} shadow-xs font-semibold`
                : "bg-slate-950/60 border-slate-800/80 text-slate-500 hover:text-slate-400 hover:border-slate-700"
            }`}
            title={`Toggle ${layer.label} layer`}
          >
            <span
              className={`size-3.5 rounded flex items-center justify-center border transition-colors shrink-0 ${
                checked
                  ? "bg-blue-600 border-blue-500 text-white"
                  : "border-slate-700 bg-slate-900 text-transparent"
              }`}
            >
              <Check className="size-2.5 stroke-[3]" />
            </span>
            <span className="whitespace-nowrap">{layer.label}</span>
          </button>
        );
      })}
    </div>
  );
}
