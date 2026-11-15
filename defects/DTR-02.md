---
id: DTR-02
title: The v2.2.0 Full EHR suite checks UDAP registration and token aud against the v2.0.1 endpoints
target: inferno-framework/davinci-dtr-test-kit
target_kind: github
kit: davinci-dtr-test-kit v0.18.1
kit_commit: 14dde0e5adc9d355c6ebdfe156839adbac20a781
suite: dtr_full_ehr_v220
tests: 1.03 udap_client_registration_interaction, 1.04 udap_client_registration_cc_verification, 5.01 udap_client_token_request_cc_verification (numbering with the UDAP option)
status: drafted, not filed
fork_branch: https://github.com/metacareforyou/davinci-dtr-test-kit/tree/fix/v220-udap-aud
spec: spec/davinci_dtr_test_kit/full_ehr_v220_udap_aud_spec.rb
spec_image: metacare-inferno-dtr:14dde0e
filed_url:
found_in: results/dtr-udap/2026-11-15
---

# DTR-02: v2.2.0 UDAP registration and token checks expect the v2.0.1 endpoints

<!-- issue:start -->
**Kit:** davinci-dtr-test-kit v0.18.1, commit `14dde0e` (two commits after the v0.18.1 tag). Suite `dtr_full_ehr_v220`, client type UDAP B2B Client Credentials.

**Tests:** in group 1 (Client Registration), `udap_client_registration_interaction` and `udap_client_registration_cc_verification`; in the UDAP "Review Authentication Interactions" group, `udap_client_token_request_cc_verification`.

### What happens

This is the UDAP counterpart of the SMART token issue (the v2.2.0 suite checks the SMART token `aud` against the v2.0.1 token endpoint).

The v2.2.0 suite serves UDAP discovery at `/custom/dtr_full_ehr_v220/fhir/.well-known/udap`, which gives `registration_endpoint` `.../custom/dtr_full_ehr_v220/auth/register` and `token_endpoint` `.../custom/dtr_full_ehr_v220/auth/token`. The UDAP tests reused from the v2.0.1 suite instead expect:

- the software statement `aud` on registration to be `.../custom/dtr_full_ehr/auth/register`;
- the client assertion `aud` on token requests to be `.../custom/dtr_full_ehr/auth/token`.

So a client that uses the endpoints the v2.2.0 suite advertises fails those checks, and the registration wait uses the v2.0.1 suite's id.

### Expected

The UDAP tests in the v2.2.0 suite expect this suite's advertised registration and token endpoints.

### Reproduction

1. Start a `dtr_full_ehr_v220` session with client type UDAP B2B Client Credentials.
2. Read the suite's UDAP discovery document and register at its `registration_endpoint`, with that URL as the software statement `aud`.
3. Request a token at its `token_endpoint`, with that URL as the client assertion `aud`.
4. The registration verification and the token request verification report an incorrect `aud`, expecting the `/custom/dtr_full_ehr/` paths.

### Cause

- `lib/davinci_dtr_test_kit/full_ehr/v2.0.1/dtr_payer_registration_group.rb` lines 29 to 42: the two UDAP registration tests set `endpoint_suite_id: :dtr_full_ehr`.
- `lib/davinci_dtr_test_kit/full_ehr/v2.0.1/dtr_client_payer_auth_udap_group.rb` lines 20 to 23: the UDAP token request test sets `endpoint_suite_id: :dtr_full_ehr`.
- `lib/davinci_dtr_test_kit/full_ehr/v2.2.0/dtr_full_ehr_suite.rb` lines 110 and 140 reuse both groups with no override.
- udap_security_test_kit 0.12.2: `client_suite/registration_request_verification.rb` line 76 compares `aud` with `client_registration_url`, and `client_suite/token_request_verification.rb` line 113 with `client_token_url`. Both are built from `endpoint_suite_id` (`urls.rb` lines 37 to 51).

### Proposed fix

In the v2.2.0 suite, give both reused groups this suite's id:

```ruby
group from: :dtr_client_payer_registration,
      config: { options: { endpoint_suite_id: :dtr_full_ehr_v220 } }

group from: :dtr_client_payer_auth_udap,
      config: { options: { endpoint_suite_id: :dtr_full_ehr_v220 } },
      required_suite_options: { client_type: DTRFullEHROptions::UDAP_CLIENT_CREDENTIALS }
```

A branch with this change and a spec (`spec/davinci_dtr_test_kit/full_ehr_v220_udap_aud_spec.rb`) is at https://github.com/metacareforyou/davinci-dtr-test-kit/tree/fix/v220-udap-aud. The spec checks the expected registration and token URLs against the suite's UDAP discovery document, and that the v2.0.1 suite is unchanged.

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Reproduced in Clear's first UDAP run (PR #84 at 355fcda, 2026-11-15): 1.04 and 5.01 failed. File it together with DTR-01.
- Spec checked against the unfixed commit: the three v2.2.0 examples fail there and pass on the branch.
