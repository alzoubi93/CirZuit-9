import JSZip from "jszip";
import { PcbDoc, PcbTrack, PcbVia, PcbPad, PcbLayerId, emptyPcbDoc } from "./pcb";
import { SchematicDoc } from "./schematic";

interface Aperture {
  shape: string; // 'C' | 'R' | 'O' etc.
  dims: number[]; // size dimensions in mm
}

/**
 * Parses a single Gerber RS-274X file string and extracts tracks, pads and outline.
 */
export function parseGerberFile(
  content: string,
  layerId: PcbLayerId
): { tracks: PcbTrack[]; pads: PcbPad[]; outlineSegments: { x1: number; y1: number; x2: number; y2: number }[] } {
  const tracks: PcbTrack[] = [];
  const pads: PcbPad[] = [];
  const outlineSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];

  // Gerber State
  let units: "mm" | "inch" = "mm";
  let scaleX = 10000; // default 4 decimal places
  let scaleY = 10000;
  const apertures = new Map<number, Aperture>();

  let currentX = 0;
  let currentY = 0;
  let currentAperture: number | null = null;
  let linearMode = true; // G01

  // Tracks accumulator
  let activeTrackPoints: { x: number; y: number }[] = [];
  let activeTrackWidth = 0.25;

  const flushActiveTrack = () => {
    if (activeTrackPoints.length >= 2) {
      tracks.push({
        id: `track-imported-${Math.random().toString(36).substr(2, 9)}`,
        layer: layerId,
        width: activeTrackWidth,
        points: [...activeTrackPoints],
      });
    }
    activeTrackPoints = [];
  };

  // Convert coordinate string to mm
  const parseCoordinate = (coordStr: string, scale: number): number => {
    const val = parseFloat(coordStr);
    if (isNaN(val)) return 0;
    
    let result = val;
    // Gerber files without decimals (standard formatted integer coordinates)
    if (!coordStr.includes(".")) {
      result = val / scale;
    }
    
    if (units === "inch") {
      result *= 25.4;
    }
    return result;
  };

  // Clean and split by Gerber block separator '*'
  const blocks = content.split("*");

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    // Parameter block: starts with % and ends with %
    if (block.startsWith("%")) {
      const paramContent = block.replace(/%/g, "").trim();

      // Units setting
      if (paramContent.includes("MOMM")) {
        units = "mm";
      } else if (paramContent.includes("MOIN")) {
        units = "inch";
      }

      // Format specification (e.g. FSLAX34Y34)
      if (paramContent.includes("FSLA")) {
        const fsMatch = paramContent.match(/X([0-9])([0-9])Y([0-9])([0-9])/);
        if (fsMatch) {
          const decX = parseInt(fsMatch[2], 10);
          const decY = parseInt(fsMatch[4], 10);
          scaleX = Math.pow(10, decX);
          scaleY = Math.pow(10, decY);
        }
      }

      // Aperture definition (e.g. ADD10C,1.5)
      if (paramContent.startsWith("ADD")) {
        const apMatch = paramContent.match(/^ADD([0-9]+)([A-Za-z]+),?([^%]*)/);
        if (apMatch) {
          const dcode = parseInt(apMatch[1], 10);
          const shape = apMatch[2].toUpperCase();
          const dimParts = apMatch[3].split("X");
          const dims = dimParts.map(d => {
            const val = parseFloat(d);
            return units === "inch" ? val * 25.4 : val;
          });
          apertures.set(dcode, { shape, dims });
        }
      }
      continue;
    }

    // Comment
    if (block.startsWith("G04") || block.startsWith("G4")) {
      continue;
    }

    // G-codes in data blocks
    if (block.startsWith("G01") || block.startsWith("G1")) {
      linearMode = true;
    }

    // Parse coordinates and active operation D-code
    let hasX = false;
    let hasY = false;
    let targetX = currentX;
    let targetY = currentY;

    // Extract X and Y coordinates
    const xMatch = block.match(/X([-+]?[0-9.]+)/);
    if (xMatch) {
      targetX = parseCoordinate(xMatch[1], scaleX);
      hasX = true;
    }
    const yMatch = block.match(/Y([-+]?[0-9.]+)/);
    if (yMatch) {
      targetY = parseCoordinate(yMatch[1], scaleY);
      hasY = true;
    }

    // Check for aperture selection (e.g. D10)
    const apSelMatch = block.match(/D([1-9][0-9]+)/);
    if (apSelMatch) {
      const dcode = parseInt(apSelMatch[1], 10);
      if (apertures.has(dcode)) {
        flushActiveTrack();
        currentAperture = dcode;
        const ap = apertures.get(dcode)!;
        activeTrackWidth = ap.dims[0] || 0.25;
      }
    }

    // Action code (D01, D02, D03)
    const actionMatch = block.match(/D0(1|2|3)\*?$/) || block.match(/D(1|2|3)\*?$/);
    const action = actionMatch ? parseInt(actionMatch[1], 10) : null;

    if (hasX || hasY || action) {
      const act = action !== null ? action : 1; // Default to D01 if movement happened without explicit D-code

      if (act === 2) {
        // D02: Move (Pen Up)
        flushActiveTrack();
        currentX = targetX;
        currentY = targetY;
        activeTrackPoints = [{ x: currentX, y: currentY }];
      } else if (act === 1) {
        // D01: Draw (Pen Down)
        if (activeTrackPoints.length === 0) {
          activeTrackPoints.push({ x: currentX, y: currentY });
        }
        activeTrackPoints.push({ x: targetX, y: targetY });

        if (layerId === "outline") {
          outlineSegments.push({
            x1: currentX,
            y1: currentY,
            x2: targetX,
            y2: targetY,
          });
        }

        currentX = targetX;
        currentY = targetY;
      } else if (act === 3) {
        // D03: Flash (Stamp Aperture)
        currentX = targetX;
        currentY = targetY;
        flushActiveTrack();

        if (currentAperture && apertures.has(currentAperture)) {
          const ap = apertures.get(currentAperture)!;
          const w = ap.dims[0] || 1.0;
          const h = ap.dims[1] || w;

          if (layerId === "top_copper" || layerId === "bottom_copper") {
            pads.push({
              id: `pad-imported-${Math.random().toString(36).substr(2, 9)}`,
              x: currentX,
              y: currentY,
              width: w,
              height: h,
              shape: ap.shape === "R" || ap.shape === "O" ? "rect" : "circle",
              layer: layerId === "bottom_copper" ? "bottom_copper" : "top_copper",
              number: String(pads.length + 1),
            });
          }
        }
      }
    }
  }

  // Flush any remaining active track
  flushActiveTrack();

  return { tracks, pads, outlineSegments };
}

