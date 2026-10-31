---
title: Carpetas del proyecto
group: Primeros pasos
summary: Dónde guarda los ficheros un proyecto, cómo mover uno y cómo un paquete lleva un proyecto a otro ordenador.
source: e77121941946
---

## La carpeta del proyecto {#the-project-folder}

Un proyecto nuevo recibe una carpeta con su nombre, con el fichero del proyecto dentro, como en `Dune\Dune.audi`. Audiodiver pone todo lo que genera para el proyecto en una carpeta `audio` junto a ese fichero:

- `audio\slices` contiene los trozos que corta la herramienta de corte.
- `audio\imported` contiene el audio decodificado del parche de un mod importado.
- `audio\added` contiene los ficheros que **Reunir ficheros** copió de otros sitios.

Los ZIP generados van a una carpeta `build` junto al fichero del proyecto.

El audio elegido en otra carpeta se queda allí, y el proyecto guarda la ruta. Las rutas de un fichero de proyecto son relativas a la carpeta del proyecto, y un fichero de otra unidad se guarda con la ruta completa. Una carpeta movida a mano sigue teniendo los ficheros que hay dentro, pero el proyecto puede perder los que están fuera. [Mover proyecto](#moving-a-project) los conserva.

Los proyectos antiguos pueden compartir una carpeta, con `slices` e `imported` junto al fichero `.audi`. Siguen funcionando, y la pestaña [Proyecto](app:project) ofrece moverlos.

## Mover un proyecto {#moving-a-project}

**Mover proyecto**, en **Carpeta** de la pestaña Proyecto, mueve la carpeta del proyecto a una carpeta que elijas: si eliges `D:\Mods` para `Dune`, queda en `D:\Mods\Dune`. Cuando `D:\Mods` ya tiene una carpeta llamada `Dune`, la carpeta del proyecto pasa a ser `Dune 2`.

Todo lo que hay en la carpeta del proyecto se va con ella: el fichero del proyecto, el audio que generó Audiodiver, los ficheros que pusiste allí y las generaciones. Los ficheros elegidos fuera de la carpeta se quedan donde están, y el proyecto sigue encontrándolos. En la misma unidad el movimiento es cuestión de un momento. A otra unidad, los ficheros se copian primero, lo que tarda más en un proyecto grande. La lista de proyectos recientes sigue al proyecto hasta la ruta nueva.

Un proyecto que [comparte una carpeta](#moving-a-project-into-a-new-folder) con otros proyectos o ficheros pasa primero a una carpeta nueva, y esa carpeta es la que se mueve.

## Mover un proyecto a una carpeta nueva {#moving-a-project-into-a-new-folder}

La pestaña Proyecto muestra una advertencia cuando el proyecto comparte una carpeta con otros proyectos, o está en un lugar compartido como el Escritorio. Audiodiver pone los trozos cortados, el audio importado y las generaciones junto al fichero del proyecto, y en una carpeta que contiene solo este proyecto se mantienen separados de otros ficheros. **Mover a una carpeta nueva** crea una carpeta con el nombre del proyecto junto al fichero del proyecto y mueve a ella lo siguiente:

- el fichero del proyecto
- los trozos cortados y el audio importado que Audiodiver generó para él
- las generaciones de la carpeta de generación predeterminada

Los ficheros elegidos en otros sitios se quedan donde están. Un fichero que usa otro proyecto de la carpeta antigua se copia. La lista de proyectos recientes sigue al proyecto hasta la ruta nueva.

## Reunir ficheros {#collecting-files}

**Reunir ficheros** copia audio de fuera de la carpeta del proyecto en `audio\added` y hace que el proyecto apunte a las copias. Un solo Deshacer lo revierte, y las copias se quedan en el disco.

Cuando todos los ficheros están dentro de la carpeta del proyecto, el proyecto se puede mover o copiar como una sola carpeta.

## Ficheros que faltan {#missing-files}

Un fichero que usa el proyecto falta cuando se mueve, se renombra o se elimina fuera de Audiodiver. El slot muestra entonces **Falta el fichero:** antes del nombre del fichero, y la pestaña Generar enumera el fichero como un problema, porque el mod no se puede generar sin él. Vuelve a poner el fichero donde estaba, o haz clic en el nombre del fichero en el slot para elegir otro. Con todos los ficheros dentro de la carpeta del proyecto ([Reunir ficheros](wiki:project-folders#collecting-files)), los ficheros se mueven con el proyecto.

## Ficheros sin usar {#unused-files}

**Buscar ficheros sin usar** enumera lo que Audiodiver generó para el proyecto y que ya no usa nada: trozos de un corte anterior, audio decodificado de un parche importado, ficheros reunidos que ningún slot reproduce. **Quitar** los envía a la Papelera de reciclaje, y Windows puede restaurarlos. En una unidad sin Papelera de reciclaje, como una unidad de red, Audiodiver pregunta antes de eliminarlos de forma definitiva.

Audiodiver busca solo en las carpetas que crea, que son `audio\slices`, `audio\imported`, `audio\added` y las antiguas `slices` e `imported`. Antes de quitar nada, Audiodiver vuelve a comprobar la lista y conserva cualquier fichero que use el proyecto, el historial de Deshacer u otro proyecto de la carpeta.

## Paquetes {#packs}

Un paquete es un único fichero con la extensión `.audipack`. Contiene el fichero del proyecto y los ficheros que usa el proyecto, de modo que el proyecto se abre igual en otro ordenador. Las generaciones y los ficheros sin usar se omiten, y un fichero de fuera de la carpeta va a `audio\added`.

**Exportar como paquete**, en la pestaña Proyecto, escribe uno. Ábrelo con **Abrir proyecto** en [Inicio](app:home), o haz doble clic en él en el Explorador de archivos. Audiodiver desempaqueta el proyecto en una carpeta nueva dentro de la carpeta de proyectos y lo abre. La carpeta de proyectos es al principio `Documents\Audiodiver\Projects`, y después la carpeta donde se creó el último proyecto nuevo.

Para compartir el mod en sí, consulta [Compartir un mod](wiki:sharing).

## Abrir ficheros desde el Explorador de archivos {#opening-files-from-explorer}

Con el instalador, al hacer doble clic en un fichero `.audi` o `.audipack` se abre Audiodiver con ese proyecto o paquete. Cuando Audiodiver ya se está ejecutando, el mismo doble clic abre el fichero en la ventana abierta.

La copia portátil del ZIP de la versión no registra estos tipos de fichero. Abre los proyectos y los paquetes desde la aplicación.
