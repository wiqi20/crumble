# Respaldo del signo del colón (₡)

Ninguna de las cuatro fuentes del proyecto trae el signo del colón (₡, U+20A1). Se comprobó en los archivos
de `@fontsource` instalados, leyendo su tabla de caracteres con fontTools:

| Fuente | Paquete | ¿Trae ₡? |
| --- | --- | --- |
| Jost (texto de la tienda) | `@fontsource-variable/jost` 5.3.0 | No |
| Marcellus (títulos de la tienda) | `@fontsource/marcellus` 5.3.0 | No |
| Onest (texto del panel) | `@fontsource/onest` 5.3.1 | No |
| JetBrains Mono (cifras del panel) | `@fontsource/jetbrains-mono` 5.3.0 | No |

Sin respaldo, cada navegador dibujaría el ₡ con la fuente del sistema que encuentre, distinta en cada
equipo. Por eso cada identidad declara una fuente de respaldo que contiene **solo ese carácter**:

| Archivo | Sale de | Licencia | Se usa en |
| --- | --- | --- | --- |
| `colon-league-spartan.woff2` | League Spartan variable (`@fontsource-variable/league-spartan` 5.3.0), geométrica como Jost | SIL OFL 1.1, `OFL-league-spartan.txt` | Tienda: detrás de Jost y de Marcellus |
| `colon-inter.woff2` | Inter variable (`@fontsource-variable/inter` 5.3.0) | SIL OFL 1.1, `OFL-inter.txt` | Panel: detrás de Onest |
| `colon-noto-sans-mono.woff2` | Noto Sans Mono variable (`@fontsource-variable/noto-sans-mono` 5.3.0) | SIL OFL 1.1, `OFL-noto-sans-mono.txt` | Panel: detrás de JetBrains Mono |

- Pesan entre 1,2 y 1,5 KB, son variables (pesos 100 a 900, siguen el peso del texto) y se declaran con
  `unicode-range: U+20A1`, así el navegador solo los descarga en páginas que muestran un ₡.
- Ninguna de las tres fuentes de origen declara "Reserved Font Name"; aun así, los subconjuntos llevan
  otro nombre de familia ("Colon League Spartan", "Colon Inter", "Colon Noto Sans Mono"), como pide la OFL
  para versiones modificadas.
- Los paquetes de origen **no** son dependencias del proyecto: se usaron una sola vez para generar estos
  archivos.

## Cómo se regeneran

Con Python 3 y `fonttools` más `brotli` (para leer y escribir woff2), a partir del archivo `latin-ext` del
paquete de origen:

```
python3 styles/fuentes/subconjunto.py <origen-latin-ext-wght-normal.woff2> styles/fuentes/colon-league-spartan.woff2 "Colon League Spartan"
```

## Separador de miles

El diseño UX pide "espacio fino de no separación" en los miles (U+202F). Ninguna de estas fuentes trae ese
espacio; Jost y Onest sí traen el espacio de no separación normal (U+00A0), que es el que produce
`Intl.NumberFormat("es-CR")` (`₡61 500`). Si `lib/dinero.ts` usa U+202F, el navegador lo toma de una fuente
del sistema: no se ve un cuadro vacío, pero el ancho puede variar entre equipos.
