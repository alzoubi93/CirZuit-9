// Render the schematic doc or PCB doc to an offscreen SVG and rasterize to PNG/JPEG, or download as SVG/PDF.
import { SchematicDoc, GRID } from "./schematic";
import { SYMBOLS, transformedPins, nodeBBox } from "./symbols";
import { PcbDoc, checkIfPolarizedCapacitor } from "./pcb";
import { renderToStaticMarkup } from "react-dom/server";
import jsPDF from "jspdf";
import React from "react";
import { RealisticComponent, RealisticDefs } from "../components/editor/RealisticComponents";
import { getElectrolyticSize } from "../components/editor/ThreeDRealModels";

function renderSvgToStaticMarkup(element: React.ReactElement): string {
  const wrapped = React.createElement("svg", null, element);
  const markup = renderToStaticMarkup(wrapped);
  return markup.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

const WIRE_HEX: Record<string, string> = {
  black: "#111111", red: "#dc2626", green: "#16a34a", blue: "#2563eb", yellow: "#eab308", white: "#ffffff",
};

function getExportWireColor(cName: string, isDark: boolean) {
  if (cName === "white" && !isDark) return "#1e293b";
  if (cName === "black" && isDark) return "#f1f5f9";
  return WIRE_HEX[cName] || "#111111";
}

export function buildSvg(doc: SchematicDoc, padding = 2, realistic = false) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of doc.nodes) {
    const s = SYMBOLS[n.symbol];
    if (!s) continue;
    const nodeScale = n.size ?? 1;
    
    // Use accurate bounding box that accounts for rotation and size
    const bbox = nodeBBox(n);
    minX = Math.min(minX, bbox.x);
    minY = Math.min(minY, bbox.y);
    maxX = Math.max(maxX, bbox.x + bbox.w);
    maxY = Math.max(maxY, bbox.y + bbox.h);

    // Account for pin dots positions
    for (const p of transformedPins(s, n.rotation, nodeScale)) {
      minX = Math.min(minX, n.x + p.x);
      minY = Math.min(minY, n.y + p.y);
      maxX = Math.max(maxX, n.x + p.x);
      maxY = Math.max(maxY, n.y + p.y);
    }

    // Account for potential label offsets (above/below the component)
    if (n.label) {
      minY = Math.min(minY, n.y - 0.5);
    }
    if (n.reference || n.value) {
      maxY = Math.max(maxY, n.y + s.height + 0.8);
    }
  }
  for (const w of doc.wires) for (const p of w.points) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 10; maxY = 10; }
  minX -= padding; minY -= padding; maxX += padding; maxY += padding;
  const w = maxX - minX;
  const h = maxY - minY;

  const isDark = doc.canvasColor === "black";
  let bg = isDark ? "#0b1220" : "#ffffff";
  if (realistic) {
    bg = isDark ? "url(#dark-wood-pattern)" : "url(#wood-pattern)";
  }
  const strokeColor = isDark ? "#e6edf6" : "#111827";

  const nodesMarkup = doc.nodes.map((n) => {
    const sym = SYMBOLS[n.symbol];
    if (!sym) return "";
    const nodeScale = n.size ?? 1;
    const cx = sym.width / 2, cy = sym.height / 2;
    const color = n.color ? WIRE_HEX[n.color] : strokeColor;
    
    let inner = "";
    if (realistic) {
      inner = renderSvgToStaticMarkup(
        React.createElement(RealisticComponent, {
          node: n,
          width: sym.width,
          height: sym.height,
        })
      );
    } else {
      inner = renderSvgToStaticMarkup(sym.draw(color) as any);
    }

    const pinDots = realistic ? "" : transformedPins(sym, n.rotation, nodeScale).map(
      (p) => `<circle cx="${p.x}" cy="${p.y}" r="0.12" fill="${color}"/>`
    ).join("");

    const label = n.label ? `<text x="${sym.width/2}" y="-0.4" font-size="0.45" text-anchor="middle" fill="${color}">${escapeXml(n.label)}</text>` : "";
    const refV = (n.reference || n.value) ? `<text x="${sym.width/2}" y="${sym.height+0.7}" font-size="0.4" text-anchor="middle" fill="${color}" opacity="0.8">${escapeXml((n.reference||"") + (n.value ? "  " + n.value : ""))}</text>` : "";
    return `<g transform="translate(${n.x} ${n.y})"><g transform="rotate(${n.rotation} ${cx} ${cy}) translate(${cx} ${cy}) scale(${nodeScale}) translate(${-cx} ${-cy})">${inner}</g>${pinDots}${label}${refV}</g>`;
  }).join("");

  const wiresMarkup = doc.wires.map((wi) => {
    const pathD = wi.points.map((p, idx) => `${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const color = getExportWireColor(wi.color, isDark);
    if (realistic) {
      return `<path d="${pathD}" fill="none" stroke="#000000" stroke-width="0.24" opacity="0.25" stroke-linecap="round" stroke-linejoin="round" />` +
             `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="0.22" stroke-linecap="round" stroke-linejoin="round" />` +
             `<path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="0.05" opacity="0.6" stroke-linecap="round" stroke-linejoin="round" />`;
    } else {
      return `<path d="${pathD}" fill="none" stroke="${color}" stroke-width="${wi.width ?? 0.1}" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }).join("");

  const defsMarkup = realistic ? renderSvgToStaticMarkup(React.createElement(RealisticDefs)) : "";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w * GRID * 2}" height="${h * GRID * 2}">
  ${defsMarkup}
  <rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${bg}"/>
  ${wiresMarkup}
  ${nodesMarkup}
