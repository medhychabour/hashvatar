import { OklchColor, oklchToHex } from './color';
import { hashToSeeds } from './hash';

export interface GradientOptions {
  size: number;
  colors: OklchColor[];
  animated?: boolean;
  seeds: number[];
}

// Irregular polygons (center ~0.5, 0.5), blurred and blended for a diffuse gradient
const SHAPES: [number, number][][] = [
  [[0.85, 0.5], [0.75, 0.18], [0.38, 0.22], [0.18, 0.52], [0.38, 0.82], [0.72, 0.78]],
  [[0.22, 0.32], [0.78, 0.28], [0.82, 0.62], [0.5, 0.88], [0.18, 0.68], [0.28, 0.48]],
  [[0.5, 0.12], [0.88, 0.45], [0.72, 0.88], [0.28, 0.82], [0.12, 0.42], [0.35, 0.18]],
  [[0.62, 0.25], [0.9, 0.55], [0.65, 0.9], [0.25, 0.7], [0.1, 0.4], [0.35, 0.15]],
  [[0.15, 0.2], [0.55, 0.08], [0.92, 0.35], [0.78, 0.75], [0.4, 0.92], [0.2, 0.6]],
  [[0.45, 0.08], [0.82, 0.3], [0.7, 0.85], [0.3, 0.88], [0.08, 0.5], [0.25, 0.25]],
];

// Safari < 18 and iOS don't support ctx.filter. Fallback: pixel-based box blur (3 passes ≈ Gaussian).
let _filterSupported: boolean | null = null;

function hasFilterBlur(): boolean {
  if (_filterSupported !== null) return _filterSupported;
  try {
    const c = document.createElement('canvas');
    c.width = 30;
    c.height = 30;
    const x = c.getContext('2d')!;
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 30, 30);
    x.filter = 'blur(6px)';
    x.fillStyle = '#000';
    x.fillRect(12, 12, 4, 4);
    _filterSupported = x.getImageData(22, 22, 1, 1).data[0] < 255;
    x.filter = 'none';
  } catch {
    _filterSupported = false;
  }
  return _filterSupported;
}

