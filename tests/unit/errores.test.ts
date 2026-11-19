// E0-4: formato de error común, id por petición y registros sin datos personales.
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  CABECERA_ID_PETICION,
  conManejoDeErrores,
  errorComun,
  ErrorApi,
  idDePeticion,
  leerCuerpo,
  MENSAJES,
  respuestaError,
} from "@/server/http/errores";
import { limpiarCampos, registrar } from "@/server/http/registro";

const peticion = (url = "https://tienda.prueba.local/api/algo?telefono=88887777", init: RequestInit = {}) => new Request(url, init);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("formato de error común", () => {
  it("respuestaError: { error, mensaje } con no-store y JSON", async () => {
    const r = respuestaError(404, "no-encontrado", MENSAJES["no-encontrado"]);
    expect(r.status).toBe(404);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(r.headers.get("content-type")).toMatch(/application\/json/);
    expect(await r.json()).toEqual({ error: "no-encontrado", mensaje: "No encontramos lo que buscas." });
  });

  it("errorComun usa el estado de la sección 4 para cada código", () => {
    expect(errorComun("sin-sesion").estado).toBe(401);
    expect(errorComun("sin-permiso").estado).toBe(403);
    expect(errorComun("origen-no-permitido").estado).toBe(403);
    expect(errorComun("conflicto").estado).toBe(409);
    expect(errorComun("demasiadas-peticiones").estado).toBe(429);
    expect(errorComun("servicio-no-disponible").estado).toBe(503);
  });

  it("todos los mensajes comunes están en español y terminan en punto", () => {
    for (const m of Object.values(MENSAJES)) expect(m).toMatch(/^[A-ZÁÉÍÓÚÑ¿].*\.$/);
  });

  it("un ErrorApi lanzado se responde con su código, sus cabeceras y el id de la petición", async () => {
    const id = "0b7c2c0e-6f0a-4f5e-9a55-2f1d3c1a9e10";
    const manejador = conManejoDeErrores(async () => {
      throw errorComun("demasiadas-peticiones", { cabeceras: { "Retry-After": "60" } });
    });
    const r = await manejador(peticion(undefined, { headers: { [CABECERA_ID_PETICION]: id } }), {});
    expect(r.status).toBe(429);
    expect(r.headers.get("retry-after")).toBe("60");
    expect(r.headers.get("x-id-peticion")).toBe(id);
    expect(await r.json()).toEqual({ error: "demasiadas-peticiones", mensaje: MENSAJES["demasiadas-peticiones"] });
  });

  it("zod: 400 datos-invalidos con campos y mensajes en español", async () => {
    const esquema = z.object({ cantidad: z.number().int().min(1).max(20), nombre: z.string().min(1) });
    const manejador = conManejoDeErrores(async (p: Request) => {
      await leerCuerpo(p, esquema);
      return new Response("no debería llegar");
    });
    const r = await manejador(peticion(undefined, { method: "POST", body: JSON.stringify({ cantidad: 50, nombre: "" }) }), {});
    expect(r.status).toBe(400);
    const cuerpo = await r.json();
    expect(cuerpo.error).toBe("datos-invalidos");
    expect(Object.keys(cuerpo.campos).sort()).toEqual(["cantidad", "nombre"]);
    expect(cuerpo.campos.cantidad).toMatch(/Demasiado grande/);
  });

  it("cuerpo que no es JSON: 400 datos-invalidos", async () => {
    const manejador = conManejoDeErrores(async (p: Request) => {
      await leerCuerpo(p, z.object({}));
      return new Response("");
    });
    const r = await manejador(peticion(undefined, { method: "POST", body: "{no es json" }), {});
    expect(r.status).toBe(400);
    expect((await r.json()).mensaje).toBe("El cuerpo de la petición no es JSON válido.");
  });

  it("error no controlado: 500 en español, sin traza ni mensaje original; el registro no lleva datos personales", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    const manejador = conManejoDeErrores(async () => {
      const e = new Error("duplicate key value violates unique constraint at postgresql://u:SECRETO@db/x for ana@correo.com") as Error & { code: string };
      e.code = "23505";
      throw e;
    });
    const r = await manejador(peticion(), {});
    expect(r.status).toBe(500);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const texto = await r.text();
    expect(JSON.parse(texto)).toEqual({ error: "error-interno", mensaje: "Ocurrió un error inesperado. Intenta de nuevo en unos minutos." });
    expect(texto).not.toMatch(/SECRETO|postgres|duplicate|at |stack|\.ts/i);

    expect(errores).toHaveBeenCalledTimes(1);
    const linea = JSON.parse(errores.mock.calls[0][0] as string);
    expect(linea).toMatchObject({ nivel: "error", evento: "error-no-controlado", metodo: "GET", ruta: "/api/algo", tipo: "Error", codigo: "23505" });
    expect(linea.idPeticion).toMatch(/^[0-9a-f-]{36}$/);
    const crudo = errores.mock.calls[0][0] as string;
    expect(crudo).not.toMatch(/SECRETO|ana@correo|duplicate|88887777|telefono/);
  });

  it("ErrorApi no se registra como error (es una respuesta prevista)", async () => {
    const errores = vi.spyOn(console, "error").mockImplementation(() => {});
    await conManejoDeErrores(async () => {
      throw new ErrorApi(409, "carrito-cambio", "Algunos precios cambiaron.");
    })(peticion(), {});
    expect(errores).not.toHaveBeenCalled();
  });
});

