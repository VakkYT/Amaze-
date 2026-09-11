# Salón Tricolor

Un salón de belleza para la clase política colombiana: nueve caricaturas
sentadas en la silla, un rostro que se maquilla por capas, una mano de cinco
uñas que se liman, se pintan y se decoran, y un jurado que pone nota.

Todo pasa en una sola página sin dependencias: dos lienzos de canvas, un rail
de herramientas que se arma solo a partir de las paletas, y un código de texto
que guarda el look entero para pasárselo a alguien más.

## Lo que hay

**En la silla** — nueve personajes repartidos de lado a lado del espectro, más
*Candidatx sin nombre* para quien prefiera no jugar con nombres propios. Cada
uno son rasgos de dibujo (piel, pelo, gafas, vello, traje) y dos colores de
campaña que el jurado usa para medir coherencia. Son caricaturas paramétricas,
no retratos.

**Rostro** — tono de base, contorno e iluminador; rubor con intensidad; sombra
en diez tonos con cuatro aplicaciones (difuminada, ojo de gato, ahumada, corte
agudo); delineador fino, alado o gráfico; pestañas hasta las de telenovela;
cejas naturales, definidas o laminadas; labial en diez tonos con acabado mate,
gloss o metálico; y cinco extras — lunar, pecas, purpurina, pedrería y antifaz
de brillo — que brillan en el tono de la sombra.

**Uñas** — seis cortes (redonda, ovalada, almendra, cuadrada, coffin,
stiletto), cuatro largos, doce esmaltes, acabado brillante, mate o cromado, y
ocho diseños: francés, puntos, rayas, estrellas, flores, degradado y tricolor.
Cualquiera de los cinco dedos puede ser la uña acentuada, que invierte los
colores.

**El jurado** — cuatro medidores y un veredicto:

| Medidor | Qué mide |
| --- | --- |
| Armonía | Distancia de matiz entre los colores aplicados; premia lo monocromo, lo análogo, lo triádico y lo complementario |
| Atrevimiento | Saturación, intensidades, largo y forma de la uña, extras y diseño |
| Coherencia de campaña | Qué tan cerca están los colores de los dos de la campaña del personaje |
| Producción | Cuántas de las diez capas posibles se aplicaron |

La nota final las pondera 40/25/20/15. Todo es determinista: el mismo look da
siempre la misma lectura.

## Controles

Toque los labios, los ojos, las cejas o las mejillas para saltar a esa
herramienta; toque una uña para acentuarla. `A` sorprende, `Z` deshace, `Y`
rehace. El código del look (`SLN1-petro-2112…`) viaja también en la dirección
de la página, así que basta con copiar el enlace.

## Cómo está armado

```
src/engine.js       paletas, personajes, look, código compartible y jurado — sin DOM
src/paint.js        el pincel: rostro y mano sobre canvas, en un espacio de 1000 x 1000
src/app.js          arma el rail a partir de los datos, historial, eventos
src/style.css       tokens y maquetación para los dos temas
src/template.html   el armazón de la página, con ranuras
build.mjs           empaqueta src/ en dist/salon.html, un solo archivo
test/engine.test.mjs
```

El look es plano y numérico a propósito: cada campo es un índice pequeño, así
que cabe entero en un código base 36 con suma de control. De ahí sale que
compartir un look sea copiar una línea de texto, y que el historial de deshacer
sean objetos completos en vez de parches.

El rail no está escrito en el HTML: `PANELS` en `app.js` declara qué campos
existen y de qué tipo son, y los controles se dibujan solos. Agregar un tono a
una paleta es agregar una línea en `engine.js`.

## Trabajar en esto

```sh
node --test salon/test/engine.test.mjs   # 13 comprobaciones
node salon/build.mjs                     # -> salon/dist/salon.html
```

Las pruebas se ocupan de lo que puede romperse en silencio: que ningún control
deje un look inválido, que el código sea de ida y vuelta exacta y que uno
corrupto se rechace en vez de entregar un look a medias, que el azar sembrado
se repita, y que el jurado siempre devuelva cuatro medidores en rango.

## Una nota

Los rostros son caricaturas vectoriales paramétricas, no retratos: ningún
parecido es exacto y nada de lo que aparece en la página es palabra, gesto ni
posición de nadie. Es un juego de salón sobre figuras públicas, repartido de
lado a lado del espectro.
