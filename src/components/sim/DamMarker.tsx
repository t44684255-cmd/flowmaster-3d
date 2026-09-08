import { Html } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { Waves, X, MapPin, TriangleAlert } from "lucide-react";
import { elevationMeters, slopeDegrees } from "@/lib/terrain";

export interface Marker {
  x: number;
  y: number;
  z: number;
}

interface Props {
  point: Marker;
  isDam: boolean;
  showPopup: boolean;
  onUseAsDam: () => void;
  onClose: () => void;
}

export function DamMarker({ point, isDam, showPopup, onUseAsDam, onClose }: Props) {
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ring.current) {
      const s = 1 + ((t * 0.7) % 1) * 1.8;
      ring.current.scale.setScalar(s);
      const m = ring.current.material as THREE.MeshBasicMaterial;
      m.opacity = 0.6 * (1 - ((t * 0.7) % 1));
    }
  });

  const color = isDam ? "#ffb648" : "#63e8ff";

  return (
    <group position={[point.x, point.y, point.z]}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.15}>
        <ringGeometry args={[1.5, 2.1, 48]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
      </mesh>
      <mesh position-y={2.4}>
        <cylinderGeometry args={[0.08, 0.08, 4.8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.2} />
      </mesh>
      <mesh position-y={5.1}>
        <octahedronGeometry args={[0.7, 0]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={1.5} />
      </mesh>
      {isDam && (
        <mesh position-y={0.9} rotation-y={0.4}>
          <boxGeometry args={[6.4, 1.9, 1.1]} />
          <meshStandardMaterial color="#9aa6b2" roughness={0.8} />
        </mesh>
      )}
      {showPopup && (
        <Html position={[0, 6.2, 0]} center distanceFactor={42} zIndexRange={[40, 0]}>
          <div className="w-64 rounded-lg border border-border bg-popover/95 p-3 text-popover-foreground shadow-2xl backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <MapPin className="h-4 w-4 text-primary" />
                {isDam ? "Dam site" : "Terrain sample"}
              </div>
              <button
                onClick={onClose}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
              <dt>Easting</dt>
              <dd className="text-right text-foreground">
                {(412300 + point.x * 25).toFixed(0)} m
              </dd>
              <dt>Northing</dt>
              <dd className="text-right text-foreground">
                {(5148700 + point.z * 25).toFixed(0)} m
              </dd>
              <dt>Elevation</dt>
              <dd className="text-right text-foreground">{elevationMeters(point.y)} m</dd>
              <dt>Slope</dt>
              <dd className="text-right text-foreground">
                {slopeDegrees(point.x, point.z).toFixed(1)}°
              </dd>
              <dt>Land cover</dt>
              <dd className="text-right text-foreground">
                {point.y > 20 ? "Bare rock" : point.y > 13 ? "Alpine scrub" : "Valley forest"}
              </dd>
            </dl>
            {isDam ? (
              <p className="mt-2 flex items-center gap-1.5 rounded bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-300">
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                Active breach source for this scenario.
              </p>
            ) : (
              <button
                onClick={onUseAsDam}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Waves className="h-3.5 w-3.5" />
                Use as dam location
              </button>
            )}
          </div>
        </Html>
      )}
    </group>
  );
}
