// Bien: descarga del panel con permiso declarado.
import { rutaAdmin } from "@/server/http/ruta-admin";

export const GET = rutaAdmin("pedidos.ver", async () => new Response("archivo"));
