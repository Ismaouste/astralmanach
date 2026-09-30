import * as A from "astronomy-engine";
import type { Card, EventCard, Fact } from "../cards";
import type { Query } from "./types";
import { fmtDec, fmtInt } from "./shared";

// Les événements du ciel, calculés ici avec astronomy-engine (MIT, précision de l'ordre de
// la minute d'arc) : éclipses de Soleil et de Lune, phases exactes, solstices et équinoxes,
// périgée et apogée de la Lune (et la « super Lune »), oppositions et conjonctions des
// planètes, plus grandes élongations, transits de Mercure et Vénus, et les pluies d'étoiles
// filantes au maximum. Rien n'est appelé : c'est un calcul, il répond pour toute date.
// Vérifié le 2026-09-24 : éclipse totale de Soleil du 11 août 1999 à 11:03 UTC, partielle
// à 99 % depuis Paris à 10:22 ; opposition de Mars du 28 août 2003 ; nouvelle Lune le 11 août
// 1999 à 11:09.

const DAY = 86400000;
const PLANETS: { body: A.Body; name: string; inner: boolean }[] = [
  { body: A.Body.Mercury, name: "Mercure", inner: true }, { body: A.Body.Venus, name: "Vénus", inner: true },
  { body: A.Body.Mars, name: "Mars", inner: false }, { body: A.Body.Jupiter, name: "Jupiter", inner: false },
  { body: A.Body.Saturn, name: "Saturne", inner: false }, { body: A.Body.Uranus, name: "Uranus", inner: false }, { body: A.Body.Neptune, name: "Neptune", inner: false },
];
// Les grandes pluies, au maximum (IMO) : jour, mois, taux horaire zénithal, parent.
export const SHOWERS: { name: string; month: number; day: number; zhr: number; parent: string }[] = [
  { name: "Quadrantides", month: 1, day: 3, zhr: 110, parent: "l'astéroïde 2003 EH1" },
  { name: "Lyrides", month: 4, day: 22, zhr: 18, parent: "la comète Thatcher" },
  { name: "Êta Aquarides", month: 5, day: 6, zhr: 50, parent: "la comète de Halley" },
  { name: "Delta Aquarides", month: 7, day: 30, zhr: 25, parent: "la comète 96P/Machholz" },
  { name: "Perséides", month: 8, day: 12, zhr: 100, parent: "la comète Swift-Tuttle" },
  { name: "Orionides", month: 10, day: 21, zhr: 20, parent: "la comète de Halley" },
  { name: "Léonides", month: 11, day: 17, zhr: 15, parent: "la comète Tempel-Tuttle" },
  { name: "Géminides", month: 12, day: 14, zhr: 150, parent: "l'astéroïde Phaéton" },
  { name: "Ursides", month: 12, day: 22, zhr: 10, parent: "la comète Tuttle" },
];
const QUARTER = ["nouvelle Lune", "premier quartier", "pleine Lune", "dernier quartier"];
const ECLIPSE: Record<string, string> = { total: "totale", annular: "annulaire", partial: "partielle", penumbral: "par la pénombre" };

