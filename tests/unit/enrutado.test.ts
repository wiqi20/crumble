// E0-5: enrutado por Host (proxy.ts) y cabeceras de seguridad (next.config.ts).
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import nextConfig from "@/next.config";
import { proxy, config as configProxy } from "@/proxy";
import { reiniciarConfig } from "@/server/config";
import { decidir, normalizarHost, normalizarRuta } from "@/server/http/enrutado";
import { entornoValido } from "../ayudas/entorno";

const HOSTS = { hostTienda: "tienda.prueba.local", hostPanel: "panel.prueba.local" };
const d = (host: string | null, ruta: string) => decidir({ host, ruta, ...HOSTS });

describe("decidir (enrutado por Host)", () => {
  it("Host desconocido o ausente → 404", () => {
    expect(d("otro.sticr.app", "/")).toMatchObject({ tipo: "no-encontrado", hostConocido: false });
    expect(d(null, "/")).toMatchObject({ tipo: "no-encontrado", hostConocido: false });
    expect(d("", "/api/tienda")).toMatchObject({ tipo: "no-encontrado", api: true });
    expect(d("crumble.sticr.app.evil.example", "/")).toMatchObject({ tipo: "no-encontrado" });
    expect(d("tienda.prueba.local:8443", "/")).toMatchObject({ tipo: "no-encontrado" });
  });

  it("/api/health responde con cualquier Host (prueba de salud de Railway)", () => {
    expect(d("healthcheck.railway.app", "/api/health")).toEqual({ tipo: "seguir", superficie: null });
    expect(d("tienda.prueba.local", "/api/health")).toEqual({ tipo: "seguir", superficie: "tienda" });
  });

  it("tienda: sirve sus páginas y su API; /panel y /api/admin → 404", () => {
    for (const ruta of ["/", "/ideas", "/ideas/pastel-de-fresa", "/arma-tu-pastel", "/api/tienda", "/api/pedidos", "/imagenes/1/800", "/paneles"]) {
      expect(d("tienda.prueba.local", ruta), ruta).toEqual({ tipo: "seguir", superficie: "tienda" });
    }
    for (const ruta of ["/panel", "/panel/", "/panel/pedidos", "/api/admin", "/api/admin/yo", "/api/admin/auth/google"]) {
      expect(d("tienda.prueba.local", ruta), ruta).toMatchObject({ tipo: "no-encontrado", hostConocido: true });
    }
    expect(d("tienda.prueba.local", "/api/admin/yo")).toMatchObject({ api: true });
    expect(d("tienda.prueba.local", "/panel/pedidos")).toMatchObject({ api: false });
  });

  it("tienda: los disfraces del panel también dan 404 (mayúsculas, codificación, barras dobles)", () => {
    for (const ruta of ["/PANEL", "/Panel/pedidos", "/%70anel", "/%2Fpanel", "//panel", "/api//admin/yo", "/API/Admin/yo", "/api/%61dmin/yo", "/%5Cpanel"]) {
      expect(d("tienda.prueba.local", ruta), ruta).toMatchObject({ tipo: "no-encontrado" });
    }
    expect(d("tienda.prueba.local", "/%E0%A4%A")).toEqual({ tipo: "ruta-invalida" });
  });

  it("panel: la API y los archivos comunes pasan tal cual", () => {
    for (const ruta of ["/api/admin/yo", "/api/configurador", "/imagenes/3/400", "/favicon.ico", "/icon.svg", "/apple-icon.png", "/robots.txt", "/manifest.webmanifest", "/iconos/icono-192.png", "/marcas/demo/favicon.ico"]) {
      expect(d("panel.prueba.local", ruta), ruta).toEqual({ tipo: "seguir", superficie: "panel" });
    }
  });

  it("panel: se sirve en la raíz; cada página se reescribe por dentro a /panel/...", () => {
    expect(d("panel.prueba.local", "/")).toEqual({ tipo: "reescribir", ruta: "/panel", superficie: "panel" });
    expect(d("panel.prueba.local", "/pedidos")).toEqual({ tipo: "reescribir", ruta: "/panel/pedidos", superficie: "panel" });
    expect(d("panel.prueba.local", "/inventario/Kardex")).toEqual({ tipo: "reescribir", ruta: "/panel/inventario/Kardex", superficie: "panel" });
    // Una página de la tienda o /panel/... en el panel cae bajo /panel y da el 404 del panel.
    expect(d("panel.prueba.local", "/privacidad")).toMatchObject({ tipo: "reescribir", ruta: "/panel/privacidad" });
    expect(d("panel.prueba.local", "/panel/pedidos")).toMatchObject({ tipo: "reescribir", ruta: "/panel/panel/pedidos" });
  });

  it("el Host se compara sin mayúsculas y sin punto final", () => {
    expect(normalizarHost("Tienda.Prueba.Local.")).toBe("tienda.prueba.local");
    expect(normalizarHost("localhost.:3000")).toBe("localhost:3000");
  });

  it("el puerto estándar no cambia el Host (un proxy delante puede mandarlo); otro puerto sí", () => {
    expect(normalizarHost("tienda.prueba.local:443")).toBe("tienda.prueba.local");
    expect(normalizarHost("Tienda.Prueba.Local.:443")).toBe("tienda.prueba.local");
    expect(normalizarHost("tienda.prueba.local:80")).toBe("tienda.prueba.local");
    expect(d("tienda.prueba.local:443", "/")).toEqual({ tipo: "seguir", superficie: "tienda" });
    expect(d("panel.prueba.local:443", "/pedidos")).toMatchObject({ tipo: "reescribir", ruta: "/panel/pedidos" });
    expect(d("tienda.prueba.local:4430", "/")).toMatchObject({ tipo: "no-encontrado", hostConocido: false });
    expect(d("tienda.prueba.local:44", "/")).toMatchObject({ tipo: "no-encontrado", hostConocido: false });
    expect(d("TIENDA.prueba.local", "/")).toEqual({ tipo: "seguir", superficie: "tienda" });
    expect(normalizarRuta("/%zz")).toBeNull();
  });
});

