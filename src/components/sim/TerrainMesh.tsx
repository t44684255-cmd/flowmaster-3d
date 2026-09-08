import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { TERRAIN_SEGMENTS, TERRAIN_SIZE, heightAt } from "@/lib/terrain";

const LOW = new THREE.Color("#16303a");
const MID = new THREE.Color("#2f4b45");
const HIGH = new THREE.Color("#5b5a4c");
const ROCK = new THREE.Color("#7c7565");
const SNOW = new THREE.Color("#d7e6ea");

function ramp(t: number, contours: boolean) {
  const c = new THREE.Color();
  if (t < 0.28) c.copy(LOW).lerp(MID, t / 0.28);
  else if (t < 0.55) c.copy(MID).lerp(HIGH, (t - 0.28) / 0.27);
  else if (t < 0.78) c.copy(HIGH).lerp(ROCK, (t - 0.55) / 0.23);
  else c.copy(ROCK).lerp(SNOW, (t - 0.78) / 0.22);
  if (contours) {
    const band = Math.abs(Math.sin(t * Math.PI * 26));
    if (band > 0.86) c.lerp(new THREE.Color("#63e8ff"), 0.45);
  }
  return c;
}

interface Props {
  wireframe: boolean;
  contours: boolean;
  onPick: (p: { x: number; y: number; z: number }) => void;
}

export function TerrainMesh({ wireframe, contours, onPick }: Props) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      TERRAIN_SIZE,
      TERRAIN_SIZE,
      TERRAIN_SEGMENTS,
      TERRAIN_SEGMENTS,
    );
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < pos.count; i++) {
      const y = heightAt(pos.getX(i), pos.getZ(i));
      pos.setY(i, y);
      if (y < min) min = y;
      if (y > max) max = y;
    }
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const t = (pos.getY(i) - min) / (max - min || 1);
      const c = ramp(t, contours);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    return geo;
  }, [contours]);

  return (
    <mesh
      geometry={geometry}
      receiveShadow
      castShadow
      onPointerDown={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onPick({ x: e.point.x, y: e.point.y, z: e.point.z });
      }}
    >
      <meshStandardMaterial
        vertexColors
        roughness={0.94}
        metalness={0.04}
        wireframe={wireframe}
        flatShading={false}
      />
    </mesh>
  );
}
