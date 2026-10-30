---
title: Génération et installation
group: Générer et partager
summary: Ce que produit une génération, comment l’installer avec un gestionnaire de mods, et comment les mises à jour parviennent au mod installé.
source: 518c0af357e6
---

## Générer {#building}

Sur [Générer](app:build), appuyez sur **Générer** ({key:build}). Audiodiver convertit le nouvel audio pour le jeu et patche les banques de sons qui contiennent ou jouent les sons remplacés ([lesquelles](#every-bank-with-the-sounds)). Il vérifie ensuite le résultat et l’empaquette dans un ZIP nommé d’après le nom et la version du mod.

Générer ne modifie ni le projet, ni les fichiers audio, ni le jeu.

Si le projet a des problèmes, comme un fichier manquant ou un nom que les gestionnaires de mods ne peuvent pas utiliser, le bouton Générer est désactivé. L’onglet liste les problèmes au-dessus du bouton.

### Dossier de destination {#destination-folder}

Le ZIP va dans le dossier `build` à côté du fichier du projet. Pour générer dans un autre dossier, appuyez sur **Modifier** sous **Dossier de destination**. **Revenir à la valeur par défaut** retourne au dossier `build`. Une génération n’ajoute que le ZIP, et les [fichiers patch](#patch-files) quand vous les activez, donc plusieurs mods peuvent partager un même dossier. Audiodiver ne génère jamais dans le dossier du jeu.

## Ce que montre le gestionnaire de mods {#what-the-mod-manager-shows}

L’onglet [Projet](app:project) affiche un aperçu de l’icône, du nom et de la description tels qu’un gestionnaire de mods les affiche.

### Nom et description {#name-and-description}

N’utilisez que des lettres, des chiffres et des espaces dans le nom, et laissez la version de côté. Le gestionnaire de mods conserve le nom de la première importation, donc choisissez-le avant de partager le mod. La description est facultative et s’affiche avec le mod.

### Version {#version}

**Version suivante** est le numéro dans le nom du prochain ZIP. Il augmente de un après chaque génération, sauf si **Augmenter la version après chaque génération** est désactivé.

### Icône {#icon}

L’icône est l’icône Audiodiver par défaut jusqu’à ce que vous choisissiez une image. Une image est recadrée en carré autour du centre et redimensionnée à 540 × 540, la taille que les gestionnaires de mods utilisent. Vous pouvez aussi déposer une image sur l’aperçu. **Contour**, **Couleur du contour** et **Coins** encadrent l’icône, par défaut ou choisie.

### ID du mod {#mod-id}

Un gestionnaire de mods reconnaît un mod par son ID. Tant que l’ID reste le même, une nouvelle génération met à jour le mod installé. Quand vous copiez un projet pour faire un autre mod, appuyez sur **Créer un nouvel ID**, et la copie s’installe comme un mod séparé.

Pour que les générations mettent à jour un mod créé auparavant, appuyez sur **Modifier** et collez l’ID de ce mod : le `Guid` du `manifest.json` du mod. Annuler remet l’ancien ID.

## Options de génération {#build-options}

Ces réglages se trouvent sous **Options de génération** dans l’onglet Générer.

- **Augmenter la version après chaque génération** donne à chaque génération un nouveau nom de ZIP, et les ZIP précédents restent. Quand il est désactivé, la génération suivante remplace le dernier ZIP. C’est l’[ID du mod](wiki:build-and-install#mod-id), et non la version, qui décide si un gestionnaire de mods prend une génération pour une mise à jour. Le réglage s’applique à tous les projets.
- **Afficher le ZIP dans l’Explorateur à la fin d’une génération** ouvre l’Explorateur avec le ZIP sélectionné.

### Fichiers patch {#patch-files}

**Enregistrer aussi les fichiers patch dans un dossier** place les fichiers patch du mod à côté de chaque ZIP, dans un dossier portant le même nom que le ZIP. Ce sont le fichier `.patch_0` et, quand le mod a de l’audio en flux, le fichier `.patch_0.stream`. Utilisez-les pour empaqueter le mod vous-même, par exemple dans une archive 7z avec un manifeste personnel. Pour les installer, empaquetez-les pour un gestionnaire de mods plutôt que de les copier dans le dossier du jeu ([Installation](#installing)). Le réglage s’applique au projet ouvert.

Une génération n’a un fichier `.patch_0.gpu_resources` que si le projet transporte les textures ou les modèles d’un mod importé. L’audio n’en a pas besoin.

### Analyse de sonie Wwise {#wwise-loudness-analysis}

**Ajouter l’analyse de sonie Wwise** ajoute les données de sonie que portent les fichiers audio d’origine. Cela ne change rien d’audible. Elle nécessite que Wwise soit installé et ralentit les générations. Le réglage s’applique au projet ouvert.

### Chaque banque contenant les sons {#every-bank-with-the-sounds}

Un son est souvent dans plus d’une banque de sons. Un clip que plusieurs armes partagent est dans la banque de chacune, et certains clips sont dans une centaine de banques. Par défaut, une génération ne patche que les banques des ensembles de sons, de la musique et des archives de la liste du projet. Cela garde le mod petit, comme les mods créés avec d’autres outils.

**Patcher chaque banque contenant les sons** place le nouvel audio dans chaque banque qui a les sons. Le nouvel audio est alors joué partout où les sons sont utilisés, y compris pour une arme que le projet ne liste pas. Le mod devient plus gros, parfois de plusieurs centaines de mégaoctets. Activez-le si l’original est encore joué là où le nouvel audio devrait l’être. Le réglage s’applique au projet ouvert.

Certains sons vont dans chaque banque dans tous les cas :

- La musique. La banque de musique de chaque mission contient des copies de la musique de chaque faction, et `music_init` en contient des copies pour une grande partie. Le jeu utilise la première copie qu’il charge. Une copie avec l’ancien minutage jouerait le nouvel audio pour l’ancienne durée, donc la musique serait coupée ou deviendrait silencieuse.
- Les banques qui contiennent le début d’un son diffusé en flux, comme une réplique. Chacune reçoit le nouveau début, si bien que l’original n’est jamais joué avant le nouvel audio.
- Un son qu’aucune banque de la liste ne contient.

Un projet avec un mod importé compte aussi les banques que ce mod a patchées. Dans [Outils ▸ Repatch](app:tools/repatch), la même case à cocher s’applique au mod repatché. Quand elle est décochée, l’audio ne va que dans les banques que le mod a patchées.

### Audio ajouté dans d’autres banques {#added-audio-in-other-banks}

Les nouvelles prises, les couches et le nouvel audio réglé sur **Ce son uniquement** vont dans chaque banque qui a une copie du son, y compris les banques que le projet ne liste pas, car le jeu joue la copie qu’il charge en premier. Les sons du Canon automatique AC-8, par exemple, ont aussi des copies dans les banques de la Plateforme pétrolière et de la Navette. Un projet qui ajoute de l’audio à ces sons patche aussi ces deux banques, ce qui met environ 30 Mo de l’audio de ces banques dans le mod.

**Limiter l’audio ajouté aux banques du projet** place l’audio ajouté uniquement dans les banques de la liste du projet, et d’un mod importé dedans. Le mod devient plus petit, mais partout où le jeu charge d’abord la copie du son d’une autre banque, l’original est joué. Laissez-le désactivé, sauf si la taille du mod compte plus que le son à ces endroits. Un son qu’aucune banque de la liste ne contient va quand même dans chaque banque qui l’a. Le réglage s’applique au projet ouvert et ne fait rien tant que **Patcher chaque banque contenant les sons** est activé.

## Installation {#installing}

Les générations sont des ZIP au format de manifeste partagé que les gestionnaires de mods de Helldivers 2 importent.

1. Importez le ZIP dans le gestionnaire de mods.
2. Déployez les mods.
3. Lancez le jeu et allez à un endroit où la nouvelle musique est jouée.

> [!WARNING]
> Ne copiez pas de fichiers patch à la main dans le dossier `data` du jeu. Le gestionnaire de mods numérote les patchs de tous les mods lors du déploiement. Un patch copié à la main est écrasé, ou il prend le pas sur un autre mod.

## Deux mods qui modifient la même banque {#two-mods-that-change-the-same-bank}

Un mod contient des copies complètes des banques de sons qu’il modifie. Si deux mods modifient la même banque, leurs modifications ne se combinent pas. Le mod déployé en dernier remplace la copie de la banque de l’autre. Les mods de musique partagent la plupart de leurs banques, donc deux mods de musique ne peuvent pas être déployés ensemble, quel que soit l’outil qui les a créés. [Combiner des Mods](wiki:combining-mods) en fait un seul mod, avec l’audio des deux.

## Mise à jour {#updating}

Importez le nouveau ZIP dans le gestionnaire de mods. Avec le même ID, il remplace la version installée et n’ajoute pas une autre copie. Déployez de nouveau et redémarrez le jeu.
