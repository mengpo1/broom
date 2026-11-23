# Braquage prolongé — diagnostic, sans modification de la conduite

Au troisième essai le joueur a signalé qu'en maintenant longtemps une touche de direction le
volant « devrait pouvoir tourner davantage », ce mouvement supplémentaire pouvant donner un
virage plus prononcé et éventuellement un dérapage.

Ce document **mesure le jeu tel qu'il est** et sépare trois explications possibles. **Rien n'a
été modifié** : ni la direction, ni l'adhérence, ni le lacet, ni le glissement, ni les dessins.
La solution reste à arrêter quand le joueur aura fourni sa vidéo de référence (§ 6).

**Suite** : l'analyse de la vidéo, l'instrumentation par vitesse et par courbure et un
prototype expérimental en deux phases sont dans `held-steering.md`. La conduite décrite ici
reste la conduite par défaut.

Fichiers examinés : `src/input/input-manager.js`, `src/physics/car-physics.js`,
`src/vehicles/car-spec.js`, `src/rendering/compositing/cockpit-layer.js`,
`src/art/cockpits/cockpit-art.js`.

Mesures : `node work/scripts/steering-study.mjs` (simulation seule, 120 Hz ; résultats complets
dans `work/benchmarks/steering-study.json`) et `node work/scripts/steering-positions.mjs`
(planche `work/renders/steering/steering-positions.jpg`).

## 1. La chaîne actuelle, de la touche à la voiture

1. **Clavier** (`input-manager.js`) : la demande vaut −1, 0 ou +1 **d'un coup**. Il n'y a
   aucune rampe côté entrée. (Manette : valeur analogique du stick ; souris : déplacement
   relatif.)
2. **Direction** (`car-physics.js`, `stepDrive`) : la position de la direction (`car.steer`,
   de −1 à +1) rejoint la demande à vitesse constante : 4,6 par seconde en braquant, 7,5 par
   seconde en revenant (`steerRate`, `steerReturnRate`). Une fois la butée atteinte, elle y
   reste tant que la touche est tenue. **Il n'existe pas de second temps.**
3. **Angle des roues utilisé par la simulation** : `car.steer` × butée. La butée vaut 19,5° à
   basse vitesse (`steerLock`) ; au-delà de 22 km/h elle est réduite pour que le plein braquage
   ne demande que 1,22 fois l'adhérence disponible (`overSteerAllowance`), en proportion de
   l'aide du profil de conduite (`steerAssist` : arcade 1, turbo 0,9, compétition 0,78).
4. **Lacet** : vitesse de lacet voulue = v·tan(angle)/empattement. Si elle demande plus que
   l'adhérence, elle est ramenée à environ 1,03 à 1,08 fois l'adhérence, et l'excès (le
   « glissement ») ne sert qu'à freiner la voiture (`slipScrub`) et à alimenter le crissement.
5. **Affichage** (`cockpit-layer.js`) : les roues avant sont l'un de **cinq dessins** (deux
   crans de chaque côté) choisi d'après la demande et une butée **d'affichage** distincte de
   celle de la simulation ; le volant tourne de 54° à pleine demande, quelle que soit la
   vitesse.

## 2. Les six points demandés

### 2.1 Durée entre l'appui et le braquage maximal

| | Durée |
|---|---|
| Du centre à la butée | **0,225 s** (27 pas de simulation) |
| De la butée au centre (touche relâchée) | 0,133 s |
| D'une butée à l'autre | 0,358 s |
| Lacet établi (95 % de sa valeur à 0,5 s) | 0,21 à 0,35 s après l'appui selon la vitesse |

Passé ce quart de seconde, la demande, la position de la direction, les dessins et le volant
ne changent plus.

### 2.2 Angle de braquage réellement calculé

Plein braquage, sur asphalte, pneus neufs. « Demande » : accélération latérale demandée,
rapportée à l'adhérence disponible.

