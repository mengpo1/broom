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
| solo | 31 | 0,5 | 1968,20 | 3449,90 | 3449,90 | 31 / 31 | n/d | n/d | n/d | 1,61 | 5,30 | 16,3 | -6676 | 1486 |
| grid | 34 | 0,6 | 1831,79 | 2133,30 | 2133,30 | 34 / 34 | n/d | n/d | n/d | 1,72 | 5,90 | 16,7 | 51 | 1618 |
| split | 34 | 0,6 | 1844,54 | 2150,00 | 2150,00 | 34 / 34 | n/d | n/d | n/d | 2,54 | 7,90 | 17,0 | 611 | 3355 |

Rafraîchissement mesuré de l'affichage : 59,9 Hz.

## Résultats à 1280×720 (même machine, qualité « high »)

| Scénario | Images | i/s moy. | Intervalle moy. (ms) | P99 (ms) | Max (ms) | Images > 16,7 ms | GPU moy. (ms) | GPU P99 | GPU max | CPU moy. (ms) | CPU max | Tas JS (Mo) | Croissance du tas (Ko) | Quadrilatères |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| solo | 201 | 10,0 | 100,00 | 100,00 | 100,00 | 201 / 201 | 396,14 | 479,79 | 506,26 | 1,39 | 19,30 | 15,9 | 752 | 1096 |
| grid | 201 | 10,0 | 100,00 | 100,00 | 100,00 | 201 / 201 | 397,29 | 471,18 | 492,39 | 1,88 | 29,10 | 17,9 | 1375 | 1143 |
| split | 201 | 10,0 | 100,00 | 100,00 | 100,00 | 201 / 201 | 436,10 | 575,51 | 576,61 | 1,89 | 14,30 | 17,8 | -277 | 2260 |

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
