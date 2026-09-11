import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RotateCw, Trash2, X, Link2, Unlink2, Sparkles, Download, Wand2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "@/i18n";
import { SYMBOLS } from "@/lib/symbols";
import type { SchematicNode, SchematicWire, WireColor } from "@/lib/schematic";
import { getPackagesForSymbol } from "@/lib/electronicsLibrary";
import { registerKicadFootprint, type KicadFootprintModel } from "@/lib/kicad/footprint";
import { createDefaultFallbackFootprint } from "@/lib/kicad/generator/generator";
import { FootprintBrowser } from "./FootprintBrowser";
import { getKiCadSymbolDefaultFootprint, deriveFootprintAssignment } from "@/lib/componentLink";

const COLORS: { id: WireColor | "default"; hex: string; label: string }[] = [
  { id: "default", hex: "transparent", label: "Default" },
  { id: "black", hex: "#111111", label: "Black" },
  { id: "red", hex: "#dc2626", label: "Red" },
  { id: "green", hex: "#16a34a", label: "Green" },
  { id: "blue", hex: "#2563eb", label: "Blue" },
  { id: "yellow", hex: "#eab308", label: "Yellow" },
  { id: "white", hex: "#ffffff", label: "White" },
];

interface Props {
  node: SchematicNode | null;
  wire?: SchematicWire | null;
  onChange: (patch: Partial<SchematicNode>) => void;
  onChangeWire?: (patch: Partial<SchematicWire>) => void;
  onRotate: () => void;
  onDelete: () => void;
  onDeleteWire?: () => void;
  onClose?: () => void;
}

