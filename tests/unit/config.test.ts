// E0-2: la configuración se valida al arrancar y dice en español qué falta, sin mostrar valores.
import { describe, expect, it, vi } from "vitest";
import { ErrorDeConfiguracion, leerConfig, reiniciarConfig, VARIABLES } from "@/server/config";
import { entornoValido } from "../ayudas/entorno";

function problemas(entorno: Record<string, string | undefined>): string[] {
  try {
    leerConfig(entorno);
  } catch (e) {
    expect(e).toBeInstanceOf(ErrorDeConfiguracion);
    return (e as ErrorDeConfiguracion).problemas;
  }
  throw new Error("se esperaba un error de configuración");
}

function mensaje(entorno: Record<string, string | undefined>): string {
  try {
    leerConfig(entorno);
  } catch (e) {
    return (e as Error).message;
  }
  throw new Error("se esperaba un error de configuración");
}

describe("server/config.ts (E0-2)", () => {
  it("acepta una instalación completa y normaliza las direcciones", () => {
    const c = leerConfig(entornoValido({ URL_TIENDA: "https://Crumble.Sticr.App", MODO_DEMO: undefined }));
    expect(c.urlTienda).toBe("https://crumble.sticr.app");
    expect(c.hostTienda).toBe("crumble.sticr.app");
    expect(c.hostPanel).toBe("panel.prueba.local");
    expect(c.modoDemo).toBe(false);
    expect(c.retencionPedidosMeses).toBe(24);
    expect(c.estadoServicio).toBe("activo");
    expect(c.google).not.toBeNull();
    expect(c.soporte).toBeNull();
  });

  it("sin DATABASE_URL no arranca y lo dice en español", () => {
    expect(problemas(entornoValido({ DATABASE_URL: undefined }))).toEqual(["DATABASE_URL: falta."]);
    expect(problemas(entornoValido({ DATABASE_URL: "   " }))).toEqual(["DATABASE_URL: falta."]);
    expect(mensaje(entornoValido({ DATABASE_URL: undefined }))).toMatch(/no es válida y el servicio no puede arrancar/);
  });

  it("con MODO_DEMO=true pide DEMO_RESET_MINUTOS y ya no pide Google ni la propietaria", () => {
    expect(
      problemas(
        entornoValido({ MODO_DEMO: "true", DEMO_RESET_MINUTOS: undefined, GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", PROPIETARIA_EMAIL: "" }),
      ),
    ).toEqual(["DEMO_RESET_MINUTOS: falta (obligatoria con MODO_DEMO=true)."]);
    const demo = leerConfig(entornoValido({ MODO_DEMO: "true", DEMO_RESET_MINUTOS: "60", GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "", PROPIETARIA_EMAIL: "" }));
    expect(demo).toMatchObject({ modoDemo: true, demoResetMinutos: 60, google: null, propietariaEmail: null });
  });

  it("fuera de la demo exige Google y la primera propietaria", () => {
    expect(problemas(entornoValido({ GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: "", PROPIETARIA_EMAIL: undefined }))).toEqual([
      "GOOGLE_CLIENT_ID: falta (obligatoria fuera de la demo).",
      "GOOGLE_CLIENT_SECRET: falta (obligatoria fuera de la demo).",
      "PROPIETARIA_EMAIL: falta (obligatoria fuera de la demo).",
    ]);
  });

  it("lista TODO lo que falta de una vez (una línea por variable)", () => {
    const vacio = Object.fromEntries(VARIABLES.map((k) => [k, undefined]));
    const lista = problemas(vacio);
    for (const v of ["DATABASE_URL", "URL_TIENDA", "URL_PANEL", "SESSION_SECRET", "IP_HASH_SALT", "RETENCION_PEDIDOS_MESES", "ESTADO_SERVICIO", "GOOGLE_CLIENT_ID", "PROPIETARIA_EMAIL"]) {
      expect(lista.filter((p) => p.startsWith(`${v}:`))).toHaveLength(1);
    }
  });

  it.each([
    ["URL_TIENDA", "http://crumble.sticr.app", /https/],
    ["URL_TIENDA", "https://crumble.sticr.app/", /sin barra final/],
    ["URL_TIENDA", "https://crumble.sticr.app/tienda", /sin ruta/],
    ["URL_TIENDA", "no es url", /no es una dirección válida/],
    ["URL_PANEL", "https://usuario:clave@panel.prueba.local", /usuario ni clave/],
    ["URL_PANEL", "https://tienda.prueba.local", /distinto/],
    ["DATABASE_URL", "mysql://u@localhost/x", /Postgres/],
    ["SESSION_SECRET", "corta", /al menos 32/],
    ["IP_HASH_SALT", "x".repeat(31), /al menos 32/],
    ["RETENCION_PEDIDOS_MESES", "doce", /entero/],
    ["RETENCION_PEDIDOS_MESES", "0", /entre 1 y 120/],
    ["MODO_DEMO", "si", /"true" o "false"/],
    ["ESTADO_SERVICIO", "pausado", /"activo" o "suspendido"/],
    ["PROPIETARIA_EMAIL", "no-es-correo", /correo válido/],
    ["SOPORTE_ORIGEN", "otro", /crumble/],
  ])("rechaza %s inválida (%s)", (variable, valor, esperado) => {
    const lista = problemas(entornoValido({ [variable]: valor }));
    const linea = lista.find((p) => p.startsWith(`${variable}:`));
    expect(linea, lista.join(" | ")).toMatch(esperado);
  });

  it("acepta http solo en la propia máquina (desarrollo local)", () => {
    const c = leerConfig(entornoValido({ URL_TIENDA: "http://localhost:3000", URL_PANEL: "http://127.0.0.1:3000" }));
    expect(c.hostTienda).toBe("localhost:3000");
    expect(c.hostPanel).toBe("127.0.0.1:3000");
  });

  it("las variables de soporte van las tres juntas", () => {
    expect(problemas(entornoValido({ SOPORTE_URL: "https://sticr.app/api/soporte" }))).toEqual([
      "SOPORTE_ORIGEN: falta (las tres variables de soporte van juntas).",
      "SOPORTE_SECRETO: falta (las tres variables de soporte van juntas).",
    ]);
    const c = leerConfig(entornoValido({ SOPORTE_URL: "https://sticr.app/api/soporte", SOPORTE_ORIGEN: "crumble", SOPORTE_SECRETO: "s".repeat(40) }));
    expect(c.soporte?.origen).toBe("crumble");
  });

  it("el mensaje nunca muestra valores, ni siquiera los que fallan", () => {
    const secretos = {
      DATABASE_URL: "mysql://admin:CLAVE_BASE_123@db.ejemplo/x",
      SESSION_SECRET: "SECRETO_CORTO",
      IP_HASH_SALT: "SAL_CORTA",
      URL_TIENDA: "http://VALOR_TIENDA.ejemplo",
      PROPIETARIA_EMAIL: "CORREO_MALO",
      RETENCION_PEDIDOS_MESES: "VALOR_MESES",
      ESTADO_SERVICIO: "VALOR_ESTADO",
      SOPORTE_SECRETO: "SOPORTE_CORTO",
    };
    const texto = mensaje(entornoValido(secretos));
    for (const valor of Object.values(secretos)) expect(texto).not.toContain(valor);
    expect(texto).not.toMatch(/CLAVE|SECRETO_|SAL_|VALOR_/);
  });

  it("al arrancar (instrumentation.ts) el proceso termina con código 1 y el mensaje, sin valores", async () => {
    const copia = { ...process.env };
    for (const k of VARIABLES) delete process.env[k];
    process.env.SESSION_SECRET = "VALOR_QUE_NO_SE_MUESTRA";
    process.env.NEXT_RUNTIME = "nodejs";
    const salir = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit");
    }) as never);
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      reiniciarConfig();
      const { register } = await import("@/instrumentation");
      await expect(register()).rejects.toThrow("process.exit");
      expect(salir).toHaveBeenCalledWith(1);
      const texto = errores.mock.calls.flat().join("\n");
      expect(texto).toContain("DATABASE_URL: falta.");
      expect(texto).toContain("SESSION_SECRET: es muy corta");
      expect(texto).not.toContain("VALOR_QUE_NO_SE_MUESTRA");
    } finally {
      salir.mockRestore();
      errores.mockRestore();
      process.env = copia;
      reiniciarConfig();
    }
  });

  it("durante next build no exige las variables (el CI compila sin ellas)", async () => {
    const copia = { ...process.env };
    for (const k of VARIABLES) delete process.env[k];
    process.env.NEXT_RUNTIME = "nodejs";
    process.env.NEXT_PHASE = "phase-production-build";
    const salir = vi.spyOn(process, "exit");
    try {
      reiniciarConfig();
      const { register } = await import("@/instrumentation");
      await register();
      expect(salir).not.toHaveBeenCalled();
    } finally {
      salir.mockRestore();
      process.env = copia;
      reiniciarConfig();
    }
  });
});
