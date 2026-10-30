---
title: Ajouter de l’audio
group: Créer un mod
summary: De nouvelles prises pour un son, une couche jouée avec lui, et du nouvel audio pour un seul son, en plus de ce que le jeu possède.
source: ea7154765378
---

Remplacer l’audio change ce qu’un emplacement joue. Les sons peuvent aussi recevoir de l’audio que le jeu n’a pas, de trois façons, toutes dans l’onglet Audio. Elles fonctionnent pour les sons et les voix, mais pas pour la musique.

## Nouvelles prises {#new-takes}

Un son qui choisit au hasard parmi plusieurs prises peut recevoir d’autres prises. Appuyez sur **+** sur la ligne du son, choisissez **Nouvelles prises** et choisissez un fichier pour chaque prise. Le jeu choisit alors parmi l’original et les nouvelles prises. Une nouvelle prise est marquée *nouvelle prise* et n’a pas d’original à lire. ✕ la retire.

Pour remplacer complètement un son, donnez du nouvel audio à chaque prise existante. Voir [Sons et voix](wiki:sounds-and-voices).

## Une couche {#a-layer}

Une couche est jouée avec un son à chaque fois, comme un grondement plus grave sous un coup de feu. Appuyez sur **+** et choisissez **Nouvelle couche** pour ajouter une couche sous le son, avec une prise pour chaque fichier que vous choisissez. **+** sur la couche ajoute d’autres prises, et le jeu en choisit une à chaque fois. Une couche va au même endroit du mixage que le son, et le Make-Up Gain règle son volume.

**Nouvelle couche** est grisé pour les sons qui ne peuvent pas avoir de couche. Un son qui est l’un des choix aléatoires d’un autre son ne peut pas en avoir, car la couche deviendrait simplement un autre choix. Un son que rien ne joue directement ne le peut pas non plus.

## Ce son uniquement {#only-this-sound}

Plusieurs sons jouent souvent le même clip, et remplacer le clip le modifie dans tous. Pour limiter un remplacement, réglez **Portée** dans les détails d’un emplacement remplacé sur **Ce son uniquement**. Les autres sons gardent alors l’original, et leurs emplacements affichent **remplacé dans un autre son**. Chaque option indique le nombre de banques qu’elle modifie.

Le nouvel audio entre dans le mod sous un nouvel ID. Les outils qui listent les clips par ID montrent l’ancien ID avec l’Original, alors que le jeu joue le nouvel audio dans ce son.

Cette option fonctionne son par son. Quand le jeu copie un son entier dans d’autres banques, comme les sons de maniement des armes dans chaque banque d’arme, les copies sont le même son et toutes changent.

## Taille {#size}

L’audio ajouté va dans chaque banque qui contient le son. Comme pour les remplacements, ajouter de l’audio à un son très répandu alourdit le mod. Pour le limiter aux banques du projet, voir [Audio ajouté dans d’autres banques](wiki:build-and-install#added-audio-in-other-banks).
