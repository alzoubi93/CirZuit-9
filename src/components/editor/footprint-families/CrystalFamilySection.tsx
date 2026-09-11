import React from "react";
import { Input } from "@/components/ui/input";
import {
  STANDARD_SMD_CRYSTAL_PACKAGES,
  QUICK_STANDARD_THT_CRYSTAL_PACKAGES,
  MORE_STANDARD_THT_CRYSTAL_PACKAGES,
} from "@/lib/kicad/generator/families/crystal";

interface Props {
  genParams: Record<string, any>;
  updateGenParams: (params: Record<string, any>) => void;
  updateGenParam: (key: string, value: any) => void;
  lang: "ar" | "en";
}

export const CrystalFamilySection: React.FC<Props> = ({
  genParams,
  updateGenParams,
  updateGenParam,
  lang,
}) => {
  const isTht =
    genParams.mounting === "THT" ||
    (genParams.packageType &&
      (genParams.packageType.toLowerCase().includes("tht") ||
        genParams.packageType.includes("HC-49/U") ||
        genParams.packageType.includes("HC-49/US") && !genParams.packageType.includes("SMD") ||
        genParams.packageType.includes("Cylinder") ||
        genParams.packageType.includes("DIP")));

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
          <span>{lang === "ar" ? "نوع البلورة والمذبذب" : "Crystal & Oscillator Type"}</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "smd_4pad", label: "SMD 4-Pad", desc: "Standard SMD Quartz 4-Pin" },
            { id: "smd_2pad", label: "SMD 2-Pad", desc: "Compact 2-Terminal Quartz" },
            { id: "can", label: "HC-49 Quartz", desc: "HC-49/US Metal Can" },
            { id: "tuning_fork", label: "32.768kHz RTC", desc: "Tuning Fork Watch Crystal" },
            { id: "oscillator", label: "Active Osc", desc: "Powered Clock Oscillator" },
            { id: "resonator", label: "Ceramic Res", desc: "3-Pin Built-in Caps" },
          ].map((item) => {
            const isSelected = (genParams.technologyType || (isTht ? "can" : "smd_4pad")) === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "can") {
                    updateGenParams({
                      technologyType: "can",
                      mounting: "THT",
                      packageType: "HC-49/US",
                      packageSize: "HC-49/US",
                      pitch: 4.88,
                      drill: 0.8,
                      padSize: 1.6,
                      value: "16MHz",
                    });
                  } else if (item.id === "tuning_fork") {
                    const defaultFork = isTht ? "Cylinder_D2x6mm" : "SMD-3215-2P";
                    updateGenParams({
                      technologyType: "tuning_fork",
                      packageType: defaultFork,
                      packageSize: defaultFork,
                      value: "32.768kHz",
                    });
                  } else if (item.id === "oscillator") {
                    const defaultOsc = isTht ? "DIP-8_Oscillator" : "SMD-5032";
                    updateGenParams({
                      technologyType: "oscillator",
                      packageType: defaultOsc,
                      packageSize: defaultOsc,
                      value: "OSC_25MHz",
                    });
                  } else if (item.id === "resonator") {
                    updateGenParams({
                      technologyType: "resonator",
                      mounting: isTht ? "THT" : "SMD",
                      packageType: isTht ? "Resonator_3Pin_P2.54mm" : "SMD-3213-3P",
                      packageSize: isTht ? "Resonator_3Pin_P2.54mm" : "SMD-3213-3P",
                      value: "CSTCE_16MHz",
                    });
                  } else if (item.id === "smd_2pad") {
                    updateGenParams({
                      technologyType: "smd_2pad",
                      mounting: "SMD",
                      packageType: "SMD-5032-2P",
                      packageSize: "SMD-5032-2P",
                      value: "Crystal_SMD_2P",
                    });
                  } else if (item.id === "smd_4pad") {
                    updateGenParams({
                      technologyType: "smd_4pad",
                      mounting: "SMD",
                      packageType: "SMD-3225",
                      packageSize: "SMD-3225",
                      value: "Crystal_3225",
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
                packageType: "HC-49/US",
                packageSize: "HC-49/US",
                pitch: 4.88,
                drill: 0.8,
                padSize: 1.6,
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
                packageType: "SMD-3225",
                packageSize: "SMD-3225",
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

      {/* 3. Package Selector (SMD vs THT) */}
      {!isTht ? (
        <div className="space-y-2">
          <label className="text-[10px] font-semibold text-slate-300 flex items-center justify-between mb-1.5">
            <span>{lang === "ar" ? "حزم البلورات السطحية القياسية" : "Standard SMD Crystal Packages"}</span>
          </label>
          <select
            className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
            value={STANDARD_SMD_CRYSTAL_PACKAGES.some((p) => p.id === genParams.packageSize) ? genParams.packageSize : ""}
            onChange={(e) => {
              const id = e.target.value;
              const found = STANDARD_SMD_CRYSTAL_PACKAGES.find((p) => p.id === id);
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
              -- Select SMD Crystal Package... --
            </option>
            {STANDARD_SMD_CRYSTAL_PACKAGES.map((pkg) => (
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
                QUICK_STANDARD_THT_CRYSTAL_PACKAGES.some((p) => p.id === genParams.packageSize) 
                  ? genParams.packageSize 
                  : MORE_STANDARD_THT_CRYSTAL_PACKAGES.some((p) => p.id === genParams.packageSize)
                    ? genParams.packageSize
                    : ""
              }
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                const found = [...QUICK_STANDARD_THT_CRYSTAL_PACKAGES, ...MORE_STANDARD_THT_CRYSTAL_PACKAGES].find((p) => p.id === id);
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
                {QUICK_STANDARD_THT_CRYSTAL_PACKAGES.map((pkg) => (
                  <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                    {pkg.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="More Standard Packages" className="bg-slate-950 text-blue-400 font-bold">
                {MORE_STANDARD_THT_CRYSTAL_PACKAGES.map((pkg) => (
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
                    {lang === "ar" ? "تباعد الأرجل Pitch (mm)" : "Lead Spacing Pitch (mm)"}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                    value={genParams.pitch ?? 4.88}
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
                    {lang === "ar" ? "طول الهيكل Body L (mm)" : "Body Length (mm)"}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                    value={genParams.bodyLength ?? 11.5}
                    onChange={(e) => updateGenParam("bodyLength", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400">
                    {lang === "ar" ? "عرض الهيكل Body W (mm)" : "Body Width (mm)"}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                    value={genParams.bodyWidth ?? 4.9}
                    onChange={(e) => updateGenParam("bodyWidth", parseFloat(e.target.value) || 0)}
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
