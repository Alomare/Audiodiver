---
title: Entendendo a tela
group: Primeiros passos
summary: O que cada parte da Biblioteca e da aba Áudio mostra, e o que significam as tags e marcas de uma linha.
source: 28d5f38a0bef
---

A Biblioteca e a aba Áudio têm o mesmo layout. Há uma lista à esquerda e o item aberto no meio. A aba Áudio também mostra as configurações do slot selecionado à direita. A Trilha Sonora tem outro layout, descrito em [Trilha Sonora](wiki:soundtrack). As palavras em **negrito** são explicadas em [O áudio do jogo, explicado](wiki:game-audio).

## A lista à esquerda {#the-list-on-the-left}

- **Índice** organiza o áudio pelo que ele é. Categorias como Música, Armas e Inimigos contêm seções como *Na nave* e *Armas principais*. Cada seção lista coisas que você pode abrir, seja uma **peça musical** ou um **conjunto de sons**. O número no fim de uma linha é a duração de uma peça musical, ou o número de sons de um conjunto.
- **Todos os Pacotes** mostra, numa tabela, cada **pacote** que contém áudio. Clique no cabeçalho de uma coluna para ordenar por ela, e clique de novo para inverter a ordem. Os ícones na coluna *Índice* mostram quais categorias incluem o pacote.
- Na Biblioteca, o **+** no fim de uma linha a adiciona ao projeto, e **✓** indica que o projeto já a tem. As linhas de categoria e de seção também têm um **+**, que adiciona tudo o que está visível abaixo delas. Depois de uma pesquisa, esse **+** adiciona só os resultados.
- Na aba Áudio, a lista mostra o que o projeto tem. **✕** numa linha, ou numa linha de categoria ou seção, remove isso do projeto, junto com tudo o que o projeto muda ali: o áudio novo, inclusive em slots que outro item do projeto compartilha, takes e camadas adicionados, Make-Up Gain, e os pontos de cue e as configurações de Trilha Sonora da música. O Audiodiver pergunta antes quando algum áudio novo seria removido. Clicar com o botão direito faz o mesmo, e {key:undo} traz de volta.
- {icon:collapse} **Recolher tudo**, ao lado da caixa de pesquisa, recolhe todas as categorias e seções. Uma pesquisa expande o que corresponder.

## O topo do painel do meio {#the-top-of-the-middle-panel}

- **O caminho e o título** mostram onde o item fica no Índice (*Armas ▸ Armas principais*, *Helldivers ▸ Vozes*) e como ele se chama. ‹ e › no fim do título voltam e avançam.
- **Original**, **Parcialmente substituído** ou **Substituído** mostra o que o item toca agora, só na aba Áudio.
- **No pacote …** nomeia o pacote que contém o item, seguido do nome do **banco** nos arquivos do jogo. Clique no pacote para abri-lo em Todos os Pacotes.

Abaixo do título, uma fileira de caixas diz mais sobre o item. Elas ficam lado a lado e se empilham quando o painel é estreito:

- {icon:transition} **N transições tocam ao lado desta música** aparece só para música. Conta as peças curtas que levam à música e saem dela. **Mostrar** as lista, junto com o que cada uma toca agora.
- {icon:order} **O jogo toca estes slots em outra ordem** aparece para música cuja playlist não toca os slots de cima para baixo. **Ordem de reprodução** a abre na [Trilha Sonora](wiki:soundtrack).
- {icon:link} **Compartilha áudio com** lista outras coisas que tocam alguns dos mesmos clipes.

{icon:header} no fim da barra de ferramentas oculta o cabeçalho, e o mostra de novo.

## A barra de ferramentas {#the-toolbar}

{icon:through} **Reprodução contínua** toca a peça musical inteira, segmento por segmento, na mesma ordem que o jogo usa. O botão cinza toca o áudio **Original**, e o amarelo, o áudio **Substituído**. Enquanto um deles toca, uma barra mostra onde ele está.

A barra de ferramentas começa com uma caixa de seleção que seleciona todos os slots ou limpa a seleção. Na Biblioteca, depois vem **Adicionar ao projeto**, e na aba Áudio, estas ferramentas:

