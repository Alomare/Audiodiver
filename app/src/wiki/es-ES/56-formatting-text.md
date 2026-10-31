---
title: Dar formato al texto
group: Crear un mod
summary: Qué hace cada botón de la barra de formato de la pestaña Texto, cómo escribe el juego cada formato y ejemplos para copiar.
source: 47d197420504
---

El juego da formato al texto con etiquetas. Una etiqueta de apertura va antes de las palabras y una de cierre va después. Por ejemplo, `<c=FFFFE900>ARMORED ENEMIES</c>` muestra *ARMORED ENEMIES* en amarillo Supertierra. La barra sobre **Texto nuevo** en la pestaña [Texto](app:text) escribe las etiquetas, y también puedes escribirlas tú. **Vista previa** muestra el resultado mientras trabajas.

Cada ejemplo siguiente muestra una línea tal como se escribe a la izquierda, y tal como se muestra a la derecha.

## Aplicar un formato {#applying-a-format}

1. Selecciona las palabras en **Texto nuevo**.
2. Si el formato tiene un color o un tamaño, defínelo primero.
3. Pulsa el botón.

Las etiquetas rodean las palabras seleccionadas. Las palabras siguen seleccionadas, así que un segundo botón añade un segundo formato. Si no hay nada seleccionado, un botón da formato a toda la línea, después de cualquier sincronización del subtítulo.

Las etiquetas se pueden anidar. Ciérralas en orden inverso:

```game-text
Use the <c=FFFFE900><i=1>Hellbomb</i></c> on the nest.
```

**Borrar el formato** quita de la línea todas las etiquetas de color, tamaño y estilo, y conserva las palabras y la sincronización. También quita los colores que rellena el juego, descritos más abajo. El editor avisa cuando ocurre eso, y {key:undo} los restaura.

## Color {#colour}

**Color** cambia el color de las palabras. Elige un color con la muestra o escribe un código hexadecimal en el cuadro de al lado, y pulsa **Color**.

Un código de color tiene ocho dígitos hexadecimales. Los dos primeros definen la opacidad (`FF` es totalmente opaco), y el resto define el rojo, el verde y el azul. Audiodiver siempre escribe `FF` para la opacidad. Para hacer las palabras parcialmente transparentes, escribe a mano un valor más bajo. Por ejemplo, `80` es medio transparente.

```game-text
Pick up and use <c=FFFFE900>EXPENDABLE ANTI-TANK</c> against <c=FFFFE900>ARMORED ENEMIES</c>.
```

```game-text
<c=FFFF0000>Danger close.</c> Clear the area.
```

```game-text
<c=80FFFFFF>Barely there.</c>
```

Estos colores son los más comunes en el juego:

| Código | Color | Líneas |
|---|---|---|
| `FFFFE900` | amarillo Supertierra, usado en las palabras clave de los consejos | 166 |
| `FF336666` | verde azulado oscuro | 13 |
| `FF66cc99` | verde pálido | 5 |
| `FFFF0000` | rojo | 4 |

## Tamaño {#size}

**Tamaño** hace las palabras más grandes o más pequeñas. Define un tamaño de 10 a 60 en el cuadro numérico y pulsa **Tamaño**. El tamaño normal es 20.

```game-text
<s=30>FOR SUPER EARTH!</s>
```

```game-text
Mission complete. <s=14>Mostly.</s>
```

> [!NOTE]
> Ninguna línea del juego usa un tamaño, pero el chat sí. El juego decide el aspecto de un tamaño en un subtítulo o en un menú, así que compruébalo en el juego antes de compartir un mod.

## Énfasis {#emphasis}

**Énfasis** escribe `<i=1>`, el estilo para los términos que explican los consejos y los informes. La Vista previa lo muestra en cursiva. En el juego aparece con el estilo de énfasis.

```game-text
Welcome to the <i=1>Galactic Map</i>. Select <i=1>Missions</i> to play.
```

Otros estilos no están en la barra. El juego usa `<i=3>` para el encabezado de un aviso, y `<i=2>` entre los números de un temporizador. Escríbelos a mano:

```game-text
<i=3>STRATEGIC ADVISORY</i>
The Automaton <i=1>Jet Brigade</i> has been spotted.
```

## Sincronización (subtítulos) {#timing-subtitles}

Un subtítulo empieza con una marca de tiempo, `{start->end}`. La marca define cuándo aparecen y desaparecen las palabras que la siguen, en segundos desde el inicio de la frase. Un subtítulo largo tiene varias marcas, una por cada fragmento de texto. Pulsa **Sincronización** para añadir `{0.00->2.00}` en el cursor y escribe luego los tiempos.

```game-text
{0.00->1.85}Reinforcements inbound!
```

```game-text
{0.00->2.40}Stratagem coming in hot.
{2.40->4.10}Clear the landing zone!
```

Si el audio nuevo de una frase tiene otra duración, cambia los tiempos del subtítulo para que coincidan. La Biblioteca muestra la duración de una frase sobre la forma de onda, y el enlace **Subtítulo** de la línea abre aquí el subtítulo.

## Saltos de línea {#line-breaks}

Pulsa Enter en **Texto nuevo** para empezar una línea nueva. Los textos más largos del juego usan saltos de línea (440 líneas los tienen), y también algunos subtítulos largos, con un fragmento de texto por línea.

## Partes que rellena el juego {#parts-the-game-fills-in}

El juego rellena algunas partes de una línea al mostrarla. Conserva estas partes sin cambios y muévelas con las palabras al reformular la línea:

- **Palabras en mayúsculas después de `#`**, como `#NAME` o `#COUNT`, se convierten en el nombre de un jugador o en un número. La Vista previa las muestra como recuadros.
- **Colores con un nombre en lugar de un código**, como `<c=#PLAYER_COLOR>`, los elige el juego, como el color de un jugador. La Vista previa subraya las palabras que colorean estas etiquetas.

```game-text
<c=#PLAYER_COLOR>#NAME</c> DIED
```

```game-text
<c=#PLAYER_COLOR>#NAME</c> gave their life for <c=FFFFE900>Super Earth</c>
```

El editor avisa cuando una línea pierde una de estas partes.
