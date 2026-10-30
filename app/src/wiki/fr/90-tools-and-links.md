---
title: Outils et liens
group: Ressources
summary: Où les mods sont installés et partagés, et des outils audio gratuits qui aident pour les mods de musique.
source: 8c4b133afed9
---

## Installer et partager des mods {#installing-and-sharing-mods}

- Les générations s’installent avec un gestionnaire de mods pour Helldivers 2.
- [Helldivers 2 sur Nexus Mods](https://www.nexusmods.com/helldivers2) est l’endroit où la plupart des mods sont partagés.
- **Audiodiver Utils**, sur la [page des versions](https://github.com/Alomare/Audiodiver/releases/latest) d’Audiodiver, propose Repatch et Combiner des Mods sans projet : une fenêtre portable plus petite, et `audiodiver.cmd` pour la ligne de commande. `audiodiver.cmd repatch <mod>` reconstruit un mod, `combine <mod> <mod>` combine des mods, `check` liste les mods installés qui ont besoin d’un repatch, et `scan <mod>` montre les options d’un mod. Ajoutez `--json` pour une sortie que d’autres programmes lisent, et `--help` pour le reste.

## Éditer l’audio {#editing-audio}

- [Audacity](https://www.audacityteam.org) est un éditeur gratuit pour couper, fondre et exporter en WAV ou FLAC. L’effet *Loudness Normalization* d’Audacity règle un fichier sur un objectif en LUFS.
- [Youlean Loudness Meter](https://youlean.co/youlean-loudness-meter/) est un sonomètre de sonie gratuit. Utilisez-le pour comparer la nouvelle musique au niveau d’origine de −13 à −15 LUFS.
- [FFmpeg](https://ffmpeg.org) convertit entre presque tous les formats audio en ligne de commande.

## En coulisses {#under-the-hood}

- [vgmstream](https://github.com/vgmstream/vgmstream) lit et convertit les formats audio des jeux, y compris ceux de Wwise.
- [wwiser](https://github.com/bnnm/wwiser) explore les banques de sons Wwise.
- [hd2-audio-modder](https://github.com/RaidingForPants/hd2-audio-modder) est un outil de modding audio basé sur les ID pour Helldivers 2.

[À propos](app:about) liste les projets sur lesquels Audiodiver lui-même s’appuie. Pour l’ouvrir, cliquez sur {icon:info} à côté de la version dans la barre d’état.
