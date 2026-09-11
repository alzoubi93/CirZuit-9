import { useEffect, useState, useMemo, useRef, useDeferredValue } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useStableCallback } from "@/hooks/useStableCallback";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";
import { Project, getProject, updateProject } from "@/lib/db";
import { SchematicDoc, SchematicNode, SchematicWire, SymbolId, WireColor, nextReference } from "@/lib/schematic";
import { downloadZuit, readZuit } from "@/lib/projectFile";
import { downloadXmlProject, readXmlProject } from "@/lib/xmlProject";
import { detectAndParseSchematic } from "@/lib/importSchematicFormats";
import { SYMBOLS } from "@/lib/symbols";
import { PcbDoc, emptyPcbDoc } from "@/lib/pcb";
import { syncPcbWithSchematic, computeEcoDiff, validateSchematicPcbLink, reconcileAssignmentsFromPcb } from "@/lib/pcbSync";
import { getPackagesForSymbol } from "@/lib/electronicsLibrary";
import { buildNetIndex } from "@/lib/netlist";
import { getKiCadSymbolDefaultFootprint, isKiCadSymbol } from "@/lib/componentLink";
import { computeTrackNets } from "@/components/editor/PcbEditor";
import { runDesignChecks, isKiCadPcbBoard, type DesignCheckResult } from "@/lib/designRules";
import { SimulationModule } from "@/components/editor/SimulationModule";
import { ModelManager } from "@/components/editor/ModelManager";
import { downloadBomXlsx, downloadNetlist } from "@/lib/bom";
import { downloadEasyEDA } from "@/lib/exportEasyEDA";
import { downloadKiCadSch, downloadEasyEdaJson, downloadEagleSch, downloadSpiceNetlist } from "@/lib/exportSchematicFormats";
import { exportImage, exportPcbImage } from "@/lib/exportImage";
import { exportPcbTonerTransferPdf } from "@/lib/exportPcbPdf";
import { downloadGerberZip, downloadNcDrillFile } from "@/lib/exportGerber";
import { importGerberToProject } from "@/lib/importGerber";
import { isOdbZip, isIpc2581Content, parseIpc2581, parseOdbZipToProject } from "@/lib/importModernPcb";
import { parseKiCadPcb, isKiCadPcbContent } from "@/lib/importKiCadPcb";
import Logo from "@/components/Logo";
import { Canvas, EditorTool, WireStyle } from "@/components/editor/Canvas";
import { PcbEditor } from "@/components/editor/PcbEditor";
import { ConnectorGeneratorModal } from "@/components/editor/ConnectorGeneratorModal";
import type { ConnectorMetadata } from "@/lib/symbols";
import { ComponentToolbox } from "@/components/editor/ComponentToolbox";
import { PropertiesPanel } from "@/components/editor/PropertiesPanel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { GridStyle } from "@/components/editor/Grid";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  ChevronDown,
  Undo2,
  Redo2,
  RotateCw,
  Trash2,
  Download,
  Settings,
  Grid,
  Sparkles,
  Cpu,
  Layers,
  Moon,
  Sun,
  Globe,
  Library,
  Activity,
  MousePointer2,
  MoreVertical,
  SlidersHorizontal,
  Type,
  Maximize,
  Minimize,
  Paintbrush,
  Palette,
  Eye,
  EyeOff,
  Plus,
  X,
  Shield,
  ShieldCheck,
  Zap,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Clipboard,
  CopyPlus,
  MousePointerSquareDashed,
  Box,
  Package,
  FolderOpen,
  Save,
  Upload,
  ArrowUpDown,
  ArrowLeftRight,
  RotateCcw,
  Tag,
  Search,
  Pencil,
  Check,
  Crosshair,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

type EditorMode = "schematic" | "realistic" | "pcb";