| Vitesse | Profil arcade : butée | Demande | Lacet établi | Rayon | Profil compétition : butée | Demande | Freinage par glissement |
|---|---|---|---|---|---|---|---|
| 30 km/h | 19,5° | 0,46 | 58°/s | 8 m | 19,5° | 0,50 | 0 |
| 60 km/h | 13,8° | 1,22 | 68°/s | 14 m | 14,3° | 1,37 | 2,6 m/s² |
| 100 km/h | 5,5° | 1,22 | 45°/s | 36 m | 8,3° | 1,98 | 6,9 m/s² |
| 150 km/h | 2,9° | 1,22 | 35°/s | 69 m | 6,4° | 2,93 | 10,5 m/s² |
| 200 km/h | 1,9° | 1,22 | 31°/s | 102 m | 5,7° | 3,88 | 10,5 m/s² |
| 250 km/h | 1,5° | 1,22 | 30°/s | 131 m | 5,4° | 4,72 | 10,5 m/s² |
| 300 km/h | 1,3° | 1,22 | 31°/s | 155 m | 5,2° | 5,41 | 10,5 m/s² |

En arcade le plein braquage demande toujours 1,22 fois l'adhérence (freinage par glissement de
1,5 m/s²) : la voiture est tenue juste à la limite. En compétition et en turbo l'aide est
partielle : le plein braquage demande beaucoup plus que l'adhérence, mais le surplus ne fait pas
tourner davantage la voiture — il la ralentit.

### 2.3 Correspondance entre l'angle physique et les cinq dessins des roues avant

Les dessins couvrent ±14,9° (`MAX_DRAWN_STEER`), en deux crans de chaque côté. Ils ne suivent
pas l'angle de la simulation mais une butée d'affichage, 19,5° × (0,45 + 0,55 / (1 + v/28 m/s)),
qui décroît beaucoup moins vite avec la vitesse.

| Vitesse | Angle dessiné à pleine demande | Angle de la simulation (arcade) | Premier cran | Second cran |
|---|---|---|---|---|
| 30 km/h | 14,9° | 19,5° | 0,05 s après l'appui | 0,14 s |
| 100 km/h | 14,1° | 5,5° | 0,06 s | 0,17 s |
| 150 km/h | 13,1° | 2,9° | 0,06 s | 0,19 s |
| 250 km/h | 11,8° | 1,5° | 0,07 s | 0,21 s |
| 300 km/h | 11,5° | 1,3° | 0,07 s | 0,21 s |

Deux constats : à toute vitesse le plein braquage montre le **dernier** des deux crans, atteint
en 0,14 à 0,21 s ; et à haute vitesse le dessin exagère fortement l'angle réel (11,8° dessinés
pour 1,5° calculés à 250 km/h) — c'est voulu, un angle de 1,5° ne se verrait pas.

### 2.4 Rotation du volant dans le cockpit

Le volant tourne de 0,95 rad × la position de la direction : **54° à la butée**, atteints en
même temps qu'elle (0,225 s), identiques à toute vitesse ; les bras se croisent. Il n'y a pas
de rotation au-delà, ni de mouvement qui se poursuive pendant que la touche reste tenue.

La planche `work/renders/steering/steering-positions.jpg` montre tout ce que le cockpit sait
afficher : la demande de 0 à 100 % par quarts, à 60 et à 250 km/h.

### 2.5 Direction maintenue plusieurs secondes

Quatre secondes de plein braquage sur une étendue d'asphalte de 900 m de large (copie d'un
circuit élargie, pour que la voiture ne sorte jamais de la route). Profil arcade :

