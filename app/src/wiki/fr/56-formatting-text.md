---
title: Mise en forme du texte
group: Créer un mod
summary: Ce que fait chaque bouton de la barre de mise en forme de l’onglet Texte, comment le jeu écrit chaque format, et des exemples à copier.
source: 47d197420504
---

Le jeu met le texte en forme avec des balises. Une balise ouvrante se place avant les mots, et une balise fermante après. Par exemple, `<c=FFFFE900>ARMORED ENEMIES</c>` affiche *ARMORED ENEMIES* en jaune Super-Terre. La barre au-dessus de **Nouveau texte** dans l’onglet [Texte](app:text) écrit les balises, et vous pouvez aussi les saisir. **Aperçu** montre le résultat pendant que vous travaillez.

Chaque exemple ci-dessous montre une ligne telle qu’elle est saisie, à gauche, et telle qu’elle est affichée, à droite.

## Appliquer un format {#applying-a-format}

1. Sélectionnez les mots dans **Nouveau texte**.
2. Si le format a une couleur ou une taille, réglez-la d’abord.
3. Appuyez sur le bouton.

Les balises entourent les mots sélectionnés. Les mots restent sélectionnés, donc un second bouton ajoute un second format. Si rien n’est sélectionné, un bouton met en forme toute la ligne, après le minutage éventuel du sous-titre.

Les balises peuvent être imbriquées. Fermez-les dans l’ordre inverse :

```game-text
Use the <c=FFFFE900><i=1>Hellbomb</i></c> on the nest.
```

**Effacer la mise en forme** retire de la ligne toutes les balises de couleur, de taille et de style, et conserve les mots et le minutage. Elle retire aussi les couleurs que le jeu renseigne, décrites plus bas. L’éditeur avertit quand cela arrive, et {key:undo} les restaure.

## Couleur {#colour}

**Couleur** change la couleur des mots. Choisissez une couleur avec l’échantillon ou saisissez un code hexadécimal dans la zone à côté, puis appuyez sur **Couleur**.

Un code de couleur a huit chiffres hexadécimaux. Les deux premiers définissent l’opacité (`FF` est totalement opaque), et les autres définissent le rouge, le vert et le bleu. Audiodiver écrit toujours `FF` pour l’opacité. Pour rendre des mots partiellement transparents, saisissez une valeur plus basse à la main. Par exemple, `80` est à moitié transparent.

```game-text
Pick up and use <c=FFFFE900>EXPENDABLE ANTI-TANK</c> against <c=FFFFE900>ARMORED ENEMIES</c>.
```

```game-text
<c=FFFF0000>Danger close.</c> Clear the area.
```

```game-text
<c=80FFFFFF>Barely there.</c>
```

Ces couleurs sont les plus courantes dans le jeu :

| Code | Couleur | Lignes |
|---|---|---|
| `FFFFE900` | jaune Super-Terre, utilisé sur les mots clés des astuces | 166 |
| `FF336666` | bleu-vert foncé | 13 |
| `FF66cc99` | vert pâle | 5 |
| `FFFF0000` | rouge | 4 |

## Taille {#size}

**Taille** agrandit ou réduit les mots. Réglez une taille de 10 à 60 dans la zone numérique, puis appuyez sur **Taille**. La taille normale est 20.

```game-text
<s=30>FOR SUPER EARTH!</s>
```

```game-text
Mission complete. <s=14>Mostly.</s>
```

> [!NOTE]
> Aucune ligne du jeu n’utilise de taille, mais le chat en utilise. C’est le jeu qui décide de l’aspect d’une taille dans un sous-titre ou un menu, donc vérifiez dans le jeu avant de partager un mod.

## Mise en valeur {#emphasis}

**Mise en valeur** écrit `<i=1>`, le style des termes que les astuces et les briefings expliquent. L’Aperçu l’affiche en italique. Dans le jeu, il apparaît dans le style de mise en valeur.

```game-text
Welcome to the <i=1>Galactic Map</i>. Select <i=1>Missions</i> to play.
```

Les autres styles ne sont pas dans la barre. Le jeu utilise `<i=3>` pour le titre d’un avis et `<i=2>` entre les chiffres d’un minuteur. Saisissez-les à la main :

```game-text
<i=3>STRATEGIC ADVISORY</i>
The Automaton <i=1>Jet Brigade</i> has been spotted.
```

## Minutage (sous-titres) {#timing-subtitles}

Un sous-titre commence par une marque de minutage, `{start->end}`. La marque définit quand les mots qui la suivent apparaissent et disparaissent, en secondes depuis le début de la réplique. Un long sous-titre a plusieurs marques, une pour chaque morceau de texte. Appuyez sur **Minutage** pour ajouter `{0.00->2.00}` au curseur, puis saisissez les temps.

```game-text
{0.00->1.85}Reinforcements inbound!
```

```game-text
{0.00->2.40}Stratagem coming in hot.
{2.40->4.10}Clear the landing zone!
```

Si le nouvel audio d’une réplique a une durée différente, changez les temps du sous-titre en conséquence. La Bibliothèque montre la durée d’une réplique au-dessus de la forme d’onde, et le lien **Sous-titre** sur la ligne ouvre le sous-titre ici.

## Sauts de ligne {#line-breaks}

Appuyez sur Enter dans **Nouveau texte** pour commencer une nouvelle ligne. Les textes plus longs du jeu utilisent des sauts de ligne (440 lignes en ont), tout comme quelques longs sous-titres, avec un morceau de texte par ligne.

## Parties que le jeu renseigne {#parts-the-game-fills-in}

Le jeu renseigne certaines parties d’une ligne quand il l’affiche. Laissez ces parties inchangées, et déplacez-les avec les mots quand vous reformulez la ligne :

- **Les mots en majuscules après `#`**, comme `#NAME` ou `#COUNT`, deviennent le nom d’un joueur ou un nombre. L’Aperçu les montre sous forme de cases.
- **Les couleurs avec un nom à la place d’un code**, comme `<c=#PLAYER_COLOR>`, sont choisies par le jeu, par exemple la couleur d’un joueur. L’Aperçu souligne les mots que ces balises colorent.

```game-text
<c=#PLAYER_COLOR>#NAME</c> DIED
```

```game-text
<c=#PLAYER_COLOR>#NAME</c> gave their life for <c=FFFFE900>Super Earth</c>
```

L’éditeur avertit quand une ligne perd l’une de ces parties.
