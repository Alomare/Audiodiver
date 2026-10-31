---
title: Make-Up Gain e a mixagem
group: Criando um mod
summary: Como definir o volume de um slot, como funciona a mixagem HDR do jogo e por que algumas telas soam mais baixas no jogo do que no Audiodiver.
source: c27b0b827853
---

## Make-Up Gain por slot {#make-up-gain-per-slot}

Selecione um slot e defina o **Make-Up Gain** nos detalhes, de −96 a +96 dB, com o controle deslizante ou digitando um valor. Vários slots selecionados recebem todos o mesmo valor. O Make-Up Gain não muda o arquivo de áudio, então você pode ajustá-lo a qualquer momento. {icon:reset} depois do valor o volta para 0 dB, o nível em que o jogo toca o som. Alguns sons têm um Make-Up Gain próprio no jogo, que o **?** mostra. Ele se mantém, já que o valor daqui se soma a ele. O **Nível** de uma peça na [Trilha Sonora](wiki:soundtrack) tem o mesmo botão.

Num slot sem áudio novo, o Make-Up Gain deixa o Original mais alto ou mais baixo. O mod muda só essa configuração, então não leva nenhuma cópia do áudio. A linha mostra o valor como uma tag. Enquanto o slot tem áudio novo, vale o ganho definido no áudio novo.

As formas de onda abaixo dos slots são desenhadas com o ganho e acompanham o controle deslizante enquanto ele se move, na mesma escala do Original, então dá para deixar o áudio novo tão alto quanto o Original a olho. O vermelho marca o áudio que passa da escala máxima, o que causa clipping. ▶ também toca o áudio novo com o ganho, e o Original com o ganho dele.

**Igualar ao volume percebido original** define o Make-Up Gain que deixa o áudio novo tão alto quanto o Original. O Audiodiver mede o volume percebido dos dois (como fazem os medidores de volume usados em transmissão): um som com menos de 3 segundos, como um tiro ou uma fala, pelo momento mais alto, e um áudio mais longo, como música, pelo todo. Com vários slots selecionados, **Igualar cada um ao volume percebido original** define um ganho separado para cada slot.

> [!NOTE]
> Alguns clipes ignoram o Make-Up Gain no jogo, entre eles os stingers calmos dos Iluminados. Os detalhes deles mostram um aviso. Defina o volume percebido desses clipes no arquivo de áudio.

O controle deslizante **Vol** na barra de status define só o volume da prévia no Audiodiver. Ele não faz parte do mod.

## Curvas de volume {#volume-curves}

O jogo muda o nível de algumas músicas enquanto elas tocam: uma curva de volume no clipe baixa ou aumenta o nível ao longo do tempo, e um fade faz o som entrar ou sair aos poucos. A curva faz parte da faixa de música, e não do arquivo de áudio, então o áudio novo nesse slot também a segue. Um slot com curva a mostra como uma linha em volta da forma de onda, com **Curva de volume** ao lado.

Desative **Manter a curva de volume** nos detalhes para tocar o slot num nível constante. O Make-Up Gain não faz isso, porque define um único nível para o clipe inteiro. A opção remove as curvas de volume e os fades, funciona em slots com ou sem áudio novo e, com vários slots selecionados, vale para os que têm curva. Um clipe pode estar em várias faixas de música, e a opção cobre todas.

Por exemplo, um dos dois clipes de Descida do Hellpod tem uma curva que vai baixando o nível, e o outro não tem nenhuma. Com a mesma música nos dois, um toca mais baixo que o outro até a curva ser desativada.

