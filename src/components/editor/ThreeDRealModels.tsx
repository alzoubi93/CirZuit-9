import React, { useMemo, useRef, Suspense, useEffect, useState } from "react";
import { useFrame, useThree, ThreeEvent } from "@react-three/fiber";
import { Text, RoundedBox, useGLTF, Instances, Instance } from "@react-three/drei";
import * as THREE from "three";
import initOpenCascade from 'occt-import-js';
// @ts-expect-error Typescript cannot find the wasm module because it is loaded by Vite
import occtWasmUrl from 'occt-import-js/dist/occt-import-js.wasm?url';
import { checkIfPolarizedCapacitor } from "@/lib/pcb";

export const MASK_COLORS: Record<string, { top: string; bottom: string; name: string }> = {
  green:     { top: "#0a5c36", bottom: "#083d24", name: "Green" },
  black:     { top: "#0a0a0a", bottom: "#050505", name: "Black" },
  blue:      { top: "#0a2a6b", bottom: "#061a45", name: "Blue" },
  red:       { top: "#6b0a0a", bottom: "#450606", name: "Red" },
  purple:    { top: "#3a0a5c", bottom: "#26063d", name: "Purple" },
  white:     { top: "#e8e8e8", bottom: "#c8c8c8", name: "White" },
  yellow:    { top: "#c9a227", bottom: "#8a6f1b", name: "Yellow" },
  matteBlack:{ top: "#1a1a1a", bottom: "#0a0a0a", name: "Matte" },
};

export const COPPER_COLOR = "#b87333";
export const COPPER_METAL = { metalness: 0.95, roughness: 0.32, color: COPPER_COLOR };
export const SILVER_METAL = { metalness: 1, roughness: 0.12, color: "#dcdcdc" };
export const GOLD_METAL   = { metalness: 1, roughness: 0.18, color: "#d4af37" };
export const SOLDER_METAL = { metalness: 0.85, roughness: 0.45, color: "#c0c0c0" };

export const SolderMaterial = () => {
  const { solderColor } = React.useContext(BoardConfigContext);
  return <meshStandardMaterial metalness={0.85} roughness={0.45} color={solderColor || "#c0c0c0"} />;
};

export const TrackMaterial = () => {
  const { trackColor } = React.useContext(BoardConfigContext);
  return <meshStandardMaterial metalness={0.95} roughness={0.32} color={trackColor || COPPER_COLOR} />;
};

export const BottomSolderMesh = ({ position, rotation, children }: any) => {
  const { showBottomSolder } = React.useContext(BoardConfigContext);
  if (!showBottomSolder) return null;
  return <mesh position={position} rotation={rotation}>{children}</mesh>;
};

export const BoardConfigContext = React.createContext({
  showBottomSolder: true,
  solderColor: "#c0c0c0",
  trackColor: COPPER_COLOR,
  elevation: 0,
});


// ============================================================
// 📏 REAL-WORLD PACKAGE DIMENSION DATABASE (JEDEC / EIA / IPC standards, in mm)
// ============================================================
export const PACKAGE_SIZES: Record<string, { w: number; h: number; d: number; pins?: number; kind: "smd" | "dip" }> = {
  "0201": { w: 0.6,  h: 0.3,  d: 0.3,  kind: "smd" },
  "0402": { w: 1.0,  h: 0.5,  d: 0.5,  kind: "smd" },
  "0603": { w: 1.6,  h: 0.8,  d: 0.45, kind: "smd" },
  "0805": { w: 2.0,  h: 1.25, d: 0.5,  kind: "smd" },
  "1206": { w: 3.2,  h: 1.6,  d: 0.55, kind: "smd" },
  "1210": { w: 3.2,  h: 2.5,  d: 0.55, kind: "smd" },
  "1812": { w: 4.5,  h: 3.2,  d: 0.6,  kind: "smd" },
  "2220": { w: 5.7,  h: 5.0,  d: 0.6,  kind: "smd" },
  "soic8":  { w: 4.9,  h: 3.9, d: 1.75, pins: 8,  kind: "smd" },
  "soic14": { w: 8.65, h: 3.9, d: 1.75, pins: 14, kind: "smd" },
  "soic16": { w: 9.9,  h: 3.9, d: 1.75, pins: 16, kind: "smd" },
  "sot23":  { w: 2.9,  h: 1.3, d: 1.1, pins: 3, kind: "smd" },
  "sot223": { w: 6.5,  h: 3.5, d: 1.6, pins: 4, kind: "smd" },
  "sot89":  { w: 4.5,  h: 2.5, d: 1.5, pins: 3, kind: "smd" },
  "to92":   { w: 5.2,  h: 5.2, d: 4.5,  pins: 3, kind: "dip" },
  "to220":  { w: 10.16, h: 4.4, d: 15.0, pins: 3, kind: "dip" },
  "hc49":   { w: 11.4, h: 4.65, d: 3.2, kind: "dip" },
  "hc49smd":{ w: 11.4, h: 4.65, d: 3.2, kind: "smd" },
  "do41":   { w: 5.2, h: 2.7, d: 2.7, kind: "dip" },
  "do35":   { w: 3.5, h: 1.6, d: 1.6, kind: "dip" },
  "sod123": { w: 2.7, h: 1.6, d: 1.1, kind: "smd" },
  "sma_diode": { w: 4.3, h: 2.65, d: 2.1, kind: "smd" },
};

const parseFirstNumber = (raw: string): number | null => {
  const m = (raw || "").match(/[\d.]+/);
  return m ? parseFloat(m[0]) : null;
};

const getDIPSize = (pins: number) => {
  const rows = Math.max(Math.floor(pins / 2), 2);
  const length = (rows - 1) * 2.54 + 2.0; // standard JEDEC DIP length
  const rowSpacing = pins <= 20 ? 7.62 : 15.24;
  return { w: rowSpacing, h: length, d: 3.3 };
};

const getSOICSize = (pins: number) => {
  const rows = Math.max(Math.floor(pins / 2), 2);
  const length = (rows - 1) * 1.27 + 1.2; // standard JEDEC SOIC length
  return { w: 5.90, h: length, d: 1.75 };
};

const getTSSOPSize = (pins: number) => {
  const rows = Math.max(Math.floor(pins / 2), 2);
  const length = (rows - 1) * 0.65 + 1.0; // standard JEDEC TSSOP length
  return { w: 5.70, h: length, d: 1.1 };
};

export const parseCapacitanceuF = (value: string): number => {
  if (!value) return 10;
  const str = value.toString().trim().toUpperCase();
  const m = str.match(/([\d.]+)/);
  if (!m) return 10;
  const val = parseFloat(m[1]);
  if (isNaN(val)) return 10;

  if (str.includes("PF") || str.endsWith("P")) return val / 1000000;
  if (str.includes("NF") || (str.includes("N") && !str.includes("NANO"))) return val / 1000;
  if (str.includes("MF") || str.includes("MILLI")) return val * 1000;
  return val;
};

export const getElectrolyticSize = (value: string) => {
  const uF = parseCapacitanceuF(value);
  // IPC-7351 Compliant Lookup based on uF -> Diameter -> (Pitch, Drill, PadDia)
  // Mapping typical uF ratings at 25V to standard can diameters
  if (uF <= 1)    return { w: 4,   h: 4,   d: 7,   pitch: 1.5, drill: 0.8, padDia: 1.5 };
  if (uF <= 10)   return { w: 5,   h: 5,   d: 11,  pitch: 2.0, drill: 0.8, padDia: 1.6 };
  if (uF <= 100)  return { w: 6.3, h: 6.3, d: 11,  pitch: 2.5, drill: 0.8, padDia: 1.6 };
  if (uF <= 220)  return { w: 8,   h: 8,   d: 12,  pitch: 3.5, drill: 0.9, padDia: 1.8 };
  if (uF <= 1000) return { w: 10,  h: 10,  d: 20,  pitch: 5.0, drill: 1.0, padDia: 1.9 };
  if (uF <= 2200) return { w: 12.5,h: 12.5,d: 25,  pitch: 5.0, drill: 1.1, padDia: 2.2 };
  if (uF <= 4700) return { w: 16,  h: 16,  d: 31.5,pitch: 7.5, drill: 1.2, padDia: 2.4 };
  return { w: 18, h: 18, d: 35.5, pitch: 7.5, drill: 1.3, padDia: 2.6 };
};

const matchRealPackage = (text: string) => {
  const t = text.replace(/[\s_-]/g, "");
  const keys = Object.keys(PACKAGE_SIZES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (t.includes(k)) return PACKAGE_SIZES[k];
  }
  const dip = t.match(/dip(\d+)/);
  if (dip) return { ...getDIPSize(parseInt(dip[1], 10)), kind: "dip" as const };
  const soic = t.match(/soic(\d+)/);
  if (soic) return { ...getSOICSize(parseInt(soic[1], 10)), kind: "smd" as const };
  const tssop = t.match(/tssop(\d+)/);
  if (tssop) return { ...getTSSOPSize(parseInt(tssop[1], 10)), kind: "smd" as const };
  return null;
};

// ============================================================
// 🧭 ORIENTATION ENGINE
// ============================================================
const derivePadAxisAngle = (fp: any): number | null => {
  if (!fp.pads || fp.pads.length < 2) return null;
  const p0 = fp.pads[0];
  const p1 = fp.pads[fp.pads.length - 1];
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return null;
  return Math.atan2(dy, dx);
};

export const resolveRotation = (fp: any): number => {
  if (typeof fp.rotation === "number") {
    const deg = Math.round(((fp.rotation % 360) + 360) % 360);
    return (deg * Math.PI) / 180;
  }
  const derived = derivePadAxisAngle(fp);
  return derived ?? 0;
};

export const isVerticalPlacement = (rotZ: number): boolean => {
  const deg = Math.round(((rotZ * 180) / Math.PI) % 180);
  const norm = deg < 0 ? deg + 180 : deg;
  return norm > 45 && norm < 135;
};

// ============================================================
// 📐 INDIVIDUAL COMPONENT MEASUREMENTS & ORIENTATION ENGINE
// ============================================================
export interface ComponentHole {
  x: number;
  y: number;
  relativeX: number;
  relativeY: number;
  diameter: number;
  isDrilled?: boolean;
}

export interface ComponentMeasurements {
  reference: string;
  x: number;
  y: number;
  length: number; // physical length along X at 0° (mm)
  width: number;  // physical width along Y at 0° (mm)
  holes: ComponentHole[]; // hole positions and diameters for through-hole components
  rotationAngle: number; // degrees
  rotationRad: number;   // radians
  placementDirection: "0° (Normal)" | "90° (Rotated CW)" | "180° (Inverted)" | "270° (Rotated CCW)";
  packageType: "DIP" | "SMD"; // package type detection: DIP (through-hole) vs SMD (surface-mount)
  orientation: "Horizontal" | "Vertical"; // horizontal placement vs vertical placement
}

export const extractComponentMeasurements = (fp: any, boardHeight: number = 80): ComponentMeasurements => {
  const sym = (fp.symbol || "").toLowerCase();
  const val = (fp.value || "").toString().toUpperCase();
  const ref = (fp.reference || "").toString().toUpperCase();
  const fpName = (fp.footprint || fp.name || "").toLowerCase();
  const text = `${sym} ${val} ${ref} ${fpName}`.toLowerCase();

  const rawRot = typeof fp.rotation === "number" ? fp.rotation : 0;
  const normalizedRot = Math.round(((rawRot % 360) + 360) % 360);
  
  // Three.js Z-axis rotation is counter-clockwise (Y-up), SVG is clockwise (Y-down).
  // With Y inverted (mirrored), we negate the rotation angle.
  const rotationAngle3D = (360 - normalizedRot) % 360;
  const rotationRad = (rotationAngle3D * Math.PI) / 180;

  let placementDirection: "0° (Normal)" | "90° (Rotated CW)" | "180° (Inverted)" | "270° (Rotated CCW)" = "0° (Normal)";
  if (normalizedRot > 45 && normalizedRot <= 135) placementDirection = "90° (Rotated CW)";
  else if (normalizedRot > 135 && normalizedRot <= 225) placementDirection = "180° (Inverted)";
  else if (normalizedRot > 225 && normalizedRot <= 315) placementDirection = "270° (Rotated CCW)";

  const isVert = (normalizedRot > 45 && normalizedRot < 135) || (normalizedRot > 225 && normalizedRot < 315);
  const orientation: "Horizontal" | "Vertical" = isVert ? "Vertical" : "Horizontal";

  const hasDrillPad = Array.isArray(fp.pads) && fp.pads.some((p: any) =>
    Number(p.drill || p.hole || 0) > 0 || p.layer === "multi" || p.layer === "through_hole" || p.shape === "circle"
  );
  const isSMDText = /(0201|0402|0603|0805|1206|1210|1812|soic|sot|sop|tqfp|lqfp|qfn|bga|smd|tant)/i.test(text);
  const realPkg = matchRealPackage(text);
  const isSMD = isSMDText || realPkg?.kind === "smd" || (!hasDrillPad && Array.isArray(fp.pads) && fp.pads.length > 0 && fp.pads.every((p: any) => p.layer === "top_copper" || p.layer === "bottom_copper" || !p.drill));
  const packageType: "DIP" | "SMD" = isSMD ? "SMD" : "DIP";

  // For 2D math (SVG Y-down)
  const cos2D = Math.cos((normalizedRot * Math.PI) / 180);
  const sin2D = Math.sin((normalizedRot * Math.PI) / 180);

  let localCenterX = 0;
  let localCenterY = 0;
  if (Array.isArray(fp.pads) && fp.pads.length > 0) {
    const padXs = fp.pads.filter((p: any) => !!p).map((p: any) => Number(p.x || 0));
    const padYs = fp.pads.filter((p: any) => !!p).map((p: any) => Number(p.y || 0));
    localCenterX = (Math.min(...padXs) + Math.max(...padXs)) / 2;
    localCenterY = (Math.min(...padYs) + Math.max(...padYs)) / 2;
  }

  // Calculate world center in 2D (Y-down) first, then map Y to 3D (Y-up)
  const worldCenterX = (fp.x || 0) + (localCenterX * cos2D - localCenterY * sin2D);
  const worldCenterY2D = (fp.y || 0) + (localCenterX * sin2D + localCenterY * cos2D);
  const worldCenterY3D = boardHeight - worldCenterY2D;

  const holes: ComponentHole[] = [];

  if (Array.isArray(fp.pads)) {
    fp.pads.forEach((pad: any) => {
      if (!pad) return;
      const padX = Number(pad.x || 0);
      const padY = Number(pad.y || 0);
      const absX = (fp.x || 0) + (padX * cos2D - padY * sin2D);
      const absY2D = (fp.y || 0) + (padX * sin2D + padY * cos2D);
      const absY3D = boardHeight - absY2D;
      const diameter = Number(pad.drill || pad.hole || (pad.width ? pad.width * 0.6 : 0.8));
      holes.push({
        x: Number(absX.toFixed(3)),
        y: Number(absY3D.toFixed(3)),
        relativeX: Number((padX - localCenterX).toFixed(3)),
        relativeY: Number(-(padY - localCenterY).toFixed(3)), // Inverted local Y for 3D Y-up
        diameter: Number(diameter.toFixed(3)),
        isDrilled: Number(pad.drill || pad.hole || 0) > 0 || !isSMD,
      });
    });
  }

  let length = Number(fp.length || fp.w || fp.width || 0);
  let width = Number(fp.width || fp.h || fp.height || 0);
  if (length <= 0 || width <= 0) {
    if (realPkg) {
      length = realPkg.w;
      width = realPkg.h;
    } else if (Array.isArray(fp.pads) && fp.pads.length > 0) {
      const padXs = fp.pads.map((p: any) => Number(p.x || 0));
      const padYs = fp.pads.map((p: any) => Number(p.y || 0));
      const spanX = Math.abs(Math.max(...padXs) - Math.min(...padXs));
      const spanY = Math.abs(Math.max(...padYs) - Math.min(...padYs));
      length = Math.max(spanX + (packageType === "SMD" ? 0.8 : 2.0), 1.6);
      width = Math.max(spanY + (packageType === "SMD" ? 0.6 : 2.0), 0.8);
    } else {
      length = 4.0;
      width = 2.5;
    }
  }

  return {
    reference: ref || "?",
    x: Number(worldCenterX.toFixed(3)),
    y: Number(worldCenterY3D.toFixed(3)),
    length: Number(length.toFixed(2)),
    width: Number(width.toFixed(2)),
    holes,
    rotationAngle: normalizedRot,
    rotationRad,
    placementDirection,
    packageType,
    orientation,
  };
};

// ============================================================
// 🎨 REAL RESISTOR COLOR-CODE ENGINE (4-band, EIA standard)
// ============================================================
const RESISTOR_BAND_COLORS: Record<number, string> = {
  0: "#1a1a1a", 1: "#6b3410", 2: "#d32f2f", 3: "#f57c00", 4: "#fbc02d",
  5: "#2e7d32", 6: "#1565c0", 7: "#7b1fa2", 8: "#757575", 9: "#f5f5f0",
};

const parseResistanceOhms = (raw: string): number | null => {
  if (!raw) return null;
  const s = raw.trim().toUpperCase().replace(/OHMS?|Ω|\s/g, "");
  const m = s.match(/^([\d]*)[.,]?([\d]*)\s*([RKM])?([\d]*)$/);
  if (!m) {
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }
  const [, intA, fracA, mult, intB] = m;
  let numStr = "";
  if (mult) numStr = (intA || "0") + (intB ? "." + intB : "");
  else numStr = (intA || "0") + (fracA ? "." + fracA : "");
  let n = parseFloat(numStr);
  if (isNaN(n)) return null;
  if (mult === "K") n *= 1e3;
  else if (mult === "M") n *= 1e6;
  return n;
};

export const getResistorBandColors = (value: string): string[] => {
  const ohms = parseResistanceOhms(value);
  if (ohms === null || ohms <= 0) {
    return [RESISTOR_BAND_COLORS[1], RESISTOR_BAND_COLORS[0], RESISTOR_BAND_COLORS[3], "#d4af37"];
  }
  let n = ohms, exp = 0;
  while (n >= 100) { n /= 10; exp++; }
  while (n < 10) { n *= 10; exp--; }
  const d1 = Math.floor(n / 10) % 10;
  const d2 = Math.round(n) % 10;
  const multIndex = Math.max(0, Math.min(9, exp));
  return [
    RESISTOR_BAND_COLORS[d1] ?? RESISTOR_BAND_COLORS[0],
    RESISTOR_BAND_COLORS[d2] ?? RESISTOR_BAND_COLORS[0],
    RESISTOR_BAND_COLORS[multIndex] ?? RESISTOR_BAND_COLORS[0],
    "#d4af37",
  ];
};

export const getSMDResistorCode = (value: string): string => {
  const ohms = parseResistanceOhms(value);
  if (ohms === null || ohms <= 0) return "";
  let n = ohms, exp = 0;
  while (n >= 100) { n /= 10; exp++; }
  while (n < 10) { n *= 10; exp--; }
  const d1 = Math.floor(n / 10) % 10;
  const d2 = Math.round(n) % 10;
  return `${d1}${d2}${Math.max(0, exp)}`;
};

const GLB_BASE_URL = "/models/3d/";
export const FOOTPRINT_MODEL_MAP: Record<string, { glb: string }> = {};

export type ComponentType =
  | "resistor" | "resistor_smd" | "capacitor_electrolytic" | "capacitor_ceramic"
  | "capacitor_smd" | "capacitor_tantalum_smd" | "inductor" | "led" | "led_smd" | "diode" | "zener"
  | "transistor_to92" | "transistor_to220" | "ic_dip" | "ic_soic" | "ic_qfp" | "ic_qfn"
  | "esp32" | "esp8266" | "nodemcu" | "arduino_nano" | "arduino_uno" | "arduino_mini" | "raspberry_pico" | "stm32_bluepill"
  | "button" | "switch" | "potentiometer" | "trimmer" | "oled_display" | "lcd_display"
  | "seven_segment" | "header_pin" | "screw_terminal" | "usb_c" | "usb_micro" | "usb_a"
  | "crystal" | "buzzer" | "relay" | "fuse" | "battery_holder" | "sensor_dht"
  | "sensor_hcsr04" | "sensor_pir" | "sensor_mpu" | "servo_motor" | "stepper_driver"
  | "sd_card" | "rgb_led" | "wifi_module" | "bluetooth_module" | "mosfet"
  | "toggle_switch" | "test_point" | "generic";

export interface DetectedModel {
  type: ComponentType; w: number; h: number; d: number;
  color: string; hasGLB: boolean; meta: Record<string, any>;
  packageName: string; mount: "SMD" | "DIP/THT";
  measurements: ComponentMeasurements;
}

