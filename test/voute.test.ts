import { describe, expect, it } from "vitest";
import { equationOfTime, moonPhaseName, projectAltAz, skyAt, skyMap } from "../src/voute";

const paris = { name: "Paris", lat: 48.8534, lon: 2.3488, tz: "Europe/Paris" };

describe("equationOfTime", () => {
  it("donne les extrêmes connus de l'année (± 0,3 min)", () => {
    expect(equationOfTime(new Date("2026-11-03T12:00:00Z"))).toBeCloseTo(16.45, 0);
    expect(equationOfTime(new Date("2026-02-11T12:00:00Z"))).toBeCloseTo(-14.2, 0);
    expect(Math.abs(equationOfTime(new Date("2026-04-15T12:00:00Z")))).toBeLessThan(0.5);
  });
});

describe("moonPhaseName", () => {
  it("nomme les huit phases", () => {
    expect(moonPhaseName(2)).toBe("nouvelle lune");
    expect(moonPhaseName(90)).toBe("premier quartier");
    expect(moonPhaseName(181)).toBe("pleine lune");
    expect(moonPhaseName(300)).toBe("dernier croissant");
    expect(moonPhaseName(359)).toBe("nouvelle lune");
  });
});

describe("skyAt", () => {
  it("met le Soleil haut à midi au solstice d'été, à Paris", () => {
    const sky = skyAt(new Date("2024-06-21T11:50:00Z"), paris);
    const sun = sky.bodies.find((b) => b.id === "soleil")!;
    expect(sun.alt).toBeGreaterThan(64);
    expect(sun.alt).toBeLessThan(65);
    expect(sun.az).toBeGreaterThan(170);
    expect(sun.az).toBeLessThan(190);
  });
  it("met le zénith à la déclinaison du lieu", () => {
    const sky = skyAt(new Date("2026-09-25T22:00:00Z"), paris);
    expect(sky.zenith.dec).toBe(paris.lat);
    expect(sky.lst).toBeGreaterThanOrEqual(0);
    expect(sky.lst).toBeLessThan(24);
  });
  it("reconnaît la pleine lune du 17 septembre 2024", () => {
    expect(skyAt(new Date("2024-09-18T02:34:00Z"), paris).moon.name).toBe("pleine lune");
  });
});

describe("projectAltAz", () => {
  it("met le zénith au centre, le nord en haut, l'est à gauche", () => {
    const z = projectAltAz(90, 0)!;
    expect(z.x).toBeCloseTo(0);
    expect(z.y).toBeCloseTo(0);
    expect(projectAltAz(0, 0)).toEqual({ x: expect.closeTo(0), y: expect.closeTo(-1) });
    expect(projectAltAz(0, 90)).toEqual({ x: expect.closeTo(-1), y: expect.closeTo(0) });
    expect(projectAltAz(0, 270)).toEqual({ x: expect.closeTo(1), y: expect.closeTo(0) });
  });
  it("ne rend rien sous l'horizon", () => {
    expect(projectAltAz(-5, 0)).toBeNull();
  });
});

describe("skyMap", () => {
  const map = skyMap(skyAt(new Date("2026-09-25T20:00:00Z"), paris));
  it("place l'étoile Polaire au nord, à la hauteur du pôle", () => {
    // La Polaire (mag 2,0) est l'étoile la plus proche de x = 0 au nord, à r = tan(41,2° / 2) ≈ 0,376.
    const polaris = map.stars.filter((s) => s.mag < 2.1 && s.mag > 1.9).find((s) => Math.abs(s.x) < 0.03 && s.y < 0);
    expect(polaris).toBeDefined();
    expect(Math.hypot(polaris!.x, polaris!.y)).toBeCloseTo(0.376, 1);
  });
  it("garde tout dans le disque de l'horizon", () => {
    for (const p of [...map.stars, ...map.lines.flat(), ...map.names, ...map.ecliptic.flat()]) expect(Math.hypot(p.x, p.y)).toBeLessThanOrEqual(1.0001);
  });
  it("s'arrête à la magnitude limite", () => {
    expect(map.stars.every((s) => s.mag <= 3.9)).toBe(true);
    expect(skyMap(skyAt(new Date("2026-09-25T20:00:00Z"), paris), { maxMag: 5 }).stars.length).toBeGreaterThan(map.stars.length);
  });
});
