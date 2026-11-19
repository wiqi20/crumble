// Mal (caso M3 de Seguridad): route.ts junto a las páginas del panel, sin permiso. El panel lo
// sirve en crumble-admin…/exportar porque el proxy reescribe a /panel/exportar.
export async function GET() {
  return Response.json({ datos: "esto no debería servirse" });
}
