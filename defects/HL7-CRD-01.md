---
id: HL7-CRD-01
title: CRD 2.2.1 invariant crd-ci-q4 is empty, so fails, for auth-needed with doc-purpose withpa
target: HL7 Jira, Da Vinci CRD (hl7.fhir.us.davinci-crd 2.2.1), with a note to inferno-framework/davinci-crd-test-kit
target_kind: hl7-jira
kit: hl7.fhir.us.davinci-crd 2.2.1, StructureDefinition ext-coverage-information
kit_commit: none (published guide package)
suite: any validation of ext-coverage-information under CRD 2.2.1
tests: any test that validates a resource carrying ext-coverage-information (CRD responses, and the DTR and PAS resources that carry it)
status: drafted, not filed
fork_branch: none
spec: defects/repro/crd-ci-q4.mjs
spec_image: none
filed_url:
found_in: guide review
---

# HL7-CRD-01: crd-ci-q4 evaluates to empty in the most common case

<!-- issue:start -->
**Guide:** Da Vinci Coverage Requirements Discovery 2.2.1 (`hl7.fhir.us.davinci-crd#2.2.1`), extension `ext-coverage-information`.

**Invariant:** `crd-ci-q4`, "If 'pa-needed' is 'satisfied', 'noauth', or 'not-covered', then 'Doc-purpose' cannot be 'withpa'."

```
extension.where(url = 'pa-needed' and (value = 'satisfied' or value = 'noauth' or value = 'not-covered'))
  and extension.where(url = 'doc-purpose').exists()
  implies extension.where(url = 'doc-purpose').all(value != 'withpa')
```

### What happens

The first operand of `and` is a collection, not a boolean. When `pa-needed` is not one of the listed values, that collection is empty, so `and` gives empty (FHIRPath three valued logic: empty and true is empty). Then `empty implies false` is empty. A validator reports an invariant that does not evaluate to true as failed.

So the invariant fails exactly when `pa-needed` is `auth-needed` and `doc-purpose` is `withpa`. That is the ordinary "prior authorization needed, send documentation with the request" answer, and the invariant is not meant to restrict it.

There is a second problem in the same expression: it tests `'noauth'`, but the code in `coverage-information-codes` is `no-auth`. So `no-auth` with `withpa`, which the invariant is meant to forbid, is not caught as false either (it is also empty).

Evaluated with fhirpath.js and the R4 model, on an `ext-coverage-information` extension with `coverage`, `covered` `covered`, `date` and `coverage-assertion-id`:

| pa-needed | doc-purpose | crd-ci-q4 today | proposed |
|---|---|---|---|
| auth-needed | withpa | empty (fails) | true |
| auth-needed | withorder | true | true |
| auth-needed | absent | true | true |
| no-auth | withpa | empty (fails) | false |
| satisfied | withpa | false | false |
| satisfied | withorder | true | true |

### Expected

The invariant is true for `pa-needed` `auth-needed` with `doc-purpose` `withpa`, and false for `pa-needed` `satisfied`, `no-auth` or `not-covered` with `doc-purpose` `withpa`.

### Reproduction

Validate any resource carrying this extension under `hl7.fhir.us.davinci-crd#2.2.1` with the HL7 validator:

```json
{
  "url": "http://hl7.org/fhir/us/davinci-crd/StructureDefinition/ext-coverage-information",
  "extension": [
    { "url": "coverage", "valueReference": { "reference": "Coverage/example" } },
    { "url": "covered", "valueCode": "covered" },
    { "url": "pa-needed", "valueCode": "auth-needed" },
    { "url": "doc-purpose", "valueCode": "withpa" },
    { "url": "date", "valueDate": "2026-11-15" },
    { "url": "coverage-assertion-id", "valueString": "example-1" }
  ]
}
```

The validator treats an invariant that evaluates to empty as not met, so it reports `crd-ci-q4` for this extension. The table above comes from evaluating the published and proposed expressions with fhirpath.js 3.15.2 and its R4 model.

### Proposed fix

Make the antecedent boolean and use the right code:

```
(extension.where(url = 'pa-needed' and (value = 'satisfied' or value = 'no-auth' or value = 'not-covered')).exists()
  and extension.where(url = 'doc-purpose').exists())
  implies extension.where(url = 'doc-purpose').all(value != 'withpa')
```

The human description could also say `no-auth` instead of `noauth`.
<!-- issue:end -->

## Notes for the kit maintainers (draft, not filed)

The Inferno CRD kit validates against CRD 2.2.1, so any coverage-information it validates with `pa-needed` `auth-needed` and `doc-purpose` `withpa` reports a `crd-ci-q4` error until HL7 fixes the guide. Until then the kit could exclude `crd-ci-q4` messages, as kits already exclude other known guide errors, and point to the HL7 ticket.

## Notes for MetaCare (not filed)

- Target is HL7 Jira, not GitHub. The `inferno-issue` skill drafts the Jira text but does not file in Jira; a person with an HL7 Jira account files it.
- We have not yet run this example through the HL7 validator itself. Do that before filing and paste its message into the reproduction.
- Reproduction script: `defects/repro/crd-ci-q4.mjs` (fhirpath.js 3.15.2 with its R4 model). Its output matches the table. Rerun it before filing.
- Clear carries the payer's coverage-information on its DTR and PAS resources (MET-1696), so this affects Clear's PAS validation whenever a payer answers auth-needed with withpa.
