---
id: PAS-01
title: PAS 2.2.1 request validation cannot pass DTR intendedUse, because CDex 2.1.0 pulls DTR 2.1.0 and CRD 2.1.0 in beside CRD 2.2.1
target: inferno-framework/davinci-pas-test-kit
also_report: HL7 Jira (Da Vinci PAS and CDex package dependencies)
target_kind: github
kit: davinci-pas-test-kit v0.16.0
kit_commit: 1db14e7899d0519138ed9ac72de8ad2c996c10ac
suite: davinci_pas_client_suite_v221
tests: request Bundle validation, for example 3.1.03 pas_client_v221_request_bundle_validation_test and 3.4.3.01 to 3.4.3.07
status: filed 2026-11-16, approved by Richard Braman
fork_branch: https://github.com/metacareforyou/davinci-pas-test-kit/tree/fix/v221-suppress-docreason-210-conflict
spec: spec/davinci_pas_test_kit/cross_suite/docreason_package_conflict_suppression_spec.rb
spec_image: metacare-inferno-pas:1db14e7
filed_url: https://github.com/inferno-framework/davinci-pas-test-kit/issues/116
found_in: results/pas/2026-11-15-2
---

# PAS-01: no intendedUse coding can pass PAS request Bundle validation

<!-- issue:start -->
**Kit:** davinci-pas-test-kit v0.16.0, commit `1db14e7`. Suite `davinci_pas_client_suite_v221`. The cause is in the HL7 package dependencies; the kit is where it shows.

**Tests:** the request Bundle validation tests, for example 3.1.03 `pas_client_v221_request_bundle_validation_test` and the claim update validation tests 3.4.3.01 to 3.4.3.07.

### What happens

A PAS request carries the DTR QuestionnaireResponse that supports it, claiming `dtr-questionnaireresponse|2.2.0`. That profile requires the `intendedUse` extension, bound (required) to CRD `DocReason|2.2.1`, whose codes are in `CodeSystem/coverage-information-codes`.

The kit's validator reports an error whatever coding the client sends. Same client and request, only the coding changed:

