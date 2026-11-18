// Fuera de /api/admin: el registro no la revisa.
export async function GET() {
  return Response.json({ ok: true });
}
