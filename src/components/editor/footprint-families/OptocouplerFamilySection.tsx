import React from "react";
import { Input } from "@/components/ui/input";
import {
  STANDARD_SMD_OPTOCOUPLER_PACKAGES,
  QUICK_STANDARD_THT_OPTOCOUPLER_PACKAGES,
} from "@/lib/kicad/generator/families/optocoupler";

interface Props {
  genParams: Record<string, any>;
  updateGenParams: (params: Record<string, any>) => void;
  updateGenParam: (key: string, value: any) => void;
  lang: "ar" | "en";
}

export const OptocouplerFamilySection: React.FC<Props> = ({
  genParams,
  updateGenParams,
  updateGenParam,
  lang,
}) => {
  const isTht =
    genParams.mounting === "THT" ||
    (genParams.packageType &&
      (genParams.packageType.toLowerCase().includes("tht") ||
        genParams.packageType.includes("DIP-") ||
        genParams.packageType.includes("SIP-") ||
        genParams.packageType.includes("Interrupter")));

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
          <span>{lang === "ar" ? "نوع العازل الضوئي والمستشعر" : "Optocoupler & Isolator Type"}</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "opto_dip", label: "DIP Opto", desc: "4/6/8-Pin Classic Isolator" },
            { id: "opto_wide", label: "Wide DIP", desc: "High Clearance Mains Isolation" },
            { id: "opto_smd", label: "SMD Gullwing", desc: "PC817S / 4N35S Surface Mount" },
            { id: "opto_soic", label: "SOP / SOIC", desc: "TLP291 Mini-Flat / Dual Channel" },
            { id: "opto_slot", label: "Slot Interrupter", desc: "Optical Barrier Photo Interrupter" },
          ].map((item) => {
            const isSelected = (genParams.technologyType || (isTht ? "opto_dip" : "opto_smd")) === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "opto_dip") {
                    updateGenParams({
                      technologyType: "opto_dip",
                      mounting: "THT",
                      packageType: "Optocoupler_DIP-4",
                      packageSize: "Optocoupler_DIP-4",
                      rowSpacing: 7.62,
                      value: "PC817",
                    });
                  } else if (item.id === "opto_wide") {
                    updateGenParams({
                      technologyType: "opto_wide",
                      mounting: "THT",
                      packageType: "Optocoupler_DIP-4_Wide",
                      packageSize: "Optocoupler_DIP-4_Wide",
                      rowSpacing: 10.16,
                      value: "PC817_Wide",
                    });
                  } else if (item.id === "opto_smd") {
                    updateGenParams({
                      technologyType: "opto_smd",
                      mounting: "SMD",
                      packageType: "Optocoupler_SMD-4",
                      packageSize: "Optocoupler_SMD-4",
                      value: "PC817S",
                    });
                  } else if (item.id === "opto_soic") {
                    updateGenParams({
                      technologyType: "opto_soic",
                      mounting: "SMD",
                      packageType: "Optocoupler_SOIC-4",
                      packageSize: "Optocoupler_SOIC-4",
                      value: "TLP291",
                    });
                  } else if (item.id === "opto_slot") {
                    updateGenParams({
                      technologyType: "opto_slot",
                      mounting: "THT",
                      packageType: "Opto_Interrupter_Slot",
                      packageSize: "Opto_Interrupter_Slot",
                      value: "ITR9608",
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
                packageType: "Optocoupler_DIP-4",
                packageSize: "Optocoupler_DIP-4",
                rowSpacing: 7.62,
                pitch: 2.54,
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
                packageType: "Optocoupler_SMD-4",
                packageSize: "Optocoupler_SMD-4",
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
      {!isTht ? (
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
            <span>{lang === "ar" ? "العوازل الضوئية السطحية القياسية" : "Standard SMD Optocoupler Packages"}</span>
          </label>
          <select
            className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white cursor-pointer"
            value={STANDARD_SMD_OPTOCOUPLER_PACKAGES.some((p) => p.id === genParams.packageSize) ? genParams.packageSize : ""}
            onChange={(e) => {
              const id = e.target.value;
              const found = STANDARD_SMD_OPTOCOUPLER_PACKAGES.find((p) => p.id === id);
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
              -- Select Standard SMD Package... --
            </option>
            {STANDARD_SMD_OPTOCOUPLER_PACKAGES.map((pkg) => (
              <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                {pkg.name} - {pkg.desc}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Quick 8 THT Standard Buttons & Dropdown */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                <span>Quick Standard Packages</span>
              </span>
            </div>
            <select
              className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
              value={QUICK_STANDARD_THT_OPTOCOUPLER_PACKAGES.some((p) => p.id === genParams.packageSize) ? genParams.packageSize : ""}
              onChange={(e) => {
                const id = e.target.value;
                const found = QUICK_STANDARD_THT_OPTOCOUPLER_PACKAGES.find((p) => p.id === id);
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
                -- Select Quick Standard Package... --
              </option>
              {QUICK_STANDARD_THT_OPTOCOUPLER_PACKAGES.map((pkg) => (
                <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                  {pkg.name} - {pkg.desc}
                </option>
              ))}
            </select>
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
              <span className="text-[10px] font-mono opacity-80">{isCustom ? "Active" : "Click to edit"}</span>
            </button>
          </div>

          {isCustom && (
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400">
                    {lang === "ar" ? "تباعد الصفين Row Spacing (mm)" : "Row Spacing (mm)"}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                    value={genParams.rowSpacing ?? 7.62}
                    onChange={(e) => updateGenParam("rowSpacing", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400">
                    {lang === "ar" ? "تباعد الأرجل Pitch (mm)" : "Pin Pitch (mm)"}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                    value={genParams.pitch ?? 2.54}
                    onChange={(e) => updateGenParam("pitch", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-semibold text-slate-400">
                    {lang === "ar" ? "عدد الأطراف Pin Count" : "Pin Count"}
                  </label>
                  <Input
                    type="number"
                    step="2"
                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                    value={genParams.pinCount ?? 4}
                    onChange={(e) => updateGenParam("pinCount", parseInt(e.target.value, 10) || 4)}
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
