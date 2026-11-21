# Virage GP — édition bande dessinée

Jeu de course arcade de monoplaces en **vue cockpit**, moteur **2D à perspective simulée**,
entièrement dessiné par le code dans une esthétique de bande dessinée automobile
franco-belge contemporaine. Un seul fichier : `index.html`.

> **Jeu original.** Virage GP appartient au genre des courses arcade en vue cockpit du début
> des années 1990 et en reprend des mécaniques génériques (modes Arcade / Championnat,
> écran partagé, stands, réglages…). Il n'est la recréation d'aucun jeu existant : nom,
> circuits, écuries, pilotes, dessins, textes et sons sont propres au projet. L'étude
> documentaire du genre se trouve dans `docs/research/`.

## Jouer

Ouvrir `index.html` dans un navigateur compatible **WebGPU** (Chrome ou Chromium 113+ sous
Linux, accélération matérielle active). Aucun serveur, aucune connexion.

```bash
chromium --enable-features=Vulkan index.html      # Linux : Vulkan aide WebGPU sur certains pilotes
```

| | Joueur 1 | Joueur 2 | Manette |
|---|---|---|---|
| Direction | ← → | A D | stick gauche ou croix |
| Accélérer / freiner | ↑ ↓ | W S | gâchettes |
| Rapports + / − | Maj droite / Ctrl droite | E / Q | RB / LB |
| Turbo, remise en piste, caméra, pause | Espace, Retour arrière, C, Échap | F, R, V, P | A, Y, X, Start |

Souris possible (déplacement = direction, boutons = accélérer / freiner). Tout est
réaffectable dans **Options → Commandes** ; langue française ou anglaise ; chaque effet
graphique peut être coupé individuellement.

**Modes** : Arcade (dépasser pour accéder au circuit suivant, score), Championnat (3 saisons
de 6 manches, qualifications, points, stands, sauvegarde), Entraînement, Turbo, Deux joueurs
en écran partagé (haut/bas ou gauche/droite). 18 circuits originaux, 16 adversaires.

## Contenu du dépôt

```
index.html            le jeu autonome (construit depuis src/), 1 035 351 octets
race-replay.mp4       démonstration, 60 s, 2560x1440, 60 i/s (enregistrée avant le travail sur les collisions)
src/                  sources (voir docs/architecture/overview.md)
tests/                tests automatisés (Node et navigateur)
docs/
  architecture/       architecture logicielle
  art-direction/      charte graphique, revues artistiques indépendantes
  research/           étude du genre et références (sourcées, niveaux de confiance)
  specifications/     règles et conduite, performances, compatibilité Linux, tests, limites
work/
  scripts/            construction, captures, benchmark, vidéo, rapports
  renders/            captures de référence (final/ : les 20 captures 2560x1440 de la revue artistique, en JPEG)
    collisions/       scénarios de collision joués dans le jeu : vidéos 60 i/s, planches, télémétrie
    comparison/       roues et rétroviseurs avant / après
  benchmarks/         résultats bruts (JSON)
  reviews/            comptes rendus des critiques (revue artistique, revue des séquences de collision)
references/           volontairement vide : aucune image de référence n'est embarquée par le jeu
work/reference-frames/  extraits d'une vidéo de gameplay tierce, pour analyse uniquement
```

## Construire et vérifier

Node 20+ suffit pour construire et pour les tests de simulation ; les tests navigateur
utilisent Playwright + Chromium. `flow-check` déroule tous les modes de jeu dans le vrai
fichier, `pages-check` les pages d'options, la pause, les caméras et la souris.

```bash
npm run build
```

```bash
npm test
```

```bash
npm run test:browser
```

```bash
node work/scripts/flow-check.mjs
```

```bash
node work/scripts/pages-check.mjs
```

```bash
node work/scripts/collision-comparison.mjs
```

```bash
node work/scripts/collision-sequences.mjs all --width 960 --height 540
```

```bash
npm run benchmark
```

```bash
npm run capture
```

Benchmark sur votre machine, sans outil : ouvrir `index.html#benchmark=all` (3 × 60 s ;
résultats à l'écran et dans `window.virageBenchmark`).

## Documentation

| Livrable | Emplacement |
|---|---|
| Architecture | `docs/architecture/overview.md` |
| Charte graphique | `docs/art-direction/charter.md` |
| Recherche historique | `docs/research/genre-study.md`, `comic-art-reference.md` |
| Analyse d'une vidéo de gameplay (collisions, décollages, perspective) | `docs/research/vroom-gameplay-analysis.md`, `work/reference-frames/` |
| Règles, conduite, fidélité | `docs/specifications/gameplay.md` |
| Collisions, décollages, accidents ; comparaison avec l'analyse vidéo ; non-régression de la conduite | `docs/specifications/collisions.md` |
| Rotation des roues avant et rétroviseurs du cockpit (avant / après) | `docs/specifications/wheels-and-mirrors.md` |
| Résultats des tests | `docs/specifications/tests.md` |
| Rapport de performances | `docs/specifications/performance.md` |
| Compatibilité Linux | `docs/specifications/linux-compatibility.md` |
| Revue artistique indépendante | `docs/art-direction/independent-review.md`, `work/reviews/` |
| Fonctions incomplètes ou non vérifiées | `docs/specifications/incomplete-features.md` |

## Technique en bref

- JavaScript (modules ES), WebGPU + WGSL, Web Audio, Gamepad API ; aucune dépendance.
- Simulation déterministe à pas fixe (120 Hz), indépendante de l'affichage.
- Route projetée en 2D par table de lignes (virages, relief, crêtes) ; sprites triés du fond
  vers l'avant ; pas de caméra 3D, pas de tampon de profondeur.
- Tous les dessins (voitures sous 48 angles, cockpit, décors, lettrage, menus) et tous les
  sons sont générés au chargement ; les dessins sont remplaçables par identifiant logique.
