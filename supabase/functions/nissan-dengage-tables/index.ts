// The row counts, read only.
//
// An HTTP 200 from the event endpoint means accepted and nothing more. The only
// proof an event landed is a row in Data Space, and until this existed the only
// way to see one was to open the panel and look.
//
//   GET  https://<ref>.supabase.co/functions/v1/nissan-dengage-tables
//
// answers with the whole table count for every table the demos write to. Run
// it, use the demo, run it again. A count that moved is not proof it was your
// event, because the account is shared with other demos and other traffic; a
// count that did not move is proof it was not.
//
// WHAT THIS CANNOT DO, deliberately. It signs in and issues two kinds of GET
// against /rest/dataspace/tables. There is no code path here that writes,
// drops or truncates anything, and there is no table name it will accept from
// the caller: the list below is the whole of what it will read. Deleting or
// truncating anything in Dengage needs written approval for that specific
// object, every time, so a diagnostic that could do it would be the wrong
// shape however carefully it were guarded.
//
// It reads the same project secrets the message function uses:
//   DENGAGE_API_USERKEY, DENGAGE_API_PASSWORD, DENGAGE_API_BASE,
//   DENGAGE_EGRESS_PROXY

const ALLOWED_ORIGINS = new Set([
  'https://dengage-presales.github.io',
  'http://localhost:8101',
]);
const API_BASE = Deno.env.get('DENGAGE_API_BASE') ?? 'https://api.dengage.com/rest';
const EGRESS_PROXY = Deno.env.get('DENGAGE_EGRESS_PROXY') ?? '';

/* Every table the two demos write to, and the call that writes it. The demo
   adds no columns to the six standard ones, because columns cannot be added to
   them; ni_lead_events is the one custom table, and it carries everything that
   has no column on a standard one. */
const TABLES: Array<{ name: string; written_by: string }> = [
  { name: 'page_view_events', written_by: 'pageView, on every page' },
  { name: 'shopping_cart_events', written_by: 'ec:addToCart, ec:removeFromCart, ec:deleteCart, ec:beginCheckout' },
  { name: 'order_events', written_by: 'ec:order, ec:cancelOrder' },
  { name: 'order_events_detail', written_by: 'the lines of each order' },
  { name: 'wishlist_events', written_by: 'ec:addToWishlist and ec:removeFromWishlist, favorites and price_drop_alert' },
  { name: 'search_events', written_by: 'ec:search' },
  { name: 'ni_lead_events', written_by: 'sendDeviceEvent, every pre purchase moment with no column on a standard table' },
];

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
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Vary': 'Origin',
  };
}
function reply(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body, null, 1), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  });
}

async function login(): Promise<string> {
  const userkey = Deno.env.get('DENGAGE_API_USERKEY') ?? '';
  const password = Deno.env.get('DENGAGE_API_PASSWORD') ?? '';
  if (!userkey || !password) throw new Error('api user not configured');
  const res = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userkey, password }),
    signal: AbortSignal.timeout(9000),
    // deno-lint-ignore no-explicit-any
    client: egress() as any,
  } as RequestInit);
  if (!res.ok) throw new Error(`login failed with HTTP ${res.status}`);
  const body = await res.json() as { access_token?: string };
  if (!body?.access_token) throw new Error('login returned no token');
  return body.access_token;
}

async function get(path: string, token: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
    // deno-lint-ignore no-explicit-any
    client: egress() as any,
  } as RequestInit);
  return { ok: res.ok, status: res.status, text: await res.text() };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin') ?? '';
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== 'GET') return reply({ error: 'GET only, this reads and never writes' }, 405, origin);

  try {
    const token = await login();
    const wanted = new Set(TABLES.map((t) => t.name));
    const ids = new Map<string, string>();
    /* The listing is paged and the account holds far more tables than these
       seven, so it walks until it has them all or runs out. */
    for (let offset = 0; offset < 10000; offset += 1000) {
      const page = await get(`/dataspace/tables?limit=1000&offset=${offset}`, token);
      if (!page.ok) return reply({ error: `listing tables: HTTP ${page.status}` }, 200, origin);
      // deno-lint-ignore no-explicit-any
      const data = (JSON.parse(page.text) as any)?.data;
      const rows = data?.result ?? [];
      for (const row of rows) {
        if (wanted.has(row.tableName)) ids.set(row.tableName, row.publicId);
      }
      if (ids.size === wanted.size || rows.length === 0) break;
      if (offset + 1000 >= (data?.totalRowCount ?? 0)) break;
    }

    const counts: Record<string, unknown> = {};
    for (const table of TABLES) {
      const id = ids.get(table.name);
      if (!id) {
        counts[table.name] = { rows: 'not found in Data Space', written_by: table.written_by };
        continue;
      }
      const detail = await get(`/dataspace/tables/${id}`, token);
      if (!detail.ok) {
        counts[table.name] = { rows: `could not read: HTTP ${detail.status}`, written_by: table.written_by };
        continue;
      }
      // deno-lint-ignore no-explicit-any
      const total = (JSON.parse(detail.text) as any)?.data?.totalRowCount;
      counts[table.name] = {
        rows: typeof total === 'number' ? total : 'unknown',
        written_by: table.written_by,
      };
    }

    return reply({
      read_at: new Date().toISOString(),
      counts,
      note: 'Whole table counts across a shared account. A count that moved is not proof it ' +
            'was your event; a count that did not move is proof it was not. This endpoint ' +
            'reads and never writes.',
    }, 200, origin);
  } catch (err) {
    return reply({ error: String(err).slice(0, 300) }, 200, origin);
  }
});
