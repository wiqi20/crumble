// Toda ruta de /api que no existe responde 404 en JSON con el formato común (decisión del PM,
// 17 nov), en vez del 404 en HTML de la tienda. Las rutas que sí existen son más específicas y
// siempre ganan. No está bajo /api/admin, así que el registro de rutas del panel no la revisa;
// no lee sesión ni datos.
import { MENSAJES, respuestaError } from "@/server/http/errores";

export const dynamic = "force-dynamic";

const noEncontrado = () => respuestaError(404, "no-encontrado", MENSAJES["no-encontrado"]);

export const GET = noEncontrado;
export const HEAD = noEncontrado;
export const POST = noEncontrado;
export const PUT = noEncontrado;
export const PATCH = noEncontrado;
export const DELETE = noEncontrado;
export const OPTIONS = noEncontrado;
