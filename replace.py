import sys

with open("src/components/editor/ThreeDRealModels.tsx", "r") as f:
    content = f.read()

dip_target = """        <RoundedBox args={[size.w, size.h, size.d]} radius={0.18} smoothness={4} castShadow>
          <meshPhysicalMaterial color="#0a0a0a" roughness={0.85} clearcoat={0.4} />
        </RoundedBox>
        {/* Notch at the top */}
        <mesh position={[-size.w / 2, 0, size.d / 2]} rotation={[0, Math.PI / 2, 0]}>
          <cylinderGeometry args={[size.h * 0.15, size.h * 0.15, 0.5, 16]} />
          <meshStandardMaterial color="#0a0a0a" />
        </mesh>
        {/* Pin 1 Dot */}
        <mesh position={[-size.w / 2 + 0.8, -size.h / 2 + 0.8, size.d / 2 + 0.005]}>
          <cylinderGeometry args={[0.3, 0.3, 0.02, 20]} />
          <meshStandardMaterial color="#e6e6e6" />
        </mesh>
        <Text position={[0, 0, size.d / 2 + 0.02]} fontSize={size.h * 0.18}
          color="#e0e0e0" anchorX="center" anchorY="middle">{fp.reference || "IC"}</Text>"""

dip_replacement = """        <RoundedBox args={[size.w, size.h, size.d]} radius={0.2} smoothness={4} castShadow>
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

soic_target = """      <RoundedBox args={[size.w, size.h, size.d]} radius={0.08} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#151515" roughness={0.75} clearcoat={0.5} />
      </RoundedBox>
      {/* Pin 1 Dot */}
      <mesh position={[-size.w / 2 + 0.5, -size.h / 2 + 0.5, size.d / 2 + 0.005]}>
        <cylinderGeometry args={[0.2, 0.2, 0.02, 16]} />
        <meshStandardMaterial color="#c0c0c0" />
      </mesh>
      {/* White line indicator */}
      <mesh position={[-size.w / 2 + 0.2, 0, size.d / 2 + 0.005]}>
        <boxGeometry args={[0.1, size.h * 0.8, 0.01]} />
        <meshStandardMaterial color="#e6e6e6" />
      </mesh>"""

soic_replacement = """      <RoundedBox args={[size.w, size.h, size.d]} radius={0.1} smoothness={4} castShadow>
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

qfp_target = """      <RoundedBox args={[size.w, size.h, size.d]} radius={0.1} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#111" roughness={0.85} />
      </RoundedBox>
      {/* Pin 1 Dot */}
      <mesh position={[-size.w / 2 + 0.6, -size.h / 2 + 0.6, size.d / 2 + 0.005]}>
        <cylinderGeometry args={[0.3, 0.3, 0.02, 16]} />
        <meshStandardMaterial color="#e6e6e6" />
      </mesh>"""

qfp_replacement = """      <RoundedBox args={[size.w, size.h, size.d]} radius={0.1} smoothness={4} castShadow>
        <meshPhysicalMaterial color="#1a1a1a" roughness={0.7} clearcoat={0.3} />
      </RoundedBox>
      {/* Pin 1 Dot */}
      <mesh position={[-size.w / 2 + 0.6, -size.h / 2 + 0.6, size.d / 2 + 0.005]}>
        <cylinderGeometry args={[0.3, 0.3, 0.02, 16]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.9} />
      </mesh>"""

fuse_target = """  // Glass Fuse
  const bodyZ = size.d / 2 + 1.5;"""

fuse_replacement = """  // Glass Fuse
  const bodyZ = (size.d || 2.5) / 2 + 0.8;"""

if dip_target not in content: print("DIP not found")
if soic_target not in content: print("SOIC not found")
if qfp_target not in content: print("QFP not found")
if fuse_target not in content: print("Fuse not found")

content = content.replace(dip_target, dip_replacement)
content = content.replace(soic_target, soic_replacement)
content = content.replace(qfp_target, qfp_replacement)
content = content.replace(fuse_target, fuse_replacement)

with open("src/components/editor/ThreeDRealModels.tsx", "w") as f:
    f.write(content)
