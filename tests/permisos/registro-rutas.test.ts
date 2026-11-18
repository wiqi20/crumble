// E0-6: registro de rutas del panel (diseño técnico 5.4). Toda ruta de /api/admin declara un
// permiso con rutaAdmin; si alguna no lo hace, esta prueba falla y el PR queda en rojo.
import path from "node:path";
import { describe, expect, it } from "vitest";
import { revisarRutasAdmin, urlDeArchivo } from "../ayudas/registro-rutas";

const RAIZ = path.resolve(import.meta.dirname, "../..");

describe("registro de rutas de /api/admin", () => {
  it("la aplicación real: toda ruta de /api/admin declara permiso y sin sesión responde 401", async () => {
    const { metodos, problemas } = await revisarRutasAdmin(path.join(RAIZ, "app"));
    expect(problemas, JSON.stringify(problemas, null, 2)).toEqual([]);
    // En la Etapa 0 todavía no hay rutas del panel; B2 y siguientes las agregan con rutaAdmin.
    for (const m of metodos) expect(m.ruta.startsWith("/api/admin")).toBe(true);
  });

  it("una ruta de ejemplo sin permiso declarado hace fallar la revisión", async () => {
    const { metodos, problemas } = await revisarRutasAdmin(path.join(import.meta.dirname, "ejemplos", "app"));
    const resumen = problemas.map((p) => `${p.metodo ?? "*"} ${p.ruta}: ${p.motivo}`).sort();
    expect(resumen).toEqual([
      "* /api/admin/permiso-inventado: el módulo no carga (¿rutaAdmin con un acceso que no está en el catálogo?)",
      "DELETE /api/admin/metodo-mixto: no declara permiso (defínela con rutaAdmin)",
      "GET /api/admin/marca-falsa: sin sesión responde 200 en vez de 401",
      "GET /api/admin/publica-no-permitida: es pública y no está en RUTAS_ADMIN_PUBLICAS",
      "GET /api/admin/sin-permiso: no declara permiso (defínela con rutaAdmin)",
      "PUT /api/admin/en-grupo: no declara permiso (defínela con rutaAdmin)",
    ]);
    // Las bien declaradas pasan; las de fuera de /api/admin no se revisan.
    expect(metodos.map((m) => `${m.metodo} ${m.ruta} ${m.acceso}`).sort()).toEqual([
      "GET /api/admin/auth/google publica",
      "GET /api/admin/con-permiso pedidos.ver",
      "GET /api/admin/metodo-mixto inventario.ver",
      "POST /api/admin/con-permiso sesion",
    ]);
  });

  it("calcula la URL sin grupos de rutas y omite las carpetas privadas", () => {
    expect(urlDeArchivo("/x/app", "/x/app/(panel)/api/admin/yo/route.ts")).toBe("/api/admin/yo");
    expect(urlDeArchivo("/x/app", "/x/app/api/admin/usuarios/[id]/route.ts")).toBe("/api/admin/usuarios/[id]");
    expect(urlDeArchivo("/x/app", "/x/app/api/admin/_interno/route.ts")).toBeNull();
  });
});

describe("rutaAdmin", () => {
  it("corta con 401 sin-sesion antes de correr el manejador (la sesión llega en B2)", async () => {
    const { rutaAdmin } = await import("@/server/http/ruta-admin");
    let corrio = false;
    const GET = rutaAdmin("pedidos.ver", async () => {
      corrio = true;
      return Response.json({ ok: true });
    });
    const r = await GET(new Request("https://panel.prueba.local/api/admin/x"), {});
    expect(r.status).toBe(401);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: "sin-sesion", mensaje: "Tu sesión no está iniciada o ya venció. Vuelve a entrar." });
    expect(corrio).toBe(false);
  });

  it("una ruta pública corre sin sesión y su respuesta va sin caché", async () => {
    const { rutaAdmin } = await import("@/server/http/ruta-admin");
    const GET = rutaAdmin("publica", async () => Response.json({ ok: true }));
    const r = await GET(new Request("https://panel.prueba.local/api/admin/auth/google"), {});
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
  });

  it("un acceso fuera del catálogo rompe al definir la ruta", async () => {
    const { rutaAdmin } = await import("@/server/http/ruta-admin");
    expect(() => rutaAdmin("todo" as never, async () => new Response())).toThrow(/catálogo/);
  });
});
