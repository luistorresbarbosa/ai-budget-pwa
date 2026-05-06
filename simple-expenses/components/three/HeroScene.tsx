"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Float, Environment, MeshDistortMaterial } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Account } from "@/lib/types";

interface Props {
  accounts: Account[];
  monthSpend: number;
  allTimeSpend: number;
}

export function HeroScene({ accounts, monthSpend, allTimeSpend }: Props) {
  const intensity = Math.min(1, monthSpend / Math.max(1, allTimeSpend || 1));

  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [0, 0, 7], fov: 45 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ width: "100%", height: "100%" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.55} />
        <directionalLight position={[5, 6, 5]} intensity={0.9} />
        <pointLight position={[-5, -3, -2]} intensity={0.4} color="#a855f7" />
        <Environment preset="city" />
        <CenterOrb intensity={intensity} />
        <AccountOrbs accounts={accounts} />
      </Suspense>
    </Canvas>
  );
}

function CenterOrb({ intensity }: { intensity: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame((state) => {
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.25;
    ref.current.rotation.x = Math.sin(t * 0.3) * 0.2;
  });
  return (
    <Float speed={1.2} rotationIntensity={0.4} floatIntensity={0.8}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[1.1, 4]} />
        <MeshDistortMaterial
          color="#0f172a"
          attach="material"
          distort={0.35 + intensity * 0.25}
          speed={1.6}
          roughness={0.25}
          metalness={0.6}
        />
      </mesh>
    </Float>
  );
}

function AccountOrbs({ accounts }: { accounts: Account[] }) {
  const data = useMemo(() => {
    const slice = accounts.slice(0, 8);
    return slice.map((a, i) => {
      const angle = (i / Math.max(1, slice.length)) * Math.PI * 2;
      const radius = 2.6;
      return {
        id: a.id,
        color: a.color,
        position: [
          Math.cos(angle) * radius,
          Math.sin(angle * 1.3) * 0.6,
          Math.sin(angle) * radius,
        ] as [number, number, number],
        speed: 0.4 + (i % 3) * 0.15,
        scale: 0.35 + ((i * 13) % 5) * 0.04,
        shape: i % 3,
      };
    });
  }, [accounts]);

  return (
    <group>
      {data.map((d) => (
        <OrbitingShape key={d.id} {...d} />
      ))}
    </group>
  );
}

function OrbitingShape({
  position,
  color,
  speed,
  scale,
  shape,
}: {
  position: [number, number, number];
  color: string;
  speed: number;
  scale: number;
  shape: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  const start = useMemo(
    () => Math.atan2(position[2], position[0]),
    [position],
  );
  useFrame((state) => {
    const t = state.clock.elapsedTime * speed + start;
    const radius = Math.hypot(position[0], position[2]);
    ref.current.position.x = Math.cos(t) * radius;
    ref.current.position.z = Math.sin(t) * radius;
    ref.current.position.y =
      position[1] + Math.sin(state.clock.elapsedTime * 1.2 + start) * 0.25;
    ref.current.rotation.x += 0.01;
    ref.current.rotation.y += 0.012;
  });
  return (
    <Float speed={1.4} rotationIntensity={0.6} floatIntensity={0.4}>
      <mesh ref={ref} scale={scale}>
        {shape === 0 && <icosahedronGeometry args={[1, 0]} />}
        {shape === 1 && <torusGeometry args={[0.7, 0.28, 16, 48]} />}
        {shape === 2 && <octahedronGeometry args={[1, 0]} />}
        <meshStandardMaterial
          color={color}
          metalness={0.55}
          roughness={0.25}
          emissive={color}
          emissiveIntensity={0.15}
        />
      </mesh>
    </Float>
  );
}
