import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { server: 'src/main.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: false,
  // tsup elimina el prefijo node: por defecto; node:sqlite lo necesita.
  removeNodeProtocol: false,
  noExternal: [/^@qabase\//],
})
