import { describe, expect, it } from "vitest";
import { clipRaw } from "../src/raw";

describe("clipRaw", () => {
  it("laisse passer une réponse légère telle quelle", () => {
    const v = { a: [1, 2, 3] };
    expect(clipRaw(v)).toBe(v);
  });
  it("coupe une réponse lourde et dit sa taille", () => {
    const big = { points: Array.from({ length: 50_000 }, (_, i) => [i, i]) };
    const out = clipRaw(big) as { tronqué: string; début: string };
    expect(out.tronqué).toMatch(/Ko|Mo/);
    expect(out.début.length).toBe(2_000);
    expect(JSON.stringify(out).length).toBeLessThan(3_000);
  });
});
