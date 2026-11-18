import type { NextConfig } from "next";

// Configuración base de Crumble (Etapa 0, E0-1).
// Las cabeceras de seguridad (CSP, HSTS sin includeSubDomains, nosniff, Referrer-Policy, COOP, CORP,
// frame-ancestors) y el enrutado por Host (proxy.ts) son de la historia E0-5 (Backend), según
// docs/proyectos/crumble/diseno-tecnico.md, secciones 5.3 y 5.4, en wiqi20/STICR_landingpage.
const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Tailwind 4 con el cargador de Turbopack, igual que sticr.app.
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
