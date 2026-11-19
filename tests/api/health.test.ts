// E0-4: GET /api/health. Con la base arriba, 200 { estado: "ok" }; con la base caída, 503
// { estado: "error" } con el formato común y sin detalles.
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { describeDb, usarEntornoDePrueba } from "../ayudas/entorno";

const pedirSalud = async () => {
  const { GET } = await import("@/app/api/health/route");
  return GET(new Request("https://tienda.prueba.local/api/health"), {});
};

describe("GET /api/health (base simulada)", () => {
  const ping = vi.fn();
  beforeEach(async () => {
    vi.resetModules();
    vi.doMock("@/server/db", () => ({ ping }));
    ping.mockReset();
    (await import("@/server/servicios/salud")).reiniciarSalud();
  });
  afterAll(() => {
    vi.doUnmock("@/server/db");
    vi.resetModules();
  });

  it("200 { estado: 'ok' } sin caché cuando la base responde", async () => {
    ping.mockResolvedValue(undefined);
    const r = await pedirSalud();
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ estado: "ok" });
  });

  it("503 { estado: 'error' } con el formato común, sin detalles ni secretos", async () => {
    ping.mockRejectedValue(new Error("password authentication failed for user x at postgresql://u:SECRETO@host/db"));
    const r = await pedirSalud();
    expect(r.status).toBe(503);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const texto = await r.text();
    expect(JSON.parse(texto)).toEqual({
      estado: "error",
      error: "servicio-no-disponible",
      mensaje: "El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.",
    });
    expect(texto).not.toMatch(/SECRETO|postgres|password/i);
  });

  it("100 llamadas simultáneas hacen un solo SELECT 1 y el resultado vale 3 s", async () => {
    vi.useFakeTimers();
    try {
      ping.mockImplementation(() => new Promise((r) => setTimeout(r, 20)));
      const todas = Promise.all(Array.from({ length: 100 }, () => pedirSalud()));
      await vi.advanceTimersByTimeAsync(25);
      expect((await todas).every((r) => r.status === 200)).toBe(true);
      expect(ping).toHaveBeenCalledTimes(1);
      await pedirSalud();
      expect(ping).toHaveBeenCalledTimes(1);
      ping.mockRejectedValueOnce(new Error("caída"));
      vi.advanceTimersByTime(3_100);
      expect((await pedirSalud()).status).toBe(503);
      expect(ping).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("pide la comprobación con un tiempo máximo corto (2 s)", async () => {
    ping.mockResolvedValue(undefined);
    await pedirSalud();
    expect(ping).toHaveBeenCalledWith(2000);
  });
});

describeDb("GET /api/health contra Postgres real", () => {
  beforeEach(async () => {
    vi.resetModules();
    (await import("@/server/servicios/salud")).reiniciarSalud();
  });
  afterAll(async () => {
    await usarEntornoDePrueba();
  });

  it("con la base de pruebas arriba: 200", async () => {
    await usarEntornoDePrueba();
    const r = await pedirSalud();
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ estado: "ok" });
  });

  it("con la base caída (nadie escucha en el puerto): 503 sin detalles", async () => {
    await usarEntornoDePrueba({ DATABASE_URL: "postgresql://u:CLAVE_FALSA@127.0.0.1:1/caida_test" });
    const r = await pedirSalud();
    expect(r.status).toBe(503);
    const texto = await r.text();
    expect(JSON.parse(texto).estado).toBe("error");
    expect(texto).not.toMatch(/CLAVE_FALSA|ECONNREFUSED|127\.0\.0\.1/);
  });

  it("con la configuración inválida también responde 503 (no 500)", async () => {
    await usarEntornoDePrueba({ DATABASE_URL: undefined });
    const r = await pedirSalud();
    expect(r.status).toBe(503);
  });
});
