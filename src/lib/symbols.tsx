import { SymbolId } from "./schematic";
import { getImportedKiCadSymbol } from "./kicadSymbol";

export type SymbolCategory =
  | "power"
  | "passive"
  | "semi"
  | "logic"
  | "display"
  | "ic"
  | "connector"
  | "control"
  | "protection"
  | "test"
  | "mcu"
  | "sensor"
  | "amplifier"
  | "motor"
  | "board"
  | "meter"
  | "modules";

export interface PinDef {
  x: number;
  y: number;
  /** Logical pin number used for Symbol ↔ Footprint pad matching. */
  number?: string;
  name?: string;
  hide?: boolean;
}

export interface SymbolDef {
  id: SymbolId;
  category: SymbolCategory;
  width: number;
  height: number;
  pins: PinDef[];
  prefix?: string;
  defaultValue?: string;
  draw: (stroke: string) => JSX.Element;
}

const S = (stroke: string) => ({
  stroke,
  fill: "none",
  strokeWidth: 0.12,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

const SF = (stroke: string) => ({ ...S(stroke), fill: stroke });

/* ---------- helpers ---------- */

function dipPins(count: number, width: number = 4): PinDef[] {
  const half = count / 2;
  const pins: PinDef[] = [];
  for (let i = 0; i < half; i++) pins.push({ x: 0, y: i + 1, name: `${i + 1}` });
  for (let i = 0; i < half; i++) pins.push({ x: width, y: half - i, name: `${count - i}` });
  return pins;
}

function makeIC(id: string, count: number, label: string): SymbolDef {
  const half = count / 2;
  const h = half + 1;
  return {
    id, category: "ic", width: 4, height: h, prefix: "U", defaultValue: label,
    pins: dipPins(count, 4),
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={3} height={h - 0.6} rx={0.15} />
        <circle cx={0.9} cy={0.7} r={0.12} />
        <text x={2} y={h / 2 + 0.15} fontSize={0.45} textAnchor="middle" fill={c} stroke="none">{label}</text>
        {Array.from({ length: half }).map((_, i) => (
          <g key={i}>
            <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
            <line x1={3.5} y1={i + 1} x2={4} y2={i + 1} />
          </g>
        ))}
      </g>
    ),
  };
}

function makeMCU(id: string, count: number, label: string): SymbolDef {
  const half = count / 2;
  const h = half + 1;
  return {
    id, category: "mcu", width: 5, height: h, prefix: "U", defaultValue: label,
    pins: (() => {
      const ps: PinDef[] = [];
      for (let i = 0; i < half; i++) ps.push({ x: 0, y: i + 1, name: `P${i + 1}` });
      for (let i = 0; i < half; i++) ps.push({ x: 5, y: half - i, name: `P${count - i}` });
      return ps;
    })(),
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={4} height={h - 0.6} rx={0.2} />
        <text x={2.5} y={0.9} fontSize={0.45} textAnchor="middle" fill={c} stroke="none">{label}</text>
        {Array.from({ length: half }).map((_, i) => (
          <g key={i}>
            <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
            <line x1={4.5} y1={i + 1} x2={5} y2={i + 1} />
          </g>
        ))}
      </g>
    ),
  };
}

function makeBoard(id: string, label: string, pinPairs: [string, string][]): SymbolDef {
  const h = pinPairs.length + 1;
  return {
    id, category: "board", width: 6, height: h, prefix: "U", defaultValue: label,
    pins: pinPairs.flatMap(([l, r], i) => [
      { x: 0, y: i + 1, name: l },
      { x: 6, y: i + 1, name: r },
    ]),
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={5} height={h - 0.6} rx={0.25} />
        <text x={3} y={0.95} fontSize={0.45} textAnchor="middle" fill={c} stroke="none">{label}</text>
        {pinPairs.map((_, i) => (
          <g key={i}>
            <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
            <line x1={5.5} y1={i + 1} x2={6} y2={i + 1} />
          </g>
        ))}
      </g>
    ),
  };
}

/* ---------- catalog ---------- */

