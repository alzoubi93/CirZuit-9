import { openDB, DBSchema, IDBPDatabase } from "idb";
import type { SchematicDoc } from "./schematic";
import { emptyPcbDoc } from "./pcb";

interface SSD extends DBSchema {
  projects: {
    key: string;
    value: {
      id: string;
      name: string;
      createdAt: number;
      updatedAt: number;
      doc: SchematicDoc;
    };
    indexes: { "by-updated": number };
  };
}

let _db: Promise<IDBPDatabase<SSD>> | null = null;
function db() {
  if (!_db) {
    _db = openDB<SSD>("ssd", 1, {
      upgrade(d) {
        const s = d.createObjectStore("projects", { keyPath: "id" });
        s.createIndex("by-updated", "updatedAt");
      },
    });
  }
  return _db;
}

export type ProjectRecord = {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  doc: SchematicDoc;
};

export async function listProjects(): Promise<ProjectRecord[]> {
  const d = await db();
  const all = await d.getAll("projects");
  const migrated = all.map(p => migrateLegacyProject(p));
  return migrated.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string) {
  const p = await (await db()).get("projects", id);
  return p ? migrateLegacyProject(p) : undefined;
}

function normalizePcb(pcb: any) {
  const base = emptyPcbDoc();
  const legacyFootprints = Array.isArray(pcb?.components) ? pcb.components : undefined;
  const legacyTracks = Array.isArray(pcb?.wires) ? pcb.wires : (Array.isArray(pcb?.traces) ? pcb.traces : undefined);
  return {
    ...base,
    ...pcb,
    layers: pcb?.layers?.length ? pcb.layers : base.layers,
    tracks: Array.isArray(pcb?.tracks) ? pcb.tracks : (legacyTracks ?? []),
    vias: Array.isArray(pcb?.vias) ? pcb.vias : [],
    pads: Array.isArray(pcb?.pads) ? pcb.pads : [],
    measures: Array.isArray(pcb?.measures) ? pcb.measures : [],
    footprints: Array.isArray(pcb?.footprints) ? pcb.footprints : (legacyFootprints ?? []),
    nets: Array.isArray(pcb?.nets) ? pcb.nets : [],
    sync: pcb?.sync ?? base.sync,
    ratsnestVisible: pcb?.ratsnestVisible ?? true,
  };
}

function migrateLegacyProject(p: any): ProjectRecord {
  if (!p.doc) {
    const migratedPcb = p.pcb;
    p.doc = {
      nodes: p.components || p.nodes || [],
      wires: p.wires || [],
      canvasColor: p.canvasColor || "white",
      defaultWireColor: p.defaultWireColor || "black",
      pcb: migratedPcb ? normalizePcb(migratedPcb) : emptyPcbDoc(),
      netLabels: [],
    };
    delete p.components;
    delete p.wires;
    delete p.canvasColor;
    delete p.defaultWireColor;
    delete p.pcb;
  } else {
    // Ensure existing doc has required arrays
    if (!p.doc.nodes) p.doc.nodes = [];
    if (!p.doc.wires) p.doc.wires = [];
    if (!p.doc.netLabels) p.doc.netLabels = [];
    if (p.doc.pcb) p.doc.pcb = normalizePcb(p.doc.pcb);
    
    if (!p.doc.pcb) p.doc.pcb = emptyPcbDoc();
    if (p.doc.pcb && !p.doc.pcb.footprints) {
      // Edge case: doc exists but pcb was partially migrated
      p.doc.pcb = {
        footprints: p.doc.pcb.components || [],
        traces: p.doc.pcb.wires || p.doc.pcb.traces || [],
        boardOutline: p.doc.pcb.boardOutline || null,
      };
      delete p.doc.pcb.components;
      delete p.doc.pcb.wires;
    }
  }
  return p as ProjectRecord;
}

export async function saveProject(p: ProjectRecord) {
  const d = await db();
  await d.put("projects", { ...p, updatedAt: Date.now() });
}

export async function createProject(name: string, doc?: SchematicDoc): Promise<ProjectRecord> {
  const now = Date.now();
  const defaultDoc: SchematicDoc = {
    nodes: [],
    wires: [],
    canvasColor: "white",
    defaultWireColor: "black",
    defaultElementColor: "black",
    netLabels: [],
    pcb: emptyPcbDoc(),
  };
  const rec: ProjectRecord = {
    id: crypto.randomUUID(),
    name,
    createdAt: now,
    updatedAt: now,
    doc: doc || defaultDoc,
  };
  const d = await db();
  await d.put("projects", rec);
  return rec;
}

export async function deleteProject(id: string) {
  await (await db()).delete("projects", id);
}

export async function renameProject(id: string, name: string) {
  const d = await db();
  const p = await d.get("projects", id);
  if (!p) return;
  p.name = name;
  p.updatedAt = Date.now();
  await d.put("projects", p);
}

export async function duplicateProject(id: string): Promise<ProjectRecord | null> {
  const d = await db();
  const p = await d.get("projects", id);
  if (!p) return null;
  const copy: ProjectRecord = {
    ...p,
    id: crypto.randomUUID(),
    name: p.name + " (copy)",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    doc: JSON.parse(JSON.stringify(p.doc)),
  };
  await d.put("projects", copy);
  return copy;
}

// Aliases and Compatibility Exports for UI pages
export type Project = ProjectRecord;

export const getAllProjects = listProjects;

export async function updateProject(id: string, fields: Partial<ProjectRecord>) {
  const d = await db();
  const p = await d.get("projects", id);
  if (!p) return;
  const updated = {
    ...p,
    ...fields,
    updatedAt: Date.now(),
  };
  // Handle if fields specifies the top-level partial properties or pcb
  if (fields.doc) {
    updated.doc = {
      ...p.doc,
      ...fields.doc,
    };
  }
  await d.put("projects", updated);
}

