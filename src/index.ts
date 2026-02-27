import { hashToSeeds } from './hash';
import {
  OklchColor,
  ToneInput,
  generateColor,
  parseTone,
  oklchToHex,
  oklchToCss,
} from './color';
import { renderGradient } from './gradient';
import { renderDither } from './dither';

export type { OklchColor, ToneInput };
export { oklchToHex, oklchToCss, hashToSeeds, parseTone, renderGradient, renderDither };

// ─── hashToColors ─────────────────────────────────────────────────────────────

export function hashToColors(
  hash: string,
  tones?: ToneInput[],
  count = 2,
): OklchColor[] {
  const seeds = hashToSeeds(hash, count * 3);
  const parsed = tones?.map(parseTone).filter((t): t is OklchColor => t !== null);
  const toneList = parsed?.length ? parsed : undefined;
  const baseHue = toneList ? undefined : (seeds[0] * 360) % 360; // monotone when no tones
  return Array.from({ length: count }, (_, i) =>
    generateColor(seeds[i * 3], seeds[i * 3 + 1], seeds[i * 3 + 2], toneList, i > 0, baseHue),
  );
}

// ─── Options ──────────────────────────────────────────────────────────────────

export type Mode = 'gradient' | 'dither';

export interface HashvatarOptions {
  /** Any string: wallet address, username, UUID… */
  hash: string;
  /** Canvas size in px (square). Default: 64 */
  size?: number;
  /** Render mode. Default: 'gradient' */
  mode?: Mode;
  /** Enable animation. Default: false */
  animated?: boolean;
  /** Dot cell size for dither mode. Default: 4 */
  dotScale?: number;
  /**
   * Restrict palette to these hue families.
   * Accepts hex (#ff69b4), oklch(l c h), or CSS color names (red, hotpink…)
   */
  tones?: ToneInput[];
}

export interface HashvatarResult {
  /** The rendered canvas element */
  canvas: HTMLCanvasElement;
  /** The generated colors in OKLCH */
  colors: OklchColor[];
  /** Call to stop animation loop (no-op if not animated) */
  destroy: () => void;
}

// ─── Main API ─────────────────────────────────────────────────────────────────

export function createHashvatar(options: HashvatarOptions): HashvatarResult {
  const {
    hash,
    size = 64,
    mode = 'gradient',
    animated = false,
    dotScale,
    tones,
  } = options;

  const canvas = document.createElement('canvas');
  const colorCount = mode === 'gradient' ? 4 : 2;
  const colors = hashToColors(hash, tones, colorCount);
  const seeds  = hashToSeeds(hash, 4);

  let cancel: (() => void) | null = null;

  if (mode === 'dither') {
    cancel = renderDither(canvas, { size, colors, dotScale, animated, seeds });
  } else {
    cancel = renderGradient(canvas, { size, colors, animated, seeds });
  }

  return {
    canvas,
    colors,
    destroy: () => cancel?.(),
  };
}

/**
 * Convenience: render into an existing canvas element.
 * Useful when you already have a <canvas> in the DOM.
 */
export function renderHashvatar(
  canvas: HTMLCanvasElement,
  options: HashvatarOptions,
): () => void {
  const {
    hash,
    size = 64,
    mode = 'gradient',
    animated = false,
    dotScale,
    tones,
  } = options;

  const colorCount = mode === 'gradient' ? 4 : 2;
  const colors = hashToColors(hash, tones, colorCount);
  const seeds  = hashToSeeds(hash, 4);

  let cancel: (() => void) | null = null;

  if (mode === 'dither') {
    cancel = renderDither(canvas, { size, colors, dotScale, animated, seeds });
  } else {
    cancel = renderGradient(canvas, { size, colors, animated, seeds });
  }

  return () => cancel?.();
}
