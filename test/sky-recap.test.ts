import { describe, expect, it } from "vitest";
import { skyRecap } from "../src/sky-recap";

const paris = { name: "Paris", lat: 48.8566, lon: 2.3522, tz: "Europe/Paris" };

describe("le ciel d'une date en une phrase", () => {
  it("dit la Lune, le lever et le coucher du Soleil, et les planètes à l'œil nu la nuit", () => {
    // Le 21 juillet 1969 à 3 h 56 à Paris : la nuit du premier pas sur la Lune.
    const r = skyRecap({ date: "1969-07-21", time: "03:56", place: paris });
    expect(r.night).toBe(true);
    // Le premier quartier exact est le 22 ; le nom couvre les 45° autour.
    expect(r.moon.name).toBe("premier quartier");
    expect(r.visible).toContain("Vénus");
    expect(r.moon.illum).toBeGreaterThan(25);
    expect(r.moon.illum).toBeLessThan(50);
    // En 1969, la France est à l'heure d'hiver toute l'année (UTC+1) : le Soleil se lève vers 5 h.
    expect(r.sun?.rise).toMatch(/^0[5-6]:\d\d$/);
    expect(r.sun?.set).toMatch(/^2[01]:\d\d$/);
    expect(Array.isArray(r.visible)).toBe(true);
    expect(r.summary.length).toBeLessThanOrEqual(155);
    expect(r.summary).toMatch(/^21 juillet 1969 à 03:56, Paris : /);
  });
  it("sans lieu, la Lune seule ; en plein jour, pas « à l'œil nu »", () => {
    const r = skyRecap({ date: "2024-04-08" });
    expect(r.sun).toBeUndefined();
    expect(r.visible).toBeUndefined();
    expect(r.headline).toMatch(/^(Nouvelle lune|Dernier croissant|Premier croissant) \(\d+ %\)$/);
    const day = skyRecap({ date: "2024-06-21", time: "14:00", place: paris });
    expect(day.night).toBe(false);
    expect(day.headline).toMatch(/en plein jour/);
  });
});
