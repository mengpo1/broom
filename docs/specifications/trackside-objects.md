# Objets de bord de piste — décors enrichis, profils d'interaction, prototypes expérimentaux

Lot « collisions et objets de bord de piste ». Branche issue de la PR #4.

**État.** Trois choses distinctes sont livrées, avec trois niveaux d'engagement :

| | Par défaut | Effet sur la simulation |
|---|---|---|
| **Décors enrichis** (nouveaux objets décoratifs, tunnels, portiques, ombres) | **actifs** | **aucun** : la simulation ne les connaît pas ; courses identiques au bit près à la PR #4 |
| **Objets que l'on peut heurter** (profils BREAKABLE et SOLID, supports de portiques) | **inactifs** — EXPÉRIMENTAL | seulement avec `#objects=interactive` ou sur le banc d'essai |
| **Accotements ouverts** | **inactifs** — EXPÉRIMENTAL | seulement sur un circuit de développement, copie d'un circuit existant |

Aucun circuit existant, aucun réglage de conduite, aucune collision validée n'est modifié.
Rien n'est à fusionner sans validation humaine.

## 0. Ce qui n'a pas été reçu

Le lot s'appuie sur la vidéo « Vroom Multiplayer — Atari ST (1993) » de 13 min 38 s et sur six
séquences (03:15, 06:32, 08:16, 10:22, 11:19, 12:38). **Cette vidéo n'est pas dans la
session.** Le seul enregistrement disponible est celui de 1991 (5 min 36 s) : les circuits
nommés (Adelaide, San Marino, Monaco, Catalunya, Belgique) n'y figurent pas.

Le relevé du § 1 porte donc sur l'enregistrement de 1991 — deux circuits, un désert et un
circuit d'herbe avec tunnel et ponts. **Aucune des six séquences demandées n'a été étudiée**,
et rien n'en est supposé. Ce qui en dépend est listé au § 10.

## 1. Observations vidéo (partie A)

Relevé complet, horodaté image par image, avec ses tableaux :
`docs/research/trackside-objects-observations.md` ; images dans
`work/reference-frames/T-trackside-objects/` (40 images, 9 planches). Le relevé a été fait
par un agent d'analyse à qui il était interdit de proposer quoi que ce soit ; six de ses
images ont été recontrôlées à la main (chevrons 1:53,56, plaque à flèche 0:18,84, portique
0:30,48, portail et intérieur du tunnel 3:29,96 et 3:30,48, structure couverte 0:38,08) :
elles montrent ce qu'il décrit.

Les trois colonnes sont tenues séparées dans tout le lot.

