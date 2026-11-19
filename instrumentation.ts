// Arranque del servidor (guía 03-api-reference/03-file-conventions/instrumentation.md): register()
// corre una vez antes de atender peticiones. Lo de Node va en server/arranque.ts, que solo se
// carga en el runtime de Node.
// E0-2: valida la configuración; si falta algo, el servicio no arranca. Las tareas programadas
// (11.1) se arrancarán aquí en etapas siguientes.
export async function register() {
  // `next build` no necesita las variables de la instalación (el CI compila sin ellas).
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { comprobarAlArrancar } = await import("./server/arranque");
    comprobarAlArrancar();
  }
}
