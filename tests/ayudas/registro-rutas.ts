// Revisor del registro de rutas del panel (E0-6; diseño técnico 5.4): recorre los route.ts de una
// carpeta `app`, se queda con los que sirven /api/admin/* y revisa cada método HTTP exportado.
// Un problema por cada método que:
// - no se definió con rutaAdmin (no declara permiso);
// - declara un acceso que no está en el catálogo;
// - es público sin estar en RUTAS_ADMIN_PUBLICAS;
// - sin sesión responde algo distinto de 401 (siendo no público).
// También es un problema que el módulo no se pueda cargar (p. ej. rutaAdmin con un permiso inventado).
import { readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { ACCESO_DECLARADO, esAccesoValido, RUTAS_ADMIN_PUBLICAS, type Acceso } from "@/server/http/ruta-admin";

export const METODOS_HTTP = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const;

export type Problema = { ruta: string; metodo?: string; motivo: string };
export type MetodoRevisado = { ruta: string; metodo: string; acceso: Acceso };

async function archivosDeRuta(carpeta: string): Promise<string[]> {
  const salida: string[] = [];
  let entradas;
  try {
    entradas = await readdir(carpeta, { withFileTypes: true });
  } catch {
    return salida;
  }
  for (const e of entradas) {
    const completo = path.join(carpeta, e.name);
    if (e.isDirectory()) salida.push(...(await archivosDeRuta(completo)));
    else if (/^route\.(ts|tsx|js|jsx|mjs)$/.test(e.name)) salida.push(completo);
  }
  return salida.sort();
}

/** URL que sirve un route.ts: sin grupos "(x)" ni carpetas privadas "_x" (que no se sirven). */
export function urlDeArchivo(carpetaApp: string, archivo: string): string | null {
  const partes = path.relative(carpetaApp, path.dirname(archivo)).split(path.sep).filter(Boolean);
  if (partes.some((p) => p.startsWith("_"))) return null;
  return "/" + partes.filter((p) => !/^\(.*\)$/.test(p)).join("/");
}

const esDeAdmin = (url: string) => url === "/api/admin" || url.startsWith("/api/admin/");

export async function revisarRutasAdmin(carpetaApp: string): Promise<{ metodos: MetodoRevisado[]; problemas: Problema[] }> {
  const metodos: MetodoRevisado[] = [];
  const problemas: Problema[] = [];

  for (const archivo of await archivosDeRuta(carpetaApp)) {
    const ruta = urlDeArchivo(carpetaApp, archivo);
    if (ruta === null || !esDeAdmin(ruta)) continue;

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
      const acceso = typeof exportado === "function" ? (exportado as { [ACCESO_DECLARADO]?: unknown })[ACCESO_DECLARADO] : undefined;
      if (acceso === undefined) {
        problemas.push({ ruta, metodo, motivo: "no declara permiso (defínela con rutaAdmin)" });
        continue;
      }
      if (!esAccesoValido(acceso)) {
        problemas.push({ ruta, metodo, motivo: "declara un acceso que no está en el catálogo" });
        continue;
      }
      if (acceso === "publica" && !(RUTAS_ADMIN_PUBLICAS as readonly string[]).includes(ruta)) {
        problemas.push({ ruta, metodo, motivo: "es pública y no está en RUTAS_ADMIN_PUBLICAS" });
        continue;
      }
      if (acceso !== "publica") {
        // Sin cookie de sesión debe cortar con 401 antes de hacer nada.
        const respuesta = await (exportado as (p: Request, c: unknown) => Promise<Response>)(
          new Request(`https://panel.prueba.local${ruta}`, { method: metodo }),
          { params: Promise.resolve({}) },
        );
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
