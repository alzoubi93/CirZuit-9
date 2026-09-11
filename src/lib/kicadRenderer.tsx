/**
 * Native KiCad symbol renderer.
 *
 * Important architectural rule: this renderer consumes the KiCad object model
 * directly. SymbolDef is only a legacy adapter used by the existing CirZuit
 * placement code; it is never used to calculate native KiCad geometry.
 */
import React from "react";
import type { JSX } from "react";
import type {
  KiCadParsedSymbol,
  KiCadGraphic,
  KiCadPin,
  KicadTextEffects,
} from "./kicadSymbol";
import { WORLD_UNITS_PER_KICAD_MM, kicadMmToWorld, kicadPointToWorld } from "./kicadCoordinateSystem";

const DEFAULT_STROKE_MM = 0.1524;
const EPS = 1e-9;

function strokeWidth(mm: number): number {
  const w = kicadMmToWorld(mm > 0 ? mm : DEFAULT_STROKE_MM);
  // Keep a minimum visible stroke so small library thumbnails are not blank.
  return Math.max(w, 0.035);
}

function fillAttr(fill: any): string {
  if (!fill || fill.type === "none" || fill.type === "outline") return "none";
  // KiCad "background" is the symbol body fill. Pure white becomes invisible
  // on light themes and looks like empty white blocks in library previews.
  // Use a soft neutral that stays visible on both light and dark canvases.
  if (fill.type === "background") return "rgba(148, 163, 184, 0.22)";
  if (fill.type === "color" && fill.color) {
    const c = fill.color;
    if (typeof c === "string") return c;
    if (Array.isArray(c) && c.length >= 3) {
      const [r, g, b, a = 1] = c;
      return `rgba(${r},${g},${b},${a})`;
    }
  }
  return "none";
}

function point(p: { x: number; y: number }, bbox: any) {
  return kicadPointToWorld(p, bbox);
}

function pinBodyEnd(pin: KiCadPin) {
  // KiCad pin `at` is the electrical connection point. The pin body extends
  // in the direction specified by `angle` for `length` millimetres.
  const r = (pin.at.angle * Math.PI) / 180;
  return {
    x: pin.at.x + Math.cos(r) * pin.length,
    y: pin.at.y + Math.sin(r) * pin.length,
  };
}

function collectUnit(sym: KiCadParsedSymbol, unit: number, style: number) {
  // Unit 0 is shared/common geometry across units.
  // Style 0 is shared/common geometry across body styles (convert=0).
  const common = sym.units.filter(
    (u) => u.unit === 0 && (u.style === 0 || u.style === style || u.style === 1),
  );
  const selected = sym.units.filter(
    (u) => u.unit === unit && (u.style === 0 || u.style === style || u.style === 1),
  );

  const gList = [
    ...common.flatMap((u) => u.graphics),
    ...selected.flatMap((u) => u.graphics),
  ];
  const pList = [
    ...common.flatMap((u) => u.pins),
    ...selected.flatMap((u) => u.pins),
  ];

  return {
    graphics: gList.length ? gList : sym.bodyGraphics,
    pins: pList.length ? pList : sym.pins,
  };
}

function bounds(
  sym: KiCadParsedSymbol,
  graphics: KiCadGraphic[],
  pins: KiCadPin[],
) {
  if (sym.bbox && Number.isFinite(sym.bbox.minX) && Number.isFinite(sym.bbox.maxX)) {
    return sym.bbox;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  const add = (x: number, y: number) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const g of graphics) {
    if (g.type === "polyline" || g.type === "bezier") {
      g.pts.forEach((p) => add(p.x, p.y));
    } else if (g.type === "rectangle") {
      add(g.start.x, g.start.y);
      add(g.end.x, g.end.y);
    } else if (g.type === "circle") {
      add(g.center.x - g.radius, g.center.y - g.radius);
      add(g.center.x + g.radius, g.center.y + g.radius);
    } else if (g.type === "arc") {
      add(g.start.x, g.start.y);
      add(g.mid.x, g.mid.y);
      add(g.end.x, g.end.y);
    } else if (g.type === "text" && !g.hide) {
      add(g.at.x, g.at.y);
    }
  }

  for (const p of pins) {
    if (p.hide) continue;
    add(p.at.x, p.at.y);
    const end = pinBodyEnd(p);
    add(end.x, end.y);
  }

  if (!Number.isFinite(minX)) return { minX: -2.54, minY: -2.54, maxX: 2.54, maxY: 2.54 };
  const pad = 0.254;
  return {
    minX: minX - pad,
    minY: minY - pad,
    maxX: maxX + pad,
    maxY: maxY + pad,
  };
}

