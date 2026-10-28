---
title: Sons e vozes
group: Criando um mod
summary: Armas, inimigos, vozes e todo o outro áudio que não é música. Como a Biblioteca os mostra e o que verificar antes de substituir um deles.
source: b6977583442a
---

O Audiodiver tem mais informações sobre música, mas a Biblioteca contém todo o áudio do jogo. Esta página aborda tudo o que não é música.

## Conjuntos de sons {#sound-sets}

Fora da música, o Índice lista **conjuntos de sons**. Um conjunto de sons contém os sons de uma arma, estratagema, inimigo, voz ou tipo de planeta, com o nome que os jogadores veem no jogo.

Os sons de um conjunto aparecem em grupos. Cada grupo é um som e os **takes** que ele toca. O jogo escolhe um take ao acaso cada vez que o som toca. Para substituir um som por completo, dê áudio novo a todos os takes, senão o jogo continua misturando os originais. Arquivos soltos na linha de um grupo preenchem os takes em ordem. Clique com o botão direito na linha para preencher, silenciar ou limpar todos os takes.

A maioria dos grupos tem só números como nome, como *Som 1* e *Take 2* ([por que isso acontece](wiki:game-audio)), então ouça para diferenciá-los. ▶ na linha de um grupo toca o primeiro take. Num conjunto grande, os grupos começam recolhidos, e **Pesquisar sons** encontra um som por uma palavra ou um ID. A mesma página explica os grupos **Outros áudios** e **Sem áudio nos arquivos do jogo**.

Você também pode adicionar áudio que o jogo não tem, como mais takes para um som ou uma camada que toca junto com ele. Veja [Adicionando áudio](wiki:adding-audio).

## Armas {#weapons}

Um tiro de arma é feito de vários sons que tocam ao mesmo tempo, cada um num grupo separado do conjunto. Um tiro toca de 3 a 15 deles, dependendo da arma. A maioria das armas toca 6 ou mais, e os lança-chamas são os que mais tocam.

Um disparo geralmente é feito destas partes:

| Parte | Descrição |
|---|---|
| Mecanismo | As partes móveis da arma, como o ferrolho e o gatilho. |
| Grave | O baque grave do tiro. |
| Transiente | O estalo curto no início do tiro. |
| Cauda | O eco do tiro, e o tiro como soa de longe. |

O conjunto também contém os sons de manuseio, como a recarga e a fita de munição.

Para dar um tiro novo a uma arma, substitua ou silencie todos os grupos que o tiro toca. Um grupo deixado original continua tocando por baixo do som novo. Os grupos são numerados, então ouça cada um para descobrir qual parte do tiro ele é. Você também pode substituir uma parte e manter as outras, por exemplo para colocar um grave mais pesado por baixo do tiro original.

Algumas partes são compartilhadas com outras armas, e substituir uma delas a muda em todas as armas que a têm.

## Sons que muitas coisas compartilham {#sounds-that-many-things-share}

O jogo guarda cópias de alguns sons em muitos lugares. Por exemplo, todo banco de arma contém os sons de manuseio de armas. Um grupo assim mostra **em 104 outros bancos** e vem depois dos sons que só este conjunto tem.

Substituir um som compartilhado o muda em todo lugar onde ele toca, e os detalhes listam esses lugares em **Compartilhado com**. O mod inclui uma cópia de cada banco que ele muda, então substituir um som muito compartilhado deixa o mod grande.

## Vozes {#voices}

Uma voz tem uma parte para cada idioma instalado, como *Inglês* e *Italiano*, com gravações separadas para cada um. Uma fala substituída na parte em inglês só é ouvida por quem joga em inglês.

Uma fala recebe o nome das palavras da legenda correspondente, e o filtro a encontra por essas palavras. Quando vários takes dizem a mesma fala, o grupo e cada take mostram as palavras.

Os sons sem palavras recebem o nome do que são, como *Grunhido 1* ou *Ofego 3*, e são numerados separadamente para cada voz. Os grunhidos são sons curtos de esforço. **Ofego** abrange a respiração mais longa, os suspiros e as risadas. A maioria desses sons fica no fim de uma voz de Helldiver e em **Sons de esforço dos Helldivers**, em grupos chamados **Grunhidos** e **Ofego**. Cada um desses clipes é compartilhado por duas vozes de Helldiver: as vozes 1 e 3, e as vozes 2 e 4.

Uma fala com legenda mostra um link **Legenda** nos detalhes. O link abre a fala na aba [Texto](wiki:text) para mudar as palavras.

## Todos os pacotes {#all-archives}

O Índice contém só o áudio com nome. **Todos os pacotes** contém cada pacote com áudio. Os pacotes que estão no Índice mostram um nome e ícones de categoria, e os outros mostram *Ainda sem nome*. Ordene por **Sons** para encontrar os maiores pacotes, ou por **Idioma** para encontrar um pacote de voz.

Quando uma atualização do jogo adiciona áudio, procure-o em Todos os pacotes. Ele pode ser tocado, adicionado ao projeto e substituído na hora.

As duas listas aceitam IDs, além de palavras. Cole um ID da fonte, um ID de arquivo de stream ou um ID de banco para ver onde ele está.
