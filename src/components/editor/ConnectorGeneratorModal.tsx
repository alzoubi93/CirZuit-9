import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { generateConnectorId } from "@/lib/symbols";
import { useI18n } from "@/i18n";
import type { ConnectorMetadata } from "@/lib/symbols";
import { Cpu, Columns3, Rows3, Hash, Ruler, Baseline, Type as TypeOutline, SquareStack, Layers, Palette, ArrowRightLeft, Tag } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (id: string, metadata: ConnectorMetadata) => void;
}

export function ConnectorGeneratorModal({ open, onOpenChange, onGenerate }: Props) {
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab] = useState<"headers" | "terminals">("headers");

  // Tab 1: Headers & Sockets State
  const [gender, setGender] = useState<ConnectorMetadata["gender"]>("MALE");
  const [rows, setRows] = useState(1);
  const [pinsPerRow, setPinsPerRow] = useState(4);
  const [pitch, setPitch] = useState(2.54);
  const [orientation, setOrientation] = useState<ConnectorMetadata["orientation"]>("STRAIGHT");
  const [refDes, setRefDes] = useState("J");

  // Tab 2: Screw Terminal Block State
  const [modelPreset, setModelPreset] = useState<string>("KF301 (5.08mm)");
  const [termPoles, setTermPoles] = useState<number>(2);
  const [termPitch, setTermPitch] = useState<number>(5.08);
  const [termWireEntry, setTermWireEntry] = useState<string>("Side Entry (90° Horizontal)");
  const [termColor, setTermColor] = useState<string>("#00A859");
  const [termPinLabels, setTermPinLabels] = useState<string>("1, 2");
  const [termRefDes, setTermRefDes] = useState<string>("TB");

  const handlePresetChange = (preset: string) => {
    setModelPreset(preset);
    if (preset === "KF301 (5.08mm)") {
      setTermPitch(5.08);
      setTermColor("#00A859");
      setTermWireEntry("Side Entry (90° Horizontal)");
    } else if (preset === "DG301 (5.00mm)") {
      setTermPitch(5.00);
      setTermColor("#0055A5");
      setTermWireEntry("Side Entry (90° Horizontal)");
    } else if (preset === "KF128 (3.50mm)") {
      setTermPitch(3.50);
      setTermColor("#00A859");
      setTermWireEntry("Side Entry (90° Horizontal)");
    }
  };

  const handleGenerate = () => {
    if (activeTab === "headers") {
      const meta: ConnectorMetadata = {
        type: "HEADER_SOCKET",
        gender,
        rows,
        pinsPerRow,
        pitch,
        orientation,
        refDes,
      };
      const id = generateConnectorId(meta);
      onGenerate(id, meta);
    } else {
      const polesCount = Math.max(2, Math.min(24, termPoles || 2));
      const labels = termPinLabels
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const meta: ConnectorMetadata = {
        type: "SCREW_TERMINAL",
        poles: polesCount,
        pitch: termPitch,
        color: termColor,
        drillHole: termPitch >= 5.0 ? 1.30 : 1.10,
        padDiameter: termPitch >= 5.0 ? 2.40 : 1.90,
        pinLabels: labels,
        wireEntry: termWireEntry,
        refDes: termRefDes || "TB",
      };
      const id = generateConnectorId(meta);
      onGenerate(id, meta);
    }
    onOpenChange(false);
  };

  const isRtl = lang === "ar";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] bg-card text-card-foreground border-border shadow-xl">
        <DialogHeader className="pb-3 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold text-foreground">
            <div className="flex items-center justify-center p-2 rounded-lg bg-blue-500/10 text-blue-400">
              <Cpu className="w-5 h-5 text-blue-400" />
            </div>
            {t("connectorGen.title")}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground pt-1 text-xs">
            {isRtl
              ? "قم بإنشاء وتحديد الموصلات ورؤوس الدبابيس وكتل الأطراف (الجنكسيون) بدقة."
              : "Generate parametric pin headers, sockets, and PCB screw terminal blocks."}
          </DialogDescription>

          {/* Top Tab Bar Navigation */}
          <div className="flex rounded-lg bg-muted/60 p-1 mt-3 border border-border/50">
            <button
              type="button"
              onClick={() => setActiveTab("headers")}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                activeTab === "headers"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              <Columns3 className="w-3.5 h-3.5 text-blue-400" />
              {t("connectorGen.tabHeaders")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("terminals")}
              className={`flex-1 flex items-center justify-center gap-2 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
                activeTab === "terminals"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
            >
              <SquareStack className="w-3.5 h-3.5 text-blue-400" />
              {t("connectorGen.tabScrewTerminals")}
            </button>
          </div>
        </DialogHeader>

        {/* Tab 1: Pin Headers & Sockets */}
        {activeTab === "headers" && (
          <div className="grid gap-4 py-3">
            <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <Columns3 className="w-4 h-4 text-blue-400" />}
                {t("connectorGen.type")}
                {isRtl && <Columns3 className="w-4 h-4 text-blue-400" />}
              </Label>
              <select
                value={gender}
                onChange={(e: any) => setGender(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <option value="MALE">{t("connectorGen.male")}</option>
                <option value="FEMALE">{t("connectorGen.female")}</option>
                <option value="SHROUDED">{t("connectorGen.shrouded")}</option>
                <option value="DIP">{t("connectorGen.dip")}</option>
              </select>
            </div>

            <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <Rows3 className="w-4 h-4 text-blue-400" />}
                {t("connectorGen.rows")}
                {isRtl && <Rows3 className="w-4 h-4 text-blue-400" />}
              </Label>
              <Input
                type="number"
                min={1}
                value={rows}
                onChange={(e) => setRows(parseInt(e.target.value) || 1)}
                className="h-9 text-center font-mono text-sm bg-background/50"
              />
            </div>

            <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <Hash className="w-4 h-4 text-blue-400" />}
                {t("connectorGen.pinsPerRow")}
                {isRtl && <Hash className="w-4 h-4 text-blue-400" />}
              </Label>
              <Input
                type="number"
                min={1}
                value={pinsPerRow}
                onChange={(e) => setPinsPerRow(parseInt(e.target.value) || 1)}
                className="h-9 text-center font-mono text-sm bg-background/50"
              />
            </div>

            <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <Ruler className="w-4 h-4 text-blue-400" />}
                {t("connectorGen.pitch")}
                {isRtl && <Ruler className="w-4 h-4 text-blue-400" />}
              </Label>
              <select
                value={pitch.toString()}
                onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <option value="2.54">{t("connectorGen.pitch254")}</option>
                <option value="2">{t("connectorGen.pitch200")}</option>
                <option value="1.27">{t("connectorGen.pitch127")}</option>
              </select>
            </div>

            <div className="grid grid-cols-[1fr_2fr] items-center gap-4">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <Baseline className="w-4 h-4 text-blue-400" />}
                {t("connectorGen.orientation")}
                {isRtl && <Baseline className="w-4 h-4 text-blue-400" />}
              </Label>
              <select
                value={orientation}
                onChange={(e: any) => setOrientation(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <option value="STRAIGHT">{t("connectorGen.straight")}</option>
                <option value="RIGHT_ANGLE">{t("connectorGen.rightAngle")}</option>
              </select>
            </div>

            <div className="grid grid-cols-[1fr_2fr] items-center gap-4 pt-2 border-t border-border/40">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <TypeOutline className="w-4 h-4 text-blue-400" />}
                {t("connectorGen.prefix")}
                {isRtl && <TypeOutline className="w-4 h-4 text-blue-400" />}
              </Label>
              <Input
                value={refDes}
                onChange={(e) => setRefDes(e.target.value)}
                className="h-9 font-mono text-sm bg-background/50"
              />
            </div>
          </div>
        )}

        {/* Tab 2: Screw Terminal Blocks (الجنكسيون / كتل الأطراف) */}
        {activeTab === "terminals" && (
          <div className="grid gap-3.5 py-3">
            {/* Preset Model Selection */}
            <div className="grid grid-cols-[1.1fr_2fr] items-center gap-3">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium text-xs ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <Layers className="w-3.5 h-3.5 text-blue-400" />}
                {t("connectorGen.modelPreset")}
                {isRtl && <Layers className="w-3.5 h-3.5 text-blue-400" />}
              </Label>
              <select
                value={modelPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="flex h-8.5 w-full rounded-md border border-input bg-background/50 px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <option value="Custom">{t("connectorGen.customPreset")}</option>
                <option value="KF301 (5.08mm)">KF301 (5.08mm / 200mil)</option>
                <option value="DG301 (5.00mm)">DG301 (5.00mm)</option>
                <option value="KF128 (3.50mm)">KF128 (3.50mm)</option>
              </select>
            </div>

            {/* Poles / Pins Count */}
            <div className="grid grid-cols-[1.1fr_2fr] items-center gap-3">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium text-xs ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <Hash className="w-3.5 h-3.5 text-blue-400" />}
                {t("connectorGen.poles")}
                {isRtl && <Hash className="w-3.5 h-3.5 text-blue-400" />}
              </Label>
              <Input
                type="number"
                min={2}
                max={24}
                value={termPoles}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setTermPoles(isNaN(val) ? 2 : val);
                }}
                className="h-8.5 text-center font-mono text-xs bg-background/50"
              />
            </div>

            {/* Pitch Options */}
            <div className="grid grid-cols-[1.1fr_2fr] items-center gap-3">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium text-xs ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <Ruler className="w-3.5 h-3.5 text-blue-400" />}
                {t("connectorGen.pitch")}
                {isRtl && <Ruler className="w-3.5 h-3.5 text-blue-400" />}
              </Label>
              <select
                value={termPitch.toString()}
                onChange={(e) => {
                  setTermPitch(parseFloat(e.target.value));
                  setModelPreset("Custom");
                }}
                className="flex h-8.5 w-full rounded-md border border-input bg-background/50 px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <option value="5.08">{t("connectorGen.pitch508")}</option>
                <option value="5.00">{t("connectorGen.pitch500")}</option>
                <option value="3.50">{t("connectorGen.pitch350")}</option>
                <option value="3.81">{t("connectorGen.pitch381")}</option>
              </select>
            </div>

            {/* Wire Entry Direction */}
            <div className="grid grid-cols-[1.1fr_2fr] items-center gap-3">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium text-xs ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />}
                {t("connectorGen.wireEntry")}
                {isRtl && <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />}
              </Label>
              <select
                value={termWireEntry}
                onChange={(e) => setTermWireEntry(e.target.value)}
                className="flex h-8.5 w-full rounded-md border border-input bg-background/50 px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
              >
                <option value="Side Entry (90° Horizontal)">{t("connectorGen.sideEntry")}</option>
                <option value="Top Entry (Vertical)">{t("connectorGen.topEntry")}</option>
              </select>
            </div>

            {/* Housing Color */}
            <div className="grid grid-cols-[1.1fr_2fr] items-center gap-3">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium text-xs ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <Palette className="w-3.5 h-3.5 text-blue-400" />}
                {t("connectorGen.color")}
                {isRtl && <Palette className="w-3.5 h-3.5 text-blue-400" />}
              </Label>
              <div className="flex items-center gap-2">
                <select
                  value={termColor}
                  onChange={(e) => setTermColor(e.target.value)}
                  className="flex h-8.5 flex-1 rounded-md border border-input bg-background/50 px-2.5 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500"
                >
                  <option value="#00A859">{t("connectorGen.green")}</option>
                  <option value="#0055A5">{t("connectorGen.blue")}</option>
                  <option value="#1A1A1A">{t("connectorGen.black")}</option>
                </select>
                <div
                  className="w-6 h-6 rounded-md border border-border shadow-inner shrink-0"
                  style={{ backgroundColor: termColor }}
                />
              </div>
            </div>

            {/* Custom Pin Labels */}
            <div className="grid grid-cols-[1.1fr_2fr] items-center gap-3">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium text-xs ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <Tag className="w-3.5 h-3.5 text-blue-400" />}
                {t("connectorGen.pinLabels")}
                {isRtl && <Tag className="w-3.5 h-3.5 text-blue-400" />}
              </Label>
              <Input
                value={termPinLabels}
                onChange={(e) => setTermPinLabels(e.target.value)}
                placeholder={t("connectorGen.pinLabelsPlaceholder")}
                className="h-8.5 text-xs bg-background/50 font-mono"
              />
            </div>

            {/* Prefix */}
            <div className="grid grid-cols-[1.1fr_2fr] items-center gap-3 pt-2 border-t border-border/40">
              <Label className={`flex items-center gap-2 text-muted-foreground font-medium text-xs ${isRtl ? "justify-start" : "justify-end"}`}>
                {!isRtl && <TypeOutline className="w-3.5 h-3.5 text-blue-400" />}
                {t("connectorGen.prefix")}
                {isRtl && <TypeOutline className="w-3.5 h-3.5 text-blue-400" />}
              </Label>
              <Input
                value={termRefDes}
                onChange={(e) => setTermRefDes(e.target.value)}
                className="h-8.5 font-mono text-xs bg-background/50"
              />
            </div>
          </div>
        )}

        <DialogFooter className="pt-2">
          <div className="flex w-full justify-between gap-3">
            <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold text-xs h-9" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button onClick={handleGenerate} className="gap-2 px-6 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium h-9 shadow-sm">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              {t("connectorGen.generate")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
