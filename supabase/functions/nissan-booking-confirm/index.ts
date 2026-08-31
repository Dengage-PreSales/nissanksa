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
// It answers the storefront directly, without a project key, because the page
// that calls it is public and carries none. What keeps it safe is that it
// accepts nothing but a demo contact key and a known moment, sends only
// content the panel already holds, and derives every link and image itself.
//
// Secrets, all optional, with the demo's own content ids as defaults:
//   DENGAGE_API_USERKEY, DENGAGE_API_PASSWORD   the API user
//   DENGAGE_API_BASE                            defaults to production
//   DENGAGE_EGRESS_PROXY                        the whitelisted egress path
//   DENGAGE_TX_EMAIL_CONTENT_ID                 email content, public id
//   DENGAGE_TX_PUSH_CONTENT_ID                  push content, public id
//   DENGAGE_APP_ID                              the web application guid
//
// Every other moment reads one variable per channel, named in the table at the
// top of panel/lincoln/README.md alongside the content it expects. A moment
// with no id configured sends nothing and says so, so a new one goes live by
// setting two variables rather than by changing this file.
//
// TWO DEMOS SHARE THIS. Each page sends the brand it belongs to and the reply
// names it back. They share every push content, because that copy names no
// dealer and only the values differ; the newsletter is the one exception and
// is held back for Nissan until it has its own. Email bodies are never shared:
// they carry a dealer name and a footer, so Nissan reads its own ids from
// DENGAGE_TX_EMAIL_NI_*, and a moment without one reports that it needs
// content rather than sending a visitor to the wrong showroom.

const ALLOWED_ORIGINS = new Set([
  'https://dengage-presales.github.io',
  'http://localhost:8101',
]);
const API_BASE = Deno.env.get('DENGAGE_API_BASE') ?? 'https://api.dengage.com/rest';
const EGRESS_PROXY = Deno.env.get('DENGAGE_EGRESS_PROXY') ?? '';
/* One entry per moment the demo can message on, each naming the panel content
   it sends. All ten are authored, and the public ids sit here as the defaults
   so this file is the record of what is wired: a variable overrides one
   without a deploy, and a moment whose id is emptied reports that it needs
   content and sends nothing rather than failing quietly. */
type Moment = { email: string; push: string; label: string };
const MOMENTS: Record<string, Moment> = {
  booking: {
    label: 'test drive booked',
    email: Deno.env.get('DENGAGE_TX_EMAIL_CONTENT_ID') ?? 'a632eb00-198c-4b3a-8a99-cdd85004b04f',
    push: Deno.env.get('DENGAGE_TX_PUSH_CONTENT_ID') ?? '34a70f7e-4671-4ed9-a482-ae78e5308188',
  },
  abandoned_booking: {
    label: 'booking started and left',
    email: Deno.env.get('DENGAGE_TX_EMAIL_ABANDONED') ?? 'e8bc5bcb-3c27-412c-bd85-1d79ffc35e62',
    push: Deno.env.get('DENGAGE_TX_PUSH_ABANDONED') ?? '7a1aa595-ff4c-498a-b032-c9b11954ab69',
  },
  quote: {
    label: 'quote requested',
    email: Deno.env.get('DENGAGE_TX_EMAIL_QUOTE') ?? '24ee6574-0f5c-4c31-a11a-f663e8102c33',
    push: Deno.env.get('DENGAGE_TX_PUSH_QUOTE') ?? '4bd7ad89-547f-40bc-aef5-d81cf46b9473',
  },
  brochure: {
    label: 'specification downloaded',
    email: Deno.env.get('DENGAGE_TX_EMAIL_BROCHURE') ?? '9c4bf361-46be-465a-bfdd-8da6d9378a03',
    push: Deno.env.get('DENGAGE_TX_PUSH_BROCHURE') ?? '6ccb441d-9513-4d4f-a852-99debe03362d',
  },
  newsletter: {
    label: 'newsletter signup',
    email: Deno.env.get('DENGAGE_TX_EMAIL_NEWSLETTER') ?? '214ee3c1-9a5a-4355-a8a4-8ce3f6af905e',
    push: Deno.env.get('DENGAGE_TX_PUSH_NEWSLETTER') ?? 'f8672856-8a11-4d4f-92ab-e036739e2423',
  },
  survey: {
    label: 'survey answered',
    email: Deno.env.get('DENGAGE_TX_EMAIL_SURVEY') ?? '926586f0-de55-47cb-b08e-4103f965ce8c',
    push: Deno.env.get('DENGAGE_TX_PUSH_SURVEY') ?? 'dd33859f-3f41-49ec-86ba-0f42dbf5397f',
  },
  showroom_visit: {
    label: 'walk in logged at the showroom',
    email: Deno.env.get('DENGAGE_TX_EMAIL_WALKIN') ?? '6e03aa30-978b-48d7-816b-54a8f895207b',
    push: Deno.env.get('DENGAGE_TX_PUSH_WALKIN') ?? '9fa61c0c-e033-4644-977f-b6198bb6e759',
  },
  test_drive_done: {
    label: 'test drive completed',
    email: Deno.env.get('DENGAGE_TX_EMAIL_TD_DONE') ?? '32906767-2cf1-4eb0-8d28-027b0bf1af33',
    push: Deno.env.get('DENGAGE_TX_PUSH_TD_DONE') ?? '818a45fa-da5e-4846-9fca-0e41ba159cc7',
  },
  inbox_message: {
    label: 'a message waiting in the app inbox',
    /* The inbox message is a notification and nothing else: there is no
       email counterpart to it. */
    email: '',
    push: Deno.env.get('DENGAGE_TX_PUSH_INBOX') ?? '31aab9e8-1aa8-4ddd-9346-58d06e1f5a2d',
  },
  no_show: {
    label: 'booked but did not arrive',
    email: Deno.env.get('DENGAGE_TX_EMAIL_NOSHOW') ?? '356e1d8d-4aa2-42a1-9596-951e0afd988d',
    push: Deno.env.get('DENGAGE_TX_PUSH_NOSHOW') ?? 'e974aaf2-4b7c-409c-8a57-91565a226bf3',
  },
};
/* The Nissan demo's own email bodies, one per moment. They cannot be shared
   with Lincoln: an email carries a dealer name and a footer, and telling a
   Nissan visitor about Mohamed Yousuf Naghi Motors would be worse than sending
   nothing. A moment with no id here reports that it needs content. */
