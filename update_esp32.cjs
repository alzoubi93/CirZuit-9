const fs = require('fs');
const file = 'src/components/editor/ThreeDRealModels.tsx';
let content = fs.readFileSync(file, 'utf8');

const regex = /export const ESP32Module3D = \(\{ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered \}: any\) => \{[\s\S]*?^  \);[\n\r]+^\};/m;

const newCode = `export const ESP32Module3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const isESP8266 = (fp.value || fp.footprint || fp.name || "").toLowerCase().includes("8266");
  const moduleColor = isESP8266 ? "#1565c0" : "#121212"; // Blue for ESP8266, Matte Black for ESP32
  
  const boardW = size.h || (isESP8266 ? 25.4 : 27.94); // Width along X in vertical view
  const boardH = size.w || (isESP8266 ? 48.0 : 54.61); // Height along Y in vertical view
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
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.4} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color={moduleColor} roughness={0.8} />
        </RoundedBox>

        {/* 2. ESP32 / ESP8266 Metallic Shielding Can */}
        {!isESP8266 ? (
          // ESP32 WROOM Shield
          <group position={[0, boardH * 0.12, pcbTopZ + 0.85]}>
            <mesh castShadow>
              <boxGeometry args={[20, 18, 1.7]} />
              <meshPhysicalMaterial color="#dedede" metalness={0.9} roughness={0.2} clearcoat={0.3} />
            </mesh>
            <Text position={[0, 0, 0.86]} fontSize={1.5}
              color="#222" anchorX="center" anchorY="middle">ESP32-WROOM</Text>
          </group>
        ) : (
          // ESP8266 / ESP-12F Shield
          <group position={[0, boardH * 0.1, pcbTopZ + 0.75]}>
            <mesh castShadow>
              <boxGeometry args={[15, 16, 1.5]} />
              <meshPhysicalMaterial color="#d0d0d0" metalness={0.9} roughness={0.25} />
            </mesh>
            <Text position={[0, 0, 0.76]} fontSize={1.2}
              color="#333" anchorX="center" anchorY="middle">ESP-12F</Text>
          </group>
        )}

        {/* 3. PCB Antenna Trace Area */}
        <group position={[0, boardH / 2 - 4, pcbTopZ + 0.1]}>
          <mesh castShadow>
            <boxGeometry args={[15, 6, 0.2]} />
            <meshStandardMaterial color="#b8860b" roughness={0.6} metalness={0.8} />
          </mesh>
        </group>

        {/* 4. Micro-USB Port (Usually at the bottom for dev boards, but let's place it at top if rotating?) */}
        {/* We place it at bottom edge, since that's standard for NodeMCU and ESP32 DevKitC. 
            Wait, if the user rotates 180, it means it was previously at bottom and they wanted it at top, or vice versa?
            We will place it at the edge matching the original logic, and the group rotation will invert it. */}
        <group position={[0, -boardH / 2 + 2, pcbTopZ + 1.25]}>
          <mesh castShadow>
            <boxGeometry args={[7.5, 5.5, 2.5]} />
            <meshStandardMaterial color="#dcdcdc" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, -2.7, -0.2]}>
            <boxGeometry args={[5, 1, 1]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        </group>

        {/* 5. Boot and EN Buttons */}
        <group position={[-5, -boardH / 2 + 7, pcbTopZ + 0.8]}>
          <mesh castShadow><boxGeometry args={[3, 4, 1.6]} /><meshStandardMaterial color="#e0e0e0" /></mesh>
          <mesh position={[0, 0, 0.8]}><cylinderGeometry args={[0.8, 0.8, 0.4, 16]} /><meshStandardMaterial color="#111" /></mesh>
        </group>
        <group position={[5, -boardH / 2 + 7, pcbTopZ + 0.8]}>
          <mesh castShadow><boxGeometry args={[3, 4, 1.6]} /><meshStandardMaterial color="#e0e0e0" /></mesh>
          <mesh position={[0, 0, 0.8]}><cylinderGeometry args={[0.8, 0.8, 0.4, 16]} /><meshStandardMaterial color="#111" /></mesh>
        </group>

        {/* 6. CP2102 or CH340 Serial Chip */}
        <group position={[0, -boardH * 0.15, pcbTopZ + 0.4]}>
          <mesh castShadow>
            <boxGeometry args={[5.0, 5.0, 0.8]} />
            <meshStandardMaterial color="#222" roughness={0.7} />
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
            {/* Top Solder Joint on ESP32 PCB */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[pinDia * 0.9, 0.2, 12]} />
              <SolderMaterial />
            </mesh>
            {/* Gold Edge Pads on ESP32 PCB */}
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
console.log('Done replacing ESP32Module3D');
