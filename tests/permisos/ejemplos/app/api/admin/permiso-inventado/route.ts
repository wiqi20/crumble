// Mal: el permiso no está en el catálogo (rutaAdmin lanza al cargar el módulo).
import { rutaAdmin } from "@/server/http/ruta-admin";

export const GET = rutaAdmin("permiso.inventado" as never, async () => Response.json({ ok: true }));
