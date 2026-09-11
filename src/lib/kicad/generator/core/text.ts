import type { KicadFootprintText } from "../../footprint";
import { KLC_RULES } from "../rules/klc";

export interface TextOptions {
  layer?: string;
  size?: { x: number; y: number };
  thickness?: number;
  role?: "reference" | "value" | "user" | "other";
  justify?: string[];
  visible?: boolean;
}

export function createReferenceText(
  x: number,
  y: number,
  options?: Partial<TextOptions>
): KicadFootprintText {
  return {
    kind: "text",
    layer: options?.layer || KLC_RULES.layers.silk,
    text: "${REFERENCE}",
    position: { x, y },
    size: options?.size || { ...KLC_RULES.text.reference.size },
    thickness: options?.thickness || KLC_RULES.text.reference.thickness,
    role: "reference",
    justify: options?.justify || ["center"],
    visible: options?.visible ?? true,
  };
}

export function createValueText(
  x: number,
  y: number,
  defaultValue?: string,
  options?: Partial<TextOptions>
): KicadFootprintText {
  return {
    kind: "text",
    layer: options?.layer || KLC_RULES.layers.fab,
    text: defaultValue || "${VALUE}",
    position: { x, y },
    size: options?.size || { ...KLC_RULES.text.value.size },
    thickness: options?.thickness || KLC_RULES.text.value.thickness,
    role: "value",
    justify: options?.justify || ["center"],
    visible: options?.visible ?? true,
  };
}
