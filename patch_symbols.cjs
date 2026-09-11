const fs = require('fs');
let code = fs.readFileSync('src/lib/symbols.tsx', 'utf-8');
const exportSymbolListIndex = code.indexOf('export const SYMBOL_LIST');

const connectorGen = `
export type ConnectorMetadata = {
  type: "HEADER_SOCKET";
  gender: "MALE" | "FEMALE" | "SHROUDED" | "DIP";
  rows: number;
  pinsPerRow: number;
  pitch: number;
  orientation: "STRAIGHT" | "RIGHT_ANGLE";
  refDes: string;
};

export function generateConnectorId(meta: ConnectorMetadata) {
  return \`CONN_\${meta.gender}_\${meta.rows}x\${meta.pinsPerRow}_\${meta.pitch}_\${meta.orientation}\`;
}

export function ensureDynamicSymbol(id: string, meta?: ConnectorMetadata) {
  if (SYMBOLS[id]) return SYMBOLS[id];
  
  if (id.startsWith("CONN_")) {
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
    
    const rows = m.rows;
    const cols = m.pinsPerRow;
    const width = 2 + (cols > 1 ? (cols - 1) * 1.5 : 0);
    const height = 1 + rows; // 1 unit per row spacing

    const pins: PinDef[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pinNum = r * cols + c + 1;
        pins.push({
          x: 1 + c * 1.5,
          y: 1 + r,
          name: \`\${m.refDes}_\${pinNum}\`,
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
      prefix: m.refDes,
      defaultValue: \`\${m.rows}x\${m.pinsPerRow} \${m.gender}\`,
      pins,
      draw,
    };
    SYMBOLS[id] = sym;
    return sym;
  }
  return undefined;
}
\n`;

code = code.slice(0, exportSymbolListIndex) + connectorGen + code.slice(exportSymbolListIndex);
fs.writeFileSync('src/lib/symbols.tsx', code);
