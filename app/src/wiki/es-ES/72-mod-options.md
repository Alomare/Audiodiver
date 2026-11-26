---
title: Opciones para jugadores
group: Generar y compartir
summary: Grupos que los jugadores marcan en el gestor de mods, cada uno con opciones entre las que elegir, como uno de cinco sonidos para un arma.
source: e6c8bc37ba4c
---

## Grupos y opciones {#groups-and-options}

Un **grupo** es una parte del mod que los jugadores pueden activar o desactivar en el gestor de mods, como **Fuego del Liberator** o **Extracción**. El grupo tiene **opciones** entre las que elegir, como **1**, **2** y **3**. Los jugadores marcan un grupo y eligen una de sus opciones. Un grupo sin marcar no instala nada, así que sus slots suenan como sonarían sin él: el sonido original, o lo que el resto del mod ponga ahí.

Todo lo que queda fuera de los grupos es el **mod base**, que siempre se instala.

Los grupos se crean en la pestaña [Proyecto](app:project), en **Opciones para jugadores**:

- **Añadir grupo** añade un grupo con una opción. **Añadir opción** añade otra.
- Haz clic en un nombre para cambiarlo. Cada grupo y cada opción tienen también una descripción.
- El cuadrado junto a un nombre elige la imagen que los jugadores ven en el gestor de mods. Se recorta a un cuadrado centrado, como el icono.
- Las flechas mueven grupos y opciones, y la papelera los quita. La primera opción de un grupo es la que un gestor de mods elige al principio.

Cada grupo tiene una letra y cada opción un número, que juntos forman un código como **A3**: la letra aparece en la imagen del grupo, y el código junto a la imagen de cada opción. Los códigos siguen el orden: el primer grupo es **A**, y **A3** es la tercera opción de ese grupo. Mover o quitar un grupo o una opción cambia los códigos que van después.

Bajo cada opción, una línea dice qué cambia y aproximadamente cuánto añade al mod. **Cambios** lista todos los slots que cambia la opción, con el ajuste tal como lo tiene el mod base y tal como lo tiene la opción. El botón de deshacer de una fila saca ese cambio de la opción, tras una pregunta. Haz clic en el nombre de un slot para mostrarlo en la pestaña Audio.

## Editar una opción {#editing-an-option}

**Seleccionar** en una opción hace que la pestaña [Audio](app:editor) edite esa opción, y la opción se resalta en la pestaña Proyecto. La barra sobre la pestaña Audio dice qué se está editando, y su menú permite elegir otra cosa: **Mod base**, o una opción de un grupo. **Volver al mod base**, en cualquiera de las dos pestañas, vuelve a editar el propio mod. Se edita una opción cada vez.

Mientras se edita una opción, la pestaña Audio reproduce el mod con esa opción elegida. Los cambios en los slots van a la opción:

- Un slot del grupo va a la opción. La fila lleva el código de la opción, como **A3**.
- Un slot que aún no tiene ningún grupo se une al grupo.
- Un slot de otro grupo no puede cambiar. La fila lleva la letra de ese grupo, con borde discontinuo.

Cuenta todo lo que se hace a los slots: soltar ficheros, copiar y pegar, Silencio, la ganancia, los filtros y los fundidos de los detalles, los puntos de referencia y [Waveform Suite](wiki:timing-and-loops#the-waveform-suite). El panel de detalles dice qué opción cambia un slot y qué suena sin el grupo.

**Quitar de la opción**, en el menú contextual de un slot, retira el cambio: el slot suena entonces como sin el grupo. Un slot que ya no cambia ninguna opción del grupo vuelve a ser del mod base.

Las tomas nuevas, las capas y Aislar audio cambian aquello de lo que están hechos los sonidos, así que pertenecen al mod base. Vuelve al mod base para usarlos.

## Ganancia {#gain}

**Ganancia** en una opción añade esos dB a cada slot que cambia el mod base, de −12 a +12 dB. Un grupo **Volumen** con **Más alto** a +3 dB y **Más bajo** a −3 dB permite a los jugadores elegir lo fuerte que suena el mod. Los slots de los grupos conservan los niveles que se les pusieron, y también un slot del mod base cambiado mientras se edita una opción: se une al grupo con el nivel que se le dio.

## Grupos que cambian los mismos bancos {#groups-that-change-the-same-banks}

En los gestores de mods de Helldivers 2, cada opción sustituye bancos de sonido enteros. Dos grupos no pueden cambiar el mismo banco: el que se instale después ganaría ahí, elijan lo que elijan los jugadores en el otro. Por eso un slot cuyo banco ya tiene sonidos de otro grupo no puede ir a un segundo grupo; cámbialo en ese grupo o en el mod base. Las pestañas Proyecto y Generar lo avisan si dos grupos siguen compartiendo bancos, como un grupo **Volumen** y un grupo que cambia slots de los bancos del mod base.

Obsidian, para los mods de Helldivers 1, no tiene ese límite: la generación incluye una versión de los sonidos compartidos para cada combinación de elecciones.

## Qué produce una generación {#what-a-build-makes}

Para Helldivers 2, el gestor de mods muestra primero el mod base. Después va cada grupo, con sus opciones para elegir. Cada opción contiene solo los bancos de sonido y los streams que difieren del mod base. Donde una opción devuelve el original a un sonido que el mod base sustituye, contiene el banco del juego, así que suena el original.

Un banco entra entero, con todos los sonidos guardados en él. La mayoría de los sonidos se guardan en bancos, así que una opción que cambia uno de ellos añade el tamaño completo de ese banco: unos 10 MB para un sonido típico, y mucho más para la música, de la que cada banco de música de misión tiene una copia. Un sonido que el juego reproduce en streaming desde un fichero aparte solo añade el tamaño de ese fichero.

Para Helldivers 1, cada grupo es una opción en Obsidian, con sus opciones y **Desactivado** para elegir.

> Una opción que aún no cambia nada no instala nada. Rellénala en la pestaña Audio, o dale una ganancia, antes de generar.
