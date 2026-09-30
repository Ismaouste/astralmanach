import type { Card, Fact } from "../cards";
import type { Query } from "./types";
import { addDays } from "../time";
import { fmtDec, fmtInt, isObj, num, str, whenFrom, withParams } from "./shared";
import { mapAt, signed } from "../lieu";

// CNEOS Fireball : les petits astéroïdes entrés dans l'atmosphère, vus comme des météores très
// lumineux par les capteurs gouvernementaux américains depuis 1988. On ne dit pas « bolide » : le
// mot est juste mais obscur (Ismaël, 2026-09-24) ; « astéroïde » dit ce qui est tombé.
// Réponse en colonnes : `fields` + `data` (tableau de tableaux de chaînes).

function tabular(raw: unknown): Record<string, string>[] {
  if (!isObj(raw) || !Array.isArray(raw.fields) || !Array.isArray(raw.data)) return [];
  const fields = raw.fields.map(str);
  return raw.data.filter(Array.isArray).map((row) => {
    const o: Record<string, string> = {};
    fields.forEach((f, i) => { o[f] = str(row[i]); });
    return o;
  });
}

export const fireballs: Query = {
  id: "jpl.fireball",
  provider: "jpl",
  label: "Astéroïdes et météores",
  hint: "Les petits astéroïdes entrés dans l'atmosphère, vus comme des météores très lumineux : heure, lieu, énergie libérée.",
  granularity: "window",
  coverage: { from: "1988-04-15", to: "today", note: "le catalogue commence en avril 1988" },
  needsKey: false,
  // date-max est lue à 00:00 : on passe au lendemain pour inclure le dernier jour.
  build: (ctx) => [{ url: withParams("https://ssd-api.jpl.nasa.gov/fireball.api", { "date-min": ctx.from, "date-max": addDays(ctx.to, 1) }), label: "Fireballs" }],
  normalize: ([raw], ctx) => {
    return tabular(raw).map((r): Card => {
      const e = num(r.energy);
      const imp = num(r["impact-e"]);
      const lat = r.lat ? `${r.lat}° ${r["lat-dir"]}` : "—";
      const lon = r.lon ? `${r.lon}° ${r["lon-dir"] === "W" ? "O" : r["lon-dir"]}` : "—";
      const facts: Fact[] = [
        // Le champ `energy` est déjà exprimé en unités de 10¹⁰ J (documentation de l'API).
        ["Énergie rayonnée", e !== undefined ? `${fmtInt(e)} × 10¹⁰ J` : "—"],
        ["Énergie d'impact", imp !== undefined ? `${fmtDec(imp, 2)} kt TNT` : "—"],
        ["Latitude", lat],
        ["Longitude", lon],
        ["Altitude", r.alt ? `${r.alt} km` : "—"],
        ["Vitesse", r.vel ? `${r.vel} km/s` : "—"],
      ];
      const la = signed(r.lat, r["lat-dir"]), lo = signed(r.lon, r["lon-dir"]);
      if (la !== undefined && lo !== undefined) facts.push(["Sur la carte", "le point d'entrée", mapAt(la, lo, 5)]);
      return {
        kind: "event",
        title: imp !== undefined && imp >= 10 ? "Astéroïde entré dans l'atmosphère" : "Météore lumineux",
        when: whenFrom(r.date, ctx.tz),
        facts,
        href: "https://cneos.jpl.nasa.gov/fireballs/",
        emphasis: imp !== undefined && imp >= 10,
      };
    });
  },
};

export { tabular };
