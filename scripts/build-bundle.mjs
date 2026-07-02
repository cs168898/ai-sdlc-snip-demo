#!/usr/bin/env node
/**
 * scripts/build-bundle.mjs
 *
 * Assembles the "bundle" branch — the self-contained release artefact that
 * combines the Bun backend, the pre-built Angular frontend, and the CLI into a
 * single folder that can be run with `bun start` or deployed to Railway/Docker.
 *
 * Usage:
 *   node scripts/build-bundle.mjs           # assemble + commit (no push)
 *   node scripts/build-bundle.mjs --push    # assemble + commit + push
 *
 * Safe to run repeatedly: every commit step checks for staged changes first and
 * skips the commit (and push) when nothing has changed.
 *
 * Zero npm dependencies — uses only Node.js built-ins.
 * Works on Windows, macOS, Linux, and in CI.
 */

import { execSync, spawnSync } from 'child_process';
import {
  existsSync, copyFileSync, mkdirSync,
  writeFileSync, rmSync, readdirSync,
} from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── paths ────────────────────────────────────────────────────────────────────

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT     = join(__dirname, '..');
const BACKEND  = join(ROOT, 'backend');
const FRONTEND = join(ROOT, 'frontend');
const CLI      = join(ROOT, 'cli');
const BUNDLE   = join(ROOT, 'bundle');
const BROWSER  = join(FRONTEND, 'dist', 'snip-frontend', 'browser');
const PUSH     = process.argv.includes('--push');

// ── helpers ──────────────────────────────────────────────────────────────────

function run(cmd, cwd = ROOT) {
  const rel = cwd === ROOT ? '.' : cwd.replace(ROOT + '/', '').replace(ROOT + '\\', '');
  console.log(`\n  $ ${cmd}  [${rel}]`);
  execSync(cmd, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, CI: 'true' },   // suppress interactive prompts in CI
  });
}

/** true when the index has staged changes vs HEAD (or vs empty tree on new repo). */
function hasStagedChanges(cwd) {
  // diff-index with HEAD fails on a repo that has no commits yet; use diff --cached
  return spawnSync('git', ['diff', '--cached', '--quiet'], { cwd }).status !== 0;
}

function write(filePath, content) {
  writeFileSync(filePath, content, 'utf8');
  console.log(`  wrote  ${filePath.replace(ROOT, '.').replace(/\\/g, '/')}`);
}

/** Portable recursive directory copy (avoids fs.cpSync experimental status). */
function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, entry.name);
    const d = join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else copyFileSync(s, d);
  }
}

// ── 1. Update source submodules to their remote branch tips ──────────────────

console.log('\n[1/5] Updating backend / frontend / cli submodules...');
run('git submodule update --init --remote backend frontend cli');

// ── 2. Build the Angular frontend ─────────────────────────────────────────────

console.log('\n[2/5] Building Angular frontend...');
run('npm install', FRONTEND);
run('npx ng build', FRONTEND);

if (!existsSync(join(BROWSER, 'index.html'))) {
  console.error(
    '\nERROR: frontend/dist/snip-frontend/browser/index.html not found — build failed.',
  );
  process.exit(1);
}
console.log('  \u2713 frontend build verified');

// ── 3. Assemble bundle/ ───────────────────────────────────────────────────────

console.log('\n[3/5] Assembling bundle/...');

// Source files — copied verbatim
copyFileSync(join(BACKEND, 'server.js'), join(BUNDLE, 'server.js'));
copyFileSync(join(CLI,     'cli.js'),    join(BUNDLE, 'cli.js'));

// Pre-built SPA → bundle/public/
const PUBLIC = join(BUNDLE, 'public');
if (existsSync(PUBLIC)) rmSync(PUBLIC, { recursive: true, force: true });
copyDir(BROWSER, PUBLIC);

// .env — Bun auto-loads this at startup; flips server into "serve UI" mode
write(join(BUNDLE, '.env'), 'PUBLIC_DIR=./public\n');

// package.json — intentionally NO "type":"module" so cli.js runs under plain node
write(join(BUNDLE, 'package.json'), JSON.stringify({
  name: 'snip-bundle',
  version: '1.0.0',
  description: 'Snip — self-contained release bundle (backend + frontend + cli)',
  scripts: { start: 'bun server.js' },
}, null, 2) + '\n');

// Dockerfile
write(join(BUNDLE, 'Dockerfile'), [
  'FROM oven/bun:1-alpine',
  'WORKDIR /app',
  'COPY . .',
  'ENV PORT=3000',
  'EXPOSE 3000',
  'CMD bun server.js',
  '',
].join('\n'));

// .dockerignore
write(join(BUNDLE, '.dockerignore'), [
  'node_modules',
  '.git',
  '*.md',
  '',
].join('\n'));

// railway.json — tells Railway to use the Dockerfile builder
write(join(BUNDLE, 'railway.json'), JSON.stringify({
  build:  { builder: 'DOCKERFILE', dockerfilePath: './Dockerfile' },
  deploy: { startCommand: 'bun server.js', restartPolicyType: 'ON_FAILURE' },
}, null, 2) + '\n');

// ── 4. Commit inside bundle/ ──────────────────────────────────────────────────
//
// Submodule checkouts are typically in detached-HEAD state.
// We push with HEAD:bundle so this works regardless of branch state.

console.log('\n[4/5] Committing bundle/...');
run('git add .', BUNDLE);

if (hasStagedChanges(BUNDLE)) {
  run('git commit -m "chore: bundle release"', BUNDLE);
  if (PUSH) {
    run('git push origin HEAD:bundle', BUNDLE);
    console.log('  \u2713 pushed bundle branch');
  } else {
    console.log('  (skipping push — rerun with --push to publish)');
  }
} else {
  console.log('  nothing to commit in bundle/');
}

// ── 5. Bump superproject submodule pointers ───────────────────────────────────

console.log('\n[5/5] Bumping superproject pointers...');
run('git add backend frontend cli bundle');

if (hasStagedChanges(ROOT)) {
  run('git commit -m "chore: bump submodules (bundle release)"');
  if (PUSH) {
    run('git push');
    console.log('  \u2713 pushed main');
  } else {
    console.log('  (skipping push — rerun with --push to publish)');
  }
} else {
  console.log('  nothing to commit in superproject');
}

console.log('\nDone. \u2713');
