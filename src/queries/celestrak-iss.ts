import * as sat from "satellite.js";
import type { Card, Fact } from "../cards";
import { formatLocal, whenOf, zonedToUtc } from "../time";
import type { Query } from "./types";
import { compass, towards } from "./shared";

// La Station spatiale internationale, vue du lieu : ses passages visibles ce jour-là.
// Éléments orbitaux actuels de CelesTrak, propagés en SGP4 ici. Les éléments passés ne sont
// pas publics librement : le calcul n'a de sens qu'à quelques jours d'aujourd'hui, et la
// carte le dit. Un passage est « visible » si la station est au-dessus de 10°, éclairée
// par le Soleil, et l'observateur dans la nuit (Soleil sous −6°).

const TLE_URL = "https://celestrak.org/NORAD/elements/gp.php?CATNR=25544&FORMAT=TLE";
const MAX_DAYS = 6;

function sunEci(date: Date): { x: number; y: number; z: number } {
  // Position du Soleil (ECI, km), formule basse précision (Astronomical Almanac), largement suffisante pour l'ombre.
  const jd = date.getTime() / 86_400_000 + 2_440_587.5;
  const n = jd - 2_451_545.0;
  const L = ((280.46 + 0.9856474 * n) % 360 + 360) % 360;
  const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * (Math.PI / 180);
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * (Math.PI / 180);
  const eps = (23.439 - 0.0000004 * n) * (Math.PI / 180);
  const r = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g);
  const au = 149_597_870.7;
  return { x: r * au * Math.cos(lambda), y: r * au * Math.cos(eps) * Math.sin(lambda), z: r * au * Math.sin(eps) * Math.sin(lambda) };
}

/** La station est-elle éclairée ? Vrai si elle n'est pas dans le cylindre d'ombre de la Terre. */
function sunlit(pos: { x: number; y: number; z: number }, sun: { x: number; y: number; z: number }): boolean {
  const sn = Math.hypot(sun.x, sun.y, sun.z);
  const ux = sun.x / sn, uy = sun.y / sn, uz = sun.z / sn;
  const dot = pos.x * ux + pos.y * uy + pos.z * uz;
  if (dot > 0) return true;
  const perp = Math.hypot(pos.x - dot * ux, pos.y - dot * uy, pos.z - dot * uz);
  return perp > 6371;
}

/** Hauteur du Soleil sur l'horizon de l'observateur, en degrés. */
function sunElevation(date: Date, lat: number, lon: number): number {
  const s = sunEci(date);
  const gmst = sat.gstime(date);
  const ecf = sat.eciToEcf(s, gmst);
  const look = sat.ecfToLookAngles({ latitude: sat.degreesToRadians(lat), longitude: sat.degreesToRadians(lon), height: 0 }, ecf);
  return look.elevation * (180 / Math.PI);
}