</svg>`;
  return { svg, width: w * GRID * 2, height: h * GRID * 2 };
}

// Generate highly polished, production-grade vector SVG representing the PCB board
export function buildPcbSvg(pcb: PcbDoc, padding = 4) {
  const w = pcb.width;
  const h = pcb.height;
  const viewW = w + padding * 2;
  const viewH = h + padding * 2;
  const minX = -padding;
  const minY = -padding;

  const bgBoardHex = "#043a1e"; // Classic deep forest green solder mask
  const bgWorkspaceHex = "#0d1424"; // Charcoal dark work space background
  
  // Render traces
  const tracksMarkup = pcb.tracks.map((t) => {
    // Top copper in red, bottom copper in blue
    const color = t.layer === "top_copper" ? "#ef4444" : "#3b82f6";
    const pts = t.points.map((p) => `${p.x},${p.y}`).join(" ");
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${t.width}" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`;
  }).join("");

  // Render vias
  const viasMarkup = pcb.vias.map((v) => {
    return `<g>
      <circle cx="${v.x}" cy="${v.y}" r="${v.diameter / 2}" fill="#fbbf24" stroke="#ffffff" stroke-width="0.05"/>
      <circle cx="${v.x}" cy="${v.y}" r="${v.drill / 2}" fill="#0d1424"/>
    </g>`;
  }).join("");

  // Render standalone pads
  const padsMarkup = pcb.pads.map((p) => {
    const isTop = p.layer === "top_copper";
    const strokeColor = isTop ? "#dc2626" : "#2563eb";
    const fillPadColor = "#fbbf24"; // Gold finish pad

    let shapeMarkup = "";
    if (p.shape === "circle") {
      shapeMarkup = `<circle cx="${p.x}" cy="${p.y}" r="${p.width / 2}" fill="${fillPadColor}" stroke="${strokeColor}" stroke-width="0.1"/>`;
    } else {
      shapeMarkup = `<rect x="${p.x - p.width / 2}" y="${p.y - p.height / 2}" width="${p.width}" height="${p.height}" rx="0.1" fill="${fillPadColor}" stroke="${strokeColor}" stroke-width="0.1"/>`;
    }

    const drillHole = (p.drill && p.drill > 0) ? `<circle cx="${p.x}" cy="${p.y}" r="${p.drill / 2}" fill="#0d1424"/>` : "";
    return `<g>${shapeMarkup}${drillHole}</g>`;
  }).join("");

  // Render footprint silkscreens and rotated pads
  const footprintsMarkup = pcb.footprints.map((fp) => {
    const rad = (fp.rotation * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // Compute pad bounding box to sketch thin component outline on silkscreen layer
    let minPX = 0, minPY = 0, maxPX = 0, maxPY = 0;
    fp.pads.forEach((p, idx) => {
      if (idx === 0) {
        minPX = p.x - p.width/2; maxPX = p.x + p.width/2;
        minPY = p.y - p.height/2; maxPY = p.y + p.height/2;
      } else {
        minPX = Math.min(minPX, p.x - p.width/2);
        maxPX = Math.max(maxPX, p.x + p.width/2);
        minPY = Math.min(minPY, p.y - p.height/2);
        maxPY = Math.max(maxPY, p.y + p.height/2);
      }
    });

    const borderOffset = 0.6;
    const rectW = (maxPX - minPX) + borderOffset * 2;
    const rectH = (maxPY - minPY) + borderOffset * 2;
    const rectX = (minPX - borderOffset);
    const rectY = (minPY - borderOffset);

    const sym = (fp.symbol || "").toLowerCase();
    const ref = (fp.reference || "").toLowerCase();
    const isResistor = sym.includes("resistor") || ref.startsWith("r");
    const isPolarCap = checkIfPolarizedCapacitor(fp);
    const isNonPolarCap = (sym.includes("capacitor") || ref.startsWith("c")) && !isPolarCap;
    const isDiode = sym.includes("diode") || ref.startsWith("d");
    const isTransistor = sym.includes("transistor") || sym.includes("npn") || sym.includes("pnp") || sym.includes("mosfet") || ref.startsWith("q") || fp.packageId === "to92" || fp.packageId === "to220" || fp.packageId === "sot23" || fp.packageId === "sot223" || fp.packageId === "dpak";
    const isLED = sym.includes("led") || (isDiode && sym.includes("light"));
    const isRegulator = sym.includes("regulator") || sym.includes("7805") || sym.includes("7812") || sym.includes("lm317") || sym.includes("ams1117");

    const pad0 = fp.pads[0];
    const pad1 = fp.pads[1];
    const capValRaw = fp.value || (fp as any).val || "10uF";
    const capSize = getElectrolyticSize(capValRaw);
    const d = pad0 && pad1 ? Math.hypot(pad0.x - pad1.x, pad0.y - pad1.y) : capSize.pitch;
    const r = isPolarCap ? Math.max(capSize.w / 2, d / 2 + 0.3) : Math.max(d * 0.6, 2.5);
    const cx = pad0 && pad1 ? (pad0.x + pad1.x) / 2 : 0;
    const cy = pad0 && pad1 ? (pad0.y + pad1.y) / 2 : 0;
    const angle = pad0 && pad1 ? Math.atan2(pad1.y - pad0.y, pad1.x - pad0.x) * (180 / Math.PI) : 0;
    const nonPolarCx = (minPX + maxPX) / 2;
    const nonPolarCy = (minPY + maxPY) / 2;

    let silkHtml = "";
    if (isPolarCap) {
      const rBody = (capSize.w + 0.5) / 2;
      silkHtml = `<!-- Polarized Capacitor circle footprint with negative stripe and plus sign -->
      <g transform="translate(${cx}, ${cy}) rotate(${angle})">
        <circle cx="0" cy="0" r="${rBody}" fill="none" stroke="#ffffff" stroke-width="0.15" />
        <path d="M ${rBody * Math.cos(-Math.PI / 3)} ${rBody * Math.sin(-Math.PI / 3)} A ${rBody} ${rBody} 0 0 1 ${rBody * Math.cos(Math.PI / 3)} ${rBody * Math.sin(Math.PI / 3)} L 0 0 Z" fill="#ffffff" opacity="0.3" />
        <g transform="translate(${-rBody - 0.8}, 0)">
          <line x1="-0.4" y1="0" x2="0.4" y2="0" stroke="#ffffff" stroke-width="0.2" />
          <line x1="0" y1="-0.4" x2="0" y2="0.4" stroke="#ffffff" stroke-width="0.2" />
        </g>
      </g>`;
    } else if (isNonPolarCap) {
      silkHtml = `<!-- Non-polarized Capacitor rounded/pill envelope with parallel plate markings -->
      <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" rx="${rectH / 2}" fill="none" stroke="#ffffff" stroke-width="0.15" />
      <g transform="translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})">
        <line x1="-0.45" y1="${-rectH * 0.3}" x2="-0.45" y2="${rectH * 0.3}" stroke="#ffffff" stroke-width="0.15" />
        <line x1="0.45" y1="${-rectH * 0.3}" x2="0.45" y2="${rectH * 0.3}" stroke="#ffffff" stroke-width="0.15" />
      </g>`;
    } else if (isDiode || isLED) {
      const bodyL = Math.max(1.5, d - 1.8);
      const bodyH = Math.min(1.8, rectH - 0.4);
      const scaleFactor = Math.min(1.0, bodyL / 3.0);
      let ledArrows = "";
      if (isLED) {
        ledArrows = `
        <g transform="translate(0, ${-bodyH / 2 - 0.2}) scale(${scaleFactor})">
          <line x1="-0.3" y1="0" x2="0.2" y2="-0.5" stroke="#ffffff" stroke-width="0.1" />
          <polygon points="0.2,-0.5 -0.1,-0.5 0.2,-0.2" fill="#ffffff" />
          <line x1="0.1" y1="0.2" x2="0.6" y2="-0.3" stroke="#ffffff" stroke-width="0.1" />
          <polygon points="0.6,-0.3 0.3,-0.3 0.6,0.0" fill="#ffffff" />
        </g>`;
      }

      silkHtml = `<!-- Diode / LED footprint -->
      <g transform="translate(${nonPolarCx}, ${nonPolarCy}) rotate(${angle})">
        <rect x="${-bodyL / 2}" y="${-bodyH / 2}" width="${bodyL}" height="${bodyH}" rx="0.2" fill="none" stroke="#ffffff" stroke-width="0.15" />
        <rect x="${bodyL / 2 - 0.45}" y="${-bodyH / 2}" width="0.35" height="${bodyH}" fill="#ffffff" />
        <g transform="scale(${scaleFactor})">
          <polygon points="-0.5,-0.4 -0.5,0.4 0.1,0" fill="none" stroke="#ffffff" stroke-width="0.15" />
          <line x1="0.1" y1="-0.4" x2="0.1" y2="0.4" stroke="#ffffff" stroke-width="0.15" />
        </g>
        ${ledArrows}
      </g>`;
    } else if (isTransistor) {
      if (fp.pads.length === 3) {
        const isSmd = fp.pads[0].shape === "rect";
        if (isSmd) {
          const pinLabels = fp.pads.map((p) => {
            if (p.name && ["G", "D", "S", "B", "C", "E"].includes(p.name)) {
              return `<text x="${p.x}" y="${p.y + (p.y > nonPolarCy ? 0.9 : -0.9)}" fill="#ffffff" font-size="0.5" font-weight="bold" font-family="monospace" text-anchor="middle" dominant-baseline="middle" opacity="0.8">${p.name}</text>`;
            }
            return "";
          }).join("");

          silkHtml = `<!-- SOT-23 Transistor -->
          <rect x="${rectX + 0.2}" y="${rectY + 0.5}" width="${rectW - 0.4}" height="${rectH - 1.0}" rx="0.2" fill="none" stroke="#ffffff" stroke-width="0.15" />
          <line x1="${rectX + 0.2}" y1="${rectY + 0.8}" x2="${rectX + 0.6}" y2="${rectY + 0.5}" stroke="#ffffff" stroke-width="0.15" />
          ${pinLabels}`;
        } else {
          const isTO220 = fp.packageId === "to220" || rectW > 6.0;
          if (isTO220) {
            const pinLabels = fp.pads.map((p) => {
              if (p.name && ["G", "D", "S", "B", "C", "E"].includes(p.name)) {
                return `<text x="${p.x}" y="${p.y + 1.5}" fill="#ffffff" font-size="0.65" font-weight="bold" font-family="monospace" text-anchor="middle" dominant-baseline="middle" opacity="0.85">${p.name}</text>`;
              }
              return "";
            }).join("");

            silkHtml = `<!-- TO-220 Transistor -->
            <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" rx="0.1" fill="none" stroke="#ffffff" stroke-width="0.15" />
            <rect x="${rectX}" y="${rectY - 1.2}" width="${rectW}" height="1.2" fill="none" stroke="#ffffff" stroke-width="0.15" />
            <circle cx="${nonPolarCx}" cy="${rectY - 0.6}" r="0.4" fill="none" stroke="#ffffff" stroke-width="0.1" />
            ${pinLabels}`;
          } else {
            // TO-92 (D-shape)
            const pad0 = fp.pads[0];
            const pad1 = fp.pads[1];
            const pad2 = fp.pads[2];
            const avgOtherX = pad1 && pad2 ? (pad1.x + pad2.x) / 2 : nonPolarCx;
            const avgOtherY = pad1 && pad2 ? (pad1.y + pad2.y) / 2 : nonPolarCy;

            let pathD = "";
            const isVerticalFlat = Math.abs(avgOtherY - pad0.y) > Math.abs(avgOtherX - pad0.x);

            if (isVerticalFlat) {
              if (pad0.x < avgOtherX) {
                pathD = `M ${rectX + rectW} ${rectY + rectH} L ${rectX + rectW * 0.3} ${rectY + rectH} A ${rectW * 0.7} ${rectH / 2} 0 0 1 ${rectX + rectW * 0.3} ${rectY} L ${rectX + rectW} ${rectY} Z`;
              } else {
                pathD = `M ${rectX} ${rectY} L ${rectX + rectW * 0.7} ${rectY} A ${rectW * 0.7} ${rectH / 2} 0 0 1 ${rectX + rectW * 0.7} ${rectY + rectH} L ${rectX} ${rectY + rectH} Z`;
              }
            } else {
              if (pad0.y < avgOtherY) {
                pathD = `M ${rectX} ${rectY + rectH} L ${rectX} ${rectY + rectH * 0.3} A ${rectW / 2} ${rectH * 0.7} 0 0 1 ${rectX + rectW} ${rectY + rectH * 0.3} L ${rectX + rectW} ${rectY + rectH} Z`;
              } else {
                pathD = `M ${rectX + rectW} ${rectY} L ${rectX + rectW} ${rectY + rectH * 0.7} A ${rectW / 2} ${rectH * 0.7} 0 0 1 ${rectX} ${rectY + rectH * 0.7} L ${rectX} ${rectY} Z`;
              }
            }

            const dotCx = isVerticalFlat ? (pad0.x < avgOtherX ? minPX + 0.3 : maxPX - 0.3) : nonPolarCx;
            const dotCy = isVerticalFlat ? nonPolarCy : (pad0.y < avgOtherY ? minPY + 0.3 : maxPY - 0.3);

            const pinLabels = fp.pads.map((p) => {
              if (p.name && ["G", "D", "S", "B", "C", "E"].includes(p.name)) {
                return `<text x="${p.x}" y="${p.y + (isVerticalFlat ? 1.0 : (pad0.y < avgOtherY ? 1.0 : -1.0))}" fill="#ffffff" font-size="0.5" font-weight="bold" font-family="monospace" text-anchor="middle" dominant-baseline="middle" opacity="0.8">${p.name}</text>`;
              }
              return "";
            }).join("");

            silkHtml = `<!-- TO-92 Transistor -->
            <path d="${pathD}" fill="none" stroke="#ffffff" stroke-width="0.15" />
            <circle cx="${dotCx}" cy="${dotCy}" r="0.2" fill="#ffffff" />
            ${pinLabels}`;
          }
        }
      }
    } else {
      if (fp.lines && fp.lines.length > 0) {
        silkHtml = fp.lines.map(ln => `<line x1="${ln.x1}" y1="${ln.y1}" x2="${ln.x2}" y2="${ln.y2}" stroke="#ffffff" stroke-width="0.15" />`).join("");
      } else if (!fp.circles || fp.circles.length === 0) {
        silkHtml = `<!-- Footprint Silkscreen Box outline -->
        <rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" rx="0.3" fill="none" stroke="#ffffff" stroke-width="0.15" opacity="0.8"/>
        ${fp.pads.length > 0 ? `<circle cx="${rectX + 0.8}" cy="${rectY + 0.8}" r="0.3" fill="#ffffff" opacity="0.8" />` : ''}`;
      }
      if (fp.circles && fp.circles.length > 0) {
        silkHtml += fp.circles.map(c => `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}" stroke="#ffffff" stroke-width="0.15" fill="none" />`).join("");
      }
    }

    // Draw rotated pads
    const padsHtml = fp.pads.map((p) => {
      const isTop = p.layer === "top_copper" || p.layer === "multi_layer";
      const padColor = "#fbbf24"; // Gold solder pad
      const strokeColor = isTop ? "#dc2626" : "#2563eb";
      
      let pShape = "";
      if (p.shape === "circle") {
        pShape = `<circle cx="${p.x}" cy="${p.y}" r="${p.width / 2}" fill="${padColor}" stroke="${strokeColor}" stroke-width="0.08"/>`;
      } else {
        pShape = `<rect x="${p.x - p.width/2}" y="${p.y - p.height/2}" width="${p.width}" height="${p.height}" rx="0.1" fill="${padColor}" stroke="${strokeColor}" stroke-width="0.08"/>`;
      }

      const pDrill = (p.drill && p.drill > 0) ? `<circle cx="${p.x}" cy="${p.y}" r="${p.drill / 2}" fill="#0d1424"/>` : "";
      return `<g>${pShape}${pDrill}</g>`;
    }).join("");

    const centerX = rectX + rectW / 2;
    const centerY = rectY + rectH / 2;

    const maxTextLength = Math.max(fp.reference?.length || 0, fp.value?.length || 0);
    let fontSize = 1.0;
    if (maxTextLength > 0) {
      const maxFontSizeW = (rectW - 0.6) / (maxTextLength * 0.6);
      const maxFontSizeH = fp.value ? (rectH - 0.6) / 2.2 : (rectH - 0.6) / 1.2;
      fontSize = Math.min(1.1, maxFontSizeW, maxFontSizeH);
      if (fontSize < 0.5) fontSize = 0.5;
    }

    let labelsHtml = "";
    if (fp.reference || fp.value) {
      let refText = "";
      let valText = "";
      let ty = 0;
      
      // Position labels outside/above the component boundary for non-polar caps, transistors, diodes, LEDs, regulators, resistors, polar caps, etc.
      // Y points down in this local text space, so a negative ty moves it UP.
      if (isNonPolarCap || isTransistor || isDiode || isLED || isRegulator || isResistor || isPolarCap) {
        fontSize = 0.8;
        ty = -(rectH / 2 + fontSize * 1.8);
      }

      if (fp.reference && fp.value) {
        refText = `<text x="0" y="${ty - fontSize * 0.55}" fill="#ffffff" font-size="${fontSize}" font-weight="bold" font-family="monospace" text-anchor="middle">${escapeXml(fp.reference)}</text>`;
        valText = `<text x="0" y="${ty + fontSize * 0.55}" fill="#ffffff" font-size="${fontSize}" font-weight="normal" font-family="monospace" text-anchor="middle" opacity="0.85">${escapeXml(fp.value)}</text>`;
      } else if (fp.reference) {
        refText = `<text x="0" y="${ty}" fill="#ffffff" font-size="${fontSize}" font-weight="bold" font-family="monospace" text-anchor="middle" dominant-baseline="middle">${escapeXml(fp.reference)}</text>`;
      } else if (fp.value) {
        valText = `<text x="0" y="${ty}" fill="#ffffff" font-size="${fontSize}" font-weight="normal" font-family="monospace" text-anchor="middle" dominant-baseline="middle" opacity="0.85">${escapeXml(fp.value)}</text>`;
      }

      labelsHtml = `<g transform="translate(${centerX} ${centerY}) scale(1, -1)">${refText}${valText}</g>`;
    }

    return `<g transform="translate(${fp.x} ${fp.y}) rotate(${fp.rotation})">
      ${silkHtml}
      ${padsHtml}
      ${labelsHtml}
    </g>`;
  }).join("");

  // Standalone custom texts on silkscreen layer
  const textsMarkup = (pcb.texts ?? []).map((t) => {
    return `<text x="${t.x}" y="${t.y}" font-size="${t.size}" fill="#ffffff" font-family="monospace" font-weight="medium" transform="rotate(${t.rotation} ${t.x} ${t.y}) scale(1, -1)">${escapeXml(t.text)}</text>`;
  }).join("");

  // Grid background pattern for layout depth
  const gridPattern = `<pattern id="pcb-grid" width="2" height="2" patternUnits="userSpaceOnUse">
    <circle cx="1" cy="1" r="0.1" fill="#ffffff" opacity="0.1"/>
  </pattern>`;

  // Draw board outline box
  const boardOutline = `<rect x="0" y="0" width="${w}" height="${h}" rx="2" ry="2" fill="${bgBoardHex}" stroke="#ffd166" stroke-width="0.4" filter="url(#shadow)"/>`;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${viewW} ${viewH}" width="${viewW * 15}" height="${viewH * 15}">
  <defs>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.5"/>
    </filter>
    ${gridPattern}
  </defs>
  <!-- Background Workspace -->
  <rect x="${minX}" y="${minY}" width="${viewW}" height="${viewH}" fill="${bgWorkspaceHex}"/>
  <rect x="${minX}" y="${minY}" width="${viewW}" height="${viewH}" fill="url(#pcb-grid)"/>

  <!-- PCB Solder Mask & Border -->
  <g transform="translate(0 ${h}) scale(1 -1)">
    ${boardOutline}
    ${tracksMarkup}
    ${padsMarkup}
    ${footprintsMarkup}
    ${viasMarkup}
    ${textsMarkup}
  </g>
</svg>`;

  return { svg, width: viewW * 15, height: viewH * 15 };
}

function escapeXml(s: string) {
  return s.replace(/[<>&"']/g, (c) => ({ "<":"&lt;",">":"&gt;","&":"&amp;","\"":"&quot;","'":"&apos;" }[c]!));
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

// Highly robust and scalable SVG Rasterization handler
async function rasterizeSvg(svgString: string, width: number, height: number, format: "jpeg" | "png", bgHex: string) {
  const scale = 3;
  const targetWidth = (width || 800) * scale;
  const targetHeight = (height || 600) * scale;

  const blob = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("svg load failed"));
    img.src = url;
  });
  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bgHex;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
  URL.revokeObjectURL(url);
  return canvas;
}

export async function exportImage(doc: SchematicDoc, format: "jpeg" | "png" | "svg" | "pdf", filename: string, options?: { realistic?: boolean }) {
  const realistic = !!options?.realistic;
  if (format === "svg") {
    const { svg } = buildSvg(doc, 2, realistic);
    triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${filename}.svg`);
    return;
  }
  if (format === "pdf") {
    const { svg, width, height } = buildSvg(doc, 2, realistic);
    const bgHex = doc.canvasColor === "black" ? "#0b1220" : "#ffffff";
    const canvas = await rasterizeSvg(svg, width, height, "jpeg", bgHex);
    const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const aw = pageW - margin * 2;
    const ah = pageH - margin * 2;
    const ratio = Math.min(aw / canvas.width, ah / canvas.height);
    const drawW = canvas.width * ratio;
    const drawH = canvas.height * ratio;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;
    pdf.addImage(canvas.toDataURL("image/jpeg", 1.0), "JPEG", x, y, drawW, drawH);
    pdf.save(`${filename}.pdf`);
    return;
  }
  const { svg, width, height } = buildSvg(doc, 2, realistic);
  const bgHex = doc.canvasColor === "black" ? "#0b1220" : "#ffffff";
  const canvas = await rasterizeSvg(svg, width, height, format, bgHex);
  const dataUrl = canvas.toDataURL(format === "png" ? "image/png" : "image/jpeg", 1.0);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${filename}.${format === "png" ? "png" : "jpg"}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// Full, genuine support for exporting PCB board layouts to crisp vector or high-resolution raster files
