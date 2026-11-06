---
title: Contenu du Patch
group: Générer et partager
summary: Remplacer des sons d’un mod existant, sur les banques de sons du mod lui-même, aussi des sons qu’une mise à jour a retirés du jeu.
source: 120fdcca46f4
---

Le patch d’un mod contient des copies des banques de sons qu’il modifie, telles qu’elles étaient dans la version du jeu pour laquelle le mod a été fait, et le jeu lit ces copies à la place des banques actuelles. **Contenu du Patch**, dans [Outils](app:tools/content), ouvre un tel mod tel quel, liste les sons de ses patchs et écrit à nouveau le mod avec un nouvel audio pour les sons choisis. Tout le reste reste tel que le mod l’a.

## Quand l’utiliser {#when-to-use-it}

- Une mise à jour a retiré un son du jeu, et un mod fait avant la mise à jour a encore ce son. La version 7.2.2, par exemple, a retiré l’hymne qui jouait pendant qu’un drapeau monte. Un projet et **Repatch** s’appuient sur les banques de sons actuelles, qui n’ont plus un tel son : seules les banques de l’ancien mod peuvent lui donner un nouvel audio.
- Quelques sons d’un mod doivent changer d’audio, et rien d’autre dans le mod ne doit changer.

Pour les sons que le jeu a encore, un projet ou [Repatch](wiki:repatching) convient mieux : les deux s’appuient sur les banques actuelles, et le mod suit le jeu.

## Ouvrir un mod {#opening-a-mod}

1. Ouvrez [Outils](app:tools/content) et choisissez **Contenu du Patch**.
2. Déposez le mod sur la page sous forme de ZIP, de dossier ou de fichier `.patch_0`, ou appuyez sur **Choisir un ZIP ou un fichier patch** ou **Choisir un dossier**.

La liste commence par les sons que le jeu actuel n’a pas, marqués **Absent du jeu**. **Tous les Sons** affiche chaque son du mod, et la recherche trouve un son par son ID, son nom ou une banque. Chaque ligne lit l’audio tel que le mod l’a et nomme les banques du mod qui contiennent le son.

## Donner un nouvel audio aux sons {#giving-sounds-new-audio}

- Déposez un fichier audio sur un son, ou appuyez sur **Choisir un Fichier** dans la ligne. **Silence** remplace le son par du silence.
- ✕ retire à nouveau le nouvel audio.
- Le nouvel audio va dans chaque banque et chaque flux du mod qui a le son. Un fichier est encodé comme une génération l’encode, et un `.wem` que le jeu lit tel quel entre sans changement.

## Écrire le mod {#writing-the-mod}

Choisissez le nom que montre le gestionnaire de mods et un dossier de destination, puis appuyez sur **Écrire le Mod**. Le nouveau ZIP est le mod tel qu’il était : le manifeste, les options, les autres fichiers et l’ID du mod restent, donc l’importer dans un gestionnaire de mods met à jour l’ancien mod. Un mod sans manifeste devient un ZIP pour gestionnaire de mods, avec une option pour chaque partie du mod.

Chaque patch qui contient un son choisi est écrit à nouveau et comparé à l’ancien : seuls l’audio de ces sons, les tailles qui le décrivent et le minutage de la musique qui le joue diffèrent.

## À savoir {#what-to-know}

- Les banques du mod restent telles qu’elles étaient dans la version du jeu pour laquelle le mod a été fait. Tant que le mod est installé, le jeu lit ces banques à la place des banques actuelles, donc ce qu’une mise à jour y a changé n’atteint pas le jeu. Voir [Sons d’une ancienne version du jeu](wiki:repatching#sounds-from-an-older-game-version).
- Un mod fait ainsi reste l’œuvre de l’auteur d’origine. Gardez-le pour un usage personnel et ne le partagez qu’avec la permission de l’auteur.
