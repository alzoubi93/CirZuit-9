import React, { useState, useMemo } from "react";
import { 
  Search, Filter, Plus, Trash2, Import, 
  CheckCircle2, AlertCircle, X, ChevronRight,
  Database, User, FileCode, Edit3, Save, Link
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Dialog, DialogContent, DialogHeader, 
  DialogTitle, DialogFooter, DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Tabs, TabsContent, TabsList, TabsTrigger 
} from "@/components/ui/tabs";
import { BUILTIN_MODELS, SpiceModel, ModelSource } from "@/lib/spice-models";
import { parseSpiceModels } from "@/lib/model-parser";
import { SchematicDoc, SchematicNode, PinMapping } from "@/lib/schematic";
import { SYMBOLS } from "@/lib/symbols.tsx";
import { motion, AnimatePresence } from "framer-motion";

interface ModelManagerProps {
  doc: SchematicDoc;
  setDoc: (updater: (d: SchematicDoc) => SchematicDoc) => void;
  onClose: () => void;
  lang: string;
}

export function ModelManager({ doc, setDoc, onClose, lang }: ModelManagerProps) {
  const [search, setSearch] = useState("");
  const [activeSource, setActiveSource] = useState<ModelSource | "all">("all");
  const [selectedModel, setSelectedModel] = useState<SpiceModel | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importContent, setImportContent] = useState("");

  const allModels = useMemo(() => {
    return [...BUILTIN_MODELS, ...(doc.userModels || [])];
  }, [doc.userModels]);

  const filteredModels = useMemo(() => {
    return allModels.filter(m => {
      const name = m.name || "";
      const label = m.label || "";
      const matchesSearch = name.toLowerCase().includes((search || "").toLowerCase()) || 
                            label.toLowerCase().includes((search || "").toLowerCase());
      const matchesSource = activeSource === "all" || m.source === activeSource;
      return matchesSearch && matchesSource;
    });
  }, [allModels, search, activeSource]);

  const handleImport = () => {
    const imported = parseSpiceModels(importContent, "imported");
    if (imported.length > 0) {
      setDoc(d => ({
        ...d,
        userModels: [...(d.userModels || []), ...imported]
      }));
      setImportContent("");
      setIsImporting(false);
    }
  };

  const handleDeleteModel = (id: string) => {
    setDoc(d => ({
      ...d,
      userModels: d.userModels?.filter(m => m.id !== id)
    }));
    if (selectedModel?.id === id) setSelectedModel(null);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col font-sans">
      {/* Header */}
      <div className="h-16 border-b flex items-center justify-between px-6 bg-muted/20">
        <div className="flex items-center gap-3">
          <Database className="size-5 text-emerald-500" />
          <div>
            <h2 className="text-sm font-bold tracking-tight uppercase">
              {lang === "ar" ? "إدارة نماذج SPICE" : "SPICE Model Manager"}
            </h2>
            <p className="text-[10px] text-muted-foreground uppercase font-medium tracking-wider">
              {filteredModels.length} {lang === "ar" ? "نماذج متوفرة" : "Models Available"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsImporting(true)} className="h-9 gap-2">
            <Import className="size-4" />
            <span className="hidden sm:inline">{lang === "ar" ? "استيراد" : "Import .LIB"}</span>
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20">
            <X className="size-4 stroke-[2.5]" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar: Filters & List */}
        <div className="w-full md:w-80 border-r flex flex-col shrink-0 bg-muted/5">
          <div className="p-4 space-y-4 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input 
                placeholder={lang === "ar" ? "بحث..." : "Search models..."} 
                className="pl-9 h-10 bg-background"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-1 bg-muted p-1 rounded-lg">
               {(["all", "builtin", "imported"] as const).map(s => (
                 <button 
                  key={s}
                  onClick={() => setActiveSource(s)}
                  className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all ${
                    activeSource === s ? "bg-background shadow-sm" : "hover:bg-background/50 opacity-60"
                  }`}
                 >
                   {s}
                 </button>
               ))}
            </div>
          </div>

          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {filteredModels.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedModel(m)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all group ${
                    selectedModel?.id === m.id ? "bg-emerald-500/10 border border-emerald-500/20" : "hover:bg-muted border border-transparent"
                  }`}
                >
                  <div className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                    m.source === "builtin" ? "bg-blue-500/10 text-blue-500" : "bg-purple-500/10 text-purple-500"
                  }`}>
                    <span className="text-xs font-bold font-mono">{m.primitive}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold truncate">{m.name}</span>
                      {m.source === "builtin" && <CheckCircle2 className="size-3 text-blue-500" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate uppercase tracking-tighter">
                      {m.category || "General"} • {m.pinMapping.length} Pins
                    </p>
                  </div>
                </button>
              ))}
              {filteredModels.length === 0 && (
                <div className="py-20 text-center opacity-30">
                  <Database className="size-12 mx-auto mb-4" />
                  <p className="text-xs font-bold uppercase tracking-widest">{lang === "ar" ? "لا توجد نماذج" : "No Models Found"}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Content Area: Details & Assignment */}
        <div className="flex-1 flex flex-col bg-background relative overflow-hidden">
          <AnimatePresence mode="wait">
            {selectedModel ? (
              <motion.div 
                key={selectedModel.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-1 flex flex-col"
              >
                <div className="p-8 space-y-8 flex-1 overflow-auto">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                         <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold rounded uppercase">
                           {selectedModel.primitive} Type
                         </span>
                         <span className="px-2 py-0.5 bg-muted text-muted-foreground text-[10px] font-bold rounded uppercase">
                           {selectedModel.source}
                         </span>
                      </div>
                      <h1 className="text-3xl font-black tracking-tight">{selectedModel.name}</h1>
                      <p className="text-muted-foreground max-w-lg">{selectedModel.description}</p>
                    </div>
                    {selectedModel.source !== "builtin" && (
                       <Button variant="ghost" size="sm" onClick={() => handleDeleteModel(selectedModel.id)} className="text-red-500 hover:text-red-600 hover:bg-red-500/10 h-10 px-4">
                         <Trash2 className="size-4 mr-2" />
                         {lang === "ar" ? "حذف النموذج" : "Delete Model"}
                       </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Parameters & Pin Def */}
                    <div className="space-y-6">
                      <div className="p-6 bg-muted/20 border rounded-2xl space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                          <Link className="size-4 text-emerald-500" />
                          {lang === "ar" ? "التعريف والمداخل" : "Definition & Terminals"}
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedModel.pinMapping.map((p, i) => (
                            <div key={i} className="px-3 py-1.5 bg-background border rounded-lg flex items-center gap-2">
                              <span className="text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                              <span className="text-xs font-mono font-bold">{p}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-6 bg-muted/20 border rounded-2xl space-y-4">
                        <h3 className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                          <FileCode className="size-4 text-emerald-500" />
                          {lang === "ar" ? "كود SPICE" : "SPICE Implementation"}
                        </h3>
                        <div className="bg-slate-950 p-4 rounded-xl border font-mono text-[11px] leading-relaxed text-slate-300 overflow-auto max-h-48">
                           {selectedModel.template}
                           {selectedModel.content && (
                             <div className="mt-4 pt-4 border-t border-slate-800 text-slate-500 whitespace-pre">
                               {selectedModel.content}
                             </div>
                           )}
                        </div>
                      </div>
                    </div>

                    {/* Assignment Interface */}
                    <div className="space-y-6">
                      <h3 className="text-xs font-bold uppercase tracking-widest">{lang === "ar" ? "تخصيص لعنصر" : "Assign to Component"}</h3>
                      <div className="space-y-3">
                         <p className="text-[10px] text-muted-foreground uppercase font-medium">
                           {lang === "ar" ? "اختر عنصراً من المخطط لربطه بهذا النموذج" : "Select a component from the schematic to link with this model"}
                         </p>
                         <div className="space-y-2 border rounded-2xl p-2 h-96 overflow-auto bg-muted/10">
                           {doc.nodes.map(node => (
                             <AssignmentItem 
                               key={node.id} 
                               node={node} 
                               model={selectedModel} 
                               setDoc={setDoc} 
                               lang={lang} 
                             />
                           ))}
                         </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                 <div className="size-20 rounded-full bg-muted/20 flex items-center justify-center mb-6">
                    <Database className="size-10 text-muted-foreground/30" />
                 </div>
                 <h2 className="text-lg font-bold tracking-tight mb-2">
                   {lang === "ar" ? "لا يوجد نموذج مختار" : "No Model Selected"}
                 </h2>
                 <p className="text-xs text-muted-foreground max-w-xs uppercase font-medium tracking-widest leading-relaxed">
                   {lang === "ar" ? "اختر نموذجاً من القائمة الجانبية لعرض تفاصيله أو تعيينه لعنصر" : "Select a model from the sidebar to view details or assign it to a circuit component"}
                 </p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Import Dialog */}
      <Dialog open={isImporting} onOpenChange={setIsImporting}>
        <DialogContent hideCloseButton={true} className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{lang === "ar" ? "استيراد نموذج SPICE" : "Import SPICE Model"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">
              {lang === "ar" ? "الصيغ المدعومة: .LIB, .MODEL, .SUBCKT" : "Supported formats: .LIB, .MODEL, .SUBCKT"}
            </p>
            <textarea 
              className="w-full h-80 bg-slate-950 border rounded-xl p-4 font-mono text-xs text-slate-300 resize-none outline-none focus:border-emerald-500/50 transition-colors"
              placeholder={lang === "ar" ? "أدخل نص النموذج هنا..." : "Paste your SPICE model code here..."}
              value={importContent}
              onChange={e => setImportContent(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold" onClick={() => setIsImporting(false)}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleImport} className="bg-emerald-500 hover:bg-emerald-600">{lang === "ar" ? "استيراد وتخزين" : "Import & Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AssignmentItem({ node, model, setDoc, lang }: { 
  node: SchematicNode; 
  model: SpiceModel; 
  setDoc: (updater: (d: SchematicDoc) => SchematicDoc) => void;
  lang: string;
}) {
  const [mappingOpen, setMappingOpen] = useState(false);
  const sym = SYMBOLS[node.symbol];
  const isAssigned = node.customModel?.modelId === model.id;

  const handleAssign = (mapping: PinMapping) => {
    setDoc(d => ({
      ...d,
      nodes: d.nodes.map(n => n.id === node.id ? {
        ...n,
        customModel: { modelId: model.id, pinMapping: mapping }
      } : n)
    }));
    setMappingOpen(false);
  };

  return (
    <div className={`p-4 rounded-xl border flex items-center justify-between group transition-all ${
      isAssigned ? "bg-emerald-500/10 border-emerald-500/20" : "hover:bg-background border-transparent"
    }`}>
      <div className="flex items-center gap-4">
        <div className="size-10 rounded-lg bg-muted flex items-center justify-center font-mono text-[10px] font-bold">
           {node.reference || node.id}
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-bold uppercase">{node.symbol}</span>
          <span className="text-[10px] text-muted-foreground">{(sym?.pins || []).length} Pins</span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {isAssigned ? (
          <Button size="sm" variant="ghost" className="h-8 text-[10px] font-bold text-red-500 uppercase" onClick={() => setDoc(d => ({
            ...d,
            nodes: d.nodes.map(n => n.id === node.id ? { ...n, customModel: undefined } : n)
          }))}>
             {lang === "ar" ? "إزالة" : "Unassign"}
          </Button>
        ) : (
          <Dialog open={mappingOpen} onOpenChange={setMappingOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase">
                {lang === "ar" ? "تعيين" : "Assign"}
              </Button>
            </DialogTrigger>
            <PinMappingDialog 
               node={node} 
               model={model} 
               onComplete={handleAssign} 
               onCancel={() => setMappingOpen(false)}
               lang={lang}
            />
          </Dialog>
        )}
      </div>
    </div>
  );
}

function PinMappingDialog({ node, model, onComplete, onCancel, lang }: {
  node: SchematicNode;
  model: SpiceModel;
  onComplete: (mapping: PinMapping) => void;
  onCancel: () => void;
  lang: string;
}) {
  const sym = SYMBOLS[node.symbol];
  const symbolPins = useMemo(() => (sym?.pins || []).map((p, i) => p.name || `Pin ${i + 1}`), [sym]);
  const [mapping, setMapping] = useState<PinMapping>(() => {
     const m: PinMapping = {};
     symbolPins.forEach((sp, i) => {
        m[sp] = model.pinMapping[i] || model.pinMapping[0];
     });
     return m;
  });

  return (
    <DialogContent hideCloseButton={true} className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{lang === "ar" ? "رسم خرائط الأطراف" : "Pin Mapping Interface"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-6 py-4">
        <div className="p-3 bg-muted/30 rounded-xl flex items-center justify-between text-[10px] font-bold uppercase tracking-widest">
           <span className="text-muted-foreground">{lang === "ar" ? "طرف الرمز" : "Symbol Pin"}</span>
           <span className="text-muted-foreground">{lang === "ar" ? "طرف النموذج" : "Model Terminal"}</span>
        </div>
        <div className="space-y-3">
           {symbolPins.map(sp => (
             <div key={sp} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                   <div className="size-8 rounded-lg bg-muted flex items-center justify-center font-mono text-[10px] font-bold">
                      {sp}
                   </div>
                   <ChevronRight className="size-3 text-muted-foreground" />
                </div>
                <select 
                  className="bg-background border rounded-lg h-9 px-3 text-xs font-mono outline-none focus:border-emerald-500/50"
                  value={mapping[sp]}
                  onChange={e => setMapping({ ...mapping, [sp]: e.target.value })}
                >
                  {model.pinMapping.map(mp => (
                    <option key={mp} value={mp}>{mp}</option>
                  ))}
                </select>
             </div>
           ))}
        </div>
        <div className="flex items-center gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-amber-600">
           <AlertCircle className="size-4 shrink-0" />
           <p className="text-[10px] font-medium leading-tight">
             {lang === "ar" ? "تأكد من مطابقة الأطراف بدقة لتجنب أخطاء المحاكاة." : "Ensure pins match physical terminals to avoid simulation errors."}
           </p>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold" onClick={onCancel}>{lang === "ar" ? "إلغاء" : "Cancel"}</Button>
        <Button onClick={() => onComplete(mapping)} className="bg-emerald-500 hover:bg-emerald-600 gap-2">
           <Link className="size-4" />
           {lang === "ar" ? "ربط وحفظ" : "Map & Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
