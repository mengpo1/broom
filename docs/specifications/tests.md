# Résultats des tests

Tous les tests sont reproductibles : `npm test` (Node, sans navigateur) et
`npm run test:browser` (Playwright + Chromium + WebGPU, sur le fichier `index.html` réel).
Dans le conteneur de développement, WebGPU est exécuté par le rasteriseur logiciel
SwiftShader derrière un serveur X virtuel (Xvfb) : les tests vérifient le comportement et
l'image, pas la vitesse.

## 0. Dernière exécution complète — lot « objets de bord de piste »

Sur le build final (`index.html`, 1 159 973 octets), le 23 novembre 2026. Les nouveaux décors
sont actifs par défaut et **la simulation est celle de la PR #4** ; les contacts avec les
objets et les accotements ouverts sont expérimentaux et inactifs par défaut
(`trackside-objects.md`).

| Contrôle | Commande | Résultat |
|---|---|---|
| Tests de simulation | `npm test` | 105 / 105 : les 91 existants (un seul adapté : les tunnels enjambent la route) et 14 nouveaux |
| Décor d'origine conservé | `node work/scripts/scenery-fingerprint.mjs src classic` | empreintes des 18 circuits identiques à celles de la source de la PR #4 |
| Simulation par défaut inchangée | `node work/scripts/driving-trace.mjs` | quatre courses complètes (8 voitures, 9000 pas) : empreintes identiques à la source de la PR #4 |
| Conduite | `node work/scripts/driving-report.mjs` | 165 valeurs identiques à la PR #4 |
| E2, E3, E3x, E4, E5, saut | `node work/scripts/collision-sequences.mjs all` | télémétrie identique image par image aux fichiers de la PR #4 et à la référence validée (192, 570, 252, 600, 390 images) |
| Contacts en simulation | `node work/scripts/collision-comparison.mjs` | valeurs identiques |
| Navigateur | rendu, pages, audio, parcours des modes | 13 / 13, 14 / 14, 80 / 80, 5 parcours |
| Banc d'essai dans le vrai jeu, au clavier | `node work/scripts/lab-check.mjs` | 37 / 37 (19 existants, 18 nouveaux) |

Points de la partie I :

| Exigence | Vérification |
|---|---|
| Déterminisme à 120 Hz | chaque cas du banc rejoué deux fois donne la même trace ; aucun tirage au sort dans les contacts ; placement refait à l'identique |
| Mêmes collisions pour toutes les voitures | même contact, même résultat pour une voiture de joueur et une voiture de l'ordinateur |
| Pas de collision avec un décor lointain ou inaccessible | aucun objet derrière une barrière n'a de volume ; tout objet interactif est entre la route et la barrière |
| Pas de double collision après destruction | repasser sur un panneau couché ne produit rien ; un objet rigide n'est signalé qu'une fois par contact |
| Positions graphiques et physiques cohérentes | le volume est à la place du dessin et tient dans sa largeur ; les supports sont sous les extrémités de leur portique |
| Visibilité et profondeur | les objets passent par l'ordre de dessin existant ; scènes avant / après et vidéos contrôlées à l'œil, sans mesure automatique |
| Performances à 16 voitures | voir ci-dessous |
| Rien ne change quand les objets sont désactivés | décor de la PR #4 à l'objet près ; liste d'objets vide ; course identique avec et sans décors |

