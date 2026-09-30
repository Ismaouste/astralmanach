// Le ciel d'une observation : ce qu'astronomy-engine calcule pour un instant et un lieu (le zénith,
// le Soleil, la Lune, les planètes, l'équation du temps), et la carte du ciel projetée — étoiles et
// lignes des constellations de d3-celestial (BSD-3), noms en français. Pur : pas de réseau, pas de
// disque (les catalogues sont importés), testé (test/observations-ciel.test.ts).
//
// La carte est vue d'en dessous, comme on la tient au-dessus de sa tête : zénith au centre, nord en
// haut, est à gauche, l'horizon sur le cercle de rayon 1. Stéréographique par défaut (la recette de la
// fiche, §3), orthographique en réglage.

import * as A from "astronomy-engine";
import linesData from "../data/celestial/lines.json";
import namesData from "../data/celestial/names.json";
import starsData from "../data/celestial/stars.json";
import type { Place } from "./time";

export type Projection = "stereo" | "ortho";

export interface SkyBody {
  id: string;
  name: string;
  /** Hauteur au-dessus de l'horizon, degrés (réfraction comprise). */
  alt: number;
  /** Azimut, degrés depuis le nord vers l'est. */
  az: number;
  mag: number;
  /** Écart au Soleil, degrés (planètes et Lune). */
  elong?: number;
  /** Distance à l'observateur, unités astronomiques (les tailles apparentes des astres flottants). */
  dist?: number;
}

export interface Sky {
  instant: Date;
  place: Place;
  /** Le zénith sur la sphère céleste : ascension droite (heures) et déclinaison (degrés). */
  zenith: { ra: number; dec: number };
  /** Temps sidéral local, heures. */
  lst: number;
  bodies: SkyBody[];
  moon: { phase: number; illum: number; name: string };
  /** Équation du temps, minutes : temps solaire vrai moins temps solaire moyen. */
  eot: number;
}

const BODIES: [A.Body, string, string][] = [
  [A.Body.Sun, "soleil", "Soleil"],
  [A.Body.Moon, "lune", "Lune"],
  [A.Body.Mercury, "mercure", "Mercure"],
  [A.Body.Venus, "venus", "Vénus"],
  [A.Body.Mars, "mars", "Mars"],
  [A.Body.Jupiter, "jupiter", "Jupiter"],
  [A.Body.Saturn, "saturne", "Saturne"],
  [A.Body.Uranus, "uranus", "Uranus"],
  [A.Body.Neptune, "neptune", "Neptune"],
];

const wrap = (x: number, span: number) => ((x % span) + span) % span;

/** L'équation du temps à un instant, en minutes (+16 début novembre, −14 mi-février). */
export function equationOfTime(instant: Date): number {
  const greenwich = new A.Observer(0, 0, 0);
  const ha = A.HourAngle(A.Body.Sun, instant, greenwich);
  const ut = (instant.getTime() / 3_600_000) % 24;
  const h = wrap(ha + 12 - ut + 12, 24) - 12;
  return h * 60;
}

/** L'équation du temps sur l'année de l'instant, un point par jour à midi UTC (la « double vague »). */
export function equationOfTimeYear(instant: Date): { day: number; min: number }[] {
  const y = instant.getUTCFullYear();
  const days = (Date.UTC(y + 1, 0, 1) - Date.UTC(y, 0, 1)) / 86_400_000;
  return Array.from({ length: days }, (_, d) => ({ day: d, min: equationOfTime(new Date(Date.UTC(y, 0, 1 + d, 12))) }));
}

/** Le nom de la phase de la Lune d'après son angle (0 nouvelle, 180 pleine). */
export function moonPhaseName(deg: number): string {
  const names = ["nouvelle lune", "premier croissant", "premier quartier", "gibbeuse croissante", "pleine lune", "gibbeuse décroissante", "dernier quartier", "dernier croissant"];
  return names[Math.floor(wrap(deg + 22.5, 360) / 45)];
}

