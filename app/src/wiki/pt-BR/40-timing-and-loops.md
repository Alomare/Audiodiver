---
title: Tempo, pontos de cue e loops
group: Criando um mod
summary: Como o jogo passa de um segmento para o seguinte, como fazer a música nova passar a vez sem emendas, como recortar e mover o áudio novo e como fatiar uma música num cue.
source: 2a8c7f369c63
---

## Ajustar o tempo ao áudio novo {#fitting-the-timing-to-the-new-audio}

**Ajustar o tempo ao áudio novo** vem ligado por padrão em todo slot substituído. O segmento assume a duração do clipe novo, e o ponto de *Saída* vai para o fim do clipe. O segmento seguinte começa quando o clipe termina.

Desligue a opção só quando o clipe precisar seguir o tempo original, como um stinger curto colocado dentro de um segmento mais longo.

## Entrada e Saída {#entry-and-exit}

As formas de onda abaixo dos slots mostram o original acima da substituição, na mesma escala de tempo, com os pontos de cue:

- **Entrada** é onde o segmento conta como iniciado. O áudio antes da Entrada é uma pré-entrada que toca por baixo do fim do segmento anterior.
- **Saída** é onde o segmento seguinte começa. O áudio depois da Saída ressoa por cima do segmento seguinte.

Arraste a Saída na substituição para mover a passagem. Para desfazer, arraste-a de volta: solte perto da posição automática e ela se encaixa nela. Os detalhes mostram os mesmos valores em milissegundos em **Pontos de cue**.

Quando um arquivo toca em vários segmentos, **Aplicar a mais … segmentos com este arquivo**, em **Pontos de cue**, dá a todos eles os pontos de cue do selecionado. Para definir pontos de cue numa seleção, selecione os slots e digite os valores nos detalhes. Uma caixa que mostra **Misto** deixa cada segmento como está até você digitar um valor.

> [!TIP]
> Coloque as caudas de reverb e as batidas finais depois da Saída. Ali elas se sobrepõem ao segmento seguinte, o que evita um vazio.

## Waveform Suite {#the-waveform-suite}

O lápis ao lado de **Antigo** (o original) ou **Novo** (o áudio novo) nas formas de onda abre o Waveform Suite para o slot selecionado. O botão branco antes dele copia aquele áudio, para colar em outros slots ou no Waveform Suite. Na [Trilha Sonora](app:soundtrack), **Editar música** e o lápis de uma música em uma playlist abrem uma música do mesmo jeito. Ele corta, divide, move e aplica fades no áudio, então edições simples não precisam de outro programa. Isso funciona em todos os slots: música, sons e falas.

O áudio fica em uma linha do tempo como **blocos**. Cada bloco é um trecho de um arquivo, colocado em um momento escolhido, com fade in, fade out, ganho e curva de volume. O original corre no topo para comparação, e uma linha tracejada marca onde ele termina. As ferramentas ficam em uma barra acima da linha do tempo, e apontar para uma mostra o que ela faz e a tecla dela. O tempo do cursor aparece à direita, acima das formas de onda.

