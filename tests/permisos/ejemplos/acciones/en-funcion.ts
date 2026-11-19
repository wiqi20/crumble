// Mal: la directiva también puede ir dentro de una función.
export function armar() {
  return async function accion() {
    "use server";
    return 1;
  };
}