const NISSAN_EMAIL: Record<string, string> = {
  booking: Deno.env.get('DENGAGE_TX_EMAIL_NI_BOOKING') ?? '',
  quote: Deno.env.get('DENGAGE_TX_EMAIL_NI_QUOTE') ?? '',
  brochure: Deno.env.get('DENGAGE_TX_EMAIL_NI_BROCHURE') ?? '',
  newsletter: Deno.env.get('DENGAGE_TX_EMAIL_NI_NEWSLETTER') ?? '',
  survey: Deno.env.get('DENGAGE_TX_EMAIL_NI_SURVEY') ?? '',
  showroom_visit: Deno.env.get('DENGAGE_TX_EMAIL_NI_WALKIN') ?? '',
  test_drive_done: Deno.env.get('DENGAGE_TX_EMAIL_NI_TD_DONE') ?? '',
  no_show: Deno.env.get('DENGAGE_TX_EMAIL_NI_NOSHOW') ?? '',
  abandoned_booking: Deno.env.get('DENGAGE_TX_EMAIL_NI_ABANDONED') ?? '',
};
/* Push content Nissan needs of its own. Everything absent here falls back to
   the shared content, because that copy names no dealer. */
const NISSAN_PUSH: Record<string, string> = {
  newsletter: Deno.env.get('DENGAGE_TX_PUSH_NI_NEWSLETTER') ?? '',
};
const PUSH_NAMES_A_DEALER = new Set(['newsletter']);

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

/* What the messages can say about the car, derived here from the brand and
   the model id rather than taken from the page, so a request cannot put
   arbitrary text or links into a send. Every value comes from the source site
   each demo was built from: the model names, the figures those sites publish,
   the imagery they use, and the demo's own page for that model.

   Two demos share this function. They share the push content too, because that
   copy names no dealer and only the values below change between them. The
   email bodies do not share: they carry a dealer name and a footer, so each
   brand has its own. */
type Vehicle = { name: string; category: string; seats?: number; price?: number; image?: string; path?: string };
type Brand = { origin: string; form: string; stands_in: string; image?: string; vehicles: Record<string, Vehicle> };

