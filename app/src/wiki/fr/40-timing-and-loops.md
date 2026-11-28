---
title: Minutage, points de repère et boucles
group: Créer un mod
summary: Comment le jeu passe d’un segment au suivant, comment faire en sorte que la nouvelle musique s’enchaîne proprement, comment rogner et déplacer le nouvel audio, et comment découper une chanson dans un cue.
source: f516c8a9ac66
---

## Ajuster le minutage au nouvel audio {#fitting-the-timing-to-the-new-audio}

**Ajuster le minutage au nouvel audio** est activé par défaut pour chaque emplacement remplacé. Le segment prend la durée du nouveau clip, et le point de *Sortie* se déplace à la fin du clip. Le segment suivant démarre quand le clip se termine.

Désactivez l’option seulement quand le clip doit suivre le minutage d’origine, comme un court sting placé à l’intérieur d’un segment plus long.

## Entrée et Sortie {#entry-and-exit}

Les formes d’onde sous les emplacements montrent l’original au-dessus du remplacement, sur la même échelle de temps, avec les points de repère :

- L’**Entrée** est le point où le segment compte comme commencé. L’audio avant l’Entrée est une amorce, jouée sous la fin du segment précédent.
- La **Sortie** est le point où démarre le segment suivant. L’audio après la Sortie se prolonge par-dessus le segment suivant.

Faites glisser la Sortie sur le remplacement pour déplacer le passage de relais. Pour annuler, faites-la glisser de nouveau : relâchée près de la position automatique, elle s’y aimante. Les détails montrent les mêmes valeurs en millisecondes sous **Points de repère**.

Quand un même fichier est joué dans plusieurs segments, **Appliquer à … autres segments avec ce fichier** sous **Points de repère** donne à tous les points de repère du segment sélectionné. Pour définir des points de repère sur une sélection, sélectionnez les emplacements et saisissez les valeurs dans les détails. Une zone qui affiche **Mixte** laisse chaque segment tel quel jusqu’à ce que vous saisissiez une valeur.

> [!TIP]
> Placez les queues de réverbération et les coups finaux après la Sortie. Ils y chevauchent le segment suivant, ce qui évite un vide.

## Waveform Suite {#the-waveform-suite}

Le crayon à côté de la forme d’onde de l’original ou de celle du nouvel audio ouvre Waveform Suite pour l’emplacement sélectionné. Le bouton blanc juste avant copie cet audio, pour le coller dans d’autres emplacements ou dans Waveform Suite. Dans la [Bande-son](app:soundtrack), **Modifier la chanson** et le crayon d’une chanson de playlist ouvrent une chanson de la même façon. L’outil rogne, coupe, déplace l’audio et y ajoute des fondus, si bien que les modifications simples ne demandent aucun autre programme. Cela marche sur tous les emplacements : musique, sons et répliques.

L’audio est posé sur une ligne de temps sous forme de **blocs**. Chaque bloc est un passage d’un fichier, placé à un moment choisi, avec un fondu d’entrée, un fondu de sortie, un gain et une courbe de volume. L’original court tout en haut pour comparer, et une ligne pointillée marque l’endroit où il se termine. Les outils sont dans une barre au-dessus de la ligne de temps, et en pointer un montre ce qu’il fait et sa touche. Chaque outil a une touche, et [Paramètres ▸ Raccourcis](app:settings/shortcuts) les liste sous **Waveform Suite**, pour les changer. Le temps du curseur s’affiche à droite, au-dessus des formes d’onde.

