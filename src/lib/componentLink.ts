/**
 * Component link layer: the stable bridge between a schematic Symbol and a
 * physical Footprint. Geometry/rendering stay in their own environments.
 */
import type { SchematicNode } from "./schematic";
import type { PcbFootprint } from "./pcb";
import { SYMBOLS } from "./symbols";
import { getImportedKiCadParsedSymbol, resolveKicadUnit } from "./kicadSymbol";
import { guessFootprintConfigFromSymbol, createDefaultFallbackFootprint } from "./kicad/generator/generator";
import { registerKicadFootprint } from "./kicad/footprint/kicadFootprint";

export type FootprintAssignmentSource = "kicad" | "generator";

export interface FootprintAssignment {
  source: FootprintAssignmentSource;
  /** KiCad fullName (Library:Name) or Generator identifier (Generator:Name). */
  identifier: string;
  library?: string;
  name?: string;
  displayName?: string;
  /** Resolved after assignment; key = symbol pin index, value = footprint pad index. */
  pinPadMap?: Record<string, number>;
  status?: "resolved" | "missing" | "mismatch";
}

export interface PinPadLink {
  symbolPinIndex: number;
  symbolPinNumber: string;
  padIndex: number;
  padNumber: string;
}

export interface ComponentLink {
  componentId: string;
  reference: string;
  symbolId: string;
  footprintId?: string;
  assignment?: FootprintAssignment;
  links: PinPadLink[];
  missingSymbolPins: string[];
  missingPads: string[];
  duplicatePads: string[];
}

function normalize(value: string | undefined | null): string {
  return String(value ?? "").trim().toLowerCase();
}

export function getSymbolPinNumbers(node: SchematicNode): string[] {
  const parsed = getImportedKiCadParsedSymbol(node.symbol);
  if (parsed) {
    const unit = node.unit && node.unit > 0 ? resolveKicadUnit(parsed, node.unit, parsed.selectedBodyStyle || 1) : null;
    const pins = unit?.pins?.length ? unit.pins : parsed.pins;
    if (pins?.length) return pins.map((p, i) => String(p.number || p.name || i + 1));
  }
  const sym = SYMBOLS[node.symbol];
  return (sym?.pins ?? []).map((p, i) => String(p.number || p.name || i + 1));
}



export interface PhysicalComponentGroup {
  physicalId: string;
  owner: SchematicNode;
  units: SchematicNode[];
}

/** Build physical component groups. Multi-unit schematic nodes share one PCB footprint. */
export function buildPhysicalComponentGroups(nodes: SchematicNode[]): PhysicalComponentGroup[] {
  const groups = new Map<string, SchematicNode[]>();
  const singles: SchematicNode[] = [];
  for (const node of nodes) {
    if (!node.unitGroupId) { singles.push(node); continue; }
    const arr = groups.get(node.unitGroupId) ?? [];
    arr.push(node);
    groups.set(node.unitGroupId, arr);
  }
  const result: PhysicalComponentGroup[] = singles.map(n => ({ physicalId: n.id, owner: n, units: [n] }));
  for (const [physicalId, units] of groups) {
    units.sort((a, b) => (a.unit ?? 999) - (b.unit ?? 999) || a.id.localeCompare(b.id));
    result.push({ physicalId, owner: units[0], units });
  }
  return result;
}

export function getPhysicalComponentId(node: SchematicNode, nodes: SchematicNode[]): string {
  if (!node.unitGroupId) return node.id;
  const group = buildPhysicalComponentGroups(nodes).find(g => g.physicalId === node.unitGroupId);
  return group?.owner.id ?? node.id;
}

