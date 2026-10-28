---
title: Quando o jogo atualiza
group: Geração e compartilhamento
summary: Por que um mod de música geralmente só precisa ser gerado de novo depois de um patch, e o que fazer quando precisa de mais.
source: 3a5f4d64907d
---

Os patches pequenos do Helldivers 2 geralmente não mudam o áudio. As grandes atualizações muitas vezes adicionam música para um novo inimigo ou um novo tipo de planeta, e podem mover músicas existentes para outros arquivos do jogo.

## Gerar de novo {#rebuild}

Um projeto registra *qual som* o áudio novo substitui. Ele não registra onde esse som fica guardado. Depois de uma atualização:

1. Inicie o Audiodiver. Ele detecta os arquivos do jogo alterados e os lê de novo, então a primeira inicialização depois de uma atualização leva cerca de um minuto. Se o jogo mudou de lugar e o Audiodiver não o encontra, a tela inicial pede a pasta do jogo. Você também pode definir a pasta em **Jogo** nas [Configurações](app:settings/system).
2. Abra o projeto e gere-o.
3. Importe o novo ZIP no gerenciador de mods e implante-o.

A nova geração aplica patch nos bancos de sons atuais, então inclui todas as mudanças da atualização.

## Quando um som mudou de lugar {#when-a-sound-has-moved}

Se um som substituído não existe mais, a aba [Gerar](app:build) o lista como problema, e você não consegue gerar até corrigi-lo. Encontre o novo local na [Biblioteca](app:library), adicione-o ao projeto e atribua o arquivo ali.

As músicas novas aparecem no Índice automaticamente. As músicas que o Audiodiver ainda não consegue identificar ficam em **Ainda não identificadas**. Outros áudios novos aparecem em **Todos os pacotes** na hora, sem nome. Veja [Sons e vozes](wiki:sounds-and-voices).

## Mods feitos com ferramentas antigas {#mods-made-with-older-tools}

Os patches de ferramentas antigas, baseadas em IDs, contêm bancos de sons completos da versão do jogo em que foram gerados. Depois de uma grande atualização, um patch assim faz esses bancos voltarem atrás e pode desfazer músicas mais novas.

Para atualizar um desses mods, [faça o repatch](wiki:repatching) dele em [Ferramentas ▸ Repatch](app:tools/repatch). Solte o mod na página, e o Audiodiver o gera de novo para a versão atual do jogo.

Para continuar trabalhando no mod no Audiodiver, importe-o ([Importando um mod](wiki:importing-mods)). **Importar mod** em [Início](app:home) cria um projeto novo a partir dele, e **Importar patches** na aba [Projeto](app:project) o traz para o projeto aberto. O áudio do mod entra na geração sem ser convertido de novo.
