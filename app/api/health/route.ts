// GET /api/health (E0-4; diseño técnico 4.1 y 11.4). Prueba de salud de Railway.
// 200 { "estado": "ok" } si la base responde; si no, 503 { "estado": "error", "error", "mensaje" }
// con el formato común y sin detalles. Pública y sin límite de intentos; proxy.ts la deja pasar
// con cualquier Host (la prueba de salud de Railway no usa las direcciones de la instalación).
import { conManejoDeErrores, MENSAJES } from "@/server/http/errores";
import { baseResponde } from "@/server/servicios/salud";

export const dynamic = "force-dynamic";

export const GET = conManejoDeErrores(async () => {
  if (await baseResponde()) {
    return Response.json({ estado: "ok" }, { headers: { "Cache-Control": "no-store" } });
  }
  return Response.json(
    { estado: "error", error: "servicio-no-disponible", mensaje: MENSAJES["servicio-no-disponible"] },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
});
