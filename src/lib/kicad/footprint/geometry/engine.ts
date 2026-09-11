import type {
  KicadFootprintArc, KicadFootprintCircle, KicadFootprintCurve, KicadFootprintGraphic,
  KicadFootprintLine, KicadFootprintPad, KicadFootprintPoint, KicadFootprintPoly,
  KicadFootprintRect, KicadFootprintText,
} from "../kicadFootprint";
import { KicadPadstackRuntime } from "../kicadPadstackRuntime";
import type {
  GeoArc, GeoBezier, GeoCapsule, GeoChamferRect, GeoCircle, GeoHole, GeoLine,
  GeoPoint, GeoPolygon, GeoRect, GeoRoundRect, GeoStroke, GeoText, GeoTransform,
  KicadGeometryBounds, KicadGeometryItem, KicadGeometryPrimitive, KicadHitResult,
} from "./types";

export const GEOMETRY_EPSILON = 1e-9;
export const HIT_TOLERANCE_MM = 0.12;

export function rotatePoint(point: GeoPoint, degrees: number): GeoPoint {
  const r = degrees * Math.PI / 180;
  const c = Math.cos(r), s = Math.sin(r);
  return { x: point.x * c - point.y * s, y: point.x * s + point.y * c };
}

export function transformPoint(point: GeoPoint, transform: GeoTransform): GeoPoint {
  let p = { x: point.x * transform.scaleX, y: point.y * transform.scaleY };
  if (transform.flipped) p.x = -p.x;
  p = rotatePoint(p, transform.rotation);
  return { x: p.x + transform.position.x, y: p.y + transform.position.y };
}

export function normalizeRadians(value: number): number {
  const tau = Math.PI * 2;
  return ((value % tau) + tau) % tau;
}

export function arcFromThreePoints(start: GeoPoint, mid: GeoPoint, end: GeoPoint, strokeWidth = 0.12): GeoArc | null {
  const d = 2 * (start.x * (mid.y - end.y) + mid.x * (end.y - start.y) + end.x * (start.y - mid.y));
  if (Math.abs(d) < GEOMETRY_EPSILON) return null;
  const a = start.x * start.x + start.y * start.y;
  const b = mid.x * mid.x + mid.y * mid.y;
  const c = end.x * end.x + end.y * end.y;
  const center = {
    x: (a * (mid.y - end.y) + b * (end.y - start.y) + c * (start.y - mid.y)) / d,
    y: (a * (end.x - mid.x) + b * (start.x - end.x) + c * (mid.x - start.x)) / d,
  };
  const radius = Math.hypot(start.x - center.x, start.y - center.y);
  if (!Number.isFinite(radius) || radius < GEOMETRY_EPSILON) return null;
  const a0 = Math.atan2(start.y - center.y, start.x - center.x);
  const am = Math.atan2(mid.y - center.y, mid.x - center.x);
  const a1 = Math.atan2(end.y - center.y, end.x - center.x);
  const ccw = normalizeRadians(a1 - a0);
  const midFromStart = normalizeRadians(am - a0);
  const sweep = midFromStart <= ccw + GEOMETRY_EPSILON ? ccw : -(Math.PI * 2 - ccw);
  return { kind: "arc", start, mid, end, center, radius, sweepRadians: sweep, stroke: { width: strokeWidth } };
}

function stroke(width?: number, type?: string): GeoStroke { return { width: Math.max(0, width ?? 0.12), type }; }
function point(p: KicadFootprintPoint): GeoPoint { return { x: p.x, y: p.y }; }
function graphicStroke(g: KicadFootprintGraphic): GeoStroke { return stroke(g.stroke?.width, g.stroke?.type); }
function textAnchor(justify: string[] = []): "start" | "middle" | "end" {
  if (justify.includes("left")) return "start";
  if (justify.includes("right")) return "end";
  return "middle";
}

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function effectiveRadius(size: {x:number;y:number}, ratio: number) {
  return clamp(Math.max(0, ratio) * Math.min(Math.abs(size.x), Math.abs(size.y)), 0, Math.min(Math.abs(size.x), Math.abs(size.y)) / 2);
}

export class KicadGeometryEngine {
  graphic(g: KicadFootprintGraphic, source: KicadGeometryItem["source"] = "graphic"): KicadGeometryItem[] {
    const base = { layer: g.layer, source, selectable: true } as const;
    switch (g.kind) {
      case "line": return [{ ...base, primitive: this.line(g) }];
      case "rect": return [{ ...base, primitive: this.rect(g) }];
      case "circle": return [{ ...base, primitive: this.circle(g) }];
      case "arc": {
        const arc = g.mid ? arcFromThreePoints(point(g.start), point(g.mid), point(g.end), g.stroke?.width) : this.arcFromCenter(g);
        return arc ? [{ ...base, primitive: arc }] : [];
      }
      case "poly": return [{ ...base, primitive: this.poly(g) }];
      case "curve": return [{ ...base, primitive: this.curve(g) }];
      case "text":
      case "text_box": return [{ ...base, source: g.kind === "text_box" ? "text-box" : source, primitive: this.text(g) }];
      default: return [];
    }
  }

