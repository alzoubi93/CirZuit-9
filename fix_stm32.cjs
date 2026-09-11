const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /export const STM32BluePill3D = \(\{ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered \}: any\) => \{[\s\S]*?^  \);[\n\r]+^\};/m;

const newCode = `export const STM32BluePill3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const boardW = size.w || 22.9;
  const boardH = size.h || 53.3;
  const boardD = 1.6;
  
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
      
      {/* Visual Board Group */}
      <group>
        {/* Raised PCB */}
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.3} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color="#154360" roughness={0.7} clearcoat={0.2} /> {/* Bluepill blue */}
        </RoundedBox>
        
        {/* Main MCU (STM32F103C8T6 LQFP-48) */}
        <group position={[0, 2, pcbTopZ + 0.5]} rotation={[0, 0, Math.PI / 4]}>
          <mesh castShadow>
            <boxGeometry args={[7.0, 7.0, 1.0]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
          </mesh>
          <mesh position={[-2.5, 2.5, 0.51]}>
            <sphereGeometry args={[0.25, 12, 12]} />
            <meshBasicMaterial color="#dedede" />
          </mesh>
          <Text position={[0, 0, 0.51]} rotation={[0, 0, -Math.PI / 4]} fontSize={1.0} color="#999" anchorX="center" anchorY="middle">STM32</Text>
        </group>

        {/* Micro-USB Port at the top */}
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

        {/* Reset Button */}
        <group position={[boardW / 2 - 3, boardH / 2 - 10, pcbTopZ + 0.5]}>
          <mesh castShadow><boxGeometry args={[3, 4, 1.5]} /><meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.5} /></mesh>
          <mesh position={[0, 0, 0.75]} castShadow><cylinderGeometry args={[0.8, 0.8, 0.5, 16]} /><meshStandardMaterial color="#111" roughness={0.8} /></mesh>
        </group>
        
        {/* Yellow Pin Headers (Programming) */}
        <group position={[0, boardH / 2 - 12, pcbTopZ + 2.5]}>
          <mesh castShadow><boxGeometry args={[10, 2.54, 5]} /><meshStandardMaterial color="#ffeb3b" roughness={0.6} /></mesh>
        </group>
        
        {/* 32.768kHz Crystal */}
        <group position={[-boardW / 2 + 4, -5, pcbTopZ + 0.8]}>
          <mesh castShadow><cylinderGeometry args={[1, 1, 4, 16]} rotation={[0, 0, Math.PI / 2]} /><meshStandardMaterial color="#b0b0b0" metalness={0.9} roughness={0.2} /></mesh>
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
console.log('Fixed STM32');