- Arraste o corpo de um bloco para movê-lo. Arraste a borda esquerda ou direita para cortá-lo. Arraste os quadradinhos da borda superior para aplicar fade in ou fade out.
- Clique na linha do tempo para posicionar o cursor. Para movê-lo, arraste o próprio cursor, ou arraste ao longo da régua no topo.
- Arraste a partir de um espaço vazio para desenhar uma caixa: todo bloco que ela toca é selecionado, em qualquer camada. Shift ou Ctrl com um clique adiciona um bloco à seleção ou o tira dela, e Ctrl+A seleciona todos os blocos. Blocos selecionados se movem, se dividem, se duplicam, se normalizam e saem juntos, e os valores ao lado da linha do tempo definem os fades e o ganho de todos eles.
- **Dividir** ({key:suiteSplit}) corta os blocos selecionados no cursor, ou o bloco sob o cursor, e cada parte ganha fades próprios. **Normalizar** (N) ajusta o ganho para que o momento mais alto de cada bloco chegue a −1 dB. **Duplicar** (Ctrl+D) coloca cópias logo depois dos blocos, e **Remover** (Delete) os tira.
- **Ímã** (M) encaixa o cursor, as bordas e os blocos uns nos outros, no início e onde o original termina.
- **Curvas de volume** (V) mostra uma linha sobre cada bloco: nível cheio no topo do bloco, silêncio embaixo. Clique na linha para adicionar um ponto, e arraste um ponto para moldar o volume ao longo do tempo. Um clique duplo em um ponto, ou Alt e um clique, o remove. Enquanto um ponto é arrastado, o nível aparece ao lado em dB. Os pontos ficam com o áudio quando um bloco é cortado ou dividido, e **Achatar curva** ao lado da linha do tempo tira todos eles.
- **Adicionar áudio** coloca arquivos de áudio na linha do tempo como novos blocos, um depois do outro a partir do cursor. Soltar arquivos no editor faz o mesmo, e **Ctrl+V** cola slots copiados com Ctrl+C na lista (o áudio novo deles como toca, ou o original) ou arquivos de áudio copiados no Explorador. Assim um slot pode ser feito de vários arquivos, e um slot sem áudio novo pode começar de arquivos ou do original.
- Ao lado da linha do tempo, digite valores exatos para o bloco selecionado, em milissegundos.
- **Reproduzir** (Espaço) toca a partir do cursor, e **Loop** (L) toca os blocos selecionados repetidamente. Um clique duplo na linha do tempo toca a partir dali. As pistas tocando ficam tingidas com a cor delas.
- Ctrl+Z e Ctrl+Y desfazem e refazem dentro do editor. **Redefinir** volta ao arquivo inteiro, como está.

### Camadas {#layers}

Os blocos ficam em **camadas**, uma embaixo da outra. As camadas mantêm os blocos separados para que cada um seja fácil de ver e alcançar. Todas as camadas tocam juntas, e um bloco soa igual em qualquer camada.

- **Nova camada**, abaixo da linha do tempo, adiciona uma camada. Clique no nome de uma camada para renomeá-la; Aplicar guarda os nomes com o slot. Áudio novo vindo de Adicionar áudio, de arquivos soltos ou de Ctrl+V vai para a última camada clicada, mostrada em amarelo.
- Arraste um bloco para cima ou para baixo para movê-lo para outra camada.
- Arraste os pontinhos antes do nome de uma camada para reordenar as camadas, e arraste a borda inferior do nome de uma camada para deixá-la mais alta ou mais baixa. Um clique duplo nessa borda a restaura.
- A lixeira exclui uma camada. Uma camada com blocos pergunta antes, e Desfazer traz os blocos de volta.
- A caixa antes de cada pista, inclusive a do original, escolhe o que **Reproduzir** toca e o que **Exportar** grava. Marque o original para ouvi-lo junto com o áudio novo, ou desmarque todas as camadas para ouvi-lo sozinho. **Aplicar** mantém todas as camadas, marcadas ou não.

Blocos na mesma camada também podem se sobrepor, e tocam juntos. Blocos sobrepostos são desenhados semitransparentes, cada um de outra cor, para que os dois continuem visíveis. Um clique pega o bloco mais curto embaixo do ponteiro, e outro clique no mesmo lugar pega o próximo, então um bloco embaixo de outro mais longo sempre pode ser selecionado.

### Música: pontos de marcação, contexto e segmentos inteiros {#music-cue-points-context-and-whole-segments}

Em um slot de um segmento de música, a **Entrada** e a **Saída** do segmento ficam na linha do tempo como linhas com bandeiras na régua, e os tempos delas aparecem acima das formas de onda. Arraste uma bandeira para mover o ponto de marcação. Ele se encaixa nas bordas dos blocos com o ímã ligado, e solto perto do ponto automático volta para ele. A pista do original mostra onde o jogo os coloca. **Aplicar** define os pontos de marcação junto com os blocos.

**Tocar no contexto** (C) toca o fim do segmento anterior, este segmento como está no editor e o início do segmento seguinte, passando de um para o outro nos pontos de marcação como o jogo faz. Nada precisa ser aplicado antes.

**Exportar**, ao lado de Aplicar, mixa as pistas marcadas em um único arquivo de áudio: WAV, FLAC, MP3 ou Ogg Vorbis, a 48 ou 44,1 kHz, nos canais do áudio, em estéreo ou mono, e levado a −1 dB no momento mais alto se você quiser. O projeto não muda.

