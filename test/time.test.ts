import { describe, expect, it } from "vitest";
import {
  cacheTtl,
  addDays, formatLocal, horizonsTime, isValidDate, makeContext, parseUtc, zonedToUtc,
} from "../src/time";

describe("zonedToUtc", () => {
  it("convertit l'heure de Paris en hiver (UTC+1)", () => {
    expect(zonedToUtc(1978, 3, 12, 15, 0, "Europe/Paris").toISOString()).toBe("1978-03-12T14:00:00.000Z");
  });
  it("convertit l'heure de Paris en été (UTC+2)", () => {
    expect(zonedToUtc(2024, 5, 10, 15, 0, "Europe/Paris").toISOString()).toBe("2024-05-10T13:00:00.000Z");
  });
  it("laisse UTC inchangé", () => {
    expect(zonedToUtc(2000, 1, 1, 0, 0, "UTC").toISOString()).toBe("2000-01-01T00:00:00.000Z");
  });
});

describe("makeContext", () => {
  it("prend midi local quand l'heure manque, et le dit", () => {
    const c = makeContext({ date: "1978-03-12" });
    expect(c.hasTime).toBe(false);
    expect(c.instant.toISOString()).toBe("1978-03-12T11:00:00.000Z");
    expect(c.from).toBe("1978-03-12");
    expect(c.to).toBe("1978-03-12");
  });
  it("applique la fenêtre des deux côtés", () => {
    const c = makeContext({ date: "1978-03-12", windowDays: 3 });
    expect(c.from).toBe("1978-03-09");
    expect(c.to).toBe("1978-03-15");
  });
  it("rejette une date impossible", () => {
    expect(() => makeContext({ date: "1978-02-30" })).toThrow();
    expect(isValidDate("2024-13-01")).toBe(false);
  });
  it("ignore une heure mal formée", () => {
    const c = makeContext({ date: "1978-03-12", time: "25:99" });
    expect(c.hasTime).toBe(false);
  });
  it("retombe sur Europe/Paris pour un fuseau inconnu", () => {
    expect(makeContext({ date: "1978-03-12", tz: "Mars/Olympus" }).tz).toBe("Europe/Paris");
  });
});

describe("addDays", () => {
  it("franchit les mois et les années", () => {
    expect(addDays("1978-12-30", 3)).toBe("1979-01-02");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });
});

describe("parseUtc", () => {
  it("lit les formats des différentes API", () => {
    expect(parseUtc("2024-05-10T00:13Z")?.toISOString()).toBe("2024-05-10T00:13:00.000Z");
    expect(parseUtc("2013-02-15 03:20:26")?.toISOString()).toBe("2013-02-15T03:20:26.000Z");
    expect(parseUtc("1978-Mar-07 00:56")?.toISOString()).toBe("1978-03-07T00:56:00.000Z");
    expect(parseUtc("2024-05-10")?.toISOString()).toBe("2024-05-10T00:00:00.000Z");
    expect(parseUtc("")).toBeUndefined();
    expect(parseUtc("n'importe quoi")).toBeUndefined();
  });
});

describe("formats", () => {
  it("formate en français dans le fuseau", () => {
    const at = new Date("1978-03-12T14:00:00Z");
    expect(formatLocal(at, "Europe/Paris")).toBe("12 mars 1978 à 15:00");
    expect(formatLocal(at, "Europe/Paris", false)).toBe("12 mars 1978");
  });
  it("écrit l'instant pour Horizons", () => {
    expect(horizonsTime(new Date("1978-03-12T14:00:00Z"))).toBe("1978-03-12 14:00");
  });
});

describe("cacheTtl", () => {
  it("garde une archive un mois, le présent une heure", () => {
    expect(cacheTtl("1969-07-21", "2026-09-24")).toBe(30 * 86_400);
    expect(cacheTtl("2026-09-21", "2026-09-24")).toBe(30 * 86_400);
    expect(cacheTtl("2026-09-22", "2026-09-24")).toBe(3_600);
    expect(cacheTtl("2026-09-24", "2026-09-24")).toBe(3_600);
    expect(cacheTtl("2027-01-01", "2026-09-24")).toBe(3_600);
  });
});
