const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ConnectorGeneratorModal.tsx', 'utf-8');

code = code.replace(
  'import { generateConnectorId } from "@/lib/symbols";',
  'import { generateConnectorId } from "@/lib/symbols";\nimport { useI18n } from "@/i18n";'
);

code = code.replace(
  'export function ConnectorGeneratorModal({ open, onOpenChange, onGenerate }: Props) {',
  'export function ConnectorGeneratorModal({ open, onOpenChange, onGenerate }: Props) {\n  const { t } = useI18n();'
);

code = code.replace(
  '<DialogTitle>Connector Generator</DialogTitle>',
  '<DialogTitle>{t("connectorGen.title")}</DialogTitle>'
);

code = code.replace(
  '<Label className="text-right">Type / Gender</Label>',
  '<Label className="text-right">{t("connectorGen.type")}</Label>'
);

code = code.replace(
  '<option value="MALE">Male Pin Header</option>',
  '<option value="MALE">{t("connectorGen.male")}</option>'
);

code = code.replace(
  '<option value="FEMALE">Female Socket</option>',
  '<option value="FEMALE">{t("connectorGen.female")}</option>'
);

code = code.replace(
  '<option value="SHROUDED">Shrouded / Box Header</option>',
  '<option value="SHROUDED">{t("connectorGen.shrouded")}</option>'
);

code = code.replace(
  '<option value="DIP">DIP Socket</option>',
  '<option value="DIP">{t("connectorGen.dip")}</option>'
);

code = code.replace(
  '<Label className="text-right">Rows</Label>',
  '<Label className="text-right">{t("connectorGen.rows")}</Label>'
);

code = code.replace(
  '<option value="1">Single Row (1xN)</option>',
  '<option value="1">{t("connectorGen.singleRow")}</option>'
);

code = code.replace(
  '<option value="2">Double Row (2xN)</option>',
  '<option value="2">{t("connectorGen.doubleRow")}</option>'
);

code = code.replace(
  '<Label className="text-right">Pins Per Row</Label>',
  '<Label className="text-right">{t("connectorGen.pinsPerRow")}</Label>'
);

code = code.replace(
  '<Label className="text-right">Pitch</Label>',
  '<Label className="text-right">{t("connectorGen.pitch")}</Label>'
);

code = code.replace(
  '<option value="2.54">2.54mm (100mil)</option>',
  '<option value="2.54">{t("connectorGen.pitch254")}</option>'
);

code = code.replace(
  '<option value="2">2.00mm</option>',
  '<option value="2">{t("connectorGen.pitch200")}</option>'
);

code = code.replace(
  '<option value="1.27">1.27mm (50mil)</option>',
  '<option value="1.27">{t("connectorGen.pitch127")}</option>'
);

code = code.replace(
  '<Label className="text-right">Orientation</Label>',
  '<Label className="text-right">{t("connectorGen.orientation")}</Label>'
);

code = code.replace(
  '<option value="STRAIGHT">Straight / Vertical</option>',
  '<option value="STRAIGHT">{t("connectorGen.straight")}</option>'
);

code = code.replace(
  '<option value="RIGHT_ANGLE">Right-Angle (90°)</option>',
  '<option value="RIGHT_ANGLE">{t("connectorGen.rightAngle")}</option>'
);

code = code.replace(
  '<Label className="text-right">Prefix</Label>',
  '<Label className="text-right">{t("connectorGen.prefix")}</Label>'
);

code = code.replace(
  '<Button onClick={handleGenerate}>Generate</Button>',
  '<Button onClick={handleGenerate}>{t("connectorGen.generate")}</Button>'
);

// fix dir rtl issues
code = code.replace(
  /className="text-right"/g,
  'className="ltr:text-right rtl:text-left"'
);

fs.writeFileSync('src/components/editor/ConnectorGeneratorModal.tsx', code);
