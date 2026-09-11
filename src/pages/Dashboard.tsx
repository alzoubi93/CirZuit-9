import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useTheme } from "@/theme";
import { Project, getAllProjects, createProject, deleteProject, duplicateProject, updateProject } from "@/lib/db";
import { SchematicDoc } from "@/lib/schematic";
import { readZuit } from "@/lib/projectFile";
import { detectAndParseSchematic } from "@/lib/importSchematicFormats";
import { importGerberToProject } from "@/lib/importGerber";
import { isOdbZip, isIpc2581Content, parseIpc2581, parseOdbZipToProject } from "@/lib/importModernPcb";
import { parseKiCadPcb, isKiCadPcbContent } from "@/lib/importKiCadPcb";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus,
  FolderOpen,
  Trash2,
  Copy,
  Edit3,
  Globe,
  Sun,
  Moon,
  Laptop,
  Cpu,
  Zap,
  Download,
  Upload,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { motion } from "motion/react";
import Logo from "@/components/Logo";

export default function Dashboard() {
  const { t, lang, setLang, dir } = useI18n();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  // Edit / Delete states
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importType, setImportType] = useState<"schematic" | "pcb" | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const list = await getAllProjects();
      setProjects(list.sort((a, b) => b.updatedAt - a.updatedAt));
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreate = async () => {
    if (!newProjectName.trim()) return;
    try {
      const proj = await createProject(newProjectName.trim());
      const id = proj.id;
      setNewProjectOpen(false);
      setNewProjectName("");
      toast.success(lang === "ar" ? "تم إنشاء المشروع" : "Project created");
      navigate(`/editor/${id}`);
    } catch (e) {
      toast.error(lang === "ar" ? "فشل إنشاء المشروع" : "Failed to create project");
    }
  };

  const handleRename = async () => {
    if (!editingProject || !editName.trim()) return;
    try {
      await updateProject(editingProject.id, { name: editName.trim() });
      setEditingProject(null);
      loadProjects();
      toast.success(lang === "ar" ? "تم تعديل الاسم بنجاح" : "Renamed successfully");
    } catch (e) {
      toast.error(lang === "ar" ? "فشل تعديل الاسم" : "Failed to rename");
    }
  };

  const handleDuplicate = async (proj: Project) => {
    try {
      await duplicateProject(proj.id);
      loadProjects();
      toast.success(lang === "ar" ? "تم تكرار المشروع" : "Project duplicated");
    } catch (e) {
      toast.error(lang === "ar" ? "فشل تكرار المشروع" : "Failed to duplicate");
    }
  };

  const handleDelete = async () => {
    if (!deletingProject) return;
    try {
      await deleteProject(deletingProject.id);
      setDeletingProject(null);
      loadProjects();
      toast.success(lang === "ar" ? "تم حذف المشروع" : "Project deleted");
    } catch (e) {
      toast.error(lang === "ar" ? "فشل حذف المشروع" : "Failed to delete");
    }
  };

  const executeImport = (type: "zuit" | "schematic" | "pcb") => {
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

      // Detect and handle ODB++ zip files
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
            const { doc, name } = parseKiCadPcb(text, mainFile.name, lang);
            const proj = await createProject(name, doc);
            loadProjects();
            toast.success(lang === "ar" ? "تم استيراد لوحة KiCad PCB بنجاح!" : "KiCad PCB board imported successfully!");
            navigate(`/editor/${proj.id}`);
          } catch (err) {
            console.error(err);
            toast.error(lang === "ar" ? "فشل استيراد ملف KiCad PCB" : "Failed to import KiCad PCB file");
          }
          return;
        }
      }

      if (fileList.length === 1 && mainFileName.endsWith(".zip")) {
        const isOdb = await isOdbZip(mainFile);
        if (isOdb) {
          try {
            const { doc, name } = await parseOdbZipToProject(mainFile, lang);
            const proj = await createProject(name, doc);
            loadProjects();
            toast.success(lang === "ar" ? "تم استيراد ملف ODB++ بنجاح!" : "ODB++ file imported successfully!");
            navigate(`/editor/${proj.id}`);
          } catch (err) {
            console.error(err);
            toast.error(lang === "ar" ? "فشل استيراد ملف ODB++" : "Failed to import ODB++ file");
          }
          return;
        }
      }

      // Detect and handle IPC-2581 XML files
      if (fileList.length === 1 && mainFileName.endsWith(".xml")) {
        const text = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target?.result as string);
          reader.readAsText(mainFile);
        });

        if (isIpc2581Content(text)) {
          try {
            const { doc, name } = parseIpc2581(text, mainFile.name, lang);
            const proj = await createProject(name, doc);
            loadProjects();
            toast.success(lang === "ar" ? "تم استيراد ملف IPC-2581 بنجاح!" : "IPC-2581 file imported successfully!");
            navigate(`/editor/${proj.id}`);
          } catch (err) {
            console.error(err);
            toast.error(lang === "ar" ? "فشل استيراد ملف IPC-2581" : "Failed to import IPC-2581 file");
          }
          return;
        }
      }
      
      // If there are multiple files, or if any of them is a Gerber/drill file or zip, process as Gerber set
      const hasGerber = fileList.some(file => {
        const fn = file.name.toLowerCase();
        return (
          fn.endsWith(".zip") ||
          fn.endsWith(".gbr") ||
          fn.endsWith(".ger") ||
          fn.endsWith(".gtl") ||
          fn.endsWith(".gbl") ||
          fn.endsWith(".gko") ||
          fn.endsWith(".gts") ||
          fn.endsWith(".gbs") ||
          fn.endsWith(".gto") ||
          fn.endsWith(".gbo") ||
          fn.endsWith(".gml") ||
          fn.endsWith(".profile") ||
          fn.endsWith(".gm1") ||
          fn.endsWith(".gm20") ||
          fn.endsWith(".drl") ||
          fn.endsWith(".txt") ||
          fn.endsWith(".xln") ||
          fn.endsWith(".cmp") ||
          fn.endsWith(".sol") ||
          fn.endsWith(".plc") ||
          fn.endsWith(".pls") ||
          fn.endsWith(".stc") ||
          fn.endsWith(".sts")
        );
      });

      if (hasGerber || fileList.length > 1) {
        try {
          const { doc, name } = await importGerberToProject(fileList, lang);
          const proj = await createProject(name, doc);
          const id = proj.id;
          loadProjects();
          toast.success(lang === "ar" ? "تم استيراد ملفات Gerber بنجاح!" : "Gerber files imported successfully!");
          navigate(`/editor/${id}`);
        } catch (err) {
          console.error(err);
          toast.error(lang === "ar" ? "فشل استيراد ملفات Gerber" : "Failed to import Gerber files");
        }
        return;
      }

      const file = fileList[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const zuitRes = readZuit(content);

          let doc: SchematicDoc;
          let projectName = file.name.replace(/\.(zuit|json|xml|kicad_sch|sch|cir|net|spice|sp|txt)$/i, "");
          let undoStack: SchematicDoc[] = [];
          let redoStack: SchematicDoc[] = [];
          let simulationState: any = null;
          let realisticState: any = null;

          const detected = detectAndParseSchematic(content, file.name, lang);

          if (isKiCadPcbContent(content)) {
            const kicadRes = parseKiCadPcb(content, file.name, lang);
            doc = kicadRes.doc;
            if (kicadRes.name) projectName = kicadRes.name;
          } else if (detected && detected.doc) {
            doc = detected.doc;
            if (detected.name) projectName = detected.name;
          } else if (zuitRes) {
            doc = zuitRes.doc;
            if (zuitRes.name) projectName = zuitRes.name;
            undoStack = zuitRes.undoStack || [];
            redoStack = zuitRes.redoStack || [];
            simulationState = zuitRes.simulation || null;
            realisticState = zuitRes.realistic || null;
          } else {
            const trimmedContent = content.trim();
            if (!trimmedContent.startsWith("{") && !trimmedContent.startsWith("[")) throw new Error("Not a JSON file");
            const parsed = JSON.parse(content);
            if (parsed.doc) {
              doc = parsed.doc;
            } else if (parsed.schematic) {
              doc = {
                nodes: parsed.schematic.nodes || parsed.schematic.components || [],
                wires: parsed.schematic.wires || [],
                canvasColor: parsed.schematic.canvasColor || "white",
                defaultWireColor: parsed.schematic.defaultWireColor || "black",
                pcb: parsed.pcb || undefined,
              };
            } else {
              doc = {
                nodes: parsed.nodes || parsed.components || [],
                wires: parsed.wires || [],
                canvasColor: parsed.canvasColor || "white",
                defaultWireColor: parsed.defaultWireColor || "black",
                pcb: parsed.pcb || undefined,
              };
            }
            if (parsed.name) projectName = parsed.name;
          }

          // Ensure basic arrays are present so it doesn't crash
          if (!doc.nodes) doc.nodes = [];
          if (!doc.wires) doc.wires = [];
          if (!doc.canvasColor) doc.canvasColor = "white";
          if (!doc.defaultWireColor) doc.defaultWireColor = "black";

          const proj = await createProject(projectName, doc);
          const id = proj.id;

          loadProjects();
          toast.success(
            lang === "ar"
              ? "تم استيراد مشروع Zuit الشامل بنجاح مع سجلات التراجع وكافة الوحدات!"
              : "Zuit full project imported successfully with undo history and all modules!"
          );
          navigate(`/editor/${id}`, {
            state: {
              undoStack,
              redoStack,
              simulation: simulationState,
              realistic: realisticState,
            },
          });
        } catch (err) {
          toast.error(t("importFailed"));
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  return (
    <div className="min-h-screen bg-background flex flex-col transition-colors duration-200">
      {/* Header / Brand */}
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10 px-4 py-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-slate-950 border border-blue-500/30 flex items-center justify-center p-0.5 shadow-inner shadow-blue-500/10">
              <Logo className="h-full w-full rounded-lg" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                {t("appName")}
                <span className="text-xs font-mono font-normal bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  v1.2.0
                </span>
              </h1>
              <p className="text-xs text-muted-foreground">{t("appTagline")}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Lang switch */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setLang(lang === "en" ? "ar" : "en")}
              title={t("language")}
            >
              <Globe className="h-4 w-4" />
            </Button>

            {/* Theme switch */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={t("theme")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
        
        {/* Projects List */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <FolderOpen className="h-5 w-5 text-blue-400" />
              <span className="font-bold">{t("projects")}</span>
              {projects.length > 0 && (
                <span className="bg-blue-500/15 text-blue-400 border border-blue-500/30 text-xs px-2 py-0.5 rounded-full font-mono font-bold">
                  {projects.length}
                </span>
              )}
            </h3>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button 
                size="sm" 
                variant="secondary" 
                onClick={() => setImportDialogOpen(true)}
                className="h-8 sm:h-9 px-2 sm:px-4 text-xs sm:text-sm font-semibold"
              >
                <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-blue-400" />
                {t("importFile")}
              </Button>
              <Button 
                size="sm" 
                onClick={() => setNewProjectOpen(true)}
                className="h-8 sm:h-9 px-2 sm:px-4 text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 active:scale-[0.99] transition-all"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2 text-blue-200" />
                {t("newProject")}
              </Button>
            </div>
          </div>

          {projects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="border-2 border-dashed rounded-2xl p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-4 bg-muted/20"
            >
              <Cpu className="h-12 w-12 text-muted-foreground/40 stroke-[1.5]" />
              <div className="space-y-1">
                <p className="font-semibold text-base text-foreground">{t("noProjects")}</p>
                {lang !== "ar" && (
                  <p className="text-sm">Click "New Project" to launch the circuit workspace.</p>
                )}
              </div>
              <Button onClick={() => setNewProjectOpen(true)} className="mt-2 font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 active:scale-[0.99] transition-all">
                <Plus className="h-4 w-4 mr-2 text-blue-200" />
                {t("newProject")}
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map((proj, idx) => (
                <motion.div
                  key={proj.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  whileHover={{ y: -2 }}
                  className="group"
                >
                  <Card className="h-full flex flex-col justify-between hover:shadow-md transition-all cursor-pointer relative overflow-hidden border bg-card hover:border-primary/40">
                    <div className="p-5 flex-1" onClick={() => navigate(`/editor/${proj.id}`)}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <CardTitle className="text-base font-bold line-clamp-1 group-hover:text-sky-400 transition-colors">
                            {proj.name}
                          </CardTitle>
                          <span className="text-xs font-mono text-muted-foreground">
                            {new Date(proj.updatedAt).toLocaleDateString(lang === "ar" ? "ar-u-nu-latn" : "en-US", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <div className="h-8 w-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center shrink-0 border border-sky-500/20">
                          <Cpu className="h-4.5 w-4.5 text-sky-400" />
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-1.5">
                        <span className="text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold">
                          {(proj.doc?.nodes || []).length} {lang === "ar" ? "عناصر (components)" : "components"}
                        </span>
                        <span className="text-[10px] font-mono bg-blue-500/15 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded font-bold">
                          {(proj.doc?.wires || []).length} {lang === "ar" ? "أسلاك (wires)" : "wires"}
                        </span>
                        {proj.doc?.pcb?.footprints && proj.doc.pcb.footprints.length > 0 && (
                          <span className="text-[10px] font-mono bg-green-500/10 text-green-500 border border-green-500/20 px-2 py-0.5 rounded font-bold">
                            PCB
                          </span>
                        )}
                      </div>
                    </div>

                    <CardFooter className="border-t bg-muted/20 px-5 py-3 flex items-center justify-end gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title={t("rename")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject(proj);
                          setEditName(proj.name);
                        }}
                      >
                        <Edit3 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-foreground"
                        title={t("duplicate")}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(proj);
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:text-red-500 hover:bg-red-500/10"
                        title={t("delete")}
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingProject(proj);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-red-400" />
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* New Project Dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("newProject")}</DialogTitle>
            <DialogDescription>
              {t("newProjDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="projName">{t("projectName")}</Label>
              <Input
                id="projName"
                placeholder={t("untitled")}
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)} className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold">
              {t("cancel")}
            </Button>
            <Button onClick={handleCreate} disabled={!newProjectName.trim()} className="font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 active:scale-[0.99] transition-all">
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={editingProject !== null} onOpenChange={(o) => !o && setEditingProject(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("rename")}</DialogTitle>
            <DialogDescription>
              {lang === "ar" ? "أدخل اسماً جديداً للمشروع." : "Enter a new name for your project sheet."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="renameField">{t("projectName")}</Label>
              <Input
                id="renameField"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProject(null)} className="border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300 font-bold">
              {t("cancel")}
            </Button>
            <Button onClick={handleRename} disabled={!editName.trim()}>
              {t("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Alert Dialog */}
      <AlertDialog open={deletingProject !== null} onOpenChange={(o) => !o && setDeletingProject(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {lang === "ar"
                ? `هل أنت متأكد من حذف "${deletingProject?.name}"؟ لا يمكن التراجع عن هذا الإجراء.`
                : `Are you sure you want to delete "${deletingProject?.name}"? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingProject(null)}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* Import Selection Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent 
          className="max-w-3xl"
          closeButtonClassName="right-auto left-4 rtl:left-auto rtl:right-4"
        >
          <DialogHeader className="relative rtl:pr-12 ltr:pl-12">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Upload className="h-5 w-5 text-blue-400" />
              {lang === "ar" ? "استيراد مشروع جديد" : "Import New Project"}
            </DialogTitle>
            <DialogDescription className="hidden">
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-4 py-2 sm:py-4">
            {/* 1. Zuit Import Module (FIRST MODULE) */}
            <div 
              onClick={() => {
                setImportDialogOpen(false);
                executeImport("zuit");
              }}
              className="group border border-border hover:border-blue-400/60 rounded-xl p-2.5 sm:p-4 cursor-pointer bg-card hover:bg-muted/40 transition-all flex flex-col justify-between space-y-2 sm:space-y-3 shadow-sm hover:shadow-md relative overflow-hidden"
            >
              <div className="space-y-1.5 sm:space-y-2">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-500/10 border border-transparent flex items-center justify-center p-1 shrink-0 group-hover:scale-105 transition-transform shadow-inner">
                  <Logo className="w-full h-full object-contain" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                    {lang === "ar" ? "استيراد ملفات Zuit" : "Import Zuit Files"}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 sm:mt-1">
                    {lang === "ar"
                      ? "استيراد ملفات Zuit الخاصة بهذا المشروع والحافظة لكافة الوحدات الأربعة وسجل التراجع."
                      : "Import Zuit project files combining all 4 modules and full undo history."}
                  </p>
                </div>
              </div>

              <div className="pt-1.5 sm:pt-2 border-t border-border/50">
                <span className="text-[10px] font-mono font-semibold text-blue-400 block mb-0.5 sm:mb-1">
                  {lang === "ar" ? "الصيغة الموحدة:" : "Unified Format:"}
                </span>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 font-bold px-2 py-0.5 rounded border border-blue-500/30">.zuit</span>
                </div>
              </div>
            </div>

            {/* 2. Schematic Unit Option */}
            <div 
              onClick={() => {
                setImportDialogOpen(false);
                executeImport("schematic");
              }}
              className="group border border-border hover:border-blue-400/60 rounded-xl p-2.5 sm:p-4 cursor-pointer bg-card hover:bg-muted/40 transition-all flex flex-col justify-between space-y-2 sm:space-y-3 shadow-sm hover:shadow-md"
            >
              <div className="space-y-1.5 sm:space-y-2">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Cpu className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-blue-400 transition-colors">
                    {lang === "ar" ? "وحدة المخطط (Schematic)" : "Schematic Unit"}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 sm:mt-1">
                    {lang === "ar"
                      ? "استيراد المخططات والدوائر المكونة من رموز إلكترونية ووصلات أسلاك."
                      : "Import schematic circuits containing electronic symbols and wire nets."}
                  </p>
                </div>
              </div>

              <div className="pt-1.5 sm:pt-2 border-t border-border/50">
                <span className="text-[10px] font-mono font-semibold text-blue-400 block mb-0.5 sm:mb-1">
                  {lang === "ar" ? "الصيغ المدعومة:" : "Supported Formats:"}
                </span>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">.json</span>
                  <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">.xml</span>
                </div>
              </div>
            </div>

            {/* 3. PCB Unit Option */}
            <div 
              onClick={() => {
                setImportDialogOpen(false);
                executeImport("pcb");
              }}
              className="group border border-border hover:border-blue-400/60 rounded-xl p-2.5 sm:p-4 cursor-pointer bg-card hover:bg-muted/40 transition-all flex flex-col justify-between space-y-2 sm:space-y-3 shadow-sm hover:shadow-md"
            >
              <div className="space-y-1.5 sm:space-y-2">
                <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <Layers className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground group-hover:text-blue-400 transition-colors">
                    {lang === "ar" ? "وحدة اللوحة (PCB)" : "PCB Unit"}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-0.5 sm:mt-1">
                    {lang === "ar"
                      ? "استيراد ملفات KiCad PCB أو Gerber معاً أو ODB++ أو IPC-2581."
                      : "Import KiCad PCB (.kicad_pcb), Gerber package, ODB++, or IPC-2581."}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-border/50">
                <span className="text-[10px] font-mono font-semibold text-blue-400 block mb-1">
                  {lang === "ar" ? "الصيغ المدعومة:" : "Supported Formats:"}
                </span>
                <div className="flex flex-wrap gap-1">
                  <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold">KiCad PCB (.kicad_pcb)</span>
                  <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded font-bold">Gerber RS-274X & X2 (.zip, .gbr)</span>
                  <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">Drill (.drl, .txt)</span>
                  <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">ODB++</span>
                  <span className="text-[10px] font-mono bg-blue-500/10 text-blue-400 px-1.5 py-0.5 rounded">IPC-2581</span>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
