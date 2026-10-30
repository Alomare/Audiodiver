---
title: Cómo leer la pantalla
group: Primeros pasos
summary: Qué muestra cada parte de la Biblioteca y de la pestaña Audio, y qué significan las etiquetas y las marcas de una fila.
source: f9a18dbaae00
---

La Biblioteca y la pestaña Audio comparten una disposición: una lista a la izquierda, el elemento abierto en el centro y el panel de detalles a la derecha. La Banda Sonora tiene otra disposición, que se describe en [Banda Sonora](wiki:soundtrack). Las palabras en **negrita** se explican en [El audio del juego, explicado](wiki:game-audio).

## La lista de la izquierda {#the-list-on-the-left}

- **Índice** ordena el audio según lo que es. Categorías como Música, Armas y Enemigos contienen secciones como *En la nave* y *Armas primarias*. Cada sección enumera cosas que se pueden abrir, ya sea una **pieza de música** o un **conjunto de sonidos**. El número al final de una fila es la duración de una pieza de música, o el número de sonidos de un conjunto.
- **Todos los Archivos** muestra en una tabla todos los **archivos** que contienen audio. Haz clic en el encabezado de una columna para ordenar por ella, y otra vez para invertir el orden. Los iconos de la columna *Índice* indican qué categorías incluyen el archivo. Todos los Archivos empieza más ancho que el Índice, y cada uno conserva el ancho que le des.
- Con Helldivers 1 instalado, las pestañas **Helldivers 2** y **Helldivers 1** bajo estas dos eligen el juego.
- En la Biblioteca, el **+** al final de una fila la añade al proyecto, y **✓** indica que el proyecto ya la tiene. Las líneas de categoría y de sección también tienen un **+**, que añade todo lo visible bajo ellas. Después de una búsqueda, ese **+** añade solo los resultados.
- En la pestaña Audio, la lista muestra lo que tiene el proyecto. **✕** en una fila, o en una línea de categoría o de sección, la quita del proyecto junto con todo lo que el proyecto cambia en ella: el audio nuevo, también en los slots que comparte otro elemento del proyecto, las tomas y capas añadidas, el Make-Up Gain, y los puntos de cue y los ajustes de Banda Sonora de la música. Audiodiver pregunta antes cuando se perdería audio nuevo. El clic derecho hace lo mismo, y {key:undo} lo recupera.
- {icon:collapse} **Contraer todo**, junto al cuadro de búsqueda, contrae todas las categorías y secciones. Una búsqueda expande lo que coincide.

## La parte superior del panel central {#the-top-of-the-middle-panel}

- **La ruta y el título** muestran dónde está el elemento en el Índice (*Armas ▸ Armas primarias*, *Helldivers ▸ Voces*) y cómo se llama. ‹ y › al final del título van atrás y adelante.
- **Original**, **Parcialmente sustituido** o **Sustituido** muestra qué reproduce ahora el elemento, solo en la pestaña Audio.
- **En el archivo …** nombra el archivo que contiene el elemento, seguido del nombre del **banco** en los ficheros del juego. Haz clic en el archivo para abrirlo en Todos los Archivos.

Bajo el título, una fila de recuadros da más información sobre el elemento. Van uno junto a otro y se apilan cuando el panel es estrecho:

- {icon:transition} **N transiciones suenan junto a esta música** aparece solo en la música. Cuenta las piezas cortas que dan paso a la música y salen de ella. **Mostrar** las enumera y muestra qué reproduce ahora cada una.
- {icon:order} **El juego reproduce estos slots en otro orden** aparece en la música cuya lista de reproducción no reproduce los slots de arriba abajo. **Orden de reproducción** lo abre en la [Banda Sonora](wiki:soundtrack).
- {icon:link} **Comparte audio con** enumera otras cosas que reproducen algunos de los mismos clips.

{icon:header} al final de la barra de herramientas oculta el encabezado y lo vuelve a mostrar.

## La barra de herramientas {#the-toolbar}

{icon:through} **Reproducción continua** reproduce la pieza de música entera segmento a segmento, en el mismo orden que usa el juego. El botón gris reproduce el audio **Original** y el amarillo el audio **Sustituido**. Mientras uno suena, una barra muestra por dónde va.

