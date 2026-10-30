---
title: Un primer mod
group: Primeros pasos
summary: Desde un proyecto vacío hasta música nueva en el juego, en nueve pasos.
source: 42abc2715a07
---

Esta página recorre cómo sustituir la música de la pantalla de equipamiento y oír el resultado en el juego, instalado con un gestor de mods.

1. En [Inicio](app:home), elige **Nuevo proyecto** y ponle un nombre al proyecto. Audiodiver crea una carpeta para él, con el fichero del proyecto dentro, en la carpeta de proyectos (al principio `Documents\Audiodiver\Projects`). Se abre la pestaña [Proyecto](app:project) con el nombre, el icono y la carpeta del mod. Copia los ficheros de audio en esa carpeta.
2. Ve a la [Biblioteca](app:library). En el Índice, abre **Antes del despliegue** en Música y pulsa ▶ junto a **Selección de equipamiento** para oírla.
3. Haz clic en **Selección de equipamiento**. Tiene un segmento de inicio seguido de catorce bucles que el juego reproduce en orden. En el juego, la pantalla de equipamiento llega después de la pantalla de ubicación de despliegue y la música continúa desde ahí en los bucles, así que el inicio apenas se oye. Pulsa **Añadir al proyecto**.
4. Ve a la pestaña [Audio](app:editor) y haz clic en **Selección de equipamiento** en la lista.
5. Arrastra los ficheros de audio desde el Explorador de archivos hasta la pieza de la lista, o hasta el primer slot de la pieza. Los slots se rellenan en orden de nombre de fichero, así que nombra los ficheros `01 …`, `02 …` y así sucesivamente.
6. Selecciona un slot y pulsa ▶ en cada mitad de la fila. La mitad izquierda reproduce el original y la derecha reproduce la sustitución. Al cambiar de una a otra se mantiene la posición de reproducción. Las formas de onda de debajo muestran ambos en una misma escala de tiempo.
7. Pulsa el botón amarillo {icon:through} **Reproducción continua** que hay sobre los slots. Reproduce la pieza entera con los mismos traspasos entre segmentos que usa el juego, y selecciona cada slot a medida que suena.
8. En [Proyecto](app:project), ponle un nombre y un icono al mod.
9. Pulsa **Generar**. Importa el ZIP en un gestor de mods, despliégalo e inicia el juego.

> [!TIP]
> Escucha en el juego con los ajustes de volumen normales, en los momentos que has cambiado. El juego baja la música en algunas pantallas. Consulta [Make-Up Gain y la mezcla](wiki:volume) para más detalles.

## Siguientes pasos {#next-steps}

- Añade más cosas desde la Biblioteca. Una pieza con varias partes tiene {icon:fillpiece} **Rellenar la pieza entera**, que toma ficheros para todas las partes a la vez.
- Las armas, los enemigos, las voces y otros sonidos también están en el Índice. Consulta [Sonidos y voces](wiki:sounds-and-voices).
- {icon:slice} **Cortar una canción** corta una canción larga en trozos que se reproducen sin cortes. Consulta [Sincronización, puntos de cue y bucles](wiki:timing-and-loops).
- Después de un cambio, genera de nuevo e importa el ZIP nuevo. El gestor de mods actualiza el mod instalado. Consulta [Generar e instalar](wiki:build-and-install).
