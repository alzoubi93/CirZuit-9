const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ConnectorGeneratorModal.tsx', 'utf-8');

code = code.replace(
  '<select value={rows.toString()} onChange={(e) => setRows(parseInt(e.target.value, 10))} className="flex h-9 w-full rounded-md border border-input bg-background/50 px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50">\n              <option value="1">{t("connectorGen.singleRow")}</option>\n              <option value="2">{t("connectorGen.doubleRow")}</option>\n            </select>',
  '<Input \n               type="number" \n               min={1} \n               max={20} \n               value={rows} \n               onChange={(e) => setRows(parseInt(e.target.value) || 1)}\n               className="h-9 text-center font-mono text-sm bg-background/50"\n            />'
);

fs.writeFileSync('src/components/editor/ConnectorGeneratorModal.tsx', code);
