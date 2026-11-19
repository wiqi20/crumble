// Comprobaciones al arrancar el servidor Node (las llama instrumentation.ts). E0-2: si la
// configuración no es válida, el servicio NO arranca y dice qué variable falla, nunca su valor.
import { ErrorDeConfiguracion, obtenerConfig } from "@/server/config";

export function comprobarAlArrancar(): void {
  try {
    obtenerConfig();
  } catch (error) {
    console.error(error instanceof ErrorDeConfiguracion ? error.message : "La configuración de Crumble no es válida.");
    process.exit(1);
  }
}
