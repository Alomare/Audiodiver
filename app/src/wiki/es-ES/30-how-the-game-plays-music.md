---
title: Cómo reproduce el juego la música
group: Crear un mod
summary: Segmentos, bucles, capas, variantes, transiciones y stingers, y qué significa cada uno para una sustitución.
source: bb8ea673087e
---

Helldivers 2 no reproduce las canciones de principio a fin. Reproduce la música por trozos y decide de un momento a otro qué viene a continuación. Saber cómo funcionan los trozos permite cortar música nueva para que encaje en ellos.

## Segmentos y slots {#segments-and-slots}

Una pieza de música es una cadena de **segmentos**, y cada segmento contiene uno o más **slots** (clips). Cuando un segmento llega al punto de **Salida**, empieza el siguiente y el resto del primero se prolonga sobre él.

Por ejemplo, la pantalla de ubicación de despliegue reproduce una vez un segmento de inicio y luego catorce bucles en orden. Repite los bucles hasta que se cierra la pantalla. El lugar donde empieza una pieza depende de lo que sonó antes. La pantalla de equipamiento que viene a continuación se salta el segmento de inicio y continúa los bucles desde donde se detuvo la música de la ubicación de despliegue. La [Banda Sonora](wiki:soundtrack) muestra el orden de cada pieza y puede cambiarlo.

## Capas {#layers}

Algunos segmentos reproducen varios slots a la vez, como capas llamadas *Stem 1*, *Stem 2* y así sucesivamente. La música del puente de la nave tiene tres capas. Una capa que no se sustituye sigue reproduciendo el original bajo el audio nuevo. Sustituye todas las capas que no quieras oír.

## Variantes {#variants}

Un slot con una condición, como un bioma, suena solo cuando se cumple esa condición. La fila muestra la condición. Para cambiar una pieza que tiene variantes, da audio nuevo a cada variante.

## Transiciones y stingers {#transitions-and-stingers}

Las **transiciones** (↝) suenan entre dos piezas de música, por ejemplo de la música de la nave a la cápsula Hell. Una transición reproduce el original hasta que se sustituye, así que una transición original puede acabar entre dos piezas de música nueva. La pestaña Audio avisa de esto encima de la lista y marca esas transiciones con **!**. **Saltarlo** las añade al proyecto y las sustituye por silencio, para que el juego pase directamente a lo siguiente.

Los **stingers** (✦) suenan sobre la música en ciertos momentos, como la fanfarria al completar un objetivo principal.

## Silencio {#silence}

Cualquier slot puede reproducir silencio en lugar del original, sin un fichero. Haz clic derecho en el slot y elige **Sustituir por silencio**, o selecciónalo y pulsa **Usar silencio** en los detalles. **Mantener la duración original**, en los detalles, define cómo afecta el silencio a los tiempos:

- Activado, que es el valor predeterminado, el slot permanece en silencio durante lo que duraría el original, así que los tiempos no cambian. Úsalo para silenciar una capa de una pieza o para conservar una pausa del original.
- Desactivado, el juego pasa de inmediato al segmento siguiente. **Saltarlo** silencia así las transiciones y los stingers.

✕ en la fila quita el silencio.

## Audio compartido {#shared-audio}

El juego reutiliza algunos clips en varios lugares, y sustituir un clip compartido lo cambia en todos ellos. Un slot con un clip compartido muestra **+N cues**, y los detalles enumeran los otros lugares en **Compartido con**.

Deja en paz los slots etiquetados como **nunca suena** o **no tocar**. [Cómo leer la pantalla](wiki:reading-the-screen) explica estas etiquetas.
