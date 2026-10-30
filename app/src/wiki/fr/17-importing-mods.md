---
title: Importer un mod
group: Pour commencer
summary: Un mod créé avec n’importe quel outil, comme projet sur lequel continuer à travailler : l’audio, les sons qu’il ajoute, les réglages et le texte.
source: 672ff32999fa
---

**Importer un mod** sur [Accueil](app:home), ou dans l’onglet [Projet](app:project) tant qu’aucun projet n’est ouvert, crée un nouveau projet à partir d’un mod existant. Choisissez le ZIP du mod, ou un fichier `.patch_0`. Le panneau qui s’ouvre montre le mod comme un gestionnaire de mods le montre, et liste ce qui est importé avant que quoi que ce soit soit écrit.

## Options, nom et dossier {#options-name-and-folder}

1. Choisissez les options. Un mod avec des options, comme un choix de voix ou une version avec sous-titres, démarre avec les options que le gestionnaire de mods a activées, ou avec toutes. **Ce qui est importé** liste les patchs que ces options déploient.
2. Nommez le projet et choisissez le dossier. Le projet va dans un nouveau dossier à cet endroit.
3. **Garder l’ID du mod** fait que les générations du projet mettent à jour ce mod dans le gestionnaire de mods. Désactivez-le pour installer les générations à côté du mod, comme un autre mod ([ID du mod](wiki:build-and-install#mod-id)).
4. **Utiliser l’icône du mod** place sur le projet l’image que le gestionnaire de mods affiche. Sans cette option, le projet a l’icône par défaut.
5. Appuyez sur **Créer le projet**. Le projet s’ouvre sur l’onglet Audio une fois l’import terminé.

## Ce qui est importé {#what-comes-in}

- L’audio que le mod remplace, sur les mêmes sons. Il va dans les générations sans être converti de nouveau.
- L’audio que le mod ajoute : de nouvelles prises pour un son, un nouveau son joué avec un son existant (une couche), ou un clip séparé pour un seul son. Chacun devient le même type d’ajout que ceux de [Ajouter de l’audio](wiki:adding-audio).
- Le Make-Up Gain, sur les emplacements des sons qu’il atteint, y compris quand le mod le règle sur un conteneur situé au-dessus. Un emplacement n’a qu’un seul gain, donc quand le mod donne des gains différents à deux sons qui jouent le même clip, ces gains restent sur les sons, avec les autres réglages.
- Les autres réglages de son, comme le volume ou la hauteur d’un son ou d’un conteneur, ou un délai avant sa lecture. Les générations les incluent, et le panneau de détails de l’onglet Audio les liste sous **Réglages importés** sur chaque emplacement qu’ils atteignent.
- Les courbes de volume sur les pistes de musique. Les générations les incluent, et les formes d’onde les affichent. Voir [Courbes de volume](wiki:volume#volume-curves).
- Les points de repère des segments de musique auxquels le mod donne du nouvel audio.
- Les lignes du texte du jeu que le mod modifie, comme les sous-titres ou les noms.

Les modèles, les textures et les autres fichiers qui ne sont ni de l’audio ni du texte restent de côté, car un projet ne contient que de l’audio et du texte. Les autres types de modification, comme les effets ou la façon dont un conteneur choisit les sons, ne sont pas importés non plus. L’import liste ce qui a été laissé de côté.

## Texte {#text}

Le texte arrive sous forme de modifications dans l’onglet [Texte](app:text), une pour chaque ligne que le mod modifie. Un mod transporte des tables de texte entières, donc un mod créé pour une ancienne version du jeu transporte aussi le texte de cette version. Ces lignes apparaissent comme des modifications même quand seul le jeu a changé, par exemple un ennemi renommé dans une mise à jour. Le panneau liste chaque ligne avec le texte du mod au-dessus du texte actuel. Décochez les lignes que seul le jeu a modifiées, une par une ou un groupe à la fois.

## Dans le projet ouvert {#into-the-open-project}

**Importer des patchs** dans l’onglet Projet, ou un fichier `.patch_0` déposé sur la fenêtre, ajoute un mod au projet ouvert. Le même panneau s’ouvre, sans le nom ni le dossier. Si le projet n’est pas vide, choisissez comment l’audio arrive. **Ajouter au projet** garde le contenu actuel, et quand les deux ont de l’audio pour un emplacement, c’est l’audio du mod qui est retenu. **Remplacer l’audio du projet** retire d’abord le nouvel audio, les sons ajoutés, les points de repère et la liste. Le texte et les fichiers audio restent dans les deux cas, et Annuler restaure le projet.

Pour reconstruire un mod pour la version actuelle du jeu sans projet, utilisez [Repatch](wiki:repatching).