  private arcFromCenter(g: KicadFootprintArc): GeoArc | null {
    if (!g.center || g.angle === undefined) return null;
    const start = point(g.start);
    const center = point(g.center);
    const radius = Math.hypot(start.x - center.x, start.y - center.y);
    if (radius < GEOMETRY_EPSILON) return null;
    const sweep = g.angle * Math.PI / 180;
    const a0 = Math.atan2(start.y - center.y, start.x - center.x);
    const a1 = a0 + sweep;
    const end = { x: center.x + radius * Math.cos(a1), y: center.y + radius * Math.sin(a1) };
    const midA = a0 + sweep / 2;
    const mid = { x: center.x + radius * Math.cos(midA), y: center.y + radius * Math.sin(midA) };
    return { kind: "arc", start, mid, end, center, radius, sweepRadians: sweep, fill: (g as any).fill === "solid" || (g as any).fill === true, stroke: graphicStroke(g) };
  }

  line(g: KicadFootprintLine): GeoLine { return { kind:"line", start:point(g.start), end:point(g.end), stroke:graphicStroke(g) }; }
  rect(g: KicadFootprintRect): GeoRect { return { kind:"rect", start:point(g.start), end:point(g.end), radius:Math.max(0,g.radius ?? 0), rotation:0, fill:g.fill === "solid" || (g as any).fill === true, stroke:graphicStroke(g) }; }
  circle(g: KicadFootprintCircle): GeoCircle { return { kind:"circle", center:point(g.center), radius:Math.hypot(g.end.x-g.center.x,g.end.y-g.center.y), fill:g.fill === "solid" || (g as any).fill === true, stroke:graphicStroke(g) }; }
  poly(g: KicadFootprintPoly): GeoPolygon { return { kind:"polygon", points:g.points.map(point), fill:g.fill === "solid" || (g as any).fill === true, stroke:graphicStroke(g) }; }
  curve(g: KicadFootprintCurve): GeoBezier { return { kind:"bezier", points:g.points.map(point), stroke:graphicStroke(g) }; }

  text(g: KicadFootprintText): GeoText {
    return {
      kind:"text", text:g.text, position:point(g.position), size:{...g.size}, rotation:g.rotation ?? g.angle ?? 0,
      thickness:g.thickness ?? 0.15, anchor:textAnchor(g.justify), mirror:!!g.mirror, italic:!!g.italic,
      bold:!!g.bold, visible:g.visible !== false, boxEnd:g.end ? point(g.end) : undefined,
      boxPoints:g.boxPoints?.map(point), boxFill:g.kind === "text_box" && g.fill === "solid", boxAngle:g.angle,
      stroke:graphicStroke(g),
      role: g.role,
    };
  }

  ovalPad(sizeOrPad: {x:number;y:number} | { size?: {x:number;y:number} }): GeoCapsule {
    const size = ("size" in sizeOrPad && sizeOrPad.size) ? sizeOrPad.size : (sizeOrPad as {x:number;y:number});
    const w=Math.abs(size.x), h=Math.abs(size.y), radius=Math.min(w,h)/2;
    const halfStraight=Math.max(0,Math.max(w,h)/2-radius), horizontal=w>=h;
    return { kind:"capsule", start:horizontal?{x:-halfStraight,y:0}:{x:0,y:-halfStraight}, end:horizontal?{x:halfStraight,y:0}:{x:0,y:halfStraight}, radius, rotation:0, fill:true, stroke:{width:0} };
  }

  trapezoidPad(sizeOrPad: {x:number;y:number} | { size?: {x:number;y:number}; rectDelta?: KicadFootprintPoint }, delta?: KicadFootprintPoint): GeoPolygon {
    const size = ("size" in sizeOrPad && sizeOrPad.size) ? sizeOrPad.size : (sizeOrPad as {x:number;y:number});
    const d = delta ?? ("rectDelta" in sizeOrPad ? sizeOrPad.rectDelta : undefined);
    const dx=Math.abs(size.x)/2, dy=Math.abs(size.y)/2, ddx=(d?.x ?? 0)/2, ddy=(d?.y ?? 0)/2;
    return { kind:"polygon", points:[{x:-dx-ddy,y:dy+ddx},{x:dx+ddy,y:dy-ddx},{x:dx-ddy,y:-dy+ddx},{x:-dx+ddy,y:-dy-ddx}], fill:true, stroke:{width:0} };
  }

