---
title: Bonnes pratiques
group: Créer un mod
summary: Des habitudes qui facilitent le test, la mise à jour et le partage d’un mod.
source: 81552970f352
---

- Gardez **un dossier par mod**, avec le fichier `.audi`, le dossier `audio` et `build`. Une copie du dossier est une sauvegarde complète. Si deux projets partagent un dossier, l’onglet [Projet](app:project) affiche un avertissement avec **Déplacer dans un nouveau dossier**.
- **Nommez les fichiers dans l’ordre de lecture**, par exemple `01 …` et `02 …`. Les remplissages et les découpes suivent cet ordre. Si vous exportez de nouveau un fichier modifié sous le même nom, la génération suivante utilise la nouvelle version.
- **Travaillez par étapes.** Ébauchez une zone, comme le vaisseau, le largage ou une faction, et générez-la. Jouez-la et notez les vides, les coupures brusques et les passages faibles, puis corrigez-les et générez de nouveau. Les écrans d’équipement et de lieu de largage sont les plus rapides à atteindre dans le jeu.
- **Utilisez la Lecture enchaînée** avant de générer. Elle détecte la plupart des problèmes de passage de relais sans lancer le jeu.
- **Vérifiez les transitions** que l’onglet Audio marque avec **!**. Une transition d’origine entre deux morceaux de nouvelle musique est ce qui sonne le plus souvent de travers.
- **Écoutez dans les moments calmes et pendant un échange de tirs.** Les problèmes de volume apparaissent dans les deux situations.
- **Gardez l’ID et le nom du mod** dans [Projet](app:project) pendant toute la vie du mod, pour que le gestionnaire de mods mette à jour le mod installé à chaque fois. N’utilisez **Créer un nouvel ID** que lorsque vous copiez un projet pour faire un autre mod.
