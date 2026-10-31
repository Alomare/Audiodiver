---
title: Comprendre l’écran
group: Pour commencer
summary: Ce que montre chaque partie de la Bibliothèque et de l’onglet Audio, et ce que signifient les étiquettes et les marques d’une ligne.
source: f9a18dbaae00
---

La Bibliothèque et l’onglet Audio partagent une même disposition : une liste à gauche, l’élément ouvert au milieu et le panneau de détails à droite. La Bande-son a une disposition différente, décrite dans [Bande-son](wiki:soundtrack). Les mots en **gras** sont expliqués dans [L’audio du jeu, expliqué](wiki:game-audio).

## La liste à gauche {#the-list-on-the-left}

- **Index** classe l’audio selon ce qu’il est. Des catégories comme Musique, Armes et Ennemis contiennent des sections comme *À bord du vaisseau* et *Armes principales*. Chaque section liste des éléments que vous pouvez ouvrir, soit un **morceau de musique**, soit un **ensemble de sons**. Le nombre à la fin d’une ligne est la durée d’un morceau de musique, ou le nombre de sons d’un ensemble.
- **Toutes les Archives** affiche chaque **archive** qui contient de l’audio, sous forme de tableau. Cliquez sur l’en-tête d’une colonne pour trier selon elle, et cliquez de nouveau pour inverser l’ordre. Les icônes de la colonne *Index* indiquent quelles catégories incluent l’archive. Toutes les Archives démarre plus large que l’Index, et chacun garde la largeur que vous lui donnez.
- Quand Helldivers 1 est installé, les onglets **Helldivers 2** et **Helldivers 1** sous ces deux-là choisissent le jeu.
- Dans la Bibliothèque, le **+** à la fin d’une ligne l’ajoute au projet, et **✓** signifie que le projet l’a déjà. Les lignes de catégorie et de section ont aussi un **+**, qui ajoute tout ce qui est visible en dessous. Après une recherche, ce **+** ajoute uniquement les résultats.
- Dans l’onglet Audio, la liste montre ce que le projet contient. **✕** sur une ligne, ou sur une ligne de catégorie ou de section, la retire du projet, avec tout ce que le projet y modifie : le nouvel audio, y compris dans les emplacements qu’un autre élément du projet partage, les prises et les couches ajoutées, le Make-Up Gain, ainsi que les points de repère et les réglages de la Bande-son d’une musique. Audiodiver demande d’abord confirmation quand du nouvel audio serait perdu. Le clic droit fait la même chose, et {key:undo} le rétablit.
- {icon:collapse} **Tout replier**, à côté de la zone de recherche, replie chaque catégorie et chaque section. Une recherche déplie tout ce qui correspond.

## Le haut du panneau central {#the-top-of-the-middle-panel}

- **Le chemin et le titre** montrent où se trouve l’élément dans l’Index (*Armes ▸ Armes principales*, *Helldivers ▸ Voix*) et comment il s’appelle. ‹ et › à la fin du titre permettent de revenir en arrière et d’avancer.
- **Original**, **Partiellement remplacé** ou **Remplacé** indique ce que l’élément joue maintenant, dans l’onglet Audio uniquement.
- **Dans l’archive …** nomme l’archive qui contient l’élément, suivie du nom de la **banque** dans les fichiers du jeu. Cliquez sur l’archive pour l’ouvrir dans Toutes les Archives.

Sous le titre, une rangée de cases donne plus d’informations sur l’élément. Elles sont côte à côte, et s’empilent quand le panneau est étroit :

- {icon:transition} **N transitions sont jouées à côté de cette musique** apparaît pour la musique uniquement. Elle compte les courts morceaux qui mènent à la musique et qui en sortent. **Afficher** les liste, avec ce que chacun joue maintenant.
- {icon:order} **Le jeu joue ces emplacements dans un autre ordre** apparaît pour une musique dont la playlist ne joue pas les emplacements de haut en bas. **Ordre de lecture** l’ouvre dans la [Bande-son](wiki:soundtrack).
- {icon:link} **Partage de l’audio avec** liste d’autres éléments qui jouent certains des mêmes clips.

{icon:header} à la fin de la barre d’outils masque l’en-tête, et l’affiche de nouveau.

## La barre d’outils {#the-toolbar}