  roundRectPad(size: {x:number;y:number}, ratio=0.25): GeoRoundRect {
    const radius=effectiveRadius(size,ratio);
    return { kind:"roundrect", center:{x:0,y:0}, size:{x:Math.abs(size.x),y:Math.abs(size.y)}, rotation:0,
      radii:{topLeft:radius,topRight:radius,bottomRight:radius,bottomLeft:radius}, fill:true, stroke:{width:0} };
  }

  chamferedRectPad(size:{x:number;y:number}, chamferRatio=0, corners:string[]=[], roundRatio=0): GeoChamferRect {
    const sx=Math.abs(size.x), sy=Math.abs(size.y), min=Math.min(sx,sy);
    const ch=clamp(chamferRatio*min,0,min/2);
    const rr=effectiveRadius(size,roundRatio);
    const selected=new Set(corners);
    return { kind:"chamferrect", center:{x:0,y:0}, size:{x:sx,y:sy}, rotation:0,
      chamfers:{topLeft:selected.has("top_left")?ch:0,topRight:selected.has("top_right")?ch:0,bottomRight:selected.has("bottom_right")?ch:0,bottomLeft:selected.has("bottom_left")?ch:0},
      radii:{topLeft:selected.has("top_left")?0:rr,topRight:selected.has("top_right")?0:rr,bottomRight:selected.has("bottom_right")?0:rr,bottomLeft:selected.has("bottom_left")?0:rr}, fill:true, stroke:{width:0} };
  }

  padShape(pad: KicadFootprintPad, layer?: string): KicadGeometryPrimitive[] {
    const resolved = new KicadPadstackRuntime(pad).resolve(layer ?? (pad.layers[0] ?? "F.Cu"));
    const size=resolved.size;
    switch (resolved.shape) {
      case "circle": return [{kind:"circle",center:{x:0,y:0},radius:Math.min(Math.abs(size.x),Math.abs(size.y))/2,fill:true,stroke:{width:0}}];
      case "oval": return [this.ovalPad(size)];
      case "roundrect": return [this.roundRectPad(size,resolved.roundrectRatio)];
      case "trapezoid": return [this.trapezoidPad(size,resolved.rectDelta)];
      case "rect": return [{kind:"rect",start:{x:-size.x/2,y:-size.y/2},end:{x:size.x/2,y:size.y/2},radius:0,rotation:0,fill:true,stroke:{width:0}}];
      case "custom": return resolved.customGraphics.flatMap(g=>this.graphic(g,"custom-pad").map(x=>x.primitive));
      default: return [{kind:"rect",start:{x:-size.x/2,y:-size.y/2},end:{x:size.x/2,y:size.y/2},radius:0,rotation:0,fill:true,stroke:{width:0}}];
    }
  }

  padItems(pad: KicadFootprintPad, id: string): KicadGeometryItem[] {
    const stack=new KicadPadstackRuntime(pad);
    const layers=stack.layers().length ? stack.layers() : ["F.Cu"];
    const items:KicadGeometryItem[]=[];
    for(const layer of layers){
      const resolved=stack.resolve(layer);
      if(!resolved) continue;
      const rotatedOffset=resolved.offset ? rotatePoint(resolved.offset,resolved.rotation) : {x:0,y:0};
      const t:GeoTransform={position:{x:pad.position.x+rotatedOffset.x,y:pad.position.y+rotatedOffset.y},rotation:resolved.rotation,scaleX:1,scaleY:1,flipped:false};
      const primitives=this.padShape(pad,layer);
      primitives.forEach((primitive,index)=>items.push({primitive:this.transformPrimitive(primitive,t),layer,source:pad.shape === "custom"?"custom-pad":"pad",id:`${id}:${layer}:shape:${index}`,ownerId:id,selectable:true,metadata:{padNumber:pad.number,padType:pad.type}}));
    }
    if(pad.drillX || pad.drillY || pad.drill){
      const w=pad.drillX ?? pad.drill ?? 0, h=pad.drillY ?? pad.drill ?? w;
      items.push({primitive:{kind:"hole",center:{x:pad.position.x,y:pad.position.y},size:{x:w,y:h},rotation:pad.rotation,oval:Math.abs(w-h)>GEOMETRY_EPSILON},layer:"drill",source:"drill",id:`${id}:drill`,ownerId:id,selectable:true,metadata:{padNumber:pad.number}});
    }
    return items;
  }