- Faites glisser le corps d’un bloc pour le déplacer. Faites glisser le bord gauche ou droit pour le rogner. Faites glisser les petits carrés du bord supérieur pour un fondu d’entrée ou de sortie.
- Cliquez sur la ligne de temps pour placer le curseur. Pour le déplacer, faites glisser le curseur lui-même, ou le long de la règle en haut.
- Faites glisser depuis un endroit vide pour tracer un cadre : chaque bloc qu’il touche est sélectionné, sur n’importe quelle couche. Shift ou Ctrl avec un clic ajoute un bloc à la sélection ou l’en retire, et {key:suiteSelectAll} sélectionne tous les blocs. Les blocs sélectionnés se déplacent, se coupent, se dupliquent, se normalisent et se suppriment ensemble, et les valeurs à côté de la ligne de temps règlent les fondus et le gain de tous.
- **Couper** ({key:suiteSplit}) coupe les blocs sélectionnés au curseur, ou le bloc sous le curseur, et chaque partie reçoit ses propres fondus. **Normaliser** ({key:suiteNormalize}) règle le gain pour que le moment le plus fort de chaque bloc atteigne −1 dB. **Dupliquer** ({key:suiteDuplicate}) place des copies juste après les blocs, et **Retirer** ({key:suiteRemove}) les enlève.
- **Fusionner** ({key:suiteMerge}) fait un seul bloc des blocs sélectionnés, tels qu’ils sont lus : les vides entre eux deviennent du silence, et les blocs qui se chevauchent sont lus ensemble. Le nouveau bloc lit un fichier enregistré dans le dossier `audio\edited` du projet, et Annuler ramène les blocs. Le fichier est supprimé si la Suite se ferme sans l’appliquer.
- **Accoler à gauche** ({key:suiteSnapLeft}) et **Accoler à droite** ({key:suiteSnapRight}) déplacent les blocs sélectionnés jusqu’à toucher le bloc d’avant ou d’après sur leur couche. **Placer au début** ({key:suiteToStart}) les place au début, et **Placer à la fin** ({key:suiteToEnd}) les place pour qu’ils finissent là où finit l’original (sans original, après les autres blocs). **Combler les vides** ({key:suiteCloseGaps}) ramène les blocs de la couche les uns contre les autres, depuis le premier, et avec des blocs sélectionnés, il agit sur leurs couches.
- **Aimant** ({key:suiteMagnet}) aimante le curseur, les bords et les blocs entre eux, au début et à l’endroit où l’original se termine.
- **Courbes de volume** ({key:suiteCurves}) affiche une ligne sur chaque bloc : plein niveau en haut du bloc, silence en bas. Cliquez sur la ligne pour ajouter un point, et faites glisser un point pour façonner le volume dans le temps. Un double-clic sur un point, ou Alt et un clic, le retire. Pendant qu’un point est déplacé, le niveau s’affiche à côté en dB. Les points restent avec l’audio quand un bloc est rogné ou coupé, et **Aplatir la courbe** à côté de la ligne de temps les retire tous.
- **Ajouter de l’audio** ({key:suiteAdd}) place des fichiers audio sur la ligne de temps comme nouveaux blocs, l’un après l’autre à partir du curseur. Déposer des fichiers sur l’éditeur fait de même, et {key:suitePaste} colle les emplacements copiés avec Ctrl+C dans la liste (leur nouvel audio tel qu’il joue, ou l’original) ou des fichiers audio copiés dans l’Explorateur. Un emplacement peut ainsi être fait de plusieurs fichiers, et un emplacement sans nouvel audio peut partir de fichiers ou de l’original.
- À côté de la ligne de temps, saisissez des valeurs exactes pour le bloc sélectionné, en millisecondes. Le bloc change pendant la saisie, Entrée fixe la valeur, et Échap la reprend. Faites glisser le nom d’une valeur vers la gauche ou la droite pour la changer : Shift pour de plus grands pas, Ctrl pour des pas plus fins. ↑ et ↓ la changent aussi par pas.
- **Tempo** lit un bloc plus vite ou plus lentement, de 50 % à 200 %, et **Hauteur** le rend plus aigu ou plus grave, jusqu’à 12 demi-tons dans chaque sens. Avec le lien entre les deux activé, l’un fait bouger l’autre, comme une bande lue plus vite. Sans lui, chacun change seul : le tempo garde la hauteur, et la hauteur garde le tempo.
- **Lire** ({key:suitePlay}) lit à partir du curseur, et **Boucle** ({key:suiteLoop}) lit les blocs sélectionnés en boucle. Un double-clic sur la ligne de temps lance la lecture à partir de là. Les pistes qui jouent sont teintées de leur couleur.
- {key:suiteUndo} et {key:suiteRedo} annulent et rétablissent dans l’éditeur. **Réinitialiser** ({key:suiteReset}) revient au fichier entier, tel quel.
- Zoomez avec la molette, Ctrl+molette et les curseurs, comme dans les formes d’onde sous les emplacements. À côté du zoom temporel, {icon:fitsel} montre les blocs sélectionnés sur toute la largeur, et {icon:fitlayer} montre la couche du début à la fin de son dernier bloc. L’éditeur garde le zoom de chaque emplacement pour sa prochaine ouverture.

### Couches {#layers}

Les blocs sont posés sur des **couches**, l’une sous l’autre. Les couches séparent les blocs pour que chacun soit facile à voir et à atteindre. Toutes les couches jouent ensemble, et un bloc sonne de la même façon sur n’importe quelle couche.