export const detectComponent = (fp: any): DetectedModel => {
  const measurements = extractComponentMeasurements(fp);
  const sym = (fp.symbol || "").toLowerCase();
  const val = (fp.value || "").toString().toUpperCase();
  const ref = (fp.reference || "").toString().toUpperCase();
  const fpName = (fp.footprint || fp.name || "").toLowerCase();
  const text = `${sym} ${val} ${ref} ${fpName}`.toLowerCase();
  const padsX = (fp.pads && fp.pads.length > 0) ? fp.pads.map((p: any) => p.x || 0) : [0];
  const padsY = (fp.pads && fp.pads.length > 0) ? fp.pads.map((p: any) => p.y || 0) : [0];
  const fpW = Math.abs(Math.max(...padsX) - Math.min(...padsX)) || 4;
  const fpH = Math.abs(Math.max(...padsY) - Math.min(...padsY)) || 4;
  const pinCount = fp.pads?.length || 2;
  const isSMD = /(0402|0603|0805|1206|soic|sot|sop|tqfp|lqfp|qfn|bga|smd)/i.test(text);
  const realPkg = matchRealPackage(text);
  const mk = (t: ComponentType, w: number, h: number, d: number, c: string, meta: any = {}, pkgName?: string) => {
    const isFixed = ["esp32", "esp8266", "arduino_nano", "arduino_uno", "arduino_mini", "raspberry_pico", "sensor_dht", "sensor_hcsr04", "sensor_pir", "sensor_mpu", "oled_display", "lcd_display", "seven_segment", "servo_motor", "stepper_driver", "ic_dip", "ic_soic", "ic_qfp", "ic_qfn", "transistor_to92", "transistor_to220", "transistor_smd", "mosfet", "mosfet_smd", "voltage_regulator"].includes(t);
    return {
      type: t,
      w: isFixed ? w : (measurements.length || w),
      h: isFixed ? h : (measurements.width || h),
      d,
      color: c,
      hasGLB: !!FOOTPRINT_MODEL_MAP[t],
      meta,
      packageName: pkgName || (realPkg ? "" : ""),
      mount: (measurements.packageType === "SMD") ? "SMD" as const : "DIP/THT" as const,
      measurements,
    };
  };

  if (text.includes("esp32") || text.includes("wroom") || text.includes("devkit")) return mk("esp32", 54.61, 27.94, 3.5, "#0a0a0a", { pins: 38 }, "WROOM-32");
  if (text.includes("esp8266") || text.includes("nodemcu") || text.includes("esp-12") || text.includes("esp12")) return mk("esp8266", 48.0, 25.4, 3.2, "#1a1a1a", { pins: 30 });
  if (text.includes("stm32") || text.includes("bluepill")) return mk("stm32_bluepill", 53.3, 22.9, 3.5, "#1a1a1a", { pins: 40 });
  if (text.includes("arduino") && text.includes("nano")) return mk("arduino_nano", 43.18, 17.78, 3.2, "#0d47a1");
  if (text.includes("arduino") && text.includes("mini")) return mk("arduino_mini", 33.02, 17.78, 3.2, "#0c3d82");
  if (text.includes("arduino") && (text.includes("uno") || text.includes("mega"))) return mk("arduino_uno", 68.6, 53.34, 4, "#00979d");
  if (text.includes("pico") || text.includes("rp2040")) return mk("raspberry_pico", 51.0, 21.0, 3.8, "#0a5c36");
  if (text.includes("servo") || text.includes("sg90")) return mk("servo_motor", 22.8, 12.4, 22, "#1a1a1a");
  if (text.includes("a4988") || text.includes("drv8825")) return mk("stepper_driver", 15, 20, 10, "#0a5c1a");
  if (text.includes("dht11") || text.includes("dht22")) return mk("sensor_dht", 15.5, 12, 5.5, "#f5f5f5");
  if (text.includes("hcsr04") || text.includes("ultrasonic")) return mk("sensor_hcsr04", 45, 20, 15, "#0d47a1");
  if (text.includes("pir")) return mk("sensor_pir", 32, 24, 25, "#e6b800");
  if (text.includes("mpu6050") || text.includes("mpu9250")) return mk("sensor_mpu", 20, 15, 2, "#1a237e");
  if (text.includes("oled") || text.includes("ssd1306")) return mk("oled_display", 27, 27, 4, "#000");
  if (text.includes("lcd") && text.includes("16")) return mk("lcd_display", 80, 36, 12, "#1e88e5");
  if (text.includes("seg")) return mk("seven_segment", 18, 25, 8, "#c00");
  if (text.includes("usb") && text.includes("c")) return mk("usb_c", 9, 8.5, 3.2, "#c0c0c0");
  
  if (sym.startsWith("conn_screw") || text.includes("screw_terminal") || (text.includes("terminal") && (text.includes("block") || text.includes("screw") || text.includes("kf") || text.includes("dg"))) || fp.metadata?.type === "SCREW_TERMINAL") {
    const meta = fp.metadata || {};
    const poles = meta.poles || pinCount || 2;
    const pitch = meta.pitch || 5.08;
    const color = meta.color || "#00A859";
    const wireEntry = meta.wireEntry || "Side Entry (90° Horizontal)";
    return mk("screw_terminal", poles * pitch, 8.5, 10.0, color, { poles, pitch, color, wireEntry, pinLabels: meta.pinLabels }, "SCREW_TERMINAL");
  }

  if (sym.startsWith("conn_")) {
    const parts = sym.split("_");
    const gender = parts[1];
    const r_p = parts[2].split("x");
    const rows = parseInt(r_p[0], 10) || 1;
    const cols = parseInt(r_p[1], 10) || pinCount;
    const pitch = parseFloat(parts[3]) || 2.54;
    return mk("header_pin", cols * pitch, rows * pitch, 8.5, "#111", { pins: pinCount, rows, cols, pitch, gender });
  }

  if (text.includes("header") || text.includes("pinhdr") || ref.startsWith("J")) return mk("header_pin", Math.max(fpW, 2.54 * pinCount), 2.54, 8.5, "#111", { pins: pinCount });
  if (text.includes("crystal") || text.includes("xtal") || ref.startsWith("Y")) {
    const p = realPkg || PACKAGE_SIZES["hc49"];
    return mk("crystal", p.w, p.h, p.d, "#c0c0c0", {}, "HC-49");
  }
  if (text.includes("buzzer")) return mk("buzzer", 12, 12, 8, "#111");
  if (text.includes("relay")) return mk("relay", 19, 15, 15, "#2196f3");
  if (text.includes("testpoint") || text.includes("test_point") || text.includes("test-point") || ref.startsWith("TP") || text.includes("tp_") || text.includes("test point")) {
    return mk("test_point", 3.5, 3.5, 6, "#e53935");
  }
  if (text.includes("batt") || text.includes("battery") || text.includes("coin") || text.includes("cr2032") || text.includes("cell") || ref.startsWith("BT") || ref.startsWith("BAT")) {
    if (text.includes("2032") || text.includes("coin") || text.includes("cell")) {
      return mk("battery_holder", 20, 20, 5, "#1a1a1a", { kind: "coin" });
    }
    if (text.includes("9v") || text.includes("6f22")) {
      return mk("battery_holder", 26.5, 17.5, 48.5, "#1a1a1a", { kind: "9v" });
    }
    return mk("battery_holder", 58, 16, 14, "#1a1a1a", { kind: "aa" });
  }
  if (text.includes("button") || text.includes("tact") || text.includes("push_button") || text.includes("pushbutton") || text.includes("sw_push") || text.includes("switch") || ref.startsWith("SW")) {
    if (text.includes("toggle")) return mk("toggle_switch", 13, 6.5, 10, "#c0c0c0");
    if (text.includes("slide")) return mk("slide_switch", 11.5, 4, 4, "#c0c0c0");
    if (text.includes("dip") && text.includes("sw")) return mk("dip_switch", Math.max(fpW, 2.54 * pinCount), 8, 4.5, "#e53935");
    return mk("button", 6.5, 6.5, 4.2, "#111");
  }
  if (text.includes("mosfet") || text.includes("irf") || text.includes("fqp") || text.includes("2n7002") || text.includes("bss138")) {
    if (isSMD) {
      const p = realPkg || PACKAGE_SIZES["sot23"];
      return mk("mosfet_smd", p.w, p.h, p.d, "#111", {}, "SOT-23");
    }
    const p = PACKAGE_SIZES["to220"];
    return mk("mosfet", p.w, p.h, p.d, "#111", {}, "TO-220");
  }
  if (text.includes("meter") || text.includes("volt") || text.includes("amp") || text.includes("measur") || text.includes("dvm") || text.includes("panel")) {
    return mk("panel_meter", Math.max(fpW, 30), Math.max(fpH, 15), 12, "#111");
  }
  if (text.includes("toggle")) return mk("toggle_switch", 13, 6.5, 10, "#c0c0c0");
  if (text.includes("pot") || text.includes("trim") || text.includes("trimmer") || text.includes("3296") || ref.startsWith("RV") || ref.startsWith("VR")) {
    const isTrim = text.includes("trim") || text.includes("trimmer") || text.includes("3296") || fpW < 12;
    if (isTrim) {
      return mk("trimmer", 10, 10, 5, "#0055ff", {}, "3296W Trimpot");
    }
    return mk("potentiometer", 15, 15, 10, "#1e40af");
  }
  if (ref.startsWith("Q") || text.includes("transistor")) {
    if (text.includes("to220")) { const p = PACKAGE_SIZES["to220"]; return mk("transistor_to220", p.w, p.h, p.d, "#111", {}, "TO-220"); }
    if (isSMD) {
      const p = realPkg || PACKAGE_SIZES["sot23"];
      return mk("transistor_smd", p.w, p.h, p.d, "#111", {}, "SOT-23");
    }
    const p = PACKAGE_SIZES["to92"];
    return mk("transistor_to92", p.w, p.h, p.d, "#111", {}, "TO-92");
  }
  if (ref.startsWith("LED") || (ref.startsWith("D") && val.includes("LED")) || text.includes("led")) {
    const color =
      val.includes("RED")   ? "#ff2020" : val.includes("GREEN") ? "#20ff20" :
      val.includes("BLUE")  ? "#2060ff" : val.includes("YELLOW")? "#ffdd20" :
      val.includes("WHITE") ? "#ffffff" : val.includes("RGB")   ? "#ff20ff" : "#ff6600";
    if (isSMD) {
      const p = realPkg || PACKAGE_SIZES["0603"];
      return mk("led_smd", p.w, p.h, p.d, color, {}, "0603 LED");
    }
    if (val.includes("RGB")) return mk("rgb_led", 5, 5, 5.5, color, {}, "5mm RGB");
    return mk("led", 5, 5, 8.5, color, {}, "5mm THT");
  }

  if (text.includes("zener") || ref.startsWith("ZD") || ref.startsWith("DZ") || sym.includes("zener")) {
    if (isSMD) { const p = realPkg || PACKAGE_SIZES["sod123"]; return mk("zener", p.w, p.h, p.d, "#ff7f50", {}, "SOD-123 Zener"); }
    const p = PACKAGE_SIZES["do35"] || { w: 3.8, h: 1.8, d: 1.8 };
    return mk("zener", p.w, p.h, p.d, "#ff7f50", {}, "DO-35 Zener");
  }

  if (ref.startsWith("D") || text.includes("diode")) {
    if (isSMD) { const p = realPkg || PACKAGE_SIZES["sod123"]; return mk("diode", p.w, p.h, p.d, "#1a1a1a", {}, "SOD-123"); }
    const isSignal = text.includes("4148") || text.includes("signal");
    const p = isSignal ? PACKAGE_SIZES["do35"] : PACKAGE_SIZES["do41"];
    return mk("diode", p.w, p.h, p.d, "#1a1a1a", {}, isSignal ? "DO-35" : "DO-41");
  }
  if (ref.startsWith("R")) {
    if (isSMD) {
      const p = realPkg || PACKAGE_SIZES["0603"];
      const pkgName = Object.keys(PACKAGE_SIZES).find((k) => PACKAGE_SIZES[k] === p) || "0603";
      return mk("resistor_smd", p.w, p.h, p.d, "#1a1a1a", {}, pkgName.toUpperCase());
    }
    return mk("resistor", 6.3, 2.3, 2.3, "#c9a67a", {}, "1/4W Axial");
  }
  if (ref.startsWith("C") || text.includes("capacitor") || text.includes("cpol") || text.includes("cap_")) {
    const isPolarized = checkIfPolarizedCapacitor(fp);
    if (isPolarized) {
      if (isSMD) {
        const p = realPkg || PACKAGE_SIZES["1206"]; 
        return mk("capacitor_tantalum_smd", 3.2, 2.6, 2.8, "#f4a825", {}, "Tantalum-B");
      } else {
        const p = getElectrolyticSize(val);
        return mk("capacitor_electrolytic", p.w, p.h, p.d, "#0d1b2a", {}, `⌀${p.w}mm Radial`);
      }
    } else {
      if (isSMD) {
        const p = realPkg || PACKAGE_SIZES["0603"];
        const pkgName = Object.keys(PACKAGE_SIZES).find((k) => PACKAGE_SIZES[k] === p) || "0603";
        return mk("capacitor_smd", p.w, p.h, p.d, "#c69663", {}, pkgName.toUpperCase());
      } else {
        return mk("capacitor_ceramic", 5, 5, 2, "#d2691e", {}, "5mm Disc");
      }
    }
  }
  if (ref.startsWith("L") || text.includes("inductor") || text.includes("coil") || text.includes("choke") || text.includes("toroid")) {
    if (text.includes("toroid") || text.includes("ring") || text.includes("t12") || text.includes("t18") || text.includes("t20") || fpW > 10) {
      return mk("inductor", 16, 16, 8, "#222", { style: "toroid" });
    }
    if (isSMD || text.includes("cd54") || text.includes("1040") || text.includes("1265") || text.includes("power")) {
      const p = realPkg || PACKAGE_SIZES["1206"];
      return mk("inductor", p.w, p.h, p.d || 3.5, "#222", { style: "smd_choke" });
    }
    return mk("inductor", 6.8, 2.8, 2.8, "#26a69a", { style: "axial" }, "Axial Inductor");
  }
  if (ref.startsWith("F") || text.includes("fuse")) {
    if (isSMD) {
      const p = realPkg || PACKAGE_SIZES["1206"];
      return mk("fuse", p.w, p.h, p.d, "#a0a0a0", {}, "SMD Fuse");
    }
    return mk("fuse", 10, 3, 3, "#e6e6e6", {}, "Glass Fuse");
  }

  if (ref.startsWith("U") || ref.startsWith("IC")) {
    if (text.includes("qfp") || text.includes("lqfp")) {
      const sw = Math.max(fpW + 1, 8), sh = Math.max(fpH + 1, 6);
      return mk("ic_qfp", sw, sh, 1.4, "#0a0a0a", { pins: pinCount }, `QFP-${pinCount}`);
    }
    if (text.includes("qfn")) {
      const sw = Math.max(fpW + 1, 8), sh = Math.max(fpH + 1, 6);
      return mk("ic_qfn", sw, sh, 0.9, "#0a0a0a", { pins: pinCount }, `QFN-${pinCount}`);
    }
    if (text.includes("tssop")) {
      const p = realPkg?.pins ? realPkg : getTSSOPSize(pinCount);
      return mk("ic_soic", p.w, p.h, p.d, "#0a0a0a", { pins: pinCount }, `TSSOP-${pinCount}`);
    }
    if (text.includes("soic") || isSMD) {
      const p = realPkg?.pins ? realPkg : getSOICSize(pinCount);
      return mk("ic_soic", p.w, p.h, p.d, "#0a0a0a", { pins: pinCount }, `SOIC-${pinCount}`);
    }
    const p = realPkg?.pins ? realPkg : getDIPSize(pinCount);
    return mk("ic_dip", p.w, p.h, p.d, "#0a0a0a", { pins: pinCount }, `DIP-${pinCount}`);
  }
  return mk("generic", Math.max(fpW + 0.5, 4), Math.max(fpH + 0.5, 4), 1.5, "#334155");
};

export const FrustumCulled = ({ children }: any) => {
  return <>{children}</>;
};

