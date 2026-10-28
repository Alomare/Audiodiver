---
title: Gerando e instalando
group: Geração e compartilhamento
summary: O que uma geração cria, como instalá-la com um gerenciador de mods e como as atualizações chegam ao mod instalado.
source: 518c0af357e6
---

## Gerar {#building}

Em [Gerar](app:build), pressione **Gerar** ({key:build}). O Audiodiver converte o áudio novo para o jogo e aplica patches nos bancos de sons que contêm ou tocam os sons substituídos ([quais](#every-bank-with-the-sounds)). Depois, confere o resultado e o empacota num ZIP com o nome e a versão do mod.

Gerar não muda o projeto, os arquivos de áudio nem o jogo.

Se o projeto tiver problemas, como um arquivo ausente ou um nome que os gerenciadores de mods não aceitam, o botão Gerar fica desativado. A aba lista os problemas acima do botão.

### Pasta de destino {#destination-folder}

O ZIP vai para a pasta `build` ao lado do arquivo do projeto. Para gerar em outra pasta, pressione **Alterar** em **Pasta de destino**. **Voltar ao padrão** volta para a pasta `build`. Uma geração adiciona só o ZIP, e os [arquivos de patch](#patch-files) quando você os ativa, então vários mods podem dividir uma pasta. O Audiodiver não gera na pasta do jogo.

## O que o gerenciador de mods mostra {#what-the-mod-manager-shows}

A aba [Projeto](app:project) mostra uma prévia do ícone, do nome e da descrição como um gerenciador de mods os mostra.

### Nome e descrição {#name-and-description}

Use só letras, números e espaços no nome, e deixe a versão de fora. O gerenciador de mods mantém o nome da primeira importação, então escolha-o antes de compartilhar o mod. A descrição é opcional e aparece com o mod.

### Versão {#version}

**Próxima versão** é o número no nome do próximo ZIP. Ele sobe um a cada geração, a menos que **Aumentar a versão a cada geração** esteja desligado.

### Ícone {#icon}

O ícone é o ícone padrão do Audiodiver até você escolher uma imagem. Uma imagem é recortada num quadrado em volta do centro e redimensionada para 540 × 540, o tamanho que os gerenciadores de mods usam. Você também pode soltar uma imagem na prévia. **Borda**, **Cor da borda** e **Cantos** emolduram o ícone, padrão ou escolhido.

### ID do mod {#mod-id}

Um gerenciador de mods reconhece um mod pelo ID do mod. Enquanto o ID continua o mesmo, uma nova geração atualiza o mod instalado. Quando você copiar um projeto para fazer um mod diferente, pressione **Criar um novo ID**, e a cópia é instalada como um mod separado.

Para que as gerações atualizem um mod que você fez antes, pressione **Alterar** e cole o ID desse mod: o `Guid` no `manifest.json` do mod. Desfazer coloca o ID antigo de volta.

## Opções de geração {#build-options}

Estas configurações ficam em **Opções de geração** na aba Gerar.

- **Aumentar a versão a cada geração** dá a cada geração um novo nome de ZIP, e os ZIPs anteriores ficam. Desligado, a próxima geração substitui o último ZIP. O [ID do mod](wiki:build-and-install#mod-id), e não a versão, decide se um gerenciador de mods trata uma geração como atualização. A configuração vale para todos os projetos.
- **Mostrar o ZIP no Explorador de Arquivos quando a geração terminar** abre o Explorador de Arquivos com o ZIP selecionado.

### Arquivos de patch {#patch-files}

**Salvar também os arquivos de patch em uma pasta** coloca os arquivos de patch do mod ao lado de cada ZIP, numa pasta com o mesmo nome do ZIP. São o arquivo `.patch_0` e, quando o mod tem áudio em stream, o arquivo `.patch_0.stream`. Use-os para empacotar o mod você mesmo, por exemplo num pacote 7z com um manifesto próprio. Para instalá-los, empacote-os para um gerenciador de mods em vez de copiá-los para a pasta do jogo ([Instalar](#installing)). A configuração vale para o projeto aberto.

Uma geração só tem um arquivo `.patch_0.gpu_resources` quando o projeto carrega texturas ou modelos de um mod importado. O áudio não precisa de nenhum.

### Análise de volume percebido do Wwise {#wwise-loudness-analysis}

**Adicionar a análise de volume percebido do Wwise** adiciona os dados de volume percebido que os arquivos de áudio originais têm. Não faz diferença audível. Exige o Wwise instalado e deixa as gerações mais lentas. A configuração vale para o projeto aberto.

### Todos os bancos com os sons {#every-bank-with-the-sounds}

Muitas vezes um som está em mais de um banco de sons. Um clipe que várias armas compartilham está no banco de cada arma, e alguns clipes estão em cem bancos. Por padrão, uma geração aplica patch só nos bancos dos conjuntos de sons, músicas e pacotes da lista do projeto. Isso mantém o mod pequeno, como os mods feitos com outras ferramentas.

**Aplicar patch em todos os bancos com os sons** coloca o áudio novo em todos os bancos que têm os sons. O áudio novo então toca onde quer que os sons sejam usados, inclusive numa arma que o projeto não lista. O mod fica maior, às vezes em centenas de megabytes. Ligue a opção se o original ainda tocar onde deveria tocar o áudio novo. A configuração vale para o projeto aberto.

Alguns sons vão para todos os bancos de qualquer jeito:

- A música. O banco de música de cada missão tem cópias da música de todas as facções, e o `music_init` tem cópias de boa parte dela. O jogo usa a primeira cópia que carrega. Uma cópia com o tempo antigo tocaria o áudio novo com a duração antiga, então a música seria cortada ou ficaria muda.
- Os bancos que contêm o início de um som em stream, como uma fala. Cada um recebe o novo início, então o original nunca toca antes do áudio novo.
- Um som que nenhum banco da lista tem.

Um projeto com um mod importado também conta os bancos em que esse mod aplicou patch. Em [Ferramentas ▸ Repatch](app:tools/repatch), a mesma caixa de seleção vale para o mod com repatch. Desligada, o áudio vai só para os bancos em que o mod aplicou patch.

### Áudio adicionado em outros bancos {#added-audio-in-other-banks}

Takes novos, camadas e áudio novo definidos como **Só este som** vão para todos os bancos que têm uma cópia do som, inclusive bancos que o projeto não lista, porque o jogo toca a cópia que carrega primeiro. Os sons do AC-8 Canhão Automático, por exemplo, também têm cópias nos bancos da Plataforma de petróleo e do Transporte. Um projeto que adiciona áudio a esses sons aplica patch nesses dois bancos também, o que coloca no mod cerca de 30 MB do áudio próprio desses bancos.

**Limitar o áudio adicionado aos bancos do projeto** coloca o áudio adicionado só nos bancos da lista do projeto e de um mod importado nele. O mod fica menor, mas onde quer que o jogo carregue primeiro a cópia do som de outro banco, toca o original. Deixe desligado, a menos que o tamanho do mod importe mais que o som nesses lugares. Um som que nenhum banco da lista tem continua indo para todos os bancos que o têm. A configuração vale para o projeto aberto e não faz nada enquanto **Aplicar patch em todos os bancos com os sons** está ligado.

## Instalar {#installing}

Os mods gerados são ZIPs no formato de manifesto compartilhado que os gerenciadores de mods do Helldivers 2 importam.

1. Importe o ZIP no gerenciador de mods.
2. Implante os mods.
3. Inicie o jogo e vá para um lugar onde a música nova toca.

> [!WARNING]
> Não copie arquivos de patch à mão para a pasta `data` do jogo. O gerenciador de mods numera os patches de todos os mods ao implantá-los. Um patch copiado à mão é sobrescrito, ou passa por cima de outro mod.

## Dois mods que mudam o mesmo banco {#two-mods-that-change-the-same-bank}

Um mod contém cópias completas dos bancos de sons que ele muda. Se dois mods mudam o mesmo banco, as alterações deles não se combinam. O mod implantado por último substitui a cópia do banco do outro. Os mods de música dividem a maioria dos bancos, então dois mods de música não podem ser implantados juntos, seja qual for a ferramenta que os criou. [Combinar Mods](wiki:combining-mods) faz um único mod com eles, com o áudio dos dois.

## Atualizar {#updating}

Importe o novo ZIP no gerenciador de mods. Com o mesmo ID, ele substitui a versão instalada e não adiciona outra cópia. Implante de novo e reinicie o jogo.
