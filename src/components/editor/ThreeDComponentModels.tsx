import React from "react";

export interface Component3DModel {
  w: number;
  h: number;
  d: number;
  bodyColor: string;
  type:
    | "ic"
    | "smd_ic"
    | "resistor"
    | "smd_resistor"
    | "capacitor"
    | "smd_capacitor"
    | "led"
    | "button"
    | "terminal"
    | "arduino_nano"
    | "arduino_uno"
    | "esp32"
    | "nodemcu"
    | "rpi_pico"
    | "stm32_bluepill"
    | "diode"
    | "transistor"
    | "potentiometer"
    | "buzzer"
    | "generic";
  offsetX: number;
  offsetY: number;
  isSMD: boolean;
}

export function get3DComponent(fp: any): Component3DModel {
  const isSMD = fp.pads.length > 0 && fp.pads.every((p: any) => p.drill === undefined || p.drill === 0);
  const ref = (fp.reference || "").toUpperCase();
  const val = (fp.value || "").toUpperCase();
  const sym = (fp.symbol || "").toLowerCase();

  const padsX = fp.pads.length > 0 ? fp.pads.map((p: any) => p.x) : [0];
  const padsY = fp.pads.length > 0 ? fp.pads.map((p: any) => p.y) : [0];
  const minX = Math.min(...padsX);
  const maxX = Math.max(...padsX);
  const minY = Math.min(...padsY);
  const maxY = Math.max(...padsY);

  const fpW = maxX - minX;
  const fpH = maxY - minY;

  let w = Math.max(fpW + (isSMD ? 0.4 : 2), 4);
  let h = Math.max(fpH + (isSMD ? 0.4 : 2), 4);
  let d = isSMD ? 1.4 : 3.5;
  let bodyColor = "#1e293b";
  let type: Component3DModel["type"] = "generic";

  const offsetX = (minX + maxX) / 2;
  const offsetY = (minY + maxY) / 2;

  if (sym === "arduino_nano" || sym.includes("nano") || val.includes("NANO") || ref.includes("NANO")) {
    type = "arduino_nano";
    w = 17.8;
    h = 43.2;
    d = 1.6;
    bodyColor = "#0284c7";
  } else if (sym === "arduino_uno" || sym.includes("uno") || val.includes("UNO") || ref.includes("UNO")) {
    type = "arduino_uno";
    w = 53.3;
    h = 68.6;
    d = 1.6;
    bodyColor = "#0284c7";
  } else if (
    sym.includes("esp32") ||
    sym.includes("devkit") ||
    sym.includes("wroom") ||
    val.includes("ESP32") ||
    ref.includes("ESP32")
  ) {
    type = "esp32";
    w = 28.0;
    h = 52.0;
    d = 1.6;
    bodyColor = "#1e293b";
  } else if (
    sym.includes("nodemcu") ||
    sym.includes("esp8266") ||
    val.includes("NODEMCU") ||
    val.includes("ESP8266")
  ) {
    type = "nodemcu";
    w = 25.0;
    h = 48.0;
    d = 1.6;
    bodyColor = "#0f172a";
  } else if (sym.includes("pico") || val.includes("PICO") || ref.includes("PICO")) {
    type = "rpi_pico";
    w = 21.0;
    h = 51.0;
    d = 1.6;
    bodyColor = "#0f7c4a";
  } else if (
    sym.includes("bluepill") ||
    sym.includes("stm32") ||
    val.includes("BLUEPILL") ||
    val.includes("STM32")
  ) {
    type = "stm32_bluepill";
    w = 23.0;
    h = 53.0;
    d = 1.6;
    bodyColor = "#1e3a8a";
  } else if (sym === "led" || ref.startsWith("LED") || val.includes("LED")) {
    type = "led";
    w = Math.max(fpW + 0.5, 3.2);
    h = Math.max(fpH + 0.5, 3.2);
    d = isSMD ? 1.4 : 8.5;
    bodyColor = val.includes("RED")
      ? "rgba(239, 68, 68, 0.85)"
      : val.includes("GREEN")
        ? "rgba(34, 197, 94, 0.85)"
        : val.includes("BLUE")
          ? "rgba(59, 130, 246, 0.85)"
          : "rgba(234, 179, 8, 0.85)";
  } else if (
    sym.includes("diode") ||
    sym === "zener" ||
    sym === "tvs" ||
    sym === "mov" ||
    ref.startsWith("D") ||
    val.includes("DIODE")
  ) {
    type = "diode";
    w = Math.max(fpW - (isSMD ? 0.5 : 2), 5.5);
    h = isSMD ? 2.8 : 2.4;
    d = isSMD ? 1.5 : 2.4;
    bodyColor = "#18181b";
  } else if (
    sym === "resistor" ||
    sym === "var_resistor" ||
    ref.startsWith("R") ||
    val.includes("RES") ||
    val.includes("OHM")
  ) {
    type = isSMD ? "smd_resistor" : "resistor";
    w = Math.max(fpW - (isSMD ? 0.2 : 3), isSMD ? 3.2 : 6.5);
    h = isSMD ? 1.6 : 2.2;
    d = isSMD ? 1.0 : 2.2;
    bodyColor = isSMD ? "#18181b" : "#8ecae6";
  } else if (sym.includes("capacitor") || ref.startsWith("C") || val.includes("CAP") || val.includes("F")) {
    type = isSMD ? "smd_capacitor" : "capacitor";
    w = Math.max(fpW + 0.5, isSMD ? 3.2 : 4.5);
    h = Math.max(fpH + 0.5, isSMD ? 1.6 : 4.5);
    d = isSMD ? 1.2 : 9.0;
    bodyColor = isSMD ? "#b45309" : "#023047";
  } else if (
    sym === "push_button" ||
    sym === "switch" ||
    sym === "dip_switch" ||
    sym === "rotary_switch" ||
    ref.startsWith("SW") ||
    ref.startsWith("BTN") ||
    val.includes("BTN") ||
    val.includes("BUTTON") ||
    val.includes("SWITCH")
  ) {
    type = "button";
    w = Math.max(fpW + 1, 6.0);
    h = Math.max(fpH + 1, 6.0);
    d = 4.0;
    bodyColor = "#d1d5db";
  } else if (
    sym === "screw_terminal" ||
    sym === "header" ||
    sym === "jst" ||
    sym === "usb_c" ||
    sym === "micro_usb" ||
    sym === "dc_jack" ||
    ref.startsWith("J") ||
    ref.startsWith("P") ||
    val.includes("HEADER") ||
    val.includes("CONN") ||
    val.includes("TERMINAL")
  ) {
    type = "terminal";
    w = Math.max(fpW + 1, sym.includes("terminal") ? 10 : 8);
    h = Math.max(fpH + 1, 7.5);
    d = 8.0;
    bodyColor = sym.includes("terminal") ? "#047857" : "#1e3a8a";
  } else if (
    sym === "opamp4" ||
    sym === "lm2596" ||
    sym === "lm1117" ||
    ref.startsWith("U") ||
    ref.includes("IC") ||
    val.includes("555") ||
    val.includes("358")
  ) {
    type = isSMD ? "smd_ic" : "ic";
    w = Math.max(fpW + 1, fp.pads.length === 8 ? 9.5 : fp.pads.length === 14 ? 17.5 : 12);
    h = isSMD ? Math.max(fpH - 1, 5.0) : 6.2;
    d = isSMD ? 1.8 : 3.2;
    bodyColor = "#111827";
  } else if (
    sym === "transistor" ||
    sym === "bjt" ||
    sym === "mosfet" ||
    ref.startsWith("Q") ||
    val.includes("BC547") ||
    val.includes("2N2222") ||
    val.includes("MOSFET")
  ) {
    type = "transistor";
    w = Math.max(fpW + 0.5, 4.5);
    h = Math.max(fpH + 0.5, 3.5);
    d = isSMD ? 1.5 : 5.0;
    bodyColor = "#1f2937";
  } else if (sym.includes("pot") || val.includes("POT") || ref.startsWith("POT") || ref.startsWith("RV")) {
    type = "potentiometer";
    w = Math.max(fpW + 1, 9.5);
    h = Math.max(fpH + 1, 9.5);
    d = 7.0;
    bodyColor = "#059669";
  } else if (
    sym.includes("buzzer") ||
    sym.includes("speaker") ||
    val.includes("BUZZER") ||
    val.includes("SPK") ||
    ref.startsWith("LS") ||
    ref.startsWith("BZ")
  ) {
    type = "buzzer";
    w = Math.max(fpW + 1, 11.0);
    h = Math.max(fpH + 1, 11.0);
    d = 8.5;
    bodyColor = "#09090b";
  }

  return { w, h, d, bodyColor, type, offsetX, offsetY, isSMD };
}

