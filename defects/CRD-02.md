---
id: CRD-02
title: The CRD coverage information update test and the granted scopes test cannot both pass for a non US Core target such as Appointment
target: inferno-framework/davinci-crd-test-kit
target_kind: github
kit: davinci-crd-test-kit v0.15.0
kit_commit: 86be7f4bf6817960aa204f8ce134cea466bd73d2
suite: crd_client_v221
tests: 2.3.2.01 crd_v221_client_coverage_info_update, and 1.2.x.3.07 crd_v221_hook_request_granted_scopes
status: filed 2026-11-16, approved by Richard Braman
fork_branch: https://github.com/metacareforyou/davinci-crd-test-kit/tree/fix/granted-scopes-allow-coverage-info-targets
spec: spec/davinci_crd_test_kit/client/v2.2.1/verify_request/hook_request_granted_scopes_coverage_targets_spec.rb
spec_image: metacare-inferno-crd:86be7f4
filed_url: https://github.com/inferno-framework/davinci-crd-test-kit/issues/160
found_in: results/crd/2026-11-15-2
---

# CRD-02: coverage information update reads targets the granted scopes test forbids

<!-- issue:start -->
**Kit:** davinci-crd-test-kit v0.15.0, commit `86be7f4`. Suite `crd_client_v221`, US Core 7.0.0.

**Tests:** 2.3.2.01 `crd_v221_client_coverage_info_update` and each hook's `crd_v221_hook_request_granted_scopes` (1.2.x.3.07).

### What happens

The coverage information update test reads every Coverage Information target from the client's FHIR API, with the token from the hooks. Targets include types that are not in US Core, for example the proposed Appointment from `appointment-book` and DeviceRequest from `order-sign`. It skips a type only when the CapabilityStatement does not list a read interaction for it.

The granted scopes test fails a hook request whose `fhirAuthorization.scope` grants any resource type beyond the US Core list for the selected version ("Granted scopes included the following resource types beyond what was requested").

So a client must choose:

- grant only US Core types: the granted scopes test passes, and the coverage information update test fails with "Unable to read target resource" for each Appointment or DeviceRequest target;
- also grant the target types: the coverage information update test can read them, and the granted scopes test fails.

### Expected

A client that stores coverage information and grants exactly the access the kit needs can pass both tests.

### Reproduction

1. Run `crd_client_v221` with US Core 7.0.0. Send `appointment-book` with a proposed Appointment. Inferno answers with a Coverage Information system action on the Appointment.
2. Grant only the US Core 6 and 7 resource types. 2.3.2.01 fails: "Unable to read target resource" for `Appointment/<id>`.
3. Add `user/Appointment.rs` to the granted scopes. 1.2.1.3.07 fails: "Granted scopes included the following resource types beyond what was requested: Appointment".

### Cause

- `lib/davinci_crd_test_kit/client/v2.2.1/verify_request/hook_request_granted_scopes_test.rb` lines 67 to 79: any granted type outside `CRDClientOptions::US_CORE_6_7_RESOURCE_TYPES` is an error.
- `lib/davinci_crd_test_kit/client/v2.2.1/api/client_coverage_info_update_test.rb` lines 43 to 63 and 138 to 142 read every Coverage Information target whose type the CapabilityStatement can read, including the types in `CardsIdentification::COVERAGE_INFO_EXPECTED_RESOURCE_TYPES` (Appointment, CommunicationRequest, DeviceRequest, Encounter, MedicationRequest, NutritionOrder, ServiceRequest, VisionPrescription). Of these, Appointment, CommunicationRequest, DeviceRequest, NutritionOrder and VisionPrescription are not US Core 7.0.0 types.

### Proposed fix

Either:

1. in the granted scopes test, accept scopes for the types a Coverage Information response can target, since the kit reads them; or
2. in the coverage information update test, skip (with an info message) targets whose type is outside the requested scopes.

Option 2 would skip DeviceRequest and Appointment, which are the most common Coverage Information targets, so the test would rarely check anything. We propose option 1. A branch with it and a spec (`spec/davinci_crd_test_kit/client/v2.2.1/verify_request/hook_request_granted_scopes_coverage_targets_spec.rb`) is at https://github.com/metacareforyou/davinci-crd-test-kit/tree/fix/granted-scopes-allow-coverage-info-targets. Granting `Appointment` and the other target types passes there. Any other extra type, for example `Claim`, still fails. The existing request verification and API specs pass on the branch (133 examples, 0 failures).

The fix branch is based on the pinned commit named above, not on `main`. We are glad to rebase it onto `main` and open a pull request if that helps.

Our results and the full list of defects we found are in our interoperability report card: https://github.com/metacareforyou/metacare-clear-interoperability-report-card (this one is [CRD-02](https://github.com/metacareforyou/metacare-clear-interoperability-report-card/blob/main/defects/CRD-02.md)).

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Clear run: CRD 2026-11-15 (second run) on PR #81 at be40fa2, 2.3.2.01 failed with "Unable to read target resource" for the `Appointment/<case>-appt-*` targets.
- Spec checked against the unfixed commit: 2 examples, 2 failures there; 2 examples, 0 failures on the branch.
