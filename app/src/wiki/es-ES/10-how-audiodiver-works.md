---
title: Cómo funciona Audiodiver
group: Primeros pasos
summary: Qué hace Audiodiver, qué es un proyecto y para qué sirve cada pestaña.
source: e97884655776
---

Audiodiver sustituye el audio de Helldivers 2 según **qué es y dónde suena**. Busca una pieza de música o un conjunto de sonidos en la Biblioteca, añádela a un proyecto y dale audio nuevo. Audiodiver calcula entonces los bancos de sonido, los ID y los valores de tiempo que necesita el juego.

[El audio del juego, explicado](wiki:game-audio) trata los archivos, los bancos, las tomas, los cues, los segmentos y los slots. [Cómo leer la pantalla](wiki:reading-the-screen) describe cada parte de la ventana.

## Proyectos {#projects}

Un proyecto es una carpeta con el nombre del proyecto que contiene un fichero `.audi`. El fichero registra qué cambia el mod, qué ficheros sustituyen a qué clips, y el Make-Up Gain y los tiempos. Los ficheros de audio están en esa carpeta, o el proyecto guarda sus rutas. [Carpetas del proyecto](wiki:project-folders) explica qué contiene.

Los cambios se guardan automáticamente, al hacerlos o cada pocos minutos ([Guardado automático](wiki:how-audiodiver-works#autosave)). {key:save} guarda en cualquier momento y {key:undo} deshace el último cambio.

Audiodiver nunca escribe en la carpeta del juego. Lee el audio del juego de la biblioteca de Steam, o de otra carpeta elegida en **Juego**, dentro de [Ajustes](app:settings/system). Una generación produce un ZIP que un gestor de mods importa e instala.

## Las pestañas {#the-tabs}

La barra de pestañas de la parte superior de la ventana contiene las pestañas principales. Inicio y Herramientas van primero. La banda más oscura que va después contiene las pestañas del proyecto abierto, en el orden en que se hace un mod, empezando por Proyecto, que muestra el icono del proyecto. Generar va después de la banda y aparece mientras hay un proyecto abierto. Pasa el puntero por una pestaña para ver qué contiene y su atajo. **Barra de pestañas** en [Ajustes ▸ Tema](app:settings/theme) mueve la barra a otro lado de la ventana y muestra u oculta los nombres de las pestañas.

- {icon:home} **Inicio** crea un proyecto nuevo o abre uno, y lleva a Repatch y a Combinar.
- {icon:tools} **Herramientas** trabaja con mods existentes, sin proyecto. [Repatch](wiki:repatching) reconstruye un mod para la versión actual del juego, y [Combinar Mods](wiki:combining-mods) crea un mod a partir de varios. Ambas herramientas producen un ZIP nuevo.
- {icon:project} **Proyecto** contiene el nombre, la descripción, el icono y el ID del mod, las pestañas que muestra el proyecto y la carpeta del proyecto, con **Importar parches** y **Cerrar proyecto** sobre el icono. Sin ningún proyecto abierto, enumera los proyectos recientes. La pestaña muestra el icono y el nombre del proyecto.
- {icon:library} **Biblioteca** enumera todo lo que reproduce el juego, para poder encontrarlo y escucharlo. Explorar no cambia nada. **Añadir al proyecto** pone una entrada en el proyecto. **Índice** ordena el audio que tiene nombre, y **Todos los Archivos** enumera todos los archivos que contienen audio.
- {icon:audio} **Audio** muestra los slots de aquello con lo que trabaja el proyecto. Aquí los slots reciben audio nuevo.
- {icon:soundtrack} **Banda Sonora** define cómo se reproduce cada pieza de música: en el orden original, como una sola canción, como lista de reproducción o en silencio. Consulta [Banda Sonora](wiki:soundtrack).
- {icon:text} **Texto** contiene todo el texto del juego en todos los idiomas, incluidos los subtítulos. Consulta [Texto y subtítulos](wiki:text).
- {icon:build} **Generar** contiene la próxima versión, las **Opciones de generación** y el botón **Generar**. Un punto en la pestaña indica que el proyecto aún no se ha generado, o que ha cambiado o el juego se ha actualizado desde la última generación. Un número rojo cuenta los problemas que impiden generar.
- {icon:updates} **Actualizaciones**, {icon:wiki} **Wiki** ({key:wiki}) y {icon:settings} **Ajustes** están al final de la barra de pestañas. Actualizaciones se resalta cuando hay una versión nueva de Audiodiver y enumera los cambios de cada versión. En una página de la Wiki, {key:search} busca palabras en esa página.

El botón {icon:detach} junto al cuadro de búsqueda de las guías mueve la Wiki a una ventana aparte, para leerla junto a un proyecto. La pestaña Wiki muestra entonces **Volver a acoplar la Wiki**, y cerrar la ventana hace lo mismo. Mientras la Wiki está en esa ventana, un **?** o un enlace a una página se abre allí. Al iniciar un tutorial, la Wiki se acopla de nuevo antes.

El número de versión del extremo derecho de la barra de estado también abre Actualizaciones. El botón {icon:info} de al lado abre [Acerca de](app:about), con la licencia, el fichero de registro y los créditos.

El título de la ventana es el nombre del proyecto abierto.

La Biblioteca y la pestaña Audio comparten la misma disposición, y las dos tienen {icon:export} **Exportar**. Busca algo en la Biblioteca y trabaja con ello en la pestaña Audio.

## Pestañas {#tabs}

Audio, Banda Sonora y Texto se pueden ocultar. Desmárcalas en **Pestañas**, dentro de [Ajustes ▸ Sistema](app:settings/system), por ejemplo para dejar solo Texto en un mod que cambia subtítulos. Un proyecto nuevo empieza con las pestañas que muestra Ajustes. Después cada proyecto puede elegir otras en **Pestañas**, en la pestaña [Proyecto](app:project), y conserva esa elección. Ocultar una pestaña no quita nada, y lo que se cambió en ella se queda en el mod.

## Versiones nuevas de Audiodiver {#new-versions-of-audiodiver}

Audiodiver busca una versión nueva en GitHub cada vez que se inicia. [Ajustes ▸ Sistema](app:settings/system) controla qué ocurre cuando hay una:

- **Preguntar al iniciar** (el valor predeterminado) pregunta antes, con **Actualizar ahora**, **Leer el registro de cambios** y **Ahora no**.
- **Manual** no pregunta. La pestaña Actualizaciones y la versión de la barra de estado se resaltan, y **Actualizar ahora** está en la pestaña Actualizaciones.
- **Automático** instala la versión nueva al iniciar y reinicia Audiodiver.

Una actualización reemplaza solo la aplicación. Los proyectos, los ficheros de audio y los ajustes se conservan.

## Ajustes {#settings}

### Idioma {#language}

**Idioma** en [Ajustes ▸ Sistema](app:settings/system) define el idioma de la ventana y de los mensajes que muestra Audiodiver. **Automático** toma el idioma al que está configurado Helldivers 2 en Steam. Si Audiodiver no tiene traducción para ese idioma, Automático toma el de Windows y, si tampoco, el inglés. Tras un cambio, la ventana se vuelve a cargar en el idioma nuevo, en la misma pestaña. Los subtítulos y las frases del juego se quedan como están, y la pestaña Texto sigue eligiendo en qué idioma del texto del juego se edita.

### Carpeta del juego {#game-folder}

**Juego** en [Ajustes ▸ Sistema](app:settings/system) muestra la carpeta desde la que Audiodiver lee el juego. Audiodiver la encuentra a través de Steam. Si el juego está en otro sitio, pulsa **Elegir otra carpeta** y elige la carpeta de instalación de Helldivers 2, o la carpeta `data` que contiene. Audiodiver vuelve entonces a leer el juego, lo que tarda alrededor de un minuto la primera vez. Solo lee de esta carpeta y nunca escribe en ella.

### Arranque {#startup}

Con **Abrir el último proyecto al iniciar Audiodiver** activado, Audiodiver abre el último proyecto en la pestaña Audio. Con la opción desactivada, Audiodiver empieza en Inicio.

### Inicio {#home}

Con **Mostrar el teletipo de noticias** desactivado, Inicio no muestra la franja de noticias de la guerra en la parte inferior, y las noticias no se cargan.

### Guardado automático {#autosave}

**Guardado automático** define cuándo se guardan los cambios en el fichero del proyecto. **Con cada cambio**, el valor predeterminado, guarda cada cambio al hacerlo. **Con temporizador** guarda cada 1 a 30 minutos, y hasta entonces la barra de estado dice *Cambios sin guardar*. Una generación, cerrar el proyecto y cerrar Audiodiver guardan antes los cambios. {key:save} guarda en cualquier momento.

### Notificaciones {#notifications}

**Esquina**, en **Notificaciones** dentro de [Ajustes ▸ Sistema](app:settings/system), define la esquina de la ventana donde aparecen los avisos. **Abajo a la derecha** es el valor predeterminado.

### Notas globales {#global-notes}

**Notas globales** en [Ajustes ▸ Sistema](app:settings/system) muestra el fichero de notas, que empieza en la carpeta de ajustes de Audiodiver. **Elegir otra carpeta** guarda las notas en otra, como una carpeta sincronizada entre dos ordenadores. Cuando esa carpeta ya tiene un fichero de notas, las notas que contiene y estas se unen, y si algo tiene una nota distinta en cada una se conservan los dos textos. **Usar la carpeta predeterminada** vuelve a la carpeta original. El fichero de la carpeta anterior se queda como estaba.

**Exportar notas** guarda las notas globales, las notas del proyecto abierto o ambas, ya sea como un documento Markdown para leer, con cada nota bajo el nombre de aquello a lo que pertenece, o como un fichero de notas JSON. **Importar notas** trae a las notas globales las notas de un fichero JSON de ese tipo, o de un fichero de proyecto.

### Espacio en disco {#disk-space}

Audiodiver guarda copias preparadas del audio para no preparar dos veces el mismo audio. **Vistas previas** son los originales decodificados, las formas de onda y los renderizados de la reproducción continua. **Audio codificado** es el audio nuevo convertido para el juego, que reutilizan las generaciones. Se puede borrar cualquiera de los dos sin riesgo. Audiodiver vuelve a preparar las copias cuando hacen falta. Los proyectos y los ficheros de audio nunca se guardan ahí.
