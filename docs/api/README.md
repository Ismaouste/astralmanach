# The public API

The site [astralmanach.eu](https://astralmanach.eu) serves a small read-only HTTP API on top of the same engine — no account, no key, CORS open.

| | |
|---|---|
| Documentation | <https://astralmanach.eu/api-publique> |
| OpenAPI 3.1 | [`openapi.json`](openapi.json) — live: <https://astralmanach.eu/api/openapi.json> |
| Swagger UI | <https://petstore.swagger.io/?url=https%3A%2F%2Fastralmanach.eu%2Fapi%2Fopenapi.json> |
| Postman | [`astralmanach.postman_collection.json`](astralmanach.postman_collection.json) — or *Import › Link*: <https://astralmanach.eu/api/postman.json> |

```sh
curl "https://astralmanach.eu/api/run?query=jpl.horizons&date=2026-09-30&time=21:00&lat=48.8566&lon=2.3522&place=Paris&ptz=Europe%2FParis"
```

Routes: `/api/sources` (the registry), `/api/run` (one source, one date, one place), `/api/geocode` (a place name), `/api/today`.

**What the API runs is the site's full registry** (34 sources: NASA, JPL, weather, air, earthquakes, traditions…), not only the three source modules the npm package ships (`astro-evenements`, `celestrak-iss`, `jpl-fireball`). The package carries the engine; the registry lives in the site.

The two JSON files here are **snapshots**: the site generates them from its source registry, so the live addresses are the reference.

## Keys and sign-ups — what you need to run the library yourself

The API above needs nothing from you. If you use the package with your own accounts:

- [ ] **NASA** (APOD, EPIC, NeoWs, DONKI) — a free key in a minute at <https://api.nasa.gov/>. Without one, `DEMO_KEY` works, heavily limited.
- [ ] **Launch Library 2** (The Space Devs) — works without an account, fifteen requests an hour; their plans give more: <https://thespacedevs.com/llapi>.
- [ ] **Open-Meteo** (weather, climate, air) — no key; free for non-commercial use, a paid plan beyond: <https://open-meteo.com/en/pricing>.
- [ ] **Wikimedia** ("on this day") — no key, but an identifying `User-Agent` is required.
- [ ] **PFAS Data Hub (CNRS)** — no key; cite the Forever Pollution Project and tell *Le Monde* when you reuse it.
- Everything else — JPL Horizons, USNO, CelesTrak, USGS, Géorisques, Gallica, NASA Exoplanet Archive, the local calculations — needs neither a key nor a sign-up.

The package reads no file and no environment variable: the key, the `User-Agent` and the cache are passed to the call (`runQuery(query, ctx, { key, userAgent, cache })`).
