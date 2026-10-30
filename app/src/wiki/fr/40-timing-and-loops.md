---
title: Minutage, points de repère et boucles
group: Créer un mod
summary: Comment le jeu passe d’un segment au suivant, comment faire en sorte que la nouvelle musique s’enchaîne proprement, et comment découper une chanson dans un cue.
source: 7a14e9b897bb
---

## Ajuster le minutage au nouvel audio {#fitting-the-timing-to-the-new-audio}

**Ajuster le minutage au nouvel audio** est activé par défaut pour chaque emplacement remplacé. Le segment prend la durée du nouveau clip, et le point de *Sortie* se déplace à la fin du clip. Le segment suivant démarre quand le clip se termine.

Désactivez l’option seulement quand le clip doit suivre le minutage d’origine, comme un court sting placé à l’intérieur d’un segment plus long.

## Entrée et Sortie {#entry-and-exit}

Les formes d’onde sous les emplacements montrent l’original au-dessus du remplacement, sur la même échelle de temps, avec les points de repère :

- L’**Entrée** est le point où le segment compte comme commencé. L’audio avant l’Entrée est une amorce, jouée sous la fin du segment précédent.
- La **Sortie** est le point où démarre le segment suivant. L’audio après la Sortie se prolonge par-dessus le segment suivant.

Faites glisser la Sortie sur le remplacement pour déplacer le passage de relais. Pour annuler, faites-la glisser de nouveau à la position automatique ou appuyez sur **Réinitialiser les points de repère**. Les détails montrent les mêmes valeurs en millisecondes sous **Points de repère**.

Quand un même fichier est joué dans plusieurs segments, **Appliquer à … autres segments avec ce fichier** sous **Points de repère** donne à tous les points de repère du segment sélectionné. Pour définir des points de repère sur une sélection, sélectionnez les emplacements et saisissez les valeurs dans les détails. Une zone qui affiche **Mixte** laisse chaque segment tel quel jusqu’à ce que vous saisissiez une valeur.

> [!TIP]
> Placez les queues de réverbération et les coups finaux après la Sortie. Ils y chevauchent le segment suivant, ce qui évite un vide.

## Écouter le résultat {#hearing-the-result}

**Lecture enchaînée** joue tout le morceau comme il est joué dans le jeu, avec les segments dans l’ordre et chaque passage de relais à un point de Sortie. Comparez **Original** et **Remplacé** pour repérer les vides, les doubles coups et les sauts de volume avant de générer.

## Boucles {#loops}

Un segment marqué **en boucle** se répète jusqu’à ce que le jeu passe à la suite. Un segment marqué **×2** ou d’un nombre plus élevé se répète ce nombre de fois. Une boucle qui se termine là où elle a commencé est jouée sans raccord. Certains morceaux bouclent plusieurs segments de suite (Choix de l’équipement en joue quatorze), et chacun de ces segments doit se terminer à un endroit où le suivant peut démarrer.

## Découper une longue chanson {#slicing-one-long-song}

{icon:slice} **Découper une chanson** découpe un long fichier en morceaux consécutifs à des positions d’échantillon exactes, si bien que les morceaux sonnent comme la chanson non découpée quand ils sont joués bout à bout. Chaque morceau va dans un segment, dans l’ordre de lecture. Les couches d’un segment sont jouées ensemble, donc tous les morceaux vont dans la couche de l’emplacement **Début**.

La fenêtre montre la chanson et l’original sur une même échelle de temps :

- La piste **Nouvel audio** montre la chanson, les coupes, ainsi que le numéro et l’emplacement de chaque morceau.
- La piste **Original** montre l’audio d’origine de chaque emplacement, à partir de la coupe de ce morceau. Un bord rouge signifie que l’original dépasse la coupe, donc le morceau est plus court que l’original. Une ligne en pointillés marque l’endroit où un original se termine plus tôt, donc le morceau est plus long. Le tableau et la piste montrent la différence.

Pour découper une chanson :

1. Choisissez les emplacements dans **Début** et **Dernier**. Chaque segment entre les deux reçoit un morceau, et **Dernier** liste le nombre de morceaux que cela donne.
2. Placez les coupes. **Proportions d’origine** répartit les durées d’origine sur toute la chanson. **Durées d’origine** coupe exactement aux durées d’origine, donc le dernier morceau peut se terminer avant la chanson. **À parts égales** découpe la chanson en morceaux égaux.
3. Ajustez les coupes. Faites glisser une coupe pour la déplacer, et maintenez Shift pour l’empêcher de s’aimanter à la durée d’origine. Double-cliquez sur la chanson pour ajouter une coupe. Sélectionnez une coupe et appuyez sur Delete pour la retirer, ou décalez-la avec ←/→ (Shift déplace de 100 ms, Alt de 1 ms). La coupe **Début** et la coupe **Fin** peuvent ignorer une intro ou une outro.
4. Écoutez. **Chanson** joue la chanson, et **Originaux** joue l’audio d’origine des emplacements l’un après l’autre. Cliquez sur la chanson ou sur l’original pour lire à partir de ce point, ou appuyez sur ▶ sur un morceau ou sur l’original à côté dans le tableau. Space lance et met en pause.
5. Zoomez avec la molette ou le curseur sous les pistes, et dessinez les pistes plus hautes pour une chanson faible avec Ctrl+molette ou le curseur à droite. Faites défiler avec Shift+molette ou la bande sous les pistes. {icon:reset}, dans le coin, affiche de nouveau toute la chanson. Cliquez sur une ligne du tableau pour amener ce morceau dans la vue.
6. Appuyez sur **Découper et remplir**. Audiodiver enregistre les morceaux dans le dossier `audio\slices` du projet et remplit les emplacements.

Audiodiver conserve les coupes de chaque chanson, donc vous pouvez découper de nouveau la même chanson à partir de là où vous vous étiez arrêté.
