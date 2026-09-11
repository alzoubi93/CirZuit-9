/**
 * Internal KiCad footprint definition reader.
 *
 * This module is deliberately below the public runtime boundary. It turns the
 * official .kicad_mod S-expression representation into the native CirZuit
 * KicadFootprintModel. Rendering and PCB logic never call this reader.
 */
import type {
  KicadFootprintArc,
  KicadFootprintCircle,
  KicadFootprintCurve,
  KicadFootprintGraphic,
  KicadFootprintLine,
  KicadFootprintModel,
  KicadFootprintPad,
  KicadFootprintPoint,
  KicadFootprintPoly,
  KicadFootprintRect,
  KicadFootprintText,
  KicadFootprintStroke,
  KicadPadType,
  KicadPadShape,
} from "./kicadFootprint";
import { KICAD_FOOTPRINT_REPOSITORY } from "./kicadFootprint";

interface SNode { value?: string; items: SNode[]; }

function tokenize(input: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === ";") { while (i < input.length && input[i] !== "\n") i++; continue; }
    if (c === "(") { out.push(c); i++; continue; }
    if (c === ")") { out.push(c); i++; continue; }
    if (c === '"') {
      let s = ""; i++;
      while (i < input.length) {
        const ch = input[i++];
        if (ch === "\\" && i < input.length) { s += input[i++]; continue; }
        if (ch === '"') break;
        s += ch;
      }
      out.push(s);
      continue;
    }
    let s = "";
    while (i < input.length && !/[\s()]/.test(input[i])) s += input[i++];
    out.push(s);
  }
  return out;
}

function parseSExpr(input: string): SNode[] {
  const tokens = tokenize(input);
  const roots: SNode[] = [];
  const stack: SNode[] = [];
  let current: SNode | undefined;
  for (const token of tokens) {
    if (token === "(") {
      const node: SNode = { items: [] };
      if (current) current.items.push(node); else roots.push(node);
      stack.push(node);
      current = node;
    } else if (token === ")") {
      stack.pop();
      current = stack[stack.length - 1];
    } else if (current) {
      current.items.push({ value: token, items: [] });
    }
  }
  return roots;
}

function atom(node?: SNode): string | undefined { return node?.value; }
function child(node: SNode, key: string): SNode | undefined {
  return node.items.find(i => atom(i.items[0]) === key || atom(i) === key);
}
function children(node: SNode, key: string): SNode[] {
  return node.items.filter(i => atom(i.items[0]) === key);
}
function scalar(node?: SNode): string | undefined {
  if (!node) return undefined;
  if (node.items.length > 1) return atom(node.items[1]);
  if (node.items.length === 1) return atom(node.items[0]);
  return atom(node);
}
function num(v: string | undefined, fallback = 0): number {
  const n = Number(v); return Number.isFinite(n) ? n : fallback;
}
function point(node?: SNode): KicadFootprintPoint {
  if (!node) return { x: 0, y: 0 };
  // S-expression child nodes include their keyword as item[0].
  // Coordinates begin at item[1].
  const a = node.items.slice(1).map(atom).filter((x): x is string => x !== undefined);
  return { x: num(a[0]), y: num(a[1]) };
}
function pair(node?: SNode): { x: number; y: number } {
  return point(node);
}
function xyz(node?: SNode): { x:number; y:number; z:number } {
  if (!node) return {x:0,y:0,z:0};
  const a=node.items.slice(1).map(atom).filter((x): x is string => x!==undefined);
  return {x:num(a[0]),y:num(a[1]),z:num(a[2])};
}
function fillStyle(node: SNode): "none" | "solid" {
  const f = child(node, "fill");
  if (f) {
    const fv = atom(f.items[1]) || scalar(f);
    if (fv === "none" || fv === "no") return "none";
    if (fv === "yes" || fv === "solid") return "solid";
    const typeChild = child(f, "type");
    if (typeChild) {
      const tv = scalar(typeChild);
      if (tv === "none" || tv === "no") return "none";
      if (tv === "yes" || tv === "solid") return "solid";
    }
  }
  const v = keyValue(node, "fill");
  if (v === "none" || v === "no") return "none";
  if (v === "yes" || v === "solid") return "solid";
  const kind = atom(node.items[0]);
  if (kind === "fp_poly" || kind === "gr_poly") return "solid";
  return "none";
}
function keyValue(node: SNode, key: string): string | undefined {
  const c = child(node, key);
  return scalar(c);
}
function vectorValues(node: SNode, key: string): string[] {
  const c = child(node, key);
  return c ? c.items.slice(1).map(atom).filter((x): x is string => x !== undefined) : [];
}

