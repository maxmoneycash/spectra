/** Renders the shareable SPECTRA Operator Card onto a canvas. */

export interface CardData {
  callsign: string;
  name: string;
  grid?: string;
  signals: number;
  missions: number;
  coursePct: number;
  since: Date;
  /** QR code as an already-loaded image (drawn bottom-right). */
  qr: HTMLImageElement | null;
}

export const RANKS: [min: number, rank: string][] = [
  [10, 'SPECTRUM SPECIALIST'],
  [6, 'ANALYST'],
  [3, 'OPERATOR'],
  [0, 'LISTENER'],
];

export function rankFor(signals: number): string {
  for (const [min, rank] of RANKS) if (signals >= min) return rank;
  return 'LISTENER';
}

const INK = '#18181b';
const MUTED = '#71717a';
const LINE = '#e4e4e7';
const PAPER = '#fafafa';
const EMBER = '#f5622f';
const MONO = '"Geist Mono", ui-monospace, monospace';

function hr(ctx: CanvasRenderingContext2D, x0: number, x1: number, y: number, color = LINE, w = 1) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.moveTo(x0, y + 0.5);
  ctx.lineTo(x1, y + 0.5);
  ctx.stroke();
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxW: number, px: number, weight: number): number {
  let size = px;
  while (size > 12) {
    ctx.font = `${weight} ${size}px ${MONO}`;
    if (ctx.measureText(text).width <= maxW) break;
    size -= 4;
  }
  return size;
}

function fmtDate(d: Date): string {
  return d
    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: '2-digit' })
    .toUpperCase();
}

function drawStats(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  stats: [string, string][],
) {
  const colW = w / stats.length;
  stats.forEach(([label, value], i) => {
    const cx = x + i * colW;
    if (i > 0) {
      ctx.strokeStyle = LINE;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, y + 8);
      ctx.lineTo(cx, y + 64);
      ctx.stroke();
    }
    ctx.fillStyle = MUTED;
    ctx.font = `500 15px ${MONO}`;
    ctx.fillText(label, cx + (i > 0 ? 24 : 0), y + 24);
    ctx.fillStyle = INK;
    ctx.font = `600 44px ${MONO}`;
    ctx.fillText(value, cx + (i > 0 ? 24 : 0), y + 66);
  });
}

function drawQr(
  ctx: CanvasRenderingContext2D,
  qr: HTMLImageElement | null,
  x: number,
  y: number,
  size: number,
) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = EMBER;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, size, size);
  if (qr) ctx.drawImage(qr, x + 10, y + 10, size - 20, size - 20);
  ctx.fillStyle = MUTED;
  ctx.font = `500 15px ${MONO}`;
  ctx.textAlign = 'center';
  ctx.fillText('SCAN TO PLAY', x + size / 2, y + size + 26);
  ctx.textAlign = 'left';
}

