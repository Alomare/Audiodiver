---
title: Fazendo repatch
group: Geração e compartilhamento
summary: Como gerar de novo, para o jogo atual, um mod de áudio feito para uma versão mais antiga do jogo ou com outra ferramenta.
source: 4adcbe4e29d4
---

O patch de um mod contém cópias completas dos bancos de sons que ele muda, como eles eram na versão do jogo para a qual o mod foi feito. Depois de uma atualização do jogo, essas cópias ficam desatualizadas. O mod pode ficar mudo ou tocar os sons errados e, enquanto está instalado, faz o áudio mais novo voltar atrás. Ele pode até silenciar sons que nunca mudou, porque os bancos também contêm configurações que muitos outros bancos compartilham. O **Repatch**, em [Ferramentas](app:tools/repatch), gera um mod assim de novo para o jogo atual. Não exige projeto nem experiência com mods.

## Quando usar {#when-to-use-it}

- Os sons de um mod ficaram mudos, errados ou sumiram depois de uma atualização do jogo, e o autor não o atualizou.
- Outros sons, como todos os tiros, ficam mudos enquanto o mod está instalado. Veja [Configurações compartilhadas de uma versão antiga do jogo](#shared-settings-from-an-older-game-version).

## Fazer o repatch de um mod {#repatching-a-mod}

1. Abra [Ferramentas ▸ Repatch](app:tools/repatch).
2. Solte o mod na página. Você pode soltar o ZIP baixado, a pasta do mod, ou o arquivo `.patch_0` com o arquivo `.stream` ao lado. **Escolher um ZIP ou arquivo de patch** e **Escolher uma pasta** fazem o mesmo. Um ZIP solto em qualquer lugar do Audiodiver também abre nesta página.
3. Confira o nome. O Audiodiver o pega do manifesto, se houver um, e senão do nome do arquivo ou da pasta, sem os números e as datas que o Nexus Mods adiciona aos downloads.
4. Marque **Aplicar patch em todos os bancos com os sons** para tocar o áudio do mod onde quer que esses sons sejam usados. Desmarcado, o áudio vai só para os bancos em que o mod aplicou patch, como no original, e o tamanho continua mais ou menos o mesmo. [Mais sobre isso](wiki:build-and-install#every-bank-with-the-sounds).
5. Pressione **Repatch**.

A página então resume o resultado: o que foi levado, o que foi mantido como estava e o que ficou de fora. **Mostrar tudo** lista cada patch e o log. **Fazer repatch de outro mod** limpa a página.

Alguns mods têm várias opções, com um patch para cada uma. Um mod assim continua sendo um único mod com as mesmas opções. A página conta os patches, e o Audiodiver gera de novo cada patch que contém áudio, no mesmo lugar. Um patch sem áudio, como uma opção que só muda uma textura, fica como está. **Mostrar tudo** os lista um por um.

Alguns mods têm vários arquivos de patch numa pasta, como `.patch_0`, `.patch_1` e `.patch_2`. O jogo os carrega um por cima do outro, como um único mod. O Audiodiver os lê na mesma ordem e os gera num único patch.

## Verificar os mods instalados {#checking-installed-mods}

**Mods instalados**, no fim da página do Repatch, encontra os mods que precisam de repatch. **Verificar mods instalados** examina os mods da biblioteca de um gerenciador de mods, implantados ou não, e os arquivos de patch da pasta `data` do jogo. Ele lista cada mod com bancos de sons:

- **Configurações compartilhadas antigas.** Os bancos têm cópias antigas de [configurações que outros bancos compartilham](#shared-settings-from-an-older-game-version). Enquanto implantado, o mod pode silenciar ou mudar sons em que nunca mexeu. A linha abaixo mostra quantos outros bancos ele afeta.
- **Bancos de sons antigos.** Os bancos são de uma versão mais antiga do jogo. Os sons do mod podem estar errados ou faltando.
- **Atualizado.** Nada nos bancos é mais antigo que o jogo atual. Ou o mod foi feito para esta versão, ou as atualizações seguintes não mexeram nesses bancos.
- **Ilegível.** O Audiodiver não conseguiu ler o arquivo de patch.

**Implantado** marca os mods que estão na pasta do jogo agora. Um mod com opções aparece uma vez, com **Opções** mostrando cada opção quando elas diferem. **Repatch** abre um mod sinalizado no formulário no topo da página, pronto para o repatch.

A verificação só aponta o que o autor de um mod não teria mudado de propósito, então um mod feito para o jogo atual nunca aparece como antigo.

## O que o repatch leva {#what-repatching-carries-over}

- O áudio que o mod substitui e o áudio que ele adiciona. O áudio adicionado pode ser takes novos para um som, um som que toca junto com outro som, ou um clipe separado para um único som.
- Configurações de som, como o volume (Make-Up Gain) de um som ou de um contêiner, um atraso antes de tocar, e quanto dele vai para o reverb.
- Os pontos de cue dos segmentos musicais que tocam áudio novo.
- Todo o resto do patch, como texto, modelos e texturas, exatamente como estava. A página lista o que um patch contém além de áudio.

O Audiodiver aplica tudo isso aos bancos de sons atuais e gera um novo ZIP do mesmo mod. Os bancos em que o mod não aplicou patch só recebem o áudio quando **Aplicar patch em todos os bancos com os sons** está marcado.

Se o mod tiver um manifesto de gerenciador de mods, o novo ZIP mantém todo o resto do original: o nome, a descrição, o ícone, as opções, os arquivos ao lado dos patches e o ID. Com o mesmo ID, importar o novo ZIP num gerenciador de mods atualiza o mod antigo e não adiciona outra cópia. Só os patches são novos. O áudio entra sem ser convertido de novo, então soa igual.

## Pasta de destino {#destination-folder}

O novo ZIP vai para a **Pasta de destino**. O local padrão é `Documents\Audiodiver\Repatched`, e **Alterar** escolhe outro. Se já houver um ZIP com o mesmo nome ali, ele fica, e o novo recebe um número.

Para mudar mais o mod, crie um projeto e importe nele o patch do mod, como explica [Quando o jogo atualiza](wiki:game-updates#mods-made-with-older-tools). Depois, gere-o em [Gerar](app:build) como qualquer outro projeto.

## O que o repatch deixa de fora {#what-repatching-leaves-out}

A cópia de um banco num mod também pode ter efeitos ou posicionamento diferentes, ou um jeito diferente de um contêiner escolher os sons. A maioria dessas diferenças vem dos bancos como eles eram quando o mod foi feito, antes de atualizações posteriores os mudarem. O Audiodiver as deixa de fora, e a página as lista. Uma diferença que o Audiodiver conhece de uma versão anterior do jogo não é listada. Se o mod com repatch soar diferente, compare-o com a versão antiga no jogo.

Texto, modelos e texturas entram sem mudanças. Uma tabela de textos contém todas as linhas da tabela, então uma tabela de uma versão mais antiga do jogo também traz de volta as linhas dessa versão, como o mod antigo fazia.

As configurações de som são copiadas como estavam. Uma delas pode passar por cima de um valor que o jogo mudou desde então, como o mod antigo fazia. Nos grupos que outros bancos compartilham, só o volume, o pitch, os filtros e o atraso são copiados. Veja [Configurações compartilhadas de uma versão antiga do jogo](#shared-settings-from-an-older-game-version).

> [!NOTE]
> O Audiodiver acompanha o que cada atualização do jogo muda, a partir da atualização de 20 de outubro de 2026. Para um mod feito antes dessa atualização, alguns itens em **Deixado de fora** e algumas das configurações copiadas podem ser valores Original daquela época que o mod não mudou.

Num mod com várias opções, um patch com áudio que não pode passar por repatch fica no ZIP sem mudanças, e a página o nomeia. Isso acontece quando os bancos de sons do patch não podem ser lidos, ou não contêm nada que o Audiodiver possa levar.

## Sons de uma versão antiga do jogo {#sounds-from-an-older-game-version}

As cópias de bancos de um mod ainda contêm todos os sons que o jogo tinha quando o mod foi feito. Quando uma atualização posterior remove alguns desses sons, eles parecem sons que o mod adicionou. Colocá-los no repatch traria os sons removidos de volta como takes extras ao lado dos atuais.

O Audiodiver reconhece esses sons, os deixa de fora e mostra quantos são. Eles nunca fizeram parte do mod, então o mod com repatch continua com tudo o que o autor fez. [Importar o patch de um mod](wiki:game-updates) num projeto também os deixa de fora.

O Audiodiver os reconhece de dois jeitos:

- Ele lembra quais sons as versões anteriores do jogo tinham em cada banco.
- Um som que o mod adicionou toca áudio novo. Um som que toca um áudio que o jogo atual ainda tem é um som original.

Se o mod substituiu o áudio de um som que o jogo removeu desde então, não há onde colocar esse áudio, e o mod com repatch toca os sons atuais ali.

## Configurações compartilhadas de uma versão antiga do jogo {#shared-settings-from-an-older-game-version}

Muitos sons pegam o volume, a prioridade e outras configurações de grupos compartilhados entre bancos. Todo som de arma passa por um grupo que está em mais de cem bancos. A cópia de um banco num mod tem esses grupos como eles eram quando o mod foi feito. Quando o jogo carrega esse banco, a cópia antiga de um grupo pode substituir a atual, e todo som do grupo muda junto. Depois da atualização de 20 de outubro de 2026, mods assim silenciaram todos os tiros.

As atualizações mudam as curvas, os efeitos e as configurações de mixagem desses grupos, como a prioridade. Os mods mudam no máximo o volume, o pitch, os filtros e o atraso. Quando um grupo no mod difere em curvas ou efeitos, o Audiodiver o trata como uma versão antiga do jogo e mantém o grupo atual. Das outras configurações de um grupo compartilhado, ele pega só o volume, o pitch, os filtros e o atraso, e mantém os valores atuais no resto. Uma configuração que o jogo atual tem e que falta no mod veio com uma atualização posterior. Uma cópia compartilhada sem ela é de uma versão antiga do jogo, então nenhuma das configurações dessa cópia é levada. A página mostra quantos objetos de som foram atualizados desse jeito. [Importar o patch de um mod](wiki:game-updates) funciona do mesmo jeito.

Um mod pode ter essas cópias antigas mesmo quando foi atualizado depois do jogo. Algumas ferramentas de modding levam as configurações do mod para os bancos novos e, com elas, os valores antigos dos grupos compartilhados. A verificação dos mods instalados também os encontra.

Um mod gerado com o Audiodiver tem as mesmas cópias. Gere-o de novo depois de cada atualização do jogo. A página [Gerar](app:build) avisa quando a última geração é mais antiga que o jogo.

## Instalar o resultado {#installing-the-result}

Importe o novo ZIP no gerenciador de mods. Se a página disser que o ID do mod foi mantido, o novo ZIP substitui o mod antigo. Senão, remova o mod antigo antes.

> [!NOTE]
> Um mod com repatch continua sendo obra do autor. Mantenha-o para uso pessoal e só o compartilhe com a permissão do autor. Melhor ainda: indique o Audiodiver ao autor para que ele atualize o mod.
