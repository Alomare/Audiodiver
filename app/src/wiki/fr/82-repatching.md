---
title: Repatch
group: Générer et partager
summary: Reconstruire un mod audio créé pour une ancienne version du jeu, ou avec un autre outil, pour le jeu actuel.
source: 4adcbe4e29d4
---

Le patch d’un mod contient des copies complètes des banques de sons qu’il modifie, telles qu’elles étaient dans la version du jeu pour laquelle le mod a été créé. Après une mise à jour du jeu, ces copies sont périmées. Le mod peut devenir silencieux ou jouer les mauvais sons, et, une fois installé, il ramène l’audio plus récent en arrière. Il peut même rendre silencieux des sons qu’il n’a jamais modifiés, car les banques contiennent aussi des réglages que beaucoup d’autres banques partagent. **Repatch**, dans [Outils](app:tools/repatch), reconstruit un tel mod pour le jeu actuel. Il ne demande ni projet ni expérience en modding.

## Quand l’utiliser {#when-to-use-it}

- Les sons d’un mod sont devenus silencieux, incorrects ou absents après une mise à jour du jeu, et l’auteur ne l’a pas mis à jour.
- D’autres sons, comme tous les tirs, deviennent silencieux tant que le mod est installé. Voir [Réglages partagés d’une ancienne version du jeu](#shared-settings-from-an-older-game-version).

## Repatcher un mod {#repatching-a-mod}

1. Ouvrez [Outils ▸ Repatch](app:tools/repatch).
2. Déposez le mod sur la page. Vous pouvez déposer le ZIP téléchargé, le dossier du mod, ou le fichier `.patch_0` avec le fichier `.stream` à côté. **Choisir un ZIP ou un fichier patch** et **Choisir un dossier** font la même chose. Un ZIP déposé n’importe où dans Audiodiver s’ouvre aussi sur cette page.
3. Vérifiez le nom. Audiodiver le prend dans le manifeste s’il y en a un, et sinon dans le nom du fichier ou du dossier, sans les numéros et les dates que Nexus Mods ajoute aux téléchargements.
4. Cochez **Patcher chaque banque contenant les sons** pour que l’audio du mod soit joué partout où ces sons sont utilisés. Décochée, l’audio ne va que dans les banques que le mod a patchées, comme dans l’original, et la taille reste à peu près la même. [En savoir plus](wiki:build-and-install#every-bank-with-the-sounds).
5. Appuyez sur **Repatch**.

La page résume ensuite le résultat : ce qui a été repris, ce qui a été conservé tel quel et ce qui a été écarté. **Tout afficher** liste chaque patch et le journal. **Repatcher un autre mod** vide la page.

Certains mods ont plusieurs options, avec un patch pour chacune. Un tel mod reste un seul mod avec les mêmes options. La page compte les patchs, et Audiodiver reconstruit chaque patch qui contient de l’audio à sa place. Un patch sans audio, comme une option qui ne change qu’une texture, reste tel quel. **Tout afficher** les liste un par un.

Certains mods ont plusieurs fichiers patch dans un même dossier, comme `.patch_0`, `.patch_1` et `.patch_2`. Le jeu les charge les uns par-dessus les autres comme un seul mod. Audiodiver les lit dans le même ordre et les assemble en un seul patch.

## Vérifier les mods installés {#checking-installed-mods}

**Mods installés**, en bas de la page Repatch, trouve les mods qui ont besoin d’un repatch. **Vérifier les mods installés** examine les mods de la bibliothèque d’un gestionnaire de mods, déployés ou non, et les fichiers patch du dossier `data` du jeu. Il liste chaque mod qui a des banques de sons :

- **Anciens réglages partagés.** Les banques ont d’anciennes copies de [réglages que d’autres banques partagent](#shared-settings-from-an-older-game-version). Une fois déployé, le mod peut couper ou modifier des sons qu’il n’a jamais touchés. La ligne en dessous indique combien d’autres banques il atteint.
- **Anciennes banques de sons.** Les banques viennent d’une ancienne version du jeu. Les sons du mod peuvent être incorrects ou absents.
- **À jour.** Rien dans les banques n’est plus ancien que le jeu actuel. Soit le mod a été créé pour cette version, soit les mises à jour suivantes n’ont pas touché ces banques.
- **Illisible.** Audiodiver n’a pas pu lire le fichier patch.

**Déployé** marque les mods actuellement dans le dossier du jeu. Un mod avec des options est listé une seule fois, avec **Options** qui montre chaque option quand elles diffèrent. **Repatch** ouvre un mod signalé dans le formulaire en haut de la page, prêt à être repatché.

La vérification ne signale que ce que l’auteur d’un mod n’aurait pas modifié volontairement, donc un mod créé pour le jeu actuel n’apparaît jamais comme ancien.

## Ce que le repatch reprend {#what-repatching-carries-over}

- L’audio que le mod remplace, et l’audio qu’il ajoute. L’audio ajouté peut être de nouvelles prises pour un son, un son joué avec un autre son, ou un clip séparé pour un seul son.
- Les réglages de son, comme le volume (Make-Up Gain) d’un son ou d’un conteneur, un délai avant sa lecture, et la part qui va à la réverbération.
- Les points de repère des segments de musique qui jouent du nouvel audio.
- Tout le reste du patch, comme le texte, les modèles et les textures, exactement tel quel. La page liste ce qu’un patch contient en dehors de l’audio.

Audiodiver applique tout cela aux banques de sons actuelles et génère un nouveau ZIP du même mod. Les banques que le mod n’a pas patchées ne reçoivent l’audio que si **Patcher chaque banque contenant les sons** est coché.

Si le mod a un manifeste de gestionnaire de mods, le nouveau ZIP conserve tout le reste de l’original : le nom, la description, l’icône, les options, les fichiers à côté des patchs et l’ID. Avec le même ID, importer le nouveau ZIP dans un gestionnaire de mods met à jour l’ancien mod et n’ajoute pas une autre copie. Seuls les patchs sont nouveaux. L’audio entre sans être converti de nouveau, donc il sonne pareil.

## Dossier de destination {#destination-folder}

Le nouveau ZIP va dans le **Dossier de destination**. L’emplacement par défaut est `Documents\Audiodiver\Repatched`, et **Modifier** en choisit un autre. Si un ZIP du même nom s’y trouve déjà, il reste, et le nouveau reçoit un numéro.

Pour modifier un mod davantage, créez un projet et importez-y le patch du mod, comme l’explique [Quand le jeu est mis à jour](wiki:game-updates#mods-made-with-older-tools). Générez-le ensuite depuis [Générer](app:build) comme n’importe quel autre projet.

## Ce que le repatch écarte {#what-repatching-leaves-out}

La copie d’une banque dans un mod peut aussi avoir des effets ou un positionnement différents, ou une autre façon pour un conteneur de choisir les sons. La plupart de ces différences viennent des banques telles qu’elles étaient quand le mod a été créé, avant que des mises à jour ultérieures ne les modifient. Audiodiver les écarte, et la page les liste. Une différence qu’Audiodiver connaît d’une ancienne version du jeu n’est pas listée. Si le mod repatché sonne différemment, comparez-le à l’ancienne version dans le jeu.

Le texte, les modèles et les textures entrent sans changement. Une table de chaînes contient toutes les lignes de la table, donc une table d’une ancienne version du jeu ramène aussi les lignes de cette version, comme le faisait l’ancien mod.

Les réglages de son sont copiés tels quels. L’un d’eux peut remplacer une valeur que le jeu a modifiée depuis, comme le faisait l’ancien mod. Sur les groupes que d’autres banques partagent, seuls le volume, la hauteur, les filtres et le délai sont copiés. Voir [Réglages partagés d’une ancienne version du jeu](#shared-settings-from-an-older-game-version).

> [!NOTE]
> Audiodiver garde la trace de ce que change chaque mise à jour du jeu, à partir de la mise à jour du 20 octobre 2026. Pour un mod créé avant cette mise à jour, certains éléments sous **Écarté** et certains des réglages copiés peuvent être des valeurs Original de cette époque que le mod n’a pas modifiées.

Dans un mod à plusieurs options, un patch contenant de l’audio qui ne peut pas être repatché reste dans le ZIP sans changement, et la page le nomme. Cela arrive quand les banques de sons du patch ne peuvent pas être lues, ou ne contiennent rien qu’Audiodiver puisse reprendre.

## Sons d’une ancienne version du jeu {#sounds-from-an-older-game-version}

Les copies de banques d’un mod contiennent encore tous les sons que le jeu avait quand le mod a été créé. Quand une mise à jour ultérieure supprime certains de ces sons, ils ressemblent à des sons que le mod a ajoutés. Les repatcher ramènerait les sons supprimés comme prises supplémentaires à côté des sons actuels.

Audiodiver reconnaît ces sons, les écarte et indique combien ils sont. Ils n’ont jamais fait partie du mod, donc le mod repatché contient toujours tout ce que l’auteur a fait. [Importer le patch d’un mod](wiki:game-updates) dans un projet les écarte aussi.

Audiodiver les reconnaît de deux façons :

- Il se souvient des sons que les versions précédentes du jeu avaient dans chaque banque.
- Un son que le mod a ajouté joue du nouvel audio. Un son qui joue un audio que le jeu actuel a encore est un son d’origine.

Si le mod a remplacé l’audio d’un son que le jeu a supprimé depuis, il n’y a rien où mettre cet audio, et le mod repatché joue les sons actuels à cet endroit.

## Réglages partagés d’une ancienne version du jeu {#shared-settings-from-an-older-game-version}

Beaucoup de sons tirent leur volume, leur priorité et d’autres réglages de groupes partagés entre des banques. Chaque son d’arme passe par un groupe qui se trouve dans plus d’une centaine de banques. La copie d’une banque dans un mod a ces groupes tels qu’ils étaient quand le mod a été créé. Quand le jeu charge cette banque, l’ancienne copie d’un groupe peut remplacer l’actuelle, et chaque son du groupe change avec elle. Après la mise à jour du 20 octobre 2026, des mods de ce type ont rendu silencieux tous les tirs.

Les mises à jour modifient les courbes, les effets et les réglages de mixage de ces groupes, comme la priorité. Les mods modifient au plus le volume, la hauteur, les filtres et le délai. Quand un groupe du mod diffère par ses courbes ou ses effets, Audiodiver le traite comme venant d’une ancienne version du jeu et garde le groupe actuel. Pour les autres réglages d’un groupe partagé, il ne prend que le volume, la hauteur, les filtres et le délai, et garde les valeurs actuelles pour le reste. Un réglage que le jeu actuel a et que le mod n’a pas est arrivé avec une mise à jour ultérieure. Une copie partagée qui en est dépourvue vient d’une ancienne version du jeu, donc aucun des réglages de cette copie n’est repris. La page indique combien d’objets sonores ont été mis à jour de cette façon. [Importer le patch d’un mod](wiki:game-updates) fonctionne de la même manière.

Un mod peut avoir ces anciennes copies même s’il a été mis à jour après le jeu. Certains outils de modding reportent les réglages du mod sur les nouvelles banques, et avec eux les anciennes valeurs des groupes partagés. La vérification des mods installés les trouve aussi.

Un mod généré avec Audiodiver a les mêmes copies. Générez-le de nouveau après chaque mise à jour du jeu. La page [Générer](app:build) avertit quand la dernière génération est plus ancienne que le jeu.

## Installer le résultat {#installing-the-result}

Importez le nouveau ZIP dans le gestionnaire de mods. Si la page indique que l’ID du mod a été conservé, le nouveau ZIP remplace l’ancien mod. Sinon, retirez d’abord l’ancien mod.

> [!NOTE]
> Un mod repatché reste le travail de son auteur. Gardez-le pour un usage personnel, et ne le partagez qu’avec l’autorisation de l’auteur. Mieux encore, indiquez Audiodiver à l’auteur pour qu’il mette le mod à jour.
