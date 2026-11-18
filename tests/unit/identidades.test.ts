import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

// Comprobaciones de la Etapa 0 (E0-7): las dos identidades no se mezclan, los tokens aprobados están
// y el manifiesto apunta a los íconos del favicon de Crumble.

const raiz = path.resolve(import.meta.dirname, "../..");
const leer = (ruta: string) => readFileSync(path.join(raiz, ruta), "utf8");

describe("identidades de la tienda y del panel", () => {
  const tienda = leer("styles/tienda.css");
  const panel = leer("styles/panel.css");

  it("la tienda tiene los tokens de Crumble y ninguno de STI", () => {
    for (const token of [
      "--color-blanco: #ffffff",
      "--color-tinta: #1b1717",
      "--color-tinta-suave: #5f5757",
      "--color-rosa: #f8dcdd",
      "--color-rosa-claro: #fdf4f4",
      "--color-linea: #e9e3e3",
      "--color-linea-fuerte: #8a8181",
      "--color-error: #a12b2b",
      "--color-error-fondo: #fbeded",
      "--color-exito: #2c6a4b",
      "--radius-campo: 6px",
      "--radius-tarjeta: 14px",
      '"Marcellus"',
      '"Jost Variable"',
    ]) {
      expect(tienda).toContain(token);
    }
    expect(tienda).not.toMatch(/coastal-teal|deep-ink|Onest|JetBrains/);
  });

  it("el panel tiene el sistema de STI, con --surface-error, y ninguno de Crumble", () => {
    for (const token of [
      "--color-deep-ink: #0a090c",
      "--color-bone-white: #e6e6e5",
      "--color-coastal-teal: #96beca",
      "--color-iris: #7561b1",
      "--color-dust: #d1d5db",
      "--color-error: #a63232",
      "--color-surface-error: #f8eaea",
      "--surface-error:",
      "--radius-md: 5px",
      "--radius-lg: 8px",
      '"Onest"',
      '"JetBrains Mono"',
    ]) {
      expect(panel).toContain(token);
    }
    expect(panel).not.toMatch(/--color-tinta|--color-rosa|Marcellus|Jost/);
  });

  it("cada identidad tiene un respaldo propio para el signo ₡", () => {
    expect(tienda).toMatch(/font-family: "Colon League Spartan";[\s\S]*unicode-range: U\+20A1;/);
    expect(panel).toMatch(/font-family: "Colon Inter";[\s\S]*unicode-range: U\+20A1;/);
    expect(panel).toMatch(/font-family: "Colon Noto Sans Mono";[\s\S]*unicode-range: U\+20A1;/);
  });

  it("ninguna hoja de estilos pide fuentes a servidores externos", () => {
    for (const hoja of [tienda, panel]) {
      expect(hoja).not.toMatch(/url\(\s*["']?https?:/);
      expect(hoja).not.toMatch(/fonts\.googleapis|fonts\.gstatic/);
    }
  });
});

describe("manifiesto", () => {
  it("usa los íconos de 192 y 512 px del favicon de Crumble", () => {
    const datos = manifest();
    expect(datos.lang).toBe("es");
    expect(datos.icons).toEqual([
      { src: "/iconos/icono-192.png", sizes: "192x192", type: "image/png" },
      { src: "/iconos/icono-512.png", sizes: "512x512", type: "image/png" },
    ]);
  });
});
