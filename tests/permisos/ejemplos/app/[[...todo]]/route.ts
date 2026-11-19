// Mal: comodín opcional en la raíz; atiende /panel/... y /api/admin/....
export async function POST() {
  return Response.json({ ok: true });
}
