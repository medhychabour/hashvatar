# hashvatar

Deterministic avatars from any string — wallet address, username, UUID. **Zero dependencies**.

Two modes: **gradient** (radial blends) and **dither** (Bayer halftone + linear gradient).

```bash
npm install hashvatar
```

---

## Demo

From the repo root:

```bash
npm run demo
```

Then open **http://localhost:5000/demo/** in your browser.

---

## Usage

### Vanilla JS

```js
import { createHashvatar } from "hashvatar";

const { canvas, destroy } = createHashvatar({
	hash: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
	size: 64,
});

document.body.appendChild(canvas);

// Stop animation later if animated:
destroy();
```

### React

```tsx
import { Hashvatar } from 'hashvatar/react';

<Hashvatar hash="vitalik.eth" size={48} />
<Hashvatar hash="satoshi" size={64} mode="dither" />
<Hashvatar hash="0x742…44e" size={64} animated tones={['hotpink', '#00ff99']} />
```

React is an optional peer dependency — only install it if you use `hashvatar/react`.

---

## Options

| Option     | Type                     | Default      | Description                                                           |
| ---------- | ------------------------ | ------------ | --------------------------------------------------------------------- |
| `hash`     | `string`                 | —            | Any string. Same string = same avatar.                                |
| `size`     | `number`                 | `64`         | Canvas size in px (square).                                           |
| `mode`     | `'gradient' \| 'dither'` | `'gradient'` | Render style.                                                         |
| `animated` | `boolean`                | `false`      | Animation loop.                                                       |
| `dotScale` | `number`                 | —            | Dither cell size. If omitted, scales with canvas for consistent look. |
| `tones`    | `string[]`               | —            | Restrict palette (hex, `oklch()`, CSS color names).                   |

**`createHashvatar(options)`** — returns `{ canvas, colors, destroy }`.

**`renderHashvatar(canvas, options)`** — draws into an existing canvas; returns `destroy()`.

**`hashToColors(hash, tones?, count?)`** — returns the generated OKLCH colors without rendering.

**`hashToSeeds(hash, count)`** — returns `count` deterministic numbers in `[0, 1)` from the hash (for custom rendering or seeding).

---

## Circle / clipping

The canvas is **square**. To show a circle:

```css
canvas {
	border-radius: 50%;
}
```

The React component already uses `border-radius: 50%` by default. You can also use a rounded square, hexagon via `clip-path`, etc.

---

## Tone constraints

```js
// Single hue family
createHashvatar({ hash, tones: ["hotpink"] });

// Multiple
createHashvatar({ hash, tones: ["#ff6b6b", "#4ecdc4"] });

// oklch
createHashvatar({ hash, tones: ["oklch(0.65 0.25 310)"] });
```

---

## Development

```bash
npm install
npm run build    # ESM + CJS + types (tsup)
npm run dev      # watch & rebuild
npm run demo     # serve on port 5000
```

---

## Publish

```bash
npm run build
npm publish
```

---

MIT — [Médhy](https://github.com/medhchabour) · [repo](https://github.com/medhychabour/hashvatar)
