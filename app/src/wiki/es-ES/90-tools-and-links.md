---
title: Herramientas y enlaces
group: Recursos
summary: Dónde se instalan y se comparten los mods, y herramientas de audio gratuitas que ayudan con los mods de música.
source: 8c4b133afed9
---

## Instalar y compartir mods {#installing-and-sharing-mods}

- Las generaciones se instalan con un gestor de mods de Helldivers 2.
- [Helldivers 2 en Nexus Mods](https://www.nexusmods.com/helldivers2) es donde se comparten la mayoría de los mods.
- **Audiodiver Utils**, en la [página de versiones](https://github.com/Alomare/Audiodiver/releases/latest) de Audiodiver, es Repatch y Combinar Mods sin proyectos: una ventana portátil más pequeña, y `audiodiver.cmd` para la línea de comandos. `audiodiver.cmd repatch <mod>` reconstruye un mod, `combine <mod> <mod>` combina mods, `check` enumera los mods instalados que necesitan un Repatch, y `scan <mod>` muestra las opciones de un mod. Añade `--json` para una salida que leen otros programas, y `--help` para el resto.

## Editar audio {#editing-audio}

- [Audacity](https://www.audacityteam.org) es un editor gratuito para cortar, aplicar fundidos y exportar WAV o FLAC. El efecto *Loudness Normalization* (normalización de sonoridad) de Audacity ajusta un fichero a un objetivo en LUFS.
- [Youlean Loudness Meter](https://youlean.co/youlean-loudness-meter/) es un medidor de sonoridad gratuito. Úsalo para comparar la música nueva con el nivel original de −13 a −15 LUFS.
- [FFmpeg](https://ffmpeg.org) convierte entre casi cualquier formato de audio desde la línea de comandos.

## Bajo el capó {#under-the-hood}

- [vgmstream](https://github.com/vgmstream/vgmstream) reproduce y convierte formatos de audio de juegos, incluidos los de Wwise.
- [wwiser](https://github.com/bnnm/wwiser) explora bancos de sonido de Wwise.
- [hd2-audio-modder](https://github.com/RaidingForPants/hd2-audio-modder) es una herramienta de modding de audio basada en ID para Helldivers 2.

[Acerca de](app:about) enumera los proyectos sobre los que se construye el propio Audiodiver. Para abrirlo, haz clic en {icon:info} junto a la versión en la barra de estado.