| Catégorie | 1. Observation directe (enregistrement de 1991) | 2. Inférence | 3. Proposition originale de Virage GP |
|---|---|---|---|
| Chevrons | Panneau noir à trois chevrons blancs sur deux pieds courts, toujours à l'extérieur des courbes, pointant dans le sens du virage, seul ou en file de 2 à 5 (17 groupes relevés, ex. 0:18,5–0:20,6 ; 1:05,5–1:06,5 ; 3:20,5–3:23,5) | Ils jalonnent l'extérieur du virage | Dessin différent (deux chevrons rouges sur fond blanc) ; files de 3 à 6 à l'extérieur des courbes de moins de 230 m de rayon, **derrière** la barrière |
| Signalisation avant virage | Carré rouge à pictogramme blanc, sur un poteau (8 exemples, ex. 0:18,84 ; 1:15,96) ou sur une traverse de portique (10) ; aucun panneau chiffré | La flèche annonce le sens du virage suivant | Panneau bleu à flèche blanche, côté intérieur, 150 m avant la courbe. Les panneaux 300 / 200 / 100 existants sont une invention de Virage GP, inchangée |
| Panneaux publicitaires | Trois familles : grand panneau bas, panneau carré sur deux poteaux bas, panneau haut et étroit (28 exemples, ex. 0:39,4 ; 0:19,1 ; 3:21,5) ; souvent groupés par 2 ou 3 | Images plates toujours vues de face | Deux familles (bas, 3 dessins ; haut, 2 dessins) aux couleurs des commanditaires **fictifs** déjà présents dans le jeu ; aucune marque ni illustration reprise |
| Portiques | Cadres plats à traverse, le plus souvent en séries rapprochées (≈ 25 par tour sur le premier circuit) ; le portique « START » marque le changement de tour | — | Un à deux portiques par circuit (treillis à trois panneaux, ou arche de tubes), en plus du portique de départ et des passerelles existants |
| Ponts, toit sur piliers | Ponts sur talus (second circuit, 6 passages) ; toit rouge sur piliers (premier circuit, 3 passages) | — | Les passerelles existantes sont conservées ; pas de toit sur piliers |
| Tunnel | Un par tour sur le second circuit (3:30,2–3:31,4 ; 4:35,5–4:36,7) : mur plat à ouverture rectangulaire, intérieur presque noir avec une file de points lumineux par côté, sortie visible dès l'entrée, bordures toujours visibles | Portail, habillage uniforme, portail | Portail en béton dans un talus, nervures de voûte à lampes, murs éclairés, tablier en béton ; sur trois circuits |
| Lumière sous un ouvrage | Toute l'image s'assombrit d'un cran sous les ponts, le toit et dans le tunnel ; **pas** sous les portiques | Un seul mécanisme de palette | Sol et voitures assombris dans le tunnel et sous les passerelles, pas sous les portiques ; l'extérieur reste clair au bout du tunnel |
| Végétation | Cactus seulement sur le premier circuit, arbres en ombrelle seulement sur le second ; isolés ou en petits groupes, souvent associés à un autre objet | — | Arbres isolés par environnement : chêne, peuplier, cactus (deux dessins) |
| Rochers | Un seul modèle, isolé, ≈ 6 par tour, premier circuit seulement | — | Blocs (deux dessins) et petits cailloux, selon l'environnement |
| Bas-côtés | Sable ou herbe d'une seule couleur ; bordures rouge et blanc continues ; relief réel | — | Touffes d'herbe ou banc de sable au pied des barrières |
| Barrières | **Aucune barrière, aucun rail, aucun mur** le long de la piste | — | Virage GP garde ses limites fermées (§ 6) |
| Contact avec un objet | **Un seul** dans tout l'enregistrement : le panneau d'E5 à 3:01, déjà analysé | On ne sait pas si les autres objets sont solides | Tout comportement de collision d'un nouvel objet est une proposition de Virage GP, expérimentale (§ 4) |
| Passage sous un portique | Aucun changement d'image, aucun contact (12 passages relevés) | — | Profil OVERHEAD : on passe dessous |
| Sortie de piste | Seulement E5 (3:02–3:04) : sable identique au reste, rien n'arrête la voiture sinon sa décélération | — | Prototype d'accotements ouverts (§ 6) |

Conséquence directe de la consigne « ne pas attribuer de comportement de collision à un objet
simplement parce qu'il est visible » : **par défaut, aucun nouvel objet n'a de volume.**

## 2. Architecture réutilisée (partie B)

Il n'y a pas de second système. Les nouveaux objets sont des « props » et des bandes du
placement existant, dessinés par la même bibliothèque à partir d'identifiants logiques.

| Fichier | Rôle | Modification |
|---|---|---|
| `src/tracks/scenery-layout.js` | placement des décors | appelle `placeTracksideObjects` après ses propres placements ; renvoie en plus `objects` et `trackside` |
| `src/tracks/trackside-objects.js` | **nouveau** : catalogue, profils, règles de placement, placements explicites | — |
| `src/art/environments/trackside-objects-art.js` | **nouveau** : les dessins | — |
| `src/art/environments/scenery-specs.js`, `scenery-painters.js` | tailles et registre des dessins | 20 familles ajoutées |
| `src/physics/trackside-tuning.js`, `trackside-contacts.js` | **nouveaux** : réglages et contacts expérimentaux | — |
| `src/physics/obstacles.js`, `collisions.js`, `car-physics.js`, `collision-tuning.js` | collisions validées | **non modifiés** |
| `src/gameplay/race.js` | course | liste `objects` (vide par défaut) et appel du contact expérimental quand elle ne l'est pas |
| `src/tracks/track-builder.js` | circuits | option `openVerges`, lue seulement pour un circuit de développement |
| `src/rendering/drawing/scene-builder.js`, `shaders/road.wgsl.js`, `track-attributes.js` | rendu | ombre sous les ouvrages, objet couché, tunnel dessiné jusqu'à la caméra |
| `src/rendering/effects/effects-layer.js`, `src/audio/game-audio.js` | effets, sons | événement `object` |
| `src/core/collision-lab.js` | banc d'essai | sept cas ajoutés |

