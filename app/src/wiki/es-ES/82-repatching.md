---
title: Volver a parchear
group: Generar y compartir
summary: Reconstruir para el juego actual un mod de audio hecho para una versión anterior del juego o con otra herramienta.
source: 4adcbe4e29d4
---

El parche de un mod contiene copias completas de los bancos de sonido que cambia, tal como estaban en la versión del juego para la que se hizo el mod. Después de una actualización del juego, esas copias están desfasadas. El mod puede quedarse en silencio o reproducir sonidos equivocados, y mientras está instalado revierte audio más nuevo. Incluso puede silenciar sonidos que nunca cambió, porque los bancos también contienen ajustes que comparten muchos otros bancos. **Repatch**, en [Herramientas](app:tools/repatch), reconstruye un mod así para el juego actual. No necesita ningún proyecto ni experiencia con mods.

## Cuándo usarlo {#when-to-use-it}

- Los sonidos de un mod se quedaron en silencio, suenan mal o faltan después de una actualización del juego, y el autor no lo ha actualizado.
- Otros sonidos, como todos los disparos, se quedan en silencio mientras el mod está instalado. Consulta [Ajustes compartidos de una versión anterior del juego](#shared-settings-from-an-older-game-version).

## Volver a parchear un mod {#repatching-a-mod}

1. Abre [Herramientas ▸ Repatch](app:tools/repatch).
2. Suelta el mod en la página. Puedes soltar el ZIP descargado, la carpeta del mod o el fichero `.patch_0` con el fichero `.stream` junto a él. **Elegir un ZIP o un fichero de parche** y **Elegir una carpeta** hacen lo mismo. Un ZIP soltado en cualquier parte de Audiodiver también se abre en esta página.
3. Revisa el nombre. Audiodiver lo toma del manifiesto si hay uno, y si no del nombre del fichero o de la carpeta, sin los números y las fechas que Nexus Mods añade a las descargas.
4. Marca **Parchear todos los bancos con los sonidos** para que el audio del mod suene dondequiera que se usen esos sonidos. Si se deja desactivado, el audio va solo a los bancos que parcheó el mod, como en el original, y el tamaño se queda más o menos igual. [Más información](wiki:build-and-install#every-bank-with-the-sounds).
5. Pulsa **Repatch**.

La página resume entonces el resultado: qué se conservó, qué se mantuvo como estaba y qué se omitió. **Mostrar todo** enumera todos los parches y el registro. **Volver a parchear otro mod** vacía la página.

Algunos mods tienen varias opciones, con un parche para cada una. Un mod así sigue siendo un solo mod con las mismas opciones. La página cuenta los parches, y Audiodiver reconstruye cada parche que contiene audio en el lugar donde estaba. Un parche sin audio, como una opción que solo cambia una textura, se queda como está. **Mostrar todo** los enumera uno por uno.

Algunos mods tienen varios ficheros de parche en una carpeta, como `.patch_0`, `.patch_1` y `.patch_2`. El juego los carga uno sobre otro como un solo mod. Audiodiver los lee en el mismo orden y los construye en un solo parche.

## Comprobar los mods instalados {#checking-installed-mods}

**Mods instalados**, al final de la página Repatch, encuentra los mods que necesitan un Repatch. **Comprobar los mods instalados** revisa los mods de la biblioteca de un gestor de mods, desplegados o no, y los ficheros de parche de la carpeta `data` del juego. Enumera todos los mods con bancos de sonido:

- **Ajustes compartidos antiguos.** Los bancos tienen copias antiguas de los [ajustes que comparten otros bancos](#shared-settings-from-an-older-game-version). Mientras está desplegado, el mod puede silenciar o cambiar sonidos que nunca tocó. La línea de debajo indica a cuántos otros bancos llega.
- **Bancos de sonido antiguos.** Los bancos son de una versión anterior del juego. Los sonidos del mod pueden sonar mal o faltar.
- **Actualizado.** Nada de los bancos es más antiguo que el juego actual. O el mod se hizo para esta versión, o las actualizaciones posteriores no tocaron esos bancos.
- **No se puede leer.** Audiodiver no pudo leer el fichero de parche.

**Desplegado** marca los mods que están ahora en la carpeta del juego. Un mod con opciones aparece una vez, con **Opciones** mostrando cada opción cuando difieren. **Repatch** abre un mod marcado en el formulario de la parte superior de la página, listo para volver a parchearlo.

La comprobación solo informa de lo que el autor de un mod no habría cambiado a propósito, así que un mod hecho para el juego actual nunca aparece como antiguo.

## Qué se conserva al volver a parchear {#what-repatching-carries-over}

- El audio que sustituye el mod y el audio que añade. El audio añadido puede ser tomas nuevas para un sonido, un sonido que suena con otro sonido o un clip aparte para un sonido.
- Los ajustes de sonido, como el volumen (Make-Up Gain) de un sonido o un contenedor, un retardo antes de que suene y cuánto de él va a la reverberación.
- Los puntos de cue de los segmentos de música que reproducen audio nuevo.
- Todo lo demás del parche, como texto, modelos y texturas, exactamente como estaba. La página enumera lo que contiene un parche además de audio.

Audiodiver aplica todo esto a los bancos de sonido actuales y genera un ZIP nuevo del mismo mod. Los bancos que el mod no parcheó reciben el audio solo cuando **Parchear todos los bancos con los sonidos** está marcado.

Si el mod tiene un manifiesto de gestor de mods, el ZIP nuevo conserva todo lo demás del original: el nombre, la descripción, el icono, las opciones, los ficheros junto a los parches y el ID. Con el mismo ID, importar el ZIP nuevo en un gestor de mods actualiza el mod antiguo y no añade otra copia. Solo los parches son nuevos. El audio entra sin volver a convertirse, así que suena igual.

## Carpeta de destino {#destination-folder}

El ZIP nuevo va a la **Carpeta de destino**. La ubicación predeterminada es `Documents\Audiodiver\Repatched`, y **Cambiar** elige otra. Si ya hay allí un ZIP con el mismo nombre, se queda, y el nuevo recibe un número.

Para cambiar más un mod, crea un proyecto e importa en él el parche del mod, como explica [Cuando el juego se actualiza](wiki:game-updates#mods-made-with-older-tools). Después genéralo desde [Generar](app:build) como cualquier otro proyecto.

## Qué se omite al volver a parchear {#what-repatching-leaves-out}

La copia de un banco de un mod también puede tener efectos o posicionamiento distintos, o una forma distinta de elegir sonidos de un contenedor. La mayoría de estas diferencias vienen de los bancos tal como estaban cuando se hizo el mod, antes de que actualizaciones posteriores los cambiaran. Audiodiver las omite, y la página las enumera. Una diferencia que Audiodiver conoce de una versión anterior del juego no se enumera. Si el mod con Repatch suena distinto, compáralo con la versión antigua en el juego.

El texto, los modelos y las texturas entran sin cambios. Una tabla de cadenas contiene todas las líneas de la tabla, así que una tabla de una versión anterior del juego también trae de vuelta las líneas de esa versión, como hacía el mod antiguo.

Los ajustes de sonido se copian tal como estaban. Uno de ellos puede anular un valor que el juego ha cambiado desde entonces, como hacía el mod antiguo. En los grupos que comparten otros bancos, solo se copian el volumen, el tono, los filtros y el retardo. Consulta [Ajustes compartidos de una versión anterior del juego](#shared-settings-from-an-older-game-version).

> [!NOTE]
> Audiodiver registra lo que cambia cada actualización del juego, a partir de la actualización del 20 de octubre de 2026. En un mod hecho antes de esa actualización, algunos elementos de **Omitido** y algunos de los ajustes copiados pueden ser valores originales de esa época que el mod no cambió.

En un mod con varias opciones, un parche con audio que no se puede volver a parchear se queda en el ZIP sin cambios, y la página lo nombra. Esto ocurre cuando los bancos de sonido del parche no se pueden leer, o no contienen nada que Audiodiver pueda traer.

## Sonidos de una versión anterior del juego {#sounds-from-an-older-game-version}

Las copias de bancos de un mod siguen conteniendo todos los sonidos que tenía el juego cuando se hizo el mod. Cuando una actualización posterior elimina algunos de esos sonidos, parecen sonidos que añadió el mod. Si se incluyeran en el Repatch, traerían de vuelta los sonidos eliminados como tomas adicionales junto a las actuales.

Audiodiver reconoce estos sonidos, los omite y muestra cuántos son. Nunca formaron parte del mod, así que el mod con Repatch sigue teniendo todo lo que hizo el autor. [Importar el parche de un mod](wiki:game-updates) en un proyecto también los omite.

Audiodiver los reconoce de dos maneras:

- Recuerda qué sonidos tenían las versiones anteriores del juego en cada banco.
- Un sonido que añadió el mod reproduce audio nuevo. Un sonido que reproduce audio que el juego actual todavía tiene es un sonido original.

Si el mod sustituyó el audio de un sonido que el juego ha eliminado desde entonces, no hay dónde poner ese audio, y el mod con Repatch reproduce allí los sonidos actuales.

## Ajustes compartidos de una versión anterior del juego {#shared-settings-from-an-older-game-version}

Muchos sonidos toman su volumen, prioridad y otros ajustes de grupos compartidos entre bancos. Todos los sonidos de armas pasan por un grupo que está en más de cien bancos. La copia de un banco de un mod tiene estos grupos tal como eran cuando se hizo el mod. Cuando el juego carga ese banco, la copia antigua de un grupo puede sustituir a la actual, y todos los sonidos del grupo cambian con ella. Tras la actualización del 20 de octubre de 2026, mods como estos silenciaron todos los disparos.

Las actualizaciones cambian las curvas, los efectos y los ajustes de mezcla de estos grupos, como la prioridad. Los mods cambian, como mucho, el volumen, el tono, los filtros y el retardo. Cuando un grupo del mod difiere en curvas o efectos, Audiodiver lo trata como de una versión anterior del juego y conserva el grupo actual. De los demás ajustes de un grupo compartido, toma solo el volumen, el tono, los filtros y el retardo, y conserva los valores actuales para el resto. Un ajuste que el juego actual tiene y que el mod no tiene llegó con una actualización posterior. Una copia compartida sin él es de una versión anterior del juego, así que no se traslada ninguno de los ajustes de esa copia. La página muestra cuántos objetos de sonido se actualizaron así. [Importar el parche de un mod](wiki:game-updates) funciona igual.

Un mod puede tener estas copias antiguas incluso cuando se actualizó después del juego. Algunas herramientas de modding trasladan los ajustes del mod a los bancos nuevos, y con ellos los valores antiguos de los grupos compartidos. La comprobación de los mods instalados también los encuentra.

Un mod generado con Audiodiver tiene las mismas copias. Genéralo de nuevo después de cada actualización del juego. La pestaña [Generar](app:build) avisa cuando la última generación es anterior al juego.

## Instalar el resultado {#installing-the-result}

Importa el ZIP nuevo en el gestor de mods. Si la página dice que se conservó el ID del mod, el ZIP nuevo reemplaza al mod antiguo. Si no, quita primero el mod antiguo.

> [!NOTE]
> Un mod con Repatch sigue siendo obra del autor. Consérvalo para uso personal y compártelo solo con el permiso del autor. Mejor aún, indica al autor que use Audiodiver para actualizar el mod.
