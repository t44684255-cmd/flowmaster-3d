
export type SimStatus = "idle" | "running" | "paused" | "finished";

export interface SimParams {
  /** Reservoir volume, million cubic metres */
  reservoirVolume: number;
  /** Breach width, metres */
  breachWidth: number;
  /** Rainfall intensity, mm/h */
  rainfall: number;
  /** Manning roughness coefficient */
  roughness: number;
  /** Simulated duration, minutes */
  duration: number;
  /** Grid resolution, metres */
  resolution: number;
}

export const DEFAULT_PARAMS: SimParams = {
  reservoirVolume: 42.5,
  breachWidth: 85,
  rainfall: 24,
  roughness: 0.035,
  duration: 120,
  resolution: 25,
};

export interface DamSite {
  x: number;
  z: number;
  y: number;
}

export interface SimStats {
  peakDischarge: number; // m3/s
  meanVelocity: number; // m/s
  frontVelocity: number; // m/s
  inundatedArea: number; // km2
  releasedVolume: number; // Mm3
  maxDepth: number; // m
  travelDistance: number; // km
  arrivalTime: number; // min
  crestElevation: number; // m
  froude: number;
  cellsWet: number;
  reynolds: number;
}

/** Mock hydraulics. Physically flavoured, numerically fake — demo values only. */
export function computeStats(
  params: SimParams,
  progress: number, // 0..1 through the simulated timeline
  dam: { height: number } | null,
  longestMeters: number,
): SimStats {
  const p = Math.max(0, Math.min(1, progress));
  const vol = params.reservoirVolume;
  // Breach outflow follows a rising limb then a long recession
  const hydro = Math.pow(p, 0.45) * Math.exp(-2.1 * p) * 4.15;
  const peak =
    0.68 * params.breachWidth * Math.pow(vol, 0.62) * (1 + params.rainfall / 260) * 12;
  const discharge = peak * hydro;

  const slopeFactor = 0.9 + params.rainfall / 400;
  const meanV = (1 / params.roughness) * 0.048 * slopeFactor;
  const frontV = meanV * 1.42;

  const longest = longestMeters;
  const travelled = (longest / 1000) * Math.min(1, p * 1.25);
  const width = params.breachWidth * (1.6 + p * 2.4);
  const area = (travelled * 1000 * width) / 1e6;
  const released = vol * (1 - Math.exp(-3.4 * p));
  const depth = 2.2 + Math.pow(vol, 0.4) * 1.35 * Math.exp(-1.4 * p) + params.rainfall / 90;
  const arrival = longest > 0 ? longest / frontV / 60 : 0;
  const froude = frontV / Math.sqrt(9.81 * Math.max(depth, 0.6));

  return {
    peakDischarge: discharge,
    meanVelocity: meanV,
    frontVelocity: frontV,
    inundatedArea: area,
    releasedVolume: released,
    maxDepth: depth,
    travelDistance: travelled,
    arrivalTime: arrival,
    crestElevation: dam ? Math.round(dam.height) : 0,
    froude,
    cellsWet: Math.round((area * 1e6) / (params.resolution * params.resolution)),
    reynolds: (frontV * Math.max(depth, 0.6)) / 1.05e-6,
  };
}

export const SPEEDS = [0.5, 1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export function formatClock(minutes: number): string {
  const total = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function compact(n: number, digits = 1): string {
  if (!isFinite(n)) return "—";
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(digits)}M`;
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(digits)}k`;
  return n.toFixed(digits);
}