- **Nouvelle couche**, sous la ligne de temps, ajoute une couche. Cliquez sur le nom d’une couche pour la renommer ; Appliquer garde les noms avec l’emplacement. Le nouvel audio d’Ajouter de l’audio, d’un dépôt ou de Ctrl+V va sur la dernière couche cliquée, affichée en jaune.
- Faites glisser un bloc vers le haut ou le bas pour le mettre sur une autre couche.
- Faites glisser les points avant le nom d’une couche pour réordonner les couches, et faites glisser le bord inférieur du nom d’une couche pour la rendre plus haute ou plus basse. Un double-clic sur ce bord la rétablit.
- La corbeille supprime une couche. Une couche qui contient des blocs demande d’abord, et Annuler rétablit les blocs.
- La case avant chaque piste, celle de l’original aussi, choisit ce que **Lire** joue et ce qu’**Exporter** écrit. Cochez l’original pour l’entendre avec le nouvel audio, ou décochez toutes les couches pour l’entendre seul. **Appliquer** garde toutes les couches, cochées ou non.

Les blocs d’une même couche peuvent aussi se chevaucher, et ils jouent ensemble. Les blocs qui se chevauchent sont dessinés en transparence, chacun d’une autre couleur, pour que les deux restent visibles. Un clic choisit le bloc le plus court sous le pointeur, et un autre clic au même endroit choisit le suivant, si bien qu’un bloc sous un bloc plus long peut toujours être sélectionné.

### Musique : points de repère, contexte et segments entiers {#music-cue-points-context-and-whole-segments}

Sur un emplacement d’un segment de musique, l’**Entrée** et la **Sortie** du segment se dressent sur la ligne de temps comme des lignes avec des drapeaux sur la règle, et leurs temps s’affichent au-dessus des formes d’onde. Faites glisser un drapeau pour déplacer le point de repère. Il s’aimante aux bords des blocs quand l’aimant est activé, et relâché près de la position automatique il y revient. La piste de l’original montre où le jeu les place. **Appliquer** fixe les points de repère avec les blocs.

**Lire en contexte** ({key:suiteContext}) lit la fin du segment précédent, ce segment tel que vous l’avez dans l’éditeur et le début du segment suivant, enchaînés aux points de repère comme le jeu les joue. Rien n’a besoin d’être appliqué d’abord.

**Exporter**, à côté d’Appliquer, mixe les pistes cochées en un seul fichier audio : WAV, FLAC, MP3 ou Ogg Vorbis, à 48 ou 44,1 kHz, avec les canaux de l’audio, en stéréo ou en mono, et ramené à −1 dB au moment le plus fort si vous le souhaitez. Le projet ne change pas.

Rien ne change avant **Appliquer**. Les fichiers restent tels quels : le projet garde les blocs, et les générations et les aperçus jouent ce que montre l’éditeur. Modifier l’original donne à l’emplacement l’original modifié comme nouvel audio, comme le fait la copie d’un emplacement. Le Make-Up Gain s’applique par-dessus le résultat, et choisir un autre fichier pour l’emplacement le fait repartir sans modification.

## Écouter le résultat {#hearing-the-result}

**Lecture enchaînée** joue tout le morceau comme il est joué dans le jeu, avec les segments dans l’ordre et chaque passage de relais à un point de Sortie. Là où le jeu choisit des segments au hasard, chaque lecture enchaînée les choisit à nouveau. Comparez **Original** et **Remplacé** pour repérer les vides, les doubles coups et les sauts de volume avant de générer.

## Boucles {#loops}

Un segment marqué **en boucle** se répète jusqu’à ce que le jeu passe à la suite. Un segment marqué **×2** ou d’un nombre plus élevé se répète ce nombre de fois. Une boucle qui se termine là où elle a commencé est jouée sans raccord. Certains morceaux bouclent plusieurs segments de suite (Choix de l’équipement en joue quatorze), et chacun de ces segments doit se terminer à un endroit où le suivant peut démarrer.

## Découper une longue chanson {#slicing-one-long-song}

{icon:slice} **Découper une chanson** découpe un long fichier en morceaux consécutifs à des positions d’échantillon exactes, si bien que les morceaux sonnent comme la chanson non découpée quand ils sont joués bout à bout. Chaque morceau va dans un segment, dans l’ordre de lecture. Les couches d’un segment sont jouées ensemble, donc tous les morceaux vont dans la couche de l’emplacement **Début**. Dans une musique dont les couches changent avec l’intensité, comme la musique d’Extraction, chaque morceau va dans cette couche à intensité faible et forte, et les autres couches sans nouvel audio reçoivent du silence, pour que la chanson joue seule.

