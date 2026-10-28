---
title: Trilha Sonora
group: Criando um mod
summary: Como cada peça musical toca, na ordem original, como uma única música, como playlist, em silêncio ou como a música de batalha.
source: 214ec97ec28d
---

O jogo não toca uma peça musical de cima para baixo. A playlist de uma peça mistura grupos que tocam em ordem, grupos que tocam o segmento seguinte a cada vez e grupos que escolhem ao acaso. A maioria das músicas de combate começa cada combate numa abertura curta, e um combate novo continua de onde o anterior parou. Uma música cortada nos slots na ordem da lista toca fora de ordem no jogo.

A aba [Trilha Sonora](app:soundtrack) lista todas as músicas e define como cada peça toca. As gerações gravam essa ordem na música.

## Música {#music}

A lista à esquerda tem todas as músicas do jogo, organizadas pelo lugar onde você as ouve. Cada linha diz como a música toca, com o nível quando ele não é 0 dB, e **Misto** indica que as partes de uma peça tocam de jeitos diferentes. Uma música com várias partes, como Chegada, que tem uma para cada bioma, mostra as partes como abas. A caixa de pesquisa encontra músicas por seção, nome ou modo, como *Iluminados* ou *Playlist*, e {icon:collapse} **Recolher tudo** recolhe todas as seções.

Os **Modelos** definem muitas músicas de uma vez:

- **Músicas de batalha** define a Batalha intensa de todos os inimigos como **Igual à batalha**, para que uma única música cubra um combate.
- **Exploração silenciosa** define a música de Exploração de todos os inimigos como **Silêncio**.
- **Sem aberturas** deixa as aberturas curtas fora da música de batalha, para que os combates comecem direto na música.
- **Original** volta todas as músicas para a ordem original. O áudio novo continua nos slots.

Desfazer reverte um modelo inteiro. Um modelo que não encontra nada para mudar avisa.

## Modos {#modes}

| Modo | O que toca |
|---|---|
| **Original** | Os segmentos na ordem original. Desmarque um segmento na ordem de reprodução para deixá-lo fora desta música. Ele continua tocando em qualquer outro lugar onde o jogo o usa. |
| **Música única** | Uma música, cortada nos segmentos. Cada combate toca uma abertura e depois a música a partir do pedaço 1. |
| **Playlist** | Músicas inteiras, uma em cada lugar, em ordem ou em ordem aleatória. |
| **Silêncio** | Nada. |
| **Igual à batalha** | Para a Batalha intensa. A música de batalha continua a partir do segmento em que está, para que a música não recomece quando um combate fica mais pesado. |

**Nível** aumenta ou diminui a peça inteira em até 96 dB, além do Make-Up Gain de cada slot. Arraste o controle deslizante ou digite um valor na caixa ao lado. {icon:reset} o volta para 0 dB. As músicas em Silêncio e as definidas como Igual à batalha não tocam, então o Nível fica desativado para elas.

**Copiar para** define do mesmo jeito a música de mesmo nome em outros lugares, por exemplo a música de Batalha de todos os inimigos. Uma playlist coloca cada música no mesmo lugar, e Música única coloca os pedaços em ordem. Onde há menos lugares, as últimas músicas ou os últimos pedaços ficam de fora, e uma nota avisa.

## Música única {#one-song}

**Escolher uma música** abre a ferramenta de fatiar com os segmentos que a música preenche. Uma música solta na página também a abre. Corte-a em quantos pedaços quiser, até um por segmento. Cada pedaço vai inteiro para um segmento. A primeira camada recebe o pedaço, e as outras camadas tocam silêncio. Na música de Extração, a primeira camada em baixa intensidade e a primeira em alta intensidade recebem o pedaço.

**Alterar os cortes** abre a ferramenta de fatiar de novo com a mesma música e os mesmos cortes. **Escolher outra música** começa com uma nova.

## Playlist {#playlist}

Uma playlist tem uma linha para cada lugar onde uma música pode entrar, na ordem de reprodução. Clique num lugar, ou solte uma música nele, para colocar uma música ali. Vários arquivos escolhidos ou soltos num lugar preenchem esse lugar e os seguintes, na ordem dos nomes de arquivo. **Adicionar músicas** preenche os lugares vazios. Arraste uma música para outro lugar para movê-la, e as músicas entre os dois avançam um lugar. ↑ e ↓ na linha, ou {key:moveUp} e {key:moveDown}, movem uma música um lugar, e ✕ a tira da playlist. O arquivo continua no disco.

Lugares vazios não tocam. **Ordem aleatória** toca as músicas numa ordem aleatória, e nenhuma música toca duas vezes antes que as outras tenham tocado. **Continuar no próximo combate** começa cada combate na música seguinte àquela em que o último combate parou. Sem isso, cada combate recomeça da primeira música. Para músicas fora de combate, a opção é **Continuar na próxima vez**.

