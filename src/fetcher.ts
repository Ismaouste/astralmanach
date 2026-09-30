import type { ProviderRequest } from "./queries/types";
import type { RequestTrace } from "./cards";

// L'appel à un fournisseur : un cache s'il y en a un, une seconde chance si le fournisseur sature, la clé caviardée
// partout. Ne lit ni `.env` ni disque : le User-Agent et le cache sont passés par l'appelant (le site les lie : lib/fetcher.ts).

/** Une réponse gardée : une entrée par URL. */
export interface CacheEntry {
  url: string;
  fetchedAt: string;
  status: number;
  contentType: string;
  body: string;
}

/** Un cache, fourni par l'appelant (le site : un fichier par URL, sur le disque). */
export interface CacheIo {
  read(url: string): CacheEntry | undefined;
  write(entry: CacheEntry): void;
}

export const TIMEOUT_MS = 25_000;

export interface FetchOutcome {
  trace: RequestTrace;
  ok: boolean;
  status: number | null;
  /** JSON décodé si possible, sinon le texte brut. */
  data: unknown;
  timedOut: boolean;
  error?: string;
}

/** Caviarde toute clé passée en paramètre d'URL, dans une URL ou dans un JSON sérialisé. */
export function redactKey(text: string, key: string): string {
  let out = text.replace(/([?&]api_key=)[^&"'\s]+/g, "$1•••");
  if (key && key !== "DEMO_KEY") out = out.split(key).join("•••");
  return out;
}

export function redactDeep(value: unknown, key: string): unknown {
  if (typeof value === "string") return redactKey(value, key);
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, key));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = redactDeep(v, key);
    return out;
  }
  return value;
}

function decode(body: string, contentType: string): unknown {
  const looksJson = contentType.includes("json") || /^\s*[[{]/.test(body);
  if (looksJson) {
    try {
      return JSON.parse(body);
    } catch {
      /* texte */
    }
  }
  return body;
}

export async function fetchProvider(
  req: ProviderRequest,
  opts: { key: string; userAgent: string; cache?: CacheIo; bypassCache?: boolean; revalidate?: number },
): Promise<FetchOutcome> {
  const started = Date.now();
  const redactedUrl = redactKey(req.url, opts.key);

  if (!opts.bypassCache && opts.cache) {
    const hit = opts.cache.read(req.url);
    if (hit) {
      return {
        trace: { url: redactedUrl, status: hit.status, ms: Date.now() - started, fromCache: true },
        ok: hit.status >= 200 && hit.status < 300,
        status: hit.status,
        data: decode(hit.body, hit.contentType),
        timedOut: false,
      };
    }
  }

  try {
    const doFetch = () =>
      fetch(req.url, {
        headers: { "User-Agent": opts.userAgent, Accept: "application/json, text/plain;q=0.8, */*;q=0.5", ...req.headers },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // En ligne, le disque ne garde rien : c'est le cache de données de Next (persistant sur
        // Vercel) qui évite de réinterroger le fournisseur. Il ne garde que les réponses 200, et
        // rien au-delà de 2 Mo (la carte des PFAS, 10 Mo, repasse donc à chaque fois).
        ...(opts.revalidate && !opts.bypassCache ? { next: { revalidate: opts.revalidate } } : { cache: "no-store" as const }),
      });
    let res = await doFetch();
    // 429/503 : le fournisseur sature (Horizons le fait dès deux appels simultanés). Une seconde chance, après une pause.
    if (res.status === 429 || res.status === 503) {
      await new Promise((r) => setTimeout(r, 1200));
      res = await doFetch();
    }
    const body = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    // On ne met en cache que les succès : une erreur passagère ne doit pas devenir permanente.
    if (res.ok) {
      opts.cache?.write({ url: req.url, fetchedAt: new Date().toISOString(), status: res.status, contentType, body });
    }
    return {
      trace: { url: redactedUrl, status: res.status, ms: Date.now() - started, fromCache: false },
      ok: res.ok,
      status: res.status,
      data: decode(body, contentType),
      timedOut: false,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    const err = e as Error & { name?: string };
    const timedOut = err.name === "TimeoutError" || err.name === "AbortError";
    return {
      trace: { url: redactedUrl, status: null, ms: Date.now() - started, fromCache: false },
      ok: false,
      status: null,
      data: null,
      timedOut,
      error: timedOut ? `délai dépassé (${TIMEOUT_MS / 1000} s)` : (err.message ?? String(e)),
    };
  }
}
