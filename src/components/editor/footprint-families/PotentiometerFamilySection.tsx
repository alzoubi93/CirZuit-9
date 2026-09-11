import React from "react";
import { Input } from "@/components/ui/input";
import {
  STANDARD_SMD_POTENTIOMETER_PACKAGES,
  QUICK_STANDARD_THT_POTENTIOMETER_PACKAGES,
  MORE_STANDARD_THT_POTENTIOMETER_PACKAGES,
} from "@/lib/kicad/generator/families/potentiometer";

interface Props {
  genParams: Record<string, any>;
  updateGenParams: (params: Record<string, any>) => void;
  updateGenParam: (key: string, value: any) => void;
  lang: "ar" | "en";
}

export const PotentiometerFamilySection: React.FC<Props> = ({
  genParams,
  updateGenParams,
  updateGenParam,
  lang,
}) => {
  const isTht =
    genParams.mounting === "THT" ||
    (genParams.packageType &&
      (genParams.packageType.toLowerCase().includes("tht") ||
        genParams.packageType.includes("3296") ||
        genParams.packageType.includes("3362") ||
        genParams.packageType.includes("3386") ||
        genParams.packageType.includes("Alpha") ||
        genParams.packageType.includes("Slide") ||
        genParams.packageType.includes("Rotary")));

  const isCustom =
    genParams.packageSize === "custom" ||
    genParams.packageType === "custom" ||
    genParams.packageSize === "Custom" ||
    genParams.packageType === "Custom";

  return (
    <div className="space-y-3.5 border-t border-slate-800 pt-3">
      {/* 1. Category / Technology Filter Grid */}
      <div>
        <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
          <span>{lang === "ar" ? "نوع المقاومة المتغيرة" : "Potentiometer & Trimmer Type"}</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "trimmer_single", label: "Single-Turn", desc: "Bourns 3362P / 3386P Cermet" },
            { id: "trimmer_multi", label: "Multi-Turn", desc: "Precision 3296W / 3296Y" },
            { id: "rotary_panel", label: "Rotary Pot", desc: "Alpha 16mm / Bourns 9mm" },
            { id: "slide_fader", label: "Slide Fader", desc: "Mixer / Console 30/60mm" },
            { id: "smd_trimmer", label: "SMD Trimmer", desc: "Bourns 3314G 4.5mm Micro" },
          ].map((item) => {
            const isSelected = (genParams.technologyType || (isTht ? "trimmer_single" : "smd_trimmer")) === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "trimmer_single") {
                    updateGenParams({
                      technologyType: "trimmer_single",
                      mounting: "THT",
                      packageType: "Potentiometer_Trimmer_3362P",
                      packageSize: "Potentiometer_Trimmer_3362P",
                      value: "10k",
                    });
                  } else if (item.id === "trimmer_multi") {
                    updateGenParams({
                      technologyType: "trimmer_multi",
                      mounting: "THT",
                      packageType: "Potentiometer_Trimmer_3296W",
                      packageSize: "Potentiometer_Trimmer_3296W",
                      value: "10k_Precision",
                    });
                  } else if (item.id === "rotary_panel") {
                    updateGenParams({
                      technologyType: "rotary_panel",
                      mounting: "THT",
                      packageType: "Potentiometer_Rotary_Alpha16mm",
                      packageSize: "Potentiometer_Rotary_Alpha16mm",
                      value: "Alpha_16mm",
                    });
                  } else if (item.id === "slide_fader") {
                    updateGenParams({
                      technologyType: "slide_fader",
                      mounting: "THT",
                      packageType: "Potentiometer_Slide_30mm",
                      packageSize: "Potentiometer_Slide_30mm",
                      value: "Fader_30mm",
                    });
                  } else if (item.id === "smd_trimmer") {
                    updateGenParams({
                      technologyType: "smd_trimmer",
                      mounting: "SMD",
                      packageType: "Potentiometer_Bourns_3314G_SMD",
                      packageSize: "Potentiometer_Bourns_3314G_SMD",
                      value: "3314G",
                    });
                  } else if (item.id === "custom") {
                    if (isSelected) {
                      updateGenParams({ technologyType: "", packageType: "", packageSize: "" });
                    } else {
                      updateGenParams({
                        technologyType: "custom",
                        packageType: "Custom",
                        packageSize: "Custom",
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
                packageType: "Potentiometer_Trimmer_3362P",
                packageSize: "Potentiometer_Trimmer_3362P",
              });
            }}
            className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              isTht
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>THT (ثقبي عبر اللوح)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              updateGenParams({
                mounting: "SMD",
                packageType: "Potentiometer_Bourns_3314G_SMD",
                packageSize: "Potentiometer_Bourns_3314G_SMD",
              });
            }}
            className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
              !isTht
                ? "bg-cyan-600 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>SMD (سطحي SMT)</span>
          </button>
        </div>
      </div>

      {/* 3. Package Selector */}
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                <span>Quick Standard Packages</span>
              </span>
            </div>
        {isTht ? (
          <select
            className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white cursor-pointer"
            value={
              QUICK_STANDARD_THT_POTENTIOMETER_PACKAGES.some((p) => p.id === genParams.packageSize)
                ? genParams.packageSize
                : MORE_STANDARD_THT_POTENTIOMETER_PACKAGES.some((p) => p.id === genParams.packageSize)
                  ? genParams.packageSize
                  : ""
            }
            onChange={(e) => {
              const id = e.target.value;
              const found = [...QUICK_STANDARD_THT_POTENTIOMETER_PACKAGES, ...MORE_STANDARD_THT_POTENTIOMETER_PACKAGES].find((p) => p.id === id);
              if (found) {
                updateGenParams({
                  packageType: found.id,
                  packageSize: found.id,
                  mounting: "THT",
                  value: found.name,
                });
              }
            }}
          >
            <option value="" disabled className="text-slate-500">
              -- Select Standard Package... --
            </option>
            <optgroup label="Quick Standard Packages" className="bg-slate-950 text-teal-400 font-bold">
              {QUICK_STANDARD_THT_POTENTIOMETER_PACKAGES.map((pkg) => (
                <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                  {pkg.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="More Standard Packages" className="bg-slate-950 text-blue-400 font-bold">
              {MORE_STANDARD_THT_POTENTIOMETER_PACKAGES.map((pkg) => (
                <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                  {pkg.name}
                </option>
              ))}
            </optgroup>
          </select>
        ) : (
          <select
            className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white cursor-pointer"
            value={STANDARD_SMD_POTENTIOMETER_PACKAGES.some((p) => p.id === genParams.packageSize) ? genParams.packageSize : ""}
            onChange={(e) => {
              const id = e.target.value;
              const found = STANDARD_SMD_POTENTIOMETER_PACKAGES.find((p) => p.id === id);
              if (found) {
                updateGenParams({
                  packageType: found.id,
                  packageSize: found.id,
                  mounting: "SMD",
                  value: found.name,
                });
              }
            }}
          >
            <option value="" disabled className="text-slate-500">
              -- Select Standard Package... --
            </option>
            {STANDARD_SMD_POTENTIOMETER_PACKAGES.map((pkg) => (
              <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                {pkg.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Custom / Manual Parametric Option */}
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
                mounting: isTht ? "THT" : "SMD",
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
          <span className="text-[10px] font-mono opacity-80">{isCustom ? "Active" : "Click to edit"}</span>
        </button>
      </div>

      {isCustom && (
        <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] font-semibold text-slate-400">
                {lang === "ar" ? "تباعد الأرجل Pitch (mm)" : "Terminal Pitch (mm)"}
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
                value={genParams.drill ?? 0.8}
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
                value={genParams.padSize ?? 1.6}
                onChange={(e) => updateGenParam("padSize", parseFloat(e.target.value) || 0)}
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
                value={genParams.bodyLength ?? 6.8}
                onChange={(e) => updateGenParam("bodyLength", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