const _SYMBOLS: Record<SymbolId, SymbolDef> = {
  /* ====== POWER ====== */
  gnd: {
    id: "gnd", category: "power", width: 2, height: 2, defaultValue: "GND",
    pins: [{ x: 1, y: 0 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={1} y1={0} x2={1} y2={0.8} />
      <line x1={0.2} y1={0.8} x2={1.8} y2={0.8} />
      <line x1={0.5} y1={1.1} x2={1.5} y2={1.1} />
      <line x1={0.8} y1={1.4} x2={1.2} y2={1.4} />
    </g>),
  },
  vcc: {
    id: "vcc", category: "power", width: 2, height: 2, defaultValue: "+5V",
    pins: [{ x: 1, y: 2 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={1} y1={2} x2={1} y2={0.6} />
      <circle cx={1} cy={0.4} r={0.35} />
      <text x={1} y={0.55} fontSize={0.45} textAnchor="middle" fill={c} stroke="none">V</text>
    </g>),
  },
  vdd: {
    id: "vdd", category: "power", width: 2, height: 2, defaultValue: "+3V3",
    pins: [{ x: 1, y: 2 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={1} y1={2} x2={1} y2={0.7} />
      <polygon points="0.4,0.7 1.6,0.7 1,0.1" />
      <text x={1} y={0.6} fontSize={0.38} textAnchor="middle" fill={c} stroke="none">VDD</text>
    </g>),
  },
  power_flag: {
    id: "power_flag", category: "power", width: 3, height: 2, defaultValue: "PWR",
    pins: [{ x: 0, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1} y2={1} />
      <polygon points="1,0.3 2.6,0.3 3,1 2.6,1.7 1,1.7" />
      <text x={1.9} y={1.2} fontSize={0.5} textAnchor="middle" fill={c} stroke="none">PWR</text>
    </g>),
  },
  battery: {
    id: "battery", category: "power", width: 3, height: 2, prefix: "BT", defaultValue: "9V",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1.2} y2={1} />
      <line x1={1.2} y1={0.3} x2={1.2} y2={1.7} />
      <line x1={1.5} y1={0.6} x2={1.5} y2={1.4} />
      <line x1={1.8} y1={0.3} x2={1.8} y2={1.7} />
      <line x1={2.1} y1={0.6} x2={2.1} y2={1.4} />
      <line x1={2.1} y1={1} x2={3} y2={1} />
    </g>),
  },
  dc_source: {
    id: "dc_source", category: "power", width: 3, height: 3, prefix: "V", defaultValue: "12V",
    pins: [{ x: 1.5, y: 0 }, { x: 1.5, y: 3 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={1.5} y1={0} x2={1.5} y2={0.5} />
      <line x1={1.5} y1={2.5} x2={1.5} y2={3} />
      <circle cx={1.5} cy={1.5} r={1} />
      <line x1={0.9} y1={1.1} x2={1.4} y2={1.1} />
      <line x1={1.15} y1={1.9} x2={1.85} y2={1.9} />
      <line x1={1.5} y1={0.75} x2={1.5} y2={1.05} />
      <line x1={1.35} y1={0.9} x2={1.65} y2={0.9} />
    </g>),
  },
  ac_source: {
    id: "ac_source", category: "power", width: 3, height: 3, prefix: "V", defaultValue: "230V",
    pins: [{ x: 1.5, y: 0 }, { x: 1.5, y: 3 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={1.5} y1={0} x2={1.5} y2={0.5} />
      <line x1={1.5} y1={2.5} x2={1.5} y2={3} />
      <circle cx={1.5} cy={1.5} r={1} />
      <path d="M0.8 1.5 q0.35 -0.55 0.7 0 t0.7 0 t0.7 0" />
    </g>),
  },

  /* ====== PASSIVE ====== */
  resistor: {
    id: "resistor", category: "passive", width: 4, height: 1, prefix: "R", defaultValue: "10k",
    pins: [{ x: 0, y: 0.5 }, { x: 4, y: 0.5 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={0.5} x2={0.5} y2={0.5} />
      <polyline points="0.5,0.5 0.8,0.1 1.1,0.9 1.4,0.1 1.7,0.9 2.0,0.1 2.3,0.9 2.6,0.1 2.9,0.9 3.2,0.1 3.5,0.5" />
      <line x1={3.5} y1={0.5} x2={4} y2={0.5} />
    </g>),
  },
  var_resistor: {
    id: "var_resistor", category: "passive", width: 4, height: 2, prefix: "RV", defaultValue: "10k",
    pins: [{ x: 0, y: 1 }, { x: 4, y: 1 }, { x: 2, y: 0, name: "W" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={0.5} y2={1} />
      <polyline points="0.5,1 0.8,0.6 1.1,1.4 1.4,0.6 1.7,1.4 2.0,0.6 2.3,1.4 2.6,0.6 2.9,1.4 3.2,0.6 3.5,1" />
      <line x1={3.5} y1={1} x2={4} y2={1} />
      <line x1={2} y1={0} x2={2} y2={0.6} />
      <polygon points="1.8,0.55 2.2,0.55 2,0.85" {...SF(c)} />
    </g>),
  },
  capacitor: {
    id: "capacitor", category: "passive", width: 3, height: 2, prefix: "C", defaultValue: "100nF",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1.3} y2={1} />
      <line x1={1.3} y1={0.2} x2={1.3} y2={1.8} />
      <line x1={1.7} y1={0.2} x2={1.7} y2={1.8} />
      <line x1={1.7} y1={1} x2={3} y2={1} />
    </g>),
  },
  capacitor_polar: {
    id: "capacitor_polar", category: "passive", width: 3, height: 2, prefix: "C", defaultValue: "10uF",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1.3} y2={1} />
      <line x1={1.3} y1={0.2} x2={1.3} y2={1.8} />
      <path d="M1.7 0.2 a0.8 0.8 0 0 1 0 1.6" />
      <line x1={1.7} y1={1} x2={3} y2={1} />
      <text x={0.95} y={0.6} fontSize={0.4} fill={c} stroke="none">+</text>
    </g>),
  },
  inductor: {
    id: "inductor", category: "passive", width: 4, height: 1.2, prefix: "L", defaultValue: "10uH",
    pins: [{ x: 0, y: 0.6 }, { x: 4, y: 0.6 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={0.6} x2={0.5} y2={0.6} />
      <path d="M0.5 0.6 a0.4 0.4 0 0 1 0.8 0 a0.4 0.4 0 0 1 0.8 0 a0.4 0.4 0 0 1 0.8 0 a0.4 0.4 0 0 1 0.8 0" />
      <line x1={3.5} y1={0.6} x2={4} y2={0.6} />
    </g>),
  },
  transformer: {
    id: "transformer", category: "passive", width: 4, height: 3, prefix: "T", defaultValue: "TR",
    pins: [
      { x: 0, y: 0.5, name: "P1" }, { x: 0, y: 2.5, name: "P2" },
      { x: 4, y: 0.5, name: "S1" }, { x: 4, y: 2.5, name: "S2" },
    ],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={0.5} x2={1} y2={0.5} />
      <line x1={0} y1={2.5} x2={1} y2={2.5} />
      <path d="M1 0.5 a0.4 0.4 0 0 1 0 0.8 a0.4 0.4 0 0 1 0 0.8 a0.4 0.4 0 0 1 0 0.8" />
      <line x1={1.9} y1={0.2} x2={1.9} y2={2.8} />
      <line x1={2.1} y1={0.2} x2={2.1} y2={2.8} />
      <path d="M3 0.5 a0.4 0.4 0 0 0 0 0.8 a0.4 0.4 0 0 0 0 0.8 a0.4 0.4 0 0 0 0 0.8" />
      <line x1={3} y1={0.5} x2={4} y2={0.5} />
      <line x1={3} y1={2.5} x2={4} y2={2.5} />
    </g>),
  },
  fuse: {
    id: "fuse", category: "protection", width: 4, height: 1, prefix: "F", defaultValue: "1A",
    pins: [{ x: 0, y: 0.5 }, { x: 4, y: 0.5 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={0.5} x2={1} y2={0.5} />
      <path d="M1 0.5 q1 -0.8 2 0 q1 0.8 0 0" />
      <line x1={3} y1={0.5} x2={4} y2={0.5} />
    </g>),
  },

  /* ====== SEMICONDUCTORS ====== */
  diode: {
    id: "diode", category: "semi", width: 3, height: 2, prefix: "D", defaultValue: "1N4148",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1.2} y2={1} />
      <polygon points="1.2,0.4 1.2,1.6 2,1" {...SF(c)} />
      <line x1={2} y1={0.4} x2={2} y2={1.6} />
      <line x1={2} y1={1} x2={3} y2={1} />
    </g>),
  },
  zener: {
    id: "zener", category: "semi", width: 3, height: 2, prefix: "D", defaultValue: "5V1",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1.2} y2={1} />
      <polygon points="1.2,0.4 1.2,1.6 2,1" {...SF(c)} />
      <polyline points="1.7,0.4 2,0.4 2,1.6 2.3,1.6" />
      <line x1={2} y1={1} x2={3} y2={1} />
    </g>),
  },
  led: {
    id: "led", category: "semi", width: 3, height: 2.5, prefix: "D", defaultValue: "LED",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1.2} y2={1} />
      <polygon points="1.2,0.4 1.2,1.6 2,1" {...SF(c)} />
      <line x1={2} y1={0.4} x2={2} y2={1.6} />
      <line x1={2} y1={1} x2={3} y2={1} />
      <line x1={1.4} y1={0.2} x2={1.9} y2={-0.1} />
      <polygon points="1.75,-0.1 1.95,-0.05 1.85,0.1" {...SF(c)} />
      <line x1={1.8} y1={0.2} x2={2.3} y2={-0.1} />
      <polygon points="2.15,-0.1 2.35,-0.05 2.25,0.1" {...SF(c)} />
    </g>),
  },
  photodiode: {
    id: "photodiode", category: "semi", width: 3, height: 2.5, prefix: "D", defaultValue: "Photo",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1.2} y2={1} />
      <polygon points="1.2,0.4 1.2,1.6 2,1" {...SF(c)} />
      <line x1={2} y1={0.4} x2={2} y2={1.6} />
      <line x1={2} y1={1} x2={3} y2={1} />
      <line x1={1.9} y1={-0.1} x2={1.4} y2={0.2} />
      <polygon points="1.4,0.05 1.45,0.25 1.6,0.15" {...SF(c)} />
      <line x1={2.3} y1={-0.1} x2={1.8} y2={0.2} />
      <polygon points="1.8,0.05 1.85,0.25 2,0.15" {...SF(c)} />
    </g>),
  },
  npn: {
    id: "npn", category: "semi", width: 3, height: 4, prefix: "Q", defaultValue: "BC547",
    pins: [{ x: 0, y: 2, name: "B" }, { x: 3, y: 0.5, name: "C" }, { x: 3, y: 3.5, name: "E" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={2} x2={1.2} y2={2} />
      <line x1={1.2} y1={1} x2={1.2} y2={3} />
      <line x1={1.2} y1={1.4} x2={3} y2={0.5} />
      <line x1={1.2} y1={2.6} x2={3} y2={3.5} />
      <polygon points="2.5,3.05 2.95,3.45 2.55,3.55" {...SF(c)} />
      <circle cx={1.7} cy={2} r={0.9} />
    </g>),
  },
  pnp: {
    id: "pnp", category: "semi", width: 3, height: 4, prefix: "Q", defaultValue: "BC557",
    pins: [{ x: 0, y: 2, name: "B" }, { x: 3, y: 0.5, name: "E" }, { x: 3, y: 3.5, name: "C" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={2} x2={1.2} y2={2} />
      <line x1={1.2} y1={1} x2={1.2} y2={3} />
      <line x1={1.2} y1={1.4} x2={3} y2={0.5} />
      <line x1={1.2} y1={2.6} x2={3} y2={3.5} />
      <polygon points="1.5,1.25 1.25,1.6 1.65,1.65" {...SF(c)} />
      <circle cx={1.7} cy={2} r={0.9} />
    </g>),
  },
  nmosfet: {
    id: "nmosfet", category: "semi", width: 3, height: 4, prefix: "Q", defaultValue: "IRFZ44N",
    pins: [{ x: 0, y: 2, name: "G" }, { x: 3, y: 0.5, name: "D" }, { x: 3, y: 3.5, name: "S" }],
    draw: (c) => (<g {...S(c)}>
      {/* Circle envelope */}
      <circle cx={1.7} cy={2} r={1.1} />
      {/* Gate lead & plate */}
      <line x1={0} y1={2} x2={1.2} y2={2} />
      <line x1={1.2} y1={1} x2={1.2} y2={3} />
      {/* Channel segments */}
      <line x1={1.4} y1={0.9} x2={1.4} y2={1.5} />
      <line x1={1.4} y1={1.7} x2={1.4} y2={2.3} />
      <line x1={1.4} y1={2.5} x2={1.4} y2={3.1} />
      {/* External connection leads */}
      <line x1={1.4} y1={1.2} x2={3} y2={0.5} />
      <line x1={1.4} y1={2.8} x2={3} y2={3.5} />
      {/* Bulk connection to source */}
      <line x1={1.4} y1={2} x2={2.1} y2={2} />
      <line x1={2.1} y1={2} x2={2.1} y2={2.8} />
      {/* Bulk arrow (pointing in) */}
      <polygon points="1.8,1.8 1.4,2 1.8,2.2" {...SF(c)} />
      {/* Body Diode in parallel with DS channel */}
      <line x1={2.5} y1={1.2} x2={2.5} y2={2.8} />
      <line x1={1.4} y1={1.2} x2={2.5} y2={1.2} />
      <line x1={1.4} y1={2.8} x2={2.5} y2={2.8} />
      {/* Diode triangle pointing up (Anode-Cathode) */}
      <polygon points="2.3,2.2 2.7,2.2 2.5,1.8" {...SF(c)} />
      <line x1={2.3} y1={1.8} x2={2.7} y2={1.8} />
    </g>),
  },
  pmosfet: {
    id: "pmosfet", category: "semi", width: 3, height: 4, prefix: "Q", defaultValue: "IRF9540",
    pins: [{ x: 0, y: 2, name: "G" }, { x: 3, y: 0.5, name: "S" }, { x: 3, y: 3.5, name: "D" }],
    draw: (c) => (<g {...S(c)}>
      {/* Circle envelope */}
      <circle cx={1.7} cy={2} r={1.1} />
      {/* Gate lead & plate */}
      <line x1={0} y1={2} x2={1.2} y2={2} />
      <line x1={1.2} y1={1} x2={1.2} y2={3} />
      {/* Channel segments */}
      <line x1={1.4} y1={0.9} x2={1.4} y2={1.5} />
      <line x1={1.4} y1={1.7} x2={1.4} y2={2.3} />
      <line x1={1.4} y1={2.5} x2={1.4} y2={3.1} />
      {/* External connection leads */}
      <line x1={1.4} y1={1.2} x2={3} y2={0.5} />
      <line x1={1.4} y1={2.8} x2={3} y2={3.5} />
      {/* Bulk connection to source */}
      <line x1={1.4} y1={2} x2={2.1} y2={2} />
      <line x1={2.1} y1={1.2} x2={2.1} y2={2} />
      {/* Bulk arrow (pointing out) */}
      <polygon points="1.4,1.8 1.8,2 1.4,2.2" {...SF(c)} />
      {/* Body Diode in parallel with DS channel */}
      <line x1={2.5} y1={1.2} x2={2.5} y2={2.8} />
      <line x1={1.4} y1={1.2} x2={2.5} y2={1.2} />
      <line x1={1.4} y1={2.8} x2={2.5} y2={2.8} />
      {/* Diode triangle pointing down (Anode-Cathode) */}
      <polygon points="2.3,1.8 2.7,1.8 2.5,2.2" {...SF(c)} />
      <line x1={2.3} y1={2.2} x2={2.7} y2={2.2} />
    </g>),
  },

  /* ====== LOGIC GATES ====== */
  and_gate: {
    id: "and_gate", category: "logic", width: 4, height: 2, prefix: "U", defaultValue: "AND",
    pins: [{ x: 0, y: 0.5, name: "A" }, { x: 0, y: 1.5, name: "B" }, { x: 4, y: 1, name: "Y" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={0.5} x2={1} y2={0.5} />
      <line x1={0} y1={1.5} x2={1} y2={1.5} />
      <path d="M1,0 L2.5,0 A1,1 0 0 1 2.5,2 L1,2 Z" />
      <line x1={3.5} y1={1} x2={4} y2={1} />
    </g>),
  },
  or_gate: {
    id: "or_gate", category: "logic", width: 4, height: 2, prefix: "U", defaultValue: "OR",
    pins: [{ x: 0, y: 0.5, name: "A" }, { x: 0, y: 1.5, name: "B" }, { x: 4, y: 1, name: "Y" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={0.5} x2={1.2} y2={0.5} />
      <line x1={0} y1={1.5} x2={1.2} y2={1.5} />
      <path d="M0.8,0 C1.5,0 3,0.2 3.5,1 C3,1.8 1.5,2 0.8,2 Q1.5,1 0.8,0 Z" />
      <line x1={3.5} y1={1} x2={4} y2={1} />
    </g>),
  },
  not_gate: {
    id: "not_gate", category: "logic", width: 3, height: 2, prefix: "U", defaultValue: "NOT",
    pins: [{ x: 0, y: 1, name: "A" }, { x: 3, y: 1, name: "Y" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={0.8} y2={1} />
      <polygon points="0.8,0.3 0.8,1.7 2,1" />
      <circle cx={2.2} cy={1} r={0.2} />
      <line x1={2.4} y1={1} x2={3} y2={1} />
    </g>),
  },
  nand_gate: {
    id: "nand_gate", category: "logic", width: 4, height: 2, prefix: "U", defaultValue: "NAND",
    pins: [{ x: 0, y: 0.5, name: "A" }, { x: 0, y: 1.5, name: "B" }, { x: 4, y: 1, name: "Y" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={0.5} x2={1} y2={0.5} />
      <line x1={0} y1={1.5} x2={1} y2={1.5} />
      <path d="M1,0 L2.3,0 A1,1 0 0 1 2.3,2 L1,2 Z" />
      <circle cx={3.4} cy={1} r={0.15} />
      <line x1={3.55} y1={1} x2={4} y2={1} />
    </g>),
  },
  nor_gate: {
    id: "nor_gate", category: "logic", width: 4, height: 2, prefix: "U", defaultValue: "NOR",
    pins: [{ x: 0, y: 0.5, name: "A" }, { x: 0, y: 1.5, name: "B" }, { x: 4, y: 1, name: "Y" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={0.5} x2={1.2} y2={0.5} />
      <line x1={0} y1={1.5} x2={1.2} y2={1.5} />
      <path d="M0.8,0 C1.5,0 2.8,0.2 3.3,1 C2.8,1.8 1.5,2 0.8,2 Q1.5,1 0.8,0 Z" />
      <circle cx={3.45} cy={1} r={0.15} />
      <line x1={3.6} y1={1} x2={4} y2={1} />
    </g>),
  },
  xor_gate: {
    id: "xor_gate", category: "logic", width: 4, height: 2, prefix: "U", defaultValue: "XOR",
    pins: [{ x: 0, y: 0.5, name: "A" }, { x: 0, y: 1.5, name: "B" }, { x: 4, y: 1, name: "Y" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={0.5} x2={1} y2={0.5} />
      <line x1={0} y1={1.5} x2={1} y2={1.5} />
      <path d="M0.5,0.2 Q1.2,1 0.5,1.8" fill="none" />
      <path d="M0.8,0 C1.5,0 3,0.2 3.5,1 C3,1.8 1.5,2 0.8,2 Q1.5,1 0.8,0 Z" />
      <line x1={3.5} y1={1} x2={4} y2={1} />
    </g>),
  },
  xnor_gate: {
    id: "xnor_gate", category: "logic", width: 4.5, height: 2, prefix: "U", defaultValue: "XNOR",
    pins: [{ x: 0, y: 0.5, name: "A" }, { x: 0, y: 1.5, name: "B" }, { x: 4.5, y: 1, name: "Y" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={0.5} x2={1} y2={0.5} />
      <line x1={0} y1={1.5} x2={1} y2={1.5} />
      <path d="M0.5,0.2 Q1.2,1 0.5,1.8" fill="none" />
      <path d="M0.8,0 C1.5,0 2.8,0.2 3.3,1 C2.8,1.8 1.5,2 0.8,2 Q1.5,1 0.8,0 Z" />
      <circle cx={3.45} cy={1} r={0.15} />
      <line x1={3.6} y1={1} x2={4.5} y2={1} />
    </g>),
  },
  buffer_gate: {
    id: "buffer_gate", category: "logic", width: 3, height: 2, prefix: "U", defaultValue: "BUF",
    pins: [{ x: 0, y: 1, name: "A" }, { x: 3, y: 1, name: "Y" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={0.8} y2={1} />
      <polygon points="0.8,0.3 0.8,1.7 2.2,1" />
      <line x1={2.2} y1={1} x2={3} y2={1} />
    </g>),
  },
  schmitt_trigger: {
    id: "schmitt_trigger", category: "logic", width: 3, height: 2, prefix: "U", defaultValue: "SCHMITT",
    pins: [{ x: 0, y: 1, name: "A" }, { x: 3, y: 1, name: "Y" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={0.8} y2={1} />
      <polygon points="0.8,0.3 0.8,1.7 2.2,1" />
      <polyline points="1.1,1.3 1.3,1.3 1.3,0.7 1.7,0.7 1.7,1.3 1.9,1.3" strokeWidth={0.08} />
      <line x1={2.2} y1={1} x2={3} y2={1} />
    </g>),
  },
  tristate_buffer: {
    id: "tristate_buffer", category: "logic", width: 3, height: 3, prefix: "U", defaultValue: "TRI",
    pins: [{ x: 0, y: 1.5, name: "A" }, { x: 3, y: 1.5, name: "Y" }, { x: 1.5, y: 0, name: "E" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1.5} x2={0.8} y2={1.5} />
      <polygon points="0.8,0.8 0.8,2.2 2.2,1.5" />
      <line x1={1.5} y1={0} x2={1.5} y2={1.15} />
      <line x1={2.2} y1={1.5} x2={3} y2={1.5} />
    </g>),
  },

  /* ====== DISPLAYS ====== */
  seven_segment: {
    id: "seven_segment", category: "display", width: 4, height: 6, prefix: "DS", defaultValue: "7-SEG",
    pins: [
      { x: 1, y: 0, name: "g" }, { x: 2, y: 0, name: "f" }, { x: 3, y: 0, name: "com" },
      { x: 1, y: 6, name: "e" }, { x: 2, y: 6, name: "d" }, { x: 3, y: 6, name: "dp" }
    ],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.5} width={3} height={5} rx={0.2} />
      <line x1={1} y1={0} x2={1} y2={0.5} />
      <line x1={2} y1={0} x2={2} y2={0.5} />
      <line x1={3} y1={0} x2={3} y2={0.5} />
      <line x1={1} y1={6} x2={1} y2={5.5} />
      <line x1={2} y1={6} x2={2} y2={5.5} />
      <line x1={3} y1={6} x2={3} y2={5.5} />
      <rect x={1.2} y={1.2} width={1.6} height={0.3} rx={0.15} /> {/* a */}
      <rect x={2.5} y={1.5} width={0.3} height={1.1} rx={0.15} /> {/* b */}
      <rect x={2.5} y={3.1} width={0.3} height={1.1} rx={0.15} /> {/* c */}
      <rect x={1.2} y={4.2} width={1.6} height={0.3} rx={0.15} /> {/* d */}
      <rect x={1.2} y={3.1} width={0.3} height={1.1} rx={0.15} /> {/* e */}
      <rect x={1.2} y={1.5} width={0.3} height={1.1} rx={0.15} /> {/* f */}
      <rect x={1.2} y={2.7} width={1.6} height={0.3} rx={0.15} /> {/* g */}
    </g>),
  },
  dot_matrix: {
    id: "dot_matrix", category: "display", width: 5, height: 6, prefix: "DS", defaultValue: "8x8",
    pins: Array.from({ length: 8 }).map((_, i) => ({ x: 0, y: i * 0.7 + 0.5, name: `R${i+1}` })),
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={4} height={5.4} rx={0.2} />
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1={0} y1={i * 0.7 + 0.5} x2={0.5} y2={i * 0.7 + 0.5} />
      ))}
      {Array.from({ length: 4 }).map((_, r) => Array.from({ length: 4 }).map((_, col) => (
        <circle key={`${r}-${col}`} cx={1.2 + col * 0.8} cy={1.5 + r * 0.8} r={0.2} fill={c} opacity={0.3} />
      )))}
    </g>),
  },
  lcd_1602: {
    id: "lcd_1602", category: "display", width: 8, height: 5, prefix: "DS", defaultValue: "LCD16x2",
    pins: Array.from({ length: 16 }).map((_, i) => ({ x: i * 0.5, y: 0, name: `${i+1}` })),
    draw: (c) => (<g {...S(c)}>
      <rect x={0} y={0.5} width={8} height={4.5} rx={0.2} />
      {Array.from({ length: 16 }).map((_, i) => (
        <line key={i} x1={i * 0.5} y1={0} x2={i * 0.5} y2={0.5} />
      ))}
      <rect x={0.8} y={1.2} width={6.4} height={2.5} rx={0.1} strokeWidth={0.08} />
      <text x={4} y={2.8} fontSize={0.6} textAnchor="middle" fill={c} stroke="none">LCD 16x2</text>
    </g>),
  },
  lcd_2004: {
    id: "lcd_2004", category: "display", width: 9, height: 6, prefix: "DS", defaultValue: "LCD20x4",
    pins: Array.from({ length: 16 }).map((_, i) => ({ x: i * 0.5 + 0.5, y: 0, name: `${i+1}` })),
    draw: (c) => (<g {...S(c)}>
      <rect x={0} y={0.5} width={9} height={5.5} rx={0.2} />
      {Array.from({ length: 16 }).map((_, i) => (
        <line key={i} x1={i * 0.5 + 0.5} y1={0} x2={i * 0.5 + 0.5} y2={0.5} />
      ))}
      <rect x={1} y={1.2} width={7} height={4} rx={0.1} strokeWidth={0.08} />
      <text x={4.5} y={3.5} fontSize={0.6} textAnchor="middle" fill={c} stroke="none">LCD 20x4</text>
    </g>),
  },
  oled_ssd1306: {
    id: "oled_ssd1306", category: "display", width: 4, height: 4, prefix: "DS", defaultValue: "OLED",
    pins: [{ x: 1, y: 0, name: "VCC" }, { x: 2, y: 0, name: "GND" }, { x: 3, y: 0, name: "SCL" }, { x: 4, y: 0, name: "SDA" }],
    draw: (c) => (<g {...S(c)}>
      <rect x={0} y={0.5} width={4} height={3.5} rx={0.2} />
      <line x1={1} y1={0} x2={1} y2={0.5} />
      <line x1={2} y1={0} x2={2} y2={0.5} />
      <line x1={3} y1={0} x2={3} y2={0.5} />
      <line x1={4} y1={0} x2={4} y2={0.5} />
      <rect x={0.5} y={1.2} width={3} height={2} rx={0.1} fill={c} opacity={0.1} />
      <text x={2} y={2.5} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">OLED</text>
    </g>),
  },
  tft_spi: {
    id: "tft_spi", category: "display", width: 5, height: 7, prefix: "DS", defaultValue: "TFT",
    pins: Array.from({ length: 8 }).map((_, i) => ({ x: i * 0.6, y: 0, name: `P${i+1}` })),
    draw: (c) => (<g {...S(c)}>
      <rect x={0} y={0.5} width={5} height={6.5} rx={0.2} />
      {Array.from({ length: 8 }).map((_, i) => (
        <line key={i} x1={i * 0.6} y1={0} x2={i * 0.6} y2={0.5} />
      ))}
      <rect x={0.5} y={1.2} width={4} height={5} rx={0.1} strokeWidth={0.08} />
      <text x={2.5} y={4} fontSize={0.6} textAnchor="middle" fill={c} stroke="none">TFT SPI</text>
    </g>),
  },
  generic_display: {
    id: "generic_display", category: "display", width: 6, height: 4, prefix: "DS", defaultValue: "Disp",
    pins: Array.from({ length: 10 }).map((_, i) => ({ x: i * 0.6, y: 0, name: `${i+1}` })),
    draw: (c) => (<g {...S(c)}>
      <rect x={0} y={0.5} width={6} height={3.5} rx={0.2} />
      {Array.from({ length: 10 }).map((_, i) => (
        <line key={i} x1={i * 0.6} y1={0} x2={i * 0.6} y2={0.5} />
      ))}
      <rect x={0.8} y={1.2} width={4.4} height={2} strokeDasharray="0.2 0.2" />
      <text x={3} y={2.5} fontSize={0.5} textAnchor="middle" fill={c} stroke="none">Generic Display</text>
    </g>),
  },
  /* ====== AMPLIFIERS ====== */
  generic_opamp: {
    id: "generic_opamp", category: "amplifier", width: 3, height: 3, prefix: "U", defaultValue: "Op-Amp",
    pins: [{ x: 0, y: 1, name: "+" }, { x: 0, y: 2, name: "-" }, { x: 3, y: 1.5, name: "OUT" }],
    draw: (c) => (<g {...S(c)}>
      <polygon points="0.5,0.5 0.5,2.5 2.5,1.5" />
      <line x1={0} y1={1} x2={0.5} y2={1} />
      <line x1={0} y1={2} x2={0.5} y2={2} />
      <line x1={2.5} y1={1.5} x2={3} y2={1.5} />
      <text x={0.8} y={1.15} fontSize={0.4} fill={c} stroke="none">+</text>
      <text x={0.8} y={2.15} fontSize={0.4} fill={c} stroke="none">-</text>
    </g>),
  },
  single_opamp: {
    id: "single_opamp", category: "amplifier", width: 4, height: 5, prefix: "U", defaultValue: "LM741",
    pins: [
      { x: 0, y: 1, name: "OFFSET" }, { x: 0, y: 2, name: "IN-" }, { x: 0, y: 3, name: "IN+" }, { x: 0, y: 4, name: "V-" },
      { x: 4, y: 4, name: "OFFSET" }, { x: 4, y: 3, name: "OUT" }, { x: 4, y: 2, name: "V+" }, { x: 4, y: 1, name: "NC" }
    ],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={3} height={4.4} rx={0.15} />
      <polygon points="1.2,1.7 1.2,3.3 2.8,2.5" opacity={0.3} />
      <text x={2} y={2.7} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">Op-Amp</text>
      {Array.from({ length: 4 }).map((_, i) => (
        <g key={i}>
          <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
          <line x1={3.5} y1={i + 1} x2={4} y2={i + 1} />
        </g>
      ))}
    </g>),
  },
  dual_opamp: {
    id: "dual_opamp", category: "amplifier", width: 4, height: 5, prefix: "U", defaultValue: "LM358",
    pins: [
      { x: 0, y: 1, name: "OUT1" }, { x: 0, y: 2, name: "IN1-" }, { x: 0, y: 3, name: "IN1+" }, { x: 0, y: 4, name: "GND" },
      { x: 4, y: 4, name: "VCC" }, { x: 4, y: 3, name: "IN2+" }, { x: 4, y: 2, name: "IN2-" }, { x: 4, y: 1, name: "OUT2" }
    ],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={3} height={4.4} rx={0.15} />
      <text x={2} y={2.7} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">DUAL</text>
      {Array.from({ length: 4 }).map((_, i) => (
        <g key={i}>
          <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
          <line x1={3.5} y1={i + 1} x2={4} y2={i + 1} />
        </g>
      ))}
    </g>),
  },
  quad_opamp: {
    id: "quad_opamp", category: "amplifier", width: 4, height: 8, prefix: "U", defaultValue: "LM324",
    pins: dipPins(14, 4),
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={3} height={7.4} rx={0.15} />
      <text x={2} y={4.2} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">QUAD</text>
      {Array.from({ length: 7 }).map((_, i) => (
        <g key={i}>
          <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
          <line x1={3.5} y1={i + 1} x2={4} y2={i + 1} />
        </g>
      ))}
    </g>),
  },
  comparator: {
    id: "comparator", category: "amplifier", width: 3, height: 3, prefix: "U", defaultValue: "LM393",
    pins: [{ x: 0, y: 1, name: "+" }, { x: 0, y: 2, name: "-" }, { x: 3, y: 1.5, name: "OUT" }],
    draw: (c) => (<g {...S(c)}>
      <polygon points="0.5,0.5 0.5,2.5 2.5,1.5" />
      <line x1={0} y1={1} x2={0.5} y2={1} />
      <line x1={0} y1={2} x2={0.5} y2={2} />
      <line x1={2.5} y1={1.5} x2={3} y2={1.5} />
      <text x={1.2} y={1.6} fontSize={0.6} textAnchor="middle" fill={c} stroke="none" fontWeight="bold">C</text>
    </g>),
  },
  instrumentation_amp: {
    id: "instrumentation_amp", category: "amplifier", width: 4, height: 5, prefix: "U", defaultValue: "INA128",
    pins: dipPins(8, 4),
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={3} height={4.4} rx={0.15} />
      <text x={2} y={2.7} fontSize={0.35} textAnchor="middle" fill={c} stroke="none">INST</text>
      {Array.from({ length: 4 }).map((_, i) => (
        <g key={i}>
          <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
          <line x1={3.5} y1={i + 1} x2={4} y2={i + 1} />
        </g>
      ))}
    </g>),
  },
  audio_amplifier: {
    id: "audio_amplifier", category: "amplifier", width: 4, height: 5, prefix: "U", defaultValue: "LM386",
    pins: dipPins(8, 4),
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={3} height={4.4} rx={0.15} />
      <text x={2} y={2.7} fontSize={0.35} textAnchor="middle" fill={c} stroke="none">AUDIO</text>
      {Array.from({ length: 4 }).map((_, i) => (
        <g key={i}>
          <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
          <line x1={3.5} y1={i + 1} x2={4} y2={i + 1} />
        </g>
      ))}
    </g>),
  },
  power_amplifier: {
    id: "power_amplifier", category: "amplifier", width: 5, height: 5, prefix: "U", defaultValue: "TDA2030",
    pins: Array.from({ length: 5 }).map((_, i) => ({ x: i + 0.5, y: 5, name: `${i+1}` })),
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.5} width={4} height={3.5} rx={0.1} />
      <rect x={1} y={0} width={3} height={0.5} fill={c} opacity={0.2} />
      <circle cx={2.5} cy={0.25} r={0.1} fill={c} opacity={0.5} />
      <text x={2.5} y={2.5} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">POWER</text>
    </g>),
  },

  ic4: makeIC("ic4", 4, "IC-4"),
  ic6: makeIC("ic6", 6, "IC-6"),
  ic8: makeIC("ic8", 8, "IC-8"),
  ic14: makeIC("ic14", 14, "IC-14"),
  ic16: makeIC("ic16", 16, "IC-16"),
  ic20: makeIC("ic20", 20, "IC-20"),
  ic28: makeIC("ic28", 28, "IC-28"),
  ic40: makeIC("ic40", 40, "IC-40"),

  /* legacy IC aliases */
  opamp4: {
    id: "opamp4", category: "ic", width: 5, height: 3, prefix: "U", defaultValue: "Op-Amp",
    pins: [
      { x: 0, y: 1, name: "IN-" }, { x: 0, y: 2, name: "IN+" },
      { x: 5, y: 1.5, name: "OUT" }, { x: 2.25, y: 0, name: "V+" },
    ],
    draw: (c) => (<g {...S(c)}>
      <polygon points="0,0.3 0,2.7 5,1.5" />
    </g>),
  },
  opamp6: makeIC("opamp6", 6, "OPAMP6"),
  opamp8: makeIC("opamp8", 8, "OPAMP8"),
  lm2596: {
    id: "lm2596", category: "ic", width: 5, height: 4, prefix: "U", defaultValue: "LM2596",
    pins: [
      { x: 0, y: 1, name: "VIN" }, { x: 0, y: 2, name: "GND" }, { x: 0, y: 3, name: "FB" },
      { x: 5, y: 1, name: "OUT" }, { x: 5, y: 2, name: "ON/OFF" },
    ],
    draw: (c) => (<g {...S(c)}>
      <rect x={0} y={0.3} width={5} height={3.4} rx={0.15} />
      <text x={2.5} y={2.2} fontSize={0.5} textAnchor="middle" fill={c} stroke="none">LM2596</text>
    </g>),
  },
  lm1117: {
    id: "lm1117", category: "ic", width: 4, height: 3, prefix: "U", defaultValue: "LM1117-3.3",
    pins: [
      { x: 0, y: 1.5, name: "IN" }, { x: 4, y: 1.5, name: "OUT" }, { x: 2, y: 3, name: "GND" },
    ],
    draw: (c) => (<g {...S(c)}>
      <rect x={0} y={0.3} width={4} height={2.4} rx={0.15} />
      <text x={2} y={1.75} fontSize={0.45} textAnchor="middle" fill={c} stroke="none">LM1117</text>
    </g>),
  },

  /* ====== CONNECTORS ====== */
  header: {
    id: "header", category: "connector", width: 2, height: 4, prefix: "J", defaultValue: "HDR-4",
    pins: Array.from({ length: 4 }).map((_, i) => ({ x: 0, y: i + 0.5, name: `${i + 1}` })),
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0} width={1.5} height={4} />
      {Array.from({ length: 4 }).map((_, i) => (
        <g key={i}>
          <line x1={0} y1={i + 0.5} x2={0.5} y2={i + 0.5} />
          <rect x={0.7} y={i + 0.2} width={0.6} height={0.6} {...SF(c)} />
        </g>
      ))}
    </g>),
  },
  screw_terminal: {
    id: "screw_terminal", category: "connector", width: 3, height: 3, prefix: "J", defaultValue: "TB-2",
    pins: [{ x: 0, y: 1, name: "1" }, { x: 0, y: 2, name: "2" }],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={2.5} height={2.4} rx={0.2} />
      <line x1={0} y1={1} x2={0.5} y2={1} />
      <line x1={0} y1={2} x2={0.5} y2={2} />
      <circle cx={1.7} cy={1} r={0.35} />
      <circle cx={1.7} cy={2} r={0.35} />
      <line x1={1.45} y1={0.75} x2={1.95} y2={1.25} />
      <line x1={1.45} y1={1.75} x2={1.95} y2={2.25} />
    </g>),
  },
  usb_c: {
    id: "usb_c", category: "connector", width: 4, height: 4, prefix: "J", defaultValue: "USB-C",
    pins: [
      { x: 0, y: 1, name: "VBUS" }, { x: 0, y: 2, name: "D+" },
      { x: 0, y: 3, name: "D-" }, { x: 4, y: 2, name: "GND" },
    ],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.5} width={3} height={3} rx={1.5} />
      <text x={2} y={2.15} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">USB-C</text>
      <line x1={0} y1={1} x2={0.5} y2={1} />
      <line x1={0} y1={2} x2={0.5} y2={2} />
      <line x1={0} y1={3} x2={0.5} y2={3} />
      <line x1={3.5} y1={2} x2={4} y2={2} />
    </g>),
  },
  micro_usb: {
    id: "micro_usb", category: "connector", width: 4, height: 4, prefix: "J", defaultValue: "MicroUSB",
    pins: [
      { x: 0, y: 1, name: "VBUS" }, { x: 0, y: 2, name: "D+" },
      { x: 0, y: 3, name: "D-" }, { x: 4, y: 2, name: "GND" },
    ],
    draw: (c) => (<g {...S(c)}>
      <polygon points="0.5,1 3.5,0.5 3.5,3.5 0.5,3" />
      <text x={2} y={2.15} fontSize={0.35} textAnchor="middle" fill={c} stroke="none">μUSB</text>
      <line x1={0} y1={1} x2={0.5} y2={1} />
      <line x1={0} y1={2} x2={0.5} y2={2} />
      <line x1={0} y1={3} x2={0.5} y2={3} />
      <line x1={3.5} y1={2} x2={4} y2={2} />
    </g>),
  },
  jst: {
    id: "jst", category: "connector", width: 3, height: 2, prefix: "J", defaultValue: "JST-2",
    pins: [{ x: 0, y: 0.5, name: "+" }, { x: 0, y: 1.5, name: "-" }],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.2} width={2} height={1.6} rx={0.1} />
      <text x={1.5} y={1.15} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">JST</text>
      <line x1={0} y1={0.5} x2={0.5} y2={0.5} />
      <line x1={0} y1={1.5} x2={0.5} y2={1.5} />
    </g>),
  },
  dc_jack: {
    id: "dc_jack", category: "connector", width: 4, height: 3, prefix: "J", defaultValue: "DC-Jack",
    pins: [
      { x: 0, y: 1, name: "+" }, { x: 0, y: 2, name: "-" }, { x: 4, y: 1.5, name: "SW" },
    ],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={3} height={2.4} rx={0.3} />
      <circle cx={2.7} cy={1.5} r={0.6} />
      <circle cx={2.7} cy={1.5} r={0.2} {...SF(c)} />
      <line x1={0} y1={1} x2={0.5} y2={1} />
      <line x1={0} y1={2} x2={0.5} y2={2} />
      <line x1={3.5} y1={1.5} x2={4} y2={1.5} />
    </g>),
  },

  usb_a: {
    id: "usb_a", category: "connector", width: 4, height: 3, prefix: "J", defaultValue: "USB-A",
    pins: [{ x: 0, y: 0.5, name: "V+" }, { x: 0, y: 1.2, name: "D-" }, { x: 0, y: 1.8, name: "D+" }, { x: 0, y: 2.5, name: "GND" }],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={3.5} height={2.4} rx={0.1} />
      <rect x={1} y={0.8} width={2.5} height={1.4} />
      <text x={2.2} y={1.75} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">USB-A</text>
    </g>),
  },
  barrel_jack: {
    id: "barrel_jack", category: "connector", width: 4, height: 3, prefix: "J", defaultValue: "DC",
    pins: [{ x: 0, y: 1, name: "+" }, { x: 0, y: 2, name: "-" }],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={3} height={2.4} rx={0.3} />
      <circle cx={2} cy={1.5} r={0.6} />
      <circle cx={2} cy={1.5} r={0.2} {...SF(c)} />
    </g>),
  },
  rj45: {
    id: "rj45", category: "connector", width: 4, height: 4, prefix: "J", defaultValue: "RJ45",
    pins: Array.from({ length: 8 }).map((_, i) => ({ x: 0, y: i * 0.4 + 0.6, name: `${i+1}` })),
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={3.5} height={3.4} rx={0.2} />
      <rect x={1.2} y={1} width={2} height={2} strokeDasharray="0.2 0.2" />
      <text x={2.2} y={2.2} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">RJ45</text>
    </g>),
  },
  hdmi: {
    id: "hdmi", category: "connector", width: 5, height: 3, prefix: "J", defaultValue: "HDMI",
    pins: Array.from({ length: 19 }).map((_, i) => ({ x: 0, y: i * 0.15 + 0.15, name: `${i+1}` })),
    draw: (c) => (<g {...S(c)}>
      <path d="M0.5,0.5 L4,0.5 L4.5,1 L4.5,2 L4,2.5 L0.5,2.5 Z" />
      <text x={2.2} y={1.7} fontSize={0.5} textAnchor="middle" fill={c} stroke="none">HDMI</text>
    </g>),
  },
  audio_jack: {
    id: "audio_jack", category: "connector", width: 4, height: 2.5, prefix: "J", defaultValue: "Audio",
    pins: [{ x: 0, y: 0.5, name: "L" }, { x: 0, y: 1.2, name: "R" }, { x: 0, y: 2, name: "GND" }],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={3} height={1.9} rx={0.2} />
      <rect x={3.5} y={0.8} width={0.5} height={0.9} />
      <text x={2} y={1.4} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">JACK</text>
    </g>),
  },
  gpio_header: {
    id: "gpio_header", category: "connector", width: 8, height: 2, prefix: "J", defaultValue: "GPIO",
    pins: Array.from({ length: 20 }).map((_, i) => ({ x: i * 0.4, y: 0, name: `${i+1}` })),
    draw: (c) => (<g {...S(c)}>
      <rect x={0} y={0.5} width={8} height={1.2} />
      {Array.from({ length: 10 }).map((_, i) => (
        <circle key={i} cx={0.4 + i * 0.8} cy={0.9} r={0.15} {...SF(c)} />
      ))}
      {Array.from({ length: 10 }).map((_, i) => (
        <circle key={i+10} cx={0.4 + i * 0.8} cy={1.3} r={0.15} {...SF(c)} />
      ))}
    </g>),
  },
  fpc_connector: {
    id: "fpc_connector", category: "connector", width: 5, height: 2, prefix: "J", defaultValue: "FPC",
    pins: Array.from({ length: 20 }).map((_, i) => ({ x: i * 0.25, y: 0, name: `${i+1}` })),
    draw: (c) => (<g {...S(c)}>
      <rect x={0} y={0.5} width={5} height={1} rx={0.1} />
      <line x1={0.5} y1={1.2} x2={4.5} y2={1.2} strokeWidth={0.2} />
    </g>),
  },

  /* ====== POWER MODULES ====== */
  xl4015_buck: {
    id: "xl4015_buck", category: "power", width: 6, height: 4, prefix: "MOD", defaultValue: "XL4015",
    pins: [{ x: 0, y: 1, name: "IN+" }, { x: 0, y: 3, name: "IN-" }, { x: 6, y: 1, name: "OUT+" }, { x: 6, y: 3, name: "OUT-" }],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={5} height={3.4} rx={0.2} />
      <text x={3} y={2.2} fontSize={0.6} textAnchor="middle" fill={c} stroke="none">XL4015</text>
    </g>),
  },
  mt3608_boost: {
    id: "mt3608_boost", category: "power", width: 5, height: 3, prefix: "MOD", defaultValue: "MT3608",
    pins: [{ x: 0, y: 1, name: "IN+" }, { x: 0, y: 2, name: "IN-" }, { x: 5, y: 1, name: "OUT+" }, { x: 5, y: 2, name: "OUT-" }],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={4} height={2.4} rx={0.2} />
      <text x={2.5} y={1.7} fontSize={0.5} textAnchor="middle" fill={c} stroke="none">MT3608</text>
    </g>),
  },
  tp4056_charger: {
    id: "tp4056_charger", category: "power", width: 5, height: 3, prefix: "MOD", defaultValue: "TP4056",
    pins: [{ x: 0, y: 1, name: "IN+" }, { x: 0, y: 2, name: "IN-" }, { x: 5, y: 0.5, name: "B+" }, { x: 5, y: 1.5, name: "B-" }, { x: 5, y: 2.5, name: "OUT+" }],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={4} height={2.4} rx={0.2} />
      <text x={2.5} y={1.7} fontSize={0.5} textAnchor="middle" fill={c} stroke="none">TP4056</text>
    </g>),
  },
  generic_dcdc: {
    id: "generic_dcdc", category: "power", width: 6, height: 4, prefix: "MOD", defaultValue: "DC-DC",
    pins: [{ x: 0, y: 1, name: "IN+" }, { x: 0, y: 3, name: "IN-" }, { x: 6, y: 1, name: "OUT+" }, { x: 6, y: 3, name: "OUT-" }],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.3} width={5} height={3.4} rx={0.2} strokeDasharray="0.2 0.2" />
      <text x={3} y={2.2} fontSize={0.6} textAnchor="middle" fill={c} stroke="none">DC-DC</text>
    </g>),
  },
  push_button: {
    id: "push_button", category: "control", width: 3, height: 2, prefix: "SW", defaultValue: "BTN",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1} y2={1} />
      <line x1={2} y1={1} x2={3} y2={1} />
      <line x1={1} y1={0.6} x2={2} y2={0.6} />
      <line x1={1.5} y1={0.6} x2={1.5} y2={0.2} />
      <line x1={1.1} y1={0.2} x2={1.9} y2={0.2} />
    </g>),
  },
  switch: {
    id: "switch", category: "control", width: 3, height: 2, prefix: "SW", defaultValue: "ON/OFF",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1} y2={1} />
      <circle cx={1} cy={1} r={0.1} {...SF(c)} />
      <line x1={1} y1={1} x2={2.2} y2={0.3} />
      <circle cx={2} cy={1} r={0.1} {...SF(c)} />
      <line x1={2} y1={1} x2={3} y2={1} />
    </g>),
  },
  dip_switch: {
    id: "dip_switch", category: "control", width: 4, height: 3, prefix: "SW", defaultValue: "DIP-4",
    pins: [
      { x: 0, y: 0.5, name: "1" }, { x: 0, y: 1.5, name: "2" }, { x: 0, y: 2.5, name: "3" },
      { x: 4, y: 0.5, name: "1" }, { x: 4, y: 1.5, name: "2" }, { x: 4, y: 2.5, name: "3" },
    ],
    draw: (c) => (<g {...S(c)}>
      <rect x={0.5} y={0.2} width={3} height={2.6} rx={0.1} />
      {[0.5, 1.5, 2.5].map((y, i) => (
        <g key={i}>
          <line x1={0} y1={y} x2={0.5} y2={y} />
          <line x1={3.5} y1={y} x2={4} y2={y} />
          <rect x={1.3} y={y - 0.25} width={1.4} height={0.5} />
          <rect x={1.4} y={y - 0.2} width={0.5} height={0.4} {...SF(c)} />
        </g>
      ))}
    </g>),
  },
  rotary_switch: {
    id: "rotary_switch", category: "control", width: 4, height: 4, prefix: "SW", defaultValue: "ROT",
    pins: [
      { x: 0, y: 2, name: "C" },
      { x: 4, y: 0.5, name: "1" }, { x: 4, y: 1.5, name: "2" },
      { x: 4, y: 2.5, name: "3" }, { x: 4, y: 3.5, name: "4" },
    ],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={2} x2={1} y2={2} />
      <circle cx={1.5} cy={2} r={0.5} />
      <line x1={1.5} y1={2} x2={3.5} y2={1.5} />
      {[0.5, 1.5, 2.5, 3.5].map((y, i) => (
        <g key={i}>
          <line x1={3.5} y1={y} x2={4} y2={y} />
          <circle cx={3.5} cy={y} r={0.1} {...SF(c)} />
        </g>
      ))}
    </g>),
  },

  /* ====== PROTECTION ====== */
  tvs: {
    id: "tvs", category: "protection", width: 3, height: 2, prefix: "D", defaultValue: "TVS",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1.2} y2={1} />
      <polygon points="1.2,0.4 1.2,1.6 2,1" {...SF(c)} />
      <polygon points="2,1.6 2,0.4 1.2,1" />
      <line x1={2} y1={1} x2={3} y2={1} />
      <polyline points="0.9,0.4 1.2,0.4 1.2,1.6 1.5,1.6" />
      <polyline points="1.7,0.4 2,0.4 2,1.6 2.3,1.6" />
    </g>),
  },
  mov: {
    id: "mov", category: "protection", width: 3, height: 2, prefix: "RV", defaultValue: "MOV",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={0.5} y2={1} />
      <rect x={0.5} y={0.5} width={2} height={1} />
      <text x={1.5} y={1.18} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">MOV</text>
      <line x1={2.5} y1={1} x2={3} y2={1} />
      <line x1={0.8} y1={1.7} x2={2.2} y2={0.3} />
    </g>),
  },

  /* ====== TEST ====== */
  test_point: {
    id: "test_point", category: "test", width: 2, height: 2, prefix: "TP", defaultValue: "TP",
    pins: [{ x: 1, y: 2 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={1} y1={2} x2={1} y2={0.8} />
      <circle cx={1} cy={0.5} r={0.35} {...SF(c)} />
    </g>),
  },
  voltage_probe: {
    id: "voltage_probe", category: "test", width: 2, height: 3, prefix: "TP", defaultValue: "VP",
    pins: [{ x: 1, y: 3 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={1} y1={3} x2={1} y2={1.5} />
      <circle cx={1} cy={1} r={0.4} />
      <text x={1} y={1.15} fontSize={0.45} textAnchor="middle" fill={c} stroke="none">V</text>
    </g>),
  },
  ground_probe: {
    id: "ground_probe", category: "test", width: 2, height: 3, defaultValue: "GND",
    pins: [{ x: 1, y: 0 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={1} y1={0} x2={1} y2={1.5} />
      <line x1={0.2} y1={1.5} x2={1.8} y2={1.5} />
      <line x1={0.5} y1={1.85} x2={1.5} y2={1.85} />
      <line x1={0.8} y1={2.2} x2={1.2} y2={2.2} />
      <text x={1} y={2.85} fontSize={0.35} textAnchor="middle" fill={c} stroke="none">GND</text>
    </g>),
  },

  /* ====== METERS ====== */
  voltmeter: {
    id: "voltmeter", category: "meter", width: 3, height: 2, prefix: "V", defaultValue: "0V",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={0.7} y2={1} />
      <line x1={2.3} y1={1} x2={3} y2={1} />
      <circle cx={1.5} cy={1} r={0.8} />
      <text x={1.5} y={1.25} fontSize={0.7} textAnchor="middle" fill={c} stroke="none">V</text>
    </g>),
  },
  ammeter: {
    id: "ammeter", category: "meter", width: 3, height: 2, prefix: "A", defaultValue: "0A",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={0.7} y2={1} />
      <line x1={2.3} y1={1} x2={3} y2={1} />
      <circle cx={1.5} cy={1} r={0.8} />
      <text x={1.5} y={1.25} fontSize={0.7} textAnchor="middle" fill={c} stroke="none">A</text>
    </g>),
  },
  oscilloscope_probe: {
    id: "oscilloscope_probe", category: "meter", width: 3, height: 3, prefix: "X", defaultValue: "OSC",
    pins: [{ x: 0, y: 2, name: "TIP" }, { x: 0, y: 2.7, name: "GND" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={2} x2={0.8} y2={2} />
      <line x1={0} y1={2.7} x2={0.8} y2={2.7} />
      <rect x={0.8} y={1.3} width={1.5} height={1.8} rx={0.15} />
      <polyline points="1,2.4 1.3,1.9 1.6,2.4 1.9,1.9 2.2,2.4" />
      <text x={1.55} y={0.95} fontSize={0.35} textAnchor="middle" fill={c} stroke="none">SCOPE</text>
    </g>),
  },
  logic_analyzer_probe: {
    id: "logic_analyzer_probe", category: "meter", width: 3, height: 3, prefix: "X", defaultValue: "LA",
    pins: [{ x: 0, y: 1, name: "CH" }, { x: 0, y: 2.5, name: "GND" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={0.8} y2={1} />
      <line x1={0} y1={2.5} x2={0.8} y2={2.5} />
      <rect x={0.8} y={0.5} width={1.8} height={2.2} rx={0.15} />
      <polyline points="1,2 1,1.5 1.4,1.5 1.4,2 1.8,2 1.8,1.5 2.2,1.5" />
      <text x={1.7} y={1.1} fontSize={0.35} textAnchor="middle" fill={c} stroke="none">LOGIC</text>
    </g>),
  },
  current_probe: {
    id: "current_probe", category: "meter", width: 3, height: 3, prefix: "X", defaultValue: "I",
    pins: [{ x: 0, y: 1.5, name: "OUT" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1.5} x2={0.8} y2={1.5} />
      <circle cx={1.7} cy={1.5} r={0.9} />
      <path d="M1.7 0.8 a0.7 0.7 0 0 1 0 1.4" />
      <text x={1.7} y={1.7} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">I</text>
    </g>),
  },

  /* legacy keep */
  transistor: {
    id: "transistor", category: "semi", width: 3, height: 4, prefix: "Q", defaultValue: "BC547",
    pins: [{ x: 0, y: 2, name: "B" }, { x: 3, y: 0.5, name: "C" }, { x: 3, y: 3.5, name: "E" }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={2} x2={1.2} y2={2} />
      <line x1={1.2} y1={1} x2={1.2} y2={3} />
      <line x1={1.2} y1={1.4} x2={3} y2={0.5} />
      <line x1={1.2} y1={2.6} x2={3} y2={3.5} />
      <polygon points="2.5,3.05 2.95,3.45 2.55,3.55" {...SF(c)} />
      <circle cx={1.7} cy={2} r={0.9} />
    </g>),
  },
  mosfet: {
    id: "mosfet", category: "semi", width: 3, height: 4, prefix: "Q", defaultValue: "IRF540",
    pins: [{ x: 0, y: 2, name: "G" }, { x: 3, y: 0.5, name: "D" }, { x: 3, y: 3.5, name: "S" }],
    draw: (c) => (<g {...S(c)}>
      {/* Circle envelope */}
      <circle cx={1.7} cy={2} r={1.1} />
      {/* Gate lead & plate */}
      <line x1={0} y1={2} x2={1.2} y2={2} />
      <line x1={1.2} y1={1} x2={1.2} y2={3} />
      {/* Channel segments */}
      <line x1={1.4} y1={0.9} x2={1.4} y2={1.5} />
      <line x1={1.4} y1={1.7} x2={1.4} y2={2.3} />
      <line x1={1.4} y1={2.5} x2={1.4} y2={3.1} />
      {/* External connection leads */}
      <line x1={1.4} y1={1.2} x2={3} y2={0.5} />
      <line x1={1.4} y1={2.8} x2={3} y2={3.5} />
      {/* Bulk connection to source */}
      <line x1={1.4} y1={2} x2={2.1} y2={2} />
      <line x1={2.1} y1={2} x2={2.1} y2={2.8} />
      {/* Bulk arrow (pointing in) */}
      <polygon points="1.8,1.8 1.4,2 1.8,2.2" {...SF(c)} />
      {/* Body Diode in parallel with DS channel */}
      <line x1={2.5} y1={1.2} x2={2.5} y2={2.8} />
      <line x1={1.4} y1={1.2} x2={2.5} y2={1.2} />
      <line x1={1.4} y1={2.8} x2={2.5} y2={2.8} />
      {/* Diode triangle pointing up (Anode-Cathode) */}
      <polygon points="2.3,2.2 2.7,2.2 2.5,1.8" {...SF(c)} />
      <line x1={2.3} y1={1.8} x2={2.7} y2={1.8} />
    </g>),
  },
  diode2: {
    id: "diode2", category: "semi", width: 3, height: 2, prefix: "D", defaultValue: "1N4148",
    pins: [{ x: 0, y: 1 }, { x: 3, y: 1 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1} x2={1.2} y2={1} />
      <polygon points="1.2,0.4 1.2,1.6 2,1" {...SF(c)} />
      <line x1={2} y1={0.4} x2={2} y2={1.6} />
      <line x1={2} y1={1} x2={3} y2={1} />
    </g>),
  },
  diode3: {
    id: "diode3", category: "semi", width: 3, height: 3, prefix: "D", defaultValue: "BAT54",
    pins: [{ x: 0, y: 1.5 }, { x: 3, y: 1.5 }, { x: 1.5, y: 3 }],
    draw: (c) => (<g {...S(c)}>
      <line x1={0} y1={1.5} x2={1.2} y2={1.5} />
      <polygon points="1.2,0.9 1.2,2.1 2,1.5" {...SF(c)} />
      <line x1={2} y1={0.9} x2={2} y2={2.1} />
      <line x1={2} y1={1.5} x2={3} y2={1.5} />
      <line x1={1.5} y1={2.1} x2={1.5} y2={3} />
    </g>),
  },

  text: {
    id: "text", category: "board", width: 1.5, height: 0.5, prefix: "TXT", defaultValue: "TEXT",
    pins: [],
    draw: (c) => (<g />),
  },
  
  /* ====== MCU GENERIC ====== */
  mcu8: makeMCU("mcu8", 8, "MCU-8"),
  mcu14: makeMCU("mcu14", 14, "MCU-14"),
  mcu16: makeMCU("mcu16", 16, "MCU-16"),
  mcu20: makeMCU("mcu20", 20, "MCU-20"),
  mcu28: makeMCU("mcu28", 28, "MCU-28"),
  attiny85: {
    id: "attiny85", category: "mcu", width: 4, height: 5, prefix: "U", defaultValue: "ATTiny85",
    pins: [
      { x: 0, y: 1, name: "PB5/RESET" }, { x: 0, y: 2, name: "PB3" }, { x: 0, y: 3, name: "PB4" }, { x: 0, y: 4, name: "GND" },
      { x: 4, y: 4, name: "PB0" }, { x: 4, y: 3, name: "PB1" }, { x: 4, y: 2, name: "PB2" }, { x: 4, y: 1, name: "VCC" },
    ],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={3} height={4.4} rx={0.15} />
        <circle cx={0.8} cy={0.7} r={0.1} />
        <text x={2} y={2.5} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">ATTiny85</text>
        {Array.from({ length: 4 }).map((_, i) => (
          <g key={i}>
            <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
            <line x1={3.5} y1={i + 1} x2={4} y2={i + 1} />
          </g>
        ))}
      </g>
    ),
  },
  esp12f: {
    id: "esp12f", category: "mcu", width: 6, height: 12, prefix: "U", defaultValue: "ESP-12F",
    pins: [
      { x: 0, y: 1, name: "REST" }, { x: 0, y: 2, name: "ADC" }, { x: 0, y: 3, name: "EN" },
      { x: 0, y: 4, name: "IO16" }, { x: 0, y: 5, name: "IO14" }, { x: 0, y: 6, name: "IO12" },
      { x: 0, y: 7, name: "IO13" }, { x: 0, y: 8, name: "VCC" },
      { x: 6, y: 8, name: "GND" }, { x: 6, y: 7, name: "IO15" }, { x: 6, y: 6, name: "IO2" },
      { x: 6, y: 5, name: "IO0" }, { x: 6, y: 4, name: "IO4" }, { x: 6, y: 3, name: "IO5" },
      { x: 6, y: 2, name: "RXD0" }, { x: 6, y: 1, name: "TXD0" },
      { x: 2, y: 12, name: "CS0" }, { x: 3, y: 12, name: "MISO" }, { x: 4, y: 12, name: "MOSI" },
    ],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={5} height={11} rx={0.2} />
        <rect x={1.5} y={1} width={3} height={3} fill={c} opacity={0.1} />
        <text x={3} y={6} fontSize={0.5} textAnchor="middle" fill={c} stroke="none">ESP8266</text>
        <text x={3} y={7} fontSize={0.3} textAnchor="middle" fill={c} stroke="none" opacity={0.7}>ESP-12F</text>
      </g>
    ),
  },
  stm32_chip: {
    id: "stm32_chip", category: "mcu", width: 8, height: 8, prefix: "U", defaultValue: "STM32F103",
    pins: Array.from({ length: 48 }).map((_, i) => {
      const side = Math.floor(i / 12);
      const idx = i % 12;
      if (side === 0) return { x: 0, y: idx + 1, name: `P${i+1}` };
      if (side === 1) return { x: idx + 1, y: 8, name: `P${i+1}` };
      if (side === 2) return { x: 8, y: 8 - idx, name: `P${i+1}` };
      return { x: 8 - idx, y: 0, name: `P${i+1}` };
    }),
    draw: (c) => (
      <g {...S(c)}>
        <rect x={1} y={1} width={6} height={6} rx={0.2} />
        <text x={4} y={4.3} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">STM32</text>
      </g>
    ),
  },
  pic16f877a: {
    id: "pic16f877a", category: "mcu", width: 5, height: 21, prefix: "U", defaultValue: "PIC16F877A",
    pins: dipPins(40, 5),
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={4} height={20.4} rx={0.2} />
        <text x={2.5} y={10.5} fontSize={0.4} textAnchor="middle" fill={c} stroke="none" transform="rotate(-90 2.5 10.5)">PIC16F877A</text>
        {Array.from({ length: 20 }).map((_, i) => (
          <g key={i}>
            <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
            <line x1={4.5} y1={i + 1} x2={5} y2={i + 1} />
          </g>
        ))}
      </g>
    ),
  },
  /* ====== MOTORS ====== */
  dc_motor: {
    id: "dc_motor", category: "motor", width: 3, height: 3, prefix: "M", defaultValue: "DC Motor",
    pins: [{ x: 0, y: 1.5, name: "+" }, { x: 3, y: 1.5, name: "-" }],
    draw: (c) => (
      <g {...S(c)}>
        <circle cx={1.5} cy={1.5} r={1.2} />
        <text x={1.5} y={1.7} fontSize={0.8} textAnchor="middle" fill={c} stroke="none" fontWeight="bold">M</text>
        <line x1={0} y1={1.5} x2={0.3} y2={1.5} />
        <line x1={0.3} y1={1.5} x2={0.7} y2={1.5} />
        <line x1={2.3} y1={1.5} x2={2.7} y2={1.5} />
        <line x1={2.7} y1={1.5} x2={3} y2={1.5} />
      </g>
    ),
  },
  servo_motor: {
    id: "servo_motor", category: "motor", width: 3, height: 2, prefix: "M", defaultValue: "Servo",
    pins: [{ x: 0.5, y: 2, name: "PWM" }, { x: 1.5, y: 2, name: "VCC" }, { x: 2.5, y: 2, name: "GND" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={2} height={1} rx={0.1} />
        <circle cx={1.5} cy={1} r={0.3} />
        <line x1={1} y1={1} x2={2} y2={1} strokeWidth={0.2} />
        <line x1={0.5} y1={1.5} x2={0.5} y2={2} />
        <line x1={1.5} y1={1.5} x2={1.5} y2={2} />
        <line x1={2.5} y1={1.5} x2={2.5} y2={2} />
      </g>
    ),
  },
  stepper_motor: {
    id: "stepper_motor", category: "motor", width: 4, height: 4, prefix: "M", defaultValue: "Stepper",
    pins: [{ x: 1, y: 4, name: "A+" }, { x: 2, y: 4, name: "A-" }, { x: 3, y: 4, name: "B+" }, { x: 4, y: 4, name: "B-" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={3} height={3} rx={0.2} />
        <circle cx={2} cy={2} r={0.8} opacity={0.3} />
        <text x={2} y={2.2} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">STEP</text>
        <line x1={1} y1={3.5} x2={1} y2={4} />
        <line x1={2} y1={3.5} x2={2} y2={4} />
        <line x1={3} y1={3.5} x2={3} y2={4} />
        <line x1={4} y1={3.5} x2={4} y2={4} />
      </g>
    ),
  },

  /* ====== TIMERS & CONVERTERS ====== */
  ne555: {
    id: "ne555", category: "amplifier", width: 4, height: 5, prefix: "U", defaultValue: "NE555",
    pins: dipPins(8, 4),
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={3} height={4.4} rx={0.15} />
        <text x={2} y={2.7} fontSize={0.5} textAnchor="middle" fill={c} stroke="none">555</text>
        {Array.from({ length: 4 }).map((_, i) => (
          <g key={i}>
            <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
            <line x1={3.5} y1={i + 1} x2={4} y2={i + 1} />
          </g>
        ))}
      </g>
    ),
  },

  /* ====== CRYSTALS ====== */
  crystal_hc49: {
    id: "crystal_hc49", category: "passive", width: 3, height: 2, prefix: "Y", defaultValue: "16MHz",
    pins: [{ x: 0, y: 1, name: "1" }, { x: 3, y: 1, name: "2" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={2} height={1} rx={0.5} fill="none" />
        <line x1={0.7} y1={0.5} x2={0.7} y2={1.5} />
        <line x1={2.3} y1={0.5} x2={2.3} y2={1.5} />
        <rect x={0.8} y={0.6} width={1.4} height={0.8} />
      </g>
    ),
  },

  /* ====== REGULATORS ====== */
  regulator_7812: {
    id: "regulator_7812", category: "semi", width: 3, height: 2, prefix: "U", defaultValue: "7812",
    pins: [{ x: 0, y: 1, name: "IN" }, { x: 1.5, y: 2, name: "GND" }, { x: 3, y: 1, name: "OUT" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={2} height={1.4} rx={0.1} />
        <text x={1.5} y={1.2} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">7812</text>
        <line x1={0} y1={1} x2={0.5} y2={1} />
        <line x1={2.5} y1={1} x2={3} y2={1} />
        <line x1={1.5} y1={1.7} x2={1.5} y2={2} />
      </g>
    ),
  },
  regulator_lm317: {
    id: "regulator_lm317", category: "semi", width: 3, height: 2, prefix: "U", defaultValue: "LM317",
    pins: [{ x: 0, y: 1, name: "ADJ" }, { x: 1.5, y: 2, name: "OUT" }, { x: 3, y: 1, name: "IN" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={2} height={1.4} rx={0.1} />
        <text x={1.5} y={1.2} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">LM317</text>
        <line x1={0} y1={1} x2={0.5} y2={1} />
        <line x1={2.5} y1={1} x2={3} y2={1} />
        <line x1={1.5} y1={1.7} x2={1.5} y2={2} />
      </g>
    ),
  },
  ams1117: {
    id: "ams1117", category: "semi", width: 3, height: 2, prefix: "U", defaultValue: "AMS1117-3.3",
    pins: [{ x: 0.5, y: 2, name: "GND" }, { x: 1.5, y: 2, name: "OUT" }, { x: 2.5, y: 2, name: "IN" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={2} height={1} rx={0.1} />
        <text x={1.5} y={1.1} fontSize={0.3} textAnchor="middle" fill={c} stroke="none">1117</text>
        <line x1={0.5} y1={1.5} x2={0.5} y2={2} />
        <line x1={1.5} y1={1.5} x2={1.5} y2={2} />
        <line x1={2.5} y1={1.5} x2={2.5} y2={2} />
      </g>
    ),
  },

  /* ====== TRANSISTORS & MOSFETS ====== */
  npn_2n2222: {
    id: "npn_2n2222", category: "semi", width: 2, height: 2, prefix: "Q", defaultValue: "2N2222",
    pins: [{ x: 0, y: 1, name: "B" }, { x: 1.5, y: 0, name: "C" }, { x: 1.5, y: 2, name: "E" }],
    draw: (c) => (
      <g {...S(c)}>
        <line x1={0.8} y1={0.5} x2={0.8} y2={1.5} strokeWidth={0.2} />
        <line x1={0} y1={1} x2={0.8} y2={1} />
        <line x1={0.8} y1={0.8} x2={1.5} y2={0.3} />
        <line x1={0.8} y1={1.2} x2={1.5} y2={1.7} />
        <polygon points="1.5,1.7 1.2,1.5 1.4,1.3" />
      </g>
    ),
  },
  mosfet_irf540: {
    id: "mosfet_irf540", category: "semi", width: 2, height: 2, prefix: "Q", defaultValue: "IRF540N",
    pins: [{ x: 0, y: 1.5, name: "G" }, { x: 1.5, y: 0, name: "D" }, { x: 1.5, y: 2, name: "S" }],
    draw: (c) => (
      <g {...S(c)}>
        <line x1={0.8} y1={0.5} x2={0.8} y2={1.5} strokeWidth={0.15} />
        <line x1={1} y1={0.5} x2={1} y2={1.5} strokeWidth={0.1} strokeDasharray="0.3 0.1" />
        <line x1={0} y1={1.5} x2={0.8} y2={1.5} />
        <line x1={1} y1={0.8} x2={1.5} y2={0.3} />
        <line x1={1} y1={1.5} x2={1.5} y2={2} />
        <polygon points="1,1.2 1.3,1.2 1,1.4" />
      </g>
    ),
  },
  ultrasonic: {
    id: "ultrasonic", category: "sensor", width: 4, height: 2, prefix: "SEN", defaultValue: "HC-SR04",
    pins: [{ x: 0.5, y: 2, name: "VCC" }, { x: 1.5, y: 2, name: "TRIG" }, { x: 2.5, y: 2, name: "ECHO" }, { x: 3.5, y: 2, name: "GND" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.2} y={0.2} width={3.6} height={1.4} rx={0.1} />
        <circle cx={1} cy={0.9} r={0.5} />
        <circle cx={3} cy={0.9} r={0.5} />
        <line x1={0.5} y1={1.6} x2={0.5} y2={2} />
        <line x1={1.5} y1={1.6} x2={1.5} y2={2} />
        <line x1={2.5} y1={1.6} x2={2.5} y2={2} />
        <line x1={3.5} y1={1.6} x2={3.5} y2={2} />
      </g>
    ),
  },
  pir_sensor: {
    id: "pir_sensor", category: "sensor", width: 3, height: 3, prefix: "SEN", defaultValue: "PIR",
    pins: [{ x: 0.5, y: 3, name: "VCC" }, { x: 1.5, y: 3, name: "OUT" }, { x: 2.5, y: 3, name: "GND" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={2} height={2} rx={0.1} />
        <circle cx={1.5} cy={1.5} r={0.8} opacity={0.3} />
        <line x1={0.5} y1={2.5} x2={0.5} y2={3} />
        <line x1={1.5} y1={2.5} x2={1.5} y2={3} />
        <line x1={2.5} y1={2.5} x2={2.5} y2={3} />
      </g>
    ),
  },
  dht11: {
    id: "dht11", category: "sensor", width: 3, height: 4, prefix: "SEN", defaultValue: "DHT11",
    pins: [{ x: 0.5, y: 4, name: "VCC" }, { x: 1.5, y: 4, name: "DATA" }, { x: 2.5, y: 4, name: "GND" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={2} height={3} rx={0.1} />
        {Array.from({ length: 4 }).map((_, i) => (
          <line key={i} x1={0.8} y1={1 + i * 0.5} x2={2.2} y2={1 + i * 0.5} strokeWidth={0.1} />
        ))}
        <line x1={0.5} y1={3.5} x2={0.5} y2={4} />
        <line x1={1.5} y1={3.5} x2={1.5} y2={4} />
        <line x1={2.5} y1={3.5} x2={2.5} y2={4} />
      </g>
    ),
  },
  gas_sensor: {
    id: "gas_sensor", category: "sensor", width: 4, height: 4, prefix: "SEN", defaultValue: "MQ-2",
    pins: [{ x: 1, y: 4, name: "VCC" }, { x: 2, y: 4, name: "DO" }, { x: 3, y: 4, name: "AO" }, { x: 4, y: 4, name: "GND" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={3.8} height={3.2} rx={0.2} />
        <circle cx={2.4} cy={1.8} r={1.2} />
        <circle cx={2.4} cy={1.8} r={0.9} strokeDasharray="0.2 0.2" />
        <line x1={1} y1={3.5} x2={1} y2={4} />
        <line x1={2} y1={3.5} x2={2} y2={4} />
        <line x1={3} y1={3.5} x2={3} y2={4} />
        <line x1={4} y1={3.5} x2={4} y2={4} />
      </g>
    ),
  },
  /* ====== COMMUNICATION ====== */
  bluetooth_hc05: {
    id: "bluetooth_hc05", category: "modules", width: 4, height: 6, prefix: "MOD", defaultValue: "HC-05",
    pins: [
      { x: 0.5, y: 6, name: "STATE" }, { x: 1.2, y: 6, name: "RX" }, { x: 1.9, y: 6, name: "TX" },
      { x: 2.6, y: 6, name: "GND" }, { x: 3.3, y: 6, name: "VCC" }, { x: 4.0, y: 6, name: "EN" }
    ],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.3} y={0.5} width={3.9} height={5} rx={0.1} />
        <path d="M 1,1 L 3,1 L 3,2 L 1,2 L 1,1.5 L 2.5,1.5" fill="none" stroke={c} strokeWidth={0.1} />
        <text x={2} y={3.5} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">BT</text>
        <line x1={0.5} y1={5.5} x2={0.5} y2={6} />
        <line x1={1.2} y1={5.5} x2={1.2} y2={6} />
        <line x1={1.9} y1={5.5} x2={1.9} y2={6} />
        <line x1={2.6} y1={5.5} x2={2.6} y2={6} />
        <line x1={3.3} y1={5.5} x2={3.3} y2={6} />
        <line x1={4.0} y1={5.5} x2={4.0} y2={6} />
      </g>
    ),
  },
  nrf24l01: {
    id: "nrf24l01", category: "modules", width: 4, height: 5, prefix: "MOD", defaultValue: "nRF24L01",
    pins: [
      { x: 0, y: 1, name: "GND" }, { x: 0, y: 2, name: "CE" }, { x: 0, y: 3, name: "SCK" }, { x: 0, y: 4, name: "MISO" },
      { x: 4, y: 1, name: "VCC" }, { x: 4, y: 2, name: "CSN" }, { x: 4, y: 3, name: "MOSI" }, { x: 4, y: 4, name: "IRQ" }
    ],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={3} height={4} rx={0.1} />
        <text x={2} y={2.5} fontSize={0.3} textAnchor="middle" fill={c} stroke="none">nRF24</text>
        {Array.from({ length: 4 }).map((_, i) => (
          <g key={i}>
            <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
            <line x1={3.5} y1={i + 1} x2={4} y2={i + 1} />
          </g>
        ))}
      </g>
    ),
  },
  /* ====== POWER MODULES ====== */
  regulator_7805: {
    id: "regulator_7805", category: "semi", width: 3, height: 2, prefix: "U", defaultValue: "7805",
    pins: [{ x: 0, y: 1, name: "IN" }, { x: 1.5, y: 2, name: "GND" }, { x: 3, y: 1, name: "OUT" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={2} height={1.4} rx={0.1} />
        <text x={1.5} y={1.2} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">7805</text>
        <line x1={0} y1={1} x2={0.5} y2={1} />
        <line x1={2.5} y1={1} x2={3} y2={1} />
        <line x1={1.5} y1={1.7} x2={1.5} y2={2} />
      </g>
    ),
  },
  lipo_battery: {
    id: "lipo_battery", category: "power", width: 4, height: 3, prefix: "BAT", defaultValue: "3.7V LiPo",
    pins: [{ x: 0, y: 1.5, name: "+" }, { x: 4, y: 1.5, name: "-" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={3} height={2} rx={0.1} />
        <text x={2} y={1.7} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">LiPo</text>
        <line x1={0} y1={1.5} x2={0.5} y2={1.5} />
        <line x1={3.5} y1={1.5} x2={4} y2={1.5} />
      </g>
    ),
  },
  li_ion_18650: {
    id: "li_ion_18650", category: "power", width: 5, height: 2, prefix: "BAT", defaultValue: "3.7V 18650",
    pins: [{ x: 0, y: 1, name: "+" }, { x: 5, y: 1, name: "-" }],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={4} height={1} rx={0.2} />
        <rect x={4.3} y={0.7} width={0.3} height={0.6} rx={0.1} />
        <text x={2.5} y={1.15} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">18650</text>
        <line x1={0} y1={1} x2={0.5} y2={1} />
        <line x1={4.5} y1={1} x2={5} y2={1} />
      </g>
    ),
  },
  buzzer_piezo: {
    id: "buzzer_piezo", category: "display", width: 2, height: 2, prefix: "BZ", defaultValue: "Buzzer",
    pins: [{ x: 0.5, y: 2, name: "+" }, { x: 1.5, y: 2, name: "-" }],
    draw: (c) => (
      <g {...S(c)}>
        <circle cx={1} cy={0.8} r={0.7} />
        <circle cx={1} cy={0.8} r={0.1} />
        <line x1={0.5} y1={1.5} x2={0.5} y2={2} />
        <line x1={1.5} y1={1.5} x2={1.5} y2={2} />
      </g>
    ),
  },
  atmega328p: {
    id: "atmega328p", category: "mcu", width: 5, height: 15, prefix: "U", defaultValue: "ATmega328P",
    pins: [
      { x: 0, y: 1, name: "PC6/RESET" }, { x: 0, y: 2, name: "PD0/RXD" }, { x: 0, y: 3, name: "PD1/TXD" },
      { x: 0, y: 4, name: "PD2/INT0" }, { x: 0, y: 5, name: "PD3/INT1" }, { x: 0, y: 6, name: "PD4/XCK" },
      { x: 0, y: 7, name: "VCC" }, { x: 0, y: 8, name: "GND" }, { x: 0, y: 9, name: "PB6/XTAL1" },
      { x: 0, y: 10, name: "PB7/XTAL2" }, { x: 0, y: 11, name: "PD5/T1" }, { x: 0, y: 12, name: "PD6/AIN0" },
      { x: 0, y: 13, name: "PD7/AIN1" }, { x: 0, y: 14, name: "PB0/ICP1" },
      { x: 5, y: 14, name: "PB1/OC1A" }, { x: 5, y: 13, name: "PB2/OC1B" }, { x: 5, y: 12, name: "PB3/MOSI" },
      { x: 5, y: 11, name: "PB4/MISO" }, { x: 5, y: 10, name: "PB5/SCK" }, { x: 5, y: 9, name: "AVCC" },
      { x: 5, y: 8, name: "AREF" }, { x: 5, y: 7, name: "GND" }, { x: 5, y: 6, name: "PC0/ADC0" },
      { x: 5, y: 5, name: "PC1/ADC1" }, { x: 5, y: 4, name: "PC2/ADC2" }, { x: 5, y: 3, name: "PC3/ADC3" },
      { x: 5, y: 2, name: "PC4/ADC4" }, { x: 5, y: 1, name: "PC5/ADC5" },
    ],
    draw: (c) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.3} width={4} height={14.4} rx={0.2} />
        <text x={2.5} y={0.9} fontSize={0.4} textAnchor="middle" fill={c} stroke="none">ATmega328P</text>
        {Array.from({ length: 14 }).map((_, i) => (
          <g key={i}>
            <line x1={0} y1={i + 1} x2={0.5} y2={i + 1} />
            <line x1={4.5} y1={i + 1} x2={5} y2={i + 1} />
          </g>
        ))}
      </g>
    ),
  },
  mcu40: makeMCU("mcu40", 40, "MCU-40"),
  mcu64: makeMCU("mcu64", 64, "MCU-64"),

  /* ====== MCU BOARDS ====== */
  esp32_devkit: makeBoard("esp32_devkit", "ESP32 DevKit", [
    ["3V3", "VIN"], ["GND", "GND"], ["D15", "D13"], ["D2", "D12"],
    ["D4", "D14"], ["RX2", "D27"], ["TX2", "D26"], ["D5", "D25"], ["SCK", "D33"],
    ["MISO", "D32"], ["MOSI", "D35"], ["CS", "D34"], ["EN", "TX0"], ["VP", "RX0"], ["VN", "D23"],
  ]),
  esp32_wroom: makeBoard("esp32_wroom", "ESP32-WROOM", [
    ["EN", "IO23"], ["IO0", "IO22"], ["IO2", "TX0"], ["IO4", "RX0"],
    ["IO5", "IO21"], ["IO12", "IO19"], ["IO14", "IO18"], ["GND", "3V3"],
    ["IO34", "IO17"], ["IO35", "IO16"], ["IO32", "IO5"], ["IO33", "IO18"],
    ["IO25", "IO19"], ["IO26", "IO21"], ["IO27", "IO22"], ["IO14", "IO23"],
    ["IO12", "TX0"], ["GND", "RX0"], ["IO13", "IO2"],
  ]),
  esp8266_nodemcu: makeBoard("esp8266_nodemcu", "NodeMCU", [
    ["A0", "VIN"], ["D0", "GND"], ["D1", "3V3"], ["D2", "D8"],
    ["D3", "D7"], ["D4", "D6"], ["3V3", "D5"], ["GND", "GND"],
    ["TX", "RX"], ["SD3", "CMD"], ["SD2", "SD0"], ["SD1", "CLK"],
    ["RST", "GND"], ["EN", "3V3"], ["GND", "VIN"],
  ]),
  arduino_uno: makeBoard("arduino_uno", "Arduino Uno", [
    ["IOREF", "SCL"], ["RST", "SDA"], ["3V3", "AREF"], ["5V", "GND"],
    ["GND", "D13"], ["GND", "D12"], ["VIN", "D11"], ["A0", "D10"],
    ["A1", "D9"], ["A2", "D8"], ["A3", "D7"], ["A4", "D6"],
    ["A5", "D5"], ["NC", "D4"], ["TX1", "D3"], ["RX0", "D2"]
  ]),
  arduino_nano: makeBoard("arduino_nano", "Arduino Nano", [
    ["D1", "VIN"], ["GND", "GND"], ["D2", "5V"], ["D3", "3V3"],
    ["D4", "A0"], ["D5", "A1"], ["D6", "A2"], ["D7", "A3"], ["D8", "A4"], ["D9", "A5"],
    ["D10", "D11"], ["D12", "D13"], ["GND", "AREF"], ["SDA", "SCL"],
  ]),
  stm32_bluepill: makeBoard("stm32_bluepill", "STM32 Blue Pill", [
    ["3V3", "VIN"], ["GND", "GND"], ["D15", "D13"], ["D2", "D12"],
    ["D4", "D14"], ["RX2", "D27"], ["TX2", "D26"], ["D5", "D25"], ["SCK", "D33"],
    ["MISO", "D32"], ["MOSI", "D35"], ["CS", "D34"], ["EN", "TX0"], ["VP", "RX0"], ["VN", "D23"],
  ]),
  rpi_pico: makeBoard("rpi_pico", "Pi Pico", [
    ["GP0", "VBUS"], ["GP1", "VSYS"], ["GND", "GND"], ["GP2", "3V3EN"],
    ["GP3", "3V3"], ["GP4", "ADC_VREF"], ["GP5", "GP28"], ["GND", "GND"], ["GP6", "GP27"], ["GP7", "GP26"],
    ["GP8", "GP22"], ["GP9", "GND"], ["GP10", "GP21"], ["GP11", "GP20"], ["GP12", "GP19"], ["GP13", "GP18"],
    ["GND", "GND"], ["GP14", "GP17"], ["GP15", "GP16"], ["GND", "RUN"],
  ]),

  /* ====== LEGACY MODULES ====== */
  esp32: makeBoard("esp32", "ESP32", [
    ["3V3", "GND"], ["EN", "IO23"], ["VP", "IO22"], ["VN", "TXD"],
    ["IO34", "RXD"], ["IO35", "IO21"], ["IO32", "IO19"], ["IO33", "IO18"],
    ["IO25", "IO5"], ["IO26", "IO17"], ["IO27", "IO16"], ["IO14", "IO4"],
    ["IO12", "IO0"], ["GND", "IO2"], ["IO13", "IO15"], ["SD2", "SD1"],
  ]),
};


export type ConnectorMetadata = {
  type: "HEADER_SOCKET" | "SCREW_TERMINAL";
  gender?: "MALE" | "FEMALE" | "SHROUDED" | "DIP";
  rows?: number;
  pinsPerRow?: number;
  orientation?: "STRAIGHT" | "RIGHT_ANGLE";
  // Screw Terminal Block parameters
  poles?: number;
  color?: string;
  drillHole?: number;
  padDiameter?: number;
  pinLabels?: string[];
  wireEntry?: "Side Entry (90° Horizontal)" | "Top Entry (Vertical)" | string;
  // Shared
  pitch: number;
  refDes: string;
};

export function generateConnectorId(meta: ConnectorMetadata) {
  if (meta.type === "SCREW_TERMINAL") {
    const entryCode = meta.wireEntry?.includes("Top") ? "TOP" : "SIDE";
    return `CONN_SCREW_${meta.poles || 2}P_${meta.pitch}MM_${entryCode}`;
  }
  return `CONN_${meta.gender}_${meta.rows}x${meta.pinsPerRow}_${meta.pitch}_${meta.orientation}`;
}

export function ensureDynamicSymbol(id: string, meta?: ConnectorMetadata) {
  if (_SYMBOLS[id]) return _SYMBOLS[id];
  
  if (id.startsWith("CONN_")) {
    if (id.startsWith("CONN_SCREW_") || meta?.type === "SCREW_TERMINAL") {
      let m = meta;
      if (!m) {
        const parts = id.split("_");
        const polesStr = parts[2]?.replace("P", "") || "2";
        const pitchStr = parts[3]?.replace("MM", "") || "5.08";
        m = {
          type: "SCREW_TERMINAL",
          poles: parseInt(polesStr, 10) || 2,
          pitch: parseFloat(pitchStr) || 5.08,
          color: "#00A859",
          drillHole: parseFloat(pitchStr) >= 5.0 ? 1.30 : 1.10,
          padDiameter: parseFloat(pitchStr) >= 5.0 ? 2.40 : 1.90,
          pinLabels: [],
          wireEntry: parts[4] === "TOP" ? "Top Entry (Vertical)" : "Side Entry (90° Horizontal)",
          refDes: "TB",
        };
      }

      const poles = m.poles || 2;
      const pitch = m.pitch || 5.08;
      const labels = m.pinLabels || [];
      const width = Math.max(3.5, (poles - 1) * 1.5 + 2.5);
      const height = 3.2;

      const pins: PinDef[] = [];
      for (let i = 0; i < poles; i++) {
        const pinNum = i + 1;
        const pinName = labels[i] || `${pinNum}`;
        pins.push({
          x: 1.25 + i * 1.5,
          y: 1.5,
          name: pinName,
        });
      }

      const draw = (c: string) => (
        <g {...S(c)}>
          <rect x={0.5} y={0.5} width={width - 1} height={2.0} rx={0.2} fill="none" stroke={c} strokeWidth={0.15} />
          {pins.map((p, i) => {
            const pinName = labels[i] || `${i + 1}`;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={0.35} fill="none" stroke={c} strokeWidth={0.12} />
                <line x1={p.x - 0.22} y1={p.y} x2={p.x + 0.22} y2={p.y} stroke={c} strokeWidth={0.1} />
                <line x1={p.x} y1={p.y - 0.22} x2={p.x} y2={p.y + 0.22} stroke={c} strokeWidth={0.1} />
                <text x={p.x} y={p.y - 0.52} fontSize={0.25} textAnchor="middle" fill={c} stroke="none" fontWeight="bold">
                  {pinName}
                </text>
              </g>
            );
          })}
          <text x={width / 2} y={2.2} fontSize={0.26} textAnchor="middle" fill={c} stroke="none">
            {m.refDes || "TB"} ({poles}P - {pitch}mm)
          </text>
        </g>
      );

      const sym: SymbolDef = {
        id,
        category: "connector",
        width,
        height,
        prefix: m.refDes || "TB",
        defaultValue: `${poles}P Terminal (${pitch}mm)`,
        pins,
        draw,
      };
      _SYMBOLS[id] = sym;
      return sym;
    }

    let m = meta;
    if (!m) {
      const parts = id.split("_");
      const r_p = parts[2].split("x");
      m = {
        type: "HEADER_SOCKET",
        gender: parts[1] as any,
        rows: parseInt(r_p[0], 10),
        pinsPerRow: parseInt(r_p[1], 10),
        pitch: parseFloat(parts[3]),
        orientation: parts[4] as any,
        refDes: "J",
      };
    }
    
    const rows = m.rows || 1;
    const cols = m.pinsPerRow || 1;
    const width = 2 + (cols > 1 ? (cols - 1) * 1.5 : 0);
    const height = 1 + rows; // 1 unit per row spacing

    const pins: PinDef[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pinNum = r * cols + c + 1;
        pins.push({
          x: 1 + c * 1.5,
          y: 1 + r,
          name: `${m.refDes}_${pinNum}`,
        });
      }
    }

    const draw = (c: string) => (
      <g {...S(c)}>
        <rect x={0.5} y={0.5} width={width - 1} height={height} rx={0.1} />
        {pins.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={0.2} fill="none" />
            <line x1={p.x} y1={p.y - 0.2} x2={p.x} y2={p.y + 0.2} />
            <line x1={p.x - 0.2} y1={p.y} x2={p.x + 0.2} y2={p.y} />
          </g>
        ))}
        <text x={width/2} y={height + 1.2} fontSize={0.3} textAnchor="middle" fill={c} stroke="none">
          {m.gender} {m.rows}x{m.pinsPerRow}
        </text>
      </g>
    );

    const sym: SymbolDef = {
      id,
      category: "connector",
      width,
      height: height + 1.5,
      prefix: m.refDes || "J",
      defaultValue: `${m.rows}x${m.pinsPerRow} ${m.gender}`,
      pins,
      draw,
    };
    _SYMBOLS[id] = sym;
    return sym;
  }
  return undefined;
}