function strokeOf(node: SNode): KicadFootprintStroke | undefined {
  const s = child(node, "stroke");
  if (s) return { width: num(scalar(child(s, "width")), 0.12), type: scalar(child(s, "type")) };
  const legacyWidth = keyValue(node, "width");
  if (legacyWidth !== undefined) return { width: num(legacyWidth, 0.12) };
  return undefined;
}
function layerOf(node: SNode): string {
  return keyValue(node, "layer") || "F.SilkS";
}
function parseAt(node: SNode): { position: KicadFootprintPoint; rotation: number } {
  const a = child(node, "at");
  if (!a) return { position: { x: 0, y: 0 }, rotation: 0 };
  const vals = a.items.slice(1).map(atom).filter((x): x is string => x !== undefined);
  return { position: { x: num(vals[0]), y: num(vals[1]) }, rotation: num(vals[2]) };
}
function parseText(node: SNode, kind: "text" | "text_box"): KicadFootprintText {
  const raw = kind === "text" ? node.items[2] : node.items[1];
  const text = atom(raw) || "";
  const roleAtom = atom(node.items[1]);
  const role = roleAtom === "reference" || roleAtom === "value" || roleAtom === "user" ? roleAtom : "other";
  const at = parseAt(node);
  const startPoint = child(node,"start") ? point(child(node,"start")) : at.position;
  const endPoint = child(node,"end") ? point(child(node,"end")) : undefined;
  const ptsNode = child(node, "pts");
  const boxPoints = ptsNode ? children(ptsNode, "xy").map(point) : undefined;
  const effects = child(node, "effects");
  const font = effects ? child(effects, "font") : undefined;
  const size = pair(font ? child(font, "size") : undefined);
  const justify = effects ? vectorValues(effects, "justify") : [];
  const isHide = node.items.some(i => atom(i.items[0]) === "hide" || atom(i) === "hide") ||
    (effects ? effects.items.some(i => atom(i.items[0]) === "hide" || atom(i) === "hide" || (atom(i.items[0]) === "hide" && atom(i.items[1]) === "yes")) : false);
  return {
    kind, layer: layerOf(node), stroke: strokeOf(node), text,
    position: kind === "text_box" ? startPoint : at.position,
    end: endPoint,
    boxPoints: boxPoints && boxPoints.length ? boxPoints : undefined,
    angle: num(keyValue(node,"angle"), at.rotation),
    rotation: num(keyValue(node,"angle"), at.rotation),
    size: { x: size.x || 1, y: size.y || 1 },
    thickness: num(font ? scalar(child(font, "thickness")) : undefined, 0.15),
    justify,
    italic: !!(font && child(font, "italic")),
    bold: !!(font && child(font, "bold")),
    mirror: justify.includes("mirror"),
    visible: !isHide,
    width: num(keyValue(node, "width"), size.x || 1),
    height: num(keyValue(node, "height"), size.y || 1),
    role,
  };
}

