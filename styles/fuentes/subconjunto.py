"""Genera una fuente woff2 con un solo carácter: el signo del colón (₡, U+20A1).

Uso: python3 subconjunto.py <origen.woff2> <salida.woff2> "<Nombre de familia>"
Necesita fonttools y brotli. Conserva los ejes variables del origen y cambia el nombre de la familia
(la OFL pide otro nombre para versiones modificadas). Ver LEEME.md.
"""

import sys

from fontTools import subset
from fontTools.ttLib import TTFont

entrada, salida, familia = sys.argv[1:4]

opciones = subset.Options()
opciones.flavor = "woff2"
opciones.layout_features = []
opciones.name_IDs = [0, 1, 2, 3, 4, 5, 6, 13, 14]
opciones.notdef_outline = True

fuente = TTFont(entrada)
recortador = subset.Subsetter(options=opciones)
recortador.populate(unicodes=[0x20A1])
recortador.subset(fuente)

nombre = fuente["name"]
postscript = familia.replace(" ", "")
for registro in list(nombre.names):
    if registro.nameID in (1, 4, 16):
        registro.string = familia
    elif registro.nameID == 6:
        registro.string = postscript
    elif registro.nameID == 3:
        registro.string = familia + " (subconjunto U+20A1)"
nombre.names = [r for r in nombre.names if r.nameID not in (16, 17, 25)]

fuente.flavor = "woff2"
fuente.save(salida)

comprobada = TTFont(salida)
print(salida, sorted(hex(c) for c in comprobada.getBestCmap()), "variable" if "fvar" in comprobada else "estática")