export const SYMBOLS = new Proxy(_SYMBOLS, {
  get(target, prop: string) {
    if (prop in target) return target[prop];
    if (typeof prop === 'string' && prop.startsWith('CONN_')) {
      const sym = ensureDynamicSymbol(prop);
      if (sym) target[prop] = sym;
      return sym;
    }
    // Dynamically imported KiCad symbols (id starts with "kicad:")
    if (typeof prop === 'string' && prop.startsWith('kicad:')) {
      try {
        const sym = getImportedKiCadSymbol(prop);
        if (sym) {
          target[prop] = sym;
          return sym;
        }
      } catch {
        /* ignore */
      }
    }
    return undefined;
  },
  set(target, prop: string, value) {
    target[prop] = value;
    return true;
  },
  ownKeys(target) {
    return Reflect.ownKeys(target);
  },
  getOwnPropertyDescriptor(target, prop) {
    return Reflect.getOwnPropertyDescriptor(target, prop);
  }
});

/** Built-in catalogue only. Imported KiCad symbols are merged at UI time. */
export const SYMBOL_LIST = Object.values(_SYMBOLS);

export const CATEGORY_ORDER: SymbolCategory[] = [
  "power", "passive", "semi", "amplifier", "sensor", "motor", "logic", "display", "ic", "connector", "control",
  "protection", "test", "mcu", "board", "meter", "modules",
];

export function transformedPins(sym: SymbolDef | undefined, rotation: number, scale = 1): PinDef[] {
  if (!sym) return [];
  const cx = sym.width / 2;
  const cy = sym.height / 2;
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return sym.pins.map((p) => ({
    x: cx + ((p.x - cx) * cos - (p.y - cy) * sin) * scale,
    y: cy + ((p.x - cx) * sin + (p.y - cy) * cos) * scale,
    name: p.name,
  }));
}

export function nodeBBox(node: { x: number; y: number; symbol: SymbolId; rotation: number; size?: number; metadata?: any }) {
  const sym = SYMBOLS[node.symbol] || ensureDynamicSymbol(node.symbol, node.metadata);
  if (!sym) return { x: node.x - 0.5, y: node.y - 0.5, w: 1, h: 1 };
  const scale = node.size ?? 1;
  const w = (node.rotation % 180 === 0 ? sym.width : sym.height) * scale;
  const h = (node.rotation % 180 === 0 ? sym.height : sym.width) * scale;
  const cx = node.x + sym.width / 2;
  const cy = node.y + sym.height / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}
