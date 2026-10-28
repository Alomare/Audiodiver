---
title: Ferramentas e links
group: Recursos
summary: Onde os mods são instalados e compartilhados, e ferramentas de áudio gratuitas que ajudam com mods de música.
source: 8c4b133afed9
---

## Instalar e compartilhar mods {#installing-and-sharing-mods}

- Os mods gerados são instalados com um gerenciador de mods do Helldivers 2.
- [Helldivers 2 no Nexus Mods](https://www.nexusmods.com/helldivers2) é onde a maioria dos mods é compartilhada.
- **Audiodiver Utils**, na [página de versões](https://github.com/Alomare/Audiodiver/releases/latest) do Audiodiver, é o Repatch e o Combinar Mods sem projetos: uma janela portátil menor, e o `audiodiver.cmd` para a linha de comando. `audiodiver.cmd repatch <mod>` gera um mod de novo, `combine <mod> <mod>` combina mods, `check` lista os mods instalados que precisam de repatch, e `scan <mod>` mostra as opções de um mod. Adicione `--json` para uma saída que outros programas leem, e `--help` para o resto.

## Editar áudio {#editing-audio}

- O [Audacity](https://www.audacityteam.org) é um editor gratuito para cortar, aplicar fades e exportar WAV ou FLAC. O efeito *Loudness Normalization* do Audacity ajusta um arquivo a um alvo em LUFS.
- O [Youlean Loudness Meter](https://youlean.co/youlean-loudness-meter/) é um medidor de volume percebido gratuito. Use-o para comparar a música nova com o nível original de −13 a −15 LUFS.
- O [FFmpeg](https://ffmpeg.org) converte entre quase todos os formatos de áudio pela linha de comando.

## Por dentro {#under-the-hood}

- O [vgmstream](https://github.com/vgmstream/vgmstream) toca e converte formatos de áudio de jogos, incluindo os do Wwise.
- O [wwiser](https://github.com/bnnm/wwiser) explora bancos de sons do Wwise.
- O [hd2-audio-modder](https://github.com/RaidingForPants/hd2-audio-modder) é uma ferramenta de modding de áudio baseada em IDs para o Helldivers 2.

[Sobre](app:about) lista os projetos em que o próprio Audiodiver se baseia. Para abrir, clique em {icon:info} ao lado da versão na barra de status.
