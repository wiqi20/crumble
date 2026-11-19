import type { Metadata } from "next";
import Link from "next/link";
import { CabeceraTienda, PieTienda } from "@/components/tienda/Marco";

// 404 de la tienda (diseño UX, T10), con la identidad de Crumble. Responde con estado 404 y
// Next.js agrega <meta name="robots" content="noindex">.
// El botón "Arma tu pastel" de T10 espera al configurador (F3); mientras tanto, vuelve a la portada.

export const metadata: Metadata = {
  title: "No encontramos esta página",
};

export default function NoEncontradaTienda() {
  return (
    <>
      <CabeceraTienda />
      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
        <section className="contenedor flex flex-col items-center py-16 text-center md:py-24">
          <p className="rotulo text-tinta-suave">Error 404</p>
          <h1 className="mt-4 text-h1">No encontramos esta página</h1>
          <p className="mt-4 max-w-[40ch] text-tinta-suave">
            Puede que el enlace esté mal escrito o que la página ya no exista.
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex min-h-12 items-center rounded-pildora bg-tinta px-7 font-medium text-blanco hover:bg-tinta/90"
          >
            Ir a la portada
          </Link>
        </section>
      </main>
      <PieTienda />
    </>
  );
}