export function PropertiesPanel({ node, wire, onChange, onChangeWire, onRotate, onDelete, onDeleteWire, onClose }: Props) {
  const { t, lang } = useI18n();
  const [footprintBrowserOpen, setFootprintBrowserOpen] = useState(false);
  const [browserInitialTab, setBrowserInitialTab] = useState<"import" | "generator">("import");

  if (wire) {
    return (
      <div className="h-full flex flex-col bg-panel text-panel-foreground">
        <div className="px-4 py-2 border-b flex items-center justify-between bg-card/50">
          <div className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <div className="size-1.5 rounded-full bg-blue-400" />
            {lang === "ar" ? "خصائص السلك" : "Wire Properties"}
          </div>
          <div className="flex gap-1">
            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={onDeleteWire} title={t("delete_")}>
              <Trash2 className="size-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20" onClick={onClose}>
              <X className="size-4 stroke-[2.5]" />
            </Button>
          </div>
        </div>
        <div className="p-4 space-y-4 overflow-auto">
          <div>
            <Label className="text-xs">{lang === "ar" ? "معلومات السلك" : "Wire Info"}</Label>
            <div className="text-xs text-muted-foreground mt-1 bg-muted/50 p-2 rounded border border-border">
              {lang === "ar" 
                ? `عدد النقاط: ${wire.points.length}` 
                : `Segments: ${wire.points.length - 1} (${wire.points.length} points)`}
            </div>
          </div>

          <div>
            <Label className="text-xs">{lang === "ar" ? "لون السلك" : "Wire Color"}</Label>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {COLORS.filter(c => c.id !== "default").map((c) => {
                const active = wire.color === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onChangeWire?.({ color: c.id as WireColor })}
                    className={`size-7 rounded-full border-2 grid place-items-center transition-all ${active ? "border-primary scale-110 shadow" : "border-border"}`}
                    style={c.id === "white" 
                      ? { background: "#ffffff", border: "1px solid #ccc" } 
                      : { background: c.hex }}
                    title={c.label}
                  />
                );
              })}
            </div>
          </div>

          <div>
            <Label className="text-xs">{lang === "ar" ? "سماكة السلك" : "Wire Thickness"}</Label>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {[
                { label: lang === "ar" ? "عادي" : "Normal", value: 0.1 },
                { label: lang === "ar" ? "متوسط" : "Medium", value: 0.15 },
                { label: lang === "ar" ? "سميك" : "Thick", value: 0.2 },
                { label: lang === "ar" ? "عريض" : "Wide", value: 0.3 },
              ].map((opt) => {
                const currentWidth = wire.width ?? 0.1;
                const active = Math.abs(currentWidth - opt.value) < 0.01;
                return (
                  <Button
                    key={opt.value}
                    size="sm"
                    variant="outline"
                    className={`h-8 text-xs px-2.5 flex-1 min-w-[60px] transition-all ${
                      active
                        ? "bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30 hover:text-blue-300 font-bold shadow-sm shadow-blue-500/10"
                        : "bg-transparent text-muted-foreground border-border hover:bg-muted hover:text-foreground font-normal"
                    }`}
                    onClick={() => onChangeWire?.({ width: opt.value })}
                  >
                    {opt.label}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-muted-foreground p-4 bg-panel text-panel-foreground">
        {t("nothingSelected")}
      </div>
    );
  }
  const sym = SYMBOLS[node.symbol];
  if (!sym) return null;
  const setPinName = (i: number, v: string) => {
    const next = { ...(node.pinNames ?? {}) };
    if (v.trim()) next[i] = v;
    else delete next[i];
    onChange({ pinNames: next });
  };
  return (
    <div className="h-full flex flex-col bg-panel text-panel-foreground border-r border-border shadow-2xl">
      <div className="px-4 py-2 border-b flex items-center justify-between bg-card/50">
        <div className="font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <div className="size-1.5 rounded-full bg-primary" />
          {t(`symbols.${node.symbol}`)}
        </div>
        <div className="flex gap-1">
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onRotate} title={t("rotate")}>
            <RotateCw className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-500/10" onClick={onDelete} title={t("delete_")}>
            <Trash2 className="size-4" />
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20" onClick={onClose}>
            <X className="size-4 stroke-[2.5]" />
          </Button>
        </div>
      </div>
      <div className="p-4 space-y-3 overflow-auto">
        <div>
          <Label className="text-xs">{t("reference")}</Label>
          <Input value={node.reference ?? ""} onChange={(e) => onChange({ reference: e.target.value })} placeholder="R1, C2..." className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{t("value")}</Label>
          <Input value={node.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} placeholder="10k, 100nF..." className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{t("label")}</Label>
          <Input value={node.label ?? ""} onChange={(e) => onChange({ label: e.target.value })} className="h-9" />
        </div>
        <div>
          <Label className="text-xs">{t("notes")}</Label>
          <Textarea value={node.notes ?? ""} onChange={(e) => onChange({ notes: e.target.value })} rows={2} />
        </div>

        <div className="pt-2 border-t space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <Link2 className="size-3.5 text-blue-400" />
              {lang === "ar" ? "بصمة العنصر (Footprint)" : "Assigned Footprint"}
            </Label>
            {(node.footprintAssignment || node.footprint) && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10"
                onClick={() => onChange({ footprint: undefined, footprintAssignment: undefined })}
              >
                <Unlink2 className="size-3 me-1" />
                {lang === "ar" ? "إلغاء" : "Clear"}
              </Button>
            )}
          </div>

          {(() => {
            const derived = !node.footprint && !node.footprintAssignment ? deriveFootprintAssignment(node) : undefined;
            return (
              <div className="rounded-lg border border-border bg-card/60 p-2.5 space-y-1.5">
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  <span className="text-muted-foreground">{lang === "ar" ? "الحالة:" : "Status:"}</span>
                  {node.footprintAssignment?.source === "generator" ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium flex items-center gap-1">
                      <Sparkles className="size-2.5 text-blue-400" />
                      <span className="text-blue-400">{lang === "ar" ? "مولّدة بالمولد الداخلي" : "Generated"}</span>
                    </span>
                  ) : (node.footprintAssignment?.source === "kicad" || (node.footprint && node.footprint.includes(":"))) ? (
                    <span className="px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium flex items-center gap-1">
                      <Download className="size-2.5 text-blue-400" />
                      <span className="text-blue-400">{lang === "ar" ? "مستوردة من KiCad" : "KiCad Library"}</span>
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium flex items-center gap-1">
                      <Sparkles className="size-2.5 text-emerald-400" />
                      <span className="text-emerald-400">{lang === "ar" ? "توليد ذكي افتراضي (THT)" : "Smart THT Default"}</span>
                    </span>
                  )}
                </div>
                <div className="text-xs font-mono font-medium break-all text-foreground">
                  {node.footprintAssignment?.displayName || node.footprint || (
                    <span className="text-emerald-400 font-mono text-xs">
                      {derived?.displayName || derived?.identifier || (lang === "ar" ? "سيتم توليد بصمة افتراضية تلقائياً" : "Auto-generating...")}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          <div className="space-y-1.5">
            <div className="text-[11px] font-medium text-white">
              {lang === "ar" ? "تعيين البصمة من:" : "Assign Footprint from:"}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2 text-xs flex items-center justify-center gap-1.5 border-blue-400/40 hover:bg-blue-400/10 hover:border-blue-400/60 text-blue-400"
                onClick={() => {
                  setBrowserInitialTab("import");
                  setFootprintBrowserOpen(true);
                }}
              >
                <Download className="size-3.5 text-blue-400 shrink-0" />
                <span className="truncate text-blue-400">{lang === "ar" ? "مستودع KiCad" : "KiCad Repo"}</span>
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="h-9 px-2 text-xs flex items-center justify-center gap-1.5 border-blue-400/40 hover:bg-blue-400/10 hover:border-blue-400/60 text-blue-400"
                onClick={() => {
                  setBrowserInitialTab("generator");
                  setFootprintBrowserOpen(true);
                }}
              >
                <Sparkles className="size-3.5 text-blue-400 shrink-0" />
                <span className="truncate text-blue-400">{lang === "ar" ? "المولّد الداخلي" : "Generator"}</span>
              </Button>
            </div>
          </div>
        </div>

        <FootprintBrowser
          open={footprintBrowserOpen}
          onOpenChange={setFootprintBrowserOpen}
          selectionOnly
          initialTab={browserInitialTab}
          symbolContext={{
            symbol: node.symbol,
            reference: node.reference,
            value: node.value,
            pinCount: SYMBOLS[node.symbol]?.pins?.length,
          }}
          onSelect={(model: KicadFootprintModel) => {
            registerKicadFootprint(model);
            const isGen = model.isGenerated || model.fullName.startsWith("Generator:");
            onChange({
              footprint: model.fullName,
              footprintAssignment: {
                source: isGen ? "generator" : "kicad",
                identifier: model.fullName,
                library: model.library,
                name: model.name,
                displayName: model.fullName,
                status: "resolved",
              },
            });
            setFootprintBrowserOpen(false);
          }}
          onGenerate={() => undefined}
        />

        <div>
          <Label className="text-xs">{t("componentColor")}</Label>
          <div className="flex flex-wrap gap-2 mt-1.5">
            {COLORS.map((c) => {
              const active = (node.color ?? "default") === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onChange({ color: c.id === "default" ? undefined : (c.id as WireColor) })}
                  className={`size-7 rounded-full border-2 grid place-items-center transition-all ${active ? "border-primary scale-110 shadow" : "border-border"}`}
                  style={c.id === "default"
                    ? { background: "repeating-linear-gradient(45deg,#fff,#fff 3px,#ccc 3px,#ccc 6px)" }
                    : { background: c.hex }}
                  title={c.label}
                />
              );
            })}
          </div>
        </div>

        <div>
          <Label className="text-xs">{lang === "ar" ? "حجم العنصر" : "Component Size"}</Label>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {[
              { label: lang === "ar" ? "صغير" : "S (80%)", value: 0.8 },
              { label: lang === "ar" ? "طبيعي" : "M (100%)", value: 1.0 },
              { label: lang === "ar" ? "كبير" : "L (120%)", value: 1.2 },
              { label: lang === "ar" ? "كبير جداً" : "XL (150%)", value: 1.5 },
              { label: lang === "ar" ? "ضخم" : "XXL (200%)", value: 2.0 },
            ].map((opt) => {
              const currentScale = node.size ?? 1.0;
              const active = Math.abs(currentScale - opt.value) < 0.01;
              return (
                <Button
                  key={opt.value}
                  size="sm"
                  variant="outline"
                  className={`h-8 text-[11px] px-2 flex-1 min-w-[70px] transition-all ${
                    active
                      ? "bg-blue-500/20 text-blue-400 border-blue-500/50 hover:bg-blue-500/30 hover:text-blue-300 font-bold shadow-sm shadow-blue-500/10"
                      : "bg-transparent text-muted-foreground border-border hover:bg-muted hover:text-foreground font-normal"
                  }`}
                  onClick={() => onChange({ size: opt.value })}
                >
                  {opt.label}
                </Button>
              );
            })}
          </div>
        </div>

        {sym.pins.length > 1 && (
          <div className="pt-2 border-t">
            <Label className="text-xs font-semibold">{t("pinNames")}</Label>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {sym.pins.map((p, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground w-6 shrink-0">{i + 1}</span>
                  <Input
                    value={node.pinNames?.[i] ?? p.name ?? ""}
                    onChange={(e) => setPinName(i, e.target.value)}
                    placeholder={p.name ?? `${t("pin")} ${i + 1}`}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
