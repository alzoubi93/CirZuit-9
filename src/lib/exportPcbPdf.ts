import jsPDF from "jspdf";
import { PcbDoc, PcbPad, PcbFootprintPad, checkIfPolarizedCapacitor } from "./pcb";
import { footprintBBox } from "./pcbSync";
import { getElectrolyticSize } from "../components/editor/ThreeDRealModels";

export interface ExportPcbPdfOptions {
  layer: "top_copper" | "bottom_copper" | "silkscreen" | "bottom_silkscreen";
  mirror: boolean;
  invert: boolean; // true = white tracks on black, false = black tracks on white
  drillGuide: "small" | "full" | "none";
  showOutline: boolean;
  numCopies: number; // 1 to 4 copies
  dpi?: number;
}

// Helper to check if pad/via exists on the current copper layer
function isPadOnLayer(pad: { layer: string; drill?: number }, targetLayer: string): boolean {
  if (targetLayer === "top_copper") {
    return pad.layer === "top_copper" || pad.layer === "multi_layer" || (pad.drill !== undefined && pad.drill > 0);
  }
  if (targetLayer === "bottom_copper") {
    return pad.layer === "bottom_copper" || pad.layer === "multi_layer" || (pad.drill !== undefined && pad.drill > 0);
  }
  return pad.layer === targetLayer;
}

/**
 * Renders the PCB layout to a high-DPI HTML5 Canvas.
 */
