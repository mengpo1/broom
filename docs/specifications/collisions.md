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
| **Saut récupérable** (choix de gameplay original, voir § 2 bis) | Roue sur roue (jusqu'à 80 % de la largeur en recouvrement), vitesse relative ≥ 10 m/s (36 km/h), vitesse de la voiture de derrière ≥ 33 m/s (120 km/h), caps à moins de 20° l'un de l'autre, et conditions de l'accident ci-dessous non réunies | La voiture de derrière est ralentie au choc (25 km/h de moins que l'autre), fait un saut court (0,45 s, 0,55 m), retombe sur ses roues 48 km/h moins vite que n'allait l'autre au choc, sa direction se dandine 0,7 s, et elle continue ; celle de devant n'est pas perturbée |
| **Contact provoquant un accident violent** | Tamponnage avec recouvrement latéral **partiel** (20 à 80 % de la largeur : roue sur roue), vitesse relative ≥ 15 m/s (54 km/h), vitesse de la voiture de derrière ≥ 50 m/s (180 km/h) | La voiture de derrière passe à l'état `AIRBORNE` (0,85 s, 1,3 m) et retombe en atterrissage violent ; celle de devant n'est pas perturbée |
| **Obstacle ponctuel** | Voiture hors de l'asphalte dont la boîte recouvre un panneau | Le panneau est couché pour le reste de la course. Sous 40 m/s : la voiture garde 60 % de sa vitesse. Au-dessus : `AIRBORNE` (0,6 s) |
| **Atterrissage léger** | Fin d'un vol déclenché par un obstacle | Vitesse conservée ; glissade hors de contrôle (rotation lente vers la piste, décélération faible puis forte) ; à l'arrêt la voiture est rendue à son pilote **là où elle s'est arrêtée**, en première |
| **Atterrissage violent** | Fin d'un vol déclenché par une voiture | Vitesse ×0,15 ; arrêt en 0,85 s ; `WRECKED` : 3,2 s à l'arrêt ; redémarrage sur place en première, protégé 2 s ; explosion |

Règles communes :

- **tamponnage** : il n'y a ni poussée ni contact prolongé. Toute perte de vitesse du joueur
  est un tamponnage signalé (étoile, onomatopée, piqué de la vue) ; le suivant demande une
  nouvelle approche. Jamais en dessous de 5 m/s ;
- **contact latéral** : une pénalité au plus par seconde et par voiture ;
- **en vol** : la voiture garde le cap, perd 50 km/h par seconde (vitesse affichée), ne se
  dirige plus, reste entre les barrières. Lancée par une autre voiture, elle **ne la dépasse
  pas** : elle retombe juste derrière elle (dans la vidéo, les voitures heurtées sont « juste
  devant » après le vol) ;
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

## 2 bis. Le saut récupérable — trois niveaux pour un même contact

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
| | après le vol | les voitures heurtées sont juste devant, puis s'éloignent | voiture heurtée 4,2 m devant à l'atterrissage (de centre à centre), 126 m deux secondes plus tard |
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
- **Saut récupérable** : choix de gameplay original, sans référence. Ses seuils et son dosage
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
  elle est dessinée plus pâle une fois arrêtée.
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
