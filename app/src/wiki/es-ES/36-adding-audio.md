---
title: Añadir audio
group: Crear un mod
summary: Tomas nuevas para un sonido, una capa que suena con él y audio nuevo solo para un sonido, además de lo que tiene el juego.
source: ea7154765378
---

Sustituir audio cambia lo que reproduce un slot. Los sonidos también pueden recibir audio que el juego no tiene, de tres maneras, todas en la pestaña Audio. Sirven para sonidos y voces, pero no para música.

## Tomas nuevas {#new-takes}

Un sonido que elige una de varias tomas al azar puede recibir más tomas. Pulsa **+** en la línea del sonido, elige **Nuevas tomas** y escoge un fichero para cada toma. El juego elige entonces entre las tomas originales y las nuevas. Una toma nueva se marca como *toma nueva* y no tiene un original que reproducir. ✕ la quita.

Para sustituir un sonido por completo, da audio nuevo a todas las tomas existentes. Consulta [Sonidos y voces](wiki:sounds-and-voices).

## Una capa {#a-layer}

Una capa suena junto con un sonido cada vez, como un estruendo más grave bajo un disparo. Pulsa **+** y elige **Nueva capa** para añadir una capa bajo el sonido, con una toma por cada fichero que escojas. **+** en la capa añade más tomas, y el juego elige una de ellas cada vez. Una capa va al mismo lugar de la mezcla que el sonido, y el Make-Up Gain define lo fuerte que suena.

**Nueva capa** aparece atenuada en los sonidos que no pueden tener una capa. Un sonido que es una de las opciones aleatorias de otro sonido no puede tenerla, porque la capa sería solo otra opción. Tampoco puede tenerla un sonido que nada reproduce directamente.

## Solo este sonido {#only-this-sound}

Varios sonidos suelen reproducir el mismo clip, y sustituir el clip lo cambia en todos ellos. Para limitar una sustitución, define **Alcance** en los detalles de un slot sustituido como **Solo este sonido**. Los demás sonidos conservan entonces el original, y sus slots muestran **sustituido en otro sonido**. Cada opción muestra cuántos bancos cambia.

El audio nuevo entra en el mod con un ID nuevo. Las herramientas que enumeran clips por ID muestran el ID antiguo con el Original, aunque el juego reproduce el audio nuevo en ese sonido.

Esta opción funciona por sonido. Cuando el juego copia un sonido entero en otros bancos, como los sonidos de manejo del arma en cada banco de armas, las copias son el mismo sonido y todas cambian.

## Tamaño {#size}

El audio añadido entra en todos los bancos que contienen el sonido. Igual que con las sustituciones, añadir audio a un sonido muy compartido hace que el mod ocupe mucho. Para limitarlo a los bancos del proyecto, consulta [Audio añadido en otros bancos](wiki:build-and-install#added-audio-in-other-banks).