Le placement d'origine utilise sa suite de tirages ; les nouveaux objets ont **la leur**. Les
objets d'origine ne bougent donc pas : avec `#scenery=classic` le décor des 18 circuits est
celui de la PR #4 à l'objet près (empreintes dans `tests/fixtures/scenery-pr4.json`).

**Remplacer un dessin** : enregistrer un autre peintre pour la même famille
(`registerSceneryPainters`), ou changer sa taille dans `scenery-specs.js`. Le jeu ne manipule
que les identifiants.

## 3. Catalogue des objets (parties C et D)

`TRACKSIDE_OBJECTS` dans `src/tracks/trackside-objects.js`. Planches des dessins :
`work/renders/trackside/sheet-signs.png`, `sheet-structures.png`.

« Profil » : ce que l'objet devient **s'il est placé à portée des voitures et si les
interactions sont actives**. Partout ailleurs il est décoratif, quoi que dise la colonne.

| Famille | Catégorie | Taille dessinée | Profil | Volume au sol (larg. × prof.) | Réaction |
|---|---|---|---|---|---|
| `sign.chevron` | chevrons | 2,8 × 3,05 m | BREAKABLE | 2,1 × 0,6 m | `lightSign` |
| `sign.turn` | signalisation | 1,75 × 2,85 m | BREAKABLE | 1,5 × 0,6 m | `lightSign` |
| `sign.advert.low` (3) | publicité, supports bas | 5,2 × 2,4 m | BREAKABLE | 4,4 × 0,7 m | `board` |
| `sign.advert.high` (2) | publicité, supports hauts | 5,7 × 6,5 m | DECORATIVE | — | — |
| `gantry.banner` (2) | portique | 24 × 7,5 m | OVERHEAD, 5,3 m de passage | deux supports 0,9 × 0,9 m à ± 10,6 m | `pillar` |
| `tunnel.portal`, `tunnel.arch` | tunnel | 34 × 11 m, mis à l'échelle du lieu | OVERHEAD, 5,8 m de passage | aucun support | — |
| `tree.oak`, `tree.poplar` | végétation | 12 × 12 m, 4,3 × 14 m | SOLID | tronc 1,1 × 1,1 m, 0,7 × 0,7 m | `trunk` |
| `cactus` (2) | végétation | 2,4 × 4,2 m | SOLID | 0,8 × 0,8 m | `trunk` |
| `boulder` (2) | rochers | 2,8 × 1,9 m | SOLID | 2,2 × 1,8 m | `rock` |
| `stones` (2) | rochers | 1,4 × 0,5 m | DECORATIVE | — | — |
| `cone` | accessoires | 0,5 × 0,78 m | BREAKABLE | 0,5 × 0,5 m | `cone` |
| `marker.post` | accessoires | 0,42 × 1,1 m | BREAKABLE | 0,24 × 0,24 m | `cone` |
| `tyrestack` | accessoires | 1,4 × 1,25 m | BREAKABLE | 1,4 × 1,4 m | `tyres` |
| `haybale` | accessoires | 1,8 × 0,98 m | BREAKABLE | 1,8 × 1,0 m | `bale` |
| `barrel` | accessoires | 0,85 × 1,1 m | SOLID | 0,8 × 0,8 m | `barrel` |
| `strip.tufts`, `strip.sandbank` | bas-côtés | bande de 0,55 m de haut | décor | — | — |
| `strip.tunnelwall` | tunnel | bande de 13 m de haut | décor (le mur physique reste la barrière) | — | — |

