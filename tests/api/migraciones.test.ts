// E0-3: migraciones versionadas. Criterio: migrar dos veces una base vacía deja el mismo esquema;
// editar una migración aplicada detiene el ejecutor; dos ejecuciones simultáneas no chocan.
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { aplicarMigraciones, CARPETA_MIGRACIONES, destinoDeUrl } from "../../scripts/migrate.mjs";
import { esBaseLocalDePrueba, vaciarEsquema } from "../ayudas/base";
import { describeDb, TEST_DB } from "../ayudas/entorno";

/** Entorno mínimo para correr el CLI: sin heredar variables de la máquina. */
const entornoMinimo = (extra: Record<string, string>): NodeJS.ProcessEnv => ({ PATH: process.env.PATH, NODE_ENV: "test", ...extra });

describe("guarda de la base de pruebas", () => {
  it.each(["postgresql://u@localhost:5432/crumble_test", "postgresql://u@127.0.0.1/crumble_test", "postgres://u:p@[::1]:5432/otra_test", "postgresql:///crumble_test"])(
    "acepta %s",
    (url) => expect(esBaseLocalDePrueba(url, "postgresql://u@db.real/railway")).toBe(true),
  );

  it.each([
    ["host remoto por consulta", "postgresql://u@localhost/crumble_test?host=db.real.example"],
    ["hostaddr", "postgresql://u@localhost/crumble_test?hostaddr=203.0.113.5"],
    ["service", "postgresql://u@localhost/crumble_test?service=produccion"],
    ["dbname", "postgresql://u@localhost/crumble_test?dbname=railway"],
    ["nombre sin _test al final", "postgresql://u@localhost/test_crumble"],
    ["nombre railway", "postgresql://u@localhost/railway"],
    ["host remoto", "postgresql://u:p@postgres.railway.internal:5432/crumble_test"],
    ["host parecido a localhost", "postgresql://u@localhost.evil.example/crumble_test"],
    ["no es URL", "no es url"],
    ["otro protocolo", "mysql://u@localhost/crumble_test"],
  ])("rechaza %s", (_n, url) => expect(esBaseLocalDePrueba(url, undefined)).toBe(false));

  it("rechaza la misma dirección que DATABASE_URL", () => {
    const misma = "postgresql://u@localhost:5432/crumble_test";
    expect(esBaseLocalDePrueba(misma, misma)).toBe(false);
  });
});

describe("scripts/migrate.mjs: destino y mensajes", () => {
  it("destinoDeUrl no expone usuario ni clave y distingue local de remoto", () => {
    const remoto = destinoDeUrl("postgresql://admin:SECRETO@postgres.railway.internal:5432/railway");
    expect(remoto).toEqual({ host: "postgres.railway.internal", puerto: "5432", base: "railway", local: false });
    expect(JSON.stringify(remoto)).not.toContain("SECRETO");
    expect(destinoDeUrl("postgresql://u@localhost/x_test").local).toBe(true);
    expect(destinoDeUrl("postgresql://u@localhost/x?host=db.real").local).toBe(false);
  });

  it("si no puede conectar, sale con 1 y no imprime la clave ni el texto crudo del error", () => {
    const r = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      env: entornoMinimo({ DATABASE_URL: "postgresql://u:CLAVE@127.0.0.1:1/x_test" }),
      encoding: "utf8",
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("Destino: host 127.0.0.1, puerto 1, base x_test (local)");
    expect(r.stderr).toMatch(/código de error: ECONNREFUSED/);
    expect(r.stdout + r.stderr).not.toMatch(/CLAVE|connect ECONNREFUSED/);
  });

  it("destino remoto sin confirmación: se cancela antes de conectar", () => {
    const r = spawnSync(process.execPath, ["scripts/migrate.mjs"], {
      env: entornoMinimo({ DATABASE_URL: "postgresql://u:CLAVE@192.0.2.1:5432/railway" }),
      encoding: "utf8",
      input: "",
    });
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("REMOTO");
    expect(r.stderr).toContain("Cancelado");
    expect(r.stdout + r.stderr).not.toContain("CLAVE");
  });

  it("sin DATABASE_URL: sale con 1 y lo dice", () => {
    const r = spawnSync(process.execPath, ["scripts/migrate.mjs"], { env: entornoMinimo({}), encoding: "utf8" });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("Falta DATABASE_URL");
  });
});

