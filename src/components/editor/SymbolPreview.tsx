import { SYMBOLS } from "@/lib/symbols";
import type { SymbolId } from "@/lib/schematic";
import { RealisticComponent, RealisticDefs } from "./RealisticComponents";
import { getImportedKiCadSymbol } from "@/lib/kicadSymbol";

export function SymbolPreview({ id, size = 56, color = "currentColor", realistic = false }: { id: SymbolId; size?: number; color?: string; realistic?: boolean }) {
  const sym = SYMBOLS[id] || getImportedKiCadSymbol(id);
  if (!sym) return null;
  const pad = 0.5;
  const w = sym.width + pad * 2;
  const h = sym.height + pad * 2;
  // KiCad symbols are vector schematic drawings — skip realistic 3D preview
  const useRealistic = realistic && !String(id).startsWith("kicad:");
  return (
    <svg viewBox={`${-pad} ${-pad} ${w} ${h}`} width={size} height={size} preserveAspectRatio="xMidYMid meet">
      {useRealistic ? (
        <>
          <RealisticDefs />
          <g transform={`translate(0, 0)`}>
            <RealisticComponent
              node={{
                id: `preview-${id}`,
                symbol: id,
                x: 0,
                y: 0,
                rotation: 0,
                value: sym.defaultValue,
              }}
              width={sym.width}
              height={sym.height}
            />
          </g>
        </>
      ) : (
        sym.draw(color)
      )}
    </svg>
  );
}
