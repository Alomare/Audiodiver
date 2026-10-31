---
title: Preparar el audio
group: Crear un mod
summary: Qué ficheros usar, a qué volumen dejarlos y cómo cortarlos para que encajen en el juego.
source: cb164f9ebd07
---

## Formatos {#formats}

Audiodiver lee WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF, WMA y WEM. Una generación convierte cada fichero al formato que reproduce el juego, Vorbis a 48 kHz en estéreo. Los ficheros mono se quedan en mono, y los envolventes se mezclan a estéreo.

Un fichero WEM en Wwise Vorbis, mono o estéreo, entra en el mod sin cambios, porque el juego lo reproduce tal cual. Una generación convierte cualquier otro fichero WEM como los formatos anteriores.

Parte de la mejor copia que tengas. **WAV o FLAC a 48 kHz** pasa por una sola conversión. Un MP3 también sirve, pero se comprime por segunda vez, lo que puede añadir una ligera neblina a los platos y a las colas de reverberación.

## Sonoridad {#loudness}

La música del juego está en torno a **−13 a −15 LUFS** (sonoridad integrada). La música a ese nivel encaja con los efectos y las voces sin más cambios.

- Mide la sonoridad con un medidor de sonoridad. La altura de la forma de onda es una mala guía. [Herramientas y enlaces](wiki:tools-and-links) enumera medidores gratuitos.
- Mantén los picos por debajo de unos **−1 dBTP** para que la conversión no sature.
- Si un slot sigue sonando demasiado bajo o demasiado alto en el juego, cambia el Make-Up Gain del slot en lugar de exportar el fichero otra vez. Consulta [Make-Up Gain y la mezcla](wiki:volume).

## Duración y cortes {#length-and-cuts}

- Recorta el silencio del principio de cada fichero. El juego empieza un clip en la primera muestra, así que una preentrada silenciosa suena como un hueco.
- Una pieza que se repite en bucle debe terminar en un punto desde el que pueda volver a empezar. Un fundido de salida hace audible el punto del bucle.
- Deja una cola natural al final. El audio posterior al punto de *Salida* de un segmento suena sobre el segmento siguiente. Consulta [Sincronización, puntos de cue y bucles](wiki:timing-and-loops).
- Nombra los ficheros de una pieza en orden de reproducción, como `01 Intro` y `02 Loop`. Los rellenados siguen el orden de nombre de fichero, que pone `2` antes que `10`.

## Dónde guardar los ficheros {#where-to-keep-the-files}

Guarda el audio en la carpeta del proyecto. Los ficheros de otras carpetas también sirven, y **Reunir ficheros**, en la pestaña [Proyecto](app:project), los copia en `audio\added`. Las rutas se guardan relativas a la carpeta del proyecto, de modo que toda la carpeta se puede mover o copiar. Generar enumera un fichero que falta como un problema y no genera hasta que se arregla.
