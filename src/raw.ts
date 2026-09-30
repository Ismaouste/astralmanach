// La réponse brute d'un fournisseur voyage jusqu'au navigateur pour le bloc « la réponse brute »
// de chaque carte. Certaines pèsent des mégaoctets (la carte des PFAS : 10 Mo ; « ce jour-là » :
// 1,7 Mo) et partaient à chaque recherche pour un bloc que presque personne n'ouvre. Au-delà du
// plafond, on n'en garde que le début et la taille : l'adresse de la requête, affichée à côté,
// redonne le tout.

export const RAW_MAX = 100_000;

const mo = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} Mo` : `${Math.round(n / 1e3)} Ko`);

export function clipRaw(value: unknown, max = RAW_MAX): unknown {
  const text = typeof value === "string" ? value : JSON.stringify(value ?? null);
  if (text.length <= max) return value;
  return {
    tronqué: `réponse de ${mo(text.length)}, trop lourde pour être jointe : l'adresse de la requête la redonne entière`,
    début: text.slice(0, 2_000),
  };
}