  buildFootprint(graphics: KicadFootprintGraphic[] = [], pads: KicadFootprintPad[] = []): KicadGeometryItem[] {
    const result: KicadGeometryItem[] = [];
    (graphics || []).forEach((g, i) => result.push(...this.graphic(g, "graphic").map(item => ({ ...item, id: `graphic:${i}`, ownerId: `graphic:${i}` }))));
    (pads || []).forEach((p, i) => result.push(...this.padItems(p, `pad:${p.number}:${i}`)));

    // Synthesize missing standard layers (F.SilkS, F.Fab, F.CrtYd, Reference, Value) if not provided in the footprint
    if (pads && pads.length > 0) {
      // Calculate full component footprint bounding box across both pads and silkscreen/fab graphics
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      
      for (const p of pads) {
        const pw = Math.max(0.2, (p.size?.x ?? 1.0)) / 2;
        const ph = Math.max(0.2, (p.size?.y ?? 1.0)) / 2;
        minX = Math.min(minX, p.position.x - pw);
        maxX = Math.max(maxX, p.position.x + pw);
        minY = Math.min(minY, p.position.y - ph);
        maxY = Math.max(maxY, p.position.y + ph);
      }

      // Include all footprint graphic primitives (except text) so the courtyard surrounds the entire component body
      for (const g of result) {
        if (g.source === "graphic" && g.primitive.kind !== "text") {
          const pts = this.primitivePoints(g.primitive);
          for (const pt of pts) {
            minX = Math.min(minX, pt.x);
            maxX = Math.max(maxX, pt.x);
            minY = Math.min(minY, pt.y);
            maxY = Math.max(maxY, pt.y);
          }
        }
      }

      const hasSilkscreenGraphic = result.some(item => (item.layer === "F.SilkS" || item.layer === "silkscreen") && item.primitive.kind !== "text" && item.source !== "pad");
      const hasFabGraphic = result.some(item => (item.layer === "F.Fab" || item.layer === "top_fab") && item.primitive.kind !== "text" && item.source !== "pad");
      const hasCourtyard = result.some(item => (item.layer === "F.CrtYd" || item.layer === "top_courtyard") && item.source !== "pad");
      const hasReferenceText = result.some(item => item.primitive.kind === "text" && (item.primitive.role === "reference" || item.primitive.text?.includes("REF") || item.primitive.text === "%R"));
      const hasValueText = result.some(item => item.primitive.kind === "text" && (item.primitive.role === "value" || item.primitive.text?.includes("VAL") || item.primitive.text === "%V"));

      const compW = maxX - minX;
      const compH = maxY - minY;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      // 1. Synthesize F.Fab (Fabrication Nominal Outline) if missing
      if (!hasFabGraphic) {
        const fabMargin = Math.min(0.2, Math.min(compW, compH) * 0.15);
        const fx1 = minX - fabMargin;
        const fy1 = minY - fabMargin;
        const fx2 = maxX + fabMargin;
        const fy2 = maxY + fabMargin;
        const chamfer = Math.min(0.8, Math.min(compW, compH) * 0.25);
        
        // Chamfered top-left corner indicating Pin 1
        const fabPoints: GeoPoint[] = [
          { x: fx1 + chamfer, y: fy1 },
          { x: fx2, y: fy1 },
          { x: fx2, y: fy2 },
          { x: fx1, y: fy2 },
          { x: fx1, y: fy1 + chamfer },
        ];
        result.push({
          primitive: { kind: "polygon", points: fabPoints, fill: false, stroke: { width: 0.15 } },
          layer: "F.Fab",
          source: "graphic",
          id: "synth:fab:body",
          ownerId: "synth:fab",
          selectable: true,
        });
      }

      // 2. Synthesize F.SilkS (Silkscreen Visual Outline & Pin 1 indicator) if missing
      if (!hasSilkscreenGraphic) {
        const silkMargin = Math.min(0.35, Math.min(compW, compH) * 0.2);
        const sx1 = minX - silkMargin;
        const sy1 = minY - silkMargin;
        const sx2 = maxX + silkMargin;
        const sy2 = maxY + silkMargin;

        result.push({
          primitive: { kind: "rect", start: { x: sx1, y: sy1 }, end: { x: sx2, y: sy2 }, radius: 0.2, rotation: 0, fill: false, stroke: { width: 0.20 } },
          layer: "F.SilkS",
          source: "graphic",
          id: "synth:silk:outline",
          ownerId: "synth:silk",
          selectable: true,
        });
        // Pin 1 dot
        const p1DotR = Math.min(0.25, Math.max(0.12, Math.min(compW, compH) * 0.2));
        result.push({
          primitive: { kind: "circle", center: { x: sx1 - p1DotR * 1.5, y: minY }, radius: p1DotR, fill: true, stroke: { width: 0.15 } },
          layer: "F.SilkS",
          source: "graphic",
          id: "synth:silk:pin1",
          ownerId: "synth:silk",
          selectable: true,
        });
      }

      // 3. Synthesize F.CrtYd (Courtyard Keep-out Boundary with standard clearance) if missing
      const crtMargin = Math.min(0.5, Math.max(0.18, Math.min(compW, compH) * 0.28));
      if (!hasCourtyard) {
        const cx1 = minX - crtMargin;
        const cy1 = minY - crtMargin;
        const cx2 = maxX + crtMargin;
        const cy2 = maxY + crtMargin;

        result.push({
          primitive: { kind: "rect", start: { x: cx1, y: cy1 }, end: { x: cx2, y: cy2 }, radius: 0.2, rotation: 0, fill: false, stroke: { width: 0.15, type: "dash" } },
          layer: "F.CrtYd",
          source: "graphic",
          id: "synth:courtyard:boundary",
          ownerId: "synth:courtyard",
          selectable: true,
        });
      }

      // 4. Synthesize Reference Text on F.SilkS if missing
      const refFontSize = Math.max(0.45, Math.min(1.0, Math.max(compW, compH) * 0.65));
      const refYOffset = Math.max(0.55, refFontSize * 1.1 + crtMargin + 0.15);
      if (!hasReferenceText) {
        result.push({
          primitive: {
            kind: "text",
            text: "REF**",
            position: { x: cx, y: minY - refYOffset },
            size: { x: refFontSize, y: refFontSize },
            rotation: 0,
            thickness: 0.12,
            anchor: "middle",
            mirror: false,
            italic: false,
            bold: true,
            visible: true,
            stroke: { width: 0.12 },
            role: "reference",
          },
          layer: "F.SilkS",
          source: "graphic",
          id: "synth:text:ref",
          ownerId: "synth:ref",
          selectable: true,
        });
      }

      // 5. Synthesize Value Text on F.Fab if missing (hidden by default on SMD components per IPC)
      if (!hasValueText) {
        const valYOffset = Math.max(0.65, refFontSize * 1.1 + crtMargin + 0.2);
        result.push({
          primitive: {
            kind: "text",
            text: "VAL**",
            position: { x: cx, y: maxY + valYOffset },
            size: { x: refFontSize, y: refFontSize },
            rotation: 0,
            thickness: 0.12,
            anchor: "middle",
            mirror: false,
            italic: false,
            bold: false,
            visible: false,
            stroke: { width: 0.12 },
            role: "value",
          },
          layer: "F.Fab",
          source: "graphic",
          id: "synth:text:val",
          ownerId: "synth:val",
          selectable: true,
        });
      }

      // 6. Synthesize Negative Polarity Indicator on F.SilkS for polarized 2-pin components
      if (!hasSilkscreenGraphic && pads.length === 2) {
        const p2 = pads.find(p => String(p.number) === "2" || p.pinfunction === "-" || p.pinfunction === "K") || pads[1];
        if (p2) {
          const bw = Math.max(0.6, compW * 0.25);
          const bh = Math.max(1.0, compH * 0.85);
          result.push({
            primitive: {
              kind: "rect",
              start: { x: p2.position.x - bw / 2, y: p2.position.y - bh / 2 },
              end: { x: p2.position.x + bw / 2, y: p2.position.y + bh / 2 },
              radius: 0.1,
              rotation: 0,
              fill: true,
              stroke: { width: 0.15 },
            },
            layer: "F.SilkS",
            source: "graphic",
            id: "synth:bodyfill:neg",
            ownerId: "synth:bodyfill",
            selectable: true,
          });
        }
      }
    }

    return result;
  }

