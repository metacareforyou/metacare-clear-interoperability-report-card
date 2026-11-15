// Scrubbing and scanning for published results.
//
// Results come from local Inferno runs against Clear on synthetic data. They hold no patient
// data, but run logs can carry credentials and local addresses: bearer tokens, signed JWTs,
// client secrets, Inferno resume tokens, session cookies, notification keys and private URLs.
// scrubValue removes them; findSecrets reports anything that is still there, so a publish fails
// instead of leaking.

const REDACTED = '[redacted]';
const LOCAL_URL = '[local url]';

// Keys whose values are credentials, whatever they look like.
const SECRET_KEY = /(^|_|-)(token|secret|password|passwd|cookie|authorization|assertion|api[_-]?key|private[_-]?key|client[_-]?secret|access[_-]?token|refresh[_-]?token|id[_-]?token|session|bearer)s?$/i;

// Hosts that only exist on the machine or network the run happened on.
const PRIVATE_HOST =
  '(?:localhost|127\\.\\d+\\.\\d+\\.\\d+|0\\.0\\.0\\.0|host\\.docker\\.internal|[a-z0-9-]+\\.internal|[a-z0-9-]+\\.local|10\\.\\d+\\.\\d+\\.\\d+|192\\.168\\.\\d+\\.\\d+|172\\.(?:1[6-9]|2\\d|3[01])\\.\\d+\\.\\d+|\\[?::1\\]?)';
const PRIVATE_URL = new RegExp(`\\b[a-z][a-z0-9+.-]*://${PRIVATE_HOST}(?::\\d+)?[^\\s"'<>()\\[\\]]*`, 'gi');

const PATTERNS = [
  // A signed or unsigned JWT: three base64url segments, the first a JSON header.
  { name: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g },
  { name: 'bearer token', re: /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi },
  { name: 'basic credentials', re: /\bBasic\s+[A-Za-z0-9+/=]{12,}/g },
  { name: 'PEM key', re: /-----BEGIN [A-Z ]*(PRIVATE KEY|CERTIFICATE)-----[\s\S]*?(-----END [A-Z ]*-----|$)/g },
  { name: 'token query parameter', re: /([?&](?:token|access_token|code|state|client_secret|session_path)=)[^&\s"']+/gi },
  { name: 'cookie header', re: /\b(Set-Cookie|Cookie)\s*:\s*[^\n"]+/gi },
  { name: 'Clear notification key', re: /(\/notify\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+\/)[A-Fa-f0-9]{16,}/g },
  { name: 'cloud key', re: /\b(AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|gh[pousr]_[A-Za-z0-9]{30,}|sk-[A-Za-z0-9_-]{20,}|xox[abpr]-[A-Za-z0-9-]{10,})\b/g },
  // The private part of a JSON Web Key.
  { name: 'private JWK member', re: /"(d|p|q|dp|dq|qi)"\s*:\s*"[A-Za-z0-9_-]{20,}"/g }
];

function scrubString(value) {
  // Local URLs go first and whole, so a key inside one goes with it.
  let out = value.replace(PRIVATE_URL, LOCAL_URL);
  out = out.replace(PATTERNS[0].re, REDACTED);
  out = out.replace(PATTERNS[1].re, `Bearer ${REDACTED}`);
  out = out.replace(PATTERNS[2].re, `Basic ${REDACTED}`);
  out = out.replace(PATTERNS[3].re, REDACTED);
  out = out.replace(PATTERNS[4].re, `$1${REDACTED}`);
  out = out.replace(PATTERNS[5].re, `$1: ${REDACTED}`);
  out = out.replace(PATTERNS[6].re, `$1${REDACTED}`);
  out = out.replace(PATTERNS[7].re, REDACTED);
  out = out.replace(PATTERNS[8].re, `"$1":"${REDACTED}"`);
  return out;
}

// Strings inside results are sometimes JSON documents themselves (a script release's detail).
// Scrub them as JSON so secret keys inside are found too, then write them back as strings.
function scrubEmbeddedJson(value) {
  const trimmed = value.trim();
  if (!(trimmed.startsWith('{') || trimmed.startsWith('['))) return null;
  try {
    return JSON.stringify(scrubValue(JSON.parse(trimmed)));
  } catch {
    return null;
  }
}

export function scrubValue(value, key = '') {
  if (typeof value === 'string') {
    if (key && SECRET_KEY.test(key) && value.length > 0) return REDACTED;
    return scrubEmbeddedJson(value) ?? scrubString(value);
  }
  if (Array.isArray(value)) return value.map((item) => scrubValue(item, key));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = scrubValue(v, k);
    return out;
  }
  return value;
}

// Every remaining match in a text. privateUrls: also report local addresses (on for results,
// off for prose, where a reproduction names https://localhost on purpose).
export function findSecrets(text, { privateUrls = true } = {}) {
  const findings = [];
  for (const { name, re } of PATTERNS) {
    for (const match of text.matchAll(new RegExp(re.source, re.flags))) {
      if (match[0].includes(REDACTED)) continue;
      findings.push({ name, sample: match[0].slice(0, 60) });
    }
  }
  if (privateUrls) {
    for (const match of text.matchAll(new RegExp(PRIVATE_URL.source, PRIVATE_URL.flags))) {
      findings.push({ name: 'private URL', sample: match[0].slice(0, 60) });
    }
  }
  // A JSON member that names a credential and still has a value.
  for (const match of text.matchAll(/"([A-Za-z_-]+)"\s*:\s*"([^"]+)"/g)) {
    if (SECRET_KEY.test(match[1]) && match[2] !== REDACTED) {
      findings.push({ name: `credential member "${match[1]}"`, sample: match[0].slice(0, 60) });
    }
  }
  return findings;
}
