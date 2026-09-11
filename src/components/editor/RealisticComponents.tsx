import React from "react";
import { SchematicNode } from "@/lib/schematic";
import { SYMBOLS } from "@/lib/symbols";

// Resistor color band mapping
const BAND_COLORS: Record<number, string> = {
  0: "#000000", // Black
  1: "#8b5a2b", // Brown
  2: "#ef4444", // Red
  3: "#f97316", // Orange
  4: "#eab308", // Yellow
  5: "#22c55e", // Green
  6: "#3b82f6", // Blue
  7: "#a855f7", // Violet
  8: "#6b7280", // Grey
  9: "#ffffff", // White
};

// Parser to get resistor color bands
function getResistorBands(valueStr: string): string[] {
  // Default bands for 10k (Brown, Black, Orange)
  const defaultBands = ["#8b5a2b", "#000000", "#f97316", "#b45309"]; // brown, black, orange, gold tolerance
  if (!valueStr) return defaultBands;

  try {
    let clean = valueStr.toLowerCase().replace(/[\sΩohm]/g, "");
    let val = 0;

    if (clean.includes("k")) {
      const parts = clean.split("k");
      if (parts[0] === "") parts[0] = "1";
      const base = parseFloat(parts[0]);
      const fraction = parts[1] ? parseFloat("0." + parts[1]) : 0;
      val = (base + fraction) * 1000;
    } else if (clean.includes("m")) {
      const parts = clean.split("m");
      if (parts[0] === "") parts[0] = "1";
      const base = parseFloat(parts[0]);
      const fraction = parts[1] ? parseFloat("0." + parts[1]) : 0;
      val = (base + fraction) * 1000000;
    } else {
      // Check for formats like 4r7
      clean = clean.replace("r", ".");
      val = parseFloat(clean);
    }

    if (isNaN(val) || val <= 0) return defaultBands;

    // Convert val to scientific/engineering notation
    const str = val.toString();
    if (val < 10) {
      // single digit
      const d1 = Math.floor(val);
      const d2 = Math.floor((val * 10) % 10);
      const multColor = "#7c2d12"; // Gold (0.1) -> represented by deep gold/brown
      return [BAND_COLORS[d1] || "#000000", BAND_COLORS[d2] || "#000000", multColor, "#b45309"];
    }

    // Standard two-digit resistor representation
    const exp = Math.floor(Math.log10(val)) - 1;
    const baseVal = Math.round(val / Math.pow(10, exp));
    const d1 = Math.floor(baseVal / 10);
    const d2 = baseVal % 10;
    const mult = exp;

    const b1 = BAND_COLORS[d1] || "#8b5a2b";
    const b2 = BAND_COLORS[d2] || "#000000";
    const b3 = BAND_COLORS[mult] || "#000000";

    return [b1, b2, b3, "#b45309"]; // tolerance gold
  } catch (e) {
    return defaultBands;
  }
}

interface RealisticProps {
  node: SchematicNode;
  width: number;
  height: number;
  isGlowing?: boolean;
  glowColor?: string;
  lang?: string;
  liveValue?: string;
  isSimulating?: boolean;
}

