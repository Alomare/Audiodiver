---
title: Sincronización, puntos de cue y bucles
group: Crear un mod
summary: Cómo pasa el juego de un segmento al siguiente, cómo hacer que la música nueva enlace sin cortes, cómo recortar y mover el audio nuevo y cómo cortar una canción en un cue.
source: 699f0b527e5c
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

## Waveform Suite {#the-waveform-suite}

El lápiz junto a **Antiguo** (el original) o **Nuevo** (el audio nuevo) en las formas de onda abre Waveform Suite para el slot seleccionado. El botón blanco que va antes copia ese audio, para pegarlo en otros slots o en Waveform Suite. En la [Banda sonora](app:soundtrack), **Editar canción** y el lápiz de una canción en una lista de reproducción abren una canción del mismo modo. Recorta, divide, mueve y aplica fundidos al audio, así que las ediciones sencillas no necesitan otro programa. Funciona en todos los slots: música, sonidos y frases.

El audio está en una línea de tiempo en forma de **bloques**. Cada bloque es un tramo de un fichero, colocado en un momento elegido, con un fundido de entrada, uno de salida, una ganancia y una curva de volumen. El original va arriba del todo para comparar, y una línea discontinua marca dónde acaba. Las herramientas están en una barra sobre la línea de tiempo, y al señalar una se muestra qué hace y su tecla. El tiempo del cursor aparece a la derecha, sobre las formas de onda.

- Arrastra el cuerpo de un bloque para moverlo. Arrastra el borde izquierdo o derecho para recortarlo. Arrastra los cuadraditos del borde superior para hacer un fundido de entrada o de salida.
- Haz clic en la línea de tiempo para colocar el cursor. Para moverlo, arrastra el propio cursor o arrastra a lo largo de la regla de arriba.
- Arrastra desde un hueco vacío para dibujar un recuadro: se seleccionan todos los bloques que toca, en cualquier capa. Shift o Ctrl con un clic añaden un bloque a la selección o lo quitan, y Ctrl+A selecciona todos los bloques. Los bloques seleccionados se mueven, se dividen, se duplican, se normalizan y se quitan juntos, y los valores junto a la línea de tiempo fijan los fundidos y la ganancia de todos ellos.
- **Dividir** (S) corta los bloques seleccionados en el cursor, o el bloque bajo el cursor, y cada parte tiene sus propios fundidos. **Normalizar** (N) ajusta la ganancia para que el momento más fuerte de cada bloque llegue a −1 dB. **Duplicar** (Ctrl+D) coloca copias justo después de los bloques, y **Quitar** (Supr) los elimina.
- **Imán** (M) ajusta el cursor, los bordes y los bloques entre sí, al inicio y a donde acaba el original.
- **Curvas de volumen** (V) muestra una línea sobre cada bloque: nivel completo arriba del bloque, silencio abajo. Haz clic en la línea para añadir un punto, y arrastra un punto para dar forma al volumen en el tiempo. Un doble clic en un punto, o Alt y un clic, lo quita. Mientras arrastras un punto, el nivel aparece a su lado en dB. Los puntos se mantienen con el audio al recortar o dividir un bloque, y **Aplanar curva** junto a la línea de tiempo los quita todos.
- **Añadir audio** pone ficheros de audio en la línea de tiempo como bloques nuevos, uno tras otro desde el cursor. Soltar ficheros en el editor hace lo mismo, y **Ctrl+V** pega slots copiados con Ctrl+C en la lista (su audio nuevo tal como suena, o el original) o ficheros de audio copiados en el Explorador. Así se puede hacer un slot con varios ficheros, y un slot sin audio nuevo puede empezar desde ficheros o desde el original.
- Junto a la línea de tiempo, escribe valores exactos para el bloque seleccionado, en milisegundos.
- **Reproducir** (Espacio) reproduce desde el cursor, y **Bucle** (L) reproduce una y otra vez los bloques seleccionados. Un doble clic en la línea de tiempo reproduce desde ahí. Las pistas que suenan se tiñen de su color.
- Ctrl+Z y Ctrl+Y deshacen y rehacen dentro del editor. **Restablecer** vuelve al fichero entero tal cual.

### Capas {#layers}

Los bloques están en **capas**, una debajo de otra. Las capas mantienen los bloques separados para que cada uno se vea y se alcance fácilmente. Todas las capas suenan a la vez, y un bloque suena igual en cualquier capa.

- **Nueva capa**, bajo la línea de tiempo, añade una capa. Haz clic en el nombre de una capa para renombrarla; Aplicar guarda los nombres con el slot. El audio nuevo de Añadir audio, de soltar ficheros o de Ctrl+V va a la última capa en la que hiciste clic, marcada en amarillo.
- Arrastra un bloque arriba o abajo para moverlo a otra capa.
- Arrastra los puntos que hay antes del nombre de una capa para reordenar las capas, y arrastra el borde inferior del nombre de una capa para hacerla más alta o más baja. Un doble clic en ese borde la restablece.
- La papelera elimina una capa. Una capa con bloques pregunta antes, y Deshacer recupera los bloques.
- La casilla antes de cada pista, también la del original, elige qué suena con **Reproducir** y qué escribe **Exportar**. Marca el original para oírlo junto al audio nuevo, o desmarca todas las capas para oírlo solo. **Aplicar** conserva todas las capas, marcadas o no.

Los bloques de una misma capa también pueden solaparse, y suenan juntos. Los bloques solapados se dibujan semitransparentes, cada uno de otro color, para que se vean los dos. Un clic elige el bloque más corto bajo el puntero, y otro clic en el mismo sitio elige el siguiente, así que un bloque bajo otro más largo siempre se puede seleccionar.

