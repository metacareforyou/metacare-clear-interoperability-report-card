# HL7 Jira: crd-ci-q4

**Project:** Specification Feedback
**Specification:** Da Vinci Coverage Requirements Discovery (CRD), version 2.2.1 (hl7.fhir.us.davinci-crd#2.2.1)
**Artifact:** StructureDefinition ext-coverage-information (Coverage Information extension), invariant crd-ci-q4
**URL:** https://hl7.org/fhir/us/davinci-crd/2.2.1/StructureDefinition-ext-coverage-information.html
**Issue type:** Technical Correction
**Summary:** crd-ci-q4 evaluates to empty, so fails, for pa-needed auth-needed with doc-purpose withpa

**Description:**

The invariant crd-ci-q4 ("If 'pa-needed' is 'satisfied', 'noauth', or 'not-covered', then 'Doc-purpose' cannot be 'withpa'.") is:

    extension.where(url = 'pa-needed' and (value = 'satisfied' or value = 'noauth' or value = 'not-covered')) and extension.where(url = 'doc-purpose').exists() implies extension.where(url = 'doc-purpose').all(value != 'withpa')

The first operand of `and` is a collection, not a boolean. When pa-needed is not one of the listed values, that collection is empty, so the `and` is empty, and `empty implies false` is empty. Validators treat an invariant that is not true as failed. So the invariant fails for pa-needed auth-needed with doc-purpose withpa, the ordinary "prior authorization needed, send documentation with the request" answer.

The expression also tests 'noauth', but the code in CodeSystem coverage-information-codes is no-auth, so no-auth with withpa (which the invariant is meant to forbid) is empty rather than false.

Evaluated with fhirpath.js 3.15.2 and its R4 model, on an ext-coverage-information extension with coverage, covered = covered, date and coverage-assertion-id:

| pa-needed | doc-purpose | crd-ci-q4 today | proposed |
|---|---|---|---|
| auth-needed | withpa | empty (fails) | true |
| auth-needed | withorder | true | true |
| auth-needed | absent | true | true |
| no-auth | withpa | empty | false |
| satisfied | withpa | false | false |
| satisfied | withorder | true | true |

Reproduction script: https://github.com/metacareforyou/metacare-clear-interoperability-report-card/blob/main/defects/repro/crd-ci-q4.mjs

**Proposed change:**

    (extension.where(url = 'pa-needed' and (value = 'satisfied' or value = 'no-auth' or value = 'not-covered')).exists() and extension.where(url = 'doc-purpose').exists()) implies extension.where(url = 'doc-purpose').all(value != 'withpa')

and in the human description, no-auth instead of noauth.

Found while testing a provider system with synthetic data only.
