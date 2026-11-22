# Spécification de jeu et évaluation de la conduite

Virage GP est un jeu **original** du genre « course arcade de monoplaces en vue cockpit ».
Il reprend des conventions de genre documentées dans `docs/research/genre-study.md` (dont le
jeu cité comme référence de sensations, *Vroom Multi-Player*, 1993) sans en reproduire le nom,
les circuits, les dessins ni les valeurs chiffrées. Chaque règle ci-dessous est étiquetée :

- **[genre]** convention attestée par les sources pour la référence de genre (voir l'étude) ;
- **[choix]** décision de conception propre à Virage GP ;
- **[estimé]** valeur numérique fixée par nous, sans source historique.

Aucune source consultée ne donne de valeur chiffrée du comportement routier de la référence
(accélérations, distances de freinage, adhérence) : **toutes les valeurs de conduite sont donc
[estimé]** et calées sur des ordres de grandeur de monoplaces du début des années 1990.

## 1. Modes de jeu

| Mode | Règles | Statut |
|---|---|---|
| **Arcade** | Départ dernier d'un plateau de 12, 2 tours. Il faut finir au moins à la position cible (9e au premier circuit, puis 8e… jusqu'à 3e) pour accéder au circuit suivant ; sinon fin de partie. Niveau des adversaires croissant. Pas d'usure, pas d'arrêt. | principe « quota de dépassements + score » **[genre]** ; seuils, barème **[estimé]** |
| Score arcade | 300 pts par dépassement, 200 pts par place gagnée à l'arrivée, prime de temps `max(0, 4200 − 12 × temps)`, 500 pts sans contact. Record sauvegardé. | **[estimé]** |
| **Championnat** | 3 saisons de 6 manches. Par manche : un tour lancé de qualification seul en piste (grille par comparaison avec des temps simulés des 15 pilotes), puis la course avec usure, carburant, dégâts, stands et pannes. Points 10-6-4-3-2-1. Sauvegarde après chaque manche ; la saison suivante se débloque en finissant la précédente. | structure et qualification **[genre]** ; barème **[choix]** (barème F1 de l'époque) |
| **Entraînement** | Seul en piste, tours chronométrés sans limite, réglages libres, record du tour sauvegardé. | **[genre]** |
| **Turbo** | Course simple, puissance +22 %, bouton de suralimentation (+45 % de puissance) qui fait monter une jauge de température ; à 100 % la suralimentation est coupée 3,5 s. | **[choix]** — dans la référence, « turbo » désigne un affichage en fenêtre réduite privilégiant la fluidité, sans objet sur une machine actuelle ; nous avons gardé le nom pour un mode « plus de puissance ». |
| **Deux joueurs** | Écran partagé, haut/bas par défaut (présentation attestée pour la référence) ou gauche/droite ; règles Arcade, Compétition ou Turbo ; adversaires ordinateur en option. | écran partagé horizontal **[genre]** ; vertical **[choix]** |
| Niveaux | Débutant, Amateur, Pro, Expert : rythme, agressivité, taux d'erreurs et puissance des adversaires. | quatre niveaux **[genre]** ; effets **[estimé]** |

## 2. Règles de course

- Départ arrêté sur grille décalée, cinq feux rouges puis extinction après un délai aléatoire
  (0,5 à 1,3 s) **[choix]**. Qualification : départ lancé.
- Classement en continu par distance parcourue ; arrivée au passage de la ligne après le
  dernier tour du premier ; chronométrage par tour et par secteur (3 secteurs).
- Compétition : usure des pneus (durée de vie 13 tours en gomme medium) et consommation
  (10,5 tours d'autonomie) **[estimé]** ; crevaison à 100 % d'usure ; panne sèche ; dégâts aux
  contacts ; casse moteur aléatoire des adversaires (0,4 % par tour) **[estimé]**.
- **Stands** **[genre]** : entrée par la voie des stands (limiteur 80 km/h), arrêt sur son
  emplacement : pneus neufs, plein, réparation. Durée 3 s + jusqu'à 2,4 s d'essence + jusqu'à 5 s
  de réparation **[estimé]**. Pour le joueur, la voie des stands est en pilotage automatique.
- Sortie de piste : herbe et gravier ralentissent et réduisent l'adhérence ; un mur renvoie
  la voiture et lui fait perdre de la vitesse ; un choc violent provoque un tête-à-queue puis une
  remise en piste automatique ; touche de remise en piste manuelle **[choix]**.
- **Collisions et accidents** (détail et comparaison chiffrée : `collisions.md`) : la voiture
  qui en tamponne une autre repart 48 km/h moins vite qu'elle, sans la déranger ; un contact
  roue contre roue coûte environ 96 km/h à la plus rapide ; ni l'un ni l'autre ne change le
  cap. Roue sur roue avec au moins 36 km/h d'écart, la voiture de derrière fait un **saut
  récupérable** : ralentie au choc, court envol, retombée sur les roues 48 km/h moins vite
  que l'autre, direction perturbée un instant, et la course continue **[choix de gameplay
  original, sans référence]**. Roue sur roue par
  l'arrière à grande vitesse (180 km/h et 54 km/h d'écart au moins), elle décolle, retombe
  derrière l'autre, explose et repart après 3,2 s d'arrêt. Un panneau de freinage heurté à grande
  vitesse fait décoller la voiture, qui retombe sans exploser, glisse hors de contrôle et
  repart de là où elle s'arrête. Pertes de vitesse et durées **[mesuré sur une vidéo de
  gameplay, approximatif]** ; seuils de déclenchement **[choix]**.

## 3. Réglages

