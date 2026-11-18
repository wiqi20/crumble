// Decisión del PM (17 nov): toda ruta de /api que no existe responde 404 JSON con el formato común.
import { describe, expect, it } from "vitest";
import * as ruta from "@/app/api/[...resto]/route";

describe("app/api/[...resto]", () => {
  it.each(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"] as const)("%s → 404 no-encontrado, sin caché", async (metodo) => {
    const r = ruta[metodo]();
    expect(r.status).toBe(404);
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect(await r.json()).toEqual({ error: "no-encontrado", mensaje: "No encontramos lo que buscas." });
  });
});
