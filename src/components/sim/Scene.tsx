import { Suspense, useEffect, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Lightformer, OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { TerrainMesh } from "./TerrainMesh";
import { WaterFlow } from "./WaterFlow";
import { DamMarker, type Marker } from "./DamMarker";
import { TERRAIN_SIZE, type Vec3 } from "@/lib/terrain";

export interface ViewCommand {
  type: "reset" | "top" | "zoom-in" | "zoom-out" | "focus";
  n: number;
}

interface Props {
  network: Vec3[][];
  progress: number;
  running: boolean;
  speed: number;
  dam: Marker | null;
  selected: Marker | null;
  layers: {
    wireframe: boolean;
    contours: boolean;
    flowLines: boolean;
    particles: boolean;
    reservoir: boolean;
  };
  command: ViewCommand;
  onPick: (p: Marker) => void;
  onUseAsDam: () => void;
  onClosePopup: () => void;
}

function Reservoir({ dam, progress }: { dam: Marker; progress: number }) {
  const drained = 1 - Math.min(1, progress * 1.1);
  const r = 9 * (0.35 + drained * 0.65);
  return (
    <mesh position={[dam.x - 4, dam.y + 1.1 * drained, dam.z - 3]} rotation-x={-Math.PI / 2}>
      <circleGeometry args={[r, 48]} />
      <meshStandardMaterial
        color="#0e7f9c"
        emissive="#0b5f77"
        emissiveIntensity={0.6}
        transparent
        opacity={0.72}
        roughness={0.15}
        metalness={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function CameraRig({ command, target }: { command: ViewCommand; target: Marker | null }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera } = useThree();

  useEffect(() => {
    const c = controls.current;
    if (!c || command.n === 0) return;
    switch (command.type) {
      case "reset":
        camera.position.set(70, 58, 82);
        c.target.set(0, 6, 0);
        break;
      case "top":
        camera.position.set(0.01, 135, 0.01);
        c.target.set(0, 0, 0);
        break;
      case "zoom-in":
        camera.position.multiplyScalar(0.82);
        break;
      case "zoom-out":
        camera.position.multiplyScalar(1.22);
        break;
      case "focus":
        if (target) {
          camera.position.set(target.x + 34, target.y + 30, target.z + 38);
          c.target.set(target.x, target.y, target.z);
        }
        break;
    }
    c.update();
  }, [command, camera, target]);

  return (
    <OrbitControls
      ref={controls}
      enableDamping
      dampingFactor={0.08}
      minDistance={22}
      maxDistance={210}
      maxPolarAngle={Math.PI / 2.12}
      makeDefault
    />
  );
}

export function Scene(props: Props) {
  const { network, progress, running, speed, dam, selected, layers, command } = props;

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [70, 58, 82], fov: 46, far: 900 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#070d14"]} />
      <fog attach="fog" args={["#070d14", 150, 330]} />
      <hemisphereLight args={["#8fb6d6", "#0b1520", 0.6]} />
      <directionalLight
        position={[60, 90, 40]}
        intensity={2.1}
        color="#ffe6c4"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight position={[-70, 40, -60]} intensity={0.5} color="#5fd4ff" />
      <Suspense fallback={null}>
        <Environment resolution={64}>
          <Lightformer intensity={1.6} position={[0, 12, 0]} scale={[16, 16, 1]} />
          <Lightformer
            intensity={0.8}
            color="#7fd8ff"
            position={[-10, 4, -8]}
            rotation-y={Math.PI / 2}
            scale={[24, 3, 1]}
          />
        </Environment>
        <TerrainMesh
          wireframe={layers.wireframe}
          contours={layers.contours}
          onPick={props.onPick}
        />
        {dam && layers.reservoir && <Reservoir dam={dam} progress={progress} />}
        <WaterFlow
          network={network}
          progress={progress}
          showLines={layers.flowLines}
          showParticles={layers.particles}
          running={running}
          speed={speed}
        />
        {dam && (
          <DamMarker
            point={dam}
            isDam
            showPopup={!!selected && selected === dam}
            onUseAsDam={props.onUseAsDam}
            onClose={props.onClosePopup}
          />
        )}
        {selected && selected !== dam && (
          <DamMarker
            point={selected}
            isDam={false}
            showPopup
            onUseAsDam={props.onUseAsDam}
            onClose={props.onClosePopup}
          />
        )}
      </Suspense>
      <gridHelper
        args={[TERRAIN_SIZE * 2, 40, "#123244", "#0d2231"]}
        position={[0, -0.5, 0]}
      />
      <CameraRig command={command} target={dam ?? selected} />
    </Canvas>
  );
}
