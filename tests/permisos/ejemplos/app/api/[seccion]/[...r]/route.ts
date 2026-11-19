// Mal (caso M3 de Seguridad): ruta dinámica que también atiende /api/admin/<cualquier cosa>.
export async function GET() {
  return Response.json({ datos: "esto no debería servirse" });
}
