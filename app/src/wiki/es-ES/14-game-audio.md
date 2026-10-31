---
title: El audio del juego, explicado
group: Primeros pasos
summary: Cómo guarda y reproduce el audio Helldivers 2, desde los archivos y los bancos hasta las tomas y los slots, por qué la aplicación nombra las cosas como lo hace, y un glosario.
source: 1a4887add42e
---

Helldivers 2 reproduce el audio con **Wwise**, un motor de audio que usan muchos juegos. Wwise no tiene el concepto de canciones ni de ficheros con nombre. Guarda los clips en contenedores, da un número a todo y decide durante la reproducción qué clip va a continuación. Audiodiver convierte esa estructura de nuevo en cosas que un jugador reconoce, y los términos de esta página son los que se muestran en pantalla.

## Dónde se guarda el audio {#where-the-audio-is-stored}

De lo más grande a lo más pequeño:

1. Un **archivo** es uno de los ficheros de la carpeta `data` del juego, con un nombre de código de 16 caracteres como `2e24ba9dd702da24`. Un archivo suele contener el audio de una sola cosa, como un arma, la música de una facción o una voz en un idioma. **Todos los Archivos** los enumera.
2. Un **banco** es un banco de sonido de Wwise dentro de un archivo. Contiene clips y los **sonidos** que los reproducen. La línea *En el archivo …* de la parte superior del panel central nombra tanto el archivo como el banco.
3. Un **sonido** es una cosa que el juego puede activar, como *disparo de cañón automático* o *"Reloading!"*. Un sonido tiene una o más **tomas** y reproduce una cada vez.
4. Una **toma** es una grabación de un sonido. Un disparo de fusil tiene varias tomas, y el juego elige una al azar para que no haya dos disparos que suenen igual. Una toma es el clip que cambia una sustitución.

El audio largo, como la música y las frases, suele ser un **stream**, es decir, que el clip se guarda en el archivo junto al banco. Audiodiver encuentra el clip en ambos casos.

## Por qué muchas cosas se llaman «Secuencia 3» o «Toma 2» {#why-many-things-are-called-sequence-3-or-take-2}

Los ficheros del juego contienen números y ningún nombre. Los nombres de Audiodiver proceden de documentos de la comunidad (enumerados en [Acerca de ▸ Créditos](app:about)) y de lo que Audiodiver puede deducir:

- Una secuencia sin nombre se llama **Secuencia 1**, **Secuencia 2** y así sucesivamente, en el orden del banco. Escúchala para saber qué es. Una secuencia es un grupo de tomas del que el juego elige una cada vez que suena.
- Las tomas de una secuencia sin nombre se llaman **Toma 1**, **Toma 2** y así sucesivamente. Una toma transcrita, como una frase, recibe el nombre de lo que dice.
- Un conjunto de sonidos o un archivo sin nombre recibe el nombre del código del archivo y se marca como *Aún sin nombre*.

Por ejemplo, «Secuencia 4 › Toma 2» es la segunda grabación de la cuarta secuencia del banco. Para sustituir una secuencia, da audio nuevo a todas las tomas. De lo contrario, el juego a veces elige un original.

## Otro audio y Sin audio en los ficheros del juego {#other-audio-and-no-audio-in-the-game-files}

Al final de un conjunto de sonidos, después de los sonidos con nombre y numerados, pueden aparecer dos grupos:

- **Otro audio** contiene clips que el banco guarda o nombra, pero que no reproduce ninguno de los sonidos que contiene. Normalmente los reproduce un sonido de otro banco. Se pueden reproducir y sustituir como cualquier clip, pero no hay información sobre para qué sirven.
- **Sin audio en los ficheros del juego** contiene clips que los datos del banco nombran, pero que los ficheros del juego instalados no incluyen. Son contenido descartado o partes del juego que no están instaladas. Su botón ▶ está desactivado y los rellenados los omiten.

## Cómo se compone la música {#how-music-is-put-together}

La música de Helldivers 2 está hecha para cambiar con la acción. Audiodiver usa estos términos para ella:

