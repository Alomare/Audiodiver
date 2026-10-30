---
title: Bande-son
group: Créer un mod
summary: Comment chaque morceau de musique est joué : dans l’ordre d’origine, comme une seule chanson, comme une playlist, en silence, ou comme la musique de combat.
source: 214ec97ec28d
---

Le jeu ne joue pas un morceau de musique de haut en bas. La playlist d’un morceau mélange des groupes joués dans l’ordre, des groupes qui jouent le segment suivant à chaque fois, et des groupes qui choisissent au hasard. La plupart des musiques de combat démarrent chaque combat sur une courte ouverture, et un nouveau combat reprend là où le précédent s’est arrêté. Une chanson découpée dans les emplacements dans l’ordre de la liste est jouée dans le désordre dans le jeu.

L’onglet [Bande-son](app:soundtrack) liste toute la musique et règle la façon dont chaque morceau est joué. Les générations écrivent cet ordre dans la musique.

## Musique {#music}

La liste à gauche contient toute la musique du jeu, classée selon l’endroit où on l’entend. Chaque ligne indique comment la musique est jouée, avec le niveau quand il n’est pas de 0 dB, et **Mixte** signifie que les parties d’un morceau sont jouées de manières différentes. Une musique à plusieurs parties, comme Arrivée avec une partie par biome, les affiche sous forme d’onglets. La zone de recherche trouve la musique par section, nom ou mode, comme *Illuministes* ou *Playlist*, et {icon:collapse} **Tout replier** replie chaque section.

Les **Modèles** règlent beaucoup de musique à la fois :

- **Chansons de combat** règle le Combat intense de chaque ennemi sur **Identique à Combat**, pour qu’une seule chanson couvre un combat.
- **Exploration calme** règle la musique d’Exploration de chaque ennemi sur **Silencieux**.
- **Sans ouvertures** retire les courtes ouvertures de la musique de combat, pour que les combats démarrent directement sur la musique.
- **Original** remet toute la musique dans l’ordre d’origine. Le nouvel audio reste dans les emplacements.

Annuler reprend un modèle entier. Un modèle qui ne trouve rien à modifier l’indique.

## Modes {#modes}

| Mode | Ce qui est joué |
|---|---|
| **Original** | Les segments dans leur ordre d’origine. Décochez un segment dans l’ordre de lecture pour l’écarter de cette musique. Il est toujours joué partout ailleurs où le jeu l’utilise. |
| **Une seule chanson** | Une chanson, découpée dans les segments. Chaque combat joue une ouverture, puis la chanson à partir du morceau 1. |
| **Playlist** | Des chansons entières, une à chaque endroit, dans l’ordre ou en lecture aléatoire. |
| **Silencieux** | Rien. |
| **Identique à Combat** | Pour Combat intense. La musique de combat se poursuit à partir du segment où elle en est, donc la chanson ne recommence pas quand un combat devient plus intense. |

**Niveau** augmente ou réduit le morceau entier jusqu’à 96 dB, en plus du Make-Up Gain de chaque emplacement. Faites glisser le curseur, ou saisissez une valeur dans la zone à côté. {icon:reset} le remet à 0 dB. Une musique silencieuse et une musique réglée sur Identique à Combat ne sont pas jouées, donc Niveau est désactivé pour elles.

**Copier vers** règle de la même façon la musique de même nom à d’autres endroits, par exemple la musique de Combat de chaque ennemi. Une playlist place chaque chanson au même endroit, et Une seule chanson place les morceaux dans l’ordre. Quand il y a moins d’endroits, les dernières chansons ou les derniers morceaux sont écartés, et une note l’indique.

## Une seule chanson {#one-song}

**Choisir une chanson** ouvre l’outil de découpe avec les segments que la chanson remplit. Une chanson déposée sur la page l’ouvre aussi. Découpez-la en autant de morceaux que vous voulez, jusqu’à un par segment. Chaque morceau va en entier dans un segment. La première couche reçoit le morceau et les autres couches jouent du silence. Dans la musique d’extraction, la première couche à basse intensité et la première à haute intensité le reçoivent toutes les deux.

**Modifier les coupes** ouvre de nouveau l’outil de découpe avec la même chanson et les mêmes coupes. **Choisir une autre chanson** repart avec une nouvelle.

## Playlist {#playlist}

Une playlist a une ligne pour chaque endroit où une chanson peut aller, dans l’ordre de lecture. Cliquez sur un endroit, ou déposez-y une chanson, pour y placer une chanson. Plusieurs fichiers choisis ou déposés sur un endroit le remplissent ainsi que les endroits suivants, dans l’ordre des noms de fichiers. **Ajouter des chansons** remplit les endroits vides. Faites glisser une chanson vers un autre endroit pour la déplacer, et les chansons entre les deux avancent d’un endroit. ↑ et ↓ sur la ligne, ou {key:moveUp} et {key:moveDown}, déplacent une chanson d’un endroit, et ✕ la retire de la playlist. Le fichier reste sur le disque.

Les endroits vides ne sont pas joués. **Lecture aléatoire** joue les chansons dans un ordre aléatoire, et aucune chanson n’est jouée deux fois avant que les autres l’aient été. **Continuer au combat suivant** démarre chaque combat sur la chanson qui suit celle où le dernier combat s’est arrêté. Sans cette option, chaque combat repart de la première chanson. Pour la musique hors combat, l’option est **Continuer la fois suivante**.