export async function exportPcbImage(pcb: PcbDoc, format: "pdf" | "png" | "svg" | "jpeg", filename: string) {
  const { svg, width, height } = buildPcbSvg(pcb);
  if (format === "svg") {
    triggerDownload(new Blob([svg], { type: "image/svg+xml" }), `${filename}_pcb.svg`);
    return;
  }
  if (format === "pdf") {
    // Solder mask green board is on a workspace backdrop. Let's paint canvas background matching the workspaces
    const canvas = await rasterizeSvg(svg, width, height, "jpeg", "#0d1424");
    const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
    const pdf = new jsPDF({ orientation, unit: "pt", format: "a4" });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 24;
    const aw = pageW - margin * 2;
    const ah = pageH - margin * 2;
    const ratio = Math.min(aw / canvas.width, ah / canvas.height);
    const drawW = canvas.width * ratio;
    const drawH = canvas.height * ratio;
    const x = (pageW - drawW) / 2;
    const y = (pageH - drawH) / 2;
    pdf.addImage(canvas.toDataURL("image/jpeg", 1.0), "JPEG", x, y, drawW, drawH);
    pdf.save(`${filename}_pcb.pdf`);
    return;
  }
  if (format === "jpeg") {
    const canvas = await rasterizeSvg(svg, width, height, "jpeg", "#0d1424");
    const dataUrl = canvas.toDataURL("image/jpeg", 1.0);
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${filename}_pcb.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  
  // PNG layout
  const canvas = await rasterizeSvg(svg, width, height, "png", "#0d1424");
  const dataUrl = canvas.toDataURL("image/png", 1.0);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${filename}_pcb.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