describeDb("migraciones contra Postgres de pruebas", () => {
  let cliente: pg.Client;

  /** Foto del esquema: columnas, restricciones e índices de `public` (sin la tabla del ejecutor). */
  async function fotoDelEsquema() {
    const columnas = await cliente.query(
      `SELECT table_name, column_name, data_type, is_nullable, column_default, character_maximum_length, numeric_precision, numeric_scale
       FROM information_schema.columns WHERE table_schema = 'public' ORDER BY 1, 2`,
    );
    const restricciones = await cliente.query(
      `SELECT conrelid::regclass::text AS tabla, conname, pg_get_constraintdef(oid) AS def
       FROM pg_constraint WHERE connamespace = 'public'::regnamespace ORDER BY 1, 2`,
    );
    const indices = await cliente.query(`SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY 1, 2`);
    const datos = await cliente.query(
      `SELECT (SELECT json_agg(p ORDER BY permiso) FROM (SELECT rol, permiso, permitido FROM permisos_rol) p) AS permisos,
              (SELECT json_agg(i) FROM (SELECT id, es_demo FROM instalacion) i) AS instalacion`,
    );
    return { columnas: columnas.rows, restricciones: restricciones.rows, indices: indices.rows, datos: datos.rows };
  }

  const tablas = async () =>
    (await cliente.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY 1")).rows.map((r) => r.tablename);

  beforeAll(async () => {
    cliente = new pg.Client({ connectionString: TEST_DB! });
    await cliente.connect();
  });
  afterAll(async () => {
    // Deja la base como la dejó el globalSetup: vacía y migrada.
    await vaciarEsquema(cliente);
    await aplicarMigraciones(cliente);
    await cliente.end();
  });

  it("la 001 crea las tablas de la Etapa 0 y queda registrada con su huella", async () => {
    expect(await tablas()).toEqual(["bitacora", "instalacion", "limites", "migraciones_aplicadas", "negocio", "permisos_rol", "sesiones", "usuarios"]);
    const reg = await cliente.query("SELECT version, nombre, length(huella) AS n FROM migraciones_aplicadas ORDER BY version");
    expect(reg.rows).toEqual([{ version: "001", nombre: "001_base.sql", n: 64 }]);
  });

  it("migrar dos veces una base vacía deja el mismo esquema", async () => {
    await vaciarEsquema(cliente);
    expect(await aplicarMigraciones(cliente)).toEqual(["001"]);
    const primera = await fotoDelEsquema();
    expect(await aplicarMigraciones(cliente)).toEqual([]);
    expect(await fotoDelEsquema()).toEqual(primera);

    // Y otra base vacía migrada desde cero queda idéntica a la primera.
    await vaciarEsquema(cliente);
    expect(await aplicarMigraciones(cliente)).toEqual(["001"]);
    expect(await fotoDelEsquema()).toEqual(primera);
  });

  it("dos ejecuciones simultáneas no chocan: una aplica y la otra no encuentra nada pendiente", async () => {
    await vaciarEsquema(cliente);
    const otros = [new pg.Client({ connectionString: TEST_DB! }), new pg.Client({ connectionString: TEST_DB! })];
    await Promise.all(otros.map((c) => c.connect()));
    try {
      const resultados = await Promise.all(otros.map((c) => aplicarMigraciones(c)));
      expect(resultados.map((r) => r.join(",")).sort()).toEqual(["", "001"]);
      const reg = await cliente.query("SELECT count(*)::int AS n FROM migraciones_aplicadas");
      expect(reg.rows[0].n).toBe(1);
      const filas = await cliente.query("SELECT count(*)::int AS n FROM permisos_rol");
      expect(filas.rows[0].n).toBe(19);
    } finally {
      await Promise.all(otros.map((c) => c.end()));
    }
  });

  describe("reglas del ejecutor (con una carpeta temporal)", () => {
    let carpeta: string;
    beforeAll(async () => {
      carpeta = await mkdtemp(path.join(os.tmpdir(), "crumble-migraciones-"));
      await cp(CARPETA_MIGRACIONES, carpeta, { recursive: true });
    });
    afterAll(async () => {
      await rm(carpeta, { recursive: true, force: true });
    });

    it("aplica las nuevas en orden y las registra", async () => {
      await writeFile(path.join(carpeta, "903_tres.sql"), "CREATE TABLE prueba_903 (id int);");
      await writeFile(path.join(carpeta, "902_dos.sql"), "CREATE TABLE prueba_902 (id int);");
      expect(await aplicarMigraciones(cliente, { carpeta })).toEqual(["902", "903"]);
      expect(await tablas()).toEqual(expect.arrayContaining(["prueba_902", "prueba_903"]));
    });

    it("editar una migración aplicada detiene el ejecutor (y no aplica nada más)", async () => {
      await writeFile(path.join(carpeta, "902_dos.sql"), "CREATE TABLE prueba_902 (id int, extra int);");
      await writeFile(path.join(carpeta, "905_despues.sql"), "CREATE TABLE prueba_905 (id int);");
      await expect(aplicarMigraciones(cliente, { carpeta })).rejects.toThrow(/902_dos\.sql ya estaba aplicada y su contenido cambió/);
      expect(await tablas()).not.toContain("prueba_905");
      await writeFile(path.join(carpeta, "902_dos.sql"), "CREATE TABLE prueba_902 (id int);");
      await rm(path.join(carpeta, "905_despues.sql"));
    });

    it("una migración que falla se revierte completa, no queda registrada y el error no trae el texto de Postgres", async () => {
      await writeFile(path.join(carpeta, "904_rota.sql"), "CREATE TABLE prueba_904 (id int); SELECT * FROM no_existe;");
      const error = await aplicarMigraciones(cliente, { carpeta }).catch((e: Error) => e);
      expect(String(error)).toMatch(/904_rota\.sql \(código de error: 42P01\)/);
      expect(String(error)).not.toMatch(/no_existe|relation/);
      expect(await tablas()).not.toContain("prueba_904");
      expect((await cliente.query("SELECT 1 FROM migraciones_aplicadas WHERE version = '904'")).rowCount).toBe(0);
      await rm(path.join(carpeta, "904_rota.sql"));
    });

    it("rechaza nombres inválidos y números repetidos", async () => {
      await writeFile(path.join(carpeta, "mal nombre.sql"), "SELECT 1;");
      await expect(aplicarMigraciones(cliente, { carpeta })).rejects.toThrow(/no válido/);
      await rm(path.join(carpeta, "mal nombre.sql"));
      await writeFile(path.join(carpeta, "902_otra.sql"), "SELECT 1;");
      await expect(aplicarMigraciones(cliente, { carpeta })).rejects.toThrow(/mismo número/);
      await rm(path.join(carpeta, "902_otra.sql"));
    });

    it("el candado se suelta aunque el ejecutor falle", async () => {
      const otro = new pg.Client({ connectionString: TEST_DB! });
      await otro.connect();
      try {
        const r = await otro.query("SELECT pg_try_advisory_lock(7420101) AS libre");
        expect(r.rows[0].libre).toBe(true);
        await otro.query("SELECT pg_advisory_unlock(7420101)");
      } finally {
        await otro.end();
      }
    });
  });

  it("el CLI migra una base local y la segunda vez dice que está al día", async () => {
    await vaciarEsquema(cliente);
    const correr = () => spawnSync(process.execPath, ["scripts/migrate.mjs"], { env: entornoMinimo({ DATABASE_URL: TEST_DB! }), encoding: "utf8" });
    const primera = correr();
    expect(primera.status).toBe(0);
    expect(primera.stdout).toContain("Aplicada 001_base.sql");
    expect(primera.stdout).toContain("Listo: 1 migración(es) aplicada(s).");
    const segunda = correr();
    expect(segunda.status).toBe(0);
    expect(segunda.stdout).toContain("Nada que migrar");
  });
});
