import { SchematicDoc, SchematicNode, SymbolId } from "./schematic";
import { NetIndex, buildNetIndex } from "./netlist";
import { SYMBOLS } from "./symbols";
import { getModelForSymbol, SpiceModel, BUILTIN_MODELS } from "./spice-models";

export type AnalysisType = "DC" | "AC" | "TRAN";

export interface SimulationSettings {
  analysisType: AnalysisType;
  dcStart?: number;
  dcStop?: number;
  dcStep?: number;
  acPoints?: number;
  acStartFreq?: number;
  acStopFreq?: number;
  tranStep?: number;
  tranStop?: number;
}

export interface SimulationResult {
  type: "voltage" | "current" | "power" | "ac_mag" | "ac_phase";
  node: string; // Net name or Element reference
  values: { t: number; v: number }[]; // t can be frequency for AC
}

interface SpiceElement {
  type: string;
  ref: string;
  nodes: string[];
  value: number;
  params?: Record<string, any>;
  signal?: {
    type: "DC" | "PULSE" | "SINE" | "SQUARE" | "TRIANGLE";
    amplitude: number;
    frequency: number;
    offset: number;
    dutyCycle?: number;
    phase?: number;
  };
}

export function getComponentRef(node: SchematicNode, doc?: SchematicDoc): string {
  let model: SpiceModel | null = null;
  if (node.customModel && doc) {
    const allModels = [...BUILTIN_MODELS, ...(doc.userModels || [])];
    model = allModels.find(m => m.id === node.customModel?.modelId) || null;
  }
  if (!model) {
    model = getModelForSymbol(node.symbol as SymbolId);
  }
  
  const prefix = model?.primitive || 'U';
  let ref = node.reference || `${prefix}${node.id}`;
  if (!ref.toUpperCase().startsWith(prefix)) {
    ref = `${prefix}${ref}`;
  }
  return ref;
}

export function getVoltageColor(v: number): string {
  if (v <= 0.1) return "#3b82f6"; // Blue
  if (v <= 1) return "#60a5fa";
  if (v <= 2) return "#10b981"; // Green
  if (v <= 5) return "#f59e0b"; // Yellow
  if (v <= 12) return "#f97316"; // Orange
  return "#ef4444"; // Red
}

export function getSpiceNodeName(netId: number | undefined, gndNetId: number): string {
  if (netId === undefined) return "0";
  if (netId === gndNetId) return "0";
  return `net_${netId}`;
}

export function generateSpiceNetlist(doc: SchematicDoc): string {
  const netIndex = buildNetIndex(doc);
  let spice = "* Circuit SPICE Netlist\n";
  const modelsUsed = new Set<string>();
  const subcircuitsUsed = new Map<string, string>();

  let gndNetId = -1;
  doc.nodes.forEach(node => {
    if (node.symbol === "gnd") {
      const netId = netIndex.pinNet.get(`${node.id}:0`);
      if (netId !== undefined) gndNetId = netId;
    }
  });

  if (gndNetId === -1 && netIndex.nets.length > 0) {
    gndNetId = 0; // Default first net to ground if no explicit ground
  }

  doc.nodes.forEach(node => {
    if (node.symbol === "gnd") return;
    
    const symbolDef = SYMBOLS[node.symbol];
    if (!symbolDef) return;

    // Determine model to use
    let model: SpiceModel | null = null;
    if (node.customModel) {
      const allModels = [...BUILTIN_MODELS, ...(doc.userModels || [])];
      model = allModels.find(m => m.id === node.customModel?.modelId) || null;
    }
    if (!model) {
      model = getModelForSymbol(node.symbol as SymbolId);
    }
    
    if (!model) return;

    // Fault Injection: Open Circuit
    const fault = doc.faults?.find(f => f.targetId === node.id && f.type === "open");
    if (fault) {
       spice += `* Faulted: ${node.reference || node.id} is OPEN\n`;
       return;
    }

    if (node.symbol === "switch" || node.symbol === "switch_spst" || node.symbol === "push_button" || node.symbol === "button") {
      const isOpen = node.value === "open" || node.value === "0" || node.value === "OFF" || !node.value;
      const rVal = isOpen ? "1G" : "1m";
      const connectedNets = symbolDef.pins.map((_, i) => getSpiceNodeName(netIndex.pinNet.get(`${node.id}:${i}`), gndNetId));
      spice += `R${node.id} ${connectedNets.join(" ")} ${rVal}\n`;
      return;
    }

    const ref = getComponentRef(node, doc);
    const value = node.value || model.parameters[0]?.defaultValue || "0";
    
    // Mapping pins
    const connectedNets = model.pinMapping.map((modelPinName) => {
      let symbolPinIdx = -1;
      
      if (node.customModel?.pinMapping) {
        // Find which symbol pin is mapped to this model pin
        const symbolPinName = Object.keys(node.customModel.pinMapping).find(k => node.customModel?.pinMapping[k] === modelPinName);
        if (symbolPinName) {
          symbolPinIdx = symbolDef.pins.findIndex(p => (p.name || `Pin ${symbolDef.pins.indexOf(p) + 1}`) === symbolPinName);
        }
      }

      // Fallback to standard order if no custom mapping or mapping failed
      if (symbolPinIdx === -1) {
        const matchingPinIdx = symbolDef.pins.findIndex(p => p.name === modelPinName);
        if (matchingPinIdx !== -1) {
           symbolPinIdx = matchingPinIdx;
        } else {
           symbolPinIdx = model.pinMapping.indexOf(modelPinName);
        }
      }

      if (symbolPinIdx === -1 || symbolPinIdx >= symbolDef.pins.length) return "0";
      
      const netId = netIndex.pinNet.get(`${node.id}:${symbolPinIdx}`);
      return getSpiceNodeName(netId, gndNetId);
    });

    const spiceLine = model.template
      .replace("{ref}", ref)
      .replace("{nodes}", connectedNets.join(" "))
      .replace("{value}", value)
      .replace("{model}", model.primitive === "X" ? model.name : value);
    
    spice += `${spiceLine}\n`;
    
    if (model.content) {
      if (model.primitive === "X" || model.template.includes("{model}")) {
        subcircuitsUsed.set(model.name, model.content);
      } else {
        modelsUsed.add(model.content);
      }
    }
  });

  // Add model definitions
  modelsUsed.forEach(m => spice += `${m}\n`);
  subcircuitsUsed.forEach(content => spice += `${content}\n`);

  return spice;
}

