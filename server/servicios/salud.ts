// Estado del servicio para GET /api/health (E0-4).
import "server-only";
import { ping } from "@/server/db";

// Un solo SELECT 1 a la vez y el último resultado se reutiliza 3 s: muchas llamadas seguidas a
// /api/health no agotan el grupo de conexiones que usan las peticiones reales (como en sticr.app).
const VIGENCIA_MS = 3_000;
const TIEMPO_MAXIMO_MS = 2_000;
let ultimo: { ok: boolean; hasta: number } | null = null;
let enCurso: Promise<boolean> | null = null;

/** ¿La base responde? Nunca lanza: cualquier fallo (incluida una configuración inválida) es false. */
export function baseResponde(): Promise<boolean> {
  if (ultimo && ultimo.hasta > Date.now()) return Promise.resolve(ultimo.ok);
  enCurso ??= Promise.resolve()
    .then(() => ping(TIEMPO_MAXIMO_MS))
    .then(
      () => true,
      () => false,
    )
    .then((ok) => {
      ultimo = { ok, hasta: Date.now() + VIGENCIA_MS };
      enCurso = null;
      return ok;
    });
  return enCurso;
}

/** Solo para pruebas: olvida el resultado guardado. */
export function reiniciarSalud(): void {
  ultimo = null;
  enCurso = null;
}