export const SilkScreenLayer = ({ fp, boardThickness, boardHeight = 80 }: any) => {
  const meas = extractComponentMeasurements(fp, boardHeight);
  const model = detectComponent(fp);
  const w = meas.length || 5;
  const h = meas.width || 5;
  const lineThickness = 0.15;
  const color = "#f5f5f5";
  const zPos = boardThickness / 2 + 0.10;

  if (model.type === "transistor_to92") {
    return (
      <group position={[meas.x, meas.y, zPos]} rotation={[0, 0, meas.rotationRad]}>
        <mesh position={[0, -1.9, 0]}>
          <boxGeometry args={[4.5, lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[-2.25, -1.125, 0]}>
          <boxGeometry args={[lineThickness, 1.55 + lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[2.25, -1.125, 0]}>
          <boxGeometry args={[lineThickness, 1.55 + lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[0, -0.35, 0]} rotation={[0, 0, 0]}>
           <torusGeometry args={[2.25, lineThickness/2, 2, 32, Math.PI]} />
           <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <Text position={[0, 0.5, 0.08]}
          fontSize={1.2} color="#ffffff" anchorX="center" anchorY="middle"
          outlineWidth={0.02} outlineColor="#000000"
          polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100}>
          {fp.reference || ""}
        </Text>
      </group>
    );
  }

  if (model.type === "transistor_to220" || model.type === "voltage_regulator" || model.type === "mosfet") {
    return (
      <group position={[meas.x, meas.y, zPos]} rotation={[0, 0, meas.rotationRad]}>
        <mesh position={[0, 4.5/2, 0]}>
          <boxGeometry args={[10 + lineThickness, lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[0, -4.5/2, 0]}>
          <boxGeometry args={[10 + lineThickness, lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[-5, 0, 0]}>
          <boxGeometry args={[lineThickness, 4.5 + lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[5, 0, 0]}>
          <boxGeometry args={[lineThickness, 4.5 + lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        {/* Thick line for heatsink (at the back) */}
        <mesh position={[0, 4.5/2 - 0.5, 0]}>
          <boxGeometry args={[10, 0.5, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <Text position={[0, 0, 0.08]}
          fontSize={1.2} color="#ffffff" anchorX="center" anchorY="middle"
          outlineWidth={0.02} outlineColor="#000000"
          polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100}>
          {fp.reference || ""}
        </Text>
      </group>
    );
  }

  if (model.type === "transistor_smd" || model.type === "mosfet_smd") {
    return (
      <group position={[meas.x, meas.y, zPos]} rotation={[0, 0, meas.rotationRad]}>
        <mesh position={[0, 1.3 / 2, 0]}>
          <boxGeometry args={[2.9 + lineThickness, lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[0, -1.3 / 2, 0]}>
          <boxGeometry args={[2.9 + lineThickness, lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[-2.9 / 2, 0, 0]}>
          <boxGeometry args={[lineThickness, 1.3 + lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[2.9 / 2, 0, 0]}>
          <boxGeometry args={[lineThickness, 1.3 + lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        {/* Pin 1 dot */}
        <mesh position={[-2.9 / 2 - 0.5, -1.3 / 2 - 0.5, 0]}>
          <circleGeometry args={[0.2, 16]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <Text position={[0, 0, 0.08]}
          fontSize={0.8} color="#ffffff" anchorX="center" anchorY="middle"
          outlineWidth={0.01} outlineColor="#000000"
          polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100}>
          {fp.reference || ""}
        </Text>
      </group>
    );
  }

  if (model.type === "ic_dip") {
    let minPX = 0, maxPX = 0, minPY = 0, maxPY = 0;
    if (fp.pads && fp.pads.length > 0) {
      fp.pads.forEach((p: any, idx: number) => {
        const pw = p.width || 1.6;
        const ph = p.height || 1.6;
        if (idx === 0) {
          minPX = p.x - pw / 2; maxPX = p.x + pw / 2;
          minPY = p.y - ph / 2; maxPY = p.y + ph / 2;
        } else {
          minPX = Math.min(minPX, p.x - pw / 2); maxPX = Math.max(maxPX, p.x + pw / 2);
          minPY = Math.min(minPY, p.y - ph / 2); maxPY = Math.max(maxPY, p.y + ph / 2);
        }
      });
    }
    const marginX = 1.0;
    const marginY = 1.2;
    const dipW = (maxPX > minPX) ? (maxPX - minPX) + marginX * 2 : Math.max(meas.length || 7.62, 7.62) + 2.0;
    const dipH = (maxPY > minPY) ? (maxPY - minPY) + marginY * 2 : Math.max(meas.width || 10, ((fp.pads?.length || 8) / 2) * 2.54) + 2.4;

    return (
      <group position={[meas.x, meas.y, zPos]}>
        <group rotation={[0, 0, meas.rotationRad]}>
          {/* Outer DIP socket/component outline */}
          <mesh position={[0, dipH / 2, 0]}>
            <boxGeometry args={[dipW + lineThickness, lineThickness, 0.02]} />
            <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
          </mesh>
          <mesh position={[0, -dipH / 2, 0]}>
            <boxGeometry args={[dipW + lineThickness, lineThickness, 0.02]} />
            <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
          </mesh>
          <mesh position={[-dipW / 2, 0, 0]}>
            <boxGeometry args={[lineThickness, dipH + lineThickness, 0.02]} />
            <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
          </mesh>
          <mesh position={[dipW / 2, 0, 0]}>
            <boxGeometry args={[lineThickness, dipH + lineThickness, 0.02]} />
            <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
          </mesh>

          {/* Orientation Notch at Top */}
          <mesh position={[0, dipH / 2 - 0.4, 0]}>
            <torusGeometry args={[0.8, lineThickness / 2, 2, 16, Math.PI]} />
            <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
          </mesh>

          {/* Pin 1 Dot Marker */}
          <mesh position={[-dipW / 2 + 1.0, dipH / 2 - 1.0, 0]}>
            <circleGeometry args={[0.35, 16]} />
            <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
          </mesh>

          <Text position={[0, 0, 0.08]}
            fontSize={Math.max(1.0, Math.min(dipW, dipH) * 0.2)}
            color="#ffffff" anchorX="center" anchorY="middle"
            outlineWidth={0.02} outlineColor="#000000"
            polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100}>
            {fp.reference || ""}
          </Text>
        </group>
      </group>
    );
  }

  return (
    <group position={[meas.x, meas.y, boardThickness / 2 + 0.10]}>
      {/* Component Outline Frame */}
      <group rotation={[0, 0, meas.rotationRad]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w + lineThickness, lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[0, -h / 2, 0]}>
          <boxGeometry args={[w + lineThickness, lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[-w / 2, 0, 0]}>
          <boxGeometry args={[lineThickness, h + lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[w / 2, 0, 0]}>
          <boxGeometry args={[lineThickness, h + lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
      </group>
      {/* Component Text Reference */}
      <Text position={[0, 0, 0.08]}
        fontSize={Math.max(1.2, Math.min(fp.w || fp.width || 5, fp.h || fp.height || 5) * 0.23)}
        color="#ffffff" anchorX="center" anchorY="middle"
        outlineWidth={0.02} outlineColor="#000000"
        polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100}>
        {fp.reference || ""}
      </Text>
    </group>
  );
};

export const SolderPad = ({ pad, boardThickness }: any) => {
  const w = pad.width || pad.w || 1.2, h = pad.height || pad.h || 1.2;
  const isCircle = pad.shape === "circle" || pad.shape === "oval";
  const isBottom = pad.layer === "bottom_copper";
  const zSign = isBottom ? -1 : 1;
  const drill = Number(pad.drill || pad.hole || 0);
  const hasDrill = drill > 0;
  return (
    <group position={[pad.x, pad.y, 0]} rotation={[0, 0, pad.rotation || 0]}>
      {hasDrill && (
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <cylinderGeometry args={[drill / 2, drill / 2, boardThickness + 0.08, 16]} />
          <meshStandardMaterial color="#080808" roughness={0.9} />
        </mesh>
      )}
      {isCircle ? (
        <>
          <mesh position={[0, 0, (boardThickness / 2 + 0.001) * zSign]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[w / 2, w / 2, 0.02, 24]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, (boardThickness / 2 + 0.012) * zSign]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[(w - 0.2) / 2, (w - 0.2) / 2, 0.02, 24]} />
            <meshStandardMaterial color={COPPER_COLOR} {...COPPER_METAL} />
          </mesh>
          {hasDrill && (
            <mesh position={[0, 0, (boardThickness / 2 + 0.012) * -zSign]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[(w - 0.2) / 2, (w - 0.2) / 2, 0.02, 24]} />
              <meshStandardMaterial color={COPPER_COLOR} {...COPPER_METAL} />
            </mesh>
          )}
          <mesh position={[0, 0, (boardThickness / 2 + 0.025) * zSign]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[Math.min(w, h) * 0.35, Math.min(w, h) * 0.35, 0.18, 16]} />
            <SolderMaterial />
          </mesh>
          {(pad.layer === "multi_layer") && (
            <mesh position={[0, 0, (boardThickness / 2 + 0.025) * -zSign]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[Math.min(w, h) * 0.35, Math.min(w, h) * 0.35, 0.18, 16]} />
              <SolderMaterial />
            </mesh>
          )}
        </>
      ) : (
        <>
          <mesh position={[0, 0, (boardThickness / 2 + 0.001) * zSign]}>
            <boxGeometry args={[w, h, 0.02]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0, (boardThickness / 2 + 0.012) * zSign]}>
            <boxGeometry args={[Math.max(w - 0.2, 0.4), Math.max(h - 0.2, 0.4), 0.02]} />
            <meshStandardMaterial color={COPPER_COLOR} {...COPPER_METAL} />
          </mesh>
          {hasDrill && (
            <mesh position={[0, 0, (boardThickness / 2 + 0.012) * -zSign]}>
              <boxGeometry args={[Math.max(w - 0.2, 0.4), Math.max(h - 0.2, 0.4), 0.02]} />
              <meshStandardMaterial color={COPPER_COLOR} {...COPPER_METAL} />
            </mesh>
          )}
          <mesh position={[0, 0, (boardThickness / 2 + 0.025) * zSign]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[Math.min(w, h) * 0.32, Math.min(w, h) * 0.32, 0.18, 16]} />
            <SolderMaterial />
          </mesh>
          {(pad.layer === "multi_layer") && (
            <mesh position={[0, 0, (boardThickness / 2 + 0.025) * -zSign]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[Math.min(w, h) * 0.32, Math.min(w, h) * 0.32, 0.18, 16]} />
              <SolderMaterial />
            </mesh>
          )}
        </>
      )}
    </group>
  );
};

export const SelectionHalo = ({ w, h, d }: any) => (
  <mesh raycast={() => null}>
    <boxGeometry args={[w + 0.8, h + 0.8, d + 0.8]} />
    <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.7} />
  </mesh>
);
export const HoverGlow = ({ w, h, d }: any) => (
  <mesh raycast={() => null}>
    <boxGeometry args={[w + 0.4, h + 0.4, d + 0.4]} />
    <meshBasicMaterial color="#facc15" wireframe transparent opacity={0.5} />
  </mesh>
);

export const InstancedResistorSMD = ({ instances, baseSize, boardHeight = 80 }: any) => {
  const { elevation = 0 } = React.useContext(BoardConfigContext);
  if (!instances || instances.length === 0 || !baseSize) return null;
  return (
    <Instances limit={instances.length} range={instances.length}>
      <boxGeometry args={[baseSize.w || 1.6, baseSize.h || 0.8, baseSize.d || 0.45]} />
      <meshPhysicalMaterial color="#1a1a1a" roughness={0.55} clearcoat={0.4} />
      {instances.map((fp: any, i: number) => {
        const meas = extractComponentMeasurements(fp, boardHeight);
        return (
          <Instance key={i} position={[meas.x, meas.y, fp.boardThickness / 2 + (baseSize.d || 0.45) / 2 + elevation]}
            rotation={[0, 0, meas.rotationRad]} />
        );
      })}
    </Instances>
  );
};

export const InstancedCapacitorSMD = ({ instances, baseSize, boardHeight = 80 }: any) => {
  const { elevation = 0 } = React.useContext(BoardConfigContext);
  if (!instances || instances.length === 0 || !baseSize) return null;
  return (
    <Instances limit={instances.length} range={instances.length}>
      <boxGeometry args={[baseSize.w || 1.6, baseSize.h || 0.8, baseSize.d || 0.45]} />
      <meshPhysicalMaterial color="#c69663" roughness={0.5} clearcoat={0.3} />
      {instances.map((fp: any, i: number) => {
        const meas = extractComponentMeasurements(fp, boardHeight);
        return (
          <Instance key={i} position={[meas.x, meas.y, fp.boardThickness / 2 + (baseSize.d || 0.45) / 2 + elevation]}
            rotation={[0, 0, meas.rotationRad]} />
        );
      })}
    </Instances>
  );
};

export const InstancedLED = ({ instances, baseSize, color, boardHeight = 80 }: any) => {
  const { elevation = 0 } = React.useContext(BoardConfigContext);
  if (!instances || instances.length === 0 || !baseSize) return null;
  return (
    <Instances limit={instances.length} range={instances.length}>
      <boxGeometry args={[baseSize.w || 1.6, baseSize.h || 0.8, baseSize.d || 0.45]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      {instances.map((fp: any, i: number) => {
        const meas = extractComponentMeasurements(fp, boardHeight);
        return (
          <Instance key={i} position={[meas.x, meas.y, fp.boardThickness / 2 + (baseSize.d || 0.45) / 2 + elevation]}
            rotation={[0, 0, meas.rotationRad]} />
        );
      })}
    </Instances>
  );
};

// ============================================================
// 📌 UNIVERSAL HIGH-PRECISION COMPONENT PINS / LEADS SYSTEM
// Ensures pins connect cleanly to component body AND penetrate pad drill holes
// ============================================================
export const getComponentHoles = (fp: any, size: any, mode?: string): { relativeX: number; relativeY: number; diameter: number; isDrilled: boolean }[] => {
  const meas = size?.measurements || extractComponentMeasurements(fp || {});
  if (Array.isArray(meas.holes) && meas.holes.length > 0) {
    return meas.holes.map((h: any) => ({
      relativeX: Number(h.relativeX || 0),
      relativeY: Number(h.relativeY || 0),
      diameter: Number(h.diameter || 0.8),
      isDrilled: Number(h.diameter || 0) > 0 || meas.packageType === "DIP" || mode === "axial" || mode === "dip" || mode === "header" || mode === "transistor" || mode === "radial"
    }));
  }
  // Fallback default hole positions if footprint has no pads defined
  const w = size?.w || 5;
  const h = size?.h || 3;
  if (mode === "axial") {
    return [
      { relativeX: -w * 0.45, relativeY: 0, diameter: 0.8, isDrilled: true },
      { relativeX:  w * 0.45, relativeY: 0, diameter: 0.8, isDrilled: true },
    ];
  }
  if (mode === "transistor") {
    return [
      { relativeX: -1.27, relativeY: 0, diameter: 0.8, isDrilled: true },
      { relativeX:  0,    relativeY: 0, diameter: 0.8, isDrilled: true },
      { relativeX:  1.27, relativeY: 0, diameter: 0.8, isDrilled: true },
    ];
  }
  if (mode === "dip") {
    const pins = Math.max(fp?.pads?.length || size?.pins || 8, 4);
    const result = [];
    const half = Math.floor(pins / 2);
    for (let i = 0; i < half; i++) {
      const x = -w / 2 + (w / half) * (i + 0.5);
      result.push({ relativeX: x, relativeY: -h * 0.45, diameter: 0.8, isDrilled: true });
      result.push({ relativeX: x, relativeY:  h * 0.45, diameter: 0.8, isDrilled: true });
    }
    return result;
  }
  if (mode === "header") {
    const pins = Math.max(fp?.pads?.length || size?.pins || 2, 2);
    const result = [];
    for (let i = 0; i < pins; i++) {
      result.push({ relativeX: -1.27 * pins + 1.27 + i * 2.54, relativeY: 0, diameter: 1.0, isDrilled: true });
    }
    return result;
  }
  if (mode === "smd_ic") {
    const pins = Math.max(fp?.pads?.length || size?.pins || 8, 4);
    const result = [];
    const half = Math.floor(pins / 2);
    for (let i = 0; i < half; i++) {
      const x = -w / 2 + (w / half) * (i + 0.5);
      result.push({ relativeX: x, relativeY: -h * 0.48, diameter: 0, isDrilled: false });
      result.push({ relativeX: x, relativeY:  h * 0.48, diameter: 0, isDrilled: false });
    }
    return result;
  }
  // Default radial 2 pins
  return [
    { relativeX: -w * 0.25, relativeY: 0, diameter: 0.8, isDrilled: true },
    { relativeX:  w * 0.25, relativeY: 0, diameter: 0.8, isDrilled: true },
  ];
};

export const ComponentPins3D = ({ fp, size, mode = "radial", boardThickness = 1.6 }: any) => {
  const holes = useMemo(() => getComponentHoles(fp, size, mode), [fp, size, mode]);
  const bt = fp?.boardThickness || boardThickness || 1.6;

  if (mode === "axial") {
    // Axial components (Resistor, Diode, Axial Inductor)
    // Body is horizontal centered at Z = size.d / 2 + 0.8
    const zBody = (size.d || 2.5) / 2 + 0.8;
    const bodyW = size.w || 6.3;
    const leftX = -bodyW * 0.44;
    const rightX = bodyW * 0.44;

    return (
      <group>
        {holes.map((hole, idx) => {
          const isLeft = hole.relativeX < 0;
          const startX = isLeft ? leftX : rightX;
          const endX = hole.relativeX;
          const endY = hole.relativeY;
          const dx = endX - startX;
          const dy = endY;
          const horizLen = Math.hypot(dx, dy);
          const angleXY = Math.atan2(dy, dx);
          const midX = (startX + endX) / 2;
          const midY = endY / 2;
          const pinDia = Math.min(Math.max(hole.diameter * 0.65, 0.45), 0.75);
          const zBottom = -bt - 0.7; // Protrudes through hole below PCB
          const vertLen = zBody - zBottom;
          const vertMidZ = (zBody + zBottom) / 2;

          return (
            <group key={idx}>
              {/* Horizontal lead wire from component body end to hole X,Y */}
              {horizLen > 0.05 && (
                <mesh position={[midX, midY, zBody]} rotation={[0, 0, angleXY]} castShadow>
                  <boxGeometry args={[horizLen, pinDia, pinDia]} />
                  <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
                </mesh>
              )}
              {/* 90 degree bend knee */}
              <mesh position={[endX, endY, zBody]} castShadow>
                <sphereGeometry args={[pinDia * 0.6, 12, 12]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
              {/* Vertical pin through PCB drill hole */}
              <mesh position={[endX, endY, vertMidZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[pinDia / 2, pinDia / 2, vertLen, 12]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
              {/* Bottom solder fillet cone under PCB */}
              <BottomSolderMesh position={[endX, endY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[pinDia * 0.9, 0.25, 12]} />
                <SolderMaterial />
              </BottomSolderMesh>
            </group>
          );
        })}
      </group>
    );
  }

  if (mode === "dip") {
    // DIP IC through-hole leads
    const zBody = (size.d || 3.3) / 2 + 1.0; // IC body center
    const bodyW = (size.w || 7.62) - 1.5; // Narrow body width so legs are on the outside

    return (
      <group>
        {holes.map((hole, idx) => {
          const isLeft = hole.relativeX < 0;
          const bodySideX = isLeft ? -bodyW * 0.48 : bodyW * 0.48; // Align with the narrow body outer edges
          const pinDia = Math.min(Math.max(hole.diameter * 0.65, 0.45), 0.7);
          const zTop = 1.0;
          const zBottom = -bt - 0.7;
          const vertLen = zTop - zBottom;
          const vertMidZ = (zTop + zBottom) / 2;

          return (
            <group key={idx}>
              {/* Upper shoulder connecting IC body to vertical pin */}
              <mesh position={[(hole.relativeX + bodySideX) / 2, hole.relativeY, (zBody + zTop) / 2]}
                    rotation={[0, (isLeft ? 1 : -1) * 0.3, 0]} castShadow>
                <boxGeometry args={[Math.abs(hole.relativeX - bodySideX) + 0.3, 0.45, zBody - zTop + 0.3]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
              {/* Vertical pin through PCB hole */}
              <mesh position={[hole.relativeX, hole.relativeY, vertMidZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[pinDia / 2, pinDia / 2, vertLen, 12]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
              {/* Solder fillet under PCB */}
              <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[pinDia * 0.9, 0.25, 12]} />
                <SolderMaterial />
              </BottomSolderMesh>
            </group>
          );
        })}
      </group>
    );
  }

  if (mode === "header" || mode === "female_header") {
    // Header pin posts (gold for male, silver/tin for female)
    const isFemaleMode = mode === "female_header";
    return (
      <group>
        {holes.map((hole, idx) => {
          const zTop = isFemaleMode ? 0.2 : 8.5;
          const zBottom = -bt - 1.2;
          const len = zTop - zBottom;
          const midZ = (zTop + zBottom) / 2;
          const pinW = 0.64;
          return (
            <group key={idx}>
              {/* Square pin extending through PCB */}
              <mesh position={[hole.relativeX, hole.relativeY, midZ]} castShadow>
                <boxGeometry args={[pinW, pinW, len]} />
                <meshStandardMaterial
                  color={isFemaleMode ? "#C0C0C0" : "#ffd700"}
                  metalness={0.95}
                  roughness={0.15}
                />
              </mesh>
              {/* PTH Solder fillet under PCB pad */}
              <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.45, 0.85, 0.8, 12]} />
                <meshStandardMaterial color="#E0E0E0" metalness={1.0} roughness={0.1} />
              </BottomSolderMesh>
            </group>
          );
        })}
      </group>
    );
  }

  if (mode === "smd_ic") {
    // SMD gull-wing leads (SOIC, QFP, QFN)
    const zBody = (size.d || 1.75) / 2 + 0.15;
    return (
      <group>
        {holes.map((hole, idx) => {
          const isLeft = hole.relativeX < 0;
          const bodySideX = isLeft ? (-size.w * 0.42) : (size.w * 0.42);
          const midX = (hole.relativeX + bodySideX) / 2;
          return (
            <group key={idx}>
              {/* Gull-wing slope from body to pad */}
              <mesh position={[midX, hole.relativeY, zBody * 0.6]} castShadow>
                <boxGeometry args={[Math.abs(hole.relativeX - bodySideX), 0.4, zBody]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
              {/* Foot resting flat on SMD copper pad */}
              <mesh position={[hole.relativeX, hole.relativeY, 0.03]}>
                <boxGeometry args={[0.6, 0.45, 0.04]} />
                <SolderMaterial />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }

  if (mode === "smd_passive") {
    // SMD resistor/capacitor end caps
    return (
      <group>
        {holes.map((hole, idx) => {
          return (
            <group key={idx}>
              {/* Metallic solder termination cap */}
              <mesh position={[hole.relativeX, hole.relativeY, (size.d || 0.45) / 2]}>
                <boxGeometry args={[(size.w || 1.6) * 0.22, (size.h || 0.8) * 1.04, (size.d || 0.45) * 1.04]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
              {/* Solder fillet on pad */}
              <mesh position={[hole.relativeX, hole.relativeY, 0.02]}>
                <boxGeometry args={[(size.w || 1.6) * 0.28, (size.h || 0.8) * 1.08, 0.04]} />
                <SolderMaterial />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }

  if (mode === "radial_ceramic") {
    // Ceramic disc capacitor radial pins connecting directly to bottom edge of vertical disc
    const diameter = size.w || 5;
    const legLength = size.legLength || 5.0;
    const bodyZ = legLength + diameter * 0.42;
    const zTop = bodyZ - diameter * 0.15; // deeper into the body for a better visual transition

    return (
      <group>
        {holes.map((hole, idx) => {
          const pinDia = 0.55; // Standard 24 AWG lead wire
          const zBottom = -bt - 0.7; // Protrude below PCB
          const vertLen = zTop - zBottom;
          const vertMidZ = (zTop + zBottom) / 2;

          return (
            <group key={idx}>
              {/* Vertical pin through PCB drill hole all the way into disc body */}
              <mesh position={[hole.relativeX, hole.relativeY, vertMidZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[pinDia / 2, pinDia / 2, vertLen, 12]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
              {/* Small "teardrop" or epoxy thickening where the wire enters the ceramic disc */}
              <mesh position={[hole.relativeX, hole.relativeY, bodyZ - diameter * 0.4]} rotation={[Math.PI / 2, 0, 0]}>
                <sphereGeometry args={[pinDia * 0.8, 8, 8]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
              {/* Bottom solder fillet cone under PCB */}
              <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[pinDia * 0.9, 0.25, 12]} />
                <SolderMaterial />
              </BottomSolderMesh>
            </group>
          );
        })}
      </group>
    );
  }

  if (mode === "radial") {
    return (
      <group>
        {holes.map((hole, idx) => {
          const pinDia = Math.min(Math.max((hole.diameter || 0.8) * 0.65, 0.45), 0.75);
          const zTop = Math.max((size.d || 10) * 0.35, 1.2) + 0.4;
          const zBottom = -bt - 0.7;
          const vertLen = zTop - zBottom;
          const vertMidZ = (zTop + zBottom) / 2;

          return (
            <group key={idx}>
              {/* Straight vertical lead wire through drill hole into bottom rubber plug */}
              <mesh position={[hole.relativeX, hole.relativeY, vertMidZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
                <cylinderGeometry args={[pinDia / 2, pinDia / 2, vertLen, 12]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
              {/* Bottom solder fillet cone under PCB */}
              <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[pinDia * 0.9, 0.25, 12]} />
                <SolderMaterial />
              </BottomSolderMesh>
            </group>
          );
        })}
      </group>
    );
  }

  // DEFAULT / "transistor" / upright through-hole (LEDs, Transistors, MOSFETs, Crystals, Sensors, Displays, Buttons, Relays)
  return (
    <group>
      {holes.map((hole, idx) => {
        const pinDia = Math.min(Math.max((hole.diameter || 0.8) * 0.65, 0.45), 0.8);
        const zTop = Math.max((size.d || 3) * 0.4, 1.3); // Anchored high inside component body
        const zBottom = -bt - 0.7;
        const vertLen = zTop - zBottom;
        const vertMidZ = (zTop + zBottom) / 2;

        // Calculate if hole is horizontally offset from (0,0) component body center
        const distXY = Math.hypot(hole.relativeX, hole.relativeY);

        return (
          <group key={idx}>
            {/* If hole is offset from center, draw a horizontal shoulder arm connecting body base to pin top */}
            {distXY > 0.3 && (
              <mesh position={[hole.relativeX / 2, hole.relativeY / 2, zTop - 0.15]}
                    rotation={[0, 0, Math.atan2(hole.relativeY, hole.relativeX)]} castShadow>
                <boxGeometry args={[distXY, pinDia * 1.1, pinDia * 1.1]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
            )}
            {/* Vertical pin through PCB drill hole */}
            <mesh position={[hole.relativeX, hole.relativeY, vertMidZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[pinDia / 2, pinDia / 2, vertLen, 12]} />
              <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
            </mesh>
            {/* Bottom solder fillet cone under PCB */}
            <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 0.9, 0.25, 12]} />
              <SolderMaterial />
            </BottomSolderMesh>
          </group>
        );
      })}
    </group>
  );
};

export const GLBComponent = ({ url, position, rotation, fp, size, isSelected, isHovered, onSelect, onHover }: any) => {
  const scene = useGLTF(url);
  const cloned = useMemo(() => scene?.scene ? scene.scene.clone(true) : null, [scene]);
  const bb = useMemo(() => cloned ? new THREE.Box3().setFromObject(cloned) : null, [cloned]);
  if (!cloned || !bb) return null;
  const sz = bb.getSize(new THREE.Vector3());
  const scale = Math.min(
    sz.x > 0 ? size.w / sz.x : 1,
    sz.y > 0 ? size.h / sz.y : 1,
    sz.z > 0 ? size.d / sz.z : 1
  ) || 1;
  const offset = -bb.min.z * scale; // PCB models usually oriented along Z for height
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <primitive object={cloned} scale={scale} position={[0, 0, offset]} />
      <ComponentPins3D fp={fp} size={size} mode={size.mount === "DIP/THT" ? "radial" : "smd_passive"} />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const Resistor3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const bandColors = useMemo(() => getResistorBandColors(fp.value), [fp.value]);
  const zBody = (size.d || 2.5) / 2 + 0.8;
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <mesh position={[0, 0, zBody]} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[size.h / 2, size.h / 2, size.w * 0.7, 32]} />
        <meshPhysicalMaterial color="#deb887" roughness={0.55} clearcoat={0.2} />
      </mesh>
      {[-0.6, -0.2, 0.2, 0.6].map((off, i) => (
        <mesh key={i} position={[size.w * 0.15 * off, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[size.h / 2 + 0.015, size.h / 2 + 0.015, 0.35, 32]} />
          <meshStandardMaterial color={bandColors[i]} roughness={0.4} />
        </mesh>
      ))}
      <ComponentPins3D fp={fp} size={size} mode="axial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const ResistorSMD3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const code = useMemo(() => getSMDResistorCode(fp.value), [fp.value]);
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <mesh castShadow>
        <boxGeometry args={[size.w, size.h, size.d]} />
        <meshPhysicalMaterial color="#1a1a1a" roughness={0.55} clearcoat={0.4} />
      </mesh>
      {code && (
        <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, size.d / 2 + 0.15]} fontSize={size.h * 0.5}
          color="#e8e8e8" anchorX="center" anchorY="middle">{code}</Text>
      )}
      <ComponentPins3D fp={fp} size={size} mode="smd_passive" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const CapacitorElectrolytic3D = ({ position, rotation, size: initialSize, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const capValRaw = fp?.value || fp?.val || initialSize?.meta?.value || "10µF";

  const dynamicSize = useMemo(() => {
    return getElectrolyticSize(capValRaw);
  }, [capValRaw]);

  // Extract component holes to ensure the capacitor body encloses all pin pads
  const holes = useMemo(() => getComponentHoles(fp, initialSize, "radial"), [fp, initialSize]);

  const maxHoleRadius = useMemo(() => {
    if (!holes || holes.length === 0) return 1.27;
    let maxR = 0;
    for (const h of holes) {
      const r = Math.hypot(h.relativeX || 0, h.relativeY || 0);
      if (r > maxR) maxR = r;
    }
    return maxR;
  }, [holes]);

  // Capacitor physical body size directly corresponds to its capacitance value
  const diameter = dynamicSize.w;
  const height = dynamicSize.d;
  const radius = diameter / 2;
  const zBase = 0.4;
  const bodyColor = "#0d1b2a"; // Dark blue/black for electrolytic sleeve

  const adjustedSize = useMemo(() => ({ w: diameter, h: diameter, d: height }), [diameter, height]);

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Rubber Bottom Plug (#1a1a1a) from which leads emerge */}
      <mesh position={[0, 0, zBase + 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.92, radius * 0.92, 0.6, 32]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>

      {/* Main Body - Standing Upright */}
      <mesh castShadow position={[0, 0, zBase + height / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, height, 32]} />
        <meshPhysicalMaterial color={bodyColor} roughness={0.4} metalness={0.2} clearcoat={0.6} />
      </mesh>
      
      {/* Negative Stripe - Integrated on rear side surface */}
      <mesh position={[0, 0, zBase + height / 2]} rotation={[Math.PI / 2, 0, Math.PI]}>
        <cylinderGeometry args={[radius + 0.03, radius + 0.03, height * 0.98, 32, 1, false, -Math.PI / 6, Math.PI / 3]} />
        <meshStandardMaterial color="#e6e6e6" />
      </mesh>

      {/* Negative (-) polarity markings on the silver stripe */}
      <Text
        polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100}
        position={[0, radius + 0.05, zBase + height * 0.5]}
        rotation={[Math.PI / 2, 0, Math.PI]}
        fontSize={Math.max(0.8, Math.min(height * 0.16, radius * 0.45))}
        color="#000000" anchorX="center" anchorY="middle"
      >
        -  -  -
      </Text>

      {/* Aluminum Top disk with vent detail */}
      <mesh position={[0, 0, zBase + height + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.94, radius * 0.94, 0.05, 32]} />
        <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Top Vent Pattern (K/X shape) */}
      <mesh position={[0, 0, zBase + height + 0.05]}>
        <boxGeometry args={[radius * 1.2, 0.12, 0.02]} />
        <meshStandardMaterial color="#777" />
      </mesh>
      <mesh position={[0, 0, zBase + height + 0.05]} rotation={[0, 0, Math.PI / 2]}>
        <boxGeometry args={[radius * 1.2, 0.12, 0.02]} />
        <meshStandardMaterial color="#777" />
      </mesh>

      <ComponentPins3D fp={fp} size={adjustedSize} mode="radial" />
      
      {isSelected && (
        <group position={[0, 0, zBase]}>
          <SelectionHalo w={adjustedSize.w} h={adjustedSize.h} d={adjustedSize.d} />
        </group>
      )}
      {isHovered && !isSelected && (
        <group position={[0, 0, zBase]}>
          <HoverGlow w={adjustedSize.w} h={adjustedSize.h} d={adjustedSize.d} />
        </group>
      )}
    </group>
  );
};

export const CeramicCapacitorDisc3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const diameter = size.w || 5;
  const thickness = size.d || 2;
  const legLength = 5.0; // Slightly longer legs
  const bodyZ = legLength + diameter * 0.42;
  const totalHeight = bodyZ + diameter / 2;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Stand on edge: rotation={[0, 0, 0]} so height/thickness is along Y, diameter is in X/Z plane */}
      <mesh castShadow position={[0, 0, bodyZ]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[diameter / 2, diameter / 2, thickness, 32]} />
        <meshPhysicalMaterial color="#e0952f" roughness={0.5} clearcoat={0.6} clearcoatRoughness={0.3} />
      </mesh>

      {/* Text on the vertical circular face (parallel to XZ, rotated to stand upright) */}
      <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, thickness / 2 + 0.15, bodyZ]} rotation={[Math.PI / 2, 0, 0]} fontSize={diameter * 0.24}
        color="#3a2408" anchorX="center" anchorY="middle">{fp.value || ""}</Text>

      <ComponentPins3D fp={fp} size={{ ...size, legLength }} mode="radial_ceramic" />

      {isSelected && (
        <group position={[0, 0, totalHeight / 2]}>
          <SelectionHalo w={diameter} h={thickness} d={totalHeight} />
        </group>
      )}
      {isHovered && !isSelected && (
        <group position={[0, 0, totalHeight / 2]}>
          <HoverGlow w={diameter} h={thickness} d={totalHeight} />
        </group>
      )}
    </group>
  );
};

export const CapacitorSMD3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <mesh castShadow>
      <boxGeometry args={[size.w, size.h, size.d]} />
      <meshPhysicalMaterial color="#c69663" roughness={0.5} clearcoat={0.3} />
    </mesh>
    <ComponentPins3D fp={fp} size={size} mode="smd_passive" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const TantalumSMD3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <RoundedBox args={[size.w, size.h, size.d]} radius={0.15} smoothness={4} castShadow>
      <meshPhysicalMaterial color="#f4a825" roughness={0.4} clearcoat={0.6} />
    </RoundedBox>
    <mesh position={[-size.w * 0.35, size.h * 0.35, size.d / 2 + 0.005]}>
      <boxGeometry args={[size.w * 0.18, size.h * 0.1, 0.02]} />
      <meshStandardMaterial color="#1a1a1a" />
    </mesh>
    <ComponentPins3D fp={fp} size={size} mode="smd_passive" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const LED3D = ({ position, rotation, size, color, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current && (ref.current.material as any))
      (ref.current.material as any).emissiveIntensity = 1.4 + Math.sin(clock.elapsedTime * 3) * 0.4;
  });
  const zBase = 1.0;
  const ledW = size.w || 5;
  const ledD = size.d || 8.5;

  const r = ledW / 2 + 0.25;
  const flatOffset = r * 0.85;

  const flangeShape = useMemo(() => {
    const shape = new THREE.Shape();
    const thetaStart = Math.acos(-flatOffset / r);
    const thetaEnd = 2 * Math.PI - thetaStart;

    shape.moveTo(-flatOffset, r * Math.sin(thetaStart));
    shape.absarc(0, 0, r, thetaStart, thetaEnd, false);
    shape.lineTo(-flatOffset, r * Math.sin(thetaStart));
    return shape;
  }, [ledW, r, flatOffset]);

  const extrudeSettings = useMemo(() => ({
    depth: 0.5,
    bevelEnabled: false
  }), []);

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* 1. Internal Metal Leadframe (Visible inside the transparent epoxy dome) */}
      {/* Cathode Anvil (Thicker post) on negative X */}
      <mesh position={[-ledW * 0.12, 0, zBase + ledD * 0.25]} castShadow>
        <boxGeometry args={[ledW * 0.18, ledW * 0.08, ledD * 0.45]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Anode Post (Thinner post) on positive X */}
      <mesh position={[ledW * 0.12, 0, zBase + ledD * 0.3]} castShadow>
        <boxGeometry args={[ledW * 0.08, ledW * 0.08, ledD * 0.55]} />
        <meshStandardMaterial color="#e0e0e0" roughness={0.2} metalness={0.8} />
      </mesh>
      {/* Tiny active LED semiconductor chip on top of the Anvil */}
      <mesh ref={ref} position={[-ledW * 0.12, 0, zBase + ledD * 0.485]}>
        <boxGeometry args={[0.3, 0.3, 0.2]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* Gold bond wire connecting chip to anode post */}
      <mesh position={[0, 0, zBase + ledD * 0.52]} rotation={[0, -0.4, 0]}>
        <boxGeometry args={[ledW * 0.25, ledW * 0.02, 0.05]} />
        <meshStandardMaterial color="#ffd700" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* 2. Outer Transparent Epoxy Dome (Cylinder + Hemisphere) */}
      <mesh castShadow position={[0, 0, zBase + ledD * 0.35]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[ledW / 2, ledW / 2, ledD * 0.7, 32]} />
        <meshPhysicalMaterial 
          color={color} 
          transparent 
          opacity={0.35}
          roughness={0.05} 
          transmission={0.9} 
          thickness={1.5}
          emissive={color} 
          emissiveIntensity={0.8} 
          clearcoat={1.0} 
        />
      </mesh>
      <mesh position={[0, 0, zBase + ledD * 0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <sphereGeometry args={[ledW / 2, 32, 32, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial 
          color={color} 
          transparent 
          opacity={0.35}
          roughness={0.05} 
          transmission={0.9} 
          emissive={color} 
          emissiveIntensity={0.8} 
          clearcoat={1.0} 
        />
      </mesh>

      {/* 3. Base Ring/Flange (with Flat/Notch on the Cathode/Left side) */}
      <group position={[0, 0, zBase]}>
        <mesh castShadow>
          <extrudeGeometry args={[flangeShape, extrudeSettings]} />
          <meshPhysicalMaterial 
            color={color} 
            transparent 
            opacity={0.45} 
            roughness={0.1} 
            transmission={0.8} 
            thickness={1} 
          />
        </mesh>
        {/* A small grey separator ring at the very bottom */}
        <mesh position={[0, 0, -0.05]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[ledW / 2 + 0.1, ledW / 2 + 0.1, 0.1, 24]} />
          <meshStandardMaterial color="#dedede" roughness={0.7} />
        </mesh>
      </group>

      <ComponentPins3D fp={fp} size={size} mode="radial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const SMDLED3D = ({ position, rotation, size, color, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ref.current && (ref.current.material as any))
      (ref.current.material as any).emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 3) * 0.3;
  });

  const bodyW = size.w || 1.6;
  const bodyH = size.h || 0.8;
  const bodyD = size.d || 0.6;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Substrate base */}
      <mesh castShadow position={[0, 0, bodyD * 0.2]}>
        <boxGeometry args={[bodyW * 0.7, bodyH, bodyD * 0.4]} />
        <meshPhysicalMaterial color="#0c3d0c" roughness={0.6} />
      </mesh>

      {/* Silver End Terminals */}
      <mesh position={[-bodyW * 0.4, 0, bodyD * 0.35]} castShadow>
        <boxGeometry args={[bodyW * 0.2, bodyH * 1.02, bodyD * 0.7]} />
        <meshStandardMaterial color="#cccccc" roughness={0.2} metalness={0.8} />
      </mesh>
      <mesh position={[bodyW * 0.4, 0, bodyD * 0.35]} castShadow>
        <boxGeometry args={[bodyW * 0.2, bodyH * 1.02, bodyD * 0.7]} />
        <meshStandardMaterial color="#cccccc" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Clear/Colored Epoxy Lens on top */}
      <mesh castShadow position={[0, 0, bodyD * 0.6]}>
        <boxGeometry args={[bodyW * 0.6, bodyH * 0.9, bodyD * 0.6]} />
        <meshPhysicalMaterial 
          color={color} 
          transparent 
          opacity={0.35} 
          roughness={0.1} 
          transmission={0.9} 
          thickness={0.5} 
          clearcoat={1.0}
        />
      </mesh>

      {/* Internal active LED die */}
      <mesh ref={ref} position={[0, 0, bodyD * 0.45]}>
        <boxGeometry args={[bodyW * 0.15, bodyH * 0.25, bodyD * 0.2]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>

      {/* Gold bond wire */}
      <mesh position={[bodyW * 0.12, 0, bodyD * 0.5]} rotation={[0, -0.4, 0]}>
        <boxGeometry args={[bodyW * 0.15, 0.05, 0.05]} />
        <meshStandardMaterial color="#ffd700" roughness={0.1} metalness={0.9} />
      </mesh>

      {/* Cathode Indicator */}
      <mesh position={[-bodyW * 0.25, -bodyH * 0.35, bodyD * 0.41]}>
        <boxGeometry args={[bodyW * 0.08, bodyH * 0.15, 0.01]} />
        <meshBasicMaterial color="#20ff20" />
      </mesh>

      <ComponentPins3D fp={fp} size={size} mode="smd_passive" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const IC_DIP3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const zBody = (size.d || 3.3) / 2 + 1.0;
  const bodyW = size.w - 1.5; // Narrow body width so legs are on the outside
  // If the component is inverted relative to editor, we swap the dot position
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <group position={[0, 0, zBody]}>
        <RoundedBox args={[bodyW, size.h, size.d]} radius={0.15} smoothness={4} castShadow>
          <meshPhysicalMaterial color="#111111" roughness={0.95} clearcoat={0.1} />
        </RoundedBox>
        {/* Notch at the top short end (half cylinder indented) - matching standard DIP and PCB Editor */}
        <mesh position={[0, size.h / 2 - size.w * 0.08, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[size.w * 0.15, size.w * 0.15, size.d * 1.1, 16]} />
          <meshStandardMaterial color="#050505" roughness={1} />
        </mesh>
        {/* Pin 1 Dot - prominently indicated with silver/white to match editor expectations */}
        <mesh position={[-bodyW / 2 + 0.6, size.h / 2 - 0.8, size.d / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.22, 0.22, 0.04, 16]} />
          <meshStandardMaterial color="#e0e0e0" roughness={0.3} metalness={0.8} />
        </mesh>
        {/* Laser etched text */}
        <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, size.d / 2 + 0.18]} fontSize={size.h * 0.22}
          color="#a0a0a0" opacity={0.8} anchorX="center" anchorY="middle">{fp.reference || "IC"}</Text>
      </group>
      <ComponentPins3D fp={fp} size={size} mode="dip" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const IC_SOIC3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <RoundedBox args={[size.w, size.h, size.d]} radius={0.1} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#111111" roughness={0.9} clearcoat={0.15} />
      </RoundedBox>
      {/* Pin 1 Dot - Prominent silver indicator at Top-Left */}
      <mesh position={[-size.w / 2 + 0.6, size.h / 2 - 0.6, size.d / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.03, 16]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.3} metalness={0.7} />
      </mesh>
      {/* White line indicator on the start side */}
      <mesh position={[-size.w / 2 + 0.35, 0, size.d / 2 + 0.01]}>
        <boxGeometry args={[0.12, size.h * 0.8, 0.01]} />
        <meshStandardMaterial color="#d0d0d0" />
      </mesh>
      {/* Laser etched text */}
      <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, size.d / 2 + 0.18]} fontSize={size.h * 0.25}
        color="#a0a0a0" opacity={0.7} anchorX="center" anchorY="middle" rotation={[0, 0, -Math.PI/2]}>
        {fp.reference || "U1"}
      </Text>
      <ComponentPins3D fp={fp} size={size} mode="smd_ic" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const IC_QFP3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <RoundedBox args={[size.w, size.h, size.d]} radius={0.15} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#151515" roughness={0.85} clearcoat={0.1} />
      </RoundedBox>
      {/* Pin 1 Dot - Prominent silver indicator at Top-Left */}
      <mesh position={[-size.w / 2 + 0.8, size.h / 2 - 0.8, size.d / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.04, 16]} />
        <meshStandardMaterial color="#e8e8e8" roughness={0.3} metalness={0.7} />
      </mesh>
      <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, size.d / 2 + 0.18]} fontSize={Math.min(size.h, size.w) * 0.2}
        color="#a0a0a0" opacity={0.8} anchorX="center" anchorY="middle">
        {fp.reference || "U1"}
      </Text>
      <ComponentPins3D fp={fp} size={size} mode="smd_ic" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const ESP32Module3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const isESP8266 = (fp.value || fp.footprint || fp.name || "").toLowerCase().includes("8266");
  const moduleColor = isESP8266 ? "#1565c0" : "#121212"; // Blue for ESP8266, Matte Black for ESP32
  
  const boardW = size.h || (isESP8266 ? 25.4 : 27.94); // Width along X in vertical view
  const boardH = size.w || (isESP8266 ? 48.0 : 54.61); // Height along Y in vertical view
  const boardD = 1.2;
  
  const zPCB = 4.0; // bottom of raised board
  const pcbMidZ = zPCB + boardD / 2; // 4.6
  const pcbTopZ = zPCB + boardD; // 5.2

  const rotZ = typeof rotation === "number" ? rotation : (Array.isArray(rotation) ? rotation[2] : (rotation?.z ?? 0));
  const adjustedRotation: [number, number, number] = [
    Array.isArray(rotation) ? rotation[0] : (rotation?.x ?? 0),
    Array.isArray(rotation) ? rotation[1] : (rotation?.y ?? 0),
    rotZ
  ];

  return (
    <group position={position} rotation={adjustedRotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Visual Board Group */}
      <group>
        {/* 1. Raised Module PCB */}
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.4} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color={moduleColor} roughness={0.8} />
        </RoundedBox>

        {/* 2. ESP32 / ESP8266 Metallic Shielding Can */}
        {!isESP8266 ? (
          // ESP32 WROOM Shield
          <group position={[0, boardH * 0.12, pcbTopZ + 0.85]}>
            <mesh castShadow>
              <boxGeometry args={[20, 18, 1.7]} />
              <meshPhysicalMaterial color="#dedede" metalness={0.9} roughness={0.2} clearcoat={0.3} />
            </mesh>
            <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, 0.98]} fontSize={1.5}
              color="#222" anchorX="center" anchorY="middle">ESP32-WROOM</Text>
          </group>
        ) : (
          // ESP8266 / ESP-12F Shield
          <group position={[0, boardH * 0.1, pcbTopZ + 0.75]}>
            <mesh castShadow>
              <boxGeometry args={[15, 16, 1.5]} />
              <meshPhysicalMaterial color="#d0d0d0" metalness={0.9} roughness={0.25} />
            </mesh>
            <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, 0.88]} fontSize={1.2}
              color="#333" anchorX="center" anchorY="middle">ESP-12F</Text>
          </group>
        )}

        {/* 3. PCB Antenna Trace Area */}
        <group position={[0, boardH / 2 - 4, pcbTopZ + 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[15, 6, 0.2]} />
            <meshStandardMaterial color="#b8860b" roughness={0.6} metalness={0.8} />
          </mesh>
        </group>

        {/* 4. Micro-USB Port (Usually at the bottom for dev boards, but let's place it at top if rotating?) */}
        {/* We place it at bottom edge, since that's standard for NodeMCU and ESP32 DevKitC. 
            Wait, if the user rotates 180, it means it was previously at bottom and they wanted it at top, or vice versa?
            We will place it at the edge matching the original logic, and the group rotation will invert it. */}
        <group position={[0, -boardH / 2 + 2, pcbTopZ + 1.25]}>
          <mesh castShadow>
            <boxGeometry args={[7.5, 5.5, 2.5]} />
            <meshStandardMaterial color="#dcdcdc" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, -2.7, -0.2]}>
            <boxGeometry args={[5, 1, 1]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        </group>

        {/* 5. Boot and EN Buttons */}
        <group position={[-5, -boardH / 2 + 7, pcbTopZ + 0.8]}>
          <mesh castShadow><boxGeometry args={[3, 4, 1.6]} /><meshStandardMaterial color="#e0e0e0" /></mesh>
          <mesh position={[0, 0, 0.8]}><cylinderGeometry args={[0.8, 0.8, 0.4, 16]} /><meshStandardMaterial color="#111" /></mesh>
        </group>
        <group position={[5, -boardH / 2 + 7, pcbTopZ + 0.8]}>
          <mesh castShadow><boxGeometry args={[3, 4, 1.6]} /><meshStandardMaterial color="#e0e0e0" /></mesh>
          <mesh position={[0, 0, 0.8]}><cylinderGeometry args={[0.8, 0.8, 0.4, 16]} /><meshStandardMaterial color="#111" /></mesh>
        </group>

        {/* 6. CP2102 or CH340 Serial Chip */}
        <group position={[0, -boardH * 0.15, pcbTopZ + 0.4]}>
          <mesh castShadow>
            <boxGeometry args={[5.0, 5.0, 0.8]} />
            <meshStandardMaterial color="#222" roughness={0.7} />
          </mesh>
        </group>
      </group>

      {/* Pins and Solder Joints - Unrotated relative to footprint pads */}
      {holes.map((hole, idx) => {
        const pinDia = 0.64;
        const zBottom = -bt - 0.8;
        const pinLen = pcbMidZ - zBottom;
        const pinMidZ = (pcbMidZ + zBottom) / 2;

        return (
          <group key={idx}>
            {/* Black Plastic Spacer block */}
            <mesh position={[hole.relativeX, hole.relativeY, 1.5]} castShadow>
              <boxGeometry args={[2.45, 2.45, 3.0]} />
              <meshStandardMaterial color="#1e1e1e" roughness={0.85} />
            </mesh>
            {/* Continuous square pin header */}
            <mesh position={[hole.relativeX, hole.relativeY, pinMidZ]} castShadow>
              <boxGeometry args={[0.64, 0.64, pinLen]} />
              <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
            </mesh>
            {/* Bottom Solder Joint under Motherboard */}
            <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 0.9, 0.25, 12]} />
              <SolderMaterial />
            </BottomSolderMesh>
            {/* Top Solder Joint on ESP32 PCB */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 0.9, 0.2, 12]} />
              <SolderMaterial />
            </mesh>
            {/* Gold Edge Pads on ESP32 PCB */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.01]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.9, 0.9, 0.02, 16]} />
              <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
            </mesh>
          </group>
        );
      })}

      {isSelected && <SelectionHalo w={boardW + 0.8} h={boardH + 0.8} d={zPCB + boardD + 2.5} />}
      {isHovered && !isSelected && <HoverGlow w={boardW + 0.4} h={boardH + 0.4} d={zPCB + boardD + 2.5} />}
    </group>
  );
};

export const ArduinoNano3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const isMini = (fp.value || fp.footprint || fp.name || "").toLowerCase().includes("mini") || (fp.reference || "").toLowerCase().includes("mini");
  const moduleColor = "#005a9c"; // Royal Arduino Blue
  
  const boardW = size.h || 17.78; // Width along X in vertical view
  const boardH = size.w || (isMini ? 33.02 : 43.18); // Height along Y in vertical view
  const boardD = 1.2;
  
  const zPCB = 4.0; // bottom of raised board
  const pcbMidZ = zPCB + boardD / 2; // 4.6
  const pcbTopZ = zPCB + boardD; // 5.2

  const rotZ = typeof rotation === "number" ? rotation : (Array.isArray(rotation) ? rotation[2] : (rotation?.z ?? 0));
  const adjustedRotation: [number, number, number] = [
    Array.isArray(rotation) ? rotation[0] : (rotation?.x ?? 0),
    Array.isArray(rotation) ? rotation[1] : (rotation?.y ?? 0),
    rotZ
  ];

  return (
    <group position={position} rotation={adjustedRotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Visual Board Group */}
      <group>
        {/* 1. Raised Module PCB */}
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.3} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color={moduleColor} roughness={0.75} clearcoat={0.3} />
        </RoundedBox>

        {/* 2. Main MCU (ATmega328P TQFP-32 rotated 45 degrees, which is classic) */}
        <group position={[0, boardH * 0.08, pcbTopZ + 0.5]} rotation={[0, 0, Math.PI / 4]}>
          <mesh castShadow>
            <boxGeometry args={[7.0, 7.0, 0.9]} />
            <meshStandardMaterial color="#111" roughness={0.6} />
          </mesh>
          {/* Tiny circle dot at Pin 1 */}
          <mesh position={[-2.8, -2.8, 0.46]}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshBasicMaterial color="#dedede" />
          </mesh>
          {/* Microscopic metallic lines to represent TQFP pins */}
          <mesh position={[0, 0, -0.2]}>
            <boxGeometry args={[8.2, 6.0, 0.1]} />
            <meshStandardMaterial color="#cccccc" {...SILVER_METAL} />
          </mesh>
          <mesh position={[0, 0, -0.2]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[8.2, 6.0, 0.1]} />
            <meshStandardMaterial color="#cccccc" {...SILVER_METAL} />
          </mesh>
          {/* Faint IC label */}
          <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, 0.58]} rotation={[0, 0, -Math.PI / 4]} fontSize={0.8}
            color="#aaa" anchorX="center" anchorY="middle">ATMEL</Text>
        </group>

        {/* 3. USB Port (Mini/Micro USB connector) at the top edge */}
        {!isMini && (
          <group position={[0, boardH / 2 - 2, pcbTopZ + 1.5]}>
            {/* Outer metal shield */}
            <mesh castShadow>
              <boxGeometry args={[7.5, 5.5, 2.5]} />
              <meshStandardMaterial color="#dcdcdc" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Inner plastic and dark hole */}
            <mesh position={[0, 2.7, -0.2]}>
              <boxGeometry args={[5, 1, 1]} />
              <meshBasicMaterial color="#111" />
            </mesh>
          </group>
        )}

        {/* 4. CH340 / Serial Chip (SOIC-16 on the bottom usually, but we'll show it for flavor) */}
        <group position={[0, -boardH * 0.25, pcbTopZ + 0.6]}>
          <mesh castShadow>
            <boxGeometry args={[4.5, 9.0, 1.2]} />
            <meshStandardMaterial color="#222" roughness={0.7} />
          </mesh>
        </group>

        {/* 5. ICSP Header (2x3 pins at the bottom) */}
        <group position={[0, -boardH / 2 + 5, pcbTopZ + 1.25]}>
          {/* Black plastic base */}
          <mesh castShadow>
            <boxGeometry args={[5, 7.6, 2.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {/* 6 gold pins */}
          {[-1.27, 1.27].map((x, ix) =>
            [-2.54, 0, 2.54].map((y, iy) => (
              <mesh key={`${ix}-${iy}`} position={[x, y, 1.5]} castShadow>
                <boxGeometry args={[0.64, 0.64, 3.5]} />
                <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
              </mesh>
            ))
          )}
        </group>

        {/* 6. Push Button (Reset) */}
        <group position={[0, boardH * 0.35, pcbTopZ + 1.0]}>
          <mesh castShadow>
            <boxGeometry args={[3, 4, 1.5]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.5} />
          </mesh>
          {/* Button actuator */}
          <mesh position={[0, 0, 0.75]} castShadow>
            <cylinderGeometry args={[0.8, 0.8, 0.5, 16]} />
            <meshStandardMaterial color="#111" roughness={0.8} />
          </mesh>
        </group>
      </group>

      {/* Pins and Solder Joints - Unrotated relative to footprint pads */}
      {holes.map((hole, idx) => {
        const pinDia = 0.64;
        const zBottom = -bt - 0.8;
        const pinLen = pcbMidZ - zBottom;
        const pinMidZ = (pcbMidZ + zBottom) / 2;

        return (
          <group key={idx}>
            {/* Black Plastic Spacer block */}
            <mesh position={[hole.relativeX, hole.relativeY, 1.5]} castShadow>
              <boxGeometry args={[2.45, 2.45, 3.0]} />
              <meshStandardMaterial color="#1e1e1e" roughness={0.85} />
            </mesh>
            {/* Continuous square pin header */}
            <mesh position={[hole.relativeX, hole.relativeY, pinMidZ]} castShadow>
              <boxGeometry args={[0.64, 0.64, pinLen]} />
              <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
            </mesh>
            {/* Bottom Solder Joint under Motherboard */}
            <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 0.9, 0.25, 12]} />
              <SolderMaterial />
            </BottomSolderMesh>
            {/* Top Solder Joint on Nano PCB */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 0.9, 0.2, 12]} />
              <SolderMaterial />
            </mesh>
            {/* Gold Edge Pads on Nano PCB */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.01]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.9, 0.9, 0.02, 16]} />
              <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
            </mesh>
          </group>
        );
      })}

      {isSelected && <SelectionHalo w={boardW + 0.8} h={boardH + 0.8} d={zPCB + boardD + 2.5} />}
      {isHovered && !isSelected && <HoverGlow w={boardW + 0.4} h={boardH + 0.4} d={zPCB + boardD + 2.5} />}
    </group>
  );
};

