# Roues avant et rétroviseurs de la vue cockpit

Deux corrections d'image faites après le travail sur les collisions (`collisions.md`). Elles
ne touchent ni la simulation ni la conduite.

## 1. Rotation des roues avant

Défaut mesuré : au-delà de 61 km/h le pneu était un dessin fixe, et entre 16 et 61 km/h les
marques sautaient plus d'une phase par image (aspect figé ou à rebours).

- Jusqu'à 16 km/h (4,5 m/s), les marques suivent **exactement** la distance parcourue : c'est
  la plus grande vitesse à laquelle trois phases dessinées peuvent suivre la roue à 60 images
  par seconde.
- Au-delà, trois dessins de stries se succèdent **dans le sens de la rotation**, à une cadence
  apparente qui croît avec la vitesse (3,5 cycles par seconde à 16 km/h, 8,6 à 300 km/h) et
  reste lisible dès 30 images par seconde. La phase avance avec la **distance parcourue**, pas
  avec les images affichées : même mouvement à toute cadence d'affichage, arrêt en pause.
- Marques et stries dessinées plus franchement.

Part des pixels de la bande de roulement qui changent d'une image à la suivante
(`work/renders/comparison/wheels-before-after.jpg`, huit images consécutives par vitesse) :

| Vitesse | Avant | Après |
|---|---|---|
| 8 km/h | 0,27 % | 0,99 % |
| 40 km/h | 0,26 % | 0,60 % |
| 120 km/h | 0,00 % (dessin fixe) | 1,19 % |
| 250 km/h | 0,95 % (vibration seule) | 2,67 % |

Vérifié par `tests/unit/animation.test.mjs` (« front wheels: rolling marks… » et « front
wheels at speed… ») : phase liée à la distance, sens de rotation, cadence croissante avec la
vitesse, même résultat à 30, 60 ou 144 images par seconde.

Limites :

- la mesure ci-dessus compte des pixels ; elle ne dit pas si la rotation **se lit** bien à
  l'œil : c'est à juger sur la vidéo comparative et en jeu ;
- les roues des **autres voitures** ne sont pas traitées : elles restent dessinées en
  rotation, y compris à l'arrêt sur la grille (leurs dessins servent à toutes les situations).

## 2. Rétroviseurs

Dans la vue cockpit ils flottaient au-dessus des roues sur de longues tiges, alors que les
vues extérieures les montrent fixés aux flancs du cockpit. Ils sont maintenant la
**projection, depuis l'œil du pilote, des rétroviseurs du modèle de la voiture**
(`MIRROR_MOUNT` dans `car-model.js`, lu par le dessin du cockpit) : même position, même
taille, bras court vers le flanc. Les trois caméras montrent donc la même voiture.

Conséquence visible : ils sont plus bas et masquent le bas des roues avant. Leur contenu
(la vue arrière simplifiée) n'a pas changé.

Vérifié par `tests/unit/animation.test.mjs` (« mirrors: the cockpit shows the mirrors of the
car model where the driver would see them »).

## 3. Séquences comparatives

| Fichier | Contenu |
|---|---|
| `work/renders/comparison/wheels-mirrors-before-after.mp4` | Le bas de la vue cockpit à 8, 40, 120 et 250 km/h (1,6 s chacun, 60 images par seconde) : état précédent en haut, état actuel en bas |
| `work/renders/comparison/wheels-before-after.jpg` | La roue avant gauche, huit images consécutives par vitesse, avant et après |
| `work/renders/comparison/mirrors-before-after.jpg` | Le même instant vu du cockpit, de derrière et de face, avant et après |

Reproduire (il faut un build de l'état précédent, par exemple celui du commit « Lot 2 ») :
`node work/scripts/compare-wheels-mirrors.mjs <avant.html> index.html` et
`node work/scripts/compare-wheels-video.mjs <avant.html> index.html`.
