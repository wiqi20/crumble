// Mal: una ruta del panel no puede ser pública.
import { rutaAdmin } from "@/server/http/ruta-admin";

export const GET = rutaAdmin("publica", async () => new Response("archivo"));
