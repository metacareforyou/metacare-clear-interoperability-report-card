# Suspected defects we did not confirm

Suspected defects that we checked and could not confirm are kept here, so nobody files them by mistake.

None at present.

## Reinstated: DTR intendedUse and the CRD version (PAS-01)

On 2026-11-15 we first dropped the suspicion that DTR intendedUse could not pass PAS request validation. We had read the DTR 2.2.0 package, which binds `intendedUse` to `DocReason|2.2.1`, and concluded the PAS kit would agree.

That was wrong. Two PAS kit runs the same day showed what the kit's validator actually does. With `coverage-information-codes` `withpa` alone, it reports the coding is not in `DocReason|2.1.0`. With `CodeSystem/temp` `withpa` added, it reports `withpa` unknown in `CodeSystem/temp` version 2.2.1. No coding passes. The defect is now [PAS-01](PAS-01.md).
