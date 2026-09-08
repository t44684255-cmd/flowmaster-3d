// Mock hydrology over a real Cesium terrain sample.
// A local height field is sampled from Cesium World Terrain around the dam,
// then steepest-descent streamlines are traced across it. Everything downstream
// (discharge, depths, velocities) remains demo maths.

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface GeoVertex {
  lon: number;
  lat: number;
  height: number;
}

export type FlowLine = GeoVertex[];

export interface HeightField {
  /** samples per side */
  n: number;
  /** half box size, metres */
  half: number;
  /** sample spacing, metres */
  step: number;
  h: Float64Array;
  lon0: number;
  lat0: number;
  /** metres per degree */
  mLon: number;
  mLat: number;
}

const M_PER_DEG_LAT = 111320;

export async function buildHeightField(
  Cesium: any,
  terrainProvider: any,
  lon: number,
  lat: number,
  half = 5000,
  n = 41,
): Promise<HeightField> {
  const mLat = M_PER_DEG_LAT;
  const mLon = M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
  const cartos: any[] = [];
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const e = -half + (2 * half * i) / (n - 1);
      const no = -half + (2 * half * j) / (n - 1);
      cartos.push(Cesium.Cartographic.fromDegrees(lon + e / mLon, lat + no / mLat));
    }
  }
  const sampled = await Cesium.sampleTerrainMostDetailed(terrainProvider, cartos);
  const h = new Float64Array(n * n);
  for (let k = 0; k < sampled.length; k++) h[k] = sampled[k]?.height ?? 0;
  return { n, half, step: (2 * half) / (n - 1), h, lon0: lon, lat0: lat, mLon, mLat };
}

export function heightAtEN(f: HeightField, e: number, no: number): number {
  const fi = Math.min(f.n - 1.001, Math.max(0, (e + f.half) / f.step));
  const fj = Math.min(f.n - 1.001, Math.max(0, (no + f.half) / f.step));
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  const tx = fi - i;
  const ty = fj - j;
  const idx = (a: number, b: number) => f.h[b * f.n + a] ?? 0;
  const a = idx(i, j) * (1 - tx) + idx(i + 1, j) * tx;
  const b = idx(i, j + 1) * (1 - tx) + idx(i + 1, j + 1) * tx;
  return a * (1 - ty) + b * ty;
}

export function gradientEN(f: HeightField, e: number, no: number) {
  const d = f.step * 0.75;
  return {
    de: (heightAtEN(f, e + d, no) - heightAtEN(f, e - d, no)) / (2 * d),
    dn: (heightAtEN(f, e, no + d) - heightAtEN(f, e, no - d)) / (2 * d),
  };
}

export function slopeAtEN(f: HeightField, e: number, no: number): number {
  const { de, dn } = gradientEN(f, e, no);
  return (Math.atan(Math.hypot(de, dn)) * 180) / Math.PI;
}

export function toGeo(f: HeightField, e: number, no: number, height: number): GeoVertex {
  return { lon: f.lon0 + e / f.mLon, lat: f.lat0 + no / f.mLat, height };
}

/** Steepest-descent streamline in local ENU metres. */
function streamline(f: HeightField, e0: number, n0: number): FlowLine {
  const pts: FlowLine = [];
  let e = e0;
  let no = n0;
  let ve = 0;
  let vn = 0;
  const stepLen = f.step * 0.55;
  for (let i = 0; i < 420; i++) {
    const h = heightAtEN(f, e, no);
    pts.push(toGeo(f, e, no, h));
    const { de, dn } = gradientEN(f, e, no);
    const len = Math.hypot(de, dn);
    if (len < 1e-5 && i > 20) break;
    ve = ve * 0.8 - (de / (len + 1e-6)) * stepLen;
    vn = vn * 0.8 - (dn / (len + 1e-6)) * stepLen;
    e += ve * 0.45;
    no += vn * 0.45;
    if (Math.abs(e) > f.half - f.step || Math.abs(no) > f.half - f.step) break;
  }
  return pts;
}

/** A fan of streamlines seeded around the breach. */
export function buildFlowNetwork(f: HeightField, count = 22, spread = 260): FlowLine[] {
  const lines: FlowLine[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const r = spread * (0.3 + ((i * 7919) % 100) / 120);
    const line = streamline(f, Math.cos(a) * r, Math.sin(a) * r);
    if (line.length > 12) lines.push(line);
  }
  return lines;
}

/** Great-circle-free planar length of a flow line, metres. */
export function lineLengthMeters(line: FlowLine, f: HeightField): number {
  let d = 0;
  for (let i = 1; i < line.length; i++) {
    const a = line[i - 1]!;
    const b = line[i]!;
    d += Math.hypot((b.lon - a.lon) * f.mLon, (b.lat - a.lat) * f.mLat);
  }
  return d;
}
