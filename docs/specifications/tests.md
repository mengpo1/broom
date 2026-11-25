# Résultats des tests

Tous les tests sont reproductibles : `npm test` (Node, sans navigateur) et
`npm run test:browser` (Playwright + Chromium + WebGPU, sur le fichier `index.html` réel).
Dans le conteneur de développement, WebGPU est exécuté par le rasteriseur logiciel
SwiftShader derrière un serveur X virtuel (Xvfb) : les tests vérifient le comportement et
l'image, pas la vitesse.

## 0 bis. Dernière exécution complète — sécurisation de la PR #8

Sur le build final (`index.html`, 1 112 114 octets), après la sécurisation (attente en vol
bornée, voiture retirée, cas 7 du banc : `collisions.md` § 2 quater) et les suites des
passes de relecture indépendante (commit `81b5580`). Tout ce qui suit a été exécuté sur ce
build.

| Suite | Commande | Résultat |
|---|---|---|
| Simulation et logique | `npm test` | **129 / 129** : les 109 tests précédents inchangés et réussis ; 20 nouveaux (17 dans `flight-wait.test.mjs`, 2 dans `retired.test.mjs`, 1 dans `lab.test.mjs`) |
| Les nouveaux tests sur `dc8b823` | mêmes fichiers sur les sources du commit précédent | les tests de l'attente en vol échouent (vols de 4,3 à 5,3 s, voiture posée dans une autre) ; celui de la voiture retirée échoue sans le correctif. Les tests ajoutés après la relecture échouent sur le commit qui la précède (voiture posée en marche arrière ; voiture en attente de remise en piste ou dans l'entrée des stands ignorée ; vitesses de plusieurs milliers de m/s pour deux vols en attente). Les trois tests ajoutés après la seconde passe échouent sur `e102802` (hauteur qui remonte de 3,6 cm en un pas dans une attente à répétition ; décollage annulé par la file des stands ; attente de 3,62 s contre une voiture seule), et les contrôles de vitesse ajoutés à chaque vol font échouer 12 tests sur 14 sur `1a95e47` (jusqu'à 55 km/h perdus en un pas). Les deux tests ajoutés après la troisième passe échouent sur `f8494a8` (voiture posée 1,09 m dans une voiture de la voie des stands ; attente de 3,45 s contre une voiture seule). Le test ajouté après la quatrième passe échoue sur `01f7c7a` (voiture déplacée de 4,16 m en un pas par le muret) |
| Banc d'essai dans le vrai jeu | `node work/scripts/lab-check.mjs` | 27 / 27 (les 23 précédents ; 4 nouveaux sur le cas 7), deux exécutions |
| Braquage après restitution, clavier réel | `node work/scripts/steering-handover-check.mjs` | 51 / 51 (sept cas du banc et une course normale), deux exécutions de suite sur une machine au calme. Sur des builds précédents, pendant que d'autres calculs chargeaient la machine, ce contrôle avait donné 50 puis 49 sur 51 (fenêtres de mesure de 0,2 s, contrôles en échec différents d'une fois à l'autre) |
| Navigateur (WebGPU) | `node tests/rendering/smoke.browser.mjs` | 13 / 13 |
| Modes de jeu de bout en bout | `node work/scripts/flow-check.mjs` | réussi : arcade, duel, qualification, championnat menés jusqu'au classement, et le parcours des menus |
| Pages, pause, caméras, souris | `node work/scripts/pages-check.mjs` | 14 / 14 |
| Audio | `node work/scripts/audio-check.mjs` | 80 / 80, deux exécutions |
| Conduite | `node work/scripts/driving-report.mjs` | **165 valeurs identiques** à la PR #4 |
| Mesures de référence E1 à E5 | `node work/scripts/collision-comparison.mjs` | identiques au commit précédent : E1, E2, E4, E5 identiques à la PR #4 ; E3 avec les quatre différences voulues du lot 5 |
| Séquences du banc, télémétrie image par image | `node work/scripts/collision-sequences.mjs` | les dix séquences existantes (E2, HOP, HOPx, HOPslow, HOPslowx, BODY, E3, E3x, E4, E5) rejouées sur ce build : télémétrie **identique image par image** aux enregistrements du dépôt (3 840 images). HOLDx, HOLD et HOLDslowx (cas extrême) réenregistrées : attente de 0,63 s, 1,22 s en l'air, posée à 93 km/h sur une place libre |
| Pelotons hostiles | `node work/scripts/flight-wait-stress.mjs` | 1 000 pelotons, 1 573 vols : 0 voiture posée dans une autre (34 avant), vol le plus long 4,35 s (6,04 s avant), 1 remise en piste, aucun atterrissage mis en attente plus de deux fois (11 fois avant) ; 3 000 pelotons : 4 665 vols, 0 posée dans une autre, 0 vol non terminé, 3 remises en piste |
| Une voiture seule contre un vol | adversaires des relecteurs (`d_one_car`, `d2_one_car_reset`, `d3_one_car_brake`, recherche `c2_climb`), hors dépôt | 20 000, 30 000, 6 000 et 28 200 essais : aucun dernier recours ; au plus 2,22 s, 2,78 s (touche de remise en piste), 0,74 s et **3,17 s** au-delà de la durée prévue, pour une limite de 3,5 s |
| Courses à 20 voitures | `node work/scripts/dense-pack-races.mjs` | 54 courses terminées, temps des vainqueurs identiques au commit précédent ; 39 vols, attente la plus longue 1,11 s, aucune remise en piste, aucune voiture posée dans une autre |
| 21 courses à 16 voitures | `node work/scripts/race-rules-comparison.mjs` | temps des vainqueurs identiques à la PR #4 (4 268,55 s) ; 19 courses identiques au commit précédent dans tout ce qui est compté, les deux autres sont celles où un atterrissage attend |
| Comparaison pas à pas avec `dc8b823` (scripts des relecteurs) | deux simulations jumelles, chaque champ de chaque voiture à chaque pas | sur ce build : 400 arrivées, 2 pas diffèrent, tous deux un décollage avec une voiture déjà en vol. Par les relecteurs sur les commits relus : 18 000, 12 500, 3 500 puis 700 arrivées et 128 courses ; tous les pas qui diffèrent ont un vol dont l'atterrissage attend, ou un décollage avec une voiture déjà en vol |
| Déterminisme à 120 Hz | `npm test` | réussi |

Ce que cette exécution **ne** dit **pas** : que le comportement convient. L'attente au-dessus
d'une voiture, le recul, le dernier recours et les vols qui ne retombent pas devant sont à
juger à l'écran et à arbitrer (`lot5-validation.md` § 6).

### Attente à l'atterrissage — `tests/gameplay/flight-wait.test.mjs` (nouveau)

De vraies voitures conduites par leurs commandes ; un conducteur scripté « fait ce qu'il peut
pour rester sous la voiture en vol ». Pour chaque vol : il se termine dans la durée bornée, la
voiture n'est posée dans aucune voiture, elle est déplacée par sa seule vitesse, jamais plus
rapide qu'au décollage, sans saut de hauteur, et finit par un atterrissage.

- ✅ a third car puts itself under the car in flight and slows down with it until it has stopped there: the flight ends, on free ground
- ✅ a third car arrives under the car in flight during the flight, from behind, and keeps pace with it: the flight ends, on free ground
- ✅ a pack travels with the car that flies and fills every place where it could come down: the flight ends, on free ground
- ✅ the car that was flown over speeds up and keeps itself under the car in flight: the flight ends, on free ground
- ✅ against a barrier, a car under the car in flight: the flight ends, on free ground, inside the barriers
- ✅ two cars take off almost together towards the same place: neither comes down in the other, nor flies through it
- ✅ one car alone cannot keep a car in the air: whatever it does with its pedals and its wheel to stay under it, the landing waits a second or two at most *(225 vols)*
- ✅ last resort: when cars stay under it for the whole of the longest wait, the car is put back on a free place, never set down in one
- ✅ letting a crawling car go: the car drifts back off it, comes down STATIONARY, and is an ordinary car on the ground *(seconde relecture, constat 2)*
- ✅ two cars whose landings wait over each other: one gets clear of the other, their speeds stay those of cars *(seconde relecture, constat 1)*
- ✅ every car that is drawn counts under the landing place, whatever its state: one waiting to be put back, one in the pit entry *(seconde relecture, constat 7)*
- ✅ a car just ahead of the landing place that brakes hard: the car in flight lets it go once, it does not tailgate it in the air *(seconde passe, constat 11)*
- ✅ cars in the pit lane, behind the pit wall, change nothing to a take-off on the track *(seconde passe, constat 12)*
- ✅ one car alone using the reset key as well (it stops dead under the car in flight): not enough to reach the last resort *(seconde passe, constat 13)*
- ✅ a flight that begins in the pit entry and comes down in the pit lane: the cars queued there are under it like any others *(troisième passe, constat 18)*
- ✅ one car alone that stops dead under a car in flight still going fast: the car in flight flies on past it *(troisième passe, constat 19)*
- ✅ last resort for a car that came down over the pit lane: it is put back in the pit lane, on a free place, and stays there *(quatrième passe, constat 24 ; 100 voitures)*

Chaque vol de chaque test est aussi contrôlé sur trois points ajoutés après la seconde passe :
sa vitesse ne change pas de plus de 4 km/h par pas (hors barrière), il ne reprend pas plus de
33 km/h en l'air, et son atterrissage ne se met pas en attente plus de trois fois (six dans
les deux tests de vols construits à la main).

