#!/usr/bin/env node
// Scan every tracked text file for credentials, and results/ also for local addresses.
// Exit status 1 when anything is found. Run before every commit and in CI.
//
//   node scripts/check-secrets.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findSecrets } from './lib/scrub.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEXT = new Set(['.json', '.md', '.mjs', '.js', '.yml', '.yaml', '.txt', '.sh', '']);
const SKIP = new Set(['.git', 'node_modules']);
// This scanner and the scrubber name the patterns they look for.
const SELF = new Set(['scripts/lib/scrub.mjs', 'scripts/check-secrets.mjs', 'scripts/test/scrub.test.mjs']);

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (TEXT.has(extname(name))) yield path;
  }
}

let count = 0;
for (const path of walk(root)) {
  const rel = relative(root, path);
  if (SELF.has(rel)) continue;
  const findings = findSecrets(readFileSync(path, 'utf8'), { privateUrls: rel.startsWith('results/') });
  for (const f of findings) {
    count += 1;
    console.error(`${rel}: ${f.name}: ${f.sample}`);
  }
}
if (count) {
  console.error(`check-secrets: ${count} finding(s)`);
  process.exit(1);
}
console.log('check-secrets: no credentials or local addresses found');