| Départ | Gaz | Lacet établi après | Lacet à 0,5 / 1 / 2 / 4 s (°/s) | Vitesse à 0,5 / 1 / 2 / 4 s (km/h) | Part de l'adhérence utilisée à 0,5 s / 4 s | Glissement maximal | Angle de dérive maximal | Tête-à-queue |
|---|---|---|---|---|---|---|---|---|
| 60 km/h | plein gaz | 0,22 s | 51 / 43 / 34 / 31 | 87 / 108 / 159 / 226 | 1,05 / 1,03 | 0,26 | 0,4° | non |
| 60 km/h | coupés | 0,35 s | 73 / 81 / 81 / 62 | 55 / 48 / 42 / 32 | 1,01 / 0,51 | 0,24 | 0,7° | non |
| 150 km/h | plein gaz | 0,28 s | 32 / 32 / 31 / 30 | 177 / 194 / 223 / 265 | 1,03 / 1,03 | 0,26 | 0,3° | non |
| 150 km/h | coupés | 0,32 s | 36 / 37 / 41 / 52 | 141 / 131 / 113 / 81 | 1,02 / 1,02 | 0,25 | 0,5° | non |
| 250 km/h | plein gaz | 0,30 s | 30 / 30 / 30 / 31 | 260 / 268 / 276 / 291 | 1,02 / 1,03 | 0,27 | 0,3° | non |
| 250 km/h | coupés | 0,30 s | 30 / 31 / 31 / 35 | 235 / 219 / 193 / 147 | 1,02 / 1,02 | 0,26 | 0,3° | non |

Une fois le lacet établi, **rien ne se construit** : la voiture décrit un cercle à la limite
d'adhérence, et le lacet ne varie que parce que la vitesse varie. Pas de dérive qui grandit,
pas de survirage, pas de tête-à-queue, aussi longtemps que la touche est tenue. Les 30 essais
(trois profils, cinq vitesses, avec et sans gaz) donnent le même résultat ; en compétition et
en turbo le glissement est plus fort (jusqu'à 3,9) et la voiture ralentit davantage — à
250 km/h plein gaz elle perd de la vitesse (247 → 220 km/h) — mais l'angle de dérive ne dépasse
pas 2,3° et elle ne part jamais en tête-à-queue.

### 2.6 Déclenchement du glissement et limites d'adhérence

- **Adhérence disponible** : g × 1,72 × échelle du profil × (1 + 0,0002·v²), soit en arcade
  18,5 m/s² à 30 km/h, 24,6 à 150, 35,8 à 250, 43,5 à 300 ; réduite par l'usure, une crevaison,
  les dégâts et la surface (vibreur 0,94, herbe 0,62 en arcade, graviers 0,53).
- **Glissement** = accélération latérale demandée / adhérence − 1, quand la demande dépasse
  l'adhérence. Ses effets : le lacet est plafonné (≈ 1,03 à 1,08 fois l'adhérence) ; la voiture
  est freinée de 7 m/s² par unité de glissement, 10,5 m/s² au plus ; une petite vitesse
  latérale apparaît (elle s'amortit à 5 par seconde).
- **Ce que le joueur en perçoit** : crissement à partir d'un glissement de 0,22 (plein volume
  à 1,15), traces de pneus à partir de 0,55, fumée à partir de 0,85. En arcade le plein
  braquage donne 0,22 à 0,27 : **juste au seuil du crissement, sous celui des traces et de la
  fumée**. En compétition et en turbo il donne 1,5 à 3,9 : crissement, traces et fumée.
- **Tête-à-queue** : il ne vient jamais de la direction. Seuls un choc contre une voiture ou
  une barrière au-delà d'un seuil, ou un atterrissage, font perdre le contrôle.

## 3. Trois explications, et ce que montrent les mesures

| Hypothèse | Ce qu'elle voudrait dire | Ce que montrent les mesures |
|---|---|---|
| **A. Manque de positions dans l'animation** | Le braquage existe, mais le cockpit n'a pas assez de dessins pour le montrer | Vrai en partie : cinq dessins de roues (deux crans par côté), volant limité à 54°. Mais toutes ces positions sont parcourues en 0,14 à 0,22 s : en ajouter ne ferait pas durer le mouvement |
| **B. Manque de progression du braquage dans le temps** | La direction arrive trop vite en butée : tenir la touche n'apporte plus rien | **Vrai** : butée en 0,225 s, à vitesse constante, sans second temps. Une demande brève de 0,3 s et une demande de 4 s produisent la même position |
| **C. Pas de phase de surbraquage ayant de vrais effets** | Tenir la touche devrait finir par faire décrocher la voiture | **Vrai** : la simulation plafonne le lacet à l'adhérence. En arcade le plein braquage ne demande que 1,22 fois l'adhérence et ne fait ni glisser ni pivoter la voiture ; dans les autres profils il la ralentit sans la faire pivoter. Aucun dérapage ne peut naître de la direction seule |