/**
 * Parses an Excellon NC Drill file string and extracts vias (drill holes).
 */
export function parseExcellonFile(content: string): PcbVia[] {
  const vias: PcbVia[] = [];
  let units: "mm" | "inch" = "mm";
  const tools = new Map<number, number>(); // Tool code -> diameter in mm
  let activeTool: number | null = null;

  const lines = content.split("\n");

  for (let line of lines) {
    line = line.trim().toUpperCase();
    if (!line || line.startsWith(";")) continue;

    // Unit settings
    if (line.includes("METRIC") || line.includes("M71")) {
      units = "mm";
      continue;
    } else if (line.includes("INCH") || line.includes("M72")) {
      units = "inch";
      continue;
    }

    // Tool Definition: e.g. T01C1.0 or T1C0.8
    if (line.startsWith("T") && line.includes("C")) {
      const toolMatch = line.match(/^T([0-9]+)C([0-9.]+)/);
      if (toolMatch) {
        const tnum = parseInt(toolMatch[1], 10);
        let dia = parseFloat(toolMatch[2]);
        if (units === "inch") {
          dia *= 25.4;
        }
        tools.set(tnum, dia);
      }
      continue;
    }

    // Tool select: e.g. T01 or T1
    if (line.startsWith("T") && !line.includes("C")) {
      const toolSelMatch = line.match(/^T([0-9]+)/);
      if (toolSelMatch) {
        activeTool = parseInt(toolSelMatch[1], 10);
      }
      continue;
    }

    // Drill hit coordinate: e.g. X12.345Y67.890
    if (line.startsWith("X") || line.startsWith("Y")) {
      let x = 0;
      let y = 0;
      let hasX = false;
      let hasY = false;

      const xMatch = line.match(/X([-+]?[0-9.]+)/);
      if (xMatch) {
        x = parseFloat(xMatch[1]);
        if (units === "inch" && !xMatch[1].includes(".")) {
          x /= 10000; // handle non-decimal scaled
        }
        if (units === "inch") x *= 25.4;
        hasX = true;
      }

      const yMatch = line.match(/Y([-+]?[0-9.]+)/);
      if (yMatch) {
        y = parseFloat(yMatch[1]);
        if (units === "inch" && !yMatch[1].includes(".")) {
          y /= 10000;
        }
        if (units === "inch") y *= 25.4;
        hasY = true;
      }

      if (hasX || hasY) {
        const drillDia = activeTool && tools.has(activeTool) ? tools.get(activeTool)! : 0.8;
        vias.push({
          id: `via-imported-${Math.random().toString(36).substr(2, 9)}`,
          x,
          y,
          drill: drillDia,
          diameter: drillDia + 0.4, // Standard annular ring
        });
      }
    }
  }

  return vias;
}