1. With only `coverage-information-codes` `withpa`:

   > None of the codings provided are in the value set 'CRD Coverage Information Documentation Reason Value Set' (http://hl7.org/fhir/us/davinci-crd/ValueSet/DocReason|2.1.0)

2. With that coding plus `CodeSystem/temp` `withpa`:

   > Unknown code 'withpa' in the CodeSystem 'http://hl7.org/fhir/us/davinci-crd/CodeSystem/temp' version '2.2.1'

The binding is checked against CRD 2.1.0's DocReason, which lists `CodeSystem/temp` codes. The code systems are resolved under CRD 2.2.1, where `CodeSystem/temp` no longer has `withpa`. No coding satisfies both.

### Cause

The published package dependencies put two CRD versions, and two DTR versions, in one validation context:

| Package | Depends on |
|---|---|
| `hl7.fhir.us.davinci-pas#2.2.1` | `davinci-crd#2.2.1`, `davinci-hrex#1.2.0`, `davinci-cdex#2.1.0` (no DTR) |
| `hl7.fhir.us.davinci-cdex#2.1.0` | `davinci-dtr#2.1.0`, `davinci-pas#2.1.0`, `davinci-hrex#1.1.0` |
| `hl7.fhir.us.davinci-dtr#2.1.0` | `davinci-crd#2.1.0`, `davinci-pas#2.1.0`, `davinci-hrex#1.1.0` |

So loading PAS 2.2.1 also loads DTR 2.1.0 and CRD 2.1.0, through CDex 2.1.0.

The QuestionnaireResponse's extension URL, `http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/intendedUse`, is unversioned, as extension URLs are. The validator resolves it to the DTR 2.1.0 definition, the only DTR in the context. That definition binds the unversioned `DocReason`, which resolves to CRD 2.1.0's value set. Codes are then looked up under CRD 2.2.1, the version PAS 2.2.1 depends on directly.

Loading DTR 2.2.0 as well does not help: we tried adding `hl7.fhir.us.davinci-dtr#2.2.0` to the kit's validator package list, and a kit run gave the same failure, because DTR 2.1.0 is still loaded and still answers the unversioned URL.

### Expected

A DTR 2.2.0 QuestionnaireResponse in a PAS 2.2.1 request is validated against DTR 2.2.0 and CRD 2.2.1, and `coverage-information-codes` `withpa` passes.

### Reproduction

1. Run `davinci_pas_client_suite_v221` and send a `$submit` whose Bundle includes a QuestionnaireResponse claiming `dtr-questionnaireresponse|2.2.0`, with `intendedUse` `coverage-information-codes` `withpa`.
2. 3.1.03 fails with the first message above.
3. Add `CodeSystem/temp` `withpa` as a second coding. 3.1.03 fails with the second message.
4. Inspect the package manifests (`package/package.json`) of the packages in the table to see the chain.

### Proposed fix

- **HL7:** publish PAS with a CDex dependency that does not pull DTR 2.1.0 and CRD 2.1.0, or align the CDex and DTR dependencies on CRD 2.2.1. We will raise this in HL7 Jira.
- **Kit, as the interim fix until HL7 resolves the dependency:** the kit already suppresses validator errors that come from IG defects. Suppress this one, anchored narrowly: the binding error against `DocReason|2.1.0` when the coding is a CRD 2.2.1 DocReason code from `coverage-information-codes`. Any other coding still fails.

  A branch with this suppression and a spec (`spec/davinci_pas_test_kit/cross_suite/docreason_package_conflict_suppression_spec.rb`) is at https://github.com/metacareforyou/davinci-pas-test-kit/tree/fix/v221-suppress-docreason-210-conflict. The spec checks that the exact message above is suppressed, and that a different code, a different code system, or a `DocReason|2.2.1` error is not. The kit's spec suite passes (818 examples, 0 failures).

  We ran the same client against an image of the kit with only this change. The ten request validation failures (3.1.03, 3.2.03, 3.3.2.01, 3.4.3.01, 3.4.3.03, 3.4.3.05, 3.4.3.07, 3.5.03, 3.7.03 and 4.1.03) passed, and no other test changed result: 81 pass, 0 fail, 8 skip. So this binding conflict is the only cause of those failures, and the suppression reaches errors reported inside Bundle validation.

- **Validator, longer term:** resolve an unversioned extension URL to the definition from the package the profile in use depends on (here DTR 2.2.0), not to whichever version a transitive dependency loaded.

The fix branch is based on the pinned commit named above, not on `main`. We are glad to rebase it onto `main` and open a pull request if that helps.

Our results and the full list of defects we found are in our interoperability report card: https://github.com/metacareforyou/metacare-clear-interoperability-report-card (this one is [PAS-01](https://github.com/metacareforyou/metacare-clear-interoperability-report-card/blob/main/defects/PAS-01.md)).

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Clear cannot fix this. Clear sends the coding DTR 2.2.0 requires (`coverage-information-codes` `withpa`).
- Evidence: PAS sessions 7jUEvG6rySX (that coding only) and bThRsP1UxVK (both codings), 2026-11-15. The dependency chain was checked against the manifests in `~/.fhir/packages`.
- Confirmed again on 2026-11-16 with a cleared validator terminology cache: develop at 163b7f3 plus Clear PRs #85 and #86, unmodified kit (session k6Q6wtOpO6t): 79 pass, 10 fail, all ten PAS-01. The same code against the patched image `metacare-inferno-pas:pas-suppress-all` (session dh6oh5HnJv9): 89 pass, 0 fail, 0 skip. Test by test, only the ten PAS-01 tests changed. PAS-01 is the only remaining PAS failure.
- Not effective: `fix/v221-validator-loads-dtr-220` (loads DTR 2.2.0 in addition). A PAS run on develop against an image of it (`metacare-inferno-pas:pas01-fix`, session fE1qMUtMCPW) gave the same ten failures. Keep the branch only as the record of what was tried.
- Proven end to end: PAS on develop at 163b7f3 against `metacare-inferno-pas:pas01-suppress` (image 84dbe4ed8abe, branch at f91de1a), session 3C4bBxxz26y, 2026-11-15: 81 pass, 0 fail, 8 skip. Compared test by test with the official run (develop at 5dc674c, unmodified kit, 71 pass, 10 fail), exactly the ten PAS-01 tests changed, from fail to pass. The two runs tested different Clear commits (163b7f3 adds the CRD merge, PR #81), and no other PAS result changed. The patched run is in the report card as an evidence run, never as the official PAS result.
- Targets: file the kit issue on GitHub with the kit maintainers' consent to suppress, and the dependency issue in HL7 Jira (Da Vinci PAS, mentioning CDex). The `inferno-issue` skill files only the GitHub part.
- The first draft blamed the kit's validator package list alone. That was wrong; the package chain above is the cause.
