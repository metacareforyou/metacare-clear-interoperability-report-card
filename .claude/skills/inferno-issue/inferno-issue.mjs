#!/usr/bin/env node
// Helper for the inferno-issue skill. Dry run unless "file" is given with --approved-by and --yes.
//
//   node .claude/skills/inferno-issue/inferno-issue.mjs check defects/DTR-01.md
//   node .claude/skills/inferno-issue/inferno-issue.mjs reproduce defects/DTR-01.md
//   node .claude/skills/inferno-issue/inferno-issue.mjs show defects/DTR-01.md
//   node .claude/skills/inferno-issue/inferno-issue.mjs file defects/DTR-01.md --approved-by "Name" --yes [--open-pr]
//
// check      completeness of the draft, the pinned commit upstream, the fork branch, likely duplicates
// reproduce  runs the draft's spec in Docker: it must fail on the pinned commit and pass on the fork branch
// show       prints the exact target, title and body that "file" would send
// file       files the issue with gh, records the URL in the draft, regenerates the README

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const FORK_OWNER = 'metacareforyou';
// Docker on this Mac is Colima, which only shares the home directory with the VM.
const WORK = join(homedir(), 'Projects', 'inferno-forks', '.check');

const REQUIRED_META = ['id', 'title', 'target', 'target_kind', 'kit', 'kit_commit', 'tests', 'status', 'fork_branch', 'spec'];
const REQUIRED_SECTIONS = ['### What happens', '### Expected', '### Reproduction', '### Proposed fix'];
const UPSTREAM_OWNERS = ['inferno-framework', 'onc-healthit'];

function die(message) {
  console.error(`inferno-issue: ${message}`);
  process.exit(1);
}

