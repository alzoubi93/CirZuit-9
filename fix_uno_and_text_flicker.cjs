const fs = require('fs');

// 1. Update ThreeDPreview.tsx
let previewContent = fs.readFileSync('src/components/editor/ThreeDPreview.tsx', 'utf8');

// Ensure user text Z pos is raised slightly and polygonOffset is applied
previewContent = previewContent.replace(
  /const zPos = isBottom \? -boardThickness \/ 2 - 0\.0[0-9]+ : boardThickness \/ 2 \+ 0\.0[0-9]+;/g,
  'const zPos = isBottom ? -boardThickness / 2 - 0.15 : boardThickness / 2 + 0.15;'
);

previewContent = previewContent.replace(
  /<Text\s+key={`user-text-\${t\.id \|\| i}`}[\s\S]*?>/g,
  `<Text
                    key={\`user-text-\${t.id || i}\`}
                    position={[t.x, boardHeight - t.y, zPos]}
                    rotation={[rotX, 0, rotZ]}
                    fontSize={t.size || 1.5}
                    color="#ffffff"
                    anchorX="center"
                    anchorY="middle"
                    fontFamily="monospace"
                    fontWeight="bold"
                    polygonOffset
                    polygonOffsetFactor={-10}
                    renderOrder={100}
                  >`
);

fs.writeFileSync('src/components/editor/ThreeDPreview.tsx', previewContent);
console.log('Updated ThreeDPreview.tsx text settings');

// 2. Update ThreeDRealModels.tsx
let realModels = fs.readFileSync('src/components/editor/ThreeDRealModels.tsx', 'utf8');

