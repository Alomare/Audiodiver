---
title: Pastas do projeto
group: Primeiros passos
summary: Onde um projeto guarda os arquivos, como mover um projeto, e como um pack leva um projeto para outro computador.
source: e77121941946
---

## A pasta do projeto {#the-project-folder}

Um projeto novo ganha uma pasta com o nome dele, com o arquivo do projeto dentro, como em `Dune\Dune.audi`. O Audiodiver coloca tudo o que cria para o projeto numa pasta `audio` ao lado desse arquivo:

- `audio\slices` contém os pedaços que a ferramenta de fatiar corta.
- `audio\imported` contém o áudio decodificado do patch de um mod importado.
- `audio\added` contém os arquivos que **Reunir arquivos** copiou de outros lugares.

Os ZIPs gerados vão para uma pasta `build` ao lado do arquivo do projeto.

O áudio escolhido de outra pasta fica lá, e o projeto guarda o caminho até ele. Os caminhos num arquivo de projeto são relativos à pasta do projeto, e um arquivo em outra unidade é guardado com o caminho completo. Uma pasta movida à mão continua com os arquivos que estão dentro dela, mas o projeto pode perder os que estão fora. [Mover projeto](#moving-a-project) os mantém.

Projetos mais antigos podem dividir uma pasta, com `slices` e `imported` ao lado do arquivo `.audi`. Eles continuam funcionando, e a aba [Projeto](app:project) oferece movê-los.

## Mover um projeto {#moving-a-project}

**Mover projeto**, em **Pasta** na aba Projeto, move a pasta do projeto para uma pasta que você escolher: escolher `D:\Mods` para `Dune` a transforma em `D:\Mods\Dune`. Quando `D:\Mods` já tem uma pasta chamada `Dune`, a pasta do projeto vira `Dune 2`.

Tudo o que está na pasta do projeto vai junto: o arquivo do projeto, o áudio que o Audiodiver criou, os arquivos que você colocou ali e os mods gerados. Os arquivos escolhidos de fora da pasta ficam onde estão, e o projeto continua encontrando-os. Na mesma unidade, a mudança leva um instante. Para outra unidade, os arquivos são copiados antes, o que demora mais num projeto grande. A lista de projetos recentes acompanha o projeto até o novo caminho.

Um projeto que [divide uma pasta](#moving-a-project-into-a-new-folder) com outros projetos ou arquivos primeiro vai para uma nova pasta, e então essa pasta é movida.

## Mover um projeto para uma nova pasta {#moving-a-project-into-a-new-folder}

A aba Projeto mostra um aviso quando o projeto divide uma pasta com outros projetos, ou está num local compartilhado, como a Área de Trabalho. O Audiodiver coloca as fatias, o áudio importado e os mods gerados ao lado do arquivo do projeto, e numa pasta que contém só este projeto eles ficam separados de outros arquivos. **Mover para uma nova pasta** cria uma pasta com o nome do projeto ao lado do arquivo do projeto e move para ela:

- o arquivo do projeto
- as fatias e o áudio importado que o Audiodiver criou para ele
- os mods gerados na pasta padrão de geração

Os arquivos escolhidos de outros lugares ficam onde estão. Um arquivo que outro projeto da pasta antiga usa é copiado. A lista de projetos recentes acompanha o projeto até o novo caminho.

## Reunir arquivos {#collecting-files}

**Reunir arquivos** copia o áudio de fora da pasta do projeto para `audio\added` e faz o projeto apontar para as cópias. Um único Desfazer reverte isso, e as cópias ficam no disco.

Quando todos os arquivos estão dentro da pasta do projeto, o projeto pode ser movido ou copiado como uma única pasta.

## Arquivos ausentes {#missing-files}

Um arquivo que o projeto usa fica ausente quando é movido, renomeado ou excluído fora do Audiodiver. O slot então mostra **Faltando:** antes do nome do arquivo, e a aba Gerar lista o arquivo como problema, porque o mod não pode ser gerado sem ele. Coloque o arquivo de volta onde estava, ou clique no nome do arquivo no slot para escolher outro. Com todos os arquivos dentro da pasta do projeto ([Reunir arquivos](wiki:project-folders#collecting-files)), os arquivos se movem junto com o projeto.

## Arquivos sem uso {#unused-files}

**Encontrar arquivos sem uso** lista o que o Audiodiver criou para o projeto e que nada mais usa: fatias de um corte antigo, áudio decodificado de um patch importado, arquivos reunidos que nenhum slot toca. **Remover** os manda para a Lixeira, e o Windows pode restaurá-los. Numa unidade sem Lixeira, como uma unidade de rede, o Audiodiver pergunta antes de excluí-los de vez.

O Audiodiver procura só nas pastas que ele cria, que são `audio\slices`, `audio\imported`, `audio\added` e as antigas `slices` e `imported`. Antes de remover qualquer coisa, o Audiodiver confere a lista de novo e mantém qualquer arquivo usado pelo projeto, pelo histórico de Desfazer ou por outro projeto da pasta.

## Packs {#packs}

Um pack é um único arquivo com a extensão `.audipack`. Ele contém o arquivo do projeto e os arquivos que o projeto usa, para que o projeto abra igual em outro computador. Os mods gerados e os arquivos sem uso ficam de fora, e um arquivo de fora da pasta vai para `audio\added`.

**Exportar como pack** na aba Projeto grava um pack. Abra-o com **Abrir projeto** em [Início](app:home), ou clique duas vezes nele no Explorador de Arquivos. O Audiodiver descompacta o projeto numa nova pasta dentro da pasta de projetos e o abre. A pasta de projetos é `Documents\Audiodiver\Projects` no começo, e depois a pasta onde o último projeto novo foi criado.

Para compartilhar o próprio mod, veja [Compartilhando um mod](wiki:sharing).

## Abrir arquivos pelo Explorador de Arquivos {#opening-files-from-explorer}

Com o instalador, clicar duas vezes num arquivo `.audi` ou `.audipack` abre o Audiodiver com esse projeto ou pack. Quando o Audiodiver já está aberto, o mesmo clique duplo abre o arquivo na janela aberta.

A cópia portátil do ZIP da versão não registra esses tipos de arquivo. Abra os projetos e packs pelo app.
