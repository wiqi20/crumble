// Catálogo de permisos del panel (diseño técnico 5.4). Fuente única para el registro de rutas
// (E0-6), la puerta requierePermiso (B3) y el CHECK de permisos_rol en 001_base.sql (una prueba
// comprueba que coinciden).

/** Permisos que la propietaria puede marcar o desmarcar para el encargado, con su valor de fábrica. */
export const PERMISOS_DELEGABLES = {
  "pedidos.ver": true,
  "pedidos.gestionar": true,
  "pagos.registrar": true,
  "pagos.anular": false,
  "facturas.registrar": true,
  "facturas.anular": false,
  "catalogo.ver": true,
  "catalogo.editar": true,
  "opciones.disponibilidad": true,
  "negocio.editar": false,
  "inventario.ver": true,
  "inventario.mover": true,
  "articulos.editar": false,
  "recetas.ver": true,
  "recetas.editar": false,
  "compras.registrar": true,
  "compras.importar": true,
  "proveedores.editar": true,
  "produccion.registrar": true,
} as const satisfies Record<string, boolean>;

/**
 * Permisos solo de la propietaria: no aparecen en la tabla del encargado y ninguna ruta permite
 * concedérselos. Los ocho primeros tienen nombre en 5.4. `propietaria` cubre el resto de lo que
 * 5.4 deja solo a la propietaria sin nombrarlo (usuarios, permisos, bitácora, anonimizar,
 * volver un pedido cancelado a nuevo y la tarifa de IVA); B3 puede partirlo en nombres propios.
 */
export const PERMISOS_SOLO_PROPIETARIA = [
  "precios.editar",
  "costos.ver",
  "inventario.ajustar",
  "inventario.anular",
  "compras.anular",
  "portada.editar",
  "negocio.descuento_inventario",
  "saldos.administrar",
  "propietaria",
] as const;

export type PermisoDelegable = keyof typeof PERMISOS_DELEGABLES;
export type PermisoSoloPropietaria = (typeof PERMISOS_SOLO_PROPIETARIA)[number];
export type Permiso = PermisoDelegable | PermisoSoloPropietaria;

export const LISTA_DELEGABLES = Object.keys(PERMISOS_DELEGABLES) as PermisoDelegable[];
export const TODOS_LOS_PERMISOS: readonly Permiso[] = [...LISTA_DELEGABLES, ...PERMISOS_SOLO_PROPIETARIA];

export function esPermiso(valor: unknown): valor is Permiso {
  return typeof valor === "string" && (TODOS_LOS_PERMISOS as readonly string[]).includes(valor);
}

export function esDelegable(valor: unknown): valor is PermisoDelegable {
  return typeof valor === "string" && Object.hasOwn(PERMISOS_DELEGABLES, valor);
}
