---
title: Perguntas Frequentes
group: Perguntas Frequentes
summary: Respostas curtas a perguntas comuns, cada uma com um link para a página que trata do assunto por completo.
source: df4f962e1978
---

## Encontrar áudio {#finding-audio}

### Quão preciso é o Índice da Biblioteca? {#how-accurate-is-the-library-index}

A música é a parte mais confiável. O Helldivers 2 dá nome aos estados que escolhem a música, como a tela, o inimigo e se há um combate acontecendo, e o Índice organiza a música por esses nomes. Os conjuntos de sons, as armas e os rótulos dos clipes vêm de pesquisas da comunidade de modding, listadas em [Sobre ▸ Créditos](app:about), e alguns desses nomes são palpites bem fundamentados. As falas recebem o nome da legenda que corresponde às palavras delas, e uma fala cuja legenda não é certa mostra **uma de várias**.

Um som sem nome aparece como *Som 3* ou *Take 2*. [O áudio do jogo, explicado](wiki:game-audio#why-many-things-are-called-sound-3-or-take-2) explica por quê. Para relatar um nome errado ou que falta, use o formulário [Nome errado ou ausente](https://github.com/Alomare/Audiodiver/issues/new?template=wrong_name.yml) no GitHub.

### Como o Audiodiver sabe qual música toca em cada situação? {#how-does-audiodiver-know-what-music-plays-in-which-scenario}

O jogo escolhe a música com estados que têm nome: a nave, o lançamento, a facção inimiga, a exploração, uma batalha e o quanto ela está pesada. O Audiodiver lê esses estados, e as regras que alternam entre eles, nos bancos de sons, e lista as músicas na ordem em que uma missão passa por elas, de *Na nave* a *Créditos*. As músicas que nenhum estado posiciona ficam em *Ainda não identificadas*. As transições recebem o nome do que elas ligam, e os stingers, do que eles tocam por cima. A ordem dentro de uma peça musical vem da playlist da peça, que a [Trilha Sonora](wiki:soundtrack) mostra.

### O que são slots, segmentos e takes? {#what-are-slots-segments-and-takes}

Um **slot** é um clipe que pode ser substituído. A música é feita de **segmentos** que tocam um após o outro, cada um com um ou mais slots. Um som tem **takes** e toca um deles a cada vez. [O áudio do jogo, explicado](wiki:game-audio) tem o glossário completo.

## Criar um mod {#making-a-mod}

### Como adiciono áudio novo a segmentos existentes? {#how-can-i-add-new-audio-to-existing-segments}

Solte um arquivo de áudio no slot de um segmento na aba [Áudio](app:editor). O áudio novo substitui o original, e o tempo do segmento acompanha a nova duração ([Tempo, pontos de cue e loops](wiki:timing-and-loops#fitting-the-timing-to-the-new-audio)). Vários arquivos soltos numa peça preenchem os slots na ordem de reprodução. Para espalhar uma música por uma peça inteira, use **Fatiar uma música**, ou **Música única** na [Trilha Sonora](wiki:soundtrack#one-song). Para uma playlist de músicas inteiras, use **Playlist** ali.

A música não pode ganhar takes ou camadas extras. Eles são para sons e vozes; veja [Adicionando áudio](wiki:adding-audio).

### Por que minha música toca fora de ordem no jogo? {#why-does-my-song-play-out-of-order-in-game}

O jogo raramente toca uma peça musical de cima para baixo. A maioria das músicas de combate começa cada combate numa abertura curta, escolhe alguns segmentos ao acaso e continua de onde o último combate parou. A [Trilha Sonora](wiki:soundtrack) mostra a ordem de reprodução de cada peça, e **Música única** faz todo combate tocar a música desde o início. [Como o jogo toca música](wiki:how-the-game-plays-music) explica as partes.

### Por que ainda ouço o áudio original? {#why-do-i-still-hear-the-original-audio}

Geralmente por um destes motivos:

- Uma camada do segmento ainda toca o original. [Camadas](wiki:how-the-game-plays-music#layers) explica como silenciá-la.
- O slot só toca sob uma condição, como um bioma, e outra variante toca em outros lugares ([Variantes](wiki:how-the-game-plays-music#variants)).
- Uma transição original toca entre duas peças de música nova ([Transições e stingers](wiki:how-the-game-plays-music#transitions-and-stingers)).
- Um som tem vários takes e alguns ainda são originais. Substitua todos eles.
- O som também está em bancos que o projeto não lista. **Aplicar patch em todos os bancos com os sons** na aba Gerar os cobre ([Todos os bancos com os sons](wiki:build-and-install#every-bank-with-the-sounds)).

### Quais arquivos de áudio posso usar? {#which-audio-files-can-i-use}

WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF, WMA e WEM. WAV ou FLAC a 48 kHz dá o melhor resultado, e um WEM em Wwise Vorbis entra no mod sem mudanças. Veja [Preparando o áudio](wiki:preparing-audio#formats).

### Como deixo o áudio novo mais alto ou mais baixo? {#how-do-i-make-new-audio-louder-or-quieter}

Defina o **Make-Up Gain** no slot, nos detalhes à direita. Vários slots selecionados recebem um único valor, e o **Nível** de uma peça na Trilha Sonora aumenta ou diminui a peça toda. [Make-Up Gain e a mixagem](wiki:volume) trata dos níveis, e [Preparando o áudio](wiki:preparing-audio#loudness), do volume percebido a buscar.

### Como silencio um som ou uma peça musical? {#how-do-i-silence-a-sound-or-a-piece-of-music}

Clique com o botão direito num slot e escolha **Substituir por silêncio**. **Manter a duração original** define se o jogo espera a duração original ou segue na hora ([Silêncio](wiki:how-the-game-plays-music#silence)). Uma peça musical inteira fica em silêncio com **Silêncio** na [Trilha Sonora](wiki:soundtrack#modes).

### Posso mudar legendas e outros textos? {#can-i-change-subtitles-and-other-text}

Sim, na aba [Texto](app:text): todas as linhas em todos os idiomas, com cores, tamanhos e ênfase. Veja [Texto e legendas](wiki:text).

## Gerar e compartilhar {#building-and-sharing}

### O Audiodiver muda os arquivos do jogo? {#does-audiodiver-change-the-game-files}

Não. Ele só lê a pasta do jogo. Uma geração cria um ZIP que um gerenciador de mods importa e implanta ([Gerando e instalando](wiki:build-and-install#installing)).

### O que faço depois de uma atualização do jogo? {#what-do-i-do-after-a-game-update}

Abra o projeto, gere-o de novo e depois importe o novo ZIP no gerenciador de mods ([Quando o jogo atualiza](wiki:game-updates#rebuild)). Um mod feito por outra pessoa pode ser gerado de novo para o jogo atual com o [Repatch](wiki:repatching).

### Meu mod funciona junto com outros mods de áudio? {#can-my-mod-run-with-other-audio-mods}

Dois mods que mudam o mesmo banco de sons não se combinam, e o implantado por último vence ([Dois mods que mudam o mesmo banco](wiki:build-and-install#two-mods-that-change-the-same-bank)). [Combinar Mods](wiki:combining-mods) os junta num único mod.

### Por que meu mod é tão grande? {#why-is-my-mod-so-big}

Um mod carrega uma cópia completa de cada banco de sons que ele muda. A música está no banco de música de cada missão, e alguns sons estão em cem bancos, então substituí-los adiciona todas as cópias ([Todos os bancos com os sons](wiki:build-and-install#every-bank-with-the-sounds), [Tamanho](wiki:adding-audio#size)).

### Como levo um projeto para outro computador? {#how-do-i-move-a-project-to-another-computer}

**Exportar como pack** na aba Projeto salva o projeto e todos os arquivos que ele usa num único arquivo `.audipack`. Abra-o no outro computador ([Pastas do projeto](wiki:project-folders)).

### Como compartilho meu mod? {#how-do-i-share-my-mod}

Envie o ZIP da pasta dos mods gerados. [Compartilhando um mod](wiki:sharing) diz o que incluir e o que deixar de fora.
