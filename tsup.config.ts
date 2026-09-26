import { defineConfig } from 'tsup';

export default defineConfig({
  clean: true,
  dts: true,
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  noExternal: ['commander'],
  platform: 'node',
  splitting: false,
  target: 'node24',
  treeshake: true,
});
