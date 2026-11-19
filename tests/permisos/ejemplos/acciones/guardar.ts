// Mal (caso M3 de Seguridad): Server Action, un punto de entrada POST fuera de la API y sin puerta.
"use server";

export async function guardar() {
  return { ok: true };
}
