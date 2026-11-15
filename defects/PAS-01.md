---
id: PAS-01
title: PAS v2.2.1 request validation binds DTR intendedUse to CRD DocReason 2.1.0 but resolves its codes under CRD 2.2.1, so no coding passes
target: inferno-framework/davinci-pas-test-kit
target_kind: github
kit: davinci-pas-test-kit v0.16.0
kit_commit: 1db14e7899d0519138ed9ac72de8ad2c996c10ac
suite: davinci_pas_client_suite_v221
tests: request Bundle validation, for example 3.1.03 pas_client_v221_request_bundle_validation_test and 3.4.3.01 to 3.4.3.07
status: drafted, not filed
fork_branch: https://github.com/metacareforyou/davinci-pas-test-kit/tree/fix/v221-validator-loads-dtr-220
spec: spec/davinci_pas_test_kit/cross_suite/validator_configuration_dtr_spec.rb
spec_image: metacare-inferno-pas:1db14e7
filed_url:
found_in: results/pas/2026-11-15-2
---

# PAS-01: no intendedUse coding can pass PAS request Bundle validation

<!-- issue:start -->
**Kit:** davinci-pas-test-kit v0.16.0, commit `1db14e7`. Suite `davinci_pas_client_suite_v221`.

**Tests:** the request Bundle validation tests, for example 3.1.03 `pas_client_v221_request_bundle_validation_test` and the claim update validation tests 3.4.3.01 to 3.4.3.07.

### What happens

A PAS request carries the DTR QuestionnaireResponse that supports it, with `meta.profile` `http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/dtr-questionnaireresponse|2.2.0`. That profile requires the `intendedUse` extension (1..*).

The kit's validator reports an error on `intendedUse` whatever coding the client sends. Two runs on 2026-11-15, same client, same request, only the coding changed:

1. With only `http://hl7.org/fhir/us/davinci-crd/CodeSystem/coverage-information-codes` `withpa`:

   > None of the codings provided are in the value set 'CRD Coverage Information Documentation Reason Value Set' (http://hl7.org/fhir/us/davinci-crd/ValueSet/DocReason|2.1.0)

2. With that coding plus `http://hl7.org/fhir/us/davinci-crd/CodeSystem/temp` `withpa`:

   > Unknown code 'withpa' in the CodeSystem 'http://hl7.org/fhir/us/davinci-crd/CodeSystem/temp' version '2.2.1'

So the validator checks the binding against DocReason 2.1.0, which lists `CodeSystem/temp` codes, but resolves `CodeSystem/temp` under CRD 2.2.1, where `withpa` no longer exists (CRD 2.2.1 moved it to `coverage-information-codes`). No coding satisfies both.

### Expected

`intendedUse` is checked under one consistent CRD version. For a DTR 2.2.0 QuestionnaireResponse that is CRD 2.2.1: in the published `hl7.fhir.us.davinci-dtr#2.2.0` package, `StructureDefinition-intendedUse.json` binds `value[x]` (required) to `http://hl7.org/fhir/us/davinci-crd/ValueSet/DocReason|2.2.1`, and DTR 2.2.0 depends on CRD 2.2.1. Under that binding, `coverage-information-codes` `withpa` passes.

### Reproduction

1. Run the PAS v2.2.1 client suite (SMART Backend Services) and send a `$submit` request whose Bundle includes a QuestionnaireResponse claiming `dtr-questionnaireresponse|2.2.0`, with `intendedUse` `coverage-information-codes` `withpa`.
2. 3.1.03 fails with the first message above.
3. Add a second coding, `CodeSystem/temp` `withpa`, and resubmit. 3.1.03 fails with the second message.

### Cause

`lib/davinci_pas_test_kit/cross_suite/validator_configuration.rb` line 6 loads only `hl7.fhir.us.davinci-pas#2.2.1` and `hl7.fhir.us.core#6.1.0`. PAS 2.2.1 does not depend on DTR, so the DTR profiles a PAS request uses are not among the loaded packages, and the validator resolves them by itself. The binding it applied, `DocReason|2.1.0`, belongs to an earlier DTR and CRD pairing (DTR 2.1.0 depends on CRD 2.1.0 and binds `intendedUse` to DocReason), while the code system came from the CRD 2.2.1 that PAS 2.2.1 loads.

### Proposed fix

Load DTR 2.2.0 in the v2.2.1 validators, so the QuestionnaireResponse profile, its `intendedUse` binding and CRD resolve together:

```ruby
V221_VALIDATOR_IGS = ['hl7.fhir.us.davinci-pas#2.2.1', 'hl7.fhir.us.core#6.1.0', 'hl7.fhir.us.davinci-dtr#2.2.0'].freeze
```

A branch with this change and a spec is at https://github.com/metacareforyou/davinci-pas-test-kit/tree/fix/v221-validator-loads-dtr-220. The kit's spec suite passes on it (816 examples, 0 failures). We have not yet rerun the suite against a client with this change, so the fix is not yet confirmed end to end.

The guides could also say which DTR version a PAS 2.2.1 request's QuestionnaireResponse is expected to follow. We will raise that with HL7 separately.

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- First suspected on 2026-11-15 and wrongly dropped the same day (see `dropped.md`). Two PAS kit runs settled it: session 7jUEvG6rySX (coverage-information-codes only) and session bThRsP1UxVK (both codings). The messages above are quoted from those sessions.
- The cause section's account of where `DocReason|2.1.0` comes from is our reading. The validator's exact package resolution was not traced. Before filing, rerun PAS against the fork branch image. If 3.1.03 then passes on the `intendedUse` check, add that to the draft.
- The coordinator's note said DTR 2.2.0 depends on CRD 2.1.0. The published DTR 2.2.0 package depends on CRD 2.2.1, so the draft does not say that.
- HL7 side: a short Jira note asking the PAS and DTR guides to state the expected DTR version for the QuestionnaireResponse in a PAS 2.2.1 Bundle. Not drafted as a separate defect yet.
- Clear: until the kit is fixed, Clear cannot pass request Bundle validation on this point. Clear should send only the `coverage-information-codes` coding, which is right under DTR 2.2.0.