function arcPath(start: any, mid: any, end: any, bbox: any): string {
  const a = point(start, bbox);
  const b = point(mid, bbox);
  const c = point(end, bbox);

  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < EPS) return `M ${a.x} ${a.y} L ${c.x} ${c.y}`;

  const ux =
    ((a.x * a.x + a.y * a.y) * (b.y - c.y) +
      (b.x * b.x + b.y * b.y) * (c.y - a.y) +
      (c.x * c.x + c.y * c.y) * (a.y - b.y)) /
    d;
  const uy =
    ((a.x * a.x + a.y * a.y) * (c.x - b.x) +
      (b.x * b.x + b.y * b.y) * (a.x - c.x) +
      (c.x * c.x + c.y * c.y) * (b.x - a.x)) /
    d;

  const radius = Math.hypot(a.x - ux, a.y - uy);
  const a0 = Math.atan2(a.y - uy, a.x - ux);
  const am = Math.atan2(b.y - uy, b.x - ux);
  const a2 = Math.atan2(c.y - uy, c.x - ux);

  // Determine the signed sweep that passes through the midpoint. This avoids
  // the common bug where a valid KiCad arc is rendered as the complementary
  // (wrong) arc.
  const normalize = (v: number) => {
    let x = v;
    while (x <= -Math.PI) x += 2 * Math.PI;
    while (x > Math.PI) x -= 2 * Math.PI;
    return x;
  };
  let sweep = normalize(am - a0);
  const endDelta = normalize(a2 - a0);
  if (Math.abs(sweep) < EPS) sweep = endDelta;
  if (Math.abs(endDelta) > EPS && Math.sign(sweep) !== Math.sign(endDelta)) {
    sweep = sweep > 0 ? sweep - 2 * Math.PI : sweep + 2 * Math.PI;
  }

  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  const sweepFlag = sweep >= 0 ? 1 : 0;
  return `M ${a.x} ${a.y} A ${radius} ${radius} 0 ${largeArc} ${sweepFlag} ${c.x} ${c.y}`;
}

function renderText(
  value: string,
  effects: KicadTextEffects,
  x: number,
  y: number,
  rotate: number,
  key: string,
  color: string,
) {
  if (!value || effects.hidden) return null;

  const size = kicadMmToWorld(
    effects.font.size.y || effects.font.size.x || 1.27,
  );
  const anchor =
    effects.justify.horizontal === "left"
      ? "start"
      : effects.justify.horizontal === "right"
        ? "end"
        : "middle";
  const baseline =
    effects.justify.vertical === "top"
      ? "text-before-edge"
      : effects.justify.vertical === "bottom"
        ? "text-after-edge"
        : "middle";

  return (
    <g
      key={key}
      transform={`translate(${x} ${y}) rotate(${rotate})${effects.justify.mirror ? " scale(-1,1)" : ""}`}
    >
      <text
        x={0}
        y={0}
        fontSize={size}
        textAnchor={anchor}
        dominantBaseline={baseline}
        fontWeight={effects.font.bold ? "bold" : "normal"}
        fontStyle={effects.font.italic ? "italic" : "normal"}
        fill={color}
        stroke="none"
      >
        {value}
      </text>
    </g>
  );
}

