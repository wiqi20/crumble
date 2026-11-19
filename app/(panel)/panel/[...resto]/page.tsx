import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Toda dirección del panel que no existe cae aquí y muestra el 404 del panel
// (app/(panel)/panel/not-found.tsx) dentro de su layout, con estado 404.
// El mismo título que el not-found de su lado. Sin esto, al hidratar React deja el título de la ruta
// (el del layout) y no el del 404: el HTML traía el correcto, pero document.title cambiaba (QA-E0-01).
export const metadata: Metadata = {
  title: "No encontramos esta página",
};

export default function RutaInexistentePanel(): never {
  notFound();
}
