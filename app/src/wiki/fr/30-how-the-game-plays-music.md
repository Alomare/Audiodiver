---
title: Comment le jeu joue la musique
group: Créer un mod
summary: Segments, boucles, couches, variantes, transitions et stingers, et ce que chacun signifie pour un remplacement.
source: bb8ea673087e
---

Helldivers 2 ne joue pas les chansons du début à la fin. Il joue la musique par morceaux et décide à chaque instant de ce qui vient ensuite. Savoir comment fonctionnent ces morceaux permet de découper la nouvelle musique pour qu’elle s’y adapte.

## Segments et emplacements {#segments-and-slots}

Un morceau de musique est une chaîne de **segments**, et chaque segment contient un ou plusieurs **emplacements** (clips). Quand un segment atteint le point de **Sortie**, le segment suivant démarre et la fin du premier se prolonge par-dessus.

Par exemple, l’écran du lieu de largage joue une fois un segment de départ, puis quatorze boucles dans l’ordre. Il répète les boucles jusqu’à la fermeture de l’écran. L’endroit où un morceau démarre dépend de ce qui a été joué avant. L’écran d’équipement qui vient ensuite saute le segment de départ et poursuit les boucles là où la musique du lieu de largage s’est arrêtée. La [Bande-son](wiki:soundtrack) montre l’ordre de chaque morceau et peut le modifier.

## Couches {#layers}

Certains segments jouent plusieurs emplacements en même temps, sous forme de couches nommées *Stem 1*, *Stem 2* et ainsi de suite. La musique de la passerelle du vaisseau a trois couches. Une couche qui n’est pas remplacée continue de jouer l’original sous le nouvel audio. Remplacez chaque couche que vous ne voulez pas entendre.

## Variantes {#variants}

Un emplacement avec une condition, comme un biome, n’est joué que lorsque cette condition est remplie. La ligne montre la condition. Pour modifier un morceau qui a des variantes, donnez du nouvel audio à chaque variante.

## Transitions et stingers {#transitions-and-stingers}

Les **transitions** (↝) sont jouées entre deux morceaux de musique, par exemple de la musique du vaisseau au Hellpod. Une transition joue l’original tant qu’elle n’est pas remplacée, donc une transition d’origine peut se retrouver entre deux morceaux de nouvelle musique. L’onglet Audio le signale au-dessus de la liste et marque ces transitions avec **!**. **Sauter** les ajoute au projet et les remplace par du silence, pour que le jeu enchaîne directement.

Les **stingers** (✦) sont joués par-dessus la musique à certains moments, comme la fanfare quand on accomplit un objectif principal.

## Silence {#silence}

N’importe quel emplacement peut jouer du silence à la place de l’original, sans fichier. Faites un clic droit sur l’emplacement et choisissez **Remplacer par du silence**, ou sélectionnez-le et appuyez sur **Utiliser le silence** dans les détails. **Conserver la durée d’origine** dans les détails définit l’effet du silence sur le minutage :

- Activée, ce qui est le choix par défaut, l’emplacement reste silencieux aussi longtemps que l’original serait joué, donc le minutage ne change pas. Utilisez-la pour couper une couche d’un morceau, ou pour garder une pause de l’original.
- Désactivée, le jeu passe tout de suite au segment suivant. **Sauter** met ainsi en silence les transitions et les stingers.

✕ sur la ligne retire le silence.

## Audio partagé {#shared-audio}

Le jeu réutilise certains clips à plusieurs endroits, et remplacer un clip partagé le modifie partout. Un emplacement avec un clip partagé affiche **+N cues**, et les détails listent les autres endroits sous **Partagé avec**.

Ne touchez pas aux emplacements marqués **jamais entendu** ou **ne pas toucher**. [Comprendre l’écran](wiki:reading-the-screen) explique ces étiquettes.
