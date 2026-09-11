// CirZuit full project format (.zuit) — Single file containing Schematic, PCB, Simulation, Realistic View & Undo/Redo history.
import { SchematicDoc, emptyDoc } from "./schematic";
import { PcbDoc, emptyPcbDoc } from "./pcb";
import { isXmlString, readXmlProject } from "./xmlProject";
import { detectAndParseSchematic } from "./importSchematicFormats";

export const ZUIT_MAGIC = "ZUIT";
export const ZUIT_FORMAT_VERSION = 1;

export interface ZuitFile {
  magic: typeof ZUIT_MAGIC;
  version: number;
  app: "CirZuit";
  name: string;
  description?: string;
  createdAt: number | string;
  updatedAt: number | string;
  exportedAt: string;

  // 1. Schematic module
  schematic: SchematicDoc;

  // 2. PCB module
  pcb: PcbDoc;

  // 3. Simulation module data
  simulation?: {
    faults?: any[];
    bookmarks?: any[];
    userModels?: any[];
    settings?: any;
    customParams?: Record<string, any>;
  };

  // 4. Realistic 3D View settings
  realistic?: {
    viewMode?: string;
    showComponents?: boolean;
    boardColor?: string;
    copperColor?: string;
    silkscreenColor?: string;
  };

  // History Undo & Redo stacks
  undoStack?: SchematicDoc[];
  redoStack?: SchematicDoc[];
}

export function buildZuit(
  doc: SchematicDoc,
  name: string,
  options?: {
    description?: string;
    createdAt?: number | string;
    undoStack?: SchematicDoc[];
    redoStack?: SchematicDoc[];
    simulation?: any;
    realistic?: any;
  }
): ZuitFile {
  const pcb = doc.pcb || emptyPcbDoc();
  
  // Clean copy of schematic doc
  const schematicClean: SchematicDoc = {
    nodes: doc.nodes || [],
    wires: doc.wires || [],
    canvasColor: doc.canvasColor || "white",
    defaultWireColor: doc.defaultWireColor || "black",
    defaultElementColor: doc.defaultElementColor || "black",
    defaultWireWidth: doc.defaultWireWidth ?? 0.1,
    defaultNodeSize: doc.defaultNodeSize ?? 1.0,
  };

  return {
    magic: ZUIT_MAGIC,
    version: ZUIT_FORMAT_VERSION,
    app: "CirZuit",
    name,
    description: options?.description || "",
    createdAt: options?.createdAt || Date.now(),
    updatedAt: Date.now(),
    exportedAt: new Date().toISOString(),
    schematic: schematicClean,
    pcb,
    simulation: options?.simulation || {
      faults: doc.faults || [],
      bookmarks: doc.bookmarks || [],
      userModels: doc.userModels || [],
    },
    realistic: options?.realistic || {
      viewMode: "3d_workbench",
      showComponents: true,
      boardColor: "#064e3b",
      copperColor: "#d97706",
      silkscreenColor: "#ffffff",
    },
    undoStack: options?.undoStack || [],
    redoStack: options?.redoStack || [],
  };
}

export function downloadZuit(
  doc: SchematicDoc,
  name: string,
  options?: {
    description?: string;
    createdAt?: number | string;
    undoStack?: SchematicDoc[];
    redoStack?: SchematicDoc[];
    simulation?: any;
    realistic?: any;
  }
) {
  const fileData = buildZuit(doc, name, options);
  const blob = new Blob([JSON.stringify(fileData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = name.trim().replace(/\s+/g, "_") || "project";
  a.download = `${safeName}.zuit`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export interface ParsedZuitResult {
  doc: SchematicDoc;
  name?: string;
  description?: string;
  undoStack: SchematicDoc[];
  redoStack: SchematicDoc[];
  simulation?: any;
  realistic?: any;
}

export function readZuit(text: string): ParsedZuitResult | null {
  try {
    if (!text || typeof text !== "string") return null;

    if (isXmlString(text)) {
      const xmlRes = readXmlProject(text);
      if (xmlRes) return xmlRes;
    }

    try {
      const j = JSON.parse(text);
      if (j && typeof j === "object") {
        if (j.magic === ZUIT_MAGIC || j.app === "CirZuit" || j.schematic || j.doc || (j.nodes && j.wires)) {
          let doc: SchematicDoc;

          if (j.schematic) {
            doc = { ...j.schematic };
          } else if (j.doc) {
            doc = { ...j.doc };
          } else if (j.nodes && j.wires) {
            doc = { ...emptyDoc(), ...j };
          } else {
            doc = emptyDoc();
          }

          // Attach PCB module
          if (j.pcb) {
            doc.pcb = j.pcb;
          }

          // Attach simulation items if present
          if (j.simulation) {
            if (j.simulation.faults && Array.isArray(j.simulation.faults)) doc.faults = j.simulation.faults;
            if (j.simulation.bookmarks && Array.isArray(j.simulation.bookmarks)) doc.bookmarks = j.simulation.bookmarks;
            if (j.simulation.userModels && Array.isArray(j.simulation.userModels)) doc.userModels = j.simulation.userModels;
          }

          const undoStack: SchematicDoc[] = Array.isArray(j.undoStack) ? j.undoStack : [];
          const redoStack: SchematicDoc[] = Array.isArray(j.redoStack) ? j.redoStack : [];

          return {
            doc,
            name: j.name,
            description: j.description,
            undoStack,
            redoStack,
            simulation: j.simulation,
            realistic: j.realistic,
          };
        }
      }
    } catch {
      // JSON parse failed, try non-JSON formats (KiCad, Eagle SCH, SPICE Netlist, EasyEDA)
    }

    // Try KiCad, EasyEDA, Eagle SCH, SPICE Netlist
    const detected = detectAndParseSchematic(text, "imported_file");
    if (detected && detected.doc) {
      return {
        doc: detected.doc,
        name: detected.name,
        undoStack: [],
        redoStack: [],
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Legacy .lvsch support alias
const MAGIC = "LVSCH";
const FORMAT_VERSION = 1;

interface LvschFile {
  magic: typeof MAGIC;
  format: number;
  app: "CirZuit";
  name: string;
  exportedAt: string;
  doc: SchematicDoc;
}

export function buildLvsch(doc: SchematicDoc, name: string): LvschFile {
  return {
    magic: MAGIC,
    format: FORMAT_VERSION,
    app: "CirZuit",
    name,
    exportedAt: new Date().toISOString(),
    doc,
  };
}

export function downloadLvsch(doc: SchematicDoc, name: string) {
  downloadZuit(doc, name);
}

export function readLvsch(text: string): { doc: SchematicDoc; name?: string } | null {
  const zuitRes = readZuit(text);
  if (zuitRes) return { doc: zuitRes.doc, name: zuitRes.name };
  try {
    const j = JSON.parse(text);
    if (j?.magic === MAGIC && j?.doc) return { doc: j.doc as SchematicDoc, name: j.name };
    if (j?.app === "CirZuit" && j?.doc) return { doc: j.doc as SchematicDoc, name: j.name };
    if (j?.nodes && j?.wires) return { doc: { ...emptyDoc(), ...j } as SchematicDoc };
    return null;
  } catch {
    return null;
  }
}

