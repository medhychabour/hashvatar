export interface OklchColor {
  l: number;
  c: number;
  h: number;
}

export type ToneInput = string; // hex, oklch(...), or CSS named color e.g. "red"

// ─── Conversions ──────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3
    ? clean.split('').map(c => c + c).join('')
    : clean;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function linearize(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function rgbToOklch(r: number, g: number, b: number): OklchColor {
  const rl = linearize(r), gl = linearize(g), bl = linearize(b);
  const x = 0.4124564 * rl + 0.3575761 * gl + 0.1804375 * bl;
  const y = 0.2126729 * rl + 0.7151522 * gl + 0.0721750 * bl;
  const z = 0.0193339 * rl + 0.1191920 * gl + 0.9503041 * bl;
  const lm = Math.cbrt(0.8189330101 * x + 0.3618667424 * y - 0.1288597137 * z);
  const mm = Math.cbrt(0.0329845436 * x + 0.9293118715 * y + 0.0361456387 * z);
  const sm = Math.cbrt(0.0482003018 * x + 0.2643662691 * y + 0.6338517070 * z);
  const L  = 0.2104542553 * lm + 0.7936177850 * mm - 0.0040720468 * sm;
  const a  = 1.9779984951 * lm - 2.4285922050 * mm + 0.4505937099 * sm;
  const bk = 0.0259040371 * lm + 0.7827717662 * mm - 0.8086757660 * sm;
  return { l: L, c: Math.sqrt(a * a + bk * bk), h: ((Math.atan2(bk, a) * 180 / Math.PI) + 360) % 360 };
}

export function oklchToHex({ l, c, h }: OklchColor): string {
  const hRad = h * Math.PI / 180;
  const a = c * Math.cos(hRad), b = c * Math.sin(hRad);
  const lm = l + 0.3963377774 * a + 0.2158037573 * b;
  const mm = l - 0.1055613458 * a - 0.0638541728 * b;
  const sm = l - 0.0894841775 * a - 1.2914855480 * b;
  const L3 = lm * lm * lm, M3 = mm * mm * mm, S3 = sm * sm * sm;
  const rl = +4.0767416621 * L3 - 3.3077115913 * M3 + 0.2309699292 * S3;
  const gl = -1.2684380046 * L3 + 2.6097574011 * M3 - 0.3413193965 * S3;
  const bl = -0.0041960863 * L3 - 0.7034186147 * M3 + 1.7076147010 * S3;
  const toSrgb = (v: number) => {
    const cv = Math.max(0, Math.min(1, v));
    return cv <= 0.0031308 ? cv * 12.92 : 1.055 * Math.pow(cv, 1 / 2.4) - 0.055;
  };
  return '#' + [rl, gl, bl].map(v => Math.round(toSrgb(v) * 255).toString(16).padStart(2, '0')).join('');
}

export function oklchToCss({ l, c, h }: OklchColor): string {
  return `oklch(${l.toFixed(3)} ${c.toFixed(3)} ${h.toFixed(1)})`;
}

// ─── Tone parsing ─────────────────────────────────────────────────────────────

/**
 * Parse a tone string into OklchColor.
 * Supports: "#ff69b4", "ff69b4", "oklch(0.6 0.25 310)", "red", "hotpink"
 * Note: CSS named color resolution requires a browser environment (uses canvas).
 */
export function parseTone(tone: string): OklchColor | null {
  const t = tone.trim();

  // CSS named colors — resolve via canvas (browser only)
  if (/^[a-zA-Z]+$/.test(t)) {
    if (typeof document === 'undefined') return null;
    const tmp = document.createElement('canvas');
    tmp.width = tmp.height = 1;
    const ctx = tmp.getContext('2d')!;
    ctx.fillStyle = t;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    if (r + g + b > 0 || t.toLowerCase() === 'black') return rgbToOklch(r, g, b);
    return null;
  }

  // Hex
  if (t.startsWith('#') || /^[0-9a-f]{3,6}$/i.test(t)) {
    const rgb = hexToRgb(t.startsWith('#') ? t : '#' + t);
    return rgbToOklch(...rgb);
  }

  // oklch(l c h)
  const m = t.match(/oklch\(\s*([\d.]+%?)\s+([\d.]+)\s+([\d.]+)\s*\)/i);
  if (m) {
    const l = m[1].endsWith('%') ? parseFloat(m[1]) / 100 : parseFloat(m[1]);
    return { l, c: parseFloat(m[2]), h: parseFloat(m[3]) };
  }

  return null;
}

// ─── Color generation ─────────────────────────────────────────────────────────

export function generateColor(
  seed: number,
  lSeed: number,
  cSeed: number,
  tones?: OklchColor[],
  isSecondary = false,
  baseHue?: number,
): OklchColor {
  let h: number, l: number, c: number;

  if (tones && tones.length > 0) {
    const ti = Math.floor(seed * tones.length) % tones.length;
    const tone = tones[ti];
    h = (tone.h + (seed * 2 - 1) * 30 + 360) % 360;
    l = isSecondary ? 0.22 + lSeed * 0.18 : 0.52 + lSeed * 0.22;
    c = isSecondary
      ? Math.max(tone.c * 0.5, 0.06) + cSeed * 0.08
      : Math.max(tone.c * 0.8, 0.14) + cSeed * 0.10;
  } else {
    // Monotone by default: single hue from hash, only L/C vary (baseHue from hashToColors)
    const hue = baseHue ?? seed * 360;
    h = (hue + 360) % 360;
    if (isSecondary) {
      l = 0.18 + cSeed * 0.20;
      c = 0.08 + lSeed * 0.12;
    } else {
      l = 0.55 + lSeed * 0.22;
      c = 0.18 + cSeed * 0.18;
    }
  }

  return { l, c: Math.min(c, 0.37), h };
}

