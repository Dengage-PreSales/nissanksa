// Seeds the eight demo personas into master_contact over the REST API, the
// same eight rows panel/personas.csv holds for a manual Audience import. Run
// it once (POST, empty body) and DPS-1 to DPS-8 carry name, surname, email,
// mobile, city and consent, so the contacts list reads like people instead
// of bare keys. It is idempotent: rerunning re-asserts the same values.
//
// Deliberately safe for a public endpoint: it reads nothing from the caller,
// performs one fixed upsert of these eight demo records and a read back of
// DPS-1, and is rate capped. It reuses the same secrets and fixed egress
// proxy as the lead relay. It never deletes anything.

const API_BASE = Deno.env.get('DENGAGE_API_BASE') ?? 'https://api.dengage.com/rest';
const EGRESS_PROXY = Deno.env.get('DENGAGE_EGRESS_PROXY') ?? '';

const PERSONAS = [
  { contact_key: 'DPS-1', name: 'Ahmed', surname: 'Al-Rashid', email: 'ahmed.alrashid@nissanksa-demo.example', gsm: '966555100001', city: 'Riyadh' },
  { contact_key: 'DPS-2', name: 'Sara', surname: 'Al-Qahtani', email: 'sara.alqahtani@nissanksa-demo.example', gsm: '966555100002', city: 'Jeddah' },
  { contact_key: 'DPS-3', name: 'Mohammed', surname: 'Al-Harbi', email: 'mohammed.alharbi@nissanksa-demo.example', gsm: '966555100003', city: 'Riyadh' },
  { contact_key: 'DPS-4', name: 'Noura', surname: 'Al-Otaibi', email: 'noura.alotaibi@nissanksa-demo.example', gsm: '966555100004', city: 'Dammam' },
  { contact_key: 'DPS-5', name: 'Khalid', surname: 'Al-Ghamdi', email: 'khalid.alghamdi@nissanksa-demo.example', gsm: '966555100005', city: 'Riyadh' },
  { contact_key: 'DPS-6', name: 'Fatima', surname: 'Al-Zahrani', email: 'fatima.alzahrani@nissanksa-demo.example', gsm: '966555100006', city: 'Makkah' },
  { contact_key: 'DPS-7', name: 'Omar', surname: 'Al-Shehri', email: 'omar.alshehri@nissanksa-demo.example', gsm: '966555100007', city: 'Khobar' },
  { contact_key: 'DPS-8', name: 'Layla', surname: 'Al-Mutairi', email: 'layla.almutairi@nissanksa-demo.example', gsm: '966555100008', city: 'Jeddah' },
].map((p) => ({ ...p, email_permission: true, gsm_permission: true }));

// deno-lint-ignore no-explicit-any
const D = Deno as any;
// deno-lint-ignore no-explicit-any
let egressClient: any = null;
function egress(): unknown {
  if (!EGRESS_PROXY) return undefined;
  if (!egressClient) {
    const u = new URL(EGRESS_PROXY);
    egressClient = D.createHttpClient({
      proxy: {
        url: `${u.protocol}//${u.host}`,
        ...(u.username
          ? { basicAuth: { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) } }
          : {}),
      },
    });
  }
  return egressClient;
}

async function dengage(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
    // deno-lint-ignore no-explicit-any
    client: egress() as any,
  } as RequestInit);
  const text = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch { /* non JSON body */ }
  return { ok: res.ok, status: res.status, data, text };
}

const seen = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (seen.get(ip) ?? []).filter((t) => now - t < 600000);
  stamps.push(now);
  seen.set(ip, stamps);
  return stamps.length > 5;
}

Deno.serve(async (req: Request) => {
  const headers = { 'content-type': 'application/json' };
  if (req.method === 'GET') {
    return new Response(JSON.stringify({
      what: 'POST with an empty body seeds the eight DPS demo personas into master_contact. Idempotent, fixed data, nothing deleted.',
      api_user_configured: !!(Deno.env.get('DENGAGE_API_USERKEY') && Deno.env.get('DENGAGE_API_PASSWORD')),
      egress_proxy_configured: !!EGRESS_PROXY,
    }), { status: 200, headers });
  }
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers });

  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) return new Response(JSON.stringify({ error: 'too many requests' }), { status: 429, headers });

  const userkey = Deno.env.get('DENGAGE_API_USERKEY');
  const password = Deno.env.get('DENGAGE_API_PASSWORD');
  if (!userkey || !password) {
    return new Response(JSON.stringify({ error: 'API user secrets are not set' }), { status: 503, headers });
  }

  const login = await dengage('POST', '/login', { userkey, password });
  const token = (login.data as { access_token?: string } | null)?.access_token;
  if (!token) {
    return new Response(JSON.stringify({ error: 'login failed', answer: login.text.slice(0, 300) }), { status: 502, headers });
  }

  const upsert = await dengage('POST', '/bulk/contacts', {
    columns: ['contact_key', 'name', 'surname', 'email', 'email_permission', 'gsm', 'gsm_permission', 'city'],
    contactDatas: PERSONAS,
    insertIfNotExists: true,
    throwExceptionIfInvalidRecord: false,
  }, token);

  // A 200 means accepted, not stored, so read one persona back as the proof.
  const readback = await dengage('GET',
    '/contacts/DPS-1?contactFields=contact_key,name,surname,email,gsm,city', undefined, token);
  const contact = ((readback.data as { data?: { contacts?: Record<string, unknown>[] } } | null)?.data?.contacts ?? [])[0];

  return new Response(JSON.stringify({
    upsert_answer: upsert.text.slice(0, 600),
    stored_readback_dps1: contact ?? 'not found',
  }), { status: upsert.ok ? 200 : 502, headers });
});
