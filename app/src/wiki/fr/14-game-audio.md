---
title: L’audio du jeu, expliqué
group: Pour commencer
summary: Comment Helldivers 2 stocke et joue l’audio, des archives et des banques jusqu’aux prises et aux emplacements, pourquoi l’application nomme les choses ainsi, et un glossaire.
source: 1a4887add42e
---

Helldivers 2 joue l’audio avec **Wwise**, un moteur audio que beaucoup de jeux utilisent. Wwise ne connaît ni chansons ni fichiers nommés. Il stocke les clips dans des conteneurs, donne un numéro à tout, et décide pendant le jeu quel clip vient ensuite. Audiodiver retransforme cette structure en éléments qu’un joueur reconnaît, et les termes de cette page sont ceux qui s’affichent à l’écran.

## Où l’audio est stocké {#where-the-audio-is-stored}

Du plus grand au plus petit :

1. Une **archive** est l’un des fichiers du dossier `data` du jeu, nommé par un code de 16 caractères comme `2e24ba9dd702da24`. Une archive contient en général l’audio d’une seule chose, comme une arme, la musique d’une faction ou une voix dans une langue. **Toutes les Archives** les liste.
2. Une **banque** est une banque de sons Wwise à l’intérieur d’une archive. Elle contient des clips et les **sons** qui les jouent. La ligne *Dans l’archive …* en haut du panneau central nomme à la fois l’archive et la banque.
3. Un **son** est une chose que le jeu peut déclencher, comme *tir d’autocanon* ou *« Reloading! »*. Un son a une ou plusieurs **prises** et en joue une à chaque fois.
4. Une **prise** est un enregistrement d’un son. Un tir de fusil a plusieurs prises, et le jeu en choisit une au hasard pour que deux tirs ne sonnent jamais pareil. Une prise est le clip que change un remplacement.

Un audio long, comme la musique et les répliques, est souvent **diffusé en flux**, c’est-à-dire que le clip est stocké dans l’archive à côté de la banque. Audiodiver trouve le clip dans les deux cas.

## Pourquoi tant d’éléments s’appellent « Séquence 3 » ou « Prise 2 » {#why-many-things-are-called-sequence-3-or-take-2}

Les fichiers du jeu contiennent des numéros et aucun nom. Les noms dans Audiodiver viennent de documents de la communauté (listés dans [À propos ▸ Crédits](app:about)) et de ce qu’Audiodiver peut déduire :

- Une séquence sans nom s’appelle **Séquence 1**, **Séquence 2** et ainsi de suite, dans l’ordre de la banque. Écoutez-la pour savoir ce que c’est. Une séquence est un groupe de prises dont le jeu en choisit une à chaque lecture.
- Les prises d’une séquence sans nom s’appellent **Prise 1**, **Prise 2** et ainsi de suite. Une prise transcrite, comme une réplique, porte le nom de ce qu’elle dit.
- Un ensemble de sons ou une archive sans nom porte le code de l’archive et est marqué *Pas encore nommé*.

Par exemple, « Séquence 4 › Prise 2 » est le deuxième enregistrement de la quatrième séquence de la banque. Pour remplacer une séquence, donnez du nouvel audio à chaque prise. Sinon, le jeu choisit parfois un original.

## Autre audio et Pas d’audio dans les fichiers du jeu {#other-audio-and-no-audio-in-the-game-files}

Deux groupes peuvent apparaître à la fin d’un ensemble de sons, après les sons nommés et numérotés :

- **Autre audio** contient les clips que la banque stocke ou nomme, mais qu’aucun des sons de la banque ne joue. Un son d’une autre banque les joue en général. On peut les lire et les remplacer comme n’importe quel clip, mais il n’y a aucune information sur leur usage.
- **Pas d’audio dans les fichiers du jeu** contient les clips que les données de la banque nomment, mais que les fichiers du jeu installés n’incluent pas. Ce sont des contenus supprimés ou des parties du jeu qui ne sont pas installées. Leur bouton ▶ est désactivé et les remplissages les ignorent.

## Comment la musique est construite {#how-music-is-put-together}

La musique de Helldivers 2 est faite pour changer avec l’action. Audiodiver emploie ces termes :