function header(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = EMBER;
  ctx.beginPath();
  ctx.arc(x + 6, y - 5, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = `600 26px ${MONO}`;
  ctx.fillText('SPECTRA', x + 22, y);
  ctx.fillStyle = MUTED;
  ctx.font = `500 15px ${MONO}`;
  const sub = 'SOFTWARE-DEFINED RADIO LAB';
  ctx.fillText(sub, x + w - ctx.measureText(sub).width, y);
}

function footer(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = MUTED;
  ctx.font = `500 16px ${MONO}`;
  ctx.fillText('Learn radio in your browser — free, no hardware.', x, y);
  ctx.fillStyle = INK;
  ctx.font = `600 17px ${MONO}`;
  ctx.fillText('spectra-one.vercel.app', x, y + 28);
}

/** Square card for sharing (1080×1080 feed format). */
export function renderOperatorCard(canvas: HTMLCanvasElement, d: CardData): void {
  const S = 1080;
  canvas.width = S;
  canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, S, S);

  // frame
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(30, 30, S - 60, S - 60);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(46, 46, S - 92, S - 92);

  const X = 88;
  const W = S - 176;
  let y = 108;

  header(ctx, X, y, W);
  y += 34;
  hr(ctx, X, X + W, y, INK, 2);

  y += 66;
  ctx.fillStyle = MUTED;
  ctx.font = `500 17px ${MONO}`;
  ctx.fillText('OPERATOR LICENSE — SIMULATED SERVICE', X, y);

  // callsign
  y += 178;
  const cs = d.callsign.toUpperCase() || 'M0RSE';
  const csSize = fitText(ctx, cs, W, 168, 600);
  ctx.font = `600 ${csSize}px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.fillText(cs, X - 8, y);

  // name + grid
  y += 56;
  ctx.font = `500 30px ${MONO}`;
  ctx.fillStyle = MUTED;
  const nameText = d.name || 'Samuel Morse';
  ctx.fillText(nameText, X, y);
  if (d.grid) {
    ctx.font = `500 22px ${MONO}`;
    const gw = ctx.measureText(nameText).width;
    ctx.fillText(` · ${d.grid.toUpperCase()}`, X + gw, y);
  }

  // rank pill
  y += 84;
  const rank = rankFor(d.signals);
  ctx.font = `600 19px ${MONO}`;
  const rw = ctx.measureText(rank).width + 36;
  ctx.fillStyle = EMBER;
  ctx.beginPath();
  ctx.roundRect(X, y - 30, rw, 42, 21);
  ctx.fill();
  ctx.fillStyle = '#2a1006';
  ctx.fillText(rank, X + 18, y - 2);

  y += 52;
  hr(ctx, X, X + W, y);

  // stats
  y += 16;
  drawStats(ctx, X, y, W, [
    ['MISSIONS', `${d.missions}/7`],
    ['SIGNALS ID', `${d.signals}/12`],
    ['COURSE', `${d.coursePct}%`],
  ]);

  y += 96;
  hr(ctx, X, X + W, y);

  // bottom row: issue info left, QR right
  y += 34;
  ctx.fillStyle = MUTED;
  ctx.font = `500 15px ${MONO}`;
  ctx.fillText(`ISSUED ${fmtDate(d.since)}`, X, y + 8);
  footer(ctx, X, y + 62);

  drawQr(ctx, d.qr, S - 88 - 200, y - 14, 200);
}

/** Wide 1200×630 layout for the site OG image. */
export function renderOgCard(canvas: HTMLCanvasElement, d: CardData): void {
  const W = 1200;
  const H = 630;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.strokeRect(20, 20, W - 40, H - 40);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1;
  ctx.strokeRect(32, 32, W - 64, H - 64);

  const X = 72;
  let y = 84;
  header(ctx, X, y, W - 144);
  y += 28;
  hr(ctx, X, W - 72, y, INK, 2);

  y += 52;
  ctx.fillStyle = MUTED;
  ctx.font = `500 15px ${MONO}`;
  ctx.fillText('OPERATOR LICENSE — SIMULATED SERVICE', X, y);

  y += 120;
  const cs = d.callsign.toUpperCase() || 'M0RSE';
  const csSize = fitText(ctx, cs, 640, 116, 600);
  ctx.font = `600 ${csSize}px ${MONO}`;
  ctx.fillStyle = INK;
  ctx.fillText(cs, X - 6, y);

  y += 44;
  ctx.font = `500 24px ${MONO}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(d.name || 'Samuel Morse', X, y);

  y += 66;
  const rank = rankFor(d.signals);
  ctx.font = `600 17px ${MONO}`;
  const rw = ctx.measureText(rank).width + 30;
  ctx.fillStyle = EMBER;
  ctx.beginPath();
  ctx.roundRect(X, y - 26, rw, 36, 18);
  ctx.fill();
  ctx.fillStyle = '#2a1006';
  ctx.fillText(rank, X + 15, y - 2);

  y += 46;
  hr(ctx, X, 800, y);
  y += 14;
  drawStats(ctx, X, y, 720, [
    ['MISSIONS', `${d.missions}/7`],
    ['SIGNALS ID', `${d.signals}/12`],
    ['COURSE', `${d.coursePct}%`],
  ]);

  footer(ctx, X, H - 84);
  drawQr(ctx, d.qr, W - 72 - 236, 122, 236);
}
