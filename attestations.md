# Inferno attestations: what Clear supports today

This is MetaCare's audit of every attestation the Inferno CRD, DTR and PAS client suites ask of Clear. It was made against Clear `develop` at `9662487` (2026-11-15). Clear's source is private; file paths and line numbers refer to it. Ticket ids such as MET-1717 are MetaCare's internal tracker ids for each gap.

No attestation has been signed. Every attestation result in this repository was released by script from Clear's recorded state and has not been confirmed by a person.

Kits: CRD `86be7f4` (`crd_client_v221`), DTR `14dde0e` (`dtr_full_ehr_v220`), PAS `1db14e7` (`davinci_pas_client_suite_v221`).

The audit's columns:

- **Verdict.** Supported: Clear does what the attestation says. Partly or Not supported: a known gap; the attestation is answered "No" (the test fails) until its ticket is done.
- **Steps before signing, or ticket.** For a Supported row, what the person signing must do and see on screen first. Only a row marked Supported is signed, and only after the signer has done its steps. For any other row, the internal ticket for the gap.

How to see a screen: open Clear on the conformance run's stack, pick the case, and use the Requirements, Evidence, Submission and Timeline tabs. Switch roles with "Demo identity" (Jordan Lee, Specialist; Alex Morgan, Clinician). The case is the one the Inferno wait names; the synthetic orders are `SYN-CLEAR-V1-<scenario>`.

Requirement texts are in each kit's requirements CSV (`lib/<kit>/requirements/`). Test numbers are those of the SMART Backend Services run; the UDAP run repeats the PAS groups at 8 and the no-auth option at 12.

## CRD 2.2.1