export const ArduinoUno3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const boardW = 53.34; // Standard Arduino Uno Width along X (2.1 inches)
  const boardH = 68.6;  // Standard Arduino Uno Height along Y (2.7 inches)
  const boardD = 1.6;

  const zPCB = 1.2;
  const pcbMidZ = zPCB + boardD / 2; // 2.0 mm
  const pcbTopZ = zPCB + boardD;     // 2.8 mm
  const arduinoTeal = "#008184";     // Official Arduino Teal / Deep Cyan

  const rotZ = typeof rotation === "number" ? rotation : (Array.isArray(rotation) ? rotation[2] : (rotation?.z ?? 0));
  const adjustedRotation: [number, number, number] = [
    Array.isArray(rotation) ? rotation[0] : (rotation?.x ?? 0),
    Array.isArray(rotation) ? rotation[1] : (rotation?.y ?? 0),
    rotZ
  ];

  return (
    <group position={position} rotation={adjustedRotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>

      {/* Visual Board Group */}
      <group>
        {/* 1. Main Arduino PCB Motherboard */}
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.6} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color={arduinoTeal} roughness={0.6} clearcoat={0.3} />
        </RoundedBox>

        {/* Crisp White Silkscreen Branding on PCB */}
        <Text position={[0, 18, pcbTopZ + 0.12]} fontSize={3.2} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold" polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100}>
          ARDUINO
        </Text>
        <Text position={[0, 13.5, pcbTopZ + 0.12]} fontSize={2.2} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold" polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100}>
          UNO R3
        </Text>

        {/* 2. Four Mounting Holes with Silver Copper Pads */}
        {[
          { x: -boardW / 2 + 15.24, y: boardH / 2 - 2.54 },  // Top Left
          { x: boardW / 2 - 2.54,   y: boardH / 2 - 15.24 }, // Top Right
          { x: boardW / 2 - 2.54,   y: -boardH / 2 + 2.54 }, // Bottom Right
          { x: -boardW / 2 + 15.24, y: -boardH / 2 + 2.54 }  // Bottom Left
        ].map((hole, idx) => (
          <group key={`uno-hole-${idx}`} position={[hole.x, hole.y, pcbMidZ]}>
            <mesh>
              <cylinderGeometry args={[2.0, 2.0, boardD + 0.1, 16]} />
              <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[1.6, 1.6, boardD + 0.3, 16]} />
              <meshBasicMaterial color="#111" />
            </mesh>
          </group>
        ))}

        {/* 3. USB Type-B Connector (Top-Left Edge - Protrudes over edge) */}
        <group position={[-18.5, boardH / 2 - 6, pcbTopZ + 5.5]}>
          {/* Main Silver Shield */}
          <mesh castShadow>
            <boxGeometry args={[12, 16, 11]} />
            <meshStandardMaterial color="#dcdcdc" metalness={0.92} roughness={0.18} />
          </mesh>
          {/* Receptacle Hole */}
          <mesh position={[0, 8.05, 0]}>
            <boxGeometry args={[9, 0.2, 8]} />
            <meshBasicMaterial color="#050505" />
          </mesh>
          {/* White Plastic Tongue */}
          <mesh position={[0, 4.5, 0]}>
            <boxGeometry args={[7.5, 6, 2]} />
            <meshStandardMaterial color="#f0f0f0" roughness={0.4} />
          </mesh>
        </group>

        {/* 4. DC Power Barrel Jack (Bottom-Left Edge - Protrudes over edge) */}
        <group position={[-18.5, -boardH / 2 + 6, pcbTopZ + 5.5]}>
          <mesh castShadow>
            <boxGeometry args={[9, 13.5, 11]} />
            <meshStandardMaterial color="#181818" roughness={0.8} />
          </mesh>
          {/* Outer Ring Opening */}
          <mesh position={[0, -6.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[2.7, 2.7, 0.2, 16]} />
            <meshBasicMaterial color="#000" />
          </mesh>
          {/* Center Silver Pin */}
          <mesh position={[0, -5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.8, 0.8, 4.5, 12]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>
        </group>

        {/* 5. ATmega328P DIP-28 Socket & Microcontroller Chip */}
        <group position={[8.0, -4.0, pcbTopZ + 1.8]}>
          {/* Black DIP Socket Base */}
          <mesh castShadow position={[0, 0, -0.6]}>
            <boxGeometry args={[10.2, 35.8, 1.6]} />
            <meshStandardMaterial color="#141414" roughness={0.9} />
          </mesh>

          {/* ATmega328P Plastic IC Package */}
          <mesh castShadow position={[0, 0, 0.7]}>
            <boxGeometry args={[9.4, 34.8, 2.6]} />
            <meshStandardMaterial color="#222222" roughness={0.65} />
          </mesh>

          {/* Notch at Top of IC Package */}
          <mesh position={[0, 16.8, 2.0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.3, 1.3, 2.5, 16, 1, false, 0, Math.PI]} />
            <meshBasicMaterial color="#111" />
          </mesh>

          {/* 28 Dual In-Line Silver Pins */}
          <mesh position={[-5.3, 0, -0.2]} castShadow>
            <boxGeometry args={[0.5, 34.0, 2.2]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>
          <mesh position={[5.3, 0, -0.2]} castShadow>
            <boxGeometry args={[0.5, 34.0, 2.2]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>

          {/* Laser etched text on IC chip */}
          <Text position={[0, 0, 2.22]} rotation={[0, 0, -Math.PI / 2]} fontSize={1.5} color="#cccccc" anchorX="center" anchorY="middle" fontWeight="bold" polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100}>
            ATMEGA328P-PU
          </Text>
        </group>

        {/* 6. Left Edge Female Headers (Power 8-pin & Analog 6-pin) */}
        {/* Power Header Socket (1x8) */}
        <group position={[-24.0, 3.0, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, 20.32, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
          </mesh>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={`pwr-hole-${i}`} position={[0, 8.89 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.4, 1.4, 0.2]} />
              <meshBasicMaterial color="#080808" />
            </mesh>
          ))}
        </group>
        {/* Analog Header Socket (1x6) */}
        <group position={[-24.0, -20.0, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, 15.24, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
          </mesh>
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={`ana-hole-${i}`} position={[0, 6.35 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.4, 1.4, 0.2]} />
              <meshBasicMaterial color="#080808" />
            </mesh>
          ))}
        </group>

        {/* 7. Right Edge Female Headers (Digital High 1x10 & Digital Low 1x8) */}
        {/* Digital High Header Socket (1x10) */}
        <group position={[24.0, 16.0, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, 25.4, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
          </mesh>
          {Array.from({ length: 10 }).map((_, i) => (
            <mesh key={`digh-hole-${i}`} position={[0, 11.43 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.4, 1.4, 0.2]} />
              <meshBasicMaterial color="#080808" />
            </mesh>
          ))}
        </group>
        {/* Digital Low Header Socket (1x8) */}
        <group position={[24.0, -12.0, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, 20.32, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
          </mesh>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={`digl-hole-${i}`} position={[0, 8.89 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.4, 1.4, 0.2]} />
              <meshBasicMaterial color="#080808" />
            </mesh>
          ))}
        </group>

        {/* 8. 16 MHz Crystal Oscillator (HC-49 Silver Oval Can) */}
        <group position={[-6.0, 2.0, pcbTopZ + 1.6]}>
          <mesh castShadow>
            <boxGeometry args={[4.5, 11.0, 3.2]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.88} roughness={0.2} />
          </mesh>
        </group>

        {/* 9. ATmega16U2 (QFN-32 USB-to-Serial IC Chip near USB) */}
        <group position={[-8.0, 15.0, pcbTopZ + 0.5]} rotation={[0, 0, Math.PI / 4]}>
          <mesh castShadow>
            <boxGeometry args={[5.0, 5.0, 1.0]} />
            <meshStandardMaterial color="#222" roughness={0.6} />
          </mesh>
        </group>

        {/* 10. 5V Voltage Regulator (SOT-223) */}
        <group position={[-12.0, -18.0, pcbTopZ + 0.8]}>
          <mesh castShadow>
            <boxGeometry args={[6.5, 3.5, 1.6]} />
            <meshStandardMaterial color="#222" roughness={0.7} />
          </mesh>
          <mesh position={[0, 2.2, -0.4]}>
            <boxGeometry args={[3.2, 1.2, 0.4]} />
            <meshStandardMaterial color="#cccccc" {...SILVER_METAL} />
          </mesh>
        </group>

        {/* 11. Aluminum Electrolytic Capacitors (2x Silver Cans) */}
        <group position={[-7.0, -14.0, pcbTopZ + 3.25]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3.0, 3.0, 6.5, 16]} />
            <meshStandardMaterial color="#d0d0d0" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 3.3]}>
            <cylinderGeometry args={[2.9, 2.9, 0.1, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
        <group position={[-7.0, -23.0, pcbTopZ + 3.25]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3.0, 3.0, 6.5, 16]} />
            <meshStandardMaterial color="#d0d0d0" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 3.3]}>
            <cylinderGeometry args={[2.9, 2.9, 0.1, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>

        {/* 12. Reset Button (Top Left) */}
        <group position={[-16.0, 24.0, pcbTopZ + 1.2]}>
          <mesh castShadow>
            <boxGeometry args={[4.5, 4.5, 2.4]} />
            <meshStandardMaterial color="#1e1e1e" />
          </mesh>
          <mesh position={[0, 0, 1.4]}>
            <cylinderGeometry args={[1.2, 1.2, 0.6, 16]} />
            <meshStandardMaterial color="#c62828" roughness={0.5} />
          </mesh>
        </group>

        {/* 13. Main ICSP Header (2x3 Gold Pins near bottom right) */}
        <group position={[22.0, -28.0, pcbTopZ + 1.25]}>
          <mesh castShadow>
            <boxGeometry args={[5.0, 7.6, 2.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {[-1.27, 1.27].map((x, ix) =>
            [-2.54, 0, 2.54].map((y, iy) => (
              <mesh key={`icsp1-${ix}-${iy}`} position={[x, y, 1.5]} castShadow>
                <boxGeometry args={[0.64, 0.64, 3.5]} />
                <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
              </mesh>
            ))
          )}
        </group>

        {/* 14. USB-Serial ICSP Header (2x3 Gold Pins near USB) */}
        <group position={[8.0, 28.0, pcbTopZ + 1.25]}>
          <mesh castShadow>
            <boxGeometry args={[5.0, 7.6, 2.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {[-1.27, 1.27].map((x, ix) =>
            [-2.54, 0, 2.54].map((y, iy) => (
              <mesh key={`icsp2-${ix}-${iy}`} position={[x, y, 1.5]} castShadow>
                <boxGeometry args={[0.64, 0.64, 3.5]} />
                <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
              </mesh>
            ))
          )}
        </group>

        {/* 15. Status SMD LEDs (ON, L, TX, RX) */}
        {[
          { x: -3.0, y: 18.0, label: "ON", color: "#00ff00" },
          { x: -3.0, y: 15.0, label: "L",  color: "#ffaa00" },
          { x: -3.0, y: 12.0, label: "TX", color: "#ffaa00" },
          { x: -3.0, y: 9.0,  label: "RX", color: "#ffaa00" }
        ].map((led, i) => (
          <group key={`led-${i}`} position={[led.x, led.y, pcbTopZ + 0.3]}>
            <mesh>
              <boxGeometry args={[1.2, 1.6, 0.6]} />
              <meshStandardMaterial color={led.color} emissive={led.color} emissiveIntensity={0.5} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Pins and Solder Joints */}
      {holes.map((hole, idx) => {
        const pinDia = 0.64;
        const zBottom = -bt - 0.8;
        const pinLen = pcbMidZ - zBottom;
        const pinMidZ = (pcbMidZ + zBottom) / 2;
        return (
          <group key={idx}>
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.7, 0.7, 0.05, 12]} />
              <SolderMaterial />
            </mesh>
            <mesh position={[hole.relativeX, hole.relativeY, pinMidZ]} castShadow>
              <boxGeometry args={[pinDia, pinDia, pinLen]} />
              <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
            </mesh>
            <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 1.5, 0.25, 12]} />
              <SolderMaterial />
            </BottomSolderMesh>
          </group>
        );
      })}

      {isSelected && <SelectionHalo w={boardW + 0.8} h={boardH + 0.8} d={zPCB + boardD + 10} />}
      {isHovered && !isSelected && <HoverGlow w={boardW + 0.4} h={boardH + 0.4} d={zPCB + boardD + 10} />}
    </group>
  );
};

export const RaspberryPico3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const boardW = size.h || 21.0;
  const boardH = size.w || 51.0;
  const boardD = 1.2;
  
  const zPCB = 4.0;
  const pcbMidZ = zPCB + boardD / 2;
  const pcbTopZ = zPCB + boardD;

  const rotZ = typeof rotation === "number" ? rotation : (Array.isArray(rotation) ? rotation[2] : (rotation?.z ?? 0));
  const adjustedRotation: [number, number, number] = [
    Array.isArray(rotation) ? rotation[0] : (rotation?.x ?? 0),
    Array.isArray(rotation) ? rotation[1] : (rotation?.y ?? 0),
    rotZ
  ];

  return (
    <group position={position} rotation={adjustedRotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Visual Board Group */}
      <group>
        {/* 1. Raised Module PCB */}
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.4} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color="#005d3b" roughness={0.7} clearcoat={0.1} /> {/* Raspberry Green */}
        </RoundedBox>

        {/* 2. RP2040 MCU (QFN-56) */}
        <group position={[0, -2.5, pcbTopZ + 0.3]}>
          <mesh castShadow>
            <boxGeometry args={[7, 7, 0.6]} />
            <meshStandardMaterial color="#111" roughness={0.8} />
          </mesh>
          <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, 0.45]} fontSize={1.0} color="#999" anchorX="center" anchorY="middle">RP2040</Text>
        </group>

        {/* 3. Micro-USB Port */}
        <group position={[0, boardH / 2 - 2, pcbTopZ + 1.25]}>
          <mesh castShadow>
            <boxGeometry args={[7.5, 5.5, 2.5]} />
            <meshStandardMaterial color="#dcdcdc" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 2.7, -0.2]}>
            <boxGeometry args={[5, 1, 1]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        </group>

        {/* 4. BOOTSEL Button */}
        <group position={[5, boardH / 2 - 8, pcbTopZ + 0.8]}>
          <mesh castShadow><boxGeometry args={[3.5, 4.5, 1.6]} /><meshStandardMaterial color="#e0e0e0" /></mesh>
          <mesh position={[0, 0, 0.8]}><cylinderGeometry args={[1, 1, 0.4, 16]} /><meshStandardMaterial color="#111" /></mesh>
        </group>

        {/* 5. 3-pin Debug Header at Bottom */}
        <group position={[0, -boardH / 2 + 3, pcbTopZ + 2.0]}>
          <mesh castShadow><boxGeometry args={[7.62, 2.54, 4.0]} /><meshStandardMaterial color="#1a1a1a" roughness={0.8} /></mesh>
          {[-2.54, 0, 2.54].map((x) => (
            <mesh key={x} position={[x, 0, 1.0]} castShadow>
              <boxGeometry args={[0.64, 0.64, 2.0]} />
              <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Pins and Solder Joints - Unrotated relative to footprint pads */}
      {holes.map((hole, idx) => {
        const pinDia = 0.64;
        const zBottom = -bt - 0.8;
        const pinLen = pcbMidZ - zBottom;
        const pinMidZ = (pcbMidZ + zBottom) / 2;

        return (
          <group key={idx}>
            {/* Subtle solder pad on top only */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.7, 0.7, 0.05, 12]} />
              <SolderMaterial />
            </mesh>
            {/* Continuous square pin header down through motherboard */}
            <mesh position={[hole.relativeX, hole.relativeY, pinMidZ]} castShadow>
              <boxGeometry args={[pinDia, pinDia, pinLen]} />
              <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
            </mesh>
            {/* Bottom Solder Joint under Motherboard */}
            <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 1.5, 0.25, 12]} />
              <SolderMaterial />
            </BottomSolderMesh>
          </group>
        );
      })}

      {isSelected && <SelectionHalo w={boardW + 0.8} h={boardH + 0.8} d={zPCB + boardD + 2.5} />}
      {isHovered && !isSelected && <HoverGlow w={boardW + 0.4} h={boardH + 0.4} d={zPCB + boardD + 2.5} />}
    </group>
  );
};

