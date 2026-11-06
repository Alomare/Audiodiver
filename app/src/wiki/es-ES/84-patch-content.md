---
title: Contenido del Parche
group: Generar y compartir
summary: Sustituir sonidos de un mod existente, sobre los propios bancos de sonido del mod, también sonidos que una actualización quitó del juego.
source: 120fdcca46f4
---

El parche de un mod guarda copias de los bancos de sonido que cambia, tal como estaban en la versión del juego para la que se hizo el mod, y el juego reproduce esas copias en lugar de los bancos actuales. **Contenido del Parche**, en [Herramientas](app:tools/content), abre un mod tal como está, muestra los sonidos de sus parches y vuelve a escribir el mod con audio nuevo para los sonidos elegidos. Todo lo demás se queda como lo tiene el mod.

## Cuándo usarlo {#when-to-use-it}

- Una actualización quitó un sonido del juego, y un mod hecho antes de la actualización todavía tiene ese sonido. La versión 7.2.2, por ejemplo, quitó el himno que sonaba mientras sube una bandera. Un proyecto y **Repatch** generan sobre los bancos de sonido actuales, que ya no tienen un sonido así, de modo que solo los bancos del mod antiguo pueden llevar audio nuevo para él.
- Unos pocos sonidos de un mod necesitan otro audio, y nada más del mod debe cambiar.

Para los sonidos que el juego aún tiene, un proyecto o [Repatch](wiki:repatching) es mejor opción: los dos generan sobre los bancos actuales, así que el mod sigue al juego.

## Abrir un mod {#opening-a-mod}

1. Abre [Herramientas](app:tools/content) y elige **Contenido del Parche**.
2. Suelta el mod en la página como ZIP, carpeta o fichero `.patch_0`, o pulsa **Elegir un ZIP o un fichero de parche** o **Elegir una carpeta**.

La lista empieza por los sonidos que el juego actual no tiene, marcados con **No está en el juego**. **Todos los Sonidos** muestra cada sonido del mod, y la búsqueda encuentra un sonido por su ID, su nombre o un banco. Cada fila reproduce el audio tal como lo tiene el mod y nombra los bancos del mod que tienen el sonido.

## Dar audio nuevo a los sonidos {#giving-sounds-new-audio}

- Suelta un fichero de audio sobre un sonido, o pulsa **Elegir Fichero** en la fila. **Silencio** sustituye el sonido por silencio.
- ✕ vuelve a quitar el audio nuevo.
- El audio nuevo va a cada banco y cada stream del mod que tiene el sonido. Un fichero se codifica como lo codifica una generación, y un `.wem` que el juego reproduce tal cual entra sin cambios.

## Escribir el mod {#writing-the-mod}

Elige el nombre que muestra el gestor de mods y una carpeta de destino, y pulsa **Escribir el Mod**. El nuevo ZIP es el mod tal como era: el manifiesto, las opciones, los otros ficheros y el ID del mod se conservan, así que importarlo en un gestor de mods actualiza el mod antiguo. Un mod sin manifiesto pasa a ser un ZIP para gestor de mods, con una opción para cada parte del mod.

Cada parche que tiene un sonido elegido se vuelve a escribir y se compara con el antiguo: solo cambian el audio de esos sonidos, los tamaños que lo describen y el tiempo de la música que lo reproduce.

## Qué saber {#what-to-know}

- Los bancos del mod se quedan como estaban en la versión del juego para la que se hizo el mod. Mientras el mod está instalado, el juego reproduce esos bancos en lugar de los actuales, así que lo que una actualización cambió en ellos no llega al juego. Consulta [Sonidos de una versión anterior del juego](wiki:repatching#sounds-from-an-older-game-version).
- Un mod hecho así sigue siendo obra del autor original. Resérvalo para uso personal y compártelo solo con permiso del autor.