Quand la musique change, par exemple de l’exploration au combat, elle quitte une chanson à la mesure suivante avec un court fondu, sans attendre la fin de la chanson.

## Ouvertures {#openings}

La plupart des musiques de combat démarrent chaque combat sur une courte ouverture, un segment choisi dans un groupe de segments, avant la musique elle-même. L’ordre de lecture marque ce groupe **Les combats commencent ici**. Certaines musiques hors combat démarrent de la même façon chaque fois qu’elles se lancent.

**Une seule chanson** et **Playlist** gardent les ouvertures, donc un combat démarre sur une ouverture d’origine et la chanson ou la playlist suit. Pour changer ce qui est joué à cet endroit :

- Remplacez les ouvertures dans l’onglet [Audio](app:editor), comme n’importe quel autre emplacement, par du nouvel audio ou par du silence. Un silence avec **Conserver la durée d’origine** désactivé passe directement à la chanson ([Silence](wiki:how-the-game-plays-music#silence)).
- Pour une musique en **Original**, décochez les ouvertures dans l’ordre de lecture pour les écarter, ou utilisez le modèle **Sans ouvertures** pour la musique de combat de tous les ennemis à la fois.

## Écoute {#listening}

Chaque ligne a l’original à gauche et le nouvel audio à droite, chacun avec ▶, comme un emplacement de l’onglet Audio. Cliquez sur une ligne, ou sur un segment dans l’ordre de lecture, pour le sélectionner. Les formes d’onde du segment sélectionné s’affichent en bas, l’original en haut et le nouvel audio en dessous, avec l’**Entrée** et la **Sortie**. Cliquez sur une forme d’onde pour lire à partir de ce point. {key:selectPrev} et {key:selectNext} sélectionnent le segment précédent ou suivant, et {key:playGame} et {key:playMine} jouent l’original ou le nouvel audio de ce segment.

Les boutons ronds en haut jouent un combat entier, le gris avec la musique d’origine et le jaune avec l’ordre et l’audio du projet. **Durée du combat** définit combien de temps dure le combat. Le combat se termine avec le segment joué à ce moment, et **Combat suivant** continue à partir de là. Pour la musique hors combat, ce sont **Joue pendant** et **Rejouer**. Pendant qu’un combat est joué, une barre montre où il en est (cliquez dessus pour aller à cet endroit), et le segment en cours s’allume et est sélectionné, si bien que les formes d’onde suivent le combat. Une ligne sous la barre liste les segments du combat dans l’ordre où ils ont été joués.

## Export {#exporting}

{icon:export} **Exporter** dans la barre au-dessus de la musique enregistre le morceau sous forme de fichiers audio ([Export](wiki:reading-the-screen#exporting)). **Le morceau entier** le joue une fois d’un bout à l’autre, et **Un combat** enregistre un combat tel que les boutons ronds en jouent un, pour la durée définie en minutes. Chaque export d’un combat est un nouveau combat. **Chaque segment** et **Chaque emplacement** enregistrent les parties. Avec **Comme le mod le joue**, l’export suit le mode, les chansons et le niveau définis ici.

{icon:header} et {icon:waves} à l’extrémité de cette barre masquent ou affichent l’en-tête et les formes d’onde. Faites glisser les bords sous l’en-tête, au-dessus des formes d’onde et à côté de la liste pour les redimensionner. **Emplacements**, à côté du nom de la musique, l’ouvre dans l’onglet [Audio](app:editor).

## Ordre de lecture {#play-order}

L’ordre de lecture montre le morceau sous forme de groupes de segments, chacun sur une carte avec un titre qui dit ce qu’elle en fait, et une carte plus sombre pour chaque groupe plus à l’intérieur :

- **Dans l’ordre** les joue l’un après l’autre.
- **Le suivant à chaque fois** en joue un à chaque fois, le suivant dans l’ordre. Un nouveau combat reprend là où le précédent s’est arrêté.
- **Aléatoire** les joue tous dans un ordre aléatoire.
- **Un au hasard** en joue un, choisi au hasard.

Les segments d’un groupe sont reliés par ce que le groupe signifie : → pour dans l’ordre, *ou* pour un au hasard. Les groupes placés les uns sous les autres sont reliés de la même façon par *puis*, *la fois suivante* ou *ou*. Un petit choix de segments tient sur une seule ligne dans un cadre en pointillés, et un groupe qui ne contient qu’un seul élément montre cet élément seul, puisque le résultat est le même.

**Se répète** marque un groupe qui est joué de nouveau jusqu’à ce que la musique change, et **3 fois** un groupe joué trois fois, puis qui passe à la suite. **Les combats commencent ici** marque l’endroit où la musique démarre quand un combat commence ([Ouvertures](wiki:soundtrack#openings)), et **Commence ici** l’endroit où une autre musique démarre chaque fois qu’elle se lance. Le ▶ sur un segment joue ce que le projet y joue.

## Couches {#layers}

Une musique qui joue plusieurs couches à la fois, comme la musique d’extraction, les montre sous forme de grille : une ligne par segment, et une colonne par couche à basse et à haute intensité. Cliquez sur une cellule pour voir les formes d’onde. Remplacez les couches dans l’onglet [Audio](app:editor).
