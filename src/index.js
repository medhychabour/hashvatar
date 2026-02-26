// ─── index.js — hashvatar public API ─────────────────────────────────────────

import { hashToSeeds } from './hash.js';
import { generateColor, parseTone, oklchToHex, oklchToCss } from './color.js';
import { renderGradient } from './gradient.js';
import { renderDither } from './dither.js';

export { oklchToHex, oklchToCss, hashToSeeds };

// ─── hashToColors ─────────────────────────────────────────────────────────────

export function hashToColors(hash, tones, count = 2) {
  const seeds  = hashToSeeds(hash, count * 3);
  const parsed = tones?.map(parseTone).filter(Boolean);
  const toneList = parsed?.length ? parsed : undefined;
  const baseHue = toneList ? undefined : (seeds[0] * 360) % 360;
  return Array.from({ length: count }, (_, i) =>
    generateColor(seeds[i*3], seeds[i*3+1], seeds[i*3+2], toneList, i > 0, baseHue),
  );
}

// ─── createHashvatar ──────────────────────────────────────────────────────────

/**
 * @param {object} options
 * @param {string}   options.hash       — any string (wallet, username, uuid…)
 * @param {number}  [options.size=64]   — canvas size in px
 * @param {string}  [options.mode]      — 'gradient' | 'dither'
 * @param {boolean} [options.animated]  — enable animation loop
 * @param {number}  [options.dotScale]  — dither dot size (default 4)
 * @param {string[]}[options.tones]     — palette hue constraints
 * @returns {{ canvas: HTMLCanvasElement, colors: object[], destroy: function }}
 */
export function createHashvatar({
  hash,
  size       = 64,
  mode       = 'gradient',
  animated   = false,
  dotScale,
  tones,
} = {}) {
  const canvas     = document.createElement('canvas');
  const colorCount = mode === 'gradient' ? 4 : 2;
  const colors     = hashToColors(hash, tones, colorCount);
  const seeds      = hashToSeeds(hash, 4);

  const cancel = mode === 'dither'
    ? renderDither(canvas,  { size, colors, dotScale, animated, seeds })
    : renderGradient(canvas, { size, colors, animated, seeds });

  return { canvas, colors, destroy: () => cancel?.() };
}

// ─── renderHashvatar ──────────────────────────────────────────────────────────

/**
 * Render into an existing canvas element.
 * @returns {function} destroy — call to stop animation
 */
export function renderHashvatar(canvas, {
  hash,
  size       = 64,
  mode       = 'gradient',
  animated   = false,
  dotScale,
  tones,
} = {}) {
  const colorCount = mode === 'gradient' ? 4 : 2;
  const colors     = hashToColors(hash, tones, colorCount);
  const seeds      = hashToSeeds(hash, 4);

  const cancel = mode === 'dither'
    ? renderDither(canvas,  { size, colors, dotScale, animated, seeds })
    : renderGradient(canvas, { size, colors, animated, seeds });

  return () => cancel?.();
}
