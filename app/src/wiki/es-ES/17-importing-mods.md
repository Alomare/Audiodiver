---
title: Importar un mod
group: Primeros pasos
summary: Un mod hecho con cualquier herramienta, como un proyecto con el que seguir trabajando: el audio, los sonidos que añade, los ajustes y el texto.
source: bca2c39520e7
---

**Importar mod** en [Inicio](app:home), o en la pestaña [Proyecto](app:project) mientras no hay ningún proyecto abierto, crea un proyecto nuevo a partir de un mod existente. Elige el ZIP del mod, o un fichero `.patch_0`. El panel que se abre muestra el mod como lo muestra un gestor de mods, y enumera lo que se importa antes de escribir nada.

## Opciones, nombre y carpeta {#options-name-and-folder}

1. Elige las opciones. Un mod con opciones, como una selección de voces o una versión con subtítulos, empieza con las opciones que tiene activadas el gestor de mods, o con todas. **Qué se importa** enumera los parches que despliegan esas opciones.
2. Pon un nombre al proyecto y elige la carpeta. El proyecto va a una carpeta nueva dentro de ella.
3. **Conservar el ID del mod** hace que las generaciones del proyecto actualicen este mod en el gestor de mods. Desactívalo para instalar las generaciones junto al mod como otro distinto ([ID del mod](wiki:build-and-install#mod-id)).
4. **Usar el icono del mod** pone en el proyecto la imagen que muestra el gestor de mods. Sin ella, el proyecto tiene el icono predeterminado.
5. Pulsa **Crear proyecto**. El proyecto se abre en la pestaña Audio cuando termina la importación.

## Qué se importa {#what-comes-in}

- El audio que sustituye el mod, en los mismos sonidos. Entra en las generaciones sin volver a convertirse.
- El audio que añade el mod: tomas nuevas de un sonido, un sonido nuevo que suena junto a uno existente (una capa) o un clip aparte para un sonido. Cada uno se convierte en el mismo tipo de adición que hace [Añadir audio](wiki:adding-audio).
- El Make-Up Gain, en los slots de los sonidos a los que llega, también cuando el mod lo define en un contenedor que está por encima de ellos. Un slot tiene una sola ganancia, así que cuando el mod da ganancias distintas a dos sonidos que reproducen el mismo clip, esas ganancias se quedan en los sonidos, con los demás ajustes.
- Otros ajustes de sonido, como el volumen o el tono de un sonido o de un contenedor, o un retardo antes de que suene. Las generaciones los incluyen, y el panel de detalles de la pestaña Audio los enumera en **Ajustes importados** en cada slot al que llegan.
- Los puntos de cue de los segmentos de música a los que el mod da audio nuevo.
- Las líneas del texto del juego que cambia el mod, como subtítulos o nombres.

Los modelos, las texturas y otros ficheros que no son audio ni texto se quedan fuera, porque un proyecto contiene solo audio y texto. Tampoco se importan otros tipos de cambio, como los efectos o cómo elige sonidos un contenedor. La importación enumera lo que se dejó fuera.

## Texto {#text}

El texto entra como cambios en la pestaña [Texto](app:text), uno por cada línea que cambia el mod. Un mod lleva tablas enteras de texto, así que un mod hecho para una versión anterior del juego lleva también el texto de esa versión. Esas líneas aparecen como cambios incluso donde solo cambió el juego, como un enemigo que cambió de nombre en una actualización. El panel enumera cada línea con el texto del mod encima del texto actual. Desmarca las líneas que solo cambió el juego, una por una o un grupo a la vez.

## En el proyecto abierto {#into-the-open-project}

**Importar parches**, en la pestaña Proyecto, o un fichero `.patch_0` soltado en la ventana, trae un mod al proyecto abierto. Se abre el mismo panel, sin el nombre y la carpeta. Si el proyecto no está vacío, elige cómo entra el audio. **Añadir al proyecto** conserva el contenido actual, y donde ambos tienen audio para un slot, entra el audio del mod. **Sustituir el audio del proyecto** quita primero el audio nuevo, los sonidos añadidos, los puntos de cue y la lista. El texto y los ficheros de audio se quedan en ambos casos, y Deshacer restaura el proyecto.

Para reconstruir un mod para la versión actual del juego sin un proyecto, usa [Repatch](wiki:repatching).
