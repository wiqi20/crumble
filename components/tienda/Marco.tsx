import Link from "next/link";
import { LogoCrumble } from "./LogoCrumble";

// Cabecera y pie MÍNIMOS de la tienda (Etapa 0). Cabecera de 64 px en celular y 80 px desde 1024,
// con el logo de letras de 40 y 48 px de alto (diseño UX 2.4 y 3). El menú (Arma tu pastel · Ideas ·
// Cómo pedir · Dónde estamos) y el ícono de Mi pedido llegan con F2, cuando existan esas páginas.

export function CabeceraTienda() {
  return (
    <header className="border-b border-linea bg-blanco">
      <div className="contenedor flex h-16 items-center justify-center lg:h-20">
        <Link
          href="/"
          aria-label="Crumble cake store, ir a la portada"
          className="inline-flex min-h-11 items-center rounded-campo"
        >
          <LogoCrumble alto={48} decorativo className="h-10 w-auto lg:h-12" />
        </Link>
      </div>
    </header>
  );
}

export function PieTienda() {
  return (
    <footer className="mt-auto border-t border-linea bg-blanco">
      <div className="contenedor flex flex-col items-center gap-4 py-10 text-center md:flex-row md:justify-between md:text-left">
        <LogoCrumble alto={64} className="h-16 w-auto" />
        <p className="text-chico text-tinta-suave">Solo retiro en el local. No hacemos envíos.</p>
      </div>
    </footer>
  );
}
