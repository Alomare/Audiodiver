---
title: Combinando mods
group: Geração e compartilhamento
summary: Como fazer um único mod a partir de vários mods de áudio que mudam os mesmos bancos de sons, escolhendo de quem é a versão de cada som compartilhado que entra.
source: cbb14758fe48
---

Um mod contém cópias completas dos bancos de sons que ele muda. Quando dois mods mudam o mesmo banco, o implantado por último substitui a cópia do outro, então só um deles toca. Os mods de música dividem a maioria dos bancos, e muitos mods de armas e de vozes também. **Combinar mods**, em [Ferramentas](app:tools/combine), lê vários mods e gera um único mod com o áudio de todos eles, nos bancos de sons atuais.

## Quando usar {#when-to-use-it}

- Dois mods que você quer usar juntos mudam os mesmos bancos, e só o implantado por último toca.
- Vários mods pequenos são mais fáceis de manter e atualizar como um só.

## Combinar mods {#combining-mods}

1. Abra [Ferramentas ▸ Combinar mods](app:tools/combine).
2. Solte os mods na página. Você pode soltar os ZIPs baixados, as pastas dos mods, ou os arquivos `.patch_0` com os arquivos `.stream` ao lado. **Adicionar ZIPs ou arquivos de patch** e **Adicionar uma pasta** fazem o mesmo, e **Mods instalados** lista os mods da biblioteca de um gerenciador de mods e da pasta do jogo.
3. Escolha as opções de cada mod. Um mod com opções as lista abaixo do nome do mod, começando pelas escolhas que o gerenciador de mods registrou. Uma opção com várias escolhas fica com uma delas.
4. Coloque os mods em ordem com ↑ e ↓. Veja [Ordem e conflitos](#order-and-conflicts).
5. Pressione **Verificar conflitos** e escolha um mod para cada conflito encontrado.
6. Confira o nome e depois pressione **Combinar**.

Depois de uma verificação, mudar a lista, a ordem ou as opções exige uma nova verificação antes que **Combinar** funcione. Uma segunda verificação é rápida, porque o Audiodiver guarda o que leu de cada mod.

## Ordem e conflitos {#order-and-conflicts}

Um conflito é um som que mais de um mod muda de jeitos diferentes. Os mods dão áudios diferentes ao mesmo clipe, ou definem a mesma configuração, como o volume de um som, com valores diferentes. Mods que dão o mesmo áudio a um clipe não entram em conflito. Os takes novos e as camadas que vários mods adicionam ao mesmo som são todos mantidos.

Os conflitos são agrupados pelo item deles no Índice, como uma peça musical ou uma arma. Cada linha toca primeiro o original e depois a versão de cada mod. O mod destacado é o que entra. **Tudo de**, na linha de um item, escolhe um mod para todos os conflitos daquele item. Por padrão, ganha o mod mais abaixo na lista, como se ele fosse implantado por último.

Uma configuração num som em conflito acompanha o som, então o mod cujo áudio entra também traz o volume definido nesse som. Os pontos de cue acompanham o áudio do mesmo jeito: um segmento musical recebe os pontos de cue do mod cujo áudio ele toca.

## Pasta de destino {#destination-folder}

O novo ZIP vai para a **Pasta de destino**. O local padrão é `Documents\Audiodiver\Combined`, e **Alterar** escolhe outro. Se já houver um ZIP com o mesmo nome ali, ele fica, e o novo recebe um número.

Depois de uma atualização do jogo, combine os mods de novo. Para mudar mais o áudio, crie um projeto e importe nele o patch combinado, como explica [Quando o jogo atualiza](wiki:game-updates#mods-made-with-older-tools). Um projeto pega só o áudio.

## O que a combinação deixa de fora {#what-combining-leaves-out}

- Alterações que o Audiodiver não leva, como efeitos ou o modo como um contêiner escolhe os sons, e sons que um mod ainda tem de uma versão mais antiga do jogo. O resultado as lista para cada mod, como o [Repatch](wiki:repatching#what-repatching-leaves-out) faz.
- Um arquivo além do áudio, como uma textura ou uma tabela de textos, que dois mods têm: a cópia do mod mais acima na lista. Entra a cópia do mod mais abaixo, como se esse mod fosse implantado por último, e o resultado avisa isso.

Todo o resto dos patches, como texto, modelos e texturas, entra como estava.

## Instalar o resultado {#installing-the-result}

O mod combinado é um mod novo com um ID novo. No gerenciador de mods, desative os mods que ele combina, depois importe o novo ZIP e implante-o. Um mod combinado continua sendo obra dos autores originais, então mantenha-o para uso pessoal e só o compartilhe com a permissão deles.
