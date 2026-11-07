---
title: Texte et sous-titres
group: Créer un mod
summary: Modifier les sous-titres et toute autre ligne du texte du jeu dans l’onglet Texte, y compris les mots, les couleurs et les tailles, et ce qu’il faut laisser intact.
source: 9c5e38424ff4
---

L’onglet [Texte](app:text) contient chaque ligne du texte du jeu dans toutes les langues, y compris les sous-titres des répliques, les textes de mission et de menu, et les noms. Recherchez une ligne pour la modifier, et le mod inclut la modification.

## Trouver une ligne {#finding-a-line}

Choisissez d’abord la **langue**. Chaque langue est une table séparée : un changement en *English (US)* ne change ni *English (UK)* ni *French*. Chaque ligne est rangée dans une catégorie : les sous-titres selon la voix qui les dit, les autres lignes selon leur usage et leur forme. Ouvrez une catégorie, cherchez un mot de la ligne ou collez l’ID de la ligne. **Modifiées** liste les lignes que le projet change.

Le panneau de droite montre l’**Original**, la zone **Nouveau texte** en dessous et un **Aperçu** de la ligne telle qu’elle s’affiche en jeu. Choisissez une seconde langue au-dessus de la liste pour lire aussi la ligne dans cette langue.

## Modifier une ligne {#changing-a-line}

Saisissez dans **Nouveau texte**. La modification est enregistrée peu après que vous avez cessé de taper, ou immédiatement avec {key:save}, et chaque enregistrement compte pour une étape de {key:undo}. **Restaurer original** remet la ligne d’origine.

Pour mettre en forme une partie d’une ligne, sélectionnez les mots et utilisez la barre au-dessus de la zone. Elle contient **Couleur**, **Taille** et **Mise en valeur**, ainsi que **Minutage** pour les sous-titres. Quand rien n’est sélectionné, un bouton met en forme toute la ligne. **Effacer la mise en forme** retire toutes les couleurs, tailles et styles.

[Mise en forme du texte](wiki:formatting-text) décrit chaque format, avec des exemples à copier.

## Ce qu’il faut conserver {#what-to-keep}

- **Le minutage des sous-titres.** Un sous-titre commence par des marques de minutage comme `{0.00->3.85}`, qui définissent quand les mots apparaissent et disparaissent, en secondes depuis le début de la réplique. Une longue ligne a plusieurs marques. Conservez-les, et changez les temps si le nouvel audio a une durée différente. **Minutage** ajoute une marque au curseur.
- **Les mots que le jeu renseigne.** Les mots en majuscules après `#`, comme `#COUNT` ou `#NAME`, sont remplacés dans le jeu quand la ligne s’affiche. L’éditeur avertit si l’un d’eux disparaît.
- **Les couleurs que le jeu renseigne**, comme `<c=#PLAYER_COLOR>`. Laissez-les inchangées.
- **Les crochets** dans les sous-titres, comme *[Grunts]*, marquent des sons qui ne sont pas des mots.

## Rechercher et remplacer {#find-and-replace}

**Rechercher et remplacer** change des mots dans de nombreuses lignes d’un coup. Choisissez les lignes, saisissez les mots et voyez chaque changement avant de l’appliquer. Le minutage, les couleurs, les tailles et les mots remplis par le jeu ne changent pas, et le tout compte pour une seule étape de {key:undo}. La recherche trouve aussi des parties de mots, sauf si **Mots entiers uniquement** est activé : vérifiez donc la liste avant d’appliquer.

## Exporter et importer {#exporting-and-importing}

**Exporter** enregistre des lignes dans un fichier CSV ou JSON : les lignes sélectionnées, changées, affichées ou une catégorie. Une seconde langue ajoute une colonne. Cochez une ligne pour la sélectionner, et utilisez Maj+clic pour en sélectionner une suite. **Restaurer original** fonctionne aussi sur les lignes sélectionnées.

Remplissez la colonne **New text** dans un tableur, sans changer les colonnes **Language** et **ID**. **Importer** lit le fichier et montre ce qui change avant de l’appliquer, en une seule étape de {key:undo}. Une ligne sans nouveau texte reste telle quelle, et celles qui ont perdu leur minutage ou des mots remplis par le jeu restent de côté, sauf si vous décochez cette option.

## Comment le texte est construit {#how-text-is-built}

Un mod contient des tables de texte entières. Une génération prend chaque table du jeu installé et y place les lignes du projet. Cela a deux conséquences :

> [!WARNING]
> **N’utilisez qu’un seul mod de texte par table et par langue.** Si deux mods modifient des lignes de la même table, leurs modifications ne se combinent pas. Le mod que le gestionnaire de mods déploie en dernier remplace l’autre copie de la table.

> [!NOTE]
> **Générez de nouveau après une mise à jour du jeu.** Un mod généré contient la table telle qu’elle était au moment de la génération, donc les lignes que le jeu ajoute ou réécrit ensuite sont masquées derrière elle. Une nouvelle génération prend la nouvelle table et y remet les lignes du projet. Si le jeu a réécrit une ligne que le projet modifie, l’onglet Texte affiche un avertissement.

## Sous-titres des répliques {#subtitles-of-voice-lines}

Les fichiers du jeu ne relient pas les répliques aux sous-titres. Audiodiver les a associés d’après ce que dit chaque ligne et sa durée. Sélectionnez une réplique et cliquez sur le lien **Sous-titre** pour ouvrir le sous-titre ici.

Plusieurs sous-titres ont souvent les mêmes mots. Par exemple, le jeu a 32 sous-titres qui disent *Reloading.* Pour beaucoup d’entre eux, la durée de l’enregistrement ne suffit pas à les distinguer. Une ligne de ce type est marquée **un parmi plusieurs**. L’onglet Texte liste chaque sous-titre contenant ces mots et ouvre le plus probable. Modifiez-les tous pour être sûr que les nouveaux mots apparaissent.
