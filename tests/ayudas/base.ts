// Prepara la base de pruebas una vez antes de todas las pruebas (globalSetup de Vitest): la deja
// vacía y le aplica las migraciones. Adaptado de sticr.app.
// Solo acepta bases LOCALES cuyo nombre termine en "_test": las pruebas borran y recrean el
// esquema `public`. Nunca se usa con datos reales.
import pg from "pg";
import { aplicarMigraciones } from "../../scripts/migrate.mjs";

/**
 * Guarda de la base de pruebas. Exige TODO esto: protocolo postgres, host local (localhost,
 * 127.0.0.1, ::1 o sin host), sin parámetros host/hostaddr/service/dbname que redirijan la
 * conexión, nombre de base que termine en "_test" y que no sea la DATABASE_URL.
 */
export function esBaseLocalDePrueba(url: string, databaseUrl: string | undefined = process.env.DATABASE_URL): boolean {
  try {
    if (databaseUrl && url.trim() === databaseUrl.trim()) return false;
    const u = new URL(url);
    if (!["postgres:", "postgresql:"].includes(u.protocol)) return false;
    for (const prohibido of ["host", "hostaddr", "service", "dbname"]) if (u.searchParams.has(prohibido)) return false;
    const host = u.hostname.replace(/^\[|\]$/g, "");
    if (!["", "localhost", "127.0.0.1", "::1"].includes(host)) return false;
    const base = decodeURIComponent(u.pathname.replace(/^\//, ""));
    return /^[a-z0-9_]*_test$/i.test(base);
  } catch {
    return false;
  }
}

/** Deja el esquema `public` vacío (solo en la base de pruebas ya validada). */
export async function vaciarEsquema(cliente: pg.Client): Promise<void> {
  await cliente.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
}

export default async function preparar() {
  const url = process.env.TEST_DATABASE_URL || undefined;
  if (!url) {
    if (process.env.CI) throw new Error("En CI, TEST_DATABASE_URL es obligatoria: las pruebas con Postgres no se pueden omitir.");
    console.warn("\n[pruebas] TEST_DATABASE_URL no está definida: se omiten las pruebas que usan Postgres (ver README).\n");
    return;
  }
  if (!esBaseLocalDePrueba(url)) {
    throw new Error("TEST_DATABASE_URL debe apuntar a una base LOCAL cuyo nombre termine en '_test' y no sea DATABASE_URL. Se rechaza por seguridad.");
  }
  const cliente = new pg.Client({ connectionString: url });
  await cliente.connect();
  try {
    await vaciarEsquema(cliente);
    await aplicarMigraciones(cliente);
  } finally {
    await cliente.end();
  }
}