| Test | Attestation (short) | Requirements | Verdict | Evidence | Steps before signing, or ticket |
|---|---|---|---|---|---|
| 1.1.02 | Inferno's CRD servers registered as trusted, tied to a payer, granted US Core read and search | cds-hooks 174 | Supported | CRD route records the CDS client (packages/core/cds-client.mjs); payer client `crd-payer-<slug>` in Keycloak gets `patient/<type>.rs` for the US Core types (packages/core/crd-payer.mjs line 7 and 8); wall PRs metacare-home-recovery 990 and 991 merged | Open each of the two cases on the Requirements tab: the route line reads "CDS Hooks client <run issuer>". In the local Keycloak admin, open client `crd-payer-inferno` and check its scopes. Open `/api/davinci/cases/<case>/journal` and check the hook request's `fhirAuthorization.scope` |
| 1.2.1.2.01 | appointment-book cards shown | resp-49 | Partly | No screen starts this hook; result shows only as "last order hook"; card detail and links not shown (apps/web/DaVinciReference.jsx line 78 to 81) | MET-1717 |
| 1.2.2.2.01 | encounter-start cards shown | resp-49 | Not supported | Result stored in `state.crdHooks`, never shown | MET-1717 |
| 1.2.3.2.01 | order-select cards shown | resp-49 | Partly | Indicator, summary and source shown; detail, links, suggestions and coverage details not shown | MET-1717 |
| 1.2.4.2.01 | order-sign cards shown | resp-49 | Partly | Same as 1.2.3.2.01 | MET-1717 |
| 1.2.5.2.01 | order-dispatch cards shown | resp-49 | Partly | Same as 1.2.1.2.01 | MET-1717 |
| 1.2.6.2.01 | encounter-discharge cards shown | resp-49 | Not supported | Same as 1.2.2.2.01 | MET-1717 |
| 1.4.1.2.01 | Cross hook cards shown | resp-49 | Partly | Same gaps | MET-1717 |
| 1.3.1.02 | User can keep working during a long request | found-6 | Partly | Exchange waits up to 20 seconds (apps/api/davinci/http.mjs line 39); panel buttons disabled meanwhile; no "continue without waiting" | MET-1720 |
| 1.3.2.02 | Unknown elements did not stop coverage information | found-33 | Supported | `mapCrdResponse` reads only known fields and ignores the rest (packages/core/davinci-exchange.mjs line 185 to 207) | Run the 1.3.2.01 wait with "Check requirements at signing" on the case. After the kit answers, the Requirements tab must show Outcome "required" (or the kit's value) and "Prior authorization auth-needed", with no error. Sign only if it does |
| 1.3.3.01 | No hook sent for a self-pay order | dev-26-B | Not supported | No self-pay flag anywhere | MET-1719 |
| 1.3.4.01 | Workflow for a patient with two payers | (verified by 1.3.4.02: dev-26-A, dev-28, dev-29-A, dev-30, hook-1) | Not supported | One Coverage and one route per case (apps/api/davinci/service.mjs line 115) | MET-1718 |
| 1.3.5.05 | Prefetch limited to what the user may access (asked only when the target is missing) | cds-hooks 42 | Partly | Prefetch holds only the case's own records; Clear has no per-user access levels, so the limited user scenario cannot be shown | MET-1723 |
| 1.4.2.x | Must support elements not observed: "Clear does not capture or surface them" (asked only for unobserved elements) | none mapped | Decide per element | Not run yet | When asked, attest only for an element Clear truly never captures; otherwise answer No and file a ticket |
| 3.01 | Follows inherited security and privacy rules | sec-1 | Partly | Strong controls exist (HTTPS sandbox routes, signed JWT, SMART, UDAP, scrubbed journals, Provenance); no item by item review; no SMART app launch from cards; loopback HTTP reference routes | MET-1723 |
| 3.02 | Distinguishes response cases | impl-1 | Supported | Timeout, error, no coverage information and not-required each get their own outcome and text (packages/core/davinci-exchange.mjs line 183 to 207) | On case `SYN-CLEAR-V1-unknown` or any case whose route has no order-sign service, run "Check requirements at signing": the tab must say requirements are unknown, not "not required". Then run it on an Inferno route with a coverage information answer and compare. Note: the fixed block above it ("Coverage Indeterminate") is not the payer answer (MET-1717) |
| 3.03 | Uses standard elements, no extra expectations, omissions not errors | conf-10, conf-12, conf-13, found-33 | Supported | Hook requests and prefetch use CRD and US Core elements only; missing optional fields map to unknown, never an error (packages/core/davinci-exchange.mjs `mapCrdResponse`); Inferno request validation passed | Read the latest hook request in `/api/davinci/cases/<case>/journal`: only standard CDS Hooks and FHIR fields. Confirm Clear publishes no payer guidance about where data must go |
| 3.04 | Resource ids unrelated to business identifiers | sec-7 | Not supported | Case id is an unkeyed hash of tenant and order id (packages/core/lifecycle.mjs line 21); every resource id derives from it | MET-1722 |
| 3.05 | Hooks invoked transparently in the workflow | hook-7, hook-8, resp-48 | Partly | No transcription (orders come from the chart or EHR); but every hook is a button, and system action annotations are stored only on ServiceRequest | MET-1721 |
| 3.06 | Multiple payers called in parallel, results shown together | dev-32 | Not supported | Clear never calls more than one payer | MET-1718 |
| 3.07 | Omits a prefetch key it cannot fill | cds-hooks 51 | Supported | Unfillable templates are omitted; "no data" is sent as null (packages/core/crd-prefetch.mjs line 8, 77 to 95) | After a check on the complete prefetch route, the Requirements tab shows "Not sent in advance: <keys>" for any omitted key; confirm in the journal that those keys are absent from `prefetch` |
| 3.08 | Keeps logs of all hook invocations and responses | found-37 | Supported | Every discovery and hook is a journal Task with the scrubbed request and the response (apps/api/davinci/service.mjs line 311 to 317); retention never purges by default (apps/api/retention.mjs). Bodies over 1 MB keep only size and hash | Open `/api/davinci/cases/<case>/journal` for a case checked earlier: each hook shows request and response with timestamps |
| 3.09 | Uses received must support data | conf-6 | Partly | pa-needed and questionnaires drive the case; doc-needed, info-needed, reasons, expiry and card details are not shown | MET-1717 |

## DTR 2.2.0

The kit maps no requirement ids to these tests; the test text points to the DTR Questionnaire profiles and SDC.

| Test | Attestation (short) | Verdict | Evidence | Steps before signing, or ticket |
|---|---|---|---|---|
| 2.1.1.02 | Standard questionnaire rendered, prefilled, completed and stored | Supported | Renderer handles group, string and choice with enableWhen, itemControl and prefill (apps/web/DaVinciReference.jsx line 20 to 107); answers saved as a QuestionnaireResponse | On the case named in the wait: Requirements, "Check requirements at signing"; Evidence, "Load payer documentation"; check every question shows and prefilled answers say "auto"; answer the rest; "Save documentation answers"; "View Questionnaire Response" shows the answers; as Alex Morgan, "Complete clinical review" |
| 2.2.1.02 | Adaptive questionnaire completed and stored | Supported | `davinci-dtr-next` and the "Request next questions" button; payer reports complete | Same case flow; answer, "Request next questions" until the tab says "the payer reports it complete"; then save and view the Questionnaire Response |
| 3.1.1.02 | Must support questionnaires fully supported | Partly | Attachment item cannot be answered; rendering-xhtml shown as plain text | MET-1724 |

## PAS 2.2.1

| Test | Attestation (short) | Requirements | Verdict | Evidence | Steps before signing, or ticket |
|---|---|---|---|---|---|
| 3.1.02 | Shows the request as approved | none mapped | Supported | Submission tab: Request status "decided", Decision "approved", line table with authorization number (apps/web/DaVinciReference.jsx line 123 and 124) | After the kit's approved answer, open the case's Submission tab and read Decision "approved" and each line's status |
| 3.2.02 | Shows the request as denied | none mapped | Supported | Same screen, Decision "denied"; the case moves to denial review | Same, Decision "denied"; check the case header shows the denial |
| 3.3.1.02 | Shows the request as pended | none mapped | Supported | Request status "pended", Decision "none", note "A receipt or pended response is not an approval" | After the pended answer, read the Submission tab |
| 3.3.1.04 | Shows the final decision from the notification as approved | none mapped | Supported | Notification settles the case like `$inquire` (apps/api/davinci/pas-subscriptions.mjs `notify`) | After the kit's notification, reload the Submission tab: Decision "approved". The Subscription is created through the API only (MET-1716) |
| 3.4.1.05 | Claim update responses handled without error | none mapped | Supported | "Send service line update" and "Cancel the whole request" (apps/web/OrderLines.jsx) | Add a line, send the update, then cancel the whole request; each response shows on the Submission tab with no error |
| 3.5.02 | Shows what the payer actually authorized | none mapped | Supported | Line table "Payer action" and "Lines the payer added or substituted" (apps/web/DaVinciReference.jsx line 139 to 146) | Read the modified line and the added line's code, units, period and authorization |
| 3.6.02 | Operation failure: details for technical staff, clinician told it failed | none mapped | Partly | User sees "The payer rejected the request (HTTP 4xx)"; OperationOutcome issues saved but on no screen | MET-1725 |
| 3.7.02 | Processing errors surfaced | none mapped | Supported | Reason lists the ClaimResponse error codes; "Payer errors" list (packages/core/davinci-exchange.mjs line 775) | Read the Submission tab: status "rejected" and each error code |
| 4.1.02 | Must support `$submit` and `$inquire` responses handled | conf-8 | Supported | MET-1710 maps notes, added items and errors | Run the must support scenario cases (`SYN-CLEAR-V1-<scenario>`), submit and "Check request status"; no errors, payer notes shown |
| 4.2.x (attestation option) | Must support elements not observed: Clear does not collect them | hrex-conf-1 | Not asked | Last run observed every element | Nothing to sign unless the kit asks |
| 16.01 | Follows HRex security and privacy | spec-4 | Partly | See CRD 3.01 | MET-1723 |
| 16.02 | No additional data element expectations | conf-14, conf-15, conf-16-A | Supported | Bundle uses PAS profiles; Clear's own systems appear only as identifier systems (packages/core/davinci-exchange.mjs line 522, 528); omissions not errors; Clear publishes no payer data guidance | Inspect a submitted Bundle in the journal; confirm only PAS and US Core elements |
| 16.03 | Allows but does not require provider review | priv-1-A, priv-1-B, use-5 | Not supported | Submission refused without clinician review (packages/core/davinci-exchange.mjs line 804); review checkbox always required (apps/web/DaVinciReference.jsx line 126) | MET-1715 |
| 16.04 | Detects and recovers from Subscription errors | subscriptions 81, 82 | Not supported | No `$status`, `$events`, heartbeat, gap detection or reactivation | MET-1716 |

## Options that ask nothing here

- PAS registration "other authentication" attestation: only for the other auth option. Clear uses SMART Backend Services or UDAP.
- The UDAP kit's client visual inspection group is not part of these three suites.
- DTR and PAS SMART and UDAP token groups have no attestations.
