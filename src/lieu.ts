// Un lieu nommé renvoie à une carte. OpenStreetMap : sans compte, sans clé, et le lien dit
// tout dans son adresse. Des coordonnées se marquent ; un nom seul (« 12 km au sud de
// Nancy », une base de lancement) se cherche. Pur : rien ici n'appelle le réseau.

const f = (n: number) => n.toFixed(4);

/** Un repère sur la carte, centré et marqué ; zoom 11 = une ville et ses environs. */
export const mapAt = (lat: number, lon: number, zoom = 11) => `https://www.openstreetmap.org/?mlat=${f(lat)}&mlon=${f(lon)}#map=${zoom}/${f(lat)}/${f(lon)}`;

/** La recherche d'un nom sur la carte, quand on n'a pas les coordonnées. */
export const mapSearch = (name: string) => `https://www.openstreetmap.org/search?query=${encodeURIComponent(name.trim())}`;

/** Une latitude ou longitude écrite avec sa direction (« 48.7 », « S ») en nombre signé. */
export const signed = (value: string | number | undefined, dir: string | undefined): number | undefined => {
  if (value === undefined || value === "") return undefined;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return /^[SW]$/i.test(dir ?? "") ? -Math.abs(n) : n;
};
