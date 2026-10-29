import { build } from 'esbuild'

await build({
  entryPoints: ['src/index.ts', 'src/tui.ts', 'src/suggestion.ts', 'src/llm.ts'],
  outdir: 'lib',
  bundle: true,
  packages: 'external',
  platform: 'neutral',
  format: 'esm',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'info',
})

await build({
  entryPoints: ['src/client.tsx'],
  outfile: 'lib/client.js',
  bundle: true,
  packages: 'external',
  platform: 'browser',
  format: 'cjs',
  target: 'es2022',
  sourcemap: true,
  logLevel: 'info',
  banner: {
    js: 'window.__ModuleLoader__.load({\n\tid: "@uremysunshine/dsh-next-sentence",\n\tfactory: (require) => {\n\t\tvar module = { exports: {} };\n\t\tvar exports = module.exports;',
  },
  footer: {
    js: '\n\t\treturn module.exports;\n\t}\n})',
  },
})
