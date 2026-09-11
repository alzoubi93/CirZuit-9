import JSZip from "jszip";
import { PcbDoc, PcbTrack, PcbPad, PcbVia, PcbLayerId, emptyPcbDoc } from "./pcb";
import { SchematicDoc } from "./schematic";

// Standard layer mapping
function mapLayerId(name: string): PcbLayerId {
  const norm = name.toLowerCase().replace(/[^a-z0-9]/g, "_");
  if (norm.includes("top_copper") || norm === "top" || norm === "gtl") return "top_copper";
  if (norm.includes("bottom_copper") || norm === "bottom" || norm === "bot" || norm === "gbl") return "bottom_copper";
  if (norm.includes("silkscreen_top") || norm.includes("top_silkscreen") || norm === "silk_top" || norm === "silkscreen" || norm === "comp" || norm === "gto") return "silkscreen";
  if (norm.includes("silkscreen_bottom") || norm.includes("bottom_silkscreen") || norm === "silk_bottom" || norm === "sold" || norm === "gbo") return "bottom_silkscreen";
  if (norm.includes("solder_mask_top") || norm === "solder_mask" || norm === "st_top" || norm === "gts") return "solder_mask";
  if (norm.includes("solder_mask_bottom") || norm === "st_bot" || norm === "gbs") return "bottom_solder_mask";
  if (norm.includes("drill") || norm === "drills" || norm === "drl") return "drill";
  if (norm.includes("outline") || norm === "profile" || norm === "board_outline" || norm === "gko") return "outline";
  
  // Default fallbacks
  if (norm.includes("top")) return "top_copper";
  if (norm.includes("bottom") || norm.includes("bot")) return "bottom_copper";
  
  return "top_copper";
}

/**
 * Parsed feature shape mapping helper for ODB++ symbols.
 */
