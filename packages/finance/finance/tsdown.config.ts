import { defineConfig } from 'tsdown'

/**
 * Build dsh-finance as a self-contained ESM bundle.
 * 入口 src/index.ts → lib/index.js，同时生成 .d.ts。
 * 外部依赖（cordis、typert-protocol、zod）保持 external，
 * 由宿主 dsh 工作区注入。
 */
export default defineConfig({
  entry: ['src/index.ts'],
  outDir: 'lib',
  format: ['esm'],
  platform: 'node',
  target: 'es2024',
  dts: true,
  clean: true,
  external: [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-typert-protocol',
    '@deepseek-ai/schemastery',
    'zod',
  ],
})
