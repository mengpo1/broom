# Résultats des tests

Tous les tests sont reproductibles : `npm test` (Node, sans navigateur) et
`npm run test:browser` (Playwright + Chromium + WebGPU, sur le fichier `index.html` réel).
Dans le conteneur de développement, WebGPU est exécuté par le rasteriseur logiciel
SwiftShader derrière un serveur X virtuel (Xvfb) : les tests vérifient le comportement et
l'image, pas la vitesse.

## 0. Dernière exécution complète — rapport de non-régression

Sur le build final (`index.html`, 1 112 050 octets), le 23 novembre 2026, après le lot
« analyse vidéo du braquage prolongé » (prototype expérimental de direction en deux phases,
banc de direction ; **conduite par défaut inchangée**) :

| Suite | Commande | Résultat |
|---|---|---|
| Simulation et logique | `npm test` | 108 / 108 (les 96 précédents, inchangés ; 12 nouveaux : variantes expérimentales et banc de direction) |
| Navigateur (WebGPU) | `node tests/rendering/smoke.browser.mjs` | 13 / 13 |
| Modes de jeu de bout en bout | `node work/scripts/flow-check.mjs` | réussi (5 parcours) |
| Pages, pause, caméras, souris | `node work/scripts/pages-check.mjs` | 14 / 14 |
| Audio | `node work/scripts/audio-check.mjs` | 80 / 80 |
| Banc d'essai des collisions | `node work/scripts/lab-check.mjs` | 19 / 19 |
| Banc de direction et option expérimentale | `node work/scripts/steerlab-check.mjs` | 31 / 31 (§ 5 ter) |

Ce qui devait être conservé, et comment c'est vérifié :

