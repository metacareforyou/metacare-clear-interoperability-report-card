---
id: DTR-01
title: The v2.2.0 Full EHR suite checks the SMART token aud against the v2.0.1 token endpoint
target: inferno-framework/davinci-dtr-test-kit
target_kind: github
kit: davinci-dtr-test-kit v0.18.1
kit_commit: 14dde0e5adc9d355c6ebdfe156839adbac20a781
suite: dtr_full_ehr_v220
tests: 4.01 smart_client_token_request_bsca_verification
status: drafted, not filed
fork_branch: https://github.com/metacareforyou/davinci-dtr-test-kit/tree/fix/v220-smart-token-aud
spec: spec/davinci_dtr_test_kit/full_ehr_v220_smart_token_aud_spec.rb
spec_image: metacare-inferno-dtr:14dde0e
filed_url:
found_in: results/dtr/2026-11-15
---

# DTR-01: v2.2.0 SMART token request check expects the v2.0.1 token endpoint

<!-- issue:start -->
**Kit:** davinci-dtr-test-kit v0.18.1, commit `14dde0e` (two commits after the v0.18.1 tag). Suite `dtr_full_ehr_v220`, client type SMART Backend Services.

**Test:** 4.01 `smart_client_token_request_bsca_verification` (group "Review Authentication Interactions").

### What happens

The v2.2.0 suite advertises its own token endpoint. Its `/fhir/.well-known/smart-configuration` gives `token_endpoint` as `https://<inferno host>/custom/dtr_full_ehr_v220/auth/token`, and the registration display gives the same URL.

A client that signs its client assertion with that URL as `aud` fails test 4.01:

> client assertion jwt on token request 1 has an incorrect `aud` claim: expected 'https://<inferno host>/custom/dtr_full_ehr/auth/token', got 'https://<inferno host>/custom/dtr_full_ehr_v220/auth/token'

The expected value is the v2.0.1 suite's token endpoint.

### Expected

Test 4.01 expects `aud` to be the token endpoint the v2.2.0 suite advertises, `.../custom/dtr_full_ehr_v220/auth/token`.

### Reproduction

1. Start a `dtr_full_ehr_v220` session with client type SMART Backend Services.
2. Register a client with a JWKS (group 1).
3. From the client, read `/custom/dtr_full_ehr_v220/fhir/.well-known/smart-configuration` and request a token from its `token_endpoint`, with that URL as the client assertion `aud`.
4. Run a workflow group so the token is used, then run group 4.
5. Test 4.01 fails with the message above.

### Cause

The v2.2.0 suite reuses the v2.0.1 auth group, and that group pins the SMART test to the v2.0.1 suite:

- `lib/davinci_dtr_test_kit/full_ehr/v2.0.1/dtr_client_payer_auth_smart_group.rb` lines 20 to 23: `test from: :smart_client_token_request_bsca_verification, config: { options: { endpoint_suite_id: :dtr_full_ehr } }`
- `lib/davinci_dtr_test_kit/full_ehr/v2.2.0/dtr_full_ehr_suite.rb` line 136: `group from: :dtr_client_payer_auth_smart`, with no override.
- smart_app_launch_test_kit 1.0.3, `client_suite/token_request_bsca_verification_test.rb` line 44 uses `endpoint_suite_id` as the suite id, and `client_suite/authentication_verification.rb` lines 59 to 61 compare `aud` with `client_token_url` built from it.

### Proposed fix

In the v2.2.0 suite, give the reused group this suite's id. Inferno applies a parent's config to every child, so one option covers the test:

```ruby
group from: :dtr_client_payer_auth_smart,
      config: { options: { endpoint_suite_id: :dtr_full_ehr_v220 } },
      required_suite_options: { client_type: DTRFullEHROptions::SMART_BACKEND_SERVICES_CONFIDENTIAL_ASYMMETRIC }
```

A branch with this change and a spec (`spec/davinci_dtr_test_kit/full_ehr_v220_smart_token_aud_spec.rb`) is at https://github.com/metacareforyou/davinci-dtr-test-kit/tree/fix/v220-smart-token-aud. The spec checks that the v2.2.0 test expects the advertised token endpoint and that the v2.0.1 suite is unchanged. The kit's full spec suite passes on the branch.

The fix branch is based on the pinned commit named above, not on `main`. We are glad to rebase it onto `main` and open a pull request if that helps.

Our results and the full list of defects we found are in our interoperability report card: https://github.com/metacareforyou/metacare-clear-interoperability-report-card (this one is [DTR-01](https://github.com/metacareforyou/metacare-clear-interoperability-report-card/blob/main/defects/DTR-01.md)).

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Clear run: DTR 2026-11-15, test 4.01 failed for this reason. Clear sends the advertised endpoint, which is correct.
- Linear: MET-1699 (report the DTR kit defects), MET-1707 (this repository).
- Spec checked against the unfixed commit: the two v2.2.0 examples fail there and pass on the branch.
