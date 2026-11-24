# Collisions, décollages et accidents

Mise en œuvre des corrections C1 à C8 de `docs/research/vroom-gameplay-analysis.md`
(C9 et C10 n'étaient pas autorisées : la conduite normale n'est pas modifiée).

Principe : une **simulation arcade déterministe** à 120 Hz, faite de quelques états et de
règles explicites, et des **animations paramétrées** pilotées par ces états. Pas de moteur
physique 3D. Les valeurs tirées de la vidéo sont des références approximatives ; les seuils
qu'elle ne donne pas sont des **choix de conception**, étiquetés comme tels dans le code.

## 1. Où est le code

| Fichier | Rôle |
|---|---|
| `src/physics/collision-tuning.js` | Tous les paramètres, annotés `MEASURED` (lus sur la vidéo) ou `DESIGN` (choix à régler en jeu). Aucun paramètre de conduite ici |
| `src/physics/collisions.js` | Contacts entre voitures : classification et conséquences, plan de vol d'une voiture qui décolle sur une autre |
| `src/physics/wheel-contacts.js` | Les roues dans le modèle de collision (essieux, voies, pneus) et le test « une roue avant entre par l'arrière dans une roue arrière » (lot 5, § 2 ter) |
| `src/physics/obstacles.js` | Panneaux de bord de piste solides |
| `src/physics/car-physics.js` | États `AIRBORNE` et `WRECKED`, trois atterrissages (`LANDING` : léger, violent, récupérable), glissade, perturbation de la direction après un saut |
| `src/tracks/scenery-layout.js` | Liste logique des obstacles de chaque circuit (les panneaux de freinage) |
| `src/rendering/compositing/crash-camera.js` | Mouvements de la vue et assiette de la voiture vue de l'extérieur : fonctions pures de l'état simulé |
| `src/rendering/effects/effects-layer.js` | Étoile au point de contact, éclats de panneau, explosion en quatre temps |
| `src/rendering/drawing/scene-builder.js` | Voiture en vol dans les vues extérieures : ombre au sol, inclinaison, écrasement |
| `src/rendering/compositing/cockpit-layer.js` | Volant lâché pendant une perte de contrôle |
| `src/core/collision-lab.js` | Banc d'essai (outil de développement) : rejoue les cas à la demande avec les vraies règles (`collision-test-bench.md`) |

`car-spec.js` (profils de conduite) n'est pas modifié.

## 2. Les huit situations

| Situation | Condition (testable) | Conséquence |
|---|---|---|
| **Collision simple** | Contact entre deux voitures qui ne roulent pas dans le même sens (plus de 37° d'écart), ou dont l'une n'est pas en course | Réponse par impulsion, inchangée ; tête-à-queue si le choc est très violent |
| **Tamponnage arrière** | Même sens, voitures séparées dans l'axe (nez contre arrière), celle de derrière plus rapide | La voiture du joueur qui percute repart **48 km/h moins vite que celle qu'elle a touchée** : elle perd donc 48 km/h plus la vitesse à laquelle elle arrivait. Les deux voitures se séparent aussitôt. Celle de devant n'est pas perturbée. Aucun changement de cap |
| **Contact latéral roue contre roue** | Même sens, voitures séparées en travers (côte à côte) | La plus rapide perd **≈ 96 km/h** ; les deux sont écartées une fois (1,2 m/s) ; aucune n'est tournée. L'autre voiture ne paie pas à son tour tant qu'elles restent côte à côte |
| **Saut récupérable** (choix de gameplay original, voir § 2 ter) | **Une roue avant de la voiture de derrière entre par l'arrière dans une roue arrière de celle de devant, les carrosseries ne se touchant pas** ; vitesse relative ≥ 10 m/s et assez grande pour passer devant (58 km/h en pratique) ; vitesse de la voiture de derrière ≥ 33 m/s (119 km/h) ; caps à moins de 20° l'un de l'autre | La voiture de derrière décolle sans être ralentie, survole l'autre (0,45 à 0,85 s), **retombe sur ses roues devant elle**, sa direction se dandine 0,7 s, et elle continue ; elle a perdu 50 km/h par seconde de vol ; celle de devant n'est pas perturbée |
| **Contact provoquant un accident violent** | Tamponnage avec recouvrement latéral **partiel** des carrosseries (20 à 80 % de la largeur : le nez sur une roue arrière), vitesse relative ≥ 15 m/s et assez grande pour passer devant (58 km/h en pratique), vitesse de la voiture de derrière ≥ 50 m/s (180 km/h) | La voiture de derrière passe à l'état `AIRBORNE` (0,85 s, 1,3 m ; davantage si c'est nécessaire pour passer), **survole l'autre et retombe devant elle, sur le côté de sa trajectoire**, en atterrissage violent ; celle de devant n'est pas perturbée |
| **Obstacle ponctuel** | Voiture hors de l'asphalte dont la boîte recouvre un panneau | Le panneau est couché pour le reste de la course. Sous 40 m/s : la voiture garde 60 % de sa vitesse. Au-dessus : `AIRBORNE` (0,6 s) |
| **Atterrissage léger** | Fin d'un vol déclenché par un obstacle | Vitesse conservée ; glissade hors de contrôle (rotation lente vers la piste, décélération faible puis forte) ; à l'arrêt la voiture est rendue à son pilote **là où elle s'est arrêtée**, en première |
| **Atterrissage violent** | Fin d'un vol déclenché par une voiture | Vitesse ×0,15 ; arrêt en 0,85 s ; `WRECKED` : 3,2 s à l'arrêt ; redémarrage sur place en première, protégé 2 s ; explosion |

Règles communes :

- **tamponnage** : il n'y a ni poussée ni contact prolongé. Toute perte de vitesse du joueur
  est un tamponnage signalé (étoile, onomatopée, piqué de la vue) ; le suivant demande une
  nouvelle approche. Jamais en dessous de 5 m/s ;
- **contact latéral** : une pénalité au plus par seconde et par voiture ;
- **en vol** : la voiture suit sa vitesse, garde le cap, perd 50 km/h par seconde (vitesse
  affichée), ne se dirige plus, reste entre les barrières. Lancée par une autre voiture, elle
  **la survole et retombe devant elle** (décision du joueur après les essais de la PR #4 ;
  jusque-là elle était retenue derrière, comme dans la vidéo de référence). Elle n'est jamais
  déplacée : ce qui est choisi au décollage est la durée du vol (§ 2 ter) ;
- une voiture en vol ou accidentée **ne peut pas être heurtée** (pas de carambolage en
  chaîne) ; les pilotes de l'ordinateur contournent une épave comme toute voiture arrêtée ;
- **voitures de l'ordinateur** : mêmes règles avec **30 %** de la perte fixe
  (`computerPenaltyScale`), une séparation étroite après un tamponnage
  (`computerBumpSeparation`, 0,5 m/s) et une pénalité au plus par seconde, pour qu'un peloton
  ne se mette pas en accordéon. Choix de conception ; la vidéo ne montre que le joueur ;
- **règle des dégâts** (mode compétition) : un tamponnage, un contact de roues ou un contact
  qui fait décoller abîment les deux voitures selon la vitesse à laquelle elles se sont
  rencontrées, à la même échelle que les contacts simples (`(vitesse − 3 m/s) × 0,008`).
  L'atterrissage, l'explosion et les panneaux n'ajoutent rien : choix de conception (la
  voiture repart intacte, comme dans la référence).

## 2 bis. Le saut récupérable de la PR #4 — état précédent, remplacé au lot 5

> **Cette section décrit le saut tel qu'il était dans la PR #4.** Après ses essais, le joueur
> a demandé qu'il ne vienne que d'un contact entre roues et que la voiture franchisse celle
> qui l'a fait décoller : la règle actuelle est au § 2 ter. Ce qui suit est conservé pour
> l'historique (déclenchement par recouvrement des carrosseries, ralentissement au choc,
> voiture retenue derrière) ; ce qui reste vrai : le choix de gameplay original, la
> perturbation de la direction après l'atterrissage, le délai de 1,5 s.

**C'est un choix de gameplay original.** La vidéo de référence ne montre que l'accident violent
(E3) et le décollage sur un obstacle (E5) ; rien n'y confirme l'existence d'un saut après lequel
la voiture continue. Il a été ajouté à la demande du joueur. Tous ses paramètres sont des choix
de conception (`hop…` dans `collision-tuning.js`), à régler par des essais.

Le contact concerné est toujours le même : **une roue qui monte sur une roue**, la roue avant
de la voiture de derrière contre la roue arrière de celle de devant. Il se présente de deux
façons :

- par l'arrière, voitures décalées : du simple pneu contre pneu au bord des voitures jusqu'à
  80 % de la largeur en recouvrement. Au-delà (nez dans la boîte de vitesses), il n'y a pas de
  roue à escalader : c'est un tamponnage ;
- côte à côte, quand les voitures se chevauchent sur la moitié de leur longueur au plus (la
  roue avant de l'une à hauteur de la roue arrière de l'autre). Complètement côte à côte, les
  roues ne font que frotter : c'est le contact E2, inchangé.

Trois niveaux de conséquence, selon l'énergie du contact (tout est explicite et déterministe,
aucun tirage au sort) :

| Niveau | Vitesse relative | Vitesse de la voiture de derrière | Conséquence |
|---|---|---|---|
| Sans décollage | moins de 36 km/h | — | mécanisme validé, inchangé : tamponnage par l'arrière, contact de roues côte à côte |
| **Saut récupérable** | 36 km/h au moins | 120 km/h au moins | saut court, la course continue |
| Accident violent (E3) | 54 km/h au moins, **par l'arrière**, 20 à 80 % de la largeur en recouvrement | 180 km/h au moins | inchangé : vol de 0,85 s, explosion, arrêt, redémarrage |