function parseOdbSymbol(symName: string, unitFactor: number): { shape: "rect" | "circle"; width: number; height: number } {
  const norm = symName.toLowerCase();
  
  // Round symbol e.g., "r50" (diameter 50)
  if (norm.startsWith("r")) {
    const val = parseFloat(norm.slice(1));
    if (!isNaN(val)) {
      const d = val * unitFactor;
      return { shape: "circle", width: d, height: d };
    }
  }
  // Square symbol e.g., "s50" (side 50)
  if (norm.startsWith("s")) {
    const val = parseFloat(norm.slice(1));
    if (!isNaN(val)) {
      const s = val * unitFactor;
      return { shape: "rect", width: s, height: s };
    }
  }
  // Rectangle symbol e.g., "rect20x40"
  if (norm.startsWith("rect") || norm.startsWith("rectangle")) {
    const match = norm.match(/rect(?:angle)?(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
    if (match) {
      const w = parseFloat(match[1]) * unitFactor;
      const h = parseFloat(match[2]) * unitFactor;
      return { shape: "rect", width: w, height: h };
    }
  }
  // Oval symbol e.g., "oval20x40"
  if (norm.startsWith("oval")) {
    const match = norm.match(/oval(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)/);
    if (match) {
      const w = parseFloat(match[1]) * unitFactor;
      const h = parseFloat(match[2]) * unitFactor;
      return { shape: "circle", width: w, height: h };
    }
  }

  // Fallback default
  const defaultVal = parseFloat(norm.replace(/[^0-9.]/g, "")) || 10;
  const size = defaultVal * unitFactor;
  return { shape: "circle", width: size, height: size };
}

/**
 * Checks if a zip archive contains ODB++ structure.
 */
export async function isOdbZip(file: File): Promise<boolean> {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    return Object.keys(contents.files).some(
      (path) => path.includes("steps/") || path.includes("matrix/") || path.includes("misc/info")
    );
  } catch {
    return false;
  }
}

/**
 * Checks if content is IPC-2581 XML.
 */
export function isIpc2581Content(text: string): boolean {
  return text.includes("<IPC-2581") || text.includes("<ipc-2581") || text.includes("xmlns=\"http://webstds.ipc.org/2581\"");
}

/**
 * Parses IPC-2581 XML format and returns a SchematicDoc.
 */
export function parseIpc2581(xmlText: string, filename: string, lang: "ar" | "en"): { doc: SchematicDoc; name: string } {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlText, "text/xml");
  
  const tracks: PcbTrack[] = [];
  const pads: PcbPad[] = [];
  const vias: PcbVia[] = [];
  const outlineSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];

  // 1. Detect Units
  // IPC-2581 unit is specified in <Content> under <Header> or similar, e.g. <Units>Millimeter</Units>
  let unitFactor = 1.0; // Default to Millimeters
  const unitEl = xmlDoc.getElementsByTagName("Units")[0] || xmlDoc.getElementsByTagName("units")[0];
  if (unitEl) {
    const u = unitEl.textContent?.trim().toLowerCase();
    if (u === "inch" || u === "inches" || u === "in") {
      unitFactor = 25.4;
    } else if (u === "micron" || u === "microns") {
      unitFactor = 0.001;
    } else if (u === "mil" || u === "mils") {
      unitFactor = 0.0254;
    }
  }

  // 2. Parse Layer Features
  // LayerFeature node contains actual graphical features for a layer
  const layerFeatures = xmlDoc.getElementsByTagName("LayerFeature") || xmlDoc.getElementsByTagName("layerFeature");
  
  for (let i = 0; i < layerFeatures.length; i++) {
    const lf = layerFeatures[i];
    const layerAttr = lf.getAttribute("layer") || lf.getAttribute("LayerName") || "top_copper";
    const layerId = mapLayerId(layerAttr);

    // Process traces / polylines
    // Trace elements can have Polyline with Vertices
    const polylines = lf.getElementsByTagName("Polyline") || lf.getElementsByTagName("polyline") || lf.getElementsByTagName("Trace");
    for (let j = 0; j < polylines.length; j++) {
      const pl = polylines[j];
      const widthAttr = pl.getAttribute("width") || pl.getAttribute("Width") || "0.254";
      const width = parseFloat(widthAttr) * unitFactor;

      const pts: { x: number; y: number }[] = [];
      const vertices = pl.getElementsByTagName("Vertex") || pl.getElementsByTagName("vertex") || pl.getElementsByTagName("Point") || pl.getElementsByTagName("point");
      
      for (let k = 0; k < vertices.length; k++) {
        const v = vertices[k];
        const xAttr = v.getAttribute("x") || v.getAttribute("X") || "0";
        const yAttr = v.getAttribute("y") || v.getAttribute("Y") || "0";
        pts.push({
          x: parseFloat(xAttr) * unitFactor,
          y: parseFloat(yAttr) * unitFactor
        });
      }

      if (pts.length >= 2) {
        if (layerId === "outline") {
          for (let k = 0; k < pts.length - 1; k++) {
            outlineSegments.push({ x1: pts[k].x, y1: pts[k].y, x2: pts[k + 1].x, y2: pts[k + 1].y });
          }
        } else {
          tracks.push({
            id: crypto.randomUUID(),
            layer: layerId,
            width: width || 0.254,
            points: pts
          });
        }
      }
    }

    // Process Pads / Features
    const pEls = lf.getElementsByTagName("Pad") || lf.getElementsByTagName("pad") || lf.getElementsByTagName("Feature");
    for (let j = 0; j < pEls.length; j++) {
      const pEl = pEls[j];
      const location = pEl.getElementsByTagName("Location")[0] || pEl.getElementsByTagName("location")[0] || pEl;
      const xAttr = location.getAttribute("x") || location.getAttribute("X");
      const yAttr = location.getAttribute("y") || location.getAttribute("Y");
      
      if (xAttr !== null && yAttr !== null) {
        const px = parseFloat(xAttr) * unitFactor;
        const py = parseFloat(yAttr) * unitFactor;
        
        // Shape and size
        const diameterAttr = pEl.getAttribute("diameter") || pEl.getAttribute("Diameter") || pEl.getAttribute("size") || "1.0";
        const diameter = parseFloat(diameterAttr) * unitFactor;
        
        if (layerId === "drill") {
          vias.push({
            id: crypto.randomUUID(),
            x: px,
            y: py,
            drill: diameter || 0.6,
            diameter: (diameter || 0.6) + 0.4
          });
        } else {
          pads.push({
            id: crypto.randomUUID(),
            x: px,
            y: py,
            width: diameter,
            height: diameter,
            shape: "circle",
            layer: layerId === "bottom_copper" ? "bottom_copper" : "top_copper"
          });
        }
      }
    }
  }

  // Scale and center geometry
  return processParsedGeometry(tracks, pads, vias, outlineSegments, filename);
}

/**
 * Parses ODB++ archive (.zip containing steps/ and layers/).
 */
