# Architecture — Virage GP, édition bande dessinée

Jeu de course arcade en vue cockpit, **moteur 2D à perspective simulée**, rendu WebGPU,
graphismes et sons entièrement générés par le code, livré en un seul `index.html`.
Aucune bibliothèque externe, aucun moteur de jeu, aucun moteur 3D ou physique tiers.

## 1. Principes

| Principe | Mise en œuvre |
|---|---|
| Simulation indépendante du rendu | `src/physics`, `src/gameplay`, `src/ai`, `src/tracks` n'importent rien de `src/rendering`, `src/art`, `src/ui` ; ils tournent sous Node (tests) |
| Pas fixe, déterminisme | 120 Hz (`SIM_DT`), générateur pseudo-aléatoire à graine (`core/random.js`), jamais `Math.random` dans la simulation |
| Coordonnées de monde cohérentes | chaque circuit est une boucle fermée en mètres (x, z, altitude) ; voitures en position monde, repérées aussi en coordonnées piste (s, d) |
| Rendu 2D sans caméra 3D | projection par table de lignes (`rendering/projection`), sprites et bandes triés du fond vers l'avant, pas de tampon de profondeur |
| Graphismes remplaçables | le jeu ne manipule que des **identifiants logiques** (`strip.armco`, `tree.pine.0`, `cockpit.near.0`…) résolus par `art/art-library.js` |
| Paramètres externalisés | `core/config.js` (vue, effets, qualité), `vehicles/car-spec.js` (conduite), `gameplay/rules.js` (règles), `tracks/themes.js`, `art/palettes/palettes.js`, `audio/audio-tuning.js`, `localization/*.js` |
| Pas d'allocation par image | tampons pré-alloués (`QuadBatch`, tables de lignes, particules, tampon de texte) ; voir § 7 |

## 2. Modules

```
src/
  core/           boucle (game-app), maths, aléa, configuration, benchmark
  tracks/         définition des 18 circuits, construction (courbure, relief, stands), trajectoire idéale,
                  thèmes logiques, disposition logique des décors (scenery-layout)
  physics/        dynamique arcade d'une monoplace, contacts voiture-voiture
  vehicles/       paramètres de la voiture (car-spec), écuries et pilotes fictifs (liveries)
  ai/             pilote ordinateur (mêmes commandes et même physique que le joueur), profil de vitesse
  gameplay/       course (départ, tours, classement, stands), règles, championnat, sessions (modes de jeu)
  multiplayer/    découpage de l'écran
  rendering/
    projection/   projection de route 2D (nœuds, table de lignes, projection de points)
    drawing/      lot de quadrilatères, atlas en mémoire, constructeur de scène, attributs de piste
    compositing/  compositeur WebGPU, vue de course (caméras), cockpit, uniformes
    shaders/      WGSL : sol, ciel, quadrilatères, traits de vitesse, page d'interface
    effects/      poussière, fumée, étincelles, traces, éclats, onomatopées
  art/
    styles/       outils d'encrage (ink), lettrage BD (lettering)
    palettes/     gammes de couleurs par thème
    vehicles/     modèle de construction de la monoplace + illustrateur (dessin encré)
    cockpits/     dessins du cockpit (calques animables)
    environments/ végétation, bords de piste, bâtiments, bandes de terrain, panoramas, catalogue
    art-library   correspondance identifiant logique -> dessin, construction des atlas
  input/          clavier, souris, manettes, affectations par joueur
  audio/          synthèse Web Audio (moteurs, bruits, foule, signaux)
  ui/             HUD, peinture de texte, planches de menus, déroulement du jeu
  localization/   dictionnaires fr / en
  persistence/    sauvegarde localStorage
tests/            unit, gameplay, integration (Node) ; rendering, performance (navigateur)
work/scripts/     build, captures, benchmarks, rapports
```

Dépendances (sens unique) : `ui` → `gameplay`, `rendering`, `art`, `input`, `persistence`,
`audio` ; `rendering` → `art` (dessins), `tracks`/`physics` (lecture seule) ; `gameplay` →
`physics`, `ai`, `tracks`, `vehicles` ; `core/game-app` assemble le tout par de petites
interfaces (`input.apply(race)`, `audio.update(app, dt)`, `ui.update(app, dt)`…).

## 3. Une image, étape par étape

1. `GameApp.onFrame` accumule le temps et exécute 0..n pas de simulation de 1/120 s
   (`input.apply` → `race.step` → diffusion des événements).
2. `GameFlow.update` (menus, pause, fin de course) peut démarrer ou arrêter une course.
3. Pour chaque vue (1 ou 2) :
   - `RaceView.update` : caméra (cockpit, poursuite, face, bord de piste), lacet, tangage,
     étirement de perspective, vibrations, puis `updateProjection` ;
   - `SceneBuilder.buildView` : parcourt les nœuds de la route du plus lointain au plus proche
     et écrit les quadrilatères (objets derrière les bandes hautes, bandes, objets devant,
     voitures, effets) ;
   - `CockpitLayer`, `EffectsLayer.buildFront`, `Hud.drawFront` écrivent le premier plan.
4. `Renderer.render` : une seule passe de rendu ; par vue : ciel + panoramas, sol, quadrilatères
   de scène, traits de vitesse, quadrilatères de premier plan ; puis la planche d'interface.

