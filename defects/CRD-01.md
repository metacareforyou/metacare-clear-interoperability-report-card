---
id: CRD-01
title: The CRD v2.2.1 token payload test checks exp when the test runs, not when the request arrived
target: inferno-framework/davinci-crd-test-kit
target_kind: github
kit: davinci-crd-test-kit v0.15.0
kit_commit: 86be7f4bf6817960aa204f8ce134cea466bd73d2
suite: crd_client_v221
tests: 1.2.x.4.04 crd_v221_token_payload (each hook's auth group)
status: drafted, not filed
fork_branch: https://github.com/metacareforyou/davinci-crd-test-kit/tree/fix/token-exp-at-request-time
spec: spec/davinci_crd_test_kit/client/v2.2.1/auth/token_payload_exp_at_request_time_spec.rb
spec_image: metacare-inferno-crd:86be7f4
filed_url:
found_in: results/crd/2026-11-15
---

# CRD-01: a valid short lived CDS Hooks JWT fails as expired

<!-- issue:start -->
**Kit:** davinci-crd-test-kit v0.15.0, commit `86be7f4`. Suite `crd_client_v221`.

**Test:** `crd_v221_token_payload`, "Authorization token payloads have required claims and valid signatures", in each hook's auth group (for example 1.2.4.4.04 for order-sign).

### What happens

The test verifies each hook request's authentication JWT with `JWT.decode(..., exp_leeway: 60)`. That checks `exp` against the time the test runs.

The auth group runs after the hook interaction, its response tests and the card display attestation. In practice that is often several minutes after the request. CDS Hooks expects the authentication JWT to be short lived, five minutes at most. A client that issues a five minute token then fails with "Signature has expired", although the token was valid when Inferno received it.

The test's own description says `exp` "must represent a time in the future", which reads as the time of the request.

### Expected

`exp` is checked against the time Inferno received the hook request, with the same 60 seconds of clock skew.

### Reproduction

1. Start a `crd_client_v221` session and register a client that signs each hook request with a JWT whose `exp` is `iat` plus 300 seconds.
2. Send `order-sign` and complete the interaction and the card display attestation.
3. Wait more than six minutes after the request (for example, while attesting), then run the order-sign auth group.
4. `crd_v221_token_payload` fails: "Token validation error: Signature has expired".

### Cause

`lib/davinci_crd_test_kit/client/v2.2.1/auth/token_payload_test.rb` lines 89 to 101: `JWT.decode` with `exp_leeway: 60` and expiration verification on, at test run time. The request itself (`requests[index]`, an `Inferno::Entities::Request`) carries `created_at`, the time it arrived.

The v2.0.1 suite's test (`client/v2.0.1/auth/token_payload_test.rb`) has the same pattern.

### Proposed fix

Turn off expiration in `JWT.decode` (`verify_expiration: false`) and check `exp` against `request.created_at`, allowing 60 seconds of clock skew. Missing or non numeric `exp` values stay with the existing required claim and claim type checks.

A branch with this change for the v2.2.1 suite is at https://github.com/metacareforyou/davinci-crd-test-kit/tree/fix/token-exp-at-request-time. It adds `lib/davinci_crd_test_kit/client/jwt_expiration.rb` and a spec (`spec/davinci_crd_test_kit/client/v2.2.1/auth/token_payload_exp_at_request_time_spec.rb`) that covers a token valid at request time but expired since (passes), a token already expired at request time (fails), and the clock skew allowance. The existing token payload specs still pass. The v2.0.1 test loads no requests, so it is left for the maintainers to decide.

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Clear run: CRD 2026-11-15 on PR #81, 1.2.4.4.04 (order-sign) failed while the same test passed for the five other hooks. Order-sign was the first hook in the run, so the most time passed between its request and its auth group. Clear signs five minute tokens (MET-1693). The validator's message was not kept in results.json, so the cause is probable, not proven: confirm on the next CRD run before filing, and paste the message into step 4.
- Spec checked with the skill's reproduce step: 3 examples, 3 failures on `86be7f4`; 3 examples, 0 failures on the branch. The kit's v2.2.1 auth specs (59 examples) pass on the branch.
