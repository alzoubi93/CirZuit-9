// Gerber RS-274X and Excellon NC Drill Exporter for CirZuit.
import JSZip from "jszip";
import { PcbDoc, PcbTrack, PcbVia, PcbPad, PcbFootprint, PcbLayerId, isCopperLayer, isViaOnLayer, getViaSpannedLayers, determineViaType, normalizeLayerId } from "./pcb";
import { getTrackArcGeometry } from "./arcGeometry";
import { SchematicDoc } from "./schematic";
import { buildNetIndex } from "./netlist";

// Simple Vector Stroke Font Dictionary for Gerber and Silkscreen export
const STROKE_FONT: Record<string, [number, number, number, number][]> = {
  "A": [[0,0, 0,6], [0,6, 3,10], [3,10, 6,6], [6,6, 6,0], [0,4, 6,4]],
  "B": [[0,0, 0,10], [0,10, 5,10], [5,10, 6,8], [6,8, 6,6], [6,6, 5,5], [5,5, 0,5], [5,5, 6,4], [6,4, 6,2], [6,2, 5,0], [5,0, 0,0]],
  "C": [[6,8, 4,10], [4,10, 1,10], [1,10, 0,8], [0,8, 0,2], [0,2, 1,0], [1,0, 4,0], [4,0, 6,2]],
  "D": [[0,0, 0,10], [0,10, 4,10], [4,10, 6,8], [6,8, 6,2], [6,2, 4,0], [4,0, 0,0]],
  "E": [[0,0, 0,10], [0,10, 6,10], [0,5, 5,5], [0,0, 6,0]],
  "F": [[0,0, 0,10], [0,10, 6,10], [0,5, 5,5]],
  "G": [[6,8, 4,10], [4,10, 1,10], [1,10, 0,8], [0,8, 0,2], [0,2, 1,0], [1,0, 5,0], [5,0, 6,2], [6,2, 6,5], [6,5, 3,5]],
  "H": [[0,0, 0,10], [6,0, 6,10], [0,5, 6,5]],
  "I": [[1,10, 5,10], [3,10, 3,0], [1,0, 5,0]],
  "J": [[0,2, 2,0], [2,0, 4,0], [4,0, 5,2], [5,2, 5,10]],
  "K": [[0,0, 0,10], [0,5, 5,10], [0,4, 5,0]],
  "L": [[0,10, 0,0], [0,0, 5,0]],
  "M": [[0,0, 0,10], [0,10, 3,5], [3,5, 6,10], [6,10, 6,0]],
  "N": [[0,0, 0,10], [0,10, 6,0], [6,0, 6,10]],
  "O": [[1,10, 5,10], [5,10, 6,8], [6,8, 6,2], [6,2, 5,0], [5,0, 1,0], [1,0, 0,2], [0,2, 0,8], [0,8, 1,10]],
  "P": [[0,0, 0,10], [0,10, 5,10], [5,10, 6,8], [6,8, 6,6], [6,6, 5,5], [5,5, 0,5]],
  "Q": [[1,10, 5,10], [5,10, 6,8], [6,8, 6,2], [6,2, 5,0], [5,0, 1,0], [1,0, 0,2], [0,2, 0,8], [0,8, 1,10], [4,2, 6,0]],
  "R": [[0,0, 0,10], [0,10, 5,10], [5,10, 6,8], [6,8, 6,6], [6,6, 5,5], [5,5, 0,5], [3,5, 6,0]],
  "S": [[0,2, 2,0], [2,0, 4,0], [4,0, 6,2], [6,2, 5,5], [5,5, 1,5], [1,5, 0,8], [0,8, 2,10], [2,10, 4,10], [4,10, 6,8]],
  "T": [[0,10, 6,10], [3,10, 3,0]],
  "U": [[0,10, 0,2], [0,2, 2,0], [2,0, 4,0], [4,0, 6,2], [6,2, 6,10]],
  "V": [[0,10, 3,0], [3,0, 6,10]],
  "W": [[0,10, 1,0], [1,0, 3,5], [3,5, 5,0], [5,0, 6,10]],
  "X": [[0,10, 6,0], [0,0, 6,10]],
  "Y": [[0,10, 3,5], [6,10, 3,5], [3,5, 3,0]],
  "Z": [[0,10, 6,10], [6,10, 0,0], [0,0, 6,0]],
  "0": [[1,10, 5,10], [5,10, 6,8], [6,8, 6,2], [6,2, 5,0], [5,0, 1,0], [1,0, 0,2], [0,2, 0,8], [0,8, 1,10], [0,10, 6,0]],
  "1": [[1,8, 3,10], [3,10, 3,0], [1,0, 5,0]],
  "2": [[0,8, 2,10], [2,10, 4,10], [4,10, 6,8], [6,8, 0,2], [0,2, 0,0], [0,0, 6,0]],
  "3": [[0,10, 6,10], [6,10, 3,5], [3,5, 5,5], [5,5, 6,3], [6,3, 6,1], [6,1, 4,0], [4,0, 0,0]],
  "4": [[0,10, 0,5], [0,5, 6,5], [5,10, 5,0]],
  "5": [[6,10, 0,10], [0,10, 0,5], [0,5, 5,5], [5,5, 6,4], [6,4, 6,1], [6,1, 4,0], [4,0, 0,0]],
  "6": [[5,10, 2,10], [2,10, 0,8], [0,8, 0,2], [0,2, 2,0], [2,0, 5,0], [5,0, 6,2], [6,2, 6,5], [6,5, 0,5]],
  "7": [[0,10, 6,10], [6,10, 2,0]],
  "8": [[2,10, 4,10], [4,10, 6,8], [6,8, 6,6], [6,6, 4,5], [4,5, 2,5], [2,5, 0,6], [0,6, 0,8], [0,8, 2,10], [4,5, 6,4], [6,4, 6,2], [6,2, 4,0], [4,0, 2,0], [2,0, 0,2], [0,2, 0,4], [0,4, 2,5]],
  "9": [[1,5, 6,5], [6,5, 6,8], [6,8, 4,10], [4,10, 1,10], [1,10, 0,8], [0,8, 0,6], [0,6, 2,5], [6,5, 4,0], [4,0, 1,0]],
  "-": [[2,5, 4,5]],
  ".": [[3,0, 3,1]],
  "+": [[3,2, 3,8], [1,5, 5,5]],
  "/": [[0,0, 6,10]],
  "_": [[0,0, 6,0]],
  " ": []
};

