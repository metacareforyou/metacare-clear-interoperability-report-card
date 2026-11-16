# HL7 Jira: PAS 2.2.1 loads two CRD and two DTR versions through CDex 2.1.0

**Project:** Specification Feedback
**Specification:** Da Vinci Prior Authorization Support (PAS), version 2.2.1 (hl7.fhir.us.davinci-pas#2.2.1)
**Artifact:** Package dependencies (package.json); also affects Da Vinci CDex 2.1.0
**Issue type:** Technical Correction
**Summary:** PAS 2.2.1's dependency on CDex 2.1.0 brings DTR 2.1.0 and CRD 2.1.0 in beside CRD 2.2.1, so a DTR 2.2.0 QuestionnaireResponse cannot pass validation

**Description:**

A PAS 2.2.1 request carries the DTR QuestionnaireResponse that supports it. A client that follows DTR 2.2.0 sends it with the intendedUse extension, bound (required) to CRD DocReason|2.2.1, and the code coverage-information-codes#withpa.

The published package dependencies put two CRD versions, and two DTR versions, in one validation context:

| Package | Depends on |
|---|---|
| hl7.fhir.us.davinci-pas#2.2.1 | davinci-crd#2.2.1, davinci-hrex#1.2.0, davinci-cdex#2.1.0 (no DTR) |
| hl7.fhir.us.davinci-cdex#2.1.0 | davinci-dtr#2.1.0, davinci-pas#2.1.0, davinci-hrex#1.1.0 |
| hl7.fhir.us.davinci-dtr#2.1.0 | davinci-crd#2.1.0, davinci-pas#2.1.0, davinci-hrex#1.1.0 |

The intendedUse extension URL (http://hl7.org/fhir/us/davinci-dtr/StructureDefinition/intendedUse) is unversioned, so the HL7 validator resolves it to the DTR 2.1.0 definition. That binding resolves to CRD 2.1.0's DocReason (CodeSystem/temp codes), while code systems are resolved under CRD 2.2.1, which moved those codes to coverage-information-codes. No coding passes:

- coverage-information-codes#withpa alone: "None of the codings provided are in the value set 'CRD Coverage Information Documentation Reason Value Set' (http://hl7.org/fhir/us/davinci-crd/ValueSet/DocReason|2.1.0)"
- plus CodeSystem/temp#withpa: "Unknown code 'withpa' in the CodeSystem 'http://hl7.org/fhir/us/davinci-crd/CodeSystem/temp' version '2.2.1'"

Loading DTR 2.2.0 as well does not help, because DTR 2.1.0 is still loaded and answers the unversioned URL. This shows in the ONC Inferno PAS test kit (davinci-pas-test-kit v0.16.0); the kit can only work around it by suppressing the message.

**Proposed change:**

Publish PAS with a CDex dependency that does not pull in DTR 2.1.0 and CRD 2.1.0, or align the CDex and DTR dependencies on CRD 2.2.1 and DTR 2.2.0. It would also help if PAS stated which DTR version the QuestionnaireResponse in a PAS 2.2.1 Bundle is expected to follow.

Details: https://github.com/metacareforyou/metacare-clear-interoperability-report-card/blob/main/defects/PAS-01.md

Found while testing a provider system with synthetic data only.
