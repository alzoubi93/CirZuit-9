import { SchematicDoc, SchematicNode } from "./schematic";
import { NetIndex, buildNetIndex } from "./netlist";
import { 
  generateSpiceNetlist, 
  runSimulation, 
  SimulationSettings, 
  SimulationResult,
  getComponentRef 
} from "./simulation";

export interface ComponentStats {
  voltage: number;
  current: number;
  power: number;
  v0: number;
  v1: number;
}

/**
 * SimulationMiddleware bridges the schematic data with the SPICE solver.
 * It provides high-level methods to run simulations and query results
 * in terms of schematic components and nets.
 */
export class SimulationMiddleware {
  private doc: SchematicDoc;
  private netIndex: NetIndex;
  private results: SimulationResult[] = [];

  constructor(doc: SchematicDoc) {
    this.doc = doc;
    this.netIndex = buildNetIndex(doc);
  }

  /**
   * Runs the simulation with given settings.
   */
  async run(settings: SimulationSettings): Promise<SimulationResult[]> {
    try {
      const netlist = generateSpiceNetlist(this.doc);
      this.results = await runSimulation(netlist, settings);
      return this.results;
    } catch (error) {
      console.error("Simulation Middleware Error:", error);
      throw error;
    }
  }

  /**
   * Sets the current results if they were run externally.
   */
  setResults(results: SimulationResult[]) {
    this.results = results;
  }

  /**
   * Gets the raw simulation results.
   */
  getRawResults(): SimulationResult[] {
    return this.results;
  }

  /**
   * Finds the value of a specific signal at a specific time/frequency.
   */
  private findValue(values: { t: number; v: number }[], time: number): number {
    if (!values || values.length === 0) return 0;
    
    // Fast path for exact match or single point
    if (values.length === 1) return values[0].v;
    
    // Binary search for efficiency in large transient datasets
    let low = 0;
    let high = values.length - 1;
    
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (values[mid].t === time) return values[mid].v;
      if (values[mid].t < time) low = mid + 1;
      else high = mid - 1;
    }
    
    // Interpolate or return nearest previous point
    const idx = Math.max(0, low - 1);
    return values[idx]?.v ?? 0;
  }

  /**
   * Gets the voltage at a specific net ID at a given time.
   */
  getNetVoltage(netId: number, time: number): number {
    const res = this.results.find(r => r.type === "voltage" && r.node === `net_${netId}`);
    if (!res) return 0;
    return this.findValue(res.values, time);
  }

  /**
   * Gets the current flowing through a specific component at a given time.
   */
  getComponentCurrent(node: SchematicNode, time: number): number {
    const ref = getComponentRef(node);
    const res = this.results.find(r => r.type === "current" && r.node === ref);
    if (!res) return 0;
    return this.findValue(res.values, time);
  }

  /**
   * Gets comprehensive stats for a component at a given time.
   */
  getComponentStats(node: SchematicNode, time: number): ComponentStats | null {
    if (this.results.length === 0) return null;

    const current = this.getComponentCurrent(node, time);
    
    const net0 = this.netIndex.pinNet.get(`${node.id}:0`);
    const net1 = this.netIndex.pinNet.get(`${node.id}:1`);
    
    const v0 = net0 !== undefined ? this.getNetVoltage(net0, time) : 0;
    const v1 = net1 !== undefined ? this.getNetVoltage(net1, time) : 0;
    
    const voltage = v0 - v1;
    const power = Math.abs(voltage * current);
    
    return {
      voltage,
      current,
      power,
      v0,
      v1
    };
  }

  /**
   * Helper to map pin positions to current flow for visualization.
   */
  getPinCurrents(time: number): Map<string, number> {
    const pinCurrentMap = new Map<string, number>();
    
    this.doc.nodes.forEach(node => {
      const i = this.getComponentCurrent(node, time);
      
      // Pin 0 is assumed source, Pin 1 is sink for 2-pin devices in current convention
      // We'll improve this based on symbol definition if needed
      const pin0Key = this.getPinKey(node, 0);
      const pin1Key = this.getPinKey(node, 1);
      
      if (pin0Key) pinCurrentMap.set(pin0Key, (pinCurrentMap.get(pin0Key) || 0) + i);
      if (pin1Key) pinCurrentMap.set(pin1Key, (pinCurrentMap.get(pin1Key) || 0) - i);
    });
    
    return pinCurrentMap;
  }

  private getPinKey(node: SchematicNode, pinIndex: number): string | null {
    // This assumes grid alignment for keys, consistent with Canvas.tsx
    // In a real middleware, we'd import the symbol transform logic
    // For now, we'll keep it simple or delegate to NetIndex
    for (const [key, netId] of this.netIndex.pinNet.entries()) {
      if (key === `${node.id}:${pinIndex}`) {
         // We need the actual coordinates for the key
         // This logic belongs in a shared coordinate-to-net mapping service
         return null; 
      }
    }
    return null;
  }
}
