// The lead relay: the demo's stand-in for a website backend.
//
// The storefront is a static site, so it has no server of its own. In a real
// deployment the brand's web backend receives the form post and calls the
// Dengage REST API from its fixed egress IP. This function plays that backend
// for the demo: it receives the typed lead, stores it in the ni_web_lead
// table, and upserts the contact into Dengage over the documented REST calls
// (POST /rest/login, then POST /rest/bulk/contacts) as soon as API user
// credentials are configured as secrets. Until then every lead is stored with
// dengage_status 'pending api user', so nothing is lost while the account
// side is prepared.
//
// Secrets read at runtime, all optional until the account side is ready:
//   DENGAGE_API_USERKEY   the API user's key (Settings > Users, API user)
//   DENGAGE_API_PASSWORD  its password
//   DENGAGE_API_BASE      defaults to https://api.dengage.com/rest
//   DENGAGE_EGRESS_PROXY  optional, http://user:pass@host:port. When set,
//                         every Dengage call tunnels through this proxy, so
//                         the address Dengage sees is the proxy machine's
//                         fixed IP instead of this platform's rotating pool.
//                         tools/vps-egress-setup.sh builds such a proxy on
//                         any small Ubuntu server; runbook section 1a has
//                         the whole story. TLS stays end to end: a CONNECT
//                         proxy relays encrypted bytes it cannot read.
//
// This endpoint is public by design, like any lead form handler. It defends
// itself with input validation, size caps and a per address rate cap rather
// than a shared browser token, because a token shipped inside a public page
// is not a secret.

const ALLOWED_ORIGINS = new Set([
  'https://dengage-presales.github.io',
  'http://localhost:8101',
]);
const FORMS = new Set(['booking', 'quote', 'register_interest']);
const API_BASE = Deno.env.get('DENGAGE_API_BASE') ?? 'https://api.dengage.com/rest';
const EGRESS_PROXY = Deno.env.get('DENGAGE_EGRESS_PROXY') ?? '';
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

/* Deno.createHttpClient is how a fetch is routed through a CONNECT proxy in
   this runtime. It sits outside the stable type surface, so it is reached
   through a loose binding; the runtime provides it. */
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

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://dengage-presales.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}

function reply(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });
}

// A short lived token cache so the function honors Dengage's guidance that
// logging in before every call is wrong.
let tokenCache: { value: string; expiresAt: number } | null = null;

async function dengagePost(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
    // deno-lint-ignore no-explicit-any
    client: egress() as any,
  } as RequestInit);
  const text = await res.text();
  let data: unknown = null;
  try { data = JSON.parse(text); } catch { /* non JSON error body */ }
  return { ok: res.ok, status: res.status, data, text };
}

async function dengageToken(userkey: string, password: string): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.value;
  const res = await dengagePost('/login', { userkey, password });
  if (!res.ok) throw new Error(`login failed with HTTP ${res.status}: ${res.text.slice(0, 300)}`);
  const body = res.data as { access_token?: string; expires_in?: number };
  if (!body?.access_token) throw new Error('login returned no token');
  tokenCache = {
    value: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return tokenCache.value;
}

// Saudi mobile normalization, light touch: digits only, the local leading
// zero swapped for the country code. Anything else passes through as typed,
// because inventing digits would be worse than storing what was given.
function normalizeGsm(raw: string): string {
  const digits = raw.replace(/\D+/g, '').slice(0, 20);
  if (/^05\d{8}$/.test(digits)) return '966' + digits.slice(1);
  if (/^5\d{8}$/.test(digits)) return '966' + digits;
  return digits;
}

const seen = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (seen.get(ip) ?? []).filter((t) => now - t < 600000);
  stamps.push(now);
  seen.set(ip, stamps);
  return stamps.length > 30;
}

