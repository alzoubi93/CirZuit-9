const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /export const RaspberryPico3D = \(\{ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered \}: any\) => \{[\s\S]*?^  \);[\n\r]+^\};/m;

const newCode = `export const RaspberryPico3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const boardW = size.h || 21.0;
  const boardH = size.w || 51.0;
  const boardD = 1.2;
  
  const zPCB = 4.0;
  const pcbMidZ = zPCB + boardD / 2;
  const pcbTopZ = zPCB + boardD;

  const rotZ = typeof rotation === "number" ? rotation : (Array.isArray(rotation) ? rotation[2] : (rotation?.z ?? 0));
  const adjustedRotation: [number, number, number] = [
    Array.isArray(rotation) ? rotation[0] : (rotation?.x ?? 0),
    Array.isArray(rotation) ? rotation[1] : (rotation?.y ?? 0),
    rotZ
  ];

  return (
    <group position={position} rotation={adjustedRotation}
      onClick={(e: ThreeEvent) => { e.stopPropagation(); onSelect(fp); }}
      onPointerOver={(e: ThreeEvent) => { e.stopPropagation(); onHover(fp); }}
      onPointerOut={() => onHover(null)}>
      
      {/* Visual Board Group - Rotated 180 degrees */}
      <group rotation={[0, 0, Math.PI]}>
        {/* 1. Raised Module PCB */}
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.4} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color="#005d3b" roughness={0.7} clearcoat={0.1} /> {/* Raspberry Green */}
        </RoundedBox>

        {/* 2. RP2040 MCU (QFN-56) */}
        <group position={[0, -2.5, pcbTopZ + 0.3]}>
          <mesh castShadow>
            <boxGeometry args={[7, 7, 0.6]} />
            <meshStandardMaterial color="#111" roughness={0.8} />
          </mesh>
          <Text position={[0, 0, 0.31]} fontSize={1.0} color="#999" anchorX="center" anchorY="middle">RP2040</Text>
        </group>

        {/* 3. Micro-USB Port */}
        <group position={[0, boardH / 2 - 2, pcbTopZ + 1.25]}>
          <mesh castShadow>
            <boxGeometry args={[7.5, 5.5, 2.5]} />
            <meshStandardMaterial color="#dcdcdc" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 2.7, -0.2]}>
            <boxGeometry args={[5, 1, 1]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        </group>

        {/* 4. BOOTSEL Button */}
        <group position={[5, boardH / 2 - 8, pcbTopZ + 0.8]}>
          <mesh castShadow><boxGeometry args={[3.5, 4.5, 1.6]} /><meshStandardMaterial color="#e0e0e0" /></mesh>
          <mesh position={[0, 0, 0.8]}><cylinderGeometry args={[1, 1, 0.4, 16]} /><meshStandardMaterial color="#111" /></mesh>
        </group>

        {/* 5. 3-pin Debug Header at Bottom */}
        <group position={[0, -boardH / 2 + 3, pcbTopZ + 2.0]}>
          <mesh castShadow><boxGeometry args={[7.62, 2.54, 4.0]} /><meshStandardMaterial color="#1a1a1a" roughness={0.8} /></mesh>
          {[-2.54, 0, 2.54].map((x) => (
            <mesh key={x} position={[x, 0, 1.0]} castShadow>
              <boxGeometry args={[0.64, 0.64, 2.0]} />
              <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
            </mesh>
          ))}
        </group>
      </group>

      {/* Pins and Solder Joints - Unrotated relative to footprint pads */}
      {holes.map((hole, idx) => {
        const pinDia = 0.64;
        const zBottom = -bt - 0.8;
        const pinLen = pcbMidZ - zBottom;
        const pinMidZ = (pcbMidZ + zBottom) / 2;

        return (
          <group key={idx}>
            {/* Subtle solder pad on top only */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.7, 0.7, 0.05, 12]} />
              <SolderMaterial />
            </mesh>
            {/* Continuous square pin header down through motherboard */}
            <mesh position={[hole.relativeX, hole.relativeY, pinMidZ]} castShadow>
              <boxGeometry args={[pinDia, pinDia, pinLen]} />
              <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
            </mesh>
            {/* Bottom Solder Joint under Motherboard */}
            <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 1.5, 0.25, 12]} />
              <SolderMaterial />
            </BottomSolderMesh>
          </group>
        );
      })}

      {isSelected && <SelectionHalo w={boardW + 0.8} h={boardH + 0.8} d={zPCB + boardD + 2.5} />}
      {isHovered && !isSelected && <HoverGlow w={boardW + 0.4} h={boardH + 0.4} d={zPCB + boardD + 2.5} />}
    </group>
  );
};`;

content = content.replace(regex, newCode);
fs.writeFileSync(file, content);
console.log('Done replacing RaspberryPico3D');
