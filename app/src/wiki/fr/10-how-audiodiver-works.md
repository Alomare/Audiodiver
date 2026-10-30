---
title: Comment fonctionne Audiodiver
group: Pour commencer
summary: Ce que fait Audiodiver, ce qu’est un projet et à quoi sert chaque onglet.
source: e97884655776
---

Audiodiver remplace l’audio de Helldivers 2 selon **ce qu’il est et l’endroit où il est joué**. Trouvez un morceau de musique ou un ensemble de sons dans la Bibliothèque, ajoutez-le à un projet et donnez-lui du nouvel audio. Audiodiver détermine ensuite les banques de sons, les ID et les valeurs de minutage dont le jeu a besoin.

[L’audio du jeu, expliqué](wiki:game-audio) décrit les archives, les banques, les prises, les cues, les segments et les emplacements. [Comprendre l’écran](wiki:reading-the-screen) décrit chaque partie de la fenêtre.

## Projets {#projects}

Un projet est un dossier portant le nom du projet, avec un fichier `.audi` à l’intérieur. Le fichier enregistre ce que le mod modifie, quels fichiers remplacent quels clips, ainsi que le Make-Up Gain et le minutage. Les fichiers audio sont dans ce dossier, ou bien le projet conserve leurs chemins. [Dossiers de projet](wiki:project-folders) décrit son contenu.