const BRANDS: Record<string, Brand> = {
  lincoln: {
    origin: 'https://dengage-presales.github.io/nissanksa/lincoln/',
    form: 'forms/testdrive/',
    stands_in: 'Lincoln',
    /* Used when no car is in play. The brand's own concept interior, which
       belongs to no single model. */
    image: 'assets/cms/storage/lincoln_common/100-years-of-lincoln/header-background-image.jpg',
    /* The banner each message carries is the source site's own, chosen for the
       shape a message needs rather than the shape a web page needs: 1440 by
       720, which is the 2:1 a rich push asks for, under 200KB, and JPEG. The
       range page images are portrait or AVIF, and both fail here: a portrait
       crop fills a push badly, and no notification or mail client decodes AVIF.
       The site publishes no prices, so there is no price here to quote. */
    vehicles: {
      navigator: { name: 'Navigator', category: 'SUV', seats: 8, image: 'assets/cms/storage/lincoln_common/navigator-2025/overview/main-banner/desktop/overview-main-banner.jpg' },
      aviator: { name: 'Aviator', category: 'SUV', seats: 7, image: 'assets/cms/storage/lincoln_common/Aviator-2025/parent-page/main-banner.jpg' },
      corsair: { name: 'Corsair', category: 'SUV', seats: 5, image: 'assets/cms/storage/lincoln_common/Corsair/parent-page/overview-main-banner_D.jpg' },
    },
  },
  nissan: {
    origin: 'https://dengage-presales.github.io/nissanksa/',
    form: 'book-a-test-drive/',
    stands_in: 'Nissan',
    /* No image, deliberately. That capture carries a 300 pixel side shot per
       model, far too small for a message, and wide banners that cannot be
       attributed to one model. Sending the wrong car's photograph is worse
       than sending none, so a Nissan message carries no picture until the
       dealer supplies per model art. Every other value personalizes. */
    vehicles: {
      /* Starting prices as the source site published them on 28 August 2026.
         The Tekton is announced without one, so it carries none rather than an
         invented figure. The NISMO has no page of its own in this build and
         routes to the Patrol, exactly as its card does. */
      'magnite': { name: 'Magnite', category: 'SUV', price: 69999 },
      'kicks': { name: 'Kicks', category: 'SUV', price: 89599 },
      'x-trail': { name: 'X-Trail', category: 'SUV', price: 104999 },
      'x-terra': { name: 'X-Terra', category: 'SUV', price: 118999 },
      'pathfinder': { name: 'Pathfinder', category: 'SUV', price: 164999 },
      'patrol': { name: 'Patrol', category: 'SUV', price: 270999 },
      'patrol-pro4x': { name: 'Patrol PRO-4X', category: 'SUV', price: 380999 },
      'patrol-nismo': { name: 'Patrol NISMO', category: 'SUV', price: 450999, path: 'patrol' },
      'altima': { name: 'Altima', category: 'Sedan', price: 112700 },
      'z': { name: 'Z', category: 'Sports', price: 261999 },
      'tekton': { name: 'Tekton', category: 'SUV' },
    },
  },
};