### Voiture retirée — `tests/gameplay/retired.test.mjs` (nouveau, correctif distinct)

- ✅ a retired computer car still on the track is an obstacle; once it has been taken off the track it is not
- ✅ a retired player car is never taken off the track: it stays where it stopped, drawn, and in the way

### Banc d'essai — ajouté à `tests/gameplay/lab.test.mjs`

- ✅ bench, case 7 (a third car stays under the car in flight): the landing waits, the car gets clear of it and comes down on free ground

## 0. Dernière exécution complète (livraison précédente de la PR #8, commit `dc8b823`)

Sur le build final (`index.html`, 1 085 255 octets), le 24 novembre 2026, après le lot 5
(« corrections après validation humaine de la PR #4 » : saut par contact de roues,
franchissement, rétroviseurs remontés, diagnostic du braquage) :

| Suite | Commande | Résultat |
|---|---|---|
| Simulation et logique | `npm test` | **109 / 109** : 76 tests de la PR #4 inchangés ; 15 réécrits ou adaptés aux règles demandées par le joueur, devenus 14 (voir § 1 ter) ; 19 nouveaux, dont 6 écrits pour les défauts trouvés par la relecture indépendante |
| Navigateur (WebGPU) | `node tests/rendering/smoke.browser.mjs` | 13 / 13 |
| Modes de jeu de bout en bout | `node work/scripts/flow-check.mjs` | réussi (5 parcours) |
| Pages, pause, caméras, souris | `node work/scripts/pages-check.mjs` | 14 / 14 |
| Audio | `node work/scripts/audio-check.mjs` | 80 / 80 |
| Banc d'essai des collisions | `node work/scripts/lab-check.mjs` | 23 / 23 (19 précédents, 4 nouveaux : retombée devant, cas 6) |
| Braquage après restitution du contrôle, clavier réel | `node work/scripts/steering-handover-check.mjs` | 44 / 44 (six cas du banc et une course normale) ; 37 / 37 sur les sources de la PR #4 |
| Conduite (non-régression) | `node work/scripts/driving-report.mjs` | **165 valeurs identiques** à la PR #4 et à la référence d'origine |
| Mesures de référence E1 à E5 | `node work/scripts/collision-comparison.mjs` | E1 (2 valeurs), E2 (13), E4 (31), E5 (14) : identiques à la PR #4. E3 : 13 identiques sur 17 ; les 4 autres sont la position d'atterrissage, **changée à la demande du joueur** (`collisions.md` § 2 ter) |
| Séquences du banc, télémétrie image par image | `node work/scripts/collision-sequences.mjs all`, `python3 work/scripts/telemetry-compare.py` | E2, E4, E5 : identiques à la PR #4. E3, E3x : identiques jusqu'au décollage, puis différentes en position. HOP, HOPx : autre scénario |
| Courses de l'ordinateur | `node work/scripts/race-rules-comparison.mjs` | 21 courses de 16 voitures : toutes terminées, somme des temps des vainqueurs identique à la PR #4 (4 268,55 s) ; 0 saut (42 avant), 5 accidents (10 avant), aucune voiture posée sur une autre (3 avant) |
| Déterminisme à 120 Hz | `npm test` (« deterministic at 120 Hz… », « same seed, same race… ») | réussi : même saut pas pour pas, quel que soit l'ordre des voitures |

