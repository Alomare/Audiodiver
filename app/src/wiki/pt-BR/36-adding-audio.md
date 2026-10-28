---
title: Adicionando áudio
group: Criando um mod
summary: Takes novos para um som, uma camada que toca junto com ele e áudio novo só para um som, além do que o jogo tem.
source: ea7154765378
---

Substituir o áudio muda o que um slot toca. Os sons também podem receber áudio que o jogo não tem, de três jeitos, todos na aba Áudio. Eles funcionam para sons e vozes, mas não para música.

## Takes novos {#new-takes}

Um som que escolhe um de vários takes ao acaso pode ganhar mais takes. Pressione **+** na linha do som, escolha **Novos takes** e selecione um arquivo para cada take. O jogo então escolhe entre os takes originais e os novos. Um take novo é marcado como *take novo* e não tem original para tocar. ✕ o remove.

Para substituir um som por completo, dê áudio novo a todos os takes existentes. Veja [Sons e vozes](wiki:sounds-and-voices).

## Uma camada {#a-layer}

Uma camada toca junto com um som toda vez, como um estrondo mais grave por baixo de um disparo. Pressione **+** e escolha **Nova camada** para adicionar uma camada abaixo do som, com um take para cada arquivo que você escolher. **+** na camada adiciona mais takes, e o jogo escolhe um deles a cada vez. Uma camada vai para o mesmo lugar da mixagem que o som, e o Make-Up Gain define o volume dela.

**Nova camada** fica desativado para sons que não podem ter uma camada. Um som que é uma das escolhas aleatórias de outro som não pode ter uma, porque a camada viraria só mais uma escolha. Um som que nada toca diretamente também não pode.

## Só este som {#only-this-sound}

Muitas vezes vários sons tocam o mesmo clipe, e substituir o clipe o muda em todos eles. Para limitar uma substituição, defina **Escopo** nos detalhes de um slot substituído como **Só este som**. Os outros sons então mantêm o original, e os slots deles mostram **substituído em outro som**. Cada opção mostra quantos bancos ela muda.

O áudio novo entra no mod com um ID novo. As ferramentas que listam clipes por ID mostram o ID antigo com o Original, embora o jogo toque o áudio novo nesse som.

Esta opção funciona por som. Quando o jogo copia um som inteiro para outros bancos, como os sons de manuseio de armas em todo banco de arma, as cópias são o mesmo som e todas elas mudam.

## Tamanho {#size}

O áudio adicionado vai para todos os bancos que contêm o som. Como nas substituições, adicionar áudio a um som muito compartilhado deixa o mod grande. Para limitá-lo aos bancos do projeto, veja [Áudio adicionado em outros bancos](wiki:build-and-install#added-audio-in-other-banks).
