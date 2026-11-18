// Registros estructurados (E0-4): una línea JSON por evento, con id de petición y SIN datos
// personales, claves, cookies ni tokens (estándar de backend y seguridad 7; Ley 8968).
//
// Regla para quien registre algo: pasa solo datos técnicos (ruta sin consulta, método, estado,
// duración, códigos de error, ids internos). Por si alguien se equivoca, este módulo además:
// - omite cualquier campo cuyo nombre suene a dato personal o secreto;
// - omite cualquier texto que parezca un correo, un teléfono o un token largo;
// - recorta los textos largos.

import "server-only";

export type Nivel = "info" | "aviso" | "error";
export type ValorRegistro = string | number | boolean | null | undefined;
export type CamposRegistro = Record<string, ValorRegistro>;

const OMITIDO = "[omitido]";
const LARGO_MAXIMO = 200;

/** Nombres de campo que nunca se escriben (comparación sin mayúsculas). */
const CAMPO_PROHIBIDO =
  /cookie|authorization|autorizacion|token|secret|secreto|clave|password|contrasena|contraseña|correo|email|mail|telefono|teléfono|phone|celular|whatsapp|nombre|name|direccion|dirección|address|cedula|cédula|^ip$|ip_|_ip|ipaddr|cuerpo|body|consulta_sql|query/i;

const PARECE_CORREO = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PARECE_TELEFONO = /(\+?\d[\d\s-]{6,}\d)/;
const PARECE_TOKEN = /[A-Za-z0-9_-]{32,}/;
// Los ids de petición (UUID) sí se escriben: son nuestros y no identifican a nadie.
const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function limpiar(clave: string, valor: ValorRegistro): ValorRegistro {
  if (CAMPO_PROHIBIDO.test(clave)) return OMITIDO;
  if (typeof valor !== "string") return valor;
  if (ES_UUID.test(valor)) return valor;
  if (PARECE_CORREO.test(valor) || PARECE_TELEFONO.test(valor) || PARECE_TOKEN.test(valor)) return OMITIDO;
  return valor.length > LARGO_MAXIMO ? `${valor.slice(0, LARGO_MAXIMO)}…` : valor;
}

/** Limpia los campos de un registro (exportada para las pruebas). */
export function limpiarCampos(campos: CamposRegistro): CamposRegistro {
  const salida: CamposRegistro = {};
  for (const [clave, valor] of Object.entries(campos)) {
    if (valor === undefined) continue;
    salida[clave] = limpiar(clave, valor);
  }
  return salida;
}

/** Escribe un registro. `evento` es un código corto fijo (p. ej. "error-no-controlado"). */
export function registrar(nivel: Nivel, evento: string, campos: CamposRegistro = {}): void {
  const linea = JSON.stringify({ hora: new Date().toISOString(), nivel, evento, ...limpiarCampos(campos) });
  if (nivel === "error") console.error(linea);
  else if (nivel === "aviso") console.warn(linea);
  else console.log(linea);
}
