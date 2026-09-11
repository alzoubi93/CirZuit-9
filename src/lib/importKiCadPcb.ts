import { PcbDoc, PcbTrack, PcbVia, PcbPad, PcbFootprint, PcbFootprintPad, PcbText, PcbZone, PcbZonePoint, PcbZonePolygon, PcbZoneFilledPolygon, PcbZoneFillSettings, PcbZoneKeepoutSettings, PcbLayerId, PcbLayer, DEFAULT_LAYERS, getCopperLayerStandardColor } from "./pcb";
import { SchematicDoc } from "./schematic";
import { KicadFootprintModel } from "./kicad/footprint/kicadFootprint";
import { registerKicadFootprint } from "./kicad/footprint/kicadFootprintStore";
import { footprintToPcbFootprint } from "./kicad/footprint/kicadFootprint";

// ==========================================
// Helpers for Geometry Interpolation

function bezierToPolyline(p1: {x: number, y: number}, p2: {x: number, y: number}, p3: {x: number, y: number}, p4: {x: number, y: number}, segments = 16): {x: number, y: number}[] {
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const x = mt*mt*mt*p1.x + 3*mt*mt*t*p2.x + 3*mt*t*t*p3.x + t*t*t*p4.x;
    const y = mt*mt*mt*p1.y + 3*mt*mt*t*p2.y + 3*mt*t*t*p3.y + t*t*t*p4.y;
    pts.push({x, y});
  }
  return pts;
}

// ==========================================

function arcToPolyline(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, segments = 16): {x: number, y: number}[] {
  const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
  if (Math.abs(D) < 1e-6) {
    return [{x: x1, y: y1}, {x: x3, y: y3}];
  }
  const Ux = ((x1 * x1 + y1 * y1) * (y2 - y3) + (x2 * x2 + y2 * y2) * (y3 - y1) + (x3 * x3 + y3 * y3) * (y1 - y2)) / D;
  const Uy = ((x1 * x1 + y1 * y1) * (x3 - x2) + (x2 * x2 + y2 * y2) * (x1 - x3) + (x3 * x3 + y3 * y3) * (x2 - x1)) / D;
  
  const r = Math.hypot(x1 - Ux, y1 - Uy);
  
  let a1 = Math.atan2(y1 - Uy, x1 - Ux);
  const a2 = Math.atan2(y2 - Uy, x2 - Ux);
  let a3 = Math.atan2(y3 - Uy, x3 - Ux);
  
  const norm = (a: number) => (a % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  a1 = norm(a1);
  const a2n = norm(a2);
  a3 = norm(a3);
  
  let isCCW = false;
  const sweep12 = norm(a2n - a1);
  const sweep13 = norm(a3 - a1);
  if (sweep12 < sweep13) {
    isCCW = true;
  }
  
  let sweep = a3 - a1;
  if (isCCW && sweep < 0) sweep += 2 * Math.PI;
  if (!isCCW && sweep > 0) sweep -= 2 * Math.PI;
  
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = a1 + sweep * t;
    pts.push({ x: Ux + r * Math.cos(a), y: Uy + r * Math.sin(a) });
  }
  return pts;
}

