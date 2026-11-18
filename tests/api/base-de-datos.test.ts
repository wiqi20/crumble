// E0-3 y E0-6: grupo de conexiones, transacciones con SET LOCAL, candados, restricciones de
// 001_base.sql y ayudas para crear usuarios y sesiones, contra Postgres real.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LISTA_DELEGABLES, PERMISOS_DELEGABLES } from "@/server/auth/permisos";
import { resumenDeToken } from "@/server/auth/tokens";
import { cerrarGrupo, consulta, ping, transaccion } from "@/server/db";
import { crearSesion, crearUsuario, limpiarUsuarios } from "../ayudas/datos";
import { describeDb, usarEntornoDePrueba } from "../ayudas/entorno";

/** Código de error de Postgres de una promesa que debe fallar. */
const codigoDe = (p: Promise<unknown>) => p.then(() => "sin error", (e: { code?: string }) => e.code);

describeDb("server/db contra Postgres de pruebas", () => {
  beforeAll(async () => {
    await usarEntornoDePrueba();
  });
  afterAll(async () => {
    await limpiarUsuarios();
    await cerrarGrupo();
  });

  it("ping responde", async () => {
    await expect(ping(2000)).resolves.toBeUndefined();
  });

  it("transaccion guarda todo junto y revierte todo si algo falla", async () => {
    const correo = "transaccion@prueba.local";
    await expect(
      transaccion(async (tx) => {
        await tx.consulta("INSERT INTO usuarios (correo, nombre, rol) VALUES ($1, 'A', 'encargado')", [correo]);
        await tx.consulta("SELECT * FROM tabla_que_no_existe");
      }),
    ).rejects.toMatchObject({ code: "42P01" });
    expect(await consulta("SELECT 1 FROM usuarios WHERE correo = $1", [correo])).toHaveLength(0);

    const id = await transaccion(async (tx) => {
      const [u] = await tx.consulta<{ id: string }>("INSERT INTO usuarios (correo, nombre, rol) VALUES ($1, 'A', 'encargado') RETURNING id", [correo]);
      return Number(u.id);
    });
    expect(await consulta("SELECT id FROM usuarios WHERE correo = $1", [correo])).toEqual([{ id: String(id) }]);
  });

  it("los ajustes valen solo dentro de la transacción (SET LOCAL) y se pasan como parámetros", async () => {
    const dentro = await transaccion(
      async (tx) => (await tx.consulta<{ v: string; t: string }>("SELECT current_setting('crumble.usuario_id') AS v, current_setting('lock_timeout') AS t"))[0],
      { ajustes: { "crumble.usuario_id": "42'; DROP TABLE usuarios; --", lock_timeout: "3s" } },
    );
    expect(dentro).toEqual({ v: "42'; DROP TABLE usuarios; --", t: "3s" });
    const [fuera] = await consulta<{ v: string | null }>("SELECT current_setting('crumble.usuario_id', true) AS v");
    expect(fuera.v === null || fuera.v === "").toBe(true);
    expect(await consulta("SELECT 1 FROM pg_tables WHERE tablename = 'usuarios'")).toHaveLength(1);
  });

  it("rechaza nombres de ajuste que no son identificadores", async () => {
    await expect(transaccion(async () => 1, { ajustes: { "x; DROP TABLE usuarios": "1" } })).rejects.toThrow(/no permitido/);
  });

  it("candado de transacción: la segunda espera a que termine la primera", async () => {
    const orden: string[] = [];
    let soltar!: () => void;
    const espera = new Promise<void>((r) => (soltar = r));
    const primera = transaccion(async (tx) => {
      await tx.candado(991);
      orden.push("primera-dentro");
      await espera;
      orden.push("primera-sale");
    });
    await new Promise((r) => setTimeout(r, 100));
    const segunda = transaccion(async (tx) => {
      await tx.candado(991);
      orden.push("segunda-dentro");
    });
    await new Promise((r) => setTimeout(r, 100));
    expect(orden).toEqual(["primera-dentro"]);
    soltar();
    await Promise.all([primera, segunda]);
    expect(orden).toEqual(["primera-dentro", "primera-sale", "segunda-dentro"]);
  });
});

