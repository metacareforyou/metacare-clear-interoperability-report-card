# Suspected defects we did not confirm

Suspected defects that we checked and could not confirm are kept here, so nobody files them by mistake.

## PAS-02: X12 889 and 886 value sets not suppressed (retracted 2026-11-16)

**Suspicion.** The PAS v2.2.1 suites suppress unverifiable membership errors for some X12-only value sets but not for `X12278FollowUpActionCodes` (X12 889) or `X12278ReviewDecisionReasonCode` (X12 886). In session koGjRfOrkbj, 4.1.04 and 4.1.06 skipped with "None of the codings provided are in the value set 'X12 278 Follow Up Action Value Set'".

**What we found.** It was our environment, not the kit. The host validator keeps a terminology cache on disk (`$TMPDIR/default-tx-cache`). 13 of its 27 files held tx.fhir.org error replies ("The cache ... expired: it went 32 minutes without being used"), and every later run replayed them, even after the validator restarted. With that folder moved aside, the unmodified kit passed 4.1.04 and 4.1.06 with no skips (session k6Q6wtOpO6t, 2026-11-16).

The suppression list is as the source shows, but with a working terminology server the kit does not need entries for these value sets. The fork branch `fix/v221-suppress-x12-889-886-value-sets` is kept as a record and is not needed. Nothing was filed.


## Reinstated: DTR intendedUse and the CRD version (PAS-01)

On 2026-11-15 we first dropped the suspicion that DTR intendedUse could not pass PAS request validation. We had read the DTR 2.2.0 package, which binds `intendedUse` to `DocReason|2.2.1`, and concluded the PAS kit would agree.

That was wrong. Two PAS kit runs the same day showed what the kit's validator actually does. With `coverage-information-codes` `withpa` alone, it reports the coding is not in `DocReason|2.1.0`. With `CodeSystem/temp` `withpa` added, it reports `withpa` unknown in `CodeSystem/temp` version 2.2.1. No coding passes. The defect is now [PAS-01](PAS-01.md).
