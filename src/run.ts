import type { Card, RunResult } from "./cards";
import { fetchProvider, redactDeep, type CacheIo } from "./fetcher";
import { clipRaw } from "./raw";
import { coverageCheck, type Query } from "./queries/types";
import { todayYmd, type RunContext } from "./time";

// Exécute une requête : couverture, fetch (parallèle, borné), normalisation.
// Toute exception d'un normaliseur devient une erreur affichable, jamais une 500. Ne lit ni `.env` ni disque : la clé,
// le User-Agent, le cache, la durée du cache de données et les compléments sont passés (le site les lie : lib/run.ts).

const CONCURRENCY = 4;

export interface RunOptions {
  /** La clé du fournisseur (NASA) ; caviardée partout dans la réponse. */
  key: string;
  userAgent: string;
  cache?: CacheIo;
  bypassCache?: boolean;
  /** La durée du cache de données de Next, en secondes (en ligne seulement). */
  revalidate?: number;
  /** Des cartes de plus, calculées par l'appelant (le site : les bibliothèques qui ne partent pas au navigateur). */
  complements?: (id: string, ctx: RunContext) => Promise<Card[]>;
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

export async function runQuery(q: Query, ctx: RunContext, opts: RunOptions): Promise<RunResult> {
  const started = Date.now();
  const base = { queryId: q.id, note: q.note?.(ctx) };
  const cov = coverageCheck(q, ctx.date, todayYmd(ctx.tz));
  if (!cov.ok) {
    return { ...base, status: "out-of-coverage", cards: [], raw: [], requests: [], message: cov.reason, totalMs: 0 };
  }
  const { key } = opts;
  const reqs = q.build(ctx, key);
  const outcomes = await mapLimit(reqs, q.concurrency ?? CONCURRENCY, (r) => fetchProvider(r, { key, userAgent: opts.userAgent, cache: opts.cache, bypassCache: opts.bypassCache, revalidate: opts.revalidate }));
  const requests = outcomes.map((o) => o.trace);
  const raw = outcomes.map((o) => clipRaw(redactDeep(o.data, key)));
  const failed = outcomes.filter((o) => !o.ok);

  // Une requête purement locale (tarot, numérologie) n'appelle personne : rien n'a échoué.
  if (outcomes.length && failed.length === outcomes.length) {
    const first = failed[0];
    const status = first?.timedOut ? "timeout" : "error";
    const apiMsg = extractMessage(first?.data);
    return { ...base, status, cards: [], raw, requests, message: [first?.error, apiMsg].filter(Boolean).join(" — "), totalMs: Date.now() - started };
  }

  try {
    const cards = [
      ...q.normalize(outcomes.map((o) => (o.ok ? o.data : undefined)), ctx),
      // Le complément du serveur (`complements.ts`) : une bibliothèque chargée à la demande ; en échec, rien de plus.
      ...(opts.complements ? await opts.complements(q.id, ctx) : []),
    ];
    const partial = failed.length ? `${failed.length} requête${failed.length > 1 ? "s" : ""} sur ${outcomes.length} en échec` : undefined;
    return {
      ...base,
      status: cards.length ? "ok" : "empty",
      cards,
      raw,
      requests,
      message: partial,
      totalMs: Date.now() - started,
    };
  } catch (e) {
    return { ...base, status: "error", cards: [], raw, requests, message: `normalisation : ${(e as Error).message}`, totalMs: Date.now() - started };
  }
}

function extractMessage(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return typeof data === "string" ? data.slice(0, 200) : undefined;
  const d = data as Record<string, unknown>;
  for (const k of ["msg", "message", "error", "error_message"]) {
    const v = d[k];
    if (typeof v === "string") return v;
    if (v && typeof v === "object" && typeof (v as Record<string, unknown>).message === "string") return (v as Record<string, string>).message;
  }
  return undefined;
}
