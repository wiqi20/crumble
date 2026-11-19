// Mal: pega la marca de rutaAdmin a mano sin pasar por la puerta; sin sesión responde 200.
import { ACCESO_DECLARADO } from "@/server/http/ruta-admin";

export const GET = Object.assign(async () => Response.json({ ok: true }), { [ACCESO_DECLARADO]: "pedidos.ver" });
