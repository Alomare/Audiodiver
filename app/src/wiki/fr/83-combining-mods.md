---
title: Combiner des Mods
group: Générer et partager
summary: Faire un seul mod à partir de plusieurs mods audio qui modifient les mêmes banques de sons, en choisissant quelle version de chaque son partagé est retenue.
source: e6f1f4bcf595
---

Un mod contient des copies complètes des banques de sons qu’il modifie. Quand deux mods modifient la même banque, celui qui est déployé en dernier remplace la copie de l’autre, donc un seul des deux est joué. Les mods de musique partagent la plupart de leurs banques, et beaucoup de mods d’armes et de voix aussi. **Combiner des Mods**, dans [Outils](app:tools/combine), lit plusieurs mods et génère un seul mod avec l’audio de tous, sur les banques de sons actuelles.

## Quand l’utiliser {#when-to-use-it}

- Deux mods que vous voulez ensemble modifient les mêmes banques, et seul celui déployé en dernier est joué.
- Plusieurs petits mods sont plus faciles à conserver et à mettre à jour sous forme d’un seul.

## Combiner des Mods {#combining-mods}

1. Ouvrez [Outils ▸ Combiner des Mods](app:tools/combine).
2. Déposez les mods sur la page. Vous pouvez déposer les ZIP téléchargés, les dossiers des mods, ou les fichiers `.patch_0` avec les fichiers `.stream` à côté. **Ajouter des ZIP ou des fichiers patch** et **Ajouter un dossier** font la même chose, et **Mods installés** liste les mods de la bibliothèque d’un gestionnaire de mods et du dossier du jeu.
3. Choisissez les options de chaque mod. Un mod avec des options les liste sous le nom du mod, à partir des choix que le gestionnaire de mods a enregistrés. Une option à plusieurs choix en prend un seul.
4. Mettez les mods dans l’ordre avec ↑ et ↓. Voir [Ordre et conflits](#order-and-conflicts).
5. Appuyez sur **Rechercher les conflits**, et choisissez un mod pour chaque conflit trouvé.
6. Vérifiez le nom, puis appuyez sur **Combiner**.

Après une vérification, modifier la liste, l’ordre ou les options exige une nouvelle vérification avant que **Combiner** fonctionne. Une seconde vérification est rapide, car Audiodiver conserve ce qu’il a lu de chaque mod.

## Ordre et conflits {#order-and-conflicts}

Un conflit est un son que plus d’un mod modifie de façons différentes. Les mods donnent au même clip des audios différents, ou règlent le même paramètre, comme le volume d’un son, à des valeurs différentes. Les mods qui donnent le même audio à un clip n’entrent pas en conflit. Les nouvelles prises et les couches que plusieurs mods ajoutent au même son sont toutes conservées.

Les conflits sont regroupés par leur élément dans l’Index, comme un morceau de musique ou une arme. Chaque ligne joue d’abord l’original, puis la version de chaque mod. Le mod en surbrillance est retenu. **Tout de** sur la ligne d’un élément choisit un seul mod pour tous les conflits de cet élément. Par défaut, le mod le plus bas dans la liste l’emporte, comme s’il était déployé en dernier.

Un réglage sur un son en conflit suit le son, donc le mod dont l’audio est retenu apporte aussi le volume réglé sur ce son. Les points de repère suivent l’audio de la même façon : un segment de musique prend les points de repère du mod dont il joue l’audio. Si deux mods règlent les courbes de volume d’une même piste de musique, ce sont les courbes du mod le plus bas qui sont retenues.

## Dossier de destination {#destination-folder}

Le nouveau ZIP va dans le **Dossier de destination**. L’emplacement par défaut est `Documents\Audiodiver\Combined`, et **Modifier** en choisit un autre. Si un ZIP du même nom s’y trouve déjà, il reste, et le nouveau reçoit un numéro.

Après une mise à jour du jeu, combinez de nouveau les mods. Pour modifier l’audio davantage, créez un projet et importez-y le patch combiné, comme l’explique [Quand le jeu est mis à jour](wiki:game-updates#mods-made-with-older-tools). Un projet ne reprend que l’audio.

## Ce que la combinaison écarte {#what-combining-leaves-out}

- Les modifications qu’Audiodiver ne reprend pas, comme les effets ou la façon dont un conteneur choisit les sons, et les sons qu’un mod a encore d’une ancienne version du jeu. Le résultat les liste pour chaque mod, comme le fait [Repatch](wiki:repatching#what-repatching-leaves-out).
- Un fichier autre que de l’audio, comme une texture ou une table de chaînes, que deux mods ont tous les deux : la copie du mod le plus haut dans la liste est écartée. La copie du mod le plus bas est retenue, comme si ce mod était déployé en dernier, et le résultat le signale.

Tout le reste des patchs, comme le texte, les modèles et les textures, entre tel quel.

## Installer le résultat {#installing-the-result}

Le mod combiné est un nouveau mod avec un nouvel ID. Dans le gestionnaire de mods, désactivez les mods qu’il combine, puis importez le nouveau ZIP et déployez-le. Un mod combiné reste le travail des auteurs d’origine, donc gardez-le pour un usage personnel, et ne le partagez qu’avec leur autorisation.