/**
 * L'écart au Soleil de la Lune et des planètes, signé : positif à l'est (visibles le soir), négatif
 * à l'ouest (le matin). Pour le calque des élongations : une ligne, le Soleil au milieu. La Lune se mesure comme les
 * planètes (l'angle vrai au Soleil) : sa phase, l'écart en longitude seul, s'en écartait jusqu'à 5° (sa latitude).
 */
export function elongations(instant: Date): { id: string; name: string; deg: number }[] {
  return BODIES.filter(([b]) => b !== A.Body.Sun).map(([body, id, name]) => {
    const e = A.Elongation(body, instant);
    return { id, name, deg: e.visibility === "evening" ? e.elongation : -e.elongation };
  });
}

/** La hauteur du Soleil (degrés) à un instant, en un lieu : sous −6°, il fait nuit pour une caméra. */
export function sunAltitude(instant: Date, lat: number, lon: number): number {
  const obs = new A.Observer(lat, lon, 0);
  const eq = A.Equator(A.Body.Sun, instant, obs, true, true);
  return A.Horizon(instant, obs, eq.ra, eq.dec, "normal").altitude;
}

export function skyAt(instant: Date, place: Place): Sky {
  const obs = new A.Observer(place.lat, place.lon, 0);
  const bodies = BODIES.map(([body, id, name]) => {
    const eq = A.Equator(body, instant, obs, true, true);
    const hor = A.Horizon(instant, obs, eq.ra, eq.dec, "normal");
    const mag = A.Illumination(body, instant).mag;
    const elong = body === A.Body.Sun ? undefined : A.AngleFromSun(body, instant);
    return { id, name, alt: hor.altitude, az: hor.azimuth, mag, elong, dist: eq.dist };
  });
  const lst = wrap(A.SiderealTime(instant) + place.lon / 15, 24);
  const phase = A.MoonPhase(instant);
  return {
    instant,
    place,
    zenith: { ra: lst, dec: place.lat },
    lst,
    bodies,
    moon: { phase, illum: A.Illumination(A.Body.Moon, instant).phase_fraction, name: moonPhaseName(phase) },
    eot: equationOfTime(instant),
  };
}

// ── La carte ──────────────────────────────────────────────────────────────────────────────────

export interface MapPoint { x: number; y: number }
export interface MapStar extends MapPoint { mag: number }
/** Un nom de constellation : son identifiant IAU (« Ori »), en français et en latin, son rang (1 les plus
 *  connues, 3 les plus obscures). */
export interface MapLabel extends MapPoint { id: string; text: string; la: string; rank: number }
/** Une constellation seule, telle qu'elle tombe sur la carte (ses traits et ses étoiles au-dessus de
 *  l'horizon) : une pièce du mode « Constellations » de la planche, qu'on déplace à la main. */
export interface MapFigure { id: string; text: string; la: string; rank: number; lines: MapPoint[][]; stars: MapStar[] }
export interface SkyMap {
  stars: MapStar[];
  /** Les lignes des constellations, en polylignes (coupées à l'horizon). */
  lines: MapPoint[][];
  names: MapLabel[];
  bodies: (MapPoint & SkyBody)[];
  /** L'écliptique au-dessus de l'horizon, en polylignes. */
  ecliptic: MapPoint[][];
  /** Les constellations dont un trait au moins est au-dessus de l'horizon, une par une. */
  figures: MapFigure[];
}

type Vec = { x: number; y: number; z: number };

/** Un vecteur horizontal unitaire (x nord, y ouest, z zénith) sur la carte, ou rien sous l'horizon. */
export function projectHor(v: Vec, projection: Projection = "stereo"): MapPoint | null {
  const n = Math.hypot(v.x, v.y, v.z);
  const x = v.x / n, y = v.y / n, z = v.z / n;
  if (z < 0) return null;
  // Vu d'en dessous : l'ouest à droite, le nord en haut (y vers le bas à l'écran).
  const k = projection === "stereo" ? 1 / (1 + z) : 1;
  return { x: y * k, y: -x * k };
}

/** Azimut et hauteur (degrés) sur la carte. */
export function projectAltAz(alt: number, az: number, projection: Projection = "stereo"): MapPoint | null {
  const a = (alt * Math.PI) / 180, b = (az * Math.PI) / 180;
  // Azimut compté du nord vers l'est ; y est l'ouest.
  return projectHor({ x: Math.cos(a) * Math.cos(b), y: -Math.cos(a) * Math.sin(b), z: Math.sin(a) }, projection);
}