Quando a música muda, por exemplo da exploração para a batalha, ela sai de uma música no compasso seguinte com um fade curto, sem esperar a música acabar.

## Aberturas {#openings}

A maioria das músicas de combate começa cada combate numa abertura curta, um segmento de um grupo de aberturas, antes da música propriamente dita. A ordem de reprodução marca esse grupo com **Os combates começam aqui**. Algumas músicas fora de combate começam do mesmo jeito cada vez que entram.

**Música única** e **Playlist** mantêm as aberturas, então um combate começa numa abertura original e a música ou a playlist vem depois. Para mudar o que toca ali:

- Substitua as aberturas na aba [Áudio](app:editor), como qualquer outro slot, por áudio novo ou por silêncio. Silêncio com **Manter a duração original** desligado segue direto para a música ([Silêncio](wiki:how-the-game-plays-music#silence)).
- Para músicas em **Original**, desmarque as aberturas na ordem de reprodução para deixá-las de fora, ou use o modelo **Sem aberturas** para a música de batalha de todos os inimigos de uma vez.

## Ouvir {#listening}

Cada linha tem o original à esquerda e o áudio novo à direita, cada um com ▶, como um slot na aba Áudio. Clique numa linha, ou num segmento da ordem de reprodução, para selecioná-lo. As formas de onda do segmento selecionado aparecem embaixo, o original em cima e o áudio novo abaixo dele, com **Entrada** e **Saída**. Clique numa forma de onda para tocar a partir daquele ponto. {key:selectPrev} e {key:selectNext} selecionam o segmento anterior ou o seguinte, e {key:playGame} e {key:playMine} tocam o original ou o áudio novo desse segmento.

Os botões redondos no topo tocam um combate inteiro, o cinza com a música original e o amarelo com a ordem e o áudio do projeto. **Duração do combate** define quanto tempo o combate dura. O combate termina com o segmento que está tocando nesse momento, e **Próximo combate** continua a partir dali. Para músicas fora de combate, eles são **Toca por** e **Reproduzir de novo**. Enquanto um combate toca, uma barra mostra onde ele está (clique nela para ir até ali), e o segmento que está tocando acende e fica selecionado, então as formas de onda acompanham o combate. Uma linha abaixo da barra lista os segmentos do combate na ordem em que tocaram.

## Exportar {#exporting}

{icon:export} **Exportar** na barra acima da música salva a peça como arquivos de áudio ([Exportar](wiki:reading-the-screen#exporting)). **A peça inteira** a toca do começo ao fim uma vez, e **Um combate** grava um combate como os botões redondos tocam um, pela duração definida em minutos. Cada exportação de um combate é um combate novo. **Cada segmento** e **Cada slot** salvam as partes. Com **Como o mod toca**, a exportação segue o modo, as músicas e o nível definidos aqui.

{icon:header} e {icon:waves} no fim dessa barra ocultam ou mostram o cabeçalho e as formas de onda. Arraste as bordas abaixo do cabeçalho, acima das formas de onda e ao lado da lista para redimensioná-los. **Slots**, ao lado do nome da música, a abre na aba [Áudio](app:editor).

## Ordem de reprodução {#play-order}

A ordem de reprodução mostra a peça como grupos de segmentos, cada um num cartão com um título que diz o que ele faz com eles, e um cartão mais escuro para cada grupo mais interno:

- **Em ordem** os toca um após o outro.
- **O próximo a cada vez** toca um a cada vez, o seguinte na ordem. Um combate novo continua de onde o anterior parou.
- **Em ordem aleatória** toca todos eles numa ordem aleatória.
- **Um ao acaso** toca um, escolhido ao acaso.

Os segmentos de um grupo são ligados pelo que o grupo significa: → para em ordem, *ou* para um ao acaso. Os grupos um abaixo do outro são ligados por *depois*, *na próxima vez* ou *ou* do mesmo jeito. Uma escolha curta de segmentos fica numa única linha, numa moldura tracejada, e um grupo com uma única coisa dentro mostra essa coisa sozinha, já que ela toca do mesmo jeito.

A marca **repete** indica um grupo que toca de novo até a música mudar, e **3 vezes**, um que toca três vezes e depois segue. **Os combates começam aqui** marca onde a música começa quando um combate começa ([Aberturas](wiki:soundtrack#openings)), e **Começa aqui**, onde outra música começa cada vez que entra. O ▶ num segmento toca o que o projeto toca ali.

## Camadas {#layers}

As músicas que tocam várias camadas ao mesmo tempo, como a música de Extração, as mostram numa grade: uma linha para cada segmento e uma coluna para cada camada em baixa e em alta intensidade. Clique numa célula para ver as formas de onda. Substitua as camadas na aba [Áudio](app:editor).
