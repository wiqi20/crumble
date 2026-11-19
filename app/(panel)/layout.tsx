import type { Metadata, Viewport } from "next";
// Fuentes del panel (sistema de STI), servidas desde el propio sitio (sin servidores externos).
import "@fontsource/onest/300.css";
import "@fontsource/onest/400.css";
import "@fontsource/onest/500.css";
import "@fontsource/onest/600.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";
import "@/styles/panel.css";

// Layout raíz del PANEL (sistema de diseño de STI, diseño UX sección 8). Sin logo de Crumble:
// arriba dice "Crumble · Panel de la tienda" en texto. El panel nunca se indexa.
// La tienda tiene su propio layout raíz en app/(tienda); las dos identidades nunca se mezclan.

export const metadata: Metadata = {
  title: {
    default: "Panel de la tienda · Crumble",
    template: "%s · Panel de Crumble",
  },
  description: "Panel administrativo de la tienda Crumble.",
  applicationName: "Crumble · Panel",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export const viewport: Viewport = {
  themeColor: "#e6e6e5",
};

export default function LayoutPanel({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CR">
      <body className="flex flex-col">
        <a
          href="#contenido"
          className="sr-only rounded-md bg-deep-ink text-caption font-medium text-paper-white focus:not-sr-only focus:px-4 focus:py-3 focus:fixed focus:top-2 focus:left-2 focus:z-50"
        >
          Saltar al contenido
        </a>
        {children}
      </body>
    </html>
  );
}
