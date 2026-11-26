---
title: Options pour les joueurs
group: Générer et partager
summary: Des groupes que les joueurs cochent dans le gestionnaire de mods, chacun avec des options au choix, comme l’un de cinq sons pour une arme.
source: e6c8bc37ba4c
---

## Groupes et options {#groups-and-options}

Un **groupe** est une partie du mod que les joueurs peuvent activer ou désactiver dans le gestionnaire de mods, comme **Tir du Liberator** ou **Extraction**. Le groupe a des **options** au choix, comme **1**, **2** et **3**. Les joueurs cochent un groupe et choisissent l’une de ses options. Un groupe non coché n’installe rien : ses emplacements jouent comme ils joueraient sans lui, avec le son original ou ce que le reste du mod y met.

Tout ce qui est hors des groupes forme le **mod de base**, qui est toujours installé.

Les groupes se créent dans l’onglet [Projet](app:project), sous **Options pour les joueurs** :

- **Ajouter un groupe** ajoute un groupe avec une option. **Ajouter une option** en ajoute une autre.
- Cliquez sur un nom pour le changer. Chaque groupe et chaque option a aussi une description.
- Le carré à côté d’un nom choisit l’image que les joueurs voient dans le gestionnaire de mods. Elle est recadrée en carré centré, comme l’icône.
- Les flèches déplacent groupes et options, et la corbeille les supprime. La première option d’un groupe est celle qu’un gestionnaire de mods choisit au départ.

Chaque groupe a une lettre et chaque option un numéro, qui forment ensemble un code comme **A3** : la lettre s’affiche sur l’image du groupe, et le code à côté de l’image de chaque option. Les codes suivent l’ordre : le premier groupe est **A**, et **A3** est la troisième option de ce groupe. Déplacer ou supprimer un groupe ou une option change les codes qui suivent.

Sous chaque option, une ligne indique ce qu’elle modifie et à peu près ce qu’elle ajoute au mod. **Modifications** liste chaque emplacement que l’option modifie, avec le réglage tel que l’a le mod de base et tel que l’a l’option. Le bouton d’annulation d’une ligne retire cette modification de l’option, après une question. Cliquez sur le nom d’un emplacement pour l’afficher dans l’onglet Audio.

## Modifier une option {#editing-an-option}

**Sélectionner** sur une option fait modifier cette option par l’onglet [Audio](app:editor), et l’option est mise en évidence dans l’onglet Projet. La barre au-dessus de l’onglet Audio indique ce qui est modifié, et son menu permet d’en choisir un autre : **Mod de base**, ou une option d’un groupe. **Revenir au mod de base**, sur l’un ou l’autre onglet, revient à la modification du mod lui-même. Une seule option est modifiée à la fois.

Pendant qu’une option est modifiée, l’onglet Audio joue le mod avec cette option choisie. Les modifications des emplacements vont dans l’option :

- Un emplacement du groupe va dans l’option. La ligne porte le code de l’option, comme **A3**.
- Un emplacement qu’aucun groupe n’a encore rejoint le groupe.
- Un emplacement d’un autre groupe ne peut pas changer. La ligne porte la lettre de ce groupe, en pointillés.

Tout ce qui est fait aux emplacements compte : déposer des fichiers, copier et coller, Silence, le gain, les filtres et les fondus dans les détails, les points de repère et [Waveform Suite](wiki:timing-and-loops#the-waveform-suite). Le panneau de détails indique quelle option modifie un emplacement et ce qui joue sans le groupe.

**Retirer de l’option**, dans le menu contextuel d’un emplacement, retire la modification : l’emplacement joue alors comme sans le groupe. Un emplacement qu’aucune option du groupe ne modifie plus revient au mod de base.

Les nouvelles prises, les couches et Isoler audio changent ce dont les sons sont faits, ils appartiennent donc au mod de base. Revenez au mod de base pour les utiliser.

## Gain {#gain}

**Gain** sur une option ajoute autant de dB à chaque emplacement que le mod de base modifie, de −12 à +12 dB. Un groupe **Volume** avec **Plus fort** à +3 dB et **Plus bas** à −3 dB permet aux joueurs de choisir le volume du mod. Les emplacements des groupes gardent les niveaux qui leur sont donnés, tout comme un emplacement du mod de base modifié pendant qu’une option est modifiée : il rejoint le groupe au niveau qui lui a été donné.

## Groupes qui modifient les mêmes banques {#groups-that-change-the-same-banks}

Dans les gestionnaires de mods de Helldivers 2, chaque option remplace des banques de sons entières. Deux groupes ne peuvent pas modifier la même banque : celui qui se déploie en dernier l’emporterait, quel que soit le choix des joueurs dans l’autre. Un emplacement dont la banque contient déjà des sons d’un autre groupe ne peut donc pas aller dans un second groupe ; modifiez-le dans ce groupe, ou dans le mod de base. Les onglets Projet et Générer le signalent si deux groupes partagent encore des banques, comme un groupe **Volume** et un groupe qui modifie des emplacements dans les banques du mod de base.

Obsidian, pour les mods de Helldivers 1, n’a pas cette limite : la génération ajoute une version des sons partagés pour chaque combinaison de choix.

## Ce que produit une génération {#what-a-build-makes}

Pour Helldivers 2, le gestionnaire de mods affiche d’abord le mod de base. Chaque groupe suit, avec ses options au choix. Chaque option ne contient que les banques de sons et les flux qui diffèrent du mod de base. Là où une option rend l’original à un son que le mod de base remplace, elle contient la banque du jeu, si bien que l’original joue.

Une banque entre en entier, avec tous les sons qu’elle stocke. La plupart des sons sont stockés dans des banques, donc une option qui en modifie un ajoute la taille complète de cette banque : environ 10 MB pour un son typique, et bien plus pour la musique, dont chaque banque de musique de mission contient une copie. Un son que le jeu lit en streaming depuis un fichier séparé n’ajoute que la taille de ce fichier.

Pour Helldivers 1, chaque groupe est une option dans Obsidian, avec ses options et **Désactivé** au choix.

> Une option qui ne modifie encore rien ne déploie rien. Remplissez-la dans l’onglet Audio, ou donnez-lui un gain, avant de générer.
