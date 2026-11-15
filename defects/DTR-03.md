---
id: DTR-03
title: The kit's own $questionnaire-package responses fail its v2.2.0 response validation
target: inferno-framework/davinci-dtr-test-kit
target_kind: github
kit: davinci-dtr-test-kit v0.18.1
kit_commit: 14dde0e5adc9d355c6ebdfe156839adbac20a781
suite: dtr_full_ehr_v220
tests: 2.1.2.02 and 2.2.2.02 dtr_full_ehr_v220_qp_response_validation
status: drafted, not filed
fork_branch: https://github.com/metacareforyou/davinci-dtr-test-kit/tree/fix/qpackage-bundle-conformance
spec: spec/davinci_dtr_test_kit/full_ehr_v220_qpackage_bundle_fixture_spec.rb
spec_image: metacare-inferno-dtr:14dde0e
filed_url:
found_in: results/dtr/2026-11-15
---

# DTR-03: the workflow package responses do not conform to DTR-QPackageBundle 2.2.0

<!-- issue:start -->
**Kit:** davinci-dtr-test-kit v0.18.1, commit `14dde0e` (two commits after the v0.18.1 tag). Suite `dtr_full_ehr_v220`.

**Tests:** 2.1.2.02 (standard workflow) and 2.2.2.02 (adaptive workflow), `dtr_full_ehr_v220_qp_response_validation`, "Questionnaire Package response is valid".

### What happens

These tests validate Inferno's own simulated `$questionnaire-package` response against `dtr-qpackage-output-parameters|2.2.0`. The responses come from the kit's fixtures, so the tests fail for every client, whatever the client does.

The fixtures do not meet DTR-QPackageBundle 2.2.0:

| Fixture | Problem |
|---|---|
| `dinner_static/parameters_questionnaire_dinner_order_static.json` | No `questionnaireResponse` entry. The profile slices `Bundle.entry` by resource type and requires exactly one QuestionnaireResponse (`dtr-questionnaireresponse|2.2.0`). |
| `dinner_adaptive/parameters_questionnaire_dinner_order_adaptive.json` | No `questionnaireResponse` entry; no `Bundle.type` (the profile fixes it to `collection`, and base Bundle requires it); no `fullUrl` on its entries. |

### Expected

The kit's packaged responses conform to the profile the kit validates them against, so these tests pass for a client that does nothing wrong.

### Reproduction

1. Start a `dtr_full_ehr_v220` session and run group 2.1 (Standard Questionnaire) with any client that requests the package.
2. Test 2.1.2.02 fails: "Request 1: Non-conformant $questionnaire-package response(s)."
3. Run group 2.2 (Adaptive Questionnaire). Test 2.2.2.02 fails the same way.

The fixtures can also be checked directly against `StructureDefinition-DTR-QPackageBundle.json` in the `hl7.fhir.us.davinci-dtr#2.2.0` package: `Bundle.entry:questionnaireResponse` has `min` 1.

### Cause

- `lib/davinci_dtr_test_kit/full_ehr/v2.2.0/workflows/dtr_full_ehr_workflow_standard_group.rb` line 17 and `dtr_full_ehr_workflow_adaptive_group.rb` line 17 name the fixtures above as the response templates.
- `lib/davinci_dtr_test_kit/full_ehr/v2.2.0/response/dtr_questionnaire_package_response_validation_test.rb` lines 66 to 69 validate the response against `dtr-qpackage-output-parameters|2.2.0`.

### Proposed fix

Make the two fixtures conform:

- add a `QuestionnaireResponse` entry to each package Bundle, with `meta.profile` `dtr-questionnaireresponse|2.2.0`, `questionnaire` set to the packaged Questionnaire's canonical, `status` `in-progress`, `subject` from the request's Coverage beneficiary, and the `qr-coverage` and `intendedUse` extensions the profile requires. The subject and Coverage reference use the kit's `{{fhirpath}}` tokens against the request;
- give the adaptive Bundle `type` `collection` and each entry a `fullUrl`.

A branch with these changes and a spec (`spec/davinci_dtr_test_kit/full_ehr_v220_qpackage_bundle_fixture_spec.rb`) is at https://github.com/metacareforyou/davinci-dtr-test-kit/tree/fix/qpackage-bundle-conformance. The spec checks each fixture's Bundle type, entry `fullUrl`s and the QuestionnaireResponse entry.

One point for the maintainers: with a QuestionnaireResponse in the adaptive package, a client may start `$next-question` from it. That is what DTR 2.2.0 intends, but it changes what the adaptive workflow sends today. The branch keeps the response empty (no items), so it adds no answers.

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Clear run: DTR 2026-11-15, tests 2.1.2.02 and 2.2.2.02 failed for this reason. MET-1699 first recorded it.
- The branch has not been run against the kit's validator (the shared validator was in use by a PAS run). Before filing, run the branch's workflow groups once against Clear and confirm the two tests pass.
- Spec checked against the unfixed commit: six examples fail there and pass on the branch.
