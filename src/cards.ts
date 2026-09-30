// Le vocabulaire commun entre les fournisseurs et l'interface.
// Un normaliseur produit des Card ; l'interface ne connaît que des Card.

export interface When {
  /** ISO 8601, toujours en UTC (suffixe Z). */
  utc: string;
  /** Lisible, dans le fuseau demandé : « 12 mars 1978, 15:00 ». */
  local: string;
}

/** Une valeur peut renvoyer vers une page ressource (Wikipédia, le plus souvent). */
/** Un lien de carte : une adresse, ou une fiche du lexique, `lex:famille:clé` (`lexRef`), qui s'ouvre en fenêtre sur la
 *  page (Ismaël, 2026-09-28 : « favoriser des fenêtres explicatives plutôt que des liens Wikipédia ; il y en a trop ») —
 *  la fiche porte ses liens Wikipédia à son pied. */
/** Un fait : le libellé, la valeur, un lien (ou `lex:famille:clé`, une fiche du lexique), et une infobulle sur le libellé
 *  (le « i » : la clé de lecture, la philosophie, la source). */
export type Fact = [label: string, value: string, href?: string, aide?: string];

/** La fiche du lexique qu'un lien désigne (`lex:famille:clé`), ou `null` pour une adresse. */
export const lexRef = (href?: string): string | null => (href?.startsWith("lex:") ? href.slice(4) : null);
/** Le lien vers une fiche du lexique. */
export const lexHref = (ref: string): string => `lex:${ref}`;

/** Une notion du lexique au milieu d'un texte (2026-09-29, Ismaël : « du contexte, des couleurs, des symboles » dans les
 *  traditions) : `⟦famille:clé|texte⟧`, que `tokenize` (lib/tint.ts) rend en jeton teinté qui ouvre sa fiche — plusieurs
 *  notions dans une même phrase (« Surya en ⟦rashi:8|Dhanu⟧, ⟦dignite:exalte|exalté⟧ »). Jamais dans un titre, jamais avec un
 *  lien sur la même valeur ; `texteSeul` rend le texte sans les marques. */
export const enLigne = (ref: string, texte: string): string => `⟦${ref}|${texte}⟧`;
export const texteSeul = (s: string): string => s.replace(/⟦[^|⟧]+\|([^⟧]+)⟧/gu, "$1");

export interface Link {
  label: string;
  href: string;
}

export interface ImageCard {
  /** Pages ressources : « en savoir plus ». */
  links?: Link[];
  kind: "image";
  title: string;
  /** Vignette ou taille d'affichage. */
  src: string;
  /** Pleine résolution, ouverte au clic. */
  full?: string;
  caption?: string;
  when?: When;
  credit?: string;
  href?: string;
  /** Mise en avant : l'image est du jour exact (médiathèque). */
  emphasis?: boolean;
  group?: string;
  /** Image haute à montrer entière (une lame de tarot), pas un paysage à recadrer. */
  portrait?: boolean;
  /** Lame renversée : affichée tête en bas, comme sur la table. */
  reversed?: boolean;
}

export interface VideoCard {
  kind: "video";
  title: string;
  /** URL d'iframe (YouTube, Vimeo) ou de fichier vidéo. */
  embed: string;
  isFile?: boolean;
  caption?: string;
  when?: When;
  href?: string;
}

export interface EventCard {
  /** Les noms des astres y ouvrent leur fiche du lexique (le Thème seul : le Ciel ne montre pas d'astrologie). */
  astro?: boolean;
  kind: "event";
  title: string;
  links?: Link[];
  /** Carte à étaler sur toute la largeur (une lecture longue), pas dans la grille. */
  wide?: boolean;
  when?: When;
  facts: Fact[];
  body?: string;
  href?: string;
  /** Événement de l'année exacte (Wikimedia) ou notable. */
  emphasis?: boolean;
  /** Regroupement visuel : « naissances », « décès »… */
  group?: string;
  /** L'infobulle du titre : ce que la tradition lit, son esprit, sa source. */
  aide?: string;
  /** Le symbole de la valeur, en image, à côté du titre (un glyphe maya, un signe aztèque) : domaine public, crédité. */
  glyphe?: { src: string; alt: string; credit: string; href?: string };
}

export interface TableCard {
  /** Les noms des astres y ouvrent leur fiche du lexique (le Thème seul : le Ciel ne montre pas d'astrologie). */
  astro?: boolean;
  kind: "table";
  title: string;
  columns: string[];
  rows: (string | number | null)[][];
  note?: string;
  /** Lien par ligne, optionnel, même longueur que rows. */
  rowLinks?: (string | undefined)[];
  /** La colonne qui porte `rowLinks` (0 par défaut : la première). */
  linkColumn?: number;
  /** Pages ressources, sous la table. */
  links?: Link[];
  group?: string;
  /** Replié d'office, ouvert à la demande : un détail qu'on ne lit pas d'abord (les maisons, les positions,
   *  les aspects du thème — Ismaël, 2026-09-27 : « moins de scroll »). */
  closed?: boolean;
  /** L'infobulle du titre, et celles des colonnes (même longueur que `columns`, `undefined` pour aucune). */
  aide?: string;
  aides?: (string | undefined)[];
}

export interface TextCard {
  kind: "text";
  title: string;
  links?: Link[];
  body: string;
  when?: When;
  href?: string;
  group?: string;
}

export interface LegendRow {
  /** Ce que la ligne désigne, pour le glossaire : "planet:Soleil", "sign:3", "house:7", "angle:AC". */
  ref: string;
  symbol: string;
  label: string;
  value: string;
  sub?: string;
  /** Titre de groupe dans la légende. */
  section?: string;
}

export interface ChartCard {
  kind: "chart";
  title: string;
  /** SVG complet, produit côté serveur par nos propres fonctions : jamais du contenu tiers. */
  svg: string;
  /** Le récapitulatif listé à côté de la roue. */
  legend?: LegendRow[];
  note?: string;
  caption?: string;
  group?: string;
}

export type Card = ImageCard | VideoCard | EventCard | TableCard | TextCard | ChartCard;

export type RunStatus =
  | "ok"
  | "empty"
  | "error"
  | "out-of-coverage"
  | "timeout";

export interface RequestTrace {
  /** URL appelée, clé caviardée. */
  url: string;
  status: number | null;
  ms: number;
  fromCache: boolean;
}

export interface RunResult {
  queryId: string;
  status: RunStatus;
  cards: Card[];
  /** Réponse(s) brute(s), clé caviardée. Une entrée par requête. */
  raw: unknown[];
  requests: RequestTrace[];
  /** Message d'erreur ou raison du hors-couverture. */
  message?: string;
  /** Précision affichée sous le titre : « à midi, heure non fournie ». */
  note?: string;
  totalMs: number;
}
