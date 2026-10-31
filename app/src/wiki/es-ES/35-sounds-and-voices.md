---
title: Sonidos y voces
group: Crear un mod
summary: Armas, enemigos, voces y todo el demás audio que no es música. Cómo los muestra la Biblioteca y qué comprobar antes de sustituir uno.
source: 8d3ce8429e30
---

Audiodiver tiene más información sobre la música, pero la Biblioteca contiene todo el audio del juego. Esta página trata todo lo que no es música.

## Conjuntos de sonidos {#sound-sets}

Fuera de la música, el Índice enumera **conjuntos de sonidos**. Un conjunto de sonidos contiene los sonidos de un arma, una estratagema, un enemigo, una voz o un tipo de planeta, con el nombre que ven los jugadores en el juego.

Los sonidos de un conjunto se muestran en grupos. Cada grupo es un sonido y las **tomas** de las que reproduce. El juego elige una toma al azar cada vez que suena el sonido. Para sustituir un sonido por completo, da audio nuevo a todas las tomas, o el juego sigue mezclando los originales. Los ficheros soltados en la línea de un grupo rellenan las tomas en orden. Haz clic derecho en la línea para rellenar, silenciar o vaciar todas las tomas.

La mayoría de los grupos tienen solo números como nombre, como *Secuencia 1* y *Toma 2* ([por qué ocurre esto](wiki:game-audio)), así que hay que escucharlos para distinguirlos. ▶ en la línea de un grupo reproduce la primera toma. En un conjunto grande, los grupos empiezan contraídos, y **Buscar sonidos** encuentra un sonido por una palabra o un ID. La misma página explica los grupos **Otro audio** y **Sin audio en los ficheros del juego**.

También se puede añadir audio que el juego no tiene, como más tomas para un sonido o una capa que suene con él. Consulta [Añadir audio](wiki:adding-audio).

## Armas {#weapons}

Un disparo de arma son varios sonidos que suenan a la vez, cada uno en un grupo aparte del conjunto. Un disparo reproduce entre 3 y 15 de ellos, según el arma. La mayoría de las armas reproducen 6 o más, y los lanzallamas son los que más reproducen.

Un disparo suele componerse de estos elementos:

| Elemento | Descripción |
|---|---|
| Mecanismo | Las piezas móviles del arma, como el cerrojo y el gatillo. |
| Graves | El golpe grave del disparo. |
| Transitorio | El chasquido corto al principio del disparo. |
| Cola | El eco del disparo, y el disparo tal como suena desde lejos. |

El conjunto también contiene los sonidos de manejo, como la recarga y la cinta de munición.

Para dar un disparo nuevo a un arma, sustituye o silencia todos los grupos que reproduce el disparo. Un grupo que se deja original sigue sonando bajo el sonido nuevo. Los grupos están numerados, así que escucha cada uno para saber qué parte del disparo es. También puedes sustituir un elemento y conservar los demás, por ejemplo para poner unos graves más pesados bajo el disparo original.

Algunos elementos se comparten con otras armas, y sustituir uno lo cambia en todas las armas que lo tienen.

## Sonidos que comparten muchas cosas {#sounds-that-many-things-share}

El juego guarda copias de algunos sonidos en muchos lugares. Por ejemplo, todos los bancos de armas contienen los sonidos de manejo del arma. Un grupo así muestra **en otros 104 bancos** y va después de los sonidos que solo tiene este conjunto.

Sustituir un sonido compartido lo cambia en todos los lugares donde suena, y los detalles enumeran esos lugares en **Compartido con**. El mod incluye una copia de cada banco que cambia, así que sustituir un sonido muy compartido hace que el mod ocupe mucho.

## Voces {#voices}

Una voz tiene una parte por cada idioma instalado, como *Inglés* e *Italiano*, con grabaciones distintas para cada uno. Una frase sustituida en la parte en inglés solo la oyen los jugadores que juegan en inglés.

Una frase recibe el nombre de las palabras del subtítulo correspondiente, y el filtro la encuentra por esas palabras. Cuando varias tomas dicen la misma frase, el grupo y cada toma muestran las palabras.

Los sonidos sin palabras reciben el nombre de lo que son, como *Gruñido 1* o *Jadeo 3*, y se numeran por separado para cada voz. Los gruñidos son sonidos cortos de esfuerzo. **Jadeo** abarca las respiraciones más largas, los suspiros y las risas. La mayoría de estos sonidos están al final de una voz de Helldiver y en **Sonidos de esfuerzo de los Helldivers**, en grupos llamados **Gruñidos** y **Jadeo**. Cada uno de estos clips lo comparten dos voces de Helldiver: las voces 1 y 3, y las voces 2 y 4.

Una frase con subtítulo muestra un enlace **Subtítulo** en los detalles. El enlace abre la línea en la pestaña [Texto](wiki:text) para cambiar las palabras.

## Todos los Archivos {#all-archives}

El Índice contiene solo audio con nombre. **Todos los Archivos** contiene todos los archivos con audio. Los archivos del Índice muestran un nombre e iconos de categoría, y los demás muestran *Aún sin nombre*. Ordena por **Sonidos** para encontrar los archivos más grandes, o por **Idioma** para encontrar un paquete de voces.

Cuando una actualización del juego añade audio, búscalo en Todos los Archivos. Se puede reproducir, añadir al proyecto y sustituir de inmediato.

Las dos listas aceptan ID además de palabras. Pega un ID de origen, un ID de fichero de stream o un ID de banco para ver dónde está.
