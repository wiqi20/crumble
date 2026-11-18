import type { Metadata } from "next";
import "./globals.css";

// Layout raíz mínimo de la Etapa 0 (E0-1). Frontend lo reemplaza en E0-7 por los layouts de
// la tienda (tokens de Crumble) y del panel (tokens de STI, noindex).
export const metadata: Metadata = {
  title: "Crumble",
  description: "Pastelería Crumble: arma tu pastel y haz tu pedido en línea.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