class MNASolver {
  private elements: SpiceElement[] = [];
  private nodeMap = new Map<string, number>();
  private nodes: string[] = [];

  constructor(netlist: string) {
    this.parseNetlist(netlist);
  }

  private parseNetlist(netlist: string) {
    const lines = netlist.split("\n");
    lines.forEach(line => {
      line = line.trim();
      if (!line || line.startsWith("*") || line.startsWith(".")) return;
      
      const parts = line.split(/\s+/);
      const ref = parts[0];
      const type = ref[0].toUpperCase();
      
      let nodeCount = 2;
      if (type === "Q") nodeCount = 3;
      if (type === "M") nodeCount = 4;
      
      const elementNodes = parts.slice(1, 1 + nodeCount);
      let valueIdx = 1 + nodeCount;
      if (parts[valueIdx] && (parts[valueIdx].toUpperCase() === "DC" || parts[valueIdx].toUpperCase() === "AC")) {
        valueIdx++;
      }
      const valueStr = parts[valueIdx];
      const value = this.parseValue(valueStr);

      const el: SpiceElement = { type, ref, nodes: elementNodes, value };
      
      // Check for signal parameters in remaining parts
      // Example: V1 n1 n2 SIN(0 5 1k)
      const remainder = parts.slice(1 + nodeCount).join(" ");
      const sinMatch = remainder.match(/sin\((.*?)\)/i);
      if (sinMatch) {
        const p = sinMatch[1].split(/\s+/).map(v => this.parseValue(v));
        el.signal = { type: "SINE", offset: p[0] || 0, amplitude: p[1] || 1, frequency: p[2] || 1000, phase: p[3] || 0 };
      }
      const pulseMatch = remainder.match(/pulse\((.*?)\)/i);
      if (pulseMatch) {
        const p = pulseMatch[1].split(/\s+/).map(v => this.parseValue(v));
        el.signal = { type: "PULSE", offset: p[0] || 0, amplitude: p[1] || 1, frequency: 1 / (p[6] || 1), dutyCycle: (p[3] || 0) / (p[6] || 1) };
      }

      this.elements.push(el);
      elementNodes.forEach(n => {
        if (!this.nodeMap.has(n)) {
          this.nodeMap.set(n, this.nodes.length);
          this.nodes.push(n);
        }
      });
    });

    if (!this.nodeMap.has("0")) {
      this.nodeMap.set("0", this.nodes.length);
      this.nodes.push("0");
    }
  }

  private parseValue(v: string): number {
    if (!v || v === "dc" || v === "ac") return 0;
    v = v.toLowerCase();
    const multipliers: Record<string, number> = {
      "p": 1e-12, "n": 1e-9, "u": 1e-6, "m": 1e-3, "k": 1e3, "meg": 1e6, "g": 1e9
    };
    for (const [suffix, mult] of Object.entries(multipliers)) {
      if (v.endsWith(suffix) && !isNaN(parseFloat(v))) return parseFloat(v) * mult;
    }
    return parseFloat(v) || 0;
  }

