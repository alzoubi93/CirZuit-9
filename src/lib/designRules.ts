import type { SchematicDoc, SchematicNode } from "./schematic";
import type { PcbDoc, PcbFootprint, PcbFootprintPad } from "./pcb";
import { SYMBOLS, transformedPins } from "./symbols";
import { getImportedKiCadParsedSymbol, resolveKicadUnit } from "./kicadSymbol";
import { buildNetIndex } from "./netlist";
import { buildPhysicalComponentGroups, buildPinPadLinks, deriveFootprintAssignment } from "./componentLink";
import { footprintBBox } from "./pcbSync";

export type DesignIssueSeverity = "error" | "warning" | "info";
export type DesignIssueDomain = "ERC" | "DRC";

export interface DesignIssue {
  id: string;
  domain: DesignIssueDomain;
  severity: DesignIssueSeverity;
  code: string;
  message: string;
  messageAr?: string;
  componentId?: string;
  reference?: string;
  netId?: number;
  footprintId?: string;
  location?: { x: number; y: number };
}

export interface DesignCheckResult {
  erc: DesignIssue[];
  drc: DesignIssue[];
  allErc: DesignIssue[];
  allDrc: DesignIssue[];
  ignoredErc: DesignIssue[];
  ignoredDrc: DesignIssue[];
  errors: DesignIssue[];
  warnings: DesignIssue[];
  allErrors: DesignIssue[];
  allWarnings: DesignIssue[];
  passed: boolean;
  checkedAt: number;
}

function generateDeterministicIssueId(
  domain: DesignIssueDomain,
  code: string,
  extra: Partial<DesignIssue> = {},
  message: string
): string {
  let hash = 0;
  for (let i = 0; i < message.length; i++) {
    hash = Math.imul(31, hash) + message.charCodeAt(i) | 0;
  }
  const parts = [
    domain,
    code,
    extra.componentId,
    extra.footprintId,
    extra.reference,
    extra.netId !== undefined ? `net${extra.netId}` : undefined,
    extra.location ? `${Math.round(extra.location.x * 10) / 10}_${Math.round(extra.location.y * 10) / 10}` : undefined,
    hash.toString(16)
  ].filter(Boolean);

  return parts.join("::");
}

function issue(
  domain: DesignIssueDomain,
  severity: DesignIssueSeverity,
  code: string,
  message: string,
  messageAr?: string,
  extra: Partial<DesignIssue> = {}
): DesignIssue {
  const id = generateDeterministicIssueId(domain, code, extra, message);
  return { id, domain, severity, code, message, messageAr, ...extra };
}

function getElectricalPins(node: SchematicNode): { number: string; electrical: string; x: number; y: number; index: number }[] {
  const parsed = getImportedKiCadParsedSymbol(node.symbol);
  if (parsed) {
    const resolved = node.unit && node.unit > 0
      ? resolveKicadUnit(parsed, node.unit, parsed.selectedBodyStyle || 1)
      : { pins: parsed.pins };
    return resolved.pins.map((p, index) => ({ number: p.number || String(index + 1), electrical: String(p.electrical || "passive").toLowerCase(), x: node.x + p.at.x, y: node.y + p.at.y, index }));
  }
  const sym = SYMBOLS[node.symbol];
  if (!sym) return [];
  return transformedPins(sym, node.rotation, node.size ?? 1).map((p, index) => ({ number: String(sym.pins[index]?.number ?? sym.pins[index]?.name ?? index + 1), electrical: "passive", x: node.x + p.x, y: node.y + p.y, index }));
}

function normalizedPowerName(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9_+#-]/g, "");
}

