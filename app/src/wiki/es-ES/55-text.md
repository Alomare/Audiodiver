---
title: Texto y subtítulos
group: Crear un mod
summary: Cómo cambiar subtítulos y cualquier otra línea del texto del juego en la pestaña Texto, con palabras, colores y tamaños, y qué conservar intacto.
source: 2248a591284e
---

La pestaña [Texto](app:text) tiene todas las líneas del texto del juego en todos los idiomas, incluidos los subtítulos de las frases, el texto de misiones y menús, y los nombres. Busca una línea para cambiarla, y el mod incluye el cambio.

## Encontrar una línea {#finding-a-line}

Elige primero el **idioma**. Cada idioma es una tabla distinta, así que un cambio en *Inglés (EE. UU.)* no cambia *Inglés (Reino Unido)* ni *Francés*. Luego busca una palabra de la línea, o pega el ID de la línea. **Cambiado** enumera las líneas que cambia el proyecto.

Cada fila indica si la línea es un **Subtítulo** u otro **Texto**. El panel derecho muestra el **Original**, debajo el cuadro **Texto nuevo** y una **Vista previa** de la línea tal como se muestra en el juego.

## Cambiar una línea {#changing-a-line}

Escribe en **Texto nuevo**. El cambio se guarda poco después de dejar de escribir, o de inmediato con {key:save}, y cada guardado es un paso para {key:undo}. **Restaurar el original** devuelve la línea original.

Para dar formato a parte de una línea, selecciona las palabras y usa la barra sobre el cuadro. Tiene **Color**, **Tamaño** y **Énfasis**, y **Sincronización** para los subtítulos. Sin nada seleccionado, un botón da formato a toda la línea. **Borrar el formato** quita todos los colores, tamaños y estilos.

[Dar formato al texto](wiki:formatting-text) describe cada formato, con ejemplos que puedes copiar.

## Qué conservar {#what-to-keep}

- **Sincronización del subtítulo.** Un subtítulo empieza con marcas de tiempo como `{0.00->3.85}`, que definen cuándo aparecen y desaparecen las palabras, en segundos desde el inicio de la frase. Una línea larga tiene varias marcas. Consérvalas y cambia los tiempos si el audio nuevo tiene otra duración. **Sincronización** añade una marca en el cursor.
- **Palabras que rellena el juego.** Las palabras en mayúsculas después de `#`, como `#COUNT` o `#NAME`, se sustituyen en el juego cuando se muestra la línea. El editor avisa si falta alguna.
- **Colores que rellena el juego**, como `<c=#PLAYER_COLOR>`. Déjalos sin cambios.
- **Los corchetes** de los subtítulos, como *[Grunts]*, marcan sonidos que no son palabras.

## Cómo se construye el texto {#how-text-is-built}

Un mod contiene tablas de texto enteras. Una generación toma cada tabla del juego instalado y mete en ella las líneas del proyecto. Esto tiene dos consecuencias:

> [!WARNING]
> **Usa un solo mod de texto por tabla e idioma.** Si dos mods cambian líneas de la misma tabla, sus cambios no se combinan. El mod que el gestor de mods despliega más tarde sustituye a la otra copia de la tabla.

> [!NOTE]
> **Genera de nuevo después de una actualización del juego.** Un mod generado contiene la tabla tal como estaba en el momento de generarlo, así que las líneas que el juego añade o reescribe después quedan ocultas tras ella. Una generación nueva toma la tabla nueva y vuelve a meter en ella las líneas del proyecto. Si el juego reescribió una línea que cambia el proyecto, la pestaña Texto muestra una advertencia.

## Subtítulos de las frases {#subtitles-of-voice-lines}

Los ficheros del juego no vinculan las frases con los subtítulos. Audiodiver las emparejó según lo que dice cada línea y lo que dura. Selecciona una frase y haz clic en el enlace **Subtítulo** para abrir aquí el subtítulo.

A menudo varios subtítulos tienen las mismas palabras. Por ejemplo, el juego tiene 32 subtítulos que dicen *Reloading.* En muchos de ellos, la duración de la grabación no basta para distinguirlos. Una línea así se marca como **uno de varios**. La pestaña Texto enumera todos los subtítulos con esas palabras y abre el más probable. Cambia todos para asegurarte de que aparecen las palabras nuevas.