export const issPasses: Query = {
  id: "celestrak.iss",
  provider: "usno",
  label: "La Station spatiale internationale",
  hint: "Ses passages visibles depuis le lieu ce jour-là : heure, hauteur, direction. Calculable seulement à quelques jours d'aujourd'hui.",
  granularity: "day",
  coverage: { from: "1998-11-20", to: "today", note: "la station est en orbite depuis le 20 novembre 1998" },
  needsKey: false,
  note: (ctx) => (ctx.place ? `depuis ${ctx.place.name} ; éléments orbitaux du jour, propagés` : "indiquez un lieu : un passage se voit d'un endroit"),
  build: (ctx) => (ctx.place ? [{ url: TLE_URL, label: "TLE" }] : []),
  normalize: ([raw], ctx) => {
    if (!ctx.place || typeof raw !== "string") return [];
    const lines = raw.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const l1 = lines.find((l) => l.startsWith("1 ")), l2 = lines.find((l) => l.startsWith("2 "));
    if (!l1 || !l2) return [];
    const satrec = sat.twoline2satrec(l1, l2);
    // Époque des éléments : année et jour décimal, colonnes 19-32 de la ligne 1.
    const epochYear = 2000 + Number(l1.slice(18, 20)), epochDay = Number(l1.slice(20, 32));
    const epoch = new Date(Date.UTC(epochYear, 0, 1) + (epochDay - 1) * 86_400_000);
    const dayStart = zonedToUtc(ctx.year, ctx.month, ctx.day, 0, 0, ctx.tz);
    const gap = Math.abs(dayStart.getTime() - epoch.getTime()) / 86_400_000;
    const stale = gap > MAX_DAYS;
    const observer = { latitude: sat.degreesToRadians(ctx.place.lat), longitude: sat.degreesToRadians(ctx.place.lon), height: 0 };

    type Pass = { start: Date; end: Date; max: number; maxAt: Date; azStart: number; azEnd: number; visible: boolean };
    const passes: Pass[] = [];
    let cur: Pass | null = null;
    for (let t = 0; t < 86_400; t += 10) {
      const date = new Date(dayStart.getTime() + t * 1000);
      const pv = sat.propagate(satrec, date);
      if (!pv || typeof pv.position !== "object" || !pv.position) { break; }
      const gmst = sat.gstime(date);
      const ecf = sat.eciToEcf(pv.position, gmst);
      const look = sat.ecfToLookAngles(observer, ecf);
      const el = look.elevation * (180 / Math.PI), az = look.azimuth * (180 / Math.PI);
      if (el > 10) {
        const lit = sunlit(pv.position, sunEci(date)) && sunElevation(date, ctx.place.lat, ctx.place.lon) < -6;
        if (!cur) cur = { start: date, end: date, max: el, maxAt: date, azStart: az, azEnd: az, visible: lit };
        cur.end = date; cur.azEnd = az; cur.visible = cur.visible || lit;
        if (el > cur.max) { cur.max = el; cur.maxAt = date; }
      } else if (cur) { passes.push(cur); cur = null; }
    }
    if (cur) passes.push(cur);

    const visible = passes.filter((p) => p.visible);
    const cards: Card[] = [];
    const dayLabel = formatLocal(dayStart, ctx.tz, false);
    if (stale) {
      cards.push({
        kind: "text",
        title: "Pas de calcul fiable pour cette date",
        body: `Les éléments orbitaux publics datent du ${formatLocal(epoch, ctx.tz)} ; à ${Math.round(gap)} jours d'écart, l'orbite de la station a trop dérivé pour dire où elle était. Les éléments passés ne sont pas en accès libre. Le calcul vaut à moins de ${MAX_DAYS} jours d'aujourd'hui.`,
        href: "https://celestrak.org/",
        links: [{ label: "La Station spatiale internationale, sur Wikipédia", href: "https://fr.wikipedia.org/wiki/Station_spatiale_internationale" }],
      });
      return cards;
    }
    if (!visible.length) {
      cards.push({
        kind: "text",
        title: `Aucun passage visible le ${dayLabel}`,
        body: `${passes.length ? `${passes.length} passage${passes.length > 1 ? "s" : ""} au-dessus de 10°, mais en plein jour ou dans l'ombre de la Terre.` : "La station n'est pas passée au-dessus de 10° sur l'horizon."} Éléments orbitaux du ${formatLocal(epoch, ctx.tz)}.`,
        href: "https://spotthestation.nasa.gov/",
        links: [{ label: "La Station spatiale internationale, sur Wikipédia", href: "https://fr.wikipedia.org/wiki/Station_spatiale_internationale" }],
      });
      return cards;
    }
    for (const p of visible) {
      const facts: Fact[] = [
        ["Apparaît", `${formatLocal(p.start, ctx.tz).split(" à ")[1]} ${towards(compass(p.azStart))}`],
        ["Plus haut", `${Math.round(p.max)}° à ${formatLocal(p.maxAt, ctx.tz).split(" à ")[1]}`],
        ["Disparaît", `${formatLocal(p.end, ctx.tz).split(" à ")[1]} ${towards(compass(p.azEnd))}`],
        ["Durée", `${Math.round((p.end.getTime() - p.start.getTime()) / 60_000)} min`],
      ];
      cards.push({
        kind: "event",
        title: p.max >= 60 ? "Passage haut, un point brillant qui traverse le ciel" : p.max >= 30 ? "Passage visible" : "Passage bas sur l'horizon",
        when: whenOf(p.maxAt, ctx.tz),
        facts,
        body: "Un point blanc, sans clignotement, plus brillant qu'une étoile, qui traverse le ciel en quelques minutes : c'est elle, éclairée par le Soleil couché pour vous.",
        href: "https://spotthestation.nasa.gov/",
        emphasis: p.max >= 60,
        links: [{ label: "La Station spatiale internationale, sur Wikipédia", href: "https://fr.wikipedia.org/wiki/Station_spatiale_internationale" }],
      });
    }
    return cards;
  },
};
