const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ComponentToolbox.tsx', 'utf-8');

code = code.replace(
  '          <Button onClick={onOpenConnModal} variant="outline" className="h-9" title={t("connectorGen.title")}>\n            <Cpu className="size-4" />\n          </Button>\n          <Button onClick={() => onPick("text")} variant="outline" className="h-9" title={t("connectorGen.addText") || "Add Text"}>\n            <Type className="size-4" />\n          </Button>\n\n            <Cpu className="size-4" />\n          </Button>',
  '          <Button onClick={onOpenConnModal} variant="outline" className="h-9" title={t("connectorGen.title")}>\n            <Cpu className="size-4" />\n          </Button>\n          <Button onClick={() => onPick("text")} variant="outline" className="h-9" title={t("connectorGen.addText") || "Add Text"}>\n            <Type className="size-4" />\n          </Button>'
);


fs.writeFileSync('src/components/editor/ComponentToolbox.tsx', code);
