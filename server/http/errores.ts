// Formato de error común de la API (E0-4, diseño técnico sección 4, "Convenciones"):
//   { "error": "codigo-corto", "mensaje": "Texto en español." }   (+ "campos" en datos-invalidos)
// Siempre con Cache-Control: no-store y sin trazas, consultas ni rutas internas.
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { registrar } from "@/server/http/registro";

// Los mensajes de validación de zod salen en español (van al campo "campos" de datos-invalidos).
z.config(z.locales.es());

/** Cabecera con el id de la petición. proxy.ts la pone en cada petición (y la respuesta la devuelve). */
export const CABECERA_ID_PETICION = "x-id-peticion";
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Id de la petición que puso proxy.ts; si no viene (pruebas) o no tiene forma de UUID, uno nuevo. */
export function idDePeticion(peticion: Request): string {
  const id = peticion.headers.get(CABECERA_ID_PETICION);
  return id && ES_UUID.test(id) ? id : randomUUID();
}

/** Textos de los códigos comunes de la sección 4. Cada ruta puede usar mensajes propios. */
export const MENSAJES = {
  "datos-invalidos": "Los datos enviados no son válidos. Revisa los campos marcados.",
  "sin-sesion": "Tu sesión no está iniciada o ya venció. Vuelve a entrar.",
  "sin-permiso": "No tienes permiso para hacer esto.",
  "no-disponible-en-demo": "Esto no está disponible en la demostración.",
  "origen-no-permitido": "La petición no viene del panel.",
  "no-encontrado": "No encontramos lo que buscas.",
  conflicto: "Los datos cambiaron mientras trabajabas. Recarga e intenta de nuevo.",
  "archivo-muy-grande": "El archivo es demasiado grande.",
  "tipo-no-permitido": "Ese tipo de archivo no está permitido.",
  "archivo-ilegible": "No pudimos leer el archivo.",
  "demasiadas-peticiones": "Hiciste demasiados intentos. Espera un momento e intenta de nuevo.",
  "servicio-no-disponible": "El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.",
  "error-interno": "Ocurrió un error inesperado. Intenta de nuevo en unos minutos.",
} as const;

export type CodigoComun = keyof typeof MENSAJES;

const ESTADO_DE: Record<CodigoComun, number> = {
  "datos-invalidos": 400,
  "sin-sesion": 401,
  "sin-permiso": 403,
  "no-disponible-en-demo": 403,
  "origen-no-permitido": 403,
  "no-encontrado": 404,
  conflicto: 409,
  "archivo-muy-grande": 413,
  "tipo-no-permitido": 415,
  "archivo-ilegible": 422,
  "demasiadas-peticiones": 429,
  "servicio-no-disponible": 503,
  "error-interno": 500,
};

export type CamposInvalidos = Record<string, string>;

type Extra = { campos?: CamposInvalidos; cabeceras?: Record<string, string> };

/** Error que una ruta o un servicio lanza para responder algo previsto (4xx o 503). */
export class ErrorApi extends Error {
  constructor(
    public readonly estado: number,
    public readonly codigo: string,
    public readonly mensajeUsuario: string,
    public readonly extra: Extra = {},
  ) {
    super(codigo);
    this.name = "ErrorApi";
  }
}

/** Atajo para los códigos comunes: `throw errorComun("sin-permiso")`. */
export function errorComun(codigo: CodigoComun, extra: Extra & { mensaje?: string } = {}): ErrorApi {
  return new ErrorApi(ESTADO_DE[codigo], codigo, extra.mensaje ?? MENSAJES[codigo], extra);
}

/** Respuesta de error con el formato común. */
export function respuestaError(
  estado: number,
  codigo: string,
  mensaje: string,
  opciones: Extra & { idPeticion?: string } = {},
): Response {
  const cabeceras = new Headers(opciones.cabeceras);
  cabeceras.set("Cache-Control", "no-store");
  if (opciones.idPeticion) cabeceras.set("X-Id-Peticion", opciones.idPeticion);
  const cuerpo: { error: string; mensaje: string; campos?: CamposInvalidos } = { error: codigo, mensaje };
  if (opciones.campos) cuerpo.campos = opciones.campos;
  return Response.json(cuerpo, { status: estado, headers: cabeceras });
}

/** Convierte un error de zod en 400 datos-invalidos con `campos` (ruta del campo → mensaje). */
export function errorDeValidacion(error: z.ZodError): ErrorApi {
  const campos: CamposInvalidos = {};
  for (const issue of error.issues) {
    const ruta = issue.path.map(String).join(".") || "(cuerpo)";
    campos[ruta] ??= issue.message;
  }
  return errorComun("datos-invalidos", { campos });
}

/** Lee el cuerpo JSON y lo valida con el esquema. Cuerpo ilegible o inválido: 400 datos-invalidos. */
export async function leerCuerpo<T extends z.ZodType>(peticion: Request, esquema: T): Promise<z.infer<T>> {
  let datos: unknown;
  try {
    datos = await peticion.json();
  } catch {
    throw errorComun("datos-invalidos", { mensaje: "El cuerpo de la petición no es JSON válido." });
  }
  const r = esquema.safeParse(datos);
  if (!r.success) throw errorDeValidacion(r.error);
  return r.data;
}

/** Ruta sin consulta (los parámetros de la URL pueden traer datos personales o tokens). */
function rutaSinConsulta(peticion: Request): string {
  try {
    return new URL(peticion.url).pathname;
  } catch {
    return "(desconocida)";
  }
}

/** Convierte cualquier error en una respuesta con el formato común. Nunca expone el error original. */
export function respuestaDesdeError(error: unknown, peticion: Request, idPeticion: string): Response {
  if (error instanceof ErrorApi) {
    return respuestaError(error.estado, error.codigo, error.mensajeUsuario, { ...error.extra, idPeticion });
  }
  if (error instanceof z.ZodError) {
    const e = errorDeValidacion(error);
    return respuestaError(e.estado, e.codigo, e.mensajeUsuario, { ...e.extra, idPeticion });
  }
  // Error no controlado: al registro solo van datos técnicos (tipo y código), nunca el mensaje,
  // que puede traer valores, consultas o direcciones.
  const e = error as { name?: unknown; code?: unknown } | null;
  registrar("error", "error-no-controlado", {
    idPeticion,
    metodo: peticion.method,
    ruta: rutaSinConsulta(peticion),
    tipo: typeof e?.name === "string" ? e.name : typeof error,
    codigo: typeof e?.code === "string" ? e.code : undefined,
  });
  return respuestaError(500, "error-interno", MENSAJES["error-interno"], { idPeticion });
}

/**
 * Envuelve un manejador de ruta: cualquier error se convierte en la respuesta común (ErrorApi →
 * su código; zod → 400; lo demás → 500 en español, sin traza, y queda en el registro).
 */
export function conManejoDeErrores<C>(
  manejador: (peticion: Request, contexto: C) => Promise<Response> | Response,
): (peticion: Request, contexto: C) => Promise<Response> {
  return async (peticion, contexto) => {
    try {
      return await manejador(peticion, contexto);
    } catch (error) {
      return respuestaDesdeError(error, peticion, idDePeticion(peticion));
    }
  };
}