/** Attach all unit pin aliases to one physical footprint without duplicating the footprint. */
export function applyPhysicalUnitAliases(footprint: PcbFootprint, units: SchematicNode[]): PcbFootprint {
  if (units.length <= 1) return footprint;
  const nextPads = footprint.pads.map(p => ({ ...p, pinAliases: p.pinAliases ? [...p.pinAliases] : [] }));
  for (const unit of units) {
    const links = buildPinPadLinks(unit, footprint).links;
    for (const link of links) {
      const pad = nextPads[link.padIndex];
      if (!pad) continue;
      const exists = pad.pinAliases?.some(a => a.componentId === unit.id && a.pinIndex === link.symbolPinIndex);
      if (!exists) pad.pinAliases!.push({ componentId: unit.id, pinIndex: link.symbolPinIndex, pinNumber: link.symbolPinNumber });
    }
  }
  return { ...footprint, pads: nextPads };
}

export function derivePhysicalFootprintAssignment(units: SchematicNode[]): { assignment?: FootprintAssignment; conflicts: string[] } {
  const assignments = units.map(deriveFootprintAssignment).filter((a): a is FootprintAssignment => Boolean(a));
  const byId = new Map(assignments.map(a => [a.identifier, a]));
  return { assignment: assignments[0], conflicts: Array.from(byId.keys()).length > 1 ? Array.from(byId.keys()) : [] };
}

export function findPadIndexForPin(node: SchematicNode, footprint: PcbFootprint, pinIndex: number): number {
  const pinNumbers = getSymbolPinNumbers(node);
  const number = normalize(pinNumbers[pinIndex]);
  if (!number) return -1;
  const aliasIndex = footprint.pads.findIndex(p => p.pinAliases?.some(a => a.componentId === node.id && a.pinIndex === pinIndex));
  if (aliasIndex >= 0) return aliasIndex;
  return footprint.pads.findIndex(p => normalize(p.number ?? p.name) === number);
}

export interface KiCadUnitInfo {
  count: number;
  names: Record<number, string>;
  selected: number;
}

export function getKiCadUnitInfo(symbolId: string): KiCadUnitInfo | undefined {
  const parsed = getImportedKiCadParsedSymbol(symbolId);
  if (!parsed || !parsed.units?.length) return undefined;
  const electricalUnits = Array.from(new Set(parsed.units.filter(u => u.unit > 0).map(u => u.unit))).sort((a, b) => a - b);
  return {
    count: electricalUnits.length || 1,
    names: { ...(parsed.unitNames ?? {}) },
    selected: parsed.selectedUnit || electricalUnits[0] || 1,
  };
}

export function getKiCadSymbolDefaultFootprint(symbolId: string): string | undefined {
  const parsed = getImportedKiCadParsedSymbol(symbolId);
  return parsed?.footprint?.trim() || undefined;
}

export function isKiCadSymbol(symbolId: string): boolean {
  return symbolId.startsWith("kicad:");
}

export function buildPinPadLinks(node: SchematicNode, footprint: PcbFootprint | undefined): {
  links: PinPadLink[];
  missingSymbolPins: string[];
  missingPads: string[];
  duplicatePads: string[];
} {
  const pinNumbers = getSymbolPinNumbers(node);
  const pads = footprint?.pads ?? [];
  const byNumber = new Map<string, number[]>();
  pads.forEach((pad, index) => {
    const n = normalize(pad.number ?? pad.name ?? String(index + 1));
    const arr = byNumber.get(n) ?? [];
    arr.push(index);
    byNumber.set(n, arr);
  });

  const links: PinPadLink[] = [];
  const missingSymbolPins: string[] = [];
  const usedPads = new Set<number>();
  const duplicatePads: string[] = [];

  pinNumbers.forEach((pinNumber, symbolPinIndex) => {
    const candidates = byNumber.get(normalize(pinNumber)) ?? [];
    if (!candidates.length) {
      missingSymbolPins.push(pinNumber);
      return;
    }
    if (candidates.length > 1) duplicatePads.push(pinNumber);
    const padIndex = candidates.find(i => !usedPads.has(i)) ?? candidates[0];
    usedPads.add(padIndex);
    links.push({
      symbolPinIndex,
      symbolPinNumber: pinNumber,
      padIndex,
      padNumber: String(pads[padIndex]?.number ?? pads[padIndex]?.name ?? ""),
    });
  });

  const linkedPadIndexes = new Set(links.map(l => l.padIndex));
  const missingPads = pads
    .map((pad, index) => ({ pad, index }))
    .filter(({ index }) => !linkedPadIndexes.has(index))
    .map(({ pad, index }) => String(pad.number ?? pad.name ?? index + 1));

  return { links, missingSymbolPins, missingPads, duplicatePads };
}

