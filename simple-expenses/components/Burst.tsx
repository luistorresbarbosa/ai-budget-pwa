"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

const SHAPES = ["€", "💸", "✨", "★", "•"];

interface Particle {
  id: number;
  x: number;
  y: number;
  rot: number;
  rotEnd: number;
  scale: number;
  symbol: string;
  color: string;
}

const PALETTE = ["#0ea5e9", "#22c55e", "#f97316", "#a855f7", "#ec4899"];

function makeParticles(count = 22): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const radius = 80 + Math.random() * 140;
    return {
      id: i,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius - 60,
      rot: Math.random() * 360,
      rotEnd: Math.random() * 720 - 360,
      scale: 0.6 + Math.random() * 0.9,
      symbol: SHAPES[i % SHAPES.length],
      color: PALETTE[i % PALETTE.length],
    };
  });
}

export function Burst({ trigger }: { trigger: number }) {
  const [particles, setParticles] = useState<Particle[]>([]);

  useEffect(() => {
    if (trigger === 0) return;
    setParticles(makeParticles());
    const t = setTimeout(() => setParticles([]), 1200);
    return () => clearTimeout(t);
  }, [trigger]);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
      style={{ perspective: 800 }}
    >
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={`${trigger}-${p.id}`}
            initial={{
              x: 0,
              y: 0,
              rotateX: 0,
              rotateY: 0,
              rotateZ: p.rot,
              scale: 0.2,
              opacity: 0,
            }}
            animate={{
              x: p.x,
              y: p.y,
              rotateX: p.rotEnd,
              rotateY: p.rotEnd * 0.6,
              rotateZ: p.rot + p.rotEnd,
              scale: p.scale,
              opacity: [0, 1, 1, 0],
            }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.0, ease: [0.2, 0.8, 0.4, 1] }}
            className="absolute text-2xl font-bold select-none"
            style={{
              color: p.color,
              textShadow: "0 2px 8px rgba(0,0,0,0.15)",
              transformStyle: "preserve-3d",
            }}
          >
            {p.symbol}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
