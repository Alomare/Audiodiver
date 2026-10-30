---
title: O áudio do jogo, explicado
group: Primeiros passos
summary: Como o Helldivers 2 guarda e toca o áudio, dos pacotes e bancos até os takes e slots, por que o app dá os nomes que dá, e um glossário.
source: 1a4887add42e
---

O Helldivers 2 toca o áudio com o **Wwise**, um motor de áudio que muitos jogos usam. O Wwise não tem o conceito de músicas nem de arquivos com nome. Ele guarda clipes em contêineres, dá um número a tudo e decide durante o jogo qual clipe vem a seguir. O Audiodiver transforma essa estrutura de volta em coisas que um jogador reconhece, e os termos desta página são os que aparecem na tela.

## Onde o áudio fica guardado {#where-the-audio-is-stored}

Do maior para o menor:

1. Um **pacote** é um dos arquivos da pasta `data` do jogo, nomeado com um código de 16 caracteres como `2e24ba9dd702da24`. Um pacote geralmente contém o áudio de uma coisa, como uma arma, a música de uma facção ou uma voz num idioma. **Todos os Pacotes** os lista.
2. Um **banco** é um banco de sons do Wwise dentro de um pacote. Ele contém clipes e os **sons** que os tocam. A linha *No pacote …* no topo do painel do meio nomeia tanto o pacote quanto o banco.
3. Um **som** é uma coisa que o jogo pode disparar, como *tiro de canhão automático* ou *"Reloading!"*. Um som tem um ou mais **takes** e toca um deles a cada vez.
4. Um **take** é uma gravação de um som. Um tiro de fuzil tem vários takes, e o jogo escolhe um ao acaso para que dois tiros nunca soem iguais. O take é o clipe que uma substituição muda.

Áudio longo, como música e falas, muitas vezes é feito por **streaming**, o que significa que o clipe fica guardado no pacote ao lado do banco. O Audiodiver encontra o clipe nos dois casos.

## Por que muitas coisas se chamam "Sequência 3" ou "Take 2" {#why-many-things-are-called-sequence-3-or-take-2}

Os arquivos do jogo contêm números, e não nomes. Os nomes no Audiodiver vêm de documentos da comunidade (listados em [Sobre ▸ Créditos](app:about)) e do que o Audiodiver consegue deduzir:

- Uma sequência sem nome se chama **Sequência 1**, **Sequência 2** e assim por diante, na ordem do banco. Ouça-a para descobrir o que é. Uma sequência é um grupo de takes do qual o jogo escolhe um a cada vez que toca.
- Os takes de uma sequência sem nome se chamam **Take 1**, **Take 2** e assim por diante. Um take transcrito, como uma fala, recebe o nome do que ele diz.
- Um conjunto de sons ou um pacote sem nome recebe o nome do código do pacote e é marcado como *Ainda sem nome*.

Por exemplo, "Sequência 4 › Take 2" é a segunda gravação da quarta sequência do banco. Para substituir uma sequência, dê áudio novo a todos os takes. Senão, o jogo às vezes escolhe um original.

## Outros áudios e Sem áudio nos arquivos do jogo {#other-audio-and-no-audio-in-the-game-files}

Dois grupos podem aparecer no fim de um conjunto de sons, depois dos sons com nome e numerados:

- **Outros áudios** contém clipes que o banco guarda ou nomeia, mas que nenhum dos sons dele toca. Geralmente um som de outro banco os toca. Eles podem ser tocados e substituídos como qualquer clipe, mas não há informação sobre para que servem.
- **Sem áudio nos arquivos do jogo** contém clipes que os dados do banco nomeiam, mas que os arquivos do jogo instalado não incluem. São conteúdo cortado ou partes do jogo que não estão instaladas. O botão ▶ deles fica desativado, e os preenchimentos os pulam.

## Como a música é montada {#how-music-is-put-together}

A música do Helldivers 2 é feita para mudar com a ação. O Audiodiver usa estes termos para ela:

