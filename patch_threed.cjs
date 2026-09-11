const fs = require('fs');
let code = fs.readFileSync('src/components/editor/ThreeDRealModels.tsx', 'utf-8');

// In detectComponent
const connDetection = `
  if (sym.startsWith("conn_")) {
    const parts = sym.split("_");
    const gender = parts[1];
    const r_p = parts[2].split("x");
    const rows = parseInt(r_p[0], 10) || 1;
    const cols = parseInt(r_p[1], 10) || pinCount;
    const pitch = parseFloat(parts[3]) || 2.54;
    return mk("header_pin", cols * pitch, rows * pitch, 8.5, "#111", { pins: pinCount, rows, cols, pitch, gender });
  }
`;

code = code.replace(
  'if (text.includes("header") || text.includes("pinhdr") || ref.startsWith("J")) return mk("header_pin", Math.max(fpW, 2.54 * pinCount), 2.54, 8.5, "#111", { pins: pinCount });',
  connDetection + '\n  if (text.includes("header") || text.includes("pinhdr") || ref.startsWith("J")) return mk("header_pin", Math.max(fpW, 2.54 * pinCount), 2.54, 8.5, "#111", { pins: pinCount });'
);

// In HeaderPin3D
const newHeader = `
export const HeaderPin3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  let pins = Math.max(fp.pads?.length || 2, 2);
  let rows = 1;
  let cols = pins;
  let pitch = 2.54;
  let isFemale = false;
  
  if (fp.symbol && fp.symbol.toLowerCase().startsWith("conn_")) {
    const parts = fp.symbol.toLowerCase().split("_");
    const r_p = parts[2].split("x");
    rows = parseInt(r_p[0], 10) || 1;
    cols = parseInt(r_p[1], 10) || pins;
    pitch = parseFloat(parts[3]) || 2.54;
    isFemale = parts[1] === "female";
  } else {
    // If we have a generic header based on pads
    // Attempt to guess rows based on bounding box
    const padsY = (fp.pads && fp.pads.length > 0) ? fp.pads.map((p: any) => p.y || 0) : [0];
    const fpH = Math.abs(Math.max(...padsY) - Math.min(...padsY));
    if (fpH > 3) {
      rows = 2;
      cols = pins / 2;
    }
  }

  const boxW = cols * pitch;
  const boxH = rows * pitch;
  const boxD = isFemale ? 8.5 : 2.5;

  return (
    <group position={position} rotation={rotation}
      onClick={(e: any) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: any) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      <mesh castShadow position={[0, 0, boxD / 2]}><boxGeometry args={[boxW, boxH, boxD]} />
        <meshPhysicalMaterial color="#111" roughness={0.7} />
      </mesh>
      {isFemale && (
        <group position={[0,0, boxD]}>
          {fp.pads?.map((p: any, i: number) => (
             <mesh key={i} position={[p.x, p.y, 0]}>
               <boxGeometry args={[pitch * 0.6, pitch * 0.6, 0.2]} />
               <meshStandardMaterial color="#000" roughness={0.9} />
             </mesh>
          ))}
        </group>
      )}
      {!isFemale && <ComponentPins3D fp={fp} size={size} mode="header" />}
      {isSelected && <SelectionHalo w={boxW} h={boxH} d={size.d} />}
      {isHovered && !isSelected && <HoverGlow w={boxW} h={boxH} d={size.d} />}
    </group>
  );
};
`;

code = code.replace(
  /export const HeaderPin3D = \(\{ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered \}: any\) => \{[\s\S]*?<\HoverGlow[\s\S]*?<\/group>\s*\);\s*\};\s*/,
  newHeader
);

fs.writeFileSync('src/components/editor/ThreeDRealModels.tsx', code);
