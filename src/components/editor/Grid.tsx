// Classic square grid: clear but transparent, scales with zoom (pinch to zoom).
import { memo } from "react";

// Kept for type compatibility with existing call sites; the renderer always draws a square grid.
export type GridStyle = "dots" | "square" | "hybrid";

interface Props {
  width: number;
  height: number;
  /** screen-px size of one grid unit */
  gridSize: number;
  offsetX: number;
  offsetY: number;
  isDark: boolean;
  style?: GridStyle;
  /** 0..1 */
  opacity?: number;
  zoom?: number;
  isSimulating?: boolean;
}

export const SmartGrid = memo(function SmartGrid({
  width, height, gridSize, offsetX, offsetY, isDark, opacity = 1, isSimulating = false,
}: Props) {
  const minor = isSimulating ? "#0a0f1d" : (isDark ? "#1f2a44" : "#dde3ec");
  const major = isSimulating ? "#162035" : (isDark ? "#33446b" : "#b8c2d1");

  const ox = ((offsetX % gridSize) + gridSize) % gridSize;
  const oy = ((offsetY % gridSize) + gridSize) % gridSize;
  const majorEvery = isSimulating ? 10 : 5;
  const majorSize = gridSize * majorEvery;
  const oxM = ((offsetX % majorSize) + majorSize) % majorSize;
  const oyM = ((offsetY % majorSize) + majorSize) % majorSize;

  // Hide minor grid when squares get too small to avoid visual noise at far zoom.
  const showMinor = isSimulating ? false : (gridSize >= 6);

  return (
    <g opacity={opacity}>
      <defs>
        {showMinor && (
          <pattern
            id="grid-square-min"
            width={gridSize}
            height={gridSize}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${ox} ${oy})`}
          >
            <path
              d={`M ${gridSize} 0 L 0 0 0 ${gridSize}`}
              fill="none"
              stroke={minor}
              strokeWidth={0.6}
            />
          </pattern>
        )}
        <pattern
          id="grid-square-maj"
          width={majorSize}
          height={majorSize}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${oxM} ${oyM})`}
        >
          <path
            d={`M ${majorSize} 0 L 0 0 0 ${majorSize}`}
            fill="none"
            stroke={major}
            strokeWidth={1}
          />
        </pattern>
      </defs>
      {showMinor && <rect width={width} height={height} fill="url(#grid-square-min)" />}
      <rect width={width} height={height} fill="url(#grid-square-maj)" />
    </g>
  );
});
