// Procedural mountainous terrain + mock hydrology helpers.
// All values are demo/simulated — no real DEM data is used.

export const TERRAIN_SIZE = 120; // world units (1 unit ~= 25 m)
export const TERRAIN_SEGMENTS = 180;
export const METERS_PER_UNIT = 25;

/** Height (world units) at a planar coordinate. Deterministic, smooth, mountainous. */
export function heightAt(x: number, z: number): number {
  let v = 0;
  v += 9.0 * Math.sin(x * 0.055) * Math.cos(z * 0.05);
  v += 4.6 * Math.sin(x * 0.118 + 1.7) * Math.cos(z * 0.104 - 0.4);
  v += 2.1 * Math.sin(x * 0.27 - 0.8) * Math.cos(z * 0.3 + 1.1);
  v += 0.9 * Math.sin(x * 0.61 + 2.3) * Math.cos(z * 0.57);
  v += 0.35 * Math.sin(x * 1.23) * Math.cos(z * 1.09 + 0.6);
  // Main ridge line across the north of the valley
  v += 10 * Math.exp(-Math.pow(z + 34, 2) / 700);
  // Valley channel carving toward the south-east
  v -= 6.5 * Math.exp(-Math.pow(x * 0.45 - z * 0.22 + 4, 2) / 260);
  return v + 13;
}

/** Elevation in metres above sea level for the info panels. */
export function elevationMeters(y: number): number {
  return Math.round(640 + y * 48);
}

export function gradientAt(x: number, z: number, eps = 0.6) {
  const dx = (heightAt(x + eps, z) - heightAt(x - eps, z)) / (2 * eps);
  const dz = (heightAt(x, z + eps) - heightAt(x, z - eps)) / (2 * eps);
  return { dx, dz };
}

export function slopeDegrees(x: number, z: number): number {
  const { dx, dz } = gradientAt(x, z);
  return Math.atan(Math.hypot(dx, dz)) * (180 / Math.PI);
}

export type Vec3 = [number, number, number];

/** Steepest-descent streamline from a start point, used for water routing. */
export function streamline(
  startX: number,
  startZ: number,
  steps = 420,
  stepSize = 1.15,
): Vec3[] {
  const pts: Vec3[] = [];
  let x = startX;
  let z = startZ;
  let vx = 0;
  let vz = 0;
  const half = TERRAIN_SIZE / 2 - 1;
  for (let i = 0; i < steps; i++) {
    const y = heightAt(x, z);
    pts.push([x, y, z]);
    const { dx, dz } = gradientAt(x, z);
    const len = Math.hypot(dx, dz);
    if (len < 0.0015 && i > 20) break;
    // momentum keeps the stream from stalling in shallow pockets
    vx = vx * 0.78 - (dx / (len + 0.001)) * stepSize;
    vz = vz * 0.78 - (dz / (len + 0.001)) * stepSize;
    x += vx * 0.45;
    z += vz * 0.45;
    if (Math.abs(x) > half || Math.abs(z) > half) break;
  }
  return pts;
}

/** A fan of streamlines seeded around the dam breach. */
export function flowNetwork(
  originX: number,
  originZ: number,
  count = 54,
  spread = 7.5,
): Vec3[][] {
  const lines: Vec3[][] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = spread * (0.25 + ((i * 7919) % 100) / 130);
    const line = streamline(originX + Math.cos(a) * r, originZ + Math.sin(a) * r);
    if (line.length > 14) lines.push(line);
  }
  return lines;
}

export function pathLengthMeters(pts: Vec3[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    d += Math.hypot(b[0] - a[0], b[2] - a[2]);
  }
  return d * METERS_PER_UNIT;
}
