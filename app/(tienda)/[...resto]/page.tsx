import type { Metadata } from "next";
import { notFound } from "next/navigation";

// Toda dirección de la tienda que no existe cae aquí y muestra el 404 de la tienda
// (app/(tienda)/not-found.tsx) dentro de su layout, con estado 404.
// Con dos layouts raíz (tienda y panel) no hay un not-found global que componer; esta ruta lo resuelve
// sin activar opciones experimentales. Las rutas más específicas (las de la API, /panel/...) ganan siempre.
// El mismo título que el not-found de su lado. Sin esto, al hidratar React deja el título de la ruta
// (el del layout) y no el del 404: el HTML traía el correcto, pero document.title cambiaba (QA-E0-01).
export const metadata: Metadata = {
  title: "No encontramos esta página",
};

export default function RutaInexistenteTienda(): never {
  notFound();
}