function renderPinShape(
  pin: KiCadPin,
  root: { x: number; y: number },
  end: { x: number; y: number },
  stroke: string,
  bbox: any,
  key: string,
): JSX.Element[] {
  const result: JSX.Element[] = [];
  const r = (pin.at.angle * Math.PI) / 180;
  const normal = { x: -Math.sin(r), y: Math.cos(r) };
  const bodyLength = Math.hypot(end.x - root.x, end.y - root.y);
  const ux = bodyLength > EPS ? (end.x - root.x) / bodyLength : Math.cos(r);
  const uy = bodyLength > EPS ? (end.y - root.y) / bodyLength : Math.sin(r);
  const n = 0.45; // world units; visual pin-shape size, not electrical length

  // KiCad graphical pin styles. We keep the electrical pin line separate from
  // these markers so the connection point remains exact.
  if (/inverted|active_low|inverted_input/i.test(pin.shape)) {
    const cx = end.x - ux * n * 0.45;
    const cy = end.y - uy * n * 0.45;
    result.push(
      <circle key={`${key}-bubble`} cx={cx} cy={cy} r={n * 0.28} fill="white" stroke={stroke} strokeWidth={strokeWidth(0)} />,
    );
  }

  if (/clock/i.test(pin.shape)) {
    const tip = { x: end.x, y: end.y };
    const base = { x: end.x - ux * n * 0.8, y: end.y - uy * n * 0.8 };
    const p1 = { x: base.x + normal.x * n * 0.5, y: base.y + normal.y * n * 0.5 };
    const p2 = { x: base.x - normal.x * n * 0.5, y: base.y - normal.y * n * 0.5 };
    result.push(
      <path
        key={`${key}-clock`}
        d={`M ${tip.x} ${tip.y} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} Z`}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth(0)}
      />,
    );
  }

  return result;
}

