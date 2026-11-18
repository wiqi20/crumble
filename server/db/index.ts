// Acceso a Postgres (E0-3): grupo de conexiones, consultas parametrizadas, transacciones con
// SET LOCAL y candados. Sin ORM (diseño técnico 11.1). Nunca se arma SQL concatenando texto.
import "server-only";
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { obtenerConfig } from "@/server/config";
import { registrar } from "@/server/http/registro";

declare global {
  var __crumblePool: Pool | undefined;
}

/**
 * Grupo único del proceso (guardado en globalThis para que la recarga de `next dev` no abra otro).
 * SSL: en Railway la base va por la red privada y no lo usa; si una base lo exige, se pide en la
 * propia DATABASE_URL con `?sslmode=require` (pg lo entiende), sin variables nuevas (5.7).
 */
function grupo(): Pool {
  if (!globalThis.__crumblePool) {
    const pool = new Pool({
      connectionString: obtenerConfig().databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      // Tiempos máximos: una base lenta no deja colgada la petición.
      connectionTimeoutMillis: 5_000,
      statement_timeout: 15_000,
      application_name: "crumble",
    });
    // Un error en una conexión inactiva (p. ej. la base se reinicia) no debe tumbar el proceso.
    pool.on("error", (error: Error & { code?: string }) => {
      registrar("error", "db-conexion-inactiva", { codigo: error.code ?? "desconocido" });
    });
    globalThis.__crumblePool = pool;
  }
  return globalThis.__crumblePool;
}

export type Consulta = <R extends QueryResultRow = QueryResultRow>(texto: string, parametros?: unknown[]) => Promise<R[]>;

/** Consulta fuera de transacción. Devuelve las filas. */
export const consulta: Consulta = async (texto, parametros = []) => (await grupo().query(texto, parametros)).rows;

/** Nombre de ajuste aceptado por SET LOCAL: `statement_timeout` o `crumble.usuario_id`. */
const NOMBRE_AJUSTE = /^[a-z_][a-z0-9_]*(\.[a-z_][a-z0-9_]*)?$/;

export type Transaccion = {
  consulta: Consulta;
  /** Candado de Postgres que dura hasta el final de la transacción (pg_advisory_xact_lock). */
  candado: (clave: number) => Promise<void>;
};

export type OpcionesTransaccion = {
  /**
   * Ajustes que valen solo dentro de esta transacción (equivalente a SET LOCAL), por ejemplo
   * `{ "crumble.usuario_id": "5", lock_timeout: "5s" }`. Se aplican con set_config(..., true),
   * que acepta parámetros: el valor nunca se concatena al SQL.
   */
  ajustes?: Record<string, string>;
};

/** Ejecuta varias consultas juntas: o se guardan todas o ninguna. */
export async function transaccion<T>(trabajo: (tx: Transaccion) => Promise<T>, opciones: OpcionesTransaccion = {}): Promise<T> {
  const cliente: PoolClient = await grupo().connect();
  let liberarConError: Error | undefined;
  try {
    await cliente.query("BEGIN");
    for (const [nombre, valor] of Object.entries(opciones.ajustes ?? {})) {
      if (!NOMBRE_AJUSTE.test(nombre)) throw new Error("Nombre de ajuste no permitido en la transacción.");
      await cliente.query("SELECT set_config($1, $2, true)", [nombre, valor]);
    }
    const tx: Transaccion = {
      consulta: async (texto, parametros = []) => (await cliente.query(texto, parametros)).rows,
      candado: async (clave) => {
        await cliente.query("SELECT pg_advisory_xact_lock($1)", [clave]);
      },
    };
    const resultado = await trabajo(tx);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    try {
      await cliente.query("ROLLBACK");
    } catch (errorRollback) {
      // Si ni siquiera se pudo revertir, la conexión se descarta en vez de volver al grupo.
      liberarConError = errorRollback as Error;
    }
    throw error;
  } finally {
    cliente.release(liberarConError);
  }
}

/** Comprueba que la base responde (SELECT 1) en menos de `tiempoMs`. Lanza si no. */
export async function ping(tiempoMs = 2_000): Promise<void> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error("tiempo agotado")), tiempoMs);
  });
  try {
    await Promise.race([grupo().query("SELECT 1"), limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

/** Cierra el grupo (apagado ordenado y pruebas). */
export async function cerrarGrupo(): Promise<void> {
  const pool = globalThis.__crumblePool;
  globalThis.__crumblePool = undefined;
  await pool?.end();
}