describe("proxy.ts", () => {
  const copia = { ...process.env };
  beforeAll(() => {
    Object.assign(process.env, entornoValido());
    reiniciarConfig();
  });
  afterAll(() => {
    process.env = copia;
    reiniciarConfig();
  });

  const pedir = (host: string, ruta: string, cabeceras: Record<string, string> = {}) =>
    proxy(new NextRequest(`https://${host}${ruta}`, { headers: { host, ...cabeceras } }));

  it("Host desconocido: 404 con cabeceras de seguridad y sin caché", async () => {
    const r = pedir("otro.sticr.app", "/");
    expect(r.status).toBe(404);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-security-policy")).toContain("frame-ancestors 'none'");
    expect(r.headers.get("strict-transport-security")).toBe("max-age=31536000");
    expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await r.text()).toContain('lang="es-CR"');
  });

  it("/api/admin en la tienda: 404 JSON con el formato común", async () => {
    const r = pedir("tienda.prueba.local", "/api/admin/yo");
    expect(r.status).toBe(404);
    expect(r.headers.get("content-type")).toBe("application/json");
    expect(await r.json()).toEqual({ error: "no-encontrado", mensaje: "No encontramos lo que buscas." });
  });

  it("tienda: deja pasar, pone un id nuevo a la petición y reemplaza el que mande el navegador", () => {
    const r = pedir("tienda.prueba.local", "/ideas", { "x-id-peticion": "id-inventado" });
    expect(r.headers.get("x-middleware-next")).toBe("1");
    const id = r.headers.get("x-id-peticion");
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    // NextResponse.next({ request: { headers } }) pasa la cabecera hacia la ruta con este prefijo.
    expect(r.headers.get("x-middleware-request-x-id-peticion")).toBe(id);
    expect(r.headers.get("x-robots-tag")).toBeNull();
  });

  it("panel: nunca sale en caché (M4), ni sus páginas ni su API; la tienda no lo lleva", () => {
    for (const ruta of ["/", "/pedidos", "/api/admin/yo", "/no-existe"]) {
      expect(pedir("panel.prueba.local", ruta).headers.get("cache-control"), ruta).toBe("private, no-store, max-age=0");
    }
    expect(pedir("tienda.prueba.local", "/").headers.get("cache-control")).toBeNull();
  });

  it("codificación inválida (B1): 404 propio con el formato común, en las dos direcciones, sin registrar nada", async () => {
    const espias = (["log", "warn", "error"] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => {}));
    try {
      for (const [host, ruta] of [["tienda.prueba.local", "/%"], ["tienda.prueba.local", "/%E0%A4%A"], ["panel.prueba.local", "/panel/%ZZ"], ["tienda.prueba.local", "/panel/%ZZ"]]) {
        const r = pedir(host, ruta);
        expect(r.status, ruta).toBe(404);
        expect(r.headers.get("x-middleware-rewrite")).toBeNull();
        expect(r.headers.get("cache-control")).toBe("no-store");
        expect(await r.json()).toEqual({ error: "no-encontrado", mensaje: "No encontramos lo que buscas." });
      }
      for (const e of espias) expect(e).not.toHaveBeenCalled();
    } finally {
      for (const e of espias) e.mockRestore();
    }
  });

  it("panel: reescribe a /panel conservando la consulta, con id de petición y noindex", () => {
    const raiz = pedir("panel.prueba.local", "/");
    expect(raiz.headers.get("x-middleware-rewrite")).toBe("https://panel.prueba.local/panel");
    const r = pedir("panel.prueba.local", "/pedidos?pagina=2");
    expect(r.headers.get("x-middleware-rewrite")).toBe("https://panel.prueba.local/panel/pedidos?pagina=2");
    expect(r.headers.get("x-middleware-request-x-id-peticion")).toBe(r.headers.get("x-id-peticion"));
    expect(r.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    const api = pedir("panel.prueba.local", "/api/admin/yo");
    expect(api.headers.get("x-middleware-next")).toBe("1");
    expect(api.headers.get("x-middleware-rewrite")).toBeNull();
  });

  it("404 de páginas en una dirección conocida: reescribe al 404 de su lado", () => {
    expect(pedir("tienda.prueba.local", "/panel").headers.get("x-middleware-rewrite")).toBe("https://tienda.prueba.local/_no-encontrado");
  });

  it("en la demo, también la tienda lleva noindex", () => {
    Object.assign(process.env, entornoValido({ MODO_DEMO: "true", DEMO_RESET_MINUTOS: "60" }));
    reiniciarConfig();
    try {
      expect(pedir("tienda.prueba.local", "/").headers.get("x-robots-tag")).toBe("noindex, nofollow");
    } finally {
      Object.assign(process.env, entornoValido());
      reiniciarConfig();
    }
  });

  it("con la configuración inválida responde 503 (seguro: en realidad el servicio no arranca)", async () => {
    delete process.env.DATABASE_URL;
    reiniciarConfig();
    try {
      const r = pedir("tienda.prueba.local", "/");
      expect(r.status).toBe(503);
      expect((await r.json()).error).toBe("servicio-no-disponible");
    } finally {
      Object.assign(process.env, entornoValido());
      reiniciarConfig();
    }
  });

  it("el matcher deja fuera solo los estáticos de Next", () => {
    expect(configProxy.matcher).toEqual(["/((?!_next/static|_next/image).*)"]);
  });
});

