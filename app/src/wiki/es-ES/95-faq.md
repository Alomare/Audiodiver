---
title: Preguntas Frecuentes
group: Preguntas Frecuentes
summary: Respuestas breves a preguntas habituales, cada una con un enlace a la página que las trata por completo.
source: 09dda6069291
---

## Encontrar audio {#finding-audio}

### ¿Qué precisión tiene el Índice de la Biblioteca? {#how-accurate-is-the-library-index}

La música es la parte más fiable. Helldivers 2 nombra los estados que eligen la música, como la pantalla, el enemigo y si hay un combate en curso, y el Índice ordena la música según esos nombres. Los conjuntos de sonidos, las armas y las etiquetas de los clips proceden de investigaciones de la comunidad de modding, enumeradas en [Acerca de ▸ Créditos](app:about), y algunos de esos nombres son suposiciones fundadas. Las frases reciben el nombre del subtítulo que coincide con sus palabras, y una línea cuyo subtítulo no es seguro dice **uno de varios**.

Una secuencia sin nombre aparece como *Secuencia 3* o *Toma 2*. [El audio del juego, explicado](wiki:game-audio#why-many-things-are-called-sequence-3-or-take-2) explica por qué. Para informar de un nombre erróneo o ausente, usa el formulario [Nombre erróneo o ausente](https://github.com/Alomare/Audiodiver/issues/new?template=wrong_name.yml) en GitHub.

### ¿Cómo sabe Audiodiver qué música suena en cada situación? {#how-does-audiodiver-know-what-music-plays-in-which-scenario}

El juego elige la música con estados con nombre: la nave, el despliegue, la facción enemiga, la exploración, una batalla y lo intensa que es. Audiodiver lee esos estados y las reglas que pasan de uno a otro desde los bancos de sonido, y enumera la música en el orden en que se encuentra en una misión, desde *En la nave* hasta *Créditos*. La música que ningún estado ubica aparece en *Aún sin identificar*. Las transiciones se nombran por lo que conectan, y los stingers por aquello sobre lo que suenan. El orden dentro de una pieza de música sale de la lista de reproducción de la pieza, que muestra la [Banda Sonora](wiki:soundtrack).

### ¿Qué son los slots, los segmentos y las tomas? {#what-are-slots-segments-and-takes}

Un **slot** es un clip que se puede sustituir. La música se compone de **segmentos** que suenan uno tras otro, cada uno con uno o más slots. Un sonido tiene **tomas** y reproduce una cada vez. [El audio del juego, explicado](wiki:game-audio) tiene el glosario completo.

## Crear un mod {#making-a-mod}

### ¿Cómo puedo añadir audio nuevo a segmentos existentes? {#how-can-i-add-new-audio-to-existing-segments}

Suelta un fichero de audio en el slot de un segmento en la pestaña [Audio](app:editor). El audio nuevo sustituye al original, y los tiempos del segmento siguen la duración nueva ([Sincronización, puntos de cue y bucles](wiki:timing-and-loops#fitting-the-timing-to-the-new-audio)). Varios ficheros soltados en una pieza rellenan los slots en orden de reproducción. Para poner una canción en toda una pieza, usa **Cortar una canción**, o **Una canción** en la [Banda Sonora](wiki:soundtrack#one-song). Para una lista de reproducción de canciones enteras, usa allí **Lista de reproducción**.

La música no puede recibir tomas ni capas adicionales. Esas son para sonidos y voces, consulta [Añadir audio](wiki:adding-audio).

### ¿Por qué mi canción suena desordenada en el juego? {#why-does-my-song-play-out-of-order-in-game}

El juego rara vez reproduce una pieza de música de arriba abajo. La mayor parte de la música de combate abre cada combate con una intro corta, elige algunos segmentos al azar y continúa desde donde se detuvo el último combate. La [Banda Sonora](wiki:soundtrack) muestra el orden de reproducción de cada pieza, y **Una canción** hace que cada combate reproduzca la canción desde el principio. [Cómo reproduce el juego la música](wiki:how-the-game-plays-music) explica las partes.

### ¿Por qué sigo oyendo el audio original? {#why-do-i-still-hear-the-original-audio}

Normalmente es una de estas razones:

- Una capa del segmento sigue reproduciendo el original. [Capas](wiki:how-the-game-plays-music#layers) explica cómo silenciarla.
- El slot suena solo bajo una condición, como un bioma, y otra variante suena en otro sitio ([Variantes](wiki:how-the-game-plays-music#variants)).
- Una transición original suena entre dos piezas de música nueva ([Transiciones y stingers](wiki:how-the-game-plays-music#transitions-and-stingers)).
- Un sonido tiene varias tomas y algunas siguen siendo originales. Sustitúyelas todas.
- El sonido también está en bancos que el proyecto no incluye. **Parchear todos los bancos con los sonidos**, en la pestaña Generar, los cubre ([Todos los bancos con los sonidos](wiki:build-and-install#every-bank-with-the-sounds)).

### ¿Qué ficheros de audio puedo usar? {#which-audio-files-can-i-use}

WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF, WMA y WEM. WAV o FLAC a 48 kHz da el mejor resultado, y un WEM en Wwise Vorbis entra en el mod sin cambios. Consulta [Preparar el audio](wiki:preparing-audio#formats).

### ¿Cómo subo o bajo el volumen del audio nuevo? {#how-do-i-make-new-audio-louder-or-quieter}

Define **Make-Up Gain** en el slot, en los detalles de la derecha. Varios slots seleccionados toman un solo valor, y el **Nivel** de una pieza en la Banda Sonora sube o baja toda la pieza. [Make-Up Gain y la mezcla](wiki:volume) trata los niveles, y [Preparar el audio](wiki:preparing-audio#loudness), la sonoridad que conviene buscar.

### ¿Cómo silencio un sonido o una pieza de música? {#how-do-i-silence-a-sound-or-a-piece-of-music}

Haz clic derecho en un slot y elige **Sustituir por silencio**. **Mantener la duración original** define si el juego espera la duración original o pasa de inmediato a lo siguiente ([Silencio](wiki:how-the-game-plays-music#silence)). Una pieza de música entera se queda en silencio con **Silencio** en la [Banda Sonora](wiki:soundtrack#modes).

### ¿Puedo cambiar subtítulos y otros textos? {#can-i-change-subtitles-and-other-text}

Sí, en la pestaña [Texto](app:text): todas las líneas en todos los idiomas, con colores, tamaños y énfasis. Consulta [Texto y subtítulos](wiki:text).

## Generar y compartir {#building-and-sharing}

### ¿Audiodiver cambia los ficheros del juego? {#does-audiodiver-change-the-game-files}

No. Solo lee la carpeta del juego. Una generación crea un ZIP que un gestor de mods importa y despliega ([Generar e instalar](wiki:build-and-install#installing)).

### ¿Qué hago después de una actualización del juego? {#what-do-i-do-after-a-game-update}

Abre el proyecto y genéralo de nuevo, e importa después el ZIP nuevo en el gestor de mods ([Cuando el juego se actualiza](wiki:game-updates#rebuild)). Un mod hecho por otra persona se puede reconstruir para el juego actual con [Repatch](wiki:repatching).

### ¿Puede mi mod funcionar con otros mods de audio? {#can-my-mod-run-with-other-audio-mods}

Dos mods que cambian el mismo banco de sonido no se combinan, y gana el que se despliega más tarde ([Dos mods que cambian el mismo banco](wiki:build-and-install#two-mods-that-change-the-same-bank)). [Combinar Mods](wiki:combining-mods) los construye en un solo mod.

### ¿Por qué mi mod ocupa tanto? {#why-is-my-mod-so-big}

Un mod lleva una copia completa de cada banco de sonido que cambia. La música está en el banco de música de cada misión, y algunos sonidos están en cien bancos, así que sustituirlos añade todas las copias ([Todos los bancos con los sonidos](wiki:build-and-install#every-bank-with-the-sounds), [Tamaño](wiki:adding-audio#size)).

### ¿Cómo muevo un proyecto a otro ordenador? {#how-do-i-move-a-project-to-another-computer}

**Exportar como paquete**, en la pestaña Proyecto, guarda el proyecto y todos los ficheros que usa como un único fichero `.audipack`. Ábrelo en el otro ordenador ([Carpetas del proyecto](wiki:project-folders)).

### ¿Cómo comparto mi mod? {#how-do-i-share-my-mod}

Sube el ZIP de la carpeta de generación. [Compartir un mod](wiki:sharing) indica qué incluir y qué dejar fuera.