/** Electrical Rule Check: logical Schematic connectivity and pin-drive consistency. */
export function runERC(schematic: SchematicDoc): DesignIssue[] {
  const issues: DesignIssue[] = [];
  const idx = buildNetIndex(schematic);
  const pinsByNet = new Map<number, { node: SchematicNode; pin: ReturnType<typeof getElectricalPins>[number] }[]>();

  for (const node of schematic.nodes) {
    const pins = getElectricalPins(node);
    for (const pin of pins) {
      const netId = idx.pinNet.get(`${node.id}:${pin.index}`);
      if (netId === undefined) {
        if (pin.electrical !== "nc" && !pin.number.toLowerCase().includes("nc")) {
          issues.push(
            issue(
              "ERC",
              "warning",
              "ERC-001",
              `${node.reference ?? node.id}.${pin.number} is not connected to a schematic net.`,
              `الدبوس ${node.reference ?? node.id}.${pin.number} غير متصل بأي شبكة كهربائية في المخطط.`,
              { componentId: node.id, reference: node.reference, location: { x: pin.x, y: pin.y } }
            )
          );
        }
        continue;
      }
      const arr = pinsByNet.get(netId) ?? [];
      arr.push({ node, pin });
      pinsByNet.set(netId, arr);
    }
  }

  for (const net of idx.nets) {
    const members = pinsByNet.get(net.id) ?? [];
    const outputs = members.filter(m => ["output", "open_collector", "open_emitter", "tristate"].includes(m.pin.electrical));
    const powerInputs = members.filter(m => m.pin.electrical === "power_in");
    if (outputs.length > 1) {
      issues.push(
        issue(
          "ERC",
          "error",
          "ERC-002",
          `${net.name} has multiple output drivers: ${outputs.map(o => `${o.node.reference ?? o.node.id}.${o.pin.number}`).join(", ")}.`,
          `الشبكة ${net.name} تحتوي على عدة مخرجات متضاربة: ${outputs.map(o => `${o.node.reference ?? o.node.id}.${o.pin.number}`).join("، ")}.`,
          { netId: net.id }
        )
      );
    }
    if (powerInputs.length && outputs.length === 0) {
      const namedPower = normalizedPowerName(net.name);
      const isPowerRail = /^(vcc|vdd|vss|gnd|ground|3v3|5v|12v|vin|vbat|avcc|dvcc)$/.test(namedPower);
      issues.push(
        issue(
          "ERC",
          isPowerRail ? "info" : "warning",
          "ERC-003",
          `${net.name} contains power-input pins but no output/power-driver pin was detected.`,
          `الشبكة ${net.name} تحتوي على دبابيس تغذية ولكن لم يتم الكشف عن مخرج أو مصدر تغذية لها.`,
          { netId: net.id }
        )
      );
    }
    if (members.length === 1 && !net.labels.length) {
      issues.push(
        issue(
          "ERC",
          "warning",
          "ERC-004",
          `${net.name} has only one connected pin.`,
          `الشبكة ${net.name} متصلة بدبوس واحد فقط.`,
          { netId: net.id, componentId: members[0].node.id, reference: members[0].node.reference }
        )
      );
    }
    if (net.labels.length > 1) {
      const names = Array.from(new Set(net.labels));
      if (names.length > 1)
        issues.push(
          issue(
            "ERC",
            "warning",
            "ERC-005",
            `Net ${net.name} has conflicting labels: ${names.join(", ")}.`,
            `الشبكة ${net.name} تحتوي على مسميات متضاربة: ${names.join("، ")}.`,
            { netId: net.id }
          )
        );
    }
  }

  for (const label of schematic.netLabels ?? []) {
    const netId = idx.labelNet.get(label.id);
    if (netId === undefined) {
      issues.push(
        issue(
          "ERC",
          "warning",
          "ERC-006",
          `Net label "${label.text}" is not attached to a wire or pin.`,
          `بطاقة التسمية "${label.text}" غير موصولة بأي سلك أو دبوس.`,
          { location: { x: label.x, y: label.y } }
        )
      );
    }
  }

  // Multi-unit physical identity checks.
  for (const group of buildPhysicalComponentGroups(schematic.nodes)) {
    if (group.units.length <= 1) continue;
    const assignments = new Set(group.units.map(n => deriveFootprintAssignment(n)?.identifier).filter(Boolean));
    if (assignments.size > 1) {
      issues.push(
        issue(
          "ERC",
          "error",
          "ERC-007",
          `Multi-unit component ${group.owner.reference ?? group.owner.id} has conflicting Footprint assignments.`,
          `المكون متعدد الأجزاء ${group.owner.reference ?? group.owner.id} يحتوي على تخصيصات بصمة متضاربة.`,
          { componentId: group.owner.id, reference: group.owner.reference }
        )
      );
    }
    const units = group.units.map(n => n.unit).filter((u): u is number => Number.isFinite(u));
    if (new Set(units).size !== units.length) {
      issues.push(
        issue(
          "ERC",
          "error",
          "ERC-008",
          `Multi-unit component ${group.owner.reference ?? group.owner.id} contains duplicate unit numbers.`,
          `المكون متعدد الأجزاء ${group.owner.reference ?? group.owner.id} يحتوي على أرقام وحدات مكررة.`,
          { componentId: group.owner.id, reference: group.owner.reference }
        )
      );
    }
  }

  return issues;
}

function padAbsPosition(fp: PcbFootprint, pad: PcbFootprintPad) {
  const r = (fp.rotation * Math.PI) / 180;
  return { x: fp.x + pad.x * Math.cos(r) - pad.y * Math.sin(r), y: fp.y + pad.x * Math.sin(r) + pad.y * Math.cos(r) };
}