As curvas de um mod entram junto na [importação](wiki:importing-mods#what-comes-in). Elas aparecem nas formas de onda e em **Configurações importadas**, e a opção também as remove.

## Make-Up Gain e Volume são configurações diferentes {#make-up-gain-and-volume-are-different-settings}

O Wwise, o motor de áudio do jogo, tem duas configurações que parecem ser "volume":

- **Volume** é o volume *lógico*, o quanto o jogo considera que um som é alto. A mixagem usa esse valor para decidir quais sons abaixar.
- **Make-Up Gain** é aplicado *depois* dessa decisão. Ele deixa o som mais alto ou mais baixo para o ouvido sem mudar o quanto a mixagem o considera alto.

O Audiodiver define o Make-Up Gain, que muda só o volume percebido. O valor nos detalhes é somado ao Make-Up Gain que o jogo já dá ao som, então 0 dB toca o som como o jogo toca.

## A mixagem HDR do jogo {#the-game-s-hdr-mix}

O jogo mixa o áudio com **HDR** (alta faixa dinâmica). A cada momento, os sons com o Volume lógico mais alto abaixam os sons mais baixos. Um tiro ou uma explosão abaixa por um instante o ambiente e a música, mais ou menos como um barulho alto faz com a sua audição.

Um som silenciado do jeito comum continua afetando a mixagem. Com o Make-Up Gain em −96 dB, ou com um arquivo silencioso, os alto-falantes não tocam nada. Mas o Volume lógico continua alto, e os sons ao redor continuam sendo abaixados.

> [!TIP]
> **O silêncio no Audiodiver sai da mixagem.** Quando você substitui um efeito sonoro ou uma fala por silêncio, o Audiodiver também define o Volume lógico em −60 dB. Esse nível é baixo demais para a mixagem levar em conta, então nada é abaixado. Ainda assim, é alto o bastante para que o jogo não interrompa o som antes da hora, então ele não atrapalha o tempo da sequência. O volume da música não muda, e um slot de música silenciado mantém a mesma duração ou segue direto, conforme a configuração do silêncio.

## O jogo abaixa a música em algumas telas {#the-game-turns-the-music-down-on-some-screens}

Em alguns momentos o jogo abaixa a música, e a música nova é abaixada do mesmo jeito:

- Na tela do local de lançamento, os loops tocam mais baixo e voltam a subir na tela do aparato que vem em seguida. Quem causa isso é a mixagem, não o arquivo de áudio.
- Na nave, ir até a mesa de guerra abaixa a música em 6 dB, e nada a sobe de volta. Antes da primeira ida à mesa de guerra, a música da nave toca 6 dB mais alta do que para os jogadores que entraram numa missão pela mesa de guerra, que é o caminho comum. Avalie a música da nave depois de ir até a mesa de guerra.
- Vozes, explosões e efeitos de combate tocam por cima da música, e o HDR abaixa a música por baixo deles. Uma música que soa bem sozinha pode soar abafada durante um tiroteio.

Por esses motivos, defina o Make-Up Gain de ouvido, **no jogo**, nos momentos alterados, e compare com o volume da música original ali.

> [!TIP]
> Se uma peça precisar de um reforço, aumente os slots em +4 dB de cada vez e ouça no jogo depois de cada passo.

**Adicionar a análise de volume percebido do Wwise** na aba [Gerar](app:build) exige uma instalação do Wwise. Não faz diferença audível e vem desligado por padrão.

## Filtros {#filters}

**Low-Pass** abafa um som e **High-Pass** o deixa mais fino, de 0 a 100, nos detalhes de qualquer slot, com áudio novo ou o original. Eles somam ao que o jogo define, e o máximo que um som pode ter é 100.

Quem os aplica é o jogo, então as prévias e as formas de onda do Audiodiver tocam sem eles. Para ouvir a mudança, construa o mod e escute no jogo.

## Fades {#fades}

**Fade In** e **Fade Out** ficam em milissegundos, nos detalhes de um slot com áudio novo. Eles entram no próprio áudio, então a forma de onda e a prévia os mostram, e a duração não muda. Um `.wem` que entraria sem alteração é codificado de novo quando tem um fade.

## Filtro de rádio {#radio-filter}

O som de rádio de algumas vozes não está nos arquivos delas. As falas passam por um efeito de rádio na mixagem do jogo, então o áudio novo dessas vozes recebe o mesmo efeito. A seção **Filtro de rádio** da aba [Projeto](app:project) o desliga, uma voz por vez, em todos os idiomas:

- **Controle da missão**
- **O Almirante**
- **Águia 1**
- **Pelicano 1**
- **Helldivers**, para companheiros no rádio e qualquer um em um veículo

Um mod pode ser só isso, sem áudio novo.

Vozes limpas saem mais altas. **Normalizar o volume** as abaixa para perto do nível do rádio.

A mixagem fica no banco Init do jogo, por onde passa todo som, então o mod carrega uma cópia só com essas mudanças:

- Só um mod pode carregar o Init. Com dois, o último vence. [Combinar](wiki:combining-mods) mantém os ajustes de rádio de cada mod em um único Init.
- Depois de uma atualização do jogo, construa o mod de novo, ou uma mudança na mixagem se perde para todos os sons. A [verificação de mods instalados](wiki:game-updates) aponta um Init antigo.
- Isso muda só o seu jogo. Os outros jogadores ouvem o que o jogo deles toca.
