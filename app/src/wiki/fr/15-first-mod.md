---
title: Un premier mod
group: Pour commencer
summary: D’un projet vide à de la nouvelle musique dans le jeu, en neuf étapes.
source: 42abc2715a07
---

Cette page explique comment remplacer la musique de l’écran d’équipement et entendre le résultat dans le jeu, installé avec un gestionnaire de mods.

1. Sur [Accueil](app:home), choisissez **Nouveau projet** et donnez un nom au projet. Audiodiver crée un dossier pour lui, avec le fichier du projet à l’intérieur, dans le dossier des projets (`Documents\Audiodiver\Projects` au départ). L’onglet [Projet](app:project) s’ouvre avec le nom, l’icône et le dossier du mod. Copiez les fichiers audio dans ce dossier.
2. Allez dans la [Bibliothèque](app:library). Dans l’Index, ouvrez **Avant le largage** sous Musique et appuyez sur ▶ à côté de **Choix de l’équipement** pour l’écouter.
3. Cliquez sur **Choix de l’équipement**. Il a un segment de départ suivi de quatorze boucles que le jeu joue dans l’ordre. Dans le jeu, l’écran d’équipement vient après l’écran du lieu de largage et la musique continue à partir de là dans les boucles, donc le début est rarement entendu. Appuyez sur **Ajouter au projet**.
4. Allez dans l’onglet [Audio](app:editor) et cliquez sur **Choix de l’équipement** dans la liste.
5. Faites glisser les fichiers audio depuis l’Explorateur sur le morceau dans la liste, ou sur son premier emplacement. Les emplacements se remplissent dans l’ordre des noms de fichiers, donc nommez les fichiers `01 …`, `02 …` et ainsi de suite.
6. Sélectionnez un emplacement et appuyez sur ▶ sur chaque moitié de la ligne. La moitié gauche joue l’original et la moitié droite joue le remplacement. Passer de l’un à l’autre conserve la position de lecture. Les formes d’onde en dessous montrent les deux sur une même échelle de temps.
7. Appuyez sur le bouton jaune {icon:through} **Lecture enchaînée** au-dessus des emplacements. Il joue tout le morceau avec les mêmes passages de relais entre segments que ceux du jeu, et sélectionne chaque emplacement pendant la lecture.
8. Dans [Projet](app:project), donnez un nom et une icône au mod.
9. Appuyez sur **Générer**. Importez le ZIP dans un gestionnaire de mods, déployez-le et lancez le jeu.

> [!TIP]
> Écoutez dans le jeu avec des réglages de volume normaux, aux moments modifiés. Le jeu baisse la musique sur certains écrans. Voir [Make-Up Gain et le mixage](wiki:volume) pour plus de détails.

## Étapes suivantes {#next-steps}

- Ajoutez d’autres éléments depuis la Bibliothèque. Un morceau qui a plusieurs parties a {icon:fillpiece} **Remplir tout le morceau**, qui accepte des fichiers pour toutes les parties d’un coup.
- Les armes, les ennemis, les voix et les autres sons sont aussi dans l’Index. Voir [Sons et voix](wiki:sounds-and-voices).
- {icon:slice} **Découper une chanson** découpe une longue chanson en morceaux qui s’enchaînent sans coupure. Voir [Minutage, points de repère et boucles](wiki:timing-and-loops).
- Après une modification, générez de nouveau et importez le nouveau ZIP. Le gestionnaire de mods met à jour le mod installé. Voir [Génération et installation](wiki:build-and-install).
