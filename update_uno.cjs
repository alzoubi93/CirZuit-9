const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /export const ArduinoUno3D = \(\{ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered \}: any\) => \{[\s\S]*?^  \);[\n\r]+^\};/m;

const newCode = `export const ArduinoUno3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const boardW = size.h || 53.34; // Width along X in vertical view
  const boardH = size.w || 68.6;  // Height along Y in vertical view
  const boardD = 1.6;
  
  const zPCB = 1.2; // slight clearance stance
  const pcbMidZ = zPCB + boardD / 2; // 2.0
  const pcbTopZ = zPCB + boardD; // 2.8

  // Main Arduino Teal color
  const boardColor = "#008184"; 

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
        {/* 1. Arduino Uno motherboard sitting on corner standoff screws */}
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.5} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color={boardColor} roughness={0.65} clearcoat={0.4} />
        </RoundedBox>

        {/* 2. Standoff Screws in 4 Corners */}
        {/* Top Left */}
        <group position={[-boardW * 0.42, boardH * 0.44, 0.6]}>
          <mesh><cylinderGeometry args={[1.5, 1.5, 1.2, 12]} /><meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} /></mesh>
          <mesh position={[0, 0, 1.1]}><cylinderGeometry args={[2.5, 2.5, 0.4, 12]} /><meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} /></mesh>
        </group>
        {/* Bottom Left */}
        <group position={[-boardW * 0.42, -boardH * 0.44, 0.6]}>
          <mesh><cylinderGeometry args={[1.5, 1.5, 1.2, 12]} /><meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} /></mesh>
          <mesh position={[0, 0, 1.1]}><cylinderGeometry args={[2.5, 2.5, 0.4, 12]} /><meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} /></mesh>
        </group>
        {/* Top Right */}
        <group position={[boardW * 0.42, boardH * 0.44, 0.6]}>
          <mesh><cylinderGeometry args={[1.5, 1.5, 1.2, 12]} /><meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} /></mesh>
          <mesh position={[0, 0, 1.1]}><cylinderGeometry args={[2.5, 2.5, 0.4, 12]} /><meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} /></mesh>
        </group>
        {/* Bottom Right */}
        <group position={[boardW * 0.42, -boardH * 0.44, 0.6]}>
          <mesh><cylinderGeometry args={[1.5, 1.5, 1.2, 12]} /><meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} /></mesh>
          <mesh position={[0, 0, 1.1]}><cylinderGeometry args={[2.5, 2.5, 0.4, 12]} /><meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} /></mesh>
        </group>

        {/* 3. ATmega328P DIP-28 MCU */}
        <group position={[0, 0, pcbTopZ + 1.8]}>
          <mesh castShadow>
            <boxGeometry args={[12, 35.5, 3.6]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {/* U-shape notch at Top */}
          <mesh position={[0, 17, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.5, 1.5, 4, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          {/* Silver DIP Pins */}
          <mesh position={[-5.8, 0, -1]} castShadow>
            <boxGeometry args={[0.5, 35, 2.5]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>
          <mesh position={[5.8, 0, -1]} castShadow>
            <boxGeometry args={[0.5, 35, 2.5]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>
          <Text position={[0, 0, 1.9]} rotation={[0, 0, -Math.PI / 2]} fontSize={1.6} color="#aaa" anchorX="center" anchorY="middle">ATMEGA328P</Text>
        </group>

        {/* 4. Type-B USB Port (Top Left Edge) */}
        <group position={[-boardW * 0.25, boardH / 2 - 3, pcbTopZ + 5.5]}>
          <mesh castShadow>
            <boxGeometry args={[12, 16, 11]} />
            <meshStandardMaterial color="#dcdcdc" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 8.2, 0]}>
            <boxGeometry args={[9, 1, 8]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        </group>

        {/* 5. DC Barrel Jack (Bottom Left Edge) */}
        <group position={[-boardW * 0.35, -boardH / 2 + 5, pcbTopZ + 5.5]}>
          <mesh castShadow>
            <boxGeometry args={[9, 13, 11]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
          </mesh>
          <mesh position={[0, -6.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[2.5, 2.5, 1, 16]} />
            <meshBasicMaterial color="#000" />
          </mesh>
        </group>

        {/* 6. ATmega16U2 (Small square chip near USB) */}
        <group position={[-boardW * 0.15, boardH * 0.15, pcbTopZ + 0.5]} rotation={[0, 0, Math.PI / 4]}>
          <mesh castShadow>
            <boxGeometry args={[5, 5, 1]} />
            <meshStandardMaterial color="#222" />
          </mesh>
        </group>

        {/* 7. Crystal Oscillator (Silver oval) */}
        <group position={[-boardW * 0.2, boardH * 0.05, pcbTopZ + 1.2]}>
          <mesh castShadow>
            <boxGeometry args={[4, 11, 2.5]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.8} roughness={0.3} />
          </mesh>
        </group>

        {/* 8. Reset Button (Top edge) */}
        <group position={[boardW * 0.15, boardH / 2 - 3, pcbTopZ + 1]}>
          <mesh castShadow><boxGeometry args={[4, 4, 2]} /><meshStandardMaterial color="#1e1e1e" /></mesh>
          <mesh position={[0, 0, 1]}><cylinderGeometry args={[1, 1, 0.5, 16]} /><meshStandardMaterial color="#b00020" /></mesh>
        </group>

        {/* 9. Black Female Header Sockets on Right Edge */}
        <group position={[boardW * 0.4, 0, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, boardH * 0.9, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          {/* Top pin holes mapping */}
          {Array.from({ length: 28 }).map((_, i) => (
            <mesh key={i} position={[0, boardH * 0.4 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.5, 1.5, 0.2]} />
              <meshBasicMaterial color="#111" />
            </mesh>
          ))}
        </group>

        {/* 10. Black Female Header Sockets on Left Edge (Analog/Power) */}
        <group position={[-boardW * 0.1, -boardH * 0.35, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, boardH * 0.5, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          {Array.from({ length: 14 }).map((_, i) => (
            <mesh key={i} position={[0, boardH * 0.23 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.5, 1.5, 0.2]} />
              <meshBasicMaterial color="#111" />
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

      {isSelected && <SelectionHalo w={boardW + 0.8} h={boardH + 0.8} d={zPCB + boardD + 10} />}
      {isHovered && !isSelected && <HoverGlow w={boardW + 0.4} h={boardH + 0.4} d={zPCB + boardD + 10} />}
    </group>
  );
};`;

content = content.replace(regex, newCode);
fs.writeFileSync(file, content);
console.log('Done replacing ArduinoUno3D');
