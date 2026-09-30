import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The sky is computed in UTC and converted with IANA zones: the machine's own zone must never leak in.
    env: { TZ: "UTC" },
  },
});