export function renderPcbToCanvas(pcb: PcbDoc, options: ExportPcbPdfOptions): HTMLCanvasElement {
  const { layer, mirror, invert, drillGuide, showOutline, dpi = 600 } = options;
  const w = pcb.width;
  const h = pcb.height;

  // 1 mm = (dpi / 25.4) pixels
  const scale = dpi / 25.4;
  const pixelWidth = Math.round(w * scale);
  const pixelHeight = Math.round(h * scale);

  const canvas = document.createElement("canvas");
  canvas.width = pixelWidth;
  canvas.height = pixelHeight;
  const ctx = canvas.getContext("2d")!;

  // 1. Fill background (Toner-transfer: Positive means black toner on white background)
  ctx.fillStyle = invert ? "#000000" : "#ffffff";
  ctx.fillRect(0, 0, pixelWidth, pixelHeight);

  ctx.save();
  // Set scale (mm to pixels)
  ctx.scale(scale, scale);

  // 2. Handle Mirroring
  if (mirror) {
    ctx.translate(w, 0);
    ctx.scale(-1, 1);
  }

  // 3. Convert SVG/Cartesian coordinates (Y goes up) to Canvas coordinates (Y goes down)
  // Origin (0,0) is bottom-left in our PCB layout
  ctx.translate(0, h);
  ctx.scale(1, -1);

  // Color selection
  const foreColor = invert ? "#ffffff" : "#000000";
  const backColor = invert ? "#000000" : "#ffffff";

  // 4. Draw Tracks (only if it's copper layers)
  if (layer === "top_copper" || layer === "bottom_copper") {
    ctx.strokeStyle = foreColor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    const tracks = pcb.tracks.filter((t) => t.layer === layer);
    for (const t of tracks) {
      if (t.points.length < 2) continue;
      ctx.lineWidth = t.width;
      ctx.beginPath();
      ctx.moveTo(t.points[0].x, t.points[0].y);
      for (let i = 1; i < t.points.length; i++) {
        ctx.lineTo(t.points[i].x, t.points[i].y);
      }
      ctx.stroke();
    }
  }

  // 5. Draw Vias (copper rings)
  if (layer === "top_copper" || layer === "bottom_copper") {
    for (const v of pcb.vias) {
      ctx.fillStyle = foreColor;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.diameter / 2, 0, 2 * Math.PI);
      ctx.fill();

      // Drill guide inside the same loop so tracks underneath don't cover it
      if (drillGuide !== "none" && v.drill && v.drill > 0) {
        ctx.fillStyle = backColor;
        const r = drillGuide === "small" ? 0.25 : v.drill / 2; // 0.25mm radius = 0.5mm center hole
        ctx.beginPath();
        ctx.arc(v.x, v.y, r, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  // 6. Draw Standalone Pads
  if (layer === "top_copper" || layer === "bottom_copper") {
    for (const p of pcb.pads) {
      if (!isPadOnLayer(p, layer)) continue;

      ctx.fillStyle = foreColor;
      if (p.shape === "circle") {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.width / 2, 0, 2 * Math.PI);
        ctx.fill();
      } else {
        ctx.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
      }

      // Drill guide
      if (drillGuide !== "none" && p.drill && p.drill > 0) {
        ctx.fillStyle = backColor;
        const r = drillGuide === "small" ? 0.25 : p.drill / 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  // 7. Draw Footprints (Copper pads OR Silkscreen outlines)
  for (const fp of pcb.footprints) {
    ctx.save();
    ctx.translate(fp.x, fp.y);
    ctx.rotate((fp.rotation * Math.PI) / 180);

    if (layer === "top_copper" || layer === "bottom_copper") {
      // Draw copper pads of the footprint
      for (const p of fp.pads) {
        if (!isPadOnLayer(p, layer)) continue;

        ctx.fillStyle = foreColor;
        if (p.shape === "circle") {
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.width / 2, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          ctx.fillRect(p.x - p.width / 2, p.y - p.height / 2, p.width, p.height);
        }

        // Drill guide
        if (drillGuide !== "none" && p.drill && p.drill > 0) {
          ctx.fillStyle = backColor;
          const r = drillGuide === "small" ? 0.25 : p.drill / 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
    } else if (layer === "silkscreen" || layer === "bottom_silkscreen") {
      // Draw component silkscreen outlines
      if (fp.pads.length > 0) {
        let minPX = Infinity, minPY = Infinity, maxPX = -Infinity, maxPY = -Infinity;
        fp.pads.forEach((p) => {
          minPX = Math.min(minPX, p.x - p.width / 2);
          maxPX = Math.max(maxPX, p.x + p.width / 2);
          minPY = Math.min(minPY, p.y - p.height / 2);
          maxPY = Math.max(maxPY, p.y + p.height / 2);
        });

        const borderOffset = 0.6;
        const rectW = maxPX - minPX + borderOffset * 2;
        const rectH = maxPY - minPY + borderOffset * 2;
        const rectX = minPX - borderOffset;
        const rectY = minPY - borderOffset;

        const sym = (fp.symbol || "").toLowerCase();
        const ref = (fp.reference || "").toLowerCase();
        const isPolarCap = checkIfPolarizedCapacitor(fp);
        const isNonPolarCap = (sym.includes("capacitor") || ref.startsWith("c")) && !isPolarCap;

        ctx.strokeStyle = foreColor;
        ctx.lineWidth = 0.15;

        if (isPolarCap) {
          // Polarized Capacitor radial body
          const pad0 = fp.pads[0];
          const pad1 = fp.pads[1];
          const capValRaw = fp.value || (fp as any).val || "10uF";
          const capSize = getElectrolyticSize(capValRaw);
          const rBody = (capSize.w + 0.5) / 2;
          const cx = pad0 && pad1 ? (pad0.x + pad1.x) / 2 : 0;
          const cy = pad0 && pad1 ? (pad0.y + pad1.y) / 2 : 0;
          const angle = pad0 && pad1 ? Math.atan2(pad1.y - pad0.y, pad1.x - pad0.x) : 0;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(angle);

          // Draw outer circle D + 0.5mm
          ctx.beginPath();
          ctx.arc(0, 0, rBody, 0, 2 * Math.PI);
          ctx.stroke();

          // Negative Stripe Arc on Pin 2 side
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, rBody, -Math.PI / 3, Math.PI / 3);
          ctx.closePath();
          ctx.save();
          ctx.globalAlpha = 0.3;
          ctx.fillStyle = foreColor;
          ctx.fill();
          ctx.restore();

          // Plus sign near Pin 1
          ctx.save();
          ctx.translate(-rBody - 0.8, 0);
          ctx.beginPath();
          ctx.moveTo(-0.4, 0); ctx.lineTo(0.4, 0);
          ctx.moveTo(0, -0.4); ctx.lineTo(0, 0.4);
          ctx.stroke();
          ctx.restore();

          ctx.restore();
        } else if (isNonPolarCap) {
          // Non-polarized capacitor rounded/pill envelope with parallel plates
          ctx.beginPath();
          if (typeof ctx.roundRect === "function") {
            ctx.roundRect(rectX, rectY, rectW, rectH, rectH / 2);
          } else {
            ctx.rect(rectX, rectY, rectW, rectH);
          }
          ctx.stroke();

          const nonPolarCx = (minPX + maxPX) / 2;
          const nonPolarCy = (minPY + maxPY) / 2;
          const pad0 = fp.pads[0];
          const pad1 = fp.pads[1];
          const angle = pad0 && pad1 ? Math.atan2(pad1.y - pad0.y, pad1.x - pad0.x) : 0;

          ctx.save();
          ctx.translate(nonPolarCx, nonPolarCy);
          ctx.rotate(angle);

          // Draw parallel plates
          ctx.beginPath();
          ctx.moveTo(-0.45, -rectH * 0.3);
          ctx.lineTo(-0.45, rectH * 0.3);
          ctx.moveTo(0.45, -rectH * 0.3);
          ctx.lineTo(0.45, rectH * 0.3);
          ctx.stroke();

          ctx.restore();
        } else {
          if (fp.lines && fp.lines.length > 0) {
            ctx.beginPath();
            fp.lines.forEach(ln => {
              ctx.moveTo(ln.x1, ln.y1);
              ctx.lineTo(ln.x2, ln.y2);
            });
            ctx.stroke();
          } else if (!fp.circles || fp.circles.length === 0) {
            // Standard bounding box outline
            if (typeof ctx.roundRect === "function") {
              ctx.beginPath();
              ctx.roundRect(rectX, rectY, rectW, rectH, 0.3);
              ctx.stroke();
            } else {
              ctx.strokeRect(rectX, rectY, rectW, rectH);
            }
            if (fp.pads.length > 0) {
              ctx.beginPath();
              ctx.arc(rectX + 0.8, rectY + 0.8, 0.3, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
          if (fp.circles && fp.circles.length > 0) {
            ctx.beginPath();
            fp.circles.forEach(c => {
              ctx.moveTo(c.cx + c.r, c.cy);
              ctx.arc(c.cx, c.cy, c.r, 0, Math.PI * 2);
            });
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore(); // restore from the footprint transform

    // Draw names (references) and values outside the footprint
    if (fp.reference || fp.value) {
      const bb = footprintBBox(fp);
      const centerX = bb.x + bb.w / 2;
      const centerY = bb.y - 0.7; // Just above the bounding box
      
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(1, -1); // flip Y back for upright text
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const textStr = (fp.reference || "") + (fp.value ? ` · ${fp.value}` : "");
      const fontSize = 1.0;
      ctx.font = `bold ${fontSize}px monospace`;
      ctx.fillStyle = foreColor;
      ctx.fillText(textStr, 0, 0);

      ctx.restore();
    }
  }

  // 8. Draw Standalone Custom Text Labels
  const pcbTexts = pcb.texts ?? [];
  for (const t of pcbTexts) {
    // Top silkscreen or custom layer text
    if (t.layer === layer || (layer === "top_copper" && t.layer === "top_copper") || (layer === "bottom_copper" && t.layer === "bottom_copper")) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate((t.rotation * Math.PI) / 180);
      ctx.scale(1, -1); // flip Y back
      ctx.font = `${t.size}px monospace`;
      ctx.fillStyle = foreColor;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(t.text, 0, 0);
      ctx.restore();
    }
  }

  // 9. Draw Board Outline (if enabled)
  if (showOutline) {
    ctx.strokeStyle = foreColor;
    ctx.lineWidth = 0.2; // 0.2mm outline
    ctx.strokeRect(0, 0, w, h);
  }

  ctx.restore();
  return canvas;
}

/**
 * Draws a professional physical scale verification ruler directly onto the PDF page.
 */
function drawCalibrationRuler(pdf: jsPDF, x: number, y: number) {
  // Border box for ruler section
  pdf.setLineWidth(0.15);
  pdf.setDrawColor(120, 120, 120);
  pdf.setFillColor(250, 250, 250);
  pdf.rect(x - 3, y - 6, 132, 18, "FD");

  // Title
  pdf.setFont("Helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(40, 40, 40);
  pdf.text("DIY PCB PRINT SCALE CALIBRATION (Confirm 1:1 Scale with physical ruler before etching)", x, y - 2.5);

  // 1. Draw 50mm ruler
  pdf.setLineWidth(0.3);
  pdf.setDrawColor(0, 0, 0);
  pdf.line(x, y, x + 50, y); // main line
  
  for (let i = 0; i <= 50; i++) {
    let tickHeight = 1.5;
    if (i % 10 === 0) {
      tickHeight = 4;
      pdf.setFont("Helvetica", "normal");
      pdf.setFontSize(5);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${i}mm`, x + i, y + tickHeight + 2, { align: "center" });
    } else if (i % 5 === 0) {
      tickHeight = 2.5;
    }
    pdf.line(x + i, y, x + i, y + tickHeight);
  }

  // 2. Draw 2-inch ruler
  const inchX = x + 65;
  pdf.setFont("Helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(40, 40, 40);
  pdf.text("Inches Ruler", inchX, y - 2.5);
  pdf.setLineWidth(0.3);
  pdf.setDrawColor(0, 0, 0);
  pdf.line(inchX, y, inchX + 50.8, y); // 2 inches = 50.8 mm
  
  for (let i = 0; i <= 16; i++) {
    const pos = (i * 25.4) / 8; // mm pos
    let tickHeight = 1.5;
    if (i % 8 === 0) { // full inch
      tickHeight = 4;
      pdf.setFont("Helvetica", "normal");
      pdf.setFontSize(5);
      pdf.setTextColor(0, 0, 0);
      pdf.text(`${i / 8}"`, inchX + pos, y + tickHeight + 2, { align: "center" });
    } else if (i % 4 === 0) { // half inch
      tickHeight = 2.5;
    }
    pdf.line(inchX + pos, y, inchX + pos, y + tickHeight);
  }
}

/**
 * Generates and downloads the 1:1 PCB layout PDF.
 */
export async function exportPcbTonerTransferPdf(
  pcb: PcbDoc,
  options: ExportPcbPdfOptions,
  filename: string
) {
  // Create high-resolution canvas
  const dpi = options.dpi ?? 600;
  const canvas = renderPcbToCanvas(pcb, options);
  const canvasDataUrl = canvas.toDataURL("image/png");

  // Create A4 PDF (portrait)
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // A4 size: 210mm x 297mm
  const w = pcb.width;
  const h = pcb.height;

  // Header and Metadata Info
  pdf.setFont("Helvetica", "bold");
  pdf.setFontSize(11);
  pdf.text(`CirZuit 1:1 PCB Print Layout - ${filename.toUpperCase()}`, 15, 12);
  
  pdf.setFont("Helvetica", "normal");
  pdf.setFontSize(7);
  pdf.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleString();
  const layerLabel = {
    top_copper: "Top Copper (Tracks + Pads)",
    bottom_copper: "Bottom Copper (Tracks + Pads)",
    silkscreen: "Top Silkscreen (Component Outlines)",
    bottom_silkscreen: "Bottom Silkscreen"
  }[options.layer];
  pdf.text(
    `Layer: ${layerLabel}  |  Mirroring: ${options.mirror ? "ENABLED" : "DISABLED"}  |  Inversion: ${options.invert ? "NEGATIVE" : "POSITIVE"}  |  Drill Hole Guide: ${options.drillGuide.toUpperCase()}  |  Date: ${dateStr}`,
    15,
    16
  );

  // Draw Calibration Ruler (placed at y = 19mm, ends at y = 37mm)
  drawCalibrationRuler(pdf, 15, 25);

  // PCB arrangement starting at y = 45mm
  const startY = 45;
  const marginX = 15;
  const gapX = 12;
  const gapY = 12;

  let currentX = marginX;
  let currentY = startY;

  for (let i = 0; i < options.numCopies; i++) {
    // If drawing this copy exceeds the right boundary, move to the next row
    if (currentX + w > 210 - marginX) {
      currentX = marginX;
      currentY += h + gapY;
    }

    // If drawing exceeds the bottom boundary, add a new page (though 1-4 copies easily fit on 1 A4)
    if (currentY + h > 297 - 15) {
      pdf.addPage();
      currentX = marginX;
      currentY = 15; // reset top margin on new page
    }

    // Place the image at EXACT PCB millimeter sizes
    pdf.addImage(canvasDataUrl, "PNG", currentX, currentY, w, h);

    // Label copy number above/beside it for easy sorting
    pdf.setFont("Helvetica", "bold");
    pdf.setFontSize(6.5);
    pdf.setTextColor(120, 120, 120);
    pdf.text(`#Copy ${i + 1}`, currentX, currentY - 1.5);

    // Advance X for next copy
    currentX += w + gapX;
  }

  // Trigger Download
  pdf.save(`${filename}_1to1_${options.layer}.pdf`);
}
