---
title: Importando um mod
group: Primeiros passos
summary: Um mod feito com qualquer ferramenta, como um projeto para continuar trabalhando: o áudio, os sons que ele adiciona, as configurações e o texto.
source: 672ff32999fa
---

**Importar mod** em [Início](app:home), ou na aba [Projeto](app:project) enquanto não há projeto aberto, cria um projeto novo a partir de um mod existente. Escolha o ZIP do mod, ou um arquivo `.patch_0`. O painel que abre mostra o mod como um gerenciador de mods o mostra, e lista o que entra antes de gravar qualquer coisa.

## Opções, nome e pasta {#options-name-and-folder}

1. Escolha as opções. Um mod com opções, como uma escolha de vozes ou uma versão com legendas, começa com as opções que o gerenciador de mods tem ativadas, ou com todas elas. **O que entra** lista os patches que essas opções implantam.
2. Dê um nome ao projeto e escolha a pasta. O projeto vai para uma nova pasta ali.
3. **Manter o ID do mod** faz as gerações do projeto atualizarem este mod no gerenciador de mods. Desligue para instalar as gerações ao lado do mod, como outro mod ([ID do mod](wiki:build-and-install#mod-id)).
4. **Usar o ícone do mod** coloca no projeto a imagem que o gerenciador de mods mostra. Sem isso, o projeto fica com o ícone padrão.
5. Pressione **Criar projeto**. O projeto abre na aba Áudio quando a importação termina.

## O que entra {#what-comes-in}

- O áudio que o mod substitui, nos mesmos sons. Ele entra nas gerações sem ser convertido de novo.
- O áudio que o mod adiciona: takes novos para um som, um som novo que toca junto com um existente (uma camada), ou um clipe separado para um único som. Cada um vira o mesmo tipo de adição que [Adicionando áudio](wiki:adding-audio) faz.
- O Make-Up Gain, nos slots dos sons que ele alcança, também quando o mod o define num contêiner acima deles. Um slot tem um único ganho, então, quando o mod dá ganhos diferentes a dois sons que tocam o mesmo clipe, esses ganhos ficam nos sons, junto com as outras configurações.
- Outras configurações de som, como o volume ou o tom de um som ou de um contêiner, ou um atraso antes de tocar. As gerações as incluem, e o painel de detalhes da aba Áudio as lista em **Configurações importadas** em cada slot que elas alcançam.
- Curvas de volume em faixas de música. As gerações as incluem, e as formas de onda as mostram. Veja [Curvas de volume](wiki:volume#volume-curves).
- Os pontos de cue dos segmentos musicais a que o mod dá áudio novo.
- As linhas do texto do jogo que o mod muda, como legendas ou nomes.

Modelos, texturas e outros arquivos que não são áudio nem texto ficam de fora, porque um projeto contém só áudio e texto. Outros tipos de alteração, como efeitos ou o modo como um contêiner escolhe os sons, também não são importados. A importação lista o que ficou de fora.

## Texto {#text}

O texto entra como alterações na aba [Texto](app:text), uma para cada linha que o mod muda. Um mod carrega tabelas inteiras de texto, então um mod feito para uma versão mais antiga do jogo também carrega o texto dessa versão. Essas linhas aparecem como alterações mesmo onde só o jogo mudou, como um inimigo renomeado numa atualização. O painel lista cada linha com o texto do mod acima do texto atual. Desmarque as linhas que só o jogo mudou, uma por uma ou um grupo de uma vez.

## No projeto aberto {#into-the-open-project}

**Importar patches** na aba Projeto, ou um arquivo `.patch_0` solto na janela, traz um mod para o projeto aberto. O mesmo painel abre, sem o nome e a pasta. Se o projeto não estiver vazio, escolha como o áudio entra. **Adicionar ao projeto** mantém o conteúdo atual, e onde os dois têm áudio para um slot, entra o áudio do mod. **Substituir o áudio do projeto** remove antes o áudio novo, os sons adicionados, os pontos de cue e a lista. O texto e os arquivos de áudio ficam nos dois casos, e Desfazer restaura o projeto.

Para gerar de novo um mod para a versão atual do jogo sem um projeto, use o [Repatch](wiki:repatching).