Un cue d’un seul emplacement, comme une transition, reçoit un seul morceau : placez **Début** et **Fin** sur le passage de la chanson qu’il doit jouer. Un son reçoit lui aussi un seul morceau : sélectionnez un emplacement du son, et **Découper une chanson** découpe un passage de la chanson pour cet emplacement. **Durées d’origine** donne au passage la durée de l’original.

La fenêtre montre la chanson et l’original sur une même échelle de temps :

- La piste **Nouvel audio** montre la chanson, les coupes, ainsi que le numéro et l’emplacement de chaque morceau.
- La piste **Original** montre l’audio d’origine de chaque emplacement, à partir de la coupe de ce morceau. Un bord rouge signifie que l’original dépasse la coupe, donc le morceau est plus court que l’original. Une ligne en pointillés marque l’endroit où un original se termine plus tôt, donc le morceau est plus long. Le tableau et la piste montrent la différence.

Pour découper une chanson :

1. Choisissez les emplacements dans **Début** et **Dernier**. Chaque segment entre les deux reçoit un morceau, et **Dernier** liste le nombre de morceaux que cela donne.
2. Placez les coupes. **Proportions d’origine** répartit les durées d’origine sur toute la chanson. **Durées d’origine** coupe exactement aux durées d’origine, donc le dernier morceau peut se terminer avant la chanson. **À parts égales** découpe la chanson en morceaux égaux.
3. Ajustez les coupes. Faites glisser une coupe pour la déplacer, et maintenez Shift pour l’empêcher de s’aimanter à la durée d’origine. Double-cliquez sur la chanson pour ajouter une coupe. Sélectionnez une coupe et appuyez sur Delete pour la retirer, ou décalez-la avec ←/→ (Shift déplace de 100 ms, Alt de 1 ms). La coupe **Début** et la coupe **Fin** peuvent ignorer une intro ou une outro. Le tableau affiche chaque temps à la milliseconde près, et **Coupe (ms)**, au-dessus du morceau, accepte un temps exact pour la coupe sélectionnée.
4. Écoutez. **Chanson** joue la chanson, et **Originaux** joue l’audio d’origine des emplacements l’un après l’autre. Cliquez sur la chanson ou sur l’original pour lire à partir de ce point, ou appuyez sur ▶ sur un morceau ou sur l’original à côté dans le tableau. Space lance et met en pause.
5. Zoomez avec la molette ou le curseur sous les pistes, et dessinez les pistes plus hautes pour une chanson faible avec Ctrl+molette ou le curseur à droite. Faites défiler avec Shift+molette ou la bande sous les pistes. {icon:reset}, dans le coin, affiche de nouveau toute la chanson. Cliquez sur une ligne du tableau pour amener ce morceau dans la vue.
6. Appuyez sur **Découper et remplir**. Audiodiver enregistre les morceaux dans le dossier `audio\slices` du projet et remplit les emplacements.

La fenêtre a deux onglets. **Découpeur** découpe la chanson, comme ci-dessus. **Waveform Suite** modifie d’abord la chanson, avec tous les outils de [Waveform Suite](#the-waveform-suite) : rognez-la, retirez-en un passage, déplacez des blocs ou ajoutez-leur des fondus, ou ajoutez un autre audio. Des lignes pointillées sur la ligne de temps montrent les coupes, numérotées par morceau, et elles suivent l’audio sur lequel elles tombent. De retour dans **Découpeur**, les coupes suivent les modifications :

- Les coupes placées à la main restent sur le même moment de la musique. Une coupe dans un passage retiré va au bord le plus proche de ce qui reste, et un morceau sans audio restant se fond dans le suivant.
- **Proportions d’origine**, **Durées d’origine** et **À parts égales** replacent les coupes sur la chanson modifiée.
- Une coupe au début ou à la fin de la chanson reste au début ou à la fin.

**Modifiée** à côté du nom de la chanson veut dire que le découpeur coupe la chanson telle que modifiée. **Découper et remplir** enregistre la chanson modifiée comme nouveau fichier dans le dossier `audio\edited`, puis la découpe. La chanson choisie reste telle quelle.

Audiodiver conserve les coupes de chaque chanson, donc vous pouvez découper de nouveau la même chanson à partir de là où vous vous étiez arrêté.
