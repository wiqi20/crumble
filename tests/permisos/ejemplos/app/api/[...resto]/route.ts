// Bien: el 404 de la API está exceptuado, pero debe responder 404.
export const GET = () => Response.json({ error: "no-encontrado" }, { status: 404 });
export const POST = () => Response.json({ ok: true });