// 3-pass box blur on ImageData (sliding window, O(w*h) per pass). Approximates Gaussian blur.
function boxBlurCanvas(ctx: CanvasRenderingContext2D, w: number, h: number, radius: number, passes = 3): void {
  const r = Math.max(1, Math.round((Math.sqrt(4 * radius * radius + 1) - 1) / 2));
  const imgData = ctx.getImageData(0, 0, w, h);
  const s = imgData.data;
  const d = new Uint8ClampedArray(s.length);
  const diam = r * 2 + 1;
  const inv = 1 / diam;

  for (let pass = 0; pass < passes; pass++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let rs = 0, gs = 0, bs = 0, as = 0;
      for (let dx = -r; dx <= r; dx++) {
        const i = (row + Math.max(0, Math.min(w - 1, dx))) << 2;
        rs += s[i]; gs += s[i | 1]; bs += s[i | 2]; as += s[i | 3];
      }
      for (let x = 0; x < w; x++) {
        const o = (row + x) << 2;
        d[o] = rs * inv; d[o | 1] = gs * inv; d[o | 2] = bs * inv; d[o | 3] = as * inv;
        const ai = (row + Math.min(w - 1, x + r + 1)) << 2;
        const ri = (row + Math.max(0, x - r)) << 2;
        rs += s[ai] - s[ri]; gs += s[ai | 1] - s[ri | 1]; bs += s[ai | 2] - s[ri | 2]; as += s[ai | 3] - s[ri | 3];
      }
    }
    for (let x = 0; x < w; x++) {
      let rs = 0, gs = 0, bs = 0, as = 0;
      for (let dy = -r; dy <= r; dy++) {
        const i = (Math.max(0, Math.min(h - 1, dy)) * w + x) << 2;
        rs += d[i]; gs += d[i | 1]; bs += d[i | 2]; as += d[i | 3];
      }
      for (let y = 0; y < h; y++) {
        const o = (y * w + x) << 2;
        s[o] = rs * inv; s[o | 1] = gs * inv; s[o | 2] = bs * inv; s[o | 3] = as * inv;
        const ai = (Math.min(h - 1, y + r + 1) * w + x) << 2;
        const ri = (Math.max(0, y - r) * w + x) << 2;
        rs += d[ai] - d[ri]; gs += d[ai | 1] - d[ri | 1]; bs += d[ai | 2] - d[ri | 2]; as += d[ai | 3] - d[ri | 3];
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  path: [number, number][],
  size: number,
  tx: number,
  ty: number,
  rotate: number,
  scale: number,
  fillStyle: string,
  offsetX: number,
  offsetY: number,
): void {
  const cx = size / 2;
  const cy = size / 2;
  ctx.save();
  ctx.translate(offsetX + cx, offsetY + cy);
  ctx.translate(tx, ty);
  ctx.rotate(rotate);
  ctx.scale(scale, scale);
  ctx.translate(-cx, -cy);
  ctx.beginPath();
  ctx.moveTo(path[0][0] * size, path[0][1] * size);
  for (let i = 1; i < path.length; i++) {
    ctx.lineTo(path[i][0] * size, path[i][1] * size);
  }
  ctx.closePath();
  ctx.fillStyle = fillStyle;
  ctx.fill();
  ctx.restore();
}

function getDevicePixelRatio(): number {
  if (typeof window === 'undefined' || !window.devicePixelRatio) return 1;
  return Math.min(window.devicePixelRatio, 3);
}

export function renderGradient(
  canvas: HTMLCanvasElement,
  { size, colors, animated = false, seeds }: GradientOptions,
): (() => void) | null {
  if (colors.length < 4) return null;
  const dpr = getDevicePixelRatio();
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);

  const mix =
    seeds[0].toString() +
    seeds[1].toString() +
    seeds[2].toString() +
    seeds[3].toString();
  const allSeeds = hashToSeeds(mix, 24);

  const layers = [0, 1, 2, 3, 4, 5].map((i) => {
    const j = i * 4;
    return {
      tx: (allSeeds[j] - 0.5) * size * 0.35,
      ty: (allSeeds[j + 1] - 0.5) * size * 0.35,
      rotate: (allSeeds[j + 2] - 0.5) * Math.PI * 1.2,
      scale: 0.85 + allSeeds[j + 3] * 0.5,
    };
  });

  const hex0 = oklchToHex(colors[0]);
  const hexColors = [oklchToHex(colors[1]), oklchToHex(colors[2]), oklchToHex(colors[3])];

  // Per-layer: composite mode, alpha (more variation so shapes are more visible)
  const LAYER_OPTS: { composite: GlobalCompositeOperation; alpha: number }[] = [
    { composite: 'source-over', alpha: 0.9 },
    { composite: 'overlay', alpha: 0.48 },
    { composite: 'soft-light', alpha: 0.7 },
    { composite: 'source-over', alpha: 0.78 },
    { composite: 'overlay', alpha: 0.4 },
    { composite: 'soft-light', alpha: 0.6 },
  ];

  const blur = Math.max(2, Math.round(size * 0.21));
  const pad = Math.ceil(blur * 1.9);
  const useFilter = hasFilterBlur();

  const ROT_SPEEDS = [0.5, 0.6, 0.45, 0.55, 0.5, 0.65];
  const DRIFT_AMP = size * 0.18;
  const DRIFT_FREQS = [0.5, 0.45, 0.4, 0.48, 0.52, 0.38];
  const DRIFT_PHASE_OFFSETS = [0, 1, 2, 0.5, 1.5, 3];
  const PHASE_SPEED = 1.2;

  const w = size + pad * 2;
  const h = size + pad * 2;
  // Fallback (box blur) is heavy: in animated mode use half-res layers to keep 60fps on mobile
  const animResScale = !useFilter && animated ? 0.5 : 1;
  const offCanvas = document.createElement('canvas');
  offCanvas.width = w * dpr * animResScale;
  offCanvas.height = h * dpr * animResScale;
  const offCtx = offCanvas.getContext('2d')!;
  offCtx.scale(dpr * animResScale, dpr * animResScale);

  const draw = (phase: number) => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = hex0;
    ctx.fillRect(0, 0, size, size);

    for (let i = 0; i < 6; i++) {
      const layer = layers[i];
      const rot = layer.rotate + (animated ? phase * ROT_SPEEDS[i] : 0);
      const driftX = animated ? DRIFT_AMP * Math.sin(phase * DRIFT_FREQS[i] + DRIFT_PHASE_OFFSETS[i]) : 0;
      const driftY = animated ? DRIFT_AMP * Math.sin(phase * DRIFT_FREQS[(i + 2) % 6] + DRIFT_PHASE_OFFSETS[i] * 1.3) : 0;
      const scalePulse = animated ? 1 + 0.15 * Math.sin(phase * 0.9 + i * 0.7) : 1;
      const scale = layer.scale * scalePulse;
      const opts = LAYER_OPTS[i];
      const hex = hexColors[i % 3];

      offCtx.clearRect(0, 0, w, h);
      drawShape(offCtx, SHAPES[i], size, layer.tx + driftX, layer.ty + driftY, rot, scale, hex, pad, pad);

      if (useFilter) {
        ctx.save();
        ctx.filter = `blur(${blur * dpr}px)`;
        ctx.globalCompositeOperation = opts.composite;
        ctx.globalAlpha = opts.alpha;
        ctx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, -pad, -pad, w, h);
        ctx.restore();
      } else {
        boxBlurCanvas(offCtx, offCanvas.width, offCanvas.height, blur * dpr * 1.4 * animResScale, animResScale < 1 ? 2 : 3);
        ctx.save();
        ctx.globalCompositeOperation = opts.composite;
        ctx.globalAlpha = opts.alpha;
        ctx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, -pad, -pad, w, h);
        ctx.restore();
      }
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  };

  if (!animated) {
    draw(0);
    return null;
  }

  let raf: number;
  let phase = 0;
  let lastTime = 0;
  const tick = (now: number) => {
    if (lastTime) phase += (now - lastTime) * 0.001 * PHASE_SPEED;
    lastTime = now;
    draw(phase);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}
