---
title: Banda Sonora
group: Crear un mod
summary: Cómo se reproduce cada pieza de música: en el orden original, como una sola canción, como lista de reproducción, en silencio o como la música de batalla.
source: 214ec97ec28d
---

El juego no reproduce una pieza de música de arriba abajo. La lista de reproducción de una pieza combina grupos que suenan en orden, grupos que reproducen cada vez el siguiente segmento y grupos que eligen al azar. La mayor parte de la música de combate empieza cada combate con una intro corta, y un combate nuevo continúa desde donde se detuvo el último. Una canción cortada en los slots en el orden de la lista suena desordenada en el juego.

La pestaña [Banda Sonora](app:soundtrack) enumera toda la música y define cómo se reproduce cada pieza. Las generaciones escriben ese orden en la música.

## Música {#music}

La lista de la izquierda contiene toda la música del juego, según dónde se oye. Cada fila dice cómo se reproduce la música, con el nivel cuando no es 0 dB, y **Varios** significa que las partes de una pieza se reproducen de maneras distintas. La música con varias partes, como Llegada con una para cada bioma, las muestra como pestañas. El cuadro de búsqueda encuentra música por sección, nombre o modo, como *Iluminados* o *Lista de reproducción*, y {icon:collapse} **Contraer todo** contrae todas las secciones.

Las **Plantillas** definen mucha música a la vez:

- **Canciones de batalla** define la Batalla intensa de cada enemigo en **Igual que Batalla**, de modo que una sola canción cubre un combate.
- **Exploración tranquila** pone la música de Exploración de cada enemigo en **Silencio**.
- **Sin intros** omite las intros cortas de la música de batalla, para que los combates empiecen directamente en la música.
- **Original** devuelve toda la música al orden original. El audio nuevo se queda en los slots.

Deshacer revierte una plantilla entera. Una plantilla que no encuentra nada que cambiar lo indica.

## Modos {#modes}

| Modo | Qué suena |
|---|---|
| **Original** | Los segmentos en su orden original. Desmarca un segmento en el orden de reproducción para omitirlo de esta música. Sigue sonando en cualquier otro sitio donde lo use el juego. |
| **Una canción** | Una canción, cortada en los segmentos. Cada combate reproduce una intro y luego la canción desde el trozo 1. |
| **Lista de reproducción** | Canciones enteras, una en cada lugar, en orden o en orden aleatorio. |
| **Silencio** | Nada. |
| **Igual que Batalla** | Para la Batalla intensa. La música de batalla sigue desde el segmento en el que está, así que la canción no vuelve a empezar cuando un combate se intensifica. |

**Nivel** sube o baja la pieza entera hasta 96 dB, además del Make-Up Gain de cada slot. Arrastra el control deslizante o escribe un valor en el cuadro de al lado. {icon:reset} lo vuelve a poner en 0 dB. La música en Silencio y la música definida en Igual que Batalla no suenan, así que Nivel está desactivado para ellas.

**Copiar a** define la música del mismo nombre en otros lugares del mismo modo, por ejemplo la música de Batalla de cada enemigo. Una lista de reproducción pone cada canción en el mismo lugar, y Una canción pone los trozos en orden. Donde hay menos lugares, las últimas canciones o los últimos trozos se omiten, y una nota lo indica.

## Una canción {#one-song}

**Elegir una canción** abre la herramienta de corte con los segmentos que rellena la canción. Una canción soltada en la página también la abre. Córtala en tantos trozos como quieras, hasta uno por segmento. Cada trozo entra entero en un segmento. La primera capa recibe el trozo y las demás capas reproducen silencio. En la música de Extracción, la primera capa de intensidad baja y la primera de intensidad alta lo reciben las dos.

**Cambiar los cortes** vuelve a abrir la herramienta de corte con la misma canción y los mismos cortes. **Elegir otra canción** empieza con una nueva.

## Lista de reproducción {#playlist}

Una lista de reproducción tiene una línea para cada lugar en el que puede ir una canción, en orden de reproducción. Haz clic en un lugar, o suelta una canción en él, para poner una canción allí. Varios ficheros elegidos o soltados en un lugar lo rellenan, y también los lugares siguientes, en orden de nombre de fichero. **Añadir canciones** rellena los lugares vacíos. Arrastra una canción a otro lugar para moverla, y las canciones intermedias se desplazan un lugar. ↑ y ↓ en la línea, o {key:moveUp} y {key:moveDown}, mueven una canción un lugar, y ✕ la saca de la lista de reproducción. El fichero se queda en el disco.

Los lugares vacíos no suenan. **Aleatorio** reproduce las canciones en orden aleatorio, y ninguna canción suena dos veces antes de que hayan sonado las demás. **Continuar en el siguiente combate** empieza cada combate con la canción siguiente a aquella en la que se detuvo el último combate. Sin esta opción, cada combate vuelve a empezar desde la primera canción. Para la música fuera del combate, la opción es **Continuar la próxima vez**.