function parseGraphic(node: SNode, diagnostics: string[]): KicadFootprintGraphic | undefined {
  const kind = atom(node.items[0]);
  if (!kind) return undefined;
  const layer = layerOf(node);
  const stroke = strokeOf(node);
  const locked = !!node.items.some(i => atom(i.items[0]) === "locked");
  if (kind === "fp_line" || kind === "gr_line") return { kind:"line", layer, stroke, locked, start:point(child(node,"start")), end:point(child(node,"end")) };
  if (kind === "fp_rect" || kind === "gr_rect") return { kind:"rect", layer, stroke, locked, start:point(child(node,"start")), end:point(child(node,"end")), fill:fillStyle(node), radius:num(keyValue(node,"radius")) };
  if (kind === "fp_circle" || kind === "gr_circle") return { kind:"circle", layer, stroke, locked, center:point(child(node,"center")), end:point(child(node,"end")), fill:fillStyle(node) };
  if (kind === "fp_arc" || kind === "gr_arc") return { kind:"arc", layer, stroke, locked, start:point(child(node,"start")), mid:child(node,"mid")?point(child(node,"mid")):undefined, end:point(child(node,"end")), center:child(node,"center")?point(child(node,"center")):undefined, startAngle:num(keyValue(node,"start")), angle:num(keyValue(node,"angle")) };
  if (kind === "fp_poly" || kind === "gr_poly") { const pts=child(node,"pts"); return { kind:"poly", layer, stroke, locked, points:pts?children(pts,"xy").map(point):[], fill:fillStyle(node) }; }
  if (kind === "fp_curve" || kind === "gr_curve") { const pts=child(node,"pts"); const points=pts?children(pts,"xy").map(point):[]; if(points.length<4) diagnostics.push(`${kind} has fewer than four control points.`); return {kind:"curve",layer,stroke,locked,points}; }
  if (kind === "fp_text") return parseText(node,"text");
  if (kind === "fp_text_box") return parseText(node,"text_box");
  if (kind === "gr_text") return parseText(node,"text");
  if (kind === "property") {
    const propKey = atom(node.items[1]) || "";
    const propVal = atom(node.items[2]) || "";
    const at = parseAt(node);
    const effects = child(node, "effects");
    const font = effects ? child(effects, "font") : undefined;
    const size = pair(font ? child(font, "size") : undefined);
    const justify = effects ? vectorValues(effects, "justify") : [];
    const isHide = node.items.some(i => atom(i.items[0]) === "hide") || (effects && effects.items.some(i => atom(i.items[0]) === "hide"));
    const role = propKey.toLowerCase() === "reference" ? "reference" : (propKey.toLowerCase() === "value" ? "value" : "other");
    return {
      kind: "text",
      layer: layerOf(node),
      stroke: strokeOf(node),
      text: propVal,
      position: at.position,
      angle: num(keyValue(node, "angle"), at.rotation),
      rotation: num(keyValue(node, "angle"), at.rotation),
      size: { x: size.x || 1, y: size.y || 1 },
      thickness: num(font ? scalar(child(font, "thickness")) : undefined, 0.15),
      justify,
      italic: !!(font && child(font, "italic")),
      bold: !!(font && child(font, "bold")),
      mirror: justify.includes("mirror"),
      visible: !isHide,
      role,
    };
  }
  if (kind.startsWith("fp_")) diagnostics.push(`Unsupported KiCad footprint graphic: ${kind}`);
  return undefined;
}

