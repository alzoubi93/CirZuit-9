import type { SymbolId } from "./schematic";

const KEY = "cirzuit_favorite_symbols_v1";

export const DEFAULT_FAVORITES: SymbolId[] = [
  "gnd", "vcc", "vdd", "battery",
  "resistor", "var_resistor", "capacitor", "capacitor_polar", "inductor",
  "diode", "led", "zener",
  "npn", "pnp", "nmosfet", "pmosfet",
  "push_button", "switch", "fuse",
  "ic8", "ic14",
  "esp32_devkit", "arduino_uno",
  "voltmeter", "ammeter", "test_point",
];

export function loadFavorites(): SymbolId[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [...DEFAULT_FAVORITES];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [...DEFAULT_FAVORITES];
    return arr.filter((x): x is string => typeof x === "string");
  } catch {
    return [...DEFAULT_FAVORITES];
  }
}

export function saveFavorites(ids: SymbolId[]) {
  try { localStorage.setItem(KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}
