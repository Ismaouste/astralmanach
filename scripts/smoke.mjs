// Imports the built package by its name and its subpaths, the way a user would (run after `npm run build`).
import assert from "node:assert/strict";
import { makeContext, skyAt, skyEvents, skyRecap } from "astralmanach";
import { skyMap } from "astralmanach/voute";
import { fireballs } from "astralmanach/queries/jpl-fireball";

const place = { name: "Paris", lat: 48.8566, lon: 2.3522, tz: "Europe/Paris" };
const recap = skyRecap({ date: "2026-09-30", time: "21:00", place });
assert.equal(typeof recap.headline, "string");

const sky = skyAt(new Date("2026-09-30T19:00:00Z"), place);
const map = skyMap(sky, { maxMag: 4 });
assert.ok(map, "skyMap returns a map");

const ctx = makeContext({ date: "2026-09-30", tz: "Europe/Paris", place });
assert.ok(Array.isArray(skyEvents.normalize([], ctx)));
assert.deepEqual(fireballs.normalize([{ nope: true }], ctx), [], "an unknown shape gives []");

console.log("smoke: ok");
