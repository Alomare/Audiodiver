---
title: Mods de Helldivers 1
group: Primeiros passos
summary: Substituir o áudio do Helldivers 1: a escolha do jogo em Início, o que um projeto pode mudar e por que um mod pode ficar grande.
source: 011a93bc722a
---

Os botões **Helldivers 1** e **Helldivers 2** no [Início](app:home) escolhem o jogo para o qual o Audiodiver cria mods. O Audiodiver procura os dois jogos ao iniciar, e a janela abre antes de eles serem lidos. Um botão fica mais escuro, com setas girando, enquanto o jogo é lido, e riscado quando o jogo não foi encontrado. A linha abaixo dos botões diz qual, com **Escolher pasta** para um jogo instalado em um lugar que a Steam não lista. O último jogo usado é escolhido de novo, ou o outro quando ele não é encontrado, e as abas e botões desse jogo aparecem assim que ele é lido.

Cada projeto pertence a um jogo, e abrir um projeto muda para esse jogo. Escolher o outro jogo fecha o projeto aberto.

## Começando um projeto {#starting-a-project}

1. Escolha **Helldivers 1** em Início e pressione **Novo projeto**.
2. Na [Biblioteca](app:library), pressione **+** no que você quer mudar.
3. Na aba [Áudio](app:editor), solte um áudio num slot ou escolha um arquivo.
4. Na aba [Gerar](app:build), pressione **Gerar**. O ZIP é instalado com [um gerenciador de mods para Helldivers 1](https://www.nexusmods.com/helldivers/mods/16), versão 1.1.0 ou mais recente.

## O que um projeto pode mudar {#what-a-project-can-change}

Um slot pode ter áudio novo ou silêncio. O áudio novo pode ter **Make-Up Gain**, **Fades** e **Igualar ao volume percebido original**, e a geração coloca isso no próprio áudio. O áudio novo assume o formato, a taxa de amostragem e os canais do original, então um arquivo estéreo num slot mono toca em mono.

As abas Trilha Sonora, Texto e Ferramentas, **Importar mod**, **Filtros**, novos takes e camadas, e Make-Up Gain no áudio original são só para o Helldivers 2.

## Obsidian {#obsidian}

A aba [Projeto](app:project) define o que o Obsidian mostra com o mod: o nome, a descrição e os autores, com vírgulas entre os nomes.

O Obsidian reconhece um mod pelo **ID do mod**. Enquanto o ID for o mesmo, uma nova geração atualiza o mod instalado. Para que as gerações atualizem um mod que você fez antes, clique em **Alterar** e cole o `id` do `obsidian.json` desse mod. Um ID tem letras minúsculas, dígitos, pontos, hifens e sublinhados, como `name.mymod`. Ao copiar um projeto para fazer um mod diferente, clique em **Criar um novo ID**, e a cópia é instalada como um mod separado.

## Áudio do Helldivers 2 {#audio-from-helldivers-2}

A Biblioteca também mostra o Helldivers 2. Selecione slots lá e pressione **Ctrl+C**, depois selecione slots na aba [Áudio](app:editor) e pressione **Ctrl+V**. O áudio original entra como áudio novo, e a geração o ajusta ao slot como qualquer outro arquivo. A cópia também funciona no sentido contrário, do Helldivers 1 para um projeto do Helldivers 2.

## Idiomas e tamanho {#languages-and-size}

Alguns sons têm uma aba para cada idioma, com slots separados. O áudio novo em um idioma toca só nesse idioma.

Um mod leva só o áudio novo, então o ZIP fica pequeno. A partir da versão 1.4.0, o gerenciador de mods coloca os clipes novos em pequenos bancos de sons ao lado dos do jogo, e os bancos de sons do próprio jogo ficam como estão, então uma implantação ocupa no disco mais ou menos o mesmo que o áudio novo. Um idioma para o qual o mod não dá áudio novo mantém os sons do jogo, que a implantação copia: cerca de 4 MB para um passo em inglês dos EUA. Depois de uma atualização do jogo, implante de novo: o mod continua como está. Mods de Helldivers 1 precisam da versão 1.1.0 ou mais recente do gerenciador de mods. Antes da 1.4.0, ele remonta cada banco de sons que o mod muda, e um som curto num banco de sons grande pode ocupar cerca de 3 GB de disco enquanto estiver implantado.
