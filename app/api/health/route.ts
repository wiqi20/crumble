// Prueba de salud de la Etapa 0 (E0-1): responde sin tocar la base.
// Backend la amplía en E0-4 (consulta a Postgres; 503 { "estado": "error" } sin detalles si cae).
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