  private getElementValue(e: SpiceElement, t: number): number {
    if (!e.signal) return e.value;
    const { type, amplitude, frequency, offset, dutyCycle, phase = 0 } = e.signal;
    const w = 2 * Math.PI * frequency;
    const phi = (phase * Math.PI) / 180;

    switch (type) {
      case "SINE":
        return offset + amplitude * Math.sin(w * t + phi);
      case "SQUARE":
        return offset + (Math.sin(w * t + phi) >= 0 ? amplitude : -amplitude);
      case "TRIANGLE": {
        const period = 1 / frequency;
        const phaseShift = (phase / 360) * period;
        const tt = (t + phaseShift) % period;
        const halfPeriod = period / 2;
        if (tt < halfPeriod) return offset - amplitude + (4 * amplitude * tt) / period;
        return offset + 3 * amplitude - (4 * amplitude * tt) / period;
      }
      case "PULSE": {
        const T = 1 / frequency;
        const phaseS = (phase / 360) * T;
        const tMod = (t + phaseS) % T;
        return tMod < T * (dutyCycle || 0.5) ? offset + amplitude : offset;
      }
      default:
        return e.value;
    }
  }

  public async run(settings: SimulationSettings): Promise<SimulationResult[]> {
    if (settings.analysisType === "TRAN") return this.runTransient(settings);
    return this.solveDC();
  }

  private runTransient(settings: SimulationSettings): SimulationResult[] {
    const step = settings.tranStep || 0.001;
    const stop = settings.tranStop || 0.1;
    
    const vPrev = new Map<string, number>(); 
    const iLPrev = new Map<string, number>(); 
    
    const results: Record<string, { t: number; v: number }[]> = {};
    const currentResults: Record<string, { t: number; v: number }[]> = {};
    const powerResults: Record<string, { t: number; v: number }[]> = {};
    
    this.nodes.forEach(n => results[n] = []);
    this.elements.forEach(e => {
      currentResults[e.ref] = [];
      powerResults[e.ref] = [];
    });

    const vSources = this.elements.filter(e => e.type === "V");
    const lSources = this.elements.filter(e => e.type === "L");
    const n = this.nodes.length - 1;
    const size = n + vSources.length + lSources.length;
    let prevSolution = new Float64Array(size);

    for (let t = 0; t <= stop + 1e-9; t += step) {
      let solution = new Float64Array(size);
      solution.set(prevSolution);

      const MAX_ITERS = 10;
      const RELTOL = 1e-3;
      
      for (let iter = 0; iter < MAX_ITERS; iter++) {
        const matrix = Array.from({ length: size }, () => new Float64Array(size));
        const rhs = new Float64Array(size);
        const GMIN = 1e-12;
        for (let i = 0; i < n; i++) matrix[i][i] += GMIN;

        let extraIdx = 0;
        this.elements.forEach(e => {
          const n1 = this.getIdx(e.nodes[0]);
          const n2 = this.getIdx(e.nodes[1]);
          const val = this.getElementValue(e, t);
          
          if (e.type === "R") {
            this.addStamps(matrix, n1, n2, 1 / Math.max(val, 1e-12));
          } else if (e.type === "C") {
            const g = val / step;
            const v1_prev = vPrev.get(e.nodes[0]) || 0;
            const v2_prev = vPrev.get(e.nodes[1]) || 0;
            this.addStamps(matrix, n1, n2, g);
            if (n1 >= 0) rhs[n1] += g * (v1_prev - v2_prev);
            if (n2 >= 0) rhs[n2] -= g * (v1_prev - v2_prev);
          } else if (e.type === "V") {
            const iIdx = n + extraIdx;
            if (n1 >= 0) { matrix[n1][iIdx] += 1; matrix[iIdx][n1] += 1; }
            if (n2 >= 0) { matrix[n2][iIdx] -= 1; matrix[iIdx][n2] -= 1; }
            rhs[iIdx] = val;
            extraIdx++;
          } else if (e.type === "L") {
            const r = val / step;
            const iIdx = n + extraIdx;
            const i_prev = iLPrev.get(e.ref) || 0;
            if (n1 >= 0) { matrix[n1][iIdx] += 1; matrix[iIdx][n1] += 1; }
            if (n2 >= 0) { matrix[n2][iIdx] -= 1; matrix[iIdx][n2] -= 1; }
            matrix[iIdx][iIdx] -= r;
            rhs[iIdx] = -r * i_prev;
            extraIdx++;
          } else if (e.type === "I") {
            if (n1 >= 0) rhs[n1] -= val;
            if (n2 >= 0) rhs[n2] += val;
          } else if (e.type === "D") {
            const IS = 1e-14, VT = 0.02585;
            const v1 = n1 >= 0 ? solution[n1] : 0, v2 = n2 >= 0 ? solution[n2] : 0;
            const vd = Math.min(v1 - v2, 0.8);
            const expTerm = Math.exp(vd / VT);
            const id = IS * (expTerm - 1), gd = (IS / VT) * expTerm;
            this.addStamps(matrix, n1, n2, gd);
            if (n1 >= 0) rhs[n1] -= (id - gd * vd);
            if (n2 >= 0) rhs[n2] += (id - gd * vd);
          }
        });

        const nextSolution = this.gaussianElimination(matrix, rhs);
        let converged = true;
        for (let i = 0; i < size; i++) {
          if (Math.abs(nextSolution[i] - solution[i]) > RELTOL * Math.abs(nextSolution[i]) + 1e-6) {
            converged = false;
            break;
          }
        }
        solution = nextSolution;
        if (converged) break;
      }
      
      prevSolution = solution;
      this.nodes.forEach(node => {
        const idx = this.getIdx(node);
        const v = idx >= 0 ? solution[idx] : 0;
        vPrev.set(node, v);
        results[node].push({ t, v });
      });
      
      let extraIdx = 0;
      this.elements.forEach(e => {
        const v1 = vPrev.get(e.nodes[0]) || 0, v2 = vPrev.get(e.nodes[1]) || 0;
        let cur = 0;
        const val = this.getElementValue(e, t);
        if (e.type === "R") cur = (v1 - v2) / Math.max(val, 1e-12);
        else if (e.type === "V") { cur = solution[n + extraIdx]; extraIdx++; }
        else if (e.type === "L") { cur = solution[n + extraIdx]; iLPrev.set(e.ref, cur); extraIdx++; }
        else if (e.type === "C") {
          const g = val / step;
          const v1p = results[e.nodes[0]].length > 1 ? results[e.nodes[0]][results[e.nodes[0]].length-2].v : v1;
          const v2p = results[e.nodes[1]].length > 1 ? results[e.nodes[1]][results[e.nodes[1]].length-2].v : v2;
          cur = g * ((v1 - v2) - (v1p - v2p));
        } else if (e.type === "I") cur = val;
        else if (e.type === "D") {
          const IS = 1e-14, VT = 0.02585;
          const vd = Math.min(v1 - v2, 0.8);
          cur = IS * (Math.exp(vd / VT) - 1);
        }
        
        currentResults[e.ref].push({ t, v: cur });
        powerResults[e.ref].push({ t, v: (v1 - v2) * cur });
      });
    }

    const output: SimulationResult[] = [];
    this.nodes.forEach(n => output.push({ type: "voltage", node: n, values: results[n] }));
    this.elements.forEach(e => {
      output.push({ type: "current", node: e.ref, values: currentResults[e.ref] });
      output.push({ type: "power", node: e.ref, values: powerResults[e.ref] });
    });
    return output;
  }

