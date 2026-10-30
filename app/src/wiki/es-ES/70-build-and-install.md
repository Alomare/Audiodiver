---
title: Generar e instalar
group: Generar y compartir
summary: Qué crea una generación, cómo instalarla con un gestor de mods y cómo llegan las actualizaciones al mod instalado.
source: 518c0af357e6
---

## Generar {#building}

En [Generar](app:build), pulsa **Generar** ({key:build}). Audiodiver convierte el audio nuevo para el juego y parchea los bancos de sonido que contienen o reproducen los sonidos sustituidos ([cuáles](#every-bank-with-the-sounds)). Luego comprueba el resultado y lo empaqueta en un ZIP con el nombre del mod y la versión.

Generar no cambia el proyecto, los ficheros de audio ni el juego.

Si el proyecto tiene problemas, como un fichero que falta o un nombre que los gestores de mods no pueden usar, el botón Generar está desactivado. La pestaña enumera los problemas sobre el botón.

### Carpeta de destino {#destination-folder}

El ZIP va a la carpeta `build` junto al fichero del proyecto. Para generar en otra carpeta, pulsa **Cambiar** en **Carpeta de destino**. **Volver al valor predeterminado** vuelve a la carpeta `build`. Una generación añade solo el ZIP, y los [ficheros de parche](#patch-files) cuando los activas, así que varios mods pueden compartir una carpeta. Audiodiver no genera en la carpeta del juego.

## Lo que muestra el gestor de mods {#what-the-mod-manager-shows}

La pestaña [Proyecto](app:project) muestra una vista previa del icono, el nombre y la descripción tal como los presenta un gestor de mods.

### Nombre y descripción {#name-and-description}

Usa solo letras, dígitos y espacios en el nombre, y deja fuera la versión. El gestor de mods conserva el nombre de la primera importación, así que elígelo antes de compartir el mod. La descripción es opcional y aparece con el mod.

### Versión {#version}

**Próxima versión** es el número del nombre del ZIP siguiente. Sube una unidad después de cada generación, salvo que **Subir la versión después de cada generación** esté desactivado.

### Icono {#icon}

El icono es el icono predeterminado de Audiodiver hasta que eliges una imagen. Una imagen se recorta a un cuadrado alrededor del centro y se redimensiona a 540 × 540, el tamaño que usan los gestores de mods. También puedes soltar una imagen en la vista previa. **Borde**, **Color del borde** y **Esquinas** enmarcan el icono, el predeterminado o el elegido.

### ID del mod {#mod-id}

Un gestor de mods reconoce un mod por el ID del mod. Mientras el ID sigue igual, una generación nueva actualiza el mod instalado. Cuando copias un proyecto para crear un mod distinto, pulsa **Crear un ID nuevo**, y la copia se instala como un mod aparte.

Para hacer que las generaciones actualicen un mod que hiciste antes, pulsa **Cambiar** y pega el ID de ese mod: el `Guid` del `manifest.json` del mod. Deshacer devuelve el ID anterior.

## Opciones de generación {#build-options}

Estos ajustes están en **Opciones de generación**, en la pestaña Generar.

- **Subir la versión después de cada generación** da a cada generación un nombre de ZIP nuevo, y los ZIP anteriores se conservan. Con la opción desactivada, la siguiente generación reemplaza el último ZIP. El [ID del mod](wiki:build-and-install#mod-id), y no la versión, decide si un gestor de mods toma una generación como una actualización. El ajuste se aplica a todos los proyectos.
- **Mostrar el ZIP en el Explorador de archivos al terminar de generar** abre el Explorador de archivos con el ZIP seleccionado.

### Ficheros de parche {#patch-files}

**Guardar también los ficheros de parche en una carpeta** pone los ficheros de parche del mod junto a cada ZIP, en una carpeta con el mismo nombre que el ZIP. Son el fichero `.patch_0` y, cuando el mod tiene audio en stream, el fichero `.patch_0.stream`. Úsalos para empaquetar el mod tú mismo, por ejemplo en un archivo 7z con un manifiesto propio. Para instalarlos, empaquétalos para un gestor de mods en lugar de copiarlos en la carpeta del juego ([Instalar](#installing)). El ajuste se aplica al proyecto abierto.

Una generación tiene un fichero `.patch_0.gpu_resources` solo cuando el proyecto lleva texturas o modelos de un mod importado. El audio no necesita ninguno.

### Análisis de sonoridad de Wwise {#wwise-loudness-analysis}

**Añadir el análisis de sonoridad de Wwise** añade los datos de sonoridad que llevan los ficheros de audio originales. No produce ninguna diferencia audible. Necesita Wwise instalado y hace que generar sea más lento. El ajuste se aplica al proyecto abierto.

### Todos los bancos con los sonidos {#every-bank-with-the-sounds}

Un sonido suele estar en más de un banco de sonido. Un clip que comparten varias armas está en el banco de cada arma, y algunos clips están en cien bancos. De forma predeterminada, una generación parchea solo los bancos de los conjuntos de sonidos, la música y los archivos de la lista del proyecto. Esto mantiene el mod pequeño, como los mods hechos con otras herramientas.

**Parchear todos los bancos con los sonidos** pone el audio nuevo en todos los bancos que tienen los sonidos. El audio nuevo suena entonces dondequiera que se usen los sonidos, también para un arma que el proyecto no incluye. El mod ocupa más, a veces cientos de megabytes. Actívalo si el original sigue sonando donde debería sonar el audio nuevo. El ajuste se aplica al proyecto abierto.

Algunos sonidos van a todos los bancos de todos modos:

- La música. El banco de música de cada misión tiene copias de la música de todas las facciones, y `music_init` tiene copias de gran parte de ella. El juego usa la primera copia que carga. Una copia con los tiempos antiguos reproduciría el audio nuevo con la duración antigua, así que la música se cortaría o se quedaría en silencio.
- Los bancos que contienen el principio de un sonido en stream, como una frase. Cada uno recibe el principio nuevo, así que el original nunca suena antes que el audio nuevo.
- Un sonido que no tiene ningún banco de la lista.

Un proyecto con un mod importado también cuenta los bancos que parcheó ese mod. En [Herramientas ▸ Repatch](app:tools/repatch), la misma casilla se aplica al mod con Repatch. Con la opción desactivada, el audio va solo a los bancos que parcheó el mod.

### Audio añadido en otros bancos {#added-audio-in-other-banks}

Las tomas nuevas, las capas y el audio nuevo configurado en **Solo este sonido** van a todos los bancos que tienen una copia del sonido, también a los bancos que el proyecto no incluye, porque el juego reproduce la copia que carga primero. Los sonidos del Cañón automático AC-8, por ejemplo, también tienen copias en los bancos de la Plataforma petrolífera y la Lanzadera. Un proyecto que añade audio a esos sonidos parchea también esos dos bancos, lo que mete en el mod unos 30 MB del audio de esos bancos.

**Limitar el audio añadido a los bancos del proyecto** pone el audio añadido solo en los bancos de la lista del proyecto y de un mod importado en él. El mod ocupa menos, pero dondequiera que el juego cargue primero la copia del sonido de otro banco, suena el original. Déjalo desactivado salvo que el tamaño del mod importe más que el sonido en esos lugares. Un sonido que no tiene ningún banco de la lista sigue yendo a todos los bancos que lo tienen. El ajuste se aplica al proyecto abierto y no hace nada mientras **Parchear todos los bancos con los sonidos** está activado.

## Instalar {#installing}

Las generaciones son ZIP en el formato de manifiesto compartido que importan los gestores de mods de Helldivers 2.

1. Importa el ZIP en el gestor de mods.
2. Despliega los mods.
3. Inicia el juego y ve a un lugar donde suene la música nueva.

> [!WARNING]
> No copies ficheros de parche a mano en la carpeta `data` del juego. El gestor de mods numera los parches de todos los mods al desplegarlos. Un parche copiado a mano se sobrescribe, o anula a otro mod.

## Dos mods que cambian el mismo banco {#two-mods-that-change-the-same-bank}

Un mod contiene copias completas de los bancos de sonido que cambia. Si dos mods cambian el mismo banco, sus cambios no se combinan. El mod que se despliega más tarde sustituye la copia del banco del otro. Los mods de música comparten la mayoría de sus bancos, así que dos mods de música no se pueden desplegar juntos, con independencia de la herramienta con que se hicieran. [Combinar Mods](wiki:combining-mods) crea un solo mod con ellos, con el audio de ambos.

## Actualizar {#updating}

Importa el ZIP nuevo en el gestor de mods. Con el mismo ID, reemplaza la versión instalada y no añade otra copia. Despliega de nuevo y reinicia el juego.
