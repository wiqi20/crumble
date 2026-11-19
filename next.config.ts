import type { NextConfig } from "next";
import { reglasDeCabeceras } from "./server/http/cabeceras";

// Configuración de Crumble.
// - E0-1: Tailwind 4 con el cargador de Turbopack (igual que sticr.app) y sin X-Powered-By.
// - E0-5: cabeceras de seguridad de 5.3 y 5.4 (CSP sin terceros, HSTS sin includeSubDomains,
//   nosniff, Referrer-Policy, COOP, CORP, frame-ancestors 'none'); detalle en
//   server/http/cabeceras.ts. El enrutado por Host está en proxy.ts.
const desarrollo = process.env.NODE_ENV === "development";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return reglasDeCabeceras(desarrollo);
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
