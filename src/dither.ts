import { OklchColor, oklchToHex } from './color';

export interface DitherOptions {
  size: number;
  colors: OklchColor[];
  dotScale?: number;
  animated?: boolean;
  seeds: number[];
}

// 8×8 Bayer matrix — 64 threshold levels for smooth transitions
const BAYER8: number[][] = (() => {
  const m = [
    [ 0,32, 8,40, 2,34,10,42],
    [48,16,56,24,50,18,58,26],
    [12,44, 4,36,14,46, 6,38],
    [60,28,52,20,62,30,54,22],
    [ 3,35,11,43, 1,33, 9,41],
    [51,19,59,27,49,17,57,25],
    [15,47, 7,39,13,45, 5,37],
    [63,31,55,23,61,29,53,21],
  ];
  return m.map(r => r.map(v => v / 64));
})();

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function getDevicePixelRatio(): number {
  if (typeof window === 'undefined' || !window.devicePixelRatio) return 1;
  return Math.min(window.devicePixelRatio, 3);
}

export function renderDither(
  canvas: HTMLCanvasElement,
  { size, colors, dotScale: dotScaleOpt, animated = false, seeds }: DitherOptions,
): (() => void) | null {
  const dpr = getDevicePixelRatio();
  const sizePx = Math.round(size * dpr);
  canvas.width = sizePx;
  canvas.height = sizePx;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d')!;

  const dotScaleLogical = dotScaleOpt ?? Math.max(2, Math.round(size / 35));
  const dotScale = Math.max(1, Math.round(dotScaleLogical * dpr));

  const colA = hexToRgb(oklchToHex(colors[0]));
  const colB = hexToRgb(oklchToHex(colors[Math.min(1, colors.length - 1)]));

  const baseAngle = seeds[0] * Math.PI * 2;
  const falloff   = 0.55 + seeds[1] * 0.25;
  const swirlSpeed = 0.45;

  const padding  = 1;
  const gridSize = Math.ceil(sizePx / dotScale) + padding * 2;

  // Deterministic per-cell phase/amplitude for organic motion (same hash = same animation)
  const cellPhase = (gx: number, gy: number): number =>
    ((gx * 31 + gy * 17) * (seeds[2] * 1000 + 1) + (seeds[3] * 1000 | 0)) % 1000 / 1000 * Math.PI * 2;
  const cellAmp = (gx: number, gy: number): number =>
    0.035 + (((gx * 7 + gy * 13 + seeds[2] * 50) | 0) % 55) / 1100;

  const draw = (phase: number) => {
    const img = ctx.createImageData(sizePx, sizePx);
    const d   = img.data;

    const angle = baseAngle + (animated ? phase * swirlSpeed : 0);
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    for (let i = 0; i < sizePx * sizePx * 4; i += 4) {
      d[i] = colB.r; d[i + 1] = colB.g; d[i + 2] = colB.b; d[i + 3] = 255;
    }

    for (let gy = 0; gy < gridSize; gy++) {
      for (let gx = 0; gx < gridSize; gx++) {
        const nx = (gx - padding + 0.5) / (gridSize - padding * 2);
        const ny = (gy - padding + 0.5) / (gridSize - padding * 2);

        const proj = (nx - 0.5) * cosA + (ny - 0.5) * sinA;

        let drift = 0;
        if (animated) {
          const p = cellPhase(gx, gy);
          const a = cellAmp(gx, gy);
          drift =
            a * Math.sin(phase * 0.3 + p) +
            a * 0.55 * Math.sin(phase * 0.1 + p * 1.7) +
            0.012 * Math.sin(phase * 0.2);
        }

        const tRaw   = (proj - drift + falloff) / (falloff * 2);
        const tClamp = Math.max(0, Math.min(1, tRaw));
        const t      = tClamp * tClamp * (3 - 2 * tClamp);

        const bayer = BAYER8[gy % 8][gx % 8];
        if (t > bayer) continue;

        for (let py = 0; py < dotScale; py++) {
          for (let px = 0; px < dotScale; px++) {
            const x = (gx - padding) * dotScale + px;
            const y = (gy - padding) * dotScale + py;
            if (x < 0 || y < 0 || x >= sizePx || y >= sizePx) continue;
            const idx = (y * sizePx + x) * 4;
            d[idx] = colA.r; d[idx + 1] = colA.g; d[idx + 2] = colA.b;
          }
        }
      }
    }

    ctx.putImageData(img, 0, 0);
  };

  if (!animated) { draw(0); return null; }

  let raf: number;
  let phase = 0;
  let lastTime = 0;
  const SPEED = 0.55; // phase units per second
  const tick = (now: number) => {
    if (lastTime) phase += (now - lastTime) * 0.001 * SPEED;
    lastTime = now;
    draw(phase);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
