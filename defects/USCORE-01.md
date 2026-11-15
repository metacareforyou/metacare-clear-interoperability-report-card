---
id: USCORE-01
title: Provenance revinclude search raises NameError on a 400, because the block names the patient id _patient_id
target: inferno-framework/us-core-test-kit
target_kind: github
kit: us-core-test-kit v1.1.5 (pulled in by davinci-crd-test-kit v0.15.0); still present on main as of 2026-11-15
kit_commit: 73fc69a5f45f9250d5df23aa3b9fbea2bdbba79b
suite: crd_client_v221 (US Core 7.0.0 FHIR API group); every US Core suite that runs the Provenance revinclude tests
tests: 2.3.x provenance_revinclude_search_test (32 tests errored in our run)
status: drafted, not filed
fork_branch: https://github.com/metacareforyou/us-core-test-kit/tree/fix/provenance-revinclude-patient-id
spec: spec/us_core/provenance_revinclude_search_test_spec.rb
spec_image: metacare-inferno-crd:86be7f4 (with bundle install)
filed_url:
found_in: results/crd/2026-11-15
---

# USCORE-01: NameError in run_provenance_revinclude_search_test

<!-- issue:start -->
**Kit:** us-core-test-kit v1.1.5, commit `73fc69a`. The same code is on `main` today. We met it through davinci-crd-test-kit v0.15.0, whose client suite runs the US Core 7.0.0 FHIR API tests.

**Tests:** every `*_provenance_revinclude_search_test` for a resource with a possible status search, for example `us_core_v700_encounter_provenance_revinclude_search_test`.

### What happens

When the server answers the `_revinclude=Provenance:target` search with HTTP 400, the test should retry with the status values, as the plain search test does. Instead it errors:

> Error: undefined local variable or method `patient_id' for an instance of USCoreTestKit::USCoreV700::EncounterProvenanceRevincludeSearchTest

### Expected

On a 400 with an OperationOutcome, the test retries the search with the status parameter, as `run_search_test` does, and passes or fails on the result.

### Reproduction

Point a US Core 7.0.0 FHIR API group at a server that answers `GET /Encounter?patient=<id>&_revinclude=Provenance:target` with HTTP 400 and an OperationOutcome. The Provenance revinclude test errors with the message above.

A spec that reproduces it is on the branch below; on `v1.1.5` it fails with the NameError.

### Cause

`lib/us_core_test_kit/search_test.rb`, `run_provenance_revinclude_search_test`, lines 63 to 68:

```ruby
all_provenance_revinclude_search_params.flat_map do |_patient_id, params_list|
  params_list.flat_map do |params|
    fhir_search resource_type, params:, tags: tags(params)

    perform_search_with_status(params, patient_id) if response[:status] == 400 && possible_status_search?
```

The block variable is `_patient_id`, but the call uses `patient_id`, which is not defined in the test.

### Proposed fix

Name the block variable `patient_id`.

A branch with the one line change and a spec (`spec/us_core/provenance_revinclude_search_test_spec.rb`) is at https://github.com/metacareforyou/us-core-test-kit/tree/fix/provenance-revinclude-patient-id. The spec answers the revinclude search with a 400 and an OperationOutcome, then checks that the status search is made once and the test passes. It and the existing `spec/us_core/search_test_spec.rb` pass on the branch.

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Clear run: CRD 2026-11-15 on PR #81, 32 Provenance revinclude tests errored with this NameError. The 400 underneath each one is Clear's FHIR API (MET-1694); fixing the kit turns the error into a retry, and Clear still has to answer the search.
- The CRD kit pins us_core_test_kit `~> 1.0` in its gemspec, so a fixed 1.x release reaches it without a CRD kit change.
- Spec checked against v1.1.5: it fails there with "undefined local variable or method `patient_id'".
