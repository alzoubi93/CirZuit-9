const fs = require('fs');
let code = fs.readFileSync('src/pages/Editor.tsx', 'utf-8');

code = code.replace(
  'onPlace={(symbol, x, y, rotation) => {',
  'onPlace={(symbol, x, y, rotation, metadata) => {'
);

code = code.replace(
  'rotation,\n                    };',
  'rotation,\n                      metadata,\n                    };'
);

// We need to add the ConnectorGeneratorModal to Editor.tsx
const importModal = `import { ConnectorGeneratorModal } from "@/components/editor/ConnectorGeneratorModal";\nimport type { ConnectorMetadata } from "@/lib/symbols";\n`;

code = code.replace('import { ComponentToolbox } from "@/components/editor/ComponentToolbox";', importModal + 'import { ComponentToolbox } from "@/components/editor/ComponentToolbox";');

code = code.replace(
  'const [libraryOpen, setLibraryOpen] = useState(false);',
  'const [libraryOpen, setLibraryOpen] = useState(false);\n  const [connModalOpen, setConnModalOpen] = useState(false);'
);

code = code.replace(
  '<ComponentToolbox \n            onPick={handlePickComponent} \n            onClose={() => setLibraryOpen(false)}\n            realistic={mode === "realistic"}\n          />',
  '<ComponentToolbox \n            onPick={handlePickComponent} \n            onOpenConnModal={() => setConnModalOpen(true)}\n            onClose={() => setLibraryOpen(false)}\n            realistic={mode === "realistic"}\n          />'
);

code = code.replace(
  '{libraryOpen && isSchematicLike && (',
  `<ConnectorGeneratorModal 
        open={connModalOpen}
        onOpenChange={setConnModalOpen}
        onGenerate={(id, metadata) => {
          setPlacement({ symbol: id, rotation: 0, metadata });
          setActiveTool("select");
          if (!isSchematicLike) {
            setMode("schematic");
            toast.info("Switched to Schematic to place component");
          }
        }}
      />
      {libraryOpen && isSchematicLike && (`
);

fs.writeFileSync('src/pages/Editor.tsx', code);
