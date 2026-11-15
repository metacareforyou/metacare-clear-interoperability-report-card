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
status: drafted, not filed
fork_branch: https://github.com/metacareforyou/davinci-pas-test-kit/tree/fix/v221-suppress-docreason-210-conflict
spec: spec/davinci_pas_test_kit/cross_suite/docreason_package_conflict_suppression_spec.rb
spec_image: metacare-inferno-pas:1db14e7
filed_url:
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
- **Kit, until then:** the kit already suppresses validator errors that come from IG defects. Suppress this one, anchored narrowly: the binding error against `DocReason|2.1.0` when the coding is a CRD 2.2.1 DocReason code from `coverage-information-codes`. Any other coding still fails.

  A branch with this suppression and a spec (`spec/davinci_pas_test_kit/cross_suite/docreason_package_conflict_suppression_spec.rb`) is at https://github.com/metacareforyou/davinci-pas-test-kit/tree/fix/v221-suppress-docreason-210-conflict. The spec checks that the exact message above is suppressed, and that a different code, a different code system, or a `DocReason|2.2.1` error is not. The kit's spec suite passes (818 examples, 0 failures). Whether the suppression reaches errors reported inside Bundle validation can only be shown by a kit run.

- **Validator, longer term:** resolve an unversioned extension URL to the definition from the package the profile in use depends on (here DTR 2.2.0), not to whichever version a transitive dependency loaded.

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Clear cannot fix this. Clear sends the coding DTR 2.2.0 requires (`coverage-information-codes` `withpa`).
- Evidence: PAS sessions 7jUEvG6rySX (that coding only) and bThRsP1UxVK (both codings), 2026-11-15. The dependency chain was checked against the manifests in `~/.fhir/packages`.
- Not effective: `fix/v221-validator-loads-dtr-220` (loads DTR 2.2.0 in addition). A PAS run on develop against an image of it (`metacare-inferno-pas:pas01-fix`, session fE1qMUtMCPW) gave the same ten failures. Keep the branch only as the record of what was tried.
- The suppression branch has an image, `metacare-inferno-pas:pas01-suppress`, so one PAS run can prove or disprove it. Until that run passes, the fix is not proven.
- Targets: file the kit issue on GitHub with the kit maintainers' consent to suppress, and the dependency issue in HL7 Jira (Da Vinci PAS, mentioning CDex). The `inferno-issue` skill files only the GitHub part.
- The first draft blamed the kit's validator package list alone. That was wrong; the package chain above is the cause.
