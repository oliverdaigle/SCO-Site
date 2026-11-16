import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@lotwise/engine': path.resolve(__dirname, 'packages/engine/src/index.ts'), '@': path.resolve(__dirname, 'src') } },
  test: { include: ['packages/**/test/**/*.test.ts', 'tests/unit/**/*.test.ts'], testTimeout: 60000 },
});
