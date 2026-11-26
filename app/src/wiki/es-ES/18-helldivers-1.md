---
title: Mods de Helldivers 1
group: Primeros pasos
summary: Sustituir el audio de Helldivers 1: la elección del juego en Inicio, qué puede cambiar un proyecto y por qué un mod puede ocupar mucho.
source: 011a93bc722a
---

Los botones **Helldivers 1** y **Helldivers 2** de [Inicio](app:home) eligen el juego para el que Audiodiver crea mods. Audiodiver busca los dos juegos al arrancar, y la ventana se abre antes de que se hayan leído. Un botón se ve más oscuro, con flechas girando, mientras se lee el juego, y aparece tachado cuando no se ha encontrado. La línea bajo los botones indica cuál, con **Elegir carpeta** para un juego instalado en un lugar que Steam no lista. Se vuelve a elegir el último juego usado, o el otro si no se encuentra, y las pestañas y botones de ese juego aparecen en cuanto se ha leído.

Cada proyecto pertenece a un juego, y abrir un proyecto cambia a ese juego. Elegir el otro juego cierra el proyecto abierto.

## Empezar un proyecto {#starting-a-project}

1. Elige **Helldivers 1** en Inicio y pulsa **Nuevo proyecto**.
2. En la [Biblioteca](app:library), pulsa **+** en lo que quieras cambiar.
3. En la pestaña [Audio](app:editor), suelta un audio en un slot o elige un archivo.
4. En la pestaña [Generar](app:build), pulsa **Generar**. El ZIP se instala con [un gestor de mods para Helldivers 1](https://www.nexusmods.com/helldivers/mods/16), versión 1.1.0 o posterior.

## Qué puede cambiar un proyecto {#what-a-project-can-change}

Un slot puede tener audio nuevo o silencio. El audio nuevo puede tener **Make-Up Gain**, **Fundidos** e **Igualar sonoridad original**, y la generación los integra en el propio audio. El audio nuevo toma el formato, la frecuencia de muestreo y los canales del original, así que un archivo estéreo en un slot mono suena en mono.

Las pestañas Banda Sonora, Texto y Herramientas, **Importar mod**, los **Filtros**, las nuevas tomas y capas, y el Make-Up Gain sobre el audio original son solo para Helldivers 2.

## Obsidian {#obsidian}

La pestaña [Proyecto](app:project) define lo que Obsidian muestra con el mod: el nombre, la descripción y los autores, con comas entre los nombres.

Obsidian reconoce un mod por el **ID del mod**. Mientras el ID no cambie, una nueva generación actualiza el mod instalado. Para que las generaciones actualicen un mod que hiciste antes, pulsa **Cambiar** y pega el `id` del `obsidian.json` de ese mod. Un ID tiene letras minúsculas, dígitos, puntos, guiones y guiones bajos, como `name.mymod`. Cuando copies un proyecto para hacer un mod distinto, pulsa **Crear un ID nuevo**, y la copia se instala como un mod aparte.

## Audio de Helldivers 2 {#audio-from-helldivers-2}

La Biblioteca también muestra Helldivers 2. Selecciona slots allí y pulsa **Ctrl+C**, luego selecciona slots en la pestaña [Audio](app:editor) y pulsa **Ctrl+V**. El audio original entra como audio nuevo, y la generación lo ajusta al slot como cualquier otro archivo. La copia también funciona al revés, de Helldivers 1 a un proyecto de Helldivers 2.

## Idiomas y tamaño {#languages-and-size}

Algunos sonidos tienen una pestaña por idioma, con slots separados. El audio nuevo en un idioma solo suena en ese idioma.

Un mod lleva solo el audio nuevo, así que el ZIP sigue siendo pequeño. Desde la versión 1.4.0, el gestor de mods pone los clips nuevos en bancos de sonido pequeños junto a los del juego, y los bancos de sonido del propio juego se quedan como están, así que un despliegue ocupa en disco más o menos lo mismo que el audio nuevo. Un idioma al que el mod no da audio nuevo conserva los sonidos del juego, que el despliegue copia: unos 4 MB para una pisada en inglés de EE. UU. Tras una actualización del juego, despliega de nuevo: el mod sigue como está. Los mods de Helldivers 1 necesitan la versión 1.1.0 o posterior del gestor de mods. Antes de la 1.4.0, reconstruye cada banco de sonido que cambia el mod, y un sonido corto en un banco de sonido grande puede ocupar unos 3 GB de disco mientras está desplegado.
