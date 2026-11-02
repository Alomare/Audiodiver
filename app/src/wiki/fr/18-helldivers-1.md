---
title: Mods de Helldivers 1
group: Pour commencer
summary: Remplacer l’audio de Helldivers 1 : le choix du jeu sur l’Accueil, ce qu’un projet peut changer, et pourquoi un mod peut être volumineux.
source: 7b5996439e04
---

Quand Helldivers 1 est installé, les boutons **Helldivers 2** et **Helldivers 1** de l’[Accueil](app:home) choisissent le jeu pour lequel Audiodiver crée des mods. Chaque projet appartient à un seul jeu, et ouvrir un projet passe à ce jeu. Choisir l’autre jeu ferme le projet ouvert.

## Commencer un projet {#starting-a-project}

1. Choisissez **Helldivers 1** sur l’Accueil et appuyez sur **Nouveau projet**.
2. Dans la [Bibliothèque](app:library), appuyez sur **+** sur ce que vous voulez changer.
3. Dans l’onglet [Audio](app:editor), déposez un audio sur un emplacement, ou choisissez un fichier.
4. Dans l’onglet [Générer](app:build), appuyez sur **Générer**. Le ZIP s’installe avec [un gestionnaire de mods pour Helldivers 1](https://www.nexusmods.com/helldivers/mods/16), version 1.1.0 ou ultérieure.

## Ce qu’un projet peut changer {#what-a-project-can-change}

Un emplacement peut recevoir un nouvel audio ou du silence. Un nouvel audio peut avoir du **Make-Up Gain**, des **Fondus** et **Aligner sur la sonie d’origine**, et la génération les intègre à l’audio lui-même. Le nouvel audio prend le format, la fréquence d’échantillonnage et les canaux de l’original : un fichier stéréo dans un emplacement mono se joue donc en mono.

Les onglets Bande-son, Texte et Outils, **Importer un mod**, les **Filtres**, les nouvelles prises et couches, et le Make-Up Gain sur l’audio d’origine sont réservés à Helldivers 2.

## L’audio de Helldivers 2 {#audio-from-helldivers-2}

La Bibliothèque affiche aussi Helldivers 2. Sélectionnez-y des emplacements et appuyez sur **Ctrl+C**, puis sélectionnez des emplacements dans l’onglet [Audio](app:editor) et appuyez sur **Ctrl+V**. L’audio d’origine entre comme nouvel audio, et la génération l’adapte à l’emplacement comme n’importe quel autre fichier. La copie marche aussi dans l’autre sens, de Helldivers 1 vers un projet Helldivers 2.

## Langues et taille {#languages-and-size}

Certains sons ont un onglet par langue, avec des emplacements séparés. Un nouvel audio dans une langue ne se joue que dans cette langue.

Un mod ne contient que le nouvel audio : le ZIP reste donc petit. Le jeu remplace une banque de sons d’un seul coup, dans toutes les langues et partout où elle se trouve : au déploiement, le gestionnaire de mods reconstruit donc chaque banque de sons que le mod change à partir des fichiers du jeu. Un son court dans une grande banque de sons peut occuper environ 3 Go de disque une fois déployé. Après une mise à jour du jeu, déployez de nouveau : le mod reste tel quel. Les mods de Helldivers 1 nécessitent la version 1.1.0 ou ultérieure du gestionnaire de mods.