Cuando cambia la música, por ejemplo de exploración a batalla, abandona una canción en el siguiente compás con un fundido corto, sin esperar a que la canción termine.

## Intros {#openings}

La mayor parte de la música de combate empieza cada combate con una intro corta, un segmento de un grupo de ellos, antes de la música propiamente dicha. El orden de reproducción marca ese grupo con **Los combates empiezan aquí**. Parte de la música fuera del combate empieza del mismo modo cada vez que suena.

**Una canción** y **Lista de reproducción** conservan las intros, así que un combate empieza con una intro original y luego viene la canción o la lista de reproducción. Para cambiar lo que suena ahí:

- Sustituye las intros en la pestaña [Audio](app:editor), como cualquier otro slot, por audio nuevo o por silencio. El silencio con **Mantener la duración original** desactivado pasa directamente a la canción ([Silencio](wiki:how-the-game-plays-music#silence)).
- Para la música en **Original**, desmarca las intros en el orden de reproducción para omitirlas, o usa la plantilla **Sin intros** para la música de batalla de todos los enemigos a la vez.

## Escuchar {#listening}

Cada línea tiene el original a la izquierda y el audio nuevo a la derecha, cada uno con ▶, como un slot de la pestaña Audio. Haz clic en una línea, o en un segmento del orden de reproducción, para seleccionarla. Las formas de onda del segmento seleccionado se muestran abajo, el original arriba y el audio nuevo debajo, con **Entrada** y **Salida**. Haz clic en una forma de onda para reproducir desde ese punto. {key:selectPrev} y {key:selectNext} seleccionan el segmento anterior o el siguiente, y {key:playGame} y {key:playMine} reproducen el original o el audio nuevo de ese segmento.

Los botones redondos de arriba reproducen un combate entero, el gris con la música original y el amarillo con el orden y el audio del proyecto. **Duración del combate** define cuánto dura el combate. El combate termina con el segmento que suena en ese momento, y **Siguiente combate** continúa desde ahí. Para la música fuera del combate estos son **Suena durante** y **Volver a reproducir**. Mientras suena un combate, una barra muestra por dónde va (haz clic en ella para ir a ese punto), y el segmento que suena se ilumina y queda seleccionado, de modo que las formas de onda siguen el combate. Una línea bajo la barra enumera los segmentos del combate en el orden en que sonaron.

## Exportar {#exporting}

{icon:export} **Exportar**, en la barra sobre la música, guarda la pieza como ficheros de audio ([Exportar](wiki:reading-the-screen#exporting)). **La pieza entera** la reproduce una vez de principio a fin, y **Un combate** graba un combate como lo reproducen los botones redondos, durante la duración definida en minutos. Cada exportación de un combate es un combate nuevo. **Cada segmento** y **Cada slot** guardan las partes. Con **Como lo reproduce el mod**, la exportación sigue el modo, las canciones y el nivel definidos aquí.

{icon:header} y {icon:waves} al final de esa barra ocultan o muestran el encabezado y las formas de onda. Arrastra los bordes bajo el encabezado, sobre las formas de onda y junto a la lista para cambiar su tamaño. **Slots**, junto al nombre de la música, la abre en la pestaña [Audio](app:editor).

## Orden de reproducción {#play-order}

El orden de reproducción muestra la pieza como grupos de segmentos, cada uno en una tarjeta con un encabezado que dice qué hace con ellos, y una tarjeta más oscura por cada grupo más adentro:

- **En orden** los reproduce uno tras otro.
- **Siguiente cada vez** reproduce uno cada vez, el siguiente en orden. Un combate nuevo continúa desde donde se detuvo el último.
- **En orden aleatorio** los reproduce todos en un orden aleatorio.
- **Una al azar** reproduce uno, elegido al azar.

Los segmentos de un grupo se unen según lo que significa el grupo: → para en orden, *o* para una al azar. Los grupos situados uno bajo otro se unen del mismo modo, con *luego*, *la próxima vez* o *o*. Una selección corta de segmentos va en una línea dentro de un marco de trazos, y un grupo con una sola cosa muestra solo esa cosa, porque suena igual.

**Se repite** marca un grupo que suena otra vez hasta que cambia la música, y **3 veces** uno que suena tres veces y luego sigue. **Los combates empiezan aquí** marca dónde empieza la música cuando empieza un combate ([Intros](wiki:soundtrack#openings)), y **Empieza aquí** dónde empieza otra música cada vez que suena. El ▶ de un segmento reproduce lo que reproduce el proyecto en ese punto.

## Capas {#layers}

La música que reproduce varias capas a la vez, como la música de Extracción, las muestra en una cuadrícula: una fila por cada segmento y una columna por cada capa en intensidad baja y alta. Haz clic en una celda para ver las formas de onda. Sustituye las capas en la pestaña [Audio](app:editor).
