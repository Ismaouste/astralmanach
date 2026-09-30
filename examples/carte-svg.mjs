// Une carte du ciel en SVG, dessinée avec astralmanach seul — c'est l'image du README.
//   npm run build && node examples/carte-svg.mjs            (écrit docs/carte-jour.svg et docs/carte-nuit.svg)
//   node examples/carte-svg.mjs 2013-02-15 12:20 55.16 61.4   (date, heure UTC, latitude, longitude)
//
// `skyMap` rend des données, pas un dessin : des étoiles projetées dans un disque de rayon 1 (le zénith au centre, le nord en haut, l'est à gauche),
// les traits des constellations, l'écliptique, les astres. Ici on les pose dans un SVG ; un canevas, un PDF ou un serveur feraient pareil.

import { mkdirSync, writeFileSync } from "node:fs";
import { skyAt, skyMap } from "../dist/voute.js";

const [date = "2026-09-30", heure = "19:00", lat = "48.8566", lon = "2.3522"] = process.argv.slice(2);
const lieu = { name: "Paris", lat: Number(lat), lon: Number(lon) };
const sky = skyAt(new Date(`${date}T${heure}:00Z`), lieu);
const map = skyMap(sky, { maxMag: 4.2, projection: "stereo" });

const R = 460; // rayon du disque, en unités du SVG
const px = (p) => [(R + p.x * R).toFixed(1), (R - p.y * R).toFixed(1)];
const trace = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${px(p).join(" ")}`).join("");

function dessin({ fond, encre, trait, fin }) {
  const lignes = map.lines.map((l) => `<path d="${trace(l)}"/>`).join("");
  const ecliptique = map.ecliptic.map((l) => `<path d="${trace(l)}"/>`).join("");
  const etoiles = map.stars.map((s) => { const [x, y] = px(s); return `<circle cx="${x}" cy="${y}" r="${Math.max(0.9, 3.6 - s.mag * 0.62).toFixed(2)}"/>`; }).join("");
  const astres = map.bodies.map((b) => { const [x, y] = px(b); return `<circle cx="${x}" cy="${y}" r="7" fill="${fond}" stroke="${encre}" stroke-width="2"/>`; }).join("");
  const noms = map.names.filter((n) => n.rank === 1).map((n) => { const [x, y] = px(n); return `<text x="${x}" y="${y}">${n.la}</text>`; }).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 -20 ${2 * R + 40} ${2 * R + 40}" role="img" aria-label="La carte du ciel de Paris, le ${date} à ${heure} UTC, dessinée avec astralmanach">
<circle cx="${R}" cy="${R}" r="${R + 8}" fill="${fond}" stroke="${encre}" stroke-width="2"/>
<g fill="none" stroke="${trait}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round">${lignes}</g>
<g fill="none" stroke="${fin}" stroke-width="1" stroke-dasharray="2 6">${ecliptique}</g>
<g fill="${encre}">${etoiles}</g>${astres}
<g fill="${fin}" font-family="ui-monospace, Menlo, Consolas, monospace" font-size="12" text-anchor="middle">${noms}</g>
</svg>
`;
}

mkdirSync("docs", { recursive: true });
writeFileSync("docs/carte-jour.svg", dessin({ fond: "#ffffff", encre: "#1a1a1a", trait: "#9a9a9a", fin: "#6a6a6a" }));
writeFileSync("docs/carte-nuit.svg", dessin({ fond: "#0a0a0a", encre: "#f5f5f5", trait: "#5b5b5b", fin: "#8a8a8a" }));
console.log(`${map.stars.length} étoiles, ${map.lines.length} traits, ${map.bodies.length} astres → docs/carte-jour.svg, docs/carte-nuit.svg`);
