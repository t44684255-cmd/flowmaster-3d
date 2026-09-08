/** Geographic point picked on the globe. */
export interface GeoPoint {
  lon: number;
  lat: number;
  /** Terrain elevation, metres above the ellipsoid. */
  height: number;
  /** Local terrain slope in degrees (sampled from the DEM). */
  slope: number;
}

/** Default study area: Tehri Dam on the Bhagirathi, Uttarakhand, India. */
export const DAM_SITE = {
  name: "Tehri Dam",
  region: "Bhagirathi valley · Uttarakhand, India",
  lon: 78.4803,
  lat: 30.3776,
  height: 830,
};

export function formatLat(lat: number): string {
  return `${Math.abs(lat).toFixed(5)}° ${lat >= 0 ? "N" : "S"}`;
}

export function formatLon(lon: number): string {
  return `${Math.abs(lon).toFixed(5)}° ${lon >= 0 ? "E" : "W"}`;
}

export function landCover(height: number): string {
  if (height > 2600) return "Bare rock / snow";
  if (height > 1800) return "Alpine scrub";
  if (height > 900) return "Hill forest";
  return "Valley terraces";
}
