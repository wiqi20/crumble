// Mal: no declara permiso. El revisor debe reportarlo.
export async function GET() {
  return Response.json({ secreto: "esto no debería servirse" });
}
