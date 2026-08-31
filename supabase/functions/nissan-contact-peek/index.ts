// Read only diagnostic: fetches one demo contact from Dengage so a booking's
// stored contact can be confirmed from the wire rather than inferred from an
// HTTP 200. Demo keys only (DPS- followed by digits), never a write, and it
// answers only callers holding the project key because the platform verifies
// the JWT before this code runs.

const API_BASE = Deno.env.get('DENGAGE_API_BASE') ?? 'https://api.dengage.com/rest';
const EGRESS_PROXY = Deno.env.get('DENGAGE_EGRESS_PROXY') ?? '';

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

let tokenCache: { value: string; expiresAt: number } | null = null;

async function dengageFetch(path: string, init: RequestInit): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    signal: AbortSignal.timeout(8000),
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
  const res = await dengageFetch('/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ userkey, password }),
  });
  if (!res.ok) throw new Error(`login failed with HTTP ${res.status}: ${res.text.slice(0, 200)}`);
  const body = JSON.parse(res.text) as { access_token?: string; expires_in?: number };
  if (!body?.access_token) throw new Error('login returned no token');
  tokenCache = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return tokenCache.value;
}

const seen = new Map<string, number[]>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const stamps = (seen.get(ip) ?? []).filter((t) => now - t < 600000);
  stamps.push(now);
  seen.set(ip, stamps);
  return stamps.length > 10;
}

Deno.serve(async (req: Request) => {
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (req.method !== 'GET') return json(405, { error: 'GET only' });
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (rateLimited(ip)) return json(429, { error: 'rate limited' });
  const key = new URL(req.url).searchParams.get('key') ?? '';
  /* The same shape the relay accepts, so a readable key like DPS-sg can be
     looked up as easily as a minted DPS-<timestamp> one. */
  if (!/^DPS-[A-Za-z0-9_-]{1,44}$/.test(key)) return json(400, { error: 'key must be a DPS- demo key' });
  try {
    const token = await dengageToken();
    const fields = ['name', 'surname', 'email', 'gsm', 'email_permission', 'gsm_permission', 'city'].join(',');
    const res = await dengageFetch(
      `/contacts/${encodeURIComponent(key)}?contactFields=${encodeURIComponent(fields)}`,
      { method: 'GET', headers: { authorization: `Bearer ${tokenCache?.value ?? token}` } },
    );
    let data: unknown = null;
    try { data = JSON.parse(res.text); } catch { /* non JSON body */ }
    return json(200, { key, dengage_http: res.status, stored: data ?? res.text.slice(0, 300) });
  } catch (e) {
    return json(502, { error: String(e).slice(0, 300) });
  }
});