Objets d'origine inscrits au catalogue sans être modifiés : portique de départ et passerelles
(OVERHEAD ; leurs supports se trouvent déjà sur les accotements, sans volume) ; arbres,
buissons et rochers d'origine (hors de portée aujourd'hui, ils n'ont un volume que sur le
circuit à accotements ouverts).

### Répartition

- **Par environnement** (`THEME_TRACKSIDE`) : espèces isolées, densité de blocs et de
  cailloux, nombre de panneaux par kilomètre, bande au pied des barrières, accessoires. Par
  exemple désert : cactus, sable, barils ; hauts plateaux : chênes, beaucoup de blocs, bottes
  de paille ; docks : ni arbre ni rocher, barils et piles de pneus.
- **Par le tracé** : chevrons et signalisation suivent les courbes ; panneaux publicitaires
  et portiques cherchent les lignes droites ; piles de pneus et bottes de paille se placent à
  l'extérieur des virages lents ; bornes réfléchissantes tous les 50 m des longues lignes
  droites.
- **Placements explicites** (`CIRCUIT_FEATURES`, ou `features` dans la définition d'un
  circuit) : tunnels de Montclair, Roca Alta et Meridian Docks ; deux portiques à Grand
  Zenith. Un tunnel demandé là où les barrières ne sont pas à distance constante est déplacé
  jusqu'au premier tronçon qui convient, ou abandonné (cas de Porto Sereno).

| | Avant | Après |
|---|---|---|
| Objets ponctuels par circuit | 141 à 1341 | 281 à 1588 |
| Objets ajoutés, 18 circuits | — | 4224 |
| Tunnels | 0 | 3 |
| Portiques (hors départ et passerelles) | 0 | 19 |

Détail par circuit : `work/benchmarks/trackside-report.json`.

**Où se tiennent les nouveaux objets décoratifs.** Derrière les barrières, au pied des
barrières (bandes basses), ou au-dessus de la route. Aucun n'est posé sur un accotement
accessible, à une exception près, signalée parce qu'elle existait déjà : les **supports des
portiques** se trouvent sur l'accotement, comme ceux du portique de départ et des passerelles
d'origine. Par défaut une voiture les traverse sans effet, comme elle le fait déjà pour ceux
d'origine.

## 4. Profils d'interaction (partie D) — EXPÉRIMENTAL

| Profil | Règle |
|---|---|
| DECORATIVE | aucun contact |
| OVERHEAD | on passe dessous tant que la hauteur libre dépasse la voiture, même en vol ; ses supports sont des volumes rigides distincts, seulement là où une voiture peut les atteindre |
| BREAKABLE | l'objet tombe au premier contact et reste couché jusqu'à la fin de la course ; la voiture garde une part de sa vitesse |
| SOLID | l'objet ne bouge pas ; la voiture est arrêtée contre lui, ou repoussée de côté si elle ne l'accroche que d'un coin ; un choc franc et rapide se termine par le tête-à-queue existant |

Trois garanties, vérifiées par des tests :

- **Aucun décollage.** Aucune réaction n'envoie une voiture en l'air.
- **Mêmes règles pour toutes les voitures**, joueur ou ordinateur.
- **Passage sous les ouvrages** : le vol le plus haut du jeu (accident E3, panneau E5) reste
  à plus de 1 m sous la plus basse des structures (5,3 m).

Réglages, tous dans `src/physics/trackside-tuning.js`, séparés des valeurs validées de
`collision-tuning.js` :

| Réaction | Objets | Vitesse conservée | Autre |
|---|---|---|---|
| `cone` | cône, borne | 98,5 % | secousse légère |
| `lightSign` | chevron, flèche | 92 % | |
| `board` | panneau publicitaire bas | 84 % | |
| `bush` | buisson | 88 % | |
| `bale` | botte de paille | 78 % | |
| `tyres` | pile de pneus | 60 % | |
| `barrel` | baril | 30 % (choc franc), 80 % (accroché du coin) | tête-à-queue au-delà de 108 km/h |
| `trunk` | arbre, cactus | 10 %, 70 % | tête-à-queue au-delà de 72 km/h |
| `rock`, `pillar` | bloc, support de portique | 8 %, 65 % | tête-à-queue au-delà de 65 km/h |

