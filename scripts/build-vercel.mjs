import { build } from 'esbuild';

// Vercel traces a small JavaScript entry point into this complete CommonJS bundle.
// This prevents extensionless TypeScript imports from reaching the Node ESM loader.
await build({
  entryPoints: ['server/vercel-entry.ts'],
  outfile: 'server/vercel-handler.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  legalComments: 'none',
});
console.log('Bundled Vercel API dependencies successfully');