/**
 * Determines if a file is an Excellon drill file based on its contents.
 */
export function isDrillContent(content: string): boolean {
  const normalized = content.toUpperCase();
  if (normalized.includes("M48") || normalized.includes("METRIC") || normalized.includes("INCH") || normalized.includes("M71") || normalized.includes("M72")) {
    if (!normalized.includes("%MOMM") && !normalized.includes("%MOIN") && !normalized.includes("%FSLA")) {
      return true;
    }
  }
  // Check for tool definitions, e.g. T01C1.2 or T1C0.8
  if (/T\d+C\d+/.test(normalized) || /T0\d+C/.test(normalized)) {
    return true;
  }
  // Check if it has many drill coordinates and no G01/G02/D01/D02/D03 commands
  const lines = normalized.split("\n");
  let drillCoordCount = 0;
  let gerberCommandCount = 0;
  for (let i = 0; i < Math.min(lines.length, 100); i++) {
    const line = lines[i].trim();
    if (line.startsWith("X") || line.startsWith("Y")) {
      if (!line.includes("*") && !line.includes("D")) {
        drillCoordCount++;
      }
    }
    if (line.includes("*") || line.includes("D01") || line.includes("D02") || line.includes("D03")) {
      gerberCommandCount++;
    }
  }
  if (drillCoordCount > 5 && gerberCommandCount === 0) {
    return true;
  }
  return false;
}

/**
 * Detects the layer type based on keywords inside comments or content header blocks.
 */