- Um **cue** é uma playlist de segmentos, uma peça musical como os dados do jogo a definem. Uma tag **+3 cues** num slot indica que o mesmo clipe toca em outras três peças musicais.
- Uma **peça musical** é o que o Índice lista, como *Seleção do aparato*. É um cue, ou vários cues que andam juntos.
- Uma **parte** é um cue de uma peça, mostrado como uma aba (como uma linha da lista, no caso de transições e stingers). Uma peça pode ter uma parte para cada bioma, cada intensidade ou cada idioma de uma voz. Cada parte tem seu próprio conjunto de slots.
- Um **segmento** é um trecho de música que toca como uma unidade, com um ponto de **Entrada** e um de **Saída**. O segmento seguinte começa na Saída, e o fim do segmento atual ressoa por cima dele.
- Uma **camada**, ou stem, é um de vários clipes que um segmento toca ao mesmo tempo. Cada camada é um slot separado.
- Um **slot** é um lugar onde um clipe toca, seja um take de um som ou uma camada de um segmento. O áudio é substituído um slot por vez, com um arquivo por slot.
- Uma **variante** é um slot que só toca sob uma condição, como um bioma. A linha mostra a condição.
- Uma **transição** (↝) é uma peça curta que toca entre duas peças musicais. Um **stinger** (✦) é uma peça curta que toca por cima da música.

[Como o jogo toca música](wiki:how-the-game-plays-music) tem mais detalhes.

## IDs {#ids}

Todo clipe, som, banco e cue tem um número, e os arquivos do jogo usam só esses números. Cole um ID de anotações ou de outra ferramenta numa caixa de pesquisa para encontrar onde ele está. O topo dos detalhes mostra o **ID do stream** de um slot, ou o **ID da fonte** (o ID do clipe) quando o áudio fica só dentro de um banco. Os projetos continuam válidos quando uma atualização do jogo muda os IDs.

## Glossário {#glossary}

| Palavra | Significado |
|---|---|
| Áudio novo | O arquivo que substitui o original de um slot. |
| Atribuição | Um arquivo, ou silêncio, dado a um slot. |
| Banco | Um banco de sons do Wwise, com clipes e os sons que os tocam. |
| Camada, stem | Clipes que um segmento toca ao mesmo tempo. |
| Categoria, seção | Como o Índice organiza as coisas, como em Armas ▸ Armas de suporte. |
| Conjunto de sons | Os sons de uma coisa, como uma arma, um inimigo ou uma voz. |
| Cue | Uma playlist de segmentos, uma peça musical como os dados do jogo a definem. |
| Entrada, Saída | Os pontos de cue de um segmento. A Entrada é onde ele conta como iniciado, e a Saída é onde o seguinte começa. |
| Grupo | Um som com os takes que ele toca, mostrado como uma linha que se expande. |
| ID da fonte | O número de um clipe nos arquivos do jogo. |
| ID do stream | O número de 64 bits de um arquivo de stream. |
| Índice | A lista organizada da Biblioteca com tudo o que tem nome. |
| Original | O áudio do jogo num slot. |
| Pacote | Um arquivo da pasta `data` do jogo. Contém bancos e clipes em stream. |
| Parte | Um cue de uma peça musical ou um idioma de uma voz, mostrado como uma aba. |
| Peça musical | Música que um jogador reconhece, feita de um ou mais cues. |
| Preenchimento | Atribuir vários arquivos a slots, na ordem de reprodução, numa só ação. |
| Projeto | O arquivo `.audi`, que registra aquilo em que o mod trabalha e as atribuições. |
| Reprodução contínua | Tocar uma peça inteira com as mesmas passagens entre segmentos que o jogo usa. |
| Segmento | Um trecho de música que toca como uma unidade. |
| Silêncio, Pular | Substituir um slot por nada. Pular faz isso com uma transição, para que o jogo siga direto. |
| Slot | Um lugar onde um clipe do jogo toca. |
| Som | Algo que o jogo dispara. Toca um take a cada vez. |
| Stinger | Uma frase curta que toca por cima da música. |
| Stream | Um clipe guardado ao lado de um banco, fora dele. |
| Substituído | Um slot que toca áudio novo, ou silêncio, no lugar do original. |
| Take | Uma gravação de um som. O jogo escolhe um take ao acaso. |
| Transição | Uma peça curta que toca entre duas peças musicais. |
| Variante | Um slot que só toca sob uma condição. |
| Wwise | O motor de áudio que o jogo usa. |
