import { SymbolId } from "./schematic";

export type ModelSource = "builtin" | "user" | "imported";
export type SpicePrimitive = "R" | "C" | "L" | "D" | "Q" | "M" | "V" | "I" | "X" | "S";

export interface SpiceParameter {
  name: string;
  label: string;
  defaultValue: string;
  unit?: string;
  description?: string;
}

export interface SpiceModel {
  id: string;
  name: string;
  primitive: SpicePrimitive;
  label: string;
  parameters: SpiceParameter[];
  pinMapping: string[]; // Order of pins for SPICE template
  template: string; // e.g. "{ref} {nodes} {value}"
  source: ModelSource;
  content?: string; // Raw .model or .subckt content
  category?: string;
}

export const BUILTIN_MODELS: SpiceModel[] = [
  {
    id: "resistor",
    name: "Standard Resistor",
    primitive: "R",
    label: "Resistor",
    source: "builtin",
    category: "Passive",
    parameters: [{ name: "value", label: "Resistance", defaultValue: "1k", unit: "Ω" }],
    pinMapping: ["1", "2"],
    template: "{ref} {nodes} {value}"
  },
  {
    id: "capacitor",
    name: "Standard Capacitor",
    primitive: "C",
    label: "Capacitor",
    source: "builtin",
    category: "Passive",
    parameters: [
      { name: "value", label: "Capacitance", defaultValue: "100u", unit: "F" },
      { name: "esr", label: "ESR", defaultValue: "0", unit: "Ω" }
    ],
    pinMapping: ["1", "2"],
    template: "{ref} {nodes} {value}"
  },
  {
    id: "inductor",
    name: "Standard Inductor",
    primitive: "L",
    label: "Inductor",
    source: "builtin",
    category: "Passive",
    parameters: [{ name: "value", label: "Inductance", defaultValue: "1m", unit: "H" }],
    pinMapping: ["1", "2"],
    template: "{ref} {nodes} {value}"
  },
  {
    id: "diode_gen",
    name: "Generic Diode",
    primitive: "D",
    label: "Diode",
    source: "builtin",
    category: "Semiconductor",
    parameters: [
      { name: "model", label: "Model Name", defaultValue: "D1N4148" },
      { name: "vf", label: "Forward Voltage", defaultValue: "0.7", unit: "V" }
    ],
    pinMapping: ["A", "K"],
    template: "{ref} {nodes} {model}"
  },
  {
    id: "npn_gen",
    name: "Generic NPN BJT",
    primitive: "Q",
    label: "NPN BJT",
    source: "builtin",
    category: "Semiconductor",
    parameters: [{ name: "model", label: "Model Name", defaultValue: "2N2222" }],
    pinMapping: ["C", "B", "E"],
    template: "{ref} {nodes} {model}"
  },
  {
    id: "pnp_gen",
    name: "Generic PNP BJT",
    primitive: "Q",
    label: "PNP BJT",
    source: "builtin",
    category: "Semiconductor",
    parameters: [{ name: "model", label: "Model Name", defaultValue: "2N2907" }],
    pinMapping: ["C", "B", "E"],
    template: "{ref} {nodes} {model}"
  },
  {
    id: "nmos_gen",
    name: "Generic N-MOSFET",
    primitive: "M",
    label: "N-MOSFET",
    source: "builtin",
    category: "Semiconductor",
    parameters: [{ name: "model", label: "Model Name", defaultValue: "IRF540" }],
    pinMapping: ["D", "G", "S"],
    template: "{ref} {nodes} {model}"
  },
  {
    id: "pmos_gen",
    name: "Generic P-MOSFET",
    primitive: "M",
    label: "P-MOSFET",
    source: "builtin",
    category: "Semiconductor",
    parameters: [{ name: "model", label: "Model Name", defaultValue: "IRF9540" }],
    pinMapping: ["D", "G", "S"],
    template: "{ref} {nodes} {model}"
  },
  {
    id: "opamp_gen",
    name: "Generic Op-Amp",
    primitive: "X",
    label: "Op-Amp",
    source: "builtin",
    category: "Integrated Circuit",
    parameters: [{ name: "model", label: "Subcircuit", defaultValue: "UA741" }],
    pinMapping: ["+", "-", "V+", "V-", "OUT"],
    template: "{ref} {nodes} {model}"
  },
  {
    id: "vsource_dc",
    name: "DC Voltage Source",
    primitive: "V",
    label: "Voltage Source",
    source: "builtin",
    category: "Source",
    parameters: [
      { name: "value", label: "DC Value", defaultValue: "5", unit: "V" },
      { name: "ac", label: "AC Amplitude", defaultValue: "0", unit: "V" }
    ],
    pinMapping: ["+", "-"],
    template: "{ref} {nodes} DC {value} AC {ac}"
  },
  {
    id: "isource_dc",
    name: "DC Current Source",
    primitive: "I",
    label: "Current Source",
    source: "builtin",
    category: "Source",
    parameters: [
      { name: "value", label: "DC Value", defaultValue: "1m", unit: "A" }
    ],
    pinMapping: ["+", "-"],
    template: "{ref} {nodes} DC {value}"
  },
  {
    id: "voltmeter",
    name: "Voltmeter",
    primitive: "R",
    label: "Voltmeter",
    source: "builtin",
    category: "Meter",
    parameters: [
      { name: "value", label: "Internal Resistance", defaultValue: "1G", unit: "Ω" }
    ],
    pinMapping: ["1", "2"],
    template: "{ref} {nodes} {value}"
  },
  {
    id: "ammeter",
    name: "Ammeter",
    primitive: "R",
    label: "Ammeter",
    source: "builtin",
    category: "Meter",
    parameters: [
      { name: "value", label: "Internal Resistance", defaultValue: "1m", unit: "Ω" }
    ],
    pinMapping: ["1", "2"],
    template: "{ref} {nodes} {value}"
  }
];

export const SYMBOL_TO_MODEL: Record<SymbolId, string> = {
  "resistor": "resistor",
  "capacitor": "capacitor",
  "capacitor_polar": "capacitor",
  "inductor": "inductor",
  "diode": "diode_gen",
  "zener": "diode_gen",
  "led": "diode_gen",
  "photodiode": "diode_gen",
  "vsource": "vsource_dc",
  "battery": "vsource_dc",
  "dc_source": "vsource_dc",
  "ac_source": "vsource_dc",
  "isource": "isource_dc",
  "vcc": "vsource_dc",
  "vdd": "vsource_dc",
  "vss": "vsource_dc",
  "vee": "vsource_dc",
  "npn": "npn_gen",
  "pnp": "pnp_gen",
  "nmos": "nmos_gen",
  "pmos": "pmos_gen",
  "nmosfet": "nmos_gen",
  "pmosfet": "pmos_gen",
  "opamp": "opamp_gen",
  "opamp4": "opamp_gen",
  "switch_spst": "resistor", // Switches often modeled as variable resistors
  "potentiometer": "resistor",
  "voltmeter": "voltmeter",
  "ammeter": "ammeter",
  "gnd": "",
};

export function getModelForSymbol(symbolId: SymbolId): SpiceModel | null {
  const modelId = SYMBOL_TO_MODEL[symbolId];
  if (!modelId) return null;
  return BUILTIN_MODELS.find(m => m.id === modelId) || null;
}