Chaque réaction porte aussi son mot dessiné (ou aucun) et son son (volume, timbre, métallique
ou non). **Aucune de ces valeurs n'est tirée de la vidéo** : ce sont des points de départ.

## 5. Ce qui n'est pas modifié (partie E)

Tamponnage arrière, contact roue contre roue, panneaux de freinage, accident E3,
atterrissage E5, animation des roues, accélération, freinage, direction, adhérence : code et
réglages intacts, résultats identiques (§ 9). Les panneaux de freinage gardent leur propre
liste et leur propre code ; ils ne figurent pas dans la liste expérimentale.

**Sauts récupérables** : les nouveaux objets ne peuvent pas en augmenter la fréquence. Par
défaut la simulation ne les voit pas ; en mode expérimental aucun contact avec eux ne lance
une voiture. La correction de fréquence elle-même est dans la PR #5 et n'est pas reprise ici.

## 6. Accotements ouverts (partie F) — prototype EXPÉRIMENTAL

Le sujet C10 n'étant pas autorisé, **aucun circuit existant n'est touché**. Le prototype est
un circuit de développement, `banc-accotements` : une copie de Kestrel Fields dont les
limites sont repoussées de 30 m, sauf à moins de 380 m de la ligne, où les stands gardent
leurs murs. Même route, mêmes bordures, mêmes zones d'herbe et de gravier, **mêmes
coefficients d'adhérence** : seule la position de la limite change. Le terrain ainsi ouvert
est planté comme les alentours du circuit.

Mêmes courses de 16 voitures de l'ordinateur, 3 tours, trois graines
(`node work/scripts/trackside-report.mjs`) :

| | Limites actuelles | Accotements ouverts, objets sans volume | Accotements ouverts, objets avec volume |
|---|---|---|---|
| Chocs contre une barrière | 6, 17, 13 | 0, 2, 0 | 0, 0, 0 |
| Temps passé hors de la route (16 voitures) | 33, 58, 49 s | 42, 49, 44 s | 52, 55, 46 s |
| Remises en piste | 7, 0, 0 | 7, 0, 0 | 7, 1, 1 |
| Objets heurtés | — | — | 3, 2, 1 (arbre, rocher, buisson, support de portique) |
| Temps du vainqueur | 243,8 / 233,5 / 233,4 s | 241,8 / 233,5 / 233,4 s | 242,2 / 233,5 / 233,4 s |

Conséquences relevées :

- **Navigation.** La voiture se repère par rapport à l'axe de la route ; le constructeur
  limite déjà la distance utilisable pour que deux portions de circuit ne se chevauchent pas,
  et la même limite s'applique au terrain ouvert (30 m ne sont pas atteints partout).
- **Objets accessibles.** 194 objets se retrouvent à portée. Sans volume, les voitures
  traversent les arbres ; avec volume, un arbre heurté de face arrête la voiture.
- **IA.** Elle ne connaît ni le terrain ouvert ni ses objets : elle vise toujours la
  trajectoire. Elle y gagne (presque plus de chocs contre les barrières) mais heurte un objet
  une à trois fois par course.
