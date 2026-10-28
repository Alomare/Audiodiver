---
title: Formatando texto
group: Criando um mod
summary: O que cada botão da barra de formatação da aba Texto faz, como o jogo escreve cada formato, e exemplos para copiar.
source: 47d197420504
---

O jogo formata o texto com tags. Uma tag de abertura vai antes das palavras, e uma tag de fechamento vai depois delas. Por exemplo, `<c=FFFFE900>ARMORED ENEMIES</c>` mostra *ARMORED ENEMIES* no amarelo da Superterra. A barra acima de **Texto novo** na aba [Texto](app:text) escreve as tags, e você também pode digitá-las. **Prévia** mostra o resultado enquanto você trabalha.

Cada exemplo abaixo mostra uma linha como foi digitada, à esquerda, e como aparece, à direita.

## Aplicar um formato {#applying-a-format}

1. Selecione as palavras em **Texto novo**.
2. Se o formato tiver uma cor ou um tamanho, defina-o primeiro.
3. Pressione o botão.

As tags vão em volta das palavras selecionadas. As palavras continuam selecionadas, então um segundo botão adiciona um segundo formato. Se nada estiver selecionado, um botão formata a linha inteira, depois do tempo da legenda, se houver.

As tags podem ser aninhadas. Feche-as na ordem inversa:

```game-text
Use the <c=FFFFE900><i=1>Hellbomb</i></c> on the nest.
```

**Limpar formatação** remove todas as tags de cor, tamanho e estilo da linha e mantém as palavras e o tempo. Também remove as cores que o jogo preenche, descritas abaixo. O editor avisa quando isso acontece, e {key:undo} as restaura.

## Cor {#colour}

**Cor** muda a cor das palavras. Escolha uma cor na amostra ou digite um código hexadecimal na caixa ao lado, e depois pressione **Cor**.

Um código de cor tem oito dígitos hexadecimais. Os dois primeiros definem a opacidade (`FF` é totalmente opaco), e o resto define o vermelho, o verde e o azul. O Audiodiver sempre escreve `FF` para a opacidade. Para deixar as palavras parcialmente transparentes, digite um valor menor à mão. Por exemplo, `80` é meio transparente.

```game-text
Pick up and use <c=FFFFE900>EXPENDABLE ANTI-TANK</c> against <c=FFFFE900>ARMORED ENEMIES</c>.
```

```game-text
<c=FFFF0000>Danger close.</c> Clear the area.
```

```game-text
<c=80FFFFFF>Barely there.</c>
```

Estas são as cores mais comuns no jogo:

| Código | Cor | Linhas |
|---|---|---|
| `FFFFE900` | amarelo da Superterra, usado nas palavras-chave das dicas | 166 |
| `FF336666` | verde-azulado escuro | 13 |
| `FF66cc99` | verde-claro | 5 |
| `FFFF0000` | vermelho | 4 |

## Tamanho {#size}

**Tamanho** deixa as palavras maiores ou menores. Defina um tamanho de 10 a 60 na caixa numérica e depois pressione **Tamanho**. O tamanho normal é 20.

```game-text
<s=30>FOR SUPER EARTH!</s>
```

```game-text
Mission complete. <s=14>Mostly.</s>
```

> [!NOTE]
> Nenhuma linha do jogo usa um tamanho, mas o chat usa. O jogo decide como um tamanho fica numa legenda ou num menu, então confira no jogo antes de compartilhar um mod.

## Ênfase {#emphasis}

**Ênfase** escreve `<i=1>`, o estilo dos termos que as dicas e os briefings explicam. A Prévia o mostra em itálico. No jogo, ele aparece no estilo de ênfase.

```game-text
Welcome to the <i=1>Galactic Map</i>. Select <i=1>Missions</i> to play.
```

Outros estilos não estão na barra. O jogo usa `<i=3>` no título de um aviso estratégico, e `<i=2>` entre os números de um cronômetro. Digite-os à mão:

```game-text
<i=3>STRATEGIC ADVISORY</i>
The Automaton <i=1>Jet Brigade</i> has been spotted.
```

## Tempo (legendas) {#timing-subtitles}

Uma legenda começa com uma marca de tempo, `{start->end}`. A marca define quando as palavras depois dela aparecem e somem, em segundos a partir do início da fala. Uma legenda longa tem várias marcas, uma para cada trecho de texto. Pressione **Tempo** para adicionar `{0.00->2.00}` no cursor e depois digite os tempos.

```game-text
{0.00->1.85}Reinforcements inbound!
```

```game-text
{0.00->2.40}Stratagem coming in hot.
{2.40->4.10}Clear the landing zone!
```

Se o áudio novo de uma fala tiver outra duração, mude os tempos da legenda para combinar. A Biblioteca mostra a duração de uma fala acima da forma de onda, e o link **Legenda** na linha abre a legenda aqui.

## Quebras de linha {#line-breaks}

Pressione Enter em **Texto novo** para começar uma nova linha. Os textos mais longos do jogo usam quebras de linha (440 linhas as têm), e algumas legendas longas também, com um trecho de texto por linha.

## Partes que o jogo preenche {#parts-the-game-fills-in}

O jogo preenche algumas partes de uma linha ao mostrá-la. Mantenha essas partes sem alteração, e mova-as junto com as palavras ao reescrever a linha:

- **Palavras em maiúsculas depois de `#`**, como `#NAME` ou `#COUNT`, viram o nome de um jogador ou um número. A Prévia as mostra como caixas.
- **Cores com um nome no lugar de um código**, como `<c=#PLAYER_COLOR>`, são escolhidas pelo jogo, como a cor de um jogador. A Prévia sublinha as palavras que essas tags colorem.

```game-text
<c=#PLAYER_COLOR>#NAME</c> DIED
```

```game-text
<c=#PLAYER_COLOR>#NAME</c> gave their life for <c=FFFFE900>Super Earth</c>
```

O editor avisa quando uma linha perde uma dessas partes.
