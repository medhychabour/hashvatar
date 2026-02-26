import { defineConfig } from 'tsup';

export default defineConfig([
  // Core (no React)
  {
    entry: { index: 'src/index.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    external: ['react'],
  },
  // React wrapper (separate chunk)
  {
    entry: { react: 'src/react.tsx' },
    format: ['esm', 'cjs'],
    dts: true,
    external: ['react', './index'],
  },
]);
