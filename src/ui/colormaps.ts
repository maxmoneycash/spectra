/**
 * Waterfall colormaps as 256-entry RGB lookup tables.
 *
 * Each map carries a dark and a light ramp. The dark ramp rises from near-black
 * into ember; the light ramp starts at paper and darkens into the same accent,
 * so a light theme reads as ink on paper rather than an inverted photo.
 */
type Stop = [number, number, number, number];

function buildLut(stops: Stop[]): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(256 * 3);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = stops[0];
    let b = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        a = stops[s];
        b = stops[s + 1];
        break;
      }
    }
    const f = (t - a[0]) / (b[0] - a[0] || 1);
    lut[i * 3] = a[1] + f * (b[1] - a[1]);
    lut[i * 3 + 1] = a[2] + f * (b[2] - a[2]);
    lut[i * 3 + 2] = a[3] + f * (b[3] - a[3]);
  }
  return lut;
}

export interface Colormap {
  name: string;
  dark: Uint8ClampedArray;
  light: Uint8ClampedArray;
}

const MAPS: { name: string; dark: Stop[]; light: Stop[] }[] = [
  {
    name: 'Ember',
    dark: [
      [0.0, 8, 7, 9],
      [0.32, 34, 15, 10],
      [0.55, 105, 40, 20],
      [0.74, 245, 98, 47],
      [0.88, 250, 158, 92],
      [1.0, 250, 240, 226],
    ],
    light: [
      [0.0, 255, 255, 254],
      [0.3, 253, 240, 228],
      [0.52, 250, 199, 158],
      [0.72, 235, 116, 60],
      [0.88, 174, 58, 18],
      [1.0, 72, 22, 6],
    ],
  },
  {
    name: 'Inferno',
    dark: [
      [0.0, 4, 6, 12],
      [0.15, 20, 14, 54],
      [0.35, 78, 18, 92],
      [0.55, 158, 32, 90],
      [0.72, 220, 68, 55],
      [0.86, 250, 150, 40],
      [0.95, 252, 214, 110],
      [1.0, 255, 252, 220],
    ],
    light: [
      [0.0, 255, 254, 250],
      [0.22, 253, 232, 190],
      [0.42, 250, 176, 84],
      [0.6, 226, 92, 56],
      [0.78, 158, 32, 90],
      [0.92, 72, 18, 88],
      [1.0, 18, 10, 40],
    ],
  },
  {
    name: 'Viridis',
    dark: [
      [0.0, 8, 10, 30],
      [0.25, 60, 40, 120],
      [0.45, 40, 90, 140],
      [0.6, 33, 140, 135],
      [0.75, 90, 190, 90],
      [0.9, 190, 220, 50],
      [1.0, 253, 231, 37],
    ],
    light: [
      [0.0, 253, 253, 245],
      [0.25, 226, 236, 160],
      [0.45, 138, 200, 110],
      [0.62, 46, 155, 130],
      [0.8, 44, 96, 140],
      [1.0, 26, 20, 72],
    ],
  },
  {
    name: 'Turbo',
    dark: [
      [0.0, 24, 20, 60],
      [0.2, 40, 120, 220],
      [0.4, 40, 220, 200],
      [0.55, 120, 235, 80],
      [0.7, 230, 200, 40],
      [0.85, 240, 90, 40],
      [1.0, 140, 20, 10],
    ],
    light: [
      [0.0, 253, 253, 253],
      [0.2, 196, 232, 246],
      [0.4, 96, 206, 200],
      [0.56, 150, 214, 96],
      [0.72, 232, 186, 54],
      [0.87, 226, 96, 44],
      [1.0, 120, 16, 8],
    ],
  },
  {
    name: 'Mono',
    dark: [
      [0.0, 8, 8, 9],
      [0.5, 96, 96, 102],
      [1.0, 250, 250, 252],
    ],
    light: [
      [0.0, 255, 255, 255],
      [0.5, 150, 150, 156],
      [1.0, 12, 12, 14],
    ],
  },
];

export const COLORMAPS: Colormap[] = MAPS.map((m) => ({
  name: m.name,
  dark: buildLut(m.dark),
  light: buildLut(m.light),
}));

/** The active ramp for a colormap under the current theme. */
export const lutFor = (index: number, isDark: boolean): Uint8ClampedArray => {
  const map = COLORMAPS[index] ?? COLORMAPS[0];
  return isDark ? map.dark : map.light;
};
