---
title: Cuando el juego se actualiza
group: Generar y compartir
summary: Por qué un mod de música suele necesitar solo volver a generarse después de un parche, y qué hacer cuando necesita más.
source: 3a5f4d64907d
---

Los parches pequeños de Helldivers 2 normalmente no cambian el audio. Las actualizaciones grandes suelen añadir música para un enemigo nuevo o un tipo de planeta nuevo, y pueden mover música existente a otros ficheros del juego.

## Volver a generar {#rebuild}

Un proyecto registra *qué sonido* sustituye el audio nuevo. No registra dónde se guarda ese sonido. Después de una actualización:

1. Inicia Audiodiver. Detecta los ficheros del juego que han cambiado y los vuelve a leer, así que el primer inicio después de una actualización tarda alrededor de un minuto. Si el juego se ha movido y Audiodiver no lo encuentra, la pantalla de inicio pide la carpeta del juego. También puedes definir la carpeta en **Juego**, dentro de [Ajustes](app:settings/system).
2. Abre el proyecto y genéralo.
3. Importa el ZIP nuevo en el gestor de mods y despliégalo.

La generación nueva parchea los bancos de sonido actuales, así que incluye todos los cambios de la actualización.

## Cuando un sonido se ha movido {#when-a-sound-has-moved}

Si un sonido sustituido ya no existe, la pestaña [Generar](app:build) lo enumera como un problema, y no puedes generar hasta que lo arregles. Busca la ubicación nueva en la [Biblioteca](app:library), añádela al proyecto y asigna allí el fichero.

La música nueva aparece en el Índice automáticamente. La música que Audiodiver aún no puede identificar aparece en **Aún sin identificar**. El otro audio nuevo aparece enseguida en **Todos los Archivos**, sin nombre. Consulta [Sonidos y voces](wiki:sounds-and-voices).

## Mods hechos con herramientas antiguas {#mods-made-with-older-tools}

Los parches de herramientas antiguas basadas en ID contienen bancos de sonido completos de la versión del juego con la que se hicieron. Después de una actualización grande, un parche así devuelve esos bancos a su estado anterior y puede deshacer música más nueva.

Para actualizar uno de estos mods, [vuelve a parchearlo](wiki:repatching) en [Herramientas ▸ Repatch](app:tools/repatch). Suelta el mod en la página, y Audiodiver lo reconstruye para la versión actual del juego.

Para seguir trabajando en el mod en Audiodiver, impórtalo ([Importar un mod](wiki:importing-mods)). **Importar mod** en [Inicio](app:home) crea un proyecto nuevo a partir de él, e **Importar parches** en la pestaña [Proyecto](app:project) lo trae al proyecto abierto. El audio del mod entra en la generación sin volver a convertirse.