export function RealisticComponent({
  node,
  width,
  height,
  isGlowing = false,
  glowColor = "#ef4444",
  lang = "en",
  liveValue,
  isSimulating = false,
}: RealisticProps) {
  const symbolId = node.symbol;
  const symbol = SYMBOLS[symbolId as keyof typeof SYMBOLS];
  const value = liveValue || node.value || "";

  // Common sizes for rendering
  const cx = width / 2;
  const cy = height / 2;

  // Render different electronic components with highly polished, photo-realistic vector graphics
  switch (symbolId) {
    case "resistor": {
      const bands = getResistorBands(value);
      // Increased length of body (width - 1.2 instead of width - 1.6)
      return (
        <g id={`realistic-resistor-${node.id}`} filter="url(#realistic-shadow)">
          {/* Metal Leads / Legs */}
          <path
            d={`M 0,${cy} L ${width},${cy}`}
            stroke="#cbd5e1"
            strokeWidth={0.12}
            strokeLinecap="round"
          />
          {/* Solder blobs at pins */}
          <circle cx={0.3} cy={cy} r={0.2} fill="#94a3b8" />
          <circle cx={width - 0.3} cy={cy} r={0.2} fill="#94a3b8" />

          {/* Resistor Body - Longer (width - 1.2) */}
          <rect
            x={0.6}
            y={cy - 0.4}
            width={width - 1.2}
            height={0.8}
            rx={0.3}
            fill="url(#resistor-body-grad)"
            stroke="#d97706"
            strokeWidth={0.04}
          />
          {/* End caps */}
          <rect x={0.6} y={cy - 0.4} width={0.3} height={0.8} rx={0.2} fill="#eab308" opacity={0.3} />
          <rect x={width - 0.9} y={cy - 0.4} width={0.3} height={0.8} rx={0.2} fill="#eab308" opacity={0.3} />

          {/* Color Bands */}
          <rect x={1.1} y={cy - 0.38} width={0.15} height={0.76} fill={bands[0]} />
          <rect x={1.5} y={cy - 0.38} width={0.15} height={0.76} fill={bands[1]} />
          <rect x={1.9} y={cy - 0.38} width={0.15} height={0.76} fill={bands[2]} />
          <rect x={width - 1.3} y={cy - 0.38} width={0.15} height={0.76} fill={bands[3]} />

          {/* Body Shine/Highlights */}
          <rect
            x={0.9}
            y={cy - 0.35}
            width={width - 1.8}
            height={0.15}
            fill="#ffffff"
            opacity={0.35}
            rx={0.07}
          />
        </g>
      );
    }

    case "var_resistor": {
      return (
        <g id={`realistic-potentiometer-${node.id}`} filter="url(#realistic-shadow)">
          {/* Curved Metal Leads going directly to pin coordinates */}
          <path d="M 0,1 L 0.9,1 L 0.9,1.1" stroke="#cbd5e1" strokeWidth={0.15} strokeLinecap="round" fill="none" />
          <path d="M 4,1 L 3.1,1 L 3.1,1.1" stroke="#cbd5e1" strokeWidth={0.15} strokeLinecap="round" fill="none" />
          <path d="M 2,0 L 2,0.5" stroke="#cbd5e1" strokeWidth={0.15} strokeLinecap="round" fill="none" />
          
          {/* Base Casing (Blue/Orange trim pot) */}
          <rect x={0.7} y={0.5} width={width - 1.4} height={1.2} rx={0.12} fill="#1d4ed8" stroke="#1e40af" strokeWidth={0.06} />
          
          {/* Dynamic rotating dial center */}
          <circle cx={cx} cy={1.1} r={0.42} fill="#e2e8f0" stroke="#94a3b8" strokeWidth={0.05} />
          {/* Brass center screw slot */}
          <circle cx={cx} cy={1.1} r={0.22} fill="url(#brass-grad)" />
          <rect x={cx - 0.16} y={1.03} width={0.32} height={0.12} fill="#475569" transform={`rotate(45 ${cx} 1.1)`} />
        </g>
      );
    }

    case "capacitor": {
      // Ceramic Capacitor (mustard yellow disk) with horizontal leads to pins
      let displayCode = value || "104";
      if (displayCode.toLowerCase().includes("nf")) {
        const num = parseFloat(displayCode);
        if (num === 100) displayCode = "104";
        else if (num === 10) displayCode = "103";
        else if (num === 1) displayCode = "102";
      } else if (displayCode.toLowerCase().includes("pf")) {
        displayCode = parseFloat(displayCode).toString();
      }

      return (
        <g id={`realistic-ceramic-cap-${node.id}`} filter="url(#realistic-shadow)">
          {/* Lead wires going directly to pins (0,1) and (3,1) */}
          <path d={`M 0,1 L ${cx - 0.3},1 L ${cx - 0.3},${cy}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          <path d={`M 3,1 L ${cx + 0.3},1 L ${cx + 0.3},${cy}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          
          {/* Ceramic body */}
          <circle
            cx={cx}
            cy={cy}
            r={0.65}
            fill="url(#ceramic-body-grad)"
            stroke="#c2410c"
            strokeWidth={0.04}
          />
          {/* Top shine */}
          <ellipse cx={cx - 0.15} cy={cy - 0.25} rx={0.35} ry={0.15} fill="#ffffff" opacity={0.3} transform={`rotate(-15 ${cx - 0.15} ${cy - 0.25})`} />
          {/* Value Code label */}
          <text
            x={cx}
            y={cy + 0.18}
            fontSize={0.35}
            fontWeight="bold"
            fill="#3f2000"
            textAnchor="middle"
            fontFamily="monospace"
            stroke="none"
          >
            {displayCode}
          </text>
        </g>
      );
    }

    case "capacitor_polar": {
      // Electrolytic Capacitor (Aluminum can with polar stripe)
      // Leads going to pins (0,1) and (3,1)
      return (
        <g id={`realistic-electrolytic-cap-${node.id}`} filter="url(#realistic-shadow)">
          {/* Lead wires going directly to pins (0,1) and (3,1) */}
          <path d={`M 0,1 L ${cx - 0.3},1 L ${cx - 0.3},${cy + 0.3}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          <path d={`M 3,1 L ${cx + 0.3},1 L ${cx + 0.3},${cy + 0.3}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          
          {/* Cylinder Body (slightly offset to sit above leads) */}
          <rect
            x={cx - 0.45}
            y={cy - 0.8}
            width={0.9}
            height={1.1}
            rx={0.12}
            fill="url(#electrolytic-body-grad)"
            stroke="#1e293b"
            strokeWidth={0.04}
          />
          {/* Negative polar stripe on the right side */}
          <path
            d={`M ${cx + 0.22},${cy - 0.75} L ${cx + 0.42},${cy - 0.75} L ${cx + 0.42},${cy + 0.25} L ${cx + 0.22},${cy + 0.25} Z`}
            fill="#cbd5e1"
          />
          {/* Minus symbols in the stripe */}
          <line x1={cx + 0.28} y1={cy - 0.4} x2={cx + 0.36} y2={cy - 0.4} stroke="#475569" strokeWidth={0.06} />
          <line x1={cx + 0.28} y1={cy - 0.1} x2={cx + 0.36} y2={cy - 0.1} stroke="#475569" strokeWidth={0.06} />
          <line x1={cx + 0.28} y1={cy + 0.15} x2={cx + 0.36} y2={cy + 0.15} stroke="#475569" strokeWidth={0.06} />
          
          {/* Aluminum top */}
          <ellipse cx={cx} cy={cy - 0.8} rx={0.45} ry={0.13} fill="#94a3b8" stroke="#475569" strokeWidth={0.03} />
          {/* Value labels */}
          <text
            x={cx - 0.1}
            y={cy}
            fontSize={0.24}
            fill="#ffffff"
            textAnchor="middle"
            fontFamily="sans-serif"
            fontWeight="bold"
            stroke="none"
          >
            {value || "10µF"}
          </text>
        </g>
      );
    }

    case "inductor": {
      // Glossy Copper Helix RF Coil
      return (
        <g id={`realistic-coil-${node.id}`} filter="url(#realistic-shadow)">
          {/* Leads */}
          <path d={`M 0,${cy} L 0.8,${cy}`} stroke="#b45309" strokeWidth={0.18} strokeLinecap="round" />
          <path d={`M ${width - 0.8},${cy} L ${width},${cy}`} stroke="#b45309" strokeWidth={0.18} strokeLinecap="round" />
          
          {/* Coil Loops */}
          <g transform={`translate(${cx - 1.25} ${cy - 0.5})`}>
            {/* Loop 1 */}
            <path d="M 0.4,0.7 C 0.4,-0.2 0.9,-0.2 0.9,0.7 C 0.9,1.6 0.4,1.6 0.4,0.7" fill="none" stroke="url(#copper-grad)" strokeWidth={0.18} strokeLinecap="round" />
            {/* Loop 2 */}
            <path d="M 0.8,0.7 C 0.8,-0.2 1.3,-0.2 1.3,0.7 C 1.3,1.6 0.8,1.6 0.8,0.7" fill="none" stroke="url(#copper-grad)" strokeWidth={0.18} strokeLinecap="round" />
            {/* Loop 3 */}
            <path d="M 1.2,0.7 C 1.2,-0.2 1.7,-0.2 1.7,0.7 C 1.7,1.6 1.2,1.6 1.2,0.7" fill="none" stroke="url(#copper-grad)" strokeWidth={0.18} strokeLinecap="round" />
            {/* Loop 4 */}
            <path d="M 1.6,0.7 C 1.6,-0.2 2.1,-0.2 2.1,0.7 C 2.1,1.6 1.6,1.6 1.6,0.7" fill="none" stroke="url(#copper-grad)" strokeWidth={0.18} strokeLinecap="round" />
            {/* Loop 5 */}
            <path d="M 2.0,0.7 C 2.0,-0.2 2.5,-0.2 2.5,0.7 C 2.5,1.6 2.0,1.6 2.0,0.7" fill="none" stroke="url(#copper-grad)" strokeWidth={0.18} strokeLinecap="round" />
          </g>
          {/* Value Label */}
          <text x={cx} y={cy + 0.8} fontSize={0.3} fill="#78350f" fontWeight="bold" textAnchor="middle" stroke="none">
            {value || "1 µH"}
          </text>
        </g>
      );
    }

    case "led": {
      // Elegant glossy LED with curved metal leads straight to (0,1) and (3,1)
      const isLedWhiteToRed = isGlowing && node.color === "white";
      const color = isLedWhiteToRed ? "red" : (node.color || "red");
      const ledColorHex = color === "green" ? "#22c55e" : color === "blue" ? "#3b82f6" : color === "yellow" ? "#eab308" : color === "white" ? "#ffffff" : "#ef4444";
      const ledDarkHex = color === "green" ? "#15803d" : color === "blue" ? "#1d4ed8" : color === "yellow" ? "#ca8a04" : color === "white" ? "#cbd5e1" : "#b91c1c";
      
      return (
        <g id={`realistic-led-${node.id}`} filter="url(#realistic-shadow)">
          {/* Leads bending directly to schematic coordinates (0,1) and (3,1) */}
          <path d={`M 0,1 L ${cx - 0.22},1 L ${cx - 0.22},1.2`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          <path d={`M 3,1 L ${cx + 0.22},1 L ${cx + 0.22},1.2`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          
          {/* Glowing Aura if turned on in simulation */}
          {isGlowing && (
            <g>
              {/* Outermost massive high-blur halo */}
              <circle
                cx={cx}
                cy={0.4}
                r={2.6}
                fill={glowColor}
                style={{ filter: "blur(14px)" }}
                opacity={0.7}
              />
              {/* Middle core glow */}
              <circle
                cx={cx}
                cy={0.4}
                r={1.5}
                fill={glowColor}
                style={{ filter: "blur(5px)" }}
                opacity={0.85}
              />
              {/* Intense high-brightness hotspot inside dome */}
              <circle
                cx={cx}
                cy={0.4}
                r={0.6}
                fill="#ffffff"
                style={{ filter: "blur(1px)" }}
                opacity={0.95}
              />
            </g>
          )}

          {/* Solder rim base */}
          <ellipse cx={cx} cy={1.1} rx={0.48} ry={0.14} fill={ledDarkHex} opacity={0.8} />
          
          {/* Dome Body - Longer and more pronounced dome (qoba) */}
          {/* Original: M cx-0.42,1.1 L cx-0.42,0.4 C cx-0.42,-0.5 cx+0.42,-0.5 cx+0.42,0.4 L cx+0.42,1.1 Z */}
          {/* New: M cx-0.42,1.1 L cx-0.42,0.2 C cx-0.42,-0.8 cx+0.42,-0.8 cx+0.42,0.2 L cx+0.42,1.1 Z */}
          <path
            d={`M ${cx - 0.42},1.1 L ${cx - 0.42},0.2 C ${cx - 0.42},-0.9 ${cx + 0.42},-0.9 ${cx + 0.42},0.2 L ${cx + 0.42},1.1 Z`}
            fill={isGlowing ? ledColorHex : `url(#led-${color}-grad)`}
            stroke={ledDarkHex}
            strokeWidth={0.04}
          />

          {/* Internal anode anvil and post */}
          <path d={`M ${cx - 0.15},1.0 L ${cx - 0.15},0.35 L ${cx - 0.25},0.25`} stroke="#94a3b8" strokeWidth={0.06} fill="none" opacity={0.6} />
          <path d={`M ${cx + 0.15},1.0 L ${cx + 0.15},0.2 L ${cx},0.2 Z`} fill="#cbd5e1" opacity={0.6} />

          {/* Realistic glass shine/reflection overlay */}
          <ellipse cx={cx - 0.15} cy={-0.1} rx={0.12} ry={0.35} fill="#ffffff" opacity={0.45} transform={`rotate(-15 ${cx - 0.15} -0.1)`} />
        </g>
      );
    }

    case "npn":
    case "pnp":
    case "transistor": {
      // Black TO-92 semi-cylindrical Transistor with curved pins to coordinates:
      // Base (0,2), Collector (3,0.5), Emitter (3,3.5)
      const label = value || (symbolId === "pnp" ? "2N3906" : "2N3904");
      const bodyY = 1.6;
      return (
        <g id={`realistic-transistor-${node.id}`} filter="url(#realistic-shadow)">
          {/* Leads routing precisely to pin coordinates */}
          {/* Pin 0 (Base): goes to (0,2) */}
          <path d={`M 0,2 C 0.5,2.0 1.15,1.9 1.15,${bodyY}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          {/* Pin 1 (Collector): goes to (3,0.5) */}
          <path d={`M 3,0.5 C 2.5,0.5 1.85,1.0 1.85,${bodyY}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          {/* Pin 2 (Emitter): goes to (3,3.5) */}
          <path d={`M 3,3.5 C 2.5,3.5 1.5,3.1 1.5,${bodyY}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          
          {/* TO-92 Casing Body */}
          <path
            d={`M ${cx - 0.55},${bodyY - 0.1} C ${cx - 0.55},${bodyY - 1.2} ${cx + 0.55},${bodyY - 1.2} ${cx + 0.55},${bodyY - 0.1} Z`}
            fill="url(#transistor-body-grad)"
            stroke="#111"
            strokeWidth={0.04}
          />
          {/* Flat front face cutout line */}
          <line x1={cx - 0.53} y1={bodyY - 0.15} x2={cx + 0.53} y2={bodyY - 0.15} stroke="#334155" strokeWidth={0.04} />
          
          {/* Part Label text on front */}
          <text
            x={cx}
            y={bodyY - 0.5}
            fontSize={0.25}
            fill="#e2e8f0"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
            stroke="none"
          >
            {label}
          </text>
        </g>
      );
    }

    case "mosfet":
    case "nmosfet":
    case "pmosfet": {
      // Ultra-realistic black TO-220 Power MOSFET package with mounting metal heat tab
      // Leads routing precisely to pin coordinates:
      // Gate (0,2), Drain (3,0.5), Source (3,3.5)
      const label = value || (symbolId === "pmosfet" ? "IRF9540" : "IRFZ44N");
      const bodyY = 2.0;
      return (
        <g id={`realistic-mosfet-${node.id}`} filter="url(#realistic-shadow)">
          {/* Legs routing precisely to pin coordinates */}
          {/* Pin 0 (Gate): goes to (0,2) */}
          <path d={`M 0,2 L 1.2,2 L 1.2,${bodyY}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          {/* Pin 1 (Drain): goes to (3,0.5) */}
          <path d={`M 3,0.5 C 2.4,0.5 1.5,1.0 1.5,${bodyY}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />
          {/* Pin 2 (Source): goes to (3,3.5) */}
          <path d={`M 3,3.5 C 2.4,3.5 1.8,3.0 1.8,${bodyY}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" fill="none" />

          {/* Metal Heat Sink Tab (Top silver metal) */}
          <rect x={cx - 0.55} y={bodyY - 1.4} width={1.1} height={0.6} rx={0.08} fill="url(#metal-shimmer-grad)" stroke="#475569" strokeWidth={0.04} />
          {/* Screw mounting hole in tab */}
          <circle cx={cx} cy={bodyY - 1.1} r={0.18} fill="#0f172a" stroke="#334155" strokeWidth={0.02} />
          
          {/* TO-220 Matte Black Epoxy Casing Body */}
          <rect x={cx - 0.55} y={bodyY - 0.8} width={1.1} height={0.8} rx={0.05} fill="url(#generic-body-grad)" stroke="#111" strokeWidth={0.05} />
          
          {/* Thermal line and mold indicator circle */}
          <line x1={cx - 0.55} y1={bodyY - 0.3} x2={cx + 0.55} y2={bodyY - 0.3} stroke="#334155" strokeWidth={0.03} />
          <circle cx={cx - 0.35} cy={bodyY - 0.55} r={0.1} fill="#111" opacity={0.5} />

          {/* Part Label text on front */}
          <text
            x={cx}
            y={bodyY - 0.45}
            fontSize={0.2}
            fill="#cbd5e1"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
            stroke="none"
          >
            {label}
          </text>
        </g>
      );
    }

    case "battery": {
      // Realistic colorful cylinder battery (e.g., purple HOBMAN 18650 or 9V)
      const is9V = value.toLowerCase().includes("9v") || height >= 3;
      if (is9V) {
        // Standard rectangular 9V battery with metallic snaps
        return (
          <g id={`realistic-battery-9v-${node.id}`} filter="url(#realistic-shadow)">
            {/* Boxy 9V body */}
            <rect x={0.3} y={0.8} width={width - 0.6} height={height - 1.0} rx={0.2} fill="url(#battery-9v-grad)" stroke="#111" strokeWidth={0.05} />
            
            {/* Top Terminals snaps */}
            <circle cx={cx - 0.5} cy={0.5} r={0.3} fill="#94a3b8" stroke="#475569" strokeWidth={0.05} />
            <circle cx={cx - 0.5} cy={0.5} r={0.15} fill="#111" />
            
            <circle cx={cx + 0.5} cy={0.5} r={0.25} fill="url(#brass-grad)" stroke="#475569" strokeWidth={0.05} />
            
            {/* Labeled text */}
            <text x={cx} y={cy + 0.4} fontSize={0.45} fontWeight="bold" fill="#ffffff" textAnchor="middle" stroke="none">9V</text>
            <text x={cx} y={cy + 0.9} fontSize={0.25} fill="#e2e8f0" textAnchor="middle" stroke="none">ALKALINE</text>
            <text x={cx - 0.8} y={1.2} fontSize={0.35} fontWeight="bold" fill="#ef4444" stroke="none">+</text>
            <text x={cx + 0.8} y={1.2} fontSize={0.35} fontWeight="bold" fill="#3b82f6" stroke="none">-</text>
          </g>
        );
      } else {
        // Purple 18650 cylindrical battery as seen in the HOBMAN Simple FM Transmitter!
        return (
          <g id={`realistic-battery-18650-${node.id}`} filter="url(#realistic-shadow)">
            {/* Metal cap on left (negative) and right (positive nipple) */}
            <rect x={0.1} y={cy - 0.4} width={0.15} height={0.8} rx={0.05} fill="#cbd5e1" stroke="#475569" strokeWidth={0.03} />
            <rect x={width - 0.25} y={cy - 0.25} width={0.2} height={0.5} rx={0.05} fill="url(#brass-grad)" stroke="#b45309" strokeWidth={0.03} />
            
            {/* Main Battery Cylinder Body */}
            <rect
              x={0.25}
              y={cy - 0.5}
              width={width - 0.5}
              height={1.0}
              rx={0.1}
              fill="url(#battery-body-grad)"
              stroke="#6b21a8"
              strokeWidth={0.04}
            />
            {/* Shine highlight */}
            <rect x={0.35} y={cy - 0.4} width={width - 0.7} height={0.15} fill="#ffffff" opacity={0.25} rx={0.07} />
            
            {/* Text labels */}
            <text x={cx} y={cy + 0.1} fontSize={0.32} fontWeight="bold" fill="#ffffff" textAnchor="middle" fontFamily="sans-serif" stroke="none">
              {value || "3.7V - 9V"}
            </text>
            <text x={cx} y={cy - 0.15} fontSize={0.22} fill="#e2e8f0" textAnchor="middle" fontFamily="sans-serif" stroke="none">
              {lang === "ar" ? "بطارية ليثيوم" : "RECHARGEABLE"}
            </text>
            <text x={0.6} y={cy + 0.15} fontSize={0.4} fontWeight="bold" fill="#94a3b8" textAnchor="middle" stroke="none">⊖</text>
            <text x={width - 0.6} y={cy + 0.12} fontSize={0.4} fontWeight="bold" fill="#fbbf24" textAnchor="middle" stroke="none">⊕</text>
          </g>
        );
      }
    }

    case "push_button": {
      // Tactile pushbutton switch
      return (
        <g id={`realistic-tactile-btn-${node.id}`} filter="url(#realistic-shadow)">
          {/* Metal Corner Legs going directly to schematic pin coordinate (0,1) and (3,1) */}
          <path d="M 0,1 L 0.5,1 L 0.5,1.5" stroke="#cbd5e1" strokeWidth={0.15} strokeLinecap="round" fill="none" />
          <path d={`M 3,1 L 2.5,1 L 2.5,1.5`} stroke="#cbd5e1" strokeWidth={0.15} strokeLinecap="round" fill="none" />
          
          {/* Square plastic switch body */}
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} rx={0.15} fill="#1e293b" stroke="#0f172a" strokeWidth={0.05} />
          
          {/* Metal circular collar */}
          <circle cx={cx} cy={cy} r={0.45} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.04} />
          
          {/* Round colored plunger button */}
          <circle cx={cx} cy={cy} r={0.32} fill={isGlowing ? "#3b82f6" : "#ef4444"} stroke="#991b1b" strokeWidth={0.03} />
          {/* Plunger highlight */}
          <ellipse cx={cx - 0.08} cy={cy - 0.08} rx={0.1} ry={0.05} fill="#ffffff" opacity={0.3} transform={`rotate(-30 ${cx - 0.08} ${cy - 0.08})`} />
        </g>
      );
    }

    case "switch": {
      // Tactile ON/OFF Toggle/Slide Switch
      const isOn = isGlowing; // or state
      return (
        <g id={`realistic-switch-${node.id}`} filter="url(#realistic-shadow)">
          {/* Terminals going directly to pin coordinate (0,1) and (3,1) */}
          <path d={`M 0,1 L 0.6,1 L 0.6,1.0`} stroke="#cbd5e1" strokeWidth={0.15} strokeLinecap="round" fill="none" />
          <path d={`M 3,1 L 2.4,1 L 2.4,1.0`} stroke="#cbd5e1" strokeWidth={0.15} strokeLinecap="round" fill="none" />
          
          {/* Slide housing */}
          <rect x={0.4} y={0.5} width={width - 0.8} height={height - 1.0} rx={0.1} fill="#111" stroke="#334155" strokeWidth={0.04} />
          <rect x={0.6} y={0.65} width={width - 1.2} height={0.3} rx={0.05} fill="#334155" />
          
          {/* Metallic Slide Knob */}
          <rect
            x={isOn ? width - 1.05 : 0.65}
            y={0.6}
            width={0.4}
            height={0.4}
            rx={0.08}
            fill="url(#brass-grad)"
            stroke="#b45309"
            strokeWidth={0.03}
          />
          {/* Slide Knob detail */}
          <line x1={isOn ? width - 0.85 : 0.85} y1={0.65} x2={isOn ? width - 0.85 : 0.85} y2={0.95} stroke="#78350f" strokeWidth={0.05} />
          
          <text x={cx} y={height - 0.15} fontSize={0.25} fill="#64748b" fontWeight="bold" textAnchor="middle" stroke="none">
            {isOn ? "ON" : "OFF"}
          </text>
        </g>
      );
    }

    /* ====== MICROCONTROLLERS & DEVELOPMENT BOARDS ====== */
    case "arduino_uno": {
      return (
        <g id={`realistic-arduino-uno-${node.id}`} filter="url(#realistic-shadow)">
          {/* Main PCB Board - Beautiful deep teal blue */}
          <rect
            x={0.5}
            y={0.3}
            width={5.0}
            height={height - 0.6}
            rx={0.25}
            fill="url(#arduino-pcb-grad)"
            stroke="#045657"
            strokeWidth={0.06}
          />

          {/* Copper Trace Routing (Golden/Teal routes for realism) */}
          <path d="M 0.8,1.2 Q 1.5,1.8 2.2,2.0 T 3.5,2.1" fill="none" stroke="url(#brass-grad)" strokeWidth={0.015} opacity={0.25} />
          <path d="M 1.2,3.2 Q 1.8,2.8 2.5,3.6 T 4.2,4.8" fill="none" stroke="url(#brass-grad)" strokeWidth={0.01} opacity={0.25} />
          <path d="M 1.4,8.0 L 2.0,8.0 Q 2.4,6.5 2.8,6.0" fill="none" stroke="url(#brass-grad)" strokeWidth={0.02} opacity={0.2} />
          <path d="M 4.5,1.2 L 4.0,2.5 Q 3.8,3.2 3.1,3.4" fill="none" stroke="url(#brass-grad)" strokeWidth={0.012} opacity={0.25} />
          <path d="M 4.8,8.2 Q 4.2,7.5 3.5,8.0" fill="none" stroke="url(#brass-grad)" strokeWidth={0.015} opacity={0.25} />

          {/* Silk screen borders */}
          <rect
            x={0.65}
            y={0.45}
            width={4.7}
            height={height - 0.9}
            rx={0.15}
            fill="none"
            stroke="#ffffff"
            strokeWidth={0.015}
            opacity={0.4}
          />

          {/* USB Type B Connector - Shiny silver metal */}
          <rect
            x={0.8}
            y={0.5}
            width={1.1}
            height={1.5}
            rx={0.1}
            fill="url(#metal-shimmer-grad)"
            stroke="#64748b"
            strokeWidth={0.04}
          />
          {/* Inner plastic shield */}
          <rect x={1.0} y={0.7} width={0.7} height={1.1} rx={0.05} fill="#f8fafc" />
          <rect x={1.15} y={0.85} width={0.4} height={0.8} rx={0.03} fill="#1e293b" />

          {/* Black Power Jack Barrel Connector */}
          <rect
            x={0.7}
            y={8.2}
            width={1.2}
            height={1.8}
            rx={0.1}
            fill="#111827"
            stroke="#1e293b"
            strokeWidth={0.05}
          />
          <rect x={0.9} y={8.35} width={0.8} height={1.5} fill="#111" />
          {/* Center pin (metallic) */}
          <circle cx={1.3} cy={9.1} r={0.25} fill="url(#metal-shimmer-grad)" />
          <circle cx={1.3} cy={9.1} r={0.12} fill="#000" />

          {/* 16MHz Crystal - Oval metal can */}
          <rect
            x={1.4}
            y={3.8}
            width={0.4}
            height={0.8}
            rx={0.2}
            fill="url(#metal-shimmer-grad)"
            stroke="#475569"
            strokeWidth={0.02}
          />
          <text x={1.6} y={4.3} fontSize={0.15} fontFamily="sans-serif" fill="#475569" textAnchor="middle" stroke="none" fontWeight="bold">16.000</text>

          {/* SMT Capacitors and Resistors (detailed tiny rectangles scatter for visual complexity) */}
          <rect x={1.9} y={3.5} width={0.15} height={0.08} rx={0.01} fill="#8b5a2b" stroke="#cbd5e1" strokeWidth={0.01} /> {/* SMD brown cap */}
          <rect x={1.9} y={3.7} width={0.15} height={0.08} rx={0.01} fill="#1f2937" stroke="#cbd5e1" strokeWidth={0.01} /> {/* SMD resistor */}
          <rect x={2.1} y={3.6} width={0.08} height={0.15} rx={0.01} fill="#8b5a2b" stroke="#cbd5e1" strokeWidth={0.01} />
          <rect x={2.0} y={4.5} width={0.15} height={0.08} rx={0.01} fill="#1f2937" stroke="#cbd5e1" strokeWidth={0.01} />
          <rect x={1.5} y={5.0} width={0.15} height={0.08} rx={0.01} fill="#8b5a2b" stroke="#cbd5e1" strokeWidth={0.01} />
          <rect x={1.6} y={5.2} width={0.15} height={0.08} rx={0.01} fill="#1f2937" stroke="#cbd5e1" strokeWidth={0.01} />

          {/* AMS1117 5V Voltage Regulator (Detailed SMT module) */}
          <g transform="translate(1.0 7.0)">
            <rect x={0} y={0} width={0.6} height={0.5} rx={0.03} fill="#1e293b" stroke="#000" strokeWidth={0.02} />
            <rect x={0.12} y={-0.12} width={0.36} height={0.12} fill="#cbd5e1" /> {/* Heat tab */}
            {/* 3 Legs */}
            <rect x={0.06} y={0.5} width={0.1} height={0.15} fill="#cbd5e1" />
            <rect x={0.25} y={0.5} width={0.1} height={0.15} fill="#cbd5e1" />
            <rect x={0.44} y={0.5} width={0.1} height={0.15} fill="#cbd5e1" />
            <text x={0.3} y={0.32} fontSize={0.1} fontFamily="sans-serif" fill="#94a3b8" textAnchor="middle">5.0V</text>
          </g>

          {/* Electrolytic Capacitors (detailed 3D aluminum cans near power lines) */}
          <g transform="translate(1.5 6.0)">
            <circle cx={0} cy={0} r={0.25} fill="#1e293b" stroke="#0f172a" strokeWidth={0.02} />
            <circle cx={0} cy={0} r={0.21} fill="#cbd5e1" />
            <rect x={-0.08} y={-0.25} width={0.16} height={0.5} fill="#111827" /> {/* Negative stripe */}
            <text x={0} y={0.06} fontSize={0.16} fontWeight="bold" fill="#fff" textAnchor="middle">-</text>
          </g>
          <g transform="translate(2.1 7.8)">
            <circle cx={0} cy={0} r={0.25} fill="#1e293b" stroke="#0f172a" strokeWidth={0.02} />
            <circle cx={0} cy={0} r={0.21} fill="#cbd5e1" />
            <rect x={-0.08} y={-0.25} width={0.16} height={0.5} fill="#111827" />
            <text x={0} y={0.06} fontSize={0.16} fontWeight="bold" fill="#fff" textAnchor="middle">-</text>
          </g>

          {/* ATmega328P DIP chip in black socket */}
          {/* Socket */}
          <rect
            x={2.6}
            y={3.5}
            width={0.9}
            height={4.6}
            fill="#111827"
            stroke="#334155"
            strokeWidth={0.04}
          />
          {/* Socket middle groove */}
          <rect x={2.9} y={3.5} width={0.3} height={4.6} fill="#030712" />
          {/* IC Chip body */}
          <rect
            x={2.65}
            y={3.6}
            width={0.8}
            height={4.4}
            rx={0.05}
            fill="url(#transistor-body-grad)"
            stroke="#111"
            strokeWidth={0.03}
          />
          {/* Notch at the top */}
          <path d="M 2.95,3.6 A 0.1,0.1 0 0,0 3.15,3.6 Z" fill="#111" />
          {/* Silver pins on sides */}
          {Array.from({ length: 14 }).map((_, i) => {
            const yOffset = 3.75 + i * 0.3;
            return (
              <g key={i}>
                <rect x={2.52} y={yOffset} width={0.13} height={0.08} fill="#cbd5e1" rx={0.02} />
                <rect x={3.45} y={yOffset} width={0.13} height={0.08} fill="#cbd5e1" rx={0.02} />
              </g>
            );
          })}
          {/* White branding text on ATmega328P */}
          <text
            x={3.05}
            y={5.8}
            fontSize={0.24}
            fontWeight="bold"
            fontFamily="monospace"
            fill="#e2e8f0"
            textAnchor="middle"
            stroke="none"
            transform={`rotate(-90 3.05 5.8)`}
            opacity={0.85}
          >
            ATMEGA328P-PU
          </text>

          {/* Pin 1 dot */}
          <circle cx={2.78} cy={3.8} r={0.05} fill="#1e293b" />

          {/* ATmega16U2 square chip near USB */}
          <rect x={2.1} y={2.1} width={0.6} height={0.6} rx={0.05} fill="#111827" stroke="#334155" strokeWidth={0.02} />
          <circle cx={2.2} cy={2.2} r={0.03} fill="#cbd5e1" />

          {/* ON LED - Green */}
          <g>
            <circle cx={4.5} cy={1.0} r={0.12} fill={isGlowing ? "#4ade80" : "#14532d"} stroke="#052e16" strokeWidth={0.02} />
            <text x={4.5} y={1.4} fontSize={0.18} fill="#ffffff" fontWeight="bold" textAnchor="middle" stroke="none" opacity={0.75}>ON</text>
            {isGlowing && (
              <circle cx={4.5} cy={1.0} r={0.35} fill="#22c55e" opacity={0.35} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* L LED - Yellow/Orange */}
          <g>
            <circle cx={4.5} cy={3.0} r={0.12} fill={isGlowing ? "#facc15" : "#713f12"} stroke="#422006" strokeWidth={0.02} />
            <text x={4.5} y={3.4} fontSize={0.18} fill="#ffffff" fontWeight="bold" textAnchor="middle" stroke="none" opacity={0.75}>L</text>
            {isGlowing && (
              <circle cx={4.5} cy={3.0} r={0.35} fill="#eab308" opacity={0.35} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* TX LED - Orange */}
          <g>
            <circle cx={4.5} cy={4.2} r={0.1} fill={isGlowing ? "#fb923c" : "#7c2d12"} stroke="#431407" strokeWidth={0.02} />
            <text x={4.5} y={4.6} fontSize={0.18} fill="#ffffff" fontWeight="bold" textAnchor="middle" stroke="none" opacity={0.75}>TX</text>
            {isGlowing && (
              <circle cx={4.5} cy={4.2} r={0.25} fill="#f97316" opacity={0.25} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* RX LED - Orange */}
          <g>
            <circle cx={4.5} cy={4.9} r={0.1} fill={isGlowing ? "#fb923c" : "#7c2d12"} stroke="#431407" strokeWidth={0.02} />
            <text x={4.5} y={5.3} fontSize={0.18} fill="#ffffff" fontWeight="bold" textAnchor="middle" stroke="none" opacity={0.75}>RX</text>
            {isGlowing && (
              <circle cx={4.5} cy={4.9} r={0.25} fill="#f97316" opacity={0.25} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* Left row header sockets (10-pin block) */}
          <rect x={0.62} y={0.7} width={0.3} height={9.6} rx={0.05} fill="#1e293b" stroke="#0f172a" strokeWidth={0.03} />
          {Array.from({ length: 10 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            return (
              <g key={i}>
                <rect x={0.68} y={yOffset - 0.15} width={0.18} height={0.3} rx={0.04} fill="#090d16" />
                <rect x={0.72} y={yOffset - 0.08} width={0.1} height={0.16} rx={0.02} fill="#cbd5e1" />
                <text x={1.1} y={yOffset + 0.1} fontSize={0.25} fill="#94a3b8" stroke="none" fontWeight="bold">
                  {["RX0", "TX1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9"][i]}
                </text>
              </g>
            );
          })}

          {/* Right row header sockets (10-pin block) */}
          <rect x={5.08} y={0.7} width={0.3} height={9.6} rx={0.05} fill="#1e293b" stroke="#0f172a" strokeWidth={0.03} />
          {Array.from({ length: 10 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            return (
              <g key={i}>
                <rect x={5.14} y={yOffset - 0.15} width={0.18} height={0.3} rx={0.04} fill="#090d16" />
                <rect x={5.18} y={yOffset - 0.08} width={0.1} height={0.16} rx={0.02} fill="#cbd5e1" />
                <text x={4.9} y={yOffset + 0.1} fontSize={0.25} fill="#94a3b8" stroke="none" fontWeight="bold" textAnchor="end">
                  {["VIN", "GND", "5V", "3V3", "A0", "A1", "A2", "A3", "A4", "A5"][i]}
                </text>
              </g>
            );
          })}

          {/* Tiny copper solder pads around headers */}
          {Array.from({ length: 10 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            return (
              <g key={i}>
                <circle cx={0.55} cy={yOffset} r={0.05} fill="url(#brass-grad)" />
                <circle cx={5.45} cy={yOffset} r={0.05} fill="url(#brass-grad)" />
              </g>
            );
          })}

          {/* Highly Detailed Reset Button */}
          <g transform="translate(1.0 2.2)">
            <rect x={0} y={0} width={0.6} height={0.6} rx={0.05} fill="#94a3b8" stroke="#475569" strokeWidth={0.03} />
            <circle cx={0.3} cy={0.3} r={0.18} fill="url(#metal-shimmer-grad)" stroke="#64748b" strokeWidth={0.01} />
            <circle cx={0.3} cy={0.3} r={0.1} fill="#ef4444" /> {/* Red plunger */}
            {/* 4 Silver solder feet */}
            <rect x={-0.08} y={0.08} width={0.08} height={0.1} fill="#94a3b8" />
            <rect x={-0.08} y={0.42} width={0.08} height={0.1} fill="#94a3b8" />
            <rect x={0.6} y={0.08} width={0.08} height={0.1} fill="#94a3b8" />
            <rect x={0.6} y={0.42} width={0.08} height={0.1} fill="#94a3b8" />
          </g>

          {/* Elegant Gold/White text overlay with Arduino logo */}
          <circle cx={3.0} cy={1.4} r={0.3} fill="none" stroke="#fff" strokeWidth={0.03} opacity={0.3} />
          <circle cx={3.35} cy={1.4} r={0.3} fill="none" stroke="#fff" strokeWidth={0.03} opacity={0.3} />
          <text x={3.175} y={1.45} fontSize={0.16} fontWeight="bold" fill="#ffffff" opacity={0.5} textAnchor="middle" stroke="none">+</text>
          <text x={3.175} y={1.25} fontSize={0.1} fontWeight="bold" fill="#ffffff" opacity={0.5} textAnchor="middle" stroke="none">ARDUINO</text>
          <text x={3.175} y={2.3} fontSize={0.35} fontWeight="bold" fill="#ffffff" opacity={0.6} textAnchor="middle" stroke="none">UNO R3</text>
        </g>
      );
    }

    case "arduino_nano": {
      return (
        <g id={`realistic-arduino-nano-${node.id}`} filter="url(#realistic-shadow)">
          {/* PCB Board - Elegant blue-green mask */}
          <rect
            x={0.5}
            y={0.3}
            width={5.0}
            height={height - 0.6}
            rx={0.2}
            fill="url(#arduino-pcb-grad)"
            stroke="#034e50"
            strokeWidth={0.05}
          />

          {/* Copper Trace Routing (Golden tracks running on PCB for extreme realism) */}
          <path d="M 0.8,1.5 Q 1.4,2.2 1.8,3.0 T 2.3,4.5" fill="none" stroke="url(#brass-grad)" strokeWidth={0.012} opacity={0.25} />
          <path d="M 4.2,1.5 Q 3.6,2.2 3.2,3.0 T 2.7,4.5" fill="none" stroke="url(#brass-grad)" strokeWidth={0.012} opacity={0.25} />
          <path d="M 1.5,5.5 Q 2.2,5.2 2.8,6.0" fill="none" stroke="url(#brass-grad)" strokeWidth={0.01} opacity={0.2} />
          <path d="M 3.5,5.5 Q 2.8,5.2 2.2,6.0" fill="none" stroke="url(#brass-grad)" strokeWidth={0.01} opacity={0.2} />

          {/* Silk screen */}
          <rect
            x={0.68}
            y={0.48}
            width={4.64}
            height={height - 0.96}
            rx={0.12}
            fill="none"
            stroke="#ffffff"
            strokeWidth={0.012}
            opacity={0.35}
          />

          {/* USB Type-C / Mini port at top - Detailed silver metal bezel */}
          <rect
            x={1.85}
            y={0.2}
            width={2.3}
            height={1.3}
            rx={0.12}
            fill="url(#metal-shimmer-grad)"
            stroke="#475569"
            strokeWidth={0.04}
          />
          <rect x={2.05} y={0.3} width={1.9} height={0.35} fill="#1e293b" rx={0.05} />
          {/* Tiny gold pins inside USB connector */}
          <line x1={2.35} y1={0.4} x2={2.35} y2={0.5} stroke="url(#brass-grad)" strokeWidth={0.04} />
          <line x1={2.65} y1={0.4} x2={2.65} y2={0.5} stroke="url(#brass-grad)" strokeWidth={0.04} />
          <line x1={3.0} y1={0.4} x2={3.0} y2={0.5} stroke="url(#brass-grad)" strokeWidth={0.04} />
          <line x1={3.35} y1={0.4} x2={3.35} y2={0.5} stroke="url(#brass-grad)" strokeWidth={0.04} />
          <line x1={3.65} y1={0.4} x2={3.65} y2={0.5} stroke="url(#brass-grad)" strokeWidth={0.04} />

          {/* SMT Resistors & Capacitors (adds beautiful visual complexity) */}
          <rect x={1.2} y={2.5} width={0.15} height={0.08} rx={0.01} fill="#8b5a2b" stroke="#cbd5e1" strokeWidth={0.01} /> {/* Cap */}
          <rect x={1.2} y={2.7} width={0.15} height={0.08} rx={0.01} fill="#111" stroke="#cbd5e1" strokeWidth={0.01} /> {/* Res */}
          <rect x={1.4} y={2.6} width={0.08} height={0.15} rx={0.01} fill="#8b5a2b" stroke="#cbd5e1" strokeWidth={0.01} />
          <rect x={3.8} y={2.5} width={0.15} height={0.08} rx={0.01} fill="#8b5a2b" stroke="#cbd5e1" strokeWidth={0.01} />
          <rect x={3.8} y={2.7} width={0.15} height={0.08} rx={0.01} fill="#111" stroke="#cbd5e1" strokeWidth={0.01} />

          {/* Blue Tactical Reset Button with silver metal frame */}
          <g transform="translate(2.5 5.8)">
            <rect x={0} y={0} width={1.0} height={1.0} rx={0.1} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.04} />
            <circle cx={0.5} cy={0.5} r={0.32} fill="#2563eb" stroke="#1d4ed8" strokeWidth={0.02} />
            <circle cx={0.5} cy={0.5} r={0.15} fill="#3b82f6" />
            {/* Solder contacts */}
            <circle cx={-0.05} cy={0.2} r={0.05} fill="#cbd5e1" />
            <circle cx={-0.05} cy={0.8} r={0.05} fill="#cbd5e1" />
            <circle cx={1.05} cy={0.2} r={0.05} fill="#cbd5e1" />
            <circle cx={1.05} cy={0.8} r={0.05} fill="#cbd5e1" />
          </g>

          {/* 16MHz Crystal Resonator (SMD metal block next to MCU) */}
          <rect x={3.9} y={3.2} width={0.3} height={0.5} rx={0.05} fill="url(#metal-shimmer-grad)" stroke="#475569" strokeWidth={0.02} />
          <text x={4.05} y={3.5} fontSize={0.1} fontFamily="monospace" fill="#475569" textAnchor="middle" fontWeight="bold">16M</text>

          {/* Main MCU: ATmega328P TQFP-32 Square chip */}
          <g transform={`translate(2.25 3.3)`}>
            <rect
              x={0}
              y={0}
              width={1.5}
              height={1.5}
              rx={0.1}
              fill="#111827"
              stroke="#000"
              strokeWidth={0.04}
            />
            {/* White chip text */}
            <text x={0.75} y={0.7} fontSize={0.18} fontFamily="monospace" fill="#e2e8f0" fontWeight="bold" textAnchor="middle" stroke="none">MEGA</text>
            <text x={0.75} y={1.0} fontSize={0.16} fontFamily="monospace" fill="#cbd5e1" textAnchor="middle" stroke="none">328P</text>
            {/* Pin 1 index dot */}
            <circle cx={0.2} cy={0.2} r={0.04} fill="#cbd5e1" />
            {/* Tiny silver legs around chip */}
            {Array.from({ length: 8 }).map((_, i) => {
              const offset = 0.15 + i * 0.16;
              return (
                <g key={i}>
                  {/* Top */}
                  <line x1={offset} y1={0} x2={offset} y2={-0.1} stroke="#94a3b8" strokeWidth={0.03} />
                  {/* Bottom */}
                  <line x1={offset} y1={1.5} x2={offset} y2={1.6} stroke="#94a3b8" strokeWidth={0.03} />
                  {/* Left */}
                  <line x1={0} y1={offset} x2={-0.1} y2={offset} stroke="#94a3b8" strokeWidth={0.03} />
                  {/* Right */}
                  <line x1={1.5} y1={offset} x2={1.6} y2={offset} stroke="#94a3b8" strokeWidth={0.03} />
                </g>
              );
            })}
          </g>

          {/* LED indicators near the reset button (Power, Rx, Tx, L) */}
          {/* L LED - Orange */}
          <g>
            <circle cx={2.2} cy={7.8} r={0.08} fill={isGlowing ? "#fb923c" : "#7c2d12"} stroke="#431407" strokeWidth={0.01} />
            <text x={2.2} y={8.2} fontSize={0.15} fill="#fff" textAnchor="middle" stroke="none" opacity={0.6}>L</text>
            {isGlowing && (
              <circle cx={2.2} cy={7.8} r={0.25} fill="#f97316" opacity={0.35} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* PWR LED - Green */}
          <g>
            <circle cx={3.8} cy={7.8} r={0.08} fill={isGlowing ? "#4ade80" : "#14532d"} stroke="#052e16" strokeWidth={0.01} />
            <text x={3.8} y={8.2} fontSize={0.15} fill="#fff" textAnchor="middle" stroke="none" opacity={0.6}>POW</text>
            {isGlowing && (
              <circle cx={3.8} cy={7.8} r={0.25} fill="#22c55e" opacity={0.35} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* RX LED - Yellow/Orange */}
          <g>
            <circle cx={2.2} cy={8.7} r={0.07} fill={isGlowing ? "#facc15" : "#713f12"} stroke="#422006" strokeWidth={0.01} />
            <text x={2.2} y={9.1} fontSize={0.15} fill="#fff" textAnchor="middle" stroke="none" opacity={0.6}>RX</text>
            {isGlowing && (
              <circle cx={2.2} cy={8.7} r={0.2} fill="#eab308" opacity={0.25} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* TX LED - Yellow/Orange */}
          <g>
            <circle cx={3.8} cy={8.7} r={0.07} fill={isGlowing ? "#facc15" : "#713f12"} stroke="#422006" strokeWidth={0.01} />
            <text x={3.8} y={9.1} fontSize={0.15} fill="#fff" textAnchor="middle" stroke="none" opacity={0.6}>TX</text>
            {isGlowing && (
              <circle cx={3.8} cy={8.7} r={0.2} fill="#eab308" opacity={0.25} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* ICSP Header pins (6-pin gold plated male headers) */}
          <g transform="translate(2.1 9.4)">
            <rect x={0} y={0} width={1.8} height={0.5} rx={0.04} fill="#111" />
            {/* Golden Header Pins */}
            {Array.from({ length: 3 }).map((_, i) => (
              <g key={i}>
                <circle cx={0.3 + i * 0.6} cy={0.15} r={0.08} fill="url(#brass-grad)" stroke="#111" strokeWidth={0.01} />
                <circle cx={0.3 + i * 0.6} cy={0.35} r={0.08} fill="url(#brass-grad)" stroke="#111" strokeWidth={0.01} />
              </g>
            ))}
          </g>

          {/* Left row header pins (10-pin block) */}
          <rect x={0.62} y={0.7} width={0.3} height={9.6} rx={0.04} fill="#1e293b" stroke="#0f172a" strokeWidth={0.02} />
          {Array.from({ length: 10 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            return (
              <g key={i}>
                {/* Copper trace rings */}
                <circle cx={0.77} cy={yOffset} r={0.12} fill="url(#brass-grad)" opacity={0.8} />
                <circle cx={0.77} cy={yOffset} r={0.06} fill="#090d16" />
                <text x={1.1} y={yOffset + 0.12} fontSize={0.22} fill="#cbd5e1" stroke="none" fontWeight="bold">
                  {["D1", "GND", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9"][i]}
                </text>
              </g>
            );
          })}

          {/* Right row header pins (10-pin block) */}
          <rect x={5.08} y={0.7} width={0.3} height={9.6} rx={0.04} fill="#1e293b" stroke="#0f172a" strokeWidth={0.02} />
          {Array.from({ length: 10 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            return (
              <g key={i}>
                {/* Copper trace rings */}
                <circle cx={5.23} cy={yOffset} r={0.12} fill="url(#brass-grad)" opacity={0.8} />
                <circle cx={5.23} cy={yOffset} r={0.06} fill="#090d16" />
                <text x={4.9} y={yOffset + 0.12} fontSize={0.22} fill="#cbd5e1" stroke="none" fontWeight="bold" textAnchor="end">
                  {["VIN", "GND", "5V", "3V3", "A0", "A1", "A2", "A3", "A4", "A5"][i]}
                </text>
              </g>
            );
          })}

          <text x={3.0} y={2.2} fontSize={0.22} fill="#fff" opacity={0.8} fontWeight="bold" textAnchor="middle" stroke="none">NANO</text>
        </g>
      );
    }

    case "stm32_bluepill": {
      return (
        <g id={`realistic-stm32-bluepill-${node.id}`} filter="url(#realistic-shadow)">
          {/* Main PCB Board - Gorgeous rich royal blue */}
          <rect
            x={0.5}
            y={0.3}
            width={5.0}
            height={height - 0.6}
            rx={0.2}
            fill="url(#stm32-pcb-grad)"
            stroke="#0a2a54"
            strokeWidth={0.05}
          />

          {/* Copper Trace Routing (Golden tracks running on PCB for extreme realism) */}
          <path d="M 0.8,1.2 Q 1.5,1.8 2.2,2.0 T 3.5,2.1" fill="none" stroke="url(#brass-grad)" strokeWidth={0.012} opacity={0.25} />
          <path d="M 1.2,3.2 Q 1.8,2.8 2.5,3.6 T 4.2,4.8" fill="none" stroke="url(#brass-grad)" strokeWidth={0.01} opacity={0.25} />
          <path d="M 1.4,8.0 L 2.0,8.0 Q 2.4,6.5 2.8,6.0" fill="none" stroke="url(#brass-grad)" strokeWidth={0.015} opacity={0.2} />
          <path d="M 4.5,1.2 L 4.0,2.5 Q 3.8,3.2 3.1,3.4" fill="none" stroke="url(#brass-grad)" strokeWidth={0.01} opacity={0.25} />

          {/* Silk screen lines */}
          <rect
            x={0.68}
            y={0.48}
            width={4.64}
            height={height - 0.96}
            rx={0.1}
            fill="none"
            stroke="#ffffff"
            strokeWidth={0.012}
            opacity={0.3}
          />

          {/* Micro USB Port at top center - Detailed silver metal bezel */}
          <rect
            x={2.1}
            y={0.2}
            width={1.8}
            height={1.1}
            rx={0.05}
            fill="url(#metal-shimmer-grad)"
            stroke="#64748b"
            strokeWidth={0.04}
          />
          <rect x={2.3} y={0.3} width={1.4} height={0.3} fill="#1e293b" />
          
          {/* Detailed Red Reset switch with silver frame */}
          <g transform="translate(1.0 1.6)">
            <rect x={0} y={0} width={0.6} height={0.6} rx={0.05} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.02} />
            <circle cx={0.3} cy={0.3} r={0.18} fill="url(#metal-shimmer-grad)" stroke="#64748b" strokeWidth={0.01} />
            <circle cx={0.3} cy={0.3} r={0.1} fill="#ef4444" /> {/* Red reset button plunger */}
          </g>

          {/* 8MHz Crystal Oscillator (HC-49/S metal can) */}
          <rect
            x={1.1}
            y={2.6}
            width={0.4}
            height={1.0}
            rx={0.15}
            fill="url(#metal-shimmer-grad)"
            stroke="#475569"
            strokeWidth={0.02}
          />
          <text x={1.3} y={3.2} fontSize={0.13} fontFamily="monospace" fill="#475569" textAnchor="middle" stroke="none" fontWeight="bold">8.000</text>

          {/* Tiny RTC 32.768kHz Crystal Oscillator (Cylinder metal can) */}
          <rect x={4.3} y={2.6} width={0.2} height={0.6} rx={0.05} fill="url(#metal-shimmer-grad)" stroke="#475569" strokeWidth={0.01} />

          {/* STM32F103C8T6 Main Microcontroller Chip (LQFP-48) */}
          <g transform={`translate(2.1 4.0)`}>
            <rect
              x={0}
              y={0}
              width={1.8}
              height={1.8}
              rx={0.08}
              fill="#181a1e"
              stroke="#000"
              strokeWidth={0.04}
            />
            {/* White laser etch branding */}
            <text x={0.9} y={0.5} fontSize={0.15} fontFamily="monospace" fill="#cbd5e1" fontWeight="bold" textAnchor="middle" stroke="none">STM32F103</text>
            <text x={0.9} y={0.9} fontSize={0.13} fontFamily="monospace" fill="#94a3b8" textAnchor="middle" stroke="none">C8T6</text>
            <text x={0.9} y={1.3} fontSize={0.11} fontFamily="monospace" fill="#64748b" textAnchor="middle" stroke="none">ARM</text>
            {/* Pin 1 dot */}
            <circle cx={0.2} cy={0.2} r={0.04} fill="#cbd5e1" />
            {/* Silver metal legs on four sides */}
            {Array.from({ length: 12 }).map((_, i) => {
              const offset = 0.15 + i * 0.135;
              return (
                <g key={i}>
                  {/* Top */}
                  <line x1={offset} y1={0} x2={offset} y2={-0.12} stroke="#e2e8f0" strokeWidth={0.02} />
                  {/* Bottom */}
                  <line x1={offset} y1={1.8} x2={offset} y2={1.92} stroke="#e2e8f0" strokeWidth={0.02} />
                  {/* Left */}
                  <line x1={0} y1={offset} x2={-0.12} y2={offset} stroke="#e2e8f0" strokeWidth={0.02} />
                  {/* Right */}
                  <line x1={1.8} y1={offset} x2={1.92} y2={offset} stroke="#e2e8f0" strokeWidth={0.02} />
                </g>
              );
            })}
          </g>

          {/* Yellow Boot jumpers (BOOT0, BOOT1) - Classic visual detail */}
          <g transform={`translate(4.0 6.3)`}>
            {/* Black base pins */}
            <rect x={0} y={0} width={0.7} height={0.9} fill="#111" />
            <circle cx={0.2} cy={0.25} r={0.05} fill="#eab308" />
            <circle cx={0.2} cy={0.65} r={0.05} fill="#eab308" />
            <circle cx={0.5} cy={0.25} r={0.05} fill="#eab308" />
            <circle cx={0.5} cy={0.65} r={0.05} fill="#eab308" />
            {/* Bright Yellow plastic jumper blocks */}
            <rect x={0.1} y={0.1} width={0.5} height={0.3} rx={0.03} fill="#facc15" stroke="#ca8a04" strokeWidth={0.02} />
            <rect x={0.1} y={0.5} width={0.5} height={0.3} rx={0.03} fill="#facc15" stroke="#ca8a04" strokeWidth={0.02} />
            <text x={0.35} y={-0.1} fontSize={0.15} fill="#fff" textAnchor="middle" stroke="none" opacity={0.6}>BOOT</text>
          </g>

          {/* On-board status LEDs (PWR red, PC13 green/blue) */}
          {/* PWR LED - Red */}
          <g>
            <circle cx={4.3} cy={1.3} r={0.07} fill={isGlowing ? "#f87171" : "#7f1d1d"} stroke="#450a0a" strokeWidth={0.01} />
            <text x={4.3} y={1.0} fontSize={0.15} fill="#fff" textAnchor="middle" stroke="none" opacity={0.65}>PWR</text>
            {isGlowing && (
              <circle cx={4.3} cy={1.3} r={0.25} fill="#ef4444" opacity={0.35} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* PC13 LED - Green */}
          <g>
            <circle cx={4.3} cy={2.0} r={0.07} fill={isGlowing ? "#4ade80" : "#14532d"} stroke="#052e16" strokeWidth={0.01} />
            <text x={4.3} y={1.7} fontSize={0.15} fill="#fff" textAnchor="middle" stroke="none" opacity={0.65}>C13</text>
            {isGlowing && (
              <circle cx={4.3} cy={2.0} r={0.25} fill="#22c55e" opacity={0.35} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* 3.3V power regulator chip */}
          <rect x={1.1} y={6.5} width={0.5} height={0.5} fill="#111" stroke="#222" strokeWidth={0.02} />
          <rect x={1.2} y={7.0} width={0.3} height={0.1} fill="#94a3b8" />

          {/* Solder SWD Header pins at the bottom (4 gold plated headers pointing downwards) */}
          <g transform={`translate(2.1 8.8)`}>
            <rect x={0} y={0} width={1.8} height={0.4} rx={0.03} fill="#111" />
            {Array.from({ length: 4 }).map((_, i) => (
              <g key={i}>
                <circle cx={0.25 + i * 0.43} cy={0.2} r={0.07} fill="url(#brass-grad)" stroke="#111" strokeWidth={0.01} />
                <rect x={0.21 + i * 0.43} y={0.2} width={0.08} height={0.4} fill="url(#brass-grad)" rx={0.02} />
              </g>
            ))}
          </g>

          {/* Left row header pins (9-pin block) */}
          <rect x={0.62} y={0.7} width={0.3} height={8.6} rx={0.04} fill="#1e293b" stroke="#0f172a" strokeWidth={0.02} />
          {Array.from({ length: 9 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            return (
              <g key={i}>
                <circle cx={0.77} cy={yOffset} r={0.12} fill="url(#brass-grad)" opacity={0.8} />
                <circle cx={0.77} cy={yOffset} r={0.06} fill="#090d16" />
                <text x={1.1} y={yOffset + 0.12} fontSize={0.22} fill="#cbd5e1" stroke="none" fontWeight="bold">
                  {["3V3", "GND", "D15", "D2", "D4", "RX2", "TX2", "D5", "SCK"][i]}
                </text>
              </g>
            );
          })}

          {/* Right row header pins (9-pin block) */}
          <rect x={5.08} y={0.7} width={0.3} height={8.6} rx={0.04} fill="#1e293b" stroke="#0f172a" strokeWidth={0.02} />
          {Array.from({ length: 9 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            return (
              <g key={i}>
                <circle cx={5.23} cy={yOffset} r={0.12} fill="url(#brass-grad)" opacity={0.8} />
                <circle cx={5.23} cy={yOffset} r={0.06} fill="#090d16" />
                <text x={4.9} y={yOffset + 0.12} fontSize={0.22} fill="#cbd5e1" stroke="none" fontWeight="bold" textAnchor="end">
                  {["VIN", "GND", "D13", "D12", "D14", "D27", "D26", "D25", "D33"][i]}
                </text>
              </g>
            );
          })}

          <text x={3.0} y={2.1} fontSize={0.2} fill="#fff" opacity={0.8} fontWeight="bold" textAnchor="middle" stroke="none">Blue Pill</text>
          <text x={3.0} y={2.4} fontSize={0.12} fill="#94a3b8" textAnchor="middle" stroke="none">STM32F103</text>
        </g>
      );
    }

    case "esp32":
    case "esp32_devkit":
    case "esp32_wroom": {
      const isLegacy = symbolId === "esp32";
      const actualHeight = height;
      return (
        <g id={`realistic-esp32-${node.id}`} filter="url(#realistic-shadow)">
          {/* Main PCB Board - Classy Matte Black / Charcoal grey */}
          <rect
            x={0.5}
            y={0.3}
            width={5.0}
            height={actualHeight - 0.6}
            rx={0.2}
            fill="url(#esp32-pcb-grad)"
            stroke="#111"
            strokeWidth={0.06}
          />
          {/* Fine gold traces on the PCB */}
          <rect
            x={0.65}
            y={0.45}
            width={4.7}
            height={actualHeight - 0.9}
            rx={0.12}
            fill="none"
            stroke="url(#brass-grad)"
            strokeWidth={0.01}
            opacity={0.3}
          />

          {/* ESP32-WROOM-32 Shield Module - at the top */}
          <g transform={`translate(1.3 0.6)`}>
            {/* The Antenna zone - Black with gold curvy track */}
            <rect x={0} y={0} width={3.4} height={1.2} rx={0.05} fill="#111827" />
            <path
              d="M 0.3,0.6 L 0.6,0.6 L 0.6,0.3 L 0.9,0.3 L 0.9,0.9 L 1.2,0.9 L 1.2,0.3 L 1.5,0.3 L 1.5,0.9 L 1.8,0.9 L 1.8,0.3 L 2.1,0.3 L 2.1,0.9 L 2.4,0.9 L 2.4,0.3 L 2.7,0.3 L 2.7,0.6 L 3.1,0.6"
              fill="none"
              stroke="url(#brass-grad)"
              strokeWidth={0.08}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Metal shielding can */}
            <rect
              x={0}
              y={1.2}
              width={3.4}
              height={2.2}
              rx={0.08}
              fill="url(#metal-shimmer-grad)"
              stroke="#94a3b8"
              strokeWidth={0.03}
            />
            {/* Espressif ESP32 Logo engraving */}
            <text x={1.7} y={2.0} fontSize={0.24} fontWeight="bold" fontFamily="monospace" fill="#475569" textAnchor="middle" stroke="none">ESP32-WROOM</text>
            <text x={1.7} y={2.35} fontSize={0.16} fontFamily="sans-serif" fill="#64748b" textAnchor="middle" stroke="none">FCC ID: 2AC7Z-ESPWROOM</text>
            {/* Solder points on module sides */}
            {Array.from({ length: 6 }).map((_, i) => (
              <g key={i}>
                <rect x={-0.06} y={1.4 + i * 0.3} width={0.12} height={0.12} fill="#cbd5e1" rx={0.02} />
                <rect x={3.34} y={1.4 + i * 0.3} width={0.12} height={0.12} fill="#cbd5e1" rx={0.02} />
              </g>
            ))}
          </g>

          {/* Micro-USB port at the bottom */}
          <rect
            x={2.1}
            y={actualHeight - 1.3}
            width={1.8}
            height={1.1}
            rx={0.05}
            fill="url(#metal-shimmer-grad)"
            stroke="#64748b"
            strokeWidth={0.04}
          />
          <rect x={2.3} y={actualHeight - 1.2} width={1.4} height={0.3} fill="#1e293b" />

          {/* Tactile buttons on either side of the USB port (Boot & EN) */}
          {/* EN/Reset button */}
          <rect x={0.9} y={actualHeight - 1.3} width={0.8} height={0.8} rx={0.05} fill="#94a3b8" stroke="#475569" strokeWidth={0.02} />
          <circle cx={1.3} cy={actualHeight - 0.9} r={0.2} fill="#ef4444" />
          <text x={1.3} y={actualHeight - 1.4} fontSize={0.18} fill="#fff" textAnchor="middle" stroke="none" opacity={0.65}>EN</text>

          {/* BOOT button */}
          <rect x={4.3} y={actualHeight - 1.3} width={0.8} height={0.8} rx={0.05} fill="#94a3b8" stroke="#475569" strokeWidth={0.02} />
          <circle cx={4.7} cy={actualHeight - 0.9} r={0.2} fill="#111" />
          <text x={4.7} y={actualHeight - 1.4} fontSize={0.18} fill="#fff" textAnchor="middle" stroke="none" opacity={0.65}>BOOT</text>

          {/* USB interface chip CP2102 */}
          <rect x={2.3} y={actualHeight - 2.8} width={1.4} height={1.1} rx={0.05} fill="#181a1e" stroke="#222" strokeWidth={0.02} />
          <text x={3.0} y={actualHeight - 2.2} fontSize={0.14} fontFamily="monospace" fill="#64748b" textAnchor="middle" stroke="none">SILABS</text>
          {Array.from({ length: 5 }).map((_, i) => (
            <g key={i}>
              <rect x={2.18} y={actualHeight - 2.7 + i * 0.2} width={0.12} height={0.06} fill="#cbd5e1" />
              <rect x={3.7} y={actualHeight - 2.7 + i * 0.2} width={0.12} height={0.06} fill="#cbd5e1" />
            </g>
          ))}

          {/* Red Power LED (glowing if active) */}
          <g>
            <circle cx={1.3} cy={4.5} r={0.08} fill={isGlowing ? "#f87171" : "#7f1d1d"} stroke="#450a0a" strokeWidth={0.01} />
            <text x={1.3} y={4.9} fontSize={0.15} fill="#94a3b8" textAnchor="middle" stroke="none" opacity={0.7}>PWR</text>
            {isGlowing && (
              <circle cx={1.3} cy={4.5} r={0.25} fill="#ef4444" opacity={0.35} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* Blue built-in user LED (IO2) */}
          <g>
            <circle cx={4.7} cy={4.5} r={0.08} fill={isGlowing ? "#60a5fa" : "#1d4ed8"} stroke="#172554" strokeWidth={0.01} />
            <text x={4.7} y={4.9} fontSize={0.15} fill="#94a3b8" textAnchor="middle" stroke="none" opacity={0.7}>IO2</text>
            {isGlowing && (
              <circle cx={4.7} cy={4.5} r={0.25} fill="#3b82f6" opacity={0.35} filter="url(#led-glowing-aura)" style={{ pointerEvents: "none" }} />
            )}
          </g>

          {/* Left row header pins/solder rings */}
          <rect x={0.62} y={0.7} width={0.3} height={actualHeight - 2.0} rx={0.04} fill="#111" stroke="#222" strokeWidth={0.01} />
          {Array.from({ length: actualHeight - 1 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            if (yOffset >= actualHeight - 0.5) return null;
            return (
              <g key={i}>
                <circle cx={0.77} cy={yOffset} r={0.12} fill="url(#brass-grad)" opacity={0.8} />
                <circle cx={0.77} cy={yOffset} r={0.06} fill="#090d16" />
                <text x={1.1} y={yOffset + 0.12} fontSize={0.22} fill="#cbd5e1" stroke="none" fontWeight="bold">
                  {isLegacy 
                    ? ["3V3", "EN", "VP", "VN", "34", "35", "32", "33", "25", "26", "27", "14", "12", "GND", "13", "SD2"][i]
                    : ["3V3", "GND", "D15", "D2", "D4", "RX2", "TX2", "D5", "SCK"][i]}
                </text>
              </g>
            );
          })}

          {/* Right row header pins/solder rings */}
          <rect x={5.08} y={0.7} width={0.3} height={actualHeight - 2.0} rx={0.04} fill="#111" stroke="#222" strokeWidth={0.01} />
          {Array.from({ length: actualHeight - 1 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            if (yOffset >= actualHeight - 0.5) return null;
            return (
              <g key={i}>
                <circle cx={5.23} cy={yOffset} r={0.12} fill="url(#brass-grad)" opacity={0.8} />
                <circle cx={5.23} cy={yOffset} r={0.06} fill="#090d16" />
                <text x={4.9} y={yOffset + 0.12} fontSize={0.22} fill="#cbd5e1" stroke="none" fontWeight="bold" textAnchor="end">
                  {isLegacy 
                    ? ["GND", "23", "22", "TXD", "RXD", "21", "19", "18", "5", "17", "16", "4", "0", "2", "15", "SD1"][i]
                    : ["VIN", "GND", "D13", "D12", "D14", "D27", "D26", "D25", "D33"][i]}
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    case "esp8266_nodemcu": {
      return (
        <g id={`realistic-nodemcu-${node.id}`} filter="url(#realistic-shadow)">
          <rect
            x={0.5}
            y={0.3}
            width={5.0}
            height={height - 0.6}
            rx={0.2}
            fill="#0f172a"
            stroke="#111"
            strokeWidth={0.05}
          />
          {/* Fine gold borders */}
          <rect x={0.65} y={0.45} width={4.7} height={height - 0.9} rx={0.12} fill="none" stroke="url(#brass-grad)" strokeWidth={0.012} opacity={0.25} />

          {/* ESP-12F WiFi Module - shiny metal with copper antenna at top */}
          <g transform={`translate(1.5 0.5)`}>
            <rect x={0} y={0} width={3.0} height={1.0} fill="#111" rx={0.03} />
            <path
              d="M 0.2,0.5 L 0.5,0.5 L 0.5,0.2 L 0.8,0.2 L 0.8,0.8 L 1.1,0.8 L 1.1,0.2 L 1.4,0.2 L 1.4,0.8 L 1.7,0.8 L 1.7,0.2 L 2.0,0.2 L 2.0,0.5 L 2.8,0.5"
              fill="none"
              stroke="url(#brass-grad)"
              strokeWidth={0.07}
            />
            {/* Metal shield */}
            <rect x={0} y={1.0} width={3.0} height={2.0} rx={0.05} fill="url(#metal-shimmer-grad)" stroke="#94a3b8" strokeWidth={0.02} />
            <text x={1.5} y={1.7} fontSize={0.18} fontFamily="monospace" fontWeight="bold" fill="#475569" textAnchor="middle" stroke="none">MODEL</text>
            <text x={1.5} y={2.1} fontSize={0.22} fontFamily="monospace" fontWeight="bold" fill="#334155" textAnchor="middle" stroke="none">ESP-12F</text>
          </g>

          {/* Micro USB Port */}
          <rect x={2.1} y={height - 1.2} width={1.8} height={1.0} rx={0.05} fill="url(#metal-shimmer-grad)" stroke="#64748b" strokeWidth={0.03} />

          {/* Buttons EN and FLASH */}
          <circle cx={1.3} cy={height - 1.0} r={0.15} fill="#475569" />
          <circle cx={4.7} cy={height - 1.0} r={0.15} fill="#111" />
          <text x={1.3} y={height - 1.3} fontSize={0.16} fill="#fff" textAnchor="middle" stroke="none" opacity={0.6}>RST</text>
          <text x={4.7} y={height - 1.3} fontSize={0.16} fill="#fff" textAnchor="middle" stroke="none" opacity={0.6}>FLASH</text>

          {/* Pins */}
          {Array.from({ length: 8 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            return (
              <g key={i}>
                <circle cx={0.77} cy={yOffset} r={0.1} fill="url(#brass-grad)" />
                <circle cx={0.77} cy={yOffset} r={0.05} fill="#000" />
                <text x={1.1} y={yOffset + 0.1} fontSize={0.2} fill="#94a3b8" stroke="none" fontWeight="bold">
                  {["A0", "D0", "D1", "D2", "D3", "D4", "3V3", "GND"][i]}
                </text>

                <circle cx={5.23} cy={yOffset} r={0.1} fill="url(#brass-grad)" />
                <circle cx={5.23} cy={yOffset} r={0.05} fill="#000" />
                <text x={4.9} y={yOffset + 0.1} fontSize={0.2} fill="#94a3b8" stroke="none" fontWeight="bold" textAnchor="end">
                  {["VIN", "GND", "3V3", "D8", "D7", "D6", "D5", "GND"][i]}
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    case "rpi_pico": {
      return (
        <g id={`realistic-rpipico-${node.id}`} filter="url(#realistic-shadow)">
          {/* Green PCB */}
          <rect
            x={0.5}
            y={0.3}
            width={5.0}
            height={height - 0.6}
            rx={0.15}
            fill="url(#pico-pcb-grad)"
            stroke="#0f766e"
            strokeWidth={0.05}
          />

          {/* Micro USB Port */}
          <rect x={2.1} y={0.2} width={1.8} height={1.1} rx={0.05} fill="url(#metal-shimmer-grad)" stroke="#64748b" strokeWidth={0.04} />

          {/* BOOTSEL Button */}
          <rect x={1.2} y={1.6} width={0.6} height={0.5} rx={0.04} fill="#cbd5e1" stroke="#94a3b8" strokeWidth={0.02} />
          <circle cx={1.5} cy={1.85} r={0.15} fill="#fff" stroke="#94a3b8" strokeWidth={0.01} />

          {/* RP2040 chip in the center */}
          <rect x={2.1} y={3.8} width={1.8} height={1.8} rx={0.12} fill="#181a1e" stroke="#111" strokeWidth={0.03} />
          <circle cx={3.0} cy={4.7} r={0.5} fill="none" stroke="#2a2e35" strokeWidth={0.05} />
          <text x={3.0} y={4.6} fontSize={0.18} fontFamily="monospace" fill="#cbd5e1" fontWeight="bold" textAnchor="middle" stroke="none">RP2-B2</text>
          <text x={3.0} y={4.95} fontSize={0.14} fontFamily="monospace" fill="#94a3b8" textAnchor="middle" stroke="none">RP2040</text>

          {/* Flash memory chip */}
          <rect x={2.3} y={6.2} width={1.4} height={1.0} rx={0.05} fill="#111827" stroke="#222" strokeWidth={0.02} />
          {Array.from({ length: 4 }).map((_, i) => (
            <g key={i}>
              <rect x={2.18} y={6.3 + i * 0.22} width={0.12} height={0.05} fill="#cbd5e1" />
              <rect x={3.7} y={6.3 + i * 0.22} width={0.12} height={0.05} fill="#cbd5e1" />
            </g>
          ))}

          {/* RP2040 Crystal oscillator */}
          <rect x={1.1} y={4.4} width={0.5} height={0.3} rx={0.05} fill="url(#metal-shimmer-grad)" stroke="#475569" strokeWidth={0.01} />

          {/* Gold castellated half-pads along left and right */}
          {Array.from({ length: 10 }).map((_, i) => {
            const yOffset = 1.0 + i * 1.0;
            return (
              <g key={i}>
                <rect x={0.46} y={yOffset - 0.2} width={0.16} height={0.4} fill="url(#brass-grad)" rx={0.02} />
                <circle cx={0.62} cy={yOffset} r={0.08} fill="url(#brass-grad)" />
                <circle cx={0.62} cy={yOffset} r={0.04} fill="#090d16" />
                <text x={1.1} y={yOffset + 0.12} fontSize={0.22} fill="#e2e8f0" stroke="none" fontWeight="bold">
                  {["GP0", "GP1", "GND", "GP2", "GP3", "GP4", "GP5", "GND", "GP6", "GP7"][i]}
                </text>

                <rect x={5.38} y={yOffset - 0.2} width={0.16} height={0.4} fill="url(#brass-grad)" rx={0.02} />
                <circle cx={5.38} cy={yOffset} r={0.08} fill="url(#brass-grad)" />
                <circle cx={5.38} cy={yOffset} r={0.04} fill="#090d16" />
                <text x={4.9} y={yOffset + 0.12} fontSize={0.22} fill="#e2e8f0" stroke="none" fontWeight="bold" textAnchor="end">
                  {["VBUS", "VSYS", "GND", "3V3EN", "3V3", "VREF", "GP28", "GND", "GP27", "GP26"][i]}
                </text>
              </g>
            );
          })}
        </g>
      );
    }

    case "voltmeter":
    case "ammeter": {
      const isVoltmeter = symbolId === "voltmeter";
      return (
        <g id={`realistic-${symbolId}-${node.id}`} filter="url(#realistic-shadow)">
          {/* Metal Leads extending out of the left and right sides */}
          <path d={`M 0,${cy} L ${width},${cy}`} stroke="#cbd5e1" strokeWidth={0.16} strokeLinecap="round" />
          
          {/* Solder Blobs */}
          <circle cx={0.3} cy={cy} r={0.2} fill="#94a3b8" />
          <circle cx={width - 0.3} cy={cy} r={0.2} fill="#94a3b8" />

          {/* Device Outer Body - Dark Slate/Navy Plastic Case */}
          <rect
            x={0.4}
            y={0.2}
            width={width - 0.8}
            height={height - 0.4}
            rx={0.15}
            fill="#1e293b"
            stroke="#475569"
            strokeWidth={0.06}
          />
          {/* Blue or Green Accent Border */}
          <rect
            x={0.46}
            y={0.26}
            width={width - 0.92}
            height={height - 0.52}
            rx={0.12}
            fill="none"
            stroke={isVoltmeter ? "#3b82f6" : "#10b981"}
            strokeWidth={0.04}
            opacity={0.8}
          />

          {/* Digital Screen LCD display */}
          <rect
            x={0.7}
            y={0.4}
            width={width - 1.4}
            height={height - 0.8}
            rx={0.08}
            fill="#090d16"
            stroke="#334155"
            strokeWidth={0.04}
          />

          {/* Subtle LCD Grid Pattern lines for realistic retro-look */}
          <rect
            x={0.74}
            y={0.44}
            width={width - 1.48}
            height={height - 0.88}
            fill={isVoltmeter ? "rgba(59, 130, 246, 0.08)" : "rgba(16, 185, 129, 0.08)"}
            pointerEvents="none"
          />

          {/* Large display letter in background */}
          <text
            x={cx}
            y={cy + 0.25}
            fontSize={0.9}
            fontWeight="900"
            fill={isVoltmeter ? "#3b82f6" : "#10b981"}
            opacity={0.12}
            textAnchor="middle"
            stroke="none"
            fontFamily="monospace"
          >
            {isVoltmeter ? "V" : "A"}
          </text>

          {/* Center Display Value */}
          <text
            x={cx}
            y={cy + 0.15}
            fontSize={0.35}
            fontWeight="bold"
            fill={isVoltmeter ? "#60a5fa" : "#34d399"}
            textAnchor="middle"
            stroke="none"
            fontFamily="monospace"
            style={{ letterSpacing: "0.02em" }}
          >
            {value || (isVoltmeter ? "0.00 V" : "0.00 A")}
          </text>

          {/* Center Indicator Text: VDC or ADC */}
          <text
            x={width - 0.85}
            y={0.65}
            fontSize={0.16}
            fontWeight="bold"
            fill={isVoltmeter ? "#60a5fa" : "#34d399"}
            textAnchor="end"
            stroke="none"
            opacity={0.7}
          >
            {isVoltmeter ? "VDC" : "ADC"}
          </text>
        </g>
      );
    }

    /* ====== LOGIC GATES & ICs (Represented as DIP ICs) ====== */
    case "and_gate":
    case "or_gate":
    case "not_gate":
    case "nand_gate":
    case "nor_gate":
    case "xor_gate":
    case "xnor_gate":
    case "buffer_gate":
    case "schmitt_trigger":
    case "tristate_buffer":
    case "ic4":
    case "ic6":
    case "ic8":
    case "ic14":
    case "ic16":
    case "ic20":
    case "ic28":
    case "ic40":
    case "mcu8":
    case "mcu14":
    case "mcu16":
    case "mcu20":
    case "mcu28":
    case "atmega328p":
    case "attiny85":
    case "esp12f":
    case "stm32_chip":
    case "pic16f877a":
    case "ne555":
    case "mcu40":
    case "mcu64":
    case "single_opamp":
    case "dual_opamp":
    case "quad_opamp":
    case "comparator":
    case "instrumentation_amp":
    case "audio_amplifier":
    case "generic_opamp": {
      let chipLabel = symbolId.replace("_gate", "").toUpperCase().replace("_", " ");
      if (symbolId.startsWith("ic")) chipLabel = value || `IC-${symbolId.slice(2)}`;
      if (symbolId.startsWith("mcu")) chipLabel = value || `MCU-${symbolId.slice(3)}`;
      if (symbolId === "atmega328p") chipLabel = "ATmega328P";
      if (symbolId === "attiny85") chipLabel = "ATTiny85";
      if (symbolId === "esp12f") chipLabel = "ESP-12F";
      if (symbolId === "stm32_chip") chipLabel = "STM32F103";
      if (symbolId === "pic16f877a") chipLabel = "PIC16F877A";
      if (symbolId === "generic_opamp") chipLabel = "OP-AMP";
      if (symbolId === "ne555") chipLabel = "NE555";

      const isVertical = height > width;

      return (
        <g id={`realistic-logic-${node.id}`} filter="url(#realistic-shadow)">
          {/* DIP Package Body */}
          <rect 
            x={0.5} 
            y={0.3} 
            width={width - 1.0} 
            height={height - 0.6} 
            rx={0.1} 
            fill="url(#transistor-body-grad)" 
            stroke="#111" 
            strokeWidth={0.05} 
          />
          
          {/* Notch at the top */}
          <path d={`M ${cx - 0.2},0.3 A 0.2,0.2 0 0,0 ${cx + 0.2},0.3 Z`} fill="#000" />
          
          {/* Pins */}
          {symbol?.pins.map((pin, i) => {
            const isLeft = pin.x === 0;
            const isRight = pin.x === width;
            const isTop = pin.y === 0;
            const isBottom = pin.y === height;

            return (
              <g key={i}>
                <circle cx={pin.x} cy={pin.y} r={0.15} fill="#94a3b8" />
                <line 
                  x1={pin.x} 
                  y1={pin.y} 
                  x2={isLeft ? 0.5 : isRight ? width - 0.5 : pin.x} 
                  y2={isTop ? 0.3 : isBottom ? height - 0.3 : pin.y} 
                  stroke="#cbd5e1" 
                  strokeWidth={0.16} 
                  strokeLinecap="round" 
                />
              </g>
            );
          })}

          <g transform={`translate(${cx} ${cy}) ${height > 10 ? "rotate(-90)" : ""}`}>
            <text x={0} y={0} fontSize={0.35} fontWeight="bold" fill="#e2e8f0" textAnchor="middle" stroke="none" fontFamily="monospace">
              {chipLabel}
            </text>
            <text x={0} y={0.35} fontSize={0.18} fill="#94a3b8" textAnchor="middle" stroke="none" fontFamily="monospace" opacity={0.7}>
              {symbolId.includes("opamp") || symbolId.includes("amp") || symbolId === "comparator" ? "Analog Integrated Circuit" : symbolId.startsWith("mcu") ? "Microcontroller" : "74LS Series"}
            </text>
          </g>
        </g>
      );
    }

    case "ultrasonic": {
      return (
        <g id={`realistic-ultrasonic-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={0.2} width={width - 0.4} height={height - 0.4} rx={0.1} fill="#1e3a8a" />
          <circle cx={1} cy={0.9} r={0.6} fill="#94a3b8" stroke="#475569" strokeWidth={0.05} />
          <circle cx={1} cy={0.9} r={0.4} fill="#e2e8f0" opacity={0.5} />
          <text x={1} y={0.95} fontSize={0.2} textAnchor="middle" fill="#1e293b" stroke="none" fontWeight="bold">T</text>
          
          <circle cx={3} cy={0.9} r={0.6} fill="#94a3b8" stroke="#475569" strokeWidth={0.05} />
          <circle cx={3} cy={0.9} r={0.4} fill="#e2e8f0" opacity={0.5} />
          <text x={3} y={0.95} fontSize={0.2} textAnchor="middle" fill="#1e293b" stroke="none" fontWeight="bold">R</text>
          
          <text x={2} y={1.4} fontSize={0.2} textAnchor="middle" fill="#fff" stroke="none" opacity={0.8}>HC-SR04</text>
          {Array.from({ length: 4 }).map((_, i) => (
            <circle key={i} cx={0.5 + i} cy={height} r={0.15} fill="#94a3b8" />
          ))}
        </g>
      );
    }

    case "pir_sensor": {
      return (
        <g id={`realistic-pir-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} rx={0.1} fill="#166534" />
          <circle cx={cx} cy={cy - 0.2} r={0.8} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={0.05} />
          <path d="M 1.5,0.5 A 0.8,0.8 0 0,1 2.3,1.3" fill="none" stroke="#cbd5e1" strokeWidth={0.02} />
          <text x={cx} y={cy + 0.8} fontSize={0.25} textAnchor="middle" fill="#fff" stroke="none">PIR</text>
          {Array.from({ length: 3 }).map((_, i) => (
            <circle key={i} cx={0.5 + i} cy={height} r={0.15} fill="#94a3b8" />
          ))}
        </g>
      );
    }

    case "dht11": {
      return (
        <g id={`realistic-dht11-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} rx={0.1} fill="#2563eb" />
          <rect x={0.8} y={0.8} width={1.4} height={1.8} fill="#1e40af" rx={0.05} />
          {Array.from({ length: 4 }).map((_, i) => (
            <line key={i} x1={0.8} y1={1.1 + i * 0.4} x2={2.2} y2={1.1 + i * 0.4} stroke="#3b82f6" strokeWidth={0.05} />
          ))}
          {Array.from({ length: 3 }).map((_, i) => (
            <line key={i} x1={1.15 + i * 0.35} y1={0.8} x2={1.15 + i * 0.35} y2={2.6} stroke="#3b82f6" strokeWidth={0.05} />
          ))}
          <text x={cx} y={cy + 1.2} fontSize={0.25} textAnchor="middle" fill="#fff" stroke="none" fontWeight="bold">DHT11</text>
          {Array.from({ length: 3 }).map((_, i) => (
            <circle key={i} cx={0.5 + i} cy={height} r={0.15} fill="#94a3b8" />
          ))}
        </g>
      );
    }

    case "gas_sensor": {
      return (
        <g id={`realistic-gas-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} rx={1.5} fill="#334155" />
          <circle cx={cx} cy={cy - 0.2} r={1.2} fill="#94a3b8" stroke="#475569" strokeWidth={0.05} />
          <circle cx={cx} cy={cy - 0.2} r={1.1} fill="none" stroke="#1e293b" strokeWidth={0.02} strokeDasharray="0.1 0.1" />
          <text x={cx} y={cy + 1.2} fontSize={0.25} textAnchor="middle" fill="#fff" stroke="none">MQ-2</text>
          {Array.from({ length: 4 }).map((_, i) => (
            <circle key={i} cx={1 + i} cy={height} r={0.15} fill="#94a3b8" />
          ))}
        </g>
      );
    }

    case "bluetooth_hc05": {
      return (
        <g id={`realistic-bluetooth-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} rx={0.1} fill="#1e40af" />
          <path d="M 1,0.7 L 3,0.7 L 3,1.2 L 1,1.2 L 1,1.7 L 3,1.7" fill="none" stroke="#fbbf24" strokeWidth={0.15} strokeLinecap="round" />
          <rect x={1.2} y={2.5} width={1.6} height={1.2} fill="#111" rx={0.05} />
          <text x={cx} y={4.5} fontSize={0.3} textAnchor="middle" fill="#fff" stroke="none" fontWeight="bold">HC-05</text>
          {Array.from({ length: 6 }).map((_, i) => (
            <circle key={i} cx={0.5 + i * 0.7} cy={height} r={0.12} fill="#94a3b8" />
          ))}
        </g>
      );
    }

    case "nrf24l01": {
      return (
        <g id={`realistic-nrf-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} rx={0.1} fill="#065f46" />
          <rect x={1} y={1} width={2} height={1} fill="#111" rx={0.05} />
          <text x={cx} y={2.5} fontSize={0.25} textAnchor="middle" fill="#fff" stroke="none">nRF24L01</text>
          {Array.from({ length: 4 }).map((_, i) => (
            <circle key={i} cx={0} cy={1 + i} r={0.15} fill="#94a3b8" />
          ))}
          {Array.from({ length: 4 }).map((_, i) => (
            <circle key={i} cx={width} cy={1 + i} r={0.15} fill="#94a3b8" />
          ))}
        </g>
      );
    }

    case "regulator_7805":
    case "regulator_7812":
    case "regulator_lm317":
    case "mosfet_irf540": {
      const label = symbolId === "regulator_7805" ? "7805" : 
                    symbolId === "regulator_7812" ? "7812" : 
                    symbolId === "regulator_lm317" ? "LM317" : "IRF540";
      return (
        <g id={`realistic-to220-${node.id}`} filter="url(#realistic-shadow)">
          {/* TO-220 Metal Tab - Enhanced with shine */}
          <rect x={0.6} y={0.1} width={width - 1.2} height={0.9} fill="url(#metal-grad)" rx={0.1} stroke="#94a3b8" strokeWidth={0.03} />
          <rect x={0.7} y={0.2} width={width - 1.4} height={0.15} fill="#fff" opacity={0.2} rx={0.05} />
          <circle cx={cx} cy={0.45} r={0.16} fill="#000" opacity={0.7} />
          <circle cx={cx} cy={0.45} r={0.14} fill="none" stroke="#475569" strokeWidth={0.02} />
          
          {/* Plastic Body - Enhanced texture */}
          <rect x={0.5} y={0.8} width={width - 1.0} height={1.2} fill="url(#transistor-body-grad)" rx={0.05} stroke="#000" strokeWidth={0.05} />
          <rect x={0.6} y={0.9} width={width - 1.2} height={0.1} fill="#fff" opacity={0.05} />
          
          {/* Detailed Labeling */}
          <text x={cx} y={1.4} fontSize={0.25} fill="#94a3b8" textAnchor="middle" stroke="none" fontWeight="bold" fontFamily="monospace" opacity={0.8}>
            {label}
          </text>
          <text x={cx} y={1.65} fontSize={0.12} fill="#64748b" textAnchor="middle" stroke="none" fontFamily="monospace" opacity={0.5}>
            {symbolId.includes("reg") ? "VOLT REG" : "POWER MOSFET"}
          </text>

          {/* Pins - Realistic metal legs */}
          {symbol?.pins.map((pin, i) => (
            <g key={i}>
              <rect x={pin.x - 0.08} y={pin.y - 0.5} width={0.16} height={0.5} fill="url(#metal-grad)" />
              <circle cx={pin.x} cy={pin.y} r={0.15} fill="#94a3b8" stroke="#475569" strokeWidth={0.02} />
            </g>
          ))}
        </g>
      );
    }

    case "ams1117": {
      return (
        <g id={`realistic-ams1117-${node.id}`} filter="url(#realistic-shadow)">
          {/* SOT-223 Package Body */}
          <rect x={0.6} y={0.4} width={width - 1.2} height={1.2} fill="url(#transistor-body-grad)" rx={0.05} stroke="#000" strokeWidth={0.05} />
          <rect x={0.8} y={0.2} width={width - 1.6} height={0.3} fill="#334155" rx={0.02} />
          <text x={cx} y={1.1} fontSize={0.25} fill="#94a3b8" textAnchor="middle" stroke="none" fontWeight="bold">AMS1117</text>
          
          {/* Pins */}
          {symbol?.pins.map((pin, i) => (
            <g key={i}>
              <rect x={pin.x - 0.15} y={pin.y - 0.4} width={0.3} height={0.4} fill="#cbd5e1" rx={0.02} />
              <circle cx={pin.x} cy={pin.y} r={0.12} fill="#94a3b8" />
            </g>
          ))}
        </g>
      );
    }

    case "crystal_hc49": {
      return (
        <g id={`realistic-crystal-${node.id}`} filter="url(#realistic-shadow)">
          {/* Metallic HC-49 Casing - Enhanced 3D Effect */}
          <rect x={0.3} y={0.3} width={width - 0.6} height={height - 0.6} rx={0.6} fill="url(#metal-grad)" stroke="#94a3b8" strokeWidth={0.06} />
          
          {/* Top highlight for metallic shine */}
          <rect x={0.5} y={0.5} width={width - 1.0} height={0.4} rx={0.2} fill="#fff" opacity={0.3} />
          
          {/* Bottom shadow for depth */}
          <rect x={0.5} y={height - 0.9} width={width - 1.0} height={0.2} rx={0.1} fill="#000" opacity={0.1} />

          <g transform={`translate(${cx} ${cy})`}>
            <text x={0} y={0.05} fontSize={0.35} textAnchor="middle" fill="#334155" stroke="none" fontWeight="bold" fontFamily="monospace" letterSpacing="0.05">
              16.000
            </text>
            <text x={0} y={0.4} fontSize={0.2} textAnchor="middle" fill="#64748b" stroke="none" fontFamily="monospace" opacity={0.8}>
              MHz
            </text>
          </g>

          {/* Solder Pads and Stubs */}
          <line x1={0.1} y1={cy} x2={0.4} y2={cy} stroke="#cbd5e1" strokeWidth={0.12} strokeLinecap="round" />
          <line x1={width - 0.1} y1={cy} x2={width - 0.4} y2={cy} stroke="#cbd5e1" strokeWidth={0.12} strokeLinecap="round" />
          
          <circle cx={0} cy={cy} r={0.15} fill="#94a3b8" />
          <circle cx={width} cy={cy} r={0.15} fill="#94a3b8" />
        </g>
      );
    }

    case "npn_2n2222": {
      return (
        <g id={`realistic-to92-${node.id}`} filter="url(#realistic-shadow)">
          {/* TO-92 Body (Half Cylinder) */}
          <path d={`M ${cx - 0.6},1.6 A 0.6,0.6 0 0,1 ${cx + 0.6},1.6 L ${cx + 0.6},0.6 L ${cx - 0.6},0.6 Z`} fill="url(#transistor-body-grad)" stroke="#000" strokeWidth={0.04} />
          <text x={cx} y={1.2} fontSize={0.18} fill="#94a3b8" textAnchor="middle" stroke="none">2N2222</text>
          
          {/* Pins */}
          {symbol?.pins.map((pin, i) => (
            <g key={i}>
              <line x1={pin.x} y1={pin.y} x2={cx + (pin.x - cx) * 0.4} y2={1.0} stroke="#cbd5e1" strokeWidth={0.08} strokeLinecap="round" />
              <circle cx={pin.x} cy={pin.y} r={0.1} fill="#94a3b8" />
            </g>
          ))}
        </g>
      );
    }

    case "dc_motor": {
      return (
        <g id={`realistic-motor-${node.id}`} filter="url(#realistic-shadow)">
          <circle cx={cx} cy={cy} r={1.2} fill="url(#metal-grad)" stroke="#475569" strokeWidth={0.05} />
          <circle cx={cx} cy={cy} r={1.1} fill="none" stroke="#cbd5e1" strokeWidth={0.02} opacity={0.5} />
          <rect x={cx - 0.15} y={cy - 1.8} width={0.3} height={0.6} fill="#475569" rx={0.05} />
          <text x={cx} y={cy + 0.3} fontSize={0.6} textAnchor="middle" fill="#1e293b" stroke="none" fontWeight="bold">M</text>
          <circle cx={0} cy={cy} r={0.15} fill="#ef4444" />
          <circle cx={width} cy={cy} r={0.15} fill="#1e293b" />
        </g>
      );
    }

    case "servo_motor": {
      return (
        <g id={`realistic-servo-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={0.2} width={width - 0.4} height={height - 0.4} rx={0.1} fill="#2563eb" />
          <circle cx={cx} cy={cy} r={0.4} fill="#f8fafc" />
          <rect x={cx - 0.6} y={cy - 0.1} width={1.2} height={0.2} fill="#f8fafc" rx={0.05} />
          <text x={cx} y={cy + 0.8} fontSize={0.2} textAnchor="middle" fill="#fff" opacity={0.7}>SG90</text>
          {Array.from({ length: 3 }).map((_, i) => (
            <circle key={i} cx={0.5 + i} cy={height} r={0.12} fill={i === 0 ? "#f59e0b" : i === 1 ? "#ef4444" : "#475569"} />
          ))}
        </g>
      );
    }

    case "buzzer_piezo": {
      return (
        <g id={`realistic-buzzer-${node.id}`} filter="url(#realistic-shadow)">
          <circle cx={cx} cy={cy - 0.2} r={0.8} fill="#111" stroke="#334155" strokeWidth={0.05} />
          <circle cx={cx} cy={cy - 0.2} r={0.15} fill="#1e293b" />
          <path d={`M ${cx - 0.4},${cy - 0.6} A 0.4,0.4 0 0,1 ${cx + 0.4},${cy - 0.6}`} fill="none" stroke="#475569" strokeWidth={0.02} />
          <circle cx={0.5} cy={height} r={0.15} fill="#94a3b8" />
          <circle cx={1.5} cy={height} r={0.15} fill="#94a3b8" />
        </g>
      );
    }

    case "lipo_battery": {
      return (
        <g id={`realistic-lipo-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} rx={0.1} fill="#e2e8f0" stroke="#cbd5e1" strokeWidth={0.05} />
          <rect x={0.7} y={0.7} width={width - 1.4} height={height - 1.4} fill="#fef08a" opacity={0.3} />
          <text x={cx} y={cy} fontSize={0.3} textAnchor="middle" fill="#1e293b" stroke="none" fontWeight="bold">3.7V Li-Po</text>
          <text x={cx} y={cy + 0.4} fontSize={0.2} textAnchor="middle" fill="#64748b" stroke="none">Lithium Ion</text>
          <circle cx={0} cy={1.5} r={0.15} fill="#ef4444" />
          <circle cx={width} cy={1.5} r={0.15} fill="#1e293b" />
        </g>
      );
    }

    case "li_ion_18650": {
      return (
        <g id={`realistic-18650-${node.id}`} filter="url(#realistic-shadow)">
          {/* Main Cylinder Body */}
          <rect x={0.8} y={0.5} width={width - 1.6} height={1.0} rx={0.5} fill="url(#metal-grad)" stroke="#94a3b8" strokeWidth={0.02} />
          
          {/* Plastic Wrap (typically green or blue) */}
          <rect x={1.2} y={0.5} width={width - 2.4} height={1.0} fill="#10b981" />
          <rect x={1.2} y={0.5} width={width - 2.4} height={0.3} fill="#fff" opacity={0.2} />
          
          {/* Positive terminal cap */}
          <rect x={width - 0.9} y={0.7} width={0.3} height={0.6} rx={0.1} fill="url(#metal-grad)" stroke="#64748b" strokeWidth={0.01} />
          
          {/* Negative terminal (flat end) */}
          <rect x={0.8} y={0.5} width={0.2} height={1.0} rx={0.1} fill="#94a3b8" />

          {/* Labels */}
          <text x={cx} y={1.1} fontSize={0.3} textAnchor="middle" fill="#fff" stroke="none" fontWeight="bold" fontFamily="monospace">
            3.7V 18650
          </text>
          
          {/* Pins/Wires connecting points */}
          <circle cx={0} cy={1} r={0.15} fill="#ef4444" />
          <circle cx={width} cy={1} r={0.15} fill="#1e293b" />
          
          {/* Indicator text for polarity */}
          <text x={0.3} y={0.9} fontSize={0.2} fill="#ef4444" fontWeight="bold">+</text>
          <text x={width - 0.4} y={0.9} fontSize={0.2} fill="#1e293b" fontWeight="bold">-</text>
        </g>
      );
    }

    case "power_amplifier": {
      return (
        <g id={`realistic-power-amp-${node.id}`} filter="url(#realistic-shadow)">
          {/* TO-220-5 Package Body */}
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 2.0} fill="#111" rx={0.1} />
          {/* Heat sink tab */}
          <rect x={1.0} y={0.1} width={width - 2.0} height={0.6} fill="#cbd5e1" rx={0.05} />
          <circle cx={cx} cy={0.4} r={0.15} fill="#111" />
          {/* Label */}
          <text x={cx} y={cy - 0.5} fontSize={0.4} fill="#fff" textAnchor="middle" stroke="none" fontWeight="bold">TDA2030</text>
          {/* Pins */}
          {Array.from({ length: 5 }).map((_, i) => (
            <g key={i}>
              <rect x={0.6 + i * 0.9} y={height - 1.0} width={0.15} height={1.0} fill="#cbd5e1" />
              <circle cx={0.675 + i * 0.9} cy={height} r={0.12} fill="#94a3b8" />
            </g>
          ))}
        </g>
      );
    }

    /* ====== DISPLAYS ====== */
    case "seven_segment": {
      return (
        <g id={`realistic-7seg-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={0.2} width={width - 0.4} height={height - 0.4} rx={0.1} fill="#111" stroke="#334155" strokeWidth={0.05} />
          {/* Common 7-segment layout */}
          <g transform={`translate(${cx - 0.5} ${cy - 0.8}) scale(0.8)`}>
            {/* A */} <rect x={0.2} y={0} width={0.6} height={0.12} rx={0.05} fill={isGlowing ? "#ef4444" : "#2d0a0a"} />
            {/* B */} <rect x={0.8} y={0.1} width={0.12} height={0.6} rx={0.05} fill={isGlowing ? "#ef4444" : "#2d0a0a"} />
            {/* C */} <rect x={0.8} y={0.8} width={0.12} height={0.6} rx={0.05} fill={isGlowing ? "#ef4444" : "#2d0a0a"} />
            {/* D */} <rect x={0.2} y={1.4} width={0.6} height={0.12} rx={0.05} fill={isGlowing ? "#ef4444" : "#2d0a0a"} />
            {/* E */} <rect x={0} y={0.8} width={0.12} height={0.6} rx={0.05} fill={isGlowing ? "#ef4444" : "#2d0a0a"} />
            {/* F */} <rect x={0} y={0.1} width={0.12} height={0.6} rx={0.05} fill={isGlowing ? "#ef4444" : "#2d0a0a"} />
            {/* G */} <rect x={0.2} y={0.7} width={0.6} height={0.12} rx={0.05} fill={isGlowing ? "#ef4444" : "#2d0a0a"} />
            {/* DP */}<circle cx={1.1} cy={1.45} r={0.08} fill={isGlowing ? "#ef4444" : "#2d0a0a"} />
          </g>
        </g>
      );
    }

    case "lcd_1602":
    case "lcd_2004": {
      const is20x4 = symbolId === "lcd_2004";
      return (
        <g id={`realistic-lcd-${node.id}`} filter="url(#realistic-shadow)">
          {/* Green/Blue PCB */}
          <rect x={0.1} y={0.1} width={width - 0.2} height={height - 0.2} rx={0.15} fill="#1e3a8a" stroke="#1e40af" strokeWidth={0.06} />
          {/* Metal Frame */}
          <rect x={0.6} y={0.6} width={width - 1.2} height={height - 1.2} rx={0.08} fill="#94a3b8" stroke="#475569" strokeWidth={0.04} />
          {/* LCD Screen area */}
          <rect x={0.8} y={0.8} width={width - 1.6} height={height - 1.6} fill="#2563eb" stroke="#1e3a8a" strokeWidth={0.04} />
          {/* Backlight effect */}
          {isSimulating && <rect x={0.8} y={0.8} width={width - 1.6} height={height - 1.6} fill="#60a5fa" opacity={0.3} />}
          {/* Text lines */}
          <text x={1.0} y={1.6} fontSize={0.5} fontFamily="monospace" fill="#eff6ff" stroke="none">
            {value.split("\n")[0] || (is20x4 ? "LCD 20x4 Module" : "LCD 16x2 Module")}
          </text>
          <text x={1.0} y={2.4} fontSize={0.5} fontFamily="monospace" fill="#eff6ff" stroke="none">
            {value.split("\n")[1] || "Status: Ready"}
          </text>
          {/* Pin Header */}
          <g transform={`translate(0.5 0.2)`}>
            {Array.from({ length: 16 }).map((_, i) => (
              <circle key={i} cx={i * 0.3} cy={0} r={0.08} fill="url(#brass-grad)" />
            ))}
          </g>
        </g>
      );
    }

    case "oled_ssd1306": {
      return (
        <g id={`realistic-oled-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.1} y={0.1} width={width - 0.2} height={height - 0.2} rx={0.1} fill="#111" stroke="#334155" strokeWidth={0.05} />
          {/* Screen area */}
          <rect x={0.4} y={1.0} width={width - 0.8} height={height - 1.4} rx={0.05} fill="#000" stroke="#222" strokeWidth={0.02} />
          {/* Simulation text */}
          {isSimulating && (
            <g>
              <text x={cx} y={2.0} fontSize={0.3} fill="#60a5fa" textAnchor="middle" stroke="none" fontFamily="monospace">OLED 128x64</text>
              <text x={cx} y={2.5} fontSize={0.25} fill="#facc15" textAnchor="middle" stroke="none" fontFamily="monospace">SSD1306</text>
            </g>
          )}
          {/* Pin Header */}
          <g transform={`translate(${cx - 0.6} 0.3)`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <circle key={i} cx={i * 0.4} cy={0} r={0.1} fill="url(#brass-grad)" />
            ))}
          </g>
        </g>
      );
    }

    case "dot_matrix": {
      return (
        <g id={`realistic-dotmatrix-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={0.2} width={width - 0.4} height={height - 0.4} rx={0.1} fill="#111" />
          {Array.from({ length: 8 }).map((_, r) => (
            Array.from({ length: 8 }).map((_, c) => (
              <circle
                key={`${r}-${c}`}
                cx={0.6 + c * ((width - 1.2) / 7)}
                cy={0.6 + r * ((height - 1.2) / 7)}
                r={0.12}
                fill={isGlowing ? "#ef4444" : "#2d0a0a"}
              />
            ))
          ))}
        </g>
      );
    }

    case "tft_spi": {
      return (
        <g id={`realistic-tft-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.1} y={0.1} width={width - 0.2} height={height - 0.2} rx={0.1} fill="#1e293b" />
          <rect x={0.4} y={0.4} width={width - 0.8} height={height - 1.2} fill="#000" stroke="#334155" strokeWidth={0.04} />
          {isSimulating && (
            <g>
              <rect x={0.4} y={0.4} width={width - 0.8} height={height - 1.2} fill="url(#metal-shimmer-grad)" opacity={0.1} />
              <text x={cx} y={cy} fontSize={0.3} fill="#fff" textAnchor="middle" stroke="none">TFT SPI</text>
            </g>
          )}
          <g transform={`translate(${cx - 1.2} ${height - 0.4})`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <circle key={i} cx={i * 0.3} cy={0} r={0.08} fill="url(#brass-grad)" />
            ))}
          </g>
        </g>
      );
    }

    case "generic_display": {
      return (
        <g id={`realistic-generic-display-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={0.2} width={width - 0.4} height={height - 0.4} rx={0.1} fill="#111" stroke="#334155" strokeWidth={0.05} />
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} fill="#222" />
          <text x={cx} y={cy} fontSize={0.4} fill="#64748b" textAnchor="middle" stroke="none">DISPLAY</text>
        </g>
      );
    }

    /* ====== CONNECTORS ====== */
    case "usb_a":
    case "usb_c":
    case "micro_usb": {
      const label = symbolId.toUpperCase().replace("_", "-");
      return (
        <g id={`realistic-usb-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={0.5} width={width - 0.4} height={height - 1.0} rx={0.1} fill="url(#metal-shimmer-grad)" stroke="#94a3b8" strokeWidth={0.05} />
          <rect x={0.5} y={0.8} width={width - 1.0} height={height - 1.6} fill="#1e293b" rx={0.05} />
          <text x={cx} y={cy + 0.1} fontSize={0.3} fontWeight="bold" fill="#cbd5e1" textAnchor="middle" stroke="none">
            {label}
          </text>
        </g>
      );
    }

    case "barrel_jack":
    case "dc_jack": {
      return (
        <g id={`realistic-dcjack-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} rx={0.1} fill="#111" stroke="#334155" strokeWidth={0.05} />
          <circle cx={cx} cy={cy} r={0.5} fill="#334155" />
          <circle cx={cx} cy={cy} r={0.2} fill="#000" />
          <circle cx={cx} cy={cy} r={0.1} fill="url(#metal-shimmer-grad)" />
        </g>
      );
    }

    case "jst": {
      return (
        <g id={`realistic-jst-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} rx={0.1} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.05} />
          <rect x={0.7} y={0.7} width={width - 1.4} height={height - 1.4} fill="#e2e8f0" rx={0.05} />
          {Array.from({ length: 2 }).map((_, i) => (
            <rect key={i} x={cx - 0.3 + i * 0.4} y={cy - 0.2} width={0.2} height={0.4} fill="#94a3b8" />
          ))}
        </g>
      );
    }

    case "screw_terminal": {
      return (
        <g id={`realistic-screw-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={0.2} width={width - 0.4} height={height - 0.4} rx={0.1} fill="#15803d" stroke="#14532d" strokeWidth={0.05} />
          {Array.from({ length: 2 }).map((_, i) => (
            <g key={i} transform={`translate(${0.6 + i * 1.8} 0.8)`}>
              <rect x={0} y={0} width={0.8} height={1.4} fill="#334155" rx={0.1} />
              <circle cx={0.4} cy={0.4} r={0.3} fill="url(#metal-shimmer-grad)" />
              <rect x={0.2} y={0.35} width={0.4} height={0.1} fill="#111" transform="rotate(45 0.4 0.4)" />
            </g>
          ))}
        </g>
      );
    }

    case "header":
    case "pin_header":
    case "gpio_header": {
      const pins = symbolId === "gpio_header" ? 40 : 8;
      const rows = symbolId === "gpio_header" ? 2 : 1;
      return (
        <g id={`realistic-header-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={cy - 0.3} width={width - 0.4} height={0.6 * rows} fill="#111" />
          {Array.from({ length: pins / rows }).map((_, i) => (
            Array.from({ length: rows }).map((_, r) => (
              <rect
                key={`${i}-${r}`}
                x={0.4 + i * 0.4}
                y={cy - 0.2 + r * 0.4}
                width={0.2}
                height={0.2}
                fill="url(#brass-grad)"
              />
            ))
          ))}
        </g>
      );
    }

    case "rj45": {
      return (
        <g id={`realistic-rj45-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={0.2} width={width - 0.4} height={height - 0.4} rx={0.1} fill="#94a3b8" opacity={0.3} stroke="#94a3b8" strokeWidth={0.05} />
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} fill="#1e293b" rx={0.1} />
          <g transform={`translate(${cx - 0.8} ${cy + 0.3})`}>
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={i} x={i * 0.2} y={0} width={0.1} height={0.4} fill="url(#brass-grad)" />
            ))}
          </g>
        </g>
      );
    }

    case "hdmi": {
      return (
        <g id={`realistic-hdmi-${node.id}`} filter="url(#realistic-shadow)">
          <path d={`M 0.5,0.5 L ${width - 0.5},0.5 L ${width - 0.7},${height - 0.5} L 0.7,${height - 0.5} Z`} fill="url(#metal-shimmer-grad)" stroke="#475569" strokeWidth={0.05} />
          <rect x={1.0} y={0.8} width={width - 2.0} height={height - 2.0} fill="#111" rx={0.05} />
        </g>
      );
    }

    case "audio_jack": {
      return (
        <g id={`realistic-audio-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.5} y={0.5} width={width - 1.0} height={height - 1.0} rx={0.1} fill="#111" stroke="#334155" strokeWidth={0.05} />
          <circle cx={cx} cy={cy} r={0.4} fill="#334155" />
          <circle cx={cx} cy={cy} r={0.25} fill="#000" />
          <rect x={width - 0.5} y={cy - 0.3} width={0.4} height={0.6} fill="url(#metal-shimmer-grad)" />
        </g>
      );
    }

    case "fpc_connector": {
      return (
        <g id={`realistic-fpc-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={cy - 0.4} width={width - 0.4} height={0.8} rx={0.05} fill="#f8fafc" stroke="#cbd5e1" strokeWidth={0.04} />
          <rect x={0.3} y={cy - 0.1} width={width - 0.6} height={0.2} fill="#1e293b" />
          <rect x={0.2} y={cy - 0.4} width={0.3} height={0.8} fill="#94a3b8" />
          <rect x={width - 0.5} y={cy - 0.4} width={0.3} height={0.8} fill="#94a3b8" />
        </g>
      );
    }

    /* ====== POWER MODULES ====== */
    case "xl4015_buck":
    case "lm2596": {
      return (
        <g id={`realistic-buck-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.1} y={0.1} width={width - 0.2} height={height - 0.2} rx={0.15} fill="#1e40af" stroke="#1d4ed8" strokeWidth={0.06} />
          {/* Main Inductor */}
          <rect x={width - 1.8} y={1.2} width={1.2} height={1.2} rx={0.2} fill="#334155" stroke="#1e293b" strokeWidth={0.05} />
          {/* Potentiometer */}
          <rect x={width - 1.8} y={0.4} width={0.8} height={0.5} fill="#3b82f6" rx={0.05} />
          <circle cx={width - 1.4} cy={0.65} r={0.15} fill="url(#brass-grad)" />
          {/* IC */}
          <rect x={1.2} y={1.2} width={1.0} height={1.0} fill="#111" rx={0.1} />
          {/* Capacitors */}
          <circle cx={0.8} cy={0.8} r={0.4} fill="#cbd5e1" stroke="#94a3b8" />
          <circle cx={0.8} cy={2.2} r={0.4} fill="#cbd5e1" stroke="#94a3b8" />
          <text x={cx} y={cy + 0.15} fontSize={0.3} fill="#fff" fontWeight="bold" textAnchor="middle" stroke="none">{symbolId === "lm2596" ? "LM2596" : "XL4015"}</text>
        </g>
      );
    }

    case "tp4056_charger": {
      return (
        <g id={`realistic-tp4056-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.1} y={0.1} width={width - 0.2} height={height - 0.2} rx={0.1} fill="#1e3a8a" />
          <rect x={0.1} y={0.8} width={0.8} height={height - 1.6} fill="url(#metal-shimmer-grad)" rx={0.05} /> {/* Micro USB */}
          <rect x={width - 1.5} y={1.0} width={1.0} height={1.0} fill="#111" rx={0.1} /> {/* TP4056 IC */}
          <circle cx={width - 1.0} cy={0.6} r={0.1} fill="#ef4444" /> {/* Red LED */}
          <circle cx={width - 1.0} cy={height - 0.6} r={0.1} fill="#3b82f6" /> {/* Blue LED */}
          <text x={cx} y={cy + 0.1} fontSize={0.25} fill="#fff" textAnchor="middle" stroke="none">TP4056</text>
        </g>
      );
    }

    case "mt3608_boost": {
      return (
        <g id={`realistic-mt3608-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.1} y={0.1} width={width - 0.2} height={height - 0.2} rx={0.1} fill="#1e3a8a" />
          <rect x={0.8} y={0.8} width={1.2} height={1.2} rx={0.2} fill="#111" stroke="#334155" strokeWidth={0.05} /> {/* Inductor */}
          <rect x={width - 1.5} y={0.5} width={1.0} height={0.6} fill="#3b82f6" rx={0.05} /> {/* Pot */}
          <circle cx={width - 1.0} cy={0.8} r={0.2} fill="url(#brass-grad)" />
          <text x={cx} y={height - 0.4} fontSize={0.3} fill="#fff" textAnchor="middle" stroke="none">MT3608</text>
        </g>
      );
    }

    case "generic_dcdc": {
      return (
        <g id={`realistic-dcdc-${node.id}`} filter="url(#realistic-shadow)">
          <rect x={0.2} y={0.2} width={width - 0.4} height={height - 0.4} rx={0.1} fill="#1e3a8a" stroke="#1d4ed8" strokeWidth={0.05} />
          <rect x={0.6} y={0.6} width={width - 1.2} height={height - 1.2} rx={0.1} fill="#0ea5e9" opacity={0.2} />
          <text x={cx} y={cy} fontSize={0.4} fill="#fff" textAnchor="middle" stroke="none">DC-DC</text>
        </g>
      );
    }

    // Microphone representation
    case "photodiode": // Let's treat photodiode or mic
    default: {
      const isMic = symbolId === "photodiode" || node.reference?.toLowerCase().startsWith("mic") || value.toLowerCase().includes("mic");
      if (isMic) {
        return (
          <g id={`realistic-mic-${node.id}`} filter="url(#realistic-shadow)">
            {/* Legs */}
            <path d={`M ${cx - 0.3},${cy} L ${cx - 0.3},${height}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" />
            <path d={`M ${cx + 0.3},${cy} L ${cx + 0.3},${height}`} stroke="#cbd5e1" strokeWidth={0.14} strokeLinecap="round" />
            
            {/* Silver metallic cylinder body */}
            <circle cx={cx} cy={cy} r={0.65} fill="url(#metal-shimmer-grad)" stroke="#94a3b8" strokeWidth={0.05} />
            
            {/* Black felt foam pad on top */}
            <circle cx={cx} cy={cy} r={0.52} fill="url(#sponge-texture-grad)" stroke="#334155" strokeWidth={0.03} />
            <circle cx={cx} cy={cy} r={0.52} fill="#111111" opacity={0.6} />
            
            {/* Mic Label */}
            <text x={cx} y={cy + 0.12} fontSize={0.28} fill="#ffffff" fontWeight="bold" textAnchor="middle" stroke="none">
              MIC
            </text>
          </g>
        );
      }

      // Default Generic Component (looks like a clean, realistic epoxy package chip or block with legs)
      return (
        <g id={`realistic-generic-${node.id}`} filter="url(#realistic-shadow)">
          {/* Pins */}
          {node.symbol !== "gnd" && node.symbol !== "vcc" && node.symbol !== "vdd" && (
            <g>
              <path d={`M 0.5,${cy} L 0.5,${height}`} stroke="#cbd5e1" strokeWidth={0.12} strokeLinecap="round" />
              <path d={`M ${width - 0.5},${cy} L ${width - 0.5},${height}`} stroke="#cbd5e1" strokeWidth={0.12} strokeLinecap="round" />
            </g>
          )}

          {/* Body Epoxy */}
          <rect
            x={0.2}
            y={0.2}
            width={width - 0.4}
            height={height - 0.4}
            rx={0.12}
            fill="url(#generic-body-grad)"
            stroke="#334155"
            strokeWidth={0.05}
          />
          {/* Text Labels */}
          <text
            x={cx}
            y={cy - 0.1}
            fontSize={0.3}
            fontWeight="bold"
            fill="#cbd5e1"
            textAnchor="middle"
            stroke="none"
          >
            {node.reference || symbolId.toUpperCase()}
          </text>
          <text
            x={cx}
            y={cy + 0.25}
            fontSize={0.22}
            fill="#94a3b8"
            textAnchor="middle"
            stroke="none"
          >
            {value || ""}
          </text>
        </g>
      );
    }
  }
}

// Global SVG Defs needed for the realistic electronic gradients, filters, shadows, etc.
export function RealisticDefs() {
  return (
    <defs>
      {/* Soft natural drop shadow for realistic components and wires */}
      <filter id="realistic-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0.08" dy="0.12" stdDeviation="0.12" floodOpacity="0.4" floodColor="#000" />
      </filter>

      <filter id="wire-realistic-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0.05" dy="0.08" stdDeviation="0.06" floodOpacity="0.35" floodColor="#000" />
      </filter>

      {/* Glossy beige/tan resistor body gradient */}
      <linearGradient id="resistor-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fef3c7" />
        <stop offset="30%" stopColor="#fde68a" />
        <stop offset="70%" stopColor="#fbbf24" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>

      {/* Ceramic capacitor clay texture gradient */}
      <radialGradient id="ceramic-body-grad" cx="40%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#fed7aa" />
        <stop offset="40%" stopColor="#f97316" />
        <stop offset="90%" stopColor="#ea580c" />
        <stop offset="100%" stopColor="#9a3412" />
      </radialGradient>

      {/* Electrolytic black metallic can gradient */}
      <linearGradient id="electrolytic-body-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="25%" stopColor="#1e293b" />
        <stop offset="75%" stopColor="#0f172a" />
        <stop offset="90%" stopColor="#1e293b" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>

      {/* TO-92 Transistor plastic body gradient */}
      <linearGradient id="transistor-body-grad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="30%" stopColor="#1e293b" />
        <stop offset="70%" stopColor="#0f172a" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>

      {/* Copper inductor wires gradient */}
      <linearGradient id="copper-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#fed7aa" />
        <stop offset="30%" stopColor="#ea580c" />
        <stop offset="75%" stopColor="#b45309" />
        <stop offset="100%" stopColor="#78350f" />
      </linearGradient>

      {/* Shiny silver metal shimmer for microphones */}
      <linearGradient id="metal-shimmer-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f8fafc" />
        <stop offset="20%" stopColor="#cbd5e1" />
        <stop offset="45%" stopColor="#94a3b8" />
        <stop offset="70%" stopColor="#cbd5e1" />
        <stop offset="90%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#475569" />
      </linearGradient>

      {/* Foam sponge texture for mic top */}
      <radialGradient id="sponge-texture-grad" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#1e293b" />
        <stop offset="60%" stopColor="#0f172a" />
        <stop offset="85%" stopColor="#020617" />
        <stop offset="100%" stopColor="#000000" />
      </radialGradient>

      {/* Brass elements */}
      <linearGradient id="brass-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#ca8a04" />
        <stop offset="100%" stopColor="#854d0e" />
      </linearGradient>

      {/* Battery body gradients */}
      <linearGradient id="battery-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#c084fc" />
        <stop offset="35%" stopColor="#a855f7" />
        <stop offset="70%" stopColor="#7e22ce" />
        <stop offset="100%" stopColor="#581c87" />
      </linearGradient>

      <linearGradient id="battery-9v-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#4b5563" />
        <stop offset="20%" stopColor="#1f2937" />
        <stop offset="80%" stopColor="#111827" />
        <stop offset="100%" stopColor="#030712" />
      </linearGradient>

      {/* LED dome gradients */}
      <radialGradient id="led-red-grad" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#fca5a5" />
        <stop offset="30%" stopColor="#ef4444" />
        <stop offset="75%" stopColor="#b91c1c" />
        <stop offset="100%" stopColor="#7f1d1d" />
      </radialGradient>
      <radialGradient id="led-green-grad" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#86efac" />
        <stop offset="30%" stopColor="#22c55e" />
        <stop offset="75%" stopColor="#15803d" />
        <stop offset="100%" stopColor="#14532d" />
      </radialGradient>
      <radialGradient id="led-blue-grad" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#93c5fd" />
        <stop offset="30%" stopColor="#3b82f6" />
        <stop offset="75%" stopColor="#1d4ed8" />
        <stop offset="100%" stopColor="#172554" />
      </radialGradient>
      <radialGradient id="led-yellow-grad" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="30%" stopColor="#eab308" />
        <stop offset="75%" stopColor="#a16207" />
        <stop offset="100%" stopColor="#713f12" />
      </radialGradient>
      <radialGradient id="led-white-grad" cx="35%" cy="35%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="30%" stopColor="#f1f5f9" />
        <stop offset="75%" stopColor="#cbd5e1" />
        <stop offset="100%" stopColor="#94a3b8" />
      </radialGradient>

      {/* Generic components */}
      <linearGradient id="generic-body-grad" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#475569" />
        <stop offset="40%" stopColor="#334155" />
        <stop offset="100%" stopColor="#1e293b" />
      </linearGradient>

      {/* Board PCBs */}
      <linearGradient id="arduino-pcb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0aa4a7" />
        <stop offset="50%" stopColor="#008184" />
        <stop offset="100%" stopColor="#004d4f" />
      </linearGradient>

      <linearGradient id="stm32-pcb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#1e58a2" />
        <stop offset="50%" stopColor="#0b3269" />
        <stop offset="100%" stopColor="#051c3d" />
      </linearGradient>

      <linearGradient id="esp32-pcb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#2e3035" />
        <stop offset="50%" stopColor="#1b1c1e" />
        <stop offset="100%" stopColor="#0d0e10" />
      </linearGradient>

      <linearGradient id="pico-pcb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#15b77c" />
        <stop offset="50%" stopColor="#0f766e" />
        <stop offset="100%" stopColor="#064e3b" />
      </linearGradient>

      <linearGradient id="banana-pcb-grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#fef08a" />
        <stop offset="50%" stopColor="#facc15" />
        <stop offset="100%" stopColor="#ca8a04" />
      </linearGradient>

      {/* Soft glowing effect for LEDs */}
      <filter id="led-glowing-aura" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="0.15" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>

      {/* Wood workbench texture pattern */}
      <pattern id="wood-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="#fcf6f0" />
        <path d="M 0,10 Q 5,12 10,10 T 20,10" fill="none" stroke="#f3e8df" strokeWidth="0.8" opacity="0.4" />
        <path d="M 0,18 Q 7,16 14,18 T 20,18" fill="none" stroke="#f3e8df" strokeWidth="0.8" opacity="0.3" />
        <path d="M 0,4 Q 3,2 10,4 T 20,4" fill="none" stroke="#f3e8df" strokeWidth="0.6" opacity="0.3" />
      </pattern>

      {/* Dark Wood workbench texture pattern */}
      <pattern id="dark-wood-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
        <rect width="20" height="20" fill="#0f172a" />
        <path d="M 0,10 Q 5,12 10,10 T 20,10" fill="none" stroke="#1e293b" strokeWidth="0.8" opacity="0.4" />
        <path d="M 0,18 Q 7,16 14,18 T 20,18" fill="none" stroke="#1e293b" strokeWidth="0.8" opacity="0.3" />
        <path d="M 0,4 Q 3,2 10,4 T 20,4" fill="none" stroke="#1e293b" strokeWidth="0.6" opacity="0.3" />
      </pattern>
    </defs>
  );
}
