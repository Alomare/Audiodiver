---
title: Make-Up Gain et le mixage
group: Créer un mod
summary: Régler le volume d’un emplacement, comment fonctionne le mixage HDR du jeu, et pourquoi certains écrans sonnent plus faible dans le jeu que dans Audiodiver.
source: 34bc5e953c4b
---

## Make-Up Gain par emplacement {#make-up-gain-per-slot}

Sélectionnez un emplacement et réglez **Make-Up Gain** dans les détails, de −96 à +96 dB, avec le curseur ou en saisissant une valeur. Plusieurs emplacements sélectionnés reçoivent tous la même valeur. Le Make-Up Gain ne modifie pas le fichier audio, donc vous pouvez l’ajuster à tout moment. {icon:reset} après la valeur la remet à 0 dB, le niveau auquel le jeu joue le son. Certains sons ont déjà un Make-Up Gain dans le jeu, que le **?** indique. Il est conservé, puisque la valeur saisie ici s’y ajoute. Le **Niveau** d’un morceau dans la [Bande-son](wiki:soundtrack) a le même bouton.

Sur un emplacement sans nouvel audio, le Make-Up Gain rend l’Original plus fort ou plus faible. Le mod ne modifie que ce réglage, donc il ne contient aucune copie de l’audio. La ligne affiche la valeur sous forme d’étiquette. Tant que l’emplacement a du nouvel audio, c’est le gain réglé sur le nouvel audio qui s’applique.

Les formes d’onde sous les emplacements sont dessinées au niveau du gain et suivent le curseur pendant qu’il bouge, sur la même échelle que l’Original, donc le nouvel audio peut être réglé au même niveau que l’Original à l’œil. Le rouge marque l’audio poussé au-delà de la pleine échelle, qui sature. ▶ joue aussi le nouvel audio au gain réglé, et l’Original au gain réglé dessus.

**Aligner sur la sonie d’origine** règle le Make-Up Gain qui rend le nouvel audio aussi fort que l’Original. Audiodiver mesure la sonie des deux (comme le font les sonomètres de diffusion) : un son de moins de 3 secondes, comme un tir ou une réplique, selon son moment le plus fort, et un audio plus long, comme la musique, dans son ensemble. Avec plusieurs emplacements sélectionnés, **Aligner chacun sur la sonie d’origine** règle un gain distinct pour chaque emplacement.

> [!NOTE]
> Quelques clips ignorent le Make-Up Gain dans le jeu, notamment les stingers calmes des Illuministes. Leurs détails affichent un avertissement. Réglez le volume de ces clips dans le fichier audio.

Le curseur **Vol** de la barre d’état règle uniquement le volume d’écoute dans Audiodiver. Il ne fait pas partie du mod.

## Make-Up Gain et Volume sont des réglages différents {#make-up-gain-and-volume-are-different-settings}

Wwise, le moteur audio du jeu, a deux réglages qui ressemblent tous deux à un « volume » :

- **Volume** est le volume *logique*, la force que le jeu attribue à un son. Le mixage utilise cette valeur pour décider quels sons baisser.
- **Make-Up Gain** est appliqué *après* cette décision. Il rend le son plus fort ou plus faible à l’oreille sans changer la force que le mixage lui attribue.

Audiodiver règle le Make-Up Gain, qui ne change que le volume. La valeur des détails s’ajoute au Make-Up Gain que le jeu donne déjà au son, donc 0 dB joue le son comme le jeu le fait.

## Le mixage HDR du jeu {#the-game-s-hdr-mix}

Le jeu mixe l’audio avec le **HDR** (grande dynamique). À tout moment, les sons dont le Volume logique est le plus élevé baissent les sons plus faibles. Un coup de feu ou une explosion atténue brièvement l’ambiance et la musique, un peu comme un bruit fort le fait à votre oreille.

Un son mis en silence de la manière habituelle affecte toujours le mixage. Avec un Make-Up Gain de −96 dB, ou avec un fichier silencieux, les haut-parleurs ne jouent rien. Le Volume logique reste pourtant élevé, et les sons autour sont toujours atténués.

> [!TIP]
> **Le silence d’Audiodiver est retiré du mixage.** Quand vous remplacez un effet sonore ou une réplique par du silence, Audiodiver règle aussi le Volume logique à −60 dB. Ce niveau est trop bas pour que le mixage le compte, donc rien n’est atténué. Il reste assez élevé pour que le jeu n’arrête pas le son plus tôt, donc il ne perturbe pas le minutage de la séquence. Le volume de la musique ne change pas, et un emplacement de musique mis en silence garde la même durée ou passe directement à la suite, selon le réglage du silence.

## Le jeu baisse la musique sur certains écrans {#the-game-turns-the-music-down-on-some-screens}

À certains moments, le jeu baisse la musique, et la nouvelle musique est baissée de la même façon :

- Sur l’écran du lieu de largage, les boucles sont jouées plus doucement et remontent sur l’écran d’équipement qui suit. C’est le mixage qui en est la cause, pas le fichier audio.
- Sur le vaisseau, s’approcher de la table de guerre baisse la musique de 6 dB, et rien ne la remonte. Avant la première visite à la table de guerre, la musique du vaisseau est jouée 6 dB plus fort que pour les joueurs qui ont rejoint une mission depuis la table de guerre, ce qui est la façon habituelle. Jugez la musique du vaisseau après une visite à la table de guerre.
- Les voix, les explosions et les effets de combat sont joués par-dessus la musique, et le HDR baisse la musique en dessous. Une musique qui sonne bien seule peut sembler noyée pendant un échange de tirs.

Pour ces raisons, réglez le Make-Up Gain à l’oreille **dans le jeu**, aux moments modifiés, et comparez-le au volume de la musique d’origine à cet endroit.

> [!TIP]
> Si un morceau a besoin d’un coup de pouce, augmentez les emplacements de +4 dB à la fois et écoutez dans le jeu après chaque étape.

**Ajouter l’analyse de sonie Wwise** dans l’onglet [Générer](app:build) nécessite une installation de Wwise. Elle ne change rien d’audible et est désactivée par défaut.
