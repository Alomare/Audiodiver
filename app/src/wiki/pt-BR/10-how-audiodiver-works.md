---
title: Como o Audiodiver funciona
group: Primeiros passos
summary: O que o Audiodiver faz, o que é um projeto e para que serve cada aba.
source: c76f32ef9388
---

O Audiodiver substitui o áudio do Helldivers 2 pelo **que ele é e onde toca**. Encontre uma peça musical ou um conjunto de sons na Biblioteca, adicione ao projeto e dê a ele áudio novo. O Audiodiver então calcula os bancos de sons, IDs e valores de tempo de que o jogo precisa.

[O áudio do jogo, explicado](wiki:game-audio) aborda pacotes, bancos, takes, cues, segmentos e slots. [Entendendo a tela](wiki:reading-the-screen) descreve cada parte da janela.

## Projetos {#projects}

Um projeto é uma pasta com o nome do projeto e um arquivo `.audi` dentro. O arquivo registra o que o mod muda, quais arquivos substituem quais clipes, o Make-Up Gain e o tempo. Os arquivos de áudio ficam nessa pasta, ou o projeto guarda os caminhos deles. [Pastas do projeto](wiki:project-folders) explica o que há nela.

As alterações são salvas automaticamente, assim que são feitas ou a cada poucos minutos ([Salvamento automático](wiki:how-audiodiver-works#autosave)). {key:save} salva a qualquer momento, e {key:undo} desfaz a última alteração.

O Audiodiver nunca grava na pasta do jogo. Ele lê o áudio do jogo na biblioteca da Steam, ou em outra pasta escolhida em **Jogo** nas [Configurações](app:settings/system). Uma geração produz um ZIP que um gerenciador de mods importa e instala.

## As abas {#the-tabs}

A barra de abas no topo da janela contém as abas principais. Início e Ferramentas vêm primeiro. A faixa mais escura depois delas contém as abas do projeto aberto, na ordem em que um mod é feito, começando por Projeto, que mostra o ícone do projeto. Gerar vem depois da faixa e aparece enquanto há um projeto aberto. Passe o mouse sobre uma aba para ver o que ela contém e o atalho. **Barra de abas** em [Configurações ▸ Tema](app:settings/theme) move a barra para outro lado da janela e mostra ou oculta os nomes das abas.

- {icon:home} **Início** cria um projeto novo ou abre um, e leva ao Repatch e ao Combinar.
- {icon:tools} **Ferramentas** trabalha com mods existentes, sem projeto. [Repatch](wiki:repatching) gera de novo um mod para a versão atual do jogo, e [Combinar Mods](wiki:combining-mods) faz um único mod a partir de vários. Os dois produzem um ZIP novo.
- {icon:project} **Projeto** contém o nome, a descrição, o ícone e o ID do mod, as abas que o projeto mostra e a pasta do projeto, com **Importar patches** e **Fechar projeto** sobre o ícone. Sem projeto aberto, lista os projetos recentes. A aba mostra o ícone e o nome do projeto.
- {icon:library} **Biblioteca** lista tudo o que o jogo toca, para você encontrar e ouvir. Navegar não muda nada. **Adicionar ao projeto** coloca uma entrada no projeto. **Índice** organiza o áudio que tem nome, e **Todos os Pacotes** lista cada pacote que contém áudio.
- {icon:audio} **Áudio** mostra os slots daquilo em que o projeto trabalha. É aqui que os slots recebem áudio novo.
- {icon:soundtrack} **Trilha Sonora** define como cada peça musical toca: na ordem original, como uma única música, como playlist ou em silêncio. Veja [Trilha Sonora](wiki:soundtrack).
- {icon:text} **Texto** tem todo o texto do jogo em todos os idiomas, incluindo as legendas. Veja [Texto e legendas](wiki:text).
- {icon:build} **Gerar** contém a próxima versão, as Opções de geração e o botão Gerar. Um ponto na aba indica que o projeto ainda não foi gerado, ou que ele mudou ou o jogo foi atualizado desde a última geração. Um número vermelho conta os problemas que impedem a geração.
- {icon:updates} **Atualizações**, {icon:wiki} **Wiki** ({key:wiki}) e {icon:settings} **Configurações** ficam no fim da barra de abas. Atualizações fica destacada quando há uma versão nova do Audiodiver, e lista as mudanças de cada versão. Numa página da Wiki, {key:search} procura palavras nessa página.

O botão {icon:detach} ao lado da busca de guias move a Wiki para uma janela separada, para ler ao lado de um projeto. A aba Wiki passa a mostrar **Trazer a Wiki de volta**, e fechar a janela faz o mesmo. Enquanto a Wiki está nessa janela, um **?** ou um link para uma página abre lá. Iniciar um tutorial traz a Wiki de volta antes.

O número da versão na ponta direita da barra de status também abre Atualizações. O botão {icon:info} ao lado dele abre [Sobre](app:about), com a licença, o arquivo de log e os créditos.

O título da janela é o nome do projeto aberto.

A Biblioteca e a aba Áudio têm o mesmo layout, e as duas têm {icon:export} **Exportar**. Encontre algo na Biblioteca e trabalhe nele na aba Áudio.

## Abas {#tabs}

Áudio, Trilha Sonora e Texto podem ser ocultadas. Desmarque-as em **Abas** em [Configurações ▸ Sistema](app:settings/system), por exemplo para manter só Texto num mod que muda legendas. Um projeto novo começa com as abas que as Configurações mostram. Depois, cada projeto pode escolher outras em **Abas** na aba [Projeto](app:project) e mantém essa escolha. Ocultar uma aba não remove nada, e o que foi alterado nela continua no mod.

## Helldivers 1 {#helldivers-1}

Com o Helldivers 1 instalado, a Biblioteca tem uma aba para cada jogo abaixo de **Índice** e **Todos os Pacotes**. O áudio do Helldivers 1 toca e é exportado como WAV, FLAC ou MP3. As entradas do Helldivers 1 não podem entrar num projeto, mas **Ctrl+C** copia qualquer clipe para um slot do projeto. O Audiodiver não muda esse jogo.

Cada entrada do Índice é um evento de som do jogo, e os slots são os clipes entre os quais ele escolhe. Vozes e algumas músicas têm uma aba para cada idioma. Uma entrada mostra o nome dos arquivos do jogo numa forma mais curta, então `fs_rock_run` aparece como *Rock Run*, e a pesquisa encontra os dois. Armas, estratagemas e inimigos usam os nomes que o jogo mostra. Uma entrada de voz traz a fala mostrada na tela quando ela toca, e a pesquisa também encontra essa fala. Os clipes de voz são curtos, então não leem a fala inteira. O jogo guarda muitos nomes só como números, então os sons sem nome conhecido ficam apenas em **Todos os Pacotes**, nos bancos deles.

## Novas versões do Audiodiver {#new-versions-of-audiodiver}

O Audiodiver procura uma nova versão no GitHub toda vez que inicia. [Configurações ▸ Sistema](app:settings/system) define o que acontece quando há uma:

- **Perguntar ao iniciar** (o padrão) pergunta antes, com **Atualizar agora**, **Ler as notas de versão** e **Agora não**.
- **Manual** não pergunta. A aba Atualizações e a versão na barra de status ficam destacadas, e **Atualizar agora** fica na aba Atualizações.
- **Automático** instala a nova versão ao iniciar e reinicia o Audiodiver.

Uma atualização substitui só o app. Projetos, arquivos de áudio e configurações são mantidos.

## Configurações {#settings}

### Idioma {#language}

**Idioma** em [Configurações ▸ Sistema](app:settings/system) define o idioma da janela e das mensagens que o Audiodiver mostra. **Automático** usa o idioma configurado para o Helldivers 2 na Steam. Quando o Audiodiver não tem tradução para ele, Automático usa o idioma do Windows, e, se também não tiver, o inglês. Depois de uma mudança, a janela carrega de novo no novo idioma, na mesma aba. As legendas e falas do jogo continuam como estão, e a aba Texto continua escolhendo em qual idioma o texto do jogo é editado.

### Pasta do jogo {#game-folder}

**Helldivers 2** em [Configurações ▸ Sistema](app:settings/system) mostra a pasta de onde o Audiodiver lê o jogo. O Audiodiver a encontra pela Steam. Se o jogo estiver em outro lugar, pressione **Escolher outra pasta** e selecione a pasta de instalação do Helldivers 2, ou a pasta `data` dentro dela. O Audiodiver então lê o jogo de novo, o que leva cerca de um minuto na primeira vez. Ele só lê dessa pasta e nunca grava nela.

**Helldivers 1** faz o mesmo para a Biblioteca. Escolha a pasta de instalação do Helldivers 1, ou a pasta `contents` dentro dela.

### Inicialização {#startup}

Com **Abrir o último projeto quando o Audiodiver iniciar** ligado, o Audiodiver abre o último projeto na aba Áudio. Desligado, o Audiodiver começa em Início.

### Início {#home}

Com **Mostrar o letreiro de notícias** desligado, o Início não mostra a faixa de notícias da guerra na parte de baixo, e as notícias não são carregadas.

### Salvamento automático {#autosave}

**Salvamento automático** define quando as alterações vão para o arquivo do projeto. **A cada alteração**, o padrão, salva cada alteração assim que ela é feita. **Em intervalos** salva a cada 1 a 30 minutos, e até lá a barra de status mostra *Alterações não salvas*. Uma geração, fechar o projeto e fechar o Audiodiver salvam as alterações antes. {key:save} salva a qualquer momento.

### Notificações {#notifications}

**Canto** em **Notificações** em [Configurações ▸ Sistema](app:settings/system) define o canto da janela onde os avisos aparecem. **Inferior direito** é o padrão.

### Notas globais {#global-notes}

**Notas globais** em [Configurações ▸ Sistema](app:settings/system) mostra o arquivo de notas, que começa na pasta das configurações do Audiodiver. **Escolher outra pasta** guarda as notas em outra, como uma pasta sincronizada entre dois computadores. Quando essa pasta já tem um arquivo de notas, as notas dele e estas se juntam, e uma coisa com uma nota diferente em cada um mantém os dois textos. **Usar a pasta padrão** volta à pasta de antes. O arquivo na pasta antiga continua como estava.

**Exportar notas** salva as notas globais, as notas do projeto aberto ou as duas, como um documento Markdown para ler, com cada nota sob o nome daquilo a que se refere, ou como um arquivo de notas JSON. **Importar notas** traz para as notas globais as notas de um arquivo JSON desses, ou de um arquivo de projeto.

### Espaço em disco {#disk-space}

O Audiodiver guarda cópias preparadas do áudio para não preparar o mesmo áudio duas vezes. **Prévias** são os originais decodificados, as formas de onda e as renderizações da Reprodução contínua. **Áudio codificado** é o áudio novo convertido para o jogo, que as gerações reaproveitam. Limpar qualquer um dos dois é seguro: o Audiodiver prepara as cópias de novo quando precisa. Projetos e arquivos de áudio nunca ficam guardados ali.
