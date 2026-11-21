# Rapport de performances

Benchmarks de référence : trois scénarios de 60 s en temps réel dans Chromium, sur le fichier
`index.html` réel (`npm run benchmark`, ou `index.html#benchmark=all` sur la machine du joueur).
Scénarios : **solo** (le joueur seul en piste), **grid** (16 adversaires), **split** (écran
partagé, 2 joueurs + 14 adversaires). Le joueur est conduit par l'ordinateur.

Trois grandeurs sont mesurées séparément :

- **intervalle entre images** : écart entre deux `requestAnimationFrame` (ce que voit le joueur) ;
- **temps CPU** par image : simulation + construction de la scène + encodage des commandes ;
- **temps GPU** de la passe de rendu : requêtes d'horodatage WebGPU (`timestamp-query`), quand
  l'adaptateur les fournit.

## ⚠ Portée de ces mesures

Adaptateur utilisé : vendor « google », architecture « swiftshader » — **rasteriseur logiciel**.

La machine de test ne possède **aucune carte graphique** : WebGPU est exécuté par SwiftShader, sur le processeur (4 cœurs). Les chiffres ci-dessous mesurent donc un rendu logiciel et **ne permettent pas de conclure** sur les objectifs fixés pour un vrai GPU (60 i/s à 2560×1440, GPU moyen ≤ 11 ms, aucun pic > 16,7 ms). **Ces objectifs ne sont ni atteints ni réfutés : ils sont non vérifiés.** Le « temps GPU » rapporté est ici le temps du rasteriseur logiciel.

## Résultats à 2560×1440 (qualité « high », 2026-11-21)

| Scénario | Images | i/s moy. | Intervalle moy. (ms) | P99 (ms) | Max (ms) | Images > 16,7 ms | GPU moy. (ms) | GPU P99 | GPU max | CPU moy. (ms) | CPU max | Tas JS (Mo) | Croissance du tas (Ko) | Quadrilatères |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| solo | 34 | 0,6 | 1820,02 | 2983,20 | 2983,20 | 34 / 34 | 1752,33 | 2085,58 | 2085,58 | 1,55 | 5,40 | 16,3 | -6151 | 1491 |
| grid | 36 | 0,6 | 1705,02 | 1900,00 | 1900,00 | 36 / 36 | 1671,31 | 1870,40 | 1870,40 | 1,19 | 2,40 | 16,2 | -366 | 1623 |
| split | 37 | 0,6 | 1670,65 | 1849,90 | 1849,90 | 37 / 37 | 1637,57 | 1816,56 | 1816,56 | 1,74 | 3,80 | 16,9 | 183 | 3365 |

Rafraîchissement mesuré de l'affichage : 59,9 Hz.

## Résultats à 1280×720 (même machine, qualité « high »)

| Scénario | Images | i/s moy. | Intervalle moy. (ms) | P99 (ms) | Max (ms) | Images > 16,7 ms | GPU moy. (ms) | GPU P99 | GPU max | CPU moy. (ms) | CPU max | Tas JS (Mo) | Croissance du tas (Ko) | Quadrilatères |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| solo | 131 | 2,2 | 466,39 | 600,00 | 1799,90 | 131 / 131 | 446,53 | 583,82 | 636,77 | 2,06 | 34,60 | 16,8 | -7098 | 1357 |
| grid | 124 | 2,1 | 489,77 | 650,10 | 666,60 | 124 / 124 | 478,61 | 636,77 | 659,93 | 2,83 | 25,70 | 17,5 | 745 | 1526 |
| split | 122 | 2,0 | 495,47 | 566,70 | 600,00 | 122 / 122 | 484,42 | 558,96 | 575,41 | 3,23 | 19,50 | 18,4 | 453 | 3223 |

## Lecture

- Le **temps CPU** du jeu (simulation à 120 Hz de 17 voitures, construction de 1 000 à 2 500
  quadrilatères, écriture des tampons) est indépendant du rasteriseur : c'est la part qui se
  transpose telle quelle sur une machine réelle. Il laisse l'essentiel du budget de 16,7 ms au GPU.
- La charge GPU par image est faible par construction : une passe, 4 à 5 appels de dessin par
  vue, un shader plein écran pour le sol, des quadrilatères texturés, MSAA 4× en qualité haute.
- **Allocations** : la croissance du tas JS pendant 60 s est rapportée ci-dessus ; le code du
  jeu n'alloue pas dans la boucle de rendu, la croissance résiduelle vient des objets créés par
  l'API WebGPU à chaque image et de la mesure elle-même (promesses de lecture des horodatages).

## Reproduire sur une machine réelle

```bash
npm run benchmark
```

ou ouvrir `index.html#benchmark=all&seconds=60` dans Chrome : les trois scénarios s'enchaînent
et le résultat s'affiche (et reste dans `window.virageBenchmark`).
