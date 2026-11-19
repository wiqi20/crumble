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
    // Prepara la base de pruebas (TEST_DATABASE_URL): la vacía y aplica las migraciones (E0-6).
    globalSetup: ["tests/ayudas/base.ts"],
    // Las pruebas con base comparten una sola base de pruebas: se corren de un archivo a la vez.
    fileParallelism: false,
  },
});
