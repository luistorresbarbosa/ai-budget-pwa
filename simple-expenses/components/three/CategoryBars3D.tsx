"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";

const CATEGORY_COLORS: Record<string, string> = {
  Alimentação: "#22c55e",
  Transportes: "#0ea5e9",
  Casa: "#f97316",
  Saúde: "#ef4444",
  Lazer: "#a855f7",
  Educação: "#14b8a6",
  Compras: "#ec4899",
  Subscrições: "#eab308",
  Outros: "#94a3b8",
};

interface Props {
  data: [string, number][];
}

export function CategoryBars3D({ data }: Props) {
  const max = Math.max(1, ...data.map((d) => d[1]));
  const scaled = data.slice(0, 9).map(([name, value], i) => ({
    name,
    value,
    height: (value / max) * 3.6 + 0.05,
    color: CATEGORY_COLORS[name] ?? "#475569",
    x: (i - Math.min(8, data.length - 1) / 2) * 0.9,
  }));

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 3.5, 6.5], fov: 40 }}
      gl={{ antialias: true, alpha: true }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 8, 4]} intensity={1} castShadow />
        <pointLight position={[-4, 4, -3]} intensity={0.4} color="#0ea5e9" />
        <SceneFloor />
        {scaled.map((b) => (
          <Bar key={b.name} {...b} />
        ))}
        <OrbitControls
          enablePan={false}
          enableZoom={false}
          autoRotate
          autoRotateSpeed={0.6}
          minPolarAngle={Math.PI / 3.5}
          maxPolarAngle={Math.PI / 2.2}
        />
      </Suspense>
    </Canvas>
  );
}

function SceneFloor() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#0f172a" transparent opacity={0.06} />
    </mesh>
  );
}

function Bar({
  name,
  value,
  height,
  color,
  x,
}: {
  name: string;
  value: number;
  height: number;
  color: string;
  x: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const groupRef = useRef<THREE.Group>(null!);
  const target = useRef(height);
  target.current = height;

  useFrame((_, delta) => {
    const m = meshRef.current;
    if (!m) return;
    const cur = m.scale.y;
    const next = cur + (target.current - cur) * Math.min(1, delta * 4);
    m.scale.y = next;
    m.position.y = next / 2;
  });

  return (
    <group ref={groupRef} position={[x, 0, 0]}>
      <mesh ref={meshRef} position={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.55, 1, 0.55]} />
        <meshStandardMaterial
          color={color}
          metalness={0.35}
          roughness={0.35}
          emissive={color}
          emissiveIntensity={0.08}
        />
      </mesh>
      <Text
        position={[0, -0.25, 0.4]}
        rotation={[-Math.PI / 4, 0, 0]}
        fontSize={0.18}
        color="#475569"
        anchorX="center"
        anchorY="top"
        maxWidth={1.2}
      >
        {name}
      </Text>
      <Text
        position={[0, height + 0.25, 0]}
        fontSize={0.22}
        color="#0f172a"
        anchorX="center"
        anchorY="bottom"
      >
        {Math.round(value).toString()}
      </Text>
    </group>
  );
}
