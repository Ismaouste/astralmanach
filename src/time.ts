// Date civile + heure + fuseau -> instant UTC, fenêtre de jours, formats.
// Sans bibliothèque : Intl suffit, et le fuseau par défaut est celui de Florian.

export const DEFAULT_TZ = "Europe/Paris";

export interface Place {
  name: string;
  lat: number;
  lon: number;
  /** Fuseau du lieu, IANA. */
  tz?: string;
}

export interface RunContext {
  /** Date civile demandée, YYYY-MM-DD. */
  date: string;
  /** Lieu (naissance, observation), si fourni. */
  place?: Place;
  /** Heure civile, HH:MM, si fournie. */
  time?: string;
  tz: string;
  /** L'instant UTC : l'heure fournie, sinon midi local. */
  instant: Date;
  hasTime: boolean;
  /** Demi-largeur de la fenêtre en jours (0 = le jour seul). */
  windowDays: number;
  /** Bornes de la fenêtre, YYYY-MM-DD, incluses. */
  from: string;
  to: string;
  year: number;
  month: number;
  day: number;
}

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;
const HM = /^(\d{2}):(\d{2})$/;

export function isValidDate(s: string): boolean {
  const m = YMD.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(y, mo - 1, d));
  return (
    probe.getUTCFullYear() === y &&
    probe.getUTCMonth() === mo - 1 &&
    probe.getUTCDate() === d
  );
}

export function isValidTime(s: string): boolean {
  const m = HM.exec(s);
  if (!m) return false;
  return Number(m[1]) < 24 && Number(m[2]) < 60;
}

export function isValidTz(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Décalage (ms) entre l'heure murale du fuseau et UTC, à un instant donné. */
function tzOffsetMs(at: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const p: Record<string, number> = {};
  for (const part of dtf.formatToParts(at)) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - at.getTime();
}

/** Décalage du fuseau à un instant, en heures (ex. 2 pour Paris l'été). */
export function tzOffsetHours(at: Date, tz: string): number {
  return Math.round((tzOffsetMs(at, tz) / 3_600_000) * 4) / 4;
}

/** Heure murale d'un fuseau -> instant UTC. Deux itérations couvrent les bascules d'heure d'été. */
export function zonedToUtc(
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  tz: string,
): Date {
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  let guess = wall - tzOffsetMs(new Date(wall), tz);
  guess = wall - tzOffsetMs(new Date(guess), tz);
  return new Date(guess);
}

export function addDays(ymd: string, n: number): string {
  const m = YMD.exec(ymd);
  if (!m) throw new Error(`date invalide : ${ymd}`);
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + n);
  return new Date(t).toISOString().slice(0, 10);
}

export function todayYmd(tz: string = DEFAULT_TZ): string {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return dtf.format(new Date());
}

export function makeContext(input: {
  date: string;
  time?: string;
  tz?: string;
  windowDays?: number;
  place?: Place;
}): RunContext {
  const { date } = input;
  if (!isValidDate(date)) throw new Error(`date invalide : ${date}`);
  const place = input.place && Number.isFinite(input.place.lat) && Number.isFinite(input.place.lon)
    ? { ...input.place, lat: Math.max(-90, Math.min(90, input.place.lat)), lon: Math.max(-180, Math.min(180, input.place.lon)) }
    : undefined;
  // Le fuseau explicite prime ; sinon celui du lieu ; sinon Paris.
  const tz = input.tz && isValidTz(input.tz) ? input.tz : place?.tz && isValidTz(place.tz) ? place.tz : DEFAULT_TZ;
  const hasTime = !!input.time && isValidTime(input.time);
  const time = hasTime ? input.time : undefined;
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hasTime ? (time as string).split(":").map(Number) : [12, 0];
  const windowDays = Math.max(0, Math.min(30, Math.floor(input.windowDays ?? 0)));
  return {
    date,
    place,
    time,
    tz,
    instant: zonedToUtc(y, mo, d, h, mi, tz),
    hasTime,
    windowDays,
    from: addDays(date, -windowDays),
    to: addDays(date, windowDays),
    year: y,
    month: mo,
    day: d,
  };
}

/** « 12 mars 1978, 15:00 » dans le fuseau demandé. */
export function formatLocal(at: Date, tz: string, withTime = true): string {
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: tz,
    day: "numeric",
    month: "long",
    year: "numeric",
  };
  if (withTime) {
    opts.hour = "2-digit";
    opts.minute = "2-digit";
    opts.hourCycle = "h23";
  }
  return new Intl.DateTimeFormat("fr-FR", opts).format(at);
}

/** Construit un When à partir d'un instant, dans le fuseau du contexte. */
export function whenOf(at: Date, tz: string, withTime = true) {
  return { utc: at.toISOString(), local: formatLocal(at, tz, withTime) };
}

/** Analyse tolérante des horodatages des API (« 2024-05-10T00:13Z », « 2013-02-15 03:20:26 », « 1978-Mar-07 00:56 »). */
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

export function parseUtc(s: string | undefined | null): Date | undefined {
  if (!s) return undefined;
  const t = s.trim();
  // 1978-Mar-07 00:56  (JPL)
  const jpl = /^(\d{4})-([A-Za-z]{3})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(t);
  if (jpl) {
    const mo = MONTHS[jpl[2].toLowerCase()];
    if (!mo) return undefined;
    return new Date(
      Date.UTC(+jpl[1], mo - 1, +jpl[3], +(jpl[4] ?? 0), +(jpl[5] ?? 0), +(jpl[6] ?? 0)),
    );
  }
  // 2024-05-10T00:13Z, 2024-05-10T00:13:00Z, 2024-05-10 00:22:24, 2024-05-10
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?Z?$/.exec(t);
  if (iso) {
    return new Date(
      Date.UTC(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] ?? 0), +(iso[5] ?? 0), +(iso[6] ?? 0)),
    );
  }
  const d = new Date(t);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Format attendu par Horizons : « 1978-03-12 15:00 » (UT). */
export function horizonsTime(at: Date): string {
  return at.toISOString().slice(0, 16).replace("T", " ");
}

/** « 1978-03-12 » -> « 12 mars 1978 ». */
export function formatYmd(ymd: string): string {
  const m = YMD.exec(ymd);
  if (!m) return ymd;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])));
}

/** Combien de temps une réponse peut servir, en secondes. Une date passée de plus de deux jours
 *  est une archive : un mois. Aujourd'hui, demain ou hier bougent encore (ISS, météo, bulletins) :
 *  une heure. */
export function cacheTtl(date: string, today: string): number {
  const days = (Date.parse(today + "T00:00:00Z") - Date.parse(date + "T00:00:00Z")) / 86_400_000;
  return days > 2 ? 30 * 86_400 : 3_600;
}
