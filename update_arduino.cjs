const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /export const ArduinoNano3D = \(\{ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered \}: any\) => \{[\s\S]*?^  \);[\n\r]+^\};/m;

const newCode = `export const ArduinoNano3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const isMini = (fp.value || fp.footprint || fp.name || "").toLowerCase().includes("mini") || (fp.reference || "").toLowerCase().includes("mini");
  const moduleColor = "#005a9c"; // Royal Arduino Blue
  
  const boardW = size.h || 17.78; // Width along X in vertical view
  const boardH = size.w || (isMini ? 33.02 : 43.18); // Height along Y in vertical view
  const boardD = 1.2;
  
  const zPCB = 4.0; // bottom of raised board
  const pcbMidZ = zPCB + boardD / 2; // 4.6
  const pcbTopZ = zPCB + boardD; // 5.2

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
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.3} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color={moduleColor} roughness={0.75} clearcoat={0.3} />
        </RoundedBox>

        {/* 2. Main MCU (ATmega328P TQFP-32 rotated 45 degrees, which is classic) */}
        <group position={[0, boardH * 0.08, pcbTopZ + 0.5]} rotation={[0, 0, Math.PI / 4]}>
          <mesh castShadow>
            <boxGeometry args={[7.0, 7.0, 0.9]} />
            <meshStandardMaterial color="#111" roughness={0.6} />
          </mesh>
          {/* Tiny circle dot at Pin 1 */}
          <mesh position={[-2.8, -2.8, 0.46]}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshBasicMaterial color="#dedede" />
          </mesh>
          {/* Microscopic metallic lines to represent TQFP pins */}
          <mesh position={[0, 0, -0.2]}>
            <boxGeometry args={[8.2, 6.0, 0.1]} />
            <meshStandardMaterial color="#cccccc" {...SILVER_METAL} />
          </mesh>
          <mesh position={[0, 0, -0.2]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[8.2, 6.0, 0.1]} />
            <meshStandardMaterial color="#cccccc" {...SILVER_METAL} />
          </mesh>
          {/* Faint IC label */}
          <Text position={[0, 0, 0.46]} rotation={[0, 0, -Math.PI / 4]} fontSize={0.8}
            color="#aaa" anchorX="center" anchorY="middle">ATMEL</Text>
        </group>

        {/* 3. USB Port (Mini/Micro USB connector) at the top edge */}
        {!isMini && (
          <group position={[0, boardH / 2 - 2, pcbTopZ + 1.5]}>
            {/* Outer metal shield */}
            <mesh castShadow>
              <boxGeometry args={[7.5, 5.5, 2.5]} />
              <meshStandardMaterial color="#dcdcdc" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* Inner plastic and dark hole */}
            <mesh position={[0, 2.7, -0.2]}>
              <boxGeometry args={[5, 1, 1]} />
              <meshBasicMaterial color="#111" />
            </mesh>
          </group>
        )}

        {/* 4. CH340 / Serial Chip (SOIC-16 on the bottom usually, but we'll show it for flavor) */}
        <group position={[0, -boardH * 0.25, pcbTopZ + 0.6]}>
          <mesh castShadow>
            <boxGeometry args={[4.5, 9.0, 1.2]} />
            <meshStandardMaterial color="#222" roughness={0.7} />
          </mesh>
        </group>

        {/* 5. ICSP Header (2x3 pins at the bottom) */}
        <group position={[0, -boardH / 2 + 5, pcbTopZ + 1.25]}>
          {/* Black plastic base */}
          <mesh castShadow>
            <boxGeometry args={[5, 7.6, 2.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {/* 6 gold pins */}
          {[-1.27, 1.27].map((x, ix) =>
            [-2.54, 0, 2.54].map((y, iy) => (
              <mesh key={\`\${ix}-\${iy}\`} position={[x, y, 1.5]} castShadow>
                <boxGeometry args={[0.64, 0.64, 3.5]} />
                <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
              </mesh>
            ))
          )}
        </group>

        {/* 6. Push Button (Reset) */}
        <group position={[0, boardH * 0.35, pcbTopZ + 1.0]}>
          <mesh castShadow>
            <boxGeometry args={[3, 4, 1.5]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.5} roughness={0.5} />
          </mesh>
          {/* Button actuator */}
          <mesh position={[0, 0, 0.75]} castShadow>
            <cylinderGeometry args={[0.8, 0.8, 0.5, 16]} />
            <meshStandardMaterial color="#111" roughness={0.8} />
          </mesh>
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
            {/* Black Plastic Spacer block */}
            <mesh position={[hole.relativeX, hole.relativeY, 1.5]} castShadow>
              <boxGeometry args={[2.45, 2.45, 3.0]} />
              <meshStandardMaterial color="#1e1e1e" roughness={0.85} />
            </mesh>
            {/* Continuous square pin header */}
            <mesh position={[hole.relativeX, hole.relativeY, pinMidZ]} castShadow>
              <boxGeometry args={[0.64, 0.64, pinLen]} />
              <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
            </mesh>
            {/* Bottom Solder Joint under Motherboard */}
            <BottomSolderMesh position={[hole.relativeX, hole.relativeY, -bt - 0.05]} rotation={[-Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 0.9, 0.25, 12]} />
              <SolderMaterial />
            </BottomSolderMesh>
            {/* Top Solder Joint on Nano PCB */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 0.9, 0.2, 12]} />
              <SolderMaterial />
            </mesh>
            {/* Gold Edge Pads on Nano PCB */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.01]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.9, 0.9, 0.02, 16]} />
              <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
            </mesh>
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
console.log('Done replacing ArduinoNano3D');
