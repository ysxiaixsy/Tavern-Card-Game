/**
 * Build the engine bundle the Edge Function ships: src/engine → a single
 * minified ESM file (line-wrapped for reviewable diffs) plus a copy of
 * types.ts for type-only imports. `npm run sync:engine` before deploying.
 * The outputs are committed so the deployed artifact is always inspectable.
 */

import { execSync } from 'node:child_process';
import { copyFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname ?? '.', '..');
const outDir = join(root, 'supabase', 'functions', 'gwent');

rmSync(join(outDir, 'engine'), { recursive: true, force: true }); // legacy tree copy
rmSync(join(outDir, 'engine.js'), { force: true });

execSync(
  'npx esbuild src/engine/index.ts --bundle --format=esm --minify --line-limit=160 ' +
    '--outfile=supabase/functions/gwent/engine.js',
  { cwd: root, stdio: 'inherit' },
);
copyFileSync(join(root, 'src', 'engine', 'types.ts'), join(outDir, 'types.ts'));
console.log('Engine bundled to supabase/functions/gwent/engine.js (+ types.ts)');
