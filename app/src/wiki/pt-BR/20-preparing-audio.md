---
title: Preparando o áudio
group: Criando um mod
summary: Quais arquivos usar, qual volume dar a eles e como cortá-los para que caibam no jogo.
source: cb164f9ebd07
---

## Formatos {#formats}

O Audiodiver lê WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF, WMA e WEM. Uma geração converte cada arquivo para o formato que o jogo toca, Vorbis a 48 kHz em estéreo. Arquivos mono continuam mono, e arquivos surround são mixados para estéreo.

Um arquivo WEM em Wwise Vorbis, mono ou estéreo, entra no mod sem mudanças, porque o jogo o toca como ele é. Uma geração converte qualquer outro arquivo WEM como os formatos acima.

Comece pela melhor cópia que você tiver. **WAV ou FLAC a 48 kHz** passa por uma única conversão. Um MP3 também funciona, mas é comprimido uma segunda vez, o que pode deixar um leve chiado nos pratos e nas caudas de reverb.

## Volume percebido {#loudness}

A música do jogo fica em torno de **−13 a −15 LUFS** (volume percebido integrado). Música nesse nível combina com os efeitos e as vozes sem mais alterações.

- Meça o volume percebido com um medidor de LUFS. A altura da forma de onda é um mau guia. [Ferramentas e links](wiki:tools-and-links) lista medidores gratuitos.
- Mantenha os picos abaixo de cerca de **−1 dBTP** para que a conversão não cause clipping.
- Se um slot ainda soar baixo ou alto demais no jogo, mude o Make-Up Gain do slot em vez de exportar o arquivo de novo. Veja [Make-Up Gain e a mixagem](wiki:volume).

## Duração e cortes {#length-and-cuts}

- Corte o silêncio do início de cada arquivo. O jogo começa um clipe na primeira amostra, então uma introdução silenciosa toca como um vazio.
- Uma peça que faz loop deve terminar num ponto em que possa recomeçar. Um fade-out deixa o ponto do loop audível.
- Mantenha uma ressonância natural no fim. O áudio depois do ponto de *Saída* de um segmento toca por cima do segmento seguinte. Veja [Tempo, pontos de cue e loops](wiki:timing-and-loops).
- Nomeie os arquivos de uma peça na ordem de reprodução, como `01 Intro` e `02 Loop`. Os preenchimentos seguem a ordem dos nomes de arquivo, que coloca `2` antes de `10`.

## Onde guardar os arquivos {#where-to-keep-the-files}

Guarde o áudio na pasta do projeto. Arquivos de outras pastas também funcionam, e **Reunir arquivos** na aba [Projeto](app:project) os copia para `audio\added`. Os caminhos são guardados em relação à pasta do projeto, então a pasta inteira pode ser movida ou copiada. Gerar lista um arquivo ausente como problema e não gera até que ele seja corrigido.
