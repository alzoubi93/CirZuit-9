const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ComponentToolbox.tsx', 'utf-8');

const importModal = `import { ConnectorGeneratorModal } from "./ConnectorGeneratorModal";\nimport { Cpu } from "lucide-react";\nimport type { ConnectorMetadata } from "@/lib/symbols";\n`;

code = code.replace('import { useMemo, useState } from "react";', 'import { useMemo, useState } from "react";\n' + importModal);

code = code.replace(
  'const [libOpen, setLibOpen] = useState(false);',
  'const [libOpen, setLibOpen] = useState(false);\n  const [connModalOpen, setConnModalOpen] = useState(false);'
);

// We need to add onPickWithMetadata because onPick only accepts ID.
// Wait, `onPick` in ComponentToolbox takes an ID, and the Editor handles adding it.
// To pass metadata to the Editor, `onPick` could take `(id: string, metadata?: any)`.
// But wait, the `onPick` is passed from Canvas or Editor. Let's look at Editor/Canvas.

fs.writeFileSync('src/components/editor/ComponentToolbox.tsx', code);
