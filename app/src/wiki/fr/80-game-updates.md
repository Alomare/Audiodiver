---
title: Quand le jeu est mis à jour
group: Générer et partager
summary: Pourquoi un mod de musique n’a en général besoin que d’une nouvelle génération après un patch, et que faire quand il lui faut davantage.
source: 3a5f4d64907d
---

Les petits patchs de Helldivers 2 ne modifient en général pas l’audio. Les grosses mises à jour ajoutent souvent de la musique pour un nouvel ennemi ou un nouveau type de planète, et peuvent déplacer la musique existante vers d’autres fichiers du jeu.

## Générer de nouveau {#rebuild}

Un projet enregistre *quel son* le nouvel audio remplace. Il n’enregistre pas où ce son est stocké. Après une mise à jour :

1. Lancez Audiodiver. Il détecte les fichiers du jeu modifiés et les relit, donc le premier démarrage après une mise à jour prend environ une minute. Si le jeu a été déplacé et qu’Audiodiver ne le trouve pas, l’écran de démarrage demande le dossier du jeu. Vous pouvez aussi définir le dossier sous **Jeu** dans les [Paramètres](app:settings/system).
2. Ouvrez le projet et générez-le.
3. Importez le nouveau ZIP dans le gestionnaire de mods et déployez-le.

La nouvelle génération patche les banques de sons actuelles, donc elle inclut tous les changements de la mise à jour.

## Quand un son a été déplacé {#when-a-sound-has-moved}

Si un son remplacé n’existe plus, l’onglet [Générer](app:build) le liste comme un problème, et vous ne pouvez pas générer tant que vous ne l’avez pas corrigé. Trouvez le nouvel emplacement dans la [Bibliothèque](app:library), ajoutez-le au projet et attribuez-y le fichier.

La nouvelle musique apparaît automatiquement dans l’Index. La musique qu’Audiodiver ne sait pas encore identifier est listée sous **Pas encore identifié**. Les autres nouveaux audios apparaissent tout de suite dans **Toutes les Archives**, sans nom. Voir [Sons et voix](wiki:sounds-and-voices).

## Mods créés avec d’anciens outils {#mods-made-with-older-tools}

Les patchs d’anciens outils basés sur les ID contiennent des banques de sons complètes de la version du jeu pour laquelle ils ont été générés. Après une grosse mise à jour, un tel patch ramène ces banques en arrière et peut annuler de la musique plus récente.

Pour mettre à jour l’un de ces mods, [repatchez-le](wiki:repatching) dans [Outils ▸ Repatch](app:tools/repatch). Déposez le mod sur la page, et Audiodiver le reconstruit pour la version actuelle du jeu.

Pour continuer à travailler sur le mod dans Audiodiver, importez-le ([Importer un mod](wiki:importing-mods)). **Importer un mod** sur [Accueil](app:home) crée un nouveau projet à partir de lui, et **Importer des patchs** dans l’onglet [Projet](app:project) l’ajoute au projet ouvert. L’audio du mod entre dans la génération sans être converti de nouveau.
