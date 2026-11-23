# Fonctionnalités incomplètes, limites et points non vérifiés

Ce document liste honnêtement ce qui n'est pas fait, ce qui est fait différemment de la
demande, et ce qui n'a pas pu être vérifié dans l'environnement de développement (conteneur
Linux sans carte graphique ni périphériques, Chromium piloté par Playwright, WebGPU exécuté
par le rasteriseur logiciel SwiftShader).

## 1. Écarts volontaires par rapport à la demande

| Demande | Ce qui a été fait | Raison |
|---|---|---|
| Recréer *Vroom Multiplayer* (nom, 18 circuits historiques, cockpit « rappelant immédiatement » l'original) | Jeu **original** du même genre : nom, 18 circuits fictifs en 3 saisons, cockpit, dessins, textes et sons propres | Pas de recréation d'un jeu existant ; les mécaniques génériques du genre sont reprises et documentées |
| Mode Turbo « historique » | Mode à puissance accrue avec suralimentation et surchauffe | Dans la référence, « turbo » est un affichage en fenêtre réduite pour gagner en fluidité : sans objet aujourd'hui |
| Dossier racine `vroom-comic-racer/` | Projet à la racine du dépôt existant, sous le nom Virage GP | Continuité avec le dépôt ; structure interne conforme |
| Références visuelles BD fournies au critique | Références **textuelles** uniquement (`docs/research/comic-art-reference.md`) ; `references/` est vide | Aucune image tierce n'a été téléchargée ni embarquée |

## 2. Non vérifié

| Point | État |
|---|---|
| **Performances sur matériel réel** (60 i/s à 2560×1440, GPU ≤ 11 ms, aucun pic > 16,7 ms) | **Non vérifié.** Aucun GPU dans le conteneur : les benchmarks ont tourné sur SwiftShader (processeur) et ne disent rien d'une carte graphique. L'outil est fourni : `index.html#benchmark=all` ou `npm run benchmark`. |
| **Comparaison de conduite avec le jeu de 1993** | Le jeu d'origine n'a **pas** été exécuté. Une vidéo de gameplay de l'édition de 1991 a été analysée image par image (`docs/research/vroom-gameplay-analysis.md`) : elle donne des mesures (accélération, freinage, collisions, décollages) et dix corrections proposées. Les corrections C1 à C8 (collisions, décollages, accidents, mise en scène) sont implémentées et comparées aux mesures (`collisions.md`) ; **C9 (accélération et freinage) et C10 (bords de piste ouverts) ne le sont pas**, par décision : la conduite normale reste celle de Virage GP, dont les valeurs sont des estimations (voir `gameplay.md`). Les mesures de la vidéo sont approximatives et les seuils qu'elle ne montre pas sont des choix de conception. |
| **Son** | Vérifié par mesures automatiques (80 contrôles : niveaux, spectre, absence d'écrêtage, réponse aux événements) mais **jamais écouté** par une personne. |
| **Manettes** | Code écrit pour la disposition « standard » de la Gamepad API (deux manettes) ; **non testé** avec un matériel réel. |
| **Souris** | Direction relative avec verrouillage du pointeur ; **non testée** hors automatisation. |
| **Clavier** | Navigation des menus et flux complets testés par automatisation (touches synthétiques) ; pas par un joueur. |
| **Navigateurs** | Testé sous Chromium (Playwright) uniquement ; Firefox et Chrome de bureau non testés. Wayland natif non testé (serveur X virtuel). |
| **Sensations de pilotage** | Évaluées par mesures et par l'IA ; aucun essai humain au volant dans cet environnement. Cela vaut pour les collisions et les accidents : leurs durées et leurs pertes de vitesse sont vérifiées, pas l'impression qu'ils donnent en jouant. |
| Scintillement, continuité des animations | Contrôlés par tests (images identiques à l'arrêt, variation bornée des effets d'une image à l'autre) et par un critique sur séquences d'images ; pas par visionnage temps réel sur écran. |

## 3. Incomplet ou simplifié

- **Rétroviseurs** : vue arrière simplifiée (ciel, relief, bas-côté et route aux couleurs du
  lieu, voitures qui suivent à leur place) ; les décors de bord de piste n'y figurent pas et
  la route y est une courbe approchée. Dans le cockpit ils sont placés là où le modèle de la
  voiture les porte (bas, contre les flancs) : ils masquent le bas des roues avant
  (`wheels-and-mirrors.md`).
- **Collisions et accidents** (`collisions.md`) : simulation arcade par états, pas de physique
  3D. Dans les vues extérieures une voiture en vol est soulevée, penchée et laisse son ombre
  au sol, mais son tangage ne peut pas être dessiné de dos ; pas de son propre au décollage ;
  les voitures de l'ordinateur ne subissent que 30 % de la perte de vitesse d'un contact et
  frôlent plus souvent les barrières qu'avant ; une épave reste traversable par un autre
  joueur ; seuls les panneaux de freinage sont des obstacles solides (arbres, bâtiments et
  autres décors restent derrière les barrières) et un panneau heurté disparaît sans débris.
  Un critique indépendant a relevé 7 défauts moyens et 13 mineurs sur les séquences
  (`work/reviews/collision-review.md`) ; ce qui n'a pas été traité est listé dans
  `collisions.md` § 9, et les corrections n'ont pas été revues à leur tour.
- **Saut récupérable** : choix de gameplay original (rien de tel dans la vidéo de référence),
  ajouté à la demande du joueur ; il se teste avec le banc d'essai
  (`collision-test-bench.md`). Jugé trop fréquent au troisième essai, il a été resserré à un
  vrai contact roue avant derrière roue arrière, avec plus d'énergie : 0,3 saut par course de
  16 voitures sur 108 courses d'essai, contre 1,9 (`collisions.md` § 12). **Si c'est le bon
  niveau, c'est au joueur de le dire.** Son dosage (hauteur, vitesse perdue, perturbation de
  la direction) n'a pas changé. Deux critiques indépendants ont examiné la version précédente
  (`collisions.md` § 10 et 11) ; **le resserrement lui-même n'a été revu par aucun critique**.
  Restent notamment : la vitesse du saut est perdue d'un coup à l'instant du choc (76 km/h en
  une image) ; la vue cockpit ne roule pas pendant le saut alors que la vue extérieure penche
  la voiture ; le dessin de la voiture de devant change de vue pendant une image à l'instant
  du choc.
- **Rétroviseurs** : jugés encore trop éloignés au troisième essai. La position du jeu est
  inchangée ; quatre propositions plus rapprochées attendent le choix du joueur
  (`wheels-and-mirrors.md` § 2 ter). Elles n'ont été ni revues par un critique ni essayées.
- **Braquage maintenu** : en tenant une touche de direction, la direction arrive en butée en
  0,225 s et plus rien ne change ensuite — ni mouvement supplémentaire du volant, ni virage
  plus serré, ni dérapage. C'est mesuré et analysé (`steering-study.md`) mais **rien n'est
  corrigé** : la solution dépend de la vidéo de référence que le joueur doit fournir, et toute
  modification de la physique se fera dans une variante expérimentale séparée.
- **Perte de roue** : demandée, **non implémentée**. La vidéo analysée n'en montre pas ; ce
  qu'il faudrait pour la définir est listé dans `collisions.md` § 6.
- **Roues** : seules les roues avant de la vue cockpit suivent la vitesse (marques
  synchronisées à basse vitesse, rangées de traits au-delà, traînées et anneaux près de la
  vitesse maximale : des conventions de dessin, un pneu lisse réel ne montre rien de tel) ;
  celles des autres voitures sont toujours dessinées en rotation, même à l'arrêt.
- **Monoplaces** : un seul modèle de carrosserie pour toutes les écuries (les livrées changent
  par trois couleurs et cinq schémas) ; les numéros de course n'apparaissent que sur les
  grandes illustrations (menus, planches d'introduction et de résultats), pas sur les voitures
  en course ; pas de lettrages de commanditaires sur les carrosseries ; pilotes sans visage.
- **Vues de voitures** : 25 dessins entre 0° et 180° (pas de 7,5°), miroir pour l'autre côté ;
  l'éclairage est donc symétrique (zénithal). Une seule élévation de point de vue.
- **Animations narratives** : planche d'introduction en trois cases et planche de résultats ;
  pas de personnages animés (pilote ajustant son casque : non réalisé), pas de recadrage
  dynamique en course au-delà des cartouches, éclats et onomatopées.
- **Qualifications** : le joueur roule son tour ; les temps des adversaires sont estimés par
  calcul (profil de vitesse) et non roulés.
- **Projection** : limites classiques de la perspective simulée — sol horizontal dans le sens
  latéral, pas de tunnels ni de ponts au-dessus de la piste autres que des portiques, pas de
  dévers ; au-delà de 100° de travers la vue se retourne d'un coup.
- **Décors** : les éléments répétés le long de la piste (tribunes, stands, palissades) sont des
  tuiles : numéros de travée et panneaux se répètent ; les poteaux de grillage penchent dans le
  mauvais sens d'un côté de la piste. Les pignons de bâtiments sont des aplats simples.
- **Vue de très près** : les dessins sont des images ; contre une barrière ou une voiture ils
  restent moins nets qu'un tracé vectoriel (définition doublée pour les barrières, contour
  raffermi, effacement des objets trop grossis).
- **Qualité graphique** : le changement d'anti-crénelage (MSAA) demande un rechargement de la
  page ; le niveau de détail et les distances s'appliquent immédiatement.
- **Météo, nuit, dégâts visibles sur les voitures** : absents (une voiture accidentée repart intacte).
- **Mémoire vidéo** : environ 460 Mo de textures (atlas 13 × 2048², 50 couches de voitures
  1024×512, 3 panoramas 4096×768, mipmaps).
- **Temps de chargement** : tous les dessins sont produits au lancement, avec un pourcentage
  d'avancement. Mesuré dans le conteneur (4 cœurs virtuels, tout en logiciel) : environ 25 s,
  dont 22 s pour tracer les 50 calques de voitures (0,43 s par calque, temps de tracé du
  canvas 2D, pas d'envoi au GPU) ; le temps sur une machine de bureau n'a **pas** été mesuré.
  Ensuite environ une seconde par changement de circuit.
- **Allocations par image** : le code du jeu n'alloue pas dans la boucle de rendu, mais l'API
  WebGPU crée elle-même quelques objets par image (texture courante, vue, encodeur, passe).
- **Vidéo de démonstration** : produite image par image (rejeu déterministe, rendu logiciel),
  et non par capture d'écran en temps réel ; la bande-son est rendue hors ligne par le moteur
  audio du jeu (voir aussi § 5).

## 4. Revue artistique : objectif non atteint

La demande était d'itérer jusqu'à ce qu'aucun défaut ne dépasse le niveau « mineur ». **Ce
n'est pas le cas.** Quatre critiques indépendants successifs (voir
`docs/art-direction/independent-review.md`) ont relevé :

| Itération | Graves | Moyens | Mineurs |
|---|---|---|---|
| 1 | 5 | 15 | 9 |
| 2 | 2 | 15 | 7 |
| 3 | 2 | 16 | 10 |
| 4 | 1 | 9 | 13 |

Les défauts graves de chaque itération ont été corrigés avant la suivante, mais chaque
nouveau critique, qui ne connaît pas les rapports précédents, en a trouvé d'autres — dont trois
fois des effets de bord de mes propres corrections. Le défaut grave du quatrième rapport
(lisière de forêt coupée à la verticale) a été corrigé ensuite et vérifié par moi sur capture,
**sans nouvelle contre-expertise** ; huit de ses neuf défauts moyens ne sont pas traités.

Défauts connus qui subsistent, par ordre d'importance :

- les voitures en course n'ont ni numéro ni marquage, et les voitures vues de près restent des
  dessins agrandis, moins nets que le cockpit ;
- la voiture vedette des menus et de la vue extérieure garde un aspect de volume (casque
  sphérique, pilote sans bras), les fonds de menu sont pauvres ;
- les bords de piste lointains sont crénelés et leur motif change d'une image à l'autre (la
  route est calculée ligne par ligne) ;
- les rétroviseurs de la vue cockpit ne sont pas fixés comme sur la vue extérieure (traité
  depuis : ils sont dessinés à la position du modèle, voir `wheels-and-mirrors.md` ; ce correctif
  n'a pas été revu par un critique) ;
- les lisières de forêt et les fins de grillage sont des coupes nettes ; les panneaux d'un
  côté de la piste ont leur texte inversé ;
- la vitesse repose sur les traits au sol, les stries des pneus et le défilement : en image
  fixe elle reste peu marquée.

## 5. Vidéo de démonstration

`race-replay.mp4` a été enregistrée image par image (rejeu déterministe, rendu logiciel) sur le
build du commit `42afaf7`, c'est-à-dire **avant** les corrections qui ont suivi le troisième
rapport de critique. Ces corrections ne concernent pas une course normale (mur au contact,
pages de menu, onomatopées variées, avant-bras, lettrage de l'interface) à l'exception de
l'espacement des lettres de l'interface, des avant-bras du pilote, des étriers de frein
(rouges dans la vidéo, métal ensuite), de l'extrémité des vibreurs et de l'ordre de quelques
objets de bord de piste, visibles dans la vidéo dans leur état antérieur. La vidéo est réencodée à 5,5 Mbit/s pour tenir dans le dépôt.

Elle est aussi **antérieure au travail sur les collisions** : on y voit les anciens contacts
(impulsions), les anciens rétroviseurs et l'ancienne animation des roues avant. Les nouvelles
collisions sont montrées par les séquences de `work/renders/collisions/`.
