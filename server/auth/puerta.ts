// Puerta única del panel (diseño técnico 5.4): recibe el permiso que exige la ruta y devuelve el
// usuario o corta con 401 o 403.
//
// ETAPA 0: todavía no existen la sesión (B2) ni la lectura de permisos (B3), así que la puerta
// FALLA CERRADA: toda ruta del panel que no sea pública responde 401 sin-sesion. B2 y B3
// reemplazan el cuerpo de requierePermiso sin cambiar su firma ni quién la llama.
import "server-only";
import type { Permiso } from "@/server/auth/permisos";
import { errorComun } from "@/server/http/errores";

export type UsuarioPanel = {
  id: number;
  nombre: string;
  rol: "propietaria" | "encargado";
  esDemo: boolean;
  permisos: ReadonlySet<Permiso>;
};

/**
 * Exige sesión válida y, si `permiso` no es null, ese permiso. Lanza ErrorApi 401 sin-sesion o
 * 403 sin-permiso (que conManejoDeErrores convierte en la respuesta común).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- la firma es la definitiva; B2 y B3 usan los parámetros.
export async function requierePermiso(peticion: Request, permiso: Permiso | null): Promise<UsuarioPanel> {
  throw errorComun("sin-sesion");
}
