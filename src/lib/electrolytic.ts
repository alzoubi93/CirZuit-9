/** Pure, UI-free capacitor sizing helpers shared by PCB sync and 3D rendering. */
export const parseCapacitanceuF = (value: string): number => {
  if (!value) return 10;
  const str = String(value).trim().toUpperCase();
  const m = str.match(/([\d.]+)/);
  if (!m) return 10;
  const val = parseFloat(m[1]);
  if (!Number.isFinite(val)) return 10;
  if (str.includes("PF") || str.endsWith("P")) return val / 1_000_000;
  if (str.includes("NF") || (str.includes("N") && !str.includes("NANO"))) return val / 1000;
  if (str.includes("MF") || str.includes("MILLI")) return val * 1000;
  return val;
};

export const getElectrolyticSize = (value: string) => {
  const uF = parseCapacitanceuF(value);
  if (uF <= 1)    return { w: 4, h: 4, d: 7, pitch: 1.5, drill: 0.8, padDia: 1.5 };
  if (uF <= 10)   return { w: 5, h: 5, d: 11, pitch: 2.0, drill: 0.8, padDia: 1.6 };
  if (uF <= 100)  return { w: 6.3, h: 6.3, d: 11, pitch: 2.5, drill: 0.8, padDia: 1.6 };
  if (uF <= 220)  return { w: 8, h: 8, d: 12, pitch: 3.5, drill: 0.9, padDia: 1.8 };
  if (uF <= 1000) return { w: 10, h: 10, d: 20, pitch: 5.0, drill: 1.0, padDia: 1.9 };
  if (uF <= 2200) return { w: 12.5, h: 12.5, d: 25, pitch: 5.0, drill: 1.1, padDia: 2.2 };
  if (uF <= 4700) return { w: 16, h: 16, d: 31.5, pitch: 7.5, drill: 1.2, padDia: 2.4 };
  return { w: 18, h: 18, d: 35.5, pitch: 7.5, drill: 1.3, padDia: 2.6 };
};