Ordre des plans (voir aussi la charte) : ciel → nuages → relief lointain → relief proche →
sol → décors et voitures (du fond vers l'avant) → effets → cockpit → interface.

## 4. Projection de route 2D

`road-projection.js` décrit la route devant l'observateur par des **nœuds** espacés de ~2,5 m :
distance le long de la piste `z`, décalage latéral cumulé `X(z)` (double intégration de la
courbure), altitude `Y(z)`. Un point (z, d, h) se projette par une seule division :

```
échelle = focale / z
x_écran = cx + (X(z) + d − d_caméra − z·tan(lacet)) · échelle
y_écran = cy + (Y_caméra − Y(z) − h) · échelle
```

La **table de lignes** donne, pour chaque ligne de pixels sous l'horizon, la profondeur du sol
le plus proche, le centre de la route, l'échelle et la distance piste. Elle est remplie du bas
vers le haut ; un segment masqué par une crête n'écrit rien. Le shader du sol lit cette table
et convertit chaque pixel en coordonnées piste (s, d) pour dessiner asphalte, lignes, vibreurs,
herbe, gravier avec un anti-crénelage analytique. Les sprites comparent leur profondeur à celle
de la ligne : c'est ce qui les cache derrière les crêtes, sans tampon de profondeur.

Limites assumées (classiques de la perspective simulée) : le sol est horizontal dans le sens
latéral, la profondeur est la distance le long de la piste (les épingles « sortent » de
l'écran), le lacet de la vue est borné (au-delà de 100° la vue se retourne).

## 5. Chaîne graphique

- **Dessins** : fonctions `(ctx, w, h, palette, rnd)` en chemins vectoriels Canvas 2D, exécutées
  au chargement (dessins communs) ou au chargement d'un circuit (décors du thème, panoramas).
- **Atlas** : `AtlasBuilder` range les dessins dans des couches 2048² (6 couches communes,
  4 par thème) avec marges et débord horizontal pour les bandes répétées ; mipmaps générés.
- **Monoplace** : `car-model.js` décrit la voiture en volumes (comme un crayonné de
  construction) ; les volumes qui se pénètrent (pontons, capot, prise d'air, épaules du pilote)
  sont rognés l'un par l'autre le long de leur surface (`trimPart`) pour se rejoindre sur une
  ligne nette ; `car-illustrator.js` projette et encre le tout : aplats par ton découpés le long
  des frontières d'ombre, contours trouvés sur le volume (silhouette lourde, arêtes et jonctions
  légères, trait plus épais dessous). Les grandes illustrations portent le numéro de course. 25 vues de 0° à 180° en deux couches (couleurs fixes + masque de
  livrée) ; la livrée est appliquée par le shader (3 couleurs par écurie).
- **Cockpit** : mêmes outils, depuis l'œil du pilote avec la focale du jeu ; calques séparés
  (aileron, roue par angle de braquage et phase de roulement, coque + suspension + rétroviseur,
  cadran, aiguille, volant + mains).
- **Menus** : planches peintes dans un canvas à la taille de l'écran quand leur contenu change,
  puis composées par le shader `blit` (avec volet de transition en bandes obliques).

### Remplacer un dessin procédural par une illustration

1. Les décors : `registerSceneryPainters({ 'tree.pine': monDessin })` ou remplacer l'entrée dans
   `art/environments/*.js`. Un « peintre » peut simplement faire `ctx.drawImage(image, 0, 0, w, h)`.
2. Tailles et dimensions réelles : `art/environments/scenery-specs.js`.
3. Voitures : fournir 25 paires d'images (couleurs fixes + masque) à `ArtLibrary.buildCars`, ou
   remplacer `drawCarFitted`.
4. Rien d'autre ne change : simulation, disposition des décors et scène ne connaissent que des
   identifiants et des tailles.

## 6. Modes de jeu, déroulement

`gameplay/sessions.js` : une session produit des configurations de course et interprète un
résultat (`TrainingSession`, `SingleRaceSession` pour Turbo et duel, `ArcadeSession`,
`ChampionshipSession`). `ui/game-flow.js` est l'automate menus → planche d'introduction →
course → pause → résultats → suite ; c'est le seul module qui touche à la sauvegarde.

## 7. Allocations et performances

- La boucle de rendu n'alloue pas dans le code du jeu : quadrilatères, lignes, uniformes,
  particules, traces, cartouches et textes écrivent dans des tableaux typés pré-alloués ; les
  nombres du HUD sont formatés dans un `TextBuffer`.
- Restent inévitables : les objets que l'API WebGPU crée à chaque image (`getCurrentTexture`,
  `createView`, `createCommandEncoder`, `beginRenderPass`, `finish`) et, quand la mesure GPU est
  activée (benchmark), la promesse de lecture des requêtes d'horodatage.
- Les planches de menus et la planche d'introduction sont repeintes hors course uniquement.
- Coût d'une image : 4 à 5 appels de dessin par vue, 1 000 à 2 500 quadrilatères.

## 8. Livrable unique

`work/scripts/build.mjs` concatène les modules ES de `src/` (import/export nommés) dans une
fonction auto-exécutée et l'insère avec la feuille de style dans `src/ui/index.template.html`.
Le fichier produit ne référence aucune ressource externe (vérifié par le test navigateur).
