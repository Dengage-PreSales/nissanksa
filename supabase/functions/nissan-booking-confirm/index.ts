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
  reserve: {
    label: 'build reserved online',
    email: Deno.env.get('DENGAGE_TX_EMAIL_RESERVE') ?? '',
    push: Deno.env.get('DENGAGE_TX_PUSH_RESERVE') ?? '89cd42ba-f865-45c6-9199-ede892c20de5',
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
  booking: Deno.env.get('DENGAGE_TX_EMAIL_NI_BOOKING') ?? 'dec3ece6-27d2-4af3-8e30-a55467a2f062',
  quote: Deno.env.get('DENGAGE_TX_EMAIL_NI_QUOTE') ?? 'dcaeee6f-b081-45e1-b8e5-820bf2a22dc3',
  brochure: Deno.env.get('DENGAGE_TX_EMAIL_NI_BROCHURE') ?? '37e8f7d3-fba3-4ddb-943a-4562f1cacbd3',
  newsletter: Deno.env.get('DENGAGE_TX_EMAIL_NI_NEWSLETTER') ?? 'cdcc5c30-d3a2-4888-bf29-c3e95eea2326',
  survey: Deno.env.get('DENGAGE_TX_EMAIL_NI_SURVEY') ?? '3b8dfca0-3eab-421b-8638-83e4c2130f6f',
  showroom_visit: Deno.env.get('DENGAGE_TX_EMAIL_NI_WALKIN') ?? '5cdb125c-c6ef-46d1-a6a6-4eca5ee98b1b',
  test_drive_done: Deno.env.get('DENGAGE_TX_EMAIL_NI_TD_DONE') ?? '0cb0cca5-6075-4597-a0a2-57ad294e9c87',
  no_show: Deno.env.get('DENGAGE_TX_EMAIL_NI_NOSHOW') ?? 'ef795652-635f-4d75-bf04-fef0f4012637',
  abandoned_booking: Deno.env.get('DENGAGE_TX_EMAIL_NI_ABANDONED') ?? '04176817-3ef1-438a-a80c-c7819850734b',
  reserve: Deno.env.get('DENGAGE_TX_EMAIL_NI_RESERVE') ?? 'd8d3f627-f970-4067-abf7-63362d428825',
};
/* Push content Nissan needs of its own. Everything absent here falls back to
   the shared content, because that copy names no dealer. */
