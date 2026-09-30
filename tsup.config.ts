import { defineConfig } from "tsup";

// One entry per public subpath (see "exports" in package.json): consumers import only what they use.
export default defineConfig({
  entry: {
    index: "src/index.ts",
    time: "src/time.ts",
    cards: "src/cards.ts",
    lieu: "src/lieu.ts",
    raw: "src/raw.ts",
    fetcher: "src/fetcher.ts",
    run: "src/run.ts",
    voute: "src/voute.ts",
    "sky-recap": "src/sky-recap.ts",
    "queries/types": "src/queries/types.ts",
    "queries/shared": "src/queries/shared.ts",
    "queries/astro-evenements": "src/queries/astro-evenements.ts",
    "queries/celestrak-iss": "src/queries/celestrak-iss.ts",
    "queries/jpl-fireball": "src/queries/jpl-fireball.ts",
  },
  format: ["esm"],
  target: "node18",
  platform: "neutral",
  dts: true,
  sourcemap: false,
  splitting: true,
  treeshake: true,
  clean: true,
  external: ["astronomy-engine", "satellite.js"],
});