function gh(args, { allowFail = false } = {}) {
  const result = spawnSync('gh', args, { encoding: 'utf8' });
  if (result.status !== 0 && !allowFail) die(`gh ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.status === 0 ? result.stdout : null;
}

export function parseDefect(path) {
  const text = readFileSync(path, 'utf8');
  const fm = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) die(`${path}: no front matter`);
  const meta = {};
  for (const line of fm[1].split('\n')) {
    const at = line.indexOf(':');
    if (at > 0) meta[line.slice(0, at).trim()] = line.slice(at + 1).trim();
  }
  const body = text.match(/<!-- issue:start -->\n([\s\S]*?)\n<!-- issue:end -->/);
  return { text, meta, body: body ? body[1].trim() : null };
}

function forkBranch(meta) {
  const m = meta.fork_branch.match(/github\.com\/([^/]+)\/([^/]+)\/tree\/(.+)$/);
  return m ? { owner: m[1], repo: m[2], branch: m[3] } : null;
}

function check(path) {
  const { meta, body } = parseDefect(path);
  const problems = [];
  const notes = [];
  for (const key of REQUIRED_META) if (!meta[key]) problems.push(`front matter is missing "${key}"`);
  if (!body) problems.push('no <!-- issue:start --> ... <!-- issue:end --> block');
  for (const section of REQUIRED_SECTIONS) if (body && !body.includes(section)) problems.push(`issue text has no "${section}" section`);
  if (body && !/\bcommit `?[0-9a-f]{7,40}`?/.test(body) && meta.target_kind === 'github') problems.push('issue text does not name the kit commit');
  if (body && /\b(MET|BUS)-\d+\b/.test(body)) problems.push('issue text names an internal MetaCare ticket; keep those in the notes below the issue block');
  if (body && /\b(e\.g\.|i\.e\.|etc\.)/.test(body)) problems.push('issue text uses an abbreviation (e.g., i.e., etc.)');
  if (meta.filed_url) problems.push(`already filed: ${meta.filed_url}`);

  if (meta.target_kind === 'github') {
    const [owner] = meta.target.split('/');
    if (!UPSTREAM_OWNERS.includes(owner)) notes.push(`target owner ${owner} is not a known Inferno owner; check the target`);
    if (meta.kit_commit && !gh(['api', `repos/${meta.target}/commits/${meta.kit_commit}`, '--jq', '.sha'], { allowFail: true })) {
      problems.push(`commit ${meta.kit_commit} not found in ${meta.target}`);
    }
    const fork = meta.fork_branch && meta.fork_branch !== 'none' ? forkBranch(meta) : null;
    if (meta.fork_branch && meta.fork_branch !== 'none') {
      if (!fork) problems.push('fork_branch is not a github.com/<owner>/<repo>/tree/<branch> URL');
      else if (!gh(['api', `repos/${fork.owner}/${fork.repo}/branches/${fork.branch}`, '--jq', '.commit.sha'], { allowFail: true })) {
        problems.push(`fork branch ${fork.branch} not found in ${fork.owner}/${fork.repo}`);
      } else {
        const sha = gh(['api', `repos/${fork.owner}/${fork.repo}/branches/${fork.branch}`, '--jq', '.commit.sha']).trim();
        notes.push(`fork branch ${fork.owner}/${fork.repo}:${fork.branch} at ${sha.slice(0, 7)}`);
      }
    }
    const words = meta.title.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 4).slice(0, 5).join(' ');
    const dupes = gh(['issue', 'list', '-R', meta.target, '--state', 'all', '--limit', '5', '--search', words,
      '--json', 'number,title,state,url', '--jq', '.[] | "#\\(.number) \\(.state) \\(.title) \\(.url)"'], { allowFail: true });
    if (dupes && dupes.trim()) notes.push(`possible duplicates upstream (read before filing):\n${dupes.trim().split('\n').map((l) => `    ${l}`).join('\n')}`);
  } else if (meta.target_kind === 'hl7-jira') {
    notes.push('target is HL7 Jira: this helper does not file there; a person with an HL7 Jira account files the issue text');
  } else {
    problems.push(`unknown target_kind "${meta.target_kind}"`);
  }

  console.log(`${meta.id}: ${meta.title}`);
  for (const n of notes) console.log(`  note: ${n}`);
  for (const p of problems) console.log(`  PROBLEM: ${p}`);
  console.log(problems.length ? `  not ready (${problems.length} problem(s))` : '  complete');
  return problems.length === 0;
}

function dockerEnv() {
  const host = execFileSync('docker', ['context', 'inspect', '--format', '{{.Endpoints.docker.Host}}'], { encoding: 'utf8' }).trim();
  const config = join(WORK, '.docker-config');
  mkdirSync(config, { recursive: true });
  return { ...process.env, DOCKER_HOST: host, DOCKER_CONFIG: config };
}

function rspec(dir, image, spec, env) {
  const install = image.includes('bundle install') ? 'bundle install --quiet && ' : '';
  const result = spawnSync('docker', ['run', '--rm', '--memory', '2g', '--cpus', '1', '-e', 'APP_ENV=test',
    '-v', `${dir}:/work`, '-w', '/work', '--entrypoint', 'sh', image.split(' ')[0],
    '-c', `git config --global --add safe.directory /work; ${install}bundle exec rspec ${spec}`], { encoding: 'utf8', env });
  const summary = (result.stdout.match(/\d+ examples?, \d+ failures?/) || ['no summary'])[0];
  return { ok: result.status === 0, summary };
}

function reproduce(path) {
  const { meta } = parseDefect(path);
  if (meta.target_kind !== 'github' || !meta.spec || meta.spec === 'none' || meta.fork_branch === 'none') {
    console.log(`${meta.id}: no fork spec to run. Reproduce by hand as the draft says${meta.spec && meta.spec !== 'none' ? ` (${meta.spec})` : ''}.`);
    return true;
  }
  const fork = forkBranch(meta);
  const clone = join(WORK, `${fork.repo}-reproduce`);
  if (!existsSync(clone)) execFileSync('git', ['clone', '-q', `https://github.com/${fork.owner}/${fork.repo}.git`, clone]);
  execFileSync('git', ['-C', clone, 'fetch', '-q', 'origin']);
  const env = dockerEnv();

  execFileSync('git', ['-C', clone, 'checkout', '-q', '--detach', meta.kit_commit]);
  const specOnBranch = execFileSync('git', ['-C', clone, 'show', `origin/${fork.branch}:${meta.spec}`]);
  mkdirSync(dirname(join(clone, meta.spec)), { recursive: true });
  writeFileSync(join(clone, meta.spec), specOnBranch);
  const before = rspec(clone, meta.spec_image, meta.spec, env);
  execFileSync('git', ['-C', clone, 'checkout', '-q', '--', '.']);
  execFileSync('git', ['-C', clone, 'clean', '-qfd']);

  execFileSync('git', ['-C', clone, 'checkout', '-q', '--detach', `origin/${fork.branch}`]);
  const after = rspec(clone, meta.spec_image, meta.spec, env);

  console.log(`${meta.id}: spec on pinned commit ${meta.kit_commit.slice(0, 7)}: ${before.summary} (${before.ok ? 'PASSED, so it does not reproduce' : 'fails, reproduces'})`);
  console.log(`${meta.id}: spec on ${fork.branch}: ${after.summary} (${after.ok ? 'passes' : 'FAILS'})`);
  return !before.ok && after.ok;
}

function show(path) {
  const { meta, body } = parseDefect(path);
  console.log(`Target:  ${meta.target} (${meta.target_kind})`);
  console.log(`Title:   ${meta.title}`);
  if (meta.fork_branch && meta.fork_branch !== 'none') console.log(`Fork:    ${meta.fork_branch}`);
  console.log('Body:');
  console.log('-----');
  console.log(body);
  console.log('-----');
}

function recordFiled(path, url, approvedBy, prUrl) {
  const date = new Date().toISOString().slice(0, 10);
  let text = readFileSync(path, 'utf8');
  text = text.replace(/^status: .*$/m, `status: filed ${date}, approved by ${approvedBy}`);
  text = text.replace(/^filed_url:.*$/m, `filed_url: ${url}`);
  if (prUrl) text = text.replace(/^filed_url: .*$/m, (line) => `${line}\npull_request_url: ${prUrl}`);
  writeFileSync(path, text);
}

function file(path, flags) {
  const { meta, body } = parseDefect(path);
  if (!flags.approvedBy || !flags.yes) {
    show(path);
    console.log('\nDry run. Nothing was filed. To file, a person must approve this exact text, then run:');
    console.log(`  node .claude/skills/inferno-issue/inferno-issue.mjs file ${path} --approved-by "<name>" --yes${flags.openPr ? ' --open-pr' : ''}`);
    return;
  }
  if (meta.target_kind !== 'github') die('only GitHub targets are filed by this helper');
  if (!check(path)) die('the draft is not complete; fix the problems above first');

  const bodyFile = join(WORK, `${meta.id}-issue.md`);
  mkdirSync(WORK, { recursive: true });
  writeFileSync(bodyFile, `${body}\n`);
  const url = gh(['issue', 'create', '-R', meta.target, '--title', meta.title, '--body-file', bodyFile]).trim();
  console.log(`filed ${url}`);

  let prUrl = null;
  if (flags.openPr) {
    const fork = forkBranch(meta);
    const base = gh(['api', `repos/${meta.target}`, '--jq', '.default_branch']).trim();
    const behind = gh(['api', `repos/${meta.target}/compare/${base}...${fork.owner}:${fork.branch}`, '--jq', '.behind_by']).trim();
    if (behind !== '0') {
      console.log(`not opening a pull request: ${fork.branch} is ${behind} commit(s) behind ${meta.target} ${base}. Rebase it onto ${base}, rerun the kit's tests, push, then open the pull request.`);
    } else {
      prUrl = gh(['pr', 'create', '-R', meta.target, '--base', base, '--head', `${fork.owner}:${fork.branch}`,
        '--title', meta.title, '--body', `Fixes ${url}\n\n${body}`]).trim();
      console.log(`opened ${prUrl}`);
    }
  }
  recordFiled(path, url, flags.approvedBy, prUrl);
  execFileSync('node', [join(root, 'scripts', 'import-run.mjs'), '--render'], { stdio: 'inherit' });
  console.log(`recorded ${url} in ${path} and README.md; commit both on a branch and open a pull request into develop`);
}

const [command, target, ...rest] = process.argv.slice(2);
if (!command || !target) die('usage: inferno-issue.mjs check|reproduce|show|file <defect file> [--approved-by "Name" --yes] [--open-pr]');
const path = resolve(root, target);
if (!existsSync(path)) die(`${target} not found`);
const flags = {
  approvedBy: rest.includes('--approved-by') ? rest[rest.indexOf('--approved-by') + 1] : null,
  yes: rest.includes('--yes'),
  openPr: rest.includes('--open-pr')
};

if (command === 'check') process.exit(check(path) ? 0 : 1);
else if (command === 'reproduce') process.exit(reproduce(path) ? 0 : 1);
else if (command === 'show') show(path);
else if (command === 'file') file(path, flags);
else die(`unknown command ${command}`);
