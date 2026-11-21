# Résultats des tests

Tous les tests sont reproductibles : `npm test` (Node, sans navigateur) et
`npm run test:browser` (Playwright + Chromium + WebGPU, sur le fichier `index.html` réel).
Dans le conteneur de développement, WebGPU est exécuté par le rasteriseur logiciel
SwiftShader derrière un serveur X virtuel (Xvfb) : les tests vérifient le comportement et
l'image, pas la vitesse.

## 0. Dernière exécution complète

Sur le build final (`index.html`, 1 025 302 octets), le 21 novembre 2026, après le travail
sur les collisions :

| Suite | Commande | Résultat |
|---|---|---|
| Simulation et logique | `npm test` | 71 / 71 |
| Navigateur (WebGPU) | `node tests/rendering/smoke.browser.mjs` | 13 / 13 |
| Modes de jeu de bout en bout | `node work/scripts/flow-check.mjs` | réussi (5 parcours) |
| Pages, pause, caméras, souris | `node work/scripts/pages-check.mjs` | 14 / 14 |
| Audio | `node work/scripts/audio-check.mjs` | 80 / 80 |
| Conduite (non-régression) | `node work/scripts/driving-report.mjs` | 165 valeurs identiques à l'état précédent |

Le test navigateur a d'abord donné 12 / 13 : son point de contrôle « pneu avant par-dessus la
route » tombait sur le rétroviseur, déplacé par ce travail. Le point a été replacé sur la
bande de roulement ; l'image elle-même était correcte.

## 1. Tests de simulation et de logique (Node) — 71 / 71 réussis

Dernière exécution : `npm test` → 71 tests, 71 réussis, 0 échec (environ 8 s).

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

### Collisions au sol — `tests/gameplay/collisions.test.mjs`

Scénarios E2 et E4 du rapport d'analyse rejoués dans la simulation, avec des tolérances (les
mesures de la vidéo sont approximatives). Détail : `collisions.md`.

- ✅ E4 rear-end bump: the follower loses 48 km/h, keeps its line, the leader is not disturbed
- ✅ E4 rear-end bump at a higher closing speed: the follower is brought down to the speed of the car ahead
- ✅ repeated bumps: each new contact costs again, but never more often than the cooldown
- ✅ E2 wheel-to-wheel side contact: about 90 km/h lost by the faster car, no swerve, a spark between the wheels
- ✅ damage rule (competition): a bump or a launch damages both cars as any contact did; no damage in arcade rules
- ✅ simple contact: cars crossing at an angle exchange an impulse, without fixed penalty
- ✅ contact dive of the view: 5 to 8 % of the view height, over in 0.4 s, driven by the car clock
- ✅ roadside boards: solid objects on the verge, never on the asphalt, the same for the race and the scenery
- ✅ hitting a board below the launch speed: knocked down once, speed cut, the car drives on
- ✅ straight stretch helper finds a flat straight on the test track

### Décollages et accidents — `tests/gameplay/accidents.test.mjs`

Scénarios E3 et E5 du rapport.

- ✅ E3 launch: wheel over wheel at a high closing speed throws the follower in the air; the car ahead drives on
- ✅ E3 flight: 0.85 s, slowing by 50 km/h per second, rising then coming down
- ✅ E3 hard landing: speed cut to about 15 %, standstill within a second, 3.2 s stopped, restart on the spot in first gear
- ✅ a wrecked or flying car cannot be hit, and the restarting car is protected for a moment
- ✅ E5 launch on a board: thrown in the air, light landing without loss of speed nor explosion, slide, then back on the track
- ✅ launch conditions are explicit: no flight below the speed, the closing speed or outside the overlap window
- ✅ pitch of the view (E3, hard): nose up and held, steady swing, ground held, rebound, second dip, level again
- ✅ pitch of the view (E5, light): same script, shorter, second dip partial; trembling only while sliding
- ✅ the staging depends only on the simulated state: same values whatever the display rate, nothing for the other player
- ✅ explosion: four phases in order, 1.25 s of fire, plumes until 1.6 s

### Multijoueur — `tests/integration/multiplayer.test.mjs`

- ✅ both players are in the same race with their own cars
- ✅ controls are independent: one accelerates and turns, the other brakes
- ✅ common classification contains both players and the computer drivers
- ✅ players collide with each other (deux assertions adaptées au nouveau modèle : la voiture
  qui percute perd de la vitesse au lieu de pousser, celle de devant est à peine poussée)
- ✅ split screen: two non-overlapping views, top/bottom by default, side by side on request
- ✅ each view projects the road from its own car
- ✅ duel session produces a two-player race configuration

### Animation — `tests/unit/animation.test.mjs`