export function detectLayerByContent(content: string): PcbLayerId | "drill" | null {
  if (isDrillContent(content)) {
    return "drill";
  }

  const header = content.slice(0, 10000).toLowerCase();

  // Gerber X2 Attribute Detection (%TF.FileFunction,...)
  if (header.includes("%tf.filefunction")) {
    if (header.includes("copper,l1,top") || header.includes("top,cu") || header.includes("copper,top")) return "top_copper";
    if (header.includes("copper,l2,bot") || header.includes("bot,cu") || header.includes("copper,bot")) return "bottom_copper";
    if (header.includes("legend,top") || header.includes("silk,top")) return "silkscreen";
    if (header.includes("legend,bot") || header.includes("silk,bot")) return "bottom_silkscreen";
    if (header.includes("soldermask,top") || header.includes("mask,top")) return "solder_mask";
    if (header.includes("soldermask,bot") || header.includes("mask,bot")) return "bottom_solder_mask";
    if (header.includes("profile") || header.includes("outline")) return "outline";
  }

  // 1. Outline (Board edge/profile)
  if (
    header.includes("edge.cuts") ||
    header.includes("edge_cuts") ||
    header.includes("edgecuts") ||
    header.includes("board outline") ||
    header.includes("boardoutline") ||
    header.includes("board_outline") ||
    header.includes("gko") ||
    header.includes("outline layer") ||
    header.includes("profile layer") ||
    header.includes("layer: outline") ||
    header.includes("layer: profile")
  ) {
    return "outline";
  }

  // 2. Top Copper
  if (
    header.includes("f.cu") ||
    header.includes("f_cu") ||
    header.includes("top copper") ||
    header.includes("topcopper") ||
    header.includes("top_copper") ||
    header.includes("layer: top copper") ||
    header.includes("layer: top_copper") ||
    header.includes("layer 1") ||
    header.includes("layer: f.cu") ||
    header.includes("gtl")
  ) {
    return "top_copper";
  }

  // 3. Bottom Copper
  if (
    header.includes("b.cu") ||
    header.includes("b_cu") ||
    header.includes("bottom copper") ||
    header.includes("bottomcopper") ||
    header.includes("bottom_copper") ||
    header.includes("layer: bottom copper") ||
    header.includes("layer: bottom_copper") ||
    header.includes("layer 2") ||
    header.includes("layer: b.cu") ||
    header.includes("gbl")
  ) {
    return "bottom_copper";
  }

  // 4. Top Silkscreen
  if (
    header.includes("f.silks") ||
    header.includes("f.silk") ||
    header.includes("f_silk") ||
    header.includes("top silk") ||
    header.includes("topsilk") ||
    header.includes("top_silk") ||
    header.includes("top silkscreen") ||
    header.includes("silkscreen top") ||
    header.includes("layer: f.silks") ||
    header.includes("gto")
  ) {
    return "silkscreen";
  }

  // 5. Bottom Silkscreen
  if (
    header.includes("b.silks") ||
    header.includes("b.silk") ||
    header.includes("b_silk") ||
    header.includes("bottom silk") ||
    header.includes("bottomsilk") ||
    header.includes("bottom_silk") ||
    header.includes("bottom silkscreen") ||
    header.includes("silkscreen bottom") ||
    header.includes("layer: b.silks") ||
    header.includes("gbo")
  ) {
    return "bottom_silkscreen";
  }

  // 6. Top Solder Mask
  if (
    header.includes("f.mask") ||
    header.includes("f_mask") ||
    header.includes("top mask") ||
    header.includes("topmask") ||
    header.includes("top_mask") ||
    header.includes("top soldermask") ||
    header.includes("soldermask top") ||
    header.includes("solder mask top") ||
    header.includes("layer: f.mask") ||
    header.includes("gts")
  ) {
    return "solder_mask";
  }

  // 7. Bottom Solder Mask
  if (
    header.includes("b.mask") ||
    header.includes("b_mask") ||
    header.includes("bottom mask") ||
    header.includes("bottommask") ||
    header.includes("bottom_mask") ||
    header.includes("bottom soldermask") ||
    header.includes("soldermask bottom") ||
    header.includes("solder mask bottom") ||
    header.includes("layer: b.mask") ||
    header.includes("gbs")
  ) {
    return "bottom_solder_mask";
  }

  return null;
}

/**
 * Combines filename rules and internal file content indicators to accurately identify a file's role.
 */
