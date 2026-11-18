import type { Metadata } from "next";
import { BarraPanel } from "@/components/panel/Marco";

// Página PROVISIONAL del panel (Etapa 0, E0-7). La reemplazan el inicio de sesión (P1) y el Inicio (P2)
// en F6. No muestra datos ni pide sesión: todavía no hay nada que proteger aquí.

export const metadata: Metadata = {
  title: "En construcción",
};

export default function PanelProvisional() {
  return (
    <>
      <BarraPanel />
      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
        <div className="mx-auto w-full max-w-[1200px] px-4 py-10 md:px-8 md:py-16 xl:py-20">
          <h1 className="text-heading md:text-display">Panel de la tienda</h1>
          <section
            aria-labelledby="titulo-construccion"
            className="mt-8 max-w-[640px] rounded-lg border border-dust bg-paper-white p-6"
          >
            <h2 id="titulo-construccion" className="text-subheading font-medium">
              El panel está en construcción
            </h2>
            <p className="mt-2 text-slate">
              Pronto vas a poder entrar con tu cuenta de Google para atender pedidos, cambiar precios y
              llevar el inventario.
            </p>
          </section>
        </div>
      </main>
    </>
  );
}
