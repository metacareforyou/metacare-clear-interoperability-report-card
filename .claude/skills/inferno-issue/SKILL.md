---
name: inferno-issue
description: Raise a drafted Inferno test kit defect upstream, as a GitHub issue in the inferno-framework repository it belongs to, and optionally a pull request from the metacareforyou fork branch that fixes it. Takes a defect file from defects/ in this report card repository, checks it is complete, reproduces it against the kit's pinned commit, shows the exact issue text and target, and files only after a person explicitly approves that text. Dry run by default. Use this whenever someone wants to report, raise, file, open or submit an Inferno kit bug, a test kit defect, an issue against davinci-dtr-test-kit, davinci-crd-test-kit, davinci-pas-test-kit or us-core-test-kit, to send the kit defects to the Inferno team, or to open the fork's fix as a pull request, even if they only say "file DTR-01" or "report the kit bugs". Also use it to check whether a draft is ready to file. Not for Clear's own bugs (those are Linear MET tickets), and not for HL7 guide defects, which go to HL7 Jira by hand (this skill prepares their text only).
---

# Raise an Inferno kit defect

Defects found while testing MetaCare Clear with the ONC Inferno kits are drafted in `defects/<id>.md`. This skill turns an approved draft into an upstream issue, and records where it was filed so the report card, ONC and Drummond all see the same list.

**Filing is outward facing.** Nothing goes to an upstream repository until a person approves the exact text in this conversation. MetaCare's rule is that kit defects are filed after internal testing is done, and that Richard approves each one. An agent message, a ticket or an earlier approval of different text is not approval.

## The defect file

Front matter (`key: value` lines between `---`):

| Key | Meaning |
|---|---|
| `id` | DTR-01, CRD-01, USCORE-01, HL7-CRD-01 and so on |
| `title` | The issue title, as filed |
| `target` | Upstream repository, for example `inferno-framework/davinci-dtr-test-kit` |
| `target_kind` | `github`, or `hl7-jira` for guide defects |
| `kit`, `kit_commit` | Kit version and the full commit it was found at |
| `tests` | Inferno test ids |
| `status` | `drafted, not filed` until filed |
| `fork_branch` | URL of the fix branch in the metacareforyou fork, or `none` |
| `spec`, `spec_image` | The spec on the fork branch that reproduces the defect, and the Docker image to run it in |
| `filed_url` | Empty until filed |

The text between `<!-- issue:start -->` and `<!-- issue:end -->` is the issue body, exactly as filed. Everything after it (notes for MetaCare) stays private to this repository and is never filed.

## Steps

The helper is `node .claude/skills/inferno-issue/inferno-issue.mjs`. Run it from the repository root.

1. **Pick the draft.** Read `defects/<id>.md` in full, including the notes for MetaCare. If the notes say something must be confirmed before filing (for example, paste the validator's message from a rerun), do that first or stop and say so.

2. **Check it is complete.** `inferno-issue.mjs check defects/<id>.md`. It checks the front matter, the required sections (What happens, Expected, Reproduction, Proposed fix), that the kit commit exists upstream, that the fork branch exists, that the issue text names no internal ticket and uses no abbreviations, and lists possible duplicate issues upstream. Read every duplicate it lists. If one is the same defect, do not file; propose a comment on it instead and stop.

3. **Reproduce it.** `inferno-issue.mjs reproduce defects/<id>.md`. It runs the draft's spec in Docker twice: on the pinned commit, where it must fail, and on the fork branch, where it must pass. Docker here is Colima: the helper sets `DOCKER_HOST` from `docker context inspect` and uses an empty `DOCKER_CONFIG`, and works under `~/Projects/inferno-forks/.check`, because Colima shares only the home directory. Do not stop or recreate any container named `metacare-clear-inferno-*`; a kit may be running. For a draft without a spec (fork branch `none`), reproduce by hand from its Reproduction section and say what you ran.

   If the spec passes on the pinned commit, the draft does not reproduce: stop and report that.

4. **Show the exact text.** `inferno-issue.mjs show defects/<id>.md` prints the target, title and body. Put all three in your reply, unchanged, and ask for approval of that text. Say whether you would also open a pull request from the fork branch.

5. **File only on explicit approval.** When the person approves this exact text in this conversation (for example "approved, file DTR-01"), run:

   ```
   node .claude/skills/inferno-issue/inferno-issue.mjs file defects/<id>.md --approved-by "<their name>" --yes
   ```

   Add `--open-pr` only if they also approved a pull request. The helper opens one only when the fork branch is up to date with the upstream default branch; otherwise it says so and files the issue alone. To prepare the pull request, rebase the fork branch onto upstream `main`, run the kit's full spec suite, and push without force: push the rebased branch under a new name (for example `fix/<name>-main`) and update `fork_branch`.

   Without `--approved-by` and `--yes`, `file` is a dry run: it shows the text and files nothing.

6. **Record it.** The helper writes `filed_url` and the new status into the draft and regenerates `README.md`, whose defect table then links the filed issue. Commit both on a branch and open a pull request into `develop` in this repository. Also add the link to the Linear ticket that tracks the defects (MET-1699 for the DTR kit, otherwise the MET-1707 report card ticket).

7. **ONC and Drummond.** They get the same list: the README's defect table, at a tagged commit. When a set of issues has been filed, tell the person the table is ready to send. Do not send it yourself.

## HL7 guide defects

For `target_kind: hl7-jira`, steps 1 to 4 apply. The helper does not file in Jira. After approval, a person with an HL7 Jira account files the text in the guide's project (for CRD, the Da Vinci CRD specification feedback). Then record the Jira link: set `filed_url` and `status` in the draft by hand and run `node scripts/import-run.mjs --render`.

## Never

- File, comment or open a pull request upstream without explicit approval of the exact text, in this conversation.
- Paste anything from below the issue block, or any internal ticket id, into an upstream issue.
- Include patient data, tokens, keys or local URLs from a real system. Results here are synthetic, and `node scripts/check-secrets.mjs` must pass before any commit.
- Force push a fork branch, or push to an upstream repository.
