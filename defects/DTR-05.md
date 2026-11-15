---
id: DTR-05
title: Rendering-xhtml must support elements can never be observed, because templates lose primitive extensions
target: inferno-framework/davinci-dtr-test-kit
target_kind: github
kit: davinci-dtr-test-kit v0.18.1
kit_commit: 14dde0e5adc9d355c6ebdfe156839adbac20a781
suite: dtr_full_ehr_v220
tests: 3.2.01 dtr_full_ehr_v220_questionnaire_base_must_support
status: drafted, not filed
fork_branch: none
spec: none
spec_image: none
filed_url:
found_in: results/dtr/2026-11-15
---

# DTR-05: itemTextRenderingXhtml and answerOptionRenderingXhtml cannot pass test 3.2.01

<!-- issue:start -->
**Kit:** davinci-dtr-test-kit v0.18.1, commit `14dde0e` (two commits after the v0.18.1 tag), with fhir_models 5.1.0 and inferno_core 1.6.0. Suite `dtr_full_ehr_v220`.

**Test:** 3.2.01 `dtr_full_ehr_v220_questionnaire_base_must_support`, "Client supports base Questionnaire must support elements and extensions".

### What happens

Test 3.2.01 requires two must support extensions that sit on primitive elements:

- `Questionnaire.item.text.extension:itemTextRenderingXhtml` (path `item.text.extension`);
- `Questionnaire.item.answerOption.value[x].extension:answerOptionRenderingXhtml` (path `item.answerOption.value[x].extension`).

In JSON these are `_text` and `_valueString` (or another `_value...`) members. The kit cannot send them to a client and cannot see them in its own responses:

1. Templates, from a fixture or a tester's input, are parsed with fhir_models (`FHIR.from_contents`). fhir_models 5.1.0 drops primitive extensions on parse, and `to_json` does not write them.
2. The `$questionnaire-package` endpoint rebuilds the response from the parsed template (`FHIR::Parameters.new(...)`, then `to_json` for token replacement), so the client never receives the extensions.
3. Test 3.2.01 parses the responses with fhir_models again and looks for `item.text.extension`, which a parsed `String` does not have.

So test 3.2.01 lists these two elements as missing even when the tester's questionnaire carries them.

### Expected

A tester can supply a questionnaire that uses `rendering-xhtml` on item text and answer options, the client receives it, and test 3.2.01 counts the two elements as observed.

### Reproduction

With the kit's Ruby environment:

```ruby
require 'fhir_models'
json = {
  resourceType: 'Questionnaire', status: 'active',
  item: [{ linkId: '1', type: 'choice', text: 'Hi',
           _text: { extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/rendering-xhtml', valueString: '<b>Hi</b>' }] },
           answerOption: [{ valueString: 'a',
                            _valueString: { extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/rendering-xhtml', valueString: '<i>a</i>' }] } }] }]
}.to_json
puts FHIR.from_contents(json).to_json   # no _text, no _valueString
```

In a session: supply such a questionnaire as a group 3.1 template, complete it, and run 3.2.01. The message lists `item.answerOption.value[x].extension:answerOptionRenderingXhtml` among the elements not found.

### Cause

- `lib/davinci_dtr_test_kit/full_ehr/fixture_loader.rb` line 19 and `MockPayer#parse_fhir_object` parse templates with `FHIR.from_contents`.
- `lib/davinci_dtr_test_kit/full_ehr/v2.2.0/full_ehr_questionnaire_package_endpoint.rb` lines 96 to 117 rebuild the response from models and replace tokens in `to_json` output. The `$next-question` endpoint does the same for each item (`replace_tokens_in_item`).
- `lib/davinci_dtr_test_kit/cross_suite/generated/v2.2.0/dtr_base_questionnaire/metadata.yml` lines 153 to 167 define the two elements with paths through primitives.

### Proposed fix

Either of these, depending on what the maintainers prefer:

1. Keep templates as JSON from input to response. Filter parameters and replace tokens on the JSON hash, and use models only to evaluate inclusion criteria. Then have the must support check look for these two elements in the raw JSON of the responses (`_text.extension`, `_value[x].extension`).
2. Until that is done, leave the two primitive extensions out of the must support list the client tests require, and say so in the test description, so a client is not failed on elements the kit cannot deliver.

We have not made a fork branch for this one. Option 1 touches both endpoints and the must support analysis, and the choice between the options is the maintainers'. We are glad to make either change on request.

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Clear run: DTR 2026-11-15, 3.2.01 failed. Most of its missing elements are Clear's to supply through group 3.1 questionnaires (MET-1703). The two rendering-xhtml elements cannot pass whatever Clear does.
- The fhir_models behavior was confirmed in the `metacare-inferno-dtr:14dde0e` image (fhir_models 5.1.0): the snippet prints the Questionnaire without `_text` or `_valueString`.
- A fhir_models issue (fhir-crucible/fhir_models) may also be worth raising once the kit maintainers say which fix they want.