export function isKiCadPcbBoard(pcb?: PcbDoc): boolean {
  if (!pcb) return false;
  if (pcb.isImportedKiCadPcb || pcb.disableDrc) return true;

  // Check for KiCad-specific ID signatures or metadata on board elements
  const hasKiCadTracks = pcb.tracks?.some(t => t.id?.includes("kicad") || t.id?.startsWith("gr-"));
  if (hasKiCadTracks) return true;

  const hasKiCadVias = pcb.vias?.some(v => v.id?.includes("kicad"));
  if (hasKiCadVias) return true;

  const hasKiCadFootprints = pcb.footprints?.some(
    fp => fp.id?.includes("kicad") ||
          (fp.library && fp.library.includes(":")) ||
          fp.library?.toLowerCase().includes("kicad") ||
          (fp.metadata && (fp.metadata.kicad || fp.metadata.source === "kicad" || fp.metadata.library))
  );
  if (hasKiCadFootprints) return true;

  const hasKiCadTexts = pcb.texts?.some(t => t.id?.includes("kicad"));
  if (hasKiCadTexts) return true;

  return false;
}

/** PCB Design Rule Check: structural, connectivity and basic geometry validation. */
export function runDRC(schematic: SchematicDoc, pcb?: PcbDoc): DesignIssue[] {
  // If the board is an imported KiCad PCB (.kicad_pcb), DRC is completely disabled.
  if (isKiCadPcbBoard(pcb)) {
    return [];
  }
  const issues: DesignIssue[] = [];
  if (!pcb)
    return [
      issue("DRC", "warning", "DRC-000", "PCB document is missing.", "ملف لوحة الـ PCB غير موجود.")
    ];
  const netIndex = buildNetIndex(schematic);
  const owners = new Set(buildPhysicalComponentGroups(schematic.nodes).map(g => g.owner.id));

  const isManualFp = (fp: PcbFootprint) => !owners.has(fp.id);
  const tagEn = (fp: PcbFootprint) => (isManualFp(fp) ? " (manually added to PCB)" : "");
  const tagAr = (fp: PcbFootprint) => (isManualFp(fp) ? " (مضافة يدوياً إلى PCB)" : "");

  const seenRefs = new Set<string>();
  for (const fp of pcb.footprints ?? []) {
    if (fp.reference && seenRefs.has(fp.reference)) {
      issues.push(
        issue(
          "DRC",
          "warning",
          "DRC-001",
          `Duplicate PCB reference ${fp.reference}${tagEn(fp)}.`,
          `الرمز المرجعي للقطعة ${fp.reference}${tagAr(fp)} مكرر على لوحة الـ PCB.`,
          { footprintId: fp.id, reference: fp.reference, location: { x: fp.x, y: fp.y } }
        )
      );
    }
    if (fp.reference) seenRefs.add(fp.reference);
    if (!owners.has(fp.id)) {
      issues.push(
        issue(
          "DRC",
          "warning",
          "DRC-002",
          `PCB footprint ${fp.reference ?? fp.id}${tagEn(fp)} is not linked to a schematic physical component.`,
          `البصمة ${fp.reference ?? fp.id}${tagAr(fp)} غير مرتبطة بأي عنصر في المخطط الكهربائي.`,
          { footprintId: fp.id }
        )
      );
    }
    const numbers = new Set<string>();
    const reportedDuplicates = new Set<string>();
    for (const pad of fp.pads) {
      const number = String(pad.number ?? pad.name ?? "").trim().toLowerCase();
      if (number && numbers.has(number) && !reportedDuplicates.has(number)) {
        reportedDuplicates.add(number);
        issues.push(
          issue(
            "DRC",
            "warning",
            "DRC-003",
            `Footprint ${fp.reference ?? fp.id}${tagEn(fp)} contains duplicate pad ${pad.number ?? pad.name}.`,
            `البصمة ${fp.reference ?? fp.id}${tagAr(fp)} تحتوي على وسادة لحام مكررة (${pad.number ?? pad.name}).`,
            { footprintId: fp.id }
          )
        );
      }
      if (number) numbers.add(number);
      if (!(pad.width > 0) || !(pad.height > 0))
        issues.push(
          issue(
            "DRC",
            "warning",
            "DRC-004",
            `Footprint ${fp.reference ?? fp.id}${tagEn(fp)} has a pad with invalid dimensions.`,
            `البصمة ${fp.reference ?? fp.id}${tagAr(fp)} تحتوي على وسادة لحام بأبعاد غير صالحة.`,
            { footprintId: fp.id }
          )
        );
      const netId = pad.netId;
      if (netId !== undefined && !netIndex.nets.some(n => n.id === netId))
        issues.push(
          issue(
            "DRC",
            "warning",
            "DRC-005",
            `Footprint ${fp.reference ?? fp.id}${tagEn(fp)} has a pad referencing a missing schematic net.`,
            `البصمة ${fp.reference ?? fp.id}${tagAr(fp)} تحتوي على وسادة لحام ترتبط بشبكة مفقودة.`,
            { footprintId: fp.id, netId }
          )
        );
    }
    const b = (() => { try { return footprintBBox(fp); } catch { return { x: fp.x, y: fp.y, w: 0, h: 0 }; } })();
    if (b.x < 0 || b.y < 0 || b.x + b.w > pcb.width || b.y + b.h > pcb.height) {
      issues.push(
        issue(
          "DRC",
          "warning",
          "DRC-006",
          `Footprint ${fp.reference ?? fp.id}${tagEn(fp)} extends outside the PCB board outline.`,
          `البصمة ${fp.reference ?? fp.id}${tagAr(fp)} تمتد خارج حدود لوحة الـ PCB.`,
          { footprintId: fp.id, location: { x: fp.x, y: fp.y } }
        )
      );
    }
  }

  for (const track of pcb.tracks ?? []) {
    if (!(track.width > 0))
      issues.push(
        issue(
          "DRC",
          "warning",
          "DRC-007",
          `Track ${track.id} has an invalid width.`,
          `المسار ${track.id} يمتلك عرضاً غير صالح.`,
          { componentId: track.id }
        )
      );
    if (track.netId !== undefined && !netIndex.nets.some(n => n.id === track.netId))
      issues.push(
        issue(
          "DRC",
          "warning",
          "DRC-008",
          `Track ${track.id} references a missing schematic net.`,
          `المسار ${track.id} يرتبط بشبكة مفقودة.`,
          { componentId: track.id, netId: track.netId }
        )
      );
    for (const p of track.points) {
      if (p.x < 0 || p.y < 0 || p.x > pcb.width || p.y > pcb.height)
        issues.push(
          issue(
            "DRC",
            "warning",
            "DRC-009",
            `Track ${track.id} extends outside the board.`,
            `المسار ${track.id} يمتد خارج حدود اللوحة.`,
            { componentId: track.id, location: p }
          )
        );
    }
  }

  // Basic copper clearance check between pads on different nets.
  const pads: { fp: PcbFootprint; pad: PcbFootprintPad; x: number; y: number }[] = [];
  for (const fp of pcb.footprints ?? []) for (const pad of fp.pads) { const p = padAbsPosition(fp, pad); pads.push({ fp, pad, ...p }); }
  for (let i = 0; i < pads.length; i++) {
    for (let j = i + 1; j < pads.length; j++) {
      const a = pads[i], b = pads[j];
      if (a.pad.netId !== undefined && a.pad.netId === b.pad.netId) continue;
      const clearance = Math.max(a.pad.width, a.pad.height) / 2 + Math.max(b.pad.width, b.pad.height) / 2;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < clearance * 0.85) {
        issues.push(
          issue(
            "DRC",
            "warning",
            "DRC-010",
            `Pads ${a.fp.reference ?? a.fp.id}.${a.pad.number ?? a.pad.name}${tagEn(a.fp)} and ${b.fp.reference ?? b.fp.id}.${b.pad.number ?? b.pad.name}${tagEn(b.fp)} violate basic copper clearance.`,
            `وسادتا اللحام ${a.fp.reference ?? a.fp.id}.${a.pad.number ?? a.pad.name}${tagAr(a.fp)} و ${b.fp.reference ?? b.fp.id}.${b.pad.number ?? b.pad.name}${tagAr(b.fp)} تتعديان مسافة الأمان النحاسية (Clearance).`,
            { footprintId: a.fp.id, location: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } }
          )
        );
      }
    }
  }

  return issues;
}

export function runDesignChecks(schematic: SchematicDoc, pcb?: PcbDoc, ignoredIds?: string[] | Set<string>): DesignCheckResult {
  const allErc = runERC(schematic);
  const allDrc = runDRC(schematic, pcb);
  const ignoredSet = ignoredIds instanceof Set ? ignoredIds : new Set(ignoredIds || schematic.ignoredIssues || []);

  const erc = allErc.filter(i => !ignoredSet.has(i.id));
  const drc = allDrc.filter(i => !ignoredSet.has(i.id));
  const ignoredErc = allErc.filter(i => ignoredSet.has(i.id));
  const ignoredDrc = allDrc.filter(i => ignoredSet.has(i.id));

  const allIssues = [...allErc, ...allDrc];
  const activeIssues = [...erc, ...drc];

  return {
    erc,
    drc,
    allErc,
    allDrc,
    ignoredErc,
    ignoredDrc,
    errors: activeIssues.filter(i => i.severity === "error"),
    warnings: activeIssues.filter(i => i.severity === "warning"),
    allErrors: allIssues.filter(i => i.severity === "error"),
    allWarnings: allIssues.filter(i => i.severity === "warning"),
    passed: activeIssues.length === 0,
    checkedAt: Date.now(),
  };
}
