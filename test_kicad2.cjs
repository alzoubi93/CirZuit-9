const fs = require('fs');
const text = `(kicad_schematic (version 20211123) (generator eeschema)
  (paper "A4")
  (symbol (lib_id "Device:R") (at 116.84 57.15 0) (unit 1)
    (in_bom yes) (on_board yes)
    (uuid 6a2c3886-53a5-48b6-9f1e-fbd47b31d2ba)
    (property "Reference" "R1" (id 0) (at 118.618 56.007 0))
    (property "Value" "10k" (id 1) (at 118.618 58.3184 0))
  )
  (wire (pts (xy 116.84 53.34) (xy 116.84 57.15))
    (stroke (width 0) (type default) (color 0 0 0 0))
    (uuid 1234)
  )
)`;

function tokenizeSExpr(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i++;
    } else if (ch === '"') {
      let str = "";
      i++;
      while (i < text.length) {
        if (text[i] === "\\" && i + 1 < text.length) {
          str += text[i + 1];
          i += 2;
        } else if (text[i] === '"') {
          i++;
          break;
        } else {
          str += text[i];
          i++;
        }
      }
      tokens.push({ type: "string", value: str });
    } else if (/\s/.test(ch)) {
      i++;
    } else {
      let atom = "";
      while (i < text.length && !/\s|\(|\)|"/.test(text[i])) {
        atom += text[i];
        i++;
      }
      tokens.push({ type: "atom", value: atom });
    }
  }
  return tokens;
}

function parseSExprAST(tokens) {
  let index = 0;
  while (index < tokens.length && tokens[index].value !== "(") index++;
  function parseNode() {
    const list = [];
    if (index >= tokens.length || tokens[index].value !== "(") return list;
    index++;
    while (index < tokens.length) {
      const tok = tokens[index];
      if (tok.value === ")") {
        index++;
        break;
      }
      if (tok.value === "(") {
        list.push(parseNode());
      } else {
        list.push(tok.value);
        index++;
      }
    }
    return list;
  }
  return parseNode();
}

function parseKiCadSch(text) {
    const tokens = tokenizeSExpr(text);
    const ast = parseSExprAST(tokens);
    if (!Array.isArray(ast) || ast[0] !== "kicad_schematic") return null;

    const nodes = [];
    const wires = [];
    const SCALE = 0.2; // Map mm to schematic grid units

    for (let i = 1; i < ast.length; i++) {
      const item = ast[i];
      if (!Array.isArray(item) || item.length === 0) continue;
      const head = item[0];

      if (head === "symbol") {
        let libId = "";
        let x = 0, y = 0, angle = 0;
        let reference = "";
        let value = "";

        for (let j = 1; j < item.length; j++) {
          const sub = item[j];
          if (!Array.isArray(sub)) continue;

          if (sub[0] === "lib_id" && typeof sub[1] === "string") {
            libId = sub[1];
          } else if (sub[0] === "at") {
            x = (parseFloat(String(sub[1] || 0)) || 0) * SCALE;
            y = (parseFloat(String(sub[2] || 0)) || 0) * SCALE;
            const rotDeg = parseFloat(String(sub[3] || 0)) || 0;
            const normRot = (((Math.round(rotDeg / 90) * 90) % 360) + 360) % 360;
            angle = normRot;
          } else if (sub[0] === "property") {
            const propName = String(sub[1] || "");
            const propVal = String(sub[2] || "");
            if (propName === "Reference") reference = propVal;
            if (propName === "Value") value = propVal;
          }
        }

        nodes.push({
          id: "node1",
          symbol: libId,
          x: Math.round(x * 2) / 2,
          y: Math.round(y * 2) / 2,
          rotation: angle,
          reference: reference || undefined,
          value: value || undefined,
        });
      } else if (head === "wire") {
        let pts = [];
        for (let j = 1; j < item.length; j++) {
          const sub = item[j];
          if (!Array.isArray(sub)) continue;
          if (sub[0] === "pts") {
            for (let k = 1; k < sub.length; k++) {
              const ptSub = sub[k];
              if (Array.isArray(ptSub) && ptSub[0] === "xy") {
                const px = (parseFloat(String(ptSub[1] || 0)) || 0) * SCALE;
                const py = (parseFloat(String(ptSub[2] || 0)) || 0) * SCALE;
                pts.push({ x: Math.round(px * 2) / 2, y: Math.round(py * 2) / 2 });
              }
            }
          }
        }
        if (pts.length >= 2) {
          for (let k = 0; k < pts.length - 1; k++) {
            wires.push({
              id: "wire1",
              points: [pts[k], pts[k+1]],
              color: "black",
            });
          }
        }
      }
    }
    return { nodes, wires };
}

console.log(JSON.stringify(parseKiCadSch(text), null, 2));
