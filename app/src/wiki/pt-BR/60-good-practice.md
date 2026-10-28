---
title: Boas práticas
group: Criando um mod
summary: Hábitos que deixam um mod mais fácil de testar, atualizar e compartilhar.
source: 81552970f352
---

- Mantenha **uma pasta por mod**, com o arquivo `.audi`, a pasta `audio` e a `build`. Uma cópia da pasta é um backup completo. Se dois projetos dividem uma pasta, a aba [Projeto](app:project) mostra um aviso com **Mover para uma nova pasta**.
- **Nomeie os arquivos na ordem de reprodução**, como `01 …` e `02 …`. Os preenchimentos e as fatias seguem essa ordem. Se você exportar de novo um arquivo alterado com o mesmo nome, a próxima geração usa a nova versão.
- **Trabalhe por etapas.** Faça um esboço de uma área, como a nave, o lançamento ou uma facção, e gere. Jogue e anote vazios, cortes bruscos e trechos baixos, depois corrija e gere de novo. As telas do aparato e do local de lançamento são as mais rápidas de alcançar no jogo.
- **Use a Reprodução contínua** antes de gerar. Ela pega a maioria dos problemas de passagem sem precisar abrir o jogo.
- **Confira as transições** que a aba Áudio marca com **!**. Uma transição original entre duas peças de música nova é o que mais costuma soar fora de lugar.
- **Ouça em momentos calmos e durante um tiroteio.** Os problemas de volume aparecem nas duas situações.
- **Mantenha o ID e o nome do mod** em [Projeto](app:project) durante toda a vida do mod, para que o gerenciador de mods atualize o mod instalado a cada vez. Use **Criar um novo ID** só quando copiar um projeto para fazer um mod diferente.
