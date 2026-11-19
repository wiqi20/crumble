// Bien: el inicio de sesión es público y está en RUTAS_ADMIN_PUBLICAS.
import { rutaAdmin } from "@/server/http/ruta-admin";

export const GET = rutaAdmin("publica", async () => new Response(null, { status: 204 }));