describe("cabeceras de seguridad (next.config.ts)", () => {
  async function reglas() {
    return nextConfig.headers!();
  }
  async function generales(): Promise<Record<string, string>> {
    const regla = (await reglas()).find((r) => r.source === "/:path*");
    expect(regla, "debe haber una regla para todas las rutas").toBeDefined();
    return Object.fromEntries(regla!.headers.map((h) => [h.key, h.value]));
  }

  it("están todas las de 5.4, con HSTS sin includeSubDomains", async () => {
    const h = await generales();
    expect(h["Strict-Transport-Security"]).toBe("max-age=31536000");
    expect(h["Strict-Transport-Security"]).not.toMatch(/includeSubDomains|preload/);
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin");
    expect(h["Cross-Origin-Resource-Policy"]).toBe("same-origin");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["Permissions-Policy"]).toMatch(/camera=\(\).*microphone=\(\).*geolocation=\(\)/);
  });

  it("la CSP no permite terceros y cierra marcos, objetos, base y formularios", async () => {
    const csp = (await generales())["Content-Security-Policy"];
    const directivas = new Map(csp.split("; ").map((x) => [x.split(" ")[0], x]));
    expect(directivas.get("default-src")).toBe("default-src 'self'");
    expect(directivas.get("frame-ancestors")).toBe("frame-ancestors 'none'");
    expect(directivas.get("object-src")).toBe("object-src 'none'");
    expect(directivas.get("base-uri")).toBe("base-uri 'self'");
    expect(directivas.get("form-action")).toBe("form-action 'self'");
    expect(directivas.get("connect-src")).toBe("connect-src 'self'");
    expect(directivas.get("font-src")).toBe("font-src 'self'");
    // Ningún origen externo en ninguna directiva, y en producción nada de eval.
    expect(csp).not.toMatch(/https?:|\*/);
    expect(directivas.get("script-src")).not.toContain("unsafe-eval");
    expect(directivas.has("upgrade-insecure-requests")).toBe(true);
  });

  it("las páginas del estado del pedido van con Referrer-Policy: no-referrer, después de la regla general", async () => {
    const lista = await reglas();
    const general = lista.findIndex((r) => r.source === "/:path*");
    for (const fuente of ["/pedido/:token*", "/mi-pedido/:token*"]) {
      const i = lista.findIndex((r) => r.source === fuente);
      expect(i, fuente).toBeGreaterThan(general);
      expect(lista[i].headers).toEqual([{ key: "Referrer-Policy", value: "no-referrer" }]);
    }
  });
});
