import type { When } from "../cards";
import { parseUtc, whenOf } from "../time";

export const NASA_API = "https://api.nasa.gov";

export function nasaUrl(pathname: string, params: Record<string, string | number | undefined>, key: string): string {
  const u = new URL(NASA_API + pathname);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
  u.searchParams.set("api_key", key);
  return u.toString();
}

export function withParams(base: string, params: Record<string, string | number | undefined>): string {
  const u = new URL(base);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
  return u.toString();
}

export const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
export const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
export const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : undefined;
};

export function whenFrom(s: unknown, tz: string, withTime = true): When | undefined {
  const d = parseUtc(str(s));
  return d ? whenOf(d, tz, withTime) : undefined;
}

export const fmtInt = (n: number | undefined, unit = ""): string =>
  n === undefined ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(n)}${unit}`;
export const fmtDec = (n: number | undefined, digits = 1, unit = ""): string =>
  n === undefined ? "—" : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n)}${unit}`;

/** Distance en UA -> texte lisible en km et en distances lunaires. */
export function fmtDistanceAu(au: number | undefined): string {
  if (au === undefined) return "—";
  const km = au * 149_597_870.7;
  const lunar = km / 384_400;
  return `${fmtInt(km, " km")} · ${fmtDec(lunar, 1, " DL")}`;
}

/** Les seize points cardinaux, du nord dans le sens des aiguilles d'une montre. */
const CARDINAL = ["nord", "nord-nord-est", "nord-est", "est-nord-est", "est", "est-sud-est", "sud-est", "sud-sud-est", "sud", "sud-sud-ouest", "sud-ouest", "ouest-sud-ouest", "ouest", "ouest-nord-ouest", "nord-ouest", "nord-nord-ouest"];
/** Le point cardinal d'un azimut, en degrés depuis le nord. */
export const compass = (az: number) => CARDINAL[Math.round((((az % 360) + 360) % 360) / 22.5) % 16];
/** « au nord », « à l'est », « à l'ouest-sud-ouest » : la préposition qui va avec le point cardinal. */
export const towards = (dir: string) => (/^[aeiou]/.test(dir) ? `à l'${dir}` : `au ${dir}`);