function parsePad(node: SNode, diagnostics: string[]): KicadFootprintPad {
  const vals=node.items.slice(1).map(atom).filter((x):x is string=>x!==undefined);
  const number=vals[0]||"", type=(vals[1]||"unknown") as KicadPadType;
  let rawShape = vals[2] || "unknown";
  if (rawShape === "chamfered_rect") rawShape = "chamferrect";
  if (rawShape === "round_rect") rawShape = "roundrect";
  const shape = rawShape as KicadPadShape;
  const at=parseAt(node), size=pair(child(node,"size")), layers=vectorValues(node,"layers");
  const drillNode=child(node,"drill"), drillVals=drillNode?.items.slice(1).map(atom).filter((x):x is string=>x!==undefined)||[];
  const net=child(node,"net"), props:Record<string,string>={};
  for(const pr of children(node,"property")){const pv=pr.items.slice(1).map(atom).filter((x):x is string=>x!==undefined);if(pv[0])props[pv[0]]=pv[1]||"";}
  const custom=child(node,"primitives");
  const customGraphics:KicadFootprintGraphic[]=[];
  if(custom){for(const item of custom.items){const g=parseGraphic(item,diagnostics);if(g)customGraphics.push(g);}}
  if(shape==="custom" && !customGraphics.length) diagnostics.push(`Custom pad ${number} has no renderable primitives.`);
  const layerOverrides: Record<string, any> = {};
  // KiCad board padstacks can carry layer-specific shape data.  Library .kicad_mod
  // files normally use a shared shape, but the runtime also accepts normalized
  // layer_override nodes emitted by CirZuit's board adapter.
  for (const ov of children(node, "layer_override")) {
    const layer = keyValue(ov, "layer");
    if (!layer) continue;
    const ovSize = child(ov, "size") ? pair(child(ov, "size")) : undefined;
    const ovAt = child(ov, "at") ? parseAt(ov) : undefined;
    const ovPrimitives = child(ov, "primitives");
    const ovGraphics: KicadFootprintGraphic[] = [];
    if (ovPrimitives) for (const item of ovPrimitives.items) { const g = parseGraphic(item, diagnostics); if (g) ovGraphics.push(g); }
    layerOverrides[layer] = {
      layer,
      shape: (keyValue(ov, "shape") as KicadPadShape | undefined),
      size: ovSize,
      rotation: ovAt?.rotation,
      offset: child(ov, "offset") ? point(child(ov, "offset")) : undefined,
      roundrectRatio: num(keyValue(ov, "roundrect_rratio")),
      chamferRatio: num(keyValue(ov, "chamfer_ratio")),
      chamferCorners: child(ov, "chamfer") ? child(ov, "chamfer")!.items.slice(1).map(atom).filter((x): x is string => !!x) : undefined,
      rectDelta: child(ov, "rect_delta") ? point(child(ov, "rect_delta")) : undefined,
      customGraphics: ovGraphics,
      clearance: keyValue(ov, "clearance") as "outline" | "convexhull" | undefined,
    };
  }
  return {
    number,type,shape,position:at.position,size,rotation:at.rotation,layers,
    drill: drillVals.length ? (drillVals[0] === "oval" ? undefined : num(drillVals[0])) : undefined,
    drillX: drillVals[0] === "oval" && drillVals.length > 1 ? num(drillVals[1]) : undefined,
    drillY: drillVals[0] === "oval" && drillVals.length > 2 ? num(drillVals[2]) : undefined,
    offset:child(node,"offset")?point(child(node,"offset")):undefined,
    roundrectRatio:num(keyValue(node,"roundrect_rratio")),
    chamferRatio:num(keyValue(node,"chamfer_ratio")),
    chamferCorners: (() => { const c = child(node, "chamfer"); return c ? c.items.slice(1).map(atom).filter((x): x is string => !!x) : []; })(),
    rectDelta:child(node,"rect_delta")?point(child(node,"rect_delta")):undefined,
    net:net?{number:num(atom(net.items[1])),name:atom(net.items[2])}:undefined,
    pinfunction:keyValue(node,"pinfunction"), pinstype:keyValue(node,"pintype"),
    removeUnusedLayers:!!child(node,"remove_unused_layers"),
    keepEndLayers:!!child(node,"keep_end_layers"),
    clearanceMode:keyValue(node,"clearance") as "outline" | "convexhull" | undefined,
    anchorShape:keyValue(node,"anchor") as "rect" | "circle" | undefined,
    customShapeInZoneMode:keyValue(node,"clearance") as "outline" | "convexhull" | undefined,
    thermalWidth:num(keyValue(node,"thermal_width")),
    thermalGap:num(keyValue(node,"thermal_gap")),
    locked:!!node.items.some(i=>atom(i.items[0])==="locked"), properties:props, customGraphics,
    layerOverrides: Object.keys(layerOverrides).length ? layerOverrides : undefined
  };
}