function clean(value: unknown, max = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().slice(0, max);
  return v || undefined;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });

  // The health line: open the function URL in a browser and it reports the
  // IP its calls currently leave from (the address Dengage's IP restriction
  // sees) and whether the API user secrets are visible to it. No secret
  // values are ever returned.
  if (req.method === 'GET') {
    let egressIp = 'unknown';
    try {
      const opts = {
        signal: AbortSignal.timeout(5000),
        // deno-lint-ignore no-explicit-any
        client: egress() as any,
      } as RequestInit;
      egressIp = (await (await fetch('https://api.ipify.org', opts)).text()).trim().slice(0, 60);
    } catch (err) {
      egressIp = 'unreachable: ' + String(err).slice(0, 120);
    }
    return reply({
      egress_ip: egressIp,
      egress_proxy_configured: !!EGRESS_PROXY,
      api_user_configured: !!(Deno.env.get('DENGAGE_API_USERKEY') && Deno.env.get('DENGAGE_API_PASSWORD')),
      api_base: API_BASE,
    }, 200, origin);
  }

  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405, origin);

  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) return reply({ error: 'too many requests' }, 429, origin);

  let raw: Record<string, unknown>;
  try { raw = await req.json(); } catch { return reply({ error: 'body must be JSON' }, 400, origin); }

  const lead = {
    contact_key: clean(raw.contact_key, 48),
    title: clean(raw.title, 30),
    name: clean(raw.name, 100),
    surname: clean(raw.surname, 100),
    email: clean(raw.email)?.toLowerCase(),
    gsm: clean(raw.gsm) ? normalizeGsm(clean(raw.gsm)!) : undefined,
    model: clean(raw.model, 60),
    city: clean(raw.city, 60),
    purchase_horizon: clean(raw.purchase_horizon, 60),
    form: clean(raw.form, 30),
    page_url: clean(raw.page_url, 500),
    utm_source: clean(raw.utm_source, 100),
    utm_medium: clean(raw.utm_medium, 100),
    utm_campaign: clean(raw.utm_campaign, 100),
    marketing_consent: raw.marketing_consent === true,
  };

  if (!lead.contact_key || !/^DPS-[A-Za-z0-9_-]{1,44}$/.test(lead.contact_key)) {
    return reply({ error: 'contact_key must be a DPS- demo key' }, 400, origin);
  }
  if (!lead.form || !FORMS.has(lead.form)) return reply({ error: 'unknown form' }, 400, origin);
  if (!lead.email && !lead.gsm) return reply({ error: 'a lead needs an email or a phone' }, 400, origin);
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return reply({ error: 'email does not look like an address' }, 400, origin);
  }

  // 1. Store the lead first, so a Dengage side failure never loses it.
  const insert = await fetch(`${SB_URL}/rest/v1/ni_web_lead`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'apikey': SB_KEY,
      'authorization': `Bearer ${SB_KEY}`,
      'prefer': 'return=representation',
    },
    body: JSON.stringify({ ...lead, dengage_status: 'received' }),
  });
  if (!insert.ok) return reply({ error: 'could not store the lead' }, 502, origin);
  const [row] = await insert.json();

  // 2. Push the contact into Dengage when the API user exists.
  const userkey = Deno.env.get('DENGAGE_API_USERKEY');
  const password = Deno.env.get('DENGAGE_API_PASSWORD');
  let status = 'pending api user';
  let detail = 'store only: DENGAGE_API_USERKEY and DENGAGE_API_PASSWORD are not set';

  if (userkey && password) {
    try {
      const token = await dengageToken(userkey, password);
      const core: Record<string, unknown> = { contact_key: lead.contact_key };
      if (lead.name) core.name = lead.name;
      if (lead.surname) core.surname = lead.surname;
      if (lead.email) {
        core.email = lead.email;
        core.email_permission = lead.marketing_consent;
      }
      if (lead.gsm) {
        core.gsm = lead.gsm;
        core.gsm_permission = lead.marketing_consent;
      }
      /* The relational split, the demo owner's call of 30 August: identity
         and reachability live on the contact, while the behavioral answers
         (preferred model, purchase horizon, title) stay on the lead's
         related rows in ni_lead_events and ni_web_lead, where segmentation
         reaches them through the contact relation. city rides along only
         because the contact table already carries that column. The retry
         below keeps the core contact safe if that ever changes. */
      const extras: Record<string, unknown> = {};
      if (lead.city) extras.city = lead.city;

      const push = (record: Record<string, unknown>) => dengagePost('/bulk/contacts', {
        columns: Object.keys(record),
        contactDatas: [record],
        insertIfNotExists: true,
        throwExceptionIfInvalidRecord: false,
      }, token);
      /* The result arrays sit under a data envelope:
         { code, message, data: { inserted, updated, errors, warnings } }.
         The envelope-free shape is read too, in case it ever appears. */
      type Arrays = { inserted?: unknown[]; updated?: unknown[]; errors?: unknown[] };
      const readArrays = (d: unknown) => {
        const b = d as (Arrays & { data?: Arrays }) | null;
        return b?.data ?? b;
      };

      let res = await push({ ...core, ...extras });
      let arrays = readArrays(res.data);
      let droppedWhy = '';
      if ((!res.ok || arrays?.errors?.length) && Object.keys(extras).length) {
        droppedWhy = (res.text || 'no answer').slice(0, 240);
        res = await push(core);
        arrays = readArrays(res.data);
      }
      if (!res.ok) {
        status = `error HTTP ${res.status}`;
        detail = res.text.slice(0, 500);
      } else if (arrays?.errors?.length) {
        status = 'rejected';
        detail = JSON.stringify(arrays.errors).slice(0, 500);
      } else {
        status = (arrays?.inserted?.length ? 'contact inserted' : 'contact updated') +
          (droppedWhy ? ', profile fields dropped' : '');
        detail = droppedWhy
          ? 'a contact column was refused. The full push answered: ' + droppedWhy
          : res.text.slice(0, 500);
      }
    } catch (err) {
      status = 'error';
      detail = String(err).slice(0, 500);
    }
  }

  await fetch(`${SB_URL}/rest/v1/ni_web_lead?id=eq.${row.id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'apikey': SB_KEY, 'authorization': `Bearer ${SB_KEY}` },
    body: JSON.stringify({ dengage_status: status, dengage_detail: detail }),
  });

  return reply({ stored: true, dengage: status }, 200, origin);
});
