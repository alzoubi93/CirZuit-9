const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ConnectorGeneratorModal.tsx', 'utf-8');

code = code.replace(
  '<Input \n               type="number" \n               min={1} \n               max={20} \n               value={rows} \n               onChange={(e) => setRows(parseInt(e.target.value) || 1)}\n               className="h-9 text-center font-mono text-sm bg-background/50"\n            />',
  '<Input \n               type="number" \n               min={1} \n               value={rows} \n               onChange={(e) => setRows(parseInt(e.target.value) || 1)}\n               className="h-9 text-center font-mono text-sm bg-background/50"\n            />'
);

code = code.replace(
  '<Input \n               type="number" \n               min={1} \n               max={40} \n               value={pinsPerRow} \n               onChange={(e) => setPinsPerRow(parseInt(e.target.value) || 1)}\n               className="h-9 text-center font-mono text-sm bg-background/50"\n            />',
  '<Input \n               type="number" \n               min={1} \n               value={pinsPerRow} \n               onChange={(e) => setPinsPerRow(parseInt(e.target.value) || 1)}\n               className="h-9 text-center font-mono text-sm bg-background/50"\n            />'
);

fs.writeFileSync('src/components/editor/ConnectorGeneratorModal.tsx', code);
