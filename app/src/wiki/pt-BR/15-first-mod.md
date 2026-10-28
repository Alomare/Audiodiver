---
title: Um primeiro mod
group: Primeiros passos
summary: De um projeto vazio a música nova no jogo, em nove passos.
source: 42abc2715a07
---

Esta página mostra como substituir a música da tela do aparato e ouvir o resultado no jogo, instalado com um gerenciador de mods.

1. Em [Início](app:home), escolha **Novo projeto** e dê um nome ao projeto. O Audiodiver cria uma pasta para ele, com o arquivo do projeto dentro, na pasta de projetos (no começo, `Documents\Audiodiver\Projects`). A aba [Projeto](app:project) abre com o nome, o ícone e a pasta do mod. Copie os arquivos de áudio para essa pasta.
2. Vá para a [Biblioteca](app:library). No Índice, abra **Antes do lançamento** em Música e pressione ▶ ao lado de **Seleção do aparato** para ouvi-la.
3. Clique em **Seleção do aparato**. Ela tem um segmento inicial seguido de catorze loops que o jogo toca em ordem. No jogo, a tela do aparato vem depois da tela do local de lançamento, e a música continua de onde estava, nos loops, então o início raramente é ouvido. Pressione **Adicionar ao projeto**.
4. Vá para a aba [Áudio](app:editor) e clique em **Seleção do aparato** na lista.
5. Arraste os arquivos de áudio do Explorador de Arquivos para a peça na lista, ou para o primeiro slot da peça. Os slots são preenchidos na ordem dos nomes de arquivo, então nomeie os arquivos `01 …`, `02 …` e assim por diante.
6. Selecione um slot e pressione ▶ em cada metade da linha. A metade esquerda toca o original, e a direita, a substituição. Alternar entre eles mantém a posição da reprodução. As formas de onda abaixo mostram os dois na mesma escala de tempo.
7. Pressione o botão amarelo {icon:through} **Reprodução contínua** acima dos slots. Ele toca a peça inteira com as mesmas passagens entre segmentos que o jogo usa, e seleciona cada slot enquanto toca.
8. Em [Projeto](app:project), dê um nome e um ícone ao mod.
9. Pressione **Gerar**. Importe o ZIP num gerenciador de mods, implante-o e inicie o jogo.

> [!TIP]
> Ouça no jogo com as configurações de volume normais, nos momentos alterados. O jogo abaixa a música em algumas telas. Veja [Make-Up Gain e a mixagem](wiki:volume) para mais detalhes.

## Próximos passos {#next-steps}

- Adicione mais coisas da Biblioteca. Uma peça com várias partes tem {icon:fillpiece} **Preencher a peça inteira**, que recebe arquivos para todas as partes de uma vez.
- Armas, inimigos, vozes e outros sons também estão no Índice. Veja [Sons e vozes](wiki:sounds-and-voices).
- {icon:slice} **Fatiar uma música** corta uma música longa em pedaços que tocam sem intervalos. Veja [Tempo, pontos de cue e loops](wiki:timing-and-loops).
- Depois de uma alteração, gere de novo e importe o novo ZIP. O gerenciador de mods atualiza o mod instalado. Veja [Gerando e instalando](wiki:build-and-install).