- Un **cue** est une playlist de segments, un morceau de musique tel que les données du jeu le définissent. Une étiquette **+3 cues** sur un emplacement signifie que le même clip est joué dans trois autres morceaux de musique.
- Un **morceau de musique** est ce que l’Index liste, comme *Choix de l’équipement*. C’est un cue, ou plusieurs cues qui vont ensemble.
- Une **partie** est un cue d’un morceau, affiché sous forme d’onglet (ou de ligne de la liste pour les transitions et les stingers). Un morceau peut avoir une partie par biome, par intensité, ou par langue d’une voix. Chaque partie a son propre ensemble d’emplacements.
- Un **segment** est un passage de musique joué comme une unité, avec un point d’**Entrée** et un point de **Sortie**. Le segment suivant démarre à la Sortie, et la fin du segment en cours se prolonge par-dessus.
- Une **couche**, ou stem, est l’un des clips qu’un segment joue en même temps. Chaque couche est un emplacement séparé.
- Un **emplacement** est un endroit où un clip est joué, soit une prise d’un son, soit une couche d’un segment. L’audio est remplacé un emplacement à la fois, avec un fichier par emplacement.
- Une **variante** est un emplacement qui n’est joué que sous une condition, comme un biome. La ligne montre la condition.
- Une **transition** (↝) est un court morceau joué entre deux morceaux de musique. Un **stinger** (✦) est un court morceau joué par-dessus la musique.

[Comment le jeu joue la musique](wiki:how-the-game-plays-music) donne plus de détails.

## ID {#ids}

Chaque clip, son, banque et cue a un numéro, et les fichiers du jeu n’utilisent que ces numéros. Collez un ID provenant de notes ou d’un autre outil dans une zone de recherche pour trouver où il se trouve. Le haut des détails montre l’**ID de flux** d’un emplacement, ou l’**ID source** (l’ID du clip) quand l’audio est uniquement à l’intérieur d’une banque. Les projets restent valides quand une mise à jour du jeu change des ID.

## Glossaire {#glossary}

| Mot | Signification |
|---|---|
| Archive | Un fichier du dossier `data` du jeu. Contient des banques et des clips diffusés en flux. |
| Attribution | Un fichier, ou du silence, donné à un emplacement. |
| Banque | Une banque de sons Wwise, avec des clips et les sons qui les jouent. |
| Catégorie, section | La façon dont l’Index classe les éléments, comme dans Armes ▸ Armes de soutien. |
| Cue | Une playlist de segments, un morceau de musique tel que les données du jeu le définissent. |
| Entrée, Sortie | Les points de repère d’un segment. L’Entrée est le point où il compte comme commencé, et la Sortie est le point où démarre le suivant. |
| Remplissage | Attribuer plusieurs fichiers à des emplacements dans l’ordre de lecture en une seule action. |
| Groupe | Un son avec les prises qu’il joue, affiché comme une ligne qui se déplie. |
| Index | La liste triée de la Bibliothèque pour tout ce qui a un nom. |
| Couche, stem | Des clips qu’un segment joue en même temps. |
| Nouvel audio | Le fichier qui remplace l’original d’un emplacement. |
| Original | L’audio du jeu dans un emplacement. |
| Partie | Un cue d’un morceau de musique ou une langue d’une voix, affiché sous forme d’onglet. |
| Morceau de musique | Une musique qu’un joueur reconnaît, faite d’un ou de plusieurs cues. |
| Lecture enchaînée | Lire un morceau entier avec les mêmes passages de relais entre segments que ceux du jeu. |
| Projet | Le fichier `.audi`, qui enregistre sur quoi le mod travaille et les attributions. |
| Remplacé | Un emplacement qui joue du nouvel audio, ou du silence, à la place de l’original. |
| Segment | Un passage de musique joué comme une unité. |
| Silence, Sauter | Remplacer un emplacement par rien. Sauter le fait pour une transition afin que le jeu enchaîne directement. |
| Emplacement | Un endroit où un clip du jeu est joué. |
| Son | Quelque chose que le jeu déclenche. Il joue une prise à chaque fois. |
| Ensemble de sons | Les sons d’une seule chose, comme une arme, un ennemi ou une voix. |
| ID source | Le numéro d’un clip dans les fichiers du jeu. |
| Stinger | Une courte phrase jouée par-dessus la musique. |
| Flux | Un clip stocké à côté d’une banque, en dehors d’elle. |
| ID de flux | Le numéro sur 64 bits d’un fichier de flux. |
| Prise | Un enregistrement d’un son. Le jeu en choisit une au hasard. |
| Transition | Un court morceau joué entre deux morceaux de musique. |
| Variante | Un emplacement qui n’est joué que sous une condition. |
| Wwise | Le moteur audio que le jeu utilise. |
