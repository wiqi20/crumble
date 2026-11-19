// Registro de rutas del panel (E0-6; diseño técnico 5.4): toda ruta de /api/admin/* se define con
// rutaAdmin(acceso, manejador). El acceso queda escrito en la función exportada y la prueba
// tests/permisos/registro-rutas.test.ts recorre app/api/admin y FALLA si algún método exportado
// no lo declara, si declara un permiso que no está en el catálogo o si una ruta pública no está
// en la lista de abajo. Así, lo que no declara permiso no llega a main.
//
// Uso:
//   export const GET = rutaAdmin("pedidos.ver", async (peticion, contexto, usuario) => { ... });
import "server-only";
import { esPermiso, type Permiso } from "@/server/auth/permisos";
import { requierePermiso, type UsuarioPanel } from "@/server/auth/puerta";
import { conManejoDeErrores } from "@/server/http/errores";

/**
 * Qué exige la ruta:
 * - un permiso del catálogo (server/auth/permisos.ts);
 * - "sesion": cualquier usuario con sesión (p. ej. GET /api/admin/yo, POST /api/admin/auth/salir);
 * - "publica": sin sesión. Solo para el inicio de sesión (RUTAS_ADMIN_PUBLICAS).
 */
export type Acceso = Permiso | "sesion" | "publica";

/** Rutas de /api/admin que pueden ser públicas (4.2). Cualquier otra pública hace fallar la prueba. */
export const RUTAS_ADMIN_PUBLICAS = ["/api/admin/auth/google", "/api/admin/auth/google/callback", "/api/admin/auth/demo"] as const;

/** Marca con la que la prueba del registro reconoce un manejador declarado. */
export const ACCESO_DECLARADO = Symbol.for("crumble.accesoDeclarado");

export type ManejadorDeclarado<C> = ((peticion: Request, contexto: C) => Promise<Response>) & { [ACCESO_DECLARADO]: Acceso };

export function esAccesoValido(acceso: unknown): acceso is Acceso {
  return acceso === "sesion" || acceso === "publica" || esPermiso(acceso);
}

export function rutaAdmin<C = unknown>(
  acceso: "publica",
  manejador: (peticion: Request, contexto: C, usuario: null) => Promise<Response> | Response,
): ManejadorDeclarado<C>;
export function rutaAdmin<C = unknown>(
  acceso: Permiso | "sesion",
  manejador: (peticion: Request, contexto: C, usuario: UsuarioPanel) => Promise<Response> | Response,
): ManejadorDeclarado<C>;
export function rutaAdmin<C = unknown>(
  acceso: Acceso,
  manejador: (peticion: Request, contexto: C, usuario: never) => Promise<Response> | Response,
): ManejadorDeclarado<C> {
  // Un acceso que no está en el catálogo rompe al cargar el módulo (y la prueba lo reporta).
  if (!esAccesoValido(acceso)) throw new Error("rutaAdmin: el acceso declarado no está en el catálogo de permisos.");

  const envuelto = conManejoDeErrores<C>(async (peticion, contexto) => {
    // Primera línea: la puerta. Nada del manejador corre antes.
    const usuario = acceso === "publica" ? null : await requierePermiso(peticion, acceso === "sesion" ? null : acceso);
    const respuesta = await manejador(peticion, contexto, usuario as never);
    // El panel va sin caché (5.2).
    if (!respuesta.headers.has("Cache-Control")) {
      try {
        respuesta.headers.set("Cache-Control", "no-store");
      } catch {
        // Respuestas con cabeceras inmutables (p. ej. Response.redirect): se dejan como están.
      }
    }
    return respuesta;
  });
  return Object.assign(envuelto, { [ACCESO_DECLARADO]: acceso });
}
