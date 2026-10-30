---
title: Sons et voix
group: Créer un mod
summary: Les armes, les ennemis, les voix et tout l’audio qui n’est pas de la musique. Comment la Bibliothèque les montre, et ce qu’il faut vérifier avant d’en remplacer un.
source: 8d3ce8429e30
---

C’est pour la musique qu’Audiodiver a le plus d’informations, mais la Bibliothèque contient tout l’audio du jeu. Cette page couvre tout ce qui n’est pas de la musique.

## Ensembles de sons {#sound-sets}

En dehors de la musique, l’Index liste des **ensembles de sons**. Un ensemble de sons contient les sons d’une arme, d’un stratagème, d’un ennemi, d’une voix ou d’un type de planète, sous le nom que les joueurs voient dans le jeu.

Les sons d’un ensemble sont affichés en groupes. Chaque groupe est un son et les **prises** parmi lesquelles il joue. Le jeu choisit une prise au hasard chaque fois que le son est joué. Pour remplacer complètement un son, donnez du nouvel audio à chaque prise, sinon le jeu mélange encore les originaux. Les fichiers déposés sur la ligne d’un groupe remplissent les prises dans l’ordre. Faites un clic droit sur la ligne pour remplir, mettre en silence ou vider toutes les prises.

La plupart des groupes n’ont que des numéros comme noms, comme *Séquence 1* et *Prise 2* ([pourquoi](wiki:game-audio)), donc écoutez pour les distinguer. ▶ sur la ligne d’un groupe joue la première prise. Dans un grand ensemble, les groupes sont repliés au départ, et **Rechercher des sons** trouve un son par un mot ou un ID. La même page explique les groupes **Autre audio** et **Pas d’audio dans les fichiers du jeu**.

Vous pouvez aussi ajouter de l’audio que le jeu n’a pas, comme des prises supplémentaires pour un son ou une couche jouée avec lui. Voir [Ajouter de l’audio](wiki:adding-audio).

## Armes {#weapons}

Un tir d’arme est composé de plusieurs sons joués en même temps, chacun dans un groupe distinct de l’ensemble. Un tir en joue entre 3 et 15, selon l’arme. La plupart des armes en jouent 6 ou plus, et les lance-flammes en jouent le plus.

Un coup de feu est généralement construit à partir de ces éléments :

| Élément | Description |
|---|---|
| Mécanisme | Les pièces mobiles de l’arme, comme le verrou et la détente. |
| Basses | Le grave sourd du tir. |
| Transitoire | Le bref claquement au début du tir. |
| Queue | L’écho du tir, et le tir tel qu’il s’entend de loin. |

L’ensemble contient aussi les sons de maniement, comme le rechargement et la bande de munitions.

Pour donner un nouveau tir à une arme, remplacez ou mettez en silence chaque groupe que le tir joue. Un groupe laissé d’origine continue d’être joué sous le nouveau son. Les groupes sont numérotés, donc écoutez chacun pour trouver de quelle partie du tir il s’agit. Vous pouvez aussi remplacer un seul élément et garder les autres, par exemple pour mettre des basses plus lourdes sous le tir d’origine.

Certains éléments sont partagés avec d’autres armes, et en remplacer un le modifie sur chaque arme qui l’a.

## Des sons que beaucoup d’éléments partagent {#sounds-that-many-things-share}

Le jeu conserve des copies de certains sons à de nombreux endroits. Par exemple, chaque banque d’arme contient les sons de maniement des armes. Un groupe de ce type affiche **dans 104 autres banques** et vient après les sons que seul cet ensemble possède.

Remplacer un son partagé le modifie partout où il est joué, et les détails listent ces endroits sous **Partagé avec**. Le mod inclut une copie de chaque banque qu’il modifie, donc remplacer un son très répandu alourdit le mod.

## Voix {#voices}

Une voix a une partie pour chaque langue installée, comme *Anglais* et *Italien*, avec des enregistrements distincts pour chacune. Une réplique remplacée dans la partie anglaise n’est entendue que par les joueurs qui jouent en anglais.

Une réplique porte le nom des mots du sous-titre correspondant, et le filtre la trouve grâce à ces mots. Quand plusieurs prises disent la même réplique, le groupe et chaque prise affichent les mots.

Les sons sans paroles portent le nom de ce qu’ils sont, comme *Grognement 1* ou *Halètement 3*, et sont numérotés séparément pour chaque voix. Les grognements sont de courts bruits d’effort. **Halètement** couvre les respirations plus longues, les soupirs et les rires. La plupart de ces sons se trouvent à la fin d’une voix de Helldiver et dans **Bruits d’effort du Helldiver**, dans des groupes appelés **Grognements** et **Halètement**. Chacun de ces clips est partagé par deux voix de Helldiver : les voix 1 et 3, et les voix 2 et 4.

Une réplique avec un sous-titre affiche un lien **Sous-titre** dans les détails. Le lien ouvre la ligne dans l’onglet [Texte](wiki:text) pour en modifier les mots.

## Toutes les Archives {#all-archives}

L’Index ne contient que de l’audio nommé. **Toutes les Archives** contient chaque archive avec de l’audio. Les archives de l’Index affichent un nom et des icônes de catégorie, et les autres affichent *Pas encore nommé*. Triez par **Sons** pour trouver les plus grosses archives, ou par **Langue** pour trouver un pack de voix.

Quand une mise à jour du jeu ajoute de l’audio, cherchez-le dans Toutes les Archives. Il peut être lu, ajouté au projet et remplacé tout de suite.

Les deux listes acceptent des ID aussi bien que des mots. Collez un ID source, un ID de fichier de flux ou un ID de banque pour voir où il se trouve.
