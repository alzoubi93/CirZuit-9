const fs = require('fs');

// 1. Update ThreeDPreview.tsx for user text labels
let previewContent = fs.readFileSync('src/components/editor/ThreeDPreview.tsx', 'utf8');

previewContent = previewContent.replace(
  /const zPos = isBottom \? -boardThickness \/ 2 - 0\.02 : boardThickness \/ 2 \+ 0\.02;/g,
  'const zPos = isBottom ? -boardThickness / 2 - 0.08 : boardThickness / 2 + 0.08;'
);

previewContent = previewContent.replace(
  /<Text\s+key={`user-text-\${t\.id \|\| i}`}\s+position=\{\[t\.x, boardHeight - t\.y, zPos\]\}\s+rotation=\{\[rotX, 0, rotZ\]\}\s+fontSize=\{t\.size \|\| 1\.5\}\s+color="#ffffff"\s+anchorX="center"\s+anchorY="middle"\s+fontFamily="monospace"\s+fontWeight="bold"\s*>/g,
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
console.log('Updated ThreeDPreview.tsx');

// 2. Update ThreeDRealModels.tsx for SilkScreenLayer and all Text components
let realModelsContent = fs.readFileSync('src/components/editor/ThreeDRealModels.tsx', 'utf8');

// Update SilkScreenLayer
const oldSilkScreen = `export const SilkScreenLayer = ({ fp, boardThickness, boardHeight = 80 }: any) => {
  const meas = extractComponentMeasurements(fp, boardHeight);
  const w = meas.length || 5;
  const h = meas.width || 5;
  const lineThickness = 0.15;
  const color = "#f5f5f5";
  return (
    <group position={[meas.x, meas.y, boardThickness / 2 + 0.01]}>
      {/* Component Outline Frame */}
      <group rotation={[0, 0, meas.rotationRad]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w + lineThickness, lineThickness, 0.01]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0, -h / 2, 0]}>
          <boxGeometry args={[w + lineThickness, lineThickness, 0.01]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[-w / 2, 0, 0]}>
          <boxGeometry args={[lineThickness, h + lineThickness, 0.01]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[w / 2, 0, 0]}>
          <boxGeometry args={[lineThickness, h + lineThickness, 0.01]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
      {/* Component Text Reference */}
      <Text position={[0, 0, 0.02]}
        fontSize={Math.max(1.2, Math.min(fp.w || fp.width || 5, fp.h || fp.height || 5) * 0.23)}
        color="#ffffff" anchorX="center" anchorY="middle"
        outlineWidth={0.02} outlineColor="#000000">
        {fp.reference || ""}
      </Text>
    </group>
  );
};`;

const newSilkScreen = `export const SilkScreenLayer = ({ fp, boardThickness, boardHeight = 80 }: any) => {
  const meas = extractComponentMeasurements(fp, boardHeight);
  const w = meas.length || 5;
  const h = meas.width || 5;
  const lineThickness = 0.15;
  const color = "#f5f5f5";
  return (
    <group position={[meas.x, meas.y, boardThickness / 2 + 0.08]}>
      {/* Component Outline Frame */}
      <group rotation={[0, 0, meas.rotationRad]}>
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w + lineThickness, lineThickness, 0.01]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[0, -h / 2, 0]}>
          <boxGeometry args={[w + lineThickness, lineThickness, 0.01]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[-w / 2, 0, 0]}>
          <boxGeometry args={[lineThickness, h + lineThickness, 0.01]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
        <mesh position={[w / 2, 0, 0]}>
          <boxGeometry args={[lineThickness, h + lineThickness, 0.01]} />
          <meshBasicMaterial color={color} polygonOffset polygonOffsetFactor={-5} />
        </mesh>
      </group>
      {/* Component Text Reference */}
      <Text position={[0, 0, 0.05]}
        fontSize={Math.max(1.2, Math.min(fp.w || fp.width || 5, fp.h || fp.height || 5) * 0.23)}
        color="#ffffff" anchorX="center" anchorY="middle"
        outlineWidth={0.02} outlineColor="#000000"
        polygonOffset polygonOffsetFactor={-10} renderOrder={100}>
        {fp.reference || ""}
      </Text>
    </group>
  );
};`;

if (realModelsContent.includes('export const SilkScreenLayer =')) {
  realModelsContent = realModelsContent.replace(oldSilkScreen, newSilkScreen);
  console.log('Replaced SilkScreenLayer');
}

// Ensure polygonOffset polygonOffsetFactor={-10} renderOrder={100} on all <Text> tags that don't have it
realModelsContent = realModelsContent.replace(/<Text\s+(?![^>]*polygonOffset)/g, '<Text polygonOffset polygonOffsetFactor={-10} renderOrder={100} ');

// 3. Replace ArduinoUno3D with clean, accurate model
const unoRegex = /export const ArduinoUno3D = \(\{[\s\S]*?\n\};/;

const newUno = `export const ArduinoUno3D = ({ position, rotation, size, fp, onSelect, onHover, isSelected, isHovered }: any) => {
  const holes = useMemo(() => {
    return getComponentHoles(fp, size, "header");
  }, [fp, size]);

  const bt = fp?.boardThickness || 1.6;
  const boardW = size.h || 53.34; // Width along X in vertical view
  const boardH = size.w || 68.6;  // Height along Y in vertical view
  const boardD = 1.6;

  const zPCB = 1.2; // clearance stance
  const pcbMidZ = zPCB + boardD / 2; // 2.0
  const pcbTopZ = zPCB + boardD;     // 2.8
  const boardColor = "#008184";     // Italian Arduino Teal

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
        {/* 1. Arduino Uno motherboard PCB */}
        <RoundedBox args={[boardW, boardH, boardD]} radius={0.5} smoothness={4} position={[0, 0, pcbMidZ]} castShadow>
          <meshPhysicalMaterial color={boardColor} roughness={0.65} clearcoat={0.3} />
        </RoundedBox>

        {/* Silkscreen text on PCB surface */}
        <Text position={[0, boardH * 0.25, pcbTopZ + 0.08]} fontSize={3.2} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold" polygonOffset polygonOffsetFactor={-10} renderOrder={100}>
          ARDUINO
        </Text>
        <Text position={[0, boardH * 0.18, pcbTopZ + 0.08]} fontSize={2.4} color="#ffffff" anchorX="center" anchorY="middle" fontWeight="bold" polygonOffset polygonOffsetFactor={-10} renderOrder={100}>
          UNO R3
        </Text>

        {/* 2. Standoff Screws / Mounting Holes in 4 Corners */}
        {[-boardW * 0.42, boardW * 0.42].map((x, ix) =>
          [-boardH * 0.44, boardH * 0.44].map((y, iy) => (
            <group key={\`screw-\${ix}-\${iy}\`} position={[x, y, 0.6]}>
              <mesh>
                <cylinderGeometry args={[1.5, 1.5, 1.2, 12]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
              <mesh position={[0, 0, 1.1]}>
                <cylinderGeometry args={[2.5, 2.5, 0.4, 12]} />
                <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
              </mesh>
            </group>
          ))
        )}

        {/* 3. ATmega328P DIP-28 IC Socket & MCU Chip */}
        <group position={[boardW * 0.12, -boardH * 0.05, pcbTopZ + 2.0]}>
          {/* DIP Socket Base */}
          <mesh castShadow position={[0, 0, -0.6]}>
            <boxGeometry args={[10, 35.5, 1.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.9} />
          </mesh>
          {/* IC Chip Body */}
          <mesh castShadow position={[0, 0, 0.6]}>
            <boxGeometry args={[9.2, 34.5, 2.5]} />
            <meshStandardMaterial color="#222222" roughness={0.7} />
          </mesh>
          {/* U-notch at top of IC */}
          <mesh position={[0, 16.5, 1.85]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[1.2, 1.2, 3, 16, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#111" />
          </mesh>
          {/* Silver DIP Pins */}
          <mesh position={[-5.2, 0, -0.2]} castShadow>
            <boxGeometry args={[0.5, 34, 2.0]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>
          <mesh position={[5.2, 0, -0.2]} castShadow>
            <boxGeometry args={[0.5, 34, 2.0]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>          <Text position={[0, 0, 1.9]} rotation={[0, 0, -Math.PI / 2]} fontSize={1.4} color="#dddddd" anchorX="center" anchorY="middle" fontWeight="bold" polygonOffset polygonOffsetFactor={-10} renderOrder={100}>
            ATMEGA328P-PU
          </Text>
        </group>

        {/* 4. USB Type-B Connector (Top-Left Edge) */}
        <group position={[-boardW * 0.25, boardH / 2 - 8, pcbTopZ + 5.5]}>
          <mesh castShadow>
            <boxGeometry args={[12, 16, 11]} />
            <meshStandardMaterial color="#dcdcdc" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Inner dark receptacle opening */}
          <mesh position={[0, 8.1, 0]}>
            <boxGeometry args={[9.5, 0.2, 8.5]} />
            <meshBasicMaterial color="#111" />
          </mesh>
          {/* White plastic tongue inside */}
          <mesh position={[0, 5, 0]}>
            <boxGeometry args={[8, 6, 2]} />
            <meshStandardMaterial color="#f0f0f0" roughness={0.5} />
          </mesh>
        </group>

        {/* 5. DC Barrel Jack (Bottom-Left Edge) */}
        <group position={[-boardW * 0.3, -boardH / 2 + 8, pcbTopZ + 5.5]}>
          <mesh castShadow>
            <boxGeometry args={[9, 13, 11]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          <mesh position={[0, -6.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[2.5, 2.5, 0.5, 16]} />
            <meshBasicMaterial color="#000" />
          </mesh>
          {/* Center metallic pin */}
          <mesh position={[0, -5, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.8, 0.8, 4, 12]} />
            <meshStandardMaterial color="#dcdcdc" {...SILVER_METAL} />
          </mesh>
        </group>

        {/* 6. ATmega16U2 (Small QFN USB-Serial chip) */}
        <group position={[-boardW * 0.15, boardH * 0.22, pcbTopZ + 0.5]} rotation={[0, 0, Math.PI / 4]}>
          <mesh castShadow>
            <boxGeometry args={[5, 5, 1]} />
            <meshStandardMaterial color="#222" roughness={0.6} />
          </mesh>
        </group>

        {/* 7. 16 MHz Crystal Oscillator (Silver oval HC-49) */}
        <group position={[-boardW * 0.15, boardH * 0.02, pcbTopZ + 1.6]}>
          <mesh castShadow>
            <boxGeometry args={[4.5, 11, 3.2]} />
            <meshStandardMaterial color="#e0e0e0" metalness={0.85} roughness={0.25} />
          </mesh>
        </group>

        {/* 8. 5V Voltage Regulator (SOT-223) */}
        <group position={[-boardW * 0.15, -boardH * 0.3, pcbTopZ + 0.8]}>
          <mesh castShadow>
            <boxGeometry args={[6.5, 3.5, 1.6]} />
            <meshStandardMaterial color="#222" roughness={0.7} />
          </mesh>
          <mesh position={[0, 2.2, -0.4]}>
            <boxGeometry args={[3.2, 1.2, 0.4]} />
            <meshStandardMaterial color="#cccccc" {...SILVER_METAL} />
          </mesh>
        </group>

        {/* 9. Aluminum Electrolytic Capacitors (2x silver cans) */}
        <group position={[-boardW * 0.1, -boardH * 0.12, pcbTopZ + 3.25]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3, 3, 6.5, 16]} />
            <meshStandardMaterial color="#d0d0d0" metalness={0.8} roughness={0.3} />
          </mesh>
          {/* Black top crescent */}
          <mesh position={[0, 0, 3.3]}>
            <cylinderGeometry args={[2.9, 2.9, 0.1, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>
        <group position={[-boardW * 0.1, -boardH * 0.4, pcbTopZ + 3.25]}>
          <mesh castShadow rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[3, 3, 6.5, 16]} />
            <meshStandardMaterial color="#d0d0d0" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0, 3.3]}>
            <cylinderGeometry args={[2.9, 2.9, 0.1, 16]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>
        </group>

        {/* 10. Reset Button */}
        <group position={[-boardW * 0.32, boardH / 2 - 5, pcbTopZ + 1.2]}>
          <mesh castShadow>
            <boxGeometry args={[4.5, 4.5, 2.4]} />
            <meshStandardMaterial color="#1e1e1e" />
          </mesh>
          <mesh position={[0, 0, 1.4]}>
            <cylinderGeometry args={[1.2, 1.2, 0.6, 16]} />
            <meshStandardMaterial color="#c62828" roughness={0.5} />
          </mesh>
        </group>

        {/* 11. ICSP Header (2x3 gold pins) */}
        <group position={[boardW * 0.2, -boardH * 0.4, pcbTopZ + 1.25]}>
          <mesh castShadow>
            <boxGeometry args={[5.0, 7.6, 2.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
          </mesh>
          {[-1.27, 1.27].map((x, ix) =>
            [-2.54, 0, 2.54].map((y, iy) => (
              <mesh key={\`icsp-\${ix}-\${iy}\`} position={[x, y, 1.5]} castShadow>
                <boxGeometry args={[0.64, 0.64, 3.5]} />
                <meshStandardMaterial color="#ffd700" {...GOLD_METAL} />
              </mesh>
            ))
          )}
        </group>

        {/* 12. Female Header Sockets along Right Edge (Digital & Power) */}
        <group position={[boardW * 0.42, boardH * 0.1, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, boardH * 0.72, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
          </mesh>
          {/* Socket holes */}
          {Array.from({ length: 18 }).map((_, i) => (
            <mesh key={\`hdr-r-\${i}\`} position={[0, boardH * 0.32 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.5, 1.5, 0.2]} />
              <meshBasicMaterial color="#111" />
            </mesh>
          ))}
        </group>

        {/* 13. Female Header Sockets along Left Edge (Power & Analog) */}
        <group position={[-boardW * 0.42, -boardH * 0.1, pcbTopZ + 4.25]}>
          <mesh castShadow>
            <boxGeometry args={[2.54, boardH * 0.55, 8.5]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.85} />
          </mesh>
          {Array.from({ length: 14 }).map((_, i) => (
            <mesh key={\`hdr-l-\${i}\`} position={[0, boardH * 0.24 - i * 2.54, 4.3]}>
              <boxGeometry args={[1.5, 1.5, 0.2]} />
              <meshBasicMaterial color="#111" />
            </mesh>
          ))}
        </group>
      </group>

      {/* Pins and Solder Joints */}
      {holes.map((hole, idx) => {
        const pinDia = 0.64;
        const zBottom = -bt - 0.8;
        const pinLen = pcbMidZ - zBottom;
        const pinMidZ = (pcbMidZ + zBottom) / 2;
        return (
          <group key={idx}>
            {/* Solder pad on top */}
            <mesh position={[hole.relativeX, hole.relativeY, pcbTopZ + 0.05]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.7, 0.7, 0.05, 12]} />
              <SolderMaterial />
            </mesh>
            {/* Square pin header down through motherboard */}
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

realModelsContent = realModelsContent.replace(unoRegex, newUno);

fs.writeFileSync('src/components/editor/ThreeDRealModels.tsx', realModelsContent);
console.log('Updated ThreeDRealModels.tsx');

