import sys

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

# Fix Fuse3D
fuse_target = """      {/* Metal Caps */}
      <mesh position={[-size.w * 0.35, 0, bodyZ]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[size.h / 2 * 1.05, size.h / 2 * 1.05, size.w * 0.15, 16]} />
        <meshStandardMaterial color="#c0c0c0" {...SILVER_METAL} />
      </mesh>
      <mesh position={[size.w * 0.35, 0, bodyZ]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[size.h / 2 * 1.05, size.h / 2 * 1.05, size.w * 0.15, 16]} />
        <meshStandardMaterial color="#c0c0c0" {...SILVER_METAL} />
      </mesh>"""

fuse_replacement = """      {/* Metal Caps */}
      <mesh position={[-size.w * 0.42, 0, bodyZ]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[size.h / 2 * 1.02, size.h / 2 * 1.02, size.w * 0.16, 16]} />
        <meshStandardMaterial color="#e0e0e0" {...SILVER_METAL} metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[size.w * 0.42, 0, bodyZ]} rotation={[0, Math.PI / 2, 0]} castShadow>
        <cylinderGeometry args={[size.h / 2 * 1.02, size.h / 2 * 1.02, size.w * 0.16, 16]} />
        <meshStandardMaterial color="#e0e0e0" {...SILVER_METAL} metalness={0.9} roughness={0.2} />
      </mesh>"""

# Fix IC_DIP3D
dip_target = """        <RoundedBox args={[size.w, size.h, size.d]} radius={0.2} smoothness={4} castShadow>
          <meshPhysicalMaterial color="#1a1a1a" roughness={0.8} clearcoat={0.2} />
        </RoundedBox>
        {/* Notch at the top */}
        <mesh position={[-size.w / 2, 0, size.d / 2 + 0.005]}>
          <cylinderGeometry args={[size.h * 0.15, size.h * 0.15, 0.02, 16]} />
          <meshStandardMaterial color="#000000" roughness={1} />
        </mesh>
        {/* Pin 1 Dot */}
        <mesh position={[-size.w / 2 + 0.8, -size.h / 2 + 0.8, size.d / 2 + 0.005]}>
          <cylinderGeometry args={[0.25, 0.25, 0.02, 16]} />
          <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
        </mesh>
        <Text position={[0, 0, size.d / 2 + 0.015]} fontSize={size.h * 0.18}
          color="#999999" anchorX="center" anchorY="middle">{fp.reference || "IC"}</Text>"""

dip_replacement = """        <RoundedBox args={[size.w, size.h, size.d]} radius={0.15} smoothness={4} castShadow>
          <meshPhysicalMaterial color="#111111" roughness={0.95} clearcoat={0.1} />
        </RoundedBox>
        {/* Notch at the top (half cylinder indented) */}
        <mesh position={[-size.w / 2 + 0.1, 0, size.d / 2 + 0.005]}>
          <cylinderGeometry args={[size.h * 0.12, size.h * 0.12, 0.03, 16]} />
          <meshStandardMaterial color="#080808" roughness={1} />
        </mesh>
        {/* Pin 1 Dot (slight indent) */}
        <mesh position={[-size.w / 2 + 0.8, -size.h / 2 + 0.8, size.d / 2 + 0.005]}>
          <cylinderGeometry args={[0.2, 0.2, 0.03, 16]} />
          <meshStandardMaterial color="#0a0a0a" roughness={1} />
        </mesh>
        {/* Laser etched text */}
        <Text position={[0, 0, size.d / 2 + 0.01]} fontSize={size.h * 0.22}
          color="#a0a0a0" opacity={0.8} anchorX="center" anchorY="middle">{fp.reference || "IC"}</Text>"""

# Fix IC_SOIC3D
soic_target = """      <RoundedBox args={[size.w, size.h, size.d]} radius={0.1} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#1a1a1a" roughness={0.7} clearcoat={0.3} />
      </RoundedBox>
      {/* Pin 1 Dot */}
      <mesh position={[-size.w / 2 + 0.5, -size.h / 2 + 0.5, size.d / 2 + 0.005]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>
      {/* White line indicator */}
      <mesh position={[-size.w / 2 + 0.2, 0, size.d / 2 + 0.005]}>
        <boxGeometry args={[0.1, size.h * 0.8, 0.01]} />
        <meshStandardMaterial color="#888888" />
      </mesh>"""

soic_replacement = """      <RoundedBox args={[size.w, size.h, size.d]} radius={0.1} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#111111" roughness={0.9} clearcoat={0.15} />
      </RoundedBox>
      {/* Pin 1 Dot */}
      <mesh position={[-size.w / 2 + 0.5, -size.h / 2 + 0.5, size.d / 2 + 0.005]}>
        <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
        <meshStandardMaterial color="#080808" roughness={1} />
      </mesh>
      {/* White line indicator */}
      <mesh position={[-size.w / 2 + 0.3, 0, size.d / 2 + 0.005]}>
        <boxGeometry args={[0.15, size.h * 0.7, 0.01]} />
        <meshStandardMaterial color="#b0b0b0" />
      </mesh>
      {/* Laser etched text */}
      <Text position={[0, 0, size.d / 2 + 0.01]} fontSize={size.h * 0.25}
        color="#a0a0a0" opacity={0.7} anchorX="center" anchorY="middle" rotation={[0, 0, -Math.PI/2]}>
        {fp.reference || "U1"}
      </Text>"""

# Fix IC_QFP3D
qfp_target = """      <RoundedBox args={[size.w, size.h, size.d]} radius={0.1} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#1a1a1a" roughness={0.7} clearcoat={0.3} />
      </RoundedBox>
      {/* Pin 1 Dot */}
      <mesh position={[-size.w / 2 + 0.6, -size.h / 2 + 0.6, size.d / 2 + 0.005]}>
        <cylinderGeometry args={[0.3, 0.3, 0.02, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>"""

qfp_replacement = """      <RoundedBox args={[size.w, size.h, size.d]} radius={0.15} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#151515" roughness={0.85} clearcoat={0.1} />
      </RoundedBox>
      {/* Pin 1 Dot Indent */}
      <mesh position={[-size.w / 2 + 0.8, -size.h / 2 + 0.8, size.d / 2 + 0.005]}>
        <cylinderGeometry args={[0.25, 0.25, 0.03, 16]} />
        <meshStandardMaterial color="#080808" roughness={1} />
      </mesh>
      <Text position={[0, 0, size.d / 2 + 0.01]} fontSize={Math.min(size.h, size.w) * 0.2}
        color="#a0a0a0" opacity={0.8} anchorX="center" anchorY="middle">
        {fp.reference || "U1"}
      </Text>"""

if fuse_target not in content: print("Fuse target not found")
if dip_target not in content: print("DIP target not found")
if soic_target not in content: print("SOIC target not found")
if qfp_target not in content: print("QFP target not found")

content = content.replace(fuse_target, fuse_replacement)
content = content.replace(dip_target, dip_replacement)
content = content.replace(soic_target, soic_replacement)
content = content.replace(qfp_target, qfp_replacement)

with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
    f.write(content)
