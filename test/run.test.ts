import { afterEach, describe, expect, it, vi } from "vitest";
import type { Card } from "../src/cards";
import type { Query } from "../src/queries/types";
import { makeContext } from "../src/time";
import { runQuery } from "../src/run";
import type { CacheEntry } from "../src/fetcher";

// Le runner du paquet ne lit ni `.env` ni disque : la clé, le User-Agent, le cache et les compléments lui sont passés.
const factice: Query = {
  id: "essai.factice",
  provider: "nasa",
  label: "Essai",
  hint: "une requête d'essai",
  granularity: "day",
  coverage: {},
  needsKey: true,
  build: (_ctx, key) => [{ url: `https://exemple.test/x?api_key=${key}` }],
  normalize: ([d]) => (d && typeof d === "object" ? [{ kind: "text", title: `n = ${(d as { n: number }).n}` } as Card] : []),
};

const ctx = makeContext({ date: "2026-09-30", tz: "Europe/Paris" });

afterEach(() => { vi.unstubAllGlobals(); });

describe("le runner du paquet", () => {
  it("interroge, caviarde la clé partout, passe le User-Agent et appelle les compléments une fois", async () => {
    const appels: { url: string; ua: string | null }[] = [];
    vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
      appels.push({ url, ua: new Headers(init.headers).get("User-Agent") });
      return new Response(JSON.stringify({ self: "https://exemple.test/x?api_key=SECRET", n: 2 }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const complements = vi.fn(async () => [] as Card[]);
    const r = await runQuery(factice, ctx, { key: "SECRET", userAgent: "essai/1.0", complements });
    expect(r.status).toBe("ok");
    expect(r.cards[0]).toMatchObject({ title: "n = 2" });
    expect(appels).toEqual([{ url: "https://exemple.test/x?api_key=SECRET", ua: "essai/1.0" }]);
    expect(r.requests[0].url).not.toContain("SECRET");
    expect(JSON.stringify(r.raw)).not.toContain("SECRET");
    expect(complements).toHaveBeenCalledTimes(1);
    expect(complements).toHaveBeenCalledWith("essai.factice", ctx);
  });

  it("lit et écrit le cache qu'on lui donne, et seulement celui-là", async () => {
    vi.stubGlobal("fetch", async () => new Response('{"n":3}', { status: 200, headers: { "content-type": "application/json" } }));
    const ecrits: CacheEntry[] = [];
    const cache = { read: (): CacheEntry | undefined => undefined, write: (e: CacheEntry) => { ecrits.push(e); } };
    await runQuery(factice, ctx, { key: "K", userAgent: "essai/1.0", cache });
    expect(ecrits).toHaveLength(1);
    const lu = { read: () => ({ url: "", fetchedAt: "", status: 200, contentType: "application/json", body: '{"n":9}' }), write: () => {} };
    vi.stubGlobal("fetch", async () => { throw new Error("ne devait pas partir"); });
    const r = await runQuery(factice, ctx, { key: "K", userAgent: "essai/1.0", cache: lu });
    expect(r.cards[0]).toMatchObject({ title: "n = 9" });
    expect(r.requests[0].fromCache).toBe(true);
  });
});