function when(d: Date, tz: string): { local: string; utc: string } {
  return { local: new Intl.DateTimeFormat("fr-FR", { timeZone: tz, day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d), utc: d.toISOString() };
}
function inWindow(d: Date, from: Date, to: Date) { return d >= from && d <= to; }

export const skyEvents: Query = {
  id: "astro.evenements",
  provider: "astro",
  label: "Les événements du ciel",
  hint: "Éclipses, phases exactes, solstices et équinoxes, périgée et apogée de la Lune, oppositions, conjonctions, plus grandes élongations, transits, pluies d'étoiles filantes — calculés ici, pour toute date.",
  granularity: "window",
  coverage: { from: "1600-01-01", to: "2500-12-31", note: "calcul valable de 1600 à 2500" },
  needsKey: false,
  note: (ctx) => `calculé (astronomy-engine)${ctx.windowDays ? `, ± ${ctx.windowDays} jour${ctx.windowDays > 1 ? "s" : ""}` : ", le jour"}${ctx.place ? `, éclipse vue depuis ${ctx.place.name}` : ""}`,
  build: () => [],
  normalize: (_raws, ctx) => {
    const half = Math.max(0, ctx.windowDays) * DAY;
    const dayStart = new Date(`${ctx.date}T00:00:00Z`);
    const from = new Date(dayStart.getTime() - half - 12 * 3600000), to = new Date(dayStart.getTime() + DAY + half + 12 * 3600000);
    const cards: Card[] = [];
    const push = (title: string, at: Date, facts: Fact[], body: string, emphasis = false, links: EventCard["links"] = []) => {
      cards.push({ kind: "event", title, when: when(at, ctx.tz), facts, body, emphasis, links });
    };
    const searchFrom = new Date(from.getTime() - 30 * DAY);

    // Éclipses de Soleil (globales, puis vues du lieu).
    try {
      let e = A.SearchGlobalSolarEclipse(searchFrom);
      for (let i = 0; i < 3 && e; i++) {
        const peak = e.peak.date;
        if (peak > to) break;
        if (inWindow(peak, from, to)) {
          const facts: Fact[] = [["Type", `éclipse ${ECLIPSE[e.kind] ?? e.kind} de Soleil`], ["Maximum", when(peak, ctx.tz).local], ["Obscurcissement", e.kind === "partial" || e.obscuration === undefined ? "partiel" : fmtInt(e.obscuration * 100, " %")]];
          if (e.latitude !== undefined && e.kind !== "partial") facts.push(["Maximum vu depuis", `${fmtDec(e.latitude, 1, "°")}, ${fmtDec(e.longitude, 1, "°")}`]);
          if (ctx.place) {
            try {
              const loc = A.SearchLocalSolarEclipse(new Date(peak.getTime() - 2 * DAY), new A.Observer(ctx.place.lat, ctx.place.lon, 0));
              if (Math.abs(loc.peak.time.date.getTime() - peak.getTime()) < 2 * DAY) facts.push([`Depuis ${ctx.place.name}`, `${ECLIPSE[loc.kind] ?? loc.kind}, ${fmtInt(loc.obscuration * 100, " %")} du Soleil caché à ${when(loc.peak.time.date, ctx.tz).local.slice(-5)}${loc.peak.altitude < 0 ? " (Soleil sous l'horizon)" : ""}`]);
              else facts.push([`Depuis ${ctx.place.name}`, "invisible"]);
            } catch { facts.push([`Depuis ${ctx.place.name}`, "invisible"]); }
          }
          push(`Éclipse ${ECLIPSE[e.kind] ?? e.kind} de Soleil`, peak, facts, "La Lune passe devant le Soleil. L'obscurcissement est la part du disque cachée au maximum, là où l'éclipse est la plus forte.", true, [{ label: "Les éclipses de Soleil, sur Wikipédia", href: "https://fr.wikipedia.org/wiki/%C3%89clipse_solaire" }]);
        }
        e = A.NextGlobalSolarEclipse(e.peak);
      }
    } catch { /* hors de portée du calcul */ }

    // Éclipses de Lune.
    try {
      let e = A.SearchLunarEclipse(searchFrom);
      for (let i = 0; i < 3 && e; i++) {
        const peak = e.peak.date;
        if (peak > to) break;
        if (inWindow(peak, from, to)) {
          push(`Éclipse ${ECLIPSE[e.kind] ?? e.kind} de Lune`, peak, [["Type", `éclipse ${ECLIPSE[e.kind] ?? e.kind} de Lune`], ["Maximum", when(peak, ctx.tz).local], ["Durée", e.sd_total ? `totalité ${fmtInt(e.sd_total * 2, " min")}` : e.sd_partial ? `phase partielle ${fmtInt(e.sd_partial * 2, " min")}` : `pénombre ${fmtInt(e.sd_penum * 2, " min")}`]], "La Lune traverse l'ombre de la Terre : visible de partout où la Lune est levée.", e.kind === "total", [{ label: "Les éclipses de Lune, sur Wikipédia", href: "https://fr.wikipedia.org/wiki/%C3%89clipse_lunaire" }]);
        }
        e = A.NextLunarEclipse(e.peak);
      }
    } catch { /* idem */ }

    // Phase exacte, périgée, apogée.
    try {
      let q = A.SearchMoonQuarter(from);
      while (q && q.time.date <= to) {
        const isFull = q.quarter === 2;
        let extra = "";
        if (isFull || q.quarter === 0) {
          const ap = A.SearchLunarApsis(new Date(q.time.date.getTime() - 1.5 * DAY));
          if (ap.kind === A.ApsisKind.Pericenter && Math.abs(ap.time.date.getTime() - q.time.date.getTime()) < 1.5 * DAY && ap.dist_km < 360000) extra = isFull ? " — super Lune : pleine à moins d'un jour du périgée" : " — nouvelle Lune au périgée : grandes marées";
        }
        push(QUARTER[q.quarter][0].toUpperCase() + QUARTER[q.quarter].slice(1) + extra, q.time.date, [["Instant exact", when(q.time.date, ctx.tz).local]], isFull ? "La Lune pleine se lève quand le Soleil se couche." : q.quarter === 0 ? "Nouvelle Lune : le ciel est noir, les étoiles faibles se montrent." : "Un quartier : la Lune est à demi éclairée.", !!extra);
        q = A.NextMoonQuarter(q);
      }
      let ap = A.SearchLunarApsis(from);
      while (ap && ap.time.date <= to) {
        push(ap.kind === A.ApsisKind.Pericenter ? "Lune au périgée" : "Lune à l'apogée", ap.time.date, [["Distance", fmtInt(ap.dist_km, " km")]], ap.kind === A.ApsisKind.Pericenter ? "Le point de l'orbite le plus proche de la Terre." : "Le point de l'orbite le plus loin de la Terre.");
        ap = A.NextLunarApsis(ap);
      }
    } catch { /* idem */ }

    // Saisons.
    try {
      for (const y of [Number(ctx.date.slice(0, 4)) - 1, Number(ctx.date.slice(0, 4)), Number(ctx.date.slice(0, 4)) + 1]) {
        const s = A.Seasons(y);
        for (const [label, t] of [["Équinoxe de mars", s.mar_equinox], ["Solstice de juin", s.jun_solstice], ["Équinoxe de septembre", s.sep_equinox], ["Solstice de décembre", s.dec_solstice]] as const) {
          if (inWindow(t.date, from, to)) push(label, t.date, [["Instant exact", when(t.date, ctx.tz).local]], label.startsWith("Solstice") ? "Le Soleil atteint sa déclinaison extrême : le jour le plus long ou le plus court de l'année." : "Le Soleil traverse l'équateur céleste : jour et nuit presque égaux partout.");
        }
      }
    } catch { /* idem */ }

    // Oppositions, conjonctions, élongations, transits.
    for (const p of PLANETS) {
      try {
        for (const [rel, label] of (p.inner ? [[0, "conjonction inférieure"], [180, "conjonction supérieure"]] : [[0, "opposition"], [180, "conjonction"]]) as [number, string][]) {
          const t = A.SearchRelativeLongitude(p.body, rel, searchFrom);
          if (inWindow(t.date, from, to)) {
            const facts: Fact[] = [["Instant", when(t.date, ctx.tz).local]];
            if (label === "opposition") { const geo = A.GeoVector(p.body, t, true); facts.push(["Distance", fmtDec(Math.hypot(geo.x, geo.y, geo.z), 3, " UA")]); }
            push(`${p.name} en ${label}`, t.date, facts, label === "opposition" ? `${p.name} est à l'opposé du Soleil : au plus près, au plus brillant, visible toute la nuit.` : label === "conjonction inférieure" ? `${p.name} passe entre la Terre et le Soleil.` : `${p.name} passe derrière le Soleil : invisible.`, label === "opposition");
          }
        }
        if (p.inner) {
          const el = A.SearchMaxElongation(p.body, searchFrom);
          if (inWindow(el.time.date, from, to)) push(`${p.name} à sa plus grande élongation`, el.time.date, [["Écart au Soleil", fmtDec(el.elongation, 1, "°")], ["Visible", el.visibility === "morning" ? "le matin, avant le lever du Soleil" : "le soir, après le coucher du Soleil"]], `Le moment où ${p.name} s'éloigne le plus du Soleil dans le ciel : le meilleur pour la voir.`);
          const tr = A.SearchTransit(p.body, searchFrom);
          if (inWindow(tr.peak.date, from, to)) push(`Transit de ${p.name} devant le Soleil`, tr.peak.date, [["Milieu", when(tr.peak.date, ctx.tz).local], ["Du début à la fin", `${when(tr.start.date, ctx.tz).local.slice(-5)} à ${when(tr.finish.date, ctx.tz).local.slice(-5)}`]], `${p.name} passe devant le disque du Soleil : un point noir qui le traverse en quelques heures. Rare.`, true, [{ label: `Le transit de ${p.name}, sur Wikipédia`, href: `https://fr.wikipedia.org/wiki/Transit_de_${p.name === "Vénus" ? "V%C3%A9nus" : "Mercure"}` }]);
        }
      } catch { /* une planète sans réponse ne bloque pas les autres */ }
    }

    // Pluies d'étoiles filantes au maximum.
    for (const s of SHOWERS) {
      for (const y of [Number(ctx.date.slice(0, 4)) - 1, Number(ctx.date.slice(0, 4)), Number(ctx.date.slice(0, 4)) + 1]) {
        const peak = new Date(Date.UTC(y, s.month - 1, s.day, 12));
        if (inWindow(peak, from, to)) push(`Maximum des ${s.name}`, peak, [["Taux horaire zénithal", `jusqu'à ${s.zhr} par heure, ciel noir et radiant au zénith`], ["Corps parent", s.parent]], "Une pluie d'étoiles filantes : la Terre traverse la poussière laissée par une comète ou un astéroïde. Le maximum est donné au jour près.", s.zhr >= 100, [{ label: `Les ${s.name}, sur Wikipédia`, href: `https://fr.wikipedia.org/wiki/${encodeURIComponent(s.name)}` }]);
      }
    }

    cards.sort((a, b) => ((a.kind === "event" && a.when?.utc) || "").localeCompare((b.kind === "event" && b.when?.utc) || ""));
    if (!cards.length) return [{ kind: "text", title: "Un ciel sans événement", body: "Ni éclipse, ni phase exacte, ni solstice, ni opposition, ni pluie d'étoiles au maximum dans la fenêtre. Élargir la fenêtre pour voir ce qui approche.", href: "https://fr.wikipedia.org/wiki/Ph%C3%A9nom%C3%A8ne_astronomique" }];
    return cards;
  },
};
