---
title: Foire aux Questions
group: FAQ
summary: De courtes réponses aux questions courantes, chacune avec un lien vers la page qui la traite en détail.
source: 09dda6069291
---

## Trouver de l’audio {#finding-audio}

### Quelle est la fiabilité de l’Index de la Bibliothèque ? {#how-accurate-is-the-library-index}

La musique est la partie la plus fiable. Helldivers 2 nomme les états qui choisissent la musique, comme l’écran, l’ennemi et la présence ou non d’un combat, et l’Index classe la musique selon ces noms. Les ensembles de sons, les armes et les étiquettes de clips viennent de recherches de la communauté du modding, listées dans [À propos ▸ Crédits](app:about), et certains de ces noms sont des hypothèses raisonnables. Les répliques portent le nom du sous-titre qui correspond à leurs mots, et une ligne dont le sous-titre n’est pas certain affiche **un parmi plusieurs**.

Une séquence sans nom s’affiche comme *Séquence 3* ou *Prise 2*. [L’audio du jeu, expliqué](wiki:game-audio#why-many-things-are-called-sequence-3-or-take-2) en donne la raison. Pour signaler un nom incorrect ou manquant, utilisez le formulaire [Nom incorrect ou manquant](https://github.com/Alomare/Audiodiver/issues/new?template=wrong_name.yml) sur GitHub.

### Comment Audiodiver sait-il quelle musique est jouée dans quelle situation ? {#how-does-audiodiver-know-what-music-plays-in-which-scenario}

Le jeu choisit la musique avec des états nommés : le vaisseau, le largage, la faction ennemie, l’exploration, un combat et son intensité. Audiodiver lit ces états et les règles qui permettent de passer de l’un à l’autre dans les banques de sons, et liste la musique dans l’ordre où une mission la rencontre, de *À bord du vaisseau* à *Crédits*. La musique qu’aucun état ne place est listée sous *Pas encore identifié*. Les transitions sont nommées d’après ce qu’elles relient, et les stingers d’après ce qu’ils recouvrent. L’ordre à l’intérieur d’un morceau de musique vient de sa playlist, que la [Bande-son](wiki:soundtrack) montre.

### Que sont les emplacements, les segments et les prises ? {#what-are-slots-segments-and-takes}

Un **emplacement** est un clip qui peut être remplacé. La musique est faite de **segments** joués l’un après l’autre, chacun avec un ou plusieurs emplacements. Un son a des **prises** et en joue une à chaque fois. [L’audio du jeu, expliqué](wiki:game-audio) contient le glossaire complet.

## Créer un mod {#making-a-mod}

### Comment ajouter du nouvel audio aux segments existants ? {#how-can-i-add-new-audio-to-existing-segments}

Déposez un fichier audio sur l’emplacement d’un segment dans l’onglet [Audio](app:editor). Le nouvel audio remplace l’original, et le minutage du segment suit la nouvelle durée ([Minutage, points de repère et boucles](wiki:timing-and-loops#fitting-the-timing-to-the-new-audio)). Plusieurs fichiers déposés sur un morceau remplissent les emplacements dans l’ordre de lecture. Pour étaler une chanson sur tout un morceau, utilisez **Découper une chanson**, ou **Une seule chanson** dans la [Bande-son](wiki:soundtrack#one-song). Pour une playlist de chansons entières, utilisez **Playlist** au même endroit.

La musique ne peut pas recevoir de prises ni de couches supplémentaires. Celles-ci sont réservées aux sons et aux voix, voir [Ajouter de l’audio](wiki:adding-audio).

### Pourquoi ma chanson est-elle jouée dans le désordre dans le jeu ? {#why-does-my-song-play-out-of-order-in-game}

Le jeu joue rarement un morceau de musique de haut en bas. La plupart des musiques de combat ouvrent chaque combat sur une courte ouverture, choisissent certains segments au hasard et reprennent là où le dernier combat s’est arrêté. La [Bande-son](wiki:soundtrack) montre l’ordre de lecture de chaque morceau, et **Une seule chanson** fait jouer la chanson depuis le début à chaque combat. [Comment le jeu joue la musique](wiki:how-the-game-plays-music) explique les éléments.

### Pourquoi est-ce que j’entends encore l’audio d’origine ? {#why-do-i-still-hear-the-original-audio}

En général, pour l’une de ces raisons :

- Une couche du segment joue encore l’original. [Couches](wiki:how-the-game-plays-music#layers) explique comment la mettre en silence.
- L’emplacement n’est joué que sous une condition, comme un biome, et une autre variante est jouée ailleurs ([Variantes](wiki:how-the-game-plays-music#variants)).
- Une transition d’origine est jouée entre deux morceaux de nouvelle musique ([Transitions et stingers](wiki:how-the-game-plays-music#transitions-and-stingers)).
- Un son a plusieurs prises et certaines sont encore d’origine. Remplacez-les toutes.
- Le son est aussi dans des banques que le projet ne liste pas. **Patcher chaque banque contenant les sons** dans l’onglet Générer les couvre ([Chaque banque contenant les sons](wiki:build-and-install#every-bank-with-the-sounds)).

### Quels fichiers audio puis-je utiliser ? {#which-audio-files-can-i-use}

WAV, FLAC, MP3, OGG, Opus, M4A, AAC, AIFF, WMA et WEM. Un WAV ou FLAC à 48 kHz donne le meilleur résultat, et un WEM en Wwise Vorbis entre dans le mod sans changement. Voir [Préparer l’audio](wiki:preparing-audio#formats).

### Comment rendre le nouvel audio plus fort ou plus faible ? {#how-do-i-make-new-audio-louder-or-quieter}

Réglez **Make-Up Gain** sur l’emplacement, dans les détails à droite. Plusieurs emplacements sélectionnés prennent une même valeur, et le **Niveau** d’un morceau dans la Bande-son augmente ou réduit tout le morceau. [Make-Up Gain et le mixage](wiki:volume) décrit les niveaux, et [Préparer l’audio](wiki:preparing-audio#loudness) la sonie à viser.

### Comment mettre un son ou un morceau de musique en silence ? {#how-do-i-silence-a-sound-or-a-piece-of-music}

Faites un clic droit sur un emplacement et choisissez **Remplacer par du silence**. **Conserver la durée d’origine** détermine si le jeu attend la durée d’origine ou passe tout de suite à la suite ([Silence](wiki:how-the-game-plays-music#silence)). Un morceau de musique entier devient silencieux avec **Silencieux** dans la [Bande-son](wiki:soundtrack#modes).

### Puis-je modifier les sous-titres et les autres textes ? {#can-i-change-subtitles-and-other-text}

Oui, dans l’onglet [Texte](app:text) : chaque ligne dans chaque langue, avec des couleurs, des tailles et de la mise en valeur. Voir [Texte et sous-titres](wiki:text).

## Générer et partager {#building-and-sharing}

### Audiodiver modifie-t-il les fichiers du jeu ? {#does-audiodiver-change-the-game-files}

Non. Il ne fait que lire le dossier du jeu. Une génération produit un ZIP qu’un gestionnaire de mods importe et déploie ([Génération et installation](wiki:build-and-install#installing)).

### Que faire après une mise à jour du jeu ? {#what-do-i-do-after-a-game-update}

Ouvrez le projet et générez-le de nouveau, puis importez le nouveau ZIP dans le gestionnaire de mods ([Quand le jeu est mis à jour](wiki:game-updates#rebuild)). Un mod créé par quelqu’un d’autre peut être reconstruit pour le jeu actuel avec [Repatch](wiki:repatching).

### Mon mod peut-il fonctionner avec d’autres mods audio ? {#can-my-mod-run-with-other-audio-mods}

Deux mods qui modifient la même banque de sons ne se combinent pas, et celui déployé en dernier l’emporte ([Deux mods qui modifient la même banque](wiki:build-and-install#two-mods-that-change-the-same-bank)). [Combiner des Mods](wiki:combining-mods) les assemble en un seul mod.

### Pourquoi mon mod est-il si gros ? {#why-is-my-mod-so-big}

Un mod transporte une copie complète de chaque banque de sons qu’il modifie. La musique est dans la banque de musique de chaque mission, et certains sons sont dans une centaine de banques, donc les remplacer ajoute chaque copie ([Chaque banque contenant les sons](wiki:build-and-install#every-bank-with-the-sounds), [Taille](wiki:adding-audio#size)).

### Comment déplacer un projet vers un autre ordinateur ? {#how-do-i-move-a-project-to-another-computer}

**Exporter en pack** dans l’onglet Projet enregistre le projet et tous les fichiers qu’il utilise dans un seul fichier `.audipack`. Ouvrez-le sur l’autre ordinateur ([Dossiers de projet](wiki:project-folders)).

### Comment partager mon mod ? {#how-do-i-share-my-mod}

Publiez le ZIP du dossier de génération. [Partager un mod](wiki:sharing) indique ce qu’il faut inclure et ce qu’il faut laisser de côté.
