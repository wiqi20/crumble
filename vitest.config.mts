import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // "server-only" lanza error fuera de Next.js; en pruebas se sustituye por un módulo vacío.
      "server-only": path.resolve(import.meta.dirname, "tests/ayudas/server-only.ts"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
