import { notFound } from "next/navigation";

// Toda dirección del panel que no existe cae aquí y muestra el 404 del panel
// (app/(panel)/panel/not-found.tsx) dentro de su layout, con estado 404.
export default function RutaInexistentePanel(): never {
  notFound();
}
