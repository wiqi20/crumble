// Migraciones versionadas de Crumble (E0-3). Uso: DATABASE_URL=... npm run migrate
// Adaptado de scripts/migrate.mjs de sticr.app (diseño técnico 11.1):
//
// - Aplica en orden los archivos migrations/NNN_nombre.sql que todavía no estén en migraciones_aplicadas.
// - Cada migración corre en su propia transacción: o se aplica completa o no se aplica.
// - Un candado de Postgres evita que dos ejecuciones (dos despliegues) migren a la vez: la segunda
//   espera a la primera y luego no encuentra nada pendiente.
// - Guarda la huella (sha256) de cada archivo; si una migración ya aplicada se edita, se detiene:
//   el cambio va en una migración nueva.
// - Nunca imprime la dirección completa de la base ni el texto crudo de los errores de Postgres.
// - Si el destino no es la propia máquina, pide confirmación (o `--si` en el comando previo al
//   despliegue de Railway: `npm run migrate -- --si`).
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

export const CARPETA_MIGRACIONES = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "migrations");
/** Número fijo del candado de migraciones de Crumble (distinto del de sticr.app). */
export const CANDADO_MIGRACIONES = 7_420_101;

/** Error con texto seguro para mostrar: nunca incluye el mensaje crudo de Postgres. */
export class ErrorDeMigracion extends Error {}

/** ¿A dónde apunta la dirección? Sin usuario ni clave. Local = la propia máquina. */
export function destinoDeUrl(url) {
  const u = new URL(url);
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const base = decodeURIComponent(u.pathname.replace(/^\//, ""));
  return {
    host: host || "(socket local)",
    puerto: u.port || "5432",
    base,
    local: ["", "localhost", "127.0.0.1", "::1"].includes(host) && !u.searchParams.has("host") && !u.searchParams.has("hostaddr"),
  };
}

const NOMBRE_VALIDO = /^(\d{3,})_[a-z0-9_]+\.sql$/;

/**
 * Aplica las migraciones pendientes con un cliente de pg ya conectado.
 * Devuelve las versiones aplicadas en esta ejecución (vacío si la base ya estaba al día).
 */
export async function aplicarMigraciones(cliente, { carpeta = CARPETA_MIGRACIONES, log = () => {} } = {}) {
  const archivos = (await readdir(carpeta)).filter((f) => f.endsWith(".sql")).sort();
  const malo = archivos.find((f) => !NOMBRE_VALIDO.test(f));
  if (malo) throw new ErrorDeMigracion(`Nombre de migración no válido: ${malo} (usa 001_descripcion.sql, en minúsculas).`);
  const versiones = archivos.map((f) => f.slice(0, f.indexOf("_")));
  if (new Set(versiones).size !== versiones.length) throw new ErrorDeMigracion("Hay dos migraciones con el mismo número.");

  await cliente.query("SELECT pg_advisory_lock($1)", [CANDADO_MIGRACIONES]);
  const aplicadas = [];
  try {
    await cliente.query(`CREATE TABLE IF NOT EXISTS migraciones_aplicadas (
      version    text PRIMARY KEY,
      nombre     text NOT NULL,
      huella     text NOT NULL CHECK (huella ~ '^[0-9a-f]{64}$'),
      aplicada_en timestamptz NOT NULL DEFAULT now()
    )`);
    const hechas = new Map(
      (await cliente.query("SELECT version, huella FROM migraciones_aplicadas")).rows.map((r) => [r.version, r.huella]),
    );

    for (const archivo of archivos) {
      const version = archivo.slice(0, archivo.indexOf("_"));
      const sql = await readFile(path.join(carpeta, archivo), "utf8");
      const huella = createHash("sha256").update(sql).digest("hex");
      if (hechas.has(version)) {
        if (hechas.get(version) !== huella) {
          throw new ErrorDeMigracion(`La migración ${archivo} ya estaba aplicada y su contenido cambió. No la edites: crea una nueva.`);
        }
        continue;
      }
      try {
        await cliente.query("BEGIN");
        await cliente.query(sql);
        await cliente.query("INSERT INTO migraciones_aplicadas (version, nombre, huella) VALUES ($1, $2, $3)", [version, archivo, huella]);
        await cliente.query("COMMIT");
      } catch (error) {
        await cliente.query("ROLLBACK").catch(() => {});
        throw new ErrorDeMigracion(
          `Falló la migración ${archivo} (código de error: ${error?.code ?? "desconocido"}). Se revirtió completa; revisa el registro de Postgres.`,
        );
      }
      aplicadas.push(version);
      log(`Aplicada ${archivo}`);
    }
  } finally {
    await cliente.query("SELECT pg_advisory_unlock($1)", [CANDADO_MIGRACIONES]).catch(() => {});
  }
  return aplicadas;
}

async function confirmar(destino) {
  if (process.argv.includes("--si")) return true;
  if (!process.stdin.isTTY) return false;
  const rl = (await import("node:readline/promises")).createInterface({ input: process.stdin, output: process.stdout });
  const respuesta = await rl.question(`El destino NO es local. Escribe el nombre de la base (${destino.base}) para continuar: `);
  rl.close();
  return respuesta.trim() === destino.base;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("Falta DATABASE_URL (la base de datos a migrar).");
    process.exit(1);
  }
  let destino;
  try {
    destino = destinoDeUrl(url);
  } catch {
    console.error("DATABASE_URL no es una dirección válida.");
    process.exit(1);
  }
  // Se muestra a dónde apunta (sin usuario ni clave) antes de tocar nada.
  console.log(`Destino: host ${destino.host}, puerto ${destino.puerto}, base ${destino.base} (${destino.local ? "local" : "REMOTO"})`);
  if (!destino.local && !(await confirmar(destino))) {
    console.error("Cancelado: el destino no es local. Confirma escribiendo el nombre de la base, o usa --si en el comando de despliegue.");
    process.exit(1);
  }
  // SSL: igual que server/db (se pide en la propia DATABASE_URL con ?sslmode=require si hace falta).
  const cliente = new pg.Client({ connectionString: url, connectionTimeoutMillis: 10_000, application_name: "crumble-migraciones" });
  try {
    await cliente.connect();
    const aplicadas = await aplicarMigraciones(cliente, { log: console.log });
    console.log(aplicadas.length ? `Listo: ${aplicadas.length} migración(es) aplicada(s).` : "Nada que migrar: la base ya está al día.");
  } catch (error) {
    // Nunca se imprime el texto crudo de Postgres (puede traer nombres, valores o rutas).
    console.error(error instanceof ErrorDeMigracion ? error.message : `No se pudo migrar (código de error: ${error?.code ?? "desconocido"}).`);
    process.exitCode = 1;
  } finally {
    await cliente.end().catch(() => {});
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