Autres conditions du saut : les deux voitures roulent dans le même sens à moins de 20° près ;
la règle des accidents est active (elle l'est dans tous les modes) ; la voiture n'a pas
elle-même atterri d'un saut depuis moins de 1,5 s. Avec l'écart de vitesse de l'accident mais
sans ses autres conditions (trop lentement : 170 km/h sur une voiture à 100 ; ou pneu contre
pneu au bord des voitures, moins de 20 % de recouvrement), le contact donne un saut. Côte à
côte, il n'y a jamais d'accident violent : au plus un saut.

Ce qui déclenche quoi, par l'arrière, selon le décalage latéral entre les deux voitures
(`node work/scripts/hop-trigger-table.mjs`, résultats dans
`work/benchmarks/hop-trigger-table.json` ; simulation seule) :

| Décalage (largeur en recouvrement) | 170 km/h sur 150 | 200 km/h sur 150 | 262 km/h sur 188 |
|---|---|---|---|
| 0 m et 0,3 m (100 % et 84 %) : en ligne | tamponnage | tamponnage | tamponnage |
| 0,5 m à 1,4 m (73 % à 25 %) : roues engrenées | tamponnage | **saut** | accident violent (E3) |
| 1,6 m et 1,8 m (14 % et 3 %) : pneu contre pneu | tamponnage | **saut** | **saut** |
| 2,0 m : plus de recouvrement | aucun contact | aucun contact | aucun contact |

Déroulement :

1. **Choc** : la voiture est ralentie d'un coup à 25 km/h de moins que celle dont elle escalade
   la roue (jamais accélérée). C'est là que le saut coûte le plus, à l'instant où la cause se
   voit : étoile sur la roue, secousse, « HOP ! ».
2. **Envol** : 0,45 s, 0,55 m au sommet (l'accident : 0,85 s et 1,3 m). La voiture perd
   50 km/h par seconde comme dans tout vol, soit 22,5 km/h. Plus lente que la voiture qui l'a
   soulevée, elle s'en éloigne naturellement ; elle est de plus tenue à l'écart de toutes les
   autres : **elle ne retombe dans personne**. Partie d'un contact côte à côte, elle est
   écartée de l'autre voiture (1,5 m/s).
3. **Atterrissage sur les roues** : rien n'est retiré à cet instant (pas de saut de vitesse à
   l'image). Elle se pose 48 km/h moins vite que n'allait l'autre voiture au choc — le même
   écart qu'après un tamponnage : les deux se séparent. Un garde-fou maintient cet écart si la
   voiture de devant a freiné pendant le vol. Ni explosion, ni arrêt, ni remise en piste ; elle
   roule dès l'atterrissage.
4. **Direction perturbée** : pendant 0,7 s le volant part d'un côté (à l'opposé de la voiture
   touchée) puis revient, jusqu'à 30 % de sa course. Les deux mouvements se compensent : sans
   correction la voiture se retrouve dans son cap d'origine, décalée d'environ un demi-mètre.
   Les commandes du pilote restent actives pendant tout ce temps.
5. Ensuite la voiture répond exactement comme avant (vérifié contre une voiture qui n'a pas
   sauté, à la même vitesse).

Mesuré dans la simulation (`collision-comparison.json`, entrée `HOP`) : 206 km/h sur une
voiture à 154 → 129 km/h après le choc (−77), 22,5 km/h perdus pendant les 0,45 s de vol,
0,4 km/h dans le pas de l'atterrissage (la décélération du vol, rien de plus), posée à
107 km/h ; 202 km/h deux secondes plus tard à pleine charge ; écart latéral 0,45 m ; cap
retrouvé à 0,2° près.

Première version et correction : la perte de vitesse était d'abord appliquée **à
l'atterrissage** (la vitesse tombait de 180 à 103 km/h en une image, sans cause visible), et
la voiture était retenue derrière l'autre pendant le vol alors que son compteur indiquait
30 à 50 km/h de plus. Le second critique indépendant a relevé les deux (§ 10). La vitesse
d'arrivée au sol est la même qu'avant ; seul le moment où elle est perdue a changé.

Ce que cela change pour les contacts validés : rien en dessous de 36 km/h de vitesse relative,
rien en ligne. Le contact roue contre roue de référence (E2, environ 25 km/h d'écart) et les
tamponnages d'E4 (en ligne, donc sans roue à escalader) donnent exactement la même télémétrie
qu'avant, image par image. Un cas change de nature : par l'arrière, pneu contre pneu au bord
des voitures (moins de 20 % de recouvrement) à plus de 36 km/h d'écart, le contact était un
tamponnage et devient un saut — c'est le contact « roue contre roue » au sens strict.

## 2 ter. Lot 5 — le saut vient des roues, et tout décollage franchit la voiture

Décisions du joueur après les essais de la PR #4 :

1. un saut récupérable provoqué par une voiture vient **exclusivement d'un contact entre les
   roues** des deux véhicules ;
2. un décollage, récupérable ou non, **franchit l'obstacle** qui l'a provoqué : la voiture se
   retrouve devant lui.

### Les roues dans le modèle de collision

Jusqu'ici une voiture était une boîte (4,2 × 1,86 m) et « roue sur roue » se déduisait du
recouvrement de deux boîtes. Les roues existent maintenant dans le modèle
(`src/physics/wheel-contacts.js`, `WHEEL_LAYOUT`) :

| | Avant | Arrière |
|---|---|---|
| Essieu, depuis le centre de la voiture | +1,55 m | −1,35 m |
| Centre du pneu, depuis l'axe | 0,90 m | 0,82 m |
| Pneu vu de dessus (longueur × largeur) | 0,65 × 0,29 m | 0,66 × 0,42 m |
| Bord extérieur du pneu, depuis l'axe | 1,045 m | 1,03 m |
| Dépassement hors de la carrosserie (boîte à 0,93 m) | 11,5 cm | 10 cm |

Ce sont les cotes du dessin de la voiture (`CAR_DIMENSIONS` dans
`src/art/vehicles/car-model.js`). **La simulation ne lit pas le dessin** : les chiffres sont
écrits dans le modèle de collision et un test les compare à ceux du dessin
(`wheel-contacts.test.mjs`). La carrosserie reste la boîte validée : tamponnages et
frottements ne changent pas.

Conséquence géométrique : les pneus dépassent de la carrosserie d'une largeur de main de
chaque côté et sont en retrait de son nez et de sa queue. Deux pneus ne peuvent donc se
toucher **sans que les carrosseries se touchent** que dans une bande étroite, quand les deux
voitures sont décalées de 1,86 à 2,075 m : la roue avant de l'une est alors derrière la roue
arrière de l'autre, bord contre bord.

### La règle du saut

Un saut récupérable part quand **toutes** ces conditions sont réunies au même pas de
simulation :

1. les deux **carrosseries ne se touchent pas** (sinon c'est un tamponnage ou un frottement,
   traités comme avant), et la carrosserie de la voiture de derrière **n'a touché aucune
   voiture dans ce pas ni dans la demi-seconde précédente** (`hopAfterContactTime`). Les
   contacts de carrosserie de tout le peloton sont traités d'abord, les roues ensuite : le
   résultat ne dépend pas de l'ordre des voitures dans la liste ;
2. vus de dessus, **un pneu avant de la voiture de derrière recouvre un pneu arrière de celle
   de devant**, sur au moins 4 cm de bande de roulement (`hopTyreOverlapMin` : un pneu qui
   effleure le coin d'un autre ne l'escalade pas) ;
3. **un pas plus tôt ce pneu avant était encore entièrement derrière la face arrière de ce
   pneu arrière, et à l'instant où son bord avant a passé le plan de cette face il était dans
   la largeur du pneu arrière** : il est entré par l'arrière. Deux pneus qui se rejoignent par
   le côté ne comptent pas, quelle que soit la différence de vitesse : leur premier contact est
   sur les flancs — y compris un pneu qui arrive en biais, passe à côté de l'autre puis
   rencontre son flanc ;
4. vitesse relative le long de la voiture de devant ≥ 36 km/h (`hopClosingSpeed`), vitesse de
   la voiture de derrière ≥ 119 km/h (`hopMinSpeed`), caps à moins de 20° ;
5. la voiture n'a pas atterri d'un saut depuis moins de 1,5 s ; la règle des accidents est
   active ;
6. **sa vitesse lui permet de passer devant** (plan de vol ci-dessous) ; sinon elle ne décolle
   pas.

Sont pris en compte, comme demandé : la position des essieux, la largeur des pneus,
l'orientation des deux voitures (les rectangles tournent avec elles), la roue avant de la
voiture qui percute, la roue arrière de la voiture percutée, la vitesse relative et la
direction du contact (entrée par la face arrière). Les roues avant sont prises dans l'axe de
la voiture : aux vitesses où un saut est possible l'angle de braquage ne dépasse pas 4°, ce
qui déplace les coins d'un pneu de 2 cm.

### Ce que donne chaque contact

Arrivée par l'arrière, les deux voitures tenant leur vitesse, selon le décalage latéral entre
leurs axes (`node work/scripts/hop-trigger-table.mjs`, `work/benchmarks/hop-trigger-table.json` ;
simulation seule) :

| Décalage | Ce qui se touche | 200 km/h sur 150 (écart 50) | 215 sur 150 (écart 65) | 175 sur 110 (écart 65) | 262 sur 188 (écart 74) |
|---|---|---|---|---|---|
| 0 à 0,3 m | nez contre arrière, en ligne | tamponnage | tamponnage | tamponnage | tamponnage |
| 0,5 à 1,3 m | nez sur une roue arrière (20 à 80 % des carrosseries) | tamponnage | **accident violent (E3)** | tamponnage (moins de 180 km/h) | **accident violent (E3)** |
| 1,5 à 1,84 m | aileron avant contre roue arrière, carrosseries en léger recouvrement | tamponnage ou frottement | tamponnage ou frottement | tamponnage ou frottement | tamponnage ou frottement |
| **1,87 à 2,03 m** | **roue avant dans le dos d'une roue arrière, carrosseries séparées** | rien (pas assez d'écart pour passer) | **saut récupérable** | **saut récupérable** | **saut récupérable** |
| 2,06 m | pneus qui s'effleurent (moins de 4 cm) | rien | rien | rien | rien |
| 2,1 m et plus | rien | aucun contact | aucun contact | aucun contact | aucun contact |

Côte à côte, des pneus qui se rejoignent par le flanc frottent (E2, inchangé) et ne font
jamais décoller, même avec 65 km/h d'écart.

Le test `wheel-contacts.test.mjs` balaie 909 arrivées (décalages de −2,5 à +2,5 m par pas de
5 cm, trois angles d'arrivée de 0 à 6°, trois couples de vitesses) : 24 sauts, 235 accidents,
366 tamponnages, 16 frottements, 268 sans contact. Pour **chaque** saut il vérifie, avec une
géométrie écrite à part du jeu, qu'un pneu avant recouvre un pneu arrière au pas du décollage,
que les carrosseries ne se touchent pas et ne se sont pas touchées avant, et que la voiture
est derrière l'autre, au bord.

### Le vol : ce qui a été retiré, ce qui le remplace

Retiré de `collisions.js` : `keepHopClear()` (qui reculait la voiture pendant le saut pour
qu'elle ne gagne pas de terrain, et l'écartait des autres) et `holdFlightBehind()` (qui
maintenait la voiture accidentée derrière celle qui l'avait lancée). Retiré aussi : le
ralentissement du saut au choc (25 km/h sous l'autre voiture) et le plafond de vitesse à
l'atterrissage, qui servaient à retomber derrière.

À la place, **le vol est libre** : à chaque pas la voiture avance de sa propre vitesse, qui
baisse de 50 km/h par seconde comme dans tout vol. Rien ne la déplace (vérifié pas par pas, au
micromètre). Ce qui est décidé au décollage (`flightPlan`) :

- **la durée du vol** : la durée mesurée ou choisie (0,85 s pour l'accident, 0,45 s pour le
  saut), **ou davantage quand il le faut pour retomber devant** : la queue de la voiture
  0,5 m devant le nez de l'autre (`flightClearance`), l'autre continuant comme elle roule à
  cet instant. Au plus 1,1 s pour l'accident, 0,85 s pour le saut ;
- **un lieu d'atterrissage libre** : l'endroit où la voiture retombera est comparé à la place
  qu'occupera alors **chaque voiture du peloton**, chacune poursuivant sa route à sa vitesse.
  S'il est occupé, le vol est allongé pas à pas jusqu'à ce qu'il soit libre, dans la limite de
  la durée maximale ;
- **s'il y a décollage** : si, à la vitesse actuelle de l'autre voiture, la voiture ne peut
  pas passer devant dans cette durée, ou si aucun lieu d'atterrissage libre n'est trouvé,
  **elle ne décolle pas** (le contact reste un tamponnage, ou rien pour des pneus au bord) ;
- **pour l'accident seulement, un écart latéral** : la voiture est jetée de côté, juste assez
  pour retomber à côté de la trajectoire de l'autre (0,4 m entre les deux carrosseries,
  `flightSideClearance`) : du côté où elle se trouve, ou de celui où sa route la mène quand
  elle arrive en biais (le déplacement latéral de l'autre voiture est compté). Sans cela l'épave, qui s'arrête
  en moins d'une seconde, serait posée devant la voiture qu'elle vient de survoler, qui la
  traverserait (une épave ne peut pas être heurtée) : c'était le défaut E3x-1 relevé par le
  critique du premier lot. Le saut, lui, vole droit : ses roues touchaient au bord, il est
  déjà à côté.

Hauteur : 1,3 m au sommet pour un vol de 0,85 s, proportionnelle au carré de la durée ; jamais
moins de 0,55 m pour un saut.

**L'atterrissage attend s'il le faut** (`holdLanding`) : le lieu d'atterrissage est choisi
libre au décollage, mais une voiture peut changer de vitesse ou de ligne pendant le vol. Dans
les 0,12 dernières secondes on regarde donc de nouveau où la voiture va se poser. Si elle
n'est pas encore passée alors qu'elle gagne toujours du terrain (l'autre a accéléré plus que
prévu), elle reste en l'air 0,5 s de plus au maximum ; si une voiture est sous elle ou à
l'endroit où elle se poserait, elle reste en l'air à la hauteur qu'elle a et **se dégage** de
cette voiture, pour une durée bornée : voir § 2 quater (cette partie a été reprise lors de la
sécurisation de la PR #8 ; auparavant elle attendait tant que la voiture y était).

**Barrières** : inchangé, une voiture en vol est retenue entre les barrières (elle y perd sa
vitesse vers l'extérieur, sans effet visible). Test : l'accident E3 rejoué contre la barrière
de droite reste à l'intérieur à chaque pas et ne se pose sur personne.

### Les vitesses et durées de la PR #4 ne permettaient pas de franchir : solutions chiffrées

Pour retomber devant, la voiture doit gagner sur l'autre, pendant son vol, la distance qui la
sépare d'une position « queue devant le nez » : **8,2 m** pour un saut (de 3,5 m derrière à
4,7 m devant, centre à centre), **8,9 m** pour l'accident (de 4,2 m derrière à 4,7 m devant).
Elle gagne `écart × durée − 25 km/h par seconde × durée² ÷ 2` (elle perd 50 km/h par seconde,
l'autre tient sa vitesse).

| | Écart de vitesse | Durée du vol | Distance gagnée | Franchit ? |
|---|---|---|---|---|
| Saut de la PR #4 (ralenti au choc à 25 km/h **sous** l'autre voiture) | — | 0,45 s | négative | non, par construction |
| Saut, sans ralentissement, au seuil de la PR #4 | 36 km/h | 0,45 s | 3,1 m | non |
| | 36 km/h | n'importe laquelle | 3,6 m au mieux (après 0,72 s, puis l'autre la rattrape) | **non, quelle que soit la durée** |
| Accident de la PR #4, au seuil | 54 km/h | 0,85 s | 7,7 m | non (il manque 1,2 m) |
| Accident du banc d'essai (262 km/h sur 188) | 74 km/h | 0,85 s | 12,5 m | oui, 3,6 m de marge |

Avec la perte de vitesse en vol validée, **aucune durée de vol ne fait franchir une voiture
en dessous de 54,4 km/h d'écart pour un saut, 56,6 km/h pour l'accident** : la voiture retombe
à la vitesse de l'autre avant d'être passée. Quatre mécanismes étaient possibles :

| Solution | Ce qui change | Seuil de décollage | Durée du vol | Coût du saut pour le joueur |
|---|---|---|---|---|
| **S1 — durée de vol suffisante, perte en vol conservée (retenue)** | pas de ralentissement au choc ; le vol dure ce qu'il faut pour passer, dans des bornes ; pas de décollage si c'est impossible | **58 km/h** d'écart mesurés (saut et accident), au lieu de 36 et 54 | saut 0,45 à 0,85 s ; accident 0,85 à 1,1 s | 22 à 41 km/h (le temps passé en l'air), et il est devant |
| S2 — freinage en vol allégé pour le saut (`hopAirDecel` : 3 m/s² au lieu de 13,9) | une seconde valeur de perte en vol, propre au saut | 39 km/h d'écart avec un vol de 0,85 s au plus | 0,45 à 0,85 s | 5 à 9 km/h : le saut devient un dépassement presque gratuit |
| S3 — impulsion au décollage | la voiture reçoit la vitesse qui lui manque (41 km/h de plus en arrivant avec 36 km/h d'écart, pour un vol de 0,45 s) | 36 km/h | 0,45 s | négatif : un contact qui accélère la voiture |
| S4 — retomber à côté quand on ne peut pas passer | seuils de la PR #4 conservés ; la voiture se pose à hauteur de l'autre, sur le côté | 36 et 54 km/h | 0,45 et 0,85 s | — mais elle n'est pas « devant » |

**S1 est en place** : c'est la seule qui garde la règle commune et validée du vol (50 km/h
perdus par seconde), ne fait jamais gagner de vitesse à une voiture, et tient la règle du
joueur à chaque décollage. Son prix : il faut **58 km/h d'écart** pour décoller, et un vol
au seuil est long (0,83 s pour un saut, 1,1 s et 2,2 m de haut pour l'accident). S2 se règle
par un seul nombre (`hopAirDecel` dans `collision-tuning.js`) ; S3 et S4 demanderaient du
code. **C'est un arbitrage à rendre par le joueur.**

Vols mesurés avec S1, voitures tenant leur vitesse :

| Arrivée | Contact | Durée du vol | Sommet | Vitesse au décollage → à l'atterrissage | Retombe |
|---|---|---|---|---|---|
| 208 km/h sur 150 (seuil) | roue sur roue | 0,83 s | 1,2 m | 208 → 167 km/h | 0,5 m devant le nez de l'autre |
| 215 km/h sur 150 (banc d'essai) | roue sur roue | 0,63 s | 0,69 m | 215 → 184 km/h | 0,6 m devant |
| 230 km/h sur 150 | roue sur roue | 0,45 s | 0,55 m | 229 → 207 km/h | 0,7 m devant |
| 262 km/h sur 188 | roue sur roue | 0,50 s | 0,55 m | 260 → 236 km/h | 0,5 m devant |
| 208 km/h sur 150 (seuil) | nez sur roue : accident | 1,11 s | 2,2 m | 208 → 153 km/h, puis ×0,15 | 0,5 m devant, 0,4 m sur le côté |
| 215 km/h sur 150 | nez sur roue : accident | 0,86 s | 1,3 m | 215 → 172 km/h, puis ×0,15 | 1,6 m devant, 0,4 m sur le côté |
| 262 km/h sur 188 (banc d'essai) | nez sur roue : accident | 0,86 s | 1,3 m | 261 → 218 km/h, puis ×0,15 | 3,7 m devant, 0,4 m sur le côté |

Dans tous ces cas la voiture se pose au moins aussi vite que l'autre : après un saut les deux
ne se retrouvent pas. Après l'accident, l'autre voiture longe l'épave 0,14 s plus tard, à
0,43 m.

### Ce que le saut coûte maintenant

Rien au choc, rien à l'atterrissage : **le temps passé en l'air**, à 50 km/h par seconde. Un
saut au seuil coûte 41 km/h, le saut du banc 31 km/h, un saut à fort écart 22 km/h ; un
tamponnage coûte 48 km/h plus l'écart, et laisse derrière. Le saut est donc devenu un
dépassement, qui demande de viser une bande de 17 cm de chaque côté avec 58 km/h d'écart :
toucher plus à l'intérieur donne un tamponnage, ou l'accident violent au-delà de 180 km/h.

### Références E3 et E5 : ce qui change

**E5 (panneau) ne change pas.** Le panneau était déjà franchi : couché au contact, la voiture
décolle à sa hauteur et retombe 0,6 s plus tard, **35,5 m au-delà du panneau** dans la
séquence du banc (242 km/h au choc), puis glisse comme avant. La télémétrie de la séquence est identique image
par image à celle de la PR #4 (390 images), et les 14 mesures de comparaison sont identiques.

**E3 (accident) change, pour la position seulement.** Sur 17 mesures de comparaison, 13 sont
identiques (vitesse au contact, durée du vol, atterrissage 228 → 35 km/h, arrêt, immobilisation,
redémarrage, mise en scène de la vue, explosion). Les quatre autres :

| Mesure | Référence (vidéo) | PR #4 | Maintenant |
|---|---|---|---|
| Voiture heurtée à l'atterrissage (centre à centre) | « les voitures heurtées sont juste devant » | 4,2 m **devant** la voiture accidentée | 5,2 m **derrière** elle (la voiture accidentée est passée devant) |
| Deux secondes plus tard | elles s'éloignent | 126 m devant | 117 m devant : elle a longé l'épave et repris la tête |
| Perte en vol | 50 km/h/s | 49,6 km/h/s | 49,5 km/h/s (la vitesse compte l'écart latéral) |
| Vitesse à l'atterrissage | 228 → 35 km/h | 222,4 → 33,3 km/h | 222,5 → 33,3 km/h |

Sur ce point Virage GP **s'écarte maintenant de la vidéo de référence, à la demande du
joueur** : dans la vidéo les voitures heurtées sont devant après le vol.

Séquences du banc, télémétrie image par image (`python3 work/scripts/telemetry-compare.py`) :

| Séquence | Images | Comparaison avec la PR #4 |
|---|---|---|
| E2 (roue contre roue sans saut) | 192 | identique, les 16 grandeurs de chaque image |
| E4 (tamponnages) | 600 | identique |
| E5 (panneau) | 390 | identique |
| E3, E3x (accident) | 570 et 480 | identiques jusqu'à l'image du décollage (101 images, 1,68 s). Ensuite : **identiques** pour l'état de la voiture, la hauteur, le tangage de la vue, le piqué de contact, les événements et leurs instants, la vitesse de l'autre voiture ; **différentes** pour la position latérale (jusqu'à 1,43 m), la distance à l'autre voiture (jusqu'à 12,2 m), la vitesse affichée pendant le vol (0,1 km/h au plus, 38 images) et, après le redémarrage, la commande du pilote du banc, qui repart d'un autre endroit |
| HOP, HOPx (saut) | 480 | autre scénario (roue contre roue, 215 km/h au lieu de 200 km/h à une demi-largeur) : non comparable |

Dans la séquence E3 du banc : décollage à 262 km/h, 4,2 m derrière l'autre voiture ; à
l'atterrissage, 0,86 s plus tard, la voiture est 7,8 m devant elle (3,6 m entre sa queue et le
nez de l'autre) et 2,3 m sur le côté ; l'autre voiture longe l'épave 0,13 s plus tard.

### Courses complètes : ce que la règle change

21 courses de trois tours à 16 voitures conduites par l'ordinateur (six circuits × trois
tirages en règles arcade, trois courses en règles de compétition),
`node work/scripts/race-rules-comparison.mjs`, les mêmes courses sur les sources de la PR #4
(`work/benchmarks/race-rules-before.json` et `race-rules-after.json`) :

| Sur les 21 courses | PR #4 | Maintenant |
|---|---|---|
| Somme des temps des vainqueurs | 4 268,55 s | 4 268,55 s (identique) |
| Voitures à l'arrivée | 279 | 293 |
| Tamponnages / frottements de roues | 184 / 1 090 | 219 / 1 110 |
| **Sauts récupérables** | **42** | **0** |
| Accidents violents | 10 | 5 |
| Vols retombés devant la voiture survolée | 0 sur 52 | 3 sur 5 |
| Vols posés en recouvrant la voiture survolée | 3 | 0 |
| Remises en piste | 17 | 25 |

À dire nettement : **dans ces 21 courses, aucun saut récupérable ne se produit plus.** Le
contact géométrique lui-même (une roue avant qui entre par l'arrière dans une roue arrière)
y arrive 108 fois, mais presque toujours à faible écart de vitesse : 7 fois au-dessus de
36 km/h, 3 fois au-dessus de 57 km/h, et ces trois-là ne décollent pas : la voiture arrive en
biais (8°, 12° et 16°) et un coin de sa carrosserie touche l'autre au même pas (de 2 à 8 cm) —
les carrosseries passent d'abord, c'est un frottement. Le saut est devenu un événement de
pilotage, reproductible au banc d'essai, pas un incident de peloton. Les deux accidents qui ne
retombent pas devant sont sur le circuit urbain, à un écart de vitesse proche du seuil (59 et
62 km/h), sur une voiture qui accélérait : le vol a duré 1,28 s, attente comprise, et la
voiture s'est posée en retrait de l'autre (6,5 m derrière son nez et 2,8 m sur le côté pour
l'une ; 10,5 m derrière son nez pour l'autre). Les trois autres retombent de 1,8 à 3,7 m
devant. Aucun des cinq ne se pose sur une voiture ; trois le faisaient avec les règles de la
PR #4.

Coût de la simulation : 21 à 23 microsecondes par pas de 16 voitures avant comme après (trois
courses complètes, médiane de cinq passes) : pas d'écart mesurable.

### Relecture indépendante du code, et suites

Le code de ce lot a été relu par un relecteur indépendant, qui n'avait que le diff et les
règles attendues. Il a d'abord confirmé, sur 17 640 arrivées à deux voitures comparées pas à
pas avec les sources de la PR #4, que **tout contact sans vol est identique** (position, cap,
vitesse, dégâts, événements), puis il a trouvé et reproduit sept défauts. Tous sont corrigés,
chacun avec un test.

| N° | Défaut | Correction |
|---|---|---|
| 1 (grave) | Dans un peloton, un saut dont l'attente à l'atterrissage arrivait à son terme (1,5 s) se posait **dans** une troisième voiture : les deux étaient écartées d'un mètre en un pas et celle de dessous pénalisée (188 → 92 km/h) | Le lieu d'atterrissage est choisi libre de toute voiture dès le décollage (sinon pas de décollage) ; l'attente n'a plus de terme tant qu'une voiture est dessous. Test : cinq placements de troisième voiture, personne n'est déplacé ni pénalisé |
| 2 | L'accident retombait dans la trajectoire de l'autre voiture dès que la voiture arrivait en biais de 0,6° : l'écart latéral supposait les deux voitures parallèles | Le déplacement latéral de l'autre voiture pendant le vol est compté. Test : de −1,7° à +2,9°, des deux côtés |
| 3 | Deux contacts au même pas (une roue sur une roue, le nez sur une troisième voiture) donnaient un saut ou un accident selon l'ordre des voitures dans la liste ; une voiture qui venait de décoller pouvait encore être poussée par un autre contact du même pas (ce second point existait déjà dans la PR #4 pour l'accident) | Carrosseries d'abord pour tout le peloton, roues ensuite ; plus aucun contact pour une voiture qui vient de décoller. Test : onze positions de la troisième voiture, les six ordres donnent chaque fois le même résultat (avant correction, le résultat dépendait de l'ordre sur 14 cm de positions) |
| 4 | Un frottement de carrosserie à très fort écart (coin contre coin) écartait les voitures, et trois pas plus tard la roue entrait dans la roue : saut | Pas de saut dans la demi-seconde qui suit un contact de carrosserie. Test |
| 5 | Quand l'attente reprenait après avoir cessé, la voiture remontait de 38 cm en un pas | La hauteur tenue est celle du début de chaque attente. Test : pas de remontée de plus de 2 cm |
| 6 | Un pneu arrivant en biais pouvait passer à côté de l'autre puis toucher son flanc, et être compté comme entré par l'arrière (13 cas sur 897 dans une grille d'essai) | La position latérale est vérifiée à l'instant où le pneu passe le plan de la face arrière. Test : 0 cas sur 827 |
| 7 | Le cas 6 du banc (nez contre roue) roulait à 177 km/h, à 3 km/h du seuil de l'accident | Cas ramené à 165 km/h sur une voiture à 100 |

Relevé par le relecteur hors de ce lot, **non corrigé** : une voiture de l'ordinateur retirée
de la course après un abandon (elle n'est plus dessinée) reste un obstacle solide pour les
contacts. C'était déjà le cas dans la PR #4 ; la correction tient en une ligne mais modifie
les courses avec abandons : à décider.

### Limites et points à arbitrer

- **Fréquence des sauts** : voir ci-dessus. Si elle est jugée trop faible, deux leviers, non
  essayés : S2 abaisse le seuil à 39 km/h ; et ne plus compter comme « carrosserie » les coins
  de la boîte où le dessin ne montre rien (au-delà de l'aileron, devant la roue) rendrait
  éligibles les arrivées en biais — les trois contacts rapides des courses d'essai sont de
  ceux-là — mais ferait de certains frottements validés des sauts.
- **Entre 1,5 et 1,86 m de décalage**, c'est l'aileron avant, puis un coin de la boîte de
  carrosserie où le dessin ne montre rien, qui touche avant les roues : tamponnage ou
  frottement, comme avant. La bande du saut est donc de 17 cm (21,5 cm moins les 4 cm de
  gomme exigés) de chaque côté.
- **Sous le seuil de 58 km/h, des pneus au bord des voitures se croisent toujours sans
  effet** (ni contact ni événement), comme dans la PR #4 : rien n'a été ajouté là.
- **Seuil de l'accident** : 58 km/h d'écart au lieu de 54 sur une voiture qui tient sa
  vitesse ; entre les deux, le contact est un tamponnage.
- **Vol au seuil de l'accident** : 1,1 s et 2,2 m de haut, plus spectaculaire que l'accident
  « normal » (0,85 s, 1,3 m). `flightTimeCarMax` le limite ; le ramener à 0,85 s porte le
  seuil à 59 km/h.
- **Voiture survolée qui accélère fort** : si elle ne peut pas être dépassée, la voiture se
  pose à sa hauteur, sur le côté (accident) ou derrière elle une fois qu'elle est partie.
- **Épave** : toujours traversable par les autres voitures pendant son immobilisation ; seule
  la voiture survolée est sûre de passer à côté.
- **Contre une barrière**, l'écart latéral de l'accident peut être refusé par le rail ;
  l'atterrissage attend alors que la voiture survolée soit partie.
- **Attente en l'air** : si une voiture freine ou se rabat sous le lieu d'atterrissage pendant
  le vol, la voiture reste à sa hauteur (20 à 60 cm) tant qu'elle est dessous ; à l'image, une
  voiture qui glisse au-dessus d'une autre. Mesuré en cherchant le pire : 854 vols (saut et
  accident) avec une troisième voiture placée de 6 à 40 m devant et qui freine dès le
  décollage, à sept intensités : 137 attentes, la plus longue de 0,77 s (un saut de 1,45 s au
  lieu de 0,62 s), aucune voiture posée sur une autre. Il n'y a pas de plafond explicite ; la
  seule borne est que l'attente cesse quand la voiture en vol n'a presque plus de vitesse
  (moins de 4 km/h), ce qui demanderait qu'une voiture reste dessous pendant plus de quatre
  secondes en freinant exactement comme elle : non observé.
- **Dans un peloton serré, moins de décollages** : s'il n'y a pas de place libre où retomber,
  la voiture ne décolle pas et le contact reste un tamponnage.
- **En virage**, « devant » n'a plus de sens simple : le vol est rectiligne.
- **Mise en scène** : les mouvements de la vue et l'assiette de la voiture en vol suivent la
  part du vol accomplie ; ils n'ont pas été réglés pour des vols plus longs que 0,85 s, ni
  pour l'attente en l'air.
- Rien de tout cela n'a été essayé au volant par une personne.

## 2 quater. Sécurisation de la PR #8 — l'attente à l'atterrissage est bornée

Base : PR #8, commit `dc8b823`. Demande : qu'aucun vol ne puisse rester suspendu indéfiniment,
**sans** réintroduire d'atterrissage dans une voiture, et sans se contenter d'un délai maximal
suivi d'un atterrissage forcé.

### Le défaut

Le lieu d'atterrissage est choisi libre au décollage ; si une voiture s'y trouve quand même à
la fin du vol, l'atterrissage attend. Dans `dc8b823` il attendait **tant qu'une voiture était
dessous**, et quand la voiture en vol n'avait presque plus de vitesse (moins de 4 km/h) elle
se posait **quoi qu'il y ait dessous**. Une voiture qui cale sa vitesse sur celle de la voiture
en vol (elle freine comme elle ralentit) la gardait donc en l'air jusqu'à l'arrêt complet des
deux, 4 à 5 secondes plus tard ; puis la voiture était posée, à l'intérieur de l'autre quand
elle était encore là. Reproduit sans difficulté : un conducteur scripté qui « fait ce qu'il
peut pour rester dessous » (accélérateur, frein, volant, rien d'autre) suffit, et la voiture
heurtée elle-même peut le faire en accélérant.

Deux défauts voisins ont été trouvés en écrivant les tests :

- le lieu d'atterrissage était regardé **une fraction de pas en avance** au lieu de l'instant
  où la voiture se pose (fin du pas où son temps de vol s'achève) : jusqu'à un demi-mètre
  d'erreur à grande vitesse relative, d'où des voitures posées quelques centimètres dans une
  autre sans aucune attente ;
- une voiture **déjà en vol** n'était comptée ni dans le plan d'un autre vol ni dans son
  atterrissage : deux voitures jetées en l'air presque en même temps pouvaient être envoyées au
  même endroit et s'y poser l'une dans l'autre (1,3 m de recouvrement dans le test).

### Les six contraintes, et où elles se contredisent

| Contrainte | Tenue ? |
|---|---|
| Durée de vol bornée | oui, sans condition : au plus la durée prévue + 3,5 s + 0,12 s de descente |
| Jamais posée dans une autre voiture | oui, sans condition |
| Pas de téléportation | oui **sauf dans le dernier recours** (voir plus bas) |
| Pas de déplacement artificiel des autres voitures | oui : rien n'agit sur elles |
| Règles de conduite au sol inchangées | oui : aucun contact au sol n'est modifié |
| Vols sans conflit inchangés | oui : tout se joue dans les derniers instants d'un vol dont le lieu d'atterrissage est pris |

Les trois premières ne peuvent pas tenir ensemble **dans tous les cas**. Une voiture en vol ne
peut se poser que sur une place libre ; les voitures au sol vont où leurs conducteurs les
mènent ; si l'on s'interdit de les déplacer et de déplacer la voiture en vol, alors des
voitures qui se relaient sous elle sans jamais laisser sa place libre la gardent en l'air
aussi longtemps qu'elles le veulent. Aucune règle ne peut l'empêcher sans toucher à l'une des
trois : c'est un problème de poursuite, pas un réglage. La correction consiste donc à
**rendre ce cas aussi difficile à produire que possible**, puis à dire ce qui se passe quand
il se produit quand même.

### La règle

Tant qu'une voiture est sous elle (ou là où elle se poserait), la voiture en vol ne se
contente plus d'attendre : **elle se dégage**. Sa vitesse le long de sa trajectoire est tenue
à au moins **8 m/s (29 km/h) de la vitesse de toute voiture qui est dessous**
(`flightYieldSpeed`).

- Livrée à elle-même, elle continue de perdre 50 km/h par seconde comme dans tout vol.
- Quand cela l'amènerait à moins de 29 km/h de la vitesse d'une voiture qui est dessous, elle
  prend **la vitesse permise la plus proche** : juste au-dessus (elle garde son élan et
  **passe** cette voiture ; au-dessus d'une voiture arrêtée elle continue de glisser à
  29 km/h) ou juste en dessous (elle **la laisse partir**).
- Elle ne va jamais plus vite qu'au début de l'attente (hormis cette glissade lente), et une
  fois qu'elle a laissé partir une voiture elle ne ré-accélère plus tant que quelque chose est
  dessous : une voiture ne peut pas lui faire faire des allers-retours.
- Elle garde pendant ce temps la hauteur qu'elle avait au début de l'attente, puis descend en
  0,12 s dès que la place est libre.

Rien n'est déplacé : la voiture en vol continue d'avancer **par sa propre vitesse** (vérifié à
chaque pas : déplacement = vitesse × pas, au micromètre), et les voitures de dessous ne sont
ni poussées ni ralenties. Ce qui change est la vitesse de la voiture en vol, pendant un
conflit seulement.

Conséquence : **quoi que fasse une voiture pour rester dessous, elle est dépassée ou distancée
en une seconde environ** — deux longueurs de voiture à 29 km/h d'écart, soit 1,2 s ; le double
si elle a d'abord été presque dépassée puis s'est mise à aller plus vite (la voiture en vol
change alors d'avis une fois, jamais deux).

Les autres voitures en vol comptent maintenant comme les autres : dans le plan d'un vol
(`placeOfFlight` prévoit où chacune sera, en l'air puis posée), dans l'atterrissage, et un
décollage dont la trajectoire croiserait une voiture déjà en vol est refusé (le contact reste
un tamponnage).

### Le dernier recours — une exception à arbitrer

Des voitures peuvent encore **se relayer** sous la voiture en vol. Un vol ne dure donc jamais
plus de **3,5 s au-delà de sa durée prévue** (`flightWaitMax`), tout compris : attente de la
voiture qui l'a fait décoller (0,5 s au plus), attente au-dessus d'une voiture, descentes
interrompues. Passé ce délai, si une voiture est toujours dessous, la voiture **est remise en
piste** sur la place libre la plus proche : sa ligne d'abord, puis le milieu de la route, puis
de chaque côté, en reculant de 1,5 m en 1,5 m. C'est le traitement de toute voiture sortie de
la route dans ce jeu : arrêtée, protégée 2,5 s, même signal sonore. Sa distance parcourue
recule avec elle.

**C'est une téléportation**, la seule, et elle est déclarée comme telle : la contrainte « pas
de téléportation » cède ici, parce que les deux autres possibilités étaient exclues par la
demande (rester en l'air sans limite ; se poser dans une voiture). Ce que cela pèse :

- **une voiture seule ne peut pas la déclencher** : 0,5 s + 2,5 s au pire en théorie ; 2,26 s
  mesurés sur 1 458 vols contre une voiture qui change de tactique au hasard, et 1,52 s sur
  225 vols contre un poursuivant méthodique ;
- dans **54 courses à 20 voitures** de l'ordinateur : **0 fois** sur 38 vols (attente la plus
  longue : 1,09 s) ;
- dans **1 000 pelotons construits pour cela** (5 à 12 voitures, un quart d'entre elles
  cherchant à rester sous la voiture en vol) : 3 fois sur 1 575 vols (9 fois sur 4 672 vols
  avec 3 000 pelotons).

Autres réponses possibles à ce cas, non retenues, avec leurs conséquences :

| Possibilité | Ce qu'elle respecte | Ce qu'elle coûte |
|---|---|---|
| **Remise en piste sur une place libre** (retenue) | durée bornée ; jamais dans une voiture ; autres voitures intactes | une téléportation, dans un cas qu'il faut plusieurs voitures pour produire |
| Atterrissage sur place, la voiture restant « fantôme » un instant | durée bornée ; pas de téléportation | la voiture est posée dans une autre : c'est le défaut que la demande interdit |
| Atterrissage sur place avec séparation par les règles de contact | durée bornée ; pas de téléportation | les deux voitures sont écartées d'un mètre en un pas et celle de dessous pénalisée : le défaut grave de la première relecture |
| Attendre sans limite | pas de téléportation ; jamais dans une voiture | un vol peut ne jamais finir |
| La voiture en vol devient un obstacle solide dès qu'elle attend (les voitures qui arrivent la heurtent comme une voiture au sol) | empêche le relais par des voitures qui arrivent ; pas de téléportation | des voitures sont tamponnées par une voiture en l'air ; nouveau type de contact à valider ; ne supprime pas le cas de trois voitures arrêtées en file |
| Ne décoller que si aucune voiture ne peut atteindre le lieu d'atterrissage, quoi qu'elle fasse | rien de tout cela n'arrive | presque plus de décollage dès qu'il y a du monde, et un seuil bien au-dessus de 58 km/h |

### Les scénarios demandés

`tests/gameplay/flight-wait.test.mjs` : de vraies voitures, conduites par leurs commandes
(accélérateur, frein, volant) par de petits scripts. Pour chaque vol : il **se termine** dans
la durée bornée ; la voiture **n'est posée dans aucune voiture** (recouvrement nul avec toute
voiture au sol au pas de l'atterrissage, et ensuite) ; elle reste **un vol** (déplacée par sa
seule vitesse, jamais plus rapide qu'au décollage, pas de saut de hauteur) ; elle finit par un
atterrissage et non par une remise en piste. **Chacun échoue sur `dc8b823`.**

| Scénario | Sur `dc8b823` | Maintenant |
|---|---|---|
| Une troisième voiture se place sous la voiture en vol et freine avec elle jusqu'à l'arrêt, puis reste là | 4,3 s en l'air (saut) ; 5,3 s puis posée 1,6 m dans l'autre (accident) | attente de 0,6 s ; posée sur une place libre |
| Une troisième voiture arrive par derrière pendant le vol et se cale dessous | 4,3 s en l'air | attente de 0,6 à 1,0 s |
| Un peloton roule avec la voiture, occupe la place prévue, celle d'avant et celle d'après, et ralentit avec elle (3 et 5 voitures) | 4,3 s en l'air | attente de 0,5 à 1,5 s ; posée derrière le peloton ou dans un intervalle |
| La voiture franchie accélère et se maintient dessous | 4,3 s (saut), 5,3 s (accident) | attente de 0,8 à 1,0 s ; **le saut retombe derrière elle**, l'accident devant |
| Contre une barrière (voiture en vol à 30 cm du rail), une voiture dessous | 4,3 s en l'air | attente de 0,9 s ; toujours à l'intérieur des barrières |
| Deux décollages presque simultanés vers le même endroit | les deux volent ; l'une est posée 1,3 m dans l'autre | une seule décolle (l'autre contact reste un tamponnage) ; avec la place pour deux, les deux volent et retombent à 5,9 m l'une de l'autre |
| Une voiture seule, 225 façons de rester dessous | 4,3 s en l'air | attente la plus longue : 1,52 s |
| Dernier recours : file de 25 voitures arrêtées, plus longue que ce que la voiture peut survoler | posée dans une voiture | remise en piste après 3,5 s, à côté de la file, dans aucune voiture |
| Voiture qui rampe à 18 km/h sous une voiture en vol très lente | — | la voiture en vol recule de dessus (8 km/h), se pose en roulant à peine, repart |

Le cas extrême est aussi au banc d'essai (`#lab=dessous`, touche `7`) et filmé :
`work/renders/collisions/HOLDx.mp4` (vue de derrière), `HOLD.mp4` (cockpit), `HOLDslowx.mp4`
(quatre fois plus lentement).

### Mesures

**Pelotons hostiles** (`node work/scripts/flight-wait-stress.mjs`,
`work/benchmarks/flight-wait-stress.json` et `-before.json`) : 1 000 pelotons de 5 à 12
voitures sur une ligne droite, conducteurs tirés au hasard (tenir sa vitesse, freiner à fond à
un instant quelconque, changer de file, ou chercher à rester sous la voiture en vol), une
voiture jetée en l'air par peloton.

| Sur 1 000 pelotons | `dc8b823` | Maintenant |
|---|---|---|
| Vols | 1 661 | 1 575 |
| **Voitures posées dans une autre** | **34** (jusqu'à 1,6 m de recouvrement) | **0** |
| Atterrissages qui ont attendu | 337 | 307 |
| Attente : médiane / 9 sur 10 en dessous de / la plus longue | 0,30 / 3,63 / 5,19 s | 0,32 / 1,38 / 3,62 s |
| Vol le plus long | 6,04 s | 4,35 s |
| Dernier recours (remise en piste) | — | 3 |
| Vols non terminés | 0 | 0 |
| Pas en l'air différent de vitesse × pas | 0 | 0 |
| Voiture plus rapide en l'air qu'au décollage ; valeur non finie | 0 ; 0 | 0 ; 0 |
| Deux voitures en vol qui se recouvrent en l'air (pelotons) | 42 | 6 |

(L'attente commence 0,12 s avant l'atterrissage prévu : 3,62 s d'attente, c'est 3,5 s au-delà
de la durée prévue. Avant comme après, trois voitures qui se touchent au même pas peuvent
rester quelques centimètres l'une dans l'autre pendant un pas, au sol, vol ou pas : 52 et 57
fois, 15 cm au plus ; ce n'est pas une voiture traversée et ce travail n'y touche pas.)

**Courses en peloton dense** (`node work/scripts/dense-pack-races.mjs`,
`work/benchmarks/dense-pack-races.json` et `-before.json`) : 54 courses de deux tours, départ
arrêté, 20 voitures conduites par l'ordinateur, sur les 18 circuits.

| Sur 54 courses | `dc8b823` | Maintenant |
|---|---|---|
| Courses terminées ; somme des temps des vainqueurs | 54 ; 7 426,04 s | 54 ; 7 426,04 s (identique) |
| Vols (sauts / accidents / panneaux) | 41 (7 / 29 / 5) | 38 (6 / 27 / 5) |
| Atterrissages qui ont attendu ; attente la plus longue | 18 ; 1,63 s | 14 ; 1,09 s |
| Vol le plus long | 2,28 s | 1,95 s |
| Voitures posées dans une autre ; dernier recours | 0 ; — | 0 ; 0 |
| Vols causés par une voiture : retombés devant elle / pas devant | 13 / 23 | 14 / 19 |

Dans les 21 courses à 16 voitures déjà suivies (`race-rules-comparison.mjs`) : somme des temps
des vainqueurs toujours identique à la PR #4 (4 268,55 s), 0 saut, 5 accidents dont 3 retombés
devant, aucune voiture posée dans une autre ; les seuls écarts avec `dc8b823` sont dans les deux
courses où un atterrissage attend (tamponnages 219 → 220, frottements 1 110 → 1 113, voitures à
l'arrivée 293 → 294). Coût de la simulation : 20 à 21 microsecondes par pas de 16 voitures,
comme avant.

### Retomber devant : l'exception, chiffrée

La règle générale (« tout décollage franchit la voiture et retombe devant elle ») **n'est pas
tenue dans tous les cas**, et cette correction ne la tient pas davantage : quand la voiture
heurtée accélère ou reste dessous, la voiture en vol la laisse partir et retombe derrière. Ce
n'est pas conforme à la règle : c'est une exception à arbitrer.

| Mesure | Vols causés par une voiture | Retombés devant elle | Pas devant |
|---|---|---|---|
| 21 courses à 16 voitures, 3 tours | 5 | 3 | **2** : la voiture heurtée accélérait (écart de 59 et 62 km/h) ; posées 9 et 11 m en retrait de son nez |
| 54 courses à 20 voitures, 2 tours | 33 | 14 | **19** : 7 sans attente, en courbe (la voiture vole tout droit, l'autre tourne : posée de 2,3 à 9,1 m sur le côté) ; 12 après une attente, la voiture heurtée accélérant ou restant dessous (posées de 2 à 30 m derrière) |
| Banc, cas 2 et 3 (voiture heurtée à vitesse constante, ligne droite) | 2 | 2 | 0 |
| Banc, cas 7 (une voiture reste dessous) | 1 | 0 | **1** : posée derrière la voiture qui s'est mise dessous, et 1,5 m en retrait de celle qu'elle a heurtée, à côté d'elle |
| Scénario « la voiture franchie accélère et se maintient dessous » | 6 | 3 (accident) | **3** (saut) |

Avec `dc8b823` c'était 13 sur 36 dans les mêmes 54 courses : la proportion n'est pas nouvelle.
La règle est tenue quand la voiture heurtée roule droit à vitesse constante ; elle ne l'est pas
dans plus de la moitié des cas en peloton.

Pistes, sans rien changer avant arbitrage : juger la faisabilité du vol avec l'accélération
de la voiture heurtée (moins de décollages, un seuil plus haut à la sortie des virages) ;
allonger encore le vol (au-delà de 1,1 s) ; accepter l'exception.

### Ce qui reste

- **Pendant l'attente, la voiture en vol est dessinée au-dessus d'une voiture**, à 20–60 cm du
  sol : les deux images se recouvrent, comme avant. Ce n'est plus que pour une seconde environ.
- Les changements de vitesse de la voiture en vol sont **instantanés** (jusqu'à 29 km/h d'un
  pas à l'autre quand elle laisse partir une voiture, davantage si deux voitures de vitesses
  très différentes sont dessous). Non lissé : le lissage affaiblirait la garantie.
- Au-dessus d'une voiture qui rampe, la voiture en vol peut **reculer** (au plus 29 km/h) ;
  elle se pose alors en roulant en arrière et repart. Jamais observé en course.
- **Deux voitures en vol peuvent encore se croiser en l'air** quand l'une des deux attend
  (6 pelotons hostiles sur 1 000 ; 42 avant) : le plan l'évite au décollage, pas ensuite.
- Une **épave** reste traversable par les autres voitures (inchangé, antérieur à ce travail).
- La mise en scène (assiette, vue) n'est pas réglée pour l'attente.

## 3. Mise en scène

Toutes les animations sont des fonctions de l'**horloge propre de la voiture** (`car.clock`,
avancée par la simulation) et des instants de ses derniers événements : même état, même image,
quelle que soit la cadence d'affichage ; une course en pause montre une image fixe.

| Élément | Règle |
|---|---|
| Piqué de la vue au contact | 6,5 % de la hauteur, atteint en 0,16 s, résorbé en 0,24 s |
| Piqué au freinage | jusqu'à 4,5 % de la hauteur à plein freinage (1,2 % auparavant) |
| Vol, vue cockpit | cabré tenu 47 % du vol (l'horizon passe sous le cockpit), puis bascule régulière jusqu'au piqué, atteint à l'atterrissage ; l'œil monte avec la voiture (1,3 m au sommet) |
| Vol, vues extérieures | la voiture monte au-dessus de la route ; son **ombre reste au sol**, plus petite et plus pâle avec la hauteur ; le dessin s'incline (le côté qui a touché se lève, jusqu'à 0,2 rad ; nez levé puis piqué quand on la voit de côté) et **s'écrase** un instant à l'impact (24 % après un vol sur une voiture, 12 % après un panneau, 0,16 s) |
| Saut récupérable | même scénario très réduit : cabré de 20 % de la hauteur, piqué de 13 % à l'atterrissage, vue stabilisée 0,35 s après. L'horizon ne quitte jamais l'image. Onomatopée « HOP ! » (du côté opposé à la voiture touchée, en haut de l'image, effacée quand les roues se posent), secousse plus faible, pas d'explosion, mains sur le volant ; vu de l'extérieur : voiture moins penchée, ombre au sol, léger écrasement (8 %) |
| Après un atterrissage violent | sol seul 0,48 s, rebond 0,16 s, second piqué complet (0,28 s + 0,6 s tenu), redressement 0,28 s |
| Après un atterrissage léger | sol seul 0,28 s, rebond 0,08 s, second piqué partiel (34 % de la hauteur), redressement 0,3 s |
| Glissade | tremblement vertical de ± 1,5 % à 12 Hz tant que la voiture glisse à plus de 5 m/s ; volant lâché |
| Étoile de contact | 0,16 s, au point de contact, attachée à la voiture. Le pilote concerné la voit **sur le dessin de son cockpit** : face extérieure de la roue avant touchée (contact latéral, contact qui fait décoller), pointe du nez (tamponnage), ou côté de l'impact pour un panneau heurté hors de sa vue (0,22 s) — le point réel est caché par le cockpit ou hors du champ |
| Panneau | étoile, éclats, poussière, onomatopée ; le panneau disparaît |
| Explosion | croissance 0,48 s, pleine taille 0,44 s (deux dessins alternés), assombrissement 0,2 s, fumée 0,12 s, deux panaches 0,6 s. Sur la roue avant touchée dans la vue cockpit, dans le monde pour les autres voitures. Désactivable (option « Explosions ») |

Écart assumé avec la référence : l'amplitude du basculement est réglée pour que l'horizon
sorte de **notre** image (+60 % / −50 % de la hauteur), dont le cadrage diffère ; la bascule
est donc plus rapide à l'écran (2,4 hauteurs par seconde contre 1,7).

## 4. Comparaison avec les mesures du rapport

Scénarios rejoués dans la simulation par `node work/scripts/collision-comparison.mjs`
(résultats bruts : `work/benchmarks/collision-comparison.json`) et vérifiés par les tests
`tests/gameplay/collisions.test.mjs` et `tests/gameplay/accidents.test.mjs`.

| Événement | Grandeur | Référence (vidéo) | Virage GP |
|---|---|---|---|
| **E1** freinage | décélération | ≈ 150 km/h/s | 103 km/h/s — **inchangé volontairement** |
| | piqué de la vue | 3,4 à 5 % | 4,5 % à plein freinage |
| **E2** roue contre roue | vitesse avant → après | 140–149 → 50–59 km/h | 145,4 → 49,4 km/h |
| | perte | ≈ 90 km/h | 96 km/h |
| | autre voiture | inchangée (hypothèse) | +0,3 km/h |
| | changement de cap | aucun | 0,1° |
| | étincelle | 0,16 s | 0,16 s |
| | piqué de la vue | 5,5 à 7 %, 0,44 s | 6,5 %, 0,40 s |
| **E3** décollage sur une voiture | vitesse au contact | 262 km/h | 264,7 km/h |
| | durée du vol | ≈ 0,85 s | 0,86 s |
| | perte en vol | 50 km/h/s | 49,6 km/h/s |
| | atterrissage | 228 → 35 km/h | 222,4 → 33,3 km/h |
| | arrêt après l'atterrissage | 0,84 s | 0,85 s |
| | immobilisation | 3,2 s | 3,2 s |
| | contact → redémarrage | 4,9 s | 4,92 s |
| | cabré tenu | 0,40 s | 0,40 s |
| | vue stabilisée après le contact | 2,64 s | 2,65 s |
| | explosion / panaches | 1,25 s / 0,6 s | 1,24 s / 0,6 s |
| | voiture heurtée | non affectée (hypothèse) | non affectée |
| | après le vol | les voitures heurtées sont juste devant, puis s'éloignent | **écart voulu depuis le lot 5** : la voiture accidentée retombe 5,2 m devant la voiture heurtée (de centre à centre) et 0,4 m à côté de sa trajectoire ; la voiture heurtée la longe et se trouve 117 m devant deux secondes plus tard (PR #4 : voiture heurtée 4,2 m devant à l'atterrissage, 126 m deux secondes plus tard) |
| | redémarrage | 0 → 100 km/h en 1,0 s | 54,6 km/h après 1 s, 106,5 après 2 s — **accélération normale, inchangée** |
| **E4** tamponnages | en suivant de près | 115 → 67 et 104 → 56 km/h | 116,8 → 65,8 et 107,5 → 56,9 km/h |
| | en arrivant vite | 145 → 60 et 146 → 52 km/h | 147,0 → 59,7 km/h (voiture de devant à 107,5) |
| | voiture de devant | ne bouge pas (hypothèse) | +0,2 km/h |
| | fréquence en restant derrière | 6 en 12 s, espacés de 1,4 à 4,6 s | 5 en 12 s à pleine charge, espacés de 1,9 à 3,0 s |
| | perte à pleine charge | — | 92 à 106 km/h : la voiture revient aussi vite qu'elle est repartie |
| | perte de vitesse sans tamponnage signalé | aucune relevée | aucune |
| | piqué de la vue | 5 à 8 % | 6,5 % |
| | décollage | non | non |
| **E5** panneau | vitesse au choc | 240 km/h | 226 km/h dans le scénario de test (la voiture ralentit dans l'herbe avant) ; 242 km/h dans la séquence filmée |
| | durée du vol | ≈ 0,6 s (par analogie) | 0,60 s |
| | atterrissage | 227 → 224 km/h | 196,5 → 196,1 km/h |
| | explosion | non | non |
| | début de glissade | ≈ 30 km/h/s | 29,9 km/h/s |
| | fin de glissade | ≈ 180 km/h/s | 180 km/h/s |
| | arrêt après l'atterrissage | ≈ 2,1 s | 1,88 s |
| | rotation | ≈ 75° en 0,84 s | 72,3° |
| | second piqué | 34 % | 34 % |
| | vue stabilisée après le contact | 1,7 s | 1,70 s |
| | tremblement | 12,5 Hz | 12 Hz |
| | après l'arrêt | inconnu (la vidéo se termine en fondu) | la voiture repart de là où elle est, sans être replacée |

## 5. Écarts non résolus

- **Freinage et accélération** restent ceux de Virage GP (C9 non autorisée) : le freinage
  avant un choc est plus doux que dans la vidéo, le redémarrage après un accident presque deux
  fois plus lent (0 → 100 km/h en 1,9 s contre 1,0 s), la ré-accélération après un tamponnage
  environ deux fois plus vive (56 à 63 km/h/s contre 25 à 35 à ces vitesses).
- **Tamponnage à pleine charge** : parce que la voiture ré-accélère plus fort que dans la
  vidéo, elle revient sur la voiture de devant aussi vite qu'elle en est repartie et perd alors
  environ 96 km/h par choc, là où un pilote qui lève le pied n'en perd que 48 à 55.
- **Règle du tamponnage** : « 48 km/h de moins que la voiture touchée » reproduit les quatre
  relevés de la vidéo, mais ce n'est qu'une lecture possible de ces relevés (l'autre : 48 km/h
  retirés à chaque image de jeu tant que la voiture est la plus rapide). Choix de conception.
- **Circuits fermés par des barrières** (C10 non autorisée, et C6 limitée aux panneaux) : la
  glissade d'E5 se fait le long d'un rail au lieu d'un désert ouvert. En vol, une voiture
  qui atteint la barrière est retenue sans effet visible (elle y perd quelques km/h).
- **Seuils de décollage** : choix de conception. Un seul exemple de chaque cas dans la vidéo.
- **Saut récupérable** : *(état de la PR #4 ; depuis le lot 5 le saut vient d'un contact de
  roues et il n'y en a plus dans les courses de l'ordinateur, voir § 2 ter)* choix de gameplay
  original, sans référence. Ses seuils et son dosage
  (hauteur, vitesse perdue, perturbation de la direction) n'ont été essayés par personne. Le
  bas de la bande est proche du contact E2 de référence (36 km/h d'écart contre 25 environ) :
  si des contacts ordinaires déclenchent trop souvent un saut, c'est `hopClosingSpeed` qu'il
  faut relever ; `hopOverlapMin` à 0,2 retire les sauts pneu contre pneu au bord des voitures
  (ils redeviennent des tamponnages). Les voitures de l'ordinateur sautent aussi : 1 à 5 fois
  par course sur les six courses ci-dessous.
  Qui rattrape de nouveau la voiture qu'il vient d'escalader, sans déboîter ni lever le pied,
  la heurte une seconde fois : passé le délai de 1,5 s, ce second contact peut être un saut ou,
  si l'écart de vitesse a eu le temps de dépasser 54 km/h à plus de 180 km/h, l'accident
  violent. C'est arrivé au pilote du banc d'essai pendant sa mise au point, en restant une
  seconde à pleine charge derrière l'autre voiture.
- **Voitures de l'ordinateur** : pénalité réduite à 30 %. Effet sur trois courses de 3 tours
  à 16 voitures, toutes conduites par l'ordinateur (`work/scripts/race-contact-stats.mjs`,
  options `--legacy` pour l'ancien modèle et `--racing` pour les règles de compétition ;
  résultats : `work/benchmarks/race-contact-stats.json`), règles arcade :

  | Circuit | Modèle | Vainqueur | Meilleur tour | Clôture de la course | Contacts simples / tamponnages / roues | Barrières | Têtes-à-queue |
  |---|---|---|---|---|---|---|---|
  | hazelbrook | ancien | 155,27 s | 50,58 s | 162,78 s | 63 / – / – | 0 | 0 |
  | | nouveau | 155,27 s | 50,58 s | 168,02 s | 27 / 7 / 26 | 7 | 0 |
  | porto-sereno | ancien | 175,12 s | 57,17 s | 183,16 s | 108 / – / – | 0 | 0 |
  | | nouveau | 175,12 s | 57,17 s | 186,37 s | 62 / 14 / 62 | 14 | 0 |
  | meridian-docks | ancien | 221,93 s | 72,75 s | 229,90 s | 133 / – / – | 0 | 0 |
  | | nouveau | 221,93 s | 72,75 s | 234,17 s | 88 / 24 / 80 | 15 | 2 |

  Le vainqueur n'est pas touché ; le peloton perd 2 à 3 % (jusqu'à 4 % en règles de
  compétition) ; des **frôlements de barrière apparaissent** (7 à 15 par course, aucun
  auparavant) parce que deux voitures côte à côte ne se repoussent plus par impulsion ; deux
  têtes-à-queue avec remise en piste sur une des trois courses ; un décollage entre voitures de
  l'ordinateur sur les six courses. En règles de compétition le total des dégâts du peloton
  passe de 1,12 / 0,88 / 1,11 à 1,27 / 1,89 / 2,25 (les barrières abîment), sans abandon.
  Trois courses ne font pas une statistique : c'est un contrôle de non-perturbation, pas une
  mesure d'équilibrage.

  Les mêmes six courses avec le saut récupérable (lot suivant ; « avant » = le tableau
  ci-dessus et son équivalent en règles de compétition, `node work/scripts/race-contact-table.mjs`) :

  | Course | Vainqueur | Meilleur tour | Clôture de la course | Contacts simples / tamponnages / roues | Sauts | Accidents violents | Barrières | Têtes-à-queue |
  |---|---|---|---|---|---|---|---|---|
  | hazelbrook (arcade) | 155,27 s | 50,58 s | 168,02 → 166,41 s | 27 / 7 / 26 → 32 / 5 / 29 | 5 | 0 → 0 | 7 → 7 | 0 → 0 |
  | porto-sereno (arcade) | 175,12 s | 57,17 s | 186,37 → 185,88 s | 62 / 14 / 62 → 61 / 12 / 61 | 2 | 0 → 0 | 14 → 14 | 0 → 0 |
  | meridian-docks (arcade) | 221,93 s | 72,75 s | 234,17 → 234,02 s | 88 / 24 / 80 → 86 / 19 / 84 | 3 | 2 → 0 | 15 → 8 | 2 → 0 |
  | hazelbrook (compétition) | 161,77 s | 52,69 s | 177,13 → 177,03 s | 38 / 6 / 36 → 38 / 6 / 38 | 1 | 2 → 1 | 7 → 5 | 1 → 0 |
  | porto-sereno (compétition) | 182,05 s | 59,46 s | 196,17 → 194,84 s | 46 / 7 / 57 → 42 / 6 / 41 | 4 | 0 → 2 | 17 → 8 | 0 → 0 |
  | meridian-docks (compétition) | 230,27 s | 75,46 s | 252,55 → 245,32 s | 56 / 14 / 60 → 73 / 14 / 70 | 1 | 0 → 0 | 16 → 8 | 0 → 0 |

  Temps du vainqueur et meilleur tour : identiques dans les six courses. Le reste diverge dès
  le premier contact qui change de nature (une course est un système chaotique : un saut à la
  place d'un tamponnage déplace toutes les rencontres suivantes), sans tendance nette : le
  peloton ne finit pas plus tard. 16 sauts en six courses de 16 voitures. Même réserve : ce
  n'est pas une mesure d'équilibrage.
- **Épave** : elle reste traversable par un autre joueur (elle ne peut pas être heurtée) ;
  elle est dessinée plus pâle une fois arrêtée. Depuis le lot 5 elle retombe à côté de la
  trajectoire de la voiture qu'elle a survolée, qui ne la traverse donc pas (§ 2 ter).
- **Vues extérieures pendant un vol** : vue de dos ou de face, le tangage ne peut pas être
  dessiné (une seule élévation de dessin par voiture) : la voiture paraît seulement plus haute
  et penchée. L'ombre portée du dessin lui-même monte toujours avec la voiture, en plus de
  l'ombre laissée au sol.
- **Vue du cockpit pendant le piqué** : une voiture proche apparaît en haut de l'image,
  dessinée de dos et non de dessus (`E3.mp4`, vers 2,7 s).
- **Panneau heurté** : il disparaît, sans dessin de panneau couché ni débris durables.
- **Rapport affiché** : pendant la glissade l'indicateur garde le rapport engagé ; il passe en
  première à l'arrêt.
- **Son** : les nouveaux événements réutilisent les sons d'impact et d'accident existants ;
  aucun son propre au décollage ; rien n'a été écouté.
- **Sensations** : rien de tout cela n'a été essayé au volant par une personne.

## 6. Perte de roue — demandée, non implémentée dans ce lot

La vidéo analysée ne montre **aucun détachement de roue** : après l'explosion d'E3 les deux
roues avant sont toujours dessinées. Rien ne permet donc d'affirmer que ce comportement
existait, ni comment. Pour le définir sans inventer, il manque :

1. **Une source** : une séquence où l'on voit une roue se détacher (ou une documentation du
   jeu qui la décrit), avec l'édition et le mode de jeu identifiés.
2. **Le déclencheur** : quel choc (vitesse, angle, objet heurté, cumul de dégâts) ?
3. **Le sort de la roue** : trajectoire, rebonds, durée de vie, peut-elle être heurtée ?
4. **Les conséquences sur la voiture** : peut-on continuer ? Avec quelle tenue de route,
   quelle vitesse maximale ? Abandon, retour aux stands, réparation automatique ?
5. **La représentation** : cockpit (roue absente, moyeu visible ?), vues extérieures, voitures
   adverses.
6. **Les règles** : dans quels modes de jeu, avec quelle option ?

En l'absence de ces éléments, toute implémentation serait une interprétation, pas une
caractéristique vérifiée. Points d'ancrage déjà en place pour la suite : l'état `WRECKED`, le
côté du choc (`car.launchSide`), les dessins de roue séparés du reste du cockpit.

## 7. Non-régression de la conduite

`node work/scripts/driving-report.mjs`, comparé à l'état précédant ce travail
(`work/benchmarks/driving-report-before.json`) : **toutes les valeurs sont identiques** —
accélérations, vitesses maximales, distances de freinage, adhérence latérale pour les trois
profils, effet des ailerons, et le meilleur tour d'un pilote ordinateur seul sur chacun des 18
circuits (165 valeurs). Les profils de conduite (`car-spec.js`) n'ont pas été touchés.

Refait après l'ajout du saut récupérable, des roues à très haute vitesse et du déplacement
des rétroviseurs : les 165 valeurs sont de nouveau identiques (seule la date du fichier
change), et `car-spec.js` n'a pas été modifié.

Ce que cela ne dit pas : si les sensations au volant sont restées satisfaisantes. Trois
changements se voient en conduisant sans rien heurter — le piqué de la vue au freinage, plus
marqué ; les rétroviseurs, déplacés ; l'animation des roues avant (ces deux derniers :
`wheels-and-mirrors.md`). C'est au joueur d'en juger.

## 8. Séquences et captures

| Fichier | Contenu |
|---|---|
| `work/renders/collisions/E2.mp4`, `E3.mp4`, `E3x.mp4`, `E4.mp4`, `E5.mp4` | Les scénarios rejoués dans le vrai jeu, 60 images par seconde (deux pas de simulation par image), 960×540. `E3x` : le décollage vu de derrière (8 s : jusqu'au redémarrage) |
| `work/renders/collisions/HOP.mp4`, `HOPx.mp4` | Le saut récupérable, vue cockpit et vue arrière (8 s chacune) : même mise en place que E3 (même circuit, même voiture devant, même décalage, contact au même instant), avec moins de vitesse. Après l'atterrissage le pilote du banc garde sa ligne 0,8 s (ce que fait alors la direction est la perturbation du jeu), puis déboîte en 1,2 s et dépasse |
| `work/renders/collisions/hop-vs-accident.mp4` | Les deux décollages côte à côte, synchronisés, 8 s : saut récupérable à gauche, accident violent à droite ; vue cockpit en haut, vue arrière en bas |
| `work/renders/collisions/*-sheet.jpg` | Planches des étapes du mouvement (une image toutes les 0,07 à 0,1 s) |
| `work/renders/collisions/*.json` | Télémétrie de chaque image : vitesse, état, position latérale, hauteur, tangage de la vue, événements, vitesse de l'autre voiture et distance qui en sépare ; direction : commande du pilote (`steerAsked`), perturbation ajoutée par le jeu après un saut (`steerDisturbance`), position des roues (`steer`), cap par rapport à la route (`headingToRoad`, degrés) |
| `work/renders/collisions/stills/` | Images extraites des vidéos aux moments clés (avant le contact, étoile, cabré, piqué, explosion, panaches, arrêt, redémarrage, panneau, vol, glissade, retour vers la piste), 960×540. Celles du saut (`HOP-1` à `HOP-8`, `HOPx-1` à `HOPx-6`) sont choisies d'après la télémétrie par `node work/scripts/hop-stills.mjs` |

Reproduire : `node work/scripts/collision-sequences.mjs all --width 960 --height 540`. Les
situations sont mises en place par le banc d'essai du jeu (`collision-test-bench.md`), le même
que celui qu'un joueur ouvre avec `index.html#lab=…`.

Ce que montrent les séquences du jeu (journal de l'enregistrement) :

| Séquence | Événements relevés |
|---|---|
| E2 | 1,03 s : contact de roues, 148 → 53 km/h, étoile sur la roue avant droite, « TCHAK ! » |
| HOP | 1,63 s : choc à 202 km/h sur une voiture à 151, étoile sur la roue avant droite, « HOP ! » ; le compteur tombe à 126 km/h **à cette image** ; vol de 0,45 s, 126 → 104 km/h, la voiture de devant s'éloigne de 4,2 à 8,8 m ; 2,08 s : atterrissage sur les roues à 103 km/h (0,8 km/h de moins qu'à l'image précédente) ; direction perturbée 0,68 s (jusqu'à 23 % de la course ; le pilote corrige jusqu'à 16 %), la voiture reste à 0,17 m de sa ligne ; puis elle déboîte de 2 m sans louvoyer (cap à 2° de la route au plus), retrouve ses 202 km/h 2,05 s après l'atterrissage, est à hauteur de l'autre voiture à 4,62 s, et tient une ligne stable de 5,23 s à la fin (286 km/h, 100 m devant). Aucun autre contact |
| E3 | 1,67 s : décollage à 262 km/h, étoile sur la roue qui monte ; 2,53 s : atterrissage violent derrière la voiture heurtée, 32 km/h, explosion ; 6,58 s : redémarrage |
| E3x | le même accident en vue arrière : la voiture monte sur l'autre en se penchant, son ombre reste au sol, elle retombe derrière, explose |
| E4 | 1,03 s : premier tamponnage, 146 → 59 km/h (voiture de devant à 107) ; puis le pilote revient doucement (5 km/h de plus que la voiture de devant) : 5,37 s et 9,32 s, 116 → 59 km/h |
| E5 | 1,00 s : panneau « 300 » à 242 km/h, décollage ; 1,60 s : atterrissage à 207 km/h, glissade volant lâché ; 3,53 s : arrêt en travers dans l'herbe ; la voiture repart de là vers la piste |

Dans E5 les autres panneaux du circuit ont été retirés du scénario pour isoler le cas de la
vidéo (un seul obstacle). En jeu, une voiture qui glisse peut en renverser un second.

## 9. Revue indépendante et suites

Un critique qui n'a vu que les séquences enregistrées et le rapport d'analyse (ni ces
spécifications, ni les tests, ni le code) a rendu `work/reviews/collision-review.md` :
**0 défaut grave, 7 moyens, 13 mineurs**. Il juge les chiffres conformes à la référence et
situe les défauts dans la mise en scène. Ce qui en a été fait :

| N° | Défaut relevé | Suite |
|---|---|---|
| E3x-1 (moyen) | La voiture heurtée traverse l'épave ; le joueur atterrit devant elle | **Corrigé** : la voiture en vol retombe derrière celle qui l'a lancée ; les pilotes de l'ordinateur contournent une épave. Un autre joueur peut encore la traverser |
| E3x-2 (moyen) | Vue arrière : voiture à plat pendant tout le vol | **Traité en partie** : inclinaison, étirement, écrasement à l'impact ; le tangage vu de dos reste impossible à dessiner |
| E3x-3 (moyen) | Pas d'ombre lisible sous la voiture en vol | **Corrigé** : ombre laissée au sol |
| E4-1 (moyen) | Contact collant d'une seconde, puis pénalité sans nouveau contact | **Corrigé** : séparation franche après chaque tamponnage, plus aucune perte de vitesse non signalée (test) |
| E5-1 (moyen) | Second choc invisible pendant la glissade | **Corrigé** : un panneau heurté hors de la vue donne une étoile du côté de l'impact ; scénario isolé à un seul panneau |
| E5-2 (moyen) | Remise en piste par coupe franche | **Corrigé** pour ce cas : la voiture repart de là où elle s'est arrêtée. La remise en piste après un tête-à-queue ordinaire est inchangée |
| R-1 (moyen) | Rupture de l'animation des roues vers 17–20 km/h | **Corrigé** : voir `wheels-and-mirrors.md` |
| E3-2 | Rapport « 6 » affiché à l'arrêt après l'accident | Corrigé (première dès l'arrêt) |
| E3-3 | Pas d'éclat au contact qui fait décoller | Corrigé |
| E4-2 | Voiture de devant poussée à chaque contact | Corrigé (elle n'est plus touchée) |
| E4-4 | Séquence E4 non représentative (premier contact à 183 km/h) | Corrigé (146 km/h, puis approches lentes) |
| R-2 | Sens de rotation illisible au-dessus de 20 km/h | Traité : voir `wheels-and-mirrors.md` |
| E3-4, E4-3 | Redémarrage lent, ré-accélération vive | Non traité : accélération normale de la voiture (C9 non autorisée) |
| E2-1, M-1 | L'étoile et le rétroviseur masquent une partie de la roue | Non traité |
| E5-3 | En vol, la voiture bute sur la limite latérale sans signal | Non traité |
| E5-4 | Le panneau disparaît sans débris | Non traité (l'étoile est maintenant visible dès le choc) |
| E5-5 | Dos de panneau en aplat gris | Non traité |
| R-3 | Jante immobile à 8 km/h | Non traité |

Ces corrections **n'ont pas été revues** par un second critique : les séquences ont été
réenregistrées et contrôlées par leur auteur seulement.

## 10. Second critique indépendant (saut récupérable, roues, rétroviseurs) et suites

Après l'ajout du saut récupérable, du dessin des roues à très haute vitesse et du déplacement
des rétroviseurs, un second critique — qui n'a vu que le matériel enregistré (séquences,
télémétrie, vidéo comparative des roues, planche des rétroviseurs), ni les spécifications, ni
les tests, ni le code — a rendu `work/reviews/second-test-review.md` : **aucun défaut grave,
3 moyens, 13 mineurs**. Il confirme que le saut se distingue nettement de l'accident, qu'E3
est inchangé, que le dessin des roues à haute vitesse est réellement nouveau et progressif
sans rien changer aux vitesses basses et moyennes, et que la variante B des rétroviseurs est la
correction discrète. Ce qui a été fait de ses réserves :

| N° | Défaut relevé | Suite |
|---|---|---|
| A-1 (moyen) | À l'atterrissage du saut la vitesse tombe de 180 à 103 km/h en une image, sans cause visible | **Corrigé** : la vitesse est perdue au choc (étoile, secousse, « HOP ! ») puis régulièrement pendant le vol ; plus rien à l'atterrissage (0,8 km/h entre les deux images, la décélération du vol). Test ajouté |
| A-2 (moyen) | Embardée de 3,7 m après l'atterrissage ; la trajectoire louvoie encore à la fin ; la télémétrie ne sépare pas le jeu du pilote | **Corrigé** : c'était le pilote du banc (il visait aussitôt une ligne 2,5 m plus à gauche, avec une loi de commande mal amortie). Il garde maintenant sa ligne 0,8 s, puis déboîte de 2 m en 1,2 s sans louvoyer ; séquence portée à 8 s, dont 2,8 s sur une ligne stable ; commande du pilote, perturbation du jeu, position des roues et cap ajoutés à la télémétrie. La perturbation imposée par le jeu, elle, n'a pas changé : 0,7 s, 30 % de la course au plus, environ 0,2 m d'écart quand le pilote corrige, 0,5 m s'il ne fait rien |
| A-3 | Pendant le vol, la vitesse affichée (201 → 180 km/h) ne correspond pas à l'image (distance constante à la voiture de devant) | **Corrigé** par la même modification : la voiture est plus lente que l'autre dès le choc et s'en éloigne (4,2 → 8,8 m), ce que montre le compteur |
| A-4 | Le dessin de la voiture de devant saute d'une vue à l'autre au décollage et à l'atterrissage | **Réduit, non supprimé** : le saut à l'atterrissage a disparu (la voiture est alors à 9 m) ; il reste une image de trois quarts à l'instant du choc, là où les deux voitures sont au plus près. Le choix de la vue selon l'angle n'a pas été retouché (il sert à toutes les voitures) |
| A-5 | « HOP ! » recouvre la voiture de devant au moment de l'atterrissage | **Corrigé** : le mot est placé du côté opposé à cette voiture, plus haut, et s'efface en 0,5 s |
| A-6 | La vue extérieure penche la voiture, la vue cockpit ne roule pas | Non traité : la projection de la vue cockpit ne sait pas incliner l'horizon |
| A-7 | La scène n'est pas un alignement roue contre roue strict (voitures décalées d'une demi-largeur) | **Traité** : le tableau du § 2 bis montre ce qui déclenche quoi selon le décalage ; il a révélé qu'un contact pneu contre pneu au bord des voitures (moins de 20 % de recouvrement) donnait un tamponnage : il donne maintenant un saut (`hopOverlapMin`), test ajouté. La scène enregistrée garde le décalage d'E3, pour que les deux vidéos ne diffèrent que par l'énergie |
| A-8 | E3 : l'étoile de l'explosion n'est pas placée comme sur l'image de référence | Expliqué, rien à corriger : sa position vient du générateur pseudo-aléatoire **des effets visuels** (fumées, éclats), qui a une graine fixe mais avance à chaque effet dessiné ; la mise en place par le banc d'essai n'en consomme pas autant que l'ancien script. La simulation ne l'utilise pas : la télémétrie d'E3 est identique image par image |
| B-1 à B-4 | Roues à haute vitesse | Voir `wheels-and-mirrors.md` § 1 bis (B-1 corrigé ; B-2, B-3, B-4 non traités) |
| C-1 (moyen, variante C) | La variante C crée des recouvrements | C n'est pas retenue (elle n'est montrée que pour comparaison) |
| C-2 à C-4 | Rétroviseurs, variante B | Voir `wheels-and-mirrors.md` § 2 bis (C-3 corrigé ; C-2, C-4 signalés au joueur) |

## 11. Contre-vérification indépendante des corrections du saut et de la planche

Les corrections A-1 à A-5 et C-3 ont été soumises à un critique indépendant, de nouveau sur
le seul matériel réenregistré (`work/reviews/second-test-recheck.md`). Son verdict : **quatre
corrections réelles (A-1 dans les termes annoncés, A-2, A-3, A-5), deux partielles (A-4,
C-3), aucun défaut grave ni moyen**. Ce qu'il en reste :

| N° | Remarque | Suite |
|---|---|---|
| R-1 | **La marche de vitesse n'a pas disparu, elle a changé d'instant** : 201 → 125 km/h en une image, maintenant à l'image du choc, où l'étoile et la voiture de devant qui s'éloigne racontent la même chose que le compteur. Deux incohérences demeurent : le joueur sort du choc 25 km/h plus lent que la voiture heurtée, qui ne varie pas ; et l'accident « violent » E3 garde toute sa vitesse à son propre choc alors que le saut « léger » y perd 38 % | **Non traité, à trancher par le joueur.** C'est la règle validée du tamponnage (la voiture de derrière est ralentie d'un coup, celle de devant n'est pas dérangée) appliquée au saut. E3 perd sa vitesse à l'atterrissage, comme sur la vidéo de référence, et ne devait pas être modifié. Étaler la perte du saut (moins au choc, davantage en vol) est possible avec `hopSeparation` et la décélération du vol |
| R-2 (A-4) | Il reste une image où la voiture de devant est dessinée de trois quarts, à l'instant du choc ; le même changement de vue par paliers se voit pendant le dépassement | Non traité (choix de la vue selon l'angle, commun à toutes les voitures) |
| R-3 (C-3) | La vue de trois quarts ne montre qu'un rétroviseur, déplacé de quelques pixels, sans repère | **Traité** : ligne agrandie deux fois sur le cockpit, avec un repère en pointillé au bord du rétroviseur de la variante A. La symétrie se vérifie sur les vues cockpit et de face |
| R-4 | Dans `hop-vs-accident.mp4` les vues arrière se figeaient avant la fin | **Corrigé** : `HOPx` et `E3x` sont enregistrées sur 8 s comme les vues cockpit (les 252 premières images d'`E3x` restent identiques à la PR précédente) |
| R-5 | Le classement reste « 4/4 » trois secondes après le dépassement | Artefact du banc d'essai, pas du jeu : le classement suit la distance cumulée depuis le départ, et le banc pose les voitures à la main sans la recaler. Signalé dans `collision-test-bench.md` |
| R-6 | Vue arrière : des nuages de poussière de l'atterrissage sont dessinés par-dessus la voiture | Non traité (les mêmes nuages que pour les autres atterrissages, placés autour de la voiture) |
| R-7 | Le contre-braquage du pilote du banc arrive en retard et s'ajoute à la seconde moitié de la perturbation (volant à 32 % pour une perturbation de 23 %) | Non traité : c'est le pilote de démonstration. **Aucun enregistrement ne montre le cas mains lâchées** ; il est mesuré dans la simulation seulement (§ 2 bis : 0,45 m d'écart, cap retrouvé à 0,2° près) et vérifié par un test. Au banc, c'est le joueur qui tient le volant |
| — | Libellés sans accents sur les planches et la vidéo comparative | Corrigé |

Le critique rappelle aussi qu'E3 garde le défaut A-3 (voiture retenue derrière l'autre pendant
son vol alors que son compteur indique davantage) : E3 est validé et n'a pas été touché.

Les corrections R-3 et R-4 et la retouche des roues (B-1) n'ont pas été revues à leur tour.