const eqj = (raDeg: number, decDeg: number): A.Vector => {
  const r = (raDeg * Math.PI) / 180, d = (decDeg * Math.PI) / 180;
  return new A.Vector(Math.cos(d) * Math.cos(r), Math.cos(d) * Math.sin(r), Math.sin(d), A.MakeTime(0));
};

export function skyMap(sky: Sky, opts: { maxMag?: number; projection?: Projection } = {}): SkyMap {
  const maxMag = opts.maxMag ?? 3.9;
  const projection = opts.projection ?? "stereo";
  const rot = A.Rotation_EQJ_HOR(sky.instant, new A.Observer(sky.place.lat, sky.place.lon, 0));
  const at = (raDeg: number, decDeg: number) => projectHor(A.RotateVector(rot, eqj(raDeg, decDeg)), projection);

  const stars: MapStar[] = [];
  for (const [ra, dec, mag] of starsData.stars as number[][]) {
    if (mag > maxMag) break; // le catalogue est trié par magnitude
    const p = at(ra, dec);
    if (p) stars.push({ ...p, mag });
  }

  // Les sommets des traits sont des étoiles du catalogue (vérifié : 878 sur 884) : leur magnitude en vient.
  const magAt = new Map((starsData.stars as number[][]).map(([ra, dec, mag]) => [`${ra.toFixed(3)},${dec.toFixed(3)}`, mag]));
  const nameOf = new Map((namesData.names as { id: string; fr: string; la: string; rank: number }[]).map((n) => [n.id, n]));
  const lines: MapPoint[][] = [];
  const figures: MapFigure[] = [];
  for (const [id, segs] of Object.entries(linesData.lines as Record<string, number[][][]>)) {
    const own: MapPoint[][] = [];
    const seen = new Map<string, MapStar>();
    for (const seg of segs) {
      let run: MapPoint[] = [];
      for (const [ra, dec] of seg) {
        const p = at(ra, dec);
        if (p) {
          run.push(p);
          const k = `${ra.toFixed(3)},${dec.toFixed(3)}`;
          if (!seen.has(k)) seen.set(k, { ...p, mag: magAt.get(k) ?? 4 });
        } else { if (run.length > 1) own.push(run); run = []; }
      }
      if (run.length > 1) own.push(run);
    }
    lines.push(...own);
    const n = nameOf.get(id);
    if (own.length) figures.push({ id, text: n?.fr ?? id, la: n?.la ?? id, rank: n?.rank ?? 3, lines: own, stars: [...seen.values()] });
  }

  const names: MapLabel[] = [];
  for (const n of namesData.names as { id: string; fr: string; la: string; at: number[]; rank: number }[]) {
    const p = at(n.at[0], n.at[1]);
    if (p) names.push({ ...p, id: n.id, text: n.fr, la: n.la, rank: n.rank });
  }

  const bodies = sky.bodies.flatMap((b) => {
    const p = projectAltAz(b.alt, b.az, projection);
    return p ? [{ ...b, ...p }] : [];
  });

  // L'écliptique : la latitude écliptique nulle, tous les 2°, ramenée en équatorial J2000.
  const eps = (23.4392911 * Math.PI) / 180;
  const ecliptic: MapPoint[][] = [];
  let run: MapPoint[] = [];
  for (let l = 0; l <= 360; l += 2) {
    const lr = (l * Math.PI) / 180;
    const ra = (Math.atan2(Math.sin(lr) * Math.cos(eps), Math.cos(lr)) * 180) / Math.PI;
    const dec = (Math.asin(Math.sin(lr) * Math.sin(eps)) * 180) / Math.PI;
    const p = at(wrap(ra, 360), dec);
    if (p) run.push(p);
    else { if (run.length > 1) ecliptic.push(run); run = []; }
  }
  if (run.length > 1) ecliptic.push(run);

  return { stars, lines, names, bodies, ecliptic, figures };
}