  transformed(items:KicadGeometryItem[],transform:GeoTransform):KicadGeometryItem[]{return items.map(item=>({...item,primitive:this.transformPrimitive(item.primitive,transform)}));}

  transformPrimitive(p:KicadGeometryPrimitive,t:GeoTransform):KicadGeometryPrimitive{
    const tp=(q:GeoPoint)=>transformPoint(q,t);
    switch(p.kind){
      case "line": return {...p,start:tp(p.start),end:tp(p.end)};
      case "rect": {
        const corners=[{x:p.start.x,y:p.start.y},{x:p.end.x,y:p.start.y},{x:p.end.x,y:p.end.y},{x:p.start.x,y:p.end.y}].map(tp);
        const uniform=Math.abs(Math.abs(t.scaleX)-Math.abs(t.scaleY))<GEOMETRY_EPSILON;
        const totalRot = (t.flipped ? -p.rotation : p.rotation) + t.rotation;
        if(uniform && Math.abs(totalRot % 360) < GEOMETRY_EPSILON){
          const c=tp({x:(p.start.x+p.end.x)/2,y:(p.start.y+p.end.y)/2}),s=Math.abs(t.scaleX);
          return {...p,start:{x:c.x-Math.abs(p.end.x-p.start.x)*s/2,y:c.y-Math.abs(p.end.y-p.start.y)*s/2},end:{x:c.x+Math.abs(p.end.x-p.start.x)*s/2,y:c.y+Math.abs(p.end.y-p.start.y)*s/2},radius:p.radius*s,rotation:0};
        }
        return {kind:"polygon",points:corners,fill:p.fill,stroke:p.stroke};
      }
      case "roundrect": return {...p,center:tp(p.center),size:{x:Math.abs(p.size.x*t.scaleX),y:Math.abs(p.size.y*t.scaleY)},rotation:(t.flipped?-p.rotation:p.rotation)+t.rotation,radii:{topLeft:p.radii.topLeft*Math.max(Math.abs(t.scaleX),Math.abs(t.scaleY)),topRight:p.radii.topRight*Math.max(Math.abs(t.scaleX),Math.abs(t.scaleY)),bottomRight:p.radii.bottomRight*Math.max(Math.abs(t.scaleX),Math.abs(t.scaleY)),bottomLeft:p.radii.bottomLeft*Math.max(Math.abs(t.scaleX),Math.abs(t.scaleY))}};
      case "chamferrect": return {...p,center:tp(p.center),size:{x:Math.abs(p.size.x*t.scaleX),y:Math.abs(p.size.y*t.scaleY)},rotation:(t.flipped?-p.rotation:p.rotation)+t.rotation};
      case "circle": {const c=tp(p.center),rx=Math.abs(p.radius*t.scaleX),ry=Math.abs(p.radius*t.scaleY);if(Math.abs(rx-ry)<GEOMETRY_EPSILON)return {...p,center:c,radius:rx};return {kind:"polygon",points:this.sampleEllipse(p.center,p.radius,t,96),fill:p.fill,stroke:p.stroke};}
      case "arc": {const start=tp(p.start),mid=tp(p.mid),end=tp(p.end);const arc=arcFromThreePoints(start,mid,end,p.stroke.width);return arc ?? {...p,start,mid,end,center:tp(p.center),radius:p.radius*Math.max(Math.abs(t.scaleX),Math.abs(t.scaleY)),sweepRadians:t.flipped?-p.sweepRadians:p.sweepRadians};}
      case "polygon": return {...p,points:p.points.map(tp)};
      case "bezier": return {...p,points:p.points.map(tp)};
      case "text": return {...p,position:tp(p.position),boxEnd:p.boxEnd?tp(p.boxEnd):undefined,boxPoints:p.boxPoints?.map(tp),rotation:(t.flipped?-p.rotation:p.rotation)+t.rotation,boxAngle:p.boxAngle===undefined?undefined:(t.flipped?-p.boxAngle:p.boxAngle)+t.rotation,mirror:t.flipped?!p.mirror:p.mirror};
      case "capsule": return {...p,start:tp(p.start),end:tp(p.end),radius:p.radius*Math.max(Math.abs(t.scaleX),Math.abs(t.scaleY)),rotation:(t.flipped?-p.rotation:p.rotation)+t.rotation};
      case "hole": return {...p,center:tp(p.center),size:{x:Math.abs(p.size.x*t.scaleX),y:Math.abs(p.size.y*t.scaleY)},rotation:(t.flipped?-p.rotation:p.rotation)+t.rotation};
    }
  }

