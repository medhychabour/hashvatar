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

function drawBlurredShape(
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

export function renderGradient(
  canvas: HTMLCanvasElement,
  { size, colors, animated = false, seeds }: GradientOptions,
): (() => void) | null {
  if (colors.length < 4) return null;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

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

  const blur = Math.max(8, Math.round(size * 0.21));
  const pad = Math.ceil(blur * 1.9);

  const ROT_SPEEDS = [0.5, 0.6, 0.45, 0.55, 0.5, 0.65];
  const DRIFT_AMP = size * 0.18;
  const DRIFT_FREQS = [0.5, 0.45, 0.4, 0.48, 0.52, 0.38];
  const DRIFT_PHASE_OFFSETS = [0, 1, 2, 0.5, 1.5, 3];
  const PHASE_SPEED = 1.2;

  const draw = (phase: number) => {
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = hex0;
    ctx.fillRect(0, 0, size, size);

    const w = size + pad * 2;
    const h = size + pad * 2;
    const offCtx = document.createElement('canvas').getContext('2d')!;
    offCtx.canvas.width = w;
    offCtx.canvas.height = h;

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
      drawBlurredShape(
        offCtx,
        SHAPES[i],
        size,
        layer.tx + driftX,
        layer.ty + driftY,
        rot,
        scale,
        hex,
        pad,
        pad,
      );
      ctx.save();
      ctx.filter = `blur(${blur}px)`;
      ctx.globalCompositeOperation = opts.composite;
      ctx.globalAlpha = opts.alpha;
      ctx.drawImage(offCtx.canvas, 0, 0, w, h, -pad, -pad, w, h);
      ctx.restore();
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
