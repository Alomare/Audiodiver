---
title: Sincronización, puntos de cue y bucles
group: Crear un mod
summary: Cómo pasa el juego de un segmento al siguiente, cómo hacer que la música nueva enlace sin cortes y cómo cortar una canción en un cue.
source: 7a14e9b897bb
---

## Ajustar los tiempos al audio nuevo {#fitting-the-timing-to-the-new-audio}

**Ajustar los tiempos al audio nuevo** está activado de forma predeterminada en todos los slots sustituidos. El segmento toma la duración del clip nuevo, y el punto de *Salida* se mueve al final del clip. El segmento siguiente empieza cuando el clip termina.

Desactiva la opción solo cuando el clip deba seguir los tiempos originales, como un stinger corto colocado dentro de un segmento más largo.

## Entrada y Salida {#entry-and-exit}

Las formas de onda bajo los slots muestran el original encima de la sustitución, en la misma escala de tiempo, con los puntos de cue:

- **Entrada** es donde se considera que ha empezado el segmento. El audio anterior a la Entrada es una preentrada que suena bajo el final del segmento anterior.
- **Salida** es donde empieza el segmento siguiente. El audio posterior a la Salida se prolonga sobre el segmento siguiente.

Arrastra la Salida en la sustitución para mover el traspaso. Para deshacerlo, arrástrala de vuelta a la posición automática o pulsa **Restablecer los puntos de cue**. Los detalles muestran los mismos valores en milisegundos en **Puntos de cue**.

Cuando un fichero suena en varios segmentos, **Aplicar a … segmentos más con este fichero**, en **Puntos de cue**, da a todos ellos los puntos de cue del seleccionado. Para definir puntos de cue en una selección, selecciona los slots y escribe los valores en los detalles. Un cuadro que muestra **Varios** deja cada segmento como está hasta que escribes un valor.

> [!TIP]
> Coloca las colas de reverberación y los golpes finales después de la Salida. Se solapan allí con el segmento siguiente, lo que evita un hueco.

## Escuchar el resultado {#hearing-the-result}

**Reproducción continua** reproduce la pieza entera como suena en el juego, con los segmentos en orden y cada traspaso en un punto de Salida. Compara **Original** y **Sustituido** para detectar huecos, golpes dobles y saltos de volumen antes de generar.

## Bucles {#loops}

Un segmento marcado como **en bucle** se repite hasta que el juego pasa a lo siguiente. Un segmento marcado como **×2** o con un número mayor se repite esa cantidad de veces. Un bucle que termina donde empezó suena sin cortes. Algunas piezas repiten varios segmentos seguidos (Selección de equipamiento reproduce catorce), y cada uno de esos segmentos debe terminar en un punto desde el que pueda empezar el siguiente.

## Cortar una canción larga {#slicing-one-long-song}

{icon:slice} **Cortar una canción** corta un fichero largo en trozos consecutivos en posiciones de muestra exactas, de modo que los trozos suenen como la canción sin cortar cuando se reproducen uno tras otro. Cada trozo va a un segmento, en orden de reproducción. Las capas de un segmento suenan juntas, así que todos los trozos van a la capa del slot **Desde**.

La ventana muestra la canción y el original en una misma escala de tiempo:

- El carril **Audio nuevo** muestra la canción, los cortes, y el número y el slot de cada trozo.
- El carril **Original** muestra el audio original de cada slot, empezando en el corte de ese trozo. Un borde rojo significa que el original pasa del corte, así que el trozo es más corto que el original. Una línea discontinua marca dónde termina antes un original, así que el trozo es más largo. La tabla y el carril muestran la diferencia.

Para cortar una canción:

1. Elige los slots en **Desde** y **Hasta**. Cada segmento entre ellos recibe un trozo, y **Hasta** enumera cuántos trozos son.
2. Coloca los cortes. **Proporciones originales** reparte las duraciones originales sobre toda la canción. **Duraciones originales** corta exactamente en las duraciones originales, así que el último trozo puede terminar antes que la canción. **Iguales** corta la canción en trozos iguales.
3. Ajusta los cortes. Arrastra un corte para moverlo y mantén pulsada la tecla Shift para que no se ajuste a la duración original. Haz doble clic en la canción para añadir un corte. Selecciona un corte y pulsa Delete para quitarlo, o desplázalo con ←/→ (Shift mueve 100 ms, Alt mueve 1 ms). **Inicio** y **Fin** pueden omitir una intro o un final.
4. Escucha. **Canción** reproduce la canción, y **Originales** reproduce el audio original de los slots uno tras otro. Haz clic en la canción o en el original para reproducir desde ese punto, o pulsa ▶ en un trozo o en el original que hay a su lado en la tabla. La barra espaciadora reproduce y pausa.
5. Haz zoom con la rueda o con el control deslizante bajo los carriles, y dibuja los carriles más altos para una canción silenciosa con Ctrl+rueda o con el control deslizante de la derecha. Desplázate con Shift+rueda o con la franja bajo los carriles. {icon:reset}, en la esquina, vuelve a mostrar la canción entera. Haz clic en una fila de la tabla para llevar ese trozo a la vista.
6. Pulsa **Cortar y rellenar**. Audiodiver guarda los trozos en la carpeta `audio\slices` del proyecto y rellena los slots.

Audiodiver conserva los cortes de cada canción, así que puedes volver a cortar la misma canción desde donde lo dejaste.
