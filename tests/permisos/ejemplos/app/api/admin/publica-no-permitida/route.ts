// Mal: pública fuera de la lista de rutas de inicio de sesión.
import { rutaAdmin } from "@/server/http/ruta-admin";

export const GET = rutaAdmin("publica", async () => Response.json({ ok: true }));