{icon:through} **Lecture enchaînée** joue tout le morceau de musique segment par segment, dans le même ordre que le jeu. Le bouton gris joue l’audio **Original**, le bouton jaune l’audio **Remplacé**. Pendant la lecture, une barre montre où elle en est.

La barre d’outils commence par une case qui sélectionne tous les emplacements, ou efface la sélection. Dans la Bibliothèque, elle contient ensuite **Ajouter au projet**, et dans l’onglet Audio ces outils :

| Outil | Fonction |
|---|---|
| {icon:fill} **Remplir depuis des fichiers** | Remplit les emplacements avec des fichiers, un fichier par emplacement, dans l’ordre de lecture et l’ordre des noms de fichiers. |
| {icon:fillpiece} **Remplir tout le morceau** | Remplit de la même façon les emplacements de chaque partie, partie par partie. |
| {icon:slice} **Découper une chanson** | Découpe une chanson en morceaux, un par emplacement. |
| {icon:export} **Exporter** | Enregistre l’élément, ou les emplacements sélectionnés, en fichiers WAV, FLAC, MP3 ou WEM. **Liste d’Export** à côté ouvre la [liste d’export](#the-export-list) dès qu’elle contient quelque chose. |
| {icon:skip} **Sauter**, {icon:skipall} **Tout sauter** | Remplacent une transition ou un stinger par un court silence. |
| {icon:clear} **Tout effacer**, **Effacer cette partie** | Retirent le nouvel audio de tous les emplacements affichés, ou de tous les emplacements de la partie. |

{icon:search} **Rechercher des emplacements** restreint la liste par nom, étiquette, note, nom de fichier ou ID. Dans un ensemble de sons, elle trouve aussi les mots d’une réplique. Quand rien dans la liste ne correspond, **Ailleurs** liste les morceaux de musique et les ensembles de sons qui ont un résultat.

{icon:id} après la recherche liste les sons d’une banque par [ID de conteneur](#container-ids). Appuyez dessus de nouveau pour revenir aux noms.

{icon:header} et {icon:waves} à la fin de la barre d’outils masquent ou affichent l’en-tête et les formes d’onde, et le **?** qui les suit ouvre cette section. Le bouton des formes d’onde fonctionne quand un emplacement est sélectionné.

## Parties {#parts}

Les onglets sous la barre d’outils permettent de passer d’une **partie** à l’autre de l’élément ouvert. Les parties sont les biomes ou les intensités d’un morceau de musique, ou les langues d’une voix. Le nombre sur un onglet est une durée ou un nombre de sons.

Les transitions et les stingers ont beaucoup de courtes parties, donc chaque partie est plutôt une ligne dans la liste des emplacements. Une ligne joue l’original, affiche la durée, et signale une partie silencieuse ou qui appartient à une autre musique. Les emplacements de la partie ouverte sont listés juste en dessous. Cliquez sur une autre ligne pour ouvrir cette partie, ou sur la ligne ouverte pour la replier. La barre d’outils agit sur la partie ouverte.

## Les emplacements {#the-slots}

Chaque ligne est un **emplacement**, c’est-à-dire un clip du jeu qui peut être remplacé.

- **Musique** liste les **segments** dans l’ordre de lecture. La première ligne d’un segment affiche le nom du segment, et les lignes en dessous sont les autres **couches**.
- Les **sons** sont affichés en **groupes**, avec une ligne par son et les **prises** repliées en dessous. ▶ sur la ligne joue la première prise. Les fichiers déposés sur la ligne remplissent les prises dans l’ordre. Faites un clic droit sur la ligne pour remplir, mettre en silence ou vider toutes les prises d’un coup.
- La moitié gauche d’une ligne est l’original. ▶ le joue, et la durée est affichée à la fin. Dans l’onglet Audio, la moitié droite est le remplacement. ▶ joue le nouvel audio, cliquer sur le nom du fichier en choisit un autre, et ✕ le retire. Un emplacement vide affiche *Déposer de l’audio ou choisir un fichier*.
- La case au début d’une ligne met l’emplacement dans la sélection, ou l’en retire, comme le fait Ctrl+clic. Shift sur une case sélectionne une plage. Une ligne de groupe a une case pour toutes les prises du groupe, et le groupe reste replié. Dans la Bibliothèque, **Exporter** peut enregistrer uniquement les emplacements sélectionnés. Dans l’onglet Audio, avec plusieurs emplacements sélectionnés, le panneau de droite propose **Choisir un seul fichier pour tous**, **Choisir des fichiers**, **Remplacer par du silence** et le bouton qui retire le nouvel audio.
- Double-cliquez sur une ligne pour la lire. Faites un clic droit dessus pour tout le reste, y compris copier, coller, silence et ID.
- Copiez des fichiers audio dans l’Explorateur, sélectionnez des emplacements et appuyez sur **Ctrl+V**. Un seul fichier va dans chaque emplacement sélectionné. Plusieurs fichiers vont dans l’ordre des noms de fichiers, et sur un seul emplacement sélectionné ils remplissent les suivants à partir de là. Ctrl+V colle ce qui a été copié en dernier : des fichiers de l’Explorateur ou des emplacements copiés dans Audiodiver.
- **Ctrl+C** copie les emplacements sélectionnés, dans la Bibliothèque ou dans l’onglet Audio. **Ctrl+V** les colle dans les emplacements sélectionnés de l’onglet Audio, sans rien exporter ni importer. Un emplacement avec du nouvel audio donne cet audio et ses réglages. Tout autre emplacement donne l’original, et un clip de Helldivers 2 entre sans changement.

### Étiquettes d’une ligne {#tags-on-a-row}

| Étiquette | Signification |
|---|---|
| {icon:link} **+3 cues** / **+5 banques** / **+8 autres** | Le jeu joue le même clip dans ce nombre d’autres endroits. |
| {icon:link} **dans 104 autres banques** (sur un groupe) | Chaque son du groupe est une copie partagée, comme les sons de maniement que chaque arme possède. |
| **en boucle**, **×2** | Le segment se répète jusqu’à ce que le jeu passe à la suite, ou se répète ce nombre de fois. |
| une condition, comme *Désert* | Cet emplacement est une **variante** et n’est joué que si la condition est remplie. |
| **jamais entendu** | Les données du jeu listent ce clip, mais rien ne le joue. |
| **ne pas toucher** | Remplacer ce clip rend la musique saccadée. Les remplissages l’ignorent. |
| **pas d’audio** | Les données du jeu nomment ce clip, mais les fichiers du jeu installés ne l’incluent pas. Il n’y a rien à jouer ni à remplacer. |
| **tambours discrets** | Une couche de batterie à peine audible sous une autre couche du segment. |
| **jamais jouée** | Le clip est dans les fichiers du jeu, mais le jeu ne le joue jamais. La musique de mort des Illuministes Void en est un exemple. |
| **ce son uniquement** | Le nouvel audio n’est joué que dans ce son. Les autres sons qui jouent le clip gardent l’Original. Voir [Ce son uniquement](wiki:adding-audio#only-this-sound). |
| **remplacé dans un autre son** | Un autre son joue du nouvel audio à la place de ce clip, avec **Ce son uniquement**. Celui-ci garde l’Original. |
| **−6 dB** | Make-Up Gain sur l’Original, dans un emplacement sans nouvel audio. Voir [Make-Up Gain par emplacement](wiki:volume#make-up-gain-per-slot). |
| une étiquette colorée | Une entrée de l’Index liée à cet emplacement. Cliquez sur l’étiquette pour l’ouvrir. |

Survolez une étiquette pour lire la note. Les notes d’un clip sélectionné apparaissent dans le panneau de détails. Elles décrivent quand le clip est joué, ou donnent un avertissement, comme une durée minimale pour le nouvel audio.

### Marques {#marks}

| Marque | Signification |
|---|---|
| ○ ◐ ● | Original, partiellement remplacé, remplacé. |
| ↝ | Une **transition**, jouée entre deux morceaux de musique. |
| ✦ | Un **stinger**, joué par-dessus la musique. |
| ×3 | L’élément a trois **parties**. |
| **!** | Une transition d’origine est jouée à côté de la nouvelle musique. Voir [Comment le jeu joue la musique](wiki:how-the-game-plays-music). |

## Sous les emplacements {#under-the-slots}

Les **formes d’onde** de l’emplacement sélectionné sont affichées ici. L’original est en haut, et dans l’onglet Audio le remplacement est en dessous, sur les mêmes échelles de temps et de niveau, avec les points **Entrée** et **Sortie** marqués. Les deux sont dessinées à leur [Make-Up Gain](wiki:volume#make-up-gain-per-slot), et le rouge marque l’audio poussé au-delà de la pleine échelle. Cliquez sur une forme d’onde pour lire à partir de ce point, et faites glisser le bord supérieur du panneau pour le redimensionner. {icon:waves} à la fin de la barre d’outils les masque. Dans la Bibliothèque, la ligne au-dessus des formes d’onde décrit l’emplacement. Elle indique l’ID (cliquez pour le copier), la durée, quand l’emplacement est joué, et où le jeu le joue ailleurs. Une ligne autour d’une forme d’onde est la [courbe de volume](wiki:volume#volume-curves) du clip.

Deux curseurs zooment sur les deux formes d’onde. Celui qui longe le côté droit les dessine plus hautes, pour montrer l’audio faible, et celui qui est dessous, à droite, zoome sur le temps, pour placer l’Entrée et la Sortie avec précision. Sur les formes d’onde, la molette de la souris zoome sur le temps, Ctrl+molette les dessine plus hautes, et Shift+molette fait défiler. Quand le zoom temporel est actif, la bande sous les formes d’onde défile aussi. {icon:reset}, dans le coin entre les curseurs, affiche de nouveau tout l’audio à pleine échelle. Pendant qu’un curseur bouge, un nombre de 0 à 100 au-dessus du bouton indique où il en est. Le zoom reste tel quel quand un autre emplacement est sélectionné, et l’outil de découpe a les mêmes curseurs.

## Le panneau de détails {#the-details-panel}

Dans l’onglet Audio, ce panneau contient les réglages de l’emplacement sélectionné. Il montre ce qui remplace l’emplacement, soit un fichier, soit du silence. Un fichier a un bouton qui l’affiche dans l’Explorateur, et le silence a **Conserver la durée d’origine**. En dessous se trouvent **Make-Up Gain** ([expliqué ici](wiki:volume)), **Ajuster le minutage au nouvel audio**, les **points de repère**, **Partagé avec** et les notes. Un emplacement sans nouvel audio a **Utiliser le silence** et le Make-Up Gain de l’Original. Lisez l’audio et choisissez les fichiers sur la ligne de l’emplacement.

Avec plusieurs emplacements sélectionnés, le panneau règle le Make-Up Gain, les points de repère ou le silence pour tous. **Choisir un seul fichier pour tous** met un même fichier dans chaque emplacement sélectionné, et **Choisir des fichiers** met un fichier dans chacun, dans l’ordre de la liste et l’ordre des noms de fichiers.

Sans emplacement sélectionné, le panneau montre les notes de l’élément ouvert et les touches de la liste des emplacements.

Dans la Bibliothèque, le panneau montre le nom et l’ID de l’emplacement sélectionné, ou de l’élément ouvert si aucun emplacement n’est sélectionné, avec la note globale qui s’y rapporte.

## Notes {#notes}

Les emplacements, et les éléments de la liste à gauche, peuvent avoir deux notes. La **Note de projet** est enregistrée dans le fichier du projet, et Annuler annule une modification qui la touche. La **Note globale** est enregistrée dans un fichier de notes sur cet ordinateur et s’affiche dans chaque projet et dans la Bibliothèque. Annuler n’annule pas une note globale, et [Notes globales](wiki:how-audiodiver-works#global-notes) dans les Paramètres indique où se trouve le fichier. Les générations laissent les notes de côté.

Les notes sont en bas du panneau de détails. Sélectionnez un emplacement pour voir ses notes, ou ne sélectionnez rien pour voir les notes de l’élément. La Bibliothèque montre uniquement la note globale. **Ajouter une note de projet** et **Ajouter une note globale** ouvrent l’éditeur. Une recherche dans la liste à gauche trouve aussi des mots dans les notes globales, et marque ce qu’elle a trouvé ainsi avec {icon:note}.

Les notes s’écrivent en Markdown. `#` commence un titre, `-` commence un élément de liste, `**bold**` et `*italic*` marquent des mots, et `[text](https://…)` crée un lien. Les boutons au-dessus de la zone font la même chose pour les mots sélectionnés, et appuyer de nouveau sur un bouton retire la marque. {key:undo} fonctionne dans la zone pendant la saisie. Cliquez ailleurs pour enregistrer la note et l’afficher mise en forme. Cliquez dessus pour la modifier de nouveau. **Supprimer la note de projet** et **Supprimer la note globale** suppriment une note, et demandent d’abord confirmation si elle contient des mots.

Un clip joué à plusieurs endroits a une note de chaque type, affichée à chaque endroit. Quand une mise à jour du jeu donne un nouvel ID à un clip, la note ne s’affiche plus. Elle reste dans le fichier et s’affiche de nouveau si l’ID revient.

## Les barres {#the-bars}

La barre d’onglets contient les onglets principaux. Accueil et Outils viennent en premier. La bande plus sombre qui suit contient les onglets du projet ouvert, de Projet à Texte, et l’onglet Projet affiche l’icône du projet. Générer vient après la bande tant qu’un projet est ouvert, et {icon:updates} Mises à jour, le Wiki et les Paramètres sont à la fin. La barre longe le haut de la fenêtre, et **Barre d’onglets** dans [Paramètres ▸ Thème](app:settings/theme) la place sur un autre côté. Quand les noms des onglets sont affichés, une barre en haut ou en bas montre les noms à côté des icônes, et une barre à gauche ou à droite montre un nom quand le pointeur est sur l’onglet. L’onglet ouvert prend la couleur de la page qu’il ouvre, et dans la bande l’onglet ouvert a un bord dans la couleur principale. Les onglets à l’intérieur d’une page, comme Index et Toutes les Archives, les parties d’un morceau ou les sections des Paramètres, sont soulignés à la place. Un point sur Générer signifie que le projet a besoin d’une nouvelle génération, et un point sur Mises à jour signifie qu’une nouvelle version d’Audiodiver est disponible.

La barre d’état en bas contient annuler et rétablir, le fichier du projet et l’audio en cours de lecture. Cliquez sur l’audio en cours pour revenir à l’endroit où il a été lancé : l’emplacement dans la Bibliothèque ou l’onglet Audio, ou le morceau et le segment dans la Bande-son. **Vol** règle le volume d’écoute, qui n’affecte pas le mod. Le numéro de version ouvre Mises à jour, et le {icon:info} à côté ouvre [À propos](app:about).

### Historique {#history}

L’horloge à côté d’annuler et de rétablir ouvre **Historique**, la liste des modifications faites depuis l’ouverture du projet, la plus ancienne en premier, chacune avec l’heure à laquelle elle a été faite. La modification où en est le projet est marquée. Cliquez sur une modification antérieure pour annuler d’un coup toutes celles qui suivent, ou sur une modification plus bas, en gris, pour rétablir jusqu’à elle. **À l’ouverture** les annule toutes et montre quand le projet a été ouvert. Annuler et rétablir continuent de fonctionner à partir de l’endroit où la liste est arrivée, et la liste garde les 200 dernières modifications.

### Notifications {#notifications}

De courtes confirmations comme *Choix de l’équipement ajouté à Mon mod* ou *Mon mod enregistré* apparaissent brièvement en bas de la fenêtre. Les notifications qui demandent d’être lues, ou qui ont un bouton comme Annuler ou Afficher dans le dossier, apparaissent en bas à droite, ou dans le coin défini sous **Notifications** dans [Paramètres ▸ Système](app:settings/system).

La cloche à l’extrémité droite de la barre d’état liste les notifications affichées jusqu’ici, la plus récente en premier, avec l’heure de chacune, pour en relire une après sa disparition. Une notification qui menait quelque part, comme la proposition des tutoriels ou une notification avec **Afficher dans le dossier**, y mène de nouveau quand on clique dessus dans la liste. La liste garde les 100 dernières, y compris après un redémarrage d’Audiodiver. Elle ne fait que les lister, et n’affiche jamais rien d’elle-même.

## ID {#ids}

Chaque emplacement affiche un **ID de flux** à la fin de la ligne, l’ID sous lequel les autres outils audio le listent. Un emplacement dont l’audio est stocké uniquement dans une banque affiche à la place l’**ID source**. Cliquez sur l’ID pour le copier. Faites un clic droit sur la ligne pour voir tous les ID de l’emplacement :

- l’ID de **flux** sur 64 bits du fichier qui contient l’audio
- l’ID **source** du clip
- le **son** d’une banque qui joue le clip
- le **conteneur** qui contient les prises du son
- la **piste** de musique dont le clip est une couche

Les deux zones de recherche acceptent n’importe lequel.

## ID de conteneur {#container-ids}

Appuyez sur {icon:id} dans la barre d’outils pour lister les sons d’une banque comme les outils Wwise les listent. Chaque son est alors nommé par l’ID du conteneur situé juste au-dessus des prises, avec le type de conteneur avant l’ID (Random, Sequence, Switch, Layer ou Actor-Mixer) et le nom habituel après. Les conteneurs du dessus sont sur des lignes à part, décalées d’un cran de plus à chaque niveau, dans l’ordre de la banque. Les Actor-Mixer qui ne contiennent que le suivant partagent une ligne. Cliquez sur un ID de ces lignes pour le copier. La recherche d’emplacements trouve aussi les ID de conteneur. Cliquez sur la ligne d’un conteneur, ou sur sa case, pour sélectionner tous les emplacements en dessous, par exemple pour régler le Make-Up Gain d’un conteneur entier.

## Export {#exporting}

{icon:export} **Exporter** dans la barre d’outils ouvre le panneau d’export. Le premier onglet enregistre l’élément ouvert, et le second la [liste d’export](#the-export-list). À droite, le panneau liste les dossiers et les fichiers que l’export écrit, avec les noms qu’ils auront, avant que quoi que ce soit soit écrit.

- **Sons** ou **Emplacements** : **Sélectionnés** (cochez d’abord des emplacements dans la liste), **Remplacé** (dans l’onglet Audio) ou **Tout**.
- **Contenu**, pour la musique : **Chaque emplacement**, **Chaque segment** avec les couches mixées, ou **Le morceau entier** joué d’un bout à l’autre. Dans la Bande-son, **Un combat** enregistre un combat tel que le jeu le joue ([Export de musique](wiki:soundtrack#exporting)).
- **Audio**, dans l’onglet Audio et la Bande-son : **Comme le mod le joue** enregistre le nouvel audio là où un emplacement en a, au Make-Up Gain réglé, et l’Original partout ailleurs. **Les deux** ajoute la version remplacée à côté de l’Original partout où le mod change quelque chose, et ces noms se terminent par *(original)* et *(remplacé)*. La Bibliothèque enregistre l’Original.
- **Noms de fichiers** : **Noms complets** commencent par le nom de l’élément, **Noms courts** l’omettent, et **ID source** nomme chaque emplacement par l’ID source, comme les autres outils de modding nomment l’audio du jeu.
- **Format** : WAV, FLAC, MP3, ou WEM pour les emplacements Original. Un WEM est le fichier exactement tel que le jeu l’a, et il va dans un autre emplacement comme nouvel audio sans être encodé de nouveau.

### Un dossier par élément {#a-folder-for-each-item}

Quand **Un dossier par élément** est activé, les fichiers de chaque entrée vont dans un dossier portant son nom. Quand il est désactivé, tous les fichiers vont dans le dossier de destination.

### Amorce et queue {#lead-in-and-ring-out}

Exporter un morceau de musique par segment enregistre un fichier par segment. **Amorce et queue** inclut l’audio avant l’Entrée et après la Sortie de chaque segment, pour que les fichiers se chevauchent comme les segments dans le jeu. Quand l’option est désactivée, les fichiers ne contiennent que l’audio de l’Entrée à la Sortie et se suivent bout à bout. Voir [Minutage et boucles](wiki:timing-and-loops#entry-and-exit).

## La liste d’export {#the-export-list}

Rassemblez des éléments de différents endroits pour les exporter ensemble. Faites un clic droit sur un emplacement, un groupe de prises, une entrée de l’Index, une ligne de catégorie ou de section, ou une archive, et choisissez **Ajouter à la liste d’export**. **Ajouter à la liste d’export** dans le panneau d’export ajoute l’élément ouvert avec les choix faits là. **Liste d’Export** dans la barre d’outils ouvre la liste. Renommez une entrée pour nommer le dossier où elle va, modifiez ce qu’elle enregistre et quel audio, retirez des entrées, et exportez tout en une seule tâche. La liste est conservée jusqu’à ce que vous la vidiez.

## Couleurs {#colours}

- La **couleur principale** (jaune Super-Terre) remplit les boutons principaux et marque l’audio remplacé, les modifications et le projet.
- La **couleur secondaire** (bleu) sert à la navigation et à l’information, comme les liens, l’onglet ouvert, la sélection et l’anneau de focus. Sur le thème clair, elle sert aussi au texte, aux lignes et aux teintes qui seraient sinon dans la couleur principale.
- Le gris neutre marque l’original.

Changez les deux couleurs, le thème, le contraste et le **Mode nuit** dans [Paramètres ▸ Thème](app:settings/theme).