function estimateTextDimensions(text: string, fontSize: number) {
  const narrow = (text.match(/[ijlI1.,'|:;()]/g) || []).length;
  const wide = (text.match(/[wWmM@_OQ0]/g) || []).length;
  const normal = text.length - narrow - wide;
  const width = (narrow * 0.35 + normal * 0.6 + wide * 0.8) * fontSize;
  const height = fontSize * 1.2;
  return { width, height };
}

export interface KiCadRenderOptions {
  unit?: number;
  bodyStyle?: number;
  showPinNames?: boolean;
  showPinNumbers?: boolean;
  showProperties?: boolean;
}

export function renderKiCadSymbol(
  sym: KiCadParsedSymbol,
  stroke = "#000",
  options: KiCadRenderOptions = {},
): JSX.Element {
  const unit = options.unit ?? sym.selectedUnit ?? 1;
  const style = options.bodyStyle ?? sym.selectedBodyStyle ?? 1;
  const resolved = collectUnit(sym, unit, style);

  // Never fall back to an approximate SymbolDef geometry. If a resolved unit
  // is empty, include the native body graphics as a compatibility fallback;
  // those are still original KiCad graphics, not generated shapes.
  const graphics = resolved.graphics.length ? resolved.graphics : sym.bodyGraphics;
  const pins = resolved.pins.length ? resolved.pins : sym.pins;
  const bbox = bounds(sym, graphics, pins);

  // Compute the exact body boundary in world coordinates
  let bodyMinX = Infinity, bodyMinY = Infinity, bodyMaxX = -Infinity, bodyMaxY = -Infinity;
  graphics.forEach(g => {
    if (g.type === "rectangle") {
      const a = point(g.start, bbox);
      const b = point(g.end, bbox);
      bodyMinX = Math.min(bodyMinX, a.x, b.x);
      bodyMaxX = Math.max(bodyMaxX, a.x, b.x);
      bodyMinY = Math.min(bodyMinY, a.y, b.y);
      bodyMaxY = Math.max(bodyMaxY, a.y, b.y);
    } else if (g.type === "polyline") {
      g.pts.forEach(p => {
        const q = point(p, bbox);
        bodyMinX = Math.min(bodyMinX, q.x);
        bodyMaxX = Math.max(bodyMaxX, q.x);
        bodyMinY = Math.min(bodyMinY, q.y);
        bodyMaxY = Math.max(bodyMaxY, q.y);
      });
    } else if (g.type === "circle") {
      const c = point(g.center, bbox);
      const r = kicadMmToWorld(g.radius);
      bodyMinX = Math.min(bodyMinX, c.x - r);
      bodyMaxX = Math.max(bodyMaxX, c.x + r);
      bodyMinY = Math.min(bodyMinY, c.y - r);
      bodyMaxY = Math.max(bodyMaxY, c.y + r);
    } else if (g.type === "arc") {
      const a = point(g.start, bbox);
      const b = point(g.mid, bbox);
      const c = point(g.end, bbox);
      bodyMinX = Math.min(bodyMinX, a.x, b.x, c.x);
      bodyMaxX = Math.max(bodyMaxX, a.x, b.x, c.x);
      bodyMinY = Math.min(bodyMinY, a.y, b.y, c.y);
      bodyMaxY = Math.max(bodyMaxY, a.y, b.y, c.y);
    }
  });

  if (!isFinite(bodyMinX)) {
    bodyMinX = 0; bodyMaxX = (bbox.maxX - bbox.minX) * WORLD_UNITS_PER_KICAD_MM;
    bodyMinY = 0; bodyMaxY = (bbox.maxY - bbox.minY) * WORLD_UNITS_PER_KICAD_MM;
  }
  const bodyBboxWorld = { minX: bodyMinX, minY: bodyMinY, maxX: bodyMaxX, maxY: bodyMaxY };

  const els: JSX.Element[] = [];

  graphics.forEach((g, i) => {
    if (g.type === "polyline") {
      const d = g.pts
        .map((p, j) => {
          const q = point(p, bbox);
          return `${j ? "L" : "M"} ${q.x} ${q.y}`;
        })
        .join(" ");
      const closed = g.fill.type !== "none" && g.fill.type !== "outline";
      els.push(
        <path
          key={`poly-${i}`}
          d={closed ? `${d} Z` : d}
          stroke={stroke}
          strokeWidth={strokeWidth(g.stroke.width)}
          fill={closed ? fillAttr(g.fill) : "none"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />,
      );
    } else if (g.type === "rectangle") {
      const a = point(g.start, bbox);
      const b = point(g.end, bbox);
      els.push(
        <rect
          key={`rect-${i}`}
          x={Math.min(a.x, b.x)}
          y={Math.min(a.y, b.y)}
          width={Math.abs(b.x - a.x)}
          height={Math.abs(b.y - a.y)}
          stroke={stroke}
          strokeWidth={strokeWidth(g.stroke.width)}
          fill={fillAttr(g.fill)}
        />,
      );
    } else if (g.type === "circle") {
      const c = point(g.center, bbox);
      els.push(
        <circle
          key={`circle-${i}`}
          cx={c.x}
          cy={c.y}
          r={kicadMmToWorld(g.radius)}
          stroke={stroke}
          strokeWidth={strokeWidth(g.stroke.width)}
          fill={fillAttr(g.fill)}
        />,
      );
    } else if (g.type === "arc") {
      els.push(
        <path
          key={`arc-${i}`}
          d={arcPath(g.start, g.mid, g.end, bbox)}
          stroke={stroke}
          strokeWidth={strokeWidth(g.stroke.width)}
          fill="none"
          strokeLinecap="round"
        />,
      );
    } else if (g.type === "bezier" && g.pts.length >= 4) {
      const p = g.pts.map((v) => point(v, bbox));
      const segments: string[] = [`M ${p[0].x} ${p[0].y}`];
      for (let j = 1; j + 2 < p.length; j += 3) {
        segments.push(
          `C ${p[j].x} ${p[j].y} ${p[j + 1].x} ${p[j + 1].y} ${p[j + 2].x} ${p[j + 2].y}`,
        );
      }
      els.push(
        <path
          key={`bezier-${i}`}
          d={segments.join(" ")}
          stroke={stroke}
          strokeWidth={strokeWidth(g.stroke.width)}
          fill="none"
          strokeLinecap="round"
        />,
      );
    } else if (g.type === "text_box" && !g.hide && !g.effects.hidden) {
      const q = point(g.at, bbox);
      const width = kicadMmToWorld(g.size.x);
      const height = Math.abs(kicadMmToWorld(g.size.y));
      els.push(
        <g key={`textbox-${i}`} transform={`translate(${q.x} ${q.y}) rotate(${-g.at.angle})`}>
          <rect
            x={0}
            y={0}
            width={width}
            height={height}
            stroke={stroke}
            strokeWidth={strokeWidth(g.stroke.width)}
            fill={fillAttr(g.fill)}
          />
          {g.text.split("\n").map((line, li) => renderText(
            line,
            g.effects,
            width / 2,
            li * kicadMmToWorld((g.effects.font.size.y || 1.27) * 1.2) + kicadMmToWorld(g.effects.font.size.y || 1.27),
            0,
            `textbox-text-${i}-${li}`,
            stroke,
          ))}
        </g>,
      );
    } else if (g.type === "text" && !g.hide) {
      const q = point(g.at, bbox);
      const n = renderText(
        g.text,
        g.effects,
        q.x,
        q.y,
        -g.at.angle,
        `text-${i}`,
        stroke,
      );
      if (n) els.push(n);
    }
  });

  pins.forEach((p, i) => {
    if (p.hide) return;

    const root = point(p.at, bbox);
    const nativeEnd = pinBodyEnd(p);
    const end = point(nativeEnd, bbox);

    els.push(
      <line
        key={`pin-${i}`}
        x1={root.x}
        y1={root.y}
        x2={end.x}
        y2={end.y}
        stroke={stroke}
        strokeWidth={strokeWidth(0)}
        strokeLinecap="round"
      />,
    );
    els.push(...renderPinShape(p, root, end, stroke, bbox, `pin-${i}`));

    const showNumber = options.showPinNumbers ?? !sym.pinNumbersHide;
    const showName = options.showPinNames ?? !sym.pinNamesHide;

    const angle = ((Math.round(p.at.angle) % 360) + 360) % 360;

    // Pin Number (displayed outside the symbol body along the pin lead line)
    if (showNumber && p.number) {
      let numX = (root.x + end.x) / 2;
      let numY = (root.y + end.y) / 2;
      let numAnchor: "start" | "middle" | "end" = "middle";
      let numBaseline: "auto" | "central" = "auto";

      if (angle === 0 || angle === 180) {
        // Horizontal pin: number sits slightly above the horizontal wire
        numX = (root.x + end.x) / 2;
        numY = root.y - 0.20;
        numAnchor = "middle";
        numBaseline = "auto";
      } else if (angle === 90 || angle === 270) {
        // Vertical pin: number sits to the left of the vertical wire
        numX = root.x - 0.22;
        numY = (root.y + end.y) / 2;
        numAnchor = "end";
        numBaseline = "central";
      }

      const numSize = Math.max(0.24, Math.min(0.32, kicadMmToWorld(p.numberEffects?.font?.size?.y || 1.0) * 0.7));
      els.push(
        <g key={`pin-number-${i}`} transform={`translate(${numX} ${numY})`}>
          <text
            x={0}
            y={0}
            fontSize={numSize}
            textAnchor={numAnchor}
            dominantBaseline={numBaseline}
            fill={stroke}
            opacity={0.85}
            stroke="none"
            dir="ltr"
            style={{ fontWeight: 500, fontFamily: "system-ui, -apple-system, sans-serif", direction: "ltr" }}
          >
            {p.number}
          </text>
        </g>,
      );
    }

    // Pin Name (displayed strictly inside the symbol body box)
    if (showName && p.name && p.name !== "~") {
      let rawLabel = p.name.trim();
      let isOverline = false;
      if (rawLabel.startsWith("~{") && rawLabel.endsWith("}")) {
        rawLabel = rawLabel.slice(2, -1);
        isOverline = true;
      } else if (rawLabel.startsWith("~")) {
        rawLabel = rawLabel.slice(1);
        isOverline = true;
      } else if (rawLabel.endsWith("~")) {
        rawLabel = rawLabel.slice(0, -1);
        isOverline = true;
      }

      if (rawLabel) {
        const nameSize = Math.max(0.26, Math.min(0.35, kicadMmToWorld(p.nameEffects?.font?.size?.y || 1.27) * 0.75));
        const { width: textWidth } = estimateTextDimensions(rawLabel, nameSize);
        const margin = 0.15; // Minimum safe distance from any box border
        const nameOffWorld = Math.max(0.20, kicadMmToWorld(sym.pinNamesOffset || 0.508));

        let nameX = end.x;
        let nameY = end.y;
        let nameRotate = 0;
        let nameAnchor: "start" | "middle" | "end" = "start";

        if (angle === 0) {
          // Left pin entering rightwards: limit max position to prevent right-edge collision
          nameAnchor = "start";
          nameRotate = 0;
          const desiredX = end.x + nameOffWorld;
          const maxAllowedX = bodyBboxWorld.maxX - margin - textWidth;
          nameX = Math.min(desiredX, maxAllowedX);
          nameX = Math.max(nameX, end.x + margin); // Do not push back over the pin
        } else if (angle === 180) {
          // Right pin entering leftwards: limit min position to prevent left-edge collision
          nameAnchor = "end";
          nameRotate = 0;
          const desiredX = end.x - nameOffWorld;
          const minAllowedX = bodyBboxWorld.minX + margin + textWidth;
          nameX = Math.max(desiredX, minAllowedX);
          nameX = Math.min(nameX, end.x - margin);
        } else if (angle === 270) {
          // Top pin entering downwards: limit max position to prevent bottom-edge collision
          nameAnchor = "start";
          nameRotate = 90;
          const desiredY = end.y + nameOffWorld;
          const maxAllowedY = bodyBboxWorld.maxY - margin - textWidth;
          nameY = Math.min(desiredY, maxAllowedY);
          nameY = Math.max(nameY, end.y + margin);
        } else if (angle === 90) {
          // Bottom pin entering upwards: limit min position to prevent top-edge collision
          nameAnchor = "start";
          nameRotate = -90;
          const desiredY = end.y - nameOffWorld;
          const minAllowedY = bodyBboxWorld.minY + margin + textWidth;
          nameY = Math.max(desiredY, minAllowedY);
          nameY = Math.min(nameY, end.y - margin);
        } else {
          // Angled fallback
          const dx = end.x - root.x;
          const dy = end.y - root.y;
          const len = Math.hypot(dx, dy) || 1;
          nameX = end.x + (dx / len) * nameOffWorld;
          nameY = end.y + (dy / len) * nameOffWorld;
          nameRotate = 0;
          nameAnchor = dx >= 0 ? "start" : "end";
        }

        els.push(
          <g key={`pin-name-${i}`} transform={`translate(${nameX} ${nameY}) rotate(${nameRotate})`}>
            <text
              x={0}
              y={0}
              fontSize={nameSize}
              textAnchor={nameAnchor}
              dominantBaseline="central"
              fill={stroke}
              stroke="none"
              dir="ltr"
              style={{
                fontWeight: 600,
                fontFamily: "system-ui, -apple-system, sans-serif",
                textDecoration: isOverline ? "overline" : "none",
                direction: "ltr",
              }}
            >
              {rawLabel}
            </text>
          </g>,
        );
      }
    }
  });

  if (options.showProperties === true) {
    for (const prop of sym.properties || []) {
      if (prop.hide || prop.effects.hidden) continue;
      const q = point(prop.at, bbox);
      const n = renderText(
        prop.value,
        prop.effects,
        q.x,
        q.y,
        -prop.at.angle,
        `property-${prop.name}`,
        stroke,
      );
      if (n) els.push(n);
    }
  }

  return (
    <g
      data-kicad-native-symbol={sym.name}
      data-kicad-unit={unit}
      data-kicad-style={style}
      data-kicad-coordinate-system="mm-y-up"
      data-kicad-native-renderer="true"
    >
      {els}
    </g>
  );
}

export function makeNativeKiCadDrawFn(
  sym: KiCadParsedSymbol,
  options: KiCadRenderOptions = {},
) {
  return (stroke: string) => renderKiCadSymbol(sym, stroke, options);
}