- Un **cue** es una lista de reproducción de segmentos, una pieza de música tal como la define la información del juego. Una etiqueta **+3 cues** en un slot significa que el mismo clip suena en otras tres piezas de música.
- Una **pieza de música** es lo que enumera el Índice, como *Selección de equipamiento*. Es un cue, o varios cues que van juntos.
- Una **parte** es un cue de una pieza, que se muestra como una pestaña (como una línea de la lista en las transiciones y los stingers). Una pieza puede tener una parte por cada bioma, por cada intensidad o por cada idioma de una voz. Cada parte tiene un conjunto de slots aparte.
- Un **segmento** es un tramo de música que suena como una unidad, con un punto de **Entrada** y uno de **Salida**. El siguiente segmento empieza en la Salida, y el final del segmento actual se prolonga sobre él.
- Una **capa**, o stem, es uno de los varios clips que un segmento reproduce a la vez. Cada capa es un slot aparte.
- Un **slot** es un lugar donde suena un clip, ya sea una toma de un sonido o una capa de un segmento. El audio se sustituye slot a slot, con un fichero por slot.
- Una **variante** es un slot que suena solo bajo una condición, como un bioma. La fila muestra la condición.
- Una **transición** (↝) es una pieza corta que suena entre dos piezas de música. Un **stinger** (✦) es una pieza corta que suena sobre la música.

[Cómo reproduce el juego la música](wiki:how-the-game-plays-music) da más detalles.

## ID {#ids}

Cada clip, sonido, banco y cue tiene un número, y los ficheros del juego usan solo estos números. Pega un ID de las notas o de otra herramienta en un cuadro de búsqueda para encontrar dónde está. La parte superior de los detalles muestra el **ID de stream** de un slot, o el **ID de origen** (el ID del clip) cuando el audio está solo dentro de un banco. Los proyectos siguen siendo válidos cuando una actualización del juego cambia los ID.

## Glosario {#glossary}

| Palabra | Significado |
|---|---|
| Archivo | Un fichero de la carpeta `data` del juego. Contiene bancos y clips en stream. |
| Asignación | Un fichero, o silencio, dado a un slot. |
| Audio nuevo | El fichero que sustituye al original de un slot. |
| Banco | Un banco de sonido de Wwise, con clips y los sonidos que los reproducen. |
| Capa, stem | Clips que un segmento reproduce a la vez. |
| Categoría, sección | Cómo ordena el Índice las cosas, como en Armas ▸ Armas de apoyo. |
| Conjunto de sonidos | Los sonidos de una cosa, como un arma, un enemigo o una voz. |
| Cue | Una lista de reproducción de segmentos, una pieza de música tal como la define la información del juego. |
| Entrada, Salida | Los puntos de cue de un segmento. La Entrada es donde se considera que ha empezado, y la Salida es donde empieza el siguiente. |
| Grupo | Un sonido con las tomas de las que reproduce, mostrado como una línea que se despliega. |
| ID de origen | El número de un clip en los ficheros del juego. |
| ID de stream | El número de 64 bits de un fichero de stream. |
| Índice | La lista ordenada de la Biblioteca con todo lo que tiene nombre. |
| Original | El audio del juego en un slot. |
| Parte | Un cue de una pieza de música o un idioma de una voz, mostrado como una pestaña. |
| Pieza de música | Música que un jugador reconoce, formada por uno o más cues. |
| Proyecto | El fichero `.audi`, que registra aquello con lo que trabaja el mod y las asignaciones. |
| Rellenar | Asignar varios ficheros a slots en orden de reproducción con una sola acción. |
| Reproducción continua | Reproducir una pieza entera con los mismos traspasos entre segmentos que usa el juego. |
| Segmento | Un tramo de música que suena como una unidad. |
| Silencio, Saltar | Sustituir un slot por nada. Saltar hace esto con una transición para que el juego pase directamente a lo siguiente. |
| Slot | Un lugar donde suena un clip del juego. |
| Sonido | Algo que activa el juego. Reproduce una toma cada vez. |
| Stinger | Una frase corta que suena sobre la música. |
| Stream | Un clip guardado junto a un banco, fuera de él. |
| Sustituido | Un slot que reproduce audio nuevo, o silencio, en lugar del original. |
| Toma | Una grabación de un sonido. El juego elige una al azar. |
| Transición | Una pieza corta que suena entre dos piezas de música. |
| Variante | Un slot que suena solo bajo una condición. |
| Wwise | El motor de audio que usa el juego. |