  bounds(items:KicadGeometryItem[]):KicadGeometryBounds{
    const pts=items.flatMap(i=>this.primitivePoints(i.primitive));
    if(!pts.length)return{minX:-1,minY:-1,maxX:1,maxY:1};
    return{minX:Math.min(...pts.map(p=>p.x)),minY:Math.min(...pts.map(p=>p.y)),maxX:Math.max(...pts.map(p=>p.x)),maxY:Math.max(...pts.map(p=>p.y))};
  }

  primitivePoints(p:KicadGeometryPrimitive):GeoPoint[]{
    switch(p.kind){
      case "line":return[p.start,p.end];
      case "rect":return[p.start,p.end,{x:p.start.x,y:p.end.y},{x:p.end.x,y:p.start.y}];
      case "roundrect":case "chamferrect":{const hx=p.size.x/2,hy=p.size.y/2;return[{x:p.center.x-hx,y:p.center.y-hy},{x:p.center.x+hx,y:p.center.y+hy},{x:p.center.x-hx,y:p.center.y+hy},{x:p.center.x+hx,y:p.center.y-hy}].map(q=>rotatePoint(q,p.rotation));}
      case "circle":return[{x:p.center.x-p.radius,y:p.center.y},{x:p.center.x+p.radius,y:p.center.y},{x:p.center.x,y:p.center.y-p.radius},{x:p.center.x,y:p.center.y+p.radius}];
      case "arc":return this.arcBoundsPoints(p);
      case "polygon":return p.points;
      case "bezier":return p.points;
      case "text": {
        const textStr = p.text || "";
        const charCount = Math.max(1, textStr.length);
        const sizeX = p.size?.x || 0.8;
        const sizeY = p.size?.y || 0.8;
        const approxWidth = Math.max(sizeX, charCount * sizeX * 0.65);
        const approxHeight = Math.max(0.3, sizeY);

        let left = -approxWidth / 2;
        let right = approxWidth / 2;
        if (p.anchor === "start") {
          left = 0;
          right = approxWidth;
        } else if (p.anchor === "end") {
          left = -approxWidth;
          right = 0;
        }
        const top = -approxHeight * 0.85;
        const bottom = approxHeight * 0.25;

        const textCorners = [
          { x: left, y: top },
          { x: right, y: top },
          { x: right, y: bottom },
          { x: left, y: bottom },
        ].map((pt) => {
          const rot = rotatePoint(pt, p.rotation || 0);
          return { x: rot.x + p.position.x, y: rot.y + p.position.y };
        });

        return [
          p.position,
          ...textCorners,
          ...(p.boxEnd ? [p.boxEnd] : []),
          ...(p.boxPoints ?? []),
        ];
      }
      case "capsule":return[{x:Math.min(p.start.x,p.end.x)-p.radius,y:Math.min(p.start.y,p.end.y)-p.radius},{x:Math.max(p.start.x,p.end.x)+p.radius,y:Math.max(p.start.y,p.end.y)+p.radius}];
      case "hole":return[{x:p.center.x-p.size.x/2,y:p.center.y-p.size.y/2},{x:p.center.x+p.size.x/2,y:p.center.y+p.size.y/2}];
    }
  }