export const STM32BluePill3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const isHorizontal = size.w > size.h;
  const boardW = isHorizontal ? size.h : size.w;
  const boardH = isHorizontal ? size.w : size.h;
  const boardD = 1.6;
  
  const zPCB = 4.0;
  const pcbMidZ = zPCB + boardD / 2;
  const pcbTopZ = zPCB + boardD;

  const rotZ = typeof rotation === "number" ? rotation : (Array.isArray(rotation) ? rotation[2] : (rotation?.z ?? 0));
  const adjustedRotation: [number, number, number] = [
    Array.isArray(rotation) ? rotation[0] : (rotation?.x ?? 0),
    Array.isArray(rotation) ? rotation[1] : (rotation?.y ?? 0),
    rotZ
  ];

  return (
    <group position={position} rotation={adjustedRotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Visual Board Group */}
      <group rotation={[0, 0, (isHorizontal ? -Math.PI / 2 : 0)]}>
        {/* Raised PCB */}
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.3} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color="#154360" roughness={0.7} clearcoat={0.2} />
        </RoundedBox>
        
        {/* We build the board internally assuming it's vertical (Y is long axis), then rotate it if it's horizontal */}
        <group>
          {/* Main MCU */}
          <group position={[0, 2, pcbTopZ + 0.5]} rotation={[0, 0, Math.PI / 4]}>
            <mesh castShadow>
              <boxGeometry args={[7.0, 7.0, 1.0]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
            </mesh>
            <mesh position={[-2.5, 2.5, 0.51]}>
              <sphereGeometry args={[0.25, 12, 12]} />
              <meshBasicMaterial color="#dedede" />
            </mesh>
            <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, 0.62]} rotation={[0, 0, -Math.PI / 4]} fontSize={1.0} color="#999" anchorX="center" anchorY="middle">STM32</Text>
          </group>

          {/* Micro-USB Port at the top */}
          <group position={[0, boardH / 2 - 2, pcbTopZ + 1.25]}>
            <mesh castShadow>
              <boxGeometry args={[7.5, 5.5, 2.5]} />
              <meshStandardMaterial color="#dcdcdc" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, 2.7, -0.2]}>
              <boxGeometry args={[5, 1, 1]} />
              <meshBasicMaterial color="#111" />
            </mesh>
          </group>

          {/* Reset Button */}
          <group position={[boardW / 2 - 3, boardH / 2 - 10, pcbTopZ + 0.5]}>
            <mesh castShadow><boxGeometry args={[3, 4, 1.5]} /><meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.5} /></mesh>
            <mesh position={[0, 0, 0.75]} castShadow><cylinderGeometry args={[0.8, 0.8, 0.5, 16]} /><meshStandardMaterial color="#111" roughness={0.8} /></mesh>
          </group>
          
          {/* Yellow Pin Headers (Programming) */}
          <group position={[0, boardH / 2 - 12, pcbTopZ + 2.5]}>
            <mesh castShadow><boxGeometry args={[10, 2.54, 5]} /><meshStandardMaterial color="#ffeb3b" roughness={0.6} /></mesh>
          </group>
          
          {/* 32.768kHz Crystal */}
          <group position={[-boardW / 2 + 4, -5, pcbTopZ + 0.8]}>
            <mesh castShadow><cylinderGeometry args={[1, 1, 4, 16]} rotation={[0, 0, Math.PI / 2]} /><meshStandardMaterial color="#b0b0b0" metalness={0.9} roughness={0.2} /></mesh>
          </group>
        </group>
      </group>

      {/* Pins and Solder Joints - Unrotated relative to footprint pads */}
      {holes.map((hole, idx) => {
        const pinDia = 0.64;
        const zBottom = -bt - 0.8;
        const pinLen = pcbMidZ - zBottom;
        const pinMidZ = (pcbMidZ + zBottom) / 2;

        return (
          <group key={idx}>
            {/* Subtle solder pad on top only */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.7, 0.7, 0.05, 12]} />
              <SolderMaterial />
            </mesh>
            {/* Continuous square pin header down through motherboard */}
            <mesh position={[hole.relativeX, hole.relativeY, pinMidZ]} castShadow>
              <boxGeometry args={[pinDia, pinDia, pinLen]} />
              <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
            </mesh>
            {/* Bottom Solder Joint under Motherboard */}
            <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 1.5, 0.25, 12]} />
              <SolderMaterial />
            </BottomSolderMesh>
          </group>
        );
      })}

      {isSelected && <SelectionHalo w={boardW + 0.8} h={boardH + 0.8} d={zPCB + boardD + 2.5} />}
      {isHovered && !isSelected && <HoverGlow w={boardW + 0.4} h={boardH + 0.4} d={zPCB + boardD + 2.5} />}
    </group>
  );
};

