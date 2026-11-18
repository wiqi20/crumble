import type { Metadata } from "next";
import Link from "next/link";
import { BarraPanel } from "@/components/panel/Marco";

// 404 del panel, con el sistema de STI. Responde con estado 404 y Next.js agrega
// <meta name="robots" content="noindex"> (el panel, además, nunca se indexa).

export const metadata: Metadata = {
  title: "No encontramos esta página",
};

export default function NoEncontradaPanel() {
  return (
    <>
      <BarraPanel />
      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-10 md:px-8 md:py-16">
          <p className="cifra text-[11px] font-medium text-iron uppercase">Error 404</p>
          <h1 className="mt-3 text-heading md:text-heading-lg">No encontramos esta página</h1>
          <p className="mt-3 max-w-[60ch] text-iron">
            Puede que el enlace esté mal escrito o que la página ya no exista.
          </p>
          <Link
            href="/panel"
            className="mt-8 inline-flex min-h-11 items-center rounded-md bg-coastal-teal px-6 font-medium text-deep-ink hover:bg-pale-aqua"
          >
            Ir al inicio del panel
          </Link>
        </div>
      </main>
    </>
  );
}
