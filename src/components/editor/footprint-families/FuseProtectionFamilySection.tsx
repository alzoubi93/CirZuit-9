import React from "react";
import { Input } from "@/components/ui/input";
import {
  STANDARD_SMD_FUSE_PACKAGES,
  QUICK_STANDARD_THT_FUSE_PACKAGES,
  MORE_STANDARD_THT_FUSE_PACKAGES,
} from "@/lib/kicad/generator/families/fuseProtection";

interface Props {
  genParams: Record<string, any>;
  updateGenParams: (params: Record<string, any>) => void;
  updateGenParam: (key: string, value: any) => void;
  lang: "ar" | "en";
}

export const FuseProtectionFamilySection: React.FC<Props> = ({
  genParams,
  updateGenParams,
  updateGenParam,
  lang,
}) => {
  const isTht =
    genParams.mounting === "THT" ||
    (genParams.packageType &&
      (genParams.packageType.toLowerCase().includes("tht") ||
        genParams.packageType.includes("Fuseholder_") ||
        genParams.packageType.includes("Radial_PTC") ||
        genParams.packageType.includes("Varistor_") ||
        genParams.packageType.includes("GDT_")));

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
          <span>{lang === "ar" ? "نوع عنصر الحماية والصمام" : "Protection & Fuse Technology"}</span>
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { id: "fuse_smd", label: "SMD Fuse / PTC", desc: "Chip Fuse & Resettable PolySwitch" },
            { id: "tvs_smd", label: "TVS Diode", desc: "Transient Voltage Suppressor" },
            { id: "cartridge", label: "Cartridge Fuse", desc: "5x20mm & 6.3x32mm Glass/Ceramic" },
            { id: "ptc_tht", label: "Radial PTC", desc: "PolySwitch Resettable Through-Hole" },
            { id: "varistor", label: "Varistor MOV", desc: "Metal Oxide Surge Absorber" },
            { id: "gdt", label: "Gas Tube (GDT)", desc: "Lightning Spark Gap Arrestor" },
          ].map((item) => {
            const isSelected = (genParams.technologyType || (isTht ? "cartridge" : "fuse_smd")) === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.id === "fuse_smd") {
                    updateGenParams({
                      technologyType: "fuse_smd",
                      mounting: "SMD",
                      packageType: "Fuse_SMD_1206",
                      packageSize: "Fuse_SMD_1206",
                      value: "PTC_1206",
                    });
                  } else if (item.id === "tvs_smd") {
                    updateGenParams({
                      technologyType: "tvs_smd",
                      mounting: "SMD",
                      packageType: "TVS_SMAJ",
                      packageSize: "TVS_SMAJ",
                      value: "SMAJ5.0A",
                    });
                  } else if (item.id === "cartridge") {
                    updateGenParams({
                      technologyType: "cartridge",
                      mounting: "THT",
                      packageType: "Fuseholder_5x20mm_THT",
                      packageSize: "Fuseholder_5x20mm_THT",
                      pitch: 22.6,
                      drill: 1.6,
                      padSize: 3.0,
                      value: "Fuse_5x20mm",
                    });
                  } else if (item.id === "ptc_tht") {
                    updateGenParams({
                      technologyType: "ptc_tht",
                      mounting: "THT",
                      packageType: "Radial_PTC_P5.08mm",
                      packageSize: "Radial_PTC_P5.08mm",
                      pitch: 5.08,
                      drill: 0.9,
                      padSize: 1.8,
                      value: "PTC_5.08mm",
                    });
                  } else if (item.id === "varistor") {
                    updateGenParams({
                      technologyType: "varistor",
                      mounting: "THT",
                      packageType: "Varistor_MOV_7D",
                      packageSize: "Varistor_MOV_7D",
                      pitch: 5.0,
                      value: "MOV_07D",
                    });
                  } else if (item.id === "gdt") {
                    updateGenParams({
                      technologyType: "gdt",
                      mounting: "THT",
                      packageType: "GDT_2Pin_P5mm",
                      packageSize: "GDT_2Pin_P5mm",
                      pitch: 5.0,
                      value: "GDT_5mm",
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
                packageType: "Fuseholder_5x20mm_THT",
                packageSize: "Fuseholder_5x20mm_THT",
                pitch: 22.6,
                drill: 1.6,
                padSize: 3.0,
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
                packageType: "Fuse_SMD_1206",
                packageSize: "Fuse_SMD_1206",
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
            className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
            value={
              QUICK_STANDARD_THT_FUSE_PACKAGES.some((p) => p.id === genParams.packageSize)
                ? genParams.packageSize
                : MORE_STANDARD_THT_FUSE_PACKAGES.some((p) => p.id === genParams.packageSize)
                  ? genParams.packageSize
                  : ""
            }
            onChange={(e) => {
              const id = e.target.value;
              const found = [...QUICK_STANDARD_THT_FUSE_PACKAGES, ...MORE_STANDARD_THT_FUSE_PACKAGES].find((p) => p.id === id);
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
              -- Select Package... --
            </option>
            <optgroup label="Quick Standard Packages" className="bg-slate-950 text-teal-400 font-bold">
              {QUICK_STANDARD_THT_FUSE_PACKAGES.map((pkg) => (
                <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                  {pkg.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="More Standard Packages" className="bg-slate-950 text-blue-400 font-bold">
              {MORE_STANDARD_THT_FUSE_PACKAGES.map((pkg) => (
                <option key={pkg.id} value={pkg.id} className="bg-slate-900 text-slate-100 py-1 font-mono">
                  {pkg.name}
                </option>
              ))}
            </optgroup>
          </select>
        ) : (
          <select
            className="w-full h-8 rounded-md border border-slate-700 bg-slate-900 px-2 text-xs font-mono text-white mb-2 cursor-pointer"
            value={STANDARD_SMD_FUSE_PACKAGES.some((p) => p.id === genParams.packageSize) ? genParams.packageSize : ""}
            onChange={(e) => {
              const id = e.target.value;
              const found = STANDARD_SMD_FUSE_PACKAGES.find((p) => p.id === id);
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
              -- Select Package... --
            </option>
            {STANDARD_SMD_FUSE_PACKAGES.map((pkg) => (
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
                {lang === "ar" ? "تباعد الأرجل Pitch (mm)" : "Lead Spacing Pitch (mm)"}
              </label>
              <Input
                type="number"
                step="0.01"
                className="h-8 text-xs font-mono bg-slate-950 border-slate-700 text-white mt-1"
                value={genParams.pitch ?? 5.08}
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
                value={genParams.padSize ?? 2.0}
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
                value={genParams.bodyLength ?? 10.0}
                onChange={(e) => updateGenParam("bodyLength", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
