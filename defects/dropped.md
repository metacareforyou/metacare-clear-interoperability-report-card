# Suspected defects we did not confirm

These were suspected during the runs. We checked each against the kit source and the guide packages and could not confirm it, so there is no draft. They are kept here so nobody files them by mistake.

## DTR 2.2.0 intendedUse bound to CRD 2.1.0 DocReason (checked 2026-11-15)

**Suspicion.** DTR 2.2.0 binds QuestionnaireResponse `intendedUse` to the CRD 2.1.0 DocReason value set (code system `CodeSystem/temp`), while the PAS kit validates under CRD 2.2.1, which renamed that code system to `coverage-information-codes`. If so, no coding could pass PAS request Bundle validation.

**What we found.** The suspicion is wrong:

- In the published `hl7.fhir.us.davinci-dtr#2.2.0` package, `StructureDefinition-intendedUse.json` binds `Extension.value[x]` (required) to `http://hl7.org/fhir/us/davinci-crd/ValueSet/DocReason|2.2.1`, in both the differential and the snapshot. DTR 2.2.0 depends on `hl7.fhir.us.davinci-crd` 2.2.1.
- CRD 2.2.1 DocReason includes `withpa`, `withclaim`, `withorder` and `retain-doc` from `CodeSystem/coverage-information-codes` (under `_docReason`).
- The PAS kit validates with `hl7.fhir.us.davinci-pas#2.2.1`, which also depends on CRD 2.2.1.

So DTR and the PAS kit agree: `coverage-information-codes` `withpa` is the coding to send.

**Clear side.** Clear sends two codings for `intendedUse`: `coverage-information-codes` `withpa` and `CodeSystem/temp` `withpa`. Under CRD 2.2.1, `CodeSystem/temp` exists but has no `withpa` code, so the second coding is an unknown code in a known code system, which the validator can report as an error. Clear should send only the `coverage-information-codes` coding. This is a Clear change, not a kit or guide defect.