// Gerber 3 integer, 4 decimal places metric coordinate format helper
// e.g., coordinate 12.3456 mm becomes "123456"
const fC = (mm: number) => {
  return Math.round(mm * 10000).toString();
};

// Helper to convert characters into vector line sequences for Gerber plotting
function getTextStrokes(text: string, x: number, y: number, charSizeMm: number, rotation: number): { x1: number; y1: number; x2: number; y2: number }[] {
  const strokes: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const chars = text.toUpperCase().split("");
  const fontAspect = 10; // fonts defined in a 6x10 grid
  const charWidth = charSizeMm * 0.6;
  const spacing = charSizeMm * 0.2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  chars.forEach((char, index) => {
    const glyph = STROKE_FONT[char] || STROKE_FONT[" "];
    const dx = index * (charWidth + spacing);

    glyph.forEach(([sx1, sy1, sx2, sy2]) => {
      // Scale from font grid (0-6, 0-10) to target mm size
      const lx1 = dx + (sx1 / 6) * charWidth;
      const ly1 = (sy1 / fontAspect) * charSizeMm;
      const lx2 = dx + (sx2 / 6) * charWidth;
      const ly2 = (sy2 / fontAspect) * charSizeMm;

      // Apply rotation around starting x, y coordinate
      const worldX1 = x + (lx1 * cos - ly1 * sin);
      const worldY1 = y + (lx1 * sin + ly1 * cos);
      const worldX2 = x + (lx2 * cos - ly2 * sin);
      const worldY2 = y + (lx2 * sin + ly2 * cos);

      strokes.push({ x1: worldX1, y1: worldY1, x2: worldX2, y2: worldY2 });
    });
  });

  return strokes;
}

