---
title: Texto e legendas
group: Criando um mod
summary: Como mudar legendas e qualquer outra linha do texto do jogo na aba Texto, incluindo palavras, cores e tamanhos, e o que manter intacto.
source: d48b85a4f8e6
---

A aba [Texto](app:text) tem todas as linhas do texto do jogo em todos os idiomas, incluindo as legendas das falas, os textos de missão e de menu, e os nomes. Pesquise uma linha para mudá-la, e o mod inclui a alteração.

## Encontrar uma linha {#finding-a-line}

Escolha primeiro o **idioma**. Cada idioma é uma tabela separada, então uma mudança em *English (US)* não muda *English (UK)* nem *French*. Cada linha está numa categoria: as legendas pela voz que as diz, e as outras linhas pelo uso e pela forma. Abra uma categoria, busque uma palavra da linha ou cole o ID da linha. **Alteradas** lista as linhas que o projeto muda.

O painel direito mostra o **Original**, a caixa **Texto novo** abaixo dele e uma **Prévia** da linha como aparece no jogo. Escolha um segundo idioma acima da lista para ler a linha nele também.

## Mudar uma linha {#changing-a-line}

Digite em **Texto novo**. A alteração é salva logo depois que você para de digitar, ou na hora com {key:save}, e cada salvamento é um passo para {key:undo}. **Restaurar o original** coloca a linha original de volta.

Para formatar parte de uma linha, selecione as palavras e use a barra acima da caixa. Ela tem **Cor**, **Tamanho** e **Ênfase**, e **Tempo** para legendas. Sem nada selecionado, um botão formata a linha inteira. **Limpar formatação** remove todas as cores, tamanhos e estilos.

[Formatando texto](wiki:formatting-text) descreve cada formato, com exemplos que você pode copiar.

## O que manter {#what-to-keep}

- **O tempo das legendas.** Uma legenda começa com marcas de tempo como `{0.00->3.85}`, que definem quando as palavras aparecem e somem, em segundos a partir do início da fala. Uma linha longa tem várias marcas. Mantenha-as, e mude os tempos se o áudio novo tiver outra duração. **Tempo** adiciona uma marca no cursor.
- **As palavras que o jogo preenche.** Palavras em maiúsculas depois de `#`, como `#COUNT` ou `#NAME`, são substituídas no jogo quando a linha aparece. O editor avisa se alguma sumir.
- **As cores que o jogo preenche**, como `<c=#PLAYER_COLOR>`. Deixe-as sem alteração.
- **Os colchetes** nas legendas, como em *[Grunts]*, marcam sons que não são palavras.

## Localizar e substituir {#find-and-replace}

**Localizar e substituir** muda palavras em muitas linhas de uma vez. Escolha as linhas, digite as palavras e veja cada mudança antes de aplicá-la. Tempo, cores, tamanhos e palavras que o jogo preenche ficam como estão, e tudo é um único passo para {key:undo}. A busca também encontra partes de palavras, a menos que **Só palavras inteiras** esteja ativado, então confira a lista antes de aplicar.

## Exportar e importar {#exporting-and-importing}

**Exportar** salva linhas num arquivo CSV ou JSON: as selecionadas, as alteradas, as mostradas ou uma categoria. Um segundo idioma adiciona uma coluna. Marque uma linha para selecioná-la, e use Shift+clique para selecionar várias em sequência. **Restaurar o original** também funciona com as linhas selecionadas.

Preencha a coluna **New text** numa planilha, sem mudar as colunas **Language** e **ID**. **Importar** lê o arquivo e mostra o que muda antes de aplicar, como um único passo para {key:undo}. Uma linha sem texto novo fica como está, e as que perderam o tempo ou palavras que o jogo preenche ficam de fora, a menos que você desmarque essa opção.

## Como o texto é montado {#how-text-is-built}

Um mod contém tabelas de texto inteiras. Uma geração pega cada tabela do jogo instalado e coloca nela as linhas do projeto. Isso tem duas consequências:

> [!WARNING]
> **Use só um mod de texto por tabela e idioma.** Se dois mods mudam linhas na mesma tabela, as alterações deles não se combinam. O mod que o gerenciador de mods implanta por último substitui a outra cópia da tabela.

> [!NOTE]
> **Gere de novo depois de uma atualização do jogo.** Um mod gerado contém a tabela como ela era na hora da geração, então as linhas que o jogo adiciona ou reescreve depois ficam escondidas por trás dela. Uma nova geração pega a nova tabela e coloca as linhas do projeto de volta nela. Se o jogo reescreveu uma linha que o projeto muda, a aba Texto mostra um aviso.

## Legendas das falas {#subtitles-of-voice-lines}

Os arquivos do jogo não ligam as falas às legendas. O Audiodiver as associou pelo que cada fala diz e pela duração dela. Selecione uma fala e clique no link **Legenda** para abrir a legenda aqui.

Muitas vezes várias legendas têm as mesmas palavras. Por exemplo, o jogo tem 32 legendas que dizem *Reloading.* Para muitas delas, a duração da gravação não basta para diferenciá-las. Uma linha assim é marcada como **uma de várias**. A aba Texto lista todas as legendas com essas palavras e abre a mais provável. Mude todas elas para ter certeza de que as palavras novas aparecem.
