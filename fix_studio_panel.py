import sys

with open("src/components/editor/ThreeDPreview.tsx", "r") as f:
    content = f.read()

target_ui = """        {/* Middle / Dropdown filters */}
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
              <span className="text-xs hidden sm:inline">{isAr ? "استوديو العرض" : "Studio"}</span>
            </Button>
            {showStudioMenu && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl p-4 z-50 flex flex-col gap-5">
                <div className="text-xs font-semibold text-slate-300 border-b border-slate-800/80 pb-2 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  {isAr ? "إعدادات الاستوديو المتقدمة" : "Advanced Studio Settings"}
                </div>
                
                {/* Board Color Setting */}
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-indigo-400" />
                    {isAr ? "لون قناع اللحام (اللوحة)" : "Board Solder Mask Color"}
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {Object.entries(MASK_COLORS).map(([key, val]) => (
                      <button
                        key={key}
                        onClick={() => setMaskColor(key)}
                        title={val.name}
                        className={`w-full aspect-square rounded-full flex items-center justify-center transition-all ${maskColor === key ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110 border border-white/10'}`}
                        style={{ backgroundColor: val.top }}
                      />
                    ))}
                  </div>
                </div>

                {/* Lighting Setting */}
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    {isAr ? "إضاءة البيئة (HDRI)" : "Environment Lighting"}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {["sunset", "dawn", "night", "studio", "warehouse", "forest", "apartment", "city", "park"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setEnvPreset(p)}
                        className={`px-2 py-1.5 text-[10px] sm:text-xs rounded-lg transition-colors border ${envPreset === p ? 'bg-amber-500/20 text-amber-300 border-amber-500/50' : 'bg-slate-800/50 text-slate-400 border-slate-700/50 hover:bg-slate-700'}`}
                      >
                        {isAr ? (p === "sunset" ? "غروب" : p === "dawn" ? "فجر" : p === "night" ? "ليل" : p === "studio" ? "استوديو" : p === "warehouse" ? "مستودع" : p === "forest" ? "غابة" : p === "apartment" ? "شقة" : p === "city" ? "مدينة" : "حديقة") : (p.charAt(0).toUpperCase() + p.slice(1))}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>"""

if target_ui in content:
    content = content.replace(target_ui, replacement_ui)
    print("Replaced UI")
else:
    print("Target UI not found")

target_layers = """              <Layers className="w-3.5 h-3.5" />
              <span className="text-xs hidden md:inline">{isAr ? "الطبقات" : "Layers"}</span>
            </Button>"""

replacement_layers = """              <Layers className="w-3.5 h-3.5" />
              <span className="text-xs hidden sm:inline">{isAr ? "الطبقات" : "Layers"}</span>
            </Button>"""

if target_layers in content:
    content = content.replace(target_layers, replacement_layers)
    print("Replaced Layers button")
else:
    print("Layers not found")

with open("src/components/editor/ThreeDPreview.tsx", "w") as f:
    f.write(content)

