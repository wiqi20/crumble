// Ayudas para crear datos de prueba en la base de pruebas (E0-6): usuarios y sesiones.
// Crean sus propios datos con correos únicos; cada prueba limpia lo suyo con `limpiarUsuarios`.
import { randomUUID } from "node:crypto";
import { consulta } from "@/server/db";
import { nuevoToken, resumenDeToken } from "@/server/auth/tokens";

export type UsuarioDePrueba = { id: number; correo: string; nombre: string; rol: "propietaria" | "encargado"; activo: boolean };

/** Crea un usuario del panel. Por omisión, encargado activo con un correo único de prueba. */
export async function crearUsuario(datos: Partial<Omit<UsuarioDePrueba, "id">> = {}): Promise<UsuarioDePrueba> {
  const correo = datos.correo ?? `usuario-${randomUUID()}@prueba.local`;
  const [fila] = await consulta<{ id: string }>(
    "INSERT INTO usuarios (correo, nombre, rol, activo) VALUES ($1, $2, $3, $4) RETURNING id",
    [correo, datos.nombre ?? "Usuario de prueba", datos.rol ?? "encargado", datos.activo ?? true],
  );
  return { id: Number(fila.id), correo, nombre: datos.nombre ?? "Usuario de prueba", rol: datos.rol ?? "encargado", activo: datos.activo ?? true };
}

export type SesionDePrueba = { id: number; token: string; usuarioId: number };

/**
 * Crea una sesión para el usuario y devuelve el token en claro (el que iría en la cookie). En la
 * base solo queda su resumen. `venceEnHoras` negativo crea una sesión ya vencida; `revocada`, una
 * sesión revocada.
 */
export async function crearSesion(usuarioId: number, opciones: { venceEnHoras?: number; revocada?: boolean } = {}): Promise<SesionDePrueba> {
  const token = nuevoToken();
  const horas = opciones.venceEnHoras ?? 12;
  // Una sesión vencida se crea "en el pasado" para respetar el CHECK vence_en > creado_en.
  const [fila] = await consulta<{ id: string }>(
    `INSERT INTO sesiones (usuario_id, token_hash, creado_en, vence_en, revocada_en)
     VALUES ($1, $2, CASE WHEN $3::double precision > 0 THEN now() ELSE now() - interval '1 day' END,
             now() + make_interval(secs => $3::double precision), CASE WHEN $4 THEN now() END)
     RETURNING id`,
    [usuarioId, resumenDeToken(token), horas * 3600, opciones.revocada ?? false],
  );
  return { id: Number(fila.id), token, usuarioId };
}

/** Borra los usuarios de prueba (y sus sesiones, en cascada) cuyo correo termina en @prueba.local. */
export async function limpiarUsuarios(): Promise<void> {
  await consulta("DELETE FROM bitacora WHERE usuario_id IN (SELECT id FROM usuarios WHERE correo LIKE '%@prueba.local')");
  await consulta("UPDATE permisos_rol SET actualizado_por = NULL WHERE actualizado_por IN (SELECT id FROM usuarios WHERE correo LIKE '%@prueba.local')");
  await consulta("DELETE FROM usuarios WHERE correo LIKE '%@prueba.local'");
}
