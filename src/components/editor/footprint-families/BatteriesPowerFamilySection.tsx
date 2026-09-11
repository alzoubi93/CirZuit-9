import React from "react";
import { Input } from "@/components/ui/input";
import {
  STANDARD_SMD_BATTERY_PACKAGES,
  QUICK_STANDARD_THT_BATTERY_PACKAGES,
  MORE_STANDARD_THT_BATTERY_PACKAGES,
} from "@/lib/kicad/generator/families/batteriesPower";

interface Props {
  genParams: Record<string, any>;
  updateGenParams: (params: Record<string, any>) => void;
  updateGenParam: (key: string, value: any) => void;
  lang: "ar" | "en";
}

export const BatteriesPowerFamilySection: React.FC<Props> = ({
  genParams,
  updateGenParams,
  updateGenParam,
  lang,
}) => {
  const isTht =
    genParams.mounting === "THT" ||
    (genParams.packageType &&
      (genParams.packageType.toLowerCase().includes("tht") ||
        genParams.packageType.includes("18650") ||
        genParams.packageType.includes("AA_") ||
        genParams.packageType.includes("AAA_") ||
        genParams.packageType.includes("XT60") ||
        genParams.packageType.includes("XT30") ||
        genParams.packageType.includes("Terminal_Block") ||
        genParams.packageType.includes("Keystone3002")));

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
          <span>{lang === "ar" ? "نوع البطارية أو مدخل الطاقة" : "Battery & Power Interface Type"}</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "coin_cell", label: "Coin Cell CR2032", desc: "RTC & Backup Battery Holder" },
            { id: "cylindrical", label: "18650 / AA / AAA", desc: "Li-Ion & Alkaline Battery Clips" },
            { id: "dc_jack", label: "DC Barrel Jack", desc: "2.1mm / 2.5mm Power Supply In" },
            { id: "terminal", label: "Screw Terminal", desc: "2P / 3P 5.08mm Wire Terminal" },
            { id: "high_power", label: "XT60 / XT30", desc: "High Current LiPo Connectors" },
          ].map((item) => {
            const isSelected = (genParams.technologyType || (isTht ? "coin_cell" : "coin_cell")) === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "coin_cell") {
                    updateGenParams({
                      technologyType: "coin_cell",
                      mounting: isTht ? "THT" : "SMD",
                      packageType: isTht ? "Battery_CR2032_THT_Keystone3002" : "Battery_CR2032_SMD_Keystone1058",
                      packageSize: isTht ? "Battery_CR2032_THT_Keystone3002" : "Battery_CR2032_SMD_Keystone1058",
                      value: "CR2032",
                    });
                  } else if (item.id === "cylindrical") {
                    updateGenParams({
                      technologyType: "cylindrical",
                      mounting: "THT",
                      packageType: "Battery_18650_Holder_Keystone1042",
                      packageSize: "Battery_18650_Holder_Keystone1042",
                      value: "18650_Holder",
                    });
                  } else if (item.id === "dc_jack") {
                    updateGenParams({
                      technologyType: "dc_jack",
                      mounting: isTht ? "THT" : "SMD",
                      packageType: isTht ? "DC_Barrel_Jack_2.1mm_THT" : "DC_Barrel_Jack_2.1mm_SMD",
                      packageSize: isTht ? "DC_Barrel_Jack_2.1mm_THT" : "DC_Barrel_Jack_2.1mm_SMD",
                      value: "DC_IN_2.1mm",
                    });
                  } else if (item.id === "terminal") {
                    updateGenParams({
                      technologyType: "terminal",
                      mounting: "THT",
                      packageType: "Terminal_Block_2P_5.08mm",
                      packageSize: "Terminal_Block_2P_5.08mm",
                      value: "Screw_Terminal_2P",
                    });
                  } else if (item.id === "high_power") {
                    updateGenParams({
                      technologyType: "high_power",
                      mounting: "THT",
                      packageType: "Connector_Power_XT60_THT",
                      packageSize: "Connector_Power_XT60_THT",
                      value: "XT60",
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
                packageType: "Battery_CR2032_THT_Keystone3002",
                packageSize: "Battery_CR2032_THT_Keystone3002",
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
                packageType: "Battery_CR2032_SMD_Keystone1058",
                packageSize: "Battery_CR2032_SMD_Keystone1058",
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
            <span>{lang === "ar" ? "حوامل البطاريات السطحية القياسية" : "Standard SMD Battery Packages"}</span>
          </label>
          <select
            className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
            value={STANDARD_SMD_BATTERY_PACKAGES.some((p) => p.id === genParams.packageSize) ? genParams.packageSize : ""}
            onChange={(e) => {
              const id = e.target.value;
              const found = STANDARD_SMD_BATTERY_PACKAGES.find((p) => p.id === id);
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
              -- Select SMD Battery Package... --
            </option>
            {STANDARD_SMD_BATTERY_PACKAGES.map((pkg) => (
              <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                {pkg.name} - {pkg.desc}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Quick Standard Packages (Merged THT) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-bold text-teal-300 flex items-center gap-1.5">
                <span>Quick Standard Packages</span>
              </span>
            </div>
            <select
              className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
              value={
                QUICK_STANDARD_THT_BATTERY_PACKAGES.some((p) => p.id === genParams.packageSize) 
                  ? genParams.packageSize 
                  : MORE_STANDARD_THT_BATTERY_PACKAGES.some((p) => p.id === genParams.packageSize)
                    ? genParams.packageSize
                    : ""
              }
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                const found = [...QUICK_STANDARD_THT_BATTERY_PACKAGES, ...MORE_STANDARD_THT_BATTERY_PACKAGES].find((p) => p.id === id);
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
                {QUICK_STANDARD_THT_BATTERY_PACKAGES.map((pkg) => (
                  <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                    {pkg.name} - {pkg.desc}
                  </option>
                ))}
              </optgroup>
              <optgroup label="More Standard Packages" className="bg-slate-950 text-blue-400 font-bold">
                {MORE_STANDARD_THT_BATTERY_PACKAGES.map((pkg) => (
                  <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                    {pkg.name}
                  </option>
                ))}
              </optgroup>
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
                    {lang === "ar" ? "تباعد الأرجل Pitch (mm)" : "Terminal Pitch (mm)"}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                    value={genParams.pitch ?? 20.0}
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
                    value={genParams.drill ?? 1.2}
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
                    value={genParams.padSize ?? 2.5}
                    onChange={(e) => updateGenParam("padSize", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400">
                    {lang === "ar" ? "قطر الهيكل Diameter (mm)" : "Body Diameter (mm)"}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                    value={genParams.diameter ?? 20.0}
                    onChange={(e) => updateGenParam("diameter", parseFloat(e.target.value) || 0)}
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
