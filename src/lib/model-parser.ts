import { SpiceModel, ModelSource, SpicePrimitive } from "./spice-models";

export function parseSpiceModels(content: string, source: ModelSource = "imported"): SpiceModel[] {
  const models: SpiceModel[] = [];
  const lines = content.split(/\r?\n/);
  
  let currentModel: Partial<SpiceModel> | null = null;
  let inSubckt = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("*")) continue;

    const upper = line.toUpperCase();

    // Start of .MODEL
    if (upper.startsWith(".MODEL")) {
      const parts = line.split(/\s+/);
      const name = parts[1];
      const primitive = parts[2]?.toUpperCase()[0] as SpicePrimitive;
      
      models.push({
        id: `imported_${name}_${Math.random().toString(36).substr(2, 5)}`,
        name: name,
        label: name,
        primitive: primitive || "X",
        parameters: [],
        pinMapping: getPinsForPrimitive(primitive),
        template: "{ref} {nodes} {value}",
        source,
        content: line,
        category: "Imported"
      });
    }

    // Start of .SUBCKT
    if (upper.startsWith(".SUBCKT")) {
      const parts = line.split(/\s+/);
      const name = parts[1];
      const pins = parts.slice(2);
      
      currentModel = {
        id: `subckt_${name}_${Math.random().toString(36).substr(2, 5)}`,
        name: name,
        label: name,
        primitive: "X",
        source,
        category: "Subcircuit",
        pinMapping: pins,
        template: "{ref} {nodes} {model}",
        parameters: [{ name: "model", label: "Model Name", defaultValue: name }],
        content: line
      };
      inSubckt = true;
    } else if (inSubckt && currentModel) {
      currentModel.content += "\n" + line;
      if (upper.startsWith(".ENDS")) {
        models.push(currentModel as SpiceModel);
        currentModel = null;
        inSubckt = false;
      }
    }
  }

  return models;
}

function getPinsForPrimitive(primitive: string): string[] {
  switch (primitive) {
    case "D": return ["A", "K"];
    case "Q": return ["C", "B", "E"];
    case "M": return ["D", "G", "S"];
    case "R":
    case "C":
    case "L": return ["1", "2"];
    default: return ["1", "2"];
  }
}