export function detectLayerByFilenameAndContent(filename: string, content: string): PcbLayerId | "drill" | null {
  const fn = filename.toLowerCase();

  // First, check if content is definitely drill
  if (isDrillContent(content)) {
    return "drill";
  }

  // Check specific extensions first (standard/common extensions)
  if (fn.endsWith(".gtl") || fn.endsWith(".cmp") || fn.endsWith(".top") || fn.endsWith(".g1") || fn.endsWith(".tcu")) {
    return "top_copper";
  }
  if (fn.endsWith(".gbl") || fn.endsWith(".sol") || fn.endsWith(".bot") || fn.endsWith(".g2") || fn.endsWith(".bcu") || fn.endsWith(".bottom")) {
    return "bottom_copper";
  }
  if (fn.endsWith(".gko") || fn.endsWith(".gml") || fn.endsWith(".profile") || fn.endsWith(".outline") || fn.endsWith(".gm1") || fn.endsWith(".gm20") || fn.endsWith(".edge") || fn.endsWith(".cuts")) {
    return "outline";
  }
  if (fn.endsWith(".gto") || fn.endsWith(".plc") || fn.endsWith(".tsilk") || fn.endsWith(".gtsilk") || fn.endsWith(".legend_top")) {
    return "silkscreen";
  }
  if (fn.endsWith(".gbo") || fn.endsWith(".pls") || fn.endsWith(".bsilk") || fn.endsWith(".gbsilk") || fn.endsWith(".legend_bottom")) {
    return "bottom_silkscreen";
  }
  if (fn.endsWith(".gts") || fn.endsWith(".stc") || fn.endsWith(".tsold") || fn.endsWith(".mask_top") || fn.endsWith(".f_mask")) {
    return "solder_mask";
  }
  if (fn.endsWith(".gbs") || fn.endsWith(".sts") || fn.endsWith(".bsold") || fn.endsWith(".mask_bot") || fn.endsWith(".b_mask")) {
    return "bottom_solder_mask";
  }
  if (fn.endsWith(".drl") || fn.endsWith(".txt") || fn.endsWith(".xln") || fn.endsWith(".drill") || fn.endsWith(".exc") || fn.endsWith(".tap")) {
    return "drill";
  }

  // If the extension is generic (e.g. .gbr) or unrecognized, check keywords in filename
  if (
    fn.includes("outline") ||
    fn.includes("profile") ||
    fn.includes("edge_cuts") ||
    fn.includes("edgecuts") ||
    fn.includes("edge.cuts") ||
    fn.includes("contour") ||
    fn.includes("border") ||
    fn.includes("mechanical") ||
    fn.includes("mech") ||
    fn.includes("dimension") ||
    fn.includes("gko") ||
    fn.includes("gml")
  ) {
    return "outline";
  }

  if (
    fn.includes("drill") ||
    fn.includes("excellon") ||
    fn.includes("plated") ||
    fn.includes("nonplated") ||
    fn.includes("npth") ||
    fn.includes("pth") ||
    fn.includes("drl") ||
    fn.includes("txt") ||
    fn.includes("xln")
  ) {
    return "drill";
  }

  if (
    fn.includes("top_copper") ||
    fn.includes("topcopper") ||
    fn.includes("top.copper") ||
    fn.includes("copper_top") ||
    fn.includes("copper.top") ||
    fn.includes("f.cu") ||
    fn.includes("f_cu") ||
    fn.includes("f-cu") ||
    fn.includes("top_cu") ||
    fn.includes("top.cu") ||
    fn.includes("top-cu") ||
    fn.includes("signal_top") ||
    fn.includes("layer1") ||
    fn.includes("layer_1") ||
    fn.includes("gtl")
  ) {
    return "top_copper";
  }

  if (
    fn.includes("bottom_copper") ||
    fn.includes("bottomcopper") ||
    fn.includes("bottom.copper") ||
    fn.includes("copper_bottom") ||
    fn.includes("copper.bottom") ||
    fn.includes("b.cu") ||
    fn.includes("b_cu") ||
    fn.includes("b-cu") ||
    fn.includes("bottom_cu") ||
    fn.includes("bottom.cu") ||
    fn.includes("bottom-cu") ||
    fn.includes("signal_bottom") ||
    fn.includes("layer2") ||
    fn.includes("layer_2") ||
    fn.includes("bot_copper") ||
    fn.includes("bot.copper") ||
    fn.includes("bot_cu") ||
    fn.includes("bot.cu") ||
    fn.includes("gbl")
  ) {
    return "bottom_copper";
  }

  if (
    fn.includes("top_silk") ||
    fn.includes("topsilk") ||
    fn.includes("top.silk") ||
    fn.includes("top_silkscreen") ||
    fn.includes("silkscreen_top") ||
    fn.includes("silkscreen.top") ||
    fn.includes("f.silk") ||
    fn.includes("f_silk") ||
    fn.includes("f-silk") ||
    fn.includes("legend_top") ||
    fn.includes("gto")
  ) {
    return "silkscreen";
  }

  if (
    fn.includes("bottom_silk") ||
    fn.includes("bottomsilk") ||
    fn.includes("bottom.silk") ||
    fn.includes("bottom_silkscreen") ||
    fn.includes("silkscreen_bottom") ||
    fn.includes("silkscreen.bottom") ||
    fn.includes("b.silk") ||
    fn.includes("b_silk") ||
    fn.includes("b-silk") ||
    fn.includes("legend_bottom") ||
    fn.includes("bot_silk") ||
    fn.includes("botsilk") ||
    fn.includes("bot.silk") ||
    fn.includes("gbo")
  ) {
    return "bottom_silkscreen";
  }

  if (
    fn.includes("top_solder") ||
    fn.includes("topsoldermask") ||
    fn.includes("top_mask") ||
    fn.includes("top.mask") ||
    fn.includes("solder_mask_top") ||
    fn.includes("soldermask_top") ||
    fn.includes("solder-mask-top") ||
    fn.includes("f.mask") ||
    fn.includes("f_mask") ||
    fn.includes("f-mask") ||
    fn.includes("solder_stop_top") ||
    fn.includes("solderstop_top") ||
    fn.includes("gts")
  ) {
    return "solder_mask";
  }

  if (
    fn.includes("bottom_solder") ||
    fn.includes("bottomsoldermask") ||
    fn.includes("bottom_mask") ||
    fn.includes("bottom.mask") ||
    fn.includes("solder_mask_bottom") ||
    fn.includes("soldermask_bottom") ||
    fn.includes("solder-mask-bottom") ||
    fn.includes("b.mask") ||
    fn.includes("b_mask") ||
    fn.includes("b-mask") ||
    fn.includes("solder_stop_bottom") ||
    fn.includes("solderstop_bottom") ||
    fn.includes("bot_solder") ||
    fn.includes("bot_mask") ||
    fn.includes("gbs")
  ) {
    return "bottom_solder_mask";
  }

  // Fallback to internal content-based detection
  const detectedByContent = detectLayerByContent(content);
  if (detectedByContent) {
    return detectedByContent;
  }

  // Check generic indicators in content body
  const lowerContent = content.toLowerCase();
  if (lowerContent.includes("top") || lowerContent.includes("f.cu") || lowerContent.includes("gtl")) {
    return "top_copper";
  }
  if (lowerContent.includes("bottom") || lowerContent.includes("b.cu") || lowerContent.includes("gbl")) {
    return "bottom_copper";
  }

  return null;
}

