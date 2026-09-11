const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ComponentToolbox.tsx', 'utf-8');

code = code.replace(
  'import { Cpu } from "lucide-react";',
  'import { Cpu, Type } from "lucide-react";'
);

const buttonHtml = `
          <Button onClick={() => onPick("text")} variant="outline" className="h-9" title={t("connectorGen.addText") || "Add Text"}>
            <Type className="size-4" />
          </Button>
`;

code = code.replace(
  '<Button onClick={onOpenConnModal} variant="outline" className="h-9" title="Connector Generator">',
  '<Button onClick={onOpenConnModal} variant="outline" className="h-9" title={t("connectorGen.title")}>\n            <Cpu className="size-4" />\n          </Button>' + buttonHtml
);

code = code.replace(
  '<Cpu className="size-4" />\n          </Button>\n          <Button onClick={onOpenConnModal} variant="outline" className="h-9" title={t("connectorGen.title")}>\n            <Cpu className="size-4" />\n          </Button>',
  '<Button onClick={onOpenConnModal} variant="outline" className="h-9" title={t("connectorGen.title")}>\n            <Cpu className="size-4" />\n          </Button>'
);


fs.writeFileSync('src/components/editor/ComponentToolbox.tsx', code);
