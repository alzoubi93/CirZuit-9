import type {
  KicadFootprintModel,
  KicadFootprintPad,
  KicadFootprintGraphic,
} from "../../footprint";
import { computeEnvelope } from "../core/courtyard";

export interface CreateFootprintOptions {
  name: string;
  library?: string;
  category?: string;
  referencePrefix?: string;
  value?: string;
  description?: string;
  tags?: string[];
  pads: KicadFootprintPad[];
  graphics: KicadFootprintGraphic[];
  mountingType?: "SMD" | "THT" | "Mixed";
  generatorFamily?: string;
  generatorParams?: Record<string, any>;
}

export function buildNativeFootprintModel(options: CreateFootprintOptions): KicadFootprintModel {
  const library = options.library || "Generator";
  const name = options.name;
  const fullName = `${library}:${name}`;

  // Deduplicate value text graphics to prevent multiple occurrences
  let hasValueText = false;
  const filteredGraphics = (options.graphics || []).filter((g) => {
    if (g.kind === "text") {
      const isValue = g.role === "value" || g.text === "${VALUE}" || g.text === "%V";
      if (isValue) {
        if (hasValueText) return false;
        hasValueText = true;
      }
    }
    return true;
  });

  // Calculate physical envelope of pads and non-text graphics
  const env = computeEnvelope(options.pads, filteredGraphics);
  const clearance = options.mountingType === "THT" ? 0.50 : 0.25;

  let crtMinY = env.minY - clearance;
  let crtMaxY = env.maxY + clearance;

  // Scan for explicit F.CrtYd graphics to refine courtyard boundary
  for (const g of filteredGraphics) {
    if (g.layer === "F.CrtYd") {
      if (g.kind === "rect") {
        crtMinY = Math.min(crtMinY, g.start.y, g.end.y);
        crtMaxY = Math.max(crtMaxY, g.start.y, g.end.y);
      } else if (g.kind === "circle") {
        const r = Math.hypot(g.end.x - g.center.x, g.end.y - g.center.y);
        crtMinY = Math.min(crtMinY, g.center.y - r);
        crtMaxY = Math.max(crtMaxY, g.center.y + r);
      } else if (g.kind === "line") {
        crtMinY = Math.min(crtMinY, g.start.y, g.end.y);
        crtMaxY = Math.max(crtMaxY, g.start.y, g.end.y);
      } else if (g.kind === "poly") {
        for (const pt of g.points) {
          crtMinY = Math.min(crtMinY, pt.x, pt.y);
          crtMaxY = Math.max(crtMaxY, pt.x, pt.y);
        }
      }
    }
  }

  // Enforce clean clearance between F.Courtyard boundaries and text elements
  const safeMargin = 0.50; // 0.50mm clear gap between F.Courtyard line and text edge

  for (const g of filteredGraphics) {
    if (g.kind === "text") {
      const isReference = g.role === "reference" || g.text === "${REFERENCE}" || g.text === "%R" || g.text === "REF**";
      const isValue = g.role === "value" || g.text === "${VALUE}" || g.text === "%V" || g.text === "VAL**" || g.text === options.value;
      const sizeY = g.size?.y || 1.0;
      const halfSizeY = sizeY / 2;

      if (isReference) {
        // Reference text sits ABOVE courtyard
        const maxAllowedY = crtMinY - safeMargin - halfSizeY;
        if (g.position.y > maxAllowedY) {
          g.position.y = Number(maxAllowedY.toFixed(2));
        }
      } else if (isValue) {
        // Value text sits BELOW courtyard
        const minAllowedY = crtMaxY + safeMargin + halfSizeY;
        if (g.position.y < minAllowedY) {
          g.position.y = Number(minAllowedY.toFixed(2));
        }
      }
    }
  }

  return {
    id: `gen-${options.generatorFamily || "fp"}-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    library,
    name,
    fullName,
    layer: "F.Cu",
    position: { x: 0, y: 0 },
    rotation: 0,
    description: options.description || `Auto-generated ${options.generatorFamily || "footprint"}`,
    tags: options.tags || ["generated", options.generatorFamily || "general"],
    properties: {
      Reference: options.referencePrefix || "REF**",
      Value: options.value || name,
      Footprint: fullName,
    },
    graphics: filteredGraphics,
    pads: options.pads,
    models: [],
    attributes: options.mountingType ? [options.mountingType === "SMD" ? "smd" : "through_hole"] : [],
    mountingType: options.mountingType,
    source: {
      path: `generator/${options.generatorFamily || "custom"}`,
      type: "generated",
    },
    diagnostics: [],
    generator: options.generatorFamily,
    generatorParams: options.generatorParams,
  };
}
