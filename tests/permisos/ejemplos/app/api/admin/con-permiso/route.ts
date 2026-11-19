// Bien: cada método declara su acceso con rutaAdmin.
import { rutaAdmin } from "@/server/http/ruta-admin";

export const GET = rutaAdmin("pedidos.ver", async () => Response.json({ ok: true }));
export const POST = rutaAdmin("sesion", async () => Response.json({ ok: true }));