La barra de herramientas empieza con una casilla que selecciona todos los slots o anula la selección. En la Biblioteca sigue **Añadir al proyecto**, y en la pestaña Audio estas herramientas:

| Herramienta | Qué hace |
|---|---|
| {icon:fill} **Rellenar desde ficheros** | Rellena los slots con ficheros, uno por slot, en orden de reproducción y de nombre de fichero. |
| {icon:fillpiece} **Rellenar la pieza entera** | Rellena de la misma manera los slots de todas las partes, parte por parte. |
| {icon:slice} **Cortar una canción** | Corta una canción en trozos, uno por slot. |
| {icon:export} **Exportar** | Guarda el elemento, o los slots seleccionados, como ficheros WAV, FLAC, MP3 o WEM. **Lista de Exportación**, a su lado, abre la [lista de exportación](#the-export-list) cuando ya hay algo en ella. |
| {icon:skip} **Saltarlo**, {icon:skipall} **Saltarlos todos** | Sustituyen una transición o un stinger por un silencio corto. |
| {icon:clear} **Vaciar todo**, **Vaciar esta parte** | Quitan el audio nuevo de todos los slots mostrados, o de todos los slots de la parte. |

{icon:search} **Buscar slots** reduce la lista por nombre, etiqueta, nota, nombre de fichero o ID. En un conjunto de sonidos también encuentra las palabras de una frase. Cuando nada de la lista coincide, **En otros lugares** enumera las piezas de música y los conjuntos de sonidos que tienen una coincidencia.

{icon:id} después de la búsqueda enumera los sonidos de un banco por [ID de contenedor](#container-ids). Púlsalo otra vez para volver a los nombres.

{icon:header} y {icon:waves} al final de la barra de herramientas ocultan o muestran el encabezado y las formas de onda, y el **?** que va después abre esta sección. El botón de las formas de onda funciona mientras hay un slot seleccionado.

## Partes {#parts}

Las pestañas bajo la barra de herramientas cambian entre las **partes** del elemento abierto. Las partes son los biomas o las intensidades de una pieza de música, o los idiomas de una voz. El número de una pestaña es una duración o un número de sonidos.

Las transiciones y los stingers tienen muchas partes cortas, así que cada parte es una línea de la lista de slots. Una línea reproduce el original, muestra la duración y marca una parte que está en silencio o que pertenece a otra música. Los slots de la parte abierta se enumeran justo debajo. Haz clic en otra línea para abrir esa parte, o en la abierta para contraerla. La barra de herramientas actúa sobre la parte abierta.

## Los slots {#the-slots}

Cada fila es un **slot**, un clip del juego que se puede sustituir.

- **Música** enumera los **segmentos** en orden de reproducción. La primera fila de un segmento muestra el nombre del segmento, y las filas de debajo son las demás **capas**.
- Los **sonidos** se muestran en **grupos**, con una línea por sonido y las **tomas** contraídas debajo. ▶ en la línea reproduce la primera toma. Los ficheros soltados en la línea rellenan las tomas en orden. Haz clic derecho en la línea para rellenar, silenciar o vaciar todas las tomas a la vez.
- La mitad izquierda de una fila es el original. ▶ lo reproduce, y la duración se muestra al final. En la pestaña Audio, la mitad derecha es la sustitución. ▶ reproduce el audio nuevo, hacer clic en el nombre del fichero elige otro fichero y ✕ lo quita. Un slot vacío muestra *Soltar audio o elegir un fichero*.
- La casilla del principio de una fila añade el slot a la selección, o lo quita, igual que Ctrl+clic. Shift en una casilla selecciona un intervalo. Una línea de grupo tiene una casilla para todas las tomas del grupo, y el grupo sigue contraído. En la Biblioteca, **Exportar** puede guardar solo los slots seleccionados. En la pestaña Audio, con varios slots seleccionados, el panel derecho tiene **Elegir un fichero para todos**, **Elegir ficheros**, **Sustituir por silencio** y el botón que quita el audio nuevo.
- Haz doble clic en una fila para reproducirla. Haz clic derecho en ella para todo lo demás, incluidos copiar, pegar, silencio e ID.
- Copia ficheros de audio en el Explorador de archivos, selecciona slots y pulsa **Ctrl+V**. Un fichero va a todos los slots seleccionados. Varios ficheros van en orden de nombre de fichero, y con un único slot seleccionado siguen rellenando a partir de ahí. Ctrl+V pega lo último que se copió: ficheros del Explorador de archivos o slots copiados en Audiodiver.
- **Ctrl+C** copia los slots seleccionados, en la Biblioteca o en la pestaña Audio. **Ctrl+V** los pega en los slots seleccionados de la pestaña Audio, sin exportar ni importar nada. Un slot con audio nuevo da ese audio y sus ajustes. Cualquier otro slot da el original, y un clip de Helldivers 2 entra sin cambios.

### Etiquetas de una fila {#tags-on-a-row}

| Etiqueta | Significado |
|---|---|
| {icon:link} **+3 cues** / **+5 bancos** / **+8 más** | El juego reproduce el mismo clip en esa cantidad de lugares más. |
| {icon:link} **en otros 104 bancos** (en un grupo) | Todos los sonidos del grupo son una copia compartida, como los sonidos de manejo que lleva cada arma. |
| **en bucle**, **×2** | El segmento se repite hasta que el juego pasa a lo siguiente, o se repite esa cantidad de veces. |
| una condición, como *Desierto* | Este slot es una **variante** y suena solo cuando se cumple la condición. |
| **nunca suena** | Los datos del juego incluyen este clip, pero nada lo reproduce. |
| **no tocar** | Sustituir este clip hace que la música se entrecorte. Los rellenados lo omiten. |
| **sin audio** | Los datos del juego nombran este clip, pero los ficheros del juego instalados no lo incluyen. No hay nada que reproducir ni sustituir. |
| **tambores suaves** | Una capa de percusión apenas audible bajo otra capa del segmento. |
| **nunca suena** | El clip está en los ficheros del juego, pero el juego nunca lo reproduce. La música de muerte de los Iluminados del Vacío es un ejemplo. |
| **solo este sonido** | El audio nuevo suena solo en este sonido. Los demás sonidos que reproducen el clip conservan el Original. Consulta [Solo este sonido](wiki:adding-audio#only-this-sound). |
| **sustituido en otro sonido** | Otro sonido reproduce audio nuevo en lugar de este clip, con **Solo este sonido**. Este conserva el Original. |
| **−6 dB** | Make-Up Gain en el Original, en un slot sin audio nuevo. Consulta [Make-Up Gain por slot](wiki:volume#make-up-gain-per-slot). |
| una etiqueta de color | Una entrada del Índice relacionada con este slot. Haz clic en la etiqueta para abrirla. |

Pasa el puntero por una etiqueta para leer la nota. Las notas de un clip seleccionado aparecen en el panel de detalles. Describen cuándo suena el clip, o dan una advertencia, como una duración mínima para el audio nuevo.

### Marcas {#marks}

| Marca | Significado |
|---|---|
| ○ ◐ ● | Original, parcialmente sustituido, sustituido. |
| ↝ | Una **transición**, que suena entre dos piezas de música. |
| ✦ | Un **stinger**, que suena sobre la música. |
| ×3 | El elemento tiene tres **partes**. |
| **!** | Una transición original suena junto a música nueva. Consulta [Cómo reproduce el juego la música](wiki:how-the-game-plays-music). |

## Bajo los slots {#under-the-slots}

Aquí se muestran las **formas de onda** del slot seleccionado. El original está arriba y, en la pestaña Audio, la sustitución está debajo, con las mismas escalas de tiempo y de nivel, y con los puntos de **Entrada** y **Salida** marcados. Las dos se dibujan con su [Make-Up Gain](wiki:volume#make-up-gain-per-slot), y el rojo marca el audio que pasa del fondo de escala. Haz clic en una forma de onda para reproducir desde ese punto y arrastra el borde superior del panel para cambiar su tamaño. {icon:waves} al final de la barra de herramientas las oculta. En la Biblioteca, la línea sobre las formas de onda describe el slot. Muestra el ID (haz clic para copiarlo), la duración, cuándo suena el slot y en qué otros sitios lo reproduce el juego. Una línea alrededor de una forma de onda es la [curva de volumen](wiki:volume#volume-curves) del clip.

Dos controles deslizantes hacen zoom en las dos formas de onda. El del lado derecho las dibuja más altas, para mostrar audio silencioso, y el de debajo, a la derecha, amplía el tiempo, para colocar Entrada y Salida con precisión. Sobre las formas de onda, la rueda del ratón amplía el tiempo, Ctrl+rueda las dibuja más altas y Shift+rueda desplaza. Con el tiempo ampliado, la franja bajo las formas de onda también se desplaza. {icon:reset}, en la esquina entre los controles, vuelve a mostrar todo el audio a escala completa. Mientras se mueve un control deslizante, un número de 0 a 100 sobre el tirador indica hasta dónde ha llegado. El zoom se queda como está al seleccionar otro slot, y la herramienta de corte tiene los mismos controles.

## El panel de detalles {#the-details-panel}

En la pestaña Audio, este panel contiene los ajustes del slot seleccionado. Muestra qué sustituye al slot, ya sea un fichero o silencio. Un fichero tiene un botón que lo muestra en el Explorador de archivos, y el silencio tiene **Mantener la duración original**. Debajo están **Make-Up Gain** ([se explica aquí](wiki:volume)), **Ajustar los tiempos al audio nuevo**, los **puntos de cue**, **Compartido con** y las notas. Un slot sin audio nuevo tiene **Usar silencio** y el Make-Up Gain del Original. El audio se reproduce y los ficheros se eligen en la fila del slot.

Con varios slots seleccionados, el panel define el Make-Up Gain, los puntos de cue o el silencio de todos ellos. **Elegir un fichero para todos** pone un fichero en todos los slots seleccionados, y **Elegir ficheros** pone un fichero en cada uno, en el orden de la lista y de los nombres de fichero.

Sin ningún slot seleccionado, el panel muestra las notas del elemento abierto y las teclas de la lista de slots.

En la Biblioteca, el panel muestra el nombre y el ID del slot seleccionado, o del elemento abierto cuando no hay ningún slot seleccionado, con la nota global que tenga.

## Notas {#notes}

Los slots y los elementos de la lista de la izquierda pueden tener dos notas. La **Nota del proyecto** se guarda en el fichero del proyecto, y Deshacer revierte un cambio en ella. La **Nota global** se guarda en un fichero de notas de este ordenador y se muestra en todos los proyectos y en la Biblioteca. Deshacer no revierte una nota global, y [Notas globales](wiki:how-audiodiver-works#global-notes) en Ajustes indica dónde está el fichero. Las generaciones omiten las notas.

Las notas están al final del panel de detalles. Selecciona un slot para ver sus notas, o no selecciones nada para ver las notas del elemento. La Biblioteca muestra solo la nota global. **Añadir una nota del proyecto** y **Añadir una nota global** abren el editor. Una búsqueda en la lista de la izquierda también encuentra palabras en las notas globales, y marca lo que encontró así con {icon:note}.

Las notas se escriben en Markdown. `#` crea un encabezado, `-` crea un elemento de lista, `**bold**` y `*italic*` marcan palabras, y `[text](https://…)` crea un enlace. Los botones sobre el cuadro hacen lo mismo con las palabras seleccionadas, y volver a pulsar uno quita la marca. {key:undo} funciona en el cuadro mientras escribes. Haz clic fuera para guardar la nota y mostrarla con formato. Haz clic en ella para volver a editarla. **Eliminar la nota del proyecto** y **Eliminar la nota global** borran una nota, y preguntan antes si tiene alguna palabra.

Un clip que suena en varios lugares tiene una nota de cada tipo, que se muestra en todos esos lugares. Cuando una actualización del juego da un ID nuevo a un clip, la nota deja de mostrarse. Se queda en el fichero y vuelve a mostrarse si el ID regresa.

## Las barras {#the-bars}

La barra de pestañas contiene las pestañas principales. Inicio y Herramientas van primero. La banda más oscura que va después contiene las pestañas del proyecto abierto, de Proyecto a Texto, y la pestaña Proyecto muestra el icono del proyecto. Generar va después de la banda mientras hay un proyecto abierto, y {icon:updates} Actualizaciones, la Wiki y Ajustes están al final. La barra recorre la parte superior de la ventana, y **Barra de pestañas** en [Ajustes ▸ Tema](app:settings/theme) la pone en otro lado. Con los nombres de las pestañas activados, una barra en la parte superior o inferior muestra los nombres junto a los iconos, y una barra a la izquierda o a la derecha muestra un nombre cuando el puntero está sobre la pestaña. La pestaña abierta toma el color de la página que abre, y en la banda la pestaña abierta tiene un borde en el color primario. Las pestañas dentro de una página, como Índice y Todos los Archivos, las partes de una pieza o las secciones de Ajustes, van subrayadas. Un punto en Generar significa que el proyecto necesita una generación nueva, y un punto en Actualizaciones significa que hay una versión nueva de Audiodiver disponible.

La barra de estado de la parte inferior tiene deshacer y rehacer, el fichero del proyecto y el audio que está sonando. Haz clic en el audio que suena para volver al lugar donde se reprodujo: el slot en la Biblioteca o en la pestaña Audio, o la pieza y el segmento en la Banda Sonora. **Vol** define el volumen de escucha, que no afecta al mod. El número de versión abre Actualizaciones, y el {icon:info} que hay a su lado abre [Acerca de](app:about).

### Historial {#history}

El reloj junto a deshacer y rehacer abre **Historial**, la lista de cambios hechos desde que se abrió el proyecto, el más antiguo primero, cada uno con la hora a la que se hizo. El cambio en el que está el proyecto aparece marcado. Haz clic en uno anterior para deshacer de golpe todos los cambios posteriores, o en uno más abajo, en gris, para rehacer hasta él. **Estado al abrir** los deshace todos y muestra cuándo se abrió el proyecto. Deshacer y rehacer siguen funcionando desde donde haya quedado la lista, y la lista conserva los últimos 200 cambios.

### Notificaciones {#notifications}

Las confirmaciones breves, como *Añadido a Mi mod: Selección de equipamiento* o *Mi mod guardado*, aparecen un momento en la parte inferior de la ventana. Los avisos que hay que leer, o que tienen un botón como Deshacer o Mostrar en la carpeta, aparecen abajo a la derecha, o en la esquina definida en **Notificaciones** dentro de [Ajustes ▸ Sistema](app:settings/system).

La campana del extremo derecho de la barra de estado enumera los avisos mostrados hasta ahora, el más reciente primero, con la hora de cada uno, para volver a leer uno cuando ya ha desaparecido. Un aviso que llevaba a algún sitio, como la propuesta de los tutoriales o uno con **Mostrar en la carpeta**, lleva allí otra vez al hacer clic en él en la lista. La lista conserva los últimos 100, también después de reiniciar Audiodiver. Solo los enumera y nunca muestra nada por sí sola.

## ID {#ids}

Cada slot muestra un **ID de stream** al final de la fila, el ID con el que lo enumeran otras herramientas de audio. Un slot con el audio guardado solo dentro de un banco muestra en su lugar el **ID de origen**. Haz clic en el ID para copiarlo. Haz clic derecho en la fila para ver todos los ID del slot:

- el **ID de stream** de 64 bits del fichero que contiene el audio
- el **ID de origen** del clip
- el **Sound** de un banco que reproduce el clip
- el **contenedor** que contiene las tomas del sonido
- la **pista** de música de la que el clip es una capa

Los dos cuadros de búsqueda aceptan cualquiera de ellos.

## ID de contenedor {#container-ids}

Pulsa {icon:id} en la barra de herramientas para enumerar los sonidos de un banco como lo hacen las herramientas de Wwise. Cada sonido se nombra entonces por el ID del contenedor que está justo encima de las tomas, con el tipo de contenedor antes del ID (Random, Sequence, Switch, Layer o Actor-Mixer) y el nombre habitual después. Los contenedores superiores van en líneas propias, un paso más adentro por cada nivel, en el orden del banco. Los Actor-Mixer que contienen solo al siguiente comparten una línea. Haz clic en un ID de estas líneas para copiarlo. La búsqueda de slots también encuentra ID de contenedor. Haz clic en la línea de un contenedor, o en su casilla, para seleccionar todos los slots que tiene debajo, por ejemplo para ajustar el Make-Up Gain de un contenedor entero.

## Exportar {#exporting}

{icon:export} **Exportar** en la barra de herramientas abre el panel de exportación. La primera pestaña guarda el elemento abierto, y la segunda la [lista de exportación](#the-export-list). A la derecha, el panel enumera las carpetas y los ficheros que escribe la exportación, con los nombres que tendrán, antes de escribir nada.

- **Sonidos** o **Slots**: **Seleccionados** (marca antes los slots en la lista), **Sustituidos** (en la pestaña Audio) o **Todos**.
- **Contenido**, para la música: **Cada slot**, **Cada segmento** con las capas mezcladas, o **La pieza entera** reproducida de principio a fin. En la Banda Sonora, **Un combate** guarda un combate tal como lo reproduce el juego ([Exportar música](wiki:soundtrack#exporting)).
- **Audio**, en la pestaña Audio y en la Banda Sonora: **Como lo reproduce el mod** guarda el audio nuevo donde un slot lo tiene, con el Make-Up Gain definido, y el Original en todos los demás. **Ambos** añade la versión sustituida junto al Original dondequiera que el mod cambie algo, y esos nombres terminan en *(original)* y *(sustituido)*. La Biblioteca guarda el Original.
- **Nombres de fichero**: **Nombres completos** empiezan con el nombre del elemento, **Nombres cortos** lo omiten e **ID de origen** nombra cada slot por el ID de origen, como nombran otras herramientas de modding el audio del juego.
- **Formato**: WAV, FLAC, MP3 o WEM para los slots Original. Un WEM es el fichero tal como lo tiene el juego, y entra en otro slot como audio nuevo sin volver a codificarse.

### Una carpeta por elemento {#a-folder-for-each-item}

Con **Una carpeta por elemento** activado, los ficheros de cada entrada van a una carpeta con su nombre. Con la opción desactivada, todos los ficheros van a la carpeta de destino.

### Preentrada y cola {#lead-in-and-ring-out}

Al exportar una pieza de música por segmentos se guarda un fichero por segmento. **Preentrada y cola** incluye el audio anterior a la Entrada y posterior a la Salida de cada segmento, de modo que los ficheros se solapan como lo hacen los segmentos en el juego. Con la opción desactivada, los ficheros contienen solo el audio de la Entrada a la Salida y encajan uno tras otro. Consulta [Sincronización y bucles](wiki:timing-and-loops#entry-and-exit).

## La lista de exportación {#the-export-list}

Reúne cosas de lugares distintos para exportarlas juntas. Haz clic derecho en un slot, un grupo de tomas, una entrada del Índice, una línea de categoría o de sección, o un archivo, y elige **Añadir a la lista de exportación**. **Añadir a la lista de exportación** en el panel de exportación añade el elemento abierto con las opciones elegidas allí. **Lista de Exportación** en la barra de herramientas abre la lista. Cambia el nombre de una entrada para nombrar la carpeta a la que va, cambia qué guarda y qué audio, quita entradas y exporta todo como una sola tarea. La lista se conserva hasta que la vacíes.

## Colores {#colours}

- El **color primario** (amarillo Supertierra) rellena los botones principales y marca el audio sustituido, las ediciones y el proyecto.
- El **color secundario** (azul) se usa para la navegación y la información, como los enlaces, la pestaña abierta, la selección y el anillo de foco. En el tema claro, también se usa para texto, líneas y tintes que de otro modo irían en el color primario.
- El gris neutro marca el original.

Cambia los dos colores, el tema, el contraste y el **Modo nocturno** en [Ajustes ▸ Tema](app:settings/theme).
