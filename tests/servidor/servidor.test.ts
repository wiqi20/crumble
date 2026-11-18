// E0-5 contra un servidor real (`next build` + `next start`). Se omite si no se define
// URL_SERVIDOR_PRUEBA (p. ej. http://127.0.0.1:3100). El servidor debe arrancar con
// URL_TIENDA=https://tienda.prueba.local y URL_PANEL=https://panel.prueba.local; las peticiones
// van a URL_SERVIDOR_PRUEBA con la cabecera Host de cada dirección. Cómo correrla: README.
import http from "node:http";
import { describe, expect, it } from "vitest";

const SERVIDOR = process.env.URL_SERVIDOR_PRUEBA || null;

type Respuesta = { estado: number; cabeceras: http.IncomingHttpHeaders; cuerpo: string };

function pedir(host: string, ruta: string): Promise<Respuesta> {
  const u = new URL(SERVIDOR!);
  return new Promise((resolver, rechazar) => {
    const req = http.request({ hostname: u.hostname, port: u.port, path: ruta, method: "GET", headers: { Host: host } }, (res) => {
      let cuerpo = "";
      res.setEncoding("utf8");
      res.on("data", (c) => (cuerpo += c));
      res.on("end", () => resolver({ estado: res.statusCode ?? 0, cabeceras: res.headers, cuerpo }));
    });
    req.on("error", rechazar);
    req.end();
  });
}

function tieneCabecerasDeSeguridad(r: Respuesta) {
  expect(r.cabeceras["content-security-policy"]).toMatch(/frame-ancestors 'none'/);
  expect(r.cabeceras["content-security-policy"]).not.toMatch(/https?:/);
  expect(r.cabeceras["strict-transport-security"]).toBe("max-age=31536000");
  expect(r.cabeceras["x-content-type-options"]).toBe("nosniff");
  expect(r.cabeceras["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(r.cabeceras["cross-origin-opener-policy"]).toBe("same-origin");
  expect(r.cabeceras["cross-origin-resource-policy"]).toBe("same-origin");
  expect(r.cabeceras["x-powered-by"]).toBeUndefined();
}

describe.skipIf(!SERVIDOR)("servidor real: enrutado por Host y cabeceras", () => {
  it("página de la tienda: 200 con las cabeceras de seguridad y un id de petición", async () => {
    const r = await pedir("tienda.prueba.local", "/");
    expect(r.estado).toBe(200);
    tieneCabecerasDeSeguridad(r);
    expect(r.cabeceras["x-id-peticion"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.cabeceras["x-robots-tag"]).toBeUndefined();
  });

  it("página del panel (en la raíz de su dirección): lleva las cabeceras y noindex", async () => {
    const r = await pedir("panel.prueba.local", "/");
    tieneCabecerasDeSeguridad(r);
    expect(r.cabeceras["x-robots-tag"]).toBe("noindex, nofollow");
    expect(r.cabeceras["x-id-peticion"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("respuesta de la API: /api/health con las cabeceras, sin caché", async () => {
    const r = await pedir("tienda.prueba.local", "/api/health");
    expect([200, 503]).toContain(r.estado);
    tieneCabecerasDeSeguridad(r);
    expect(r.cabeceras["cache-control"]).toBe("no-store");
  });

  it("/api/health responde con el Host de la prueba de salud de Railway", async () => {
    const r = await pedir("healthcheck.railway.app", "/api/health");
    expect([200, 503]).toContain(r.estado);
    expect(JSON.parse(r.cuerpo)).toHaveProperty("estado");
  });

  it("Host desconocido → 404 con cabeceras", async () => {
    const r = await pedir("otro.sticr.app", "/");
    expect(r.estado).toBe(404);
    tieneCabecerasDeSeguridad(r);
  });

  it("/api/admin y páginas del panel en la dirección de la tienda → 404", async () => {
    for (const ruta of ["/api/admin/yo", "/panel", "/panel/pedidos", "/PANEL", "/%70anel"]) {
      const r = await pedir("tienda.prueba.local", ruta);
      expect(r.estado, ruta).toBe(404);
      tieneCabecerasDeSeguridad(r);
    }
  });

  it("páginas de la tienda (y /panel/...) en la dirección del panel → 404", async () => {
    for (const ruta of ["/privacidad", "/panel", "/panel/pedidos"]) {
      const r = await pedir("panel.prueba.local", ruta);
      expect(r.estado, ruta).toBe(404);
      tieneCabecerasDeSeguridad(r);
    }
  });

  it("una ruta de la API que no existe → 404 en JSON con el formato común", async () => {
    for (const [host, ruta] of [["tienda.prueba.local", "/api/nada"], ["panel.prueba.local", "/api/admin/no-existe"]]) {
      const r = await pedir(host, ruta);
      expect(r.estado, ruta).toBe(404);
      expect(r.cabeceras["content-type"]).toMatch(/application\/json/);
      expect(JSON.parse(r.cuerpo)).toEqual({ error: "no-encontrado", mensaje: "No encontramos lo que buscas." });
    }
  });

  it("estado del pedido: Referrer-Policy no-referrer", async () => {
    const r = await pedir("tienda.prueba.local", "/pedido/un-token");
    expect(r.cabeceras["referrer-policy"]).toBe("no-referrer");
  });
});