  private arcBoundsPoints(a:GeoArc):GeoPoint[]{const pts=[a.start,a.end,a.mid];const s=Math.atan2(a.start.y-a.center.y,a.start.x-a.center.x);for(const ang of[0,Math.PI/2,Math.PI,Math.PI*1.5])if(this.angleOnArc(ang,s,a.sweepRadians))pts.push({x:a.center.x+a.radius*Math.cos(ang),y:a.center.y+a.radius*Math.sin(ang)});return pts;}
  private angleOnArc(angle:number,start:number,sweep:number){const eps=1e-9;if(Math.abs(sweep)>=Math.PI*2-eps)return true;if(sweep>=0)return normalizeRadians(angle-start)<=sweep+eps;return normalizeRadians(start-angle)<=-sweep+eps;}

  hitTestPoint(items:KicadGeometryItem[],point:GeoPoint,tolerance=HIT_TOLERANCE_MM):KicadHitResult{
    let best:KicadHitResult={hit:false,distance:Number.POSITIVE_INFINITY};
    for(const item of items){if(item.selectable===false)continue;const d=this.distanceToPrimitive(item.primitive,point);if(d<=tolerance&&d<best.distance)best={hit:true,distance:d,item,kind:item.primitive.kind};}
    return best;
  }

  selectAtPoint(items:KicadGeometryItem[],point:GeoPoint,tolerance=HIT_TOLERANCE_MM):KicadGeometryItem[]{return items.filter(i=>i.selectable!==false&&this.distanceToPrimitive(i.primitive,point)<=tolerance);}

  selectInRect(items:KicadGeometryItem[],rect:KicadGeometryBounds,contained=false):KicadGeometryItem[]{return items.filter(i=>{const b=this.bounds([{...i}]);return contained?(b.minX>=rect.minX&&b.maxX<=rect.maxX&&b.minY>=rect.minY&&b.maxY<=rect.maxY):(b.maxX>=rect.minX&&b.minX<=rect.maxX&&b.maxY>=rect.minY&&b.minY<=rect.maxY);});}

  private distanceToPrimitive(p:KicadGeometryPrimitive,q:GeoPoint):number{
    switch(p.kind){
      case "line":return this.pointSegmentDistance(q,p.start,p.end);
      case "rect":return this.distanceToRect(q,p.start,p.end,p.rotation,p.radius);
      case "roundrect":return this.distanceToRoundRect(q,p);
      case "chamferrect":return this.distanceToChamferRect(q,p);
      case "circle": { const d=Math.hypot(q.x-p.center.x,q.y-p.center.y); return d<=p.radius?0:d-p.radius; }
      case "arc":return this.distanceToArc(q,p);
      case "polygon":return pointInPolygon(q,p.points)?0:this.distanceToPolyline(q,[...p.points,p.points[0]]);
      case "bezier":return this.distanceToPolyline(q,this.sampleBezier(p.points,32));
      case "capsule":return Math.max(0,this.pointSegmentDistance(q,p.start,p.end)-p.radius);
      case "hole":return this.distanceToEllipse(q,p.center,p.size,p.rotation);
      case "text":return this.distanceToText(q,p);
    }
  }

