---
title: Conteúdo do Patch
group: Geração e compartilhamento
summary: Como substituir sons dentro de um mod existente, sobre os próprios bancos de sons do mod, também sons que uma atualização tirou do jogo.
source: 120fdcca46f4
---

O patch de um mod guarda cópias dos bancos de sons que ele altera, como estavam na versão do jogo para a qual o mod foi feito, e o jogo toca essas cópias no lugar dos bancos atuais. **Conteúdo do Patch**, em [Ferramentas](app:tools/content), abre um mod como ele é, lista os sons dos patches e grava o mod de novo com áudio novo para os sons escolhidos. Todo o resto fica como o mod tem.

## Quando usar {#when-to-use-it}

- Uma atualização tirou um som do jogo, e um mod feito antes da atualização ainda tem esse som. A versão 7.2.2, por exemplo, tirou o hino que tocava enquanto uma bandeira sobe. Um projeto e o **Repatch** geram sobre os bancos de sons atuais, que não têm mais um som assim, então só os bancos do mod antigo podem levar áudio novo para ele.
- Alguns sons de um mod precisam de outro áudio, e nada mais no mod deve mudar.

Para sons que o jogo ainda tem, um projeto ou o [Repatch](wiki:repatching) é a melhor escolha: os dois geram sobre os bancos atuais, então o mod acompanha o jogo.

## Abrindo um mod {#opening-a-mod}

1. Abra [Ferramentas](app:tools/content) e escolha **Conteúdo do Patch**.
2. Solte o mod na página como ZIP, pasta ou arquivo `.patch_0`, ou pressione **Escolher um ZIP ou arquivo de patch** ou **Escolher uma pasta**.

A lista começa pelos sons que o jogo atual não tem, marcados com **Fora do jogo**. **Todos os Sons** mostra cada som do mod, e a pesquisa encontra um som pelo ID, pelo nome ou por um banco. Cada linha toca o áudio como o mod o tem e diz quais bancos do mod têm o som.

## Dando áudio novo aos sons {#giving-sounds-new-audio}

- Solte um arquivo de áudio em um som, ou pressione **Escolher Arquivo** na linha. **Silêncio** substitui o som por silêncio.
- O ✕ tira o áudio novo de novo.
- O áudio novo vai para cada banco e stream do mod que tem o som. Um arquivo é codificado como uma geração o codifica, e um `.wem` que o jogo toca como está entra sem mudança.

## Gravando o mod {#writing-the-mod}

Escolha o nome que o gerenciador de mods mostra e uma pasta de destino, depois pressione **Gravar o Mod**. O novo ZIP é o mod como era: o manifesto, as opções, os outros arquivos e o ID do mod ficam, então importá-lo em um gerenciador de mods atualiza o mod antigo. Um mod sem manifesto vira um ZIP para gerenciador de mods, com uma opção para cada parte do mod.

Cada patch que tem um som escolhido é gravado de novo e conferido com o antigo: só o áudio desses sons, os tamanhos que o descrevem e o tempo da música que o toca mudam.

## O que saber {#what-to-know}

- Os bancos do mod ficam como estavam na versão do jogo para a qual o mod foi feito. Com o mod instalado, o jogo toca esses bancos no lugar dos atuais, então o que uma atualização mudou neles não chega ao jogo. Veja [Sons de uma versão antiga do jogo](wiki:repatching#sounds-from-an-older-game-version).
- Um mod feito assim continua sendo obra do autor original. Mantenha-o para uso pessoal e só o compartilhe com a permissão do autor.
