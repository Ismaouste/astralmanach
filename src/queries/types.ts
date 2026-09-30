import type { Card } from "../cards";
import type { RunContext } from "../time";

export type ProviderId = "nasa" | "jpl" | "wikimedia" | "local" | "meteo" | "usgs" | "usno" | "cnrs" | "astro" | "tsd" | "georisques" | "gallica";

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  homepage: string;
  /** Une phrase pour Florian. */
  blurb: string;
}

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  nasa: {
    id: "nasa",
    label: "NASA open data",
    homepage: "https://api.nasa.gov/",
    blurb: "Archives d'observations : ce que les instruments ont enregistré ce jour-là.",
  },
  jpl: {
    id: "jpl",
    label: "NASA / JPL",
    homepage: "https://ssd.jpl.nasa.gov/",
    blurb: "Calculs et catalogues du Jet Propulsion Laboratory : positions, passages, astéroïdes.",
  },
  wikimedia: {
    id: "wikimedia",
    label: "Wikipédia",
    homepage: "https://api.wikimedia.org/",
    blurb: "Ce qui s'est passé ce jour-là, toutes années confondues.",
  },
  meteo: {
    id: "meteo",
    label: "Open-Meteo",
    homepage: "https://open-meteo.com/",
    blurb: "Le temps qu'il faisait, le jour contre sa normale, l'air qu'on respirait : réanalyses ERA5 (depuis 1940) et CAMS (depuis 2013), au lieu choisi.",
  },
  usgs: {
    id: "usgs",
    label: "USGS",
    homepage: "https://earthquake.usgs.gov/",
    blurb: "Les séismes enregistrés dans le monde, et près du lieu choisi.",
  },
  astro: {
    id: "astro",
    label: "Calculé ici",
    homepage: "https://github.com/cosinekitty/astronomy",
    blurb: "Éclipses, phases, saisons, oppositions, pluies d'étoiles : des éphémérides calculées sur place, pour toute date.",
  },
  tsd: {
    id: "tsd",
    label: "The Space Devs",
    homepage: "https://thespacedevs.com/llapi",
    blurb: "Launch Library 2 : tous les lancements depuis 1957, et les événements du vol habité.",
  },
  georisques: {
    id: "georisques",
    label: "Géorisques",
    homepage: "https://www.georisques.gouv.fr/",
    blurb: "Les risques recensés par l'État pour la commune, et les installations classées autour. France.",
  },
  gallica: {
    id: "gallica",
    label: "Gallica, BnF",
    homepage: "https://gallica.bnf.fr/",
    blurb: "La bibliothèque numérique de la BnF : la presse du jour, locale et nationale, surtout de 1870 à 1944.",
  },
  cnrs: {
    id: "cnrs",
    label: "CNRS, PFAS Data Hub",
    homepage: "https://pdh.cnrs.fr/",
    blurb: "La carte des polluants éternels en Europe (Forever Pollution Project), autour du lieu choisi.",
  },
  usno: {
    id: "usno",
    label: "US Naval Observatory",
    homepage: "https://aa.usno.navy.mil/",
    blurb: "Levers et couchers du Soleil et de la Lune, au lieu choisi.",
  },
  local: {
    id: "local",
    label: "Traditions",
    homepage: "/documents/spec-ciel",
    blurb: "Tarot, numérologie, zodiaque chinois : calculé ici, sans appel extérieur. Des traditions, pas des mesures.",
  },
};

export type Granularity = "day" | "window" | "instant" | "year";

export const GRANULARITY_LABEL: Record<Granularity, string> = {
  day: "le jour",
  window: "la fenêtre",
  instant: "l'instant",
  year: "l'année",
};

export interface Coverage {
  /** YYYY-MM-DD ; absent = pas de borne. */
  from?: string;
  /** YYYY-MM-DD, ou "today". */
  to?: string | "today";
  /** Explication affichée quand la date sort de la couverture. */
  note?: string;
}

export interface ProviderRequest {
  url: string;
  headers?: Record<string, string>;
  /** Étiquette courte (« Lune », « Soleil ») pour la trace. */
  label?: string;
}

export interface Query {
  id: string;
  provider: ProviderId;
  label: string;
  hint: string;
  granularity: Granularity;
  coverage: Coverage;
  needsKey: boolean;
  /** Requêtes simultanées tolérées par le fournisseur (défaut 4 ; Horizons n'en supporte qu'une). */
  concurrency?: number;
  /** Une ou plusieurs requêtes ; `key` est la clé NASA (ou DEMO_KEY). */
  build(ctx: RunContext, key: string): ProviderRequest[];
  /** Reçoit les réponses dans l'ordre de `build`. Forme inconnue -> []. */
  normalize(raws: unknown[], ctx: RunContext): Card[];
  /** Précision affichée sous le titre du résultat. */
  note?(ctx: RunContext): string | undefined;
  /** Où la source se range dans le Ciel : le ciel (astronomie, par défaut) ou « autre » (météo, sol, monde). */
  family?: "ciel" | "autre";
  /** Replié par défaut dans les résultats : ce qui n'est pas directement lié au jour (médiathèque, ce jour-là). */
  folded?: boolean;
}

/** Vérifie la couverture d'une requête pour une date civile. */
export function coverageCheck(q: Query, date: string, today: string): { ok: true } | { ok: false; reason: string } {
  const { from, to, note } = q.coverage;
  if (from && date < from) {
    return { ok: false, reason: note ?? `archive ouverte le ${from}` };
  }
  const upper = to === "today" ? today : to;
  if (upper && date > upper) {
    return { ok: false, reason: to === "today" ? "date dans le futur" : (note ?? `archive close le ${upper}`) };
  }
  return { ok: true };
}