**Performances** (17 voitures, Grand Zenith — le circuit le plus chargé —, 1280×720, qualité
haute, rasteriseur logiciel SwiftShader : les valeurs absolues ne disent rien d'un vrai
processeur graphique, seul l'écart compte) :

| | Décor d'avant | Décors enrichis | Avec objets interactifs |
|---|---|---|---|
| Quadrilatères par image | 1681 | 1864 (+11 %) | 1864 |
| Temps processeur par image | 1,5 ms | 2,1 ms | 2,3 ms |
| Passe graphique (logicielle) | 395 ms | 405 ms (+2,6 %) | 403 ms |

Simulation seule, 16 voitures : 30 à 47 ms pour 1000 pas quel que soit le mode, soit moins
de 0,05 ms par pas pour 8,3 ms disponibles ; l'écart entre modes est inférieur au bruit de
mesure. Le décor de chaque circuit tient dans les quatre couches d'atlas existantes (test).
**Non mesuré sur un vrai processeur graphique.**

Test existant adapté : *scenery layout: deterministic, every object has a drawing, objects
stay off the road* admet désormais les portails et nervures de tunnel parmi les objets qui
enjambent la route (comme le portique de départ et les passerelles). Rien d'autre n'y change.

### Objets de bord de piste — `tests/gameplay/trackside.test.mjs` (tous nouveaux)

Les cas de contact passent par le vrai banc d'essai et le vrai moteur
(`tests/gameplay/lab-helpers.mjs` ne remplace que la page).

- ✅ trackside: defaults - enriched scenery, no interaction; the catalogue names a profile, a volume and a reaction for every object
- ✅ trackside: with the objects switched off the scenery of the 18 circuits is the one of PR #4, to the last object
- ✅ trackside: the enriched scenery only adds - every original object, strip and solid board is where it was; nothing new can be reached
- ✅ trackside: the simulation does not know the decorative objects - same race with and without them
- ✅ trackside: every circuit fits the texture atlas, with and without the experimental objects
- ✅ trackside (experimental): interactive objects stand where cars can reach them, never on the road nor behind a barrier; the same every time
- ✅ trackside (experimental): a structure over the road is passed under - clearance above the highest flight of the game
- ✅ trackside bench: every new case has a command, and plays through the real simulation the same way every time
- ✅ trackside bench: breakable board - knocked down once, stays down, the car drives on; no second contact
- ✅ trackside bench: rigid obstacle and gantry support - the car is stopped outside the volume, the object stays, the contact is reported once
- ✅ trackside bench: gantry and tunnel are driven through without any contact; the light changes in the tunnel only
- ✅ trackside bench: close contact between two cars uses the validated rules and nothing else
- ✅ trackside (experimental): the same contact for every car, driven by a player or by the computer
- ✅ trackside (experimental): open verges are a copy of a circuit - same road, limits moved outward away from the pits, grip untouched

Pendant ce lot, quatre de ces tests ont d'abord échoué et ont fait corriger le code : un
panneau interactif dépassait la ligne de barrière ; la ligne de barrière « habituelle » du
circuit à accotements ouverts ne suivait pas l'entrée des stands ; le cas « sortie de piste »
partait d'un virage faute de ligne droite retenue. Le quatrième tenait au banc sans
navigateur, qui ne transmettait pas l'objet touché.

## 0 bis. Exécution précédente (lot « saut récupérable, roues, rétroviseurs »)

Sur le build final (`index.html`, 1 068 261 octets), le 22 novembre 2026, après le lot « saut
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

## 1. Tests de simulation et de logique (Node) — 105 / 105 réussis (91 décrits ci-dessous, 14 au § 0)

Dernière exécution : `npm test` → 91 tests, 91 réussis, 0 échec (environ 10 s) : les 76 tests
précédents (dont quatre modifiés, voir § 1 bis) et 15 nouveaux.

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

### Saut récupérable — `tests/gameplay/hop.test.mjs` (nouveau)

Niveau intermédiaire entre le contact sans décollage et l'accident violent. Les huit tests
demandés sont marqués d'un numéro.

- ✅ **(1 — saut récupérable)** recoverable hop: wheels interlocked at a medium closing speed lift the car behind; a short flight, it comes down on its wheels
- ✅ the speed of a hop is lost where its cause is seen: at the shock and during the flight, none as the wheels touch down *(ajouté après la seconde revue)*
- ✅ recoverable hop from the side: front wheel beside rear wheel; fully alongside, the wheels only rub (E2)
- ✅ **(2 — reprise du contrôle)** after a hop the driver has the car back: the steering swings once and settles, then answers as on any car
- ✅ **(3 — pas d'immobilisation)** a hop never stops the car: no standstill, no explosion, no repositioning, it accelerates again
- ✅ what triggers a hop is the wheel: tyre against tyre at the edge of the cars lifts the car, nose in the gearbox does not *(ajouté après la seconde revue)*
- ✅ **(4 — non-déclenchement à faible énergie)** low energy: below the hop thresholds nothing changes, the validated contacts keep their outcome
- ✅ **(5 — maintien d'E3)** the hard accident E3 is kept: same contact with more energy, hard landing, wreck
- ✅ **(6 — maintien d'E5)** the launch on a board E5 is kept: light landing, slide, no hop
- ✅ **(7 — déterminisme à 120 Hz)** deterministic at 120 Hz: the same hop gives the same race, step for step
- ✅ **(8 — pas de traversée)** no car is driven through: in flight and at the landing the hopping car stays clear of every other car
- ✅ a car that has just come down cannot be thrown in the air again at once
- ✅ the landing of a hop is settled before contacts are looked for, whichever car comes first in the list

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
