// Enrutado por Host (E0-5; diseño técnico 5.3 y 11.2). Función pura que usa proxy.ts.
//
// - Host desconocido → 404 (salvo /api/health, que la prueba de salud de Railway llama con su
//   propio Host).
// - Tienda: todo menos el panel; /panel y /api/admin → 404.
// - Panel (decisión del PM, 17 nov): se sirve en la RAÍZ de su dirección. Toda página se
//   reescribe por dentro a /panel/... (crumble-admin.sticr.app/pedidos → /panel/pedidos); la API
//   (/api, incluida /api/admin), /imagenes y los archivos de Next, íconos y marcas pasan tal cual.
//   Como todo cae bajo /panel, una página de la tienda en el panel da el 404 del panel.
//
// No es un mecanismo de autorización (guía de proxy de Next.js): los permisos se comprueban en
// cada ruta con requierePermiso.

export type Superficie = "tienda" | "panel";

export type Decision =
  | { tipo: "seguir"; superficie: Superficie | null }
  | { tipo: "no-encontrado"; api: boolean; hostConocido: boolean; superficie: Superficie | null }
  /** La ruta trae una codificación que no se puede leer (/%, /panel/%ZZ): 404 propio, sin pasar a Next.js. */
  | { tipo: "ruta-invalida" }
  | { tipo: "reescribir"; ruta: string; superficie: Superficie };

/**
 * Host en minúsculas, sin punto final y sin el puerto estándar: crumble.sticr.app.,
 * crumble.sticr.app:443 y crumble.sticr.app:80 son crumble.sticr.app. Un proxy delante puede
 * mandar el puerto; URL_TIENDA y URL_PANEL nunca lo llevan si es el estándar (URL lo omite).
 */
export function normalizarHost(host: string | null | undefined): string {
  return (host ?? "")
    .trim()
    .toLowerCase()
    .replace(/:(443|80)$/, "")
    .replace(/\.(?=(:\d+)?$)/, "");
}

/**
 * Ruta para comparar: decodificada, en minúsculas y sin barras repetidas, para que /%70anel,
 * /PANEL o //panel no esquiven la regla. Devuelve null si la codificación no es válida.
 */
export function normalizarRuta(ruta: string): string | null {
  let decodificada: string;
  try {
    decodificada = decodeURIComponent(ruta);
  } catch {
    return null;
  }
  return decodificada.toLowerCase().replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

const esPrefijo = (ruta: string, prefijo: string) => ruta === prefijo || ruta.startsWith(`${prefijo}/`);

const esSalud = (ruta: string) => ruta === "/api/health" || ruta === "/api/health/";
const esPanel = (ruta: string) => esPrefijo(ruta, "/panel");
const esApiAdmin = (ruta: string) => esPrefijo(ruta, "/api/admin");
const esApi = (ruta: string) => esPrefijo(ruta, "/api");
/** Archivos que también necesita el panel: los de Next, imágenes, íconos y la marca de la demo. */
const esComun = (ruta: string) =>
  esPrefijo(ruta, "/_next") ||
  esPrefijo(ruta, "/imagenes") ||
  esPrefijo(ruta, "/marcas") ||
  esPrefijo(ruta, "/iconos") ||
  /^\/(favicon\.ico|icon[^/]*|apple-icon[^/]*|robots\.txt|manifest\.webmanifest)$/.test(ruta);

export function decidir(entrada: { host: string | null; ruta: string; hostTienda: string; hostPanel: string }): Decision {
  const ruta = normalizarRuta(entrada.ruta);
  const host = normalizarHost(entrada.host);
  const esTienda = host !== "" && host === entrada.hostTienda;
  const esDelPanel = host !== "" && host === entrada.hostPanel;
  const hostConocido = esTienda || esDelPanel;

  const superficie: Superficie | null = esTienda ? "tienda" : esDelPanel ? "panel" : null;
  const noEncontrado = (api: boolean): Decision => ({ tipo: "no-encontrado", api, hostConocido, superficie });

  if (ruta === null) return { tipo: "ruta-invalida" };
  if (esSalud(ruta)) return { tipo: "seguir", superficie };

  if (esTienda) {
    if (esPanel(ruta) || esApiAdmin(ruta)) return noEncontrado(esApi(ruta));
    return { tipo: "seguir", superficie: "tienda" };
  }
  if (esDelPanel) {
    if (esApi(ruta) || esComun(ruta)) return { tipo: "seguir", superficie: "panel" };
    // Se reescribe con la ruta ORIGINAL (solo se normaliza para comparar). /panel/x en el panel
    // queda en /panel/panel/x, que no existe: una sola dirección por pantalla.
    return { tipo: "reescribir", ruta: entrada.ruta === "/" ? "/panel" : `/panel${entrada.ruta}`, superficie: "panel" };
  }
  return noEncontrado(esApi(ruta));
}
