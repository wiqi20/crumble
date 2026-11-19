// Revisor del registro de rutas del panel (E0-6; diseño técnico 5.4; M3 de la revisión de
// Seguridad). Recorre TODOS los route.ts de una carpeta `app` y revisa los que el panel puede
// alcanzar:
// - los que, con sus segmentos dinámicos ([x], [...x], [[...x]]), pueden atender /api/admin/...;
// - los que pueden atender /panel/... (el proxy reescribe toda página del panel a /panel/...).
// La única excepción es app/api/[...resto] (404 JSON de la API): solo se exige que responda 404.
//
// Un problema por cada método exportado que:
// - no se definió con rutaAdmin (no declara permiso);
// - declara un acceso que no está en el catálogo;
// - es público sin estar en RUTAS_ADMIN_PUBLICAS (en /panel/... ninguno puede ser público);
// - sin sesión responde algo distinto de 401 (siendo no público).
// También es un problema que el módulo no se pueda cargar (p. ej. rutaAdmin con un permiso inventado).
//
// Aparte, buscarServerActions encuentra "use server": las Server Actions son puntos de entrada POST
// que no pasan por la API ni por la puerta; en Crumble toda escritura va por app/api (CLAUDE.md).
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ACCESO_DECLARADO, esAccesoValido, RUTAS_ADMIN_PUBLICAS, type Acceso } from "@/server/http/ruta-admin";

export const METODOS_HTTP = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

export type Problema = { ruta: string; metodo?: string; motivo: string };
export type MetodoRevisado = { ruta: string; metodo: string; acceso: Acceso };

/** Ruta de la API exceptuada: el 404 JSON de toda /api inexistente. */
export const RUTA_404_API = "/api/[...resto]";

async function archivos(carpeta: string, filtro: (nombre: string) => boolean): Promise<string[]> {
  const salida: string[] = [];
  let entradas;
  try {
    entradas = await readdir(carpeta, { withFileTypes: true });
  } catch {
    return salida;
  }
  for (const e of entradas) {
    const completo = path.join(carpeta, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next") continue;
      salida.push(...(await archivos(completo, filtro)));
    } else if (filtro(e.name)) salida.push(completo);
  }
  return salida.sort();
}

/** URL (patrón) que sirve un route.ts: sin grupos "(x)" ni carpetas privadas "_x" (que no se sirven). */
export function urlDeArchivo(carpetaApp: string, archivo: string): string | null {
  const partes = path.relative(carpetaApp, path.dirname(archivo)).split(path.sep).filter(Boolean);
  if (partes.some((p) => p.startsWith("_"))) return null;
  return "/" + partes.filter((p) => !/^\(.*\)$/.test(p)).join("/");
}

/**
 * ¿Hay alguna URL que empiece con `prefijo` (y siga con cualquier cosa, o nada) que el patrón
 * pueda atender? Los segmentos dinámicos aceptan cualquier valor: [x] uno, [...x] uno o más,
 * [[...x]] cero o más. Los estáticos se comparan tal cual (Next.js distingue mayúsculas).
 */
export function puedeAtender(patron: string, prefijo: string[]): boolean {
  const segmentos = patron.split("/").filter(Boolean);
  const coincide = (i: number, j: number): boolean => {
    if (j >= prefijo.length) return true; // lo que sigue del patrón se llena con segmentos cualquiera
    if (i >= segmentos.length) return false; // el patrón se acabó antes de cubrir el prefijo
    const s = segmentos[i];
    if (/^\[\[\.\.\..+\]\]$/.test(s) || /^\[\.\.\..+\]$/.test(s)) return true; // se traga el resto
    if (/^\[.+\]$/.test(s)) return coincide(i + 1, j + 1);
    return s === prefijo[j] && coincide(i + 1, j + 1);
  };
  return coincide(0, 0);
}

export const PREFIJO_ADMIN = ["api", "admin"];
export const PREFIJO_PANEL = ["panel"];

export async function revisarRutasAdmin(carpetaApp: string): Promise<{ metodos: MetodoRevisado[]; problemas: Problema[] }> {
  const metodos: MetodoRevisado[] = [];
  const problemas: Problema[] = [];

  for (const archivo of await archivos(carpetaApp, (n) => /^route\.(ts|tsx|js|jsx|mjs)$/.test(n))) {
    const ruta = urlDeArchivo(carpetaApp, archivo);
    if (ruta === null) continue;
    const delPanel = puedeAtender(ruta, PREFIJO_PANEL);
    const deAdmin = puedeAtender(ruta, PREFIJO_ADMIN);
    if (!delPanel && !deAdmin) continue;

    let modulo: Record<string, unknown>;
    try {
      modulo = await import(pathToFileURL(archivo).href);
    } catch {
      problemas.push({ ruta, motivo: "el módulo no carga (¿rutaAdmin con un acceso que no está en el catálogo?)" });
      continue;
    }

    for (const metodo of METODOS_HTTP) {
      const exportado = modulo[metodo];
      if (exportado === undefined) continue;
      const llamar = () =>
        (exportado as (p: Request, c: unknown) => Promise<Response> | Response)(
          new Request(`https://panel.prueba.local${ruta}`, { method: metodo }),
          { params: Promise.resolve({}) },
        );

      if (ruta === RUTA_404_API) {
        const respuesta = typeof exportado === "function" ? await llamar() : null;
        if (respuesta?.status !== 404) problemas.push({ ruta, metodo, motivo: "el 404 de la API debe responder 404 y nada más" });
        continue;
      }

      const acceso = typeof exportado === "function" ? (exportado as { [ACCESO_DECLARADO]?: unknown })[ACCESO_DECLARADO] : undefined;
      if (acceso === undefined) {
        problemas.push({ ruta, metodo, motivo: "no declara permiso (defínela con rutaAdmin)" });
        continue;
      }
      if (!esAccesoValido(acceso)) {
        problemas.push({ ruta, metodo, motivo: "declara un acceso que no está en el catálogo" });
        continue;
      }
      if (acceso === "publica" && (delPanel || !(RUTAS_ADMIN_PUBLICAS as readonly string[]).includes(ruta))) {
        problemas.push({ ruta, metodo, motivo: "es pública y no está en RUTAS_ADMIN_PUBLICAS" });
        continue;
      }
      if (acceso !== "publica") {
        // Sin cookie de sesión debe cortar con 401 antes de hacer nada.
        const respuesta = await llamar();
        if (respuesta.status !== 401) {
          problemas.push({ ruta, metodo, motivo: `sin sesión responde ${respuesta.status} en vez de 401` });
          continue;
        }
      }
      metodos.push({ ruta, metodo, acceso });
    }
  }
  return { metodos, problemas };
}

/** Archivos con la directiva "use server" (Server Actions) en las carpetas dadas. */
export async function buscarServerActions(carpetas: string[]): Promise<string[]> {
  const encontrados: string[] = [];
  for (const carpeta of carpetas) {
    for (const archivo of await archivos(carpeta, (n) => /\.(ts|tsx|js|jsx|mjs)$/.test(n))) {
      const texto = await readFile(archivo, "utf8");
      // La directiva puede ir al inicio del archivo o dentro de una función.
      if (/(^|[\s;{(])(["'`])use server\2/.test(texto)) encontrados.push(archivo);
    }
  }
  return encontrados.sort();
}
