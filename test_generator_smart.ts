import { guessFootprintConfigFromSymbol, createDefaultFallbackFootprint } from "./src/lib/kicad/generator/generator";

const testCases = [
  { desc: "Resistor default 10k", symbolName: "resistor", reference: "R1", value: "10k", pinCount: 2 },
  { desc: "Resistor high power 5W", symbolName: "resistor", reference: "R2", value: "5W 100R", pinCount: 2 },
  { desc: "Capacitor 100uF", symbolName: "capacitor", reference: "C1", value: "100uF", pinCount: 2 },
  { desc: "Capacitor 10uF", symbolName: "capacitor", reference: "C2", value: "10uF", pinCount: 2 },
  { desc: "Capacitor 1000uF", symbolName: "capacitor", reference: "C3", value: "1000uF", pinCount: 2 },
  { desc: "Capacitor 100nF ceramic", symbolName: "capacitor", reference: "C4", value: "100nF", pinCount: 2 },
  { desc: "Polarized capacitor CP", symbolName: "CP", reference: "C5", value: "47uF", pinCount: 2 },
  { desc: "Diode 1N4007", symbolName: "diode", reference: "D1", value: "1N4007", pinCount: 2 },
  { desc: "Diode 1N4148", symbolName: "diode", reference: "D2", value: "1N4148", pinCount: 2 },
  { desc: "LED 5mm", symbolName: "led", reference: "D3", value: "Red", pinCount: 2 },
  { desc: "Transistor 2N2222", symbolName: "npn", reference: "Q1", value: "2N2222", pinCount: 3 },
  { desc: "Power Transistor / MOSFET", symbolName: "mosfet_n", reference: "Q2", value: "IRF540", pinCount: 3 },
  { desc: "Voltage Regulator 7805", symbolName: "regulator", reference: "U1", value: "LM7805", pinCount: 3 },
  { desc: "IC 8-pin (NE555)", symbolName: "timer_555", reference: "U2", value: "NE555", pinCount: 8 },
  { desc: "IC 14-pin (Logic Gate)", symbolName: "7400", reference: "U3", value: "74HC00", pinCount: 14 },
  { desc: "IC 16-pin (Counter)", symbolName: "ic", reference: "U4", value: "CD4017", pinCount: 16 },
  { desc: "IC 28-pin (Microcontroller ATmega328)", symbolName: "mcu", reference: "U5", value: "ATmega328P", pinCount: 28 },
  { desc: "IC 40-pin (DIP-40)", symbolName: "cpu", reference: "U6", value: "8086", pinCount: 40 },
  { desc: "Large IC 64-pin (fallback to SMD QFP)", symbolName: "mcu_large", reference: "U7", value: "STM32F4", pinCount: 64 },
];

console.log("=== RUNNING SMART THT-FIRST FOOTPRINT GENERATOR TESTS ===");
for (const tc of testCases) {
  const cfg = guessFootprintConfigFromSymbol(tc);
  const fp = createDefaultFallbackFootprint(tc);
  console.log(`[TEST] ${tc.desc}:`);
  console.log(`  -> Family: ${cfg.familyId}, Preset: ${cfg.presetId || 'none'}`);
  console.log(`  -> Mounting: ${fp.mountingType}, Model: ${fp.fullName}`);
  console.log(`  -> Pads: ${fp.pads.length}, Description: ${fp.description}`);
}
