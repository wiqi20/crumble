import { CabeceraTienda, PieTienda } from "@/components/tienda/Marco";

// Portada PROVISIONAL de la tienda (Etapa 0, E0-7). Usa el texto del estado "vacío" de la portada
// (diseño UX, T1): todavía no hay secciones, ni ideas, ni configurador. La reemplaza F2 (portada e ideas).
// El botón "Escribir por WhatsApp" de ese estado espera el número real de Crumble (pendiente del dueño).

export default function PortadaProvisional() {
  return (
    <>
      <CabeceraTienda />
      <main id="contenido" tabIndex={-1} className="flex-1 focus:outline-none">
        <section
          aria-labelledby="titulo-portada"
          className="contenedor flex flex-col items-center py-16 text-center md:py-24 xl:py-32"
        >
          <p className="rotulo text-tinta-suave">Pastelería por encargo</p>
          <h1 id="titulo-portada" className="mt-4 max-w-[18ch] text-portada">
            Estamos preparando la{" "}
            <span className="underline decoration-rosa decoration-[0.18em] underline-offset-[0.12em] [text-decoration-skip-ink:none]">
              tienda
            </span>
          </h1>
          <p className="mt-6 max-w-[40ch] text-grande text-tinta-suave">
            Vuelve pronto: aquí vas a poder armar tu pastel, ver el precio mientras eliges y hacer tu
            pedido.
          </p>
        </section>
      </main>
      <PieTienda />
    </>
  );
}
