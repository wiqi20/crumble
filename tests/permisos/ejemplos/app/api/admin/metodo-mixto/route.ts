// Mal a medias: GET declara permiso, DELETE no.
import { rutaAdmin } from "@/server/http/ruta-admin";

export const GET = rutaAdmin("inventario.ver", async () => Response.json({ ok: true }));

export async function DELETE() {
  return new Response(null, { status: 204 });
}