export function renderTopFaceContent(fp: any, model: Component3DModel) {
  const ref = (fp.reference || "").toUpperCase();
  const val = (fp.value || "").toUpperCase();

  if (model.type === "arduino_nano") {
    return (
      <svg viewBox="0 0 80 160" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-90) translate(-160, 0)">
          <rect width="160" height="80" rx="6" fill="#0284c7" stroke="#0369a1" strokeWidth="2" />
          <path
            d="M 10,25 L 50,25 L 60,35 L 140,35 M 10,55 L 40,55 L 50,45 L 140,45"
            fill="none"
            stroke="#0ea5e9"
            strokeWidth="1.2"
            opacity="0.5"
          />
          {Array.from({ length: 15 }).map((_, i) => {
            const x = 8 + i * 10;
            return (
              <g key={`nano-gold-top-${i}`}>
                <rect x={x} y="3" width="6" height="6" rx="1" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
                <circle cx={x + 3} cy="6" r="1" fill="#1e293b" />
              </g>
            );
          })}
          {Array.from({ length: 15 }).map((_, i) => {
            const x = 8 + i * 10;
            return (
              <g key={`nano-gold-bot-${i}`}>
                <rect x={x} y="71" width="6" height="6" rx="1" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
                <circle cx={x + 3} cy="74" r="1" fill="#1e293b" />
              </g>
            );
          })}
          <rect x="0" y="26" width="16" height="28" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
          <rect x="2" y="30" width="12" height="20" rx="1" fill="#334155" />
          <g transform="translate(65, 40) rotate(45)">
            <rect x="-14" y="-14" width="28" height="28" rx="1" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
            <circle cx="-11" cy="-11" r="1" fill="#94a3b8" />
            <text x="0" y="3" fill="#94a3b8" fontSize="5" fontFamily="monospace" textAnchor="middle" transform="rotate(-45)">
              MEGA
            </text>
          </g>
          <rect x="115" y="32" width="16" height="16" rx="2" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
          <circle cx="123" cy="40" r="4" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.5" />
          <text x="35" y="45" fill="#ffffff" fontSize="7" fontWeight="bold" fontFamily="sans-serif">
            NANO
          </text>
          <text x="35" y="53" fill="#ffffff" fontSize="5" fontFamily="sans-serif" opacity="0.8">
            328P/V3
          </text>
          <circle cx="140" cy="22" r="1.5" fill="#22c55e" />
          <text x="140" y="29" fill="#ffffff" fontSize="4.5" fontFamily="monospace" textAnchor="middle">
            ON
          </text>
          <circle cx="140" cy="42" r="1.5" fill="#eab308" />
          <text x="140" y="49" fill="#ffffff" fontSize="4.5" fontFamily="monospace" textAnchor="middle">
            RX
          </text>
          <circle cx="140" cy="58" r="1.5" fill="#eab308" />
          <text x="140" y="65" fill="#ffffff" fontSize="4.5" fontFamily="monospace" textAnchor="middle">
            TX
          </text>
        </g>
      </svg>
    );
  }

  if (model.type === "arduino_uno") {
    return (
      <svg viewBox="0 0 140 200" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-90) translate(-200, 0)">
          <rect width="200" height="140" rx="12" fill="#006699" stroke="#004d73" strokeWidth="2" />
          <path
            d="M 15,30 L 70,30 L 80,40 L 180,40 M 15,110 L 60,110 L 75,95 L 180,95"
            fill="none"
            stroke="#0080bf"
            strokeWidth="1.5"
            opacity="0.4"
          />
          <g transform="translate(60, 10)">
            {Array.from({ length: 10 }).map((_, i) => (
              <rect key={`uno-hdr-top-${i}`} x={i * 10} y="0" width="8" height="10" rx="1.5" fill="#111" stroke="#222" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 10 }).map((_, i) => (
              <circle key={`uno-hdr-top-pin-${i}`} cx={i * 10 + 4} cy="5" r="1.8" fill="#fbbf24" />
            ))}
          </g>
          <g transform="translate(170, 10)">
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={`uno-hdr-top2-${i}`} x={i * 10} y="0" width="8" height="10" rx="1.5" fill="#111" stroke="#222" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <circle key={`uno-hdr-top2-pin-${i}`} cx={i * 10 + 4} cy="5" r="1.8" fill="#fbbf24" />
            ))}
          </g>
          <g transform="translate(60, 120)">
            {Array.from({ length: 8 }).map((_, i) => (
              <rect key={`uno-hdr-bot-${i}`} x={i * 10} y="0" width="8" height="10" rx="1.5" fill="#111" stroke="#222" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 8 }).map((_, i) => (
              <circle key={`uno-hdr-bot-pin-${i}`} cx={i * 10 + 4} cy="5" r="1.8" fill="#fbbf24" />
            ))}
          </g>
          <g transform="translate(150, 120)">
            {Array.from({ length: 6 }).map((_, i) => (
              <rect key={`uno-hdr-bot2-${i}`} x={i * 10} y="0" width="8" height="10" rx="1.5" fill="#111" stroke="#222" strokeWidth="0.5" />
            ))}
            {Array.from({ length: 6 }).map((_, i) => (
              <circle key={`uno-hdr-bot2-pin-${i}`} cx={i * 10 + 4} cy="5" r="1.8" fill="#fbbf24" />
            ))}
          </g>
          <rect x="0" y="20" width="40" height="35" rx="3" fill="#cbd5e1" stroke="#475569" strokeWidth="1.5" />
          <rect x="5" y="25" width="30" height="25" fill="#e2e8f0" stroke="#94a3b8" />
          <rect x="12" y="30" width="16" height="15" fill="#334155" />
          <rect x="0" y="85" width="45" height="40" rx="4" fill="#09090b" stroke="#27272a" strokeWidth="1.5" />
          <circle cx="22" cy="105" r="10" fill="#18181b" stroke="#3f3f46" />
          <circle cx="22" cy="105" r="4.5" fill="#09090b" />
          <g transform="translate(80, 50)">
            <rect x="0" y="0" width="100" height="36" rx="2" fill="#18181b" stroke="#000" strokeWidth="1.5" />
            {Array.from({ length: 14 }).map((_, i) => (
              <rect key={`dip-pin-top-${i}`} x={8 + i * 6.5} y="1" width="3.5" height="5" fill="#3f3f46" />
            ))}
            {Array.from({ length: 14 }).map((_, i) => (
              <rect key={`dip-pin-bot-${i}`} x={8 + i * 6.5} y="30" width="3.5" height="5" fill="#3f3f46" />
            ))}
            <rect x="5" y="4" width="90" height="28" rx="1" fill="#09090b" stroke="#1f2937" />
            <path d="M 5,14 A 4,4 0 0,1 5,22 Z" fill="#020617" />
            <circle cx="12" cy="8" r="1.5" fill="#4b5563" />
            <text x="50" y="20" fill="#a1a1aa" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle" letterSpacing="1">
              ATMEGA328P-PU
            </text>
          </g>
          <ellipse cx="65" cy="72" rx="10" ry="5" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
          <text x="65" y="75" fill="#64748b" fontSize="6.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
            16.000
          </text>
          <rect x="15" y="8" width="15" height="15" rx="1" fill="#a1a1aa" stroke="#52525b" />
          <circle cx="22.5" cy="15.5" r="4.5" fill="#ef4444" stroke="#b91c1c" />
          <g transform="translate(145, 105)">
            <path
              d="M -10,0 C -15,5 -20,5 -25,0 C -20,-5 -15,-5 -10,0 Z M -25,0 C -30,5 -35,5 -40,0 C -35,-5 -30,-5 -25,0 Z"
              fill="none"
              stroke="#60a5fa"
              strokeWidth="2.5"
              transform="scale(0.8) translate(35, -5)"
            />
            <text x="0" y="0" fill="#ffffff" fontSize="14" fontWeight="bold" fontFamily="sans-serif" letterSpacing="0.5">
              UNO
            </text>
          </g>
          <text x="145" y="115" fill="#ffffff" fontSize="7.5" fontFamily="sans-serif" opacity="0.8">
            R3 / ARDUINO
          </text>
          <text x="100" y="105" fill="#60a5fa" fontSize="7" fontFamily="sans-serif">
            MADE IN ITALY
          </text>
        </g>
      </svg>
    );
  }

  if (model.type === "esp32") {
    return (
      <svg viewBox="0 0 100 160" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-90) translate(-160, 0)">
          <rect width="160" height="100" rx="8" fill="#18181b" stroke="#27272a" strokeWidth="2" />
          {Array.from({ length: 19 }).map((_, i) => {
            const y = 8 + i * 4.6;
            return (
              <g key={`esp-gold-left-${i}`}>
                <rect x="4" y={y} width="6" height="4.5" rx="0.5" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
                <circle cx="7" cy={y + 2.25} r="1" fill="#18181b" />
              </g>
            );
          })}
          {Array.from({ length: 19 }).map((_, i) => {
            const y = 8 + i * 4.6;
            return (
              <g key={`esp-gold-right-${i}`}>
                <rect x="150" y={y} width="6" height="4.5" rx="0.5" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
                <circle cx="153" cy={y + 2.25} r="1" fill="#18181b" />
              </g>
            );
          })}
          <g transform="translate(42, 10)">
            <rect width="76" height="60" rx="3" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1.5" />
            <rect x="1" y="1" width="74" height="15" fill="#09090b" rx="1" />
            <path
              d="M 5,8 L 10,4 L 15,8 L 20,4 L 25,8 L 30,4 L 35,8 L 40,4 L 45,8 L 50,4 L 55,8 L 60,4 L 65,8 M 65,4"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1"
              opacity="0.8"
            />
            <text x="38" y="28" fill="#475569" fontSize="6.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
              ESPRESSIF
            </text>
            <text x="38" y="38" fill="#334155" fontSize="8" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
              ESP32-WROOM-32E
            </text>
            <text x="38" y="48" fill="#64748b" fontSize="5" fontFamily="monospace" textAnchor="middle">
              FCC ID: 2AC7Z-ESPWROOM32
            </text>
            <circle cx="65" cy="50" r="4" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
            <path d="M 63,50 L 67,50 M 65,48 L 65,52" stroke="#94a3b8" strokeWidth="0.5" />
          </g>
          <rect x="68" y="78" width="24" height="16" rx="1.5" fill="#0f172a" stroke="#1e293b" />
          <circle cx="72" cy="81" r="0.7" fill="#cbd5e1" />
          <text x="80" y="88" fill="#94a3b8" fontSize="4.5" fontFamily="monospace" textAnchor="middle">
            CP2102
          </text>
          <g transform="translate(24, 76)">
            <rect width="14" height="14" rx="1.5" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
            <circle cx="7" cy="7" r="3.5" fill="#475569" />
            <text x="7" y="-2" fill="#ffffff" fontSize="4.5" fontFamily="sans-serif" textAnchor="middle">
              EN
            </text>
          </g>
          <g transform="translate(122, 76)">
            <rect width="14" height="14" rx="1.5" fill="#94a3b8" stroke="#475569" strokeWidth="1" />
            <circle cx="7" cy="7" r="3.5" fill="#475569" />
            <text x="7" y="-2" fill="#ffffff" fontSize="4.5" fontFamily="sans-serif" textAnchor="middle">
              BOOT
            </text>
          </g>
          <rect x="65" y="93" width="30" height="7" rx="1" fill="#cbd5e1" stroke="#475569" strokeWidth="0.8" />
          <rect x="70" y="95" width="20" height="5" rx="0.5" fill="#1e293b" />
          <circle cx="120" cy="91" r="1.5" fill="#ef4444" />
          <circle cx="128" cy="91" r="1.5" fill="#3b82f6" />
        </g>
      </svg>
    );
  }

  if (model.type === "nodemcu") {
    return (
      <svg viewBox="0 0 100 160" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-90) translate(-160, 0)">
          <rect width="160" height="100" rx="8" fill="#0f172a" stroke="#1e293b" strokeWidth="2" />
          {Array.from({ length: 15 }).map((_, i) => {
            const y = 12 + i * 5.6;
            return (
              <g key={`nodemcu-left-${i}`}>
                <rect x="5" y={y} width="5" height="5" rx="0.5" fill="#fbbf24" stroke="#d97706" />
                <circle cx="7.5" cy={y + 2.5} r="1.2" fill="#0f172a" />
              </g>
            );
          })}
          {Array.from({ length: 15 }).map((_, i) => {
            const y = 12 + i * 5.6;
            return (
              <g key={`nodemcu-right-${i}`}>
                <rect x="150" y={y} width="5" height="5" rx="0.5" fill="#fbbf24" stroke="#d97706" />
                <circle cx="152.5" cy={y + 2.5} r="1.2" fill="#0f172a" />
              </g>
            );
          })}
          <g transform="translate(45, 12)">
            <rect x="0" y="15" width="70" height="50" rx="2" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
            <rect x="0" y="0" width="70" height="15" fill="#1e3a8a" rx="1" />
            <path
              d="M 5,7.5 L 12,3 L 19,7.5 L 26,3 L 33,7.5 L 40,3 L 47,7.5 L 54,3 L 61,7.5"
              fill="none"
              stroke="#f59e0b"
              strokeWidth="1"
              opacity="0.8"
            />
            <rect x="52" y="45" width="12" height="12" fill="#334155" opacity="0.3" rx="1" />
            <text x="35" y="32" fill="#475569" fontSize="7" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
              AI-THINKER
            </text>
            <text x="35" y="44" fill="#334155" fontSize="9" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
              ESP-12F
            </text>
            <text x="35" y="55" fill="#64748b" fontSize="5.5" fontFamily="monospace" textAnchor="middle">
              ISM 2.4GHz
            </text>
          </g>
          <rect x="68" y="72" width="24" height="16" rx="1.5" fill="#18181b" stroke="#27272a" />
          <text x="80" y="82" fill="#a1a1aa" fontSize="5" fontFamily="monospace" textAnchor="middle">
            SILABS
          </text>
          <rect x="25" y="78" width="12" height="12" rx="1" fill="#cbd5e1" stroke="#475569" />
          <circle cx="31" cy="84" r="3" fill="#3b82f6" />
          <text x="31" y="95" fill="#ffffff" fontSize="4.5" textAnchor="middle">
            RST
          </text>
          <rect x="123" y="78" width="12" height="12" rx="1" fill="#cbd5e1" stroke="#475569" />
          <circle cx="129" cy="84" r="3" fill="#cbd5e1" />
          <text x="129" y="95" fill="#ffffff" fontSize="4.5" textAnchor="middle">
            FLASH
          </text>
          <rect x="65" y="93" width="30" height="7" rx="1" fill="#cbd5e1" stroke="#475569" />
          <rect x="70" y="95" width="20" height="5" fill="#18181b" />
          <text x="80" y="8" fill="#ffffff" fontSize="7.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
            NodeMCU
          </text>
        </g>
      </svg>
    );
  }

  if (model.type === "rpi_pico") {
    return (
      <svg viewBox="0 0 64 160" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-90) translate(-160, 0)">
          <rect width="160" height="64" rx="5" fill="#0f7c4a" stroke="#095231" strokeWidth="2" />
          <path d="M 12,12 C 50,12 80,42 148,42" fill="none" stroke="#12a161" strokeWidth="1.2" opacity="0.4" />
          <path d="M 12,52 C 50,52 80,22 148,22" fill="none" stroke="#12a161" strokeWidth="1.2" opacity="0.4" />
          {Array.from({ length: 20 }).map((_, i) => {
            const x = 12 + i * 7.0;
            return (
              <g key={`pico-pads-top-${i}`}>
                <rect x={x} y="0" width="4.5" height="5.5" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
                <path d={`M ${x},5.5 Q ${x + 2.25},1.5 ${x + 4.5},5.5`} fill="#0f7c4a" />
              </g>
            );
          })}
          {Array.from({ length: 20 }).map((_, i) => {
            const x = 12 + i * 7.0;
            return (
              <g key={`pico-pads-bot-${i}`}>
                <rect x={x} y="58.5" width="4.5" height="5.5" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
                <path d={`M ${x},58.5 Q ${x + 2.25},62.5 ${x + 4.5},58.5`} fill="#0f7c4a" />
              </g>
            );
          })}
          <rect x="0" y="20" width="15" height="24" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
          <rect x="2" y="24" width="10" height="16" rx="0.5" fill="#1e293b" />
          <rect x="62" y="14" width="36" height="36" rx="2.5" fill="#18181b" stroke="#000" strokeWidth="1.5" />
          <circle cx="66" cy="18" r="1" fill="#cbd5e1" />
          <path d="M 80,20 Q 72,25 80,30 Q 88,25 80,20" fill="#ef4444" stroke="#b91c1c" strokeWidth="0.5" />
          <path d="M 78,18 Q 80,15 82,18" fill="none" stroke="#22c55e" strokeWidth="1" />
          <text x="80" y="38" fill="#e2e8f0" fontSize="5.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
            RP2040
          </text>
          <text x="80" y="44" fill="#94a3b8" fontSize="4" fontFamily="monospace" textAnchor="middle">
            YYWWXXXX
          </text>
          <rect x="35" y="24" width="12" height="12" rx="1.5" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
          <circle cx="41" cy="30" r="3.2" fill="#ffffff" stroke="#cbd5e1" strokeWidth="0.5" />
          <text x="41" y="42" fill="#ffffff" fontSize="4.5" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
            BOOTSEL
          </text>
          <rect x="115" y="24" width="16" height="16" rx="1.5" fill="#18181b" stroke="#09090b" />
          <text x="123" y="34" fill="#a1a1aa" fontSize="4.5" fontFamily="monospace" textAnchor="middle">
            FLASH
          </text>
          <text x="80" y="55" fill="#ffffff" fontSize="6" fontWeight="bold" fontFamily="sans-serif" textAnchor="middle">
            Raspberry Pi Pico
          </text>
          <text
            x="145"
            y="34"
            fill="#ffffff"
            fontSize="5"
            fontFamily="monospace"
            textAnchor="middle"
            transform="rotate(90, 145, 34)"
          >
            2020
          </text>
        </g>
      </svg>
    );
  }

  if (model.type === "stm32_bluepill") {
    return (
      <svg viewBox="0 0 64 160" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <g transform="rotate(-90) translate(-160, 0)">
          <rect width="160" height="64" rx="4" fill="#1e3a8a" stroke="#1d4ed8" strokeWidth="2" />
          {Array.from({ length: 20 }).map((_, i) => {
            const x = 10 + i * 7.0;
            return (
              <g key={`bluepill-top-${i}`}>
                <rect x={x} y="3" width="5.5" height="5.5" rx="1" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
                <circle cx={x + 2.75} cy="5.75" r="1.2" fill="#1e3a8a" />
              </g>
            );
          })}
          {Array.from({ length: 20 }).map((_, i) => {
            const x = 10 + i * 7.0;
            return (
              <g key={`bluepill-bot-${i}`}>
                <rect x={x} y="55.5" width="5.5" height="5.5" rx="1" fill="#fbbf24" stroke="#d97706" strokeWidth="0.5" />
                <circle cx={x + 2.75} cy="58.25" r="1.2" fill="#1e3a8a" />
              </g>
            );
          })}
          <rect x="0" y="20" width="14" height="24" rx="2" fill="#cbd5e1" stroke="#475569" strokeWidth="1" />
          <rect x="2" y="24" width="10" height="16" rx="0.5" fill="#1e293b" />
          <g transform="translate(68, 32) rotate(45)">
            <rect x="-14" y="-14" width="28" height="28" rx="1" fill="#111827" stroke="#000" strokeWidth="1" />
            <circle cx="-11" cy="-11" r="0.8" fill="#cbd5e1" />
            <text
              x="0"
              y="1"
              fill="#94a3b8"
              fontSize="4.2"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
              transform="rotate(-45)"
            >
              STM32
            </text>
            <text
              x="0"
              y="6"
              fill="#64748b"
              fontSize="3"
              fontFamily="monospace"
              textAnchor="middle"
              transform="rotate(-45)"
            >
              F103C8
            </text>
          </g>
          <g transform="translate(24, 20)">
            <rect width="18" height="10" rx="1" fill="#0f172a" stroke="#27272a" strokeWidth="0.8" />
            <rect x="2" y="1" width="5" height="8" rx="0.5" fill="#facc15" stroke="#ca8a04" strokeWidth="0.5" />
            <rect x="11" y="1" width="5" height="8" rx="0.5" fill="#facc15" stroke="#ca8a04" strokeWidth="0.5" />
            <text x="9" y="16" fill="#ffffff" fontSize="4.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
              BOOT
            </text>
          </g>
          <ellipse cx="120" cy="22" rx="9" ry="4" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />
          <ellipse cx="120" cy="42" rx="6" ry="2.5" fill="#94a3b8" stroke="#475569" strokeWidth="0.5" />
          <circle cx="142" cy="26" r="1.3" fill="#ef4444" />
          <circle cx="142" cy="38" r="1.3" fill="#22c55e" />
          <text x="95" y="16" fill="#ffffff" fontSize="5.5" fontWeight="bold" fontFamily="sans-serif">
            STM32 Blue Pill
          </text>
          <text x="45" y="50" fill="#ffffff" fontSize="5" fontFamily="monospace">
            RST
          </text>
          <circle cx="53" cy="48" r="2.5" fill="#cbd5e1" stroke="#475569" strokeWidth="0.5" />
        </g>
      </svg>
    );
  }

  if (model.type === "ic") {
    return (
      <svg viewBox="0 0 100 65" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="65" rx="4" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
        <path d="M 0,25 A 7.5,7.5 0 0,0 0,40 Z" fill="#09090b" stroke="#27272a" strokeWidth="1" />
        <circle cx="10" cy="12" r="3.5" fill="#09090b" stroke="#3f3f46" strokeWidth="0.5" />
        <text
          x="52"
          y="26"
          fill="#a1a1aa"
          fontSize="11"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
          letterSpacing="0.8"
        >
          {val || "NE555P"}
        </text>
        <text x="52" y="42" fill="#71717a" fontSize="7.5" fontFamily="monospace" textAnchor="middle">
          {ref || "U1"} • CHN
        </text>
        <text x="52" y="52" fill="#52525b" fontSize="5.5" fontFamily="monospace" textAnchor="middle">
          ST e4 26A32
        </text>
      </svg>
    );
  }

  if (model.type === "smd_ic") {
    return (
      <svg viewBox="0 0 100 70" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <rect width="100" height="70" rx="3" fill="#111827" stroke="#374151" strokeWidth="1.5" />
        <circle cx="12" cy="14" r="3.5" fill="#030712" stroke="#4b5563" strokeWidth="0.5" />
        <text
          x="54"
          y="30"
          fill="#e2e8f0"
          fontSize="11"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
          letterSpacing="0.5"
        >
          {val || "SMD-IC"}
        </text>
        <text x="54" y="46" fill="#94a3b8" fontSize="8" fontFamily="monospace" textAnchor="middle">
          {ref || "U1"} • SMD
        </text>
        <rect x="0" y="2" width="100" height="4" fill="#ffffff" opacity="0.12" />
      </svg>
    );
  }

  if (model.type === "resistor") {
    let bands = ["#78350f", "#000000", "#ea580c", "#fbbf24"];
    const uVal = val.toUpperCase();
    if (uVal.includes("220")) {
      bands = ["#ef4444", "#ef4444", "#78350f", "#fbbf24"];
    } else if (uVal.includes("1K") || uVal.includes("1000")) {
      bands = ["#78350f", "#000000", "#ef4444", "#fbbf24"];
    } else if (uVal.includes("100")) {
      bands = ["#78350f", "#000000", "#78350f", "#fbbf24"];
    } else if (uVal.includes("470")) {
      bands = ["#eab308", "#8b5cf6", "#78350f", "#fbbf24"];
    } else if (uVal.includes("4.7K") || uVal.includes("4K7")) {
      bands = ["#eab308", "#8b5cf6", "#ea580c", "#fbbf24"];
    } else if (uVal.includes("100K")) {
      bands = ["#78350f", "#000000", "#eab308", "#fbbf24"];
    }

    return (
      <svg viewBox="0 0 65 24" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <rect width="65" height="24" rx="10" fill="#a5f3fc" stroke="#06b6d4" strokeWidth="1" />
        <rect x="12" y="0" width="3.5" height="24" fill={bands[0]} />
        <rect x="22" y="0" width="3.5" height="24" fill={bands[1]} />
        <rect x="32" y="0" width="3.5" height="24" fill={bands[2]} />
        <rect x="45" y="0" width="3.5" height="24" fill={bands[3]} />
        <rect x="0" y="2" width="65" height="4" fill="#ffffff" opacity="0.25" rx="2" />
      </svg>
    );
  }

  if (model.type === "smd_resistor") {
    return (
      <svg viewBox="0 0 50 24" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <rect width="50" height="24" rx="1.5" fill="#18181b" stroke="#27272a" strokeWidth="1" />
        <rect x="0" y="0" width="8" height="24" fill="#cbd5e1" />
        <rect x="42" y="0" width="8" height="24" fill="#cbd5e1" />
        <text x="25" y="16" fill="#f8fafc" fontSize="10" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
          {val.length <= 4 ? val : "103"}
        </text>
      </svg>
    );
  }

  if (model.type === "capacitor") {
    return (
      <svg viewBox="0 0 35 35" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="17.5" cy="17.5" r="17" fill="#0f172a" stroke="#334155" strokeWidth="1" />
        <path d="M 0,17.5 A 17.5,17.5 0 0,1 12,2 L 12,33 A 17.5,17.5 0 0,1 0,17.5 Z" fill="#cbd5e1" />
        <text x="6" y="10" fill="#0f172a" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
          -
        </text>
        <text x="6" y="20" fill="#0f172a" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
          -
        </text>
        <text x="6" y="30" fill="#0f172a" fontSize="6" fontWeight="bold" textAnchor="middle" fontFamily="sans-serif">
          -
        </text>
        <text x="23" y="16" fill="#e2e8f0" fontSize="5" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
          {val || "47µF"}
        </text>
        <text x="23" y="24" fill="#94a3b8" fontSize="4.2" textAnchor="middle" fontFamily="monospace">
          25V
        </text>
      </svg>
    );
  }

  if (model.type === "smd_capacitor") {
    return (
      <svg viewBox="0 0 45 25" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <rect width="45" height="25" rx="2" fill="#b45309" stroke="#92400e" strokeWidth="1" />
        <rect x="0" y="0" width="8" height="25" fill="#cbd5e1" />
        <rect x="37" y="0" width="8" height="25" fill="#cbd5e1" />
        <rect x="0" y="2" width="45" height="4" fill="#ffffff" opacity="0.25" />
      </svg>
    );
  }

  if (model.type === "led") {
    const isRed = val.includes("RED") || ref.includes("RED");
    const isGreen = val.includes("GREEN") || ref.includes("GREEN");
    const isBlue = val.includes("BLUE") || ref.includes("BLUE");
    const bulbColor = isRed ? "#ef4444" : isGreen ? "#22c55e" : isBlue ? "#3b82f6" : "#eab308";
    const lightGlow = isRed ? "#fca5a5" : isGreen ? "#86efac" : isBlue ? "#93c5fd" : "#fef08a";

    return (
      <svg viewBox="0 0 32 32" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="16" cy="16" r="15.5" fill={bulbColor} stroke={lightGlow} strokeWidth="1" opacity="0.9" />
        <path
          d="M 11,10 L 11,22 L 14,22 L 14,14 L 11,10"
          fill="#94a3b8"
          stroke="#cbd5e1"
          strokeWidth="0.5"
          opacity="0.6"
        />
        <path
          d="M 18,10 L 22,14 L 22,22 L 18,22 L 18,10"
          fill="#94a3b8"
          stroke="#cbd5e1"
          strokeWidth="0.5"
          opacity="0.6"
        />
        <line x1="14" y1="14" x2="18" y2="10" stroke="#fef08a" strokeWidth="0.8" opacity="0.75" />
        <ellipse cx="11" cy="11" rx="4" ry="3" fill="#ffffff" opacity="0.5" transform="rotate(-30, 11, 11)" />
        <circle cx="16" cy="16" r="12" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.2" />
      </svg>
    );
  }

  if (model.type === "diode") {
    return (
      <svg viewBox="0 0 55 22" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <rect width="55" height="22" rx="3" fill="#18181b" stroke="#27272a" strokeWidth="1" />
        <rect x="10" y="0" width="6" height="22" fill="#cbd5e1" />
        <line x1="13" y1="2" x2="13" y2="20" stroke="#94a3b8" strokeWidth="1" />
        <text x="35" y="11" fill="#71717a" fontSize="6.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
          {val || "1N4007"}
        </text>
        <text x="35" y="18" fill="#52525b" fontSize="5" fontFamily="monospace" textAnchor="middle">
          {ref}
        </text>
        <rect x="0" y="2" width="55" height="3" fill="#ffffff" opacity="0.15" rx="1.5" />
      </svg>
    );
  }

  if (model.type === "button") {
    return (
      <svg viewBox="0 0 60 60" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <rect width="60" height="60" rx="6" fill="#e4e4e7" stroke="#a1a1aa" strokeWidth="2" />
        <circle cx="30" cy="30" r="21" fill="#d4d4d8" stroke="#71717a" strokeWidth="1" />
        <circle cx="30" cy="30" r="14" fill="#18181b" stroke="#09090b" strokeWidth="1.5" />
        <ellipse cx="26" cy="26" rx="4" ry="2" fill="#ffffff" opacity="0.25" />
        <circle cx="6" cy="6" r="2.5" fill="#a1a1aa" />
        <circle cx="54" cy="6" r="2.5" fill="#a1a1aa" />
        <circle cx="6" cy="54" r="2.5" fill="#a1a1aa" />
        <circle cx="54" cy="54" r="2.5" fill="#a1a1aa" />
      </svg>
    );
  }

  if (model.type === "terminal") {
    const isGreen = model.bodyColor === "#047857";
    return (
      <svg viewBox="0 0 80 65" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <rect
          width="80"
          height="65"
          rx="3"
          fill={isGreen ? "#047857" : "#1d4ed8"}
          stroke={isGreen ? "#064e3b" : "#1e3a8a"}
          strokeWidth="2"
        />
        <g transform="translate(10, 8)">
          <rect
            width="25"
            height="36"
            rx="2"
            fill={isGreen ? "#064e3b" : "#172554"}
            stroke={isGreen ? "#064e3b" : "#1e3a8a"}
            strokeWidth="1"
          />
          <circle cx="12.5" cy="18" r="9" fill="#ca8a04" stroke="#854d0e" strokeWidth="1" />
          <line x1="6.5" y1="18" x2="18.5" y2="18" stroke="#451a03" strokeWidth="2.2" />
        </g>
        <g transform="translate(45, 8)">
          <rect
            width="25"
            height="36"
            rx="2"
            fill={isGreen ? "#064e3b" : "#172554"}
            stroke={isGreen ? "#064e3b" : "#1e3a8a"}
            strokeWidth="1"
          />
          <circle cx="12.5" cy="18" r="9" fill="#ca8a04" stroke="#854d0e" strokeWidth="1" />
          <line x1="6.5" y1="18" x2="18.5" y2="18" stroke="#451a03" strokeWidth="2.2" />
        </g>
        <rect x="12" y="50" width="20" height="15" rx="1" fill="#94a3b8" />
        <rect x="48" y="50" width="20" height="15" rx="1" fill="#94a3b8" />
      </svg>
    );
  }

  if (model.type === "transistor") {
    return (
      <svg viewBox="0 0 45 35" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <path d="M 5,30 A 17,17 0 0,1 40,30 L 35,5 L 10,5 Z" fill="#111827" stroke="#374151" strokeWidth="1" />
        <text
          x="22.5"
          y="15"
          fill="#e2e8f0"
          fontSize="6.5"
          fontWeight="bold"
          fontFamily="monospace"
          textAnchor="middle"
        >
          {val.slice(0, 7) || "TO-92"}
        </text>
        <text x="22.5" y="24" fill="#64748b" fontSize="4.5" fontFamily="monospace" textAnchor="middle">
          {ref}
        </text>
      </svg>
    );
  }

  if (model.type === "potentiometer") {
    return (
      <svg viewBox="0 0 60 60" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="28" fill="#065f46" stroke="#044e39" strokeWidth="1.5" />
        <circle cx="30" cy="30" r="16" fill="#cbd5e1" stroke="#94a3b8" strokeWidth="1" />
        <rect x="27.5" y="10" width="5" height="15" fill="#475569" rx="1" transform="rotate(45, 30, 30)" />
        <circle cx="30" cy="30" r="4" fill="#64748b" />
        <text x="30" y="52" fill="#a7f3d0" fontSize="7.5" fontWeight="bold" fontFamily="monospace" textAnchor="middle">
          {val || "10K"}
        </text>
      </svg>
    );
  }

  if (model.type === "buzzer") {
    return (
      <svg viewBox="0 0 60 60" className="w-full h-full select-none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="28" fill="#18181b" stroke="#27272a" strokeWidth="1.5" />
        <circle cx="30" cy="30" r="7" fill="#09090b" stroke="#18181b" strokeWidth="1" />
        <text x="48" y="24" fill="#ef4444" fontSize="12" fontWeight="bold" textAnchor="middle">
          +
        </text>
        <text x="30" y="48" fill="#71717a" fontSize="6.5" fontFamily="monospace" textAnchor="middle">
          REMOVE SEAL
        </text>
        <text x="30" y="15" fill="#52525b" fontSize="5" fontFamily="monospace" textAnchor="middle">
          {ref}
        </text>
      </svg>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-[8px] font-sans font-bold select-none text-white/90">
      <span className="scale-75">{ref}</span>
      <span className="text-[6px] opacity-75 scale-75">{val}</span>
    </div>
  );
}