describe("id por petición", () => {
  it("usa el que puso proxy.ts si tiene forma de UUID; si no, crea uno", () => {
    const id = "0b7c2c0e-6f0a-4f5e-9a55-2f1d3c1a9e10";
    expect(idDePeticion(peticion(undefined, { headers: { [CABECERA_ID_PETICION]: id } }))).toBe(id);
    const otro = idDePeticion(peticion(undefined, { headers: { [CABECERA_ID_PETICION]: "<script>inyectado" } }));
    expect(otro).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(idDePeticion(peticion())).not.toBe(idDePeticion(peticion()));
  });
});

describe("registros sin datos personales", () => {
  it("omite campos con nombre de dato personal o secreto", () => {
    expect(
      limpiarCampos({
        cookie: "sesion=abc",
        Authorization: "Bearer x",
        correo: "a@b.co",
        clienteTelefono: "+50688887777",
        nombre: "Ana",
        ip: "1.2.3.4",
        token: "t",
        ruta: "/api/pedidos",
        estado: 200,
      }),
    ).toEqual({
      cookie: "[omitido]",
      Authorization: "[omitido]",
      correo: "[omitido]",
      clienteTelefono: "[omitido]",
      nombre: "[omitido]",
      ip: "[omitido]",
      token: "[omitido]",
      ruta: "/api/pedidos",
      estado: 200,
    });
  });

  it("omite textos que parecen correo, teléfono o token aunque el campo tenga otro nombre", () => {
    expect(limpiarCampos({ detalle: "escribir a ana@correo.com", nota: "llamar al 8888-7777", x: "a".repeat(40) })).toEqual({
      detalle: "[omitido]",
      nota: "[omitido]",
      x: "[omitido]",
    });
  });

  it("recorta textos largos, conserva UUID y números y escribe una línea JSON", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const id = "0b7c2c0e-6f0a-4f5e-9a55-2f1d3c1a9e10";
    registrar("info", "prueba", { idPeticion: id, duracionMs: 12, texto: "abc ".repeat(100) });
    const linea = JSON.parse(log.mock.calls[0][0] as string);
    expect(linea).toMatchObject({ nivel: "info", evento: "prueba", idPeticion: id, duracionMs: 12 });
    expect(linea.texto.length).toBeLessThanOrEqual(201);
    expect(typeof linea.hora).toBe("string");
  });
});
