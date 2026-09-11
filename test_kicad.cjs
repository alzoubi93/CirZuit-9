const fs = require('fs');
const text = `(kicad_schematic (version 20211123) (generator eeschema)
  (paper "A4")
  (lib_symbols
    (symbol "Device:R" (pin_numbers hide) (pin_names (offset 0) hide) (in_bom yes) (on_board yes)
      (property "Reference" "R" (id 0) (at 2.032 0 90)
        (effects (font (size 1.27 1.27)))
      )
    )
  )
)`;

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
  
  let index = 0;
  function parseNode() {
    const list = [];
    if (index >= tokens.length || tokens[index].value !== "(") return list;
    index++; // skip '('
    while (index < tokens.length) {
      const tok = tokens[index];
      if (tok.value === ")") {
        index++; // skip ')'
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
  const ast = parseNode();
  console.log(ast[0]);
