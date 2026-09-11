/**
 * KiCad-inspired PADSTACK runtime V8.1.
 *
 * KiCad's PAD owns a PADSTACK.  A padstack can describe a common copper shape
 * or layer-specific shapes.  The runtime keeps that distinction explicit so a
 * PCB footprint is not reduced to one generic rectangle/circle.
 */
import type { KicadFootprintPad, KicadPadLayerOverride, KicadPadShape } from "./kicadFootprint";

export interface ResolvedKicadPadLayer {
  layer: string;
  shape: KicadPadShape;
  size: { x: number; y: number };
  rotation: number;
  offset?: { x: number; y: number };
  roundrectRatio: number;
  chamferRatio: number;
  chamferCorners: string[];
  rectDelta?: { x: number; y: number };
  customGraphics: NonNullable<KicadFootprintPad["customGraphics"]>;
  clearance?: "outline" | "convexhull";
}

export class KicadPadstackRuntime {
  constructor(private readonly pad: KicadFootprintPad) {}

  /** Resolve the effective geometry exactly once for a concrete layer. */
  resolve(layer: string): ResolvedKicadPadLayer {
    const override: KicadPadLayerOverride | undefined = this.pad.layerOverrides?.[layer];
    const baseLayers = this.pad.layers.length ? this.pad.layers : [layer];
    const applies = baseLayers.includes(layer) || baseLayers.includes("*.Cu") || baseLayers.includes("*.Mask") || baseLayers.includes("*.Paste");
    if (!applies && !override) {
      return {
        layer,
        shape: this.pad.shape,
        size: { ...this.pad.size },
        rotation: this.pad.rotation,
        offset: this.pad.offset ? { ...this.pad.offset } : undefined,
        roundrectRatio: this.pad.roundrectRatio ?? 0.25,
        chamferRatio: this.pad.chamferRatio ?? 0,
        chamferCorners: [...(this.pad.chamferCorners ?? [])],
        rectDelta: this.pad.rectDelta ? { ...this.pad.rectDelta } : undefined,
        customGraphics: [...(this.pad.customGraphics ?? [])],
        clearance: this.pad.clearanceMode,
      };
    }
    return {
      layer,
      shape: override?.shape ?? this.pad.shape,
      size: { ...(override?.size ?? this.pad.size) },
      rotation: override?.rotation ?? this.pad.rotation,
      offset: override?.offset ? { ...override.offset } : this.pad.offset ? { ...this.pad.offset } : undefined,
      roundrectRatio: override?.roundrectRatio ?? this.pad.roundrectRatio ?? 0.25,
      chamferRatio: override?.chamferRatio ?? this.pad.chamferRatio ?? 0,
      chamferCorners: [...(override?.chamferCorners ?? this.pad.chamferCorners ?? [])],
      rectDelta: override?.rectDelta ? { ...override.rectDelta } : this.pad.rectDelta ? { ...this.pad.rectDelta } : undefined,
      customGraphics: [...(override?.customGraphics ?? this.pad.customGraphics ?? [])],
      clearance: override?.clearance ?? this.pad.clearanceMode,
    };
  }

  layers(): string[] {
    return [...new Set([
      ...this.pad.layers,
      ...Object.keys(this.pad.layerOverrides ?? {}),
    ])];
  }

  copperLayers(): string[] {
    return this.layers().filter(layer => layer === "F.Cu" || layer === "B.Cu" || layer === "*.Cu" || layer.endsWith(".Cu"));
  }

  maskLayers(): string[] {
    return this.layers().filter(layer => layer === "F.Mask" || layer === "B.Mask" || layer === "*.Mask");
  }

  pasteLayers(): string[] {
    return this.layers().filter(layer => layer === "F.Paste" || layer === "B.Paste" || layer === "*.Paste");
  }

  isThroughHole(): boolean {
    return this.pad.type === "thru_hole" || this.pad.type === "np_thru_hole";
  }

  isPlatedThroughHole(): boolean {
    return this.pad.type === "thru_hole";
  }

  isNonPlatedHole(): boolean {
    return this.pad.type === "np_thru_hole";
  }
}
