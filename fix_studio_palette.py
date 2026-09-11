import sys

with open("src/components/editor/ThreeDPreview.tsx", "r") as f:
    content = f.read()

target = """                {/* Lighting Setting */}"""

replacement = """                {/* Solder Color Setting */}
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-zinc-400" />
                    {isAr ? "لون اللحام" : "Solder Color"}
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { val: "#c0c0c0", name: "Silver" },
                      { val: "#d4af37", name: "Gold" },
                      { val: "#a8a8a8", name: "Matte Lead" },
                      { val: "#e5e4e2", name: "Platinum" },
                      { val: "#b87333", name: "Copper" }
                    ].map((c) => (
                      <button
                        key={c.val}
                        onClick={() => setSolderColor(c.val)}
                        title={c.name}
                        className={`w-full aspect-square rounded-full flex items-center justify-center transition-all ${solderColor === c.val ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110 border border-white/10'}`}
                        style={{ backgroundColor: c.val }}
                      />
                    ))}
                  </div>
                </div>

                {/* Track Color Setting */}
                <div className="flex flex-col gap-3">
                  <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-orange-400" />
                    {isAr ? "لون المسارات النحاسية" : "Track Color"}
                  </label>
                  <div className="grid grid-cols-5 gap-2">
                    {[
                      { val: COPPER_COLOR, name: "Natural Copper" },
                      { val: "#d4af37", name: "Gold Plated" },
                      { val: "#c0c0c0", name: "Tin Plated" },
                      { val: "#1a1a1a", name: "Carbon" },
                      { val: "#e5e4e2", name: "Platinum" }
                    ].map((c) => (
                      <button
                        key={c.val}
                        onClick={() => setTrackColor(c.val)}
                        title={c.name}
                        className={`w-full aspect-square rounded-full flex items-center justify-center transition-all ${trackColor === c.val ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'hover:scale-110 border border-white/10'}`}
                        style={{ backgroundColor: c.val }}
                      />
                    ))}
                  </div>
                </div>

                {/* Lighting Setting */}"""

content = content.replace(target, replacement)

with open("src/components/editor/ThreeDPreview.tsx", "w") as f:
    f.write(content)
print("Updated Studio Palette")