Ce que cette exécution **ne** dit **pas** : que les corrections conviennent. Les sauts, le
franchissement, la hauteur des rétroviseurs et le braquage sont à juger au volant ; aucun
critique indépendant n'a revu ce lot.

Pendant le lot, deux de mes propres scripts de mesure étaient faux et ont été corrigés avant
toute conclusion (le jeu n'était pas en cause) : le contrôle clavier étiquetait mal qui écrit
les commandes d'une course à l'autre, et la mesure de la hauteur des rétroviseurs sur l'image
repérait le pneu au lieu du boîtier.

### Exécution précédente (22 novembre 2026)

Sur le build de 1 068 261 octets, après le lot « saut
récupérable, roues à très haute vitesse, rétroviseurs rapprochés » et les corrections qui ont
suivi les revues indépendantes :

| Suite | Commande | Résultat |
|---|---|---|
| Simulation et logique | `npm test` | 91 / 91 (76 précédents dont 4 modifiés, 15 nouveaux) |
| Navigateur (WebGPU) | `node tests/rendering/smoke.browser.mjs` | 13 / 13 |
| Modes de jeu de bout en bout | `node work/scripts/flow-check.mjs` | réussi (5 parcours) |
| Pages, pause, caméras, souris | `node work/scripts/pages-check.mjs` | 14 / 14 |
| Audio | `node work/scripts/audio-check.mjs` | 80 / 80 |
| Banc d'essai des collisions | `node work/scripts/lab-check.mjs` | 19 / 19 |
| Conduite (non-régression) | `node work/scripts/driving-report.mjs` | 165 valeurs identiques à la PR précédente |
| Contacts validés (non-régression) | `node work/scripts/collision-sequences.mjs all`, `node work/scripts/collision-comparison.mjs` | télémétrie d'E2, E3, E3x, E4, E5 identique image par image à la PR précédente ; 129 valeurs chiffrées E1–E5 identiques |
| Courses de l'ordinateur | `node work/scripts/race-contact-table.mjs` | temps du vainqueur et meilleur tour identiques dans six courses ; 16 sauts |

Exécution précédente (21 novembre, build de 1 035 351 octets, après le travail sur les
collisions) : 76 / 76, 13 / 13, 5 parcours, 14 / 14, 80 / 80, 165 valeurs identiques. Le test
navigateur avait d'abord donné 12 / 13 : son point de contrôle « pneu avant par-dessus la
route » tombait sur le rétroviseur, déplacé par ce travail-là. Le point a été replacé sur la
bande de roulement ; l'image elle-même était correcte.

Incident d'outillage pendant ce lot : avec le rasteriseur logiciel, les scripts qui mettaient
en file beaucoup d'images sans attendre le processeur graphique voyaient parfois le navigateur
abandonner son périphérique graphique (« A valid external Instance reference no longer
exists »), d'où des captures à refaire. Le chien de garde graphique du navigateur automatisé
est maintenant coupé (`--disable-gpu-watchdog`, `lib-browser.mjs`) et le script des
rétroviseurs attend après chaque image. Le jeu n'est pas concerné.

## 1. Tests de simulation et de logique (Node) — 109 / 109 réussis

Dernière exécution : `npm test` → 109 tests, 109 réussis, 0 échec (environ 12 s) : 76 tests
de la PR #4 inchangés, 15 réécrits ou adaptés au lot 5 et devenus 14 (voir § 1 ter), 19 nouveaux
(13 à la première livraison du lot, 6 après la relecture indépendante du code).
À la PR #4 : 91 tests, soit 76 précédents (dont quatre modifiés, voir § 1 bis) et 15 nouveaux.

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
- ✅ **(franchissement)** E3 flight: the car flies over the car it rode over and comes down ahead of it, beside its path; that car drives past the wreck *(réécrit, § 1 ter)*
- ✅ **(relecture, défaut 2)** E3 at an angle: the follower converging on the car ahead still comes down beside its path, and is never driven through *(de −1,7° à +2,9°, des deux côtés)*
- ✅ **(relecture, défaut 3)** two contacts in the same step: the bodies come first whatever the order of the cars, and a car thrown in the air is touched by nothing else *(les six ordres de trois voitures)*
- ✅ E3 near a barrier: the flight stays between the barriers, and the car is still not set down on another one
- ✅ E3 flight: 0.85 s, slowing by 50 km/h per second, rising then coming down
- ✅ E3 hard landing: speed cut to about 15 %, standstill within a second, 3.2 s stopped, restart on the spot in first gear
- ✅ a wrecked or flying car cannot be hit, and the restarting car is protected for a moment
- ✅ a computer driver steers round a wreck instead of driving through it
- ✅ E5 launch on a board: thrown in the air, light landing without loss of speed nor explosion, slide, restart from where it stopped
- ✅ launch conditions are explicit: the accident inside its overlap window, the hop on the wheels, nothing else flies *(modifié, § 1 bis et § 1 ter)*
- ✅ pitch of the view (E3, hard): nose up and held, steady swing, ground held, rebound, second dip, level again
- ✅ pitch of the view (E5, light): same script, shorter, second dip partial; trembling only while sliding
- ✅ the staging depends only on the simulated state: same values whatever the display rate, nothing for the other player
- ✅ seen from outside: a car in flight is tilted (nose up then down, the side that was hit lifted) and flattened as it lands
- ✅ explosion: four phases in order, 1.25 s of fire, plumes until 1.6 s

### Contact de roues — `tests/gameplay/wheel-contacts.test.mjs` (nouveau, lot 5)

Ce qui déclenche un saut : une roue avant qui entre par l'arrière dans une roue arrière,
carrosseries séparées, et rien d'autre. Les six familles de contacts demandées y sont :
roue / roue, roue / carrosserie, nez / arrière, côte à côte, obliques, sans contact réel.

- ✅ the wheels of the collision model are those of the drawing of the car, without the simulation reading the drawing
- ✅ wheel strike: the front wheel must go in through the back of the rear wheel *(roue / roue par l'arrière, par le côté, déjà engagée, effleurement, en biais)*
- ✅ **(relecture, défaut 6)** wheel strike at an angle: a tyre that passes the back of the other one beside it and then meets its flank is not a strike *(grille d'arrivées en biais comparée à une géométrie de contrôle : 0 contact de flanc accepté ; l'ancien code en acceptait 13)*
- ✅ by kind of contact, with the energy of a hop (215 km/h on a car at 150 km/h): only a wheel on a wheel lifts the car *(nez / arrière, nez sur roue, aileron sur roue, roue sur roue, sans contact)*
- ✅ side by side: tyres that come together sideways rub (E2) and never lift a car, whatever the difference of speed
- ✅ energy and direction: closing speed, speed of the car, angle between the cars, accidents switched off
- ✅ swept over 900 arrivals: every hop starts with a front tyre in the back of a rear tyre and the bodies apart; nothing else lifts a car *(909 arrivées : 24 sauts, 235 accidents, 366 tamponnages, 16 frottements, 268 sans contact ; géométrie de contrôle écrite à part du jeu)*

### Saut récupérable — `tests/gameplay/hop.test.mjs` (réécrit au lot 5)

Le vol, l'atterrissage et la suite. Les tests de la PR #4 vérifiaient que la voiture était
ralentie au choc et retombait derrière : la règle demandée par le joueur est l'inverse, ils
sont réécrits (§ 1 ter).

- ✅ recoverable hop: a front wheel on a rear wheel lifts the car behind; it flies, comes down on its wheels and drives
- ✅ **(franchissement, sans téléportation)** the hop clears the car that caused it: it flies past it and comes down ahead of it, without ever being moved
- ✅ what a hop costs is the time in the air: nothing at the shock, the loss of any flight, nothing at the landing
- ✅ a slower arrival needs a longer flight to get past; too slow to get past, the car does not take off
- ✅ **(atterrissage sans chevauchement)** the landing waits rather than set the car down on the car it flew over when that car speeds up
- ✅ **(relecture, défaut 1)** the place where a hop comes down is free of every car: when a third car is there, the car does not take off *(cinq placements de la troisième voiture ; personne n'est déplacé ni pénalisé)*
- ✅ **(relecture, défauts 1 et 5)** the landing waits when a car moves under the landing place during the flight, at the height it has, without a jolt *(une voiture qui freine sous le lieu d'atterrissage ; pas de remontée de plus de 2 cm)*
- ✅ **(relecture, défaut 4)** a body contact is not followed by a hop: after a rub that pushes the cars apart the wheel does not climb the wheel
- ✅ **(braquage après le saut)** after a hop the driver has the car back: the steering swings once and settles, then answers as on any car *(gauche et droite, pendant et après la perturbation ; même réponse qu'une voiture qui n'a pas sauté, à 2 % près)*
- ✅ a hop never stops the car: no standstill, no explosion, no repositioning, it accelerates again
- ✅ low energy: below the thresholds nothing changes, the validated contacts keep their outcome
- ✅ the hard accident E3 is kept: the nose on a rear wheel at high energy, hard landing, wreck
- ✅ the launch on a board E5 is kept: light landing, slide, no hop
- ✅ **(déterminisme à 120 Hz)** deterministic at 120 Hz: the same hop gives the same race, step for step
- ✅ a car that has just come down cannot be thrown in the air again at once

### Banc d'essai — `tests/gameplay/lab.test.mjs` (nouveau, lot 5)

Les six cas du banc joués par le vrai module (`collision-lab.js`) et la vraie simulation, sans
navigateur.

- ✅ bench, case 2 (hop): a front wheel on a rear wheel, the car flies over the other one and comes down ahead of it
- ✅ bench, case 3 (accident E3): the car flies over the other one, comes down ahead of it and to its side, wrecked; the other drives past
- ✅ bench, case 4 (board E5): the car is thrown up by the board and comes down well beyond it
- ✅ bench, cases 1, 5 and 6: contacts that must not lift a car
- ✅ **(braquage après restitution du contrôle)** steering after the hand-over: until then the bench drives whatever the player holds; from then on the car obeys, left and right alike

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

## 1 ter. Tests existants réécrits ou adaptés par le lot 5

Le comportement attendu de ces tests **a changé par décision du joueur** (saut par contact de
roues seulement ; tout décollage franchit l'obstacle). Ce ne sont donc pas des non-régressions :
ils énoncent la nouvelle règle. Tous les autres tests de la PR #4 sont inchangés et réussis.

| Test de la PR #4 | Ce qu'il devient | Raison |
|---|---|---|
| `hop.test.mjs` — les 13 tests | 12 tests réécrits sur le saut « roue sur roue » (215 km/h sur 150, 1,95 m de côté). Disparus : le saut par le côté, le ralentissement au choc, « retombe derrière sans gagner de terrain », l'ordre de traitement de l'atterrissage. Conservés tels quels dans leur objet : E3 maintenu, E5 maintenu, pas d'immobilisation, délai de 1,5 s, déterminisme, contacts à faible énergie | Les deux règles du joueur remplacent ce que ces tests vérifiaient |
| `accidents.test.mjs` — *E3 flight: the car comes down behind the car it rode over…* | *E3 flight: the car flies over the car it rode over and comes down ahead of it, beside its path; that car drives past the wreck* | Règle 2 du joueur. La perte de 50 km/h par seconde en vol y est toujours vérifiée |
| `accidents.test.mjs` — *launch conditions are explicit: three levels by energy…* | *…the accident inside its overlap window, the hop on the wheels, nothing else flies* : le cas « 170 km/h sur 100, demi-largeur » donne un tamponnage et non plus un saut ; deux cas roue sur roue ajoutés ; le seuil de l'accident est mesuré (58 km/h d'écart) | Règle 1 du joueur ; conséquence de la règle 2 sur le seuil |

Treize tests nouveaux à la première livraison du lot : six dans `wheel-contacts.test.mjs`, cinq dans `lab.test.mjs`, et deux
ajoutés à des fichiers existants. Ajouté à `accidents.test.mjs` : *E3 near a barrier: the flight stays between the barriers, and
the car is still not set down on another one*. Ajouté à `animation.test.mjs` : *mirrors, lot 5:
three heights of the same mirrors…*. Le test existant des rétroviseurs passe sans modification
sur la variante B.

Six tests ajoutés après la relecture indépendante du code (`collisions.md` § 2 ter, « Relecture
indépendante du code, et suites »), un par défaut reproduit ou presque : un dans
`wheel-contacts.test.mjs` (entrée en biais), trois dans `hop.test.mjs` (lieu d'atterrissage
libre de toute voiture ; attente en l'air sans à-coup ; pas de saut après un contact de
carrosserie), deux dans `accidents.test.mjs` (arrivée en biais ; deux contacts au même pas).
Le test *the landing waits rather than set the car down on another one…* de la première
livraison a été scindé : sa moitié « troisième voiture » énonçait une attente plafonnée à 1,5 s,
qui était le défaut n° 1. Chacun de ces tests échoue sur le code de la première livraison
(`ee7f43e`).

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

**Rétroviseurs** : `work/scripts/compare-mirror-variants.mjs` capture trois positions dans la
même scène et mesure la symétrie des deux côtés sur l'image.

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
