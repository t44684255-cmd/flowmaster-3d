import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Line } from "@react-three/drei";
import type { Vec3 } from "@/lib/terrain";

interface Props {
  network: Vec3[][];
  progress: number; // 0..1
  showLines: boolean;
  showParticles: boolean;
  running: boolean;
  speed: number;
}

const PARTICLES = 900;

export function WaterFlow({
  network,
  progress,
  showLines,
  showParticles,
  running,
  speed,
}: Props) {
  const curves = useMemo(
    () =>
      network.map(
        (line) =>
          new THREE.CatmullRomCurve3(
            line.map(([x, y, z]) => new THREE.Vector3(x, y + 0.28, z)),
          ),
      ),
    [network],
  );

  const inst = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: PARTICLES }, (_, i) => ({
        line: i % Math.max(curves.length, 1),
        phase: Math.random(),
        jitter: (Math.random() - 0.5) * 0.9,
        size: 0.22 + Math.random() * 0.3,
      })),
    [curves.length],
  );
  const clock = useRef(0);

  useFrame((_, delta) => {
    if (running) clock.current += Math.min(delta, 0.05) * speed;
    const mesh = inst.current;
    if (!mesh || curves.length === 0) return;
    for (let i = 0; i < PARTICLES; i++) {
      const s = seeds[i]!;
      const curve = curves[s.line];
      if (!curve) continue;
      let t = (s.phase + clock.current * 0.075) % 1;
      const head = Math.min(1, progress * 1.35);
      if (t > head) t = head * ((t / (head || 1)) % 1);
      const p = curve.getPointAt(Math.max(0.001, Math.min(0.999, t)));
      dummy.position.set(p.x + s.jitter * 0.4, p.y + 0.12, p.z + s.jitter * 0.4);
      const fade = progress > 0 ? 1 : 0;
      const sc = s.size * fade * (0.6 + Math.sin((t + s.phase) * 22) * 0.15 + 0.4);
      dummy.scale.setScalar(Math.max(0.0001, sc));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {showLines &&
        network.map((line, i) => {
          const n = Math.max(2, Math.floor(line.length * Math.min(1, progress * 1.35)));
          if (progress <= 0.001) return null;
          const pts = line.slice(0, n).map(([x, y, z]) => [x, y + 0.22, z] as Vec3);
          if (pts.length < 2) return null;
          return (
            <Line
              key={i}
              points={pts}
              color={i % 4 === 0 ? "#7ff3ff" : "#22b7d8"}
              lineWidth={i % 4 === 0 ? 2.2 : 1.2}
              transparent
              opacity={0.75}
            />
          );
        })}
      <instancedMesh
        ref={inst}
        args={[undefined, undefined, PARTICLES]}
        visible={showParticles && progress > 0.001}
        frustumCulled={false}
      >
        <sphereGeometry args={[1, 6, 6]} />
        <meshStandardMaterial
          color="#63e8ff"
          emissive="#1fb6dd"
          emissiveIntensity={1.6}
          roughness={0.25}
          transparent
          opacity={0.85}
        />
      </instancedMesh>
    </group>
  );
}