/**
 * Main import coordinator. Reads files from a ZIP, single Gerber file, or multiple Gerber files,
 * creates a new Gerber project, scales/centers all components, and returns a SchematicDoc.
 */
export async function importGerberToProject(
  fileInput: File | File[] | FileList,
  lang: "ar" | "en"
): Promise<{ doc: SchematicDoc; name: string }> {
  const doc = emptyPcbDoc();
  
  // Normalize fileInput to an array of File objects
  let files: File[] = [];
  if (fileInput instanceof FileList) {
    files = Array.from(fileInput);
  } else if (Array.isArray(fileInput)) {
    files = fileInput;
  } else if (fileInput) {
    files = [fileInput];
  }

  if (files.length === 0) {
    return {
      name: "Empty Project",
      doc: {
        nodes: [],
        wires: [],
        canvasColor: "white",
        defaultWireColor: "black",
        pcb: emptyPcbDoc(),
      },
    };
  }

  let name = "";
  if (files.length === 1) {
    name = files[0].name.replace(/\.[^/.]+$/, "");
  } else {
    const firstBase = files[0].name.replace(/\.[^/.]+$/, "");
    name = firstBase + " Set";
  }

  const tracks: PcbTrack[] = [];
  const pads: PcbPad[] = [];
  const vias: PcbVia[] = [];
  const outlineSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];

  const addFileResult = (res: { tracks: PcbTrack[]; pads: PcbPad[]; outlineSegments: { x1: number; y1: number; x2: number; y2: number }[] }) => {
    tracks.push(...res.tracks);
    pads.push(...res.pads);
    outlineSegments.push(...res.outlineSegments);
  };

  for (const file of files) {
    // Check if file is ZIP
    if (file.name.toLowerCase().endsWith(".zip")) {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);
      
      for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
        if (zipEntry.dir) continue;
        const text = await zipEntry.async("string");
        const detected = detectLayerByFilenameAndContent(relativePath, text);
        if (!detected) continue;

        if (detected === "drill") {
          vias.push(...parseExcellonFile(text));
        } else {
          addFileResult(parseGerberFile(text, detected));
        }
      }
    } else {
      // Single file processing (either as a single file or part of multiple selection)
      const text = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsText(file);
      });

      const detected = detectLayerByFilenameAndContent(file.name, text);
      if (detected === "drill") {
        vias.push(...parseExcellonFile(text));
      } else if (detected) {
        addFileResult(parseGerberFile(text, detected));
      } else {
        // Fallback for completely unrecognized files
        addFileResult(parseGerberFile(text, "top_copper"));
      }
    }
  }

  // 1. Calculate Bounding Box of all imported items
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  const updateBounds = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  tracks.forEach((t) => t.points.forEach((p) => updateBounds(p.x, p.y)));
  pads.forEach((p) => updateBounds(p.x, p.y));
  vias.forEach((v) => updateBounds(v.x, v.y));
  outlineSegments.forEach((s) => {
    updateBounds(s.x1, s.y1);
    updateBounds(s.x2, s.y2);
  });

  // If no elements were parsed, or coordinates are extreme/empty
  if (minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
    // Return an empty document
    return {
      name: name + " (Empty Gerber)",
      doc: {
        nodes: [],
        wires: [],
        canvasColor: "white",
        defaultWireColor: "black",
        pcb: emptyPcbDoc(),
      },
    };
  }

  // Bounding box size (Real physical size of the PCB)
  const boardWidth = Number((maxX - minX).toFixed(3));
  const boardHeight = Number((maxY - minY).toFixed(3));

  // Offset so that the minimum coordinate of the design aligns perfectly with (0,0) of the board
  const offsetX = -minX;
  const offsetY = -minY;

  // 2. Adjust all elements coordinates
  tracks.forEach((t) => {
    t.points = t.points.map((p) => ({
      x: Number((p.x + offsetX).toFixed(3)),
      y: Number((p.y + offsetY).toFixed(3)),
    }));
  });

  pads.forEach((p) => {
    p.x = Number((p.x + offsetX).toFixed(3));
    p.y = Number((p.y + offsetY).toFixed(3));
  });

  vias.forEach((v) => {
    v.x = Number((v.x + offsetX).toFixed(3));
    v.y = Number((v.y + offsetY).toFixed(3));
  });

  // Assemble PcbDoc
  doc.width = boardWidth;
  doc.height = boardHeight;
  doc.tracks = tracks;
  doc.pads = pads;
  doc.vias = vias;
  doc.footprints = [];
  doc.isImportedGerber = true;

  // Return full SchematicDoc
  return {
    name,
    doc: {
      nodes: [],
      wires: [],
      canvasColor: "white",
      defaultWireColor: "black",
      pcb: doc,
    },
  };
}