describeDb("001_base.sql: restricciones", () => {
  beforeAll(async () => {
    await usarEntornoDePrueba();
  });
  afterAll(async () => {
    await limpiarUsuarios();
    await cerrarGrupo();
  });

  it("instalacion: una sola fila, nace como NO demo", async () => {
    expect(await consulta("SELECT id, es_demo FROM instalacion")).toEqual([{ id: 1, es_demo: false }]);
    expect(await codigoDe(consulta("INSERT INTO instalacion (id) VALUES (2)"))).toBe("23514");
  });

  it("negocio: una sola fila y los límites de 3.3", async () => {
    expect(await codigoDe(consulta("INSERT INTO negocio (id, nombre) VALUES (2, 'Otra')"))).toBe("23514");
    expect(await codigoDe(consulta("INSERT INTO negocio (nombre, iva_porcentaje) VALUES ('X', 14)"))).toBe("23514");
    expect(await codigoDe(consulta("INSERT INTO negocio (nombre, saldo_favor_dias) VALUES ('X', 0)"))).toBe("23514");
    expect(await codigoDe(consulta("INSERT INTO negocio (nombre, saldo_favor_horas_minimas) VALUES ('X', 169)"))).toBe("23514");
    await transaccion(async (tx) => {
      const [n] = await tx.consulta("INSERT INTO negocio (nombre) VALUES ('Prueba') RETURNING *");
      expect(n).toMatchObject({ id: 1, moneda: "CRC", plazo_base_horas: 24, anticipo_porcentaje: 50, iva_porcentaje: "13.00", descontar_inventario_listo: false, saldo_favor_dias: 60, saldo_favor_horas_minimas: null });
      await tx.consulta("SELECT * FROM tabla_que_no_existe"); // revierte: la prueba no deja la fila
    }).catch(() => {});
    expect(await consulta("SELECT 1 FROM negocio")).toHaveLength(0);
  });

  it("usuarios: correo único y en minúsculas, rol del catálogo", async () => {
    await crearUsuario({ correo: "unica@prueba.local" });
    expect(await codigoDe(crearUsuario({ correo: "unica@prueba.local" }))).toBe("23505");
    expect(await codigoDe(crearUsuario({ correo: "Mayus@prueba.local" }))).toBe("23514");
    expect(await codigoDe(consulta("INSERT INTO usuarios (correo, nombre, rol) VALUES ('rol@prueba.local', 'R', 'admin')"))).toBe("23514");
  });

  it("permisos_rol: solo el encargado, solo permisos delegables, con los valores de fábrica de 5.4", async () => {
    const filas = await consulta<{ permiso: string; permitido: boolean }>("SELECT permiso, permitido FROM permisos_rol WHERE rol = 'encargado' ORDER BY permiso");
    expect(Object.fromEntries(filas.map((f) => [f.permiso, f.permitido]))).toEqual(PERMISOS_DELEGABLES);
    expect(await codigoDe(consulta("INSERT INTO permisos_rol (rol, permiso, permitido) VALUES ('encargado', 'costos.ver', true)"))).toBe("23514");
    expect(await codigoDe(consulta("INSERT INTO permisos_rol (rol, permiso, permitido) VALUES ('encargado', 'precios.editar', true)"))).toBe("23514");
    expect(await codigoDe(consulta("INSERT INTO permisos_rol (rol, permiso, permitido) VALUES ('propietaria', 'pedidos.ver', true)"))).toBe("23514");
  });

  it("el CHECK de permisos_rol y el catálogo del código coinciden", async () => {
    const [{ def }] = await consulta<{ def: string }>(
      "SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'permisos_rol'::regclass AND pg_get_constraintdef(oid) LIKE '%permiso%ANY%'",
    );
    const enLaBase = [...def.matchAll(/'([a-z_.]+)'::text/g)].map((m) => m[1]).sort();
    expect(enLaBase).toEqual([...LISTA_DELEGABLES].sort());
  });

  it("ayudas de prueba: crearUsuario y crearSesion (la base solo guarda el resumen del token)", async () => {
    const u = await crearUsuario({ rol: "propietaria" });
    const s = await crearSesion(u.id);
    const [fila] = await consulta<{ token_hash: string; vigente: boolean }>(
      "SELECT token_hash, vence_en > now() AND revocada_en IS NULL AS vigente FROM sesiones WHERE id = $1",
      [s.id],
    );
    expect(fila.token_hash).toBe(resumenDeToken(s.token));
    expect(fila.token_hash).not.toContain(s.token);
    expect(fila.vigente).toBe(true);

    const vencida = await crearSesion(u.id, { venceEnHoras: -1 });
    const revocada = await crearSesion(u.id, { revocada: true });
    const estados = await consulta<{ id: string; vigente: boolean }>(
      "SELECT id, vence_en > now() AND revocada_en IS NULL AS vigente FROM sesiones WHERE id = ANY($1::bigint[]) ORDER BY id",
      [[vencida.id, revocada.id]],
    );
    expect(estados.map((e) => e.vigente)).toEqual([false, false]);
  });

  it("sesiones: nunca más de 7 días y resumen con forma de sha256", async () => {
    const u = await crearUsuario();
    expect(await codigoDe(consulta("INSERT INTO sesiones (usuario_id, token_hash, vence_en) VALUES ($1, $2, now() + interval '8 days')", [u.id, "a".repeat(64)]))).toBe("23514");
    expect(await codigoDe(consulta("INSERT INTO sesiones (usuario_id, token_hash, vence_en) VALUES ($1, 'token-en-claro', now() + interval '1 hour')", [u.id]))).toBe("23514");
  });
});

describe("catálogo de permisos", () => {
  it("tiene los 19 delegables de 5.4", () => {
    expect(LISTA_DELEGABLES).toHaveLength(19);
  });
});
