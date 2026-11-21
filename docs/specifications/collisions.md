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
| `src/rendering/compositing/crash-camera.js` | Mouvements de la vue et assiette de la voiture vue de l'extérieur : fonctions pures de l'état simulé |
| `src/rendering/effects/effects-layer.js` | Étoile au point de contact, éclats de panneau, explosion en quatre temps |
| `src/rendering/drawing/scene-builder.js` | Voiture en vol dans les vues extérieures : ombre au sol, inclinaison, écrasement |
| `src/rendering/compositing/cockpit-layer.js` | Volant lâché pendant une perte de contrôle |

`car-spec.js` (profils de conduite) n'est pas modifié.

## 2. Les sept situations

| Situation | Condition (testable) | Conséquence |
|---|---|---|
| **Collision simple** | Contact entre deux voitures qui ne roulent pas dans le même sens (plus de 37° d'écart), ou dont l'une n'est pas en course | Réponse par impulsion, inchangée ; tête-à-queue si le choc est très violent |
| **Tamponnage arrière** | Même sens, voitures séparées dans l'axe (nez contre arrière), celle de derrière plus rapide | La voiture du joueur qui percute repart **48 km/h moins vite que celle qu'elle a touchée** : elle perd donc 48 km/h plus la vitesse à laquelle elle arrivait. Les deux voitures se séparent aussitôt. Celle de devant n'est pas perturbée. Aucun changement de cap |
| **Contact latéral roue contre roue** | Même sens, voitures séparées en travers (côte à côte) | La plus rapide perd **≈ 96 km/h** ; les deux sont écartées une fois (1,2 m/s) ; aucune n'est tournée. L'autre voiture ne paie pas à son tour tant qu'elles restent côte à côte |
| **Contact provoquant un décollage** | Tamponnage avec recouvrement latéral **partiel** (20 à 80 % de la largeur : roue sur roue), vitesse relative ≥ 15 m/s, vitesse de la voiture de derrière ≥ 50 m/s (180 km/h) | La voiture de derrière passe à l'état `AIRBORNE` (0,85 s) ; celle de devant n'est pas perturbée |
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
| `work/renders/collisions/stills/` | Images extraites des vidéos aux moments clés (avant le contact, étoile, cabré, piqué, explosion, panaches, arrêt, redémarrage, panneau, vol, glissade, retour vers la piste), 960×540 |

Reproduire : `node work/scripts/collision-sequences.mjs all --width 960 --height 540`.

Ce que montrent les séquences du jeu (journal de l'enregistrement) :

| Séquence | Événements relevés |
|---|---|
| E2 | 1,03 s : contact de roues, 148 → 53 km/h, étoile sur la roue avant droite, « TCHAK ! » |
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
