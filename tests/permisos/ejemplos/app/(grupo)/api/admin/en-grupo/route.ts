// Mal: dentro de un grupo de rutas también sirve /api/admin/en-grupo y no declara permiso.
export async function PUT() {
  return Response.json({ ok: true });
}
