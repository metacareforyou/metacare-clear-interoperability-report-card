---
id: DTR-04
title: The adaptive workflow sends questionnaireAdaptive as valueBoolean, which dtr-questionnaire-adapt 2.2.0 does not allow
target: inferno-framework/davinci-dtr-test-kit
target_kind: github
kit: davinci-dtr-test-kit v0.18.1
kit_commit: 14dde0e5adc9d355c6ebdfe156839adbac20a781
suite: dtr_full_ehr_v220
tests: 2.2 adaptive workflow, $next-question request validation
status: drafted, not filed
fork_branch: https://github.com/metacareforyou/davinci-dtr-test-kit/tree/fix/adaptive-extension-value-url
spec: spec/davinci_dtr_test_kit/full_ehr_v220_adaptive_service_url_spec.rb
spec_image: metacare-inferno-dtr:14dde0e
filed_url:
found_in: results/dtr/2026-11-14 (Clear MET-1698)
---

# DTR-04: the adaptive Questionnaire's questionnaireAdaptive extension is a boolean

<!-- issue:start -->
**Kit:** davinci-dtr-test-kit v0.18.1, commit `14dde0e` (two commits after the v0.18.1 tag). Suite `dtr_full_ehr_v220`.

**Tests:** group 2.2 (Adaptive Questionnaire). The kit's `$next-question` request validation checks the Questionnaire the client contains in its QuestionnaireResponse.

### What happens

The adaptive workflow's package gives the adaptive Questionnaire this extension:

```json
{ "url": "http://hl7.org/fhir/uv/sdc/StructureDefinition/sdc-questionnaire-questionnaireAdaptive", "valueBoolean": true }
```

DTR 2.2.0 `dtr-questionnaire-adapt` requires the extension (`Questionnaire.extension:questionnaireAdaptive`, 1..1) and restricts `value[x]` to `url`: the url of the service the client calls `$next-question` on.

A DTR client contains the payer's Questionnaire in each `$next-question` request. A client that copies the kit's Questionnaire as given fails the kit's own request validation. A client that corrects the value is no longer sending the Questionnaire it received.

### Expected

The packaged adaptive Questionnaire carries `questionnaireAdaptive` as `valueUrl`, set to the simulated payer's FHIR base where `$next-question` is served.

### Reproduction

1. Start a `dtr_full_ehr_v220` session and run group 2.2.
2. Request the package. The adaptive Questionnaire has `questionnaireAdaptive` `valueBoolean` `true`.
3. Send `$next-question` with that Questionnaire contained, unchanged. The `$next-question` request validation fails on the contained Questionnaire, which does not meet `dtr-questionnaire-adapt` because `value[x]` is a boolean.

### Cause

- `lib/davinci_dtr_test_kit/full_ehr/fixtures/dinner_adaptive/parameters_questionnaire_dinner_order_adaptive.json` line 24, and the other `dinner_adaptive` fixtures at lines 18 and 19, use `valueBoolean: true`.
- `StructureDefinition-dtr-questionnaire-adapt.json` in `hl7.fhir.us.davinci-dtr#2.2.0` types `Questionnaire.extension:questionnaireAdaptive.value[x]` as `url` only.

A fixture cannot hold the right URL, because it does not know the host Inferno runs on.

### Proposed fix

When the package endpoint instantiates its template, replace a `questionnaireAdaptive` `valueBoolean: true` with `valueUrl` set to the suite's FHIR base (the request URL up to `/fhir`). The fixtures can keep the boolean as a marker. A Questionnaire that already gives a URL is left alone.

A branch with this change is at https://github.com/metacareforyou/davinci-dtr-test-kit/tree/fix/adaptive-extension-value-url. It adds `lib/davinci_dtr_test_kit/cross_suite/v2.2.0/adaptive_service_url.rb`, calls it from `FullEHRV220QuestionnairePackageEndpoint#instantiate_template`, and adds an endpoint spec (`spec/davinci_dtr_test_kit/full_ehr_v220_adaptive_service_url_spec.rb`) that posts a package request and checks the extension in the response. The kit's own checks that treat the Questionnaire as adaptive (`QuestionnaireHelper#adaptive_questionnaire?`) keep working, because they accept any value other than `false`.

The fix branch is based on the pinned commit named above, not on `main`. We are glad to rebase it onto `main` and open a pull request if that helps.

Our results and the full list of defects we found are in our interoperability report card: https://github.com/metacareforyou/metacare-clear-interoperability-report-card (this one is [DTR-04](https://github.com/metacareforyou/metacare-clear-interoperability-report-card/blob/main/defects/DTR-04.md)).

Related work: the open pull requests #146 and #147 add a similar replacement for `questionnaireAdaptive` `valueUrl` in new v2.2.0 templates, and leave `valueBoolean` as it is. They do not change the `dinner_adaptive` fixtures, which still send `valueBoolean`. If those land first, a smaller fix is to give the `dinner_adaptive` fixtures a placeholder `valueUrl` that the new replacement fills in.

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Clear first copied the boolean and failed `$next-question` request validation in the 2026-11-14 run. Clear now writes the route's `$next-question` URL (MET-1698, done), so Clear no longer fails on it; the kit defect remains for every other client.
- The validator's exact message was not kept in our results. Before filing, reproduce once and paste the message into step 3.
- Spec checked against the unfixed commit: both examples fail there and pass on the branch.
