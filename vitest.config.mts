import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": path("./src"),
      "server-only": path("./tests/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: { SCRUBX_TRACE_PAYLOADS: "true" },
    coverage: { include: ["src/core/**", "src/lib/**", "src/server/**", "src/app/api/**"] },
  },
});
