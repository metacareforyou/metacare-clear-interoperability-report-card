#!/usr/bin/env node
// Import one Inferno run into the report card, then regenerate the README tables.
//
//   node scripts/import-run.mjs --kit dtr --from <dir with results.json and summary.json> \
//     --branch <Clear branch> --commit <Clear commit> [--pr 79] [--pr 78] [--note "text"] [--date YYYY-MM-DD]
//   node scripts/import-run.mjs --render     (regenerate the README from results/ only)
//
// The run is copied to results/<kit>/<date>/ (results.json, summary.json, run.json), scrubbed of
// credentials and local addresses, and scanned again. The import stops, and writes nothing, if
// anything that looks like a secret survives the scrub.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scrubValue, findSecrets } from './lib/scrub.mjs';
import { renderReadme } from './lib/render.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const KITS = JSON.parse(readFileSync(join(root, 'kits.json'), 'utf8')).kits;

function parseArgs(argv) {
  const args = { pr: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === '--render') args.render = true;
    else if (flag === '--replace') args.replace = true;
    else if (flag === '--pr') args.pr.push(Number(argv[++i]));
    else if (flag.startsWith('--')) args[flag.slice(2)] = argv[++i];
    else throw new Error(`Unknown argument ${flag}`);
  }
  return args;
}

function fail(message) {
  console.error(`import-run: ${message}`);
  process.exit(1);
}

function importRun(args) {
  const kit = KITS[args.kit];
  if (!kit) fail(`--kit must be one of ${Object.keys(KITS).join(', ')}`);
  if (!args.from) fail('--from is required');
  if (!args.branch || !args.commit) fail('--branch and --commit are required: say what was tested');

  const summary = JSON.parse(readFileSync(join(args.from, 'summary.json'), 'utf8'));
  const results = JSON.parse(readFileSync(join(args.from, 'results.json'), 'utf8'));
  if (summary.kit !== args.kit) fail(`summary.json is for kit ${summary.kit}, not ${args.kit}`);
  if (summary.kitCommit !== kit.commit) {
    fail(`run used kit commit ${summary.kitCommit}; kits.json pins ${kit.commit}. Update kits.json first.`);
  }
  if (summary.synthetic !== true) fail('summary.json does not say the run used synthetic data only');

  const date = args.date || summary.generatedAt.slice(0, 10);
  const dir = join(root, 'results', args.kit, date);
  if (existsSync(dir) && !args.replace) fail(`${dir} exists; pass --replace to overwrite it`);

  const run = {
    kit: args.kit,
    date,
    generatedAt: summary.generatedAt,
    clear: {
      repository: 'https://github.com/metacareforyou/metacare-clear',
      branch: args.branch,
      commit: args.commit,
      pullRequests: args.pr.filter(Boolean),
      note: args.note || null
    },
    importedAt: new Date().toISOString(),
    synthetic: true
  };

  const files = {
    'summary.json': scrubValue(summary),
    'results.json': scrubValue(results),
    'run.json': scrubValue(run)
  };
  const findings = [];
  for (const [name, value] of Object.entries(files)) {
    for (const finding of findSecrets(JSON.stringify(value))) findings.push({ file: name, ...finding });
  }
  if (findings.length) {
    for (const f of findings) console.error(`  ${f.file}: ${f.name}: ${f.sample}`);
    fail(`${findings.length} possible secret(s) left after scrubbing; nothing was written`);
  }

  mkdirSync(dir, { recursive: true });
  for (const [name, value] of Object.entries(files)) {
    writeFileSync(join(dir, name), `${JSON.stringify(value, null, 1)}\n`);
  }
  console.log(`imported ${args.kit} ${date} into ${dir}`);
}

const args = parseArgs(process.argv.slice(2));
if (!args.render) importRun(args);
renderReadme(root);
console.log('README.md regenerated');
