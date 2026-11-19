import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = process.argv[2] || '/Mohammed-portfolio/';
if (!/^\/(?:[A-Za-z0-9._-]+\/)*$/.test(base)) {
  throw new Error('Pass a base path with leading and trailing slashes.');
}
const build = spawnSync('pnpm', ['--filter', '@workspace/devops-lab', 'run', 'build'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production', PORT: '4173', BASE_PATH: base },
});
if (build.status !== 0) process.exit(build.status || 1);

const output = path.join(root, 'artifacts/devops-lab/dist/public');
const html = await readFile(path.join(output, 'index.html'), 'utf8');
const registry = await readFile(path.join(root, 'artifacts/devops-lab/src/labs/registry.ts'), 'utf8');
const slugs = [...registry.matchAll(/^\s+slug: '([a-z0-9-]+)',/gm)].map((match) => match[1]);
if (slugs.length !== 15 || new Set(slugs).size !== 15) {
  throw new Error('Expected 15 unique lab routes; update the route export before publishing.');
}
// GitHub Pages has no SPA rewrites. Give each supported deep link a real file.
for (const route of ['about', 'game', ...slugs.map((slug) => `projects/${slug}`)]) {
  const dir = path.join(output, route);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'index.html'), html);
}
await writeFile(path.join(output, '404.html'), html);
await writeFile(path.join(output, '.nojekyll'), '');
if (!html.includes(`${base}assets/`)) throw new Error('Build assets do not use the requested Pages base path.');
console.log(`GitHub Pages build ready: ${output}; base ${base}; 15 lab routes plus home, about and game.`);
