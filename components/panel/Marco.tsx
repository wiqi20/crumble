// Barra superior MÍNIMA del panel (Etapa 0): 56 px, blanca, con "Crumble · Panel de la tienda" en texto
// (sin logo de Crumble, diseño UX sección 8). La barra lateral con el menú por permisos llega con F6,
// junto con el inicio de sesión.

export function BarraPanel() {
  return (
    <header className="border-b border-dust bg-paper-white">
      <div className="mx-auto flex h-14 w-full max-w-[1200px] items-center px-4 md:px-8">
        <p className="text-[14px] font-medium">
          Crumble <span className="text-slate">· Panel de la tienda</span>
        </p>
      </div>
    </header>
  );
}