function vehicleParams(brandKey: string, modelId?: string, modelName?: string): Record<string, string> {
  const b = BRANDS[brandKey] ?? BRANDS.lincoln;
  const id = modelId ? modelId.toLowerCase() : '';
  const v = id ? b.vehicles[id] : undefined;
  /* These four resolve whatever the moment carries. A notification that
     renders a gap where the model should be is the one failure a visitor sees
     before anything else, so the brand name stands in for an unknown model and
     the links fall back to the range and the unfiltered form. Everything else
     stays optional and is only ever printed inside a condition, because a
     city, a showroom or a purchase horizon has no honest stand in. */
  const out: Record<string, string> = {
    model: v ? v.name : (modelName || b.stands_in),
    model_url: b.origin + (v ? 'vehicles/' + (v.path ?? id) + '/' : ''),
    booking_url: b.origin + b.form + (v ? '?model=' + encodeURIComponent(v.name) : ''),
  };
  if (v) {
    out.model_id = id;
    out.model_category = v.category;
    if (v.seats) out.model_seats = String(v.seats);
    if (v.price) out.model_price = 'SAR ' + v.price.toLocaleString('en-US');
    if (v.image) out.model_image = b.origin + v.image;
  }
  if (!out.model_image && b.image) out.model_image = b.origin + b.image;
  return out;
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
        lincoln: (m.email ? 'email' : 'no email') + ', ' + (m.push ? 'push' : 'no push'),
        nissan: (NISSAN_EMAIL[k] ? 'email' : 'no email') + ', ' +
          ((NISSAN_PUSH[k] || (!PUSH_NAMES_A_DEALER.has(k) && m.push)) ? 'push' : 'no push'),
      }])),
      brands: Object.keys(BRANDS),
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
  /* Which demo is asking. Lincoln by default, because it asked first and its
     pages were sending before this field existed. */
  const brandKey = (clean(raw.brand, 20) ?? 'lincoln').toLowerCase();
  if (!BRANDS[brandKey]) return reply({ error: 'unknown brand' }, 400, origin);
  const emailId = brandKey === 'nissan' ? (NISSAN_EMAIL[momentKey] ?? '') : moment.email;
  /* The push copy names no dealer, so one content serves both demos and only
     the values change. The newsletter is the one exception: its copy names the
     dealer it welcomes you to, so it does not carry over, and the moment
     reports that it needs content until Nissan has its own. */
  const pushId = brandKey === 'nissan'
    ? (NISSAN_PUSH[momentKey] ?? (PUSH_NAMES_A_DEALER.has(momentKey) ? '' : moment.push))
    : moment.push;

  const lead = {
    contact_key: clean(raw.contact_key, 48),
    name: clean(raw.name, 100),
    surname: clean(raw.surname, 100),
    email: clean(raw.email, 160)?.toLowerCase(),
    gsm: clean(raw.gsm, 20),
    model: clean(raw.model, 60),
    model_id: clean(raw.model_id, 40),
    booking_ref: clean(raw.booking_ref, 60),
    device_token: clean(raw.device_token, 400),
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
    if (v && k !== 'contact_key' && k !== 'model' && k !== 'model_id' && k !== 'device_token') {
      params[k] = v as string;
    }
  }
  Object.assign(params, vehicleParams(brandKey, lead.model_id, lead.model));
  if (lead.name) params.first_name = lead.name;
  if (lead.name || lead.surname) {
    params.full_name = [lead.name, lead.surname].filter(Boolean).join(' ');
  }

  const out = { email: 'not attempted', push: 'not attempted' };
  const notes: string[] = [];

  try {
    const token = await dengageToken();

    if (lead.email && emailId) {
      const res = await dengagePost('/transactional/email', {
        send: { to: lead.email, toLanguage: 'EN' },
        content: { templateId: emailId },
        current: params,
        reporting: { trackOpen: true, trackClick: true },
        tags: ['demo', brandKey, momentKey],
      }, token);
      out.email = res.ok ? 'sent' : `error HTTP ${res.status}`;
      notes.push('email: ' + res.text.slice(0, 300));
    } else if (!lead.email) {
      out.email = 'no address on this contact';
    } else {
      out.email = 'needs content for ' + momentKey;
    }

    if (pushId) {
      /* The push API takes no inline title or body: every word comes from the
         saved content, personalized through these two. They carry the same
         values so the content can use whichever tag form it was built with. */
      /* Every push is also kept in the app inbox. There is no REST call that
         posts to the inbox on its own: the inbox API reads and reports, and a
         message gets there by being sent with these parameters. So the drawer
         in the storefront fills as the notifications arrive, and a visitor who
         missed one, or who never allowed notifications, still finds it. */
      const inboxParams = {
        enabled: true,
        expire: { type: 'PERIOD', period: 30, periodType: 'DAY' },
      };
      const res = await dengagePost('/transactional/push', {
        contentId: pushId,
        contactKey: lead.contact_key,
        appId: APP_ID,
        sendToAll: true,
        language: 'EN',
        current: params,
        customParameters: Object.entries(params).map(([key, value]) => ({ key, value })),
        inboxParams,
        tags: ['demo', brandKey, momentKey],
      }, token);
      out.push = res.ok ? 'sent' : `error HTTP ${res.status}`;
      notes.push('push: ' + res.text.slice(0, 300));
      /* Dengage keeps a device token against whichever contact key claimed it
         last, so a key the device has not claimed yet reaches nothing. When
         the page told us which token it holds, the same message goes to that
         device directly, which is what a demo needs: the contact is still the
         right way to address a person, and this is the safety net. */
      if (/Token not found/i.test(res.text)) {
        out.push = 'no device subscribed for this contact';
        if (lead.device_token) {
          const direct = await dengagePost('/transactional/push', {
            contentId: pushId,
            token: lead.device_token,
            appId: APP_ID,
            language: 'EN',
            current: params,
            customParameters: Object.entries(params).map(([key, value]) => ({ key, value })),
            inboxParams,
            tags: ['demo', brandKey, momentKey],
          }, token);
          out.push = direct.ok ? 'sent to this device by token' : `error HTTP ${direct.status}`;
          notes.push('push by token: ' + direct.text.slice(0, 300));
        }
      }
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

  return reply({ brand: brandKey, moment: momentKey, email: out.email, push: out.push,
                 personalized: Object.keys(params).sort() }, 200, origin);
});
