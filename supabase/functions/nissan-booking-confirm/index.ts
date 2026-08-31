// The confirmation a booking earns, sent through Dengage's transactional API.
//
// A test drive booking on the demo storefront lands in the lead relay first,
// which creates or updates the contact. The page then calls this function,
// which asks Dengage to send the two messages the visitor expects within
// seconds of pressing submit:
//
//   POST /rest/transactional/email   the confirmation email, from content
//                                    authored in the panel
//   POST /rest/transactional/push    the same confirmation as a web push,
//                                    addressed by contact key
//
// Both are separate from the relay on purpose. The lead path is the one thing
// that must never fail, so messaging lives here: if a content id is wrong or
// a send is refused, the lead is already stored and the contact already
// exists, and this function reports the failure without touching either.
//
// The outcome is written back onto the lead's row in ni_web_lead, so the
// question "did the confirmation actually go" is answered by the record
// rather than by an HTTP 200 on the page.
//
// Secrets, all optional, with the demo's own content ids as defaults:
//   DENGAGE_API_USERKEY, DENGAGE_API_PASSWORD   the API user
//   DENGAGE_API_BASE                            defaults to production
//   DENGAGE_EGRESS_PROXY                        the whitelisted egress path
//   DENGAGE_TX_EMAIL_CONTENT_ID                 email content, public id
//   DENGAGE_TX_PUSH_CONTENT_ID                  push content, public id
//   DENGAGE_APP_ID                              the web application guid

const ALLOWED_ORIGINS = new Set([
  'https://dengage-presales.github.io',
  'http://localhost:8101',
]);
const API_BASE = Deno.env.get('DENGAGE_API_BASE') ?? 'https://api.dengage.com/rest';
const EGRESS_PROXY = Deno.env.get('DENGAGE_EGRESS_PROXY') ?? '';
/* One entry per moment the demo can message on. Each names the panel content
   to send; a moment with no content configured is reported as such and sends
   nothing, so a new one goes live by setting its ids rather than by changing
   this code. Booking carries the ids already authored in the panel. */
type Moment = { email: string; push: string; label: string };
const MOMENTS: Record<string, Moment> = {
  booking: {
    label: 'test drive booked',
    email: Deno.env.get('DENGAGE_TX_EMAIL_CONTENT_ID') ?? '2206f32b-8d1a-4058-929c-de600493862a',
    push: Deno.env.get('DENGAGE_TX_PUSH_CONTENT_ID') ?? '91edd42b-2e43-4e61-a8d5-88bf5a5688af',
  },
  abandoned_booking: {
    label: 'booking started and left',
    email: Deno.env.get('DENGAGE_TX_EMAIL_ABANDONED') ?? '',
    push: Deno.env.get('DENGAGE_TX_PUSH_ABANDONED') ?? '',
  },
  quote: {
    label: 'quote requested',
    email: Deno.env.get('DENGAGE_TX_EMAIL_QUOTE') ?? '',
    push: Deno.env.get('DENGAGE_TX_PUSH_QUOTE') ?? '',
  },
  brochure: {
    label: 'specification downloaded',
    email: Deno.env.get('DENGAGE_TX_EMAIL_BROCHURE') ?? '',
    push: Deno.env.get('DENGAGE_TX_PUSH_BROCHURE') ?? '',
  },
  newsletter: {
    label: 'newsletter signup',
    email: Deno.env.get('DENGAGE_TX_EMAIL_NEWSLETTER') ?? '',
    push: Deno.env.get('DENGAGE_TX_PUSH_NEWSLETTER') ?? '',
  },
  survey: {
    label: 'survey answered',
    email: Deno.env.get('DENGAGE_TX_EMAIL_SURVEY') ?? '',
    push: Deno.env.get('DENGAGE_TX_PUSH_SURVEY') ?? '',
  },
  showroom_visit: {
    label: 'walk in logged at the showroom',
    email: Deno.env.get('DENGAGE_TX_EMAIL_WALKIN') ?? '',
    push: Deno.env.get('DENGAGE_TX_PUSH_WALKIN') ?? '',
  },
  test_drive_done: {
    label: 'test drive completed',
    email: Deno.env.get('DENGAGE_TX_EMAIL_TD_DONE') ?? '',
    push: Deno.env.get('DENGAGE_TX_PUSH_TD_DONE') ?? '',
  },
  no_show: {
    label: 'booked but did not arrive',
    email: Deno.env.get('DENGAGE_TX_EMAIL_NOSHOW') ?? '',
    push: Deno.env.get('DENGAGE_TX_PUSH_NOSHOW') ?? 'e974aaf2-4b7c-409c-8a57-91565a226bf3',
  },
};
const APP_ID = Deno.env.get('DENGAGE_APP_ID') ?? '99d9b8fb-0c62-5a85-3e43-2402554d93a5';
const SB_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SB_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

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