export const OLEDDisplay3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <mesh castShadow><boxGeometry args={[size.w, size.h, size.d * 0.4]} />
      <meshPhysicalMaterial color="#0a3d62" roughness={0.6} clearcoat={0.4} /></mesh>
    <mesh position={[0, size.h * 0.15, size.d * 0.25]}>
      <boxGeometry args={[size.w * 0.85, size.h * 0.55, 0.5]} />
      <meshPhysicalMaterial color="#000" emissive="#00d4ff" emissiveIntensity={0.8}
        roughness={0.05} metalness={0.6} clearcoat={1} />
    </mesh>
    <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, size.h * 0.15, size.d * 0.55]} fontSize={1.8}
      color="#00d4ff" anchorX="center" anchorY="middle">OLED</Text>
    <ComponentPins3D fp={fp} size={size} mode="header" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const LCDDisplay3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <mesh castShadow><boxGeometry args={[size.w, size.h, size.d * 0.3]} />
      <meshPhysicalMaterial color="#0a5c1a" roughness={0.7} /></mesh>
    <mesh position={[0, 0, size.d * 0.5]}>
      <boxGeometry args={[size.w * 0.9, size.h * 0.75, size.d * 0.5]} />
      <meshPhysicalMaterial color="#1565c0" emissive="#42a5f5" emissiveIntensity={0.7}
        roughness={0.15} metalness={0.2} clearcoat={0.5} />
    </mesh>
    <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, size.h * 0.1, size.d * 0.76]} fontSize={1.6}
      color="#fff" anchorX="center" anchorY="middle">HELLO</Text>
    <ComponentPins3D fp={fp} size={size} mode="header" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const UltrasonicSensor3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <mesh castShadow><boxGeometry args={[size.w, size.h, size.d * 0.3]} />
      <meshPhysicalMaterial color="#0d47a1" roughness={0.6} clearcoat={0.4} /></mesh>
    {[-1, 1].map((s) => (
      <mesh key={s} position={[s * size.w * 0.28, 0, size.d * 0.5]} castShadow>
        <cylinderGeometry args={[7, 7, size.d * 0.9, 32]} />
        <meshPhysicalMaterial color="#c0c0c0" metalness={0.95} roughness={0.3} />
      </mesh>
    ))}
    <ComponentPins3D fp={fp} size={size} mode="header" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const DHTSensor3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <mesh castShadow><boxGeometry args={[size.w, size.h, size.d]} />
      <meshPhysicalMaterial color="#f5f5f5" roughness={0.7} clearcoat={0.3} /></mesh>
    {Array.from({ length: 5 }).map((_, i) => (
      <mesh key={i} position={[0, -size.h / 2 + 2 + i * 2, size.d / 2 + 0.01]}>
        <boxGeometry args={[size.w * 0.7, 0.3, 0.05]} />
        <meshPhysicalMaterial color="#888" metalness={0.7} roughness={0.4} />
      </mesh>
    ))}
    <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, size.h * 0.2, size.d / 2 + 0.18]} fontSize={1.4}
      color="#333" anchorX="center" anchorY="middle">DHT{(fp.value || "").includes("22") ? "22" : "11"}</Text>
    <ComponentPins3D fp={fp} size={size} mode="header" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const PIRSensor3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <mesh castShadow><boxGeometry args={[size.w, size.h, size.d * 0.3]} />
      <meshPhysicalMaterial color="#0a3d1a" roughness={0.7} /></mesh>
    <mesh castShadow position={[0, 0, size.d * 0.45]}>
      <sphereGeometry args={[size.w * 0.4, 20, 20, 0, Math.PI * 2, 0, Math.PI / 2]} />
      <meshPhysicalMaterial color="#e8f0e0" transparent opacity={0.7} roughness={0.15}
        transmission={0.6} clearcoat={1} />
    </mesh>
    <ComponentPins3D fp={fp} size={size} mode="radial" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const PushButton3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const bodyW = size.w || 6.2;
  const bodyH = size.h || 6.2;
  const bodyD = size.d || 3.5;
  const zBase = 0.2;
  
  const val = (fp?.value || "").toString().toUpperCase();
  const capColor =
    val.includes("YELLOW") ? "#fbc02d" :
    val.includes("BLUE") ? "#1e88e5" :
    val.includes("GREEN") ? "#388e3c" :
    val.includes("WHITE") ? "#f5f5f5" :
    val.includes("BLACK") ? "#212121" :
    "#e53935"; // vibrant red default
    
  const plateW = bodyW * 0.96;
  const plateH = bodyH * 0.96;
  const plateThick = 0.25;
  const plungerR = Math.min(bodyW, bodyH) * 0.28;
  const plungerH = bodyD * 0.7;

  const tabs = [
    [-bodyW * 0.42, -bodyH * 0.42],
    [ bodyW * 0.42, -bodyH * 0.42],
    [-bodyW * 0.42,  bodyH * 0.42],
    [ bodyW * 0.42,  bodyH * 0.42],
  ];

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* 1. Black thermoset plastic housing base */}
      <mesh castShadow position={[0, 0, zBase + bodyD * 0.4]}>
        <boxGeometry args={[bodyW, bodyH, bodyD * 0.8]} />
        <meshStandardMaterial color="#121212" roughness={0.65} metalness={0.2} />
      </mesh>

      {/* 2. Stainless Steel Top Shield / Cover Plate */}
      <mesh castShadow position={[0, 0, zBase + bodyD * 0.8 + plateThick / 2]}>
        <boxGeometry args={[plateW, plateH, plateThick]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.18} />
      </mesh>

      {/* 3. Four corner rivets securing metal cover plate */}
      {tabs.map(([x, y], i) => (
        <mesh key={i} position={[x, y, zBase + bodyD * 0.8 + plateThick + 0.05]}>
          <cylinderGeometry args={[0.3, 0.3, 0.1, 12]} rotation={[Math.PI / 2, 0, 0]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.15} />
        </mesh>
      ))}

      {/* 4. Actuator Plunger / Push Button Cap */}
      <mesh castShadow position={[0, 0, zBase + bodyD * 0.8 + plungerH / 2]}>
        <cylinderGeometry args={[plungerR, plungerR * 1.05, plungerH, 24]} />
        <meshPhysicalMaterial color={capColor} roughness={0.25} clearcoat={0.8} clearcoatRoughness={0.1} />
      </mesh>
      
      {/* Plunger top bevel ring detail */}
      <mesh position={[0, 0, zBase + bodyD * 0.8 + plungerH + 0.02]}>
        <ringGeometry args={[plungerR * 0.4, plungerR * 0.7, 24]} />
        <meshBasicMaterial color={capColor} />
      </mesh>

      {/* 5. Metallic Silver Gull-Wing Lead Pins */}
      <ComponentPins3D fp={fp} size={size} mode="radial" />

      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const Potentiometer3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const isTrimmer = size.type === "trimmer" || size.w < 12;
  const bodyW = size.w || 10;
  const bodyH = size.h || 10;
  const bodyD = size.d || 5;
  const zBase = 0.2;

  if (isTrimmer) {
    // 3296W style vertical trimmer
    const pinRadius = bodyW * 0.025;
    const pinHeight = bodyW * 0.8;
    
    // We get the actual footprint holes so they align with the PCB board holes perfectly
    const holes = getComponentHoles(fp, size, "potentiometer");
    // Ensure we have exactly 3 pins if holes are not defined or are fewer
    const pins = holes.length >= 3 ? holes.slice(0, 3) : [
      { relativeX: -bodyW * 0.25, relativeY: -bodyH * 0.12, diameter: 0.8 },
      { relativeX: 0, relativeY: bodyH * 0.12, diameter: 0.8 },
      { relativeX: bodyW * 0.25, relativeY: -bodyH * 0.12, diameter: 0.8 },
    ];

    const bt = fp?.boardThickness || 1.6;
    const zBottom = -bt - 0.7;
    // Top of the pin is slightly inside the body base to look connected
    const zTop = zBase + 0.5; 
    const vertLen = zTop - zBottom;
    const vertMidZ = (zTop + zBottom) / 2;
    const solderZ = -bt - 0.05;

    const screwRadius = bodyW * 0.15;
    const screwHeight = bodyW * 0.1;
    // Position the adjustment screw on top of the case
    const screwX = bodyW * 0.3;
    const screwY = bodyH * 0.3;
    const screwZ = zBase + bodyD + screwHeight / 2;

    return (
      <group position={position} rotation={rotation}
        onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
        onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
        onPointerOut={() => onHover(null)}>
        
        {/* Main Blue Body */}
        <mesh castShadow position={[0, 0, zBase + bodyD / 2]}>
          <boxGeometry args={[bodyW, bodyH, bodyD]} />
          <meshStandardMaterial color="#0055ff" roughness={0.4} metalness={0.1} />
        </mesh>

        {/* Adjustment Screw (Top/Front Dial) */}
        <mesh position={[screwX, screwY, screwZ]} rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[screwRadius, screwRadius, screwHeight, 16]} />
          <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Slot Detail: Cross/line on top of the cylinder */}
        {/* Line 1 (Horizontal) */}
        <mesh position={[screwX, screwY, screwZ + screwHeight / 2 + 0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <boxGeometry args={[screwRadius * 1.4, screwHeight * 0.2, screwRadius * 0.2]} />
          <meshStandardMaterial color="#222222" roughness={0.9} />
        </mesh>
        {/* Line 2 (Vertical to complete the cross) */}
        <mesh position={[screwX, screwY, screwZ + screwHeight / 2 + 0.02]} rotation={[Math.PI / 2, 0, Math.PI / 2]}>
          <boxGeometry args={[screwRadius * 1.4, screwHeight * 0.2, screwRadius * 0.2]} />
          <meshStandardMaterial color="#222222" roughness={0.9} />
        </mesh>

        {/* Three PCB Pins */}
        {pins.map((pin: any, idx: number) => {
          return (
            <group key={idx}>
              {/* Vertical Pin Lead starting from body base through the hole */}
              <mesh castShadow position={[pin.relativeX, pin.relativeY, vertMidZ]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[pinRadius, pinRadius, vertLen, 16]} />
                <meshStandardMaterial color="#e5e7eb" metalness={0.95} roughness={0.1} />
              </mesh>

              {/* Solder fillet under PCB */}
              <mesh position={[pin.relativeX, pin.relativeY, solderZ]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[pinRadius * 1.5, 0.25, 12]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.85} roughness={0.45} />
              </mesh>
            </group>
          );
        })}

        {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
        {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
      </group>
    );
  }

  // Standard Panel Potentiometer
  const shaftRadius = 3;
  const shaftHeight = 15;
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      {/* Metal Body */}
      <mesh castShadow position={[0, 0, zBase + 4]}>
        <cylinderGeometry args={[bodyW / 2, bodyW / 2, 8, 24]} rotation={[Math.PI / 2, 0, 0]} />
        <meshPhysicalMaterial color="#b0b0b0" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Front Plate / Base */}
      <mesh castShadow position={[0, 0, zBase + 1]}>
        <boxGeometry args={[bodyW, bodyH, 2]} />
        <meshPhysicalMaterial color="#a0a0a0" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Shaft */}
      <mesh castShadow position={[0, 0, zBase + 8 + shaftHeight / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[shaftRadius, shaftRadius, shaftHeight, 24]} />
        <meshPhysicalMaterial color="#c0c0c0" metalness={0.9} roughness={0.1} />
      </mesh>
      {/* Shaft Flat */}
      <mesh position={[shaftRadius * 0.8, 0, zBase + 8 + shaftHeight * 0.7]}>
        <boxGeometry args={[1, shaftRadius * 2, shaftHeight * 0.6]} />
        <meshStandardMaterial color="#999" />
      </mesh>
      <ComponentPins3D fp={fp} size={size} mode="radial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const TransistorTO923D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const w = 4.5;
  const h = 4.8;
  const d = 3.8;
  const bt = fp?.boardThickness || 1.6;

  const dShapeGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-2.25, -1.9);
    shape.lineTo(2.25, -1.9);
    shape.lineTo(2.25, -0.35);
    shape.absarc(0, -0.35, 2.25, 0, Math.PI, false);
    shape.closePath();

    return new THREE.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.1,
      bevelThickness: 0.1,
    });
  }, [h]);

  const holes = useMemo(() => getComponentHoles(fp, size, "transistor"), [fp, size]);
  const pinRadius = 0.25;
  const zBody = 3.0; // Body sits 3.0mm above the board
  const zBottom = -bt - 0.7;
  const solderZ = -bt - 0.05;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Main Plastic Body: D-shaped */}
      <mesh castShadow receiveShadow geometry={dShapeGeometry} position={[0, 0, zBody]}>
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Leads */}
      {holes.map((hole, idx) => {
        const bodyX = idx === 0 ? -1.27 : idx === 1 ? 0 : idx === 2 ? 1.27 : hole.relativeX;
        const bodyY = Math.abs(hole.relativeY) < 0.8 ? 0 : hole.relativeY;
        const dx = hole.relativeX - bodyX;
        const dy = hole.relativeY - bodyY;
        const isDirect = Math.hypot(dx, dy) < 0.15;

        const zBend = zBody - 1.4;

        if (isDirect) {
          const vertLen = zBody - zBottom;
          const vertMidZ = (zBody + zBottom) / 2;
          return (
            <group key={idx}>
              {/* Lead shoulder entering body */}
              <mesh position={[bodyX, bodyY, zBody - 0.05]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[pinRadius * 1.3, pinRadius, 0.4, 12]} />
                <meshStandardMaterial color="#d1d5db" metalness={0.95} roughness={0.15} />
              </mesh>
              {/* Straight vertical lead */}
              <mesh castShadow position={[hole.relativeX, hole.relativeY, vertMidZ]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[pinRadius, pinRadius, vertLen, 12]} />
                <meshStandardMaterial color="#d1d5db" metalness={0.95} roughness={0.15} />
              </mesh>
              {/* Solder Fillet */}
              <mesh position={[hole.relativeX, hole.relativeY, solderZ]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.55, 0.35, 12]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.85} roughness={0.45} />
              </mesh>
            </group>
          );
        }

        const upperLen = zBody - zBend;
        const upperMidZ = (zBody + zBend) / 2;
        const lowerLen = zBend - zBottom;
        const lowerMidZ = (zBend + zBottom) / 2;

        const horizLen = Math.hypot(dx, dy);
        const angleXY = Math.atan2(dy, dx);
        const midX = (bodyX + hole.relativeX) / 2;
        const midY = (bodyY + hole.relativeY) / 2;

        return (
          <group key={idx}>
            {/* Lead shoulder entering body */}
            <mesh position={[bodyX, bodyY, zBody - 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[pinRadius * 1.3, pinRadius, 0.4, 12]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.95} roughness={0.15} />
            </mesh>

            {/* Upper vertical lead segment */}
            <mesh castShadow position={[bodyX, bodyY, upperMidZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[pinRadius, pinRadius, upperLen + 0.1, 12]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.95} roughness={0.15} />
            </mesh>

            {/* Top elbow joint sphere */}
            <mesh position={[bodyX, bodyY, zBend]}>
              <sphereGeometry args={[pinRadius, 12, 12]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.95} roughness={0.15} />
            </mesh>

            {/* Slanted/Horizontal bridge segment */}
            {horizLen > 0.02 && (
              <mesh castShadow position={[midX, midY, zBend]} rotation={[0, 0, angleXY + Math.PI / 2]}>
                <cylinderGeometry args={[pinRadius, pinRadius, horizLen, 12]} />
                <meshStandardMaterial color="#d1d5db" metalness={0.95} roughness={0.15} />
              </mesh>
            )}

            {/* Bottom elbow joint sphere */}
            <mesh position={[hole.relativeX, hole.relativeY, zBend]}>
              <sphereGeometry args={[pinRadius, 12, 12]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.95} roughness={0.15} />
            </mesh>

            {/* Lower vertical lead penetrating drill hole */}
            <mesh castShadow position={[hole.relativeX, hole.relativeY, lowerMidZ]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[pinRadius, pinRadius, lowerLen, 12]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.95} roughness={0.15} />
            </mesh>

            {/* Solder Fillet */}
            <mesh position={[hole.relativeX, hole.relativeY, solderZ]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.55, 0.35, 12]} />
              <meshStandardMaterial color="#c0c0c0" metalness={0.85} roughness={0.45} />
            </mesh>
          </group>
        );
      })}

      {isSelected && <SelectionHalo w={w} h={d} d={h} />}
      {isHovered && !isSelected && <HoverGlow w={w} h={d} d={h} />}
    </group>
  );
};

export const TO2203D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const zBase = 3.0; // Height of leads
  const bodyW = 10;
  const bodyH = 9;
  const bodyD = 4.5;
  const tabH = 6;
  const tabD = 1.3;
  const bt = fp?.boardThickness || 1.6;

  const holes = useMemo(() => getComponentHoles(fp, size, "transistor"), [fp, size]);
  const zBottom = -bt - 0.7;
  const solderZ = -bt - 0.05;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      {/* Plastic Body */}
      <mesh castShadow position={[0, 0, zBase + bodyH / 2]}>
        <boxGeometry args={[bodyW, bodyD, bodyH]} />
        <meshPhysicalMaterial color="#1a1a1a" roughness={0.6} clearcoat={0.1} />
      </mesh>
      {/* Metal Tab (Heatsink) */}
      <mesh position={[0, bodyD / 2 - tabD / 2, zBase + bodyH + tabH / 2]} castShadow>
        <boxGeometry args={[bodyW, tabD, tabH]} />
        <meshPhysicalMaterial color="#b0b0b0" metalness={0.95} roughness={0.2} />
      </mesh>
      {/* Tab Hole */}
      <mesh position={[0, bodyD / 2 - tabD / 2, zBase + bodyH + tabH / 2]}>
        <cylinderGeometry args={[1.6, 1.6, tabD + 0.1, 16]} rotation={[Math.PI / 2, 0, 0]} />
        <meshStandardMaterial color="#050505" />
      </mesh>
      
      {/* Dynamic pins matching footprint drill holes */}
      {holes.map((hole, i) => {
        const bodyX = i === 0 ? -2.54 : i === 1 ? 0 : i === 2 ? 2.54 : hole.relativeX;
        const bodyY = 0;
        const dx = hole.relativeX - bodyX;
        const dy = hole.relativeY - bodyY;
        const isDirect = Math.hypot(dx, dy) < 0.15;

        const vertLen = zBase - zBottom;
        const vertMidZ = (zBase + zBottom) / 2;

        if (isDirect) {
          return (
            <group key={i}>
              {/* Thicker part of pin entering body */}
              <mesh castShadow position={[bodyX, bodyY, zBase - 0.5]}>
                <boxGeometry args={[1.3, 0.6, 1.0]} />
                <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.2} />
              </mesh>
              {/* Main vertical pin to board through PCB hole */}
              <mesh castShadow position={[hole.relativeX, hole.relativeY, vertMidZ]}>
                <boxGeometry args={[0.8, 0.45, vertLen]} />
                <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
              </mesh>
              {/* Solder fillet */}
              <mesh position={[hole.relativeX, hole.relativeY, solderZ]} rotation={[-Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.8, 0.4, 12]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.4} />
              </mesh>
            </group>
          );
        }

        const zBend = 1.4;
        const upperLen = zBase - zBend;
        const upperMidZ = (zBase + zBend) / 2;
        const lowerLen = zBend - zBottom;
        const lowerMidZ = (zBend + zBottom) / 2;
        const midX = (bodyX + hole.relativeX) / 2;
        const midY = (bodyY + hole.relativeY) / 2;
        const horizLen = Math.hypot(dx, dy);

        return (
          <group key={i}>
            {/* Thicker part of pin entering body */}
            <mesh castShadow position={[bodyX, bodyY, zBase - 0.5]}>
              <boxGeometry args={[1.3, 0.6, 1.0]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Upper vertical pin */}
            <mesh castShadow position={[bodyX, bodyY, upperMidZ]}>
              <boxGeometry args={[0.8, 0.45, upperLen]} />
              <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Connecting bridge */}
            {horizLen > 0.02 && (
              <mesh castShadow position={[midX, midY, zBend]} rotation={[0, 0, Math.atan2(dy, dx)]}>
                <boxGeometry args={[horizLen, 0.8, 0.45]} />
                <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
              </mesh>
            )}
            {/* Lower vertical pin penetrating hole */}
            <mesh castShadow position={[hole.relativeX, hole.relativeY, lowerMidZ]}>
              <boxGeometry args={[0.8, 0.45, lowerLen]} />
              <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Solder fillet */}
            <mesh position={[hole.relativeX, hole.relativeY, solderZ]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.8, 0.4, 12]} />
              <meshStandardMaterial color="#c0c0c0" metalness={0.8} roughness={0.4} />
            </mesh>
          </group>
        );
      })}

      {isSelected && <SelectionHalo w={10} h={4.5} d={15} />}
      {isHovered && !isSelected && <HoverGlow w={10} h={4.5} d={15} />}
    </group>
  );
};


