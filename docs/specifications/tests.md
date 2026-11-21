# Résultats des tests

Tous les tests sont reproductibles : `npm test` (Node, sans navigateur) et
`npm run test:browser` (Playwright + Chromium + WebGPU, sur le fichier `index.html` réel).
Dans le conteneur de développement, WebGPU est exécuté par le rasteriseur logiciel
SwiftShader derrière un serveur X virtuel (Xvfb) : les tests vérifient le comportement et
l'image, pas la vitesse.

## 1. Tests de simulation et de logique (Node) — 49 / 49 réussis

Dernière exécution : `npm test` → 49 tests, 49 réussis, 0 échec (environ 5 s).

### Conduite — `tests/unit/physics.test.mjs`

- ✅ acceleration: 0-100 km/h in 2-4 s, 0-200 km/h in under 8 s, top speed above 300 km/h
- ✅ braking: 200 km/h to standstill in a short, plausible distance; brakes alone never push the car backwards
- ✅ steering turns the car in the commanded direction and grip limits cornering at speed
- ✅ more wing: more cornering grip at speed, lower top speed
- ✅ leaving the track: grass slows the car and cuts grip
- ✅ barrier contact: the car is kept inside, loses speed and reports the hit
- ✅ reset puts a stranded car back on the track, facing forward
- ✅ manual gearbox obeys shift requests; the simulation is deterministic

### Projection 2D — `tests/unit/projection.test.mjs`

- ✅ rows are filled from the bottom of the view up to the horizon without holes
- ✅ perspective: depth grows monotonically toward the horizon and scale shrinks
- ✅ straight road is centred; a right-hand corner bends the road to the right, a left-hand one to the left
- ✅ road centre line is continuous from row to row (no visual breaks) on every circuit sample
- ✅ elevation: climbing road rises on screen, crests hide what lies behind them
- ✅ projected points agree with the row table and place opponents correctly
- ✅ rear view mirrors lateral positions
- ✅ resizing the view scales the picture without changing its content
- ✅ camera yaw slides the road sideways proportionally to depth

### Course — `tests/gameplay/race.test.mjs`

- ✅ start: cars wait on the grid during the five lights, then are released together
- ✅ a complete race runs automatically: laps, timing, classification and finish are consistent
- ✅ progress: live positions always match the distance covered
- ✅ same seed, same race; different seed, different race
- ✅ attrition rules: tyres wear and fuel burns in racing mode, not in arcade mode

### Intelligence artificielle — `tests/gameplay/ai.test.mjs`

- ✅ a lone computer driver laps cleanly: stays on the road, no reset, no wall
- ✅ braking: corners are taken much slower than the straights, and the brakes are used
- ✅ traffic: overtakes happen, contacts are survived, the whole field finishes
- ✅ difficulty levels change the pace
- ✅ pit stops: with fast attrition, computer drivers stop for tyres or fuel and rejoin
- ✅ every circuit of the three seasons can be raced by the computer

### Multijoueur — `tests/integration/multiplayer.test.mjs`

- ✅ both players are in the same race with their own cars
- ✅ controls are independent: one accelerates and turns, the other brakes
- ✅ common classification contains both players and the computer drivers
- ✅ players collide with each other
- ✅ split screen: two non-overlapping views, top/bottom by default, side by side on request
- ✅ each view projects the road from its own car
- ✅ duel session produces a two-player race configuration

### Animation — `tests/unit/animation.test.mjs`

- ✅ car views: turning a car through 360 degrees walks through neighbouring drawings only
- ✅ front wheels: rolling marks advance in step with the distance travelled
- ✅ front wheels: steering frames are symmetric and monotonic
- ✅ speed effects grow with speed and are smooth from frame to frame
- ✅ each effect can be switched off on its own
- ✅ impacts jolt the view briefly, then the picture settles

### Contenu et données — `tests/unit/content.test.mjs`

- ✅ three seasons of six original circuits, each a closed, drivable loop
- ✅ scenery layout: deterministic, every object has a drawing, objects stay off the road
- ✅ palettes: every theme defines every colour name
- ✅ localisation: French and English dictionaries have the same keys; placeholders are filled
- ✅ storage: saves and reloads settings, records and championship; survives broken data
- ✅ championship: qualifying grid, points for the first six, standings, season end
- ✅ game modes: arcade progression and score, championship round, training
- ✅ HUD number formatting is exact and allocation-free

## 2. Tests navigateur — `tests/rendering/smoke.browser.mjs` — 13 / 13 réussis

- ✅ création du périphérique WebGPU
- ✅ aucune requête réseau : le fichier fonctionne hors ligne
- ✅ ordre des plans : ciel en haut de l'image
- ✅ ordre des plans : asphalte sous l'horizon
- ✅ ordre des plans : cockpit (pneu avant) par-dessus la route
- ✅ ordre des plans : cartouche d'interface par-dessus tout
- ✅ pas de scintillement : deux images successives identiques à l'arrêt
- ✅ scène émise sans dépassement de tampon
- ✅ la course tourne et l'image change
- ✅ redimensionnement : composition conservée
- ✅ écran partagé haut/bas : deux vues indépendantes
- ✅ écran partagé gauche/droite : deux vues indépendantes
- ✅ aucune erreur de console ni de validation WebGPU

## 3. Déroulement complet des modes — `work/scripts/flow-check.mjs` — réussi

Pilotage du vrai jeu par le clavier simulé, le joueur étant conduit par l'ordinateur :

| Étape | Résultat |
|---|---|
| Menu → Turbo → course d'un tour → planche de résultats → menu | ✅ |
| Arcade, première manche (12 voitures) → résultats | ✅ |
| Deux joueurs (écran partagé) → course → résultats | ✅ |
| Championnat : qualification (tour lancé) → grille → course de 5 tours à 16 voitures → classement et points | ✅ |
| Aucune erreur de console | ✅ |

Une course complète s'exécute donc automatiquement de bout en bout, en simulation pure
(`race.test.mjs`, `ai.test.mjs` : les 18 circuits) comme dans le navigateur.

## 4. Audio — `work/scripts/audio-check.mjs` — 80 contrôles réussis

Rendu hors ligne du moteur audio sur un scénario scripté : niveaux par seconde, absence
d'écrêtage et de NaN, centroïde spectral croissant avec le régime, différence accélérateur
ouvert/fermé, creux de passage de rapport, effet Doppler et panoramique d'un concurrent,
chaque événement audible isolément, silence en pause et hors course.

## 5. Ce que les tests ont trouvé

- Les pilotes ordinateur n'effectuaient jamais leur arrêt au stand (ils ralentissaient à
  1,5 m/s sans s'immobiliser) : corrigé (`ai/driver-ai.js`), test « pit stops » ajouté.
- Quitter une course depuis la pause laissait une image se dessiner sans course : corrigé
  (ordre de mise à jour dans `GameApp.present`).

## 6. Non couvert par des tests automatiques

Manettes et souris réelles, écoute du son, jugement des sensations de pilotage, navigateurs
autres que Chromium, performances sur carte graphique (voir `incomplete-features.md`).
