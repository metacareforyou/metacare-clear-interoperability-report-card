// node --test scripts/test
import test from 'node:test';
import assert from 'node:assert/strict';
import { scrubValue, findSecrets } from '../lib/scrub.mjs';

const jwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzeW50aGV0aWMiLCJleHAiOjE3MDAwMDAwMDB9.c2lnbmF0dXJlc2lnbmF0dXJl';

test('removes credentials by key', () => {
  const out = scrubValue({ session: 'abc123', access_token: 'tok', client_secret: 'shh', title: 'Token request' });
  assert.equal(out.session, '[redacted]');
  assert.equal(out.access_token, '[redacted]');
  assert.equal(out.client_secret, '[redacted]');
  assert.equal(out.title, 'Token request');
});

test('removes JWTs, bearer tokens and resume tokens inside text', () => {
  const out = scrubValue({ message: `sent ${jwt} with Bearer abcdefghijkl to https://inferno.example.org/resume_pass?token=xyz123` });
  assert.ok(!out.message.includes('eyJ'));
  assert.ok(!out.message.includes('abcdefghijkl'));
  assert.ok(!out.message.includes('xyz123'));
  assert.deepEqual(findSecrets(JSON.stringify(out)), []);
});

test('removes local addresses and notification keys, including inside embedded JSON', () => {
  const detail = JSON.stringify({ notificationEndpoint: 'http://host.docker.internal:4480/notify/clear-synthetic/pas/fbc280e6ef359400d124179d7c885951', ok: true });
  const out = scrubValue({ detail });
  assert.ok(!out.detail.includes('host.docker.internal'));
  assert.ok(!out.detail.includes('fbc280e6ef359400d124179d7c885951'));
  assert.equal(JSON.parse(out.detail).ok, true);
  assert.deepEqual(findSecrets(JSON.stringify(out)), []);
});

test('keeps synthetic case ids and public URLs', () => {
  const out = scrubValue({ caseId: 'clear-0842f16075cdddb1205aa361', url: 'https://hl7.org/fhir/us/davinci-dtr/2.2.0/' });
  assert.equal(out.caseId, 'clear-0842f16075cdddb1205aa361');
  assert.equal(out.url, 'https://hl7.org/fhir/us/davinci-dtr/2.2.0/');
});

test('finds what was not scrubbed', () => {
  const names = findSecrets(`{"token":"live","x":"${jwt}","y":"http://localhost:4480/api"}`).map((f) => f.name);
  assert.ok(names.includes('JWT'));
  assert.ok(names.includes('private URL'));
  assert.ok(names.some((n) => n.startsWith('credential member')));
});

test('replaces a local URL whole, with no stray brackets', () => {
  const out = scrubValue({ notificationEndpoint: 'http://host.docker.internal:4480/notify/clear-synthetic/pas/fbc280e6ef359400d124179d7c885951' });
  assert.equal(out.notificationEndpoint, '[local url]');
});