export function makePinPadMap(node: SchematicNode, footprint: PcbFootprint | undefined): Record<string, number> {
  const result: Record<string, number> = {};
  for (const link of buildPinPadLinks(node, footprint).links) result[String(link.symbolPinIndex)] = link.padIndex;
  return result;
}

export function applyPinPadMapping(node: SchematicNode, footprint: PcbFootprint): PcbFootprint {
  const mapping = buildPinPadLinks(node, footprint);
  const byPadIndex = new Map<number, number>();
  for (const link of mapping.links) byPadIndex.set(link.padIndex, link.symbolPinIndex);
  return {
    ...footprint,
    pads: footprint.pads.map((pad, padIndex) => ({
      ...pad,
      pinIndex: byPadIndex.get(padIndex) ?? pad.pinIndex,
    })),
  };
}

export function deriveFootprintAssignment(node: SchematicNode): FootprintAssignment | undefined {
  if (node.footprintAssignment) {
    if ((node.footprintAssignment.source as string) === "cirzuit") {
      return {
        ...node.footprintAssignment,
        source: "generator",
      };
    }
    return node.footprintAssignment;
  }
  if (node.footprint) {
    const isGen = node.footprint.startsWith("Generator:") || node.footprint.startsWith("generator:");
    const isKiCad = node.footprint.includes(":") && !isGen;
    const source: FootprintAssignmentSource = isKiCad ? "kicad" : "generator";
    return {
      source,
      identifier: node.footprint,
      displayName: node.footprint,
      status: "missing",
    };
  }
  const defaultKiCad = getKiCadSymbolDefaultFootprint(node.symbol);
  if (defaultKiCad) {
    const [library, ...rest] = defaultKiCad.split(":");
    return {
      source: "kicad",
      identifier: defaultKiCad,
      library: rest.length ? library : undefined,
      name: rest.length ? rest.join(":") : defaultKiCad,
      displayName: defaultKiCad,
      status: "missing",
    };
  }

  // Automatic default footprint generation if none assigned (THT-First Intelligent Generator)
  const pinNumbers = getSymbolPinNumbers(node);
  const pinCount = pinNumbers.length;
  const model = createDefaultFallbackFootprint({
    symbolName: node.symbol,
    reference: node.reference,
    value: node.value,
    pinCount,
  });
  registerKicadFootprint(model);
  const isTht = model.mountingType === "THT" || model.fullName.includes("THT") || model.fullName.includes("DIP") || model.fullName.includes("Axial") || model.fullName.includes("Radial");
  return {
    source: "generator",
    identifier: model.fullName,
    library: "Generator",
    name: model.name,
    displayName: `${model.fullName} (تلقائي ${isTht ? "THT" : "SMD"})`,
    status: "resolved",
  };
}

export function componentLink(node: SchematicNode, footprint?: PcbFootprint): ComponentLink {
  const assignment = deriveFootprintAssignment(node);
  const mapping = buildPinPadLinks(node, footprint);
  const status = assignment
    ? footprint
      ? mapping.missingSymbolPins.length || mapping.duplicatePads.length ? "mismatch" : "resolved"
      : "missing"
    : undefined;
  return {
    componentId: node.id,
    reference: node.reference ?? "",
    symbolId: node.symbol,
    footprintId: footprint?.id,
    assignment: assignment ? { ...assignment, pinPadMap: makePinPadMap(node, footprint), status } : undefined,
    ...mapping,
  };
}

export function componentLinkSummary(nodes: SchematicNode[], footprints: PcbFootprint[]): ComponentLink[] {
  const byId = new Map(footprints.map(fp => [fp.id, fp]));
  return nodes.map(node => componentLink(node, byId.get(node.id)));
}