function circleToPolyline(cx: number, cy: number, ex: number, ey: number, segments = 32): {x: number, y: number}[] {
  const r = Math.hypot(ex - cx, ey - cy);
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * 2 * Math.PI;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

function centerArcToPolyline(cx: number, cy: number, sx: number, sy: number, angleDeg: number, segments = 16): {x: number, y: number}[] {
  const r = Math.hypot(sx - cx, sy - cy);
  const startAngle = Math.atan2(sy - cy, sx - cx);
  const sweep = (angleDeg * Math.PI) / 180;
  
  const pts = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + sweep * t;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

// ==========================================
// S-Expression Tokenizer and Parser
// ==========================================

interface SExprToken {
  type: "paren" | "string" | "atom";
  value: string;
}

function tokenizeSExpr(text: string): SExprToken[] {
  const tokens: SExprToken[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
    } else if (ch === '"') {
      let str = "";
      i++;
      while (i < text.length) {
        if (text[i] === "\\" && i + 1 < text.length) {
          str += text[i + 1];
          i += 2;
        } else if (text[i] === '"') {
          i++;
          break;
        } else {
          str += text[i];
          i++;
        }
      }
      tokens.push({ type: "string", value: str });
    } else if (/\s/.test(ch)) {
      i++;
    } else if (ch === "#") {
      // Line comment in some files
      while (i < text.length && text[i] !== "\n") i++;
    } else {
      let atom = "";
      while (i < text.length && !/\s|\(|\)|"/.test(text[i])) {
        atom += text[i];
        i++;
      }
      if (atom) {
        tokens.push({ type: "atom", value: atom });
      }
    }
  }
  return tokens;
}

type SExprAST = Array<string | SExprAST>;

function parseSExprAST(tokens: SExprToken[]): SExprAST {
  let index = 0;
  while (index < tokens.length && (tokens[index].type !== "paren" || tokens[index].value !== "(")) index++;
  function parseNode(): SExprAST {
    const list: SExprAST = [];
    if (index >= tokens.length || (tokens[index].type !== "paren" || tokens[index].value !== "(")) return list;
    index++; // skip '('
    while (index < tokens.length) {
      const tok = tokens[index];
      if (tok.type === "paren" && tok.value === ")") {
        index++; // skip ')'
        break;
      }
      if (tok.type === "paren" && tok.value === "(") {
        list.push(parseNode());
      } else {
        list.push(tok.value);
        index++;
      }
    }
    return list;
  }

  const root: SExprAST = [];
  while (index < tokens.length) {
    if (tokens[index].value === "(") {
      root.push(parseNode());
    } else {
      index++;
    }
  }
  return root;
}

// Layer mapping from KiCad PCB layer names to PcbLayerId preserving full multilayer copper stack
export function mapKiCadPcbLayer(layerName: string): PcbLayerId {
  if (!layerName) return "top_copper";
  const raw = String(layerName).trim();

  // 1. Exact match for Inner copper layers: In1.Cu, In2.Cu, ..., In30.Cu
  const inMatch = raw.match(/^in(\d+)\.cu$/i);
  if (inMatch) {
    const num = inMatch[1];
    return `In${num}.Cu` as PcbLayerId;
  }

  // 2. Cleaned normalized token
  const l = raw.toLowerCase().replace(/[^a-z0-9.]/g, "");
  if (l === "f.cu" || l === "top" || l === "f_cu" || l === "top_copper") return "top_copper";
  if (l === "b.cu" || l === "bottom" || l === "bot" || l === "b_cu" || l === "bottom_copper") return "bottom_copper";
  if (l === "f.silks" || l === "f.silk" || l === "silkscreen.top" || l === "silkscreen" || l === "top_silkscreen") return "silkscreen";
  if (l === "b.silks" || l === "b.silk" || l === "silkscreen.bot" || l === "bottom_silkscreen") return "bottom_silkscreen";
  if (l === "f.mask" || l === "soldermask.top" || l === "solder_mask" || l === "top_solder_mask") return "solder_mask";
  if (l === "b.mask" || l === "soldermask.bot" || l === "bottom_solder_mask") return "bottom_solder_mask";
  if (l === "edge.cuts" || l === "edgecuts" || l === "outline" || l === "margin") return "outline";
  if (l === "drill" || l === "hole") return "drill";
  if (l === "f.crtyd" || l === "f_crtyd") return "F.CrtYd";
  if (l === "b.crtyd" || l === "b_crtyd") return "B.CrtYd";
  if (l === "f.fab" || l === "f_fab") return "F.Fab";
  if (l === "b.fab" || l === "b_fab") return "B.Fab";
  if (l === "f.paste" || l === "f_paste") return "F.Paste";
  if (l === "b.paste" || l === "b_paste") return "B.Paste";
  if (l === "dwgs.user" || l === "user.drawings") return "Dwgs.User";
  if (l === "cmts.user" || l === "user.comments") return "Cmts.User";
  if (l === "eco1.user" || l === "user.eco1") return "Eco1.User";
  if (l === "eco2.user" || l === "user.eco2") return "Eco2.User";

  // Inner copper with alternate spelling (e.g. inner1, in1, etc.)
  const innerNum = l.match(/^in(?:ner)?(\d+)(?:\.cu)?$/i);
  if (innerNum) {
    return `In${innerNum[1]}.Cu` as PcbLayerId;
  }

  // Preserve raw layer token if it has a valid name or prefix
  if (raw.endsWith(".Cu") || raw.startsWith("F.") || raw.startsWith("B.") || raw.startsWith("User.")) {
    return raw as PcbLayerId;
  }

  return raw as PcbLayerId;
}

export function isKiCadPcbContent(text: string): boolean {
  if (!text) return false;
  return text.includes("(kicad_pcb") || text.includes("kicad_pcb");
}

/**
 * Main parser for KiCad PCB (.kicad_pcb)
 */
export function parseKiCadPcb(
  fileContent: string,
  filename: string = "kicad_pcb_board",
  lang: "ar" | "en" = "en"
): { doc: SchematicDoc; name: string } {
  const tracks: PcbTrack[] = [];
  const vias: PcbVia[] = [];
  const pads: PcbPad[] = [];
  const zones: PcbZone[] = [];
  const footprints: PcbFootprint[] = [];
  const texts: PcbText[] = [];
  const graphics: import("./pcb").PcbGraphic[] = [];
  const dimensions: import("./pcb").PcbDimension[] = [];
  const targets: import("./pcb").PcbTarget[] = [];
  const groups: import("./pcb").PcbGroup[] = [];
  
  const kicadNets = new Map<number, string>();
  const docNets: import("./pcb").PcbNet[] = [];
  let parsedBoardLayers: PcbLayer[] | null = null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  function registerPoint(x: number, y: number) {
    if (isNaN(x) || isNaN(y)) return;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }

  try {
    const tokens = tokenizeSExpr(fileContent);
    const ast = parseSExprAST(tokens);

    // Find main (kicad_pcb ...) root node
    let mainNode: SExprAST | null = null;
    for (const item of ast) {
      if (Array.isArray(item) && item[0] === "kicad_pcb") {
        mainNode = item;
        break;
      }
    }

    const rootList = mainNode || ast;

    for (const node of rootList) {
      if (!Array.isArray(node)) continue;
      const head = node[0];

      // Parse Board Layer Stack (layers (0 "F.Cu" signal) (1 "In1.Cu" power "GND") ...)
      if (head === "layers") {
        const dynamicLayers: PcbLayer[] = [];
        for (let idx = 1; idx < node.length; idx++) {
          const layerDef = node[idx];
          if (!Array.isArray(layerDef)) continue;
          const ordinal = parseInt(layerDef[0] as string, 10);
          const layerName = layerDef[1] as string;
          const layerType = layerDef[2] as string;
          const layerUserName = (layerDef[3] as string) || undefined;

          if (layerName) {
            const canonicalId = mapKiCadPcbLayer(layerName);
            let displayName = layerUserName || layerName;
            let color = getCopperLayerStandardColor(canonicalId) || "#3b82f6";
            
            if (canonicalId === "top_copper" || canonicalId === "F.Cu") {
              displayName = layerUserName ? `Top Copper (${layerUserName})` : "Top Copper (F.Cu)";
              color = "#ef4444";
            } else if (canonicalId === "bottom_copper" || canonicalId === "B.Cu") {
              displayName = layerUserName ? `Bottom Copper (${layerUserName})` : "Bottom Copper (B.Cu)";
              color = "#3b82f6";
            } else if (/^in(\d+)\.cu$/i.test(canonicalId)) {
              const inNum = canonicalId.match(/^in(\d+)\.cu$/i)![1];
              displayName = layerUserName ? `Inner Copper ${inNum} (${layerUserName})` : `Inner Copper ${inNum} (${canonicalId})`;
            } else if (canonicalId === "outline") {
              displayName = "Board Outline (Edge.Cuts)";
              color = "#eab308";
            } else if (canonicalId === "silkscreen") {
              displayName = "Top Silkscreen (F.SilkS)";
              color = "#fde047";
            } else if (canonicalId === "bottom_silkscreen") {
              displayName = "Bottom Silkscreen (B.SilkS)";
              color = "#fde047";
            } else if (canonicalId === "solder_mask") {
              displayName = "Top Solder Mask (F.Mask)";
              color = "#10b98180";
            } else if (canonicalId === "bottom_solder_mask") {
              displayName = "Bottom Solder Mask (B.Mask)";
              color = "#04785780";
            } else if (canonicalId === "F.CrtYd") {
              displayName = "Top Courtyard (F.CrtYd)";
              color = "#c084fc";
            } else if (canonicalId === "B.CrtYd") {
              displayName = "Bottom Courtyard (B.CrtYd)";
              color = "#a855f7";
            } else if (canonicalId === "F.Fab") {
              displayName = "Top Fab (F.Fab)";
              color = "#60a5fa";
            } else if (canonicalId === "B.Fab") {
              displayName = "Bottom Fab (B.Fab)";
              color = "#3b82f6";
            }

            dynamicLayers.push({
              id: canonicalId,
              name: displayName,
              color,
              visible: true,
              type: layerType as any,
              userName: layerUserName,
              ordinal: isNaN(ordinal) ? undefined : ordinal,
            });
          }
        }

        if (dynamicLayers.length > 0) {
          if (!dynamicLayers.some(l => l.id === "outline")) {
            dynamicLayers.unshift({ id: "outline", name: "Board Outline (Edge.Cuts)", color: "#eab308", visible: true, ordinal: 44 });
          }
          if (!dynamicLayers.some(l => l.id === "drill")) {
            dynamicLayers.push({ id: "drill", name: "Drill Holes", color: "#000000", visible: true });
          }
          if (!dynamicLayers.some(l => l.id === "multi_layer")) {
            dynamicLayers.push({ id: "multi_layer", name: "Multi Layer (*.Cu)", color: "#ef4444", visible: true });
          }
          parsedBoardLayers = dynamicLayers;
        }
      }
      
      if (head === "net") {
        const netId = parseInt(node[1] as string, 10);
        const netName = typeof node[2] === "string" ? node[2] : "";
        if (!isNaN(netId)) {
          kicadNets.set(netId, netName);
          docNets.push({
            id: netId,
            key: netName || (netId === 0 ? "" : `net-${netId}`),
            name: netName || (netId === 0 ? "" : `Net ${netId}`),
            members: [],
            source: "imported",
          });
        }
      }

      // 1. Tracks / Segments: (segment (start X Y) (end X Y) (width W) (layer L) (net N) (tstamp T) (locked))
      if (head === "segment") {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0, width = 0.25;
        let layer: PcbLayerId = "top_copper";
        let netId: number | undefined;
        let tstamp: string | undefined;
        let locked = false;

        for (const sub of node) {
          if (!Array.isArray(sub)) {
            if (sub === "locked") locked = true;
            continue;
          }
          if (sub[0] === "start") {
            x1 = parseFloat(sub[1] as string) || 0;
            y1 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "end") {
            x2 = parseFloat(sub[1] as string) || 0;
            y2 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "width") {
            width = parseFloat(sub[1] as string) || 0.25;
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (sub[0] === "net") {
            netId = parseInt(sub[1] as string, 10);
          } else if (sub[0] === "tstamp") {
            tstamp = sub[1] as string;
          }
        }

        registerPoint(x1, y1);
        registerPoint(x2, y2);

        tracks.push({
          id: `track-kicad-${Math.random().toString(36).substring(2, 9)}`,
          kind: "segment",
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          layer,
          width,
          points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
          netId,
          tstamp,
          locked,
        });
      }

      // 2. Arcs: (arc (start X Y) (mid X Y) (end X Y) (width W) (layer L) (net N) (tstamp T) (locked))
      else if (head === "arc") {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0, width = 0.25;
        let layer: PcbLayerId = "top_copper";
        let hasMid = false;
        let angle = 0;
        let hasAngle = false;
        let netId: number | undefined;
        let tstamp: string | undefined;
        let locked = false;

        for (const sub of node) {
          if (!Array.isArray(sub)) {
            if (sub === "locked") locked = true;
            continue;
          }
          if (sub[0] === "start") {
            x1 = parseFloat(sub[1] as string) || 0;
            y1 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "mid") {
            x3 = parseFloat(sub[1] as string) || 0;
            y3 = parseFloat(sub[2] as string) || 0;
            hasMid = true;
          } else if (sub[0] === "end") {
            x2 = parseFloat(sub[1] as string) || 0;
            y2 = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "angle") {
            angle = parseFloat(sub[1] as string) || 0;
            hasAngle = true;
          } else if (sub[0] === "width") {
            width = parseFloat(sub[1] as string) || 0.25;
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (sub[0] === "net") {
            netId = parseInt(sub[1] as string, 10);
          } else if (sub[0] === "tstamp") {
            tstamp = sub[1] as string;
          }
        }

        let pts: {x: number, y: number}[] = [];
        if (hasMid) {
          pts = arcToPolyline(x1, y1, x3, y3, x2, y2);
          pts.forEach(p => registerPoint(p.x, p.y));
        } else if (hasAngle) {
          pts = centerArcToPolyline(x1, y1, x2, y2, angle);
          pts.forEach(p => registerPoint(p.x, p.y));
        } else {
          registerPoint(x1, y1);
          registerPoint(x2, y2);
          pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        }

        tracks.push({
          id: `track-arc-kicad-${Math.random().toString(36).substring(2, 9)}`,
          kind: "arc",
          start: { x: x1, y: y1 },
          end: { x: x2, y: y2 },
          mid: hasMid ? { x: x3, y: y3 } : undefined,
          center: hasAngle ? { x: x1, y: y1 } : undefined,
          angle: hasAngle ? angle : undefined,
          layer,
          width,
          points: pts,
          netId,
          tstamp,
          locked,
        });
      }

      // 3. Vias: (via (type T) (at X Y) (size S) (drill D) (layers L1 L2) (remove_unused_layers) (keep_end_layers) (free) (net N) (tstamp T) (status ST) (locked))
      else if (head === "via") {
        let vx = 0, vy = 0, size = 0.8, drill = 0.4;
        let netId: number | undefined;
        let viaLayers: [PcbLayerId, PcbLayerId] | undefined;
        let viaType: import("@/lib/pcb").PcbViaType | undefined;
        let removeUnusedLayers = false;
        let keepEndLayers = true;
        let free = false;
        let drillOffset: { x: number; y: number } | undefined;
        let status: number | string | undefined;
        let tstamp: string | undefined;
        let locked = false;

        for (const sub of node) {
          if (!Array.isArray(sub)) {
            if (sub === "locked") locked = true;
            else if (sub === "remove_unused_layers") removeUnusedLayers = true;
            else if (sub === "keep_end_layers") keepEndLayers = true;
            else if (sub === "free") free = true;
            else if (sub === "blind" || sub === "blind_buried") viaType = "blind";
            else if (sub === "micro" || sub === "microvia") viaType = "micro";
            else if (sub === "through" || sub === "thru") viaType = "through";
            continue;
          }
          if (sub[0] === "at") {
            vx = parseFloat(sub[1] as string) || 0;
            vy = parseFloat(sub[2] as string) || 0;
          } else if (sub[0] === "size") {
            size = parseFloat(sub[1] as string) || 0.8;
          } else if (sub[0] === "drill") {
            if (typeof sub[1] === "string" || typeof sub[1] === "number") {
              drill = parseFloat(sub[1] as string) || size * 0.5;
            }
            // Check for offset inside drill: (drill 0.3 (offset 0.05 0.05))
            for (const dSub of sub) {
              if (Array.isArray(dSub) && dSub[0] === "offset") {
                drillOffset = {
                  x: parseFloat(dSub[1] as string) || 0,
                  y: parseFloat(dSub[2] as string) || 0,
                };
              }
            }
          } else if (sub[0] === "type") {
            const tStr = String(sub[1] || "").toLowerCase();
            if (tStr.includes("micro")) viaType = "micro";
            else if (tStr.includes("blind") || tStr.includes("buried")) viaType = "blind";
            else if (tStr.includes("through") || tStr.includes("thru")) viaType = "through";
          } else if (sub[0] === "net") {
            netId = parseInt(sub[1] as string, 10);
          } else if (sub[0] === "layers") {
            const l1 = mapKiCadPcbLayer(sub[1] as string);
            const l2 = mapKiCadPcbLayer(sub[2] as string);
            viaLayers = [l1, l2];
          } else if (sub[0] === "tstamp") {
            tstamp = sub[1] as string;
          } else if (sub[0] === "status") {
            status = sub[1] as string | number;
          } else if (sub[0] === "remove_unused_layers") {
            removeUnusedLayers = true;
          } else if (sub[0] === "keep_end_layers") {
            keepEndLayers = true;
          } else if (sub[0] === "free") {
            free = true;
          } else if (sub[0] === "locked") {
            locked = true;
          }
        }

        registerPoint(vx, vy);

        vias.push({
          id: `via-kicad-${Math.random().toString(36).substring(2, 9)}`,
          x: vx,
          y: vy,
          diameter: size,
          drill,
          shape: "circle",
          viaType,
          layers: viaLayers,
          removeUnusedLayers: removeUnusedLayers ? true : undefined,
          keepEndLayers: keepEndLayers ? true : undefined,
          free: free ? true : undefined,
          drillOffset,
          status,
          netId,
          tstamp,
          locked,
        });
      }

      // 4. Native PCB Graphics: (gr_line, gr_arc, gr_rect, gr_circle, gr_poly, gr_curve, gr_textbox)
      else if (head === "gr_line" || head === "gr_arc" || head === "gr_rect" || head === "gr_circle" || head === "gr_poly" || head === "gr_curve" || head === "gr_textbox") {
        let x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0, width = 0.15;
        let layer: PcbLayerId = "outline";
        let hasMid = false;
        let angle = 0;
        let hasAngle = false;
        let fill: "none" | "solid" = "none";
        let tstamp: string | undefined;
        let locked = false;
        let groupId: string | undefined;
        const textVal = typeof node[1] === "string" ? node[1] : "";
        let rot = 0;
        let size = 1.2;
        let bold = false;
        let italic = false;
        let mirror = false;
        let justify: string[] = [];
        let strokeType: "solid" | "dash" | "dot" | "dash_dot" | "dash_dot_dot" | "default" | undefined;
        const polyPts: { x: number; y: number }[] = [];

        for (const sub of node) {
          if (!Array.isArray(sub)) {
            if (sub === "locked") locked = true;
            continue;
          }
          const subHead = sub[0];
          if (subHead === "start" || subHead === "center") {
            x1 = parseFloat(sub[1] as string) || 0;
            y1 = parseFloat(sub[2] as string) || 0;
          } else if (subHead === "mid") {
            x3 = parseFloat(sub[1] as string) || 0;
            y3 = parseFloat(sub[2] as string) || 0;
            hasMid = true;
          } else if (subHead === "end") {
            x2 = parseFloat(sub[1] as string) || 0;
            y2 = parseFloat(sub[2] as string) || 0;
          } else if (subHead === "angle") {
            angle = parseFloat(sub[1] as string) || 0;
            hasAngle = true;
          } else if (subHead === "at") {
            x1 = parseFloat(sub[1] as string) || 0;
            y1 = parseFloat(sub[2] as string) || 0;
            rot = parseFloat(sub[3] as string) || 0;
          } else if (subHead === "width") {
            width = parseFloat(sub[1] as string) || 0.15;
          } else if (subHead === "stroke") {
            for (const sSub of sub) {
              if (Array.isArray(sSub)) {
                if (sSub[0] === "width") width = parseFloat(sSub[1] as string) || 0.15;
                if (sSub[0] === "type") strokeType = sSub[1] as any;
              }
            }
          } else if (subHead === "fill") {
            if (sub[1] === "solid" || sub[1] === "yes") fill = "solid";
          } else if (subHead === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (subHead === "pts") {
            for (const xy of sub) {
              if (Array.isArray(xy) && xy[0] === "xy") {
                polyPts.push({ x: parseFloat(xy[1] as string) || 0, y: parseFloat(xy[2] as string) || 0 });
              }
            }
          } else if (subHead === "effects") {
            for (const effSub of sub) {
              if (Array.isArray(effSub)) {
                if (effSub[0] === "font") {
                  for (const fontSub of effSub) {
                    if (Array.isArray(fontSub) && fontSub[0] === "size") {
                      size = parseFloat(fontSub[1] as string) || 1.2;
                    } else if (fontSub === "bold") bold = true;
                    else if (fontSub === "italic") italic = true;
                  }
                } else if (effSub[0] === "justify") {
                  justify = effSub.slice(1).map((j) => String(j));
                } else if (effSub === "mirror") mirror = true;
              }
            }
          } else if (subHead === "tstamp") {
            tstamp = sub[1] as string;
          } else if (subHead === "group" || subHead === "gropu") {
            groupId = sub[1] as string;
          }
        }

        // Register points for bounding box calculation
        let pts: { x: number; y: number }[] = [];
        if (head === "gr_curve" && polyPts.length === 4) {
          pts = bezierToPolyline(polyPts[0], polyPts[1], polyPts[2], polyPts[3]);
        } else if (head === "gr_poly" || head === "gr_curve") {
          pts = polyPts;
        } else if (head === "gr_circle") {
          pts = circleToPolyline(x1, y1, x2, y2);
        } else if (head === "gr_rect") {
          pts = [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }];
        } else if (head === "gr_arc" && hasMid) {
          pts = arcToPolyline(x1, y1, x3, y3, x2, y2);
        } else if (head === "gr_arc" && hasAngle) {
          pts = centerArcToPolyline(x1, y1, x2, y2, angle);
        } else {
          pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
        }
        pts.forEach((p) => registerPoint(p.x, p.y));

        const stroke = { width, type: strokeType };
        const id = `graphic-${head}-${Math.random().toString(36).substring(2, 9)}`;

        if (head === "gr_line") {
          graphics.push({ id, kind: "line", start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, layer, stroke, width, tstamp, locked, groupId });
        } else if (head === "gr_arc") {
          graphics.push({ id, kind: "arc", start: { x: x1, y: y1 }, mid: hasMid ? { x: x3, y: y3 } : undefined, end: { x: x2, y: y2 }, center: hasAngle ? { x: x1, y: y1 } : undefined, angle: hasAngle ? angle : undefined, layer, stroke, width, tstamp, locked, groupId });
        } else if (head === "gr_circle") {
          const r = Math.hypot(x2 - x1, y2 - y1);
          graphics.push({ id, kind: "circle", center: { x: x1, y: y1 }, end: { x: x2, y: y2 }, radius: r, layer, stroke, width, fill, tstamp, locked, groupId });
        } else if (head === "gr_rect") {
          graphics.push({ id, kind: "rect", start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, layer, stroke, width, fill, tstamp, locked, groupId });
        } else if (head === "gr_poly") {
          graphics.push({ id, kind: "poly", points: polyPts, layer, stroke, width, fill, tstamp, locked, groupId });
        } else if (head === "gr_curve") {
          graphics.push({ id, kind: "curve", points: polyPts, layer, stroke, width, tstamp, locked, groupId });
        } else if (head === "gr_text") {
          graphics.push({ id, kind: "text", text: textVal, position: { x: x1, y: y1 }, rotation: rot, size: { x: size, y: size }, justify, bold, italic, mirror, layer, stroke, width, tstamp, locked, groupId });
        } else if (head === "gr_textbox") {
          graphics.push({ id, kind: "textbox", text: textVal, position: { x: x1, y: y1 }, end: { x: x2, y: y2 }, rotation: rot, size: { x: size, y: size }, justify, bold, italic, layer, stroke, width, tstamp, locked, groupId });
        }
      }

      // 4c. Board Dimensions
      else if (head === "dimension") {
        let dimType: "aligned" | "leader" | "center" | "orthogonal" | "radial" = "aligned";
        let layer: PcbLayerId = "silkscreen";
        const pts: { x: number; y: number }[] = [];
        let height: number | undefined;
        let textVal: string | undefined;
        let val: number | undefined;
        let tstamp: string | undefined;
        let locked = false;
        let groupId: string | undefined;

        for (const sub of node) {
          if (!Array.isArray(sub)) {
            if (sub === "locked") locked = true;
            continue;
          }
          const subHead = sub[0];
          if (subHead === "type") dimType = sub[1] as any;
          else if (subHead === "layer") layer = mapKiCadPcbLayer(sub[1] as string);
          else if (subHead === "pts") {
            for (const xy of sub) {
              if (Array.isArray(xy) && xy[0] === "xy") {
                const x = parseFloat(xy[1] as string) || 0;
                const y = parseFloat(xy[2] as string) || 0;
                pts.push({ x, y });
                registerPoint(x, y);
              }
            }
          } else if (subHead === "height") height = parseFloat(sub[1] as string) || undefined;
          else if (subHead === "text") textVal = sub[1] as string;
          else if (subHead === "value") val = parseFloat(sub[1] as string) || undefined;
          else if (subHead === "tstamp") tstamp = sub[1] as string;
          else if (subHead === "group") groupId = sub[1] as string;
        }

        dimensions.push({
          id: `dim-${Math.random().toString(36).substring(2, 9)}`,
          dimensionType: dimType,
          layer,
          points: pts,
          height,
          text: textVal,
          value: val,
          tstamp,
          locked,
          groupId,
        });
      }

      // 4d. Alignment Targets
      else if (head === "target") {
        let shape: "plus" | "cross" | "circle" = "plus";
        let tx = 0, ty = 0, size = 3, width = 0.15;
        let layer: PcbLayerId = "silkscreen";
        let tstamp: string | undefined;
        let locked = false;
        let groupId: string | undefined;

        for (const sub of node) {
          if (!Array.isArray(sub)) {
            if (sub === "locked") locked = true;
            continue;
          }
          const subHead = sub[0];
          if (subHead === "shape") shape = sub[1] as any;
          else if (subHead === "at") {
            tx = parseFloat(sub[1] as string) || 0;
            ty = parseFloat(sub[2] as string) || 0;
          } else if (subHead === "size") size = parseFloat(sub[1] as string) || 3;
          else if (subHead === "width") width = parseFloat(sub[1] as string) || 0.15;
          else if (subHead === "layer") layer = mapKiCadPcbLayer(sub[1] as string);
          else if (subHead === "tstamp") tstamp = sub[1] as string;
          else if (subHead === "group") groupId = sub[1] as string;
        }

        registerPoint(tx, ty);

        targets.push({
          id: `target-${Math.random().toString(36).substring(2, 9)}`,
          x: tx,
          y: ty,
          shape,
          size,
          width,
          layer,
          tstamp,
          locked,
          groupId,
        });
      }

      // 4e. Board Groups
      else if (head === "group") {
        const gName = typeof node[1] === "string" ? node[1] : "Group";
        let gId = `group-${Math.random().toString(36).substring(2, 9)}`;
        const members: string[] = [];
        let locked = false;

        for (const sub of node) {
          if (!Array.isArray(sub)) {
            if (sub === "locked") locked = true;
            continue;
          }
          const subHead = sub[0];
          if (subHead === "id") gId = sub[1] as string;
          else if (subHead === "members") {
            for (let mi = 1; mi < sub.length; mi++) {
              if (typeof sub[mi] === "string") members.push(sub[mi] as string);
            }
          }
        }

        groups.push({
          id: gId,
          name: gName,
          members,
          locked,
        });
      }
      
      // 4b. Native PCB Zones, Copper Pours, and Keepouts
      else if (head === "zone") {
        let layer: PcbLayerId = "top_copper";
        const zoneLayers: PcbLayerId[] = [];
        let netId: number | undefined;
        let netName: string | undefined;
        let zoneName: string | undefined;
        let priority: number | undefined;
        let clearance: number | undefined;
        let minThickness: number | undefined;
        let tstamp: string | undefined;
        let locked = false;

        let isKeepout = false;
        const keepoutSettings: PcbZoneKeepoutSettings = {};
        const fillSettings: PcbZoneFillSettings = { fillMode: "solid" };

        const boundaryPtsList: { x: number; y: number }[][] = [];
        const filledPolyList: PcbZoneFilledPolygon[] = [];

        for (const sub of node) {
          if (!Array.isArray(sub)) {
            if (sub === "locked") locked = true;
            continue;
          }
          const subHead = sub[0];
          if (subHead === "net") {
            netId = parseInt(sub[1] as string, 10);
          } else if (subHead === "net_name") {
            netName = sub[1] as string;
          } else if (subHead === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (subHead === "layers") {
            for (let li = 1; li < sub.length; li++) {
              if (typeof sub[li] === "string") {
                zoneLayers.push(mapKiCadPcbLayer(sub[li] as string));
              }
            }
            if (zoneLayers.length > 0) layer = zoneLayers[0];
          } else if (subHead === "name") {
            zoneName = sub[1] as string;
          } else if (subHead === "priority") {
            priority = parseInt(sub[1] as string, 10);
          } else if (subHead === "min_thickness") {
            minThickness = parseFloat(sub[1] as string) || undefined;
          } else if (subHead === "connect_pads") {
            for (const cp of sub) {
              if (Array.isArray(cp) && cp[0] === "clearance") {
                clearance = parseFloat(cp[1] as string) || undefined;
              }
            }
          } else if (subHead === "keepout") {
            isKeepout = true;
            for (const ko of sub) {
              if (Array.isArray(ko)) {
                if (ko[0] === "tracks" && ko[1] === "not_allowed") keepoutSettings.tracks = true;
                if (ko[0] === "vias" && ko[1] === "not_allowed") keepoutSettings.vias = true;
                if (ko[0] === "pads" && ko[1] === "not_allowed") keepoutSettings.pads = true;
                if (ko[0] === "copperpour" && ko[1] === "not_allowed") keepoutSettings.copperpour = true;
                if (ko[0] === "footprints" && ko[1] === "not_allowed") keepoutSettings.footprints = true;
              }
            }
          } else if (subHead === "fill") {
            for (const fSub of sub) {
              if (Array.isArray(fSub)) {
                if (fSub[0] === "yes" || fSub[0] === "mode") {
                  fillSettings.fillMode = "solid";
                } else if (fSub[0] === "thermal_gap") {
                  fillSettings.thermalGap = parseFloat(fSub[1] as string) || undefined;
                } else if (fSub[0] === "thermal_bridge_width") {
                  fillSettings.thermalBridgeWidth = parseFloat(fSub[1] as string) || undefined;
                } else if (fSub[0] === "smoothing") {
                  fillSettings.smoothing = fSub[1] as any;
                } else if (fSub[0] === "radius") {
                  fillSettings.smoothingRadius = parseFloat(fSub[1] as string) || undefined;
                } else if (fSub[0] === "island_removal_mode") {
                  fillSettings.islandRemovalMode = parseInt(fSub[1] as string, 10);
                } else if (fSub[0] === "min_island_area") {
                  fillSettings.minIslandArea = parseFloat(fSub[1] as string) || undefined;
                } else if (fSub[0] === "hatch_style") {
                  fillSettings.hatchStyle = fSub[1] as any;
                } else if (fSub[0] === "hatch_pitch") {
                  fillSettings.hatchPitch = parseFloat(fSub[1] as string) || undefined;
                }
              }
            }
          } else if (subHead === "hatch") {
            if (typeof sub[1] === "string") fillSettings.hatchStyle = sub[1] as any;
            if (sub[2]) fillSettings.hatchPitch = parseFloat(sub[2] as string) || undefined;
          } else if (subHead === "polygon") {
            // (polygon (pts (xy X Y) ...))
            for (const pSub of sub) {
              if (Array.isArray(pSub) && pSub[0] === "pts") {
                const pts: { x: number; y: number }[] = [];
                for (const xy of pSub) {
                  if (Array.isArray(xy) && xy[0] === "xy") {
                    const x = parseFloat(xy[1] as string) || 0;
                    const y = parseFloat(xy[2] as string) || 0;
                    pts.push({ x, y });
                    registerPoint(x, y);
                  }
                }
                if (pts.length > 0) {
                  boundaryPtsList.push(pts);
                }
              }
            }
          } else if (subHead === "filled_polygon") {
            // (filled_polygon (layer "F.Cu") (pts (xy X Y) ...))
            let fpLayer: PcbLayerId = layer;
            const fpPtsList: { x: number; y: number }[][] = [];
            for (const fpSub of sub) {
              if (Array.isArray(fpSub)) {
                if (fpSub[0] === "layer") {
                  fpLayer = mapKiCadPcbLayer(fpSub[1] as string);
                } else if (fpSub[0] === "pts") {
                  const pts: { x: number; y: number }[] = [];
                  for (const xy of fpSub) {
                    if (Array.isArray(xy) && xy[0] === "xy") {
                      const x = parseFloat(xy[1] as string) || 0;
                      const y = parseFloat(xy[2] as string) || 0;
                      pts.push({ x, y });
                      registerPoint(x, y);
                    }
                  }
                  if (pts.length > 0) {
                    fpPtsList.push(pts);
                  }
                }
              }
            }
            if (fpPtsList.length > 0) {
              const mainPts = fpPtsList[0];
              const holes = fpPtsList.length > 1 ? fpPtsList.slice(1) : undefined;
              filledPolyList.push({
                layer: fpLayer,
                pts: mainPts,
                holes,
                island: true,
              });
            }
          } else if (subHead === "tstamp") {
            tstamp = sub[1] as string;
          }
        }

        const outerBoundaryPts = boundaryPtsList.length > 0 ? boundaryPtsList[0] : [];
        const boundaryHoles = boundaryPtsList.length > 1 ? boundaryPtsList.slice(1) : undefined;

        if (outerBoundaryPts.length > 0 || filledPolyList.length > 0) {
          const zoneObj: PcbZone = {
            id: `zone-${Math.random().toString(36).substring(2, 9)}`,
            layer,
            layers: zoneLayers.length > 0 ? zoneLayers : undefined,
            netId,
            netName: netName || (netId !== undefined ? kicadNets.get(netId) : undefined),
            name: zoneName,
            priority,
            clearance,
            minThickness,
            boundary: {
              pts: outerBoundaryPts,
              holes: boundaryHoles,
            },
            filledPolygons: filledPolyList.length > 0 ? filledPolyList : undefined,
            fill: fillSettings,
            isKeepout: isKeepout ? true : undefined,
            keepout: isKeepout ? keepoutSettings : undefined,
            tstamp,
            locked: locked ? true : undefined,
          };
          zones.push(zoneObj);
        }
      }

      // 5. Graphic Text: (gr_text "TEXT" (at X Y [ROT]) (layer L) ...)
      else if (head === "gr_text") {
        const textVal = (typeof node[1] === "string" ? node[1] : "TEXT");
        let tx = 0, ty = 0, rot: 0 | 90 | 180 | 270 = 0;
        let layer: PcbLayerId = "silkscreen";
        let size = 1.2;

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "at") {
            tx = parseFloat(sub[1] as string) || 0;
            ty = parseFloat(sub[2] as string) || 0;
            const rVal = parseFloat(sub[3] as string) || 0;
            if (rVal === 90 || rVal === 180 || rVal === 270) rot = rVal;
          } else if (sub[0] === "layer") {
            layer = mapKiCadPcbLayer(sub[1] as string);
          } else if (sub[0] === "effects") {
            for (const effSub of sub) {
              if (Array.isArray(effSub) && effSub[0] === "font") {
                for (const fontSub of effSub) {
                  if (Array.isArray(fontSub) && fontSub[0] === "size") {
                    size = parseFloat(fontSub[1] as string) || 1.2;
                  }
                }
              }
            }
          }
        }

        registerPoint(tx, ty);

        texts.push({
          id: `text-kicad-${Math.random().toString(36).substring(2, 9)}`,
          text: textVal,
          x: tx,
          y: ty,
          size,
          layer,
          rotation: rot,
        });
      }

      // 6. Footprints / Modules: (footprint "NAME" ...) or (module "NAME" ...)
      else if (head === "footprint" || head === "module") {
        let fx = 0, fy = 0, frot = 0;
        let fpRef = "";
        let fpVal = "";
        let fpSymbol = "ic";
        const fpPads: PcbFootprintPad[] = [];

        for (const sub of node) {
          if (!Array.isArray(sub)) continue;
          const subHead = sub[0];

          if (subHead === "at") {
            fx = parseFloat(sub[1] as string) || 0;
            fy = parseFloat(sub[2] as string) || 0;
            frot = parseFloat(sub[3] as string) || 0;
          } else if (subHead === "property" && sub[1] === "Reference") {
            fpRef = (sub[2] as string) || "";
          } else if (subHead === "property" && sub[1] === "Value") {
            fpVal = (sub[2] as string) || "";
          } else if (subHead === "fp_text") {
            if (sub[1] === "reference") fpRef = (sub[2] as string) || "";
            if (sub[1] === "value") fpVal = (sub[2] as string) || "";
            
            const textVal = (typeof sub[2] === "string" ? sub[2] : "TEXT");
            let tx = 0, ty = 0, rot: 0 | 90 | 180 | 270 = 0;
            let layer: import("./pcb").PcbLayerId = "silkscreen";
            let size = 1.0;

            for (const fpSub of sub) {
              if (!Array.isArray(fpSub)) continue;
              if (fpSub[0] === "at") {
                tx = parseFloat(fpSub[1] as string) || 0;
                ty = parseFloat(fpSub[2] as string) || 0;
                const rVal = parseFloat(fpSub[3] as string) || 0;
                if (rVal === 90 || rVal === 180 || rVal === 270) rot = rVal;
              } else if (fpSub[0] === "layer") {
                layer = mapKiCadPcbLayer(fpSub[1] as string);
              } else if (fpSub[0] === "effects") {
                for (const effSub of fpSub) {
                  if (Array.isArray(effSub) && effSub[0] === "font") {
                    for (const fontSub of effSub) {
                      if (Array.isArray(fontSub) && fontSub[0] === "size") {
                        size = parseFloat(fontSub[1] as string) || 1.0;
                      }
                    }
                  }
                }
              }
            }

            const rad = (frot * Math.PI) / 180;
            const absTx = fx + (tx * Math.cos(rad) - ty * Math.sin(rad));
            const absTy = fy + (tx * Math.sin(rad) + ty * Math.cos(rad));
            const absRot = (frot + rot) % 360;
            const finalRot = (absRot === 90 || absRot === 180 || absRot === 270) ? absRot : 0;

            registerPoint(absTx, absTy);
            
            // Only push non-reference/value text to avoid duplicating the renderer's text
            if (sub[1] !== "reference" && sub[1] !== "value") {
              texts.push({
                id: `text-fp-${Math.random().toString(36).substring(2, 9)}`,
                text: textVal,
                x: absTx,
                y: absTy,
                size,
                layer,
                rotation: finalRot,
              });
            }
          }

          // Pads inside footprint
          else if (subHead === "pad") {
            const padNum = (sub[1] as string) || "1";
            const padType = (sub[2] as string) || "smd";
            const padShapeStr = (sub[3] as string) || "rect";

            let px = 0, py = 0, prot = 0;
            let pw = 1.0, ph = 1.0;
            let drill: number | undefined = undefined;
            let padLayers: ("top_copper" | "bottom_copper" | "multi_layer") = padType === "smd" ? "top_copper" : "multi_layer";
            let netId: number | undefined;
            
            for (const padSub of sub) {
              if (!Array.isArray(padSub)) continue;
              if (padSub[0] === "at") {
                px = parseFloat(padSub[1] as string) || 0; py = parseFloat(padSub[2] as string) || 0; prot = parseFloat(padSub[3] as string) || 0;
              } else if (padSub[0] === "size") {
                pw = parseFloat(padSub[1] as string) || 1.0;
                ph = parseFloat(padSub[2] as string) || 1.0;
              } else if (padSub[0] === "drill") {
                drill = parseFloat(padSub[1] as string) || 0.8;
              } else if (padSub[0] === "layers") {
                const layerList = padSub.slice(1).map((l) => String(l).toLowerCase());
                const hasFront = layerList.some((l) => l.includes("f.cu") || l.includes("top") || l === "*.cu");
                const hasBack = layerList.some((l) => l.includes("b.cu") || l.includes("bottom") || l === "*.cu");
                if (hasFront && hasBack) padLayers = "multi_layer";
                else if (hasBack) padLayers = "bottom_copper";
                else padLayers = "top_copper";
              } else if (padSub[0] === "net") {
                netId = parseInt(padSub[1] as string, 10);
              } else if (padSub[0] === "primitives") {
                for (const prim of padSub) {
                  if (!Array.isArray(prim)) continue;
                  const pHead = prim[0];
                  if (pHead === "gr_poly" || pHead === "gr_line" || pHead === "gr_arc" || pHead === "gr_circle" || pHead === "gr_curve") {
                    let cx1 = 0, cy1 = 0, cx2 = 0, cy2 = 0, cx3 = 0, cy3 = 0, cWidth = 0.15;
                    let cHasMid = false;
                    let cAngle = 0;
                    let cHasAngle = false;
                    const cPolyPts: {x: number, y: number}[] = [];
                    for (const ps of prim) {
                      if (!Array.isArray(ps)) continue;
                      if (ps[0] === "start" || ps[0] === "center") {
                        cx1 = parseFloat(ps[1] as string) || 0; cy1 = parseFloat(ps[2] as string) || 0;
                      } else if (ps[0] === "mid") {
                        cx3 = parseFloat(ps[1] as string) || 0; cy3 = parseFloat(ps[2] as string) || 0;
                        cHasMid = true;
                      } else if (ps[0] === "end") {
                        cx2 = parseFloat(ps[1] as string) || 0; cy2 = parseFloat(ps[2] as string) || 0;
                      } else if (ps[0] === "angle") {
                        cAngle = parseFloat(ps[1] as string) || 0;
                        cHasAngle = true;
                      } else if (ps[0] === "width" || ps[0] === "stroke") {
                        if (ps[0] === "stroke") {
                          const wSub = ps.find(s => Array.isArray(s) && s[0] === "width") as any[];
                          if (wSub) cWidth = parseFloat(wSub[1] as string) || 0.15;
                        } else {
                          cWidth = parseFloat(ps[1] as string) || 0.15;
                        }
                      } else if (ps[0] === "pts") {
                        for (const xy of ps) {
                          if (Array.isArray(xy) && xy[0] === "xy") {
                            cPolyPts.push({ x: parseFloat(xy[1] as string) || 0, y: parseFloat(xy[2] as string) || 0 });
                          }
                        }
                      }
                    }
                    let cPts: {x: number, y: number}[] = [];
                    if (pHead === "gr_poly") {
                      cPts = cPolyPts;
                      if (cPts.length > 0 && (cPts[0].x !== cPts[cPts.length-1].x || cPts[0].y !== cPts[cPts.length-1].y)) cPts.push({...cPts[0]});
                    } else if (pHead === "gr_curve" && cPolyPts.length === 4) {
                      cPts = bezierToPolyline(cPolyPts[0], cPolyPts[1], cPolyPts[2], cPolyPts[3]);
                    } else if (pHead === "gr_circle") {
                      cPts = circleToPolyline(cx1, cy1, cx2, cy2);
                    } else if (pHead === "gr_arc" && cHasMid) {
                      cPts = arcToPolyline(cx1, cy1, cx3, cy3, cx2, cy2);
                    } else if (pHead === "gr_arc" && cHasAngle) {
                      cPts = centerArcToPolyline(cx1, cy1, cx2, cy2, cAngle);
                    } else {
                      cPts = [{ x: cx1, y: cy1 }, { x: cx2, y: cy2 }];
                    }
                    if (cPts.length > 0) {
                      // Apply pad transform and then footprint transform
                      const radRot = (frot * Math.PI) / 180;
                      const absPts = cPts.map(p => {
                        // local to pad
                        const padRad = (prot * Math.PI) / 180;
                        const rotatedPdx = p.x * Math.cos(padRad) - p.y * Math.sin(padRad);
                        const rotatedPdy = p.x * Math.sin(padRad) + p.y * Math.cos(padRad);
                        const pxLocal = rotatedPdx + px;
                        const pyLocal = rotatedPdy + py;
                        // local to footprint
                        const absX = fx + (pxLocal * Math.cos(radRot) - pyLocal * Math.sin(radRot));
                        const absY = fy + (pxLocal * Math.sin(radRot) + pyLocal * Math.cos(radRot));
                        registerPoint(absX, absY);
                        return { x: absX, y: absY };
                      });
                      tracks.push({
                        id: `custompad-${Math.random().toString(36).substring(2, 9)}`,
                        layer: padLayers,
                        width: cWidth > 0 ? cWidth : 0.1,
                        points: absPts,
                        netId
                      });
                    }
                  }
                }
              }
            }

            // Calculate absolute position of pad
            const rad = (frot * Math.PI) / 180;
            const absPx = fx + (px * Math.cos(rad) - py * Math.sin(rad));
            const absPy = fy + (px * Math.sin(rad) + py * Math.cos(rad));

            registerPoint(absPx, absPy);

            const shape: "rect" | "circle" = (padShapeStr === "circle" || padShapeStr === "oval") ? "circle" : "rect";
            const padNetName = netId !== undefined ? kicadNets.get(netId) : undefined;

            fpPads.push({
              pinIndex: parseInt(padNum, 10) || 1,
              number: padNum,
              name: padNum,
              x: px,
              y: py,
              width: pw,
              height: ph,
              shape, layer: padLayers, rotation: prot,
              drill,
              netId,
              netName: padNetName,
              netKey: padNetName,
            });

            pads.push({
              id: `pad-kicad-${Math.random().toString(36).substring(2, 9)}`,
              x: absPx,
              y: absPy,
              width: pw,
              height: ph,
              shape, layer: padLayers === "bottom_copper" ? "bottom_copper" : "top_copper",
              drill,
              number: padNum,
              netId,
              netName: padNetName,
              netKey: padNetName,
            });
          }

          // Silkscreen / graphics inside footprint
          else if (subHead === "fp_line" || subHead === "fp_arc" || subHead === "fp_rect" || subHead === "fp_circle" || subHead === "fp_poly" || subHead === "fp_curve" || subHead === "fp_curve") {
            let x1 = 0, y1 = 0, x2 = 0, y2 = 0, x3 = 0, y3 = 0, width = 0.15;
            let layer: PcbLayerId = "silkscreen";
            let hasMid = false;
            let angle = 0;
            let hasAngle = false;
            const polyPts: {x: number, y: number}[] = [];

            for (const fpSub of sub) {
              if (!Array.isArray(fpSub)) continue;
              if (fpSub[0] === "start" || fpSub[0] === "center") {
                x1 = parseFloat(fpSub[1] as string) || 0;
                y1 = parseFloat(fpSub[2] as string) || 0;
              } else if (fpSub[0] === "mid") {
                x3 = parseFloat(fpSub[1] as string) || 0;
                y3 = parseFloat(fpSub[2] as string) || 0;
                hasMid = true;
              } else if (fpSub[0] === "end") {
                x2 = parseFloat(fpSub[1] as string) || 0;
                y2 = parseFloat(fpSub[2] as string) || 0;
              } else if (fpSub[0] === "angle") {
                angle = parseFloat(fpSub[1] as string) || 0;
                hasAngle = true;
              } else if (fpSub[0] === "width" || fpSub[0] === "stroke") {
                if (fpSub[0] === "stroke") {
                  const wSub = fpSub.find(s => Array.isArray(s) && s[0] === "width") as any[];
                  if (wSub) width = parseFloat(wSub[1] as string) || 0.15;
                } else {
                  width = parseFloat(fpSub[1] as string) || 0.15;
                }
              } else if (fpSub[0] === "layer") {
                layer = mapKiCadPcbLayer(fpSub[1] as string);
              } else if (fpSub[0] === "pts") {
                for (const xy of fpSub) {
                  if (Array.isArray(xy) && xy[0] === "xy") {
                    polyPts.push({ x: parseFloat(xy[1] as string) || 0, y: parseFloat(xy[2] as string) || 0 });
                  }
                }
              }
            }

            let pts: {x: number, y: number}[] = [];
            if (subHead === "fp_curve" && polyPts.length === 4) {
              pts = bezierToPolyline(polyPts[0], polyPts[1], polyPts[2], polyPts[3]);
            } else if (subHead === "fp_poly" || subHead === "fp_curve") {
              pts = polyPts;
              if (pts.length > 0 && (pts[0].x !== pts[pts.length-1].x || pts[0].y !== pts[pts.length-1].y)) {
                 pts.push({...pts[0]});
              }
            } else if (subHead === "fp_circle") {
              pts = circleToPolyline(x1, y1, x2, y2);
            } else if (subHead === "fp_rect") {
              pts = [
                { x: x1, y: y1 }, { x: x2, y: y1 }, { x: x2, y: y2 }, { x: x1, y: y2 }, { x: x1, y: y1 }
              ];
            } else if (subHead === "fp_arc" && hasMid) {
              pts = arcToPolyline(x1, y1, x3, y3, x2, y2);
            } else if (subHead === "fp_arc" && hasAngle) {
              pts = centerArcToPolyline(x1, y1, x2, y2, angle);
            } else {
              pts = [{ x: x1, y: y1 }, { x: x2, y: y2 }];
            }
            
            if (pts.length > 0) {
              const rad = (frot * Math.PI) / 180;
              const absPts = pts.map(p => {
                const absX = fx + (p.x * Math.cos(rad) - p.y * Math.sin(rad));
                const absY = fy + (p.x * Math.sin(rad) + p.y * Math.cos(rad));
                registerPoint(absX, absY);
                return { x: absX, y: absY };
              });

              const transformPt = (px: number, py: number) => ({
                x: fx + (px * Math.cos(rad) - py * Math.sin(rad)),
                y: fy + (px * Math.sin(rad) + py * Math.cos(rad)),
              });

              tracks.push({
                id: `fp-${subHead}-${Math.random().toString(36).substring(2, 9)}`,
                kind: subHead === "fp_arc" ? "arc" : subHead === "fp_line" ? "segment" : "poly",
                start: transformPt(x1, y1),
                end: transformPt(x2, y2),
                mid: hasMid ? transformPt(x3, y3) : undefined,
                center: hasAngle ? transformPt(x1, y1) : undefined,
                angle: hasAngle ? angle : undefined,
                layer,
                width,
                points: absPts,
              });
            }
          }
        }

        registerPoint(fx, fy);

        if (fpRef) {
          if (/^r[0-9]/i.test(fpRef)) fpSymbol = "resistor";
          else if (/^c[0-9]/i.test(fpRef)) fpSymbol = "capacitor";
          else if (/^l[0-9]/i.test(fpRef)) fpSymbol = "inductor";
          else if (/^d[0-9]/i.test(fpRef)) fpSymbol = "diode2";
          else if (/^q[0-9]/i.test(fpRef)) fpSymbol = "transistor";
          else if (/^u[0-9]/i.test(fpRef)) fpSymbol = "opamp4";
        }

        footprints.push({
          id: `fp-${Math.random().toString(36).substring(2, 9)}`,
          reference: fpRef || undefined,
          value: fpVal || undefined,
          symbol: fpSymbol,
          x: fx,
          y: fy,
          rotation: frot,
          pads: fpPads,
        });
      }
    }
  } catch (err) {
    console.warn("KiCad PCB AST parse warning, falling back to regex scanner", err);
  }

  // Regex fallback scanner if AST missed segments or points
  if (tracks.length === 0 && pads.length === 0 && vias.length === 0) {
    // Regex for segments
    const segMatches = fileContent.matchAll(/\(segment\s+\(start\s+([\d.-]+)\s+([\d.-]+)\)\s+\(end\s+([\d.-]+)\s+([\d.-]+)\)\s+\(width\s+([\d.-]+)\)\s+\(layer\s+"?([^"\s)]+)"?\)/gi);
    for (const m of segMatches) {
      const x1 = parseFloat(m[1]), y1 = parseFloat(m[2]);
      const x2 = parseFloat(m[3]), y2 = parseFloat(m[4]);
      const width = parseFloat(m[5]) || 0.25;
      const layer = mapKiCadPcbLayer(m[6] || "F.Cu");

      registerPoint(x1, y1);
      registerPoint(x2, y2);

      tracks.push({
        id: `track-fb-${Math.random().toString(36).substring(2, 9)}`,
        layer,
        width,
        points: [{ x: x1, y: y1 }, { x: x2, y: y2 }],
      });
    }

    // Regex for vias
    const viaMatches = fileContent.matchAll(/\(via\s+\(at\s+([\d.-]+)\s+([\d.-]+)\)\s+\(size\s+([\d.-]+)\)(?:\s+\(drill\s+([\d.-]+)\))?/gi);
    for (const m of viaMatches) {
      const vx = parseFloat(m[1]), vy = parseFloat(m[2]);
      const size = parseFloat(m[3]) || 0.8;
      const drill = parseFloat(m[4]) || size * 0.5;

      registerPoint(vx, vy);

      vias.push({
        id: `via-fb-${Math.random().toString(36).substring(2, 9)}`,
        x: vx,
        y: vy,
        diameter: size,
        drill,
        shape: "circle",
      });
    }
  }

  // Calculate board dimensions and offset
  if (minX === Infinity || minY === Infinity) {
    minX = 0; minY = 0; maxX = 100; maxY = 80;
  }

  const offsetX = -minX + 5; // 5mm margin
  const offsetY = -minY + 5;

  const boardWidth = Number(Math.max(20, (maxX - minX) + 10).toFixed(2));
  const boardHeight = Number(Math.max(20, (maxY - minY) + 10).toFixed(2));

  // Offset all elements so min coordinate is at margin
  tracks.forEach((t) => {
    t.points = t.points.map((p) => ({
      x: Number((p.x + offsetX).toFixed(3)),
      y: Number((p.y + offsetY).toFixed(3)),
    }));
    if (t.start) {
      t.start = {
        x: Number((t.start.x + offsetX).toFixed(3)),
        y: Number((t.start.y + offsetY).toFixed(3)),
      };
    }
    if (t.end) {
      t.end = {
        x: Number((t.end.x + offsetX).toFixed(3)),
        y: Number((t.end.y + offsetY).toFixed(3)),
      };
    }
    if (t.mid) {
      t.mid = {
        x: Number((t.mid.x + offsetX).toFixed(3)),
        y: Number((t.mid.y + offsetY).toFixed(3)),
      };
    }
    if (t.center) {
      t.center = {
        x: Number((t.center.x + offsetX).toFixed(3)),
        y: Number((t.center.y + offsetY).toFixed(3)),
      };
    }
  });

  pads.forEach((p) => {
    p.x = Number((p.x + offsetX).toFixed(3));
    p.y = Number((p.y + offsetY).toFixed(3));
  });

  vias.forEach((v) => {
    v.x = Number((v.x + offsetX).toFixed(3));
    v.y = Number((v.y + offsetY).toFixed(3));
  });

  footprints.forEach((f) => {
    f.x = Number((f.x + offsetX).toFixed(3));
    f.y = Number((f.y + offsetY).toFixed(3));
  });

  texts.forEach((t) => {
    t.x = Number((t.x + offsetX).toFixed(3));
    t.y = Number((t.y + offsetY).toFixed(3));
  });

  graphics.forEach((g) => {
    if (g.kind === "line") {
      g.start = { x: Number((g.start.x + offsetX).toFixed(3)), y: Number((g.start.y + offsetY).toFixed(3)) };
      g.end = { x: Number((g.end.x + offsetX).toFixed(3)), y: Number((g.end.y + offsetY).toFixed(3)) };
    } else if (g.kind === "arc") {
      g.start = { x: Number((g.start.x + offsetX).toFixed(3)), y: Number((g.start.y + offsetY).toFixed(3)) };
      g.end = { x: Number((g.end.x + offsetX).toFixed(3)), y: Number((g.end.y + offsetY).toFixed(3)) };
      if (g.mid) g.mid = { x: Number((g.mid.x + offsetX).toFixed(3)), y: Number((g.mid.y + offsetY).toFixed(3)) };
      if (g.center) g.center = { x: Number((g.center.x + offsetX).toFixed(3)), y: Number((g.center.y + offsetY).toFixed(3)) };
    } else if (g.kind === "circle") {
      g.center = { x: Number((g.center.x + offsetX).toFixed(3)), y: Number((g.center.y + offsetY).toFixed(3)) };
      g.end = { x: Number((g.end.x + offsetX).toFixed(3)), y: Number((g.end.y + offsetY).toFixed(3)) };
    } else if (g.kind === "rect") {
      g.start = { x: Number((g.start.x + offsetX).toFixed(3)), y: Number((g.start.y + offsetY).toFixed(3)) };
      g.end = { x: Number((g.end.x + offsetX).toFixed(3)), y: Number((g.end.y + offsetY).toFixed(3)) };
    } else if (g.kind === "poly" || g.kind === "curve") {
      g.points = g.points.map(p => ({ x: Number((p.x + offsetX).toFixed(3)), y: Number((p.y + offsetY).toFixed(3)) }));
    } else if (g.kind === "text") {
      g.position = { x: Number((g.position.x + offsetX).toFixed(3)), y: Number((g.position.y + offsetY).toFixed(3)) };
    } else if (g.kind === "textbox") {
      g.position = { x: Number((g.position.x + offsetX).toFixed(3)), y: Number((g.position.y + offsetY).toFixed(3)) };
      if (g.end) g.end = { x: Number((g.end.x + offsetX).toFixed(3)), y: Number((g.end.y + offsetY).toFixed(3)) };
    }
  });

  dimensions.forEach((d) => {
    d.points = d.points.map(p => ({ x: Number((p.x + offsetX).toFixed(3)), y: Number((p.y + offsetY).toFixed(3)) }));
  });

  targets.forEach((tg) => {
    tg.x = Number((tg.x + offsetX).toFixed(3));
    tg.y = Number((tg.y + offsetY).toFixed(3));
  });

  zones.forEach((z) => {
    if (z.boundary && z.boundary.pts) {
      z.boundary.pts = z.boundary.pts.map((p) => ({
        x: Number((p.x + offsetX).toFixed(3)),
        y: Number((p.y + offsetY).toFixed(3)),
      }));
    }
    if (z.boundary && z.boundary.holes) {
      z.boundary.holes = z.boundary.holes.map((hole) =>
        hole.map((p) => ({
          x: Number((p.x + offsetX).toFixed(3)),
          y: Number((p.y + offsetY).toFixed(3)),
        }))
      );
    }
    if (z.filledPolygons) {
      z.filledPolygons.forEach((fp) => {
        fp.pts = fp.pts.map((p) => ({
          x: Number((p.x + offsetX).toFixed(3)),
          y: Number((p.y + offsetY).toFixed(3)),
        }));
        if (fp.holes) {
          fp.holes = fp.holes.map((hole) =>
            hole.map((p) => ({
              x: Number((p.x + offsetX).toFixed(3)),
              y: Number((p.y + offsetY).toFixed(3)),
            }))
          );
        }
      });
    }
  });

  // Construct board layer stack
  const finalLayers: PcbLayer[] = parsedBoardLayers ? [...parsedBoardLayers] : DEFAULT_LAYERS.map(l => ({ ...l }));
  
  // Guarantee that any copper layers used by tracks/vias/zones exist in finalLayers
  const usedLayerIds = new Set<string>();
  tracks.forEach(t => { if (t.layer) usedLayerIds.add(t.layer); });
  vias.forEach(v => { if (v.layers) { usedLayerIds.add(v.layers[0]); usedLayerIds.add(v.layers[1]); } });
  zones.forEach(z => {
    if (z.layer) usedLayerIds.add(z.layer);
    if (z.layers) z.layers.forEach(l => usedLayerIds.add(l));
    if (z.filledPolygons) z.filledPolygons.forEach(fp => { if (fp.layer) usedLayerIds.add(fp.layer); });
  });

  usedLayerIds.forEach(lId => {
    if (!finalLayers.some(fl => fl.id === lId)) {
      const inMatch = lId.match(/^in(\d+)\.cu$/i);
      const name = inMatch ? `Inner Copper ${inMatch[1]} (${lId})` : lId;
      finalLayers.push({
        id: lId as PcbLayerId,
        name,
        color: getCopperLayerStandardColor(lId),
        visible: true,
      });
    }
  });

  const pcbDoc: PcbDoc = {
    version: 1,
    unit: "mm",
    width: boardWidth,
    height: boardHeight,
    gridMm: 1,
    layers: finalLayers,
    tracks,
    vias,
    pads,
    zones,
    footprints,
    texts,
    graphics,
    dimensions,
    targets,
    groups,
    nets: docNets,
    measures: [],
    ratsnestVisible: true,
    isImportedGerber: false,
    isImportedKiCadPcb: true,
    disableDrc: false,
  };

  const cleanProjName = filename.replace(/\.(kicad_pcb|kicad_sch|zip|json|xml)$/i, "");

  return {
    name: cleanProjName,
    doc: {
      nodes: [],
      wires: [],
      canvasColor: "white",
      defaultWireColor: "black",
      pcb: pcbDoc,
    },
  };
}