// Replace SilkScreenLayer
const oldSilkScreenRegex = /export const SilkScreenLayer = \(\{[\s\S]*?\n\};/;
const newSilkScreen = `export const SilkScreenLayer = ({ fp, boardThickness, boardHeight = 80 }: any) => {
  const meas = extractComponentMeasurements(fp, boardHeight);
  const w = meas.length || 5;
  const h = meas.width || 5;
  const lineThickness = 0.15;
  const color = "#f5f5f5";
  return (
    <group position={[meas.x, meas.y, boardThickness / 2 + 0.10]}>
      {/* Component Outline Frame */}
      <group rotation={[0, 0, meas.rotationRad]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w + lineThickness, lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[0, -h / 2, 0]}>
          <boxGeometry args={[w + lineThickness, lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[-w / 2, 0, 0]}>
          <boxGeometry args={[lineThickness, h + lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[w / 2, 0, 0]}>
          <boxGeometry args={[lineThickness, h + lineThickness, 0.02]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
      </group>
      {/* Component Text Reference */}
      <Text position={[0, 0, 0.08]}
        fontSize={Math.max(1.2, Math.min(fp.w || fp.width || 5, fp.h || fp.height || 5) * 0.23)}
        color="#ffffff" anchorX="center" anchorY="middle"
        outlineWidth={0.02} outlineColor="#000000"
        polygonOffset polygonOffsetFactor={-10} renderOrder={100}>
        {fp.reference || ""}
      </Text>
    </group>
  );
};`;

realModels = realModels.replace(oldSilkScreenRegex, newSilkScreen);

// Add polygonOffset polygonOffsetFactor={-10} renderOrder={100} to all <Text> tags in ThreeDRealModels
realModels = realModels.replace(/<Text\s+(?![^>]*polygonOffset)/g, '<Text polygonOffset polygonOffsetFactor={-10} renderOrder={100} ');

// 3. Replace ArduinoUno3D with an ultra-realistic, accurately detailed, perfectly dimensioned model
const oldUnoRegex = /export const ArduinoUno3D = \(\{[\s\S]*?\n\};/;

const newUno3D = `export const ArduinoUno3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const boardW = 53.34; // Standard Arduino Uno Width along X (2.1 inches)
  const boardH = 68.6;  // Standard Arduino Uno Height along Y (2.7 inches)
  const boardD = 1.6;

  const zPCB = 1.2;
  const pcbMidZ = zPCB + boardD / 2; // 2.0 mm
  const pcbTopZ = zPCB + boardD;     // 2.8 mm
  const arduinoTeal = "#008184";     // Official Arduino Teal / Deep Cyan

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
        {/* 1. Main Arduino PCB Motherboard */}
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.6} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color={arduinoTeal} roughness={0.6} clearcoat={0.3} />
        </RoundedBox>

        {/* Crisp White Silkscreen Branding on PCB */}
        <Text position={[0, 18, pcbTopZ + 0.12]} fontSize={3.2} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold" polygonOffset polygonOffsetFactor={-10} renderOrder={100}>
          ARDUINO
        </Text>
        <Text position={[0, 13.5, pcbTopZ + 0.12]} fontSize={2.2} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold" polygonOffset polygonOffsetFactor={-10} renderOrder={100}>
          UNO R3
        </Text>

        {/* 2. Four Mounting Holes with Silver Copper Pads */}
        {[
          { x: -boardW / 2 + 15.24, y: boardH / 2 - 2.54 },  // Top Left
          { x: boardW / 2 - 2.54,   y: boardH / 2 - 15.24 }, // Top Right
          { x: boardW / 2 - 2.54,   y: -boardH / 2 + 2.54 }, // Bottom Right
          { x: -boardW / 2 + 15.24, y: -boardH / 2 + 2.54 }  // Bottom Left
        ].map((hole, idx) => (
          <group key={\`uno-hole-\${idx}\`} position={[hole.x, hole.y, pcbMidZ]}>
            <mesh>
              <cylinderGeometry args={[2.0, 2.0, boardD + 0.1, 16]} />
              <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
            </mesh>
            <mesh>
              <cylinderGeometry args={[1.6, 1.6, boardD + 0.3, 16]} />
              <meshBasicMaterial color="#111" />
            </mesh>
          </group>
        ))}

        {/* 3. USB Type-B Connector (Top-Left Edge - Protrudes over edge) */}
        <group position={[-18.5, boardH / 2 - 6, pcbTopZ + 5.5]}>
          {/* Main Silver Shield */}
          <mesh castShadow>
            <boxGeometry args={[12, 16, 11]} />
            <meshStandardMaterial color="#dcdcdc" metalness={0.92} roughness={0.18} />
          </mesh>
          {/* Receptacle Hole */}
          <mesh position={[0, 8.05, 0]}>
            <boxGeometry args={[9, 0.2, 8]} />
            <meshBasicMaterial color="#050505" />
          </mesh>
          {/* White Plastic Tongue */}
          <mesh position={[0, 4.5, 0]}>
            <boxGeometry args={[7.5, 6, 2]} />
            <meshStandardMaterial color="#f0f0f0" roughness={0.4} />
          </mesh>
        </group>

        {/* 4. DC Power Barrel Jack (Bottom-Left Edge - Protrudes over edge) */}
        <group position={[-18.5, -boardH / 2 + 6, pcbTopZ + 5.5]}>
          <mesh castShadow>
            <boxGeometry args={[9, 13.5, 11]} />
            <meshStandardMaterial color="#181818" roughness={0.8} />
          </mesh>
          {/* Outer Ring Opening */}
          <mesh position={[0, -6.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[2.7, 2.7, 0.2, 16]} />
            <meshBasicMaterial color="#000" />
          </mesh>
          {/* Center Silver Pin */}
          <mesh position={[0, -5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.8, 0.8, 4.5, 12]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>
        </group>

        {/* 5. ATmega328P DIP-28 Socket & Microcontroller Chip */}
        <group position={[8.0, -4.0, pcbTopZ + 1.8]}>
          {/* Black DIP Socket Base */}
          <mesh castShadow position={[0, 0, -0.6]}>
            <boxGeometry args={[10.2, 35.8, 1.6]} />
            <meshStandardMaterial color="#141414" roughness={0.9} />
          </mesh>

          {/* ATmega328P Plastic IC Package */}
          <mesh castShadow position={[0, 0, 0.7]}>
            <boxGeometry args={[9.4, 34.8, 2.6]} />
            <meshStandardMaterial color="#222222" roughness={0.65} />
          </mesh>

          {/* Notch at Top of IC Package */}
          <mesh position={[0, 16.8, 2.0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.3, 1.3, 2.5, 16, 1, false, 0, Math.PI]} />
            <meshBasicMaterial color="#111" />
          </mesh>

          {/* 28 Dual In-Line Silver Pins */}
          <mesh position={[-5.3, 0, -0.2]} castShadow>
            <boxGeometry args={[0.5, 34.0, 2.2]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>
          <mesh position={[5.3, 0, -0.2]} castShadow>
            <boxGeometry args={[0.5, 34.0, 2.2]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>

          {/* Laser etched text on IC chip */}
          <Text position={[0, 0, 2.05]} rotation={[0, 0, -Math.PI / 2]} fontSize={1.5} color="#cccccc" anchorX="center" anchorY="middle" fontWeight="bold" polygonOffset polygonOffsetFactor={-10} renderOrder={100}>
            ATMEGA328P-PU
          </Text>
        </group>

        {/* 6. Left Edge Female Headers (Power 8-pin & Analog 6-pin) */}
        {/* Power Header Socket (1x8) */}
        <group position={[-24.0, 3.0, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, 20.32, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
          </mesh>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={\`pwr-hole-\${i}\`} position={[0, 8.89 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.4, 1.4, 0.2]} />
              <meshBasicMaterial color="#080808" />
            </mesh>
          ))}
        </group>
        {/* Analog Header Socket (1x6) */}
        <group position={[-24.0, -20.0, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, 15.24, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
          </mesh>
          {Array.from({ length: 6 }).map((_, i) => (
            <mesh key={\`ana-hole-\${i}\`} position={[0, 6.35 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.4, 1.4, 0.2]} />
              <meshBasicMaterial color="#080808" />
            </mesh>
          ))}
        </group>

        {/* 7. Right Edge Female Headers (Digital High 1x10 & Digital Low 1x8) */}
        {/* Digital High Header Socket (1x10) */}
        <group position={[24.0, 16.0, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, 25.4, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
          </mesh>
          {Array.from({ length: 10 }).map((_, i) => (
            <mesh key={\`digh-hole-\${i}\`} position={[0, 11.43 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.4, 1.4, 0.2]} />
              <meshBasicMaterial color="#080808" />
            </mesh>
          ))}
        </group>
        {/* Digital Low Header Socket (1x8) */}
        <group position={[24.0, -12.0, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, 20.32, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
          </mesh>
          {Array.from({ length: 8 }).map((_, i) => (
            <mesh key={\`digl-hole-\${i}\`} position={[0, 8.89 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.4, 1.4, 0.2]} />
              <meshBasicMaterial color="#080808" />
            </mesh>
          ))}
        </group>

        {/* 8. 16 MHz Crystal Oscillator (HC-49 Silver Oval Can) */}
        <group position={[-6.0, 2.0, pcbTopZ + 1.6]}>
          <mesh castShadow>
            <boxGeometry args={[4.5, 11.0, 3.2]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.88} roughness={0.2} />
          </mesh>
        </group>

        {/* 9. ATmega16U2 (QFN-32 USB-to-Serial IC Chip near USB) */}
        <group position={[-8.0, 15.0, pcbTopZ + 0.5]} rotation={[0, 0, Math.PI / 4]}>
          <mesh castShadow>
            <boxGeometry args={[5.0, 5.0, 1.0]} />
            <meshStandardMaterial color="#222" roughness={0.6} />
          </mesh>
        </group>

        {/* 10. 5V Voltage Regulator (SOT-223) */}
        <group position={[-12.0, -18.0, pcbTopZ + 0.8]}>
          <mesh castShadow>
            <boxGeometry args={[6.5, 3.5, 1.6]} />
            <meshStandardMaterial color="#222" roughness={0.7} />
          </mesh>
          <mesh position={[0, 2.2, -0.4]}>
            <boxGeometry args={[3.2, 1.2, 0.4]} />
            <meshStandardMaterial color="#cccccc" {...SILVER_METAL} />
          </mesh>
        </group>

        {/* 11. Aluminum Electrolytic Capacitors (2x Silver Cans) */}
        <group position={[-7.0, -14.0, pcbTopZ + 3.25]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3.0, 3.0, 6.5, 16]} />
            <meshStandardMaterial color="#d0d0d0" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 3.3]}>
            <cylinderGeometry args={[2.9, 2.9, 0.1, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
        <group position={[-7.0, -23.0, pcbTopZ + 3.25]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3.0, 3.0, 6.5, 16]} />
            <meshStandardMaterial color="#d0d0d0" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 3.3]}>
            <cylinderGeometry args={[2.9, 2.9, 0.1, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>

        {/* 12. Reset Button (Top Left) */}
        <group position={[-16.0, 24.0, pcbTopZ + 1.2]}>
          <mesh castShadow>
            <boxGeometry args={[4.5, 4.5, 2.4]} />
            <meshStandardMaterial color="#1e1e1e" />
          </mesh>
          <mesh position={[0, 0, 1.4]}>
            <cylinderGeometry args={[1.2, 1.2, 0.6, 16]} />
            <meshStandardMaterial color="#c62828" roughness={0.5} />
          </mesh>
        </group>

        {/* 13. Main ICSP Header (2x3 Gold Pins near bottom right) */}
        <group position={[22.0, -28.0, pcbTopZ + 1.25]}>
          <mesh castShadow>
            <boxGeometry args={[5.0, 7.6, 2.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {[-1.27, 1.27].map((x, ix) =>
            [-2.54, 0, 2.54].map((y, iy) => (
              <mesh key={\`icsp1-\${ix}-\${iy}\`} position={[x, y, 1.5]} castShadow>
                <boxGeometry args={[0.64, 0.64, 3.5]} />
                <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
              </mesh>
            ))
          )}
        </group>

        {/* 14. USB-Serial ICSP Header (2x3 Gold Pins near USB) */}
        <group position={[8.0, 28.0, pcbTopZ + 1.25]}>
          <mesh castShadow>
            <boxGeometry args={[5.0, 7.6, 2.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {[-1.27, 1.27].map((x, ix) =>
            [-2.54, 0, 2.54].map((y, iy) => (
              <mesh key={\`icsp2-\${ix}-\${iy}\`} position={[x, y, 1.5]} castShadow>
                <boxGeometry args={[0.64, 0.64, 3.5]} />
                <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
              </mesh>
            ))
          )}
        </group>

        {/* 15. Status SMD LEDs (ON, L, TX, RX) */}
        {[
          { x: -3.0, y: 18.0, label: "ON", color: "#00ff00" },
          { x: -3.0, y: 15.0, label: "L",  color: "#ffaa00" },
          { x: -3.0, y: 12.0, label: "TX", color: "#ffaa00" },
          { x: -3.0, y: 9.0,  label: "RX", color: "#ffaa00" }
        ].map((led, i) => (
          <group key={\`led-\${i}\`} position={[led.x, led.y, pcbTopZ + 0.3]}>
            <mesh>
              <boxGeometry args={[1.2, 1.6, 0.6]} />
              <meshStandardMaterial color={led.color} emissive={led.color} emissiveIntensity={0.5} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Pins and Solder Joints */}
      {holes.map((hole, idx) => {
        const pinDia = 0.64;
        const zBottom = -bt - 0.8;
        const pinLen = pcbMidZ - zBottom;
        const pinMidZ = (pcbMidZ + zBottom) / 2;
        return (
          <group key={idx}>
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.7, 0.7, 0.05, 12]} />
              <SolderMaterial />
            </mesh>
            <mesh position={[hole.relativeX, hole.relativeY, pinMidZ]} castShadow>
              <boxGeometry args={[pinDia, pinDia, pinLen]} />
              <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
            </mesh>
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

realModels = realModels.replace(oldUnoRegex, newUno3D);

fs.writeFileSync('src/components/editor/ThreeDRealModels.tsx', realModels);
console.log('Successfully updated ArduinoUno3D and text rendering in ThreeDRealModels.tsx');
