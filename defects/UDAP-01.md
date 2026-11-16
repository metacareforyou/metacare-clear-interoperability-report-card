---
id: UDAP-01
title: UDAP client token request verification fails a valid five minute client assertion as expired, because it checks exp when the test runs
target: inferno-framework/udap-security-test-kit
target_kind: github
kit: udap-security-test-kit v0.12.2 (pulled in by davinci-pas-test-kit v0.16.0 at 1db14e7 and davinci-dtr-test-kit v0.18.1 at 14dde0e)
kit_commit: ba81acba089444f4c0e34a545d599d57ff8f6ab9
suite: davinci_pas_client_suite_v221, UDAP B2B client credentials option (also any client suite that reuses udap_client_token_request_cc_verification)
tests: 15.01 udap_client_token_request_cc_verification (PAS UDAP option)
status: filed 2026-11-16, approved by Richard Braman
fork_branch: https://github.com/metacareforyou/udap-security-test-kit/tree/fix/token-assertion-exp-at-request-time
spec: spec/udap_security_test_kit/token_assertion_exp_at_request_time_spec.rb
spec_image: metacare-inferno-pas:1db14e7 (with bundle install)
filed_url: https://github.com/inferno-framework/udap-security-test-kit/issues/52
found_in: results/pas-udap/2026-11-15
---

# UDAP-01: the token request check judges the client assertion's exp at test time

<!-- issue:start -->
**Kit:** udap-security-test-kit v0.12.2, commit `ba81acb`. We met it through davinci-pas-test-kit v0.16.0, suite `davinci_pas_client_suite_v221`, UDAP B2B client credentials option. davinci-dtr-test-kit v0.18.1 uses the same version.

**Test:** `udap_client_token_request_cc_verification`, "Verify UDAP Token Requests" (15.01 in the PAS client suite).

### What happens

The test runs after the workflow groups, often many minutes after the client's token requests. It checks each client assertion's timing against the time the request arrived (`check_jwt_timing` with `token_request.created_at`), which is right. But it also verifies the signature with `JWT.decode` and expiration verification on, which checks `exp` against the time the test runs.

UDAP limits a client assertion to five minutes (`exp` at most five minutes after `iat`). So a conformant assertion that was valid when it arrived fails:

> Signature validation failed on token request 1: .../jwt-3.2.0/lib/jwt/claims/expiration.rb:24 Signature has expired (JWT::ExpiredSignature)

### Expected

Token request verification judges `exp` against the time the request arrived, as `check_jwt_timing` already does, and the signature check reports only signature and certificate problems.

### Reproduction

1. Run a client suite that uses `udap_client_token_request_cc_verification`, for example `davinci_pas_client_suite_v221` with UDAP B2B client credentials.
2. Have the client request a token with an assertion whose `exp` is `iat` plus 300 seconds, and use the token in a workflow group.
3. Run the auth group more than five minutes after the token request.
4. The test fails with the message above.

### Cause

- `lib/udap_security_test_kit/client_suite/token_request_verification.rb` line 178: `check_jwt_signature` calls `MockUDAPServer.udap_token_signature_verification`.
- `lib/udap_security_test_kit/endpoints/mock_udap_server.rb` lines 239 to 268: that calls `UDAPJWTValidator.validate_signature`.
- `lib/udap_security_test_kit/udap_jwt_validator.rb` lines 5 to 11: `JWT.decode(jwt, key, true, algorithm:)`, with expiration verification on by default.
- `lib/udap_security_test_kit/client_suite/token_request_verification.rb` line 118 already checks `iat` and `exp` against the request time.

### Proposed fix

Give the signature helpers a `verify_expiration:` keyword that defaults to `true`, so the mock token endpoint still rejects expired assertions when they arrive. Pass `verify_expiration: false` from `check_jwt_signature` in the verification test, which already checks timing against the request time.

A branch with this change and a spec (`spec/udap_security_test_kit/token_assertion_exp_at_request_time_spec.rb`) is at https://github.com/metacareforyou/udap-security-test-kit/tree/fix/token-assertion-exp-at-request-time. The spec checks that an expired assertion is still rejected by default, that its signature passes with expiration turned off, and that the verification test turns it off. The kit's full spec suite passes on the branch (216 examples, 0 failures).

This is the same class of problem as the CRD kit's CDS Hooks token payload check, which also judges `exp` when the test runs.

The fix branch is based on the pinned commit named above, not on `main`. We are glad to rebase it onto `main` and open a pull request if that helps.

Our results and the full list of defects we found are in our interoperability report card: https://github.com/metacareforyou/metacare-clear-interoperability-report-card (this one is [UDAP-01](https://github.com/metacareforyou/metacare-clear-interoperability-report-card/blob/main/defects/UDAP-01.md)).

Found while testing a provider system with synthetic data only.
<!-- issue:end -->

## Notes for MetaCare (not filed)

- Clear run: PAS UDAP option on PR #84 at 355fcda, 2026-11-15, session t666Ptxj0N. 15.01 failed with the message above. Clear's assertion lives five minutes, as UDAP recommends.
- The DTR UDAP run's 5.01 failure is attributed to DTR-02 (`aud`). Once DTR-02 is fixed, the same expiration check may also show there.
- The quoted message is from the session above; the full gem path in it is cut to `.../jwt-3.2.0/...`.
- Spec checked against v0.12.2: 3 examples, 2 failures there (the default rejection still passes); 3 examples, 0 failures on the branch.
- Related: CRD-01.
