---
title: Préparer l’audio
group: Créer un mod
summary: Quels fichiers utiliser, quel niveau sonore leur donner et comment les découper pour qu’ils conviennent au jeu.
source: cb164f9ebd07
---

## Formats {#formats}

Audiodiver lit WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF, WMA et WEM. Une génération convertit chaque fichier dans le format que le jeu joue, du Vorbis à 48 kHz en stéréo. Les fichiers mono restent mono, et les fichiers surround sont mixés en stéréo.

Un fichier WEM en Wwise Vorbis, mono ou stéréo, va dans le mod tel quel, car le jeu le joue tel quel. Une génération convertit tout autre fichier WEM comme les formats ci-dessus.

Partez de la meilleure copie dont vous disposez. **WAV ou FLAC à 48 kHz** ne subit qu’une seule conversion. Un MP3 fonctionne aussi, mais il est compressé une seconde fois, ce qui peut ajouter un léger voile aux cymbales et aux queues de réverbération.

## Sonie {#loudness}

La musique du jeu est à environ **−13 à −15 LUFS** (sonie intégrée). Une musique à ce niveau s’accorde avec les effets et les voix sans autre modification.

- Mesurez la sonie avec un sonomètre de sonie. La hauteur de la forme d’onde est un mauvais repère. [Outils et liens](wiki:tools-and-links) liste des outils de mesure gratuits.
- Gardez les crêtes sous environ **−1 dBTP** pour que la conversion n’écrête pas.
- Si un emplacement semble encore trop faible ou trop fort dans le jeu, modifiez le Make-Up Gain de l’emplacement plutôt que d’exporter de nouveau le fichier. Voir [Make-Up Gain et le mixage](wiki:volume).

## Durée et coupes {#length-and-cuts}

- Supprimez le silence au début de chaque fichier. Le jeu démarre un clip au premier échantillon, donc une amorce silencieuse est jouée comme un vide.
- Un morceau qui boucle doit se terminer à un endroit où il peut recommencer. Un fondu de sortie rend le point de bouclage audible.
- Gardez une queue naturelle à la fin. L’audio qui suit le point de *Sortie* d’un segment est joué par-dessus le segment suivant. Voir [Minutage, points de repère et boucles](wiki:timing-and-loops).
- Nommez les fichiers d’un morceau dans l’ordre de lecture, par exemple `01 Intro` et `02 Loop`. Les remplissages suivent l’ordre des noms de fichiers, qui place `2` avant `10`.

## Où garder les fichiers {#where-to-keep-the-files}

Gardez l’audio dans le dossier du projet. Les fichiers d’autres dossiers fonctionnent aussi, et **Rassembler les fichiers** dans l’onglet [Projet](app:project) les copie dans `audio\added`. Les chemins sont enregistrés relativement au dossier du projet, donc le dossier entier peut être déplacé ou copié. L’onglet Générer liste un fichier manquant comme un problème et ne génère rien tant qu’il n’est pas corrigé.
