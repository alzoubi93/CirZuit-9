import { useMemo, useState } from "react";
import { ConnectorGeneratorModal } from "./ConnectorGeneratorModal";
import { Cpu, Type, Tag } from "lucide-react";
import type { ConnectorMetadata } from "@/lib/symbols";

import { SYMBOLS, CATEGORY_ORDER } from "@/lib/symbols";
import { SymbolPreview } from "./SymbolPreview";
import { ComponentLibrary } from "./ComponentLibrary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LibraryBig, X } from "lucide-react";
import { useI18n } from "@/i18n";
import { loadFavorites, saveFavorites } from "@/lib/favorites";
import type { SymbolId } from "@/lib/schematic";

interface Props {
  onPick: (id: SymbolId) => void;
  onOpenConnModal?: () => void;
  onOpenNetLabels?: () => void;
  onClose?: () => void;
  realistic?: boolean;
}

export function ComponentToolbox({ onPick, onOpenConnModal, onOpenNetLabels, onClose, realistic = false }: Props) {
  const { t, lang } = useI18n();
  const [q, setQ] = useState("");
  const [favorites, setFavorites] = useState<SymbolId[]>(() => loadFavorites());
  const [libOpen, setLibOpen] = useState(false);
  const [connModalOpen, setConnModalOpen] = useState(false);

  const updateFavorites = (next: SymbolId[]) => {
    setFavorites(next);
    saveFavorites(next);
  };

  const toggleFav = (id: SymbolId) => {
    updateFavorites(favorites.includes(id) ? favorites.filter((x) => x !== id) : [id, ...favorites]);
  };

  const removeFav = (id: SymbolId) => updateFavorites(favorites.filter((x) => x !== id));

  const grouped = useMemo(() => {
    const list = favorites
      .map((id) => SYMBOLS[id])
      .filter(Boolean)
      .filter((s) => {
        if (!q) return true;
        const name = t(`symbols.${s.id}`).toLowerCase();
        return name.includes(q.toLowerCase()) || s.id.includes(q.toLowerCase());
      });
    const g: Record<string, typeof list> = {};
    for (const s of list) (g[s.category] ??= []).push(s);
    return g;
  }, [favorites, q, t]);

  return (
    <div data-component-toolbox className="flex flex-col h-full w-[290px] sm:w-[310px] shrink-0 bg-panel text-panel-foreground border-r border-border/80 relative">
      <div className="p-2 border-b space-y-2">
        <div className="flex items-center justify-between gap-1.5">
          <Button onClick={() => { setLibOpen(true); setQ(""); }} className="flex-1 gap-1.5 h-9 text-xs sm:text-sm font-semibold text-white" variant="default">
            <LibraryBig className="size-4" />
            {t("openLibrary")}
          </Button>

          <Button 
            onClick={onOpenConnModal} 
            variant="outline" 
            size="icon"
            className="h-9 w-9 shrink-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border-slate-700" 
            title={lang === "ar" ? "مولد المقابس والجنكسيون" : (t("connectorGen.title") || "Connector Generator")}
          >
            <Cpu className="size-4 text-blue-400" />
          </Button>

          {onOpenNetLabels && (
            <Button 
              onClick={onOpenNetLabels} 
              variant="outline" 
              size="icon"
              className="h-9 w-9 shrink-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 border-slate-700" 
              title={lang === "ar" ? "إدارة التسميات الشبكية (Net Labels)" : "Manage Net Labels"}
            >
              <Tag className="size-4 text-blue-400" />
            </Button>
          )}

          <Button 
            onClick={() => onPick("text")} 
            variant="outline" 
            size="icon"
            className="h-9 w-9 shrink-0 border-slate-700" 
            title={t("connectorGen.addText") || "Add Text"}
          >
            <Type className="size-4" />
          </Button>
        </div>
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="h-8 text-xs"
        />
      </div>
      <div className="flex-1 overflow-y-auto overflow-x-hidden pr-1 scrollbar-thin scrollbar-thumb-slate-700/60 scrollbar-track-transparent">
        <div className="p-2 space-y-4">
          {favorites.length === 0 && (
            <div className="text-center text-xs text-muted-foreground py-8 px-3">
              {t("noFavorites")}
            </div>
          )}
          {CATEGORY_ORDER.filter((c) => grouped[c]?.length).map((cat) => (
            <div key={cat} className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider">
                {t(`categories.${cat}`)}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-700/60 scrollbar-track-transparent snap-x">
                {grouped[cat].map((s) => (
                  <div key={s.id} className="relative group shrink-0 w-[84px] snap-start">
                    <button
                      onClick={() => onPick(s.id)}
                      className="w-full h-[92px] flex flex-col items-center justify-between gap-1 p-1.5 rounded-md border border-border bg-card hover:bg-accent hover:border-primary/40 transition-colors active:scale-95"
                    >
                      <div className="flex-1 flex items-center justify-center">
                        <SymbolPreview id={s.id} size={40} realistic={realistic} />
                      </div>
                      <span className="text-[10px] text-center leading-tight text-muted-foreground line-clamp-2 w-full">
                        {t(`symbols.${s.id}`)}
                      </span>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeFav(s.id); }}
                      className="absolute -top-1 -end-1 size-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 active:opacity-100 transition-opacity shadow"
                      title={t("removeFromSidebar")}
                    >
                      <X className="size-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <ComponentLibrary
        open={libOpen}
        onOpenChange={setLibOpen}
        favorites={favorites}
        onToggleFavorite={toggleFav}
        onPick={onPick}
        realistic={realistic}
      />
    </div>
  );
}