  private solveDC(): SimulationResult[] {
    return this.runTransient({ analysisType: "TRAN", tranStep: 0.1, tranStop: 0.1 });
  }

  private addStamps(m: Float64Array[], n1: number, n2: number, val: number) {
    if (n1 >= 0) m[n1][n1] += val;
    if (n2 >= 0) m[n2][n2] += val;
    if (n1 >= 0 && n2 >= 0) { m[n1][n2] -= val; m[n2][n1] -= val; }
  }

  private getIdx(node: string) {
    if (node === "0") return -1;
    const idx = this.nodeMap.get(node);
    if (idx === undefined) return -1;
    const gndIdx = this.nodeMap.get("0")!;
    return idx > gndIdx ? idx - 1 : idx;
  }

  private gaussianElimination(A: Float64Array[], b: Float64Array): Float64Array {
    const n = b.length;
    for (let i = 0; i < n; i++) {
      let max = Math.abs(A[i][i]), maxRow = i;
      for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > max) { max = Math.abs(A[k][i]); maxRow = k; }
      if (max < 1e-24) { A[i][i] = 1e-12; continue; }
      for (let k = i; k < n; k++) { const tmp = A[maxRow][k]; A[maxRow][k] = A[i][k]; A[i][k] = tmp; }
      const tmp = b[maxRow]; b[maxRow] = b[i]; b[i] = tmp;
      for (let k = i + 1; k < n; k++) {
        const c = -A[k][i] / A[i][i];
        for (let j = i; j < n; j++) if (i === j) A[k][j] = 0; else A[k][j] += c * A[i][j];
        b[k] += c * b[i];
      }
    }
    const x = new Float64Array(n);
    for (let i = n - 1; i >= 0; i--) {
      x[i] = b[i] / (A[i][i] || 1e-12);
      for (let k = i - 1; k >= 0; k--) b[k] -= A[k][i] * x[i];
    }
    return x;
  }
}

export async function runSimulation(netlist: string, settings: SimulationSettings): Promise<SimulationResult[]> {
  const solver = new MNASolver(netlist);
  return await solver.run(settings);
}