| Réglage | Effet (mesuré, profil compétition) | Statut |
|---|---|---|
| Ailerons, 5 crans | de 332 km/h et 2,88 g à 250 km/h (appui mini) à 311 km/h et 3,87 g (appui maxi) | existence **[genre]** ; valeurs **[estimé]** |
| Pneus durs / mediums / tendres | adhérence ×0,972 / 1 / 1,034 ; usure ×0,55 / 1 / 1,9 | existence **[genre]** ; valeurs **[estimé]** |
| Boîte automatique / manuelle, 6 rapports | en manuel, rupteur en fin de rapport | **[genre]** |

## 4. Modèle de conduite

Modèle arcade déterministe (`src/physics/car-physics.js`, paramètres dans
`src/vehicles/car-spec.js`), identique pour le joueur et l'ordinateur :

- direction cinématique limitée par un **budget d'adhérence** dépendant de la vitesse (appui
  aérodynamique) ; au-delà, la voiture glisse, élargit et perd de la vitesse ;
- moteur à courbe de puissance, 6 rapports, traînée quadratique, frein moteur ;
- deux profils, à rapprocher des deux « styles de conduite » de la référence (assisté /
  libre) **[genre]** : *arcade* (aide de direction complète, +8 % d'adhérence) et
  *compétition* (aide partielle, usure et dégâts) ; *turbo* dérive du premier.

### Mesures reproductibles

`node work/scripts/driving-report.mjs` (sans rendu) — résultats dans
`work/benchmarks/driving-report.json` :

| Mesure | Arcade | Compétition | Turbo | Ordre de grandeur F1 1990-93 |
|---|---|---|---|---|
| 0 → 100 km/h | 1,89 s | 2,04 s | 1,97 s | 2,5 à 3 s |
| 0 → 200 km/h | 3,85 s | 4,08 s | 3,81 s | 5 à 6 s |
| 0 → 300 km/h | 8,97 s | 9,21 s | 7,26 s | 12 à 15 s |
| Vitesse maximale (ailerons moyens) | 322 km/h | 321 km/h | 335 km/h (sans suralimentation) | 310 à 340 km/h |
| 200 → 0 km/h | 56,5 m en 2,26 s | 61,4 m en 2,46 s | 58,9 m en 2,36 s | 60 à 70 m |
| 300 → 0 km/h | 101,1 m en 2,91 s | 109,6 m en 3,17 s | 105,2 m en 3,03 s | 110 à 130 m |
| Adhérence latérale à 100 / 200 / 300 km/h | 2,14 / 3 / 4,44 g | 1,99 / 2,78 / 4,11 g | 2,06 / 2,89 / 4,27 g | 2 à 4 g |
| Tour de Hazelbrook (3,57 km), pilote Expert seul | — | 51,4 s (250 km/h de moyenne) | — | — |

Les accélérations sont volontairement plus vives que la réalité (nervosité arcade) ; le
freinage et l'adhérence sont dans les ordres de grandeur réels, ce qui rend le freinage
« exigeant » : à 300 km/h il faut 109,6 m pour s'arrêter.

### Évaluation de la fidélité aux sensations de référence

| Sensation recherchée | Observation reproductible | Verdict |
|---|---|---|
| Nervosité, accélération vive | 0-200 km/h en 4,08 s (test `physics.test.mjs`) | conforme à l'intention |
| Direction immédiate | réponse en lacet 16 s⁻¹, plein braquage en 0,22 s ; test de symétrie gauche/droite | conforme |
| Freinage exigeant | distances réalistes ; les pilotes ordinateur freinent sur 4 % et plus du tour | conforme |
| Dépassements | 10 dépassements ou plus sur 3 tours à 16 voitures (test `ai.test.mjs`) ; aspiration jusqu'à −32 % de traînée | conforme |
| Collisions pénalisantes | perte de vitesse au mur, tête-à-queue au-delà de 11 à 15 m/s d'impact, dégâts en compétition | conforme |
| Vitesse très élevée à l'écran | 310 km/h+, traits de vitesse, étirement de perspective (+9°), défilement des vibreurs sans repliement jusqu'à 300 m/s | à juger sur la vidéo |
| **Comparaison directe avec le jeu de 1993** | **non réalisée** : aucune mesure du jeu d'origine n'est disponible dans les sources, et il n'a pas été exécuté | **non vérifié** |

## 5. Adversaires

15 à 16 pilotes fictifs (9 écuries), chacun avec rythme, régularité, agressivité, réaction et
qualité moteur (`vehicles/liveries.js`). L'ordinateur produit les mêmes commandes qu'un
joueur : poursuite de la trajectoire idéale, profil de vitesse avec freinage anticipé,
dépassement et défense par déport latéral limité en vitesse, arrêt aux stands, erreurs
aléatoires (freinage tardif, écart, lever de pied). Pas d'« élastique » : le rythme ne dépend
que du niveau et de l'état de la voiture. Nombre d'adversaires configurable (0 à 16).

## 6. Commandes

| Action | Joueur 1 (clavier) | Joueur 2 (clavier) | Manette (standard) | Souris |
|---|---|---|---|---|
| Direction | ← → | A D (touches physiques : Q D en AZERTY) | stick gauche / croix | déplacement latéral |
| Accélérer / freiner | ↑ ↓ | W S (Z S en AZERTY) | gâchettes droite / gauche | bouton gauche / droit |
| Rapport + / − | Maj droite / Ctrl droite | E / Q | RB / LB | touches clavier |
| Turbo | Espace | F | A | touche clavier |
| Remise en piste | Retour arrière | R | Y | touche clavier |
| Caméra | C | V | X | touche clavier |
| Pause | Échap | P | Start | touche clavier |

Tout est réaffectable par joueur (Options → Commandes) ; périphérique par joueur : clavier,
souris, manette 1 ou 2 (deux manettes simultanées, ou clavier + manette).