export function readKicadFootprintDefinition(text: string, source: Partial<KicadFootprintModel["source"]> = {}): KicadFootprintModel {
  const roots = parseSExpr(text);
  const root = roots.find(r => atom(r.items[0]) === "footprint" || atom(r.items[0]) === "module") || roots[0];
  if (!root) throw new Error("No KiCad footprint expression found");
  const vals = root.items.map(atom).filter((x): x is string => x !== undefined);
  const rawName = vals[1] || "Unnamed";
  const parts = rawName.split(":");
  const name = parts.pop() || rawName;
  let library = parts.join(":") || "";
  if (!library && source?.path) {
    const pretty = source.path.split("/").find(p => p.endsWith(".pretty"));
    if (pretty) library = pretty.replace(/\.pretty$/, "");
  }
  const fullName = library ? `${library}:${name}` : rawName;
  const at = parseAt(root);
  const diagnostics: string[] = [];
  const graphics: KicadFootprintGraphic[] = [];
  for (const item of root.items) {
    const g = parseGraphic(item, diagnostics);
    if (g) graphics.push(g);
  }
  const pads = children(root, "pad").map(p => parsePad(p, diagnostics));
  const properties: Record<string, string> = {};
  for (const p of children(root, "property")) {
    const pvals = p.items.slice(1).map(atom).filter((x): x is string => x !== undefined);
    if (pvals[0]) properties[pvals[0]] = pvals[1] || "";
  }
  // Fallback for KiCad fp_text fields
  if (!properties["Reference"] && !properties["reference"]) {
    for (const item of root.items) {
      if ((atom(item.items[0]) === "fp_text" || atom(item.items[0]) === "text") && atom(item.items[1]) === "reference") {
        const refVal = atom(item.items[2]);
        if (refVal) properties["Reference"] = refVal;
        break;
      }
    }
  }
  if (!properties["Value"] && !properties["value"]) {
    for (const item of root.items) {
      if ((atom(item.items[0]) === "fp_text" || atom(item.items[0]) === "text") && atom(item.items[1]) === "value") {
        const valVal = atom(item.items[2]);
        if (valVal) properties["Value"] = valVal;
        break;
      }
    }
  }
  const models = children(root, "model").map(m => ({
    path: atom(m.items[1]) || "",
    offset: child(m, "offset") ? (() => { const v=xyz(child(m,"offset")); return {x:v.x,y:v.y}; })() : undefined,
    scale: child(m, "scale") ? (() => { const v=xyz(child(m,"scale")); return {x:v.x,y:v.y}; })() : undefined,
    rotate: child(m, "rotate") ? (() => { const v=xyz(child(m,"rotate")); return {x:v.x,y:v.y}; })() : undefined,
  }));
  const attrNode=child(root,"attr");
  const attributes=attrNode?attrNode.items.slice(1).map(atom).filter((x):x is string=>x!==undefined):[];
  const uuid=keyValue(root,"uuid");
  return {
    id: fullName,
    library, name, fullName,
    version: num(keyValue(root, "version")) || undefined,
    generator: keyValue(root, "generator"),
    layer: keyValue(root, "layer") || "F.Cu",
    position: at.position,
    rotation: at.rotation,
    description: keyValue(root, "descr"),
    tags: (keyValue(root, "tags") || "").split(/\s+/).filter(Boolean),
    properties, graphics, pads, models,
    source: { type: "kicad-official", repository: KICAD_FOOTPRINT_REPOSITORY, ...source },
    diagnostics, attributes, uuid,
    clearance:num(keyValue(root,"clearance")), solderMaskMargin:num(keyValue(root,"solder_mask_margin")),
    solderPasteMargin:num(keyValue(root,"solder_paste_margin")), solderPasteRatio:num(keyValue(root,"solder_paste_ratio")),
    zoneConnect:num(keyValue(root,"zone_connect")), thermalWidth:num(keyValue(root,"thermal_width")), thermalGap:num(keyValue(root,"thermal_gap")),
  };
}

