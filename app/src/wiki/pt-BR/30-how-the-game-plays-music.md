---
title: Como o jogo toca música
group: Criando um mod
summary: Segmentos, loops, camadas, variantes, transições e stingers, e o que cada um significa para uma substituição.
source: bb8ea673087e
---

O Helldivers 2 não toca músicas do começo ao fim. Ele toca a música em pedaços e decide a cada momento o que vem a seguir. Saber como os pedaços funcionam permite cortar a música nova para que ela se encaixe neles.

## Segmentos e slots {#segments-and-slots}

Uma peça musical é uma sequência de **segmentos**, e cada segmento contém um ou mais **slots** (clipes). Quando um segmento chega ao ponto de **Saída**, o segmento seguinte começa e o resto do primeiro ressoa por cima dele.

Por exemplo, a tela do local de lançamento toca um segmento inicial uma vez e depois catorze loops em ordem. Ela repete os loops até a tela fechar. Onde uma peça começa depende do que tocou antes. A tela do aparato, que vem em seguida, pula o segmento inicial e continua os loops de onde a música do local de lançamento parou. A [Trilha Sonora](wiki:soundtrack) mostra a ordem de cada peça e pode mudá-la.

## Camadas {#layers}

Alguns segmentos tocam vários slots ao mesmo tempo, como camadas chamadas *Stem 1*, *Stem 2* e assim por diante. A música da ponte da nave tem três camadas. Uma camada que não é substituída continua tocando o original por baixo do áudio novo. Substitua todas as camadas que você não quer ouvir.

## Variantes {#variants}

Um slot com uma condição, como um bioma, só toca quando essa condição é atendida. A linha mostra a condição. Para mudar uma peça que tem variantes, dê áudio novo a cada variante.

## Transições e stingers {#transitions-and-stingers}

As **transições** (↝) tocam entre duas peças musicais, por exemplo da música da nave para o hellpod. Uma transição toca o original até ser substituída, então uma transição original pode acabar entre duas peças de música nova. A aba Áudio avisa sobre isso acima da lista e marca essas transições com **!**. **Pular** as adiciona ao projeto e as substitui por silêncio, para que o jogo siga direto.

Os **stingers** (✦) tocam por cima da música em certos momentos, como a fanfarra quando você conclui um objetivo principal.

## Silêncio {#silence}

Qualquer slot pode tocar silêncio no lugar do original, sem arquivo. Clique com o botão direito no slot e escolha **Substituir por silêncio**, ou selecione-o e pressione **Usar silêncio** nos detalhes. **Manter a duração original** nos detalhes define como o silêncio afeta o tempo:

- Ligado, que é o padrão, o slot fica em silêncio pelo tempo que o original tocaria, então o tempo não muda. Use isso para silenciar uma camada de uma peça, ou para manter uma pausa do original.
- Desligado, o jogo segue para o segmento seguinte na hora. **Pular** silencia transições e stingers desse jeito.

✕ na linha remove o silêncio.

## Áudio compartilhado {#shared-audio}

O jogo reutiliza alguns clipes em vários lugares, e substituir um clipe compartilhado o muda em todos eles. Um slot com um clipe compartilhado mostra **+N cues**, e os detalhes listam os outros lugares em **Compartilhado com**.

Deixe em paz os slots marcados com **nunca ouvido** ou **não mexer**. [Entendendo a tela](wiki:reading-the-screen) explica essas tags.
