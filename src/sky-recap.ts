import * as A from "astronomy-engine";
import { moonPhaseName, skyAt } from "./voute";
import { formatYmd, makeContext, zonedToUtc, type Place } from "./time";

// Le ciel d'une date en une phrase, pour le partage du Ciel et du Certificat (Ismaël, 2026-09-27 : « des
// adresses partageables, un titre et une description qui disent le récap, une image qui l'illustre ») : la
// phase de la Lune, le lever et le coucher du Soleil au lieu, les planètes à l'œil nu à l'heure dite. Ni
// astrologie (le Ciel n'en montre pas), ni réseau : astronomy-engine (MIT), sur le serveur. Pur et testé
// (test/sky-recap.test.ts).

export interface SkyRecap {
  /** « 4 mai 1990 » ou « 4 mai 1990 à 14:30 ». */
  when: string;
  place?: string;
  moon: { name: string; illum: number; phase: number };
  /** Au lieu : le lever et le coucher du Soleil, heure locale (« 06:22 »). */
  sun?: { rise?: string; set?: string };
  /** À l'heure et au lieu : les planètes au-dessus de l'horizon, visibles à l'œil nu, s'il fait nuit. */
  visible?: string[];
  /** Le Soleil est-il couché (sous −6°) à l'heure dite ? */
  night?: boolean;
  headline: string;
  /** Ce qu'on voyait, sans la date : la Lune, les planètes, le Soleil levé et couché (l'aperçu d'un lien). */
  detail: string;
  summary: string;
}

const hhmm = (at: Date, tz: string) => new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(at);
const list = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} et ${xs[xs.length - 1]}`);

export function skyRecap(input: { date: string; time?: string; place?: Place; tz?: string }): SkyRecap {
  const ctx = makeContext(input);
  const phase = A.MoonPhase(ctx.instant);
  const illum = Math.round(A.Illumination(A.Body.Moon, ctx.instant).phase_fraction * 100);
  const sky = ctx.place ? skyAt(ctx.instant, ctx.place) : undefined;
  const moon = { name: moonPhaseName(phase), illum, phase };

  let sun: SkyRecap["sun"];
  if (ctx.place) {
    const [y, m, d] = ctx.date.split("-").map(Number);
    const start = A.MakeTime(zonedToUtc(y, m, d, 0, 0, ctx.tz));
    const obs = new A.Observer(ctx.place.lat, ctx.place.lon, 0);
    const rise = A.SearchRiseSet(A.Body.Sun, obs, +1, start, 1);
    const set = A.SearchRiseSet(A.Body.Sun, obs, -1, start, 1);
    sun = { rise: rise ? hhmm(rise.date, ctx.tz) : undefined, set: set ? hhmm(set.date, ctx.tz) : undefined };
  }
  const sunAlt = sky?.bodies.find((b) => b.id === "soleil")?.alt;
  const night = ctx.hasTime && sunAlt !== undefined ? sunAlt < -6 : undefined;
  const visible = ctx.hasTime && sky
    ? sky.bodies.filter((b) => b.id !== "soleil" && b.id !== "lune" && b.alt > 0 && b.mag < 5.5).map((b) => b.name)
    : undefined;

  const when = `${formatYmd(ctx.date)}${ctx.hasTime ? ` à ${ctx.time}` : ""}`;
  const place = ctx.place?.name;
  const moonBit = `${moon.name[0].toUpperCase()}${moon.name.slice(1)} (${illum} %)`;
  const sky1 = visible === undefined ? "" : night ? (visible.length ? `${list(visible)} à l'œil nu` : "aucune planète à l'œil nu") : `${visible.length ? `${list(visible)} au-dessus de l'horizon, ` : ""}en plein jour`;
  const headline = [moonBit, sky1].filter(Boolean).join(", ");
  const sunBit = sun?.rise && sun.set ? `Soleil levé à ${sun.rise}, couché à ${sun.set}` : "";
  const detail = `${[headline, sunBit].filter(Boolean).join(" ; ")}.`;
  const full = `${when}${place ? `, ${place}` : ""} : ${detail}`;
  return { when, place, moon, sun, visible, night, headline, detail, summary: full.length <= 155 ? full : `${full.slice(0, 154)}…` };
}