| Élément validé | Vérification | Résultat |
|---|---|---|
| Conduite par défaut strictement identique à la PR #4 | `node work/scripts/driving-trace.mjs <src>` : empreinte SHA-256 de quatre courses complètes (8 voitures, 9000 pas, un joueur au clavier scripté ; position, cap, vitesse, direction, glissade, lacet, glissement, état de chaque voiture à chaque pas), calculée sur les sources de la PR #4, de la PR #5 et de cette branche | **quatre empreintes identiques** pour les trois sources (`work/benchmarks/driving-trace.txt`) |
| Accélération, freinage, adhérence, direction de référence | `node work/scripts/driving-report.mjs` comparé à la PR des collisions validées et à la PR #4 | **165 valeurs identiques** ; `car-spec.js` non modifié ; test « steering reference » inchangé et réussi |
| Variante absente, `a` ou nom inconnu | test *unset, the name of the reference or an unknown name, a race is the validated driving to the last bit* | identique au bit près ; aucun état expérimental n'est touché |
| Tamponnage arrière (E4), contact roue contre roue (E2), panneau (E5), accident violent (E3, E3x) | `node work/scripts/collision-sequences.mjs all` : télémétrie de chaque image comparée à celle de la PR des collisions validées et aux fichiers du dépôt | **identique image par image** : E2 192, E3 570, E3x 252, E4 600, E5 390 images (et les 480 images de E3x, HOP et HOPx du dépôt) |
| Mêmes contacts, en simulation | `node work/scripts/collision-comparison.mjs` | toutes les valeurs chiffrées E1–E5 identiques |
| Animation des roues à grande vitesse (validée au troisième essai) | dans `cockpit-layer.js`, seuls le choix du dessin de braquage et l'angle du volant passent par une branche réservée aux variantes ; les fonctions de rotation des roues et les dessins de pneus sont inchangés ; tests d'animation | inchangée ; 13 / 13 tests d'animation |
| Sauts récupérables, rétroviseurs (PR #5) | code inchangé ; tests du saut et « mirror proposals » | inchangés |
| Affichage du braquage de la conduite validée | test *the cockpit shows the lock that is simulated, never more* ; contrôle navigateur sans option | inchangé : butée, 54° de volant, rien de plus |

Mesures du prototype, tenues à part des références validées : `work/benchmarks/held-steering.json`,
`work/renders/steering/telemetry-*.json` (`held-steering.md`).

Pendant ce lot, le contrôle du banc de direction a d'abord donné 29 / 31 : son point « touche
tenue dans une course normale » braquait à fond dès le départ arrêté, et la voiture finissait
dans le mur des stands avant d'avoir roulé. Le point attend maintenant 110 km/h en ligne
droite avant de braquer ; le jeu n'était pas en cause.

Exécutions précédentes : 23 novembre, lot du troisième essai (build de 1 073 723 octets, saut
récupérable rendu occasionnel, propositions de rétroviseurs, diagnostic du braquage) : 96 / 96,
13 / 13, 5 parcours, 14 / 14, 80 / 80, 19 / 19, 165 valeurs identiques. 22 novembre (build de 1 068 261 octets, lot « saut récupérable, roues
à très haute vitesse, rétroviseurs rapprochés ») : 91 / 91, 13 / 13, 5 parcours, 14 / 14,
80 / 80, 19 / 19, 165 valeurs identiques. 21 novembre (build de 1 035 351 octets, travail sur
les collisions) : 76 / 76, 13 / 13, 5 parcours, 14 / 14, 80 / 80, 165 valeurs identiques ; le
test navigateur avait d'abord donné 12 / 13 (son point de contrôle « pneu avant par-dessus la
route » tombait sur le rétroviseur, déplacé par ce travail-là ; le point a été replacé sur la
bande de roulement, l'image elle-même était correcte).

Incident d'outillage pendant le lot précédent : avec le rasteriseur logiciel, les scripts qui
mettaient en file beaucoup d'images sans attendre le processeur graphique voyaient parfois le
navigateur abandonner son périphérique graphique (« A valid external Instance reference no
longer exists »), d'où des captures à refaire. Le chien de garde graphique du navigateur
automatisé est coupé (`--disable-gpu-watchdog`, `lib-browser.mjs`) et les scripts de capture
attendent après chaque image. Le jeu n'est pas concerné.

## 1. Tests de simulation et de logique (Node) — 108 / 108 réussis

Dernière exécution : `npm test` → 108 tests, 108 réussis, 0 échec (environ 7 s) : les 96 tests
du lot précédent, inchangés, et douze nouveaux (variantes expérimentales de direction, banc de
direction).

### Conduite — `tests/unit/physics.test.mjs`

- ✅ acceleration: 0-100 km/h in 2-4 s, 0-200 km/h in under 8 s, top speed above 300 km/h
- ✅ braking: 200 km/h to standstill in a short, plausible distance; brakes alone never push the car backwards
- ✅ steering turns the car in the commanded direction and grip limits cornering at speed
- ✅ more wing: more cornering grip at speed, lower top speed
- ✅ leaving the track: grass slows the car and cuts grip
- ✅ barrier contact: the car is kept inside, loses speed and reports the hit
- ✅ reset puts a stranded car back on the track, facing forward
- ✅ manual gearbox obeys shift requests; the simulation is deterministic
- ✅ steering reference: the stop is reached in a quarter of a second and holding the key adds nothing; no slide, no spin *(nouveau : garde-fou de la direction validée, voir `steering-study.md`)*

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

- ✅ E4 rear-end bump when following closely: the follower loses about 48 km/h, keeps its line, the car ahead is not disturbed
- ✅ E4 rear-end bump at a higher closing speed: the loss grows with the closing speed
- ✅ repeated bumps: every bump separates the cars; the next one needs a new approach, there is no pushing
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
- ✅ E3 flight: the car comes down behind the car it rode over, which drives away ahead
- ✅ E3 flight: 0.85 s, slowing by 50 km/h per second, rising then coming down
- ✅ E3 hard landing: speed cut to about 15 %, standstill within a second, 3.2 s stopped, restart on the spot in first gear
- ✅ a wrecked or flying car cannot be hit, and the restarting car is protected for a moment
- ✅ a computer driver steers round a wreck instead of driving through it
- ✅ E5 launch on a board: thrown in the air, light landing without loss of speed nor explosion, slide, restart from where it stopped
- ✅ launch conditions are explicit: three levels by energy, and no flight outside the overlap window *(modifié, § 1 bis)*
- ✅ pitch of the view (E3, hard): nose up and held, steady swing, ground held, rebound, second dip, level again
- ✅ pitch of the view (E5, light): same script, shorter, second dip partial; trembling only while sliding
- ✅ the staging depends only on the simulated state: same values whatever the display rate, nothing for the other player
- ✅ seen from outside: a car in flight is tilted (nose up then down, the side that was hit lifted) and flattened as it lands
- ✅ explosion: four phases in order, 1.25 s of fire, plumes until 1.6 s

### Saut récupérable — `tests/gameplay/hop.test.mjs`

Niveau intermédiaire entre le contact sans décollage et l'accident violent, rendu occasionnel
après le troisième essai. Les huit tests demandés à l'origine sont marqués d'un numéro ; ceux
qui portent sur la géométrie et la fréquence des sauts sont marqués *(géométrie)* ou
*(fréquence)*.

- ✅ **(1 — saut récupérable)** recoverable hop: wheels interlocked at a medium closing speed lift the car behind; a short flight, it comes down on its wheels
- ✅ the speed of a hop is lost where its cause is seen: at the shock and during the flight, none as the wheels touch down
- ✅ *(géométrie)* recoverable hop from the side: a front wheel still behind the rear wheel is lifted; wheels side by side only rub (E2)
- ✅ **(2 — reprise du contrôle)** after a hop the driver has the car back: the steering swings once and settles, then answers as on any car
- ✅ **(3 — pas d'immobilisation)** a hop never stops the car: no standstill, no explosion, no repositioning, it accelerates again
- ✅ *(géométrie)* what triggers a hop is a front wheel behind a rear wheel: neither the nose on a wheel nor the nose in the gearbox
- ✅ *(géométrie, nouveau)* wheel geometry: the test of a front wheel behind a rear wheel uses the dimensions of the car model
- ✅ *(fréquence, nouveau)* no series of hops behind one car: for a while after the landing, a new contact with the same car is an ordinary bump
- ✅ *(fréquence, nouveau)* frequency: in full races the hop is occasional, and every one of them is a front wheel behind a rear wheel with enough energy
- ✅ **(4 — non-déclenchement à faible énergie)** low energy: below the hop thresholds nothing changes, the validated contacts keep their outcome
- ✅ **(5 — maintien d'E3)** the hard accident E3 is kept: same contact with more energy, hard landing, wreck
- ✅ **(6 — maintien d'E5)** the launch on a board E5 is kept: light landing, slide, no hop
- ✅ **(7 — déterminisme à 120 Hz)** deterministic at 120 Hz: the same hop gives the same race, step for step
- ✅ **(8 — pas de traversée)** no car is driven through: in flight and at the landing the hopping car stays clear of every other car
- ✅ a car that has just come down cannot be thrown in the air again at once
- ✅ the landing of a hop is settled before contacts are looked for, whichever car comes first in the list

Le garde-fou de fréquence joue quatre courses complètes de 16 voitures (deux circuits, deux
jeux de règles, toujours les mêmes) : avec les premières règles elles donnaient 10 sauts ; le
test en accepte quatre au plus, deux au plus par course, et vérifie pour chacun la géométrie et
l'énergie. Aujourd'hui elles en donnent deux.

### Variantes expérimentales de direction et banc — `tests/gameplay/steering-variants.test.mjs`

Tous nouveaux. Ils gardent les deux côtés : la conduite validée reste exactement ce qu'elle
était quoi qu'on demande par erreur, et les variantes font ce que disent leurs réglages.

- ✅ steering variants: the reference has no parameters; names, copies with other settings, unknown names
- ✅ steering variants: unset, the name of the reference or an unknown name, a race is the validated driving to the last bit
- ✅ steering variants: for the cars a player drives only; changed and removed during a race
- ✅ steering variants: the same manoeuvre gives the same result every time
- ✅ steering variants: two phases at the instants their numbers give
- ✅ steering variants: B2 and B3 are today's steering until phase 2 starts; B1 never exceeds today's lock
- ✅ steering variants: what phase 2 does - scrub for B2, a slide that ends in a spin for B3, recovery when released in time
- ✅ steering variants: nothing at low speed, where the lock is the mechanical one, and nothing below the hold threshold
- ✅ steering variants: road curvature - phase 2 of B3 builds up faster in a bend that asks for more than the car can give
- ✅ steering variants: the cockpit shows the lock that is simulated, never more
- ✅ steering bench: a development circuit outside the catalogue, bends of several radii both ways, demonstrations on real bends
- ✅ steering bench: the circuit of the reference passage - the validated car, driven with the keys assumed from the footage, follows it

### Multijoueur — `tests/integration/multiplayer.test.mjs`

- ✅ both players are in the same race with their own cars
- ✅ controls are independent: one accelerates and turns, the other brakes
- ✅ common classification contains both players and the computer drivers
- ✅ players collide with each other (deux assertions adaptées au nouveau modèle : la voiture
  qui percute perd de la vitesse au lieu de pousser, celle de devant garde la sienne)
- ✅ split screen: two non-overlapping views, top/bottom by default, side by side on request
- ✅ each view projects the road from its own car
- ✅ duel session produces a two-player race configuration

### Animation — `tests/unit/animation.test.mjs`

- ✅ car views: turning a car through 360 degrees walks through neighbouring drawings only
- ✅ front wheels: rolling marks advance in step with the distance travelled *(modifié, § 1 bis)*
- ✅ front wheels at speed: the streaks cycle forward with the distance travelled, faster with speed, the same at any display rate *(modifié, § 1 bis)*
- ✅ front wheels: the marks fade into the streaks between two speeds, without a jump from one drawing to the other
- ✅ front wheels at speed: the streak pattern slides as one piece, in the direction of the rolling marks
- ✅ front wheels near top speed: a third drawing, the tyre turning very fast, fades in over the rows of dashes *(nouveau)*
- ✅ front wheels near top speed: trails and rings round the tyre, moving as one piece the same way as the marks *(nouveau)*
- ✅ mirrors: the cockpit shows the mirrors of the car model where the driver would see them *(complété, § 1 bis)*
- ✅ mirror proposals: closer mounts are available on request only, each one drawn from the same definition in every view *(nouveau)*
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

## 1 bis. Tests existants modifiés par le lot « saut récupérable, roues, rétroviseurs »

Quatre des 76 tests précédents ont été touchés. Aucune assertion sur un comportement validé
n'a été retirée ; les autres tests sont inchangés.

| Test | Modification | Raison |
|---|---|---|
| `accidents.test.mjs` — *launch conditions are explicit…* | Le test disait « pas de vol » pour tout cas en dessous des seuils de l'accident. Il énonce maintenant les trois niveaux (rien, saut, accident). Un de ses cas — roue sur roue à 170 km/h sur une voiture à 100 — donne désormais un saut ; un cas a été ajouté (trop lent même pour un saut). Les deux cas de l'accident et leurs seuils sont inchangés | Le niveau intermédiaire demandé occupe par définition une partie de ce qui était « sans décollage » |
| `animation.test.mjs` — *front wheels: rolling marks…* | L'égalité `WHEEL_VARIANTS = TREAD_PHASES + STREAK_PHASES` devient `… + FAST_PHASES` | Une troisième famille de dessins du pneu a été ajoutée |
| `animation.test.mjs` — *front wheels at speed: the streaks cycle forward…* | La phase est lue quelle que soit la famille de dessins (près de la vitesse maximale, le dessin affiché est de la nouvelle famille, qui suit le même cycle) ; 250 et 330 km/h ajoutés aux vitesses vérifiées | Même raison ; les exigences (sens, cadence, indépendance de la cadence d'affichage) sont les mêmes et couvrent plus de vitesses |
| `animation.test.mjs` — *mirrors: the cockpit shows the mirrors…* | Assertions ajoutées : le boîtier ne touche pas le bord du cockpit, le bras part de ce bord | Vérifier l'absence de superposition après le rapprochement |

Deux tests **ajoutés par ce lot** ont ensuite été retouchés après la seconde revue
indépendante (ce ne sont pas des tests de la PR précédente) :

| Test | Modification | Raison |
|---|---|---|
| `hop.test.mjs` — *recoverable hop: wheels interlocked…* | L'écart de 48 km/h à l'atterrissage est vérifié par rapport à la vitesse de la voiture de devant **au moment du choc** (et l'écart à l'atterrissage doit être au moins aussi grand) | La perte de vitesse a été déplacée de l'atterrissage au choc (défaut A-1) : la voiture de devant peut avoir accéléré pendant le vol |
| `animation.test.mjs` — *front wheels near top speed: a third drawing…* | Le dessin est complet à 311 km/h et non plus à 300 ; part attendue à 300 km/h entre 85 et 97 % | La transition a été étirée jusqu'à la plus basse des vitesses maximales (défaut B-1 : plus rien ne changeait entre 300 km/h et la vitesse maximale) |

## 1 ter. Tests existants modifiés par le lot du troisième essai (fréquence des sauts)

Le saut récupérable n'existe plus que pour une roue avant derrière une roue arrière (voitures
décalées d'environ une voie) et avec plus d'énergie. Les tests du lot précédent qui
fabriquaient un saut avec un demi-décalage (0,93 m : le nez sur la roue) ou avec les roues côte
à côte ne pouvaient plus en produire. Ils ont été **déplacés sur la nouvelle géométrie** ; ce
qu'ils vérifient du saut lui-même (vol, atterrissage, reprise du contrôle, absence
d'immobilisation, déterminisme, pas de traversée) est inchangé. Aucune assertion sur un contact
validé (tamponnage, contact de roues, E3, E5) n'a été retirée ni assouplie.

| Test | Modification | Raison |
|---|---|---|
| `hop.test.mjs` — mise en place commune `rearHop` (utilisée par huit tests) | Décalage latéral 0,93 m → 1,7 m | Le pneu avant doit être derrière le pneu arrière ; à 0,93 m le contact est redevenu un tamponnage |
| `hop.test.mjs` — mise en place `sideHop` et test *recoverable hop from the side…* | La voiture arrive avec le nez engagé de 0,3 m le long de la queue (au lieu de 1,2 m derrière en dérivant) ; le cas « roue avant à côté de la roue arrière » est ajouté **avec l'issue inverse** : contact de roues à 96 km/h de pénalité | Par le côté, seule une roue avant encore derrière la roue arrière saute ; roues côte à côte, c'est de nouveau E2 |
| `hop.test.mjs` — *what triggers a hop…* (réécrit) | Il acceptait un saut pour tout décalage de 0,5 à 1,75 m ; il exige maintenant un saut de 1,55 à 1,8 m, un **tamponnage validé** (48 km/h de moins que la voiture de devant) de 0 à 1,4 m, l'accident E3 dans sa fenêtre à haute énergie | C'est la définition même du resserrement |
| `hop.test.mjs` — *low energy…* | Décalages portés à 1,7 m ; deux cas ajoutés (40 km/h d'écart ; 143 km/h) qui sautaient avec les premiers seuils et tamponnent maintenant | Seuils d'énergie relevés (45 km/h, 150 km/h) |
| `hop.test.mjs` — *the speed of a hop is lost…* | Une égalité stricte sur un nombre à virgule remplacée par une tolérance de 10⁻⁹ | Elle ne tenait que par hasard d'arrondi avec l'ancien cap de la voiture |
| `accidents.test.mjs` — *launch conditions are explicit…* | Le cas « 170 km/h sur une voiture à 100, demi-décalage » redevient « pas de vol », comme **avant le saut récupérable** ; un cas de saut avec sa propre géométrie est ajouté ; le seuil minimal attendu du saut passe de 30 à 41 km/h | Idem. Les cas et les seuils de l'accident lui-même n'ont jamais changé |

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

## 5 bis. Collisions dans le vrai jeu

**Banc d'essai** — `node work/scripts/lab-check.mjs` — 19 / 19 réussis. Le jeu est ouvert avec
l'option `#lab=hop`, la boucle tourne en temps réel et le clavier simulé passe par le vrai
chemin d'entrée : le saut est produit par les règles, la voiture est rendue au joueur (volant
et accélérateur vérifiés), l'accident E3 est rejoué, chaque touche (1 à 5, Entrée) est essayée ;
puis, sans l'option, ni les menus ni une course normale ne donnent accès au banc
(`collision-test-bench.md`).

**Séquences** — `work/scripts/collision-sequences.mjs`. Les cas E2, saut récupérable (cockpit et
vue arrière), E3 (cockpit et vue arrière), E4 et E5 sont joués dans `index.html` par ce même
banc, deux pas de simulation par image, et enregistrés à 60 images par seconde avec la
télémétrie de chaque image (`work/renders/collisions/`). Ce n'est pas un test à assertions : les
événements attendus sont relevés dans le journal, les images sont à regarder.

**Non-régression des contacts validés** : la télémétrie des séquences E2, E3, E3x, E4 et E5
(vitesse, état, position latérale, tangage de la vue, événements, image par image) est
**identique** à celle de la PR précédente. Les valeurs chiffrées E1–E5 de
`work/scripts/collision-comparison.mjs` sont identiques elles aussi ; ce script donne en plus
les chiffres du saut (`collisions.md` § 2 bis).

**Non-régression de la conduite** : `work/scripts/driving-report.mjs` donne des valeurs
identiques à la référence (`work/benchmarks/driving-report-before.json`), 165 sur 165.

**Roues avant** : `work/scripts/compare-wheels-video.mjs` enregistre l'état précédent et l'état
actuel côte à côte à 60 images par seconde, et l'état actuel seul à 30 et 144 ;
`work/scripts/wheel-motion-check.py` y mesure la cadence des changements de dessin, les plus
longues suites d'images identiques et le sens du mouvement (`wheels-and-mirrors.md`).

**Rétroviseurs** : `work/scripts/compare-mirror-proposals.mjs` ouvre le vrai jeu avec chaque
montage (`#mirrors=…`), capture la même scène sous les mêmes caméras et mesure sur l'image le
déplacement et la symétrie des deux côtés (`wheels-and-mirrors.md` § 2 ter).

**Fréquence des sauts** : `node work/scripts/hop-frequency.mjs <sortie.json> --seeds 11,23,37`
joue 108 courses complètes de l'ordinateur (18 circuits, deux jeux de règles, trois graines) et
relève chaque saut avec son énergie, sa géométrie, son caractère isolé ou en série et ce qui
suit l'atterrissage. Avant / après sur les mêmes courses : 205 → 32 sauts, temps du vainqueur
identique dans les 108 (`collisions.md` § 12, `work/benchmarks/hop-frequency-*.json`).

**Braquage maintenu** : `node work/scripts/steering-study.mjs` mesure la direction actuelle
(délai, angles, quatre secondes de plein braquage) sans rien modifier ; planche des positions
du cockpit par `node work/scripts/steering-positions.mjs` (`steering-study.md`).

**Ce qui déclenche un saut** : `node work/scripts/hop-trigger-table.mjs` (simulation seule)
donne l'issue du même contact par l'arrière pour neuf décalages latéraux et trois énergies
(`work/benchmarks/hop-trigger-table.json`, tableau dans `collisions.md` § 2 bis).

**Courses complètes de l'ordinateur** : `node work/scripts/race-contact-table.mjs` rejoue six
courses de 16 voitures avec l'ancien et le nouveau modèle de contact : temps du vainqueur et
meilleur tour identiques à la PR précédente dans les six ; 16 sauts au total
(`collisions.md` § 5).

**Revues indépendantes** : `work/reviews/collision-review.md` (PR précédente : 0 grave,
7 moyens, 13 mineurs ; suites dans `collisions.md` § 9) ; `work/reviews/second-test-review.md`
(ce lot : 0 grave, 3 moyens, 13 mineurs ; suites dans `collisions.md` § 10) ;
`work/reviews/second-test-recheck.md` (contre-vérification des corrections du saut et de la
planche des rétroviseurs : 4 confirmées, 2 partielles, 0 grave, 0 moyen ; `collisions.md` § 11).

## 5 ter. Braquage prolongé : banc de direction et mesures

**Dans le vrai jeu** : `node work/scripts/steerlab-check.mjs` ouvre `index.html#steerlab=b2`,
laisse tourner la boucle en temps réel et passe par le vrai clavier — 31 contrôles : le banc
s'ouvre seul en piste sur son circuit avec la variante demandée ; touche tenue, la phase 2
arrive et les chiffres affichés suivent ; relâchée, elle est rendue ; touches 1 à 4 (changement
de conduite sans repartir), 5 (démonstration), 6 (passage de la vidéo de référence), Entrée ;
`#steering=b3&phase2Delay=0.6` applique la variante et le réglage dans une course ordinaire,
pour la voiture du joueur seulement ; sans option ou avec un nom inconnu : ni banc, ni
variante, et une touche tenue 5 s en course ne laisse aucun état expérimental.

**Indépendance de la cadence d'affichage** : la démonstration jouée par la boucle du
navigateur (quelques images par seconde, irrégulières, avec le rasteriseur logiciel) donne
les mêmes instants, au millième, que la mesure faite par la simulation seule (butée 0,225 s,
crissement 0,417 s, début de phase 2 0,517 s, traces 0,950 s, fumée 1,283 s, fin de phase 2
1,517 s).

**Mesures** : `node work/scripts/held-steering.mjs` (direction tenue à quatre vitesses et
dans six virages, pour les quatre conduites, plus une ligne par profil de conduite →
`work/benchmarks/held-steering.json`) ; `node work/scripts/reference-passage-track.mjs`
(la piste ajustée sur le passage de la vidéo : la voiture validée y reste à 2,6 m de l'axe au
plus ; `--fit` refait l'ajustement) ; `node work/scripts/steering-sequences.mjs` (vidéos et
télémétrie des manœuvres) ; `python3 work/scripts/reference-steering-comparison.py` (vidéo de
référence et Virage GP côte à côte). Tout est décrit dans `held-steering.md`.

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
- Revue indépendante des séquences : la voiture en vol retombait devant la voiture heurtée,
  qui la traversait (la vidéo de référence la laisse derrière) ; après un tamponnage le
  contact restait collé une seconde puis une pénalité tombait sans nouveau choc ; une
  glissade se terminait par une remise en piste en coupe franche : corrigés, tests ajoutés.
- Saut récupérable : dans la séquence enregistrée, l'atterrissage était suivi d'un tamponnage
  parasite. La voiture qui retombait n'était remise à sa vitesse d'atterrissage qu'à son tour
  dans la liste des voitures, après l'examen de sa paire avec une voiture d'indice plus petit :
  corrigé (les atterrissages sont réglés avant toute recherche de contact), test ajouté. Les
  tests écrits d'abord ne le voyaient pas : la voiture qui sautait y avait toujours le plus
  petit indice.
- Roues avant : au-delà de 61 km/h le pneu était un dessin fixe (0 % de pixels changeant
  d'une image à l'autre à 120 km/h) : corrigé, mesure dans `wheels-and-mirrors.md`.

## 7. Non couvert par des tests automatiques

Manettes et souris réelles, écoute du son, jugement des sensations de pilotage, navigateurs
autres que Chromium, performances sur carte graphique (voir `incomplete-features.md`).