Les modifications sont enregistrées automatiquement, au fur et à mesure ou toutes les quelques minutes ([Enregistrement automatique](wiki:how-audiodiver-works#autosave)). {key:save} enregistre à tout moment, et {key:undo} annule la dernière modification.

Audiodiver n’écrit jamais dans le dossier du jeu. Il lit l’audio du jeu dans la bibliothèque Steam, ou dans un autre dossier choisi sous **Jeu** dans [Paramètres](app:settings/system). Une génération produit un ZIP qu’un gestionnaire de mods importe et installe.

## Les onglets {#the-tabs}

La barre d’onglets, en haut de la fenêtre, contient les onglets principaux. Accueil et Outils viennent en premier. La bande plus sombre qui suit contient les onglets du projet ouvert, dans l’ordre où l’on fabrique un mod, en commençant par Projet, qui affiche l’icône du projet. Générer vient après la bande et s’affiche tant qu’un projet est ouvert. Survolez un onglet pour voir ce qu’il contient et son raccourci. **Barre d’onglets** dans [Paramètres ▸ Thème](app:settings/theme) déplace la barre sur un autre côté de la fenêtre et affiche ou masque les noms des onglets.

- {icon:home} **Accueil** permet de commencer un nouveau projet ou d’en ouvrir un, et mène à Repatch et à Combiner.
- {icon:tools} **Outils** travaille sur des mods existants, sans projet. [Repatch](wiki:repatching) reconstruit un mod pour la version actuelle du jeu, et [Combiner des Mods](wiki:combining-mods) fait un seul mod à partir de plusieurs. Les deux produisent un nouveau ZIP.
- {icon:project} **Projet** contient le nom, la description, l’icône et l’ID du mod, les onglets que le projet affiche et le dossier du projet, avec **Importer des patchs** et **Fermer le projet** au-dessus de l’icône. Sans projet ouvert, il liste les projets récents. L’onglet affiche l’icône et le nom du projet.
- {icon:library} **Bibliothèque** liste tout ce que le jeu joue, pour le trouver et l’écouter. Parcourir ne change rien. **Ajouter au projet** place une entrée dans le projet. **Index** classe l’audio qui a un nom, et **Toutes les Archives** liste chaque archive qui contient de l’audio.
- {icon:audio} **Audio** affiche les emplacements de ce sur quoi le projet travaille. C’est ici que les emplacements reçoivent du nouvel audio.
- {icon:soundtrack} **Bande-son** règle la façon dont chaque morceau de musique est joué : dans l’ordre d’origine, comme une seule chanson, comme une playlist, ou en silence. Voir [Bande-son](wiki:soundtrack).
- {icon:text} **Texte** contient tout le texte du jeu dans toutes les langues, sous-titres compris. Voir [Texte et sous-titres](wiki:text).
- {icon:build} **Générer** contient la version suivante, les Options de génération et le bouton de génération. Un point sur l’onglet signifie que le projet n’est pas encore généré, ou qu’il a changé ou que le jeu a été mis à jour depuis la dernière génération. Un nombre rouge compte les problèmes qui bloquent une génération.
- {icon:updates} **Mises à jour**, {icon:wiki} **Wiki** ({key:wiki}) et {icon:settings} **Paramètres** sont à la fin de la barre d’onglets. Mises à jour est mis en évidence quand une nouvelle version d’Audiodiver est disponible, et liste les changements de chaque version. Sur une page du Wiki, {key:search} cherche des mots dans cette page.

Le bouton {icon:detach} à côté de la zone de recherche des guides déplace le Wiki dans une fenêtre séparée, pour le lire à côté d’un projet. L’onglet Wiki affiche alors **Rattacher le Wiki**, et fermer la fenêtre a le même effet. Tant que le Wiki est dans cette fenêtre, un **?** ou un lien vers une page s’y ouvre. Lancer un tutoriel rattache d’abord le Wiki.

Le numéro de version à l’extrémité droite de la barre d’état ouvre aussi Mises à jour. Le bouton {icon:info} à côté ouvre [À propos](app:about), avec la licence, le fichier journal et les crédits.

Le titre de la fenêtre est le nom du projet ouvert.

La Bibliothèque et l’onglet Audio partagent la même disposition, et les deux ont {icon:export} **Exporter**. Trouvez quelque chose dans la Bibliothèque et travaillez dessus dans l’onglet Audio.

## Onglets {#tabs}

Audio, Bande-son et Texte peuvent être masqués. Décochez-les sous **Onglets** dans [Paramètres ▸ Système](app:settings/system), par exemple pour ne garder que Texte pour un mod qui modifie des sous-titres. Un nouveau projet démarre avec les onglets que les Paramètres affichent. Chaque projet peut ensuite choisir d’autres onglets sous **Onglets** dans l’onglet [Projet](app:project) et conserve ce choix. Masquer un onglet ne retire rien, et ce qui a été modifié dans cet onglet reste dans le mod.

## Nouvelles versions d’Audiodiver {#new-versions-of-audiodiver}

Audiodiver recherche une nouvelle version sur GitHub à chaque démarrage. [Paramètres ▸ Système](app:settings/system) définit ce qui se passe quand il y en a une :

- **Demander au démarrage** (le choix par défaut) demande d’abord, avec **Mettre à jour maintenant**, **Lire les notes de version** et **Pas maintenant**.
- **Manuel** ne demande rien. L’onglet Mises à jour et la version dans la barre d’état sont mis en évidence, et **Mettre à jour maintenant** se trouve dans l’onglet Mises à jour.
- **Automatique** installe la nouvelle version au démarrage et redémarre Audiodiver.

Une mise à jour remplace uniquement l’application. Les projets, les fichiers audio et les paramètres sont conservés.

## Paramètres {#settings}

### Langue {#language}

**Langue** dans [Paramètres ▸ Système](app:settings/system) définit la langue de la fenêtre et des messages qu’Audiodiver affiche. **Automatique** prend la langue réglée pour Helldivers 2 dans Steam. Quand Audiodiver n’a pas de traduction pour cette langue, Automatique prend la langue de Windows, et sinon l’anglais. Après un changement, la fenêtre se recharge dans la nouvelle langue, sur le même onglet. Les sous-titres et les répliques du jeu restent tels quels, et l’onglet Texte permet toujours de choisir quelle langue du texte du jeu modifier.

### Dossier du jeu {#game-folder}

**Jeu** dans [Paramètres ▸ Système](app:settings/system) affiche le dossier où Audiodiver lit le jeu. Audiodiver le trouve via Steam. Si le jeu est ailleurs, appuyez sur **Choisir un autre dossier** et choisissez le dossier d’installation de Helldivers 2, ou le dossier `data` qu’il contient. Audiodiver relit ensuite le jeu, ce qui prend environ une minute la première fois. Il lit uniquement dans ce dossier et n’y écrit jamais.

### Démarrage {#startup}

Quand **Ouvrir le dernier projet au démarrage d’Audiodiver** est activé, Audiodiver ouvre le dernier projet sur l’onglet Audio. Quand il est désactivé, Audiodiver démarre sur Accueil.

### Accueil {#home}

Quand **Afficher le bandeau d’actualités** est désactivé, Accueil n’affiche pas la bande d’actualités de la guerre en bas, et ces actualités ne sont pas chargées.

### Enregistrement automatique {#autosave}

**Enregistrement automatique** définit quand les modifications sont écrites dans le fichier du projet. **À chaque modification**, le choix par défaut, enregistre chaque modification au moment où elle est faite. **À intervalle régulier** enregistre toutes les 1 à 30 minutes à la place, et d’ici là la barre d’état affiche *Modifications non enregistrées*. Une génération, la fermeture du projet et la fermeture d’Audiodiver enregistrent d’abord les modifications. {key:save} enregistre à tout moment.

### Notifications {#notifications}

**Coin** sous **Notifications** dans [Paramètres ▸ Système](app:settings/system) définit le coin de la fenêtre où les notifications apparaissent. **En bas à droite** est le choix par défaut.

### Notes globales {#global-notes}

**Notes globales** dans [Paramètres ▸ Système](app:settings/system) affiche le fichier de notes, qui se trouve au départ dans le dossier des paramètres d’Audiodiver. **Choisir un autre dossier** conserve les notes dans un autre dossier, par exemple un dossier synchronisé entre deux ordinateurs. Quand ce dossier contient déjà un fichier de notes, les notes qu’il contient et celles-ci sont fusionnées, et un élément qui a une note différente dans chacun garde les deux textes. **Utiliser le dossier par défaut** revient en arrière. Le fichier de l’ancien dossier reste tel quel.

**Exporter des notes** enregistre les notes globales, les notes du projet ouvert ou les deux, soit sous forme de document Markdown à lire, avec chaque note sous le nom de l’élément auquel elle se rapporte, soit sous forme de fichier de notes JSON. **Importer des notes** ajoute aux notes globales les notes d’un tel fichier JSON, ou d’un fichier de projet.

### Espace disque {#disk-space}

Audiodiver conserve des copies préparées de l’audio pour ne pas préparer deux fois le même audio. **Aperçus** regroupe les originaux décodés, les formes d’onde et les rendus de la lecture enchaînée. **Audio encodé** est le nouvel audio converti pour le jeu, que les générations réutilisent. Vider l’un ou l’autre est sans risque. Audiodiver prépare de nouveau les copies quand c’est nécessaire. Les projets et les fichiers audio ne sont jamais stockés là.
