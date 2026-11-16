---
id: PAS-02
title: PAS v2.2.1 suites do not suppress the unverifiable X12 889 and 886 value set errors, so must support follow up action codes fail response validation
target: inferno-framework/davinci-pas-test-kit
target_kind: github
kit: davinci-pas-test-kit v0.16.0
kit_commit: 1db14e7899d0519138ed9ac72de8ad2c996c10ac
suite: davinci_pas_client_suite_v221
tests: 4.1.04 and 4.1.06 (tester-provided must support responses), which feed 4.2.2.02 and 4.2.4.02
status: drafted, not filed
fork_branch: https://github.com/metacareforyou/davinci-pas-test-kit/tree/fix/v221-suppress-x12-889-886-value-sets
spec: spec/davinci_pas_test_kit/cross_suite/x12_889_886_value_set_suppression_spec.rb
spec_image: metacare-inferno-pas:1db14e7
filed_url:
found_in: PAS session koGjRfOrkbj, 2026-11-15 (develop plus Clear PRs #85 and #86); run not imported
---

# PAS-02: X12278FollowUpActionCodes and X12278ReviewDecisionReasonCode are missing from the v2.2.1 suppressions

<!-- issue:start -->
**Kit:** davinci-pas-test-kit v0.16.0, commit `1db14e7`. Suite `davinci_pas_client_suite_v221`.

**Tests:** 4.1.04 and 4.1.06, which validate the response Bundles Inferno builds from the tester-provided must support responses (`ms_submit_responses` and `ms_inquire_responses`). Those responses are what 4.2.2.02 (ClaimResponse must support) and 4.2.4.02 (ClaimInquiryResponse must support) check.

### What happens

`extension-errorFollowupAction` is must support on `ClaimResponse.error` (`followupAction`, in `profile-claimresponse-base`, `profile-claimresponse` and `profile-claiminquiryresponse`). Its value is bound (required) to `X12278FollowUpActionCodes`, whose only member code system is X12 889 (`https://codesystem.x12.org/005010/889`). The validator cannot resolve X12 code systems, so it cannot check membership and reports every follow up action code as not in the value set:

> None of the codings provided are in the value set 'X12 278 Follow Up Action Value Set' (http://hl7.org/fhir/us/davinci-pas/ValueSet/X12278FollowUpActionCodes|2.2.1)

So a tester response that fills this must support element makes 4.1.04 and 4.1.06 skip: "Non-conformant response Bundles built from tester-provided response in 'ms_submit_responses'" (and `ms_inquire_responses`). The element then cannot be shown for 4.2.2.02 and 4.2.4.02.

`X12278ReviewDecisionReasonCode` has the same problem: its only member code system is X12 886 (`https://codesystem.x12.org/external/886`), and it is bound (required) to the `reasonCode` part of `extension-reviewAction`. That part is not itself must support, but `reviewAction` is must support on ClaimResponse adjudication, so a response that fills it in fully fails the same way.

### Expected

The v2.2.1 suites treat these two X12-only value sets as they already treat the others: a membership error that cannot be checked is not reported.

### Cause

`lib/davinci_pas_test_kit/cross_suite/validator_suppressions.rb`:

- `V221_SUPPRESSIONS` (lines 13 to 62) suppresses the membership error for the X12-only value sets `pas-pwk01-attachment-report-type-code` and `PASCommunicationRequestMedium` (lines 30 and 31), with the comment that their members all come from X12 code systems, so membership cannot be checked.
- It has no entry for `X12278FollowUpActionCodes` or `X12278ReviewDecisionReasonCode`.
- The legacy list for the v2.0.1 suites does cover `X12278FollowUpActionCodes` (line 104), but in the older "Unable to check whether the code is in the value set" wording, and the v2.2.1 suites do not use that list.

The value set compositions are in `hl7.fhir.us.davinci-pas#2.2.1`: `ValueSet-X12278FollowUpActionCodes.json` includes only `https://codesystem.x12.org/005010/889`; `ValueSet-X12278ReviewDecisionReasonCode.json` includes only `https://codesystem.x12.org/external/886`.

### Reproduction

1. Run `davinci_pas_client_suite_v221` with tester-provided must support responses whose ClaimResponse has an `error` with `extension-errorFollowupAction` carrying an X12 889 code.
2. 4.1.04 (and 4.1.06 for the inquiry response) skips with "Non-conformant response Bundles built from tester-provided response", and the messages include the error above.

### Proposed fix

Add the two value sets to `V221_SUPPRESSIONS`, in the same form as the existing X12-only entries:

```ruby
%r{None of the codings provided are in the value set .*http://hl7\.org/fhir/us/davinci-pas/ValueSet/X12278FollowUpActionCodes},
%r{None of the codings provided are in the value set .*http://hl7\.org/fhir/us/davinci-pas/ValueSet/X12278ReviewDecisionReasonCode},
```

A branch with this change and a spec (`spec/davinci_pas_test_kit/cross_suite/x12_889_886_value_set_suppression_spec.rb`) is at https://github.com/metacareforyou/davinci-pas-test-kit/tree/fix/v221-suppress-x12-889-886-value-sets. The spec checks that both messages are suppressed and that a membership error for another PAS value set is still reported. The kit's spec suite passes (817 examples, 0 failures).

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Evidence: PAS run on develop plus Clear PRs #85 and #86, session koGjRfOrkbj, 2026-11-15. 4.1.04 and 4.1.06 skipped with the messages above. That run is not imported into the report card.
- Spec checked against the unfixed commit: 3 examples, 2 failures there (the negative case passes, as it should); 3 examples, 0 failures on the branch.
- Not proven by a kit run yet. An image of the branch, built the same way as `pas01-suppress`, plus one PAS run, would show 4.1.04 and 4.1.06 pass. This branch does not include the PAS-01 suppression; a combined image would need both branches.
- Clear cannot fix this: a valid X12 889 code cannot be checked by the validator, whoever sends it.
