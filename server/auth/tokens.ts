// Tokens de sesión (5.4): la cookie lleva un token aleatorio y la base guarda solo su resumen.
// Lo usan las ayudas de pruebas desde E0-6; B2 lo usa para crear y leer sesiones.
import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Token nuevo: 32 bytes aleatorios en base64url (43 caracteres). */
export function nuevoToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Resumen que se guarda en sesiones.token_hash: sha256 en hexadecimal (64 caracteres). */
export function resumenDeToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}