Les trois manques existent donc ensemble ; ils ne sont pas de même nature :

- A est un sujet **de dessin** : sans effet sur la conduite, mais insuffisant seul.
- B est un sujet **de loi de commande** : il change la réponse à un appui bref ou long, donc
  les trajectoires et les corrections — c'est-à-dire la conduite validée.
- C est un sujet **de physique** : il crée un comportement nouveau (dérive, survirage,
  rattrapage ou tête-à-queue).

La remarque du joueur (« le volant devrait tourner davantage en tenant la touche », « virage
plus prononcé », « éventuellement un dérapage ») décrit B et C, avec A comme condition pour
que cela se voie.

## 4. Ce que l'on sait de la référence

- L'analyse vidéo déjà faite (`docs/research/vroom-gameplay-analysis.md`) relève un volant et
  des gants à plusieurs positions, bras croisés à fond de braquage. Elle ne permet **pas** de
  mesurer la progression du braquage : les commandes du joueur n'y sont pas visibles.
- L'étude du genre (`docs/research/genre-study.md`) rapporte, d'une seule source de presse,
  que « le dérapage dépend surtout de l'angle de braquage et pas seulement de la vitesse » et
  qu'on peut contre-braquer pour rattraper la voiture. C'est cohérent avec la remarque du
  joueur, mais non vérifié sur image.

## 5. Pistes possibles — aucune n'est implémentée

| Piste | Répond à | Effet sur la conduite validée |
|---|---|---|
| 1. Plus de dessins (sept ou neuf positions de roues, volant au-delà de 54°) | A | aucun |
| 2. Braquage en deux temps : arrivée rapide à une première position, puis progression lente vers la butée tant que la touche est tenue | B (et A) | change la réponse aux appuis longs ; les appuis brefs peuvent rester identiques |
| 3. Surbraquage : au-delà de la première position, la demande dépasse nettement l'adhérence et l'arrière décroche progressivement (dérive qui grandit, vitesse perdue, crissement, rattrapage en relâchant ou en contre-braquant, tête-à-queue si l'on insiste) | C | comportement nouveau |

Les pistes 2 et 3 touchent à la physique. Conformément à la consigne, si l'une d'elles est
retenue elle sera développée comme **variante expérimentale activable séparément**, la conduite
actuelle restant le comportement par défaut jusqu'à nouvelle autorisation.

## 6. Ce que la vidéo du joueur doit permettre de trancher

Pour confronter ces mesures à la référence, il faudrait y voir, si possible sur une ligne
droite et à deux ou trois vitesses (lente, moyenne, rapide), une direction tenue trois à quatre
secondes :

1. en combien de temps (ou d'images) le volant et les roues atteignent leur position extrême ;
2. s'il y a un premier arrêt puis une reprise du mouvement (deux temps), ou un mouvement
   continu ;
3. combien de positions distinctes des roues avant et du volant on compte ;
4. si la trajectoire se resserre pendant que la touche reste tenue ;
5. si un dérapage apparaît, au bout de combien de temps, à quelles vitesses, à quoi on le
   reconnaît (rotation de la vue, bruit, perte de vitesse, traces) et comment il s'arrête
   (touche relâchée, contre-braquage) ;
6. ce que donne, à l'inverse, une série d'appuis brefs.

Les mêmes relevés sur le jeu actuel sont dans ce document : la comparaison dira laquelle des
pistes — ou quelle combinaison — est la bonne, et avec quelles durées.