- ✅ car views: turning a car through 360 degrees walks through neighbouring drawings only
- ✅ front wheels: rolling marks advance in step with the distance travelled
- ✅ front wheels at speed: the streaks cycle forward with the distance travelled, faster with speed, the same at any display rate
- ✅ mirrors: the cockpit shows the mirrors of the car model where the driver would see them
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

## 4. Pages secondaires, caméras, souris — `work/scripts/pages-check.mjs` — 14 / 14 réussis

Pilotage du vrai jeu par le clavier et la souris simulés, avec une capture de chaque page
(`work/renders/pages-*.png`) :

- ✅ ouverture de la page Options, changement de langue français → anglais → français (la
  page est repeinte dans la langue choisie)
- ✅ pages Effets graphiques et Commandes, retour par Échap jusqu'au menu principal
- ✅ clic de souris sur une entrée de menu (ouvre la page visée)
- ✅ une course lancée après avoir utilisé Échap dans les menus démarre normalement
- ✅ Échap met en pause, Échap ou « Reprendre » relance la course
- ✅ la touche de caméra parcourt les quatre vues (cockpit, poursuite, face, bord de piste)

`work/scripts/trackside-check.mjs` enregistre une suite d'images de la caméra de bord de
piste (`work/renders/trackside-*.png`) : vérification visuelle que la voiture suivie reste
cadrée pendant son approche et que la caméra se replace après son passage.

## 5. Audio — `work/scripts/audio-check.mjs` — 80 contrôles réussis

Rendu hors ligne du moteur audio sur un scénario scripté : niveaux par seconde, absence
d'écrêtage et de NaN, centroïde spectral croissant avec le régime, différence accélérateur
ouvert/fermé, creux de passage de rapport, effet Doppler et panoramique d'un concurrent,
chaque événement audible isolément, silence en pause et hors course.

## 5 bis. Scénarios de collision dans le vrai jeu — `work/scripts/collision-sequences.mjs`

Les scénarios E2, E3 (cockpit et vue arrière), E4 et E5 sont joués dans `index.html`, deux pas
de simulation par image, et enregistrés à 60 images par seconde avec la télémétrie de chaque
image (`work/renders/collisions/`). Ce n'est pas un test à assertions : les événements
attendus sont relevés dans le journal, les images sont à regarder. Les valeurs chiffrées sont
comparées au rapport par `work/scripts/collision-comparison.mjs` (tableau dans
`collisions.md`).

Non-régression de la conduite : `work/scripts/driving-report.mjs` donne des valeurs
identiques avant et après ce travail (`work/benchmarks/driving-report-before.json`).

## 6. Ce que les tests ont trouvé

- Les pilotes ordinateur n'effectuaient jamais leur arrêt au stand (ils ralentissaient à
  1,5 m/s sans s'immobiliser) : corrigé (`ai/driver-ai.js`), test « pit stops » ajouté.
- Quitter une course depuis la pause laissait une image se dessiner sans course : corrigé
  (ordre de mise à jour dans `GameApp.present`).
- Un appui sur Échap dans les menus restait mémorisé et mettait la course suivante en pause
  dès son départ ; Échap ne permettait pas non plus de quitter la pause : corrigé
  (`InputManager.clearEdges`), contrôles ajoutés dans `pages-check.mjs`.
- La caméra de bord de piste ne cadrait pas la voiture quand la route tournait entre la
  caméra et elle : corrigé (visée calculée sur la position projetée de la voiture).
- Les noms de touches de la page Commandes n'étaient pas traduits : corrigé (dictionnaires).
- Collisions : avec la pénalité de vitesse complète, les voitures de l'ordinateur perdaient
  2 à 5 % sur une course et se touchaient en série : pénalité réduite pour elles
  (`computerPenaltyScale`), délai d'une seconde entre deux pénalités, et la voiture qui subit
  un contact latéral ne paie pas à son tour.
- Séquences enregistrées : l'explosion puis l'étincelle de contact du joueur étaient
  dessinées dans le monde, donc cachées par le cockpit ou hors du champ : elles sont
  maintenant posées sur le dessin du cockpit (roue avant touchée, pointe du nez).
- Relecture : en mode compétition, la règle des dégâts ne s'appliquait plus aux tamponnages
  ni aux contacts de décollage (seulement aux contacts simples) : rétablie à la même échelle,
  test ajouté. Sur trois courses en règles de compétition, le total des dégâts du peloton
  reste du même ordre qu'avant (0,89 / 2,32 / 1,11 contre 1,12 / 0,88 / 1,11), sans abandon.
- Roues avant : au-delà de 61 km/h le pneu était un dessin fixe (0 % de pixels changeant
  d'une image à l'autre à 120 km/h) : corrigé, mesure dans `wheels-and-mirrors.md`.

## 7. Non couvert par des tests automatiques

Manettes et souris réelles, écoute du son, jugement des sensations de pilotage, navigateurs
autres que Chromium, performances sur carte graphique (voir `incomplete-features.md`).
