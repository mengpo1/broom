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
| `src/physics/collisions.js` | Contacts entre voitures : classification et conséquences |
| `src/physics/obstacles.js` | Panneaux de bord de piste solides |
| `src/physics/car-physics.js` | États `AIRBORNE` et `WRECKED`, glissade après un atterrissage léger |
| `src/tracks/scenery-layout.js` | Liste logique des obstacles de chaque circuit (les panneaux de freinage) |
| `src/rendering/compositing/crash-camera.js` | Mouvements de la vue : fonctions pures de l'état simulé de la voiture |
| `src/rendering/effects/effects-layer.js` | Étincelle au point de contact, éclats de panneau, explosion en quatre temps |
| `src/rendering/compositing/cockpit-layer.js` | Volant lâché pendant une perte de contrôle |

`car-spec.js` (profils de conduite) n'est pas modifié.

## 2. Les sept situations

| Situation | Condition (testable) | Conséquence |
|---|---|---|
| **Collision simple** | Contact entre deux voitures qui ne roulent pas dans le même sens (plus de 37° d'écart), ou dont l'une n'est pas en course | Réponse par impulsion, inchangée ; tête-à-queue si le choc est très violent |
| **Tamponnage arrière** | Même sens, voitures séparées dans l'axe (nez contre arrière), celle de derrière plus rapide | Celle de derrière perd **48 km/h** et ne reste jamais plus rapide que celle qu'elle a touchée ; celle de devant reçoit une petite poussée (0,8 m/s). Aucun changement de cap |
| **Contact latéral roue contre roue** | Même sens, voitures séparées en travers (côte à côte) | La plus rapide perd **≈ 96 km/h** ; les deux sont écartées une fois (1,2 m/s) ; aucune n'est tournée. L'autre voiture ne paie pas à son tour tant qu'elles restent côte à côte |
| **Contact provoquant un décollage** | Tamponnage avec recouvrement latéral **partiel** (20 à 80 % de la largeur : roue sur roue), vitesse relative ≥ 15 m/s, vitesse de la voiture de derrière ≥ 50 m/s (180 km/h) | La voiture de derrière passe à l'état `AIRBORNE` (0,85 s) ; celle de devant n'est pas perturbée |
| **Obstacle ponctuel** | Voiture hors de l'asphalte dont la boîte recouvre un panneau | Le panneau est couché pour le reste de la course. Sous 40 m/s : la voiture garde 60 % de sa vitesse. Au-dessus : `AIRBORNE` (0,6 s) |
| **Atterrissage léger** | Fin d'un vol déclenché par un obstacle | Vitesse conservée ; glissade hors de contrôle (rotation lente vers la piste, décélération faible puis forte) ; retour en piste habituel à l'arrêt |
| **Atterrissage violent** | Fin d'un vol déclenché par une voiture | Vitesse ×0,15 ; arrêt en 0,85 s ; `WRECKED` : 3,2 s à l'arrêt ; redémarrage sur place en première, protégé 2 s ; explosion |

Règles communes :

- une pénalité de vitesse au plus par seconde et par voiture (pendant ce délai, la voiture qui
  pousse est seulement maintenue derrière l'autre) ; jamais en dessous de 5 m/s ;
- une voiture en vol ou accidentée **ne peut pas être heurtée** (pas de carambolage en chaîne) ;
- les voitures conduites par l'ordinateur suivent les mêmes règles, avec **30 %** de la perte
  fixe (`computerPenaltyScale`), pour que le peloton reste fluide. C'est un choix de
  conception ; la vidéo ne montre que le joueur être pénalisé. À 1, tout le monde est traité
  de la même façon ;
- en vol : la voiture suit sa vitesse, perd 50 km/h par seconde, ne se dirige plus ; elle reste
  entre les barrières ;
- règle des dégâts (mode compétition) : un tamponnage, un contact de roues ou un contact qui
  fait décoller abîment les deux voitures selon la vitesse à laquelle elles se sont
  rencontrées, à la même échelle que les contacts simples (`(vitesse − 3 m/s) × 0,008`).
  L'atterrissage, l'explosion et les panneaux n'ajoutent rien : c'est un choix de conception
  (la voiture repart intacte, comme dans la référence).

## 3. Mise en scène

Toutes les animations sont des fonctions de l'**horloge propre de la voiture** (`car.clock`,
avancée par la simulation) et des instants de ses derniers événements : même état, même image,
quelle que soit la cadence d'affichage ; une course en pause montre une image fixe.

| Élément | Règle |
|---|---|
| Piqué de la vue au contact | 6,5 % de la hauteur, atteint en 0,16 s, résorbé en 0,24 s |
| Piqué au freinage | jusqu'à 4,5 % de la hauteur à plein freinage (1,2 % auparavant) |
| Vol | cabré tenu 47 % du vol (l'horizon passe sous le cockpit), puis bascule régulière jusqu'au piqué, atteint à l'atterrissage ; l'œil monte avec la voiture (1,3 m au sommet) |
| Après un atterrissage violent | sol seul 0,48 s, rebond 0,16 s, second piqué complet (0,28 s + 0,6 s tenu), redressement 0,28 s |
| Après un atterrissage léger | sol seul 0,28 s, rebond 0,08 s, second piqué partiel (34 % de la hauteur), redressement 0,3 s |
| Glissade | tremblement vertical de ± 1,5 % à 12 Hz tant que la voiture glisse à plus de 5 m/s ; volant lâché |
| Étincelle | étoile de 0,16 s au point de contact, attachée à la voiture. Pour les deux pilotes concernés en vue cockpit, elle est posée sur le dessin du cockpit — face extérieure de la roue avant touchée (contact latéral) ou pointe du nez (tamponnage) — car le point réel est caché par le cockpit ou hors du champ |
| Panneau | étoile sur place, éclats, poussière, onomatopée |
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
| | voiture de devant | non affectée (hypothèse) | non affectée |
| | redémarrage | 0 → 100 km/h en 1,0 s | 54,6 km/h après 1 s, 106,5 après 2 s — **accélération normale, inchangée** |
| **E4** tamponnages | perte unitaire | 48 km/h (115 → 67, 104 → 56) | 48 km/h (117,7 → 69,9 ; 107,9 → 60,0) |
| | à forte vitesse relative | 145 → 60, 146 → 52 | 145,3 → 58,2 |
| | fréquence en restant derrière | 6 en 12 s | 8 en 12 s à pleine charge |
| | piqué de la vue | 5 à 8 % | 6,5 % |
| | décollage | non | non |
| **E5** panneau | vitesse au choc | 240 km/h | 226 km/h dans le scénario de test (la voiture ralentit dans l'herbe avant) ; 242 km/h dans la séquence filmée |
| | durée du vol | ≈ 0,6 s (par analogie) | 0,60 s |
| | atterrissage | 227 → 224 km/h | 196,5 → 196,1 km/h |
| | explosion | non | non |
| | début de glissade | ≈ 30 km/h/s | 29,9 km/h/s |
| | fin de glissade | ≈ 180 km/h/s | 180 km/h/s réglés ; 273 mesurés ici, la voiture frottant la barrière |
| | arrêt après l'atterrissage | ≈ 2,1 s | 1,72 s |
| | rotation | ≈ 75° en 0,84 s | 72,3° |
| | second piqué | 34 % | 34 % |
| | vue stabilisée après le contact | 1,7 s | 1,70 s |
| | tremblement | 12,5 Hz | 12 Hz |

## 5. Écarts non résolus

- **Freinage et accélération** restent ceux de Virage GP (C9 non autorisée) : le freinage
  avant un choc et le redémarrage après un accident sont donc plus doux que dans la vidéo.
- **Circuits fermés par des barrières** (C10 non autorisée, et C6 limitée aux panneaux) : la
  glissade d'E5 se fait le long d'un rail au lieu d'un désert ouvert ; elle est plus courte.
- **Seuils de décollage** : choix de conception. Un seul exemple de chaque cas dans la vidéo.
- **Voitures de l'ordinateur** : pénalité réduite à 30 %. Effet sur trois courses de 3 tours
  à 16 voitures, toutes conduites par l'ordinateur (`work/scripts/race-contact-stats.mjs`,
  option `--legacy` pour l'ancien modèle ; résultats : `work/benchmarks/race-contact-stats.json`) :

  | Circuit | Modèle | Vainqueur | Meilleur tour | Clôture de la course | Contacts simples / tamponnages / roues | Barrières | Décollages |
  |---|---|---|---|---|---|---|---|
  | hazelbrook | ancien | 155,27 s | 50,58 s | 162,78 s | 63 / – / – | 0 | – |
  | | nouveau | 155,27 s | 50,10 s | 167,08 s | 25 / 7 / 27 | 7 | 0 |
  | porto-sereno | ancien | 175,12 s | 57,17 s | 183,16 s | 108 / – / – | 0 | – |
  | | nouveau | 175,12 s | 57,17 s | 190,92 s | 51 / 6 / 62 | 18 | 0 |
  | meridian-docks | ancien | 221,93 s | 72,75 s | 229,90 s | 133 / – / – | 0 | – |
  | | nouveau | 221,93 s | 72,53 s | 229,71 s | 58 / 18 / 51 | 12 | 0 |

  Le vainqueur n'est pas touché ; le peloton perd jusqu'à 4 % ; des **frôlements de barrière
  apparaissent** (7 à 18 par course, aucun auparavant) parce que deux voitures côte à côte ne
  se repoussent plus par impulsion ; un tête-à-queue avec remise en piste sur une des trois
  courses ; aucun décollage entre voitures de l'ordinateur. Trois courses ne font pas une
  statistique : c'est un contrôle de non-perturbation, pas une mesure d'équilibrage.
- **Une voiture accidentée est traversée** par celles qui suivent (elle ne peut pas être
  heurtée) : visible à la fin de `E3x.mp4`. Vue du cockpit pendant le piqué, la voiture qui
  repasse apparaît en haut de l'image, dessinée de dos et non de dessus (`E3.mp4`, vers 2,8 s).
- **Ombre de la voiture en vol** : elle fait partie du dessin de la voiture et monte avec elle.
- **Voitures vues de l'extérieur pendant un vol** : elles sont soulevées, pas cabrées.
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
circuits. Les profils de conduite (`car-spec.js`) n'ont pas été touchés.

Ce que cela ne dit pas : si les sensations au volant sont restées satisfaisantes. Trois
changements se voient en conduisant sans rien heurter — le piqué de la vue au freinage, plus
marqué ; les rétroviseurs, déplacés ; l'animation des roues avant (ces deux derniers :
`wheels-and-mirrors.md`). C'est au joueur d'en juger.

## 8. Séquences et captures

| Fichier | Contenu |
|---|---|
| `work/renders/collisions/E2.mp4`, `E3.mp4`, `E3x.mp4`, `E4.mp4`, `E5.mp4` | Les scénarios rejoués dans le vrai jeu, 60 images par seconde (deux pas de simulation par image), 960×540. `E3x` : le décollage vu de derrière |
| `work/renders/collisions/*-sheet.jpg` | Planches des étapes du mouvement (une image toutes les 0,07 à 0,1 s) |
| `work/renders/collisions/*.json` | Télémétrie de chaque image : vitesse, état, tangage de la vue, événements |
| `work/renders/collisions/stills/` | 24 images extraites des vidéos aux moments clés (avant le contact, étincelle, cabré, piqué, explosion, panaches, arrêt, redémarrage, panneau, vol, glissade), 960×540 |

Reproduire : `node work/scripts/collision-sequences.mjs all --width 960 --height 540`.

Ce que montrent les séquences du jeu (journal de l'enregistrement) :

| Séquence | Événements relevés |
|---|---|
| E2 | 1,03 s : contact de roues, 148 → 53 km/h, étincelle sur la roue avant droite, « TCHAK ! » |
| E3 | 1,67 s : décollage à 262 km/h ; 2,53 s : atterrissage violent, 32 km/h, explosion ; 6,58 s : redémarrage |
| E3x | le même accident en vue arrière : la voiture passe au-dessus de l'autre, retombe, explose |
| E4 | cinq tamponnages en 6,4 s (0,72 / 1,78 / 3,57 / 4,58 / 6,37 s) : 183 → 87, puis 91 → 43 km/h, etc. |
| E5 | 1,00 s : panneau « 300 » à 242 km/h, décollage ; 1,60 s : atterrissage à 207 km/h, glissade volant lâché ; 2,85 s : un second panneau est renversé pendant la glissade (124 → 73 km/h) ; 3,95 s : remise en piste |

Dans E5 le second panneau raccourcit la glissade : c'est une conséquence du circuit (les
panneaux de freinage se suivent), absente de la vidéo de référence où le terrain est ouvert.
