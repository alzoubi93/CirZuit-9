const fs = require('fs');
let code = fs.readFileSync('src/pages/Editor.tsx', 'utf-8');

code = code.replace(
  '                      metadata,\n                    };',
  '                      metadata,\n                    };'
);

code = code.replace(
  'const newNode: SchematicNode = {',
  'const newNode: SchematicNode = {'
);

code = code.replace(
  '                      size: project.doc.defaultNodeSize ?? 1.0,',
  '                      size: project.doc.defaultNodeSize ?? 1.0,\n                      metadata,'
);

fs.writeFileSync('src/pages/Editor.tsx', code);