function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<EditorMode>("schematic");

  const isSchematicLike = mode === "schematic" || mode === "realistic";

  // Undo / Redo history stacks for SchematicDoc
  const [history, setHistory] = useState<SchematicDoc[]>([]);
  const [redoStack, setRedoStack] = useState<SchematicDoc[]>([]);
  const restoredStateRef = useRef<any>(null);
  const latestDocRef = useRef<SchematicDoc | null>(null);

  useEffect(() => {
    if (project?.doc) {
      latestDocRef.current = project.doc;
    }
  }, [project?.doc]);

  // Restore history stacks passed from project import
  useEffect(() => {
    if (location.state && location.state !== restoredStateRef.current) {
      restoredStateRef.current = location.state;
      const state = location.state as any;
      if (Array.isArray(state.undoStack) && state.undoStack.length > 0) {
        setHistory(state.undoStack);
      }
      if (Array.isArray(state.redoStack) && state.redoStack.length > 0) {
        setRedoStack(state.redoStack);
      }
    }
  }, [location.state]);

  // Selections & tools
  const [activeTool, setActiveTool] = useState<EditorTool>("pan");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedWireIds, setSelectedWireIds] = useState<string[]>([]);
  const [clipboard, setClipboard] = useState<{ nodes: SchematicNode[]; wires: SchematicWire[] } | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [selectedPin, setSelectedPin] = useState<{ nodeId: string; pinIndex: number } | null>(null);
  const [ecoOpen, setEcoOpen] = useState(false);
  const [designCheckOpen, setDesignCheckOpen] = useState(false);
  const [designCheckTab, setDesignCheckTab] = useState<"erc" | "drc">("erc");
  const [ignoredIssueIds, setIgnoredIssueIds] = useState<string[]>([]);
  const [showIgnoredInModal, setShowIgnoredInModal] = useState(false);

  useEffect(() => {
    if (project?.doc.ignoredIssues) {
      setIgnoredIssueIds(project.doc.ignoredIssues);
    } else {
      setIgnoredIssueIds([]);
    }
  }, [project?.id, project?.doc.ignoredIssues]);
  const [netLabelOpen, setNetLabelOpen] = useState(false);
  const [netLabelText, setNetLabelText] = useState("");
  const [netLabelX, setNetLabelX] = useState("0");
  const [netLabelY, setNetLabelY] = useState("0");
  const [netLabelScope, setNetLabelScope] = useState<"local" | "global">("local");
  const [netLabelRotation, setNetLabelRotation] = useState<0 | 90 | 180 | 270>(0);
  const [netLabelSearch, setNetLabelSearch] = useState("");
  const [netLabelFilterScope, setNetLabelFilterScope] = useState<"all" | "local" | "global">("all");
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [editLabelText, setEditLabelText] = useState("");
  const [editLabelX, setEditLabelX] = useState("0");
  const [editLabelY, setEditLabelY] = useState("0");
  const [editLabelScope, setEditLabelScope] = useState<"local" | "global">("local");
  const [editLabelRotation, setEditLabelRotation] = useState<0 | 90 | 180 | 270>(0);

  useEffect(() => {
    if (project?.doc.pcb?.isImportedGerber || isKiCadPcbBoard(project?.doc.pcb)) {
      setEcoOpen(false);
    }
  }, [project?.doc.pcb?.isImportedGerber, project?.doc.pcb?.isImportedKiCadPcb, project?.doc.pcb?.disableDrc]);

  const [simulationOpen, setSimulationOpen] = useState(false);
  const [modelManagerOpen, setModelManagerOpen] = useState(false);
  const [unitDialogOpen, setUnitDialogOpen] = useState(false);
  const [packageSelections, setPackageSelections] = useState<Record<string, string>>({});
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTarget, setImportTarget] = useState<"schematic" | "pcb">("schematic");
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<"save_project" | "export" | "import">("save_project");
  const [exportFilename, setExportFilename] = useState("");
  const [exportFormat, setExportFormat] = useState<string>("pdf");
  const [exportTarget, setExportTarget] = useState<"schematic" | "pcb" | "realistic">("schematic");

  // DIY PCB Toner Transfer PDF Export Options
  const [diyPcbPdfType, setDiyPcbPdfType] = useState<"toner_transfer" | "color_canvas">("toner_transfer");
  const [diyPcbLayer, setDiyPcbLayer] = useState<"top_copper" | "bottom_copper" | "silkscreen" | "bottom_silkscreen">("bottom_copper");
  const [diyPcbMirror, setDiyPcbMirror] = useState<boolean>(false);
  const [diyPcbInvert, setDiyPcbInvert] = useState<boolean>(false);
  const [diyPcbDrillGuide, setDiyPcbDrillGuide] = useState<"small" | "full" | "none">("small");
  const [diyPcbOutline, setDiyPcbOutline] = useState<boolean>(true);
  const [diyPcbCopies, setDiyPcbCopies] = useState<number>(1);

  const handleDiyPcbLayerChange = (layer: "top_copper" | "bottom_copper" | "silkscreen" | "bottom_silkscreen") => {
    setDiyPcbLayer(layer);
    if (layer === "top_copper") {
      setDiyPcbMirror(true);
    } else if (layer === "bottom_copper") {
      setDiyPcbMirror(false);
    } else if (layer === "silkscreen") {
      setDiyPcbMirror(false);
    } else if (layer === "bottom_silkscreen") {
      setDiyPcbMirror(true);
    }
  };

  const [exportDirectories, setExportDirectories] = useState<string[]>([
    "/Downloads",
    "/Documents",
    "/Documents/CirZuit_Projects",
    "/Desktop",
  ]);
  const [selectedDirectory, setSelectedDirectory] = useState<string>("/Downloads");
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [customFolderName, setCustomFolderName] = useState("");

  const handleAddCustomFolder = () => {
    const trimmed = customFolderName.trim();
    if (!trimmed) return;
    const formatted = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    if (!exportDirectories.includes(formatted)) {
      setExportDirectories([...exportDirectories, formatted]);
    }
    setSelectedDirectory(formatted);
    setCustomFolderName("");
    setShowCreateFolder(false);
    toast.success(lang === "ar" ? `تم إنشاء واختيار المجلد: ${formatted}` : `Created and selected folder: ${formatted}`);
  };

  useEffect(() => {
    if (importDialogOpen) {
      setActiveModalTab("import");
      setExportDialogOpen(true);
      setImportDialogOpen(false);
    }
  }, [importDialogOpen]);

  useEffect(() => {
    if (exportDialogOpen && project) {
      setExportFilename(project.name);
    }
  }, [exportDialogOpen, project?.name]);
  
  const handleGlobalPackage = (type: "DIP" | "SMD") => {
    const next = { ...packageSelections };
    ecoDiff.add.forEach(item => {
      const pkgs = getPackagesForSymbol(item.symbol);
      const target = pkgs.find(p => p.type === type);
      if (target) {
        next[item.id] = target.id;
      }
    });
    setPackageSelections(next);
  };

  const handleGlobalSize = (sizeId: string) => {
    const next = { ...packageSelections };
    ecoDiff.add.forEach(item => {
      const pkgs = getPackagesForSymbol(item.symbol);
      const target = pkgs.find(p => p.id === sizeId);
      if (target) {
        next[item.id] = target.id;
      }
    });
    setPackageSelections(next);
  };

  const handleSinglePackageType = (itemId: string, symbol: string, type: "DIP" | "SMD") => {
    const pkgs = getPackagesForSymbol(symbol);
    const target = pkgs.find(p => p.type === type);
    if (target) {
      setPackageSelections(prev => ({ ...prev, [itemId]: target.id }));
    }
  };

  const highlightedNetIds = useMemo<number[]>(() => {
    if (!project) return [];
    const netIndex = buildNetIndex(project.doc);
    const nets = new Set<number>();

    if (selectedWireIds.length > 0) {
      selectedWireIds.forEach(wid => {
        const netId = netIndex.wireNet.get(wid);
        if (netId !== undefined) nets.add(netId);
      });
    }
    if (selectedIds.length > 0) {
      selectedIds.forEach(sid => {
        for (const [key, netId] of netIndex.pinNet.entries()) {
          if (key.startsWith(`${sid}:`)) {
            nets.add(netId);
          }
        }
      });
    }
    if (selectedPin) {
      const netId = netIndex.pinNet.get(`${selectedPin.nodeId}:${selectedPin.pinIndex}`);
      if (netId !== undefined) nets.add(netId);
    }
    if (selectedTrackId && project.doc.pcb) {
      const trackNetMap = computeTrackNets(project.doc, project.doc.pcb);
      const netId = trackNetMap.get(selectedTrackId);
      if (netId !== undefined) nets.add(netId);
    }

    return Array.from(nets);
  }, [selectedWireIds, selectedIds, selectedPin, selectedTrackId, project]);

  // React defers recomputing these (heavy, whole-board) checks while a higher-priority
  // update is in flight — e.g. every pointermove while dragging a footprint/track/pan/zoom.
  // Without this, ecoDiff/designChecks re-ran synchronously on every animation frame of any
  // drag, which is the main cause of "selecting/dragging/zooming feels frozen" on imported boards.
  const deferredProject = useDeferredValue(project);

  const ecoDiff = useMemo(() => {
    const emptyDiff = { add: [], remove: [], update: [], nets: { added: [], removed: [], changed: [] }, labels: { added: [], removed: [], renamed: [] }, multiUnit: { physicalComponents: 0, consolidated: [], conflicts: [] }, blocked: [], warnings: [] };
    if (!deferredProject) return emptyDiff;
    const pcbDoc = deferredProject.doc.pcb;
    // ECO (schematic<->PCB) sync is meaningless for boards imported directly from Gerber or
    // native KiCad .kicad_pcb files: there is no reliable matching schematic to diff against,
    // and running the comparison over every imported footprint/net is pure wasted work that
    // re-triggers on every edit. Skip it entirely for those boards (matches isKiCadPcbBoard()
    // used elsewhere in this codebase for the same reason).
    if (pcbDoc?.isImportedGerber || isKiCadPcbBoard(pcbDoc)) return emptyDiff;
    return computeEcoDiff(deferredProject.doc, pcbDoc);
  }, [deferredProject]);

  const hasEcoChanges = ecoDiff.add.length > 0 || ecoDiff.remove.length > 0 || ecoDiff.update.length > 0 || ecoDiff.nets.added.length > 0 || ecoDiff.nets.removed.length > 0 || ecoDiff.nets.changed.length > 0 || ecoDiff.labels.added.length > 0 || ecoDiff.labels.removed.length > 0 || ecoDiff.multiUnit.conflicts.length > 0;
  const designChecks = useMemo<DesignCheckResult>(() => {
    if (!deferredProject) {
      return {
        erc: [],
        drc: [],
        allErc: [],
        allDrc: [],
        ignoredErc: [],
        ignoredDrc: [],
        errors: [],
        warnings: [],
        allErrors: [],
        allWarnings: [],
        passed: true,
        checkedAt: 0,
      };
    }
    try {
      // Note: runDRC() already returns [] immediately for KiCad-imported boards
      // (isKiCadPcbBoard check inside designRules.ts), so the real pcb doc is passed
      // through as-is here — the useDeferredValue above is what stops this whole memo
      // from re-running synchronously on every drag frame.
      return runDesignChecks(deferredProject.doc, deferredProject.doc.pcb, ignoredIssueIds);
    } catch (error) {
      console.error("Design rule check failed", error);
      const runtimeErr = {
        id: "DRC-RUNTIME",
        domain: "DRC" as const,
        severity: "warning" as const,
        code: "DRC-RUNTIME",
        message: error instanceof Error ? error.message : String(error),
      };
      return {
        erc: [],
        drc: [runtimeErr],
        allErc: [],
        allDrc: [runtimeErr],
        ignoredErc: [],
        ignoredDrc: [],
        errors: [],
        warnings: [runtimeErr],
        allErrors: [],
        allWarnings: [runtimeErr],
        passed: false,
        checkedAt: Date.now(),
      };
    }
  }, [deferredProject, ignoredIssueIds]);

  // Ghost placement state
  const [placement, setPlacement] = useState<{
    symbol?: SymbolId;
    rotation?: 0 | 90 | 180 | 270;
    multi?: { nodes: SchematicNode[]; wires: SchematicWire[] };
  } | null>(null);

  // Interactive settings
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [connModalOpen, setConnModalOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [leftMenuOpen, setLeftMenuOpen] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridStyle, setGridStyle] = useState<GridStyle>("dots");
  const [gridOpacity, setGridOpacity] = useState(0.5);
  const [wireStyle, setWireStyle] = useState<WireStyle>("ortho");
  const [wireColor, setWireColor] = useState<WireColor>("black");
  const [showUI, setShowUI] = useState(true);
  const [locateSignal, setLocateSignal] = useState<{ id: string; t: number } | null>(null);

  useEffect(() => {
    loadProject();
  }, [id]);

  useEffect(() => {
    if (simulationOpen) {
      setActiveTool("pan");
    }
  }, [simulationOpen]);

  const togglePreviewMode = () => {
    setShowUI(!showUI);
    if (showUI) {
      toast.info(lang === "ar" ? "تم تفعيل وضع المعاينة" : "Preview mode activated");
    }
  };

  const loadProject = async () => {
    if (!id) {
      setLoading(false);
      return;
    }
    try {
      const p = await getProject(id);
      if (p) {
        setProject(p);
        if (p.doc.defaultWireColor) {
          setWireColor(p.doc.defaultWireColor);
        }
        
        // Auto-switch to pcb mode if it's an imported Gerber (pure PCB elements, no schematic nodes)
        if (p.doc.pcb && 
            ((p.doc.pcb.tracks && p.doc.pcb.tracks.length > 0) || 
             (p.doc.pcb.pads && p.doc.pcb.pads.length > 0) || 
             (p.doc.pcb.vias && p.doc.pcb.vias.length > 0)) && 
            (!p.doc.nodes || p.doc.nodes.length === 0)) {
          setMode("pcb");
        }
      } else {
        toast.error(lang === "ar" ? "المشروع غير موجود" : "Project not found");
        navigate("/");
      }
    } catch (e) {
      console.error(e);
      toast.error(lang === "ar" ? "فشل تحميل المشروع" : "Failed to load project");
    } finally {
      setLoading(false);
    }
  };

  // saveProjectState is the single write path for every document edit, including the
  // continuous stream of updates fired on each pointermove while dragging a footprint/
  // track/via or resizing the board. setProject() must stay synchronous so dragging feels
  // instant, but persisting to storage on every one of those frames (previously an `await
  // updateProject(...)` on every call) turned every drag/pan gesture into a rapid-fire
  // sequence of storage writes. Persistence is now debounced: only the last state within a
  // short idle window is actually written, and it's flushed immediately on unmount so no
  // edit is lost if the user navigates away mid-gesture.
  const persistDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPersistRef = useRef<{ projectId: string; doc: SchematicDoc } | null>(null);

  const flushPendingPersist = useStableCallback(() => {
    if (persistDebounceRef.current) {
      clearTimeout(persistDebounceRef.current);
      persistDebounceRef.current = null;
    }
    const pending = pendingPersistRef.current;
    if (!pending) return;
    pendingPersistRef.current = null;
    updateProject(pending.projectId, {
      doc: pending.doc,
      updatedAt: Date.now(),
    }).catch((e) => console.error(e));
  });

  useEffect(() => {
    return () => {
      flushPendingPersist();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProjectState = (newDoc: SchematicDoc) => {
    if (!project) return;
    latestDocRef.current = newDoc;

    if (!newDoc.pcb) {
      newDoc.pcb = emptyPcbDoc();
    }

    const updated = {
      ...project,
      doc: newDoc,
      updatedAt: Date.now(),
    };
    setProject(updated);

    pendingPersistRef.current = { projectId: project.id, doc: newDoc };
    if (persistDebounceRef.current) clearTimeout(persistDebounceRef.current);
    persistDebounceRef.current = setTimeout(() => {
      persistDebounceRef.current = null;
      flushPendingPersist();
    }, 350);
  };

  const handleAddNetLabel = (overrideText?: string) => {
    if (!project) return;
    const textToAdd = (overrideText ?? netLabelText).trim();
    if (!textToAdd) {
      toast.error(lang === "ar" ? "يرجى إدخال اسم التسمية الشبكية" : "Please enter a net label name");
      return;
    }
    const label: import("@/lib/schematic").SchematicNetLabel = {
      id: crypto.randomUUID(),
      text: textToAdd,
      x: Number(netLabelX) || 0,
      y: Number(netLabelY) || 0,
      scope: netLabelScope,
      rotation: netLabelRotation,
      visible: true,
    };
    pushToHistory(project.doc);
    setDoc(d => ({ ...d, netLabels: [...(d.netLabels ?? []), label] }));
    setNetLabelText("");
    toast.success(lang === "ar" ? `تمت إضافة التسمية الشبكية "${textToAdd}"` : `Net Label "${textToAdd}" added`);
  };

  const handleDeleteNetLabel = (id: string) => {
    if (!project) return;
    pushToHistory(project.doc);
    setDoc(d => ({ ...d, netLabels: (d.netLabels ?? []).filter(l => l.id !== id) }));
    if (editingLabelId === id) setEditingLabelId(null);
    toast.info(lang === "ar" ? "تم حذف التسمية الشبكية" : "Net label removed");
  };

  const handleDuplicateNetLabel = (label: import("@/lib/schematic").SchematicNetLabel) => {
    if (!project) return;
    pushToHistory(project.doc);
    const dup: import("@/lib/schematic").SchematicNetLabel = {
      ...label,
      id: crypto.randomUUID(),
      x: label.x + 2,
      y: label.y + 2,
    };
    setDoc(d => ({ ...d, netLabels: [...(d.netLabels ?? []), dup] }));
    toast.success(lang === "ar" ? "تم نسخ التسمية الشبكية" : "Net label duplicated");
  };

  const handleStartEditNetLabel = (label: import("@/lib/schematic").SchematicNetLabel) => {
    setEditingLabelId(label.id);
    setEditLabelText(label.text);
    setEditLabelX(String(label.x));
    setEditLabelY(String(label.y));
    setEditLabelScope(label.scope ?? "local");
    setEditLabelRotation(label.rotation ?? 0);
  };

  const handleSaveEditNetLabel = (id: string) => {
    if (!project || !editLabelText.trim()) return;
    pushToHistory(project.doc);
    setDoc(d => ({
      ...d,
      netLabels: (d.netLabels ?? []).map(l =>
        l.id === id
          ? {
              ...l,
              text: editLabelText.trim(),
              x: Number(editLabelX) || 0,
              y: Number(editLabelY) || 0,
              scope: editLabelScope,
              rotation: editLabelRotation,
            }
          : l
      ),
    }));
    setEditingLabelId(null);
    toast.success(lang === "ar" ? "تم حفظ تعديل التسمية" : "Net label updated");
  };

  const handleClearAllNetLabels = () => {
    if (!project || !(project.doc.netLabels?.length)) return;
    pushToHistory(project.doc);
    setDoc(d => ({ ...d, netLabels: [] }));
    setEditingLabelId(null);
    toast.info(lang === "ar" ? "تم حذف كافة التسميات الشبكية" : "All net labels cleared");
  };

  const handleApplyEco = () => {
    if (!project) return;
    if (ecoDiff.blocked.length > 0) {
      toast.error(lang === "ar" ? `لا يمكن تطبيق ECO: توجد ${ecoDiff.blocked.length} تغييرات محجوزة للمراجعة.` : `ECO blocked: ${ecoDiff.blocked.length} change(s) require manual review.`);
      return;
    }
    pushToHistory(project.doc);
    const currentPcb = project.doc.pcb ?? emptyPcbDoc();
    const syncedPcb = syncPcbWithSchematic(project.doc, currentPcb, packageSelections);
    const validation = validateSchematicPcbLink(project.doc, syncedPcb);
    const nextDoc = {
      ...project.doc,
      pcb: syncedPcb,
    };
    saveProjectState(nextDoc);
    setEcoOpen(false);
    if (validation.ok) {
      toast.success(
        lang === "ar"
          ? `تمت مزامنة PCB بنجاح: ${validation.components} مكوّن و${validation.nets} شبكة.`
          : `PCB synchronized: ${validation.components} components and ${validation.nets} nets.`
      );
    } else {
      toast.warning(
        lang === "ar"
          ? `تمت المزامنة مع ${validation.errors.length} مشكلة تحتاج مراجعة.`
          : `Synchronization completed with ${validation.errors.length} issue(s) requiring review.`
      );
    }
  };

  const handlePullFootprintAssignments = () => {
    if (!project?.doc.pcb) return;
    pushToHistory(project.doc);
    const nextDoc = reconcileAssignmentsFromPcb(project.doc, project.doc.pcb);
    saveProjectState(nextDoc);
    toast.success(
      lang === "ar"
        ? "تم اعتماد ارتباطات Footprints من PCB إلى المخطط."
        : "PCB Footprint assignments adopted into the Schematic."
    );
  };

  const handleUpdateDefaultWireColor = (color: WireColor) => {
    setWireColor(color);
    setDoc((d) => ({
      ...d,
      defaultWireColor: color,
    }));
  };

  const handleUpdateDefaultElementColor = (color: WireColor) => {
    setDoc((d) => ({
      ...d,
      defaultElementColor: color,
    }));
  };

  const handleUpdateDefaultWireWidth = (width: number) => {
    setDoc((d) => ({
      ...d,
      defaultWireWidth: width,
    }));
  };

  const handleUpdateDefaultNodeSize = (size: number) => {
    setDoc((d) => ({
      ...d,
      defaultNodeSize: size,
    }));
  };

  const pushToHistory = (doc: SchematicDoc) => {
    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(doc))]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (history.length === 0 || !project) return;
    const previous = history[history.length - 1];
    const newHistory = history.slice(0, -1);

    setRedoStack((prev) => [...prev, JSON.parse(JSON.stringify(project.doc))]);
    setHistory(newHistory);
    saveProjectState(previous);
    setSelectedIds([]);
    setSelectedWireIds([]);
    setSelectedTrackId(null);
    setSelectedPin(null);
  };

  const handleRedo = () => {
    if (redoStack.length === 0 || !project) return;
    const next = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);

    setHistory((prev) => [...prev, JSON.parse(JSON.stringify(project.doc))]);
    setRedoStack(newRedo);
    saveProjectState(next);
    setSelectedIds([]);
    setSelectedWireIds([]);
    setSelectedTrackId(null);
    setSelectedPin(null);
  };

  // Global Keyboard shortcuts for Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input, textarea or editable element
      const tgt = e.target as HTMLElement | null;
      const tag = tgt?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tgt?.isContentEditable) {
        return;
      }

      const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      if (isCmdOrCtrl) {
        if (e.key === "z" || e.key === "Z") {
          e.preventDefault();
          if (e.shiftKey) {
            handleRedo();
          } else {
            handleUndo();
          }
        } else if (e.key === "y" || e.key === "Y") {
          e.preventDefault();
          handleRedo();
        }
      }

      if (e.key === "Escape") {
        setPlacement(null);
        setLibraryOpen(false);
        setPropertiesOpen(false);
        setLeftMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [history, redoStack, project]);

  // Cancel component placement when user clicks any button outside toolbox/library
  useEffect(() => {
    if (!placement) return;

    const handleButtonPointerDown = (e: MouseEvent | PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Allow clicks inside component toolbox or component library
      if (target.closest("[data-component-toolbox]") || target.closest("[data-component-library]")) {
        return;
      }

      // If any button or menu control is clicked, exit placement mode
      const isButton = target.closest("button, [role='button'], [role='menuitem'], [role='tab']");
      if (isButton) {
        setPlacement(null);
      }
    };

    window.addEventListener("pointerdown", handleButtonPointerDown, true);
    return () => {
      window.removeEventListener("pointerdown", handleButtonPointerDown, true);
    };
  }, [placement]);

  // Sidebar element click -> sets placement ghost
  const handlePickComponent = (symId: SymbolId) => {
    setPlacement({ symbol: symId, rotation: 0 });
    setActiveTool("select");
    setLibraryOpen(false); // Close library box on component selection
    if (!isSchematicLike) {
      setMode("schematic");
      toast.info(lang === "ar" ? "تم الانتقال للمخطط لوضع العنصر" : "Switched to Schematic to place component");
    }
  };

  const handleNodeChange = (patch: Partial<SchematicNode>) => {
    if (!project || selectedIds.length === 0) return;
    pushToHistory(project.doc);
    const nextDoc = {
      ...project.doc,
      nodes: project.doc.nodes.map((n) => (selectedIds.includes(n.id) ? { ...n, ...patch } : n)),
    };
    saveProjectState(nextDoc);
  };

  const handleNodeRotate = () => {
    if (!project || selectedIds.length === 0) return;
    pushToHistory(project.doc);
    const nextDoc = {
      ...project.doc,
      nodes: project.doc.nodes.map((n) => {
        if (selectedIds.includes(n.id)) {
          return {
            ...n,
            rotation: ((n.rotation + 90) % 360) as 0 | 90 | 180 | 270,
          };
        }
        return n;
      }),
    };
    saveProjectState(nextDoc);
  };

  const handleNodeDelete = () => {
    if (!project || (selectedIds.length === 0 && selectedWireIds.length === 0)) return;
    pushToHistory(project.doc);
    
    const nextDoc = { ...project.doc };

    if (selectedWireIds.length > 0) {
      nextDoc.wires = nextDoc.wires.filter((w) => !selectedWireIds.includes(w.id));
    }
    
    if (selectedIds.length > 0) {
      const nodesToDelete = nextDoc.nodes.filter((n) => selectedIds.includes(n.id));
      nextDoc.nodes = nextDoc.nodes.filter((n) => !selectedIds.includes(n.id));

      // Auto re-numbering for each prefix deleted
      const prefixes = new Set<string>();
      nodesToDelete.forEach(node => {
        if (node.reference) {
          const match = node.reference.match(/^([a-zA-Z]+)(\d+)$/);
          if (match) prefixes.add(match[1]);
        }
      });

      prefixes.forEach(prefix => {
        const nodesWithPrefix = nextDoc.nodes
          .filter(n => n.reference && n.reference.startsWith(prefix) && /^\d+$/.test(n.reference.slice(prefix.length)))
          .sort((a, b) => {
            const numA = parseInt(a.reference!.slice(prefix.length));
            const numB = parseInt(b.reference!.slice(prefix.length));
            return numA - numB;
          });
          
        nodesWithPrefix.forEach((n, idx) => {
          n.reference = `${prefix}${idx + 1}`;
        });
      });
    }

    saveProjectState(nextDoc);
    setSelectedIds([]);
    setSelectedWireIds([]);
  };

  const handleWireChange = (patch: Partial<SchematicWire>) => {
    if (!project || selectedWireIds.length === 0) return;
    pushToHistory(project.doc);
    const nextDoc = {
      ...project.doc,
      wires: project.doc.wires.map((w) => (selectedWireIds.includes(w.id) ? { ...w, ...patch } : w)),
    };
    saveProjectState(nextDoc);
  };

  const handleWireDelete = () => {
    if (!project || selectedWireIds.length === 0) return;
    pushToHistory(project.doc);
    const nextDoc = {
      ...project.doc,
      wires: project.doc.wires.filter((w) => !selectedWireIds.includes(w.id)),
    };
    saveProjectState(nextDoc);
    setSelectedWireIds([]);
  };

  // Canvas prop wrappers
  const setDoc = useStableCallback((updater: (d: SchematicDoc) => SchematicDoc, noHistory = false) => {
    if (!project) return;
    if (!noHistory) pushToHistory(project.doc);
    const nextDoc = updater(project.doc);
    saveProjectState(nextDoc);
  });

  const setPcb = useStableCallback((updater: (p: PcbDoc) => PcbDoc, noHistory = false) => {
    if (!project) return;
    if (!noHistory) pushToHistory(project.doc);
    const currentPcb = project.doc.pcb ?? emptyPcbDoc();
    const nextPcb = updater(currentPcb);
    const nextDoc = {
      ...project.doc,
      pcb: nextPcb,
    };
    saveProjectState(nextDoc);
  });

  const commitHistory = useStableCallback(() => {
    if (!project) return;
    pushToHistory(project.doc);
  });

  const handleIgnoreIssue = (issueId: string) => {
    const next = Array.from(new Set([...ignoredIssueIds, issueId]));
    setIgnoredIssueIds(next);
    if (project) {
      setDoc(d => ({ ...d, ignoredIssues: next }), true);
    }
    toast.info(lang === "ar" ? "تم تجاهل الخطأ" : "Issue ignored");
  };

  const handleUnignoreIssue = (issueId: string) => {
    const next = ignoredIssueIds.filter(id => id !== issueId);
    setIgnoredIssueIds(next);
    if (project) {
      setDoc(d => ({ ...d, ignoredIssues: next }), true);
    }
    toast.success(lang === "ar" ? "تمت استعادة الخطأ" : "Issue restored");
  };

  const handleIgnoreAll = (domain?: "ERC" | "DRC") => {
    const targetIssues = domain === "ERC"
      ? designChecks.erc
      : domain === "DRC"
      ? designChecks.drc
      : [...designChecks.erc, ...designChecks.drc];

    if (targetIssues.length === 0) return;
    const newIds = targetIssues.map(i => i.id);
    const next = Array.from(new Set([...ignoredIssueIds, ...newIds]));
    setIgnoredIssueIds(next);
    if (project) {
      setDoc(d => ({ ...d, ignoredIssues: next }), true);
    }
    toast.info(
      lang === "ar"
        ? `تم تجاهل كافة ملاحظات ${domain ? (domain === "ERC" ? "المخطط (ERC)" : "اللوحة (DRC)") : "التصميم"} (${newIds.length})`
        : `Ignored all ${domain || "design"} issues (${newIds.length})`
    );
  };

  const handleRestoreAll = (domain?: "ERC" | "DRC") => {
    const targetIgnored = domain === "ERC"
      ? designChecks.ignoredErc
      : domain === "DRC"
      ? designChecks.ignoredDrc
      : [...designChecks.ignoredErc, ...designChecks.ignoredDrc];

    if (targetIgnored.length === 0) return;
    const idsToRemove = new Set(targetIgnored.map(i => i.id));
    const next = ignoredIssueIds.filter(id => !idsToRemove.has(id));
    setIgnoredIssueIds(next);
    if (project) {
      setDoc(d => ({ ...d, ignoredIssues: next }), true);
    }
    toast.success(
      lang === "ar"
        ? `تمت استعادة كافة ملاحظات ${domain ? (domain === "ERC" ? "المخطط (ERC)" : "اللوحة (DRC)") : "التصميم"} (${idsToRemove.size})`
        : `Restored all ${domain || "design"} issues (${idsToRemove.size})`
    );
  };

  const handleQuickSaveZuit = () => {
    if (!project) return;
    const cleanFilename = project.name.trim().replace(/\s+/g, "_") || "project";
    downloadZuit(project.doc, cleanFilename, {
      description: project.description,
      createdAt: project.createdAt,
      undoStack: history,
      redoStack: redoStack,
      simulation: {
        faults: project.doc.faults || [],
        bookmarks: project.doc.bookmarks || [],
        userModels: project.doc.userModels || [],
      },
      realistic: {
        viewMode: "3d_workbench",
        showComponents: true,
        boardColor: "#064e3b",
        copperColor: "#d97706",
        silkscreenColor: "#ffffff",
      },
    });
    toast.success(
      lang === "ar"
        ? "تم حفظ وتصدير ملف Zuit الشامل بحفظ جميع الوحدات وسجل التراجع بنجاح!"
        : "Zuit full project saved with all 4 modules and undo history!"
    );
  };

  const executeModalImport = (type: "zuit" | "schematic" | "pcb") => {
    if (!project) return;
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = type === "pcb";
    input.accept = type === "zuit" 
        ? ".zuit"
        : type === "pcb" 
        ? ".kicad_pcb,.kicad-pcb,.zip,.gbr,.ger,.gtl,.gbl,.gko,.gts,.gbs,.gto,.gbo,.gml,.profile,.gm1,.gm20,.drl,.txt,.xln,.cmp,.sol,.plc,.pls,.stc,.sts"
        : ".zuit,.json,.xml,.kicad_sch,.sch,.cir,.net,.spice,.sp,.txt";

    input.onchange = async (e: any) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const fileList = Array.from(files) as File[];
      const mainFile = fileList[0];
      const mainFileName = mainFile.name.toLowerCase();

      // Detect KiCad PCB (.kicad_pcb)
      if (fileList.length === 1 && (mainFileName.endsWith(".kicad_pcb") || mainFileName.endsWith(".kicad-pcb"))) {
        const text = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsText(mainFile);
        });

        if (isKiCadPcbContent(text)) {
          try {
            const { doc } = parseKiCadPcb(text, mainFile.name, lang);
            pushToHistory(project.doc);
            saveProjectState(doc);
            setExportDialogOpen(false);
            setImportDialogOpen(false);
            toast.success(lang === "ar" ? "تم استيراد لوحة KiCad PCB بنجاح!" : "KiCad PCB board imported successfully!");
          } catch (err) {
            console.error(err);
            toast.error(lang === "ar" ? "فشل استيراد ملف KiCad PCB" : "Failed to import KiCad PCB file");
          }
          return;
        }
      }

      // Detect ODB++ zip
      if (fileList.length === 1 && mainFileName.endsWith(".zip")) {
        const isOdb = await isOdbZip(mainFile);
        if (isOdb) {
          try {
            const { doc } = await parseOdbZipToProject(mainFile, lang);
            pushToHistory(project.doc);
            saveProjectState(doc);
            setExportDialogOpen(false);
            setImportDialogOpen(false);
            toast.success(lang === "ar" ? "تم استيراد ملف ODB++ بنجاح!" : "ODB++ file imported successfully!");
          } catch (err) {
            console.error(err);
            toast.error(lang === "ar" ? "فشل استيراد ملف ODB++" : "Failed to import ODB++ file");
          }
          return;
        }
      }

      // Detect IPC-2581 XML
      if (fileList.length === 1 && mainFileName.endsWith(".xml")) {
        const text = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsText(mainFile);
        });

        if (isIpc2581Content(text)) {
          try {
            const { doc } = parseIpc2581(text, mainFile.name, lang);
            pushToHistory(project.doc);
            saveProjectState(doc);
            setExportDialogOpen(false);
            setImportDialogOpen(false);
            toast.success(lang === "ar" ? "تم استيراد ملف IPC-2581 بنجاح!" : "IPC-2581 file imported successfully!");
          } catch (err) {
            console.error(err);
            toast.error(lang === "ar" ? "فشل استيراد ملف IPC-2581" : "Failed to import IPC-2581 file");
          }
          return;
        }
      }

      // Gerber files or ZIP
      const hasGerber = fileList.some(file => {
        const fn = file.name.toLowerCase();
        return (
          fn.endsWith(".zip") || fn.endsWith(".gbr") || fn.endsWith(".ger") ||
          fn.endsWith(".gtl") || fn.endsWith(".gbl") || fn.endsWith(".gko") ||
          fn.endsWith(".gts") || fn.endsWith(".gbs") || fn.endsWith(".gto") ||
          fn.endsWith(".gbo") || fn.endsWith(".drl") || fn.endsWith(".txt")
        );
      });

      if (hasGerber || (type === "pcb" && fileList.length > 0)) {
        try {
          const { doc } = await importGerberToProject(fileList, lang);
          pushToHistory(project.doc);
          saveProjectState(doc);
          setExportDialogOpen(false);
          setImportDialogOpen(false);
          toast.success(lang === "ar" ? "تم استيراد ملفات الجيربر و PCB بنجاح!" : "Gerber & PCB files imported successfully!");
        } catch (err) {
          console.error(err);
          toast.error(lang === "ar" ? "فشل استيراد ملفات Gerber" : "Failed to import Gerber files");
        }
        return;
      }

      // Standard Schematic / Zuit / KiCad / EasyEDA / Eagle / SPICE Netlist File
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const text = ev.target?.result as string;

          // 0. Try KiCad PCB (.kicad_pcb)
          if (isKiCadPcbContent(text)) {
            const kicadRes = parseKiCadPcb(text, mainFile.name, lang);
            pushToHistory(project.doc);
            saveProjectState(kicadRes.doc);
            setExportDialogOpen(false);
            setImportDialogOpen(false);
            toast.success(lang === "ar" ? "تم استيراد لوحة KiCad PCB بنجاح!" : "KiCad PCB board imported successfully!");
            return;
          }

          // 1. Try specialized schematic format detector first
          const detected = detectAndParseSchematic(text, mainFile.name, lang);
          if (detected && detected.doc) {
            pushToHistory(project.doc);
            saveProjectState(detected.doc);
            setExportDialogOpen(false);
            setImportDialogOpen(false);
            toast.success(
              lang === "ar"
                ? `تم استيراد مخطط ${detected.formatName || "Schematic"} بنجاح!`
                : `${detected.formatName || "Schematic"} file imported successfully!`
            );
            return;
          }

          // 2. Try Zuit project file
          const zuitRes = readZuit(text);
          if (zuitRes) {
            pushToHistory(project.doc);
            saveProjectState(zuitRes.doc);
            if (zuitRes.undoStack && zuitRes.undoStack.length > 0) setHistory(zuitRes.undoStack);
            if (zuitRes.redoStack && zuitRes.redoStack.length > 0) setRedoStack(zuitRes.redoStack);
            setExportDialogOpen(false);
            setImportDialogOpen(false);
            toast.success(
              lang === "ar"
                ? "تم استيراد مشروع Zuit الشامل بنجاح!"
                : "Zuit full project imported successfully!"
            );
            return;
          }

          // 3. Fallback raw JSON schematic
          const trimmedText = text.trim();
          if (!trimmedText.startsWith("{") && !trimmedText.startsWith("[")) throw new Error("Not a JSON file");
          const parsed = JSON.parse(text);
          const docToUse = parsed.doc || parsed.schematic || parsed;
          if (docToUse.nodes || docToUse.wires) {
            pushToHistory(project.doc);
            saveProjectState(docToUse);
            setExportDialogOpen(false);
            setImportDialogOpen(false);
            toast.success(lang === "ar" ? "تم استيراد الملف بنجاح!" : "File imported successfully!");
          } else {
            toast.error(lang === "ar" ? "صيغة الملف غير مدعومة" : "Unsupported file format");
          }
        } catch (err) {
          console.error(err);
          toast.error(lang === "ar" ? "فشل استيراد الملف" : "Failed to import file");
        }
      };
      reader.readAsText(mainFile);
    };

    input.click();
  };

  // Exports
  const handleOpenExportDialog = (format: string, target: "schematic" | "pcb" | "realistic") => {
    if (project) {
      setExportFilename(project.name);
    }
    setExportFormat(format);
    setExportTarget(target);
    setExportDialogOpen(true);
  };

  const triggerExport = async () => {
    if (!project) return;
    const cleanFilename = exportFilename.trim().replace(/\s+/g, "_") || "project";
    
    try {
      if (exportFormat === "zuit") {
        downloadZuit(project.doc, cleanFilename, {
          description: project.description,
          createdAt: project.createdAt,
          undoStack: history,
          redoStack: redoStack,
          simulation: {
            faults: project.doc.faults || [],
            bookmarks: project.doc.bookmarks || [],
            userModels: project.doc.userModels || [],
          },
          realistic: {
            viewMode: "3d_workbench",
            showComponents: true,
            boardColor: "#064e3b",
            copperColor: "#d97706",
            silkscreenColor: "#ffffff",
          },
        });
        toast.success(
          lang === "ar"
            ? `تم تصدير مشروع Zuit الشامل (.zuit) بنجاح مع سجل التراجع وكافة الوحدات إلى ${selectedDirectory}`
            : `Full Zuit project file (.zuit) exported successfully with complete undo history to ${selectedDirectory}`
        );
        return;
      }

      if (exportTarget === "schematic" || exportTarget === "realistic") {
        const isRealistic = exportTarget === "realistic";
        if (exportFormat === "kicad_sch") {
          downloadKiCadSch(project.doc, cleanFilename);
          toast.success(lang === "ar" ? `تم تصدير مخطط KiCad (.kicad_sch) بنجاح إلى ${selectedDirectory}` : `KiCad schematic (.kicad_sch) exported successfully to ${selectedDirectory}`);
        } else if (exportFormat === "easyeda") {
          downloadEasyEdaJson(project.doc, cleanFilename);
          toast.success(lang === "ar" ? `تم تصدير مخطط EasyEDA JSON بنجاح إلى ${selectedDirectory}` : `EasyEDA schematic JSON exported successfully to ${selectedDirectory}`);
        } else if (exportFormat === "eagle_sch") {
          downloadEagleSch(project.doc, cleanFilename);
          toast.success(lang === "ar" ? `تم تصدير مخطط Eagle SCH (.sch) بنجاح إلى ${selectedDirectory}` : `Eagle schematic (.sch) exported successfully to ${selectedDirectory}`);
        } else if (exportFormat === "spice") {
          downloadSpiceNetlist(project.doc, cleanFilename);
          toast.success(lang === "ar" ? `تم تصدير صافي شبكة SPICE (.cir) بنجاح إلى ${selectedDirectory}` : `SPICE Netlist (.cir) exported successfully to ${selectedDirectory}`);
        } else if (exportFormat === "json") {
          const blob = new Blob([JSON.stringify(project)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `${cleanFilename}.cirzuit.json`;
          a.click();
          URL.revokeObjectURL(url);
          toast.success(lang === "ar" ? `تم تصدير ملف JSON بنجاح إلى ${selectedDirectory}` : `JSON exported successfully to ${selectedDirectory}`);
        } else if (exportFormat === "xml") {
          downloadXmlProject(project.doc, cleanFilename, {
            description: project.description,
            createdAt: project.createdAt,
            undoStack: history,
            redoStack: redoStack,
            simulation: {
              faults: project.doc.faults || [],
              bookmarks: project.doc.bookmarks || [],
              userModels: project.doc.userModels || [],
            },
            realistic: {
              viewMode: "3d_workbench",
              showComponents: true,
              boardColor: "#064e3b",
              copperColor: "#d97706",
              silkscreenColor: "#ffffff",
            },
          });
          toast.success(lang === "ar" ? `تم تصدير ملف XML بنجاح إلى ${selectedDirectory}` : `XML file exported successfully to ${selectedDirectory}`);
        } else if (exportFormat === "jpeg" || exportFormat === "png" || exportFormat === "svg" || exportFormat === "pdf") {
          await exportImage(project.doc, exportFormat as any, cleanFilename, { realistic: isRealistic });
          toast.success(lang === "ar" ? `تم تصدير الصورة بنجاح إلى ${selectedDirectory}` : `Image exported successfully to ${selectedDirectory}`);
        }
      } else if (exportTarget === "pcb") {
        const pcbDoc = project.doc.pcb ?? emptyPcbDoc();
        if (exportFormat === "bom") {
          await downloadBomXlsx(project.doc, cleanFilename);
          toast.success(lang === "ar" ? `تم تصدير ملف BOM بصيغة XLSX بنجاح إلى ${selectedDirectory}` : `BOM exported as XLSX successfully to ${selectedDirectory}`);
        } else if (exportFormat === "ncdrill") {
          downloadNcDrillFile(pcbDoc, cleanFilename);
          toast.success(lang === "ar" ? `تم تصدير ملف NC Drill بنجاح إلى ${selectedDirectory}` : `NC Drill file exported successfully to ${selectedDirectory}`);
        } else if (exportFormat === "gerber") {
          await downloadGerberZip(pcbDoc, project.doc, cleanFilename, "rs274x");
          toast.success(lang === "ar" ? `تم تصدير حزمة ملفات Gerber RS-274X بنجاح (ZIP) إلى ${selectedDirectory}` : `Gerber RS-274X package exported successfully (ZIP) to ${selectedDirectory}`);
        } else if (exportFormat === "gerber_x2") {
          await downloadGerberZip(pcbDoc, project.doc, cleanFilename, "x2");
          toast.success(lang === "ar" ? `تم تصدير حزمة ملفات Gerber X2 بنجاح (ZIP) إلى ${selectedDirectory}` : `Gerber X2 package exported successfully (ZIP) to ${selectedDirectory}`);
        } else if (exportFormat === "pdf") {
          if (diyPcbPdfType === "toner_transfer") {
            await exportPcbTonerTransferPdf(pcbDoc, {
              layer: diyPcbLayer,
              mirror: diyPcbMirror,
              invert: diyPcbInvert,
              drillGuide: diyPcbDrillGuide,
              showOutline: diyPcbOutline,
              numCopies: diyPcbCopies,
            }, cleanFilename);
            toast.success(lang === "ar" ? `تم تصدير ملف PDF للطباعة بنسبة 1:1 بنجاح إلى ${selectedDirectory}` : `1:1 printable PDF file exported successfully to ${selectedDirectory}`);
          } else {
            await exportPcbImage(pcbDoc, "pdf", cleanFilename);
            toast.success(lang === "ar" ? `تم تصدير صورة اللوحة الملونة PDF بنجاح إلى ${selectedDirectory}` : `Full-color board PDF exported successfully to ${selectedDirectory}`);
          }
        } else if (exportFormat === "png" || exportFormat === "svg" || exportFormat === "jpeg") {
          await exportPcbImage(pcbDoc, exportFormat, cleanFilename);
          toast.success(lang === "ar" ? `تم تصدير مظهر لوحة PCB بنجاح إلى ${selectedDirectory}` : `PCB layout exported successfully to ${selectedDirectory}`);
        } else if (exportFormat === "xml") {
          downloadXmlProject(project.doc, cleanFilename, {
            description: project.description,
            createdAt: project.createdAt,
            undoStack: history,
            redoStack: redoStack,
          });
          toast.success(lang === "ar" ? `تم تصدير ملف PCB بصيغة XML بنجاح إلى ${selectedDirectory}` : `PCB XML exported successfully to ${selectedDirectory}`);
        } else {
          toast.success(lang === "ar" ? `تم تصدير ${exportFormat} للوحة PCB إلى ${selectedDirectory}` : `Exported PCB ${exportFormat} to ${selectedDirectory}`);
        }
      }
      // Note: We deliberately do not close the export dialog automatically, as requested, to allow successive exports.
    } catch (err) {
      console.error("Export error:", err);
      toast.error(lang === "ar" ? "فشل تصدير الملف" : "Failed to export file");
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-screen bg-background flex flex-col items-center justify-center gap-4">
        <Cpu className="h-10 w-10 text-primary animate-spin" />
        <p className="text-sm font-mono text-muted-foreground animate-pulse">Loading board space...</p>
      </div>
    );
  }

  if (!project) return null;

  const selectedId = selectedIds[0] || null;
  const setSelectedId = (id: string | null) => {
    setSelectedIds(id ? [id] : []);
  };
  const selectedWireId = selectedWireIds[0] || null;
  const setSelectedWireId = (id: string | null) => {
    setSelectedWireIds(id ? [id] : []);
  };
  const selectedNode = project.doc.nodes.find((n) => n.id === selectedId) || null;
  const selectedWire = project.doc.wires.find((w) => w.id === selectedWireId) || null;

  return (
    <div className="h-screen w-screen bg-background flex flex-col overflow-hidden select-none">
      {/* Top Header */}
      <AnimatePresence>
        {showUI && (
          <motion.header 
            initial={{ y: -60 }}
            animate={{ y: 0 }}
            exit={{ y: -60 }}
            transition={{ type: "spring", damping: 20, stiffness: 120 }}
            className="h-11 border-b bg-card flex items-center gap-2 px-3 shrink-0 z-30 relative"
          >
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>

        <div className="flex items-center gap-1 ml-1">
            <div className="flex flex-col">
              <h2 className="text-sm font-bold text-foreground max-w-[40px] sm:max-w-[60px] truncate" title={project.name}>
                {project.name}
              </h2>
              <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
                IDB Auto-saved
              </span>
            </div>

            {/* Undo/Redo tools - Extra small and tight */}
            <div className="flex items-center gap-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleUndo}
                disabled={history.length === 0}
                title={t("undo")}
              >
                <Undo2 className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title={t("redo")}
              >
                <Redo2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Right tools and actions pulled closer */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* Main Mode Dropdown Menu */}
          <div className="shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 px-3 rounded-md text-xs font-bold gap-1.5 bg-muted hover:bg-muted/80 text-foreground cursor-pointer"
                >
                  {simulationOpen ? (
                    <>
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      <span className="hidden sm:inline">{lang === "ar" ? "محاكاة" : "Simulation"}</span>
                    </>
                  ) : mode === "pcb" ? (
                    <>
                      <Layers className="h-3.5 w-3.5 text-green-500" />
                      <span className="hidden sm:inline">{lang === "ar" ? "لوحة PCB" : "PCB Board"}</span>
                    </>
                  ) : mode === "realistic" ? (
                    <>
                      <Box className="h-3.5 w-3.5 text-amber-500" />
                      <span className="hidden sm:inline">{lang === "ar" ? "العرض الواقعي" : "Realistic View"}</span>
                    </>
                  ) : (
                    <>
                      <Cpu className="h-3.5 w-3.5 text-primary" />
                      <span className="hidden sm:inline">{lang === "ar" ? "المخطط" : "Schematic"}</span>
                    </>
                  )}
                  <ChevronDown className="h-3 w-3 opacity-60 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-slate-900 border-slate-800 text-slate-200 shadow-xl">
                <DropdownMenuItem
                  onClick={() => {
                    setSimulationOpen(false);
                    setMode("schematic");
                  }}
                  className={`flex items-center gap-2.5 cursor-pointer text-xs py-2 ${!simulationOpen && mode === "schematic" ? "bg-blue-600/20 text-blue-400 font-bold" : "focus:bg-slate-800 focus:text-white"}`}
                >
                  <Cpu className="h-4 w-4 text-primary" />
                  <span>{lang === "ar" ? "المخطط" : "Schematic"}</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    setSimulationOpen(false);
                    setMode("pcb");
                    setPlacement(null);
                  }}
                  className={`flex items-center gap-2.5 cursor-pointer text-xs py-2 ${!simulationOpen && mode === "pcb" ? "bg-blue-600/20 text-blue-400 font-bold" : "focus:bg-slate-800 focus:text-white"}`}
                >
                  <Layers className="h-4 w-4 text-green-500" />
                  <span>{lang === "ar" ? "لوحة PCB" : "PCB Board"}</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    setSimulationOpen(true);
                  }}
                  className={`flex items-center gap-2.5 cursor-pointer text-xs py-2 ${simulationOpen ? "bg-blue-600/20 text-blue-400 font-bold" : "focus:bg-slate-800 focus:text-white"}`}
                >
                  <Zap className="h-4 w-4 text-amber-500" />
                  <span>{lang === "ar" ? "محاكاة" : "Simulation"}</span>
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    setSimulationOpen(false);
                    setMode("realistic");
                  }}
                  className={`flex items-center gap-2.5 cursor-pointer text-xs py-2 ${!simulationOpen && mode === "realistic" ? "bg-blue-600/20 text-blue-400 font-bold" : "focus:bg-slate-800 focus:text-white"}`}
                >
                  <Box className="h-4 w-4 text-amber-500" />
                  <span>{lang === "ar" ? "العرض الواقعي" : "Realistic View"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {(() => {
            const totalIssues = designChecks.erc.length + designChecks.drc.length;
            const hasErrors = designChecks.errors.length > 0;
            return (
              <Button
                variant="ghost"
                size="sm"
                className={`h-8 gap-1.5 font-bold ${
                  totalIssues > 0
                    ? hasErrors
                      ? "text-red-400 hover:text-red-300"
                      : "text-amber-400 hover:text-amber-300"
                    : "text-emerald-400 hover:text-emerald-300"
                }`}
                onClick={() => setDesignCheckOpen(true)}
                title={lang === "ar" ? "فحص ERC / DRC" : "Run ERC / DRC"}
              >
                <ShieldCheck className="h-4 w-4" />
                <span className="hidden sm:inline">ERC/DRC</span>
                {totalIssues > 0 && (
                  <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${
                    hasErrors
                      ? "bg-red-500/20 text-red-300 border border-red-500/30"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                  }`}>
                    {totalIssues}
                  </span>
                )}
              </Button>
            );
          })()}

          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 gap-1.5 text-blue-400 hover:text-blue-300 font-bold"
            onClick={() => setExportDialogOpen(true)}
            title={lang === "ar" ? "حفظ وتصدير واستيراد الملفات" : "Save, Export & Import Files"}
          >
            <ArrowUpDown className="h-4 w-4 text-blue-400" />
            <span className="hidden sm:inline">{lang === "ar" ? "حفظ واستيراد" : "Save & Import"}</span>
          </Button>




        </div>
      </motion.header>
    )}
  </AnimatePresence>

      {/* Workspace Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Toolbox Sidebar */}
        <ConnectorGeneratorModal 
        open={connModalOpen}
        onOpenChange={setConnModalOpen}
        onGenerate={(id, metadata) => {
          setPlacement({ symbol: id, rotation: 0, metadata });
          setActiveTool("select");
          if (!isSchematicLike) {
            setMode("schematic");
            toast.info("Switched to Schematic to place component");
          }
        }}
      />
      {libraryOpen && isSchematicLike && (
          <ComponentToolbox 
            onPick={handlePickComponent} 
            onOpenConnModal={() => setConnModalOpen(true)}
            onOpenNetLabels={() => setNetLabelOpen(true)}
            onClose={() => setLibraryOpen(false)}
            realistic={mode === "realistic"}
          />
        )}

        {/* Floating Exit Preview Button */}
        <AnimatePresence>
          {!showUI && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: -20 }}
              className="absolute top-4 right-4 z-50"
            >
              <Button
                variant="secondary"
                size="sm"
                className="h-9 gap-2 shadow-2xl border border-white/10 backdrop-blur-md bg-background/80 hover:bg-background pr-4"
                onClick={() => setShowUI(true)}
              >
                <Minimize className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold">{lang === "ar" ? "إنهاء المعاينة" : "Exit Preview"}</span>
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Middle Board Stage Canvas */}
        <div 
          className="flex-1 h-full relative overflow-hidden bg-[#0a0f1d] transition-colors duration-200"
          onPointerDownCapture={(e) => {
            const target = e.target as HTMLElement | null;
            if (!target) return;
            if (
              target.closest(".properties-panel") ||
              target.closest(".floating-actions") ||
              target.closest("[role='dialog']") ||
              target.closest("[data-radix-portal]") ||
              target.closest("[data-radix-popper-content-wrapper]") ||
              target.closest("[role='menu']") ||
              target.closest("[role='listbox']")
            ) {
              return;
            }
            setLibraryOpen(false);
            setPropertiesOpen(false);
            setLeftMenuOpen(false);
          }}
        >
          <AnimatePresence mode="wait">
            {isSchematicLike ? (
              <motion.div
                key={mode}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                <Canvas
                  doc={project.doc}
                  setDoc={setDoc}
                  commitHistory={commitHistory}
                  tool={activeTool}
                  setTool={setActiveTool}
                  locateSignal={locateSignal}
                  realistic={mode === "realistic"}
                  selectedIds={selectedIds}
                  setSelectedIds={(ids) => {
                    setSelectedIds(ids);
                    if (ids.length > 0) setLeftMenuOpen(true);
                  }}
                  onOpenProperties={(id) => {
                    setSelectedIds([id]);
                    setPropertiesOpen(true);
                  }}
                  onOpenWireProperties={(wireId) => {
                    setSelectedWireIds([wireId]);
                    setSelectedIds([]);
                    setPropertiesOpen(true);
                  }}
                  wireColor={wireColor}
                  selectedWireIds={selectedWireIds}
                  setSelectedWireIds={(ids) => {
                    setSelectedWireIds(ids);
                    if (ids.length > 0) setLeftMenuOpen(true);
                  }}
                  clipboard={clipboard}
                  setClipboard={setClipboard}
                  selectedTrackId={selectedTrackId}
                  setSelectedTrackId={setSelectedTrackId}
                  selectedPin={selectedPin}
                  setSelectedPin={setSelectedPin}
                  highlightedNetIds={highlightedNetIds}
                  placement={placement}
                  setPlacement={setPlacement}
                  onBackgroundClick={() => {
                    setLibraryOpen(false);
                    setPropertiesOpen(false);
                    setLeftMenuOpen(false);
                  }}
                  onCanvasClick={() => {
                    setLibraryOpen(false);
                    setPropertiesOpen(false);
                    setLeftMenuOpen(false);
                  }}
                  onPlace={(symbol, x, y, rotation, metadata) => {
                    if (!project) return;
                    const currentDoc = latestDocRef.current || project.doc;
                    pushToHistory(currentDoc);
                    
                    const symDef = SYMBOLS[symbol];
                    let nextRef = "";
                    if (symDef && symDef.prefix) {
                      const prefix = symDef.prefix;
                      const existingIndexes = currentDoc.nodes
                        .map(n => n.reference || "")
                        .filter(ref => ref.startsWith(prefix))
                        .map(ref => parseInt(ref.slice(prefix.length)))
                        .filter(num => !isNaN(num));
                      const maxIdx = existingIndexes.length > 0 ? Math.max(...existingIndexes) : 0;
                      nextRef = `${prefix}${maxIdx + 1}`;
                    }

                    const defaultKiCadFootprint = getKiCadSymbolDefaultFootprint(symbol);
                    const defaultProjectPackage = !isKiCadSymbol(symbol) ? getPackagesForSymbol(symbol)[0] : undefined;
                    const newNode: SchematicNode = {
                      id: crypto.randomUUID(),
                      symbol,
                      x,
                      y,
                      rotation,
                      label: "",
                      reference: nextRef,
                      value: symDef?.defaultValue || "",
                      size: currentDoc.defaultNodeSize ?? 1.0,
                      metadata,
                      footprint: defaultKiCadFootprint || defaultProjectPackage?.id,
                      footprintAssignment: defaultKiCadFootprint
                        ? { source: "kicad", identifier: defaultKiCadFootprint, displayName: defaultKiCadFootprint, status: "missing" }
                        : defaultProjectPackage
                          ? { source: "cirzuit", identifier: defaultProjectPackage.id, name: defaultProjectPackage.name, displayName: defaultProjectPackage.name, status: "resolved" }
                          : undefined,
                    };
                    const nextDoc = {
                      ...currentDoc,
                      nodes: [...currentDoc.nodes, newNode],
                    };
                    latestDocRef.current = nextDoc;
                    saveProjectState(nextDoc);
                    setSelectedIds([]);
                  }}
                  onPlaceMulti={(data, x, y) => {
                    if (!project) return;
                    pushToHistory(project.doc);
                    
                    let minX = Infinity, minY = Infinity;
                    data.nodes.forEach(n => { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); });
                    data.wires.forEach(w => w.points.forEach(p => { minX = Math.min(minX, p.x); minY = Math.min(minY, p.y); }));
                    
                    const dx = x - minX;
                    const dy = y - minY;
                    
                    const newNodes = data.nodes.map(n => ({
                      ...n,
                      id: crypto.randomUUID(),
                      x: n.x + dx,
                      y: n.y + dy,
                    }));
                    
                    const newWires = data.wires.map(w => ({
                      ...w,
                      id: crypto.randomUUID(),
                      points: w.points.map(p => ({ x: p.x + dx, y: p.y + dy }))
                    }));

                    const nextDoc = { ...project.doc };
                    const nodesWithRefs = newNodes.map(nn => {
                      const sym = SYMBOLS[nn.symbol];
                      const prefix = sym?.prefix || "U";
                      return { ...nn, reference: nextReference(nextDoc, prefix) };
                    });

                    const finalDoc = {
                      ...nextDoc,
                      nodes: [...nextDoc.nodes, ...nodesWithRefs],
                      wires: [...nextDoc.wires, ...newWires]
                    };
                    saveProjectState(finalDoc);
                    setPlacement(null);
                    setSelectedIds(newNodes.map(n => n.id));
                    setSelectedWireIds(newWires.map(w => w.id));
                    toast.success(lang === "ar" ? "تم اللصق بنجاح" : "Pasted successfully");
                  }}
                  onCancelPlace={() => setPlacement(null)}
                  onRotatePlacement={() => {
                    if (placement) {
                      setPlacement({
                        ...placement,
                        rotation: (((placement.rotation ?? 0) + 90) % 360) as 0 | 90 | 180 | 270,
                      });
                    }
                  }}
                  wireStyle={wireStyle}
                  gridStyle={gridStyle}
                  showGrid={showGrid}
                  gridOpacity={gridOpacity}
                  snap={snapToGrid}
                />
              </motion.div>
            ) : (
              <motion.div
                key="pcb"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full h-full"
              >
                <PcbEditor
                  schematic={project.doc}
                  pcb={project.doc.pcb}
                  onUndo={handleUndo}
                  onRedo={handleRedo}
                  canUndo={history.length > 0}
                  canRedo={redoStack.length > 0}
                  setPcb={setPcb}
                  setMode={setMode}
                  commitHistory={commitHistory}
                  onBackgroundClick={() => {
                    setLibraryOpen(false);
                    setPropertiesOpen(false);
                  }}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  selectedWireId={selectedWireId}
                  setSelectedWireId={setSelectedWireId}
                  selectedTrackId={selectedTrackId}
                  setSelectedTrackId={setSelectedTrackId}
                  selectedPin={selectedPin}
                  setSelectedPin={setSelectedPin}
                  highlightedNetIds={highlightedNetIds}
                  drc={designChecks.drc}
                  hasEcoChanges={hasEcoChanges}
                  setEcoOpen={setEcoOpen}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Floating Action Buttons (Right) */}
          {isSchematicLike && !simulationOpen && !propertiesOpen && !libraryOpen && (
            <div className="floating-actions absolute right-4 top-4 flex flex-col z-10 shadow-lg border border-border/50 rounded-2xl overflow-hidden bg-background/80 backdrop-blur-sm transition-all duration-300">
              <Button
                variant="ghost"
                size="icon"
                className={`h-12 w-12 rounded-none ${libraryOpen ? "bg-blue-500/20 text-blue-400" : "text-foreground hover:bg-muted"}`}
                onClick={() => {
                  setLibraryOpen(!libraryOpen);
                  if (!libraryOpen) setPropertiesOpen(false);
                }}
                title="Library"
              >
                <Library className="h-5 w-5" />
              </Button>
              <div className="h-px w-full bg-border/50" />
              <Button
                variant="ghost"
                size="icon"
                className={`h-12 w-12 rounded-none ${activeTool === "wire" ? "bg-blue-500/20 text-blue-400" : "text-foreground hover:bg-muted"}`}
                onClick={() => {
                  setActiveTool("wire");
                  setLibraryOpen(false);
                  setPropertiesOpen(false);
                  setPlacement(null);
                }}
                title="Draw Wire"
              >
                <Activity className="h-5 w-5" />
              </Button>
              <div className="h-px w-full bg-border/50" />
              <Button
                variant="ghost"
                size="icon"
                className={`h-12 w-12 rounded-none ${activeTool === "pan" ? "bg-blue-500/20 text-blue-400" : "text-foreground hover:bg-muted"}`}
                onClick={() => {
                  setActiveTool("pan");
                  setLibraryOpen(false);
                  setPropertiesOpen(false);
                  setPlacement(null);
                }}
                title={lang === "ar" ? "الفأرة" : "Mouse"}
              >
                <MousePointer2 className="h-5 w-5" />
              </Button>
              <div className="h-px w-full bg-border/50" />
              <Button
                variant="ghost"
                size="icon"
                className={`h-12 w-12 rounded-none ${(activeTool === "select" && placement?.symbol !== "text") ? "bg-blue-500/20 text-blue-400" : "text-foreground hover:bg-muted"}`}
                onClick={() => {
                  setActiveTool("select");
                  setPlacement(null);
                }}
                title={lang === "ar" ? "أداة التظليل (التحديد)" : "Marquee Select / Shading"}
              >
                <MousePointerSquareDashed className="h-5 w-5" />
              </Button>
            </div>
          )}
          {/* Left Action Menu */}
          {isSchematicLike && !simulationOpen && !propertiesOpen && !libraryOpen && (
            <div 
              className="floating-actions absolute top-4 left-4 flex flex-col z-20 shadow-lg border border-border/50 rounded-2xl overflow-hidden bg-background/80 backdrop-blur-sm transition-all duration-300"
            >
              {/* 1. General Button for Schematic Unit */}
              <Button
                variant="ghost"
                size="icon"
                className="h-12 w-12 rounded-none text-foreground hover:bg-muted"
                onClick={() => setUnitDialogOpen(true)}
                title={lang === "ar" ? "إعدادات الوحدة" : "Unit Settings"}
              >
                <Cpu className="h-5 w-5" />
              </Button>
              <AnimatePresence>
                {(selectedIds.length > 0 || selectedWireIds.length > 0) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="flex flex-col overflow-hidden"
                  >
                    <div className="h-px w-full bg-border/50" />
                    {/* 2. Component Properties */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 rounded-none text-foreground hover:bg-muted"
                      onClick={() => setPropertiesOpen(true)}
                      title={lang === "ar" ? "خصائص العنصر" : "Component Properties"}
                    >
                      <SlidersHorizontal className="h-5 w-5" />
                    </Button>
                    
                    {/* 3. Rotate (only if element is selected) */}
                    {selectedIds.length > 0 && (
                      <>
                        <div className="h-px w-full bg-border/50" />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-12 w-12 rounded-none text-foreground hover:bg-muted"
                          onClick={handleNodeRotate}
                          title={lang === "ar" ? "تدوير" : "Rotate"}
                        >
                          <RotateCw className="h-5 w-5" />
                        </Button>
                      </>
                    )}

                    <div className="h-px w-full bg-border/50" />
                    {/* 4. Clone (element or wire) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 rounded-none text-foreground hover:bg-muted"
                      onClick={() => {
                        if (!project) return;
                        const nodesToClone = project.doc.nodes.filter(n => selectedIds.includes(n.id));
                        const wiresToClone = project.doc.wires.filter(w => selectedWireIds.includes(w.id));
                        
                        if (nodesToClone.length > 0 || wiresToClone.length > 0) {
                          pushToHistory(project.doc);
                          const nextDoc = { ...project.doc, nodes: [...project.doc.nodes] };
                          
                          const dx = 5;
                          const dy = 5;
                          
                          const newNodes: SchematicNode[] = [];
                          for (const n of nodesToClone) {
                            const newId = crypto.randomUUID();
                            const sym = SYMBOLS[n.symbol];
                            const prefix = sym?.prefix || "U";
                            const ref = nextReference(nextDoc, prefix);
                            const clonedNode = {
                              ...n,
                              id: newId,
                              x: n.x + dx,
                              y: n.y + dy,
                              reference: ref,
                            };
                            newNodes.push(clonedNode);
                            nextDoc.nodes.push(clonedNode);
                          }
                          
                          const newWires = wiresToClone.map(w => ({
                            ...w,
                            id: crypto.randomUUID(),
                            points: w.points.map(p => ({ x: p.x + dx, y: p.y + dy })),
                          }));
                          
                          const finalDoc = {
                            ...nextDoc,
                            wires: [...nextDoc.wires, ...newWires],
                          };
                          
                          saveProjectState(finalDoc);
                          setSelectedIds(newNodes.map(n => n.id));
                          setSelectedWireIds(newWires.map(w => w.id));
                          toast.success(lang === "ar" ? "تم استنساخ العناصر بنجاح" : "Selected elements cloned successfully");
                        }
                      }}
                      title={lang === "ar" ? "استنساخ" : "Clone"}
                    >
                      <CopyPlus className="h-5 w-5" />
                    </Button>

                    <div className="h-px w-full bg-border/50" />
                    {/* 5. Delete (element or wire) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 rounded-none text-red-400 hover:text-red-500 hover:bg-red-500/10"
                      onClick={handleNodeDelete}
                      title={lang === "ar" ? "حذف" : "Delete"}
                    >
                      <Trash2 className="h-5 w-5" />
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Floating Properties Panel */}
          {propertiesOpen && isSchematicLike && (
            <div className="properties-panel absolute left-0 top-0 bottom-0 w-80 z-20 shadow-xl border-r border-border bg-background/95 backdrop-blur-sm">
              <PropertiesPanel
                node={selectedNode}
                wire={selectedWire}
                onChange={handleNodeChange}
                onChangeWire={handleWireChange}
                onRotate={handleNodeRotate}
                onDelete={handleNodeDelete}
                onDeleteWire={handleWireDelete}
                onClose={() => {
                  setPropertiesOpen(false);
                  setLeftMenuOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {simulationOpen && (
        <SimulationModule 
          doc={project.doc} 
          setDoc={setDoc}
          onClose={() => setSimulationOpen(false)} 
          lang={lang}
          onLocateNode={(id) => setLocateSignal({ id, t: Date.now() })}
        />
      )}

      {modelManagerOpen && (
        <ModelManager
          doc={project.doc}
          setDoc={setDoc}
          onClose={() => setModelManagerOpen(false)}
          lang={lang}
        />
      )}

      {/* Net Label Manager */}
      <Dialog open={netLabelOpen} onOpenChange={setNetLabelOpen}>
        <DialogContent
          hideCloseButton={true}
          className="w-[96vw] sm:w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[85vh] bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl p-0 overflow-hidden font-sans rounded-2xl flex flex-col"
        >
          {/* Header */}
          <DialogHeader className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur shrink-0">
            <div className="flex items-center justify-between gap-3 w-full">
              {/* Title & Badge on Start Side */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 sm:size-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0 shadow-[0_0_12px_rgba(59,130,246,0.2)]">
                  <Tag className="size-5 sm:size-6 text-blue-400" />
                </div>
                <div className="min-w-0 text-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-sm sm:text-base font-bold tracking-tight text-white m-0">
                      {lang === "ar" ? "إدارة التسميات الشبكية (Net Labels)" : "Net Labels Manager"}
                    </DialogTitle>
                    <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                      <Tag className="size-3 text-blue-400" />
                      <span>{(project?.doc.netLabels ?? []).length} {lang === "ar" ? "تسمية" : "labels"}</span>
                    </span>
                    {(project?.doc.netLabels ?? []).length > 0 && (
                      <span className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800/80 text-slate-300 border border-slate-700/60 hidden sm:inline-block">
                        {(project?.doc.netLabels ?? []).filter(l => l.scope === "global").length} {lang === "ar" ? "شاملة" : "global"} · {(project?.doc.netLabels ?? []).filter(l => (l.scope ?? "local") === "local").length} {lang === "ar" ? "محلية" : "local"}
                      </span>
                    )}
                  </div>
                  <DialogDescription className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {lang === "ar"
                      ? "ربط الأسلاك والمكونات كهربائياً بدون تمديدات عبر التسميات والأسماء الشبكية المحلية والشاملة."
                      : "Wirelessly interconnect schematic pins & nets using local and global net labels."}
                  </DialogDescription>
                </div>
              </div>

              {/* Close Button on Opposite Side */}
              <DialogClose className="h-8 w-8 shrink-0 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <X className="h-4 w-4 stroke-[2.5]" />
                <span className="sr-only">{lang === "ar" ? "إغلاق" : "Close"}</span>
              </DialogClose>
            </div>
          </DialogHeader>

          {/* Add Label & Quick Presets Section */}
          <div className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/50 space-y-3 shrink-0">
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-400 shrink-0">
                {lang === "ar" ? "تسميات شائعة:" : "Presets:"}
              </span>
              {["VCC", "GND", "+5V", "+3.3V", "+12V", "TX", "RX", "SDA", "SCL", "CLK", "RST", "CS", "MOSI", "MISO"].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    setNetLabelText(preset);
                    if (["VCC", "GND", "+5V", "+3.3V", "+12V"].includes(preset)) {
                      setNetLabelScope("global");
                    }
                  }}
                  className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border transition-all ${
                    netLabelText === preset
                      ? "bg-blue-500/30 text-blue-200 border-blue-500/60 shadow-sm shadow-blue-500/20"
                      : "bg-slate-950/70 text-slate-300 border-slate-800 hover:border-slate-700 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            {/* Input Form Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
              {/* Name Input */}
              <div className="sm:col-span-4 relative">
                <Tag className="size-3.5 text-blue-400 absolute left-2.5 top-3 pointer-events-none" />
                <Input
                  className="bg-slate-950 border-slate-700/80 text-white font-mono font-bold placeholder:text-slate-500 placeholder:font-normal h-9 pl-8 text-xs focus:border-blue-500"
                  placeholder={lang === "ar" ? "اسم التسمية (مثلاً VCC)" : "Label name (e.g. VCC)"}
                  value={netLabelText}
                  onChange={(e) => setNetLabelText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddNetLabel()}
                />
              </div>

              {/* Scope Selector */}
              <div className="sm:col-span-3 flex rounded-lg border border-slate-700/80 bg-slate-950 p-0.5 h-9">
                <button
                  type="button"
                  onClick={() => setNetLabelScope("local")}
                  className={`flex-1 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                    netLabelScope === "local"
                      ? "bg-blue-600/30 text-blue-300 border border-blue-500/40"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{lang === "ar" ? "محلية" : "Local"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNetLabelScope("global")}
                  className={`flex-1 rounded-md text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                    netLabelScope === "global"
                      ? "bg-blue-500/25 text-blue-200 border border-blue-500/50"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{lang === "ar" ? "شاملة" : "Global"}</span>
                </button>
              </div>

              {/* Coordinates X, Y */}
              <div className="sm:col-span-3 grid grid-cols-2 gap-1">
                <div className="relative">
                  <span className="absolute left-2 top-2 text-[10px] font-mono text-slate-500">X</span>
                  <Input
                    className="bg-slate-950 border-slate-700/80 text-white font-mono text-xs h-9 pl-5 pr-1 text-center"
                    placeholder="0"
                    value={netLabelX}
                    onChange={(e) => setNetLabelX(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-2 top-2 text-[10px] font-mono text-slate-500">Y</span>
                  <Input
                    className="bg-slate-950 border-slate-700/80 text-white font-mono text-xs h-9 pl-5 pr-1 text-center"
                    placeholder="0"
                    value={netLabelY}
                    onChange={(e) => setNetLabelY(e.target.value)}
                  />
                </div>
              </div>

              {/* Add Button */}
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  onClick={() => handleAddNetLabel()}
                  className="w-full h-9 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 active:scale-[0.99] transition-all text-xs flex items-center justify-center gap-1.5"
                >
                  <Plus className="size-3.5 text-blue-200" />
                  <span>{lang === "ar" ? "إضافة" : "Add"}</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Search, Filter & Actions Toolbar */}
          <div className="px-3.5 sm:px-4 py-2 border-b border-slate-800/80 bg-slate-900/30 flex flex-wrap items-center justify-between gap-2 shrink-0">
            {/* Search Input */}
            <div className="relative flex-1 min-w-[160px] max-w-xs">
              <Search className="size-3.5 text-blue-400 absolute left-2.5 top-2.5 pointer-events-none" />
              <Input
                className="h-8 pl-8 text-xs bg-slate-950 border-slate-800 text-slate-200 placeholder:text-slate-500 focus:border-blue-500"
                placeholder={lang === "ar" ? "بحث في التسميات..." : "Filter labels..."}
                value={netLabelSearch}
                onChange={(e) => setNetLabelSearch(e.target.value)}
              />
            </div>

            {/* Filter Scope Pills & Clear All */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex rounded-md border border-slate-800 bg-slate-950 p-0.5 text-xs">
                {(["all", "local", "global"] as const).map((filterVal) => (
                  <button
                    key={filterVal}
                    type="button"
                    onClick={() => setNetLabelFilterScope(filterVal)}
                    className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all ${
                      netLabelFilterScope === filterVal
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {filterVal === "all"
                      ? lang === "ar" ? "الكل" : "All"
                      : filterVal === "local"
                      ? lang === "ar" ? "محلية" : "Local"
                      : lang === "ar" ? "شاملة" : "Global"}
                  </button>
                ))}
              </div>

              {(project?.doc.netLabels ?? []).length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearAllNetLabels}
                  className="h-7 text-[11px] text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2"
                >
                  <Trash2 className="size-3 mr-1 text-blue-400" />
                  <span>{lang === "ar" ? "مسح الكل" : "Clear All"}</span>
                </Button>
              )}
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 p-3.5 sm:p-4 overflow-y-auto max-h-[38vh] space-y-2">
            {(() => {
              const allLabels = project?.doc.netLabels ?? [];
              const filteredLabels = allLabels.filter((label) => {
                const matchesSearch = !netLabelSearch.trim() || label.text.toLowerCase().includes(netLabelSearch.trim().toLowerCase());
                const matchesScope =
                  netLabelFilterScope === "all" ||
                  (netLabelFilterScope === "global" && label.scope === "global") ||
                  (netLabelFilterScope === "local" && (label.scope ?? "local") === "local");
                return matchesSearch && matchesScope;
              });

              if (allLabels.length === 0) {
                return (
                  <div className="py-10 text-center space-y-3">
                    <div className="size-12 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-[0_0_16px_rgba(59,130,246,0.15)]">
                      <Tag className="size-6 text-blue-400 opacity-80" />
                    </div>
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-slate-300">
                        {lang === "ar" ? "لا توجد تسميات شبكية بعد" : "No net labels defined"}
                      </div>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        {lang === "ar"
                          ? "استخدم النموذج بالأعلى أو انقر على أحد التسميات الشائعة السريعة لإضافة تسمية وربط الأسلاك لاسلكياً."
                          : "Use the inputs above or click a preset to place net labels and interconnect circuit nets wirelessly."}
                      </p>
                    </div>
                  </div>
                );
              }

              if (filteredLabels.length === 0) {
                return (
                  <div className="py-8 text-center text-sm text-slate-500">
                    {lang === "ar" ? "لا توجد نتائج مطابقة لبحثك" : "No labels match your filter"}
                  </div>
                );
              }

              return filteredLabels.map((label) => {
                const isEditing = editingLabelId === label.id;
                const isGlobal = label.scope === "global";

                if (isEditing) {
                  return (
                    <div
                      key={label.id}
                      className="p-3 rounded-xl border border-blue-500/60 bg-blue-950/20 space-y-2.5 transition-all shadow-md"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-blue-300">
                          {lang === "ar" ? "تعديل التسمية" : "Edit Net Label"}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold gap-1 shadow-md shadow-blue-900/30"
                            onClick={() => handleSaveEditNetLabel(label.id)}
                          >
                            <Check className="size-3.5 text-blue-200" />
                            <span>{lang === "ar" ? "حفظ" : "Save"}</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs text-slate-400 hover:text-white"
                            onClick={() => setEditingLabelId(null)}
                          >
                            <X className="size-3.5 text-blue-400" />
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                        <div className="sm:col-span-5">
                          <Input
                            className="h-8 bg-slate-950 border-slate-700 text-xs font-mono font-bold"
                            value={editLabelText}
                            onChange={(e) => setEditLabelText(e.target.value)}
                            placeholder="Name"
                          />
                        </div>
                        <div className="sm:col-span-4 flex rounded-md border border-slate-700 bg-slate-950 p-0.5 h-8">
                          <button
                            type="button"
                            onClick={() => setEditLabelScope("local")}
                            className={`flex-1 rounded text-[10px] font-bold ${
                              editLabelScope === "local" ? "bg-blue-600/40 text-blue-200" : "text-slate-400"
                            }`}
                          >
                            Local
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLabelScope("global")}
                            className={`flex-1 rounded text-[10px] font-bold ${
                              editLabelScope === "global" ? "bg-blue-600/40 text-blue-200" : "text-slate-400"
                            }`}
                          >
                            Global
                          </button>
                        </div>
                        <div className="sm:col-span-3 grid grid-cols-2 gap-1">
                          <Input
                            className="h-8 bg-slate-950 border-slate-700 text-xs font-mono text-center px-1"
                            placeholder="X"
                            value={editLabelX}
                            onChange={(e) => setEditLabelX(e.target.value)}
                          />
                          <Input
                            className="h-8 bg-slate-950 border-slate-700 text-xs font-mono text-center px-1"
                            placeholder="Y"
                            value={editLabelY}
                            onChange={(e) => setEditLabelY(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={label.id}
                    className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 hover:border-slate-700 transition-all gap-2"
                  >
                    {/* Left details */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="font-mono font-bold text-sm sm:text-base text-blue-200 bg-blue-950/40 border border-blue-500/30 px-2.5 py-1 rounded-lg shrink-0">
                        {label.text}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            isGlobal
                              ? "bg-blue-500/25 text-blue-200 border-blue-500/40"
                              : "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          }`}
                        >
                          {isGlobal ? (lang === "ar" ? "شاملة Global" : "Global") : (lang === "ar" ? "محلية Local" : "Local")}
                        </span>

                        <span className="text-[11px] font-mono text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded border border-slate-800">
                          X: {label.x}, Y: {label.y}
                        </span>

                        {(label.rotation ?? 0) !== 0 && (
                          <span className="text-[10px] font-mono text-slate-500">
                            {label.rotation}°
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Right actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 rounded-lg"
                        onClick={() => handleStartEditNetLabel(label)}
                        title={lang === "ar" ? "تعديل" : "Edit"}
                      >
                        <Pencil className="size-3.5 text-blue-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 rounded-lg"
                        onClick={() => handleDuplicateNetLabel(label)}
                        title={lang === "ar" ? "تكرار التسمية" : "Duplicate"}
                      >
                        <Copy className="size-3.5 text-blue-400" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-400 hover:text-red-400 hover:bg-red-950/40 rounded-lg"
                        onClick={() => handleDeleteNetLabel(label.id)}
                        title={lang === "ar" ? "حذف" : "Delete"}
                      >
                        <Trash2 className="size-3.5 text-blue-400" />
                      </Button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Footer */}
          <DialogFooter className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-900/80 backdrop-blur flex items-center justify-between gap-3 shrink-0">
            <div className="text-[11px] sm:text-xs text-slate-400 text-start">
              {lang === "ar" ? (
                <span>
                  💡 التسميات بنفس الاسم تتصل كهربائياً تلقائياً داخل المحاكي وقوائم SPICE و KiCad.
                </span>
              ) : (
                <span>
                  💡 Matching net label names are automatically interconnected across schematic & simulation.
                </span>
              )}
            </div>

            <Button
              type="button"
              onClick={() => setNetLabelOpen(false)}
              className="px-5 py-2 h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-bold border border-blue-500/40 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:border-blue-400 transition-all shadow-sm shadow-blue-500/10 flex items-center gap-2 shrink-0"
            >
              <span>{lang === "ar" ? "إغلاق" : "Close"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ERC / DRC Dialog */}
      <Dialog open={designCheckOpen} onOpenChange={setDesignCheckOpen}>
        <DialogContent
          hideCloseButton={true}
          className="w-[96vw] sm:w-full sm:max-w-3xl max-h-[92vh] sm:max-h-[85vh] bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl p-0 overflow-hidden font-sans rounded-2xl flex flex-col"
        >
          {/* Header */}
          <DialogHeader className="p-3.5 sm:p-4 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur shrink-0">
            <div className="flex items-center justify-between gap-3 w-full">
              {/* Title & Badge on Start Side */}
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-9 sm:size-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <ShieldCheck className="size-5 sm:size-6" />
                </div>
                <div className="min-w-0 text-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-sm sm:text-base font-bold tracking-tight text-white m-0">
                      {lang === "ar" ? "فحص قواعد التصميم والكهرباء (ERC / DRC)" : "ERC / DRC Design Check"}
                    </DialogTitle>
                    {designChecks.passed ? (
                      <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="size-3 text-emerald-400" />
                        <span>
                          {lang === "ar" ? "سليم ومطابق" : "Passed"}
                          {(designChecks.ignoredErc.length + designChecks.ignoredDrc.length) > 0 && (
                            <span className="opacity-80 font-normal">
                              {" "}({designChecks.ignoredErc.length + designChecks.ignoredDrc.length} {lang === "ar" ? "متجاهل" : "ignored"})
                            </span>
                          )}
                        </span>
                      </span>
                    ) : (
                      <span className={`text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                        designChecks.errors.length > 0
                          ? "bg-red-500/20 text-red-300 border border-red-500/30"
                          : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                      }`}>
                        <AlertTriangle className="size-3" />
                        <span>
                          {designChecks.errors.length + designChecks.warnings.length} {lang === "ar" ? "ملاحظة نشطة" : "Active Issues"}
                        </span>
                      </span>
                    )}
                  </div>
                  <DialogDescription className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {lang === "ar"
                      ? "فحص الاتصال الكهربائي وقواعد لوحة PCB مع إمكانية تجاهل الملاحظات أو استعادتها."
                      : "Cross-check schematic electrical rules (ERC) and PCB constraints (DRC) with ignore & restore capabilities."}
                  </DialogDescription>
                </div>
              </div>

              {/* Close Button on Opposite Side - Bordered in Blue as requested */}
              <DialogClose className="h-8 w-8 shrink-0 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <X className="h-4 w-4 stroke-[2.5]" />
                <span className="sr-only">{lang === "ar" ? "إغلاق" : "Close"}</span>
              </DialogClose>
            </div>
          </DialogHeader>

          {/* Navigation Bar / Tabs & Quick Actions */}
          <div className="px-3.5 sm:px-5 py-2 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
            {/* Tabs */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDesignCheckTab("erc")}
                className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border shrink-0 whitespace-nowrap ${
                  designCheckTab === "erc"
                    ? "bg-blue-600/20 text-blue-400 border-blue-500/40 shadow-sm shadow-blue-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
                }`}
              >
                <Shield className="size-3.5 sm:size-4 text-blue-400 shrink-0" />
                <span>ERC</span>
                {designChecks.erc.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {designChecks.erc.length}
                  </span>
                )}
                {designChecks.ignoredErc.length > 0 && (
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({designChecks.ignoredErc.length} {lang === "ar" ? "متجاهل" : "ignored"})
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setDesignCheckTab("drc")}
                className={`px-3.5 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center gap-2 border shrink-0 whitespace-nowrap ${
                  designCheckTab === "drc"
                    ? "bg-blue-600/20 text-blue-400 border-blue-500/40 shadow-sm shadow-blue-500/10"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border-slate-800/80"
                }`}
              >
                <Shield className="size-3.5 sm:size-4 text-blue-400 shrink-0" />
                <span>DRC</span>
                {isKiCadPcbBoard(project?.doc?.pcb) ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {lang === "ar" ? "معطل" : "Disabled"}
                  </span>
                ) : designChecks.drc.length > 0 ? (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {designChecks.drc.length}
                  </span>
                ) : null}
                {!isKiCadPcbBoard(project?.doc?.pcb) && designChecks.ignoredDrc.length > 0 && (
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({designChecks.ignoredDrc.length} {lang === "ar" ? "متجاهل" : "ignored"})
                  </span>
                )}
              </button>
            </div>

            {/* Quick Actions (Ignore All / Restore All / Toggle Show Ignored) */}
            <div className="flex items-center gap-2 shrink-0">
              {(() => {
                const activeCount = designCheckTab === "erc" ? designChecks.erc.length : designChecks.drc.length;
                const ignoredCount = designCheckTab === "erc" ? designChecks.ignoredErc.length : designChecks.ignoredDrc.length;
                const currentDomain = designCheckTab === "erc" ? ("ERC" as const) : ("DRC" as const);

                return (
                  <>
                    {activeCount > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleIgnoreAll(currentDomain)}
                        className="h-7 px-2.5 text-xs font-semibold border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/25 hover:text-amber-100 transition-all flex items-center gap-1.5 shadow-sm"
                        title={lang === "ar" ? `تجاهل كافة ملاحظات ${designCheckTab.toUpperCase()}` : `Ignore all ${designCheckTab.toUpperCase()} issues`}
                      >
                        <EyeOff className="size-3.5 text-amber-400" />
                        <span>{lang === "ar" ? "تجاهل الكل" : "Ignore All"}</span>
                      </Button>
                    )}

                    {ignoredCount > 0 && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => handleRestoreAll(currentDomain)}
                          className="h-7 px-2.5 text-xs font-semibold border-slate-700 text-slate-300 bg-slate-800/80 hover:bg-slate-700 hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
                          title={lang === "ar" ? `استعادة كافة ملاحظات ${designCheckTab.toUpperCase()} المتجاهلة` : `Restore all ignored ${designCheckTab.toUpperCase()} issues`}
                        >
                          <RotateCcw className="size-3.5 text-blue-400" />
                          <span>{lang === "ar" ? "استعادة الكل" : "Restore All"}</span>
                        </Button>

                        <button
                          type="button"
                          onClick={() => setShowIgnoredInModal(prev => !prev)}
                          className={`h-7 px-2.5 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                            showIgnoredInModal
                              ? "bg-blue-600/25 text-blue-300 border-blue-500/50 shadow-sm"
                              : "bg-slate-900/60 text-slate-400 hover:text-slate-200 border-slate-800"
                          }`}
                          title={showIgnoredInModal ? (lang === "ar" ? "إخفاء المتجاهل" : "Hide Ignored") : (lang === "ar" ? "عرض المتجاهل" : "Show Ignored")}
                        >
                          <Eye className="size-3.5" />
                          <span>
                            {showIgnoredInModal
                              ? (lang === "ar" ? "إخفاء المتجاهل" : "Hide Ignored")
                              : (lang === "ar" ? `المتجاهل (${ignoredCount})` : `Ignored (${ignoredCount})`)}
                          </span>
                        </button>
                      </>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Tab Content with Scrollable Area and Custom Scrollbar */}
          <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-4 custom-scrollbar bg-slate-950">
            {designCheckTab === "erc" && (
              <div className="space-y-4">
                {/* ERC Active Issues List */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col">
                  <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <Shield className="size-4 text-blue-400" />
                      <span className="font-bold text-xs sm:text-sm text-slate-100">
                        {lang === "ar" ? "نتائج فحص المخطط الكهربائي (ERC)" : "Electrical Rules Check Results"}
                      </span>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${designChecks.erc.length === 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
                      {designChecks.erc.length} {lang === "ar" ? "ملاحظة نشطة" : "active"}
                    </span>
                  </div>
                  <div className="p-3 space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {designChecks.erc.length === 0 ? (
                      <div className="py-10 text-center text-emerald-400 text-xs sm:text-sm font-medium flex flex-col items-center gap-2.5">
                        <CheckCircle2 className="size-8 text-emerald-400/80" />
                        <span>✓ {lang === "ar" ? "المخطط الكهربائي خالٍ تماماً من الملاحظات والأخطاء النشطة" : "No active ERC issues detected in schematic"}</span>
                        {designChecks.ignoredErc.length > 0 && (
                          <div className="flex items-center gap-2 mt-1 text-slate-400 text-xs">
                            <span>
                              {lang === "ar" ? `(تم تجاهل ${designChecks.ignoredErc.length} ملاحظة)` : `(${designChecks.ignoredErc.length} issues ignored)`}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowIgnoredInModal(true)}
                              className="text-blue-400 hover:text-blue-300 underline font-semibold transition-colors"
                            >
                              {lang === "ar" ? "عرض واستعادة" : "View & Restore"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      designChecks.erc.map((i) => (
                        <div
                          key={i.id}
                          className={`rounded-lg p-3 border text-xs transition-colors ${
                            i.severity === "error"
                              ? "border-red-500/30 bg-red-500/10 text-red-200"
                              : i.severity === "warning"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                              : "border-sky-500/20 bg-sky-500/10 text-sky-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono font-bold opacity-90 pb-1.5 border-b border-current/10">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono">{i.code}</span>
                              <span className="uppercase font-sans font-bold px-1.5 py-0.5 rounded bg-black/30">
                                {lang === "ar"
                                  ? i.severity === "error"
                                    ? "خطأ"
                                    : i.severity === "warning"
                                    ? "تحذير"
                                    : "تنبيه"
                                  : i.severity}
                              </span>
                              {i.reference && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-300 font-mono border border-slate-700/40">
                                  {i.reference}
                                </span>
                              )}
                              {i.netId !== undefined && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-300 font-mono border border-slate-700/40">
                                  Net #{i.netId}
                                </span>
                              )}
                            </div>

                            {/* Ignore Button */}
                            <button
                              type="button"
                              onClick={() => handleIgnoreIssue(i.id)}
                              className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-300 hover:text-amber-300 bg-slate-900/80 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/40 transition-all flex items-center gap-1 shrink-0 ml-auto rtl:mr-auto rtl:ml-0 shadow-sm"
                              title={lang === "ar" ? "تجاهل هذا التحذير" : "Ignore this warning"}
                            >
                              <EyeOff className="size-3 text-amber-400" />
                              <span>{lang === "ar" ? "تجاهل" : "Ignore"}</span>
                            </button>
                          </div>
                          <div className="text-xs sm:text-sm mt-2 leading-relaxed font-medium">
                            {lang === "ar" ? i.messageAr || i.message : i.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* ERC Ignored Issues Section */}
                {(showIgnoredInModal || designChecks.erc.length === 0) && designChecks.ignoredErc.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col">
                    <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <EyeOff className="size-4 text-slate-400" />
                        <span className="font-bold text-xs sm:text-sm text-slate-300">
                          {lang === "ar" ? "الملاحظات المتجاهلة (ERC)" : "Ignored ERC Issues"}
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {designChecks.ignoredErc.length}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRestoreAll("ERC")}
                        className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-600/15 gap-1"
                      >
                        <RotateCcw className="size-3" />
                        <span>{lang === "ar" ? "استعادة الكل" : "Restore All"}</span>
                      </Button>
                    </div>
                    <div className="p-3 space-y-2 max-h-[35vh] overflow-y-auto custom-scrollbar">
                      {designChecks.ignoredErc.map((i) => (
                        <div
                          key={i.id}
                          className="rounded-lg p-2.5 border border-slate-800 bg-slate-900/50 text-slate-400 opacity-80 hover:opacity-100 transition-opacity text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono font-bold opacity-80 pb-1 border-b border-slate-800">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="line-through">{i.code}</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-sans">
                                {lang === "ar" ? "متجاهل" : "Ignored"}
                              </span>
                              {i.reference && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono">
                                  {i.reference}
                                </span>
                              )}
                            </div>
                            {/* Restore Button */}
                            <button
                              type="button"
                              onClick={() => handleUnignoreIssue(i.id)}
                              className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-blue-400 hover:text-white bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 transition-all flex items-center gap-1 shrink-0 ml-auto rtl:mr-auto rtl:ml-0 shadow-sm"
                              title={lang === "ar" ? "استعادة هذا الخطأ" : "Restore this error"}
                            >
                              <RotateCcw className="size-3" />
                              <span>{lang === "ar" ? "استعادة" : "Restore"}</span>
                            </button>
                          </div>
                          <div className="text-xs mt-1.5 leading-relaxed">
                            {lang === "ar" ? i.messageAr || i.message : i.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {designCheckTab === "drc" && (
              <div className="space-y-4">
                {/* DRC Active Issues List */}
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden flex flex-col">
                  <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                      <Shield className="size-4 text-blue-400" />
                      <span className="font-bold text-xs sm:text-sm text-slate-100">
                        {lang === "ar" ? "نتائج فحص مسارات وقطع اللوحة (DRC)" : "Design Rules Check Results"}
                      </span>
                    </div>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${isKiCadPcbBoard(project?.doc?.pcb) ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : designChecks.drc.length === 0 ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}`}>
                      {isKiCadPcbBoard(project?.doc?.pcb) ? (lang === "ar" ? "معطل" : "disabled") : `${designChecks.drc.length} ${lang === "ar" ? "ملاحظة نشطة" : "active"}`}
                    </span>
                  </div>
                  <div className="p-3 space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {isKiCadPcbBoard(project?.doc?.pcb) ? (
                      <div className="py-10 text-center text-blue-400 text-xs sm:text-sm font-medium flex flex-col items-center gap-2.5">
                        <Shield className="size-8 text-blue-400/80" />
                        <span className="font-bold">✓ {lang === "ar" ? "نظام فحص قواعد اللوحة (DRC) معطل بالكامل لملف KiCad PCB المستورد" : "DRC system is completely disabled for imported KiCad PCB board"}</span>
                        <span className="text-[11px] text-slate-400 font-normal max-w-md">
                          {lang === "ar" ? "تم تجاوز وإيقاف كافة قيود فحص الـ DRC تلقائياً للحفاظ على سلامة وتخطيط لوحة KiCad الأصلية بدون أي أخطاء." : "Design rule checks bypassed automatically to preserve original KiCad board tracks and layout without errors."}
                        </span>
                      </div>
                    ) : designChecks.drc.length === 0 ? (
                      <div className="py-10 text-center text-emerald-400 text-xs sm:text-sm font-medium flex flex-col items-center gap-2.5">
                        <CheckCircle2 className="size-8 text-emerald-400/80" />
                        <span>✓ {lang === "ar" ? "لوحة الـ PCB خالية تماماً من أخطاء التصميم والمسارات النشطة" : "No active DRC issues detected on PCB layout"}</span>
                        {designChecks.ignoredDrc.length > 0 && (
                          <div className="flex items-center gap-2 mt-1 text-slate-400 text-xs">
                            <span>
                              {lang === "ar" ? `(تم تجاهل ${designChecks.ignoredDrc.length} ملاحظة)` : `(${designChecks.ignoredDrc.length} issues ignored)`}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowIgnoredInModal(true)}
                              className="text-blue-400 hover:text-blue-300 underline font-semibold transition-colors"
                            >
                              {lang === "ar" ? "عرض واستعادة" : "View & Restore"}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      designChecks.drc.map((i) => (
                        <div
                          key={i.id}
                          className={`rounded-lg p-3 border text-xs transition-colors ${
                            i.severity === "warning" || i.severity === "error"
                              ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
                              : "border-sky-500/20 bg-sky-500/10 text-sky-200"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono font-bold opacity-90 pb-1.5 border-b border-current/10">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono">{i.code}</span>
                              <span className="uppercase font-sans font-bold px-1.5 py-0.5 rounded bg-black/30">
                                {lang === "ar"
                                  ? i.severity === "warning" || i.severity === "error"
                                    ? "تحذير"
                                    : "تنبيه"
                                  : i.severity === "error"
                                  ? "warning"
                                  : i.severity}
                              </span>
                              {i.reference && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-300 font-mono border border-slate-700/40">
                                  {i.reference}
                                </span>
                              )}
                              {i.netId !== undefined && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-900/60 text-slate-300 font-mono border border-slate-700/40">
                                  Net #{i.netId}
                                </span>
                              )}
                            </div>

                            {/* Ignore Button */}
                            <button
                              type="button"
                              onClick={() => handleIgnoreIssue(i.id)}
                              className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-slate-300 hover:text-amber-300 bg-slate-900/80 hover:bg-amber-500/20 border border-slate-700 hover:border-amber-500/40 transition-all flex items-center gap-1 shrink-0 ml-auto rtl:mr-auto rtl:ml-0 shadow-sm"
                              title={lang === "ar" ? "تجاهل هذا التحذير" : "Ignore this warning"}
                            >
                              <EyeOff className="size-3 text-amber-400" />
                              <span>{lang === "ar" ? "تجاهل" : "Ignore"}</span>
                            </button>
                          </div>
                          <div className="text-xs sm:text-sm mt-2 leading-relaxed font-medium">
                            {lang === "ar" ? i.messageAr || i.message : i.message}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* DRC Ignored Issues Section */}
                {(showIgnoredInModal || designChecks.drc.length === 0) && designChecks.ignoredDrc.length > 0 && (
                  <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden flex flex-col">
                    <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <EyeOff className="size-4 text-slate-400" />
                        <span className="font-bold text-xs sm:text-sm text-slate-300">
                          {lang === "ar" ? "الملاحظات المتجاهلة (DRC)" : "Ignored DRC Issues"}
                        </span>
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                          {designChecks.ignoredDrc.length}
                        </span>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRestoreAll("DRC")}
                        className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-600/15 gap-1"
                      >
                        <RotateCcw className="size-3" />
                        <span>{lang === "ar" ? "استعادة الكل" : "Restore All"}</span>
                      </Button>
                    </div>
                    <div className="p-3 space-y-2 max-h-[35vh] overflow-y-auto custom-scrollbar">
                      {designChecks.ignoredDrc.map((i) => (
                        <div
                          key={i.id}
                          className="rounded-lg p-2.5 border border-slate-800 bg-slate-900/50 text-slate-400 opacity-80 hover:opacity-100 transition-opacity text-xs"
                        >
                          <div className="flex items-center justify-between gap-2 text-[10px] font-mono font-bold opacity-80 pb-1 border-b border-slate-800">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="line-through">{i.code}</span>
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-sans">
                                {lang === "ar" ? "متجاهل" : "Ignored"}
                              </span>
                              {i.reference && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-400 font-mono">
                                  {i.reference}
                                </span>
                              )}
                            </div>
                            {/* Restore Button */}
                            <button
                              type="button"
                              onClick={() => handleUnignoreIssue(i.id)}
                              className="px-2 py-0.5 rounded-md text-[11px] font-semibold text-blue-400 hover:text-white bg-blue-600/15 hover:bg-blue-600/30 border border-blue-500/30 transition-all flex items-center gap-1 shrink-0 ml-auto rtl:mr-auto rtl:ml-0 shadow-sm"
                              title={lang === "ar" ? "استعادة هذا الخطأ" : "Restore this error"}
                            >
                              <RotateCcw className="size-3" />
                              <span>{lang === "ar" ? "استعادة" : "Restore"}</span>
                            </button>
                          </div>
                          <div className="text-xs mt-1.5 leading-relaxed">
                            {lang === "ar" ? i.messageAr || i.message : i.message}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer - Styled like Footprint Generator Theme */}
          <DialogFooter className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-slate-900/60 shrink-0 flex items-center justify-between sm:justify-end gap-3">
            <div className="text-xs text-slate-400 hidden sm:block">
              {designChecks.passed ? (
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" />
                  {lang === "ar" ? "اجتاز كافة الفحوصات بنجاح" : "All design checks passed"}
                  {(designChecks.ignoredErc.length + designChecks.ignoredDrc.length) > 0 && (
                    <span className="text-slate-400 font-normal">
                      {" "}({lang === "ar" ? `تم تجاهل ${designChecks.ignoredErc.length + designChecks.ignoredDrc.length} ملاحظة` : `${designChecks.ignoredErc.length + designChecks.ignoredDrc.length} ignored`})
                    </span>
                  )}
                </span>
              ) : (
                <span className={`font-semibold flex items-center gap-1.5 ${designChecks.errors.length > 0 ? "text-red-400" : "text-amber-400"}`}>
                  <AlertTriangle className="size-4" />
                  {lang === "ar"
                    ? `يتطلب المعالجة (${designChecks.errors.length > 0 ? `${designChecks.errors.length} أخطاء` : ""}${designChecks.errors.length > 0 && designChecks.warnings.length > 0 ? " و " : ""}${designChecks.warnings.length > 0 ? `${designChecks.warnings.length} تحذيرات` : ""})`
                    : `Attention needed (${designChecks.errors.length > 0 ? `${designChecks.errors.length} errors` : ""}${designChecks.errors.length > 0 && designChecks.warnings.length > 0 ? ", " : ""}${designChecks.warnings.length > 0 ? `${designChecks.warnings.length} warnings` : ""})`}
                </span>
              )}
            </div>

            <Button
              type="button"
              onClick={() => setDesignCheckOpen(false)}
              className="px-5 py-2 h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-bold border border-blue-500/40 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:border-blue-400 transition-all shadow-sm shadow-blue-500/10 flex items-center gap-2"
            >
              <span>{lang === "ar" ? "إغلاق" : "Close"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ECO Dialog */}
      <Dialog open={ecoOpen} onOpenChange={setEcoOpen}>
        <DialogContent hideCloseButton={true} className="w-[96vw] sm:w-full sm:max-w-2xl max-h-[92vh] sm:max-h-[85vh] bg-slate-950 border border-slate-800 text-slate-100 shadow-2xl p-0 overflow-hidden font-sans rounded-2xl flex flex-col">
          {/* Header */}
          <DialogHeader className="p-3 sm:p-4 border-b border-slate-800/80 bg-slate-900/70 backdrop-blur shrink-0 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="size-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                  <Zap className="size-5" />
                </div>
                <div className="min-w-0 text-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <DialogTitle className="text-sm sm:text-base font-bold tracking-tight text-white m-0">
                      {lang === "ar" ? "نظام التغيير الهندسي (ECO)" : "Engineering Change Order (ECO)"}
                    </DialogTitle>
                    {hasEcoChanges ? (
                      <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        {ecoDiff.add.length + ecoDiff.update.length + ecoDiff.remove.length + ecoDiff.nets.added.length + ecoDiff.nets.changed.length + ecoDiff.nets.removed.length} {lang === "ar" ? "تغييرات معلقة" : "pending"}
                      </span>
                    ) : (
                      <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {lang === "ar" ? "متطابق" : "Synced"}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">
                    {lang === "ar" ? "مراجعة واعتماد الفروقات والاتصالات الكهربائية بين المخطط ولوحة PCB." : "Review and synchronize net connections and footprints between Schematic and PCB."}
                  </p>
                </div>
              </div>
              {/* Close Button on Opposite Side - Bordered in Blue */}
              <DialogClose
                onClick={() => setEcoOpen(false)}
                className="h-8 w-8 shrink-0 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500"
                title={lang === "ar" ? "إغلاق" : "Close"}
              >
                <X className="h-4 w-4 stroke-[2.5]" />
                <span className="sr-only">{lang === "ar" ? "إغلاق" : "Close"}</span>
              </DialogClose>
            </div>

            {/* Mobile Summary Pills Bar */}
            {hasEcoChanges && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-0.5 scrollbar-none text-[10px] sm:text-xs font-semibold">
                {ecoDiff.add.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 shrink-0">
                    <Plus className="size-3 text-emerald-400" />
                    <span>{ecoDiff.add.length} {lang === "ar" ? "إضافة" : "Add"}</span>
                  </span>
                )}
                {ecoDiff.update.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-500/20 shrink-0">
                    <RotateCw className="size-3 text-blue-400" />
                    <span>{ecoDiff.update.length} {lang === "ar" ? "تحديث" : "Update"}</span>
                  </span>
                )}
                {(ecoDiff.nets.added.length + ecoDiff.nets.changed.length + ecoDiff.nets.removed.length) > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/20 shrink-0">
                    <Activity className="size-3 text-amber-400" />
                    <span>{ecoDiff.nets.added.length + ecoDiff.nets.changed.length + ecoDiff.nets.removed.length} {lang === "ar" ? "شبكات" : "Nets"}</span>
                  </span>
                )}
                {ecoDiff.remove.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-500/10 text-red-300 border border-red-500/20 shrink-0">
                    <Trash2 className="size-3 text-red-400" />
                    <span>{ecoDiff.remove.length} {lang === "ar" ? "حذف" : "Remove"}</span>
                  </span>
                )}
                {ecoDiff.blocked.length > 0 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600/20 text-red-200 border border-red-500/40 font-bold shrink-0 animate-pulse">
                    <AlertTriangle className="size-3 text-red-400" />
                    <span>{ecoDiff.blocked.length} {lang === "ar" ? "محجوز" : "Blocked"}</span>
                  </span>
                )}
              </div>
            )}
          </DialogHeader>

          {/* Scrollable Content */}
          <ScrollArea className="flex-1 overflow-y-auto max-h-[calc(92vh-140px)] sm:max-h-[58vh]">
            <div className="p-3 sm:p-4 space-y-3.5 sm:space-y-4">
              {!hasEcoChanges ? (
                <div className="flex flex-col items-center justify-center py-10 sm:py-14 text-center space-y-3 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800 p-4">
                  <div className="size-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.15)]">
                    <CheckCircle2 className="size-7 text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-100">{lang === "ar" ? "المخطط ولوحة PCB متطابقان تماماً!" : "Fully Synchronized!"}</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm">
                      {lang === "ar" ? "لا توجد تعديلات معلقة أو اختلافات في التوصيلات والمكونات." : "No pending modifications found requiring synchronization."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3.5 sm:space-y-4">
                  {/* ADD SECTION */}
                  {ecoDiff.add.length > 0 && (
                    <div className="rounded-xl sm:rounded-2xl bg-emerald-500/[0.03] border border-emerald-500/20 overflow-hidden shadow-sm">
                      <div className="bg-emerald-950/40 px-3 sm:px-4 py-2.5 sm:py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/15">
                        <div className="flex items-center gap-2">
                          <Plus className="size-4 text-emerald-400 shrink-0" />
                          <span className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
                            {lang === "ar" ? `إضافة مكونات جديدة (${ecoDiff.add.length})` : `Provision New Components (${ecoDiff.add.length})`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-auto">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] sm:text-xs bg-emerald-950/60 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 font-bold" onClick={() => handleGlobalPackage("DIP")}>
                            {lang === "ar" ? "DIP للكل" : "DIP ALL"}
                          </Button>
                          <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] sm:text-xs bg-emerald-950/60 border-emerald-500/30 hover:bg-emerald-500/20 text-emerald-300 font-bold" onClick={() => handleGlobalPackage("SMD")}>
                            {lang === "ar" ? "SMD للكل" : "SMD ALL"}
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 px-2 text-[10px] sm:text-xs bg-blue-950/60 border-blue-500/30 hover:bg-blue-500/20 text-blue-300 font-bold">
                                {lang === "ar" ? "الحجم" : "SIZE"}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="bg-slate-900 border-slate-800 text-white min-w-[130px]">
                              {["0805", "0603", "0402", "1206"].map(size => (
                                <DropdownMenuItem key={size} onClick={() => handleGlobalSize(size)} className="text-xs focus:bg-slate-800 focus:text-white cursor-pointer py-1.5">
                                  {lang === "ar" ? `الكل ${size}` : `All ${size}`}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      <div className="p-3 sm:p-4 space-y-2.5">
                        {ecoDiff.add.map((item) => {
                          const pkgs = getPackagesForSymbol(item.symbol);
                          const selectedPkgId = packageSelections[item.id] || pkgs[0]?.id;
                          const currentPkg = pkgs.find(p => p.id === selectedPkgId) || pkgs[0];
                          const hasDip = pkgs.some(p => p.type === "DIP");
                          const hasSmd = pkgs.some(p => p.type === "SMD");

                          return (
                            <div key={item.id} className="flex flex-col gap-2.5 p-3 bg-slate-900/60 rounded-xl border border-slate-800/90 hover:border-emerald-500/40 transition-all shadow-sm">
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="size-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)] shrink-0" />
                                  <span className="font-mono font-bold text-sm text-slate-100 tracking-tight">{item.reference}</span>
                                  <span className="text-[10px] text-slate-400 bg-slate-800/90 border border-slate-700/60 px-2 py-0.5 rounded-md font-medium truncate max-w-[120px]">
                                    {item.symbol}
                                  </span>
                                </div>

                                {/* Quick Single-Tap DIP / SMD Switcher on Mobile */}
                                <div className="flex items-center bg-slate-950/80 p-0.5 rounded-lg border border-slate-800 shrink-0">
                                  {hasDip && (
                                    <button
                                      type="button"
                                      onClick={() => handleSinglePackageType(item.id, item.symbol, "DIP")}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition-all ${
                                        currentPkg?.type === "DIP"
                                          ? "bg-emerald-500 text-slate-950 shadow-sm"
                                          : "text-slate-400 hover:text-slate-200"
                                      }`}
                                    >
                                      DIP
                                    </button>
                                  )}
                                  {hasSmd && (
                                    <button
                                      type="button"
                                      onClick={() => handleSinglePackageType(item.id, item.symbol, "SMD")}
                                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono transition-all ${
                                        currentPkg?.type === "SMD"
                                          ? "bg-blue-500 text-white shadow-sm"
                                          : "text-slate-400 hover:text-slate-200"
                                      }`}
                                    >
                                      SMD
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="relative">
                                <select
                                  className="w-full bg-slate-950/90 border border-slate-700/80 text-xs sm:text-sm rounded-lg px-3 py-2.5 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all cursor-pointer text-slate-200 min-h-[42px] appearance-none"
                                  value={selectedPkgId}
                                  onChange={(e) => setPackageSelections({ ...packageSelections, [item.id]: e.target.value })}
                                >
                                  {pkgs.map(p => (
                                    <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100 py-1">
                                      {p.name} ({p.type})
                                    </option>
                                  ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 end-0 flex items-center px-3 text-slate-400">
                                  <ChevronLeft className="size-4 -rotate-90 rtl:rotate-90" />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* UPDATE SECTION */}
                  {ecoDiff.update.length > 0 && (
                    <div className="rounded-xl sm:rounded-2xl bg-blue-500/[0.03] border border-blue-500/20 overflow-hidden shadow-sm">
                      <div className="bg-blue-950/40 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 border-b border-blue-500/15">
                        <RotateCw className="size-4 text-blue-400 shrink-0" />
                        <span className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                          {lang === "ar" ? `تحديث المكونات (${ecoDiff.update.length})` : `Update Components (${ecoDiff.update.length})`}
                        </span>
                      </div>
                      <div className="p-3 sm:p-4 space-y-2.5">
                        {ecoDiff.update.map((item) => (
                          <div key={item.id} className="p-3 bg-slate-900/60 rounded-xl border border-slate-800/90">
                            <div className="flex items-center gap-2 mb-2 font-mono">
                              <div className="size-2 rounded-full bg-blue-400" />
                              <span className="font-bold text-sm text-slate-100">{item.reference}</span>
                            </div>
                            <div className="space-y-1.5">
                              {item.changes.map((c, i) => (
                                <div key={i} className="text-xs text-blue-200 flex items-start gap-2 bg-blue-950/40 px-2.5 py-1.5 rounded-lg border border-blue-500/10">
                                  <span className="text-blue-400 mt-0.5">•</span>
                                  <span className="font-mono">
                                    {lang === "ar" ? (
                                      c.startsWith("Reference:") ? c.replace("Reference:", "المعرف:").replace("➔", "←") :
                                      c.startsWith("Value:") ? c.replace("Value:", "القيمة:").replace("➔", "←").replace("None", "لا شيء") :
                                      c.startsWith("Symbol:") ? c.replace("Symbol:", "الرمز:").replace("➔", "←") :
                                      c.startsWith("Footprint:") ? c.replace("Footprint:", "البصمة:").replace("➔", "←").replace("None", "لا شيء") :
                                      c === "Pads configuration updated" ? "تحديث إعدادات الأرجل" :
                                      c
                                    ) : c}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* NET / CONNECTIVITY SECTION */}
                  {(ecoDiff.nets.added.length > 0 || ecoDiff.nets.removed.length > 0 || ecoDiff.nets.changed.length > 0) && (
                    <div className="rounded-xl sm:rounded-2xl bg-amber-500/[0.03] border border-amber-500/20 overflow-hidden shadow-sm">
                      <div className="bg-amber-950/40 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 border-b border-amber-500/15">
                        <Activity className="size-4 text-amber-400 shrink-0" />
                        <span className="text-xs font-bold text-amber-300 uppercase tracking-wider">
                          {lang === "ar" ? `تغييرات الشبكات والتوصيلات (${ecoDiff.nets.added.length + ecoDiff.nets.changed.length + ecoDiff.nets.removed.length})` : `Net & Connectivity Changes (${ecoDiff.nets.added.length + ecoDiff.nets.changed.length + ecoDiff.nets.removed.length})`}
                        </span>
                      </div>
                      <div className="p-3 sm:p-4 space-y-2 text-xs">
                        {ecoDiff.nets.added.map(n => (
                          <div key={`add-${n.key}`} className="p-2.5 rounded-xl bg-emerald-950/30 border border-emerald-500/20 text-emerald-200 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0 font-mono">
                              <span className="font-bold text-emerald-400">+</span>
                              <span className="font-semibold truncate">{n.name}</span>
                            </div>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-300 border border-emerald-500/20 shrink-0">
                              {n.members} {lang === "ar" ? "أطراف" : "pins"}
                            </span>
                          </div>
                        ))}
                        {ecoDiff.nets.changed.map(n => (
                          <div key={`chg-${n.key}`} className="p-2.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-amber-200 flex flex-col gap-1">
                            <div className="flex items-center gap-2 font-mono">
                              <span className="font-bold text-amber-400">↻</span>
                              <span className="font-semibold">{n.name}</span>
                            </div>
                            <div className="text-[11px] text-amber-300/80 ps-4 font-mono">
                              {lang === "ar"
                                ? n.changes
                                    .map((c) =>
                                      c.startsWith("Members:")
                                        ? c.replace("Members:", "الأطراف:").replace("→", "←")
                                        : c.startsWith("Status:")
                                        ? c.replace("Status:", "الحالة:").replace("→", "←").replace("unknown", "غير معروف")
                                        : c
                                    )
                                    .join(" · ")
                                : n.changes.join(" · ")}
                            </div>
                          </div>
                        ))}
                        {ecoDiff.nets.removed.map(n => (
                          <div key={`rm-${n.key}`} className="p-2.5 rounded-xl bg-red-950/30 border border-red-500/20 text-red-300 flex items-center gap-2 font-mono">
                            <span className="font-bold text-red-400">−</span>
                            <span className="line-through opacity-80">{n.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* BLOCKED CHANGES SECTION */}
                  {ecoDiff.blocked.length > 0 && (
                    <div className="rounded-xl sm:rounded-2xl bg-red-500/[0.05] border border-red-500/35 overflow-hidden shadow-sm">
                      <div className="bg-red-950/50 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 border-b border-red-500/20">
                        <AlertTriangle className="size-4 text-red-400 shrink-0" />
                        <span className="text-xs font-bold text-red-300 uppercase tracking-wider">
                          {lang === "ar" ? "تغييرات محجوزة للمراجعة اليدوية" : "Blocked ECO Changes"}
                        </span>
                      </div>
                      <div className="p-3 sm:p-4 space-y-2 text-xs">
                        {ecoDiff.blocked.map(item => (
                          <div key={item.id} className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/20 text-red-200">
                            <div className="font-mono font-bold text-red-400 mb-0.5">{item.reference}</div>
                            <div className="text-[11px] text-red-300/90">
                              {lang === "ar" ? (
                                item.reason === "Footprint is scheduled for removal but has physically connected PCB routing." ? "البصمة مجدولة للحذف ولكنها تمتلك مسارات نحاسية متصلة في اللوحة." :
                                item.reason === "Multi-unit component has conflicting Footprint assignments." ? "المكون متعدد الوحدات لديه ارتباطات بصمة متناقضة." :
                                item.reason === "Multi-unit component has no physical owner footprint." ? "المكون متعدد الوحدات ليس له بصمة مادية مالكة." :
                                item.reason === "Multi-unit component has more than one physical footprint." ? "المكون متعدد الوحدات له أكثر من بصمة مادية واحدة." :
                                item.reason
                              ) : item.reason}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* NET LABELS SECTION */}
                  {ecoDiff.labels.added.length + ecoDiff.labels.removed.length > 0 && (
                    <div className="rounded-xl sm:rounded-2xl bg-violet-500/[0.03] border border-violet-500/20 overflow-hidden">
                      <div className="bg-violet-950/40 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 border-b border-violet-500/15">
                        <Type className="size-4 text-violet-400 shrink-0" />
                        <span className="text-xs font-bold text-violet-300 uppercase tracking-wider">
                          {lang === "ar" ? "تغييرات أسماء الشبكات (Net Labels)" : "Net Label Changes"}
                        </span>
                      </div>
                      <div className="p-3 sm:p-4 flex flex-wrap gap-2 text-xs">
                        {ecoDiff.labels.added.map(x => (
                          <span key={`la-${x}`} className="px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 font-mono text-xs flex items-center gap-1">
                            <span className="text-emerald-400 font-bold">+</span> {x}
                          </span>
                        ))}
                        {ecoDiff.labels.removed.map(x => (
                          <span key={`lr-${x}`} className="px-2.5 py-1 rounded-lg bg-red-950/40 border border-red-500/20 text-red-300 font-mono text-xs flex items-center gap-1">
                            <span className="text-red-400 font-bold">−</span> {x}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* REMOVE SECTION */}
                  {ecoDiff.remove.length > 0 && (
                    <div className="rounded-xl sm:rounded-2xl bg-red-500/[0.03] border border-red-500/20 overflow-hidden shadow-sm">
                      <div className="bg-red-950/40 px-3 sm:px-4 py-2.5 sm:py-3 flex items-center gap-2 border-b border-red-500/15">
                        <Trash2 className="size-4 text-red-400 shrink-0" />
                        <span className="text-xs font-bold text-red-300 uppercase tracking-wider">
                          {lang === "ar" ? `حذف من PCB (${ecoDiff.remove.length})` : `Retire from PCB (${ecoDiff.remove.length})`}
                        </span>
                      </div>
                      <div className="p-3 sm:p-4 flex flex-wrap gap-2">
                        {ecoDiff.remove.map((item) => (
                          <div key={item.id} className="font-mono text-xs font-bold text-red-300 bg-red-950/50 px-2.5 py-1.5 rounded-lg border border-red-500/20 flex items-center gap-1.5 shadow-sm">
                            <X className="size-3 text-red-400" />
                            {item.reference}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Mobile-Friendly Responsive Footer */}
          <DialogFooter className="p-3 sm:p-4 border-t border-slate-800/80 bg-slate-900/70 backdrop-blur flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3 shrink-0">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                className="w-full sm:w-auto border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold h-10 sm:h-9 text-xs sm:text-sm"
                onClick={() => setEcoOpen(false)}
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </Button>
              {project?.doc.pcb?.footprints?.length ? (
                <Button
                  variant="outline"
                  className="w-full sm:w-auto border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 hover:border-emerald-500 h-10 sm:h-9 text-xs sm:text-sm font-semibold"
                  onClick={handlePullFootprintAssignments}
                  title={lang === "ar" ? "اعتماد ارتباطات Footprints من PCB إلى المخطط" : "Adopt Footprint assignments from PCB"}
                >
                  <RotateCcw className="size-3.5 mr-1 rtl:ml-1 rtl:mr-0 text-emerald-400" />
                  <span className="truncate">{lang === "ar" ? "اعتماد من PCB" : "Adopt PCB Footprints"}</span>
                </Button>
              ) : null}
            </div>

            {hasEcoChanges && (
              <Button
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold px-6 h-11 sm:h-10 text-xs sm:text-sm rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
                onClick={handleApplyEco}
              >
                <Zap className="size-4 fill-current" />
                <span>{lang === "ar" ? "تطبيق التغييرات" : "Execute ECO"}</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit Dialog */}
      <Dialog open={unitDialogOpen} onOpenChange={setUnitDialogOpen}>
        <DialogContent hideCloseButton={true} className="max-w-full w-screen h-screen m-0 p-0 sm:max-w-full sm:rounded-none rounded-none bg-slate-950 border-none flex flex-col font-sans">
          <DialogHeader className="py-2.5 sm:py-3.5 px-4 sm:px-6 border-b border-slate-800 bg-slate-900/50 shrink-0">
            <div className="flex items-center justify-between gap-3 w-full">
              <div className="flex items-center gap-2.5 min-w-0">
                <Cpu className="size-4 sm:size-5 text-primary shrink-0" />
                <DialogTitle className="text-sm sm:text-base font-bold tracking-tight text-white m-0 truncate">
                  {lang === "ar" ? "إعدادات وحدة schematic" : "Schematic Unit Settings"}
                </DialogTitle>
              </div>
              <DialogClose className="h-8 w-8 shrink-0 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg transition-all flex items-center justify-center shadow-sm shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <X className="h-4 w-4 stroke-[2.5]" />
                <span className="sr-only">{lang === "ar" ? "إغلاق" : "Close"}</span>
              </DialogClose>
            </div>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-20">
              
              {/* Appearance */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 font-semibold text-slate-200">
                  {lang === "ar" ? "العرض والمظهر" : "Appearance & Display"}
                </div>
                <div className="p-4 space-y-3">
                  <Button variant="outline" className="w-full justify-start border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={togglePreviewMode}>
                    {!showUI ? <Maximize className="h-4 w-4 mr-3 text-red-500" /> : <Eye className="h-4 w-4 mr-3 text-green-500" />}
                    {lang === "ar" ? "وضع المعاينة" : "Preview Mode"}
                    <span className="ml-auto text-xs text-muted-foreground">{!showUI ? (lang === "ar" ? "إلغاء" : "Exit") : (lang === "ar" ? "تفعيل" : "Enter")}</span>
                  </Button>
                  <Button variant="outline" className="w-full justify-start border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={() => setDoc((d) => ({ ...d, canvasColor: d.canvasColor === "black" ? "white" : "black" }))}>
                    <Palette className="h-4 w-4 mr-3 text-sky-500" />
                    {lang === "ar" ? "لون خلفية الرسم" : "Canvas Background"}
                    <span className="ml-auto text-xs text-muted-foreground">{project.doc.canvasColor === "black" ? (lang === "ar" ? "أسود" : "Black") : (lang === "ar" ? "أبيض" : "White")}</span>
                  </Button>
                </div>
              </div>

              {/* Grid & Alignment */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 font-semibold text-slate-200">
                  {lang === "ar" ? "الشبكة والمحاذاة" : "Grid & Alignment"}
                </div>
                <div className="p-4 space-y-3">
                  <Button variant="outline" className="w-full justify-start border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={() => setShowGrid(!showGrid)}>
                    <Grid className="h-4 w-4 mr-3 text-purple-500" />
                    {lang === "ar" ? "إظهار الشبكة" : "Show Grid"}
                    <span className="ml-auto text-xs text-muted-foreground">{showGrid ? (lang === "ar" ? "إخفاء" : "Hide") : (lang === "ar" ? "إظهار" : "Show")}</span>
                  </Button>
                  <Button variant="outline" className="w-full justify-start border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={() => setSnapToGrid(!snapToGrid)}>
                    <Sparkles className="h-4 w-4 mr-3 text-amber-500" />
                    {lang === "ar" ? "محاذاة الشبكة" : "Snap to Grid"}
                    <span className="ml-auto text-xs text-muted-foreground">{snapToGrid ? (lang === "ar" ? "مفعّل" : "ON") : (lang === "ar" ? "معطّل" : "OFF")}</span>
                  </Button>
                </div>
              </div>

              {/* Tools */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 font-semibold text-slate-200">
                  {lang === "ar" ? "أدوات الرسم والتحرير" : "Drawing & Edit Tools"}
                </div>
                <div className="p-4 space-y-3">
                  <Button variant="outline" className="w-full justify-start border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800" onClick={() => {
                    setModelManagerOpen(true);
                    setUnitDialogOpen(false);
                  }}>
                    <Library className="h-4 w-4 mr-3 text-primary" />
                    {lang === "ar" ? "مدير النماذج" : "Model Manager"}
                  </Button>
                </div>
              </div>

              {/* Defaults */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="bg-slate-800/50 px-4 py-3 border-b border-slate-800 font-semibold text-slate-200">
                  {lang === "ar" ? "الإعدادات الافتراضية" : "Default Settings"}
                </div>
                <div className="p-4 space-y-5">
                  {/* Default Element Color */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400">{lang === "ar" ? "لون العناصر الافتراضي" : "Element Color"}</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { val: "black", color: "#111111" },
                        { val: "white", color: "#ffffff" },
                        { val: "red", color: "#dc2626" },
                        { val: "yellow", color: "#eab308" },
                        { val: "green", color: "#16a34a" },
                        { val: "blue", color: "#2563eb" },
                      ].map(opt => (
                        <button
                          key={opt.val}
                          onClick={() => handleUpdateDefaultElementColor(opt.val as WireColor)}
                          className={`w-8 h-8 rounded-full border-2 ${(project.doc.defaultElementColor || "black") === opt.val ? "border-primary scale-110" : "border-slate-700"} transition-all`}
                          style={{ backgroundColor: opt.color }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  {/* Default Wire Color */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400">{lang === "ar" ? "لون السلك الافتراضي" : "Wire Color"}</label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { val: "black", color: "#111111" },
                        { val: "white", color: "#ffffff" },
                        { val: "red", color: "#dc2626" },
                        { val: "yellow", color: "#eab308" },
                        { val: "green", color: "#16a34a" },
                        { val: "blue", color: "#2563eb" },
                      ].map(opt => (
                        <button
                          key={opt.val}
                          onClick={() => handleUpdateDefaultWireColor(opt.val as WireColor)}
                          className={`w-8 h-8 rounded-full border-2 ${wireColor === opt.val ? "border-primary scale-110" : "border-slate-700"} transition-all`}
                          style={{ backgroundColor: opt.color }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Wire Thickness */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400">{lang === "ar" ? "سمك السلك الافتراضي" : "Default Wire Thickness"}</label>
                    <select
                      value={project.doc.defaultWireWidth ?? 0.1}
                      onChange={(e) => handleUpdateDefaultWireWidth(parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                    >
                      <option value={0.1}>{lang === "ar" ? "عادي" : "Normal"}</option>
                      <option value={0.15}>{lang === "ar" ? "متوسط" : "Medium"}</option>
                      <option value={0.2}>{lang === "ar" ? "سميك" : "Thick"}</option>
                      <option value={0.3}>{lang === "ar" ? "عريض" : "Wide"}</option>
                    </select>
                  </div>

                  {/* Component Size */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-slate-400">{lang === "ar" ? "حجم العنصر الافتراضي" : "Default Component Size"}</label>
                    <select
                      value={project.doc.defaultNodeSize ?? 1.0}
                      onChange={(e) => handleUpdateDefaultNodeSize(parseFloat(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-md px-3 py-2 text-sm outline-none focus:border-primary transition-colors"
                    >
                      <option value={0.8}>{lang === "ar" ? "صغير" : "S (80%)"}</option>
                      <option value={1.0}>{lang === "ar" ? "طبيعي" : "M (100%)"}</option>
                      <option value={1.2}>{lang === "ar" ? "كبير" : "L (120%)"}</option>
                      <option value={1.5}>{lang === "ar" ? "كبير جداً" : "XL (150%)"}</option>
                      <option value={2.0}>{lang === "ar" ? "ضخم" : "XXL (200%)"}</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-3 sm:px-6 border-t border-slate-800 bg-slate-900/60 shrink-0 flex flex-row items-center justify-center gap-3">
            <Button
              type="button"
              onClick={() => setUnitDialogOpen(false)}
              className="px-5 py-2 h-9 sm:h-10 rounded-xl text-xs sm:text-sm font-bold border border-blue-500/40 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 hover:border-blue-400 transition-all shadow-sm shadow-blue-500/10 flex items-center gap-2"
            >
              <span>{lang === "ar" ? "إغلاق" : "Close"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="fixed inset-0 z-50 bg-slate-950 w-screen h-screen max-w-none m-0 border-none rounded-none flex flex-col font-sans p-0 text-slate-100 overflow-hidden left-0 top-0 translate-x-0 translate-y-0 [&>button:last-child]:hidden">
          
          {/* Header with Switcher Buttons */}
          <div className="flex items-center justify-between px-4 md:px-6 py-2.5 border-b border-slate-800 bg-slate-900/80 shrink-0 flex-row-reverse">
            <div className="flex items-center gap-2">
              {/* Button 1: Save Project (First & Default) */}
              <Button
                variant="ghost"
                onClick={() => setActiveModalTab("save_project")}
                className={`h-9 px-3.5 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  activeModalTab === "save_project"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-sm shadow-blue-500/15 hover:bg-blue-600/30 hover:border-blue-400"
                    : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <div className={`w-4 h-4 rounded overflow-hidden flex items-center justify-center p-0.5 bg-slate-950/80 border ${activeModalTab === "save_project" ? "border-blue-400/40" : "border-slate-700"} shrink-0`}>
                  <Logo className="w-full h-full object-contain" />
                </div>
                <span>{lang === "ar" ? "حفظ المشروع" : "Save Project"}</span>
              </Button>

              {/* Button 2: Export & Save */}
              <Button
                variant="ghost"
                onClick={() => setActiveModalTab("export")}
                className={`h-9 px-3.5 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  activeModalTab === "export"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-sm shadow-blue-500/15 hover:bg-blue-600/30 hover:border-blue-400"
                    : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <Download className="size-4 text-blue-400 shrink-0" />
                <span>{lang === "ar" ? "تصدير وحفظ" : "Export & Save"}</span>
              </Button>

              {/* Button 3: Import */}
              <Button
                variant="ghost"
                onClick={() => setActiveModalTab("import")}
                className={`h-9 px-3.5 rounded-lg font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
                  activeModalTab === "import"
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/50 shadow-sm shadow-blue-500/15 hover:bg-blue-600/30 hover:border-blue-400"
                    : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200 border border-slate-800"
                }`}
              >
                <Upload className="size-4 text-blue-400 shrink-0" />
                <span>{lang === "ar" ? "استيراد" : "Import"}</span>
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setExportDialogOpen(false)}
              className="h-8 w-8 text-blue-400 hover:text-white hover:bg-blue-600/20 border-2 border-blue-500/80 hover:border-blue-400 rounded-lg cursor-pointer flex items-center justify-center transition-all shadow-sm shadow-blue-500/20"
              title={lang === "ar" ? "إغلاق" : "Close"}
            >
              <X className="size-4 stroke-[2.5]" />
            </Button>
          </div>

          {/* Tab 1: Save Project (.zuit format) */}
          {activeModalTab === "save_project" && (
            <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 md:py-8 bg-slate-950/20 flex flex-col justify-center">
              <div className="max-w-3xl mx-auto w-full space-y-6">
                
                {/* Header Card */}
                <div className="bg-gradient-to-br from-blue-950/40 via-slate-900/60 to-slate-950 border border-blue-500/30 rounded-2xl p-6 text-center space-y-3 shadow-xl relative overflow-hidden">
                  <div className="absolute -right-10 -top-10 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                  
                  <div className="mx-auto h-16 w-16 rounded-2xl bg-slate-900 border-2 border-blue-500/40 flex items-center justify-center p-2.5 shadow-lg shadow-blue-950/50">
                    <Logo className="w-full h-full object-contain" />
                  </div>

                  <div>
                    <h3 className="text-xl md:text-2xl font-bold text-white flex items-center justify-center gap-2">
                      {lang === "ar" ? "حفظ ملف المشروع (.zuit)" : "Save Full Project (.zuit)"}
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto mt-1.5 leading-relaxed">
                      {lang === "ar" 
                        ? "يحفظ هذا الخيار مستند المشروع بكافة وحداته الأربعة (المخطط، اللوحة المطبوعة، المحاكاة، العرض 3D)"
                        : "Saves the complete project file across all 4 modules (Schematic, PCB, Simulation, 3D View)."}
                    </p>
                  </div>
                </div>

                {/* Save Form Card */}
                <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-5 md:p-6 space-y-5">
                  
                  {/* Project Name Input */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 block">
                      {lang === "ar" ? "اسم ملف المشروع:" : "Project File Name:"}
                    </label>
                    <div className="relative">
                      <Input
                        value={exportFilename}
                        onChange={(e) => setExportFilename(e.target.value)}
                        placeholder={lang === "ar" ? "أدخل اسم الملف..." : "Enter file name..."}
                        className="bg-slate-950/80 border-slate-800 text-slate-100 font-medium pl-12 h-10 rounded-xl focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 text-sm"
                      />
                      <span className="absolute left-3 top-2.5 text-xs font-mono font-bold text-blue-400">
                        .zuit
                      </span>
                    </div>
                  </div>

                  {/* Directory Selector - Styled as in Export & Save */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <FolderOpen className="size-3.5 text-blue-400" />
                      <span>{lang === "ar" ? "مجلد الحفظ" : "Save Directory"}</span>
                    </label>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="w-full h-10 px-3 flex items-center justify-between bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 gap-2 hover:border-slate-700 hover:text-white transition-all cursor-pointer">
                          <div className="flex items-center gap-2">
                            <FolderOpen className="size-4 text-blue-400" />
                            <span className="truncate">{selectedDirectory}</span>
                          </div>
                          <ChevronLeft className="size-4 rotate-270 text-slate-500" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-64 bg-slate-900 border-slate-800 text-slate-200">
                        {exportDirectories.map((dir) => (
                          <DropdownMenuItem
                            key={dir}
                            onClick={() => setSelectedDirectory(dir)}
                            className="text-xs cursor-pointer focus:bg-blue-600 focus:text-white"
                          >
                            {dir}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Action Download Button */}
                  <div className="pt-2">
                    <Button
                      onClick={() => {
                        if (!project) return;
                        const cleanName = exportFilename.trim().replace(/\s+/g, "_") || "project";
                        downloadZuit(project.doc, cleanName, {
                          description: project.description,
                          createdAt: project.createdAt,
                          undoStack: history,
                          redoStack: redoStack,
                          simulation: {
                            faults: project.doc.faults || [],
                            bookmarks: project.doc.bookmarks || [],
                            userModels: project.doc.userModels || [],
                          },
                          realistic: {
                            viewMode: "3d_workbench",
                            showComponents: true,
                            boardColor: "#064e3b",
                            copperColor: "#d97706",
                            silkscreenColor: "#ffffff",
                          },
                        });
                        toast.success(
                          lang === "ar"
                            ? `تم حفظ المشروع (${cleanName}.zuit) بنجاح!`
                            : `Project (${cleanName}.zuit) saved successfully!`
                        );
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3.5 h-auto text-sm rounded-xl flex items-center justify-center gap-2.5 shadow-lg shadow-blue-900/40 hover:scale-[1.005] active:scale-[0.995] transition-all cursor-pointer"
                    >
                      <div className="w-5 h-5 rounded overflow-hidden flex items-center justify-center p-0.5 bg-slate-950/90 border border-blue-300/40 shrink-0">
                        <Logo className="w-full h-full object-contain" />
                      </div>
                      <span>{lang === "ar" ? "حفظ المشروع (.zuit)" : "Save Project (.zuit)"}</span>
                    </Button>
                  </div>

                </div>

              </div>
            </div>
          )}

          {/* Tab 2: Export & Save */}
          {activeModalTab === "export" && (
            <>

          {/* Scrollable Workspace */}
          <div className="flex-1 overflow-y-auto px-3 md:px-8 py-3 md:py-4 bg-slate-950/20">
            <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-3 lg:gap-6">
              
              {/* Left Column: Build Steps */}
              <div className="lg:col-span-7 space-y-3">
                
                {/* Step 1: Target Selector */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-400">1</span>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      {lang === "ar" ? "ماذا تريد أن تصدر؟ (الهدف الرئيسي)" : "What to export? (Primary Target)"}
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'schematic', label: lang === 'ar' ? 'المخطط الهندسي' : 'Schematic', desc: lang === 'ar' ? 'الرسم البياني' : 'Circuit layout', icon: <Activity className="size-3.5 text-blue-400" /> },
                      { id: 'pcb', label: lang === 'ar' ? 'لوحة PCB المطبوعة' : 'PCB Board', desc: lang === 'ar' ? 'المسارات واللوحة' : 'Physical track', icon: <Cpu className="size-3.5 text-blue-400" /> },
                      { id: 'realistic', label: lang === 'ar' ? 'العرض الواقعي' : 'Realistic View', desc: lang === 'ar' ? 'عرض ثلاثي الأبعاد' : 'Workbench view', icon: <Package className="size-3.5 text-blue-400" /> },
                    ].map((t) => (
                      <button
                        key={t.id}
                        onClick={() => {
                          setExportTarget(t.id as any);
                          // Reset format to a safe default for that target
                          if (t.id === 'pcb') setExportFormat('gerber');
                          else setExportFormat('pdf');
                        }}
                        className={`flex flex-col items-start p-2 md:p-3 rounded-lg border transition-all gap-1.5 text-right cursor-pointer ${
                          exportTarget === t.id 
                            ? "bg-blue-600/10 border-blue-500 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.08)]" 
                            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          {t.icon}
                          <div className={`h-1.5 w-1.5 rounded-full ${exportTarget === t.id ? 'bg-blue-400' : 'bg-transparent'}`} />
                        </div>
                        <div className="mt-0.5 w-full text-right sm:text-left">
                          <p className="text-[11px] font-bold text-slate-200 block truncate">{t.label}</p>
                          <p className="text-[9px] text-slate-500 leading-tight block truncate">{t.desc}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Step 2: Format Selector */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-400">2</span>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      {lang === "ar" ? "تحديد صيغة التصدير" : "Select Export Format"}
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-10 gap-1.5">
                    {(exportTarget === 'schematic' ? ['pdf', 'jpeg', 'png', 'svg', 'xml', 'json', 'kicad_sch', 'easyeda', 'eagle_sch', 'spice'] : 
                      exportTarget === 'pcb' ? ['gerber', 'gerber_x2', 'ncdrill', 'bom', 'pdf', 'jpeg', 'png', 'svg'] :
                      ['pdf', 'jpeg', 'png']
                    ).map((f) => (
                      <button
                        key={f}
                        onClick={() => setExportFormat(f)}
                        className={`py-1.5 px-1 text-[11px] font-mono font-bold rounded-lg border transition-all uppercase flex flex-col items-center gap-0.5 cursor-pointer ${
                          exportFormat === f 
                            ? "bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.08)]" 
                            : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <span className={f === 'gerber_x2' || f === 'kicad_sch' || f === 'easyeda' ? 'text-blue-300 font-bold truncate max-w-full px-0.5' : 'truncate max-w-full px-0.5'}>
                          {f === 'gerber' ? 'RS-274X' : 
                           f === 'gerber_x2' ? 'Gerber X2' : 
                           f === 'kicad_sch' ? 'KiCad' :
                           f === 'easyeda' ? 'EasyEDA' :
                           f === 'eagle_sch' ? 'Eagle' :
                           f === 'spice' ? 'SPICE' : f}
                        </span>
                        <span className="text-[8px] font-sans font-normal opacity-60">
                          {f === 'gerber' ? 'Standard' : 
                           f === 'gerber_x2' ? 'Attributes' : 
                           f === 'bom' ? 'XLSX' : 
                           f === 'kicad_sch' ? 'SCH' :
                           f === 'easyeda' ? 'JSON' :
                           f === 'eagle_sch' ? 'SCH' :
                           f === 'spice' ? 'Netlist' :
                           f === 'pdf' ? 'Doc' : 'File'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* DIY PCB Toner Transfer Settings (only shown for PCB target + PDF format) */}
                {exportTarget === 'pcb' && exportFormat === 'pdf' && (
                  <div className="bg-slate-900/60 border border-blue-500/30 rounded-xl p-3.5 space-y-3 shadow-[0_0_15px_rgba(59,130,246,0.05)]">
                    {/* PDF Type Selector */}
                    <div className="space-y-1.5 pb-3 border-b border-slate-800/80">
                      <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 justify-start">
                        <Palette className="size-3 text-blue-400" />
                        {lang === "ar" ? "نوع مستند الـ PDF المطلوب" : "PDF Document Type"}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setDiyPcbPdfType("toner_transfer")}
                          className={`py-2 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                            diyPcbPdfType === "toner_transfer"
                              ? "bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.05)]"
                              : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          {lang === "ar" ? "طباعة يدوي 1:1 بالمكواة" : "DIY Toner Transfer (1:1)"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDiyPcbPdfType("color_canvas")}
                          className={`py-2 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                            diyPcbPdfType === "color_canvas"
                              ? "bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.05)]"
                              : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                          }`}
                        >
                          {lang === "ar" ? "صورة اللوحة الملونة" : "Full-Color Board Canvas"}
                        </button>
                      </div>
                    </div>

                    {diyPcbPdfType === "toner_transfer" ? (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-400">3</span>
                            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
                              {lang === "ar" ? "إعدادات الطباعة اليدوية بنسبة 1:1" : "DIY Toner-Transfer Print Settings (1:1)"}
                            </h3>
                          </div>
                          <span className="bg-blue-500/10 text-blue-400 text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border border-blue-500/20">
                            {lang === "ar" ? "جاهز للمكواة" : "Iron-On Ready"}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right sm:text-left">
                          {/* Active Layer to Export */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                              <Layers className="size-3 text-blue-400" />
                              {lang === "ar" ? "الطبقة المراد تصديرها" : "Active Layer to Export"}
                            </label>
                            <select
                              value={diyPcbLayer}
                              onChange={(e) => handleDiyPcbLayerChange(e.target.value as any)}
                              className="w-full h-8.5 px-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="bottom_copper">{lang === "ar" ? "النحاس السفلي (Bottom Copper)" : "Bottom Copper (Tracks + Pads)"}</option>
                              <option value="top_copper">{lang === "ar" ? "النحاس العلوي (Top Copper)" : "Top Copper (Tracks + Pads)"}</option>
                              <option value="silkscreen">{lang === "ar" ? "الطباعة الحريرية العلوية (Top Silkscreen)" : "Top Silkscreen (Outlines)"}</option>
                              <option value="bottom_silkscreen">{lang === "ar" ? "الطباعة الحريرية السفلية (Bottom Silkscreen)" : "Bottom Silkscreen"}</option>
                            </select>
                          </div>

                          {/* Drill Guide Holes */}
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                              <Palette className="size-3 text-blue-400" />
                              {lang === "ar" ? "دليل حفر الثقوب" : "Drill Guide Holes"}
                            </label>
                            <select
                              value={diyPcbDrillGuide}
                              onChange={(e) => setDiyPcbDrillGuide(e.target.value as any)}
                              className="w-full h-8.5 px-2 bg-slate-950 border border-slate-800 rounded-md text-xs text-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            >
                              <option value="small">{lang === "ar" ? "نقاط صغيرة 0.5مم (موصى به للتثقيب)" : "Small Dots 0.5mm (Best for hand-drilling)"}</option>
                              <option value="full">{lang === "ar" ? "القطر الفعلي للثقب" : "Actual Drill Hole Size"}</option>
                              <option value="none">{lang === "ar" ? "بدون ثقوب (وسادات مصمتة)" : "Solid Pads (No holes)"}</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                          {/* Mirror Checkbox */}
                          <button
                            type="button"
                            onClick={() => setDiyPcbMirror(!diyPcbMirror)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                              diyPcbMirror
                                ? "bg-blue-500/10 border-blue-500 text-blue-400"
                                : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            <RotateCw className="size-3 shrink-0" />
                            <span className="truncate">{lang === "ar" ? "عكس اللوحة (Mirror)" : "Mirror Layout"}</span>
                          </button>

                          {/* Invert Checkbox */}
                          <button
                            type="button"
                            onClick={() => setDiyPcbInvert(!diyPcbInvert)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                              diyPcbInvert
                                ? "bg-blue-500/10 border-blue-500 text-blue-400"
                                : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            <Palette className="size-3 shrink-0" />
                            <span className="truncate">{lang === "ar" ? "ألوان معكوسة (Negative)" : "Invert (Negative)"}</span>
                          </button>

                          {/* Board Outline Checkbox */}
                          <button
                            type="button"
                            onClick={() => setDiyPcbOutline(!diyPcbOutline)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all col-span-2 sm:col-span-1 ${
                              diyPcbOutline
                                ? "bg-blue-500/10 border-blue-500 text-blue-400"
                                : "bg-slate-950/40 border-slate-800/80 text-slate-400 hover:border-slate-700"
                            }`}
                          >
                            <Layers className="size-3 shrink-0" />
                            <span className="truncate">{lang === "ar" ? "رسم إطار الحدود" : "Draw Outline"}</span>
                          </button>
                        </div>

                        {/* Copies Slider / Grid selector */}
                        <div className="bg-slate-950/30 border border-slate-800/60 rounded-lg p-2.5 space-y-2">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-400 text-right sm:text-left">
                              {lang === "ar" ? "عدد النسخ المطبوعة على الورقة" : "Number of copies on single A4 sheet"}
                            </span>
                            <span className="font-mono font-bold text-blue-400 bg-blue-500/15 px-2 py-0.5 rounded">
                              {diyPcbCopies} {diyPcbCopies === 1 ? (lang === "ar" ? "نسخة" : "copy") : (lang === "ar" ? "نسخ" : "copies")}
                            </span>
                          </div>
                          <div className="flex gap-1.5">
                            {[1, 2, 3, 4].map((c) => (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setDiyPcbCopies(c)}
                                className={`flex-1 py-1 text-xs font-mono font-bold rounded-md border transition-all cursor-pointer ${
                                  diyPcbCopies === c
                                    ? "bg-blue-500/10 border-blue-500 text-blue-400 shadow-[0_0_8px_rgba(59,130,246,0.08)]"
                                    : "bg-slate-950/40 border-slate-800/80 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                                  }`}
                              >
                                {c}
                              </button>
                            ))}
                          </div>
                          <p className="text-[9px] text-slate-500 leading-tight text-right sm:text-left">
                            {lang === "ar" 
                              ? "💡 تكرار المخطط على الورقة يحميك في حال فشل الكي المباشر بالمكواة لمرة واحدة."
                              : "💡 Placing multiple copies prevents waste and gives you instant backups in case of an ironing transfer issue."}
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="bg-slate-950/30 border border-slate-800/60 rounded-lg p-3.5 space-y-1.5 text-center">
                        <p className="text-xs font-bold text-blue-400">
                          {lang === "ar" ? "وضع صورة اللوحة الملونة" : "Color Canvas Layout Mode"}
                        </p>
                        <p className="text-[10px] text-slate-400 leading-relaxed max-w-md mx-auto">
                          {lang === "ar" 
                            ? "سيقوم هذا بتصدير صورة عالية الدقة لمظهر اللوحة الكامل بجميع تفاصيلها الملونة كملف PDF مناسب للعرض والتفتيش والتوثيق الفني." 
                            : "This will export a high-resolution render of the complete physical board with its beautiful colored components and copper tracks embedded in a PDF document."}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 3: Filename & Destination */}
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-3.5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/15 text-[10px] font-bold text-blue-400">
                      {exportTarget === 'pcb' && exportFormat === 'pdf' ? 4 : 3}
                    </span>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      {lang === "ar" ? "تسمية الملف ومسار الحفظ" : "Naming & Save Target"}
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400">
                        {lang === "ar" ? "اسم الملف المصدر" : "Export Filename"}
                      </label>
                      <Input
                        value={exportFilename}
                        onChange={(e) => setExportFilename(e.target.value)}
                        placeholder="Project name"
                        className="bg-slate-900/60 border-slate-800 text-slate-100 focus:border-blue-500 text-xs h-8.5"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold text-slate-400">
                        {lang === "ar" ? "مجلد الحفظ الافتراضي" : "Save Destination Folder"}
                      </label>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="w-full h-8.5 px-3 flex items-center justify-between bg-slate-900/60 border border-slate-800 rounded-md text-xs text-slate-200 gap-2 hover:border-slate-700 hover:text-white transition-all cursor-pointer">
                            <div className="flex items-center gap-2">
                              <FolderOpen className="size-3.5 text-blue-400" />
                              <span className="truncate">{selectedDirectory}</span>
                            </div>
                            <ChevronLeft className="size-3 rotate-270 text-slate-500" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className="w-52 bg-slate-900 border-slate-800 text-slate-200">
                          <DropdownMenuLabel className="text-[9px] uppercase text-slate-400">
                            {lang === "ar" ? "اختر مجلد الحفظ" : "Select Export Folder"}
                          </DropdownMenuLabel>
                          <DropdownMenuSeparator className="bg-slate-800" />
                          {exportDirectories.map((dir) => (
                            <DropdownMenuItem
                              key={dir}
                              onClick={() => setSelectedDirectory(dir)}
                              className={`text-xs cursor-pointer ${selectedDirectory === dir ? "bg-blue-500/10 text-blue-400 font-medium" : "hover:bg-slate-800"}`}
                            >
                              <FolderOpen className="size-3 mr-2 text-blue-400 shrink-0" />
                              {dir}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator className="bg-slate-800" />
                          <DropdownMenuItem
                            onClick={() => setShowCreateFolder(true)}
                            className="text-xs cursor-pointer text-blue-400 font-medium hover:bg-slate-800"
                          >
                            <Plus className="size-3 mr-2 shrink-0" />
                            {lang === "ar" ? "مجلد مخصص جديد..." : "New Custom Folder..."}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {showCreateFolder && (
                        <motion.div 
                          initial={{ opacity: 0, y: -5 }} 
                          animate={{ opacity: 1, y: 0 }}
                          className="flex gap-1.5 mt-1.5"
                        >
                          <Input
                            value={customFolderName}
                            onChange={(e) => setCustomFolderName(e.target.value)}
                            placeholder={lang === "ar" ? "/مجلد_جديد" : "/new_folder"}
                            className="bg-slate-900/60 border-slate-800 text-slate-100 text-xs h-8 flex-1"
                          />
                          <Button 
                            size="sm" 
                            onClick={handleAddCustomFolder} 
                            className="bg-blue-600 hover:bg-blue-500 text-white h-8 text-xs font-bold"
                          >
                            {lang === "ar" ? "إضافة" : "Add"}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setShowCreateFolder(false)} 
                            className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold h-8 text-xs"
                          >
                            {lang === "ar" ? "إلغاء" : "Cancel"}
                          </Button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Summaries & Dynamic Help Guidelines */}
              <div className="lg:col-span-5 space-y-3">

                {/* Intelligent Dynamic Help Guide based on current selection */}
                <div className="bg-slate-900/20 border border-slate-800/60 rounded-xl p-4 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                    <Globe className="size-3.5 text-emerald-400 shrink-0" />
                    <span>{lang === "ar" ? "دليل صيغ التصدير والتصنيع" : "Format Application Guide"}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40 text-right sm:text-left min-h-[50px]">
                    {(() => {
                      const guide = {
                        schematic: {
                          zuit: {
                            en: "Zuit Full Project (.zuit): Native single-file project format containing all 4 modules (Schematic, PCB, Simulation, Realistic view) and complete Undo/Redo history stacks.",
                            ar: "مشروع Zuit الشامل (.zuit): صيغة المشروع الموحدة التي تحفظ كافة الوحدات الأربعة (المخطط الهندسي، PCB، المحاكاة، العرض الواقعي) وسجلات التراجع والإعادة كاملة."
                          },
                          pdf: {
                            en: "PDF Document: Crisp vector schematic perfect for sharing, printing, and high-fidelity project documentation.",
                            ar: "مستند PDF: مخطط متجهات دقيق ومثالي للمشاركة والطباعة وتوثيق المشروع بجودة عالية."
                          },
                          jpeg: {
                            en: "JPEG Image: High-resolution raster file with balanced file size, great for embedding in reports or websites.",
                            ar: "صورة JPEG: ملف صورة نقطية عالي الدقة بحجم متوازن، ممتاز للتضمين في التقارير أو مواقع الويب."
                          },
                          png: {
                            en: "PNG Image: High-resolution lossless raster file with absolute clarity, ideal for presentations and digital view.",
                            ar: "صورة PNG: ملف صورة نقطية عالي الدقة غير مفقود الوضوح، مثالي للعروض التقديمية والعرض الرقمي."
                          },
                          svg: {
                            en: "SVG Vector: Infinite scaling vector format suitable for editing in Illustrator, Inkscape, or professional publishing.",
                            ar: "رسومات SVG المتجهة: تنسيق متجهات قابل للتكبير اللانهائي، مناسب للتحرير في Illustrator أو Inkscape أو النشر المهني."
                          },
                          xml: {
                            en: "XML Blueprint: Complete blueprint data including positions, references, and connections for CAD integration.",
                            ar: "مخطط XML: بيانات مخطط كاملة تشمل المواضع والمراجع والتوصيلات للتكامل مع برامج CAD."
                          },
                          json: {
                            en: "JSON Metadata: Raw project backup format containing all nodes, wires, and metadata. Easy to re-import.",
                            ar: "نسخة JSON الاحتياطية: ملف بيانات خام يحتوي على كافة العناصر والأسلاك والمخرجات، يسهل إعادة استيراده."
                          },
                          kicad_sch: {
                            en: "KiCad Schematic (.kicad_sch): Standard KiCad 6+ format with S-expression syntax, ready to open directly in KiCad.",
                            ar: "مخطط KiCad (.kicad_sch): صيغة KiCad القياسية المعتمدة على S-expressions، جاهزة للفتح المباشر في برنامج KiCad."
                          },
                          easyeda: {
                            en: "EasyEDA Schematic JSON (.json): Native EasyEDA JSON format, fully compatible with EasyEDA STD and PRO schematic importers.",
                            ar: "مخطط EasyEDA JSON (.json): صيغة EasyEDA القياسية، متوافقة كلياً مع أداة الاستيراد في برنامج EasyEDA."
                          },
                          eagle_sch: {
                            en: "EAGLE Schematic (.sch): XML-based EAGLE format compatible with Autodesk EAGLE, Fusion 360, and Altium Designer.",
                            ar: "مخطط EAGLE (.sch): صيغة XML الخاصة ببرنامج EAGLE والمتوافقة مع Fusion 360 وAltium."
                          },
                          spice: {
                            en: "SPICE Netlist (.cir): Standard SPICE circuit netlist format compatible with LTspice, NGspice, PSpice, and Multisim.",
                            ar: "صافي شبكة SPICE (.cir): قائمة شبكة الدارة الكهربائية المتوافقة مع برامج المحاكاة LTspice وNGspice وPSpice."
                          },
                        },
                        pcb: {
                          gerber: {
                            en: "Gerber RS-274X Package (ZIP): Traditional extended Gerber vector files supported by 100% of PCB factories (JLCPCB, PCBWay, etc.).",
                            ar: "حزمة Gerber RS-274X (ZIP): الصيغة القياسية التقليدية الممتدة والمتوافقة مع كافة مصانع اللوحات المطبوعة عالمياً."
                          },
                          gerber_x2: {
                            en: "Gerber X2 Package (ZIP): Modern Gerber standard with file attributes (%TF.FileFunction) for automatic layer assignment in CAM tools.",
                            ar: "حزمة Gerber X2 المتقدمة (ZIP): معيار جيربر الحديث المزود بوسوم الخصائص (%TF.FileFunction) للتعرف الآلي الفائق على الطبقات."
                          },
                          ncdrill: {
                            en: "NC Drill: Numeric Drill instructions containing hole locations and diameter specifications for CNC drilling machines.",
                            ar: "ملف NC Drill: تعليمات الثقب الرقمية التي تحتوي على مواقع الثقوب وأقطارها لآلات الحفر CNC."
                          },
                          bom: {
                            en: "BOM (XLSX): Bill of Materials list. A detailed spreadsheet listing all components, references, values, and packages.",
                            ar: "قائمة المواد BOM (XLSX): جدول بيانات مفصل يسرد جميع المكونات والمراجع والقيم والعبوات المطلوبة للتجميع."
                          },
                          pdf: {
                            en: diyPcbPdfType === "toner_transfer"
                              ? "1:1 Printable PDF Layout: High-density black-and-white mask with exact physical dimensions, designed for DIY PCB toner-transfer (ironing) and etching, complete with scale calibration rulers."
                              : "PCB PDF Canvas: Beautiful high-resolution full-color render of the physical board (solder mask, copper traces, gold pads) embedded in a PDF document.",
                            ar: diyPcbPdfType === "toner_transfer"
                              ? "مخطط طباعة 1:1 (PDF): قناع عالي الكثافة (أسود وأبيض) بالأبعاد الحقيقية الدقيقة للوحة، مصمم خصيصاً للتحميض الكيميائي والطباعة اليدوية بالمكواة (Toner-Transfer)، مع مساطر لمعايرة القياس الفعلي."
                              : "مستند PDF ملون للوحة: عرض مذهل كامل الألوان للمظهر الحقيقي للوحة المطبوعة (قناع اللحام، النحاس، الوسادات الذهبية) داخل ملف PDF للتوثيق والتحقق البصري."
                          },
                          jpeg: {
                            en: "PCB JPEG Image: High-resolution raster file with balanced file size, representing the beautiful color canvas with dark workbench space background.",
                            ar: "صورة لوحة JPEG: ملف صورة نقطية عالي الدقة بحجم متوازن يمثل العرض الملون الكامل للوحة المطبوعة مع خلفية بيئة العمل الداكنة الفخمة."
                          },
                          png: {
                            en: "PCB PNG Image: Crisp top/bottom layer preview raster graphic, ideal for documentation and visually verifying layouts.",
                            ar: "صورة لوحة PNG: رسم معاينة عالي الدقة للطبقات العلوية أو السفلية، مثالي للتوثيق والتحقق البصري."
                          },
                          svg: {
                            en: "PCB SVG Layout: Vector representation of copper tracks, pads, and silkscreens for vector-editing tools.",
                            ar: "مخطط لوحة SVG: تمثيل متجهات لمسارات النحاس والوسادات والطبقة الحريرية لأدوات التصميم المتجه."
                          },
                        },
                        realistic: {
                          pdf: {
                            en: "Realistic PDF: Beautiful high-fidelity, high-contrast wood workbench rendering saved as a vector-wrapped vector document.",
                            ar: "PDF واقعي: عرض مذهل وعالي الدقة لمظهر طاولة العمل الخشبية والعناصر، محفوظ كمستند متجه."
                          },
                          jpeg: {
                            en: "Realistic JPEG: Photo-realistic rendering of your circuit on a workbench background, optimized for fast web sharing.",
                            ar: "JPEG واقعي: محاكاة واقعية للغاية للدارتك الإلكترونية على خلفية خشبية، مناسب للمشاركة السريعة."
                          },
                          png: {
                            en: "Realistic PNG: High-fidelity, ultra-clear photo rendering with full lossless detail. Perfect for portfolios.",
                            ar: "PNG واقعي: محاكاة فائقة الدقة والوضوح بألوان كاملة وتفاصيل غير مفقودة، ممتازة لمعارض الأعمال."
                          },
                        }
                      };

                      const targetGuide = guide[exportTarget as keyof typeof guide] || guide.schematic;
                      const explain = targetGuide[exportFormat as keyof typeof targetGuide] || { en: "Select a format to see detailed integration guidelines.", ar: "اختر صيغة لعرض الإرشادات التفصيلية الخاصة بها." };
                      return lang === "ar" ? explain.ar : explain.en;
                    })()}
                  </p>
                </div>

              </div>

            </div>
          </div>

          {/* Footer Bar */}
          <div className="border-t border-slate-800 bg-slate-900/60 px-4 md:px-6 py-3 shrink-0">
            <div className="max-w-5xl mx-auto w-full flex items-center justify-center relative">
              <div className="hidden md:flex items-center gap-2 text-xs text-slate-400 absolute right-0 rtl:right-auto rtl:left-0">
                <ShieldCheck className="size-4 text-emerald-500" />
                <span>{lang === "ar" ? "تم التحقق من سلامة المخططات وبناء الحزمة" : "Schematics validated & ready for manufacturing"}</span>
              </div>
              <Button 
                onClick={triggerExport} 
                className="bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-500/25 px-8 py-2.5 h-auto text-xs sm:text-sm font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center"
              >
                <Download className="size-4 text-white" />
                <span>{lang === "ar" ? "تصدير الآن" : "Export Now"}</span>
              </Button>
            </div>
          </div>

          </>
          )}

          {/* Tab 2: Import */}
          {activeModalTab === "import" && (
            <div className="flex-1 overflow-y-auto px-2.5 sm:px-6 md:px-8 py-3 sm:py-6 bg-slate-950/20 flex flex-col justify-center">
              <div className="max-w-4xl mx-auto w-full space-y-3.5 sm:space-y-6">
                <div className="text-center space-y-1">
                  <h3 className="text-base sm:text-lg md:text-xl font-bold text-white flex items-center justify-center gap-2">
                    <Upload className="h-5 w-5 sm:h-6 sm:w-6 text-blue-400" />
                    {lang === "ar" ? "اختر وحدة الاستيراد المطلوبة" : "Select Import Module"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {lang === "ar" 
                      ? "يمكنك استيراد كافة صيغ المشاريع والملفات المعيارية إلى بيئة العمل مباشرة"
                      : "Import all project formats and standard files directly into your workspace"}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
                  {/* 1. Zuit Import Module (FIRST MODULE) */}
                  <div 
                    onClick={() => executeModalImport("zuit")}
                    className="group border-2 border-blue-500/50 hover:border-blue-400 rounded-xl p-2.5 sm:p-3.5 cursor-pointer bg-blue-950/20 hover:bg-blue-950/40 transition-all flex flex-col justify-between space-y-2 sm:space-y-2.5 shadow-md hover:shadow-blue-500/10 relative overflow-hidden"
                  >
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg overflow-hidden bg-slate-900 border border-blue-500/40 flex items-center justify-center p-1 shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                        <Logo className="w-full h-full object-contain" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                          {lang === "ar" ? "استيراد ملفات Zuit" : "Import Zuit Files"}
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                          {lang === "ar"
                            ? "استيراد ملفات Zuit الخاصة بهذا المشروع والحافظة لكافة الوحدات الأربعة وسجل التراجع."
                            : "Import Zuit project files combining all 4 modules and full undo history."}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-blue-500/20">
                      <span className="text-[10px] font-mono font-semibold text-blue-400 block mb-0.5">
                        {lang === "ar" ? "الصيغة الموحدة:" : "Unified Format:"}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] font-mono bg-blue-500/20 text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-500/30">.zuit</span>
                      </div>
                    </div>
                  </div>

                  {/* 2. Schematic Unit Option */}
                  <div 
                    onClick={() => executeModalImport("schematic")}
                    className="group border border-slate-800 hover:border-blue-500/50 rounded-xl p-2.5 sm:p-3.5 cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all flex flex-col justify-between space-y-2 sm:space-y-2.5 shadow-sm hover:shadow-md"
                  >
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-blue-500/20">
                        <Cpu className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                          {lang === "ar" ? "استيراد مخطط schematic" : "Import Schematic"}
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                          {lang === "ar" 
                            ? "استيراد رسم المخطط الإلكتروني وتحديث المكونات والتوصيلات." 
                            : "Import electronic schematic layout to update components & wiring."}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-800/80">
                      <span className="text-[10px] font-mono font-semibold text-blue-400 block mb-0.5">
                        {lang === "ar" ? "الصيغ المدعومة:" : "Supported Formats:"}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">.kicad_sch</span>
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">.json (EasyEDA)</span>
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">.sch (Eagle)</span>
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">.cir / .net (SPICE)</span>
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">.xml / .zuit</span>
                      </div>
                    </div>
                  </div>

                  {/* 3. PCB Unit Option */}
                  <div 
                    onClick={() => executeModalImport("pcb")}
                    className="group border border-slate-800 hover:border-blue-500/50 rounded-xl p-2.5 sm:p-3.5 cursor-pointer bg-slate-900/40 hover:bg-slate-900/80 transition-all flex flex-col justify-between space-y-2 sm:space-y-2.5 shadow-sm hover:shadow-md"
                  >
                    <div className="space-y-1.5 sm:space-y-2">
                      <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-blue-500/20">
                        <Layers className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-white group-hover:text-blue-400 transition-colors">
                          {lang === "ar" ? "استيراد لوحة مطبوعة PCB" : "Import PCB Board"}
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                          {lang === "ar" 
                            ? "استيراد ملفات KiCad PCB أو حزم Gerber المعيارية لتحديث طبقات ورسومات اللوحة." 
                            : "Import KiCad PCB (.kicad_pcb) or Gerber package to update PCB layers."}
                        </p>
                      </div>
                    </div>

                    <div className="pt-1.5 border-t border-slate-800/80">
                      <span className="text-[10px] font-mono font-semibold text-blue-400 block mb-0.5">
                        {lang === "ar" ? "الصيغ المدعومة:" : "Supported Formats:"}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">KiCad PCB (.kicad_pcb)</span>
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">Gerber RS-274X & X2 (.zip, .gbr)</span>
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">Drill (.drl, .txt)</span>
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">ODB++</span>
                        <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20">IPC-2581</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </div>
  );
}
