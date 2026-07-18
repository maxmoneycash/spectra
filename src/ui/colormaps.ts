/** Waterfall colormaps as 256-entry RGB lookup tables. */
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
  lut: Uint8ClampedArray;
}

export const COLORMAPS: Colormap[] = [
  {
    name: 'Ember',
    lut: buildLut([
      [0.0, 6, 6, 7],
      [0.3, 19, 11, 9],
      [0.52, 68, 22, 10],
      [0.7, 150, 48, 18],
      [0.84, 245, 98, 47],
      [0.93, 252, 168, 108],
      [1.0, 255, 246, 236],
    ]),
  },
  {
    name: 'Inferno',
    lut: buildLut([
      [0.0, 4, 6, 12],
      [0.15, 20, 14, 54],
      [0.35, 78, 18, 92],
      [0.55, 158, 32, 90],
      [0.72, 220, 68, 55],
      [0.86, 250, 150, 40],
      [0.95, 252, 214, 110],
      [1.0, 255, 252, 220],
    ]),
  },
  {
    name: 'Viridis',
    lut: buildLut([
      [0.0, 8, 10, 30],
      [0.25, 60, 40, 120],
      [0.45, 40, 90, 140],
      [0.6, 33, 140, 135],
      [0.75, 90, 190, 90],
      [0.9, 190, 220, 50],
      [1.0, 253, 231, 37],
    ]),
  },
  {
    name: 'Turbo',
    lut: buildLut([
      [0.0, 24, 20, 60],
      [0.2, 40, 120, 220],
      [0.4, 40, 220, 200],
      [0.55, 120, 235, 80],
      [0.7, 230, 200, 40],
      [0.85, 240, 90, 40],
      [1.0, 140, 20, 10],
    ]),
  },
  {
    name: 'Phosphor',
    lut: buildLut([
      [0.0, 3, 8, 6],
      [0.35, 8, 40, 24],
      [0.6, 20, 110, 60],
      [0.8, 74, 222, 128],
      [1.0, 210, 255, 220],
    ]),
  },
  {
    name: 'Grayscale',
    lut: buildLut([
      [0.0, 6, 8, 10],
      [1.0, 240, 244, 248],
    ]),
  },
];
