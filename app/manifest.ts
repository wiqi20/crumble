import type { MetadataRoute } from "next";

// Manifiesto con los íconos de 192 y 512 px (diseño técnico 11.3). No convierte el sitio en aplicación
// instalable: "display: browser". Lo comparten la tienda y el panel. La demo (Pastelería Demo) tendrá
// su favicon neutro elegido con MODO_DEMO cuando el Diseñador lo entregue (ajuste 31).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Crumble cake store",
    short_name: "Crumble",
    lang: "es-CR",
    start_url: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
