# Roues avant et rétroviseurs de la vue cockpit

Deux corrections d'image faites après le travail sur les collisions (`collisions.md`). Elles
ne touchent ni la simulation ni la conduite.

## 1. Rotation des roues avant

Défaut mesuré : au-delà de 61 km/h le pneu était un dessin fixe, et entre 16 et 61 km/h les
marques sautaient plus d'une phase par image (aspect figé ou à rebours).

- **Jusqu'à 8 km/h** (2,2 m/s) : des marques isolées suivent **exactement** la distance
  parcourue (trois dessins par intervalle entre deux marques).
- **De 8 à 16 km/h** : les marques s'effacent pendant que le dessin « à vitesse » apparaît
  par-dessus (fondu) : il n'y a plus de saut d'un dessin à l'autre. 16 km/h est la plus grande
  vitesse à laquelle les marques peuvent suivre la roue à 60 images par seconde.
- **Au-delà** : douze rangées de traits courts font le tour du pneu. Chaque rangée traverse la
  bande de roulement et avance d'un tiers de l'écart entre rangées à chaque dessin, **toutes
  dans le sens de la rotation** (un long trait qui glisse sur lui-même paraît immobile : c'est
  la rangée, en travers, qui montre le mouvement). La cadence croît avec la vitesse, de 7
  cycles par seconde à l'apparition du dessin à 10 à pleine vitesse : un nouveau dessin toutes
  les deux ou trois images à 60 images par seconde, jamais plus d'une phase par image à 30.
- La phase avance avec la **distance parcourue**, pas avec les images affichées : même
  mouvement à toute cadence d'affichage, arrêt en pause.

Mesures sur la vidéo comparative (`python3 work/scripts/wheel-motion-check.py`, résultats
dans `work/benchmarks/wheel-motion.json`) : cadence des changements de dessin sur la bande de
roulement de la roue avant gauche, plus longue suite d'images identiques, et sens du mouvement
lu en suivant les rangées de traits dans les deux moitiés du pneu (pas vers le haut / vers le
bas, seuls les appariements nets étant comptés).

| Vitesse | Avant | Après |
|---|---|---|
| 8 km/h | 20 changements/s, jusqu'à 3 images identiques | 30 changements/s, 1 image identique au plus |
| 40 km/h | 21 changements/s, jusqu'à 3 images identiques ; sens illisible (15 pas vers le haut, 15 vers le bas) | 23 changements/s, 2 au plus ; **vers le haut** dans les deux moitiés (28 / 0 et 34 / 0) |
| 120 km/h | **0 changement : pneu figé** | 27 changements/s, 2 au plus ; **vers le haut** (33 / 0 et 38 / 5) |
| 250 km/h | 0,7 changement/s (60 images identiques de suite) | 29 changements/s, 2 au plus ; vers le haut dans une moitié (31 / 0), moins net dans l'autre (41 / 14) |
| de 4 à 30 km/h en 1,6 s | 27 changements/s, puis 12 images identiques de suite | 25 changements/s, 2 au plus : plus de rupture |

Vers le haut de l'image est le sens correct : vu du cockpit, la bande de roulement d'une roue
qui avance monte par l'arrière du pneu et passe par-dessus.

Vérifié aussi par `tests/unit/animation.test.mjs` : marques synchronisées avec la distance,
fondu continu entre les deux dessins, rangées alignées qui avancent toutes ensemble d'un tiers
d'écart dans le sens des marques, cadence croissante avec la vitesse, même résultat à 30, 60
ou 144 images par seconde.

Limites :

- ces mesures comptent des pixels et des pas ; elles ne disent pas si la rotation **se lit**
  bien à l'œil : c'est à juger sur la vidéo comparative et en jeu ;
- la lecture automatique du sens ne conclut pas à 8 km/h ni pendant l'accélération lente
  (marques trop rares pour être appariées) ; à 8 km/h le sens a été relevé à la main, image par
  image, et par le critique indépendant : vers le haut ;
- à 250 km/h la vibration du cockpit brouille en partie la lecture ;
- un pneu lisse réel ne montre pas de rangées de traits : c'est une convention de dessin ;
- la jante vue du cockpit ne tourne pas visiblement à basse vitesse ;
- les roues des **autres voitures** ne sont pas traitées : elles restent dessinées en
  rotation, y compris à l'arrêt sur la grille (leurs dessins servent à toutes les situations).

## 2. Rétroviseurs

Dans la vue cockpit ils flottaient au-dessus des roues sur de longues tiges, alors que les
vues extérieures les montrent fixés aux flancs du cockpit. Ils sont maintenant la
**projection, depuis l'œil du pilote, des rétroviseurs du modèle de la voiture**
(`MIRROR_MOUNT` dans `car-model.js`, lu par le dessin du cockpit) : même position, même
taille, bras court vers le flanc. Les trois caméras montrent donc la même voiture.

Conséquence visible : ils sont plus bas et masquent environ le tiers bas et extérieur de
chaque pneu avant ; en contrepartie ils ne cachent plus les voitures voisines ni l'horizon.
Leur contenu (la vue arrière simplifiée) n'a pas changé. Le critique indépendant
(`work/reviews/collision-review.md`) a confirmé que seule la vue cockpit a changé et qu'elle
est maintenant cohérente avec la vue de face ; il a noté que la première comparaison ne
plaçait pas les autres voitures au même endroit dans les deux états, ce qui est corrigé.

Vérifié par `tests/unit/animation.test.mjs` (« mirrors: the cockpit shows the mirrors of the
car model where the driver would see them »).

## 3. Séquences comparatives

| Fichier | Contenu |
|---|---|
| `work/renders/comparison/wheels-mirrors-before-after.mp4` | Le bas de la vue cockpit à 8, 40, 120 et 250 km/h, puis pendant une accélération de 4 à 30 km/h (1,6 s chacun, 60 images par seconde) : état précédent en haut, état actuel en bas |
| `work/renders/comparison/wheels-before-after.jpg` | La roue avant gauche, huit images consécutives par vitesse, avant et après |
| `work/renders/comparison/mirrors-before-after.jpg` | La même situation vue du cockpit, de derrière et de face, avant et après ; les autres voitures sont tenues aux mêmes places dans les deux états (une derrière à droite, une devant à gauche) |

Reproduire (il faut un build de l'état précédent, par exemple celui du commit « Lot 2 ») :
`node work/scripts/compare-wheels-mirrors.mjs <avant.html> index.html` et
`node work/scripts/compare-wheels-video.mjs <avant.html> index.html`.
