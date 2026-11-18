import { notFound } from "next/navigation";

// Toda dirección de la tienda que no existe cae aquí y muestra el 404 de la tienda
// (app/(tienda)/not-found.tsx) dentro de su layout, con estado 404.
// Con dos layouts raíz (tienda y panel) no hay un not-found global que componer; esta ruta lo resuelve
// sin activar opciones experimentales. Las rutas más específicas (las de la API, /panel/...) ganan siempre.
export default function RutaInexistenteTienda(): never {
  notFound();
}
