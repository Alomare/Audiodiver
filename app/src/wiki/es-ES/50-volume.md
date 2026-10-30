---
title: Make-Up Gain y la mezcla
group: Crear un mod
summary: Cómo ajustar la sonoridad de un slot, cómo funciona la mezcla HDR del juego y por qué algunas pantallas suenan más bajas en el juego que en Audiodiver.
source: 34bc5e953c4b
---

## Make-Up Gain por slot {#make-up-gain-per-slot}

Selecciona un slot y define **Make-Up Gain** en los detalles, de −96 a +96 dB, con el control deslizante o escribiendo un valor. Varios slots seleccionados reciben todos el mismo valor. Make-Up Gain no cambia el fichero de audio, así que se puede ajustar en cualquier momento. {icon:reset} después del valor lo vuelve a poner en 0 dB, el nivel al que el juego reproduce el sonido. Algunos sonidos ya tienen un Make-Up Gain en el juego, que muestra el **?**. Se conserva, ya que el valor de aquí se suma a él. El **Nivel** de una pieza en la [Banda Sonora](wiki:soundtrack) tiene el mismo botón.

En un slot sin audio nuevo, Make-Up Gain sube o baja el volumen del Original. El mod cambia solo ese ajuste, así que no contiene ninguna copia del audio. La fila muestra el valor como una etiqueta. Mientras el slot tiene audio nuevo, se aplica en su lugar la ganancia definida en el audio nuevo.

Las formas de onda bajo los slots se dibujan con la ganancia y siguen al control deslizante mientras se mueve, en la misma escala que el Original, así que el audio nuevo se puede dejar tan fuerte como el Original a ojo. El rojo marca el audio que pasa del fondo de escala, que satura. ▶ también reproduce el audio nuevo con la ganancia, y el Original con la ganancia que tiene.

**Igualar la sonoridad original** define el Make-Up Gain que hace que el audio nuevo suene tan fuerte como el Original. Audiodiver mide la sonoridad de ambos (como lo hacen los medidores de sonoridad de radiodifusión): un sonido de menos de 3 segundos, como un disparo o una frase, por su momento más fuerte, y el audio más largo, como la música, en conjunto. Con varios slots seleccionados, **Igualar cada uno a la sonoridad original** define una ganancia distinta para cada slot.

> [!NOTE]
> Algunos clips ignoran el Make-Up Gain en el juego, entre ellos los stingers de calma de los Iluminados. Sus detalles muestran una advertencia. Define la sonoridad de estos clips en el fichero de audio.

El control deslizante **Vol** de la barra de estado define solo el volumen de escucha en Audiodiver. No forma parte del mod.

## Make-Up Gain y Volumen son ajustes distintos {#make-up-gain-and-volume-are-different-settings}

Wwise, el motor de audio del juego, tiene dos ajustes que suenan a «volumen»:

- **Volumen** es el volumen *lógico*, lo fuerte que el juego considera que es un sonido. La mezcla usa este valor para decidir qué sonidos bajar.
- **Make-Up Gain** se aplica *después* de esa decisión. Hace que el sonido suene más fuerte o más suave al oído sin cambiar lo fuerte que lo considera la mezcla.

Audiodiver define Make-Up Gain, que cambia solo la sonoridad. El valor de los detalles se suma al Make-Up Gain que el juego ya da al sonido, así que 0 dB reproduce el sonido como lo hace el juego.

## La mezcla HDR del juego {#the-game-s-hdr-mix}

El juego mezcla el audio con **HDR** (alto rango dinámico). En cada momento, los sonidos con el Volumen lógico más alto bajan los sonidos más suaves. Un disparo o una explosión baja brevemente el ambiente y la música, de forma muy parecida a como lo hace un ruido fuerte con el oído.

Un sonido silenciado de la manera habitual sigue afectando a la mezcla. Con el Make-Up Gain en −96 dB, o con un fichero silencioso, los altavoces no reproducen nada. Pero el Volumen lógico sigue siendo alto, y los sonidos que lo rodean siguen bajando.

> [!TIP]
> **El silencio de Audiodiver se quita de la mezcla.** Cuando sustituyes un efecto de sonido o una frase por silencio, Audiodiver también define el Volumen lógico en −60 dB. Ese nivel es demasiado bajo para que la mezcla lo cuente, así que nada baja. Sigue siendo lo bastante alto para que el juego no detenga el sonido antes de tiempo, así que no altera los tiempos de la secuencia. El volumen de la música no cambia, y un slot de música silenciado mantiene la misma duración o pasa directamente a lo siguiente, según el ajuste de silencio.

## El juego baja la música en algunas pantallas {#the-game-turns-the-music-down-on-some-screens}

En algunos momentos el juego baja la música, y la música nueva se baja del mismo modo:

- En la pantalla de ubicación de despliegue, los bucles suenan más suaves y vuelven a subir en la pantalla de equipamiento que sigue. Lo causa la mezcla, no el fichero de audio.
- En la nave, acercarse a la mesa de guerra baja la música 6 dB, y nada la vuelve a subir. Antes de la primera visita a la mesa de guerra, la música de la nave suena 6 dB más fuerte que para los jugadores que se unieron a una misión desde la mesa de guerra, que es la forma habitual. Juzga la música de la nave después de una visita a la mesa de guerra.
- Las voces, las explosiones y los efectos de combate suenan sobre la música, y el HDR baja la música bajo ellos. Una música que suena bien sola puede sonar enterrada durante un tiroteo.

Por estos motivos, define el Make-Up Gain de oído **en el juego**, en los momentos que has cambiado, y compáralo con lo fuerte que suena allí la música original.

> [!TIP]
> Si una pieza necesita un empujón, sube los slots +4 dB cada vez y escucha en el juego después de cada paso.

**Añadir el análisis de sonoridad de Wwise**, en la pestaña [Generar](app:build), requiere una instalación de Wwise. No produce ninguna diferencia audible y está desactivado de forma predeterminada.
