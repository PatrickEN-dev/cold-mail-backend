import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.module.ts', 'src/**/*.dto.ts', 'src/main.ts'],
    },
    environment: 'node',
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: {
    alias: {
      '@': '/src',
      '@modules': '/src/modules',
      '@infra': '/src/infra',
      '@shared': '/src/shared',
    },
  },
});
