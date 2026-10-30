---
title: Dossiers de projet
group: Pour commencer
summary: Où un projet stocke ses fichiers, comment en déplacer un, et comment un pack transporte un projet vers un autre ordinateur.
source: e77121941946
---

## Le dossier du projet {#the-project-folder}

Un nouveau projet reçoit un dossier portant son nom, avec le fichier du projet à l’intérieur, comme dans `Dune\Dune.audi`. Audiodiver place tout ce qu’il crée pour le projet dans un dossier `audio` à côté de ce fichier :

- `audio\slices` contient les morceaux découpés par l’outil de découpe.
- `audio\imported` contient l’audio décodé à partir du patch d’un mod importé.
- `audio\added` contient les fichiers que **Rassembler les fichiers** a copiés depuis d’autres emplacements.

Les ZIP générés vont dans un dossier `build` à côté du fichier du projet.

Un audio choisi dans un autre dossier reste là, et le projet conserve le chemin qui y mène. Les chemins d’un fichier de projet sont relatifs au dossier du projet, et un fichier situé sur un autre disque est enregistré avec son chemin complet. Un dossier déplacé à la main contient toujours ses fichiers, mais le projet peut perdre ceux qui sont en dehors. [Déplacer le projet](#moving-a-project) les conserve.

Les anciens projets peuvent partager un dossier, avec `slices` et `imported` à côté du fichier `.audi`. Ils continuent de fonctionner, et l’onglet [Projet](app:project) propose de les déplacer.

## Déplacer un projet {#moving-a-project}

**Déplacer le projet**, sous **Dossier** dans l’onglet Projet, déplace le dossier du projet dans un dossier que vous choisissez : choisir `D:\Mods` pour `Dune` donne `D:\Mods\Dune`. Quand `D:\Mods` contient déjà un dossier nommé `Dune`, le dossier du projet devient `Dune 2`.

Tout ce qui est dans le dossier du projet suit : le fichier du projet, l’audio qu’Audiodiver a créé, les fichiers que vous y avez mis et les générations. Les fichiers choisis en dehors du dossier restent où ils sont, et le projet les retrouve toujours. Sur le même disque, le déplacement prend un instant. Vers un autre disque, les fichiers sont d’abord copiés, ce qui prend plus de temps pour un gros projet. La liste des projets récents suit le projet vers le nouveau chemin.

Un projet qui [partage un dossier](#moving-a-project-into-a-new-folder) avec d’autres projets ou d’autres fichiers est d’abord déplacé dans un nouveau dossier, et c’est ce dossier qui est déplacé.

## Déplacer un projet dans un nouveau dossier {#moving-a-project-into-a-new-folder}

L’onglet Projet affiche un avertissement quand le projet partage un dossier avec d’autres projets, ou se trouve dans un emplacement partagé comme le Bureau. Audiodiver place les découpes, l’audio importé et les générations à côté du fichier du projet, et dans un dossier qui ne contient que ce projet, ils restent séparés des autres fichiers. **Déplacer dans un nouveau dossier** crée un dossier portant le nom du projet à côté du fichier du projet et y déplace :

- le fichier du projet
- les découpes et l’audio importé qu’Audiodiver a créés pour lui
- les générations du dossier de génération par défaut

Les fichiers choisis ailleurs restent où ils sont. Un fichier qu’un autre projet de l’ancien dossier utilise est copié. La liste des projets récents suit le projet vers le nouveau chemin.

## Rassembler les fichiers {#collecting-files}

**Rassembler les fichiers** copie l’audio situé en dehors du dossier du projet dans `audio\added` et fait pointer le projet vers les copies. Un seul Annuler le défait, et les copies restent sur le disque.

Une fois que tous les fichiers sont dans le dossier du projet, le projet peut être déplacé ou copié comme un seul dossier.

## Fichiers manquants {#missing-files}

Un fichier utilisé par le projet devient manquant quand il est déplacé, renommé ou supprimé en dehors d’Audiodiver. L’emplacement affiche alors **Manquant :** avant le nom du fichier, et l’onglet Générer liste le fichier comme un problème, car le mod ne peut pas être généré sans lui. Remettez le fichier là où il était, ou cliquez sur le nom du fichier dans l’emplacement pour en choisir un autre. Quand tous les fichiers sont dans le dossier du projet ([Rassembler les fichiers](wiki:project-folders#collecting-files)), les fichiers suivent le projet.

## Fichiers inutilisés {#unused-files}

**Trouver les fichiers inutilisés** liste ce qu’Audiodiver a créé pour le projet et que plus rien n’utilise : les découpes d’une ancienne coupe, l’audio décodé d’un patch importé, les fichiers rassemblés qu’aucun emplacement ne joue. **Retirer** les envoie à la Corbeille, et Windows peut les restaurer. Sur un disque sans Corbeille, comme un disque réseau, Audiodiver demande confirmation avant de les supprimer définitivement.

Audiodiver ne cherche que dans les dossiers qu’il crée, à savoir `audio\slices`, `audio\imported`, `audio\added` et les anciens `slices` et `imported`. Avant de retirer quoi que ce soit, Audiodiver revérifie la liste et garde tout fichier utilisé par le projet, par l’historique d’annulation ou par un autre projet du dossier.

## Packs {#packs}

Un pack est un fichier avec l’extension `.audipack`. Il contient le fichier du projet et les fichiers que le projet utilise, si bien que le projet s’ouvre de la même façon sur un autre ordinateur. Les générations et les fichiers inutilisés sont laissés de côté, et un fichier situé en dehors du dossier va dans `audio\added`.

**Exporter en pack** dans l’onglet Projet en écrit un. Ouvrez-le avec **Ouvrir un projet** sur [Accueil](app:home), ou double-cliquez dessus dans l’Explorateur. Audiodiver extrait le projet dans un nouveau dossier du dossier des projets et l’ouvre. Le dossier des projets est `Documents\Audiodiver\Projects` au départ, puis le dossier où le dernier nouveau projet a été créé.

Pour partager le mod lui-même, voir [Partager un mod](wiki:sharing).

## Ouvrir des fichiers depuis l’Explorateur {#opening-files-from-explorer}

Avec l’installateur, double-cliquer sur un fichier `.audi` ou `.audipack` ouvre Audiodiver avec ce projet ou ce pack. Quand Audiodiver est déjà lancé, le même double-clic ouvre le fichier dans la fenêtre ouverte.

La copie portable du ZIP de la version n’enregistre pas ces types de fichiers. Ouvrez plutôt les projets et les packs depuis l’application.
