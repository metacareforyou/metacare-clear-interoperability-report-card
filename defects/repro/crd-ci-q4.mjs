// Reproduction for HL7-CRD-01: evaluate CRD 2.2.1 invariant crd-ci-q4 on synthetic extensions.
//
//   npm install --no-save fhirpath@3.15.2
//   node defects/repro/crd-ci-q4.mjs
import fhirpath from 'fhirpath';
import r4 from 'fhirpath/fhir-context/r4/index.js';

const published = "extension.where(url = 'pa-needed' and (value = 'satisfied' or value = 'noauth' or value = 'not-covered')) and extension.where(url = 'doc-purpose').exists() implies extension.where(url = 'doc-purpose').all(value != 'withpa')";
const proposed = "(extension.where(url = 'pa-needed' and (value = 'satisfied' or value = 'no-auth' or value = 'not-covered')).exists() and extension.where(url = 'doc-purpose').exists()) implies extension.where(url = 'doc-purpose').all(value != 'withpa')";

const coverageInformation = (paNeeded, docPurpose) => ({
  url: 'http://hl7.org/fhir/us/davinci-crd/StructureDefinition/ext-coverage-information',
  extension: [
    { url: 'coverage', valueReference: { reference: 'Coverage/synthetic-coverage' } },
    { url: 'covered', valueCode: 'covered' },
    ...(paNeeded ? [{ url: 'pa-needed', valueCode: paNeeded }] : []),
    ...(docPurpose ? [{ url: 'doc-purpose', valueCode: docPurpose }] : []),
    { url: 'date', valueDate: '2026-11-15' },
    { url: 'coverage-assertion-id', valueString: 'synthetic-assertion-1' }
  ]
});

const show = (result) => (result.length ? String(result[0]) : 'empty');
for (const [paNeeded, docPurpose] of [
  ['auth-needed', 'withpa'], ['auth-needed', 'withorder'], ['auth-needed', null],
  ['no-auth', 'withpa'], ['satisfied', 'withpa'], ['satisfied', 'withorder']
]) {
  const extension = coverageInformation(paNeeded, docPurpose);
  console.log(`pa-needed=${paNeeded} doc-purpose=${docPurpose ?? 'absent'}: published ${show(fhirpath.evaluate(extension, published, null, r4))}, proposed ${show(fhirpath.evaluate(extension, proposed, null, r4))}`);
}
