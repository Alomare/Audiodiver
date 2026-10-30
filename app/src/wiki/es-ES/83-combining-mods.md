---
title: Combinar mods
group: Generar y compartir
summary: Crear un solo mod a partir de varios mods de audio que cambian los mismos bancos de sonido, eligiendo qué versión de cada sonido compartido entra.
source: e6f1f4bcf595
---

Un mod contiene copias completas de los bancos de sonido que cambia. Cuando dos mods cambian el mismo banco, el que se despliega más tarde sustituye la copia del otro, así que solo suena uno de ellos. Los mods de música comparten la mayoría de sus bancos, y también lo hacen muchos mods de armas y de voces. **Combinar Mods**, en [Herramientas](app:tools/combine), lee varios mods y genera un solo mod con el audio de todos ellos, sobre los bancos de sonido actuales.

## Cuándo usarlo {#when-to-use-it}

- Dos mods que quieres usar juntos cambian los mismos bancos, y solo suena el que se despliega el último.
- Varios mods pequeños son más fáciles de conservar y actualizar como uno solo.

## Combinar mods {#combining-mods}

1. Abre [Herramientas ▸ Combinar Mods](app:tools/combine).
2. Suelta los mods en la página. Puedes soltar los ZIP descargados, las carpetas de los mods o los ficheros `.patch_0` con los ficheros `.stream` junto a ellos. **Añadir ZIP o ficheros de parche** y **Añadir una carpeta** hacen lo mismo, y **Mods instalados…** enumera los mods de la biblioteca de un gestor de mods y de la carpeta del juego.
3. Elige las opciones de cada mod. Un mod con opciones las enumera bajo el nombre del mod, a partir de las elecciones que registró el gestor de mods. Una opción con varias elecciones toma una de ellas.
4. Ordena los mods con ↑ y ↓. Consulta [Orden y conflictos](#order-and-conflicts).
5. Pulsa **Buscar conflictos** y elige un mod para cada conflicto que encuentre.
6. Revisa el nombre y pulsa **Combinar**.

Después de una comprobación, cambiar la lista, el orden o las opciones exige otra comprobación antes de que **Combinar** funcione. Una segunda comprobación es rápida, porque Audiodiver conserva lo que leyó de cada mod.

## Orden y conflictos {#order-and-conflicts}

Un conflicto es un sonido que más de un mod cambia de maneras distintas. Los mods dan al mismo clip audio distinto, o definen el mismo ajuste, como el volumen de un sonido, con valores distintos. Los mods que dan el mismo audio a un clip no entran en conflicto. Las tomas nuevas y las capas que varios mods añaden al mismo sonido se conservan todas.

Los conflictos se agrupan por su elemento en el Índice, como una pieza de música o un arma. Cada línea reproduce primero el original y luego la versión de cada mod. El mod resaltado es el que entra. **Todo de**, en la línea de un elemento, elige un mod para todos los conflictos de ese elemento. De forma predeterminada gana el mod que está más abajo en la lista, como si se desplegara más tarde.

Un ajuste de un sonido en conflicto sigue al sonido, así que el mod cuyo audio entra también aporta el volumen definido en ese sonido. Los puntos de cue siguen al audio del mismo modo: un segmento de música toma los puntos de cue del mod cuyo audio reproduce. Si dos mods definen las curvas de volumen de una misma pista de música, entran las curvas del mod que está más abajo.

## Carpeta de destino {#destination-folder}

El ZIP nuevo va a la **Carpeta de destino**. La ubicación predeterminada es `Documents\Audiodiver\Combined`, y **Cambiar** elige otra. Si ya hay allí un ZIP con el mismo nombre, se queda, y el nuevo recibe un número.

Después de una actualización del juego, combina los mods de nuevo. Para cambiar más el audio, crea un proyecto e importa en él el parche combinado, como explica [Cuando el juego se actualiza](wiki:game-updates#mods-made-with-older-tools). Un proyecto toma solo el audio.

## Qué se omite al combinar {#what-combining-leaves-out}

- Los cambios que Audiodiver no traslada, como los efectos o cómo elige sonidos un contenedor, y los sonidos que un mod todavía tiene de una versión anterior del juego. El resultado los enumera para cada mod, como hace [Repatch](wiki:repatching#what-repatching-leaves-out).
- Un fichero que no es audio, como una textura o una tabla de cadenas, que tienen ambos mods: la copia del mod situado más arriba en la lista se queda fuera. Entra la copia del mod de más abajo, como si ese mod se desplegara más tarde, y el resultado lo indica.

Todo lo demás de los parches, como texto, modelos y texturas, entra tal como estaba.

## Instalar el resultado {#installing-the-result}

El mod combinado es un mod nuevo con un ID nuevo. En el gestor de mods, desactiva los mods que combina, importa después el ZIP nuevo y despliégalo. Un mod combinado sigue siendo obra de los autores originales, así que consérvalo para uso personal y compártelo solo con su permiso.
