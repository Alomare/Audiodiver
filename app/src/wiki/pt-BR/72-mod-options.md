---
title: Opções para Jogadores
group: Geração e compartilhamento
summary: Grupos que os jogadores marcam no gerenciador de mods, cada um com opções para escolher, como um de cinco sons para uma arma.
source: e6c8bc37ba4c
---

## Grupos e opções {#groups-and-options}

Um **grupo** é uma parte do mod que os jogadores podem ligar ou desligar no gerenciador de mods, como **Tiro do Liberator** ou **Extração**. O grupo tem **opções** para escolher, como **1**, **2** e **3**. Os jogadores marcam um grupo e escolhem uma opção dele. Um grupo desmarcado não instala nada, então os slots do grupo tocam como tocariam sem ele: o som original, ou o que o resto do mod coloca ali.

Tudo o que fica fora dos grupos é o **mod base**, que sempre é instalado.

Os grupos são criados na aba [Projeto](app:project), em **Opções para Jogadores**:

- **Adicionar grupo** adiciona um grupo com uma opção. **Adicionar opção** adiciona outra.
- Clique em um nome para alterá-lo. Cada grupo e cada opção também tem uma descrição.
- O quadrado ao lado de um nome escolhe a imagem que os jogadores veem no gerenciador de mods. Ela é cortada em um quadrado centralizado, como o ícone.
- As setas movem grupos e opções, e a lixeira os remove. A primeira opção de um grupo é a que um gerenciador de mods escolhe de início.

Cada grupo tem uma letra e cada opção um número, que juntos formam um código como **A3**: a letra aparece na imagem do grupo, e o código ao lado da imagem de cada opção. Os códigos seguem a ordem: o primeiro grupo é **A**, e **A3** é a terceira opção desse grupo. Mover ou remover um grupo ou uma opção muda os códigos que vêm depois.

Abaixo de cada opção, uma linha diz o que ela altera e mais ou menos quanto acrescenta ao mod. **Alterações** lista cada slot que a opção altera, com o ajuste como está no mod base e como está na opção. O botão de desfazer em uma linha tira aquela alteração da opção, depois de uma pergunta. Clique no nome de um slot para mostrá-lo na aba Áudio.

## Editando uma opção {#editing-an-option}

**Selecionar** em uma opção faz a aba [Áudio](app:editor) editar essa opção, e a opção fica destacada na aba Projeto. A barra acima da aba Áudio diz o que está sendo editado, e o menu dela escolhe outra coisa: **Mod base**, ou uma opção de um grupo. **Voltar ao mod base**, em qualquer uma das abas, volta a editar o próprio mod. Uma opção é editada por vez.

Enquanto uma opção é editada, a aba Áudio toca o mod com essa opção escolhida. As alterações nos slots vão para a opção:

- Um slot do grupo vai para a opção. A linha mostra o código da opção, como **A3**.
- Um slot que ainda não tem grupo entra no grupo.
- Um slot de outro grupo não pode mudar. A linha mostra a letra desse grupo, tracejada.

Tudo o que é feito nos slots conta: soltar arquivos, copiar e colar, Silêncio, o ganho, os filtros e os fades nos detalhes, os pontos de marcação e o [Waveform Suite](wiki:timing-and-loops#the-waveform-suite). O painel de detalhes diz qual opção altera um slot e o que toca sem o grupo.

**Remover da opção**, no menu de contexto de um slot, tira a alteração: o slot passa a tocar como sem o grupo. Um slot que nenhuma opção do grupo altera mais volta a ser do mod base.

Takes novos, camadas e Isolar áudio mudam aquilo de que os sons são feitos, então pertencem ao mod base. Volte ao mod base para usá-los.

## Ganho {#gain}

**Ganho** em uma opção soma essa quantidade de dB a cada slot que o mod base altera, de −12 a +12 dB. Um grupo **Volume** com **Mais alto** a +3 dB e **Mais baixo** a −3 dB deixa os jogadores escolherem o volume do mod. Os slots dos grupos mantêm os níveis definidos neles, e o mesmo vale para um slot do mod base alterado enquanto uma opção é editada: ele entra no grupo com o nível que recebeu.

## Grupos que alteram os mesmos bancos {#groups-that-change-the-same-banks}

Nos gerenciadores de mods do Helldivers 2, cada opção substitui bancos de sons inteiros. Dois grupos não podem alterar o mesmo banco: o que for implantado por último prevaleceria ali, seja qual for a escolha dos jogadores no outro. Por isso um slot cujo banco já tem sons de outro grupo não pode entrar em um segundo grupo; altere-o naquele grupo, ou no mod base. As abas Projeto e Gerar avisam se dois grupos ainda compartilham bancos, como um grupo **Volume** e um grupo que altera slots nos bancos do mod base.

O Obsidian, para mods do Helldivers 1, não tem esse limite: a geração inclui uma versão dos sons compartilhados para cada combinação de escolhas.

## O que uma geração produz {#what-a-build-makes}

Para o Helldivers 2, o gerenciador de mods lista primeiro o mod base. Cada grupo vem em seguida, com as opções dele para escolher. Cada opção contém só os bancos de sons e os streams que diferem do mod base. Onde uma opção devolve o original a um som que o mod base substitui, ela contém o banco do jogo, então o original toca.

Um banco entra inteiro, com todos os sons guardados nele. A maioria dos sons fica guardada em bancos, então uma opção que altera um deles acrescenta o tamanho completo daquele banco: cerca de 10 MB para um som típico, e muito mais para música, da qual cada banco de música de missão tem uma cópia. Um som que o jogo toca em streaming de um arquivo separado acrescenta só o tamanho desse arquivo.

Para o Helldivers 1, cada grupo é uma opção no Obsidian, com as opções dele e **Desativado** para escolher.

> Uma opção que ainda não altera nada não implanta nada. Preencha-a na aba Áudio, ou dê um ganho a ela, antes de gerar.