Nada muda até **Aplicar**. Os arquivos ficam como estão: o projeto guarda os blocos, e as gerações e prévias tocam o que o editor mostra. Editar o original dá ao slot o original editado como áudio novo, como faz copiar um slot. O Make-Up Gain se aplica sobre o resultado, e escolher outro arquivo para o slot o faz começar sem edição.

## Ouvir o resultado {#hearing-the-result}

**Reprodução contínua** toca a peça inteira como ela toca no jogo, com os segmentos em ordem e cada passagem num ponto de Saída. Compare **Original** e **Substituído** para pegar vazios, batidas duplas e saltos de volume antes de gerar.

## Loops {#loops}

Um segmento marcado com **em loop** se repete até o jogo seguir em frente. Um segmento marcado com **×2** ou um número maior se repete esse número de vezes. Um loop que termina onde começou toca sem emenda. Algumas peças fazem loop de vários segmentos seguidos (Seleção do aparato toca catorze), e cada um desses segmentos deve terminar num ponto em que o seguinte possa começar.

## Fatiar uma música longa {#slicing-one-long-song}

{icon:slice} **Fatiar uma música** corta um arquivo longo em pedaços consecutivos, em posições exatas de amostra, para que os pedaços soem como a música inteira quando tocam um após o outro. Cada pedaço vai para um segmento, na ordem de reprodução. As camadas de um segmento tocam juntas, então todos os pedaços vão para a camada do slot **Primeiro**.

Um cue com um só slot, como uma transição, recebe um pedaço: mova **Início** e **Fim** para o trecho da música que ele deve tocar. Um som também recebe um pedaço: selecione um slot do som, e **Fatiar uma música** corta um trecho da música para esse slot. **Durações originais** deixa o trecho tão longo quanto o original.

A janela mostra a música e o original na mesma escala de tempo:

- A faixa **Áudio novo** mostra a música, os cortes, e o número e o slot de cada pedaço.
- A faixa **Original** mostra o áudio original de cada slot, começando no corte daquele pedaço. Uma borda vermelha indica que o original passa do corte, então o pedaço é mais curto que o original. Uma linha tracejada marca onde um original termina antes, então o pedaço é mais longo. A tabela e a faixa mostram a diferença.

Para fatiar uma música:

1. Escolha os slots em **Primeiro** e **Último**. Cada segmento entre eles recebe um pedaço, e **Último** mostra quantos pedaços isso dá.
2. Posicione os cortes. **Proporções originais** distribui as durações originais pela música inteira. **Durações originais** corta exatamente nas durações originais, então o último pedaço pode terminar antes da música. **Iguais** corta a música em pedaços iguais.
3. Ajuste os cortes. Arraste um corte para movê-lo, e segure Shift para que ele não se encaixe na duração original. Clique duas vezes na música para adicionar um corte. Selecione um corte e pressione Delete para removê-lo, ou mova-o aos poucos com ←/→ (Shift move 100 ms, Alt move 1 ms). **Início** e **Fim** podem pular uma introdução ou um encerramento. A tabela mostra cada tempo até o milissegundo, e **Corte (ms)**, acima da música, aceita um tempo exato para o corte selecionado.
4. Ouça. **Música** toca a música, e **Originais** toca o áudio original dos slots um após o outro. Clique na música ou no original para tocar a partir daquele ponto, ou pressione ▶ num pedaço ou no original ao lado dele na tabela. Espaço toca e pausa.
5. Dê zoom com a roda do mouse ou com o controle deslizante abaixo das faixas, e desenhe as faixas mais altas para uma música baixa com Ctrl+roda ou com o controle deslizante à direita. Role com Shift+roda ou com a barra abaixo das faixas. {icon:reset}, no canto, mostra a música inteira de novo. Clique numa linha da tabela para trazer aquele pedaço à vista.
6. Pressione **Fatiar e preencher**. O Audiodiver salva os pedaços na pasta `audio\slices` do projeto e preenche os slots.

O Audiodiver guarda os cortes de cada música, então você pode fatiar a mesma música de novo a partir de onde parou.
