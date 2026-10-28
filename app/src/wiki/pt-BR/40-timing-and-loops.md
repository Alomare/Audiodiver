---
title: Tempo, pontos de cue e loops
group: Criando um mod
summary: Como o jogo passa de um segmento para o seguinte, como fazer a música nova passar a vez sem emendas e como fatiar uma música num cue.
source: 7a14e9b897bb
---

## Ajustar o tempo ao áudio novo {#fitting-the-timing-to-the-new-audio}

**Ajustar o tempo ao áudio novo** vem ligado por padrão em todo slot substituído. O segmento assume a duração do clipe novo, e o ponto de *Saída* vai para o fim do clipe. O segmento seguinte começa quando o clipe termina.

Desligue a opção só quando o clipe precisar seguir o tempo original, como um stinger curto colocado dentro de um segmento mais longo.

## Entrada e Saída {#entry-and-exit}

As formas de onda abaixo dos slots mostram o original acima da substituição, na mesma escala de tempo, com os pontos de cue:

- **Entrada** é onde o segmento conta como iniciado. O áudio antes da Entrada é uma pré-entrada que toca por baixo do fim do segmento anterior.
- **Saída** é onde o segmento seguinte começa. O áudio depois da Saída ressoa por cima do segmento seguinte.

Arraste a Saída na substituição para mover a passagem. Para desfazer, arraste-a de volta para a posição automática ou pressione **Redefinir pontos de cue**. Os detalhes mostram os mesmos valores em milissegundos em **Pontos de cue**.

Quando um arquivo toca em vários segmentos, **Aplicar a mais … segmentos com este arquivo**, em **Pontos de cue**, dá a todos eles os pontos de cue do selecionado. Para definir pontos de cue numa seleção, selecione os slots e digite os valores nos detalhes. Uma caixa que mostra **Misto** deixa cada segmento como está até você digitar um valor.

> [!TIP]
> Coloque as caudas de reverb e as batidas finais depois da Saída. Ali elas se sobrepõem ao segmento seguinte, o que evita um vazio.

## Ouvir o resultado {#hearing-the-result}

**Reprodução contínua** toca a peça inteira como ela toca no jogo, com os segmentos em ordem e cada passagem num ponto de Saída. Compare **Original** e **Substituído** para pegar vazios, batidas duplas e saltos de volume antes de gerar.

## Loops {#loops}

Um segmento marcado com **em loop** se repete até o jogo seguir em frente. Um segmento marcado com **×2** ou um número maior se repete esse número de vezes. Um loop que termina onde começou toca sem emenda. Algumas peças fazem loop de vários segmentos seguidos (Seleção do aparato toca catorze), e cada um desses segmentos deve terminar num ponto em que o seguinte possa começar.

## Fatiar uma música longa {#slicing-one-long-song}

{icon:slice} **Fatiar uma música** corta um arquivo longo em pedaços consecutivos, em posições exatas de amostra, para que os pedaços soem como a música inteira quando tocam um após o outro. Cada pedaço vai para um segmento, na ordem de reprodução. As camadas de um segmento tocam juntas, então todos os pedaços vão para a camada do slot **Primeiro**.

A janela mostra a música e o original na mesma escala de tempo:

- A faixa **Áudio novo** mostra a música, os cortes, e o número e o slot de cada pedaço.
- A faixa **Original** mostra o áudio original de cada slot, começando no corte daquele pedaço. Uma borda vermelha indica que o original passa do corte, então o pedaço é mais curto que o original. Uma linha tracejada marca onde um original termina antes, então o pedaço é mais longo. A tabela e a faixa mostram a diferença.

Para fatiar uma música:

1. Escolha os slots em **Primeiro** e **Último**. Cada segmento entre eles recebe um pedaço, e **Último** mostra quantos pedaços isso dá.
2. Posicione os cortes. **Proporções originais** distribui as durações originais pela música inteira. **Durações originais** corta exatamente nas durações originais, então o último pedaço pode terminar antes da música. **Iguais** corta a música em pedaços iguais.
3. Ajuste os cortes. Arraste um corte para movê-lo, e segure Shift para que ele não se encaixe na duração original. Clique duas vezes na música para adicionar um corte. Selecione um corte e pressione Delete para removê-lo, ou mova-o aos poucos com ←/→ (Shift move 100 ms, Alt move 1 ms). **Início** e **Fim** podem pular uma introdução ou um encerramento.
4. Ouça. **Música** toca a música, e **Originais** toca o áudio original dos slots um após o outro. Clique na música ou no original para tocar a partir daquele ponto, ou pressione ▶ num pedaço ou no original ao lado dele na tabela. Espaço toca e pausa.
5. Dê zoom com a roda do mouse ou com o controle deslizante abaixo das faixas, e desenhe as faixas mais altas para uma música baixa com Ctrl+roda ou com o controle deslizante à direita. Role com Shift+roda ou com a barra abaixo das faixas. {icon:reset}, no canto, mostra a música inteira de novo. Clique numa linha da tabela para trazer aquele pedaço à vista.
6. Pressione **Fatiar e preencher**. O Audiodiver salva os pedaços na pasta `audio\slices` do projeto e preenche os slots.

O Audiodiver guarda os cortes de cada música, então você pode fatiar a mesma música de novo a partir de onde parou.