const NISSAN_PUSH: Record<string, string> = {
  newsletter: Deno.env.get('DENGAGE_TX_PUSH_NI_NEWSLETTER') ?? '50fdb66e-d894-4f6a-b4ce-da9a4a850e91',
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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

/* WHAT DENGAGE CALLS A SUCCESS, and why the HTTP status is not it.
   Every transactional endpoint answers HTTP 200 for a refusal as well as for a
   send, and puts the real outcome in the body: {transactionId, code, message,
   data}, where code 0 is Successful and anything else is not. Reading only
   res.ok therefore reported a push as sent whenever Dengage accepted the
   request and then declined to deliver it, which is the one failure a demo
   cannot see from the room. Recorded on 1 September 2026 from a live send:
   code 11 is "Token not found with given ContactKey", the normal state for a
   device that has not claimed this contact yet, and the one refusal with a
   second path worth trying.
   A body that is not JSON is read as accepted, because the endpoint has always
   answered with this envelope and the raw text is kept in the record either
   way; inventing a failure from an unfamiliar shape would be worse. */
type Answer = { sent: boolean; code: number; message: string };
function outcome(res: { ok: boolean; status: number; text: string }): Answer {
  if (!res.ok) return { sent: false, code: -1, message: `HTTP ${res.status}` };
  try {
    const body = JSON.parse(res.text) as { code?: number; message?: string };
    const code = typeof body.code === 'number' ? body.code : 0;
    return { sent: code === 0, code, message: body.message ?? '' };
  } catch {
    return { sent: true, code: 0, message: '' };
  }
}
function refused(a: Answer): string {
  return a.code === -1 ? `error ${a.message}` : `refused by Dengage: ${a.message || 'code ' + a.code}`;
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
type Brand = { origin: string; form: string; contact: string; stands_in: string; image?: string; vehicles: Record<string, Vehicle> };

const BRANDS: Record<string, Brand> = {
  lincoln: {
    origin: 'https://dengage-presales.github.io/nissanksa/lincoln/',
    form: 'forms/testdrive/',
    contact: 'contact-us/',
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
    contact: 'find-a-showroom/',
    stands_in: 'Nissan',
    /* One photograph per model, added 1 September. The first pass carried
       none: the catalogue side shots are 300 pixels wide, far too small for a
       notification, and the obvious large image on a model page is as often an
       interior or a lane assist diagram as it is the car. Sending the wrong
       car's photograph is worse than sending none, so each of these was picked
       by eye from that model's own page and re-encoded to 1200 pixels of JPEG
       at assets/img/msg-<model>.jpg, which every push and mail client renders.
       The NISMO has none: no shot of it was captured, and the Patrol's would
       be a different car. */
    vehicles: {
      /* Starting prices as the source site published them on 28 August 2026.
         The Tekton is announced without one, so it carries none rather than an
         invented figure. The NISMO has no page of its own in this build and
         routes to the Patrol, exactly as its card does. */
      'magnite': { name: 'Magnite', category: 'SUV', price: 69999, image: 'assets/img/msg-magnite.jpg' },
      'kicks': { name: 'Kicks', category: 'SUV', price: 89599, image: 'assets/img/msg-kicks.jpg' },
      'x-trail': { name: 'X-Trail', category: 'SUV', price: 104999, image: 'assets/img/msg-x-trail.jpg' },
      'x-terra': { name: 'X-Terra', category: 'SUV', price: 118999, image: 'assets/img/msg-x-terra.jpg' },
      'pathfinder': { name: 'Pathfinder', category: 'SUV', price: 164999, image: 'assets/img/msg-pathfinder.jpg' },
      'patrol': { name: 'Patrol', category: 'SUV', price: 270999, image: 'assets/img/msg-patrol.jpg' },
      'patrol-pro4x': { name: 'Patrol PRO-4X', category: 'SUV', price: 380999, image: 'assets/img/msg-patrol-pro4x.jpg' },
      'patrol-nismo': { name: 'Patrol NISMO', category: 'SUV', price: 450999, path: 'patrol' },
      'altima': { name: 'Altima', category: 'Sedan', price: 112700, image: 'assets/img/msg-altima.jpg' },
      'z': { name: 'Z', category: 'Sports', price: 261999, image: 'assets/img/msg-z.jpg' },
      'tekton': { name: 'Tekton', category: 'SUV', image: 'assets/img/msg-tekton.jpg' },
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
    /* Where a message sends someone who wants to talk rather than book. It is
       a parameter rather than a URL typed into the content because the push
       contents are shared between the two demos: a Lincoln address written
       into one of them would send a Nissan visitor to the other demo, which is
       what it did until 2 September. */
    contact_url: b.origin + b.contact,
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


/* THE STOREFRONT MESSAGE CENTRE, and why it is here rather than in Dengage.

   Dengage's own App Inbox is filled by a campaign and by nothing else. There
   is no endpoint that puts a message in it, transactional sends are documented
   as unavailable for that channel, and a campaign is evaluated on a schedule,
   so the drawer cannot answer the moment a visitor acts. Measured on
   1 September 2026: two transactional pushes at a contact holding twenty inbox
   messages left the count at twenty.

   So the demo carries its own inbox, and treats it as a channel rather than
   as a receipt for the other two. Every moment lands in it the instant it is
   raised, the same way the email and the push go out, which is the behaviour
   a production build would have with a real time inbox behind it. Each row
   names which Dengage channels carried the same moment, and says so plainly
   when none of them did, so the drawer never implies a send that Dengage
   refused. The drawer shows these alongside whatever Dengage's own App Inbox
   holds, so a campaign message and an instant one sit in one list. The copy
   lives in ni_inbox_template, editable with one statement and no deploy. */
async function sbFetch(path: string, init: RequestInit) {
  return await fetch(`${SB_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      'apikey': SB_KEY,
      'authorization': `Bearer ${SB_KEY}`,
      ...(init.headers ?? {}),
    },
  });
}

function fill(template: string, params: Record<string, string>): string {
  return template.replace(/\{([a-z_]+)\}/g, (_m, key) => params[key] ?? '').replace(/\s{2,}/g, ' ').trim();
}

async function recordMessage(
  brandKey: string, momentKey: string, lead: { contact_key?: string; device_token?: string },
  params: Record<string, string>, channels: string[], detail?: string,
): Promise<string> {
  if (!SB_URL || !SB_KEY) return 'not configured';
  try {
    const res = await sbFetch(
      `ni_inbox_template?brand=eq.${encodeURIComponent(brandKey)}&moment=eq.${encodeURIComponent(momentKey)}` +
      `&select=title,body&limit=1`, { method: 'GET' });
    const rows = await res.json();
    const tpl = Array.isArray(rows) ? rows[0] : null;
    if (!tpl) return 'needs copy for ' + momentKey;
    const wrote = await sbFetch('ni_inbox', {
      method: 'POST',
      headers: { 'prefer': 'return=minimal' },
      body: JSON.stringify({
        contact_key: lead.contact_key ?? null,
        device_token: lead.device_token ?? null,
        brand: brandKey,
        moment: momentKey,
        title: fill(tpl.title, params),
        body: fill(tpl.body, params),
        media_url: params.model_image ?? null,
        target_url: params.model_url ?? null,
        channels: channels.length ? channels.join(', ') : 'inbox only',
        /* What Dengage actually answered, for every moment rather than only
           for a booking. channels says a push was accepted; it cannot say
           whether the contact was addressed or the token fallback ran, and
           when a notification does not appear that is the first thing worth
           knowing. Never returned to the browser: the drawer read does not
           select it. */
        detail: detail ? detail.slice(0, 1500) : null,
      }),
    });
    return wrote.ok ? 'delivered' : `error HTTP ${wrote.status}`;
  } catch (err) {
    return 'error ' + String(err).slice(0, 120);
  }
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
    /* The message centre, read by the storefront drawer, by contact key and by
       device token together. An anonymous visitor sees what was sent to their
       device, and keeps seeing it after a form gives them a name. */
    const url = new URL(req.url);
    const who = url.searchParams.get('inbox');
    /* A device token is opaque to us, so only the characters a token is made of
       reach the filter. Anything else is dropped rather than escaped, because a
       comma or a bracket would rewrite the query instead of failing it. */
    const rawDevice = url.searchParams.get('device') ?? '';
    const byDevice = /^[A-Za-z0-9:._-]{20,400}$/.test(rawDevice) ? rawDevice : '';
    if (who || byDevice) {
      if (who && !/^DPS-[A-Za-z0-9_-]{1,44}$/.test(who)) {
        return reply({ error: 'inbox must be a DPS- demo key' }, 400, origin);
      }
      if (!SB_URL || !SB_KEY) return reply({ messages: [] }, 200, origin);
      try {
        /* Both, when the page has both. A visitor who allowed notifications
           before filling in a form has messages against the device, and the
           ones sent after they were named are against the contact. Reading
           either keeps the drawer whole across the moment they are identified,
           which is the moment the story turns. */
        const clauses: string[] = [];
        if (who) clauses.push(`contact_key.eq.${who}`);
        if (byDevice) clauses.push(`device_token.eq.${byDevice}`);
        const filter = clauses.length > 1
          ? `or=(${encodeURIComponent(clauses.join(','))})`
          : (who ? `contact_key=eq.${encodeURIComponent(who)}`
                 : `device_token=eq.${encodeURIComponent(byDevice)}`);
        const res = await sbFetch(
          `ni_inbox?${filter}&select=id,title,body,media_url,target_url,channels,moment,sent_at` +
          `&order=sent_at.desc&limit=30`, { method: 'GET' });
        const rows = await res.json();
        /* Named the way the drawer already reads a Dengage message, so one
           renderer draws both without knowing which is which. */
        // deno-lint-ignore no-explicit-any
        const messages = (Array.isArray(rows) ? rows : []).map((r: any) => ({
          smsgId: 'demo-' + r.id,
          title: r.title,
          message: r.body,
          mediaUrl: r.media_url || undefined,
          targetUrl: r.target_url || undefined,
          sentDate: r.sent_at,
          channels: r.channels,
          moment: r.moment,
        }));
        return reply({ messages }, 200, origin);
      } catch (err) {
        return reply({ messages: [], error: String(err).slice(0, 200) }, 200, origin);
      }
    }
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
    /* The grade a build was configured at. The reservation message prints it,
       and it is the one value that distinguishes two reservations of the same
       car at different money. */
    note: clean(raw.note, 120),
  };

  /* A contact key names a person; a push token names the device in front of
     you. Either is enough to send, and requiring the key meant a visitor who
     had allowed notifications but not yet filled in a form could never be
     reached, which is exactly the anonymous half of the story this demo is
     built to show. A key, when given, still has to be one of this demo's. */
  if (lead.contact_key && !/^DPS-[A-Za-z0-9_-]{1,44}$/.test(lead.contact_key)) {
    return reply({ error: 'contact_key must be a DPS- demo key' }, 400, origin);
  }
  if (!lead.contact_key && !lead.device_token) {
    return reply({ error: 'send needs a contact_key or a device_token' }, 400, origin);
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

  const out = { email: 'not attempted', push: 'not attempted', inbox: 'not attempted' };
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
      const mail = outcome(res);
      out.email = mail.sent ? 'sent' : refused(mail);
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
      /* These are the inbox parameters the API documents, and in this account
         they do not put anything in the inbox. Measured on 1 September 2026:
         two pushes fired at a contact holding twenty inbox messages left the
         count at twenty, read straight from /api/inbox/getMessages. The drawer
         in the storefront fills from its own message centre and from a campaign
         instead. They are still sent because they are correct and cost nothing,
         but nothing here should be described as filling Dengage's inbox until a
         send is watched doing it. */
      const inboxParams = {
        enabled: true,
        expire: { type: 'PERIOD', period: 30, periodType: 'DAY' },
      };
      if (!lead.contact_key) {
        /* Nobody has told us who this is yet. The device is still reachable,
           which is the whole point of a token. */
        const anon = await dengagePost('/transactional/push', {
          contentId: pushId,
          token: lead.device_token,
          appId: APP_ID,
          language: 'EN',
          current: params,
          customParameters: Object.entries(params).map(([key, value]) => ({ key, value })),
          inboxParams,
          tags: ['demo', brandKey, momentKey],
        }, token);
        const anonymous = outcome(anon);
        out.push = anonymous.sent ? 'sent to this device, still anonymous' : refused(anonymous);
        notes.push('push to anonymous device: ' + anon.text.slice(0, 300));
        out.inbox = await recordMessage(brandKey, momentKey, lead, params,
                                        anonymous.sent ? ['push'] : [], notes.join(' | '));
        return reply({ brand: brandKey, moment: momentKey, email: out.email, push: out.push,
                       inbox: out.inbox, personalized: Object.keys(params).sort() }, 200, origin);
      }
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
      const byContact = outcome(res);
      out.push = byContact.sent ? 'sent' : refused(byContact);
      notes.push('push: ' + res.text.slice(0, 300));
      /* Dengage keeps a device token against whichever contact key claimed it
         last, so a key the device has not claimed yet reaches nothing. When
         the page told us which token it holds, the same message goes to that
         device directly, which is what a demo needs: the contact is still the
         right way to address a person, and this is the safety net. */
      if (byContact.code === 11 || /Token not found/i.test(res.text)) {
        /* The device is subscribed; Dengage simply has no device recorded
           against this contact key yet, which is the normal state for anyone
           who allowed notifications before they filled in a form. The token
           reaches them regardless. */
        out.push = 'this contact has no device bound, and the page sent no token';
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
          const byToken = outcome(direct);
          out.push = byToken.sent ? 'sent to this device by token, the contact has none bound'
                                  : refused(byToken);
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

  /* The inbox delivers on its own, because it is this demo's channel rather
     than a report on the other two. The row still records exactly which
     Dengage channels carried the same moment, so a refusal stays visible. */
  const carried: string[] = [];
  if (out.email === 'sent') carried.push('email');
  if (out.push.indexOf('sent') === 0) carried.push('push');
  out.inbox = await recordMessage(brandKey, momentKey, lead, params, carried,
                                  ['email: ' + out.email, 'push: ' + out.push]
                                    .concat(notes).join(' | '));

  // The record, so the outcome outlives the page that asked for it. Only a
  // booking has a row of its own to carry it.
  if (SB_URL && SB_KEY && momentKey === 'booking' && lead.contact_key) {
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
                 inbox: out.inbox, personalized: Object.keys(params).sort() }, 200, origin);
});