- **Collisions entre voitures.** Inchangées.
- **Remises en piste.** Même règle (à l'arrêt hors de la route) ; une voiture arrêtée contre
  un objet est remise en piste comme une voiture arrêtée dans l'herbe.
- **Performances.** Pas de coût mesurable (§ 9).
- **Image.** Le terrain ouvert est dessiné comme l'accotement, jusqu'à la barrière repoussée.

Ce prototype ne s'active que par le banc (`#lab=offtrack`).

## 7. Effets visuels et sonores (partie G)

- **Contact** (événement `object`) : étoile d'impact à l'endroit du choc, poussière, secousse
  de la vue et mot dessiné, proportionnés à la réaction ; son d'impact réglable par réaction.
- **Objet détruit** : il reste couché, à sa place, jusqu'à la fin de la course.
- **Tunnels** : le sol, le tablier et les voitures sont dans l'ombre à l'intérieur ; l'ombre
  commence au portail et finit au portail ; la sortie se voit claire depuis l'intérieur.
- **Passerelles** : une ombre au sol et sur les voitures, sur 7 m. Rien sous les portiques.
- **Aucun effet de collision** en passant normalement sous un ouvrage.

## 8. Banc d'essai (partie H)

Le banc existant (`src/core/collision-lab.js`) reçoit sept cas. Chaque cas se rejoue par une
commande, par une touche, ou par Entrée. Seules les commandes de la voiture sont scriptées ;
le reste est le moteur de simulation.

| Cas | Commande | Touche | Ce qui se passe |
|---|---|---|---|
| Panneau destructible | `index.html#lab=sign` | 6 | sur l'accotement à 150 km/h : le panneau tombe, la voiture continue à 127 km/h |
| Obstacle rigide | `index.html#lab=rock` | 7 | bloc à 110 km/h : arrêt, tête-à-queue, remise en piste |
| Passage sous un portique | `index.html#lab=gantry` | 8 | à 250 km/h : aucun contact |
| Support de portique | `index.html#lab=pillar` | 9 | sur l'accotement à 100 km/h : arrêt, tête-à-queue |
| Tunnel | `index.html#lab=tunnel` | 0 | à 220 km/h : aucun contact, la lumière change |
| Sortie de piste | `index.html#lab=offtrack` | O | accotements ouverts : 7 m au-delà de la ligne de barrière habituelle, puis retour |
| Contact rapproché | `index.html#lab=close` | K | deux voitures côte à côte, règles validées |

Les cinq cas d'origine gardent leurs touches (1 à 5). Les cas 6, 7 et 9 se jouent sur
`banc-objets`, un circuit de développement où les interactions sont actives ; les objets y
sont posés à la main.

Options pour le jeu normal :

| Lancement | Effet |
|---|---|
| sans option | décors enrichis, aucun objet à heurter |
| `index.html#scenery=classic` | décor de la PR #4 |
| `index.html#objects=interactive` | EXPÉRIMENTAL : une vingtaine d'objets à heurter par circuit |

## 9. Validation (partie I)

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

## 10. Comportements expérimentaux restant à valider

1. **Chaque réaction du § 4** : vitesse conservée, seuil de tête-à-queue, mot et son. Aucune
   n'a été jugée par un joueur.
2. **Le choix même des profils** : un panneau publicitaire bas est-il destructible ? un
   arbre arrête-t-il la voiture ? La vidéo disponible ne le dit pas.
3. **Supports de portiques solides**, y compris ceux du portique de départ et des passerelles
   d'origine en mode expérimental.
4. **Objets posés sur les accotements** (`#objects=interactive`) : emplacement et nombre.
5. **Accotements ouverts** : principe, largeur, objets avec ou sans volume.
6. **Décors enrichis par défaut** : c'est le seul changement visible sans option. Ils
   n'ont été revus par aucun critique indépendant.
7. **Les six séquences de la vidéo de 1993**, non étudiées.

## 11. Limites

- Les contacts expérimentaux utilisent des volumes rectangulaires alignés sur la route.
- Un objet rigide heurté en glissade est traité comme en ligne : la voiture est repoussée par
  le plus court chemin.
- Dans un tunnel, le poste de pilotage du joueur n'est pas assombri ; seuls le sol, les
  murs et les autres voitures le sont.
- Les tunnels occupent toute la largeur entre les barrières (32 m et plus), parce que les
  barrières des circuits existants ne sont pas déplacées.
- La référence montre des portiques en séries serrées et un toit sur piliers ; Virage GP n'a
  qu'un ou deux portiques par circuit et pas de toit.
- L'ordinateur ne connaît pas les objets expérimentaux et ne les évite pas.
