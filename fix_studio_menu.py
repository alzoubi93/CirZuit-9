import sys

with open("src/components/editor/ThreeDPreview.tsx", "r") as f:
    content = f.read()

# 1. Add state for showStudioMenu
target_state = "const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);"
replacement_state = "const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);\n  const [showStudioMenu, setShowStudioMenu] = useState<boolean>(false);"
if target_state in content:
    content = content.replace(target_state, replacement_state)

# 2. Add Sliders or similar icon import
target_import = "Palette,\n  Play,"
replacement_import = "Palette,\n  Sliders,\n  Play,"
if target_import in content:
    content = content.replace(target_import, replacement_import)

# 3. Replace Middle / Dropdown filters with a single Studio button
target_ui = """        {/* Middle / Dropdown filters */}
        <div className="flex items-center gap-2">
          {/* Solder Mask Color Dropdown */}
          <div className="relative">
            <select
              aria-label={isAr ? "لون قناع اللحام" : "Solder Mask Color"}
              value={maskColor}
              onChange={(e) => setMaskColor(e.target.value)}
              className="h-8 pl-2 pr-7 text-xs bg-slate-800/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500/70 appearance-none cursor-pointer"
            >
              {Object.entries(MASK_COLORS).map(([key, val]) => (
                <option key={key} value={key} className="bg-slate-900 text-slate-200">
                  {val.name}
                </option>
              ))}
            </select>
            <Palette className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>

          {/* HDRI Environment Dropdown */}
          <div className="relative hidden xl:block">
            <select
              aria-label={isAr ? "إضاءة البيئة" : "Environment Lighting"}
              value={envPreset}
              onChange={(e) => setEnvPreset(e.target.value)}
              className="h-8 pl-2 pr-7 text-xs bg-slate-800/80 border border-slate-700/80 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500/70 appearance-none cursor-pointer"
            >
              {["sunset", "dawn", "night", "studio", "warehouse", "forest", "apartment", "city", "park", "lobby"].map((p) => (
                <option key={p} value={p} className="bg-slate-900 text-slate-200">
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </option>
              ))}
            </select>
            <Sun className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          </div>
        </div>"""

replacement_ui = """        {/* Middle / Dropdown filters */}
        <div className="flex items-center gap-2">
          {/* Studio Options Dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setShowStudioMenu(!showStudioMenu); setShowLayerMenu(false); }}
              className="h-8 gap-1.5 bg-slate-800/80 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span className="text-xs">{isAr ? "استوديو العرض" : "Studio"}</span>
            </Button>
            {showStudioMenu && (
              <div className="absolute top-10 left-1/2 -translate-x-1/2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-3 z-50 flex flex-col gap-3">
                <div className="text-[11px] font-semibold text-slate-400 border-b border-slate-800 pb-2">
                  {isAr ? "إعدادات الاستوديو" : "Studio Settings"}
                </div>
                
                {/* Board Color Setting */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-300 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-emerald-400" />
                    {isAr ? "لون قناع اللحام (اللوحة)" : "Board Color (Solder Mask)"}
                  </label>
                  <select
                    aria-label={isAr ? "لون قناع اللحام" : "Solder Mask Color"}
                    value={maskColor}
                    onChange={(e) => setMaskColor(e.target.value)}
                    className="h-8 px-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 w-full"
                  >
                    {Object.entries(MASK_COLORS).map(([key, val]) => (
                      <option key={key} value={key} className="bg-slate-900 text-slate-200">
                        {val.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Lighting Setting */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-slate-300 flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    {isAr ? "إضاءة البيئة (HDRI)" : "Environment Lighting"}
                  </label>
                  <select
                    aria-label={isAr ? "إضاءة البيئة" : "Environment Lighting"}
                    value={envPreset}
                    onChange={(e) => setEnvPreset(e.target.value)}
                    className="h-8 px-2 text-xs bg-slate-800 border border-slate-700 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500 w-full"
                  >
                    {["sunset", "dawn", "night", "studio", "warehouse", "forest", "apartment", "city", "park", "lobby"].map((p) => (
                      <option key={p} value={p} className="bg-slate-900 text-slate-200">
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>"""

if target_ui in content:
    content = content.replace(target_ui, replacement_ui)
else:
    print("UI TARGET NOT FOUND")

# We should also hide showLayerMenu when showStudioMenu is toggled, and vice versa.
target_layer_btn = """onClick={() => setShowLayerMenu(!showLayerMenu)}"""
replacement_layer_btn = """onClick={() => { setShowLayerMenu(!showLayerMenu); setShowStudioMenu(false); }}"""
if target_layer_btn in content:
    content = content.replace(target_layer_btn, replacement_layer_btn)

with open("src/components/editor/ThreeDPreview.tsx", "w") as f:
    f.write(content)

print("Studio menu added")