export async function parseOdbZipToProject(file: File, lang: "ar" | "en"): Promise<{ doc: SchematicDoc; name: string }> {
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  
  const tracks: PcbTrack[] = [];
  const pads: PcbPad[] = [];
  const vias: PcbVia[] = [];
  const outlineSegments: { x1: number; y1: number; x2: number; y2: number }[] = [];

  // ODB++ unit. Default is Inch (all coordinates in features file are usually in inches, e.g. 0.0001 resolution)
  // Or if we detect metric setting in matrix/misc
  let unitFactor = 25.4; // Default to Inch -> MM conversion

  // 1. Scan ZIP to find feature files
  for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
    if (zipEntry.dir) continue;

    // Check for units inside misc/info or layer headers
    if (relativePath.includes("misc/info") || relativePath.includes("matrix/matrix")) {
      const text = await zipEntry.async("string");
      if (text.toLowerCase().includes("metric") || text.toLowerCase().includes("units=mm")) {
        unitFactor = 1.0; // Metrics directly!
      }
    }
  }

  // 2. Parse feature files
  for (const [relativePath, zipEntry] of Object.entries(contents.files)) {
    if (zipEntry.dir) continue;

    // We look for files matching steps/<step_name>/layers/<layer_name>/features
    const layerMatch = relativePath.match(/steps\/[^/]+\/layers\/([^/]+)\/features$/i);
    if (!layerMatch) continue;

    const layerName = layerMatch[1];
    const layerId = mapLayerId(layerName);
    const text = await zipEntry.async("string");

    // Parse features file
    const lines = text.split("\n");
    const symbolsMap = new Map<string, string>(); // index -> symbol description e.g. '1' -> 'r50'

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith("#") || line.startsWith(";")) continue;

      // Symbol definition: e.g. $1 r50 or $2 rect30x60
      if (line.startsWith("$")) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          const symIndex = parts[0].slice(1);
          symbolsMap.set(symIndex, parts[1]);
        }
        continue;
      }

      const parts = line.split(/\s+/);
      const featureType = parts[0];

      if (featureType === "L") {
        // Line format: L <xs> <ys> <xe> <ye> <sym_num> <polarity>
        if (parts.length >= 6) {
          const x1 = parseFloat(parts[1]) * unitFactor;
          const y1 = parseFloat(parts[2]) * unitFactor;
          const x2 = parseFloat(parts[3]) * unitFactor;
          const y2 = parseFloat(parts[4]) * unitFactor;
          const symIndex = parts[5];
          
          let traceWidth = 0.254; // Fallback
          const symName = symbolsMap.get(symIndex);
          if (symName) {
            traceWidth = parseOdbSymbol(symName, unitFactor).width;
          }

          if (layerId === "outline") {
            outlineSegments.push({ x1, y1, x2, y2 });
          } else {
            tracks.push({
              id: crypto.randomUUID(),
              layer: layerId,
              width: traceWidth || 0.254,
              points: [
                { x: x1, y: y1 },
                { x: x2, y: y2 }
              ]
            });
          }
        }
      } else if (featureType === "P") {
        // Pad format: P <x> <y> <sym_num> <polarity>
        if (parts.length >= 4) {
          const px = parseFloat(parts[1]) * unitFactor;
          const py = parseFloat(parts[2]) * unitFactor;
          const symIndex = parts[3];

          let symInfo = { shape: "circle" as "circle" | "rect", width: 1.0, height: 1.0 };
          const symName = symbolsMap.get(symIndex);
          if (symName) {
            symInfo = parseOdbSymbol(symName, unitFactor);
          }

          if (layerId === "drill") {
            vias.push({
              id: crypto.randomUUID(),
              x: px,
              y: py,
              drill: symInfo.width || 0.6,
              diameter: (symInfo.width || 0.6) + 0.4
            });
          } else {
            pads.push({
              id: crypto.randomUUID(),
              x: px,
              y: py,
              width: symInfo.width || 1.0,
              height: symInfo.height || 1.0,
              shape: symInfo.shape,
              layer: layerId === "bottom_copper" ? "bottom_copper" : "top_copper"
            });
          }
        }
      }
    }
  }

  return processParsedGeometry(tracks, pads, vias, outlineSegments, file.name.replace(/\.[^/.]+$/, ""));
}

/**
 * Centering, scaling, and building the final SchematicDoc.
 */
function processParsedGeometry(
  tracks: PcbTrack[],
  pads: PcbPad[],
  vias: PcbVia[],
  outlineSegments: { x1: number; y1: number; x2: number; y2: number }[],
  projectName: string
): { doc: SchematicDoc; name: string } {
  // Find Bounding Box
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

  // Empty fallback
  if (minX === Infinity || maxX === -Infinity || minY === Infinity || maxY === -Infinity) {
    return {
      name: projectName,
      doc: {
        nodes: [],
        wires: [],
        canvasColor: "white",
        defaultWireColor: "black",
        pcb: emptyPcbDoc()
      }
    };
  }

  const boardWidth = Number((maxX - minX).toFixed(3));
  const boardHeight = Number((maxY - minY).toFixed(3));

  const offsetX = -minX;
  const offsetY = -minY;

  // Apply Offset & clean values
  tracks.forEach((t) => {
    t.points = t.points.map((p) => ({
      x: Number((p.x + offsetX).toFixed(3)),
      y: Number((p.y + offsetY).toFixed(3))
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

  // Convert outlineSegments to outline tracks
  outlineSegments.forEach((s) => {
    tracks.push({
      id: crypto.randomUUID(),
      layer: "outline",
      width: 0.15,
      points: [
        { x: Number((s.x1 + offsetX).toFixed(3)), y: Number((s.y1 + offsetY).toFixed(3)) },
        { x: Number((s.x2 + offsetX).toFixed(3)), y: Number((s.y2 + offsetY).toFixed(3)) }
      ]
    });
  });

  const pcbDoc = emptyPcbDoc();
  pcbDoc.width = boardWidth || 80;
  pcbDoc.height = boardHeight || 60;
  pcbDoc.tracks = tracks;
  pcbDoc.pads = pads;
  pcbDoc.vias = vias;
  pcbDoc.isImportedGerber = true; // Treats imported features consistently for rendering/manipulation

  return {
    name: projectName,
    doc: {
      nodes: [],
      wires: [],
      canvasColor: "white",
      defaultWireColor: "black",
      pcb: pcbDoc
    }
  };
}
