import type { Metadata, Viewport } from "next";
// Fuentes de la tienda, servidas desde el propio sitio (sin servidores externos).
import "@fontsource/marcellus/400.css";
import "@fontsource-variable/jost";
import "@/styles/tienda.css";

// Layout raíz de la TIENDA (identidad de Crumble, diseño UX sección 2).
// El panel tiene su propio layout raíz en app/(panel); las dos identidades nunca se mezclan.
// El favicon (app/favicon.ico, app/icon.svg, app/apple-icon.png) y el manifiesto son comunes.

export const metadata: Metadata = {
  title: {
    default: "Crumble cake store",
    template: "%s · Crumble cake store",
  },
  description: "Pastelería Crumble: arma tu pastel y haz tu pedido en línea. Solo retiro en el local.",
  applicationName: "Crumble",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

export default function LayoutTienda({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CR">
      <body className="flex flex-col">
        <a
          href="#contenido"
          className="sr-only rounded-pildora bg-tinta text-chico text-blanco focus:not-sr-only focus:px-5 focus:py-3 focus:fixed focus:top-3 focus:left-3 focus:z-50"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