### Música: puntos de referencia, contexto y segmentos enteros {#music-cue-points-context-and-whole-segments}

En un slot de un segmento de música, la **Entrada** y la **Salida** del segmento aparecen en la línea de tiempo como líneas con banderas en la regla, y sus tiempos se muestran sobre las formas de onda. Arrastra una bandera para mover el punto de referencia. Se ajusta a los bordes de los bloques con el imán activado, y si la sueltas cerca del punto automático vuelve a él. La pista del original muestra dónde los tiene el juego. **Aplicar** fija los puntos de referencia junto con los bloques.

**Reproducir en contexto** (C) reproduce el final del segmento anterior, este segmento tal como lo tienes en el editor y el inicio del segmento siguiente, con los relevos en los puntos de referencia como los reproduce el juego. No hace falta aplicar nada antes.

**Editar segmento**, el botón apilado bajo el lápiz en las formas de onda, abre todos los slots del segmento a la vez: cada slot con el original encima de las capas de audio nuevo, todo en una misma línea de tiempo, para que las partes se alineen. Un slot sin audio nuevo puede empezar desde el original con el + junto al nombre del slot. **Aplicar** fija todos los slots que han cambiado.

**Exportar**, junto a Aplicar, mezcla las pistas marcadas en un fichero de audio: WAV, FLAC, MP3 u Ogg Vorbis, a 48 o 44,1 kHz, con los canales del audio, en estéreo o en mono, y llevado a −1 dB en su momento más fuerte si lo eliges. El proyecto no cambia.

Nada cambia hasta **Aplicar**. Los ficheros se quedan como están: el proyecto guarda los bloques, y las generaciones y las previsualizaciones reproducen lo que muestra el editor. Editar el original da al slot el original editado como audio nuevo, igual que copiar un slot. El Make-Up Gain se aplica sobre el resultado, y elegir otro fichero para el slot lo empieza sin editar.

## Escuchar el resultado {#hearing-the-result}

**Reproducción continua** reproduce la pieza entera como suena en el juego, con los segmentos en orden y cada traspaso en un punto de Salida. Compara **Original** y **Sustituido** para detectar huecos, golpes dobles y saltos de volumen antes de generar.

## Bucles {#loops}

Un segmento marcado como **en bucle** se repite hasta que el juego pasa a lo siguiente. Un segmento marcado como **×2** o con un número mayor se repite esa cantidad de veces. Un bucle que termina donde empezó suena sin cortes. Algunas piezas repiten varios segmentos seguidos (Selección de equipamiento reproduce catorce), y cada uno de esos segmentos debe terminar en un punto desde el que pueda empezar el siguiente.

## Cortar una canción larga {#slicing-one-long-song}

{icon:slice} **Cortar una canción** corta un fichero largo en trozos consecutivos en posiciones de muestra exactas, de modo que los trozos suenen como la canción sin cortar cuando se reproducen uno tras otro. Cada trozo va a un segmento, en orden de reproducción. Las capas de un segmento suenan juntas, así que todos los trozos van a la capa del slot **Desde**.

Un cue con un solo slot, como una transición, recibe un trozo: mueve **Inicio** y **Fin** al tramo de la canción que debe sonar. Un sonido también recibe un trozo: selecciona un slot del sonido, y **Cortar una canción** corta un tramo de la canción para ese slot. **Duraciones originales** hace el tramo tan largo como el original.

La ventana muestra la canción y el original en una misma escala de tiempo:

- El carril **Audio nuevo** muestra la canción, los cortes, y el número y el slot de cada trozo.
- El carril **Original** muestra el audio original de cada slot, empezando en el corte de ese trozo. Un borde rojo significa que el original pasa del corte, así que el trozo es más corto que el original. Una línea discontinua marca dónde termina antes un original, así que el trozo es más largo. La tabla y el carril muestran la diferencia.

Para cortar una canción:

1. Elige los slots en **Desde** y **Hasta**. Cada segmento entre ellos recibe un trozo, y **Hasta** enumera cuántos trozos son.
2. Coloca los cortes. **Proporciones originales** reparte las duraciones originales sobre toda la canción. **Duraciones originales** corta exactamente en las duraciones originales, así que el último trozo puede terminar antes que la canción. **Iguales** corta la canción en trozos iguales.
3. Ajusta los cortes. Arrastra un corte para moverlo y mantén pulsada la tecla Shift para que no se ajuste a la duración original. Haz doble clic en la canción para añadir un corte. Selecciona un corte y pulsa Delete para quitarlo, o desplázalo con ←/→ (Shift mueve 100 ms, Alt mueve 1 ms). **Inicio** y **Fin** pueden omitir una intro o un final. La tabla muestra cada tiempo al milisegundo, y **Corte (ms)**, encima de la canción, acepta un tiempo exacto para el corte seleccionado.
4. Escucha. **Canción** reproduce la canción, y **Originales** reproduce el audio original de los slots uno tras otro. Haz clic en la canción o en el original para reproducir desde ese punto, o pulsa ▶ en un trozo o en el original que hay a su lado en la tabla. La barra espaciadora reproduce y pausa.
5. Haz zoom con la rueda o con el control deslizante bajo los carriles, y dibuja los carriles más altos para una canción silenciosa con Ctrl+rueda o con el control deslizante de la derecha. Desplázate con Shift+rueda o con la franja bajo los carriles. {icon:reset}, en la esquina, vuelve a mostrar la canción entera. Haz clic en una fila de la tabla para llevar ese trozo a la vista.
6. Pulsa **Cortar y rellenar**. Audiodiver guarda los trozos en la carpeta `audio\slices` del proyecto y rellena los slots.

Audiodiver conserva los cortes de cada canción, así que puedes volver a cortar la misma canción desde donde lo dejaste.
