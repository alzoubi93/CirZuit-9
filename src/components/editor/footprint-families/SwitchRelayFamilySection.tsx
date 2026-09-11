import React from "react";
import { Input } from "@/components/ui/input";
import {
  STANDARD_SMD_SWITCH_PACKAGES,
  QUICK_STANDARD_THT_SWITCH_PACKAGES,
  MORE_STANDARD_THT_SWITCH_PACKAGES,
} from "@/lib/kicad/generator/families/switchRelay";

interface Props {
  genParams: Record<string, any>;
  updateGenParams: (params: Record<string, any>) => void;
  updateGenParam: (key: string, value: any) => void;
  lang: "ar" | "en";
}

export const SwitchRelayFamilySection: React.FC<Props> = ({
  genParams,
  updateGenParams,
  updateGenParam,
  lang,
}) => {
  const isTht =
    genParams.mounting === "THT" ||
    (genParams.packageType &&
      (genParams.packageType.toLowerCase().includes("tht") ||
        genParams.packageType.includes("Songle") ||
        genParams.packageType.includes("Telecom") ||
        genParams.packageType.includes("DIP_Switch") ||
        genParams.packageType.includes("SlideSwitch") ||
        genParams.packageType.includes("Tactile_12x12") ||
        genParams.packageType === "Tactile_6x6mm_THT"));

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
          <span>{lang === "ar" ? "نوع المفتاح أو المرحل" : "Switch & Relay Type"}</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "tactile", label: "Tactile Switch", desc: "Momentary Push Button" },
            { id: "slide", label: "Slide Switch", desc: "SPDT / DPDT Toggle Slide" },
            { id: "dip", label: "DIP Switch", desc: "Multi-position Config Switch" },
            { id: "relay_power", label: "Power Relay", desc: "Songle SRD / Omron 10A" },
            { id: "relay_signal", label: "Signal Relay", desc: "Telecom DPDT 8-Pin" },
            { id: "pushbutton", label: "Push Button", desc: "Latching / Panel Mount" },
          ].map((item) => {
            const isSelected = (genParams.technologyType || (isTht ? "tactile" : "tactile")) === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "tactile") {
                    updateGenParams({
                      technologyType: "tactile",
                      mounting: isTht ? "THT" : "SMD",
                      packageType: isTht ? "Tactile_6x6mm_THT" : "Tactile_6x6mm_SMD",
                      packageSize: isTht ? "Tactile_6x6mm_THT" : "Tactile_6x6mm_SMD",
                      value: "SW_Push",
                    });
                  } else if (item.id === "slide") {
                    updateGenParams({
                      technologyType: "slide",
                      mounting: isTht ? "THT" : "SMD",
                      packageType: isTht ? "SlideSwitch_SPDT_P2.54mm" : "Slide_SPDT_SMD_PCM12",
                      packageSize: isTht ? "SlideSwitch_SPDT_P2.54mm" : "Slide_SPDT_SMD_PCM12",
                      value: "SW_Slide",
                    });
                  } else if (item.id === "dip") {
                    updateGenParams({
                      technologyType: "dip",
                      mounting: isTht ? "THT" : "SMD",
                      packageType: isTht ? "DIP_Switch_4Pos" : "DIP_Switch_4Pos_SMD",
                      packageSize: isTht ? "DIP_Switch_4Pos" : "DIP_Switch_4Pos_SMD",
                      value: "DIP_4P",
                    });
                  } else if (item.id === "relay_power") {
                    updateGenParams({
                      technologyType: "relay_power",
                      mounting: "THT",
                      packageType: "Relay_SPDT_Songle_SRD",
                      packageSize: "Relay_SPDT_Songle_SRD",
                      value: "Songle_SRD",
                    });
                  } else if (item.id === "relay_signal") {
                    updateGenParams({
                      technologyType: "relay_signal",
                      mounting: "THT",
                      packageType: "Relay_DPDT_Telecom",
                      packageSize: "Relay_DPDT_Telecom",
                      value: "Relay_Telecom",
                    });
                  } else if (item.id === "pushbutton") {
                    updateGenParams({
                      technologyType: "pushbutton",
                      mounting: "THT",
                      packageType: "Pushbutton_12x12mm_THT",
                      packageSize: "Pushbutton_12x12mm_THT",
                      value: "SW_12x12",
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
                packageType: "Tactile_6x6mm_THT",
                packageSize: "Tactile_6x6mm_THT",
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
                packageType: "Tactile_6x6mm_SMD",
                packageSize: "Tactile_6x6mm_SMD",
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
          <label className="text-[10px] font-semibold text-slate-300 mb-1.5 block">
            {lang === "ar" ? "حزم المفاتيح السطحية القياسية" : "Standard SMD Switch Packages"}
          </label>
          <select
            className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
            value={STANDARD_SMD_SWITCH_PACKAGES.some((p) => p.id === genParams.packageSize) ? genParams.packageSize : ""}
            onChange={(e) => {
              const id = e.target.value;
              const found = STANDARD_SMD_SWITCH_PACKAGES.find((p) => p.id === id);
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
              -- Select SMD Switch Package... --
            </option>
            {STANDARD_SMD_SWITCH_PACKAGES.map((pkg) => (
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
                QUICK_STANDARD_THT_SWITCH_PACKAGES.some((p) => p.id === genParams.packageSize) 
                  ? genParams.packageSize 
                  : MORE_STANDARD_THT_SWITCH_PACKAGES.some((p) => p.id === genParams.packageSize)
                    ? genParams.packageSize
                    : ""
              }
              onChange={(e) => {
                const id = e.target.value;
                if (!id) return;
                const found = [...QUICK_STANDARD_THT_SWITCH_PACKAGES, ...MORE_STANDARD_THT_SWITCH_PACKAGES].find((p) => p.id === id);
                if (found) {
                  updateGenParams({
                    packageType: found.id,
                    packageSize: found.id,
                    mounting: "THT",
                    value: found.name.split(" ")[0],
                  });
                }
              }}
            >
              <option value="" disabled className="text-slate-500">
                -- Select Standard Package... --
              </option>
              <optgroup label="Quick Standard Packages" className="bg-slate-950 text-teal-400 font-bold">
                {QUICK_STANDARD_THT_SWITCH_PACKAGES.map((pkg) => (
                  <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                    {pkg.name} - {(pkg as any).desc}
                  </option>
                ))}
              </optgroup>
              <optgroup label="More Standard Packages" className="bg-slate-950 text-blue-400 font-bold">
                {MORE_STANDARD_THT_SWITCH_PACKAGES.map((pkg) => (
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
                    {lang === "ar" ? "تباعد الأرجل X Pitch (mm)" : "Lead Spacing X (mm)"}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                    value={genParams.pitchX ?? 6.5}
                    onChange={(e) => updateGenParam("pitchX", parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-slate-400">
                    {lang === "ar" ? "تباعد الأرجل Y Pitch (mm)" : "Lead Spacing Y (mm)"}
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                    value={genParams.pitchY ?? 4.5}
                    onChange={(e) => updateGenParam("pitchY", parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
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
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