  private distanceToRect(q:GeoPoint,start:GeoPoint,end:GeoPoint,rotation:number,radius:number){const c={x:(start.x+end.x)/2,y:(start.y+end.y)/2};const local=rotatePoint({x:q.x-c.x,y:q.y-c.y},-rotation);const hx=Math.abs(end.x-start.x)/2,hy=Math.abs(end.y-start.y)/2;const ax=Math.abs(local.x),ay=Math.abs(local.y);if(ax<=hx&&ay<=hy)return 0;const dx=Math.max(ax-hx,0),dy=Math.max(ay-hy,0);return Math.hypot(dx,dy);}
  private distanceToRoundRect(q:GeoPoint,p:GeoRoundRect){const local=rotatePoint({x:q.x-p.center.x,y:q.y-p.center.y},-p.rotation),hx=p.size.x/2,hy=p.size.y/2;if(Math.abs(local.x)<=hx&&Math.abs(local.y)<=hy){const r=local.x<0?(local.y<0?p.radii.topLeft:p.radii.bottomLeft):(local.y<0?p.radii.topRight:p.radii.bottomRight);const nearX=hx-Math.abs(local.x),nearY=hy-Math.abs(local.y);if(nearX>=r||nearY>=r)return 0;const cx=Math.sign(local.x||1)*(hx-r),cy=Math.sign(local.y||1)*(hy-r);return Math.max(0,Math.hypot(local.x-cx,local.y-cy)-r);}const dx=Math.max(Math.abs(local.x)-hx,0),dy=Math.max(Math.abs(local.y)-hy,0);return Math.hypot(dx,dy);}
  private distanceToChamferRect(q:GeoPoint,p:GeoChamferRect){const local=rotatePoint({x:q.x-p.center.x,y:q.y-p.center.y},-p.rotation),hx=p.size.x/2,hy=p.size.y/2;const x=Math.abs(local.x),y=Math.abs(local.y);const corner=(x>hx||y>hy)?Math.hypot(Math.max(0,x-hx),Math.max(0,y-hy)):0;return corner;}
  private distanceToArc(q:GeoPoint,a:GeoArc){const r=Math.hypot(q.x-a.center.x,q.y-a.center.y),ang=Math.atan2(q.y-a.center.y,q.x-a.center.x),start=Math.atan2(a.start.y-a.center.y,a.start.x-a.center.x);if(this.angleOnArc(ang,start,a.sweepRadians))return Math.abs(r-a.radius);return Math.min(Math.hypot(q.x-a.start.x,q.y-a.start.y),Math.hypot(q.x-a.end.x,q.y-a.end.y));}
  private distanceToEllipse(q:GeoPoint,c:GeoPoint,size:{x:number;y:number},rotation:number){const l=rotatePoint({x:q.x-c.x,y:q.y-c.y},-rotation);const rx=Math.max(size.x/2,GEOMETRY_EPSILON),ry=Math.max(size.y/2,GEOMETRY_EPSILON);const n=Math.sqrt((l.x*l.x)/(rx*rx)+(l.y*l.y)/(ry*ry));if(n<=1)return 0;return Math.min(Math.abs(Math.hypot(l.x,l.y)-Math.min(rx,ry)),Math.abs(n-1)*Math.min(rx,ry));}
  private distanceToText(q:GeoPoint,p:GeoText){if(p.boxPoints?.length===4)return pointInPolygon(q,p.boxPoints)?0:this.distanceToPolyline(q,[...p.boxPoints,p.boxPoints[0]]);const width=Math.max(p.size.x,p.text.length*p.size.x*0.6);const h=Math.max(p.size.y,0.2);const l=rotatePoint({x:q.x-p.position.x,y:q.y-p.position.y},-p.rotation);return Math.max(Math.abs(l.x)-width/2,Math.abs(l.y)-h/2,0);}
  private pointSegmentDistance(p:GeoPoint,a:GeoPoint,b:GeoPoint){const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;if(l2<GEOMETRY_EPSILON)return Math.hypot(p.x-a.x,p.y-a.y);const t=clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/l2,0,1);return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy));}
  private distanceToPolyline(p:GeoPoint,pts:GeoPoint[]){let d=Number.POSITIVE_INFINITY;for(let i=1;i<pts.length;i++)d=Math.min(d,this.pointSegmentDistance(p,pts[i-1],pts[i]));return d;}
  private sampleBezier(pts:GeoPoint[],n:number){if(pts.length<2)return pts;const out:GeoPoint[]=[];for(let i=0;i<=n;i++){const t=i/n;let x=0,y=0;const m=pts.length-1;for(let k=0;k<=m;k++){let b=1;for(let j=0;j<k;j++)b*= (m-j)/(j+1);b*=Math.pow(t,k)*Math.pow(1-t,m-k);x+=b*pts[k].x;y+=b*pts[k].y;}out.push({x,y});}return out;}
  private sampleEllipse(center:GeoPoint,r:number,t:GeoTransform,n:number){const out:GeoPoint[]=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2;out.push(transformPoint({x:center.x+r*Math.cos(a),y:center.y+r*Math.sin(a)},t));}return out;}
}

function pointInPolygon(p:GeoPoint,poly:GeoPoint[]){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const xi=poly[i].x,yi=poly[i].y,xj=poly[j].x,yj=poly[j].y;const intersect=((yi>p.y)!==(yj>p.y))&&(p.x<(xj-xi)*(p.y-yi)/(yj-yi+GEOMETRY_EPSILON)+xi);if(intersect)inside=!inside;}return inside;}

export const kicadGeometryEngine=new KicadGeometryEngine();
