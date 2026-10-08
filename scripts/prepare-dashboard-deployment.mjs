import { build } from 'esbuild';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';

// Maintainer helper: end users deploy the generated files through their browser.
const output = 'supabase/dashboard-deploy';
await mkdir(output, { recursive: true });
const config = JSON.parse(await readFile('supabase/functions/deno.json', 'utf8'));
for (const name of ['vocabulary', 'review', 'reverse-search', 'ai', 'notifications']) {
  await build({
    entryPoints: [`./supabase/functions/${name}/index.ts`],
    outfile: `${output}/${name}.ts`,
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
    tsconfigRaw: { compilerOptions: {} },
    banner: { js: '// @ts-nocheck\n// Generated JavaScript from checked TypeScript. Paste all of this into the Dashboard index.ts.' },
    plugins: [{
      name: 'deno-dependencies',
      setup(builder) {
        builder.onResolve({ filter: /^[^./]/ }, ({ path }) => {
          const mapped = config.imports[path];
          if (!mapped) throw new Error(`Unmapped dependency: ${path}`);
          return { path: mapped, external: true };
        });
      },
    }],
  });
}
const migrations = (await readdir('supabase/migrations')).filter(name => name.endsWith('.sql')).sort();
const statements = await Promise.all(migrations.map(async name => `-- ${name}\n${await readFile(`supabase/migrations/${name}`, 'utf8')}`));
await writeFile(`${output}/setup.sql`, `-- Fresh projects only. Run once as postgres in the Supabase SQL Editor.\n-- Includes all migrations in order, in one transaction.\nbegin;\n${statements.join('\n\n')}\ncommit;\n`);
await writeFile(`${output}/gemini-upgrade.sql`, `-- Existing Lexi projects: run this in the Supabase SQL Editor before deploying Gemini functions.\nbegin;\n${await readFile('supabase/migrations/202610080005_embedding_models.sql', 'utf8')}\ncommit;\n`);
console.log('Prepared dashboard SQL and five single-file functions. No cloud changes made.');
