// Entorno de las pruebas: base de pruebas y variables de una instalación ficticia.
import { randomBytes } from "node:crypto";
import { describe } from "vitest";

/** URL de la base de pruebas, o null si no está configurada. */
export const TEST_DB = process.env.TEST_DATABASE_URL || null;

/** `describe` que se omite (y se ve como omitido) cuando no hay base de pruebas. */
export const describeDb = describe.skipIf(!TEST_DB);

/**
 * Variables válidas de una instalación ficticia. Los secretos se generan al azar en cada corrida:
 * no hay ningún valor fijo que pueda confundirse con uno real.
 */
export function entornoValido(cambios: Record<string, string | undefined> = {}): Record<string, string | undefined> {
  return {
    DATABASE_URL: TEST_DB ?? "postgresql://prueba@localhost:5432/crumble_test",
    URL_TIENDA: "https://tienda.prueba.local",
    URL_PANEL: "https://panel.prueba.local",
    GOOGLE_CLIENT_ID: "id-de-cliente-de-prueba",
    GOOGLE_CLIENT_SECRET: randomBytes(24).toString("hex"),
    SESSION_SECRET: randomBytes(32).toString("hex"),
    PROPIETARIA_EMAIL: "propietaria@prueba.local",
    IP_HASH_SALT: randomBytes(32).toString("hex"),
    RETENCION_PEDIDOS_MESES: "24",
    MODO_DEMO: "false",
    DEMO_RESET_MINUTOS: "",
    ESTADO_SERVICIO: "activo",
    SOPORTE_URL: "",
    SOPORTE_ORIGEN: "",
    SOPORTE_SECRETO: "",
    ...cambios,
  };
}

/**
 * Carga en process.env una instalación ficticia (con DATABASE_URL = base de pruebas) y olvida la
 * configuración y el grupo de conexiones anteriores. Llamar antes de usar server/config o server/db.
 */
export async function usarEntornoDePrueba(cambios: Record<string, string | undefined> = {}): Promise<void> {
  for (const [k, v] of Object.entries(entornoValido(cambios))) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const { reiniciarConfig } = await import("@/server/config");
  const { cerrarGrupo } = await import("@/server/db");
  reiniciarConfig();
  await cerrarGrupo();
}