// Generate coordinate-based drill lines for the Excellon NC Drill file
export function generateNcDrill(pcb: PcbDoc, layerPair?: [PcbLayerId, PcbLayerId]): string {
  const drills: { x: number; y: number; diameter: number }[] = [];

  // Vias
  pcb.vias.forEach((v) => {
    if (layerPair) {
      const vL1 = normalizeLayerId(v.layers ? v.layers[0] : "top_copper");
      const vL2 = normalizeLayerId(v.layers ? v.layers[1] : "bottom_copper");
      const pL1 = normalizeLayerId(layerPair[0]);
      const pL2 = normalizeLayerId(layerPair[1]);
      const match = (vL1 === pL1 && vL2 === pL2) || (vL1 === pL2 && vL2 === pL1);
      if (!match) return;
    } else {
      // Default file: include through-hole vias, or all vias if no pair specified
      const type = determineViaType(v, pcb.layers);
      if (type !== "through" && v.layers && (v.layers[0] !== "top_copper" || v.layers[1] !== "bottom_copper")) {
        // If blind/buried, will have dedicated drill file, but still include if no layerPair filter
      }
    }
    const hX = v.x + (v.drillOffset?.x || 0);
    const hY = v.y + (v.drillOffset?.y || 0);
    drills.push({ x: hX, y: hY, diameter: v.drill });
  });

  // Standalone pads with drills (only in through drill file)
  if (!layerPair || (isCopperLayer(layerPair[0]) && isCopperLayer(layerPair[1]) && layerPair[0] === "top_copper" && layerPair[1] === "bottom_copper")) {
    pcb.pads.forEach((p) => {
      if (p.drill && p.drill > 0) {
        drills.push({ x: p.x, y: p.y, diameter: p.drill });
      }
    });

    // Footprint pads with drills
    pcb.footprints.forEach((fp) => {
      const rad = (fp.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      fp.pads.forEach((pad) => {
        if (pad.drill && pad.drill > 0) {
          const worldX = fp.x + (pad.x * cos - pad.y * sin);
          const worldY = fp.y + (pad.x * sin + pad.y * cos);
          drills.push({ x: worldX, y: worldY, diameter: pad.drill });
        }
      });
    });
  }

  if (drills.length === 0) {
    // Return empty Excellon shell
    return [
      "M48",
      "METRIC",
      "T01C1.000",
      "%",
      "G90",
      "M30"
    ].join("\n");
  }

  // Group drill locations by diameter
  const tools: Record<string, { x: number; y: number }[]> = {};
  drills.forEach((d) => {
    const dKey = d.diameter.toFixed(3);
    if (!tools[dKey]) tools[dKey] = [];
    tools[dKey].push({ x: d.x, y: d.y });
  });

  const lines: string[] = [
    "M48",
    "METRIC,TZ", // TZ means Trailing Zeros are kept, or just metric units
  ];

  // Tool headers: e.g. T01C1.000
  const toolKeys = Object.keys(tools).sort((a, b) => parseFloat(a) - parseFloat(b));
  const toolCodes: Record<string, string> = {};

  toolKeys.forEach((key, idx) => {
    const code = `T0${idx + 1}`.slice(-3); // T01, T02, etc.
    toolCodes[key] = code;
    lines.push(`${code}C${parseFloat(key).toFixed(3)}`);
  });

  lines.push("%");
  lines.push("G90"); // Absolute coordinates
  lines.push("G05"); // Drill mode

  toolKeys.forEach((key) => {
    const code = toolCodes[key];
    lines.push(code);
    tools[key].forEach((pt) => {
      // Excellon format outputs in 1/1000th mm or similar, or decimal format: XcoordYcoord.
      // A safe way is to write coordinates with explicit decimals or scaled integers.
      // excellon format with decimals is standard and supported by modern CAM systems:
      lines.push(`X${pt.x.toFixed(3)}Y${pt.y.toFixed(3)}`);
    });
  });

  lines.push("M30"); // End of program
  return lines.join("\n");
}

// Generate Gerber content for a specific layer
export function generateGerberLayer(
  pcb: PcbDoc,
  layerId: "outline" | "top_copper" | "bottom_copper" | "silkscreen" | "solder_mask" | "bottom_solder_mask",
  schematic?: SchematicDoc,
  formatVersion: "rs274x" | "x2" = "rs274x"
): string {
  const lines: string[] = [];

  if (formatVersion === "x2") {
    lines.push(
      `%G04 Gerber X2 export by CirZuit*%`,
      `%TF.GenerationSoftware,CirZuit,1.0*%`,
      `%TF.CreationDate,${new Date().toISOString()}*%`,
      `%TF.ProjectName,CirZuit PCB*%`,
      `%TF.Part,Single*%`
    );

    switch (layerId) {
      case "outline":
        lines.push(`%TF.FileFunction,Profile,NP*%`);
        break;
      case "top_copper":
      case "F.Cu":
        lines.push(`%TF.FileFunction,Copper,L1,Top*%`);
        break;
      case "bottom_copper":
      case "B.Cu":
        lines.push(`%TF.FileFunction,Copper,L2,Bot*%`);
        break;
      case "silkscreen":
      case "F.SilkS":
        lines.push(`%TF.FileFunction,Legend,Top*%`);
        break;
      case "bottom_silkscreen":
      case "B.SilkS":
        lines.push(`%TF.FileFunction,Legend,Bot*%`);
        break;
      case "solder_mask":
      case "F.Mask":
        lines.push(`%TF.FileFunction,Soldermask,Top*%`);
        break;
      case "bottom_solder_mask":
      case "B.Mask":
        lines.push(`%TF.FileFunction,Soldermask,Bot*%`);
        break;
      default:
        if (isCopperLayer(layerId)) {
          lines.push(`%TF.FileFunction,Copper,L,In,${layerId}*%`);
        }
        break;
    }
    lines.push(`%TF.FilePolarity,Positive*%`);
  } else {
    lines.push(`%G04 Gerber RS-274X export by CirZuit*%`);
  }

  lines.push(
    "%FSLAX34Y34*%",      // Coordinate format specification: 3 integer digits, 4 decimal digits
    "%MOMM*%",            // Dimensions in Millimeters
    "%IPPD*%",            // Image Polarity: Positive
    "G04 Define Apertures*%"
  );

  let nextApCode = 10;
  const apertures: Record<string, { code: number; gerberDef: string }> = {};

  const getApertureCode = (def: string): number => {
    if (apertures[def]) return apertures[def].code;
    const code = nextApCode++;
    apertures[def] = { code, gerberDef: `%ADD${code}${def}*%` };
    return code;
  };

  // Helper to add lines for track segments and native circular arcs
  const drawTrackLines = (layerLines: string[], track: PcbTrack) => {
    const apCode = getApertureCode(`C,${track.width.toFixed(3)}`);
    layerLines.push(`D${apCode}*`);

    const arc = getTrackArcGeometry(track);
    if (arc) {
      // Enable Multi-Quadrant Circular Interpolation mode
      layerLines.push("G75*");
      // Move to start point
      layerLines.push(`X${fC(arc.start.x)}Y${fC(arc.start.y)}D02*`);
      // In Gerber coordinate system, I and J are signed distances from start to center
      const I = fC(arc.center.x - arc.start.x);
      const J = fC(arc.center.y - arc.start.y);
      // G02 is Clockwise, G03 is Counter-Clockwise
      const gCmd = arc.anticlockwise ? "G03*" : "G02*";
      layerLines.push(gCmd);
      layerLines.push(`X${fC(arc.end.x)}Y${fC(arc.end.y)}I${I}J${J}D01*`);
      layerLines.push("G01*"); // Restore Linear Interpolation mode
      return;
    }

    if (!track.points || track.points.length < 2) {
      if (track.start && track.end) {
        layerLines.push("G01*");
        layerLines.push(`X${fC(track.start.x)}Y${fC(track.start.y)}D02*`);
        layerLines.push(`X${fC(track.end.x)}Y${fC(track.end.y)}D01*`);
      }
      return;
    }

    layerLines.push("G01*"); // Linear interpolation mode
    const start = track.points[0];
    layerLines.push(`X${fC(start.x)}Y${fC(start.y)}D02*`); // Pen Up to start point
    for (let i = 1; i < track.points.length; i++) {
      const pt = track.points[i];
      layerLines.push(`X${fC(pt.x)}Y${fC(pt.y)}D01*`); // Pen Down to next point
    }
  };

  const drawVectorStrokes = (layerLines: string[], strokes: { x1: number; y1: number; x2: number; y2: number }[], width = 0.15) => {
    if (strokes.length === 0) return;
    const apCode = getApertureCode(`C,${width.toFixed(3)}`);
    layerLines.push(`D${apCode}*`);
    layerLines.push("G01*");
    strokes.forEach((s) => {
      layerLines.push(`X${fC(s.x)}Y${fC(s.y1)}D02*`);
      layerLines.push(`X${fC(s.x2)}Y${fC(s.y2)}D01*`);
    });
  };

  // Flash circular pads or vias
  const flashCircle = (layerLines: string[], x: number, y: number, diameter: number) => {
    const apCode = getApertureCode(`C,${diameter.toFixed(3)}`);
    layerLines.push(`D${apCode}*`);
    layerLines.push(`X${fC(x)}Y${fC(y)}D03*`);
  };

  // Flash rectangular pads
  const flashRect = (layerLines: string[], x: number, y: number, w: number, h: number, rotationDeg: number) => {
    // If rotated 90 or 270, swap dimensions
    const rotatedWidth = rotationDeg % 180 === 90 ? h : w;
    const rotatedHeight = rotationDeg % 180 === 90 ? w : h;
    const apCode = getApertureCode(`R,${rotatedWidth.toFixed(3)}X${rotatedHeight.toFixed(3)}`);
    layerLines.push(`D${apCode}*`);
    layerLines.push(`X${fC(x)}Y${fC(y)}D03*`);
  };

  const layerContentLines: string[] = [];

  if (layerId === "outline") {
    // DRAW BOARD BOUNDARY BOX
    const trackWidth = 0.15;
    const apCode = getApertureCode(`C,${trackWidth.toFixed(3)}`);
    layerContentLines.push(`D${apCode}*`);
    layerContentLines.push("G01*");
    layerContentLines.push(`X0Y0D02*`);
    layerContentLines.push(`X${fC(pcb.width)}Y0D01*`);
    layerContentLines.push(`X${fC(pcb.width)}Y${fC(pcb.height)}D01*`);
    layerContentLines.push(`X0Y${fC(pcb.height)}D01*`);
    layerContentLines.push(`X0Y0D01*`);

  } else if (isCopperLayer(layerId)) {
    // 1. Draw tracks on this layer
    pcb.tracks.forEach((track) => {
      if (track.layer === layerId) {
        drawTrackLines(layerContentLines, track);
      }
    });

    // 2. Standalone pads on this layer
    pcb.pads.forEach((pad) => {
      if (pad.layer === layerId) {
        if (pad.shape === "circle") {
          flashCircle(layerContentLines, pad.x, pad.y, pad.width);
        } else {
          flashRect(layerContentLines, pad.x, pad.y, pad.width, pad.height, 0);
        }
      }
    });

    // 3. Footprint pads on this layer
    pcb.footprints.forEach((fp) => {
      const rad = (fp.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      fp.pads.forEach((pad) => {
        // Footprint pads can be "multi_layer" (through-hole) which exists on all copper layers,
        // or specific to Top/Bottom/Inner copper layers.
        const isTargetLayer = pad.layer === layerId || pad.layer === "multi_layer";
        if (isTargetLayer) {
          const worldX = fp.x + (pad.x * cos - pad.y * sin);
          const worldY = fp.y + (pad.x * sin + pad.y * cos);
          // Pad rotation is composite of footprint rotation and pad rotation (if any)
          if (pad.shape === "circle") {
            flashCircle(layerContentLines, worldX, worldY, pad.width);
          } else {
            flashRect(layerContentLines, worldX, worldY, pad.width, pad.height, fp.rotation);
          }
        }
      });
    });

    // 4. Vias on this copper layer
    pcb.vias.forEach((via) => {
      if (isViaOnLayer(via, layerId, pcb.layers)) {
        flashCircle(layerContentLines, via.x, via.y, via.diameter);
      }
    });

  } else if (layerId === "silkscreen") {
    // DRAW SILKSCREEN DESIGNATORS & COMPONENT OUTLINES
    pcb.footprints.forEach((fp) => {
      const rad = (fp.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      // Draw a simple white box bounding the footprint pads to act as component outline
      let minX = 0, minY = 0, maxX = 0, maxY = 0;
      fp.pads.forEach((pad, index) => {
        if (index === 0) {
          minX = pad.x - pad.width/2;
          maxX = pad.x + pad.width/2;
          minY = pad.y - pad.height/2;
          maxY = pad.y + pad.height/2;
        } else {
          minX = Math.min(minX, pad.x - pad.width/2);
          maxX = Math.max(maxX, pad.x + pad.width/2);
          minY = Math.min(minY, pad.y - pad.height/2);
          maxY = Math.max(maxY, pad.y + pad.height/2);
        }
      });

      // Pad boundary with an extra clearance border of 0.8mm
      const border = 0.8;
      const xL = minX - border;
      const xR = maxX + border;
      const yB = minY - border;
      const yT = maxY + border;

      // Rotated bounding corners
      const corners = [
        { x: xL, y: yB }, { x: xR, y: yB },
        { x: xR, y: yT }, { x: xL, y: yT }
      ].map((pt) => ({
        x: fp.x + (pt.x * cos - pt.y * sin),
        y: fp.y + (pt.x * sin + pt.y * cos)
      }));

      // Draw footprint outlines in vector lines
      const fpStrokes = [
        { x1: corners[0].x, y1: corners[0].y, x2: corners[1].x, y2: corners[1].y },
        { x1: corners[1].x, y1: corners[1].y, x2: corners[2].x, y2: corners[2].y },
        { x1: corners[2].x, y1: corners[2].y, x2: corners[3].x, y2: corners[3].y },
        { x1: corners[3].x, y1: corners[3].y, x2: corners[0].x, y2: corners[0].y },
      ];
      drawVectorStrokes(layerContentLines, fpStrokes, 0.15);

      // Draw the component reference designator text (e.g. "R1")
      if (fp.reference) {
        // Draw centered slightly above or in center of the footprint
        const labelX = fp.x;
        const labelY = fp.y + (yT + 1.2) * cos; // offset upwards
        const textStrokes = getTextStrokes(fp.reference, labelX - 1.0, labelY, 1.2, fp.rotation);
        drawVectorStrokes(layerContentLines, textStrokes, 0.15);
      }
    });

    // Standalone texts
    if (pcb.texts) {
      pcb.texts.forEach((textItem) => {
        if (textItem.layer === "silkscreen") {
          const textStrokes = getTextStrokes(textItem.text, textItem.x, textItem.y, textItem.size, textItem.rotation);
          drawVectorStrokes(layerContentLines, textStrokes, 0.15);
        }
      });
    }

  } else if (layerId === "solder_mask" || layerId === "bottom_solder_mask") {
    // SOLDER MASK openings (pads/vias with clearance margin of +0.1mm)
    const copperLayer: "top_copper" | "bottom_copper" = layerId === "solder_mask" ? "top_copper" : "bottom_copper";
    const clearance = 0.15; // standard solder mask expansion

    // 1. Standalone pads on this layer
    pcb.pads.forEach((pad) => {
      if (pad.layer === copperLayer) {
        if (pad.shape === "circle") {
          flashCircle(layerContentLines, pad.x, pad.y, pad.width + clearance * 2);
        } else {
          flashRect(layerContentLines, pad.x, pad.y, pad.width + clearance * 2, pad.height + clearance * 2, 0);
        }
      }
    });

    // 2. Footprint pads on this layer
    pcb.footprints.forEach((fp) => {
      const rad = (fp.rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);

      fp.pads.forEach((pad) => {
        const isTargetLayer = pad.layer === copperLayer || pad.layer === "multi_layer";
        if (isTargetLayer) {
          const worldX = fp.x + (pad.x * cos - pad.y * sin);
          const worldY = fp.y + (pad.x * sin + pad.y * cos);
          if (pad.shape === "circle") {
            flashCircle(layerContentLines, worldX, worldY, pad.width + clearance * 2);
          } else {
            flashRect(layerContentLines, worldX, worldY, pad.width + clearance * 2, pad.height + clearance * 2, fp.rotation);
          }
        }
      });
    });

    // 3. Vias are exposed on outer solder mask if they reach that outer surface
    pcb.vias.forEach((via) => {
      const surfaceLayer = layerId === "solder_mask" ? "top_copper" : "bottom_copper";
      if (isViaOnLayer(via, surfaceLayer, pcb.layers)) {
        flashCircle(layerContentLines, via.x, via.y, via.diameter + clearance * 2);
      }
    });
  }

  // Generate aperture definitions code block
  const apertureDefinitions: string[] = [];
  Object.values(apertures).forEach((ap) => {
    apertureDefinitions.push(ap.gerberDef);
  });

  lines.push(...apertureDefinitions);
  lines.push("G04 End of Apertures*%", "");
  lines.push(...layerContentLines);
  lines.push("M02*"); // End of File

  return lines.join("\n");
}

// Download package of Gerbers and NC drill as a single production ZIP file
export async function downloadGerberZip(
  pcb: PcbDoc, 
  schematic: SchematicDoc, 
  filename: string,
  formatVersion: "rs274x" | "x2" = "rs274x"
) {
  const zip = new JSZip();

  // 1. Generate standard layers
  const outlineGbr = generateGerberLayer(pcb, "outline", schematic, formatVersion);
  const topCopperGtl = generateGerberLayer(pcb, "top_copper", schematic, formatVersion);
  const bottomCopperGbl = generateGerberLayer(pcb, "bottom_copper", schematic, formatVersion);
  const topSilkscreenGto = generateGerberLayer(pcb, "silkscreen", schematic, formatVersion);
  const topSolderMaskGts = generateGerberLayer(pcb, "solder_mask", schematic, formatVersion);
  const bottomSolderMaskGbs = generateGerberLayer(pcb, "bottom_solder_mask", schematic, formatVersion);
  const drillDrl = generateNcDrill(pcb);

  // 2. Add to ZIP archive (Standard PCB Manufacturing File naming conventions)
  zip.file(`${filename}.gko`, outlineGbr);
  zip.file(`${filename}.gtl`, topCopperGtl);
  zip.file(`${filename}.gbl`, bottomCopperGbl);
  zip.file(`${filename}.gto`, topSilkscreenGto);
  zip.file(`${filename}.gts`, topSolderMaskGts);
  zip.file(`${filename}.gbs`, bottomSolderMaskGbs);
  zip.file(`${filename}.drl`, drillDrl);

  const innerFileList: string[] = [];
  // Add inner copper layers if present
  (pcb.layers || []).forEach((l) => {
    const inMatch = l.id.match(/^in(\d+)\.cu$/i);
    if (inMatch) {
      const inNum = inMatch[1];
      const innerContent = generateGerberLayer(pcb, l.id, schematic, formatVersion);
      const ext = `g${parseInt(inNum, 10) + 1}`;
      zip.file(`${filename}.${ext}`, innerContent);
      innerFileList.push(`- ${filename}.${ext} : Inner Copper Layer ${inNum} (${l.name || l.id})`);
    }
  });

  // Layer-pair blind/buried drill files if present
  const blindPairs = new Map<string, [PcbLayerId, PcbLayerId]>();
  pcb.vias.forEach((v) => {
    if (v.layers) {
      const type = determineViaType(v, pcb.layers);
      if (type === "blind" || type === "micro") {
        const pairKey = `${v.layers[0]}-${v.layers[1]}`;
        if (!blindPairs.has(pairKey)) {
          blindPairs.set(pairKey, v.layers);
        }
      }
    }
  });

  const drillFileList: string[] = [`- ${filename}.drl : Primary NC Drill Coordinate File (Excellon format)`];
  blindPairs.forEach((pair, pairKey) => {
    const blindDrl = generateNcDrill(pcb, pair);
    const sanitizedKey = pairKey.replace(/[.\s]/g, "_");
    const drillName = `${filename}-${sanitizedKey}.drl`;
    zip.file(drillName, blindDrl);
    drillFileList.push(`- ${drillName} : Layer Span Drill File for ${pair[0]} -> ${pair[1]}`);
  });

  // Create Readme file
  const formatLabel = formatVersion === "x2" ? "Gerber X2 (with attributes)" : "Gerber RS-274X (Extended Gerber)";
  const readme = [
    `CirZuit PCB Gerber Package (${formatLabel}): ${filename}`,
    `Generated on: ${new Date().toISOString()}`,
    `Gerber Standard: ${formatLabel}`,
    `----------------------------------------`,
    `File List and Manufacturing Assignments:`,
    `- ${filename}.gko : Board Outline / Mechanical Profile`,
    `- ${filename}.gtl : Top Copper Layer`,
    `- ${filename}.gbl : Bottom Copper Layer`,
    ...innerFileList,
    `- ${filename}.gto : Top Silkscreen Legend`,
    `- ${filename}.gts : Top Solder Mask Openings`,
    `- ${filename}.gbs : Bottom Solder Mask Openings`,
    ...drillFileList,
    `----------------------------------------`,
    `This package is ready for direct manufacture at JLCPCB, PCBWay, or any other fabrication service.`
  ].join("\n");
  zip.file("README.txt", readme);

  // 3. Trigger user ZIP file download
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}_gerber_${formatVersion === "x2" ? "x2" : "rs274x"}_package.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Download the standalone Excellon Drill file directly
export function downloadNcDrillFile(pcb: PcbDoc, filename: string) {
  const content = generateNcDrill(pcb);
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.drl`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
