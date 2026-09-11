const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ComponentToolbox.tsx', 'utf-8');

code = code.replace(
  'interface Props {\n  onPick: (id: SymbolId) => void;',
  'interface Props {\n  onPick: (id: SymbolId) => void;\n  onOpenConnModal?: () => void;'
);

code = code.replace(
  'export function ComponentToolbox({ onPick, onClose, realistic = false }: Props) {',
  'export function ComponentToolbox({ onPick, onOpenConnModal, onClose, realistic = false }: Props) {'
);

const buttonHtml = `
          <Button onClick={onOpenConnModal} variant="outline" className="h-9" title="Connector Generator">
            <Cpu className="size-4" />
          </Button>
`;

code = code.replace(
  '{t("openLibrary")}\n          </Button>',
  '{t("openLibrary")}\n          </Button>\n' + buttonHtml
);

fs.writeFileSync('src/components/editor/ComponentToolbox.tsx', code);