let tokenCache: { value: string; expiresAt: number } | null = null;

async function dengagePost(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (token) headers['authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(9000),
    // deno-lint-ignore no-explicit-any
    client: egress() as any,
  } as RequestInit);
  return { ok: res.ok, status: res.status, text: await res.text() };
}

async function dengageToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60000) return tokenCache.value;
  const userkey = Deno.env.get('DENGAGE_API_USERKEY') ?? '';
  const password = Deno.env.get('DENGAGE_API_PASSWORD') ?? '';
  if (!userkey || !password) throw new Error('api user not configured');
  const res = await dengagePost('/login', { userkey, password });
  if (!res.ok) throw new Error(`login failed with HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  const body = JSON.parse(res.text) as { access_token?: string; expires_in?: number };
  if (!body?.access_token) throw new Error('login returned no token');
  tokenCache = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return tokenCache.value;
}

/* What the messages can say about the car, derived here from the model id
   rather than taken from the page, so a request cannot put arbitrary text or
   links into a send. Every value comes from the source site: the three model
   names, the seat counts it publishes, the image it uses on its own range
   page, and the demo's page for that model. The site publishes no prices, so
   there is no price here to quote. */
const DEMO_ORIGIN = 'https://dengage-presales.github.io/nissanksa/lincoln/';
/* The image a message carries is the source site's own banner for that model,
   chosen for the shape a message needs rather than the shape a web page needs:
   1440 by 720, which is the 2:1 a rich push asks for, under 200KB, and JPEG.
   The range page images are portrait or AVIF, and both fail here: a portrait
   crop fills a push badly, and no notification or mail client decodes AVIF. */
const VEHICLES: Record<string, { name: string; seats: number; image: string }> = {
  navigator: { name: 'Navigator', seats: 8, image: 'assets/cms/storage/lincoln_common/navigator-2025/overview/main-banner/desktop/overview-main-banner.jpg' },
  aviator: { name: 'Aviator', seats: 7, image: 'assets/cms/storage/lincoln_common/Aviator-2025/parent-page/main-banner.jpg' },
  corsair: { name: 'Corsair', seats: 5, image: 'assets/cms/storage/lincoln_common/Corsair/parent-page/overview-main-banner_D.jpg' },
};

function vehicleParams(modelId?: string, modelName?: string): Record<string, string> {
  const v = modelId ? VEHICLES[modelId.toLowerCase()] : undefined;
  if (!v) return modelName ? { model: modelName } : {};
  return {
    model: v.name,
    model_id: modelId!.toLowerCase(),
    model_seats: String(v.seats),
    model_category: 'SUV',
    model_url: DEMO_ORIGIN + 'vehicles/' + modelId!.toLowerCase() + '/',
    model_image: DEMO_ORIGIN + v.image,
    booking_url: DEMO_ORIGIN + 'forms/testdrive/?model=' + encodeURIComponent(v.name),
  };
}

const seen = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (seen.get(ip) ?? []).filter((t) => now - t < 600000);
  stamps.push(now);
  seen.set(ip, stamps);
  return stamps.length > 20;
}

function clean(value: unknown, max = 120): string | undefined {
  if (typeof value !== 'string') return undefined;
  const v = value.trim().slice(0, max);
  return v || undefined;
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method === 'GET') {
    return reply({
      moments: Object.fromEntries(Object.entries(MOMENTS).map(([k, m]) => [k, {
        label: m.label,
        email: m.email ? 'configured' : 'needs content',
        push: m.push ? 'configured' : 'needs content',
      }])),
      app_id: APP_ID,
      api_user_configured: !!(Deno.env.get('DENGAGE_API_USERKEY') && Deno.env.get('DENGAGE_API_PASSWORD')),
      egress_proxy_configured: !!EGRESS_PROXY,
    }, 200, origin);
  }
  if (req.method !== 'POST') return reply({ error: 'POST only' }, 405, origin);

  const ip = (req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim();
  if (rateLimited(ip)) return reply({ error: 'too many requests' }, 429, origin);

  let raw: Record<string, unknown>;
  try { raw = await req.json(); } catch { return reply({ error: 'body must be JSON' }, 400, origin); }

  const momentKey = clean(raw.moment, 40) ?? 'booking';
  const moment = MOMENTS[momentKey];
  if (!moment) return reply({ error: 'unknown moment' }, 400, origin);

  const lead = {
    contact_key: clean(raw.contact_key, 48),
    name: clean(raw.name, 100),
    surname: clean(raw.surname, 100),
    email: clean(raw.email, 160)?.toLowerCase(),
    gsm: clean(raw.gsm, 20),
    model: clean(raw.model, 60),
    model_id: clean(raw.model_id, 40),
    booking_ref: clean(raw.booking_ref, 60),
    city: clean(raw.city, 60),
    branch: clean(raw.branch, 120),
    purchase_horizon: clean(raw.purchase_horizon, 60),
  };

  if (!lead.contact_key || !/^DPS-[A-Za-z0-9_-]{1,44}$/.test(lead.contact_key)) {
    return reply({ error: 'contact_key must be a DPS- demo key' }, 400, origin);
  }
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) {
    return reply({ error: 'email does not look like an address' }, 400, origin);
  }

  // The values the panel content can address by name: what the visitor typed,
  // plus everything the demo knows about the car they chose. A field left
  // empty is left out rather than sent blank.
  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(lead)) {
    if (v && k !== 'contact_key' && k !== 'model' && k !== 'model_id') params[k] = v as string;
  }
  Object.assign(params, vehicleParams(lead.model_id, lead.model));
  if (lead.name) params.first_name = lead.name;
  if (lead.name || lead.surname) {
    params.full_name = [lead.name, lead.surname].filter(Boolean).join(' ');
  }

  const out = { email: 'not attempted', push: 'not attempted' };
  const notes: string[] = [];

  try {
    const token = await dengageToken();

    if (lead.email && moment.email) {
      const res = await dengagePost('/transactional/email', {
        send: { to: lead.email, toLanguage: 'EN' },
        content: { templateId: moment.email },
        current: params,
        reporting: { trackOpen: true, trackClick: true },
        tags: ['demo', 'test-drive'],
      }, token);
      out.email = res.ok ? 'sent' : `error HTTP ${res.status}`;
      notes.push('email: ' + res.text.slice(0, 300));
    } else if (!lead.email) {
      out.email = 'no address on this contact';
    } else {
      out.email = 'needs content for ' + momentKey;
    }

    if (moment.push) {
      /* The push API takes no inline title or body: every word comes from the
         saved content, personalized through these two. They carry the same
         values so the content can use whichever tag form it was built with. */
      const res = await dengagePost('/transactional/push', {
        contentId: moment.push,
        contactKey: lead.contact_key,
        appId: APP_ID,
        sendToAll: true,
        language: 'EN',
        current: params,
        customParameters: Object.entries(params).map(([key, value]) => ({ key, value })),
        tags: ['demo', 'test-drive'],
      }, token);
      out.push = res.ok ? 'sent' : `error HTTP ${res.status}`;
      /* The device carries the token, and Dengage keeps it against whichever
         contact key claimed it last. A key that never subscribed, or that has
         been overtaken by a newer session, answers this rather than failing
         silently. */
      if (/Token not found/i.test(res.text)) out.push = 'no device subscribed for this contact';
      notes.push('push: ' + res.text.slice(0, 300));
    } else {
      out.push = 'needs content for ' + momentKey;
    }
  } catch (err) {
    notes.push('failed before sending: ' + String(err).slice(0, 300));
    if (out.email === 'not attempted') out.email = 'error';
    if (out.push === 'not attempted') out.push = 'error';
  }

  // The record, so the outcome outlives the page that asked for it. Only a
  // booking has a row of its own to carry it.
  if (SB_URL && SB_KEY && momentKey === 'booking') {
    try {
      const find = await fetch(
        `${SB_URL}/rest/v1/ni_web_lead?contact_key=eq.${encodeURIComponent(lead.contact_key)}` +
        `&form=eq.booking&order=created_at.desc&limit=1&select=id`,
        { headers: { 'apikey': SB_KEY, 'authorization': `Bearer ${SB_KEY}` } },
      );
      const rows = await find.json();
      if (Array.isArray(rows) && rows[0]?.id) {
        await fetch(`${SB_URL}/rest/v1/ni_web_lead?id=eq.${rows[0].id}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json', 'apikey': SB_KEY, 'authorization': `Bearer ${SB_KEY}` },
          body: JSON.stringify({
            tx_email_status: out.email,
            tx_push_status: out.push,
            tx_detail: notes.join(' | ').slice(0, 900) || null,
          }),
        });
      }
    } catch { /* the sends already happened; the record is a convenience */ }
  }

  return reply({ moment: momentKey, email: out.email, push: out.push,
                 personalized: Object.keys(params).sort() }, 200, origin);
});