| Ferramenta | O que faz |
|---|---|
| {icon:fill} **Preencher com arquivos** | Preenche os slots com arquivos, um arquivo por slot, na ordem de reprodução e na ordem dos nomes de arquivo. |
| {icon:fillpiece} **Preencher a peça inteira** | Preenche os slots de todas as partes do mesmo jeito, parte por parte. |
| {icon:slice} **Fatiar uma música** | Corta uma música em pedaços, um por slot. |
| {icon:export} **Exportar** | Salva o item, ou os slots selecionados, como arquivos WAV, FLAC, MP3 ou WEM. **Lista de Exportação**, ao lado, abre a [lista de exportação](#the-export-list) quando há algo nela. |
| {icon:skip} **Pular**, {icon:skipall} **Pular todos** | Substituem uma transição ou um stinger por um silêncio curto. |
| {icon:clear} **Limpar tudo**, **Limpar esta parte** | Remove o áudio novo de todos os slots mostrados, ou de todos os slots da parte. |

{icon:search} **Pesquisar slots** filtra a lista por nome, rótulo, nota, nome de arquivo ou ID. Num conjunto de sons, também encontra as palavras de uma fala. Quando nada na lista corresponde, **Em outros lugares** lista as peças musicais e os conjuntos de sons que têm uma correspondência.

{icon:id} depois da pesquisa lista os sons de um banco por [ID de contêiner](#container-ids). Pressione de novo para voltar aos nomes.

{icon:header} e {icon:waves} no fim da barra de ferramentas ocultam ou mostram o cabeçalho e as formas de onda, e o **?** depois deles abre esta seção. O botão das formas de onda funciona enquanto um slot está selecionado.

## Partes {#parts}

As abas abaixo da barra de ferramentas alternam entre as **partes** do item aberto. As partes são os biomas ou as intensidades de uma peça musical, ou os idiomas de uma voz. O número numa aba é uma duração ou um número de sons.

Transições e stingers têm muitas partes curtas, então cada parte vira uma linha na lista de slots. Uma linha toca o original, mostra a duração e marca uma parte que está em silêncio ou que pertence a outra música. Os slots da parte aberta aparecem logo abaixo dela. Clique em outra linha para abrir essa parte, ou na que está aberta para recolhê-la. A barra de ferramentas age sobre a parte aberta.

## Os slots {#the-slots}

Cada linha é um **slot**, um único clipe do jogo que pode ser substituído.

- **Música** lista os **segmentos** na ordem de reprodução. A primeira linha de um segmento mostra o nome do segmento, e as linhas abaixo dela são as outras **camadas**.
- **Sons** aparecem em **grupos**, com uma linha por som e os **takes** recolhidos abaixo dela. ▶ na linha toca o primeiro take. Arquivos soltos na linha preenchem os takes em ordem. Clique com o botão direito na linha para preencher, silenciar ou limpar todos os takes de uma vez.
- A metade esquerda de uma linha é o original. ▶ o toca, e a duração aparece no fim. Na aba Áudio, a metade direita é a substituição. ▶ toca o áudio novo, clicar no nome do arquivo escolhe outro arquivo, e ✕ o remove. Um slot vazio mostra *Soltar áudio ou escolher um arquivo*.
- A caixa de seleção no início de uma linha coloca o slot na seleção, ou o tira dela, como Ctrl+clique. Shift numa caixa de seleção seleciona um intervalo. A linha de um grupo tem uma caixa de seleção para todos os takes do grupo, e o grupo continua recolhido. Na Biblioteca, **Exportar** pode salvar só os slots selecionados. Na aba Áudio, com vários slots selecionados, o painel direito tem **Escolher um arquivo para todos**, **Escolher arquivos**, **Substituir por silêncio** e o botão que remove o áudio novo.
- Clique duas vezes numa linha para tocá-la. Clique com o botão direito para todo o resto, incluindo copiar, colar, silêncio e IDs.
- Copie arquivos de áudio no Explorador de Arquivos, selecione slots e pressione **Ctrl+V**. Um arquivo vai para todos os slots selecionados. Vários arquivos vão na ordem dos nomes de arquivo, e com um único slot selecionado eles preenchem a partir dele. Ctrl+V cola o que foi copiado por último: arquivos do Explorador de Arquivos ou slots copiados no Audiodiver.

### Tags de uma linha {#tags-on-a-row}

| Tag | Significado |
|---|---|
| {icon:link} **+3 cues** / **+5 bancos** / **mais 8** | O jogo toca o mesmo clipe em tantos outros lugares. |
| {icon:link} **em 104 outros bancos** (num grupo) | Todo som do grupo é uma cópia compartilhada, como os sons de manuseio que toda arma carrega. |
| **em loop**, **×2** | O segmento se repete até o jogo seguir em frente, ou se repete esse número de vezes. |
| uma condição, como *Deserto* | Este slot é uma **variante** e só toca quando a condição é atendida. |
| **nunca ouvido** | Os dados do jogo listam este clipe, mas nada o toca. |
| **não mexer** | Substituir este clipe faz a música engasgar. Os preenchimentos o pulam. |
| **sem áudio** | Os dados do jogo nomeiam este clipe, mas os arquivos do jogo instalado não o incluem. Não há nada para tocar ou substituir. |
| **tambores baixos** | Uma camada de bateria quase inaudível abaixo de outra camada do segmento. |
| **nunca toca** | O clipe está nos arquivos do jogo, mas o jogo nunca o toca. A música de morte do Vazio dos Iluminados é um exemplo. |
| **só este som** | O áudio novo toca só neste som. Os outros sons que tocam o clipe mantêm o Original. Veja [Só este som](wiki:adding-audio#only-this-sound). |
| **substituído em outro som** | Outro som toca áudio novo no lugar deste clipe, com **Só este som**. Este mantém o Original. |
| **−6 dB** | Make-Up Gain no Original, num slot sem áudio novo. Veja [Make-Up Gain por slot](wiki:volume#make-up-gain-per-slot). |
| uma tag colorida | Uma entrada do Índice relacionada a este slot. Clique na tag para abri-la. |

Passe o mouse sobre uma tag para ler a nota. As notas de um clipe selecionado aparecem no painel de detalhes. Elas descrevem quando o clipe toca, ou dão um aviso, como uma duração mínima para o áudio novo.

### Marcas {#marks}

| Marca | Significado |
|---|---|
| ○ ◐ ● | Original, parcialmente substituído, substituído. |
| ↝ | Uma **transição**, que toca entre duas peças musicais. |
| ✦ | Um **stinger**, que toca por cima da música. |
| ×3 | O item tem três **partes**. |
| **!** | Uma transição original toca ao lado de música nova. Veja [Como o jogo toca música](wiki:how-the-game-plays-music). |

## Abaixo dos slots {#under-the-slots}

As **formas de onda** do slot selecionado aparecem aqui. O original fica em cima e, na aba Áudio, a substituição fica embaixo, nas mesmas escalas de tempo e de nível, com os pontos de **Entrada** e **Saída** marcados. As duas são desenhadas com o seu [Make-Up Gain](wiki:volume#make-up-gain-per-slot), e o vermelho marca o áudio que passa da escala máxima. Clique numa forma de onda para tocar a partir daquele ponto, e arraste a borda de cima do painel para redimensioná-lo. {icon:waves} no fim da barra de ferramentas as oculta. Na Biblioteca, a linha acima das formas de onda descreve o slot. Ela mostra o ID (clique para copiá-lo), a duração, quando o slot toca e onde mais o jogo o toca.

Dois controles deslizantes dão zoom nas duas formas de onda. O que sobe pelo lado direito as desenha mais altas, para mostrar áudio baixo, e o que fica abaixo delas, à direita, dá zoom no tempo, para posicionar a Entrada e a Saída com precisão. Sobre as formas de onda, a roda do mouse dá zoom no tempo, Ctrl+roda as desenha mais altas, e Shift+roda rola. Com zoom no tempo, a faixa abaixo das formas de onda também rola. {icon:reset}, no canto entre os controles deslizantes, mostra de novo o áudio inteiro em escala máxima. Enquanto um controle deslizante se move, um número de 0 a 100 sobre o botão mostra em que ponto ele está. O zoom fica como foi definido quando outro slot é selecionado, e a ferramenta de fatiar tem os mesmos controles deslizantes.

## O painel direito (aba Áudio) {#the-right-panel-audio-tab}

Este painel contém as configurações do slot selecionado. Ele mostra o que substitui o slot, um arquivo ou silêncio. Um arquivo tem um botão que o mostra no Explorador de Arquivos, e o silêncio tem **Manter a duração original**. Abaixo ficam **Make-Up Gain** ([explicado aqui](wiki:volume)), **Ajustar o tempo ao áudio novo**, os **pontos de cue**, **Compartilhado com** e a nota. Um slot sem áudio novo tem **Usar silêncio** e Make-Up Gain para o Original. Toque o áudio e escolha arquivos na linha do slot.

Com vários slots selecionados, o painel define Make-Up Gain, pontos de cue ou silêncio para todos eles. **Escolher um arquivo para todos** coloca um arquivo em cada slot selecionado, e **Escolher arquivos** coloca um arquivo em cada um, na ordem da lista e na ordem dos nomes de arquivo.

Sem slot selecionado, o painel mostra a nota do item aberto e as teclas da lista de slots.

## Notas {#notes}

Slots e itens da lista à esquerda podem ter notas. As notas ficam no fim do painel direito. Selecione um slot para ver a nota dele, ou não selecione nada para ver a nota do item. **Adicionar nota** abre o editor. As notas são salvas no arquivo do projeto, e Desfazer reverte uma alteração numa nota.

As notas são escritas em Markdown. `#` começa um título, `-` começa um item de lista, `**bold**` e `*italic*` marcam palavras, e `[text](https://…)` cria um link. Os botões acima da caixa fazem o mesmo com as palavras selecionadas, e pressionar um deles de novo tira a marcação. {key:undo} funciona na caixa enquanto você digita. Clique em outro lugar para salvar a nota e mostrá-la formatada. Clique nela para editá-la de novo. **Excluir nota** a remove, e pergunta antes se ela tiver alguma palavra.

Um clipe que toca em vários lugares tem uma única nota, mostrada em todos esses lugares. Quando uma atualização do jogo dá um novo ID a um clipe, a nota deixa de aparecer. Ela continua no arquivo e volta a aparecer se o ID voltar.

## As barras {#the-bars}

A barra de abas contém as abas principais. Início e Ferramentas vêm primeiro. A faixa mais escura depois delas contém as abas do projeto aberto, de Projeto a Texto, e a aba Projeto mostra o ícone do projeto. Gerar vem depois da faixa enquanto há um projeto aberto, e {icon:updates} Atualizações, a Wiki e Configurações ficam no fim. A barra fica no topo da janela, e **Barra de abas** em [Configurações ▸ Tema](app:settings/theme) a coloca em outro lado. Com os nomes das abas ligados, uma barra no topo ou embaixo mostra os nomes ao lado dos ícones, e uma barra à esquerda ou à direita mostra o nome quando o ponteiro está sobre a aba. A aba aberta assume a cor da página que ela abre, e na faixa a aba aberta tem uma borda na cor principal. As abas dentro de uma página, como Índice e Todos os Pacotes, as partes de uma peça ou as seções das Configurações, ficam sublinhadas. Um ponto em Gerar indica que o projeto precisa de uma nova geração, e um ponto em Atualizações indica que há uma nova versão do Audiodiver.

A barra de status, embaixo, tem desfazer e refazer, o arquivo do projeto e o áudio que está tocando. Clique no áudio que está tocando para voltar ao lugar onde ele foi tocado: o slot na Biblioteca ou na aba Áudio, ou a peça e o segmento na Trilha Sonora. **Vol** define o volume da prévia, que não afeta o mod. O número da versão abre Atualizações, e o {icon:info} ao lado dele abre [Sobre](app:about).

### Histórico {#history}

O relógio ao lado de desfazer e refazer abre o **Histórico**, a lista das alterações feitas desde que o projeto foi aberto, da mais antiga para a mais recente, cada uma com a hora em que foi feita. A alteração em que o projeto está fica marcada. Clique numa anterior para desfazer de uma vez todas as alterações depois dela, ou numa mais abaixo, em cinza, para refazer até ela. **Como foi aberto** desfaz todas e mostra quando o projeto foi aberto. Desfazer e refazer continuam funcionando a partir de onde a lista parou, e a lista guarda as últimas 200 alterações.

### Notificações {#notifications}

Confirmações curtas, como *Meu mod agora inclui Seleção do aparato* ou *Meu mod salvo*, aparecem por um instante na parte de baixo da janela. Avisos que precisam ser lidos, ou que têm um botão como Desfazer ou Mostrar na pasta, aparecem no canto inferior direito, ou no canto definido em **Notificações** em [Configurações ▸ Sistema](app:settings/system).

O sino na ponta direita da barra de status lista os avisos mostrados até agora, do mais recente para o mais antigo, com a hora de cada um, para você ler um de novo depois que ele sumir. Um aviso que levava a algum lugar, como a oferta dos tutoriais ou um com **Mostrar na pasta**, leva lá de novo quando clicado na lista. A lista guarda os últimos 100, mesmo depois que o Audiodiver reinicia. Ela só os lista e nunca mostra nada sozinha.

## IDs {#ids}

Todo slot mostra um **ID do stream** no fim da linha, o ID pelo qual outras ferramentas de áudio o listam. Um slot com áudio guardado só dentro de um banco mostra o **ID da fonte**. Clique no ID para copiá-lo. Clique com o botão direito na linha para ver todos os IDs do slot:

- o ID de **stream** de 64 bits do arquivo que contém o áudio
- o ID da **fonte** do clipe
- o **Som** num banco que toca o clipe
- o **contêiner** que contém os takes do som
- a **faixa** musical da qual o clipe é uma camada

As duas caixas de pesquisa aceitam qualquer um deles.

## IDs de contêiner {#container-ids}

Pressione {icon:id} na barra de ferramentas para listar os sons de um banco como as ferramentas do Wwise o listam. Cada som passa a ser nomeado pelo ID do contêiner logo acima dos takes, com o tipo de contêiner antes do ID (Random, Sequence, Switch, Layer ou Actor-Mixer) e o nome de sempre depois. Os contêineres acima ficam em linhas próprias, um nível mais para dentro a cada nível, na ordem do banco. Actor-Mixers que contêm só o seguinte dividem uma linha. Clique num ID dessas linhas para copiá-lo. A pesquisa de slots também encontra IDs de contêiner.

## Exportar {#exporting}

{icon:export} **Exportar** na barra de ferramentas abre o painel de exportação. A primeira aba salva o item aberto, e a segunda, a [lista de exportação](#the-export-list). À direita, o painel lista as pastas e os arquivos que a exportação grava, com os nomes que eles terão, antes de gravar qualquer coisa.

- **Sons** ou **Slots**: **Selecionados** (marque os slots na lista antes), **Substituídos** (na aba Áudio) ou **Todos**.
- **Conteúdo**, para música: **Cada slot**, **Cada segmento** com as camadas mixadas, ou **A peça inteira** em reprodução contínua. Na Trilha Sonora, **Um combate** salva um combate como o jogo o toca ([Exportar música](wiki:soundtrack#exporting)).
- **Áudio**, na aba Áudio e na Trilha Sonora: **Como o mod toca** salva o áudio novo onde um slot tem algum, com o Make-Up Gain definido, e o Original em todos os outros. **Ambos** adiciona a versão substituída ao lado do Original onde quer que o mod mude algo, e esses nomes terminam em *(original)* e *(substituído)*. A Biblioteca salva o Original.
- **Nomes de arquivo**: **Nomes completos** começam com o nome do item, **Nomes curtos** o deixam de fora, e **IDs da fonte** nomeiam cada slot pelo ID da fonte, como outras ferramentas de modding nomeiam o áudio do jogo.
- **Formato**: WAV, FLAC, MP3, ou WEM para slots Original. Um WEM é o arquivo exatamente como o jogo o tem, e ele entra em outro slot como áudio novo sem ser codificado de novo.

### Uma pasta para cada item {#a-folder-for-each-item}

Com **Uma pasta para cada item** ligado, os arquivos de cada entrada vão para uma pasta com o nome dela. Desligado, todos os arquivos vão para a pasta de destino.

### Pré-entrada e pós-saída {#lead-in-and-ring-out}

Exportar uma peça musical por segmento salva um arquivo por segmento. **Pré-entrada e pós-saída** inclui o áudio antes da Entrada e depois da Saída de cada segmento, para que os arquivos se sobreponham como os segmentos se sobrepõem no jogo. Desligado, os arquivos contêm só o áudio da Entrada à Saída e se encaixam um após o outro. Veja [Tempo e loops](wiki:timing-and-loops#entry-and-exit).

## A lista de exportação {#the-export-list}

Reúna coisas de lugares diferentes para exportá-las juntas. Clique com o botão direito num slot, num grupo de takes, numa entrada do Índice, numa linha de categoria ou seção, ou num pacote, e escolha **Adicionar à lista de exportação**. **Adicionar à lista de exportação** no painel de exportação adiciona o item aberto com as escolhas feitas ali. **Lista de Exportação** na barra de ferramentas abre a lista. Renomeie uma entrada para dar nome à pasta para onde ela vai, mude o que ela salva e qual áudio, remova entradas e exporte tudo numa única tarefa. A lista fica guardada até você limpá-la.

## Cores {#colours}

- A **cor principal** (o amarelo da Superterra) preenche os botões principais e marca o áudio substituído, as edições e o projeto.
- A **cor secundária** (azul) é usada para navegação e informação, como links, a aba aberta, a seleção e o anel de foco. No tema claro, também é usada em textos, linhas e tons que de outra forma estariam na cor principal.
- O cinza neutro marca o original.

Mude as duas cores, o tema, o contraste e o **Modo noturno** em [Configurações ▸ Tema](app:settings/theme).
