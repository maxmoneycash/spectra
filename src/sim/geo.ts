/** Maidenhead grid squares and great-circle math (ARRL/NOAA formulas). */

const A = 'A'.charCodeAt(0);

export function isValidGrid(g: string): boolean {
  return /^[A-R]{2}[0-9]{2}([A-X]{2})?$/i.test(g);
}

/** Grid square (4 or 6 chars) → cell-center lat/lon. Null when invalid. */
export function gridToLatLon(grid: string): { lat: number; lon: number } | null {
  const g = grid.trim().toUpperCase();
  if (!isValidGrid(g)) return null;
  let lon = (g.charCodeAt(0) - A) * 20 - 180;
  let lat = (g.charCodeAt(1) - A) * 10 - 90;
  lon += Number(g[2]) * 2;
  lat += Number(g[3]) * 1;
  if (g.length === 6) {
    lon += (g.charCodeAt(4) - A) * (2 / 24) + 1 / 24;
    lat += (g.charCodeAt(5) - A) * (1 / 24) + 1 / 48;
  } else {
    lon += 1;
    lat += 0.5;
  }
  return { lat, lon };
}

/** Lat/lon → 6-character grid square. */
export function latLonToGrid(lat: number, lon: number): string {
  const la = Math.min(89.9999, Math.max(-90, lat));
  const lo = Math.min(179.9999, Math.max(-180, lon));
  const adjLon = lo + 180;
  const adjLat = la + 90;
  const field = String.fromCharCode(A + Math.floor(adjLon / 20)) +
    String.fromCharCode(A + Math.floor(adjLat / 10));
  const square = `${Math.floor((adjLon % 20) / 2)}${Math.floor(adjLat % 10)}`;
  const sub = String.fromCharCode(A + Math.floor(((adjLon % 2) / 2) * 24)) +
    String.fromCharCode(A + Math.floor(((adjLat % 1) / 1) * 24));
  return field + square + sub;
}

const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export interface GreatCircle {
  km: number;
  miles: number;
  shortPathDeg: number;
  longPathDeg: number;
  compass: string;
}

const COMPASS16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

/** Haversine distance + short/long-path initial bearings. */
export function greatCircle(
  from: { lat: number; lon: number },
  to: { lat: number; lon: number },
): GreatCircle {
  const φ1 = rad(from.lat);
  const φ2 = rad(to.lat);
  const Δφ = rad(to.lat - from.lat);
  const Δλ = rad(to.lon - from.lon);
  const a =
    Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const km = 2 * R_KM * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const brg = (deg(Math.atan2(y, x)) + 360) % 360;
  return {
    km,
    miles: km * 0.621371,
    shortPathDeg: brg,
    longPathDeg: (brg + 180) % 360,
    compass: COMPASS16[Math.round(brg / 22.5) % 16],
  };
}