export const HeaderPin3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const pins = Math.max(fp.pads?.length || 2, 2);
  let rows = 1;
  let cols = pins;
  let pitch = 2.54;
  
  const symStr = (fp.symbol || fp.symbolId || fp.value || fp.footprint || fp.packageId || "").toLowerCase();
  const genderStr = (fp.gender || fp.meta?.gender || "").toLowerCase();
  
  let isFemale = symStr.includes("female") || symStr.includes("socket") || symStr.includes("header_socket") || genderStr === "female";
  let isShrouded = symStr.includes("shrouded") || symStr.includes("box") || symStr.includes("idc") || symStr.includes("shroud") || genderStr === "shrouded";

  if (fp.symbol && fp.symbol.toLowerCase().startsWith("conn_")) {
    const parts = fp.symbol.toLowerCase().split("_");
    const r_p = parts[2].split("x");
    rows = parseInt(r_p[0], 10) || 1;
    cols = parseInt(r_p[1], 10) || pins;
    pitch = parseFloat(parts[3]) || 2.54;
    if (parts[1] === "female") isFemale = true;
    if (parts[1] === "male") { isFemale = false; isShrouded = false; }
    if (parts[1] === "shrouded") { isFemale = false; isShrouded = true; }
  } else {
    // Generic header row/col estimation
    const padsY = (fp.pads && fp.pads.length > 0) ? fp.pads.map((p: any) => p.y || 0) : [0];
    const uniqueYs = Array.from(new Set(padsY.map(y => Math.round(y * 10) / 10)));
    rows = Math.max(1, uniqueYs.length);
    cols = Math.ceil(pins / rows);
  }

  const boxW = cols * pitch;
  const boxH = rows * pitch;
  
  // Dimensions for Shrouded Box Header vs Female Socket vs Male Header
  const shroudW = cols * pitch + 7.6;
  const shroudH = Math.max(rows * pitch + 5.0, 9.0);
  const boxD = isShrouded ? 9.0 : (isFemale ? 8.5 : 2.5);

  const holes = getComponentHoles(fp, size, isFemale ? "female_header" : "header");

  const wallT = 1.8;
  const floorT = 1.8;
  const cavityDepth = boxD - floorT; // 7.2mm
  const innerW = shroudW - 2 * wallT;
  const notchW = 3.8;
  const sideFrontW = Math.max((innerW - notchW) / 2, 0.5);

  return (
    <group position={position} rotation={rotation}
      onClick={(e: any) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: any) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>

      {/* 1. SHROUDED BOX HEADER (المقبس الصندوقي) */}
      {isShrouded ? (
        <group>
          {/* Bottom Floor */}
          <mesh castShadow position={[0, 0, floorT / 2]}>
            <boxGeometry args={[shroudW, shroudH, floorT]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
          </mesh>

          {/* Left Outer Wall (-X) */}
          <mesh castShadow position={[-shroudW / 2 + wallT / 2, 0, floorT + cavityDepth / 2]}>
            <boxGeometry args={[wallT, shroudH, cavityDepth]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
          </mesh>

          {/* Right Outer Wall (+X) */}
          <mesh castShadow position={[shroudW / 2 - wallT / 2, 0, floorT + cavityDepth / 2]}>
            <boxGeometry args={[wallT, shroudH, cavityDepth]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
          </mesh>

          {/* Rear Wall (-Y) */}
          <mesh castShadow position={[0, -shroudH / 2 + wallT / 2, floorT + cavityDepth / 2]}>
            <boxGeometry args={[shroudW - 2 * wallT, wallT, cavityDepth]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
          </mesh>

          {/* Front Wall (+Y) with Standard Polarization Keying Notch */}
          {/* Left front section */}
          <mesh castShadow position={[-(notchW / 2 + sideFrontW / 2), shroudH / 2 - wallT / 2, floorT + cavityDepth / 2]}>
            <boxGeometry args={[sideFrontW, wallT, cavityDepth]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
          </mesh>
          {/* Right front section */}
          <mesh castShadow position={[(notchW / 2 + sideFrontW / 2), shroudH / 2 - wallT / 2, floorT + cavityDepth / 2]}>
            <boxGeometry args={[sideFrontW, wallT, cavityDepth]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
          </mesh>
          {/* Bottom bridge section under keying notch */}
          <mesh castShadow position={[0, shroudH / 2 - wallT / 2, floorT + (cavityDepth - 5.5) / 2]}>
            <boxGeometry args={[notchW, wallT, cavityDepth - 5.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
          </mesh>

          {/* Internal Alignment Guide Tab inside rear wall */}
          <mesh position={[0, -shroudH / 2 + wallT + 0.3, floorT + cavityDepth / 2]}>
            <boxGeometry args={[2.5, 0.6, cavityDepth - 1.0]} />
            <meshStandardMaterial color="#252525" roughness={0.7} />
          </mesh>

          {/* Pin 1 Orientation Triangle Indicator on Front Wall */}
          <mesh position={[-shroudW / 2 + 1.2, shroudH / 2 + 0.05, boxD - 1.0]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[0.6, 0.3, 3]} />
            <meshStandardMaterial color="#e0e0e0" roughness={0.3} />
          </mesh>
        </group>
      ) : (
        /* 2. STANDARD MALE / FEMALE HEADER BODY */
        <mesh castShadow position={[0, 0, boxD / 2]}>
          <boxGeometry args={[boxW, boxH, boxD]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.8} metalness={0.1} />
        </mesh>
      )}

      {/* Top Cavities & Metal Contact Entries for Female Header */}
      {isFemale && (
        <group position={[0, 0, boxD]}>
          {holes.map((hole: any, i: number) => (
             <group key={i} position={[hole.relativeX, hole.relativeY, 0]}>
               {/* Recessed Square Cavity Indentation */}
               <mesh position={[0, 0, -0.25]}>
                 <boxGeometry args={[pitch * 0.55, pitch * 0.55, 0.5]} />
                 <meshStandardMaterial color="#0d0d0d" roughness={0.9} />
               </mesh>
               {/* Shallow Metal Contact Entry */}
               <mesh position={[0, 0, -0.45]}>
                 <boxGeometry args={[pitch * 0.38, pitch * 0.38, 0.1]} />
                 <meshStandardMaterial color="#D4AF37" metalness={0.9} roughness={0.2} />
               </mesh>
             </group>
          ))}
        </group>
      )}

      {/* Bottom Pins and Solder Fillets */}
      <ComponentPins3D fp={fp} size={{ ...size, d: boxD }} mode={isFemale ? "female_header" : "header"} />

      {isSelected && <SelectionHalo w={isShrouded ? shroudW : boxW} h={isShrouded ? shroudH : boxH} d={boxD} />}
      {isHovered && !isSelected && <HoverGlow w={isShrouded ? shroudW : boxW} h={isShrouded ? shroudH : boxH} d={boxD} />}
    </group>
  );
};

export const ScrewTerminal3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const poles = Math.max(fp.pads?.length || fp.metadata?.poles || 2, 2);
  const pitch = fp.metadata?.pitch || 5.08;
  const color = fp.metadata?.color || "#00A859";
  const wireEntry = fp.metadata?.wireEntry || "Side Entry (90° Horizontal)";
  const isTopEntry = wireEntry.toLowerCase().includes("top");

  const width = poles * pitch;
  const depth = 8.5;
  const height = 10.0;

  const holePositions = useMemo(() => Array.from({ length: poles }).map((_, i) => (i - (poles - 1) / 2) * pitch), [poles, pitch]);

  // Generate body with authentic rear hexagonal curvature & faceted back profile (الجنكسيون / كتل الأطراف)
  const bodyGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    const halfD = depth / 2; // 4.25
    const h = height; // 10.0

    // Y-Z cross-section:
    // Front face (+Y = +4.25), Back face (-Y = -4.25)
    shape.moveTo(halfD, 0);                 // Bottom-front corner
    shape.lineTo(halfD, h);                 // Vertical front face (wire entry side)
    shape.lineTo(-0.8, h);                  // Top flat plate (screw area)
    shape.lineTo(-halfD + 1.2, h - 2.5);    // Upper rear hexagonal facet / slope
    shape.lineTo(-halfD, h - 4.5);          // Middle rear facet
    shape.lineTo(-halfD, 1.2);              // Lower rear face
    shape.lineTo(-halfD + 0.8, 0);          // Bottom-rear bevel
    shape.closePath();

    const geom = new THREE.ExtrudeGeometry(shape, {
      steps: 1,
      depth: width,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 2,
    });

    // Map extruded coordinates: (s_x, s_y, s_z) -> (s_z, s_x, s_y) [Width->X, Depth->Y, Height->Z]
    geom.applyMatrix4(new THREE.Matrix4().set(
      0, 0, 1, 0,
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 0, 1
    ));
    geom.center();
    return geom;
  }, [width, depth, height]);

  return (
    <group position={position} rotation={rotation}
      onClick={(e: any) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: any) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>

      {/* Main Plastic Body with Rear Hexagonal Curvature */}
      <mesh geometry={bodyGeometry} castShadow position={[0, 0, height / 2]}>
        <meshStandardMaterial color={color} roughness={0.55} metalness={0.12} />
      </mesh>

      {/* Pole Divider Grooves on Top */}
      {poles > 1 && Array.from({ length: poles - 1 }).map((_, i) => {
        const xPos = (i + 1 - poles / 2) * pitch;
        return (
          <mesh key={`div_${i}`} position={[xPos, 0, height - 0.25]}>
            <boxGeometry args={[0.3, depth - 1.2, 0.5]} />
            <meshStandardMaterial color="#0f172a" roughness={0.8} />
          </mesh>
        );
      })}

      {/* Top Screws & Screw Slots (+Z Face) */}
      <group position={[0, 0, height]}>
        {holePositions.map((xPos, i) => (
          <group key={i} position={[xPos, 0, 0]}>
            {/* Recessed Screw Well Ring */}
            <mesh position={[0, 0, -0.2]}>
              <cylinderGeometry args={[1.8, 1.8, 0.5, 16]} />
              <meshStandardMaterial color="#1e293b" roughness={0.8} />
            </mesh>
            {/* Screw Head Cylinder */}
            <mesh position={[0, 0, 0.2]} castShadow>
              <cylinderGeometry args={[1.5, 1.5, 0.4, 16]} />
              <meshStandardMaterial color="#d1d5db" metalness={0.85} roughness={0.2} />
            </mesh>
            {/* Screw Slot (-) Cross Indentation */}
            <mesh position={[0, 0, 0.42]}>
              <boxGeometry args={[2.2, 0.4, 0.1]} />
              <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.42]}>
              <boxGeometry args={[0.4, 2.2, 0.1]} />
              <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.3} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Front Wire Entry Cavities */}
      <group position={[0, isTopEntry ? 0 : depth / 2, isTopEntry ? height : height / 2]}>
        {holePositions.map((xPos, i) => (
          <group key={i} position={[xPos, 0, 0]}>
            {/* Recessed Square Cavity */}
            <mesh position={[0, isTopEntry ? 0 : 0.1, isTopEntry ? -0.1 : 0]}>
              <boxGeometry args={[2.8, isTopEntry ? 2.8 : 0.4, isTopEntry ? 0.4 : 2.8]} />
              <meshStandardMaterial color="#0f172a" roughness={0.9} />
            </mesh>
            {/* Metal Terminal Contact Clamp Inside */}
            <mesh position={[0, isTopEntry ? 0 : -0.3, isTopEntry ? -0.3 : 0]}>
              <boxGeometry args={[2.0, isTopEntry ? 2.0 : 0.8, isTopEntry ? 0.8 : 2.0]} />
              <meshStandardMaterial color="#fbbf24" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Bottom Metal Pins extending 3.5mm downward */}
      <group position={[0, 0, -1.75]}>
        {holePositions.map((xPos, i) => (
          <mesh key={i} position={[xPos, 0, 0]}>
            <boxGeometry args={[0.8, 0.8, 3.5]} />
            <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
          </mesh>
        ))}
      </group>

      {isSelected && <SelectionHalo w={width} h={depth} d={height} />}
      {isHovered && !isSelected && <HoverGlow w={width} h={depth} d={height} />}
    </group>
  );
};
export const USBC3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <RoundedBox args={[size.w, size.h, size.d]} radius={0.7} smoothness={4} castShadow>
      <meshPhysicalMaterial color="#c0c0c0" metalness={0.95} roughness={0.25} clearcoat={0.3} />
    </RoundedBox>
    <mesh position={[0, 0, size.d * 0.36]}>
      <boxGeometry args={[size.w * 0.55, size.h * 0.18, size.d * 0.4]} />
      <meshStandardMaterial color="#000" />
    </mesh>
    <ComponentPins3D fp={fp} size={size} mode="smd_ic" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const Crystal3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <RoundedBox args={[size.w, size.h, size.d]} radius={size.h * 0.4} smoothness={4} castShadow>
      <meshPhysicalMaterial color="#c0c0c0" metalness={0.9} roughness={0.35} clearcoat={0.5} />
    </RoundedBox>
    <ComponentPins3D fp={fp} size={size} mode="radial" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const Buzzer3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <mesh castShadow position={[0, 0, size.d / 2]}>
      <cylinderGeometry args={[size.w / 2, size.w / 2, size.d, 32]} />
      <meshPhysicalMaterial color="#111" roughness={0.6} />
    </mesh>
    <ComponentPins3D fp={fp} size={size} mode="radial" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const Relay3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <mesh castShadow><boxGeometry args={[size.w, size.h, size.d]} />
      <meshPhysicalMaterial color="#2196f3" roughness={0.5} clearcoat={0.7} /></mesh>
    <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, size.d / 2 + 0.18]} fontSize={1.4} color="#fff"
      anchorX="center" anchorY="middle">RELAY</Text>
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const Diode3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const zBody = (size.d || 2.5) / 2 + 0.8;
  const isSMD = size.mount === "SMD";

  const sym = (fp.symbol || "").toLowerCase();
  const val = (fp.value || "").toString().toUpperCase();
  const ref = (fp.reference || "").toString().toUpperCase();
  const fpName = (fp.footprint || fp.name || "").toLowerCase();
  const text = `${sym} ${val} ${ref} ${fpName}`.toLowerCase();

  const isZener = ref.startsWith("ZD") || ref.startsWith("DZ") || text.includes("zener") || sym.includes("zener");
  const isGlass = isZener || text.includes("4148") || text.includes("signal") || text.includes("do-35") || text.includes("do35") || size.packageName?.includes("DO-35") || size.packageName === "DO-35" || (size.w < 4 && size.mount === "DIP/THT");

  const bodyW = size.w || (isGlass ? 3.8 : 4.5);
  const bodyH = size.h || (isGlass ? 1.8 : 2.5);
  const bodyD = size.d || (isGlass ? 1.8 : 2.5);

  if (isSMD) {
    if (isGlass) {
      return (
        <group position={position} rotation={rotation}
          onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
          onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
          onPointerOut={() => onHover(null)}>
          <mesh castShadow position={[0, 0, bodyD / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[bodyH / 2, bodyH / 2, bodyW * 0.7, 16]} />
            <meshPhysicalMaterial 
              color="#ff6a3d" 
              transparent 
              opacity={0.65} 
              roughness={0.1} 
              transmission={0.9} 
              thickness={0.5} 
              clearcoat={1.0}
            />
          </mesh>
          <mesh position={[-bodyW * 0.4, 0, bodyD / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[bodyH / 2 + 0.01, bodyH / 2 + 0.01, bodyW * 0.2, 16]} />
            <meshStandardMaterial color="#dcdcdc" roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[bodyW * 0.4, 0, bodyD / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[bodyH / 2 + 0.01, bodyH / 2 + 0.01, bodyW * 0.2, 16]} />
            <meshStandardMaterial color="#dcdcdc" roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[bodyW * 0.15, 0, bodyD / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[bodyH / 2 + 0.02, bodyH / 2 + 0.02, bodyW * 0.1, 16]} />
            <meshStandardMaterial color="#111111" roughness={0.5} />
          </mesh>
          <mesh position={[-bodyW * 0.05, 0, bodyD / 2]}>
            <boxGeometry args={[bodyW * 0.15, bodyH * 0.4, bodyD * 0.4]} />
            <meshStandardMaterial color="#333333" roughness={0.4} />
          </mesh>
          <ComponentPins3D fp={fp} size={size} mode="smd_passive" />
          {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
          {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
        </group>
      );
    }

    return (
      <group position={position} rotation={rotation}
        onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
        onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
        onPointerOut={() => onHover(null)}>
        <mesh castShadow position={[0, 0, size.d / 2]}>
          <boxGeometry args={[size.w, size.h, size.d]} />
          <meshPhysicalMaterial color="#1a1a1a" roughness={0.4} />
        </mesh>
        <mesh position={[size.w * 0.35, 0, size.d / 2 + 0.01]}>
          <boxGeometry args={[size.w * 0.12, size.h * 1.01, size.d * 1.01]} />
          <meshStandardMaterial color="#e6e6e6" />
        </mesh>
        <ComponentPins3D fp={fp} size={size} mode="smd_passive" />
        {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
        {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
      </group>
    );
  }

  if (isGlass) {
    return (
      <group position={position} rotation={rotation}
        onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
        onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
        onPointerOut={() => onHover(null)}>
        <mesh castShadow position={[0, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[bodyH / 2, bodyH / 2, bodyW * 0.85, 24]} />
          <meshPhysicalMaterial 
            color="#ff7f50" 
            roughness={0.1} 
            clearcoat={1.0}
            transparent={true}
            opacity={0.65}
            transmission={0.9} 
            thickness={0.8}
          />
        </mesh>
        <mesh position={[0, 0, zBody]}>
          <boxGeometry args={[bodyW * 0.15, bodyH * 0.4, bodyH * 0.4]} />
          <meshStandardMaterial color="#2d2d2d" roughness={0.5} />
        </mesh>
        <mesh position={[-bodyW * 0.22, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, bodyW * 0.45, 12]} />
          <meshStandardMaterial color="#cccccc" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[bodyW * 0.22, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, bodyW * 0.45, 12]} />
          <meshStandardMaterial color="#cccccc" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[bodyW * 0.24, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[bodyH / 2 + 0.02, bodyH / 2 + 0.02, bodyW * 0.12, 24]} />
          <meshStandardMaterial color="#111111" roughness={0.8} />
        </mesh>
        <ComponentPins3D fp={fp} size={size} mode="axial" />
        {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
        {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
      </group>
    );
  }

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <mesh castShadow position={[0, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyH / 2, bodyH / 2, bodyW * 0.85, 24]} />
        <meshPhysicalMaterial 
          color="#1a1a1a" 
          roughness={0.4} 
          clearcoat={0.3}
        />
      </mesh>
      <mesh position={[bodyW * 0.26, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyH / 2 + 0.01, bodyH / 2 + 0.01, bodyW * 0.12, 24]} />
        <meshStandardMaterial color="#dedede" roughness={0.3} metalness={0.6} />
      </mesh>
      <ComponentPins3D fp={fp} size={size} mode="axial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const Fuse3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const isSMD = size.mount === "SMD";
  
  if (isSMD) {
    return (
      <group position={position} rotation={rotation}
        onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
        onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
        onPointerOut={() => onHover(null)}>
        <mesh position={[0, 0, size.d / 2]} castShadow>
          <boxGeometry args={[size.w * 0.8, size.h, size.d]} />
          <meshPhysicalMaterial color="#e0e0e0" roughness={0.3} clearcoat={0.6} />
        </mesh>
        <ComponentPins3D fp={fp} size={size} mode="smd_chip" />
        {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
        {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
      </group>
    );
  }

  // Glass Fuse
  const bodyZ = (size.d || 2.5) / 2 + 0.8;
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      {/* Glass Body */}
      <mesh position={[0, 0, bodyZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[size.h / 2, size.h / 2, size.w * 0.7, 16]} />
        <meshPhysicalMaterial color="#ffffff" transmission={0.9} opacity={1} roughness={0.05} ior={1.5} thickness={0.5} />
      </mesh>
      {/* Inner Wire */}
      <mesh position={[0, 0, bodyZ]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, size.w * 0.7, 8]} />
        <meshStandardMaterial color="#dcdcdc" metalness={0.8} />
      </mesh>
      {/* Metal Caps */}
      <mesh position={[-size.w * 0.42, 0, bodyZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[size.h / 2 * 1.02, size.h / 2 * 1.02, size.w * 0.16, 16]} />
        <meshStandardMaterial color="#e0e0e0" {...SILVER_METAL} metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[size.w * 0.42, 0, bodyZ]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[size.h / 2 * 1.02, size.h / 2 * 1.02, size.w * 0.16, 16]} />
        <meshStandardMaterial color="#e0e0e0" {...SILVER_METAL} metalness={0.9} roughness={0.2} />
      </mesh>
      <ComponentPins3D fp={fp} size={size} mode="axial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const ZenerDiode3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const zBody = (size.d || 1.8) / 2 + 0.8;
  const isSMD = size.mount === "SMD";

  const sym = (fp.symbol || "").toLowerCase();
  const val = (fp.value || "").toString().toUpperCase();
  const ref = (fp.reference || "").toString().toUpperCase();
  const fpName = (fp.footprint || fp.name || "").toLowerCase();
  const text = `${sym} ${val} ${ref} ${fpName}`.toLowerCase();

  const isPlastic = text.includes("plastic") || size.w > 4.5 || size.h > 2.5;
  const isGlass = !isPlastic;

  const bodyW = size.w || (isGlass ? 3.8 : 4.5);
  const bodyH = size.h || (isGlass ? 1.8 : 2.5);
  const bodyD = size.d || (isGlass ? 1.8 : 2.5);

  if (isSMD) {
    if (isGlass) {
      return (
        <group position={position} rotation={rotation}
          onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
          onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
          onPointerOut={() => onHover(null)}>
          <mesh castShadow position={[0, 0, bodyD / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[bodyH / 2, bodyH / 2, bodyW * 0.7, 16]} />
            <meshPhysicalMaterial 
              color="#ff6a3d" 
              transparent 
              opacity={0.65} 
              roughness={0.1} 
              transmission={0.9} 
              thickness={0.5} 
              clearcoat={1.0}
            />
          </mesh>
          <mesh position={[-bodyW * 0.4, 0, bodyD / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[bodyH / 2 + 0.01, bodyH / 2 + 0.01, bodyW * 0.2, 16]} />
            <meshStandardMaterial color="#dcdcdc" roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[bodyW * 0.4, 0, bodyD / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[bodyH / 2 + 0.01, bodyH / 2 + 0.01, bodyW * 0.2, 16]} />
            <meshStandardMaterial color="#dcdcdc" roughness={0.2} metalness={0.8} />
          </mesh>
          <mesh position={[bodyW * 0.15, 0, bodyD / 2]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[bodyH / 2 + 0.02, bodyH / 2 + 0.02, bodyW * 0.1, 16]} />
            <meshStandardMaterial color="#111111" roughness={0.5} />
          </mesh>
          <mesh position={[-bodyW * 0.05, 0, bodyD / 2]}>
            <boxGeometry args={[bodyW * 0.15, bodyH * 0.4, bodyD * 0.4]} />
            <meshStandardMaterial color="#333333" roughness={0.4} />
          </mesh>
          <ComponentPins3D fp={fp} size={size} mode="smd_passive" />
          {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
          {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
        </group>
      );
    }

    return (
      <group position={position} rotation={rotation}
        onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
        onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
        onPointerOut={() => onHover(null)}>
        <mesh castShadow position={[0, 0, size.d / 2]}>
          <boxGeometry args={[size.w, size.h, size.d]} />
          <meshPhysicalMaterial color="#1a1a1a" roughness={0.4} />
        </mesh>
        <mesh position={[size.w * 0.35, 0, size.d / 2 + 0.01]}>
          <boxGeometry args={[size.w * 0.12, size.h * 1.01, size.d * 1.01]} />
          <meshStandardMaterial color="#e6e6e6" />
        </mesh>
        <ComponentPins3D fp={fp} size={size} mode="smd_passive" />
        {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
        {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
      </group>
    );
  }

  if (isGlass) {
    return (
      <group position={position} rotation={rotation}
        onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
        onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
        onPointerOut={() => onHover(null)}>
        <mesh castShadow position={[0, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[bodyH / 2, bodyH / 2, bodyW * 0.85, 24]} />
          <meshPhysicalMaterial 
            color="#ff7f50" 
            roughness={0.1} 
            clearcoat={1.0}
            transparent={true}
            opacity={0.65}
            transmission={0.9} 
            thickness={0.8}
          />
        </mesh>
        <mesh position={[0, 0, zBody]}>
          <boxGeometry args={[bodyW * 0.15, bodyH * 0.4, bodyH * 0.4]} />
          <meshStandardMaterial color="#2d2d2d" roughness={0.5} />
        </mesh>
        <mesh position={[-bodyW * 0.22, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, bodyW * 0.45, 12]} />
          <meshStandardMaterial color="#cccccc" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[bodyW * 0.22, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.15, 0.15, bodyW * 0.45, 12]} />
          <meshStandardMaterial color="#cccccc" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[bodyW * 0.24, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[bodyH / 2 + 0.02, bodyH / 2 + 0.02, bodyW * 0.12, 24]} />
          <meshStandardMaterial color="#111111" roughness={0.8} />
        </mesh>
        <ComponentPins3D fp={fp} size={size} mode="axial" />
        {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
        {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
      </group>
    );
  }

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <mesh castShadow position={[0, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyH / 2, bodyH / 2, bodyW * 0.85, 24]} />
        <meshPhysicalMaterial 
          color="#1a1a1a" 
          roughness={0.4} 
          clearcoat={0.3}
        />
      </mesh>
      <mesh position={[bodyW * 0.26, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyH / 2 + 0.01, bodyH / 2 + 0.01, bodyW * 0.12, 24]} />
        <meshStandardMaterial color="#dedede" roughness={0.3} metalness={0.6} />
      </mesh>
      <ComponentPins3D fp={fp} size={size} mode="axial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const Inductor3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const style = size.meta?.style || (size.mount === "SMD" ? "smd_choke" : size.w > 10 ? "toroid" : "axial");
  const zBase = 0.2;

  if (style === "toroid") {
    const coreR = (size.w || 16) * 0.42;
    const tubeR = (size.w || 16) * 0.20;
    const wireR = 0.8;
    const numTurns = 20;

    return (
      <group position={position} rotation={rotation}
        onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
        onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
        onPointerOut={() => onHover(null)}>
        
        {/* Black Plastic Mounting Base Header */}
        <mesh castShadow position={[0, 0, zBase + 1.2]}>
          <boxGeometry args={[coreR * 2.2, coreR * 2.2, 2.4]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
        </mesh>

        {/* Ferrite Donut Core (Dark Grey) */}
        <group position={[0, 0, zBase + 2.4 + coreR]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh castShadow>
            <torusGeometry args={[coreR, tubeR, 20, 36]} />
            <meshStandardMaterial color="#2b2d42" roughness={0.8} />
          </mesh>

          {/* Copper Wire Coils Wound Around Toroid */}
          {Array.from({ length: numTurns }).map((_, i) => {
            const angle = (i / numTurns) * Math.PI * 2;
            const x = Math.cos(angle) * coreR;
            const y = Math.sin(angle) * coreR;
            return (
              <mesh key={i} position={[x, y, 0]} rotation={[0, 0, angle]}>
                <torusGeometry args={[tubeR + wireR, wireR, 12, 20]} />
                <meshStandardMaterial color={COPPER_COLOR} metalness={0.92} roughness={0.25} />
              </mesh>
            );
          })}
        </group>

        <ComponentPins3D fp={fp} size={size} mode="radial" />
        {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
        {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
      </group>
    );
  }

  if (style === "smd_choke") {
    const bodyW = size.w || 6.5;
    const bodyH = size.h || 6.5;
    const bodyD = size.d || 4.0;

    return (
      <group position={position} rotation={rotation}
        onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
        onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
        onPointerOut={() => onHover(null)}>
        
        {/* Molded Ferrite Core Box */}
        <mesh castShadow position={[0, 0, zBase + bodyD / 2]}>
          <boxGeometry args={[bodyW, bodyH, bodyD]} />
          <meshStandardMaterial color="#212529" roughness={0.65} metalness={0.3} />
        </mesh>

        {/* Top Chamfer Rim */}
        <mesh position={[0, 0, zBase + bodyD]}>
          <boxGeometry args={[bodyW * 0.92, bodyH * 0.92, 0.2]} />
          <meshStandardMaterial color="#15171a" roughness={0.5} />
        </mesh>

        {/* Value Marking Text "100" (10uH) */}
        <Text
          position={[0, 0, zBase + bodyD + 0.12]}
          fontSize={Math.min(bodyW, bodyH) * 0.35}
          color="#94a3b8"
          anchorX="center"
          anchorY="middle"
          fontWeight="bold"
        >
          {fp?.value ? fp.value.replace(/[^0-9]/g, "").slice(0, 3) || "100" : "100"}
        </Text>

        {/* SMD Wrapped Metallic Silver Leads */}
        <mesh position={[-bodyW * 0.45, 0, zBase + 0.2]}>
          <boxGeometry args={[bodyW * 0.18, bodyH * 0.8, 0.4]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh position={[bodyW * 0.45, 0, zBase + 0.2]}>
          <boxGeometry args={[bodyW * 0.18, bodyH * 0.8, 0.4]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
        </mesh>

        {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
        {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
      </group>
    );
  }

  // Axial Leaded Color-Coded Inductor
  const bodyW = size.w || 6.8;
  const bodyH = size.h || 2.8;
  const zBody = zBase + bodyH / 2;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Cylindrical Teal Epoxy Body */}
      <mesh castShadow position={[0, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyH / 2, bodyH / 2, bodyW * 0.8, 24]} />
        <meshPhysicalMaterial color="#26a69a" roughness={0.35} clearcoat={0.6} />
      </mesh>

      {/* End Bulges */}
      <mesh castShadow position={[-bodyW * 0.38, 0, zBody]}>
        <sphereGeometry args={[bodyH / 2, 16, 16]} />
        <meshPhysicalMaterial color="#26a69a" roughness={0.35} clearcoat={0.6} />
      </mesh>
      <mesh castShadow position={[bodyW * 0.38, 0, zBody]}>
        <sphereGeometry args={[bodyH / 2, 16, 16]} />
        <meshPhysicalMaterial color="#26a69a" roughness={0.35} clearcoat={0.6} />
      </mesh>

      {/* Inductance Color Bands */}
      <mesh position={[-bodyW * 0.22, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyH / 2 + 0.02, bodyH / 2 + 0.02, bodyW * 0.08, 20]} />
        <meshBasicMaterial color="#388e3c" />
      </mesh>
      <mesh position={[-bodyW * 0.08, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyH / 2 + 0.02, bodyH / 2 + 0.02, bodyW * 0.08, 20]} />
        <meshBasicMaterial color="#1976d2" />
      </mesh>
      <mesh position={[bodyW * 0.06, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyH / 2 + 0.02, bodyH / 2 + 0.02, bodyW * 0.08, 20]} />
        <meshBasicMaterial color="#795548" />
      </mesh>
      <mesh position={[bodyW * 0.22, 0, zBody]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[bodyH / 2 + 0.02, bodyH / 2 + 0.02, bodyW * 0.08, 20]} />
        <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.2} />
      </mesh>

      <ComponentPins3D fp={fp} size={size} mode="axial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const SevenSegment3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const segs = [
    [0, size.h * 0.42, 0, 0.7],
    [-size.w * 0.32, size.h * 0.2, Math.PI / 2, 0.65],
    [ size.w * 0.32, size.h * 0.2, Math.PI / 2, 0.65],
    [0, 0, 0, 0.7],
    [-size.w * 0.32, -size.h * 0.2, Math.PI / 2, 0.65],
    [ size.w * 0.32, -size.h * 0.2, Math.PI / 2, 0.65],
    [0, -size.h * 0.42, 0, 0.7],
  ] as const;
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <mesh castShadow><boxGeometry args={[size.w, size.h, size.d * 0.3]} />
        <meshPhysicalMaterial color="#111" roughness={0.6} /></mesh>
      {segs.map(([x, y, rz, scale], i) => (
        <mesh key={i} position={[x, y, size.d * 0.18]} rotation={[0, 0, rz]}>
          <boxGeometry args={[size.w * scale * 0.5, size.h * 0.08, 0.15]} />
          <meshStandardMaterial color="#3a0505" emissive="#ff1111" emissiveIntensity={0.3} />
        </mesh>
      ))}
      <ComponentPins3D fp={fp} size={size} mode="header" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const BatteryHolder3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const kind = size.meta?.kind || (size.w < 25 ? "coin" : size.d > 25 ? "9v" : "aa");
  const zBase = 0.2;

  if (kind === "coin") {
    const outerR = 11.5;

    return (
      <group position={position} rotation={rotation}
        onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
        onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
        onPointerOut={() => onHover(null)}>
        
        {/* Black Plastic Holder Frame */}
        <mesh castShadow position={[0, 0, zBase + 2.5]}>
          <cylinderGeometry args={[outerR, outerR, 4.5, 32]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
        </mesh>
        
        {/* Inner socket hollow cutout */}
        <mesh position={[0, 0, zBase + 3.2]}>
          <cylinderGeometry args={[10.2, 10.2, 3.8, 32]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.8} />
        </mesh>

        {/* Shiny Stainless Steel CR2032 Battery */}
        <group position={[0, 0, zBase + 3.0]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[10.0, 10.0, 3.2, 36]} />
            <meshPhysicalMaterial color="#f1f5f9" metalness={0.95} roughness={0.12} clearcoat={0.9} />
          </mesh>
          
          <Text
            position={[0, 0, 1.62]}
            fontSize={2.2}
            color="#0f172a"
            anchorX="center"
            anchorY="middle"
            fontWeight="bold"
          >
            + CR2032
          </Text>
          <Text
            position={[0, -3.2, 1.62]}
            fontSize={1.4}
            color="#334155"
            anchorX="center"
            anchorY="middle"
          >
            3V LITHIUM
          </Text>
        </group>

        {/* Nickel-Plated Spring Top Contact Arm */}
        <mesh castShadow position={[0, outerR * 0.7, zBase + 5.2]}>
          <boxGeometry args={[6, 8, 0.4]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh castShadow position={[0, 0, zBase + 5.0]}>
          <boxGeometry args={[4, outerR * 1.5, 0.4]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
        </mesh>

        <ComponentPins3D fp={fp} size={size} mode="radial" />
        {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
        {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
      </group>
    );
  }

  if (kind === "9v") {
    const w = size.w || 26.5;
    const h = size.h || 17.5;
    const d = size.d || 48.5;

    return (
      <group position={position} rotation={rotation}
        onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
        onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
        onPointerOut={() => onHover(null)}>
        
        {/* 9V Battery Main Metallic Body Casing */}
        <mesh castShadow position={[0, 0, zBase + d / 2]}>
          <boxGeometry args={[w, h, d]} />
          <meshPhysicalMaterial color="#1e293b" metalness={0.3} roughness={0.4} />
        </mesh>

        {/* Gold/Yellow Brand Stripe Accent */}
        <mesh castShadow position={[0, 0, zBase + d * 0.7]}>
          <boxGeometry args={[w + 0.1, h + 0.1, d * 0.3]} />
          <meshStandardMaterial color="#d4af37" metalness={0.8} roughness={0.2} />
        </mesh>

        <Text position={[0, h / 2 + 0.1, zBase + d * 0.5]} rotation={[-Math.PI / 2, 0, 0]} fontSize={6} color="#ffffff" fontWeight="bold">
          9V 6F22
        </Text>

        {/* Top Header Plate */}
        <mesh castShadow position={[0, 0, zBase + d + 1]}>
          <boxGeometry args={[w * 0.9, h * 0.9, 2]} />
          <meshStandardMaterial color="#475569" roughness={0.6} />
        </mesh>

        {/* Snap Terminals */}
        <mesh castShadow position={[-w * 0.25, 0, zBase + d + 3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.8, 2.8, 4, 8]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
        </mesh>
        <mesh castShadow position={[w * 0.25, 0, zBase + d + 3]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.0, 2.0, 4, 24]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
        </mesh>

        <ComponentPins3D fp={fp} size={size} mode="radial" />
        {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
        {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
      </group>
    );
  }

  // AA / AAA Battery Holder Tray + Realistic Metallic AA Battery
  const boxW = size.w || 58;
  const boxH = size.h || 16;
  const boxD = size.d || 14;
  const battR = boxH * 0.42;
  const battL = boxW * 0.88;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Black Ribbed Battery Tray Box */}
      <mesh castShadow position={[0, 0, zBase + boxD / 2]}>
        <boxGeometry args={[boxW, boxH, boxD]} />
        <meshStandardMaterial color="#121212" roughness={0.7} />
      </mesh>

      {/* Inner Tray Hollow Cutout */}
      <mesh position={[0, 0, zBase + boxD / 2 + 1]}>
        <boxGeometry args={[boxW - 3, boxH - 2, boxD - 1]} />
        <meshStandardMaterial color="#050505" roughness={0.8} />
      </mesh>

      {/* AA Battery Cylindrical Body */}
      <group position={[0, 0, zBase + boxD / 2 + 0.5]} rotation={[0, 0, Math.PI / 2]}>
        <mesh castShadow position={[0, -battL * 0.15, 0]}>
          <cylinderGeometry args={[battR, battR, battL * 0.7, 32]} />
          <meshStandardMaterial color="#1e293b" roughness={0.3} />
        </mesh>

        <mesh castShadow position={[0, battL * 0.3, 0]}>
          <cylinderGeometry args={[battR, battR, battL * 0.2, 32]} />
          <meshStandardMaterial color="#d4af37" metalness={0.85} roughness={0.2} />
        </mesh>

        <mesh castShadow position={[0, battL * 0.45, 0]}>
          <cylinderGeometry args={[battR * 0.35, battR * 0.35, 2.5, 24]} />
          <meshStandardMaterial color="#f1f5f9" metalness={0.95} roughness={0.12} />
        </mesh>

        <mesh castShadow position={[0, -battL * 0.5, 0]}>
          <cylinderGeometry args={[battR * 0.95, battR * 0.95, 1.2, 32]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.95} roughness={0.15} />
        </mesh>
      </group>

      {/* Negative Terminal Coil Spring Contact */}
      <mesh position={[-boxW * 0.43, 0, zBase + boxD / 2]}>
        <cylinderGeometry args={[battR * 0.7, battR * 0.4, 3, 16]} rotation={[0, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.2} />
      </mesh>

      <ComponentPins3D fp={fp} size={size} mode="radial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const TestPoint3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const val = (fp?.value || "").toString().toUpperCase();
  const ref = (fp?.reference || "").toString().toUpperCase();
  const text = `${val} ${ref}`.toUpperCase();

  const collarColor =
    text.includes("GND") || text.includes("BLK") ? "#212121" :
    text.includes("5V") || text.includes("VCC") || text.includes("RED") ? "#e53935" :
    text.includes("3V") || text.includes("YEL") ? "#fbc02d" :
    text.includes("BLU") ? "#1e88e5" :
    text.includes("WHT") ? "#f5f5f5" :
    "#e53935";

  const zBase = 0.2;
  const loopRadius = 1.8;
  const wireTube = 0.45;
  const collarR = 2.2;
  const collarH = 2.8;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* 1. Color-Coded Insulating Nylon Collar Ring */}
      <mesh castShadow position={[0, 0, zBase + collarH / 2]}>
        <cylinderGeometry args={[collarR, collarR * 1.1, collarH, 24]} />
        <meshStandardMaterial color={collarColor} roughness={0.4} />
      </mesh>

      {/* 2. Gold/Silver Plated Test Point Wire Loop Ring */}
      <group position={[0, 0, zBase + collarH + loopRadius + 0.2]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh castShadow>
          <torusGeometry args={[loopRadius, wireTube, 16, 32]} />
          <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.15} />
        </mesh>
      </group>

      {/* Vertical wire legs connecting loop to collar */}
      <mesh castShadow position={[-loopRadius, 0, zBase + collarH + loopRadius / 2]}>
        <cylinderGeometry args={[wireTube, wireTube, loopRadius, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.15} />
      </mesh>
      <mesh castShadow position={[loopRadius, 0, zBase + collarH + loopRadius / 2]}>
        <cylinderGeometry args={[wireTube, wireTube, loopRadius, 16]} />
        <meshStandardMaterial color="#d4af37" metalness={0.95} roughness={0.15} />
      </mesh>

      {/* 3. PCB Solder Pins */}
      <ComponentPins3D fp={fp} size={size} mode="radial" />

      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const ServoMotor3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const hornRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (hornRef.current) hornRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.8) * 0.9;
  });
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <RoundedBox args={[size.w, size.h, size.d * 0.65]} radius={0.4} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#1a1a1a" roughness={0.6} />
      </RoundedBox>
      <group ref={hornRef} position={[0, size.h * 0.12, size.d * 0.5]} castShadow>
        <mesh><boxGeometry args={[size.w * 0.75, 1.2, 0.8]} />
          <meshStandardMaterial color="#e8e8e8" /></mesh>
      </group>
      <ComponentPins3D fp={fp} size={size} mode="header" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const StepperDriver3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => (
  <group position={position} rotation={rotation}
    onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
    onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
    onPointerOut={() => onHover(null)}>
    <mesh castShadow><boxGeometry args={[size.w, size.h, size.d * 0.25]} />
      <meshPhysicalMaterial color="#0a5c1a" roughness={0.7} clearcoat={0.4} /></mesh>
    <mesh position={[0, size.h * 0.12, size.d * 0.55]} castShadow>
      <boxGeometry args={[size.w * 0.55, size.h * 0.55, size.d * 0.7]} />
      <meshPhysicalMaterial color="#a0a0a0" metalness={0.85} roughness={0.35} />
    </mesh>
    <ComponentPins3D fp={fp} size={size} mode="header" />
    {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
    {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
  </group>
);

export const SOT233D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const bodyW = 2.9;
  const bodyH = 1.3;
  const bodyD = 1.0;
  const bt = fp?.boardThickness || 1.6;
  const zBase = bt / 2 + 0.1;
  const isSOT223 = size.packageName === "SOT-223" || (size.w && size.w > 5);

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      {/* SOT-23/223 Plastic Body */}
      <mesh castShadow position={[0, 0, zBase + bodyD / 2]}>
        <boxGeometry args={[bodyW, bodyH, bodyD]} />
        <meshPhysicalMaterial color="#1a1a1a" roughness={0.4} />
      </mesh>
      
      {/* Leads for standard SOT-23 */}
      {!isSOT223 && (
        <group>
          {/* Side A pins (Pitch 1.9mm, so ±0.95 from center) */}
          {[-0.95, 0.95].map((x, i) => (
            <group key={`pin-A-${i}`}>
              <mesh position={[x, -bodyH / 2 - 0.25, zBase + 0.3]} castShadow>
                <boxGeometry args={[0.4, 0.5, 0.2]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
              </mesh>
              <mesh position={[x, -bodyH / 2 - 0.5, zBase + 0.15]} rotation={[Math.PI / 4, 0, 0]} castShadow>
                <boxGeometry args={[0.4, 0.3, 0.2]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
              </mesh>
              <mesh position={[x, -bodyH / 2 - 0.65, zBase + 0.05]} castShadow>
                <boxGeometry args={[0.4, 0.4, 0.1]} />
                <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
              </mesh>
            </group>
          ))}
          {/* Side B center pin */}
          <group key="pin-B">
            <mesh position={[0, bodyH / 2 + 0.25, zBase + 0.3]} castShadow>
              <boxGeometry args={[0.4, 0.5, 0.2]} />
              <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, bodyH / 2 + 0.5, zBase + 0.15]} rotation={[-Math.PI / 4, 0, 0]} castShadow>
              <boxGeometry args={[0.4, 0.3, 0.2]} />
              <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
            </mesh>
            <mesh position={[0, bodyH / 2 + 0.65, zBase + 0.05]} castShadow>
              <boxGeometry args={[0.4, 0.4, 0.1]} />
              <meshStandardMaterial color="#c0c0c0" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        </group>
      )}

      {isSOT223 && (
        <mesh castShadow position={[0, bodyH * 0.5, zBase + bodyD * 0.4]}>
          <boxGeometry args={[bodyW * 0.5, bodyH * 0.4, bodyD * 0.1]} />
          <meshStandardMaterial color="#c0c0c0" metalness={0.8} />
        </mesh>
      )}

      {/* Small marker for pin 1 */}
      {!isSOT223 && (
        <mesh position={[-bodyW * 0.35, -bodyH * 0.35, zBase + bodyD + 0.01]}>
          <circleGeometry args={[0.15, 16]} />
          <meshBasicMaterial color="#333" />
        </mesh>
      )}
      
      {/* SOT-223 uses generic SMD pads */}
      {isSOT223 && <ComponentPins3D fp={fp} size={size} mode="smd_passive" />}
      
      {isSelected && <SelectionHalo w={bodyW} h={bodyH} d={bodyD} />}
      {isHovered && !isSelected && <HoverGlow w={bodyW} h={bodyH} d={bodyD} />}
    </group>
  );
};

export const MOSFET3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const isSMD = size.mount === "SMD";
  if (isSMD) return <SOT233D position={position} rotation={rotation} size={size} fp={fp} onSelect={onSelect} onHover={onHover} isSelected={isSelected} isHovered={isHovered} />;
  return <TO2203D position={position} rotation={rotation} size={size} fp={fp} onSelect={onSelect} onHover={onHover} isSelected={isSelected} isHovered={isHovered} />;
};

export const ToggleSwitch3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const zBase = 0.2;
  const bodyW = size.w || 13;
  const bodyH = size.h || 6.5;
  const bodyD = size.d || 10;
  
  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Blue epoxy body */}
      <mesh castShadow position={[0, 0, zBase + bodyD * 0.4]}>
        <boxGeometry args={[bodyW, bodyH, bodyD * 0.8]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.7} />
      </mesh>
      
      {/* Metal top plate */}
      <mesh castShadow position={[0, 0, zBase + bodyD * 0.85]}>
        <boxGeometry args={[bodyW * 0.9, bodyH * 0.9, bodyD * 0.1]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.9} roughness={0.2} />
      </mesh>
      
      {/* Threaded collar/neck */}
      <mesh castShadow position={[0, 0, zBase + bodyD * 0.9 + 2]}>
        <cylinderGeometry args={[2.5, 2.5, 4, 16]} rotation={[Math.PI/2, 0, 0]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.3} />
      </mesh>
      
      {/* Hex nut on collar */}
      <mesh castShadow position={[0, 0, zBase + bodyD * 0.9 + 1.2]}>
        <cylinderGeometry args={[3.5, 3.5, 1, 6]} rotation={[Math.PI/2, 0, 0]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Toggle Bat (Lever) angled */}
      <mesh castShadow position={[0, 1.5, zBase + bodyD * 0.9 + 4.5]} rotation={[0.4, 0, 0]}>
        <cylinderGeometry args={[0.8, 1.2, 6, 16]} />
        <meshStandardMaterial color="#f1f5f9" metalness={0.95} roughness={0.15} />
      </mesh>

      <ComponentPins3D fp={fp} size={size} mode="radial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const SlideSwitch3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const bodyW = size.w || 11.5;
  const bodyH = size.h || 4;
  const bodyD = size.d || 4;
  const zBase = 0.2;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Silver Metal Shielding Body */}
      <mesh castShadow position={[0, 0, zBase + bodyD * 0.5]}>
        <boxGeometry args={[bodyW, bodyH, bodyD]} />
        <meshStandardMaterial color="#d1d5db" metalness={0.95} roughness={0.15} />
      </mesh>
      
      {/* Black Plastic Slider Base inside metal shell */}
      <mesh position={[0, 0, zBase + bodyD]}>
        <boxGeometry args={[bodyW * 0.6, bodyH * 0.6, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>

      {/* Actuator/Slider nub (offset to one side) */}
      <mesh castShadow position={[-bodyW * 0.2, 0, zBase + bodyD + 1.5]}>
        <boxGeometry args={[bodyW * 0.2, bodyH * 0.5, 3]} />
        <meshStandardMaterial color="#111" roughness={0.6} />
      </mesh>

      <ComponentPins3D fp={fp} size={size} mode="radial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const DIPSwitch3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const bodyW = size.w || 10;
  const bodyH = size.h || 8;
  const bodyD = size.d || 4.5;
  const zBase = 0.2;
  const switchCount = Math.floor(bodyW / 2.54);

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Red Plastic Body */}
      <mesh castShadow position={[0, 0, zBase + bodyD * 0.5]}>
        <boxGeometry args={[bodyW, bodyH, bodyD]} />
        <meshStandardMaterial color="#b91c1c" roughness={0.7} />
      </mesh>
      
      {/* Recessed black area for switches */}
      <mesh position={[0, 0, zBase + bodyD + 0.1]}>
        <boxGeometry args={[bodyW * 0.9, bodyH * 0.7, 0.2]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>

      {/* Individual white switch sliders */}
      {Array.from({ length: switchCount }).map((_, i) => {
        const xOffset = -bodyW / 2 + 1.27 + i * 2.54;
        const isUp = i % 2 === 0;
        return (
          <mesh key={i} castShadow position={[xOffset, isUp ? 1 : -1, zBase + bodyD + 0.5]}>
            <boxGeometry args={[1, 1.5, 0.8]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} />
          </mesh>
        );
      })}

      <ComponentPins3D fp={fp} size={size} mode="radial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const PanelMeter3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const bodyW = size.w || 30;
  const bodyH = size.h || 15;
  const bodyD = size.d || 12;
  const zBase = 0.2;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Main Black Housing */}
      <mesh castShadow position={[0, 0, zBase + bodyD * 0.5]}>
        <boxGeometry args={[bodyW, bodyH, bodyD]} />
        <meshStandardMaterial color="#121212" roughness={0.7} />
      </mesh>

      {/* Front Bezel frame */}
      <mesh castShadow position={[0, 0, zBase + bodyD + 0.5]}>
        <boxGeometry args={[bodyW * 1.05, bodyH * 1.05, 1]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.6} />
      </mesh>

      {/* Dark Red/Black Acrylic Display Window */}
      <mesh position={[0, 0, zBase + bodyD + 1.05]}>
        <boxGeometry args={[bodyW * 0.9, bodyH * 0.8, 0.2]} />
        <meshStandardMaterial color="#1a0505" roughness={0.2} metalness={0.5} clearcoat={0.9} />
      </mesh>

      {/* Glowing 7-segment LED Text - Volts */}
      <Text
        position={[0, 0, zBase + bodyD + 1.2]}
        fontSize={bodyH * 0.6}
        color="#ef4444"
        anchorX="center"
        anchorY="middle"
      >
        12.0 V
      </Text>

      <ComponentPins3D fp={fp} size={size} mode="radial" />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

const CustomGLBModel = ({ url, position, rotation, common }: any) => {
  const { scene } = useGLTF(url);
  const clone = useMemo(() => scene.clone(), [scene]);
  
  return (
    <group 
      position={position} 
      rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); common.onSelect(common.fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); common.onHover(common.fp); }}
      onPointerOut={() => common.onHover(null)}
    >
      <primitive object={clone} />
      {common.isSelected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[10, 10, 0.1]} />
          <meshBasicMaterial color="#10b981" wireframe opacity={0.5} transparent />
        </mesh>
      )}
    </group>
  );
};

const CustomSTPModel = ({ url, position, rotation, common, onFallback }: any) => {
  const [meshes, setMeshes] = useState<THREE.Mesh[]>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const loadStep = async () => {
      try {
        const occt = await initOpenCascade({ locateFile: () => occtWasmUrl });
        const res = await fetch(url);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const buffer = await res.arrayBuffer();
        const fileBuffer = new Uint8Array(buffer);
        const result = occt.ReadStepFile(fileBuffer, null);
        
        if (result.success && active && result.meshes) {
          const threeMeshes: THREE.Mesh[] = [];
          
          for (const m of result.meshes) {
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(m.attributes.position.array, 3));
            if (m.attributes.normal) {
              geometry.setAttribute('normal', new THREE.Float32BufferAttribute(m.attributes.normal.array, 3));
            }
            if (m.index) {
              geometry.setIndex(new THREE.Uint32BufferAttribute(m.index.array, 1));
            }
            geometry.computeBoundingBox();
            
            const r = m.color ? m.color[0] : 0.8;
            const g = m.color ? m.color[1] : 0.8;
            const b = m.color ? m.color[2] : 0.8;
            
            const material = new THREE.MeshStandardMaterial({ 
              color: new THREE.Color(r, g, b),
              roughness: 0.5,
              metalness: 0.2
            });
            
            threeMeshes.push(new THREE.Mesh(geometry, material));
          }
          
          setMeshes(threeMeshes);
        }
      } catch (err) {
        console.error("Failed to load STP model", err);
        if (active) setError(true);
      }
    };
    loadStep();
    return () => { active = false; };
  }, [url]);

  if (error && onFallback) return <>{onFallback()}</>;

  return (
    <group 
      position={position} 
      rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); common.onSelect(common.fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); common.onHover(common.fp); }}
      onPointerOut={() => common.onHover(null)}
    >
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
      {common.isSelected && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[10, 10, 0.1]} />
          <meshBasicMaterial color="#10b981" wireframe opacity={0.5} transparent />
        </mesh>
      )}
    </group>
  );
};

const Custom3DModelRenderer = ({ url, type, position, rotation, common, fallback }: any) => {
  if (type === 'glb') {
    return (
      <GLBErrorBoundary fallback={fallback}>
        <Suspense fallback={null}>
          <CustomGLBModel url={url} position={position} rotation={rotation} common={common} />
        </Suspense>
      </GLBErrorBoundary>
    );
  }
  if (type === 'stp') {
    return <CustomSTPModel url={url} position={position} rotation={rotation} common={common} onFallback={() => fallback} />;
  }
  return fallback;
};

export const GenericComponent3D = ({ position, rotation, size, color, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const isDip = size.mount === "DIP/THT";
  const zOffset = isDip ? size.d / 2 : 0;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <group position={[0, 0, zOffset]}>
        <RoundedBox args={[size.w, size.h, size.d]} radius={0.1} smoothness={4} castShadow>
          <meshStandardMaterial color={color || "#334155"} roughness={0.7} />
        </RoundedBox>
        <Text polygonOffset polygonOffsetFactor={-10} polygonOffsetUnits={-10} renderOrder={100} position={[0, 0, size.d / 2 + 0.18]} fontSize={size.h * 0.15}
          color="#fff" anchorX="center" anchorY="middle">{fp.reference || ""}</Text>
      </group>
      <ComponentPins3D fp={fp} size={size} mode={isDip ? "header" : "smd_passive"} />
      {isSelected && <SelectionHalo w={size.w} h={size.h} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={size.w} h={size.h} d={size.d} />}
    </group>
  );
};

export const COMPONENT_MAP: Record<string, any> = {
  resistor: Resistor3D, resistor_smd: ResistorSMD3D,
  capacitor_electrolytic: CapacitorElectrolytic3D,
  capacitor_ceramic: CeramicCapacitorDisc3D,
  capacitor_smd: CapacitorSMD3D,
  capacitor_tantalum_smd: TantalumSMD3D,
  led: LED3D, led_smd: SMDLED3D, rgb_led: LED3D,
  ic_dip: IC_DIP3D, ic_soic: IC_SOIC3D, ic_qfp: IC_QFP3D, ic_qfn: IC_QFP3D,
  esp32: ESP32Module3D, esp8266: ESP32Module3D,
  arduino_nano: ArduinoNano3D, arduino_mini: ArduinoNano3D,
  arduino_uno: ArduinoUno3D,
  raspberry_pico: RaspberryPico3D,
  stm32_bluepill: STM32BluePill3D,
  nodemcu: ESP32Module3D,
  oled_display: OLEDDisplay3D, lcd_display: LCDDisplay3D,
  sensor_hcsr04: UltrasonicSensor3D, sensor_dht: DHTSensor3D, sensor_pir: PIRSensor3D,
  button: PushButton3D, switch: PushButton3D,
  potentiometer: Potentiometer3D, trimmer: Potentiometer3D,
  transistor_to92: TransistorTO923D, transistor_to220: TO2203D, transistor_smd: SOT233D, voltage_regulator: TO2203D,
  mosfet: MOSFET3D, mosfet_smd: SOT233D, toggle_switch: ToggleSwitch3D, slide_switch: SlideSwitch3D, dip_switch: DIPSwitch3D,
  header_pin: HeaderPin3D, screw_terminal: ScrewTerminal3D,
  usb_c: USBC3D, usb_micro: USBC3D, usb_a: USBC3D,
  crystal: Crystal3D, buzzer: Buzzer3D, relay: Relay3D, fuse: Fuse3D,
  diode: Diode3D, zener: ZenerDiode3D, inductor: Inductor3D, seven_segment: SevenSegment3D,
  battery_holder: BatteryHolder3D, test_point: TestPoint3D, panel_meter: PanelMeter3D,
  servo_motor: ServoMotor3D, stepper_driver: StepperDriver3D,
};

class GLBErrorBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any) {
    console.warn("3D GLTF load fallback to procedural model:", error);
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export const SmartRenderComponent = ({ model, common, boardThickness, boardHeight = 80 }: any) => {
  const { elevation = 0 } = React.useContext(BoardConfigContext);
  const meas = extractComponentMeasurements(common.fp, boardHeight);
  const pos: [number, number, number] = [meas.x, meas.y, boardThickness / 2 + elevation];
  const rot: [number, number, number] = [0, 0, meas.rotationRad];

  const map = FOOTPRINT_MODEL_MAP[model.type];
  const Fallback = COMPONENT_MAP[model.type] || GenericComponent3D;

  const isFixedType = ["esp32", "esp8266", "nodemcu", "arduino_nano", "arduino_uno", "arduino_mini", "raspberry_pico", "stm32_bluepill", "sensor_dht", "sensor_hcsr04", "sensor_pir", "sensor_mpu", "oled_display", "lcd_display", "seven_segment", "servo_motor", "stepper_driver", "transistor_to92", "transistor_to220", "transistor_smd", "mosfet", "mosfet_smd", "voltage_regulator"].includes(model.type);

  const enhancedSize = {
    ...model,
    w: isFixedType ? (model.w || meas.length || 5) : (meas.length || model.w || 5),
    h: isFixedType ? (model.h || meas.width || 5) : (meas.width || model.h || 5),
    d: model.d || 3,
    mount: meas.packageType,
    orientation: meas.orientation,
    measurements: meas,
  };
  // Normalize axial components (Resistor, Diode, Fuse, Inductor)
  // If their pads are oriented vertically in local space, rotate them by 90 deg
  const isAxial = ["resistor", "diode", "fuse", "inductor"].includes(model.type);
  const finalRot = [...rot] as [number, number, number];

  const isESP = ["esp32", "esp8266", "nodemcu"].includes(model.type) || model.type.includes("esp");
  if (isESP) {
    // Restore original 180 degree global rotation for ESP32
    finalRot[2] += Math.PI;
  }

  const finalSize = { ...enhancedSize };
  let finalFp = { ...common.fp };

  if (isAxial && meas.width > meas.length * 1.2) {
    // Pads are vertical. Rotate the component by 90 degrees on Z
    finalRot[2] += Math.PI / 2;
    // Swap width and length for the model rendering
    finalSize.w = enhancedSize.h;
    finalSize.h = enhancedSize.w;
    
    // Rotate the pads in local space by -90 degrees so they match the rotated component
    if (finalFp.pads && Array.isArray(finalFp.pads)) {
      finalFp = {
        ...finalFp,
        pads: finalFp.pads.map((p: any) => ({
          ...p,
          x: p.y,
          y: -p.x
        }))
      };
    }
  }

  const fallbackNode = (
    <Fallback position={pos} rotation={finalRot} size={finalSize} fp={finalFp}
      isSelected={common.isSelected} isHovered={common.isHovered}
      onSelect={common.onSelect} onHover={common.onHover} color={common.color} />
  );

  if (common.fp.custom3DModel) {
    return (
      <Custom3DModelRenderer 
        url={common.fp.custom3DModel} 
        type={common.fp.custom3DModelType} 
        position={pos} 
        rotation={finalRot} 
        common={common}
        fallback={fallbackNode}
      />
    );
  }

  if (map) {
    return (
      <GLBErrorBoundary fallback={fallbackNode}>
        <Suspense fallback={fallbackNode}>
          <FrustumCulled>
            <GLBComponent url={map.glb} position={pos} rotation={finalRot} fp={finalFp}
              size={finalSize}
              isSelected={common.isSelected} isHovered={common.isHovered}
              onSelect={common.onSelect} onHover={common.onHover} />
          </FrustumCulled>
        </Suspense>
      </GLBErrorBoundary>
    );
  }
  return (
    <FrustumCulled>
      {fallbackNode}
    </FrustumCulled>
  );
};
