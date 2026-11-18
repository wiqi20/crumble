// Ejecutor de migraciones: marcador de la Etapa 0 (E0-1).
// Backend lo reemplaza en E0-3 por el ejecutor adaptado de scripts/migrate.mjs de sticr.app
// (transacción por archivo, candado de Postgres, huella que impide editar una migración aplicada).
// Mientras tanto no se conecta a ninguna base y termina sin error, para que `npm run migrate`
// pueda usarse ya como comando previo al despliegue.
console.log("[migrate] Aún no hay ejecutor de migraciones (llega en E0-3). No se aplicó nada.");
