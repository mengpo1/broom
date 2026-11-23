# Roues avant et rétroviseurs de la vue cockpit

Corrections d'image faites après le travail sur les collisions (`collisions.md`), en trois
temps : rotation des roues et position des rétroviseurs (§ 1, § 2) ; après le second essai du
joueur, roues près de la vitesse maximale et entraxe des rétroviseurs (§ 1 bis, § 2 bis) ;
après le troisième, nouvelles propositions de rétroviseurs (§ 2 ter). Elles ne touchent ni la
simulation ni la conduite.

**État des validations par le joueur (troisième essai)** : l'animation des roues à grande
vitesse est jugée satisfaisante et **validée pour ce lot** — elle n'a plus été modifiée (les
fichiers `cockpit-layer.js` et les dessins de pneus de `car-model.js` sont inchangés, ses
tests passent). Les rétroviseurs restent à choisir.

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

## 1 bis. Près de la vitesse maximale — le pneu qui tourne très vite

Au second essai le joueur a jugé l'animation « nettement améliorée, mais incomplète à vitesse
maximale » : de 16 km/h à la vitesse maximale le pneu montrait les mêmes rangées de traits,
seule leur cadence augmentait. Une **troisième famille de dessins** a été ajoutée ; ce n'est
pas une accélération de la cadence, qui reste celle d'avant.

- **Le dessin** (`{ fast: true }` dans `car-model.js`) : trois anneaux tracés autour du pneu,
  fixes (un cercle qui tourne sur lui-même ne bouge pas : c'est ce qu'on voit d'un pneu à très
  grande vitesse), et de longues traînées claires dans le sens de la rotation, dont les têtes
  alternent d'une voie à l'autre. Trois phases, qui avancent d'un tiers de pas dans le même
  sens que les marques et les rangées de traits.
- **La transition** : fondu croisé avec les rangées de traits, de 0 % à 180 km/h à 100 % à
  311 km/h (`WHEEL_FAST_START`, `WHEEL_FAST_FULL` dans `cockpit-layer.js`). 311 km/h est la
  plus basse des vitesses maximales des voitures (311 à 332 km/h selon les ailerons) : l'image
  change donc jusqu'à la vitesse maximale, et toute voiture atteint le dessin complet. À
  200 km/h il compte pour 15 %, à 250 pour 53 %, à 300 pour 92 %.
- **La phase** est la même que celle des rangées de traits (une seule horloge, avancée par la
  **distance parcourue**) : les deux dessins tournent ensemble pendant le fondu, à toute
  cadence d'affichage, et s'arrêtent en pause.
- **En dessous de 180 km/h rien ne change** : ni les marques synchronisées, ni le fondu de 8 à
  16 km/h, ni les rangées de traits.

Mesures (`python3 work/scripts/wheel-motion-check.py <vidéo> <sortie.json>`, sur la bande de
roulement de la roue avant gauche ; enregistrements faits **vibration du cockpit coupée**
(option du jeu, `--steady`) pour ne mesurer que le dessin du pneu ; résultats dans
`work/benchmarks/wheel-motion-60fps.json`, `-30fps.json`, `-144fps.json`). À 60 images par
seconde, état de la PR précédente / état actuel :

| Vitesse | Changements de dessin par seconde | Plus longue suite d'images identiques | Part de la bande portant un trait clair | Variation moyenne d'une image à la suivante (scintillement) |
|---|---|---|---|---|
| 40 km/h | 23,4 / 23,4 | 2 / 2 | 8,3 % / 8,3 % | 1,67 / 1,69 (+1 %) |
| 120 km/h | 26,9 / 26,9 | 2 / 2 | 8,5 % / 8,5 % | 1,91 / 1,94 (+2 %) |
| 200 km/h | 29,0 / 29,0 | 2 / 2 | 9,5 % / 9,2 % | 2,11 / 2,03 (-4 %) |
| 250 km/h | 29,0 / 29,7 | 2 / 2 | 9,7 % / 7,3 % | 2,09 / 1,63 (-22 %) |
| 300 km/h | 31,0 / 31,0 | 2 / 2 | 10,9 % / 6,5 % | 2,18 / 1,21 (-44 %) |
| 322 km/h | 32,4 / 31,7 | 1 / 1 | 11,9 % / 6,6 % | 2,20 / 1,07 (-51 %) |
| de 0 à 322 km/h en 8 s | 28,3 / 28,4 | 3 / 3 | 23,0 % / 23,9 % | 2,01 / 1,85 (-8 %) |

Ce que cela montre : à 40 et 120 km/h rien n'a changé (aux arrondis de la compression vidéo
près) ; à 200 km/h le nouveau dessin commence à peine ; de 250 à 322 km/h la cadence est la
même qu'avant mais **les traits isolés cèdent la place à un dessin plus continu** — la part de
la bande portant un trait clair baisse d'un tiers à moitié, et le scintillement de 22 %, 44 %
et 51 %. Entre 300 et 322 km/h l'image évolue encore (scintillement 1,21 → 1,07). Le pneu
n'est jamais figé : au plus deux images identiques de suite (0,03 s).

Aux trois cadences d'affichage, état actuel (changements par seconde ; plus longue suite
d'images identiques) :

| Vitesse | 30 images/s | 60 images/s | 144 images/s |
|---|---|---|---|
| 40 km/h | 23,7 ; 1 image (0,03 s) | 23,4 ; 2 images (0,03 s) | 23,4 ; 7 images (0,05 s) |
| 120 km/h | 26,5 ; 1 image (0,03 s) | 26,9 ; 2 images (0,03 s) | 26,9 ; 5 images (0,04 s) |
| 200 km/h | 28,6 ; 1 image (0,03 s) | 29,0 ; 2 images (0,03 s) | 28,2 ; 5 images (0,04 s) |
| 250 km/h | 29,3 ; 1 image (0,03 s) | 29,7 ; 2 images (0,03 s) | 28,9 ; 5 images (0,04 s) |
| 300 km/h | 29,3 ; 1 image (0,03 s) | 31,0 ; 2 images (0,03 s) | 31,7 ; 5 images (0,04 s) |
| 322 km/h | 29,3 ; 1 image (0,03 s) | 31,7 ; 1 image (0,02 s) | 32,4 ; 5 images (0,04 s) |
| de 0 à 322 km/h en 4 s (8 s à 60) | 27,4 ; 1 image (0,03 s) | 28,4 ; 3 images (0,05 s) | 28,3 ; 7 images (0,05 s) |

La cadence du dessin est la même à 60 et à 144 images par seconde (elle suit la distance, pas
les images) ; à 30 images par seconde elle est plafonnée par l'affichage (un dessin nouveau à
chaque image), sans jamais sauter plus d'une phase par image.

**Sens de rotation** : jusqu'à 200 km/h la lecture automatique donne « vers le haut », le
sens correct (à 200 km/h : 30 pas vers le haut pour 1 vers le bas dans une moitié du pneu,
37 pour 9 dans l'autre). **À partir de 250 km/h la mesure ne conclut plus** — ni dans un sens
ni dans l'autre : les traînées se fondent et les repères qu'elle suit disparaissent, ce qui
est le but. L'absence de rotation inverse apparente à ces vitesses n'est donc pas démontrée
par la mesure ; elle l'est par construction (test « trails and rings round the tyre, moving as
one piece the same way as the marks ») et reste **à juger à l'œil**.

Vidéo à regarder : `work/renders/comparison/wheels-high-speed-before-after.mp4` (tel qu'en
jeu, vibrations comprises) : 40, 120, 200, 250, 300 et 322 km/h, puis l'accélération continue
de 0 à 322 km/h.

Second critique indépendant (`work/reviews/second-test-review.md`), sur la première version
(transition terminée à 300 km/h) : dessin réellement nouveau, transition progressive, rien de
changé aux vitesses basses et moyennes ; quatre réserves mineures :

| N° | Réserve | Suite |
|---|---|---|
| B-1 | Plus rien n'évolue entre 300 et 322 km/h | **Corrigé** : transition étirée jusqu'à 311 km/h (voir ci-dessus). Une voiture peu chargée en ailerons (jusqu'à 332 km/h) garde le dessin complet sur ses 21 derniers km/h |
| B-2 | Battement résiduel à 10 Hz des traînées (trois dessins tenus deux images chacun) | Non traité |
| B-3 | Entre 220 et 270 km/h les deux systèmes de dessin se superposent (zone la plus chargée) | Non traité : c'est le fondu croisé lui-même |
| B-4 | Le gain sur le scintillement est en partie repris par la vibration du cockpit (−38 % avec, −58 % sans, à 322 km/h, sur sa mesure) | Non traité : la vibration fait partie de la conduite validée |

La version corrigée (B-1) n'a pas été revue par un critique : elle est vérifiée par les
mesures ci-dessus et par le test « front wheels near top speed… ».

Limites propres à ce régime :

- anneaux et traînées sont une **convention de dessin** de bande dessinée ; un pneu lisse réel
  ne montre rien de tel ;
- la vitesse « maximale réellement atteinte » des enregistrements est 322 km/h (réglage
  d'ailerons par défaut, sans aspiration) ;
- les mesures comptent des pixels : elles ne disent pas si l'effet **se lit** comme une roue
  qui tourne très vite. C'est au joueur d'en juger.

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

## 2 bis. Entraxe légèrement réduit — trois variantes comparées

Au second essai le joueur a jugé l'entraxe des rétroviseurs « légèrement excessif ». La
position se règle à un seul endroit, `MIRROR_MOUNT` dans `src/art/vehicles/car-model.js`
(`y` : distance du centre du rétroviseur à l'axe de la voiture, appliquée symétriquement des
deux côtés) ; la vue cockpit et les vues extérieures en sont toutes tirées, rien n'est déplacé
dans le dessin du cockpit lui-même. Hauteur, dimensions et orientation sont inchangées.

Trois positions, dans la même scène (mêmes voitures aux mêmes places, mêmes caméras), sur
`work/renders/comparison/mirror-variants.jpg` (images sources dans
`work/renders/comparison/frames/mirror-{A,B,C}-*.png`) :

| Variante | Centre du rétroviseur | Déplacement à l'image (vue cockpit, 1280×720) |
|---|---|---|
| A — position précédente | 42,0 cm de l'axe | — |
| **B — légèrement rapprochés (dans le jeu)** | 39,5 cm (−2,5 cm de chaque côté) | bord extérieur du miroir 29 px plus près du centre (2,3 % de la largeur) |
| C — un peu plus rapprochés | 37,0 cm (−5 cm de chaque côté) | 59 px |

Pour B et C le point d'attache du bras a été reculé sur le tour de cockpit (30 → 25 cm de
l'axe, 1,5 cm plus bas) pour que le bras garde sa longueur et parte toujours du bord.

**B est une proposition, pas une valeur validée** : le joueur a demandé « légèrement » sans
donner de distance ; c'est la plus petite des deux corrections. La changer revient à modifier
`y` (et `arm`) dans `MIRROR_MOUNT`.

Vérifications :

- **symétrie** : entre A et B, les colonnes de l'image qui changent sont 52–263 à gauche et
  1016–1227 à droite, soit exactement le reflet l'une de l'autre (0 px d'écart) ; 1 px d'écart
  entre B et C ;
- **cohérence cockpit / extérieur** : le même déplacement se voit en vue de face et en vue de
  trois quarts arrière (696 et 194 pixels modifiés sur la voiture entre A et B). Vue
  exactement de dos, les roues arrière cachent les rétroviseurs : la planche prend donc la vue
  arrière de trois quarts (la voiture est dessinée tournée de 17° devant la caméra) ;
- **superpositions** : test `animation.test.mjs` (« mirrors… ») — le boîtier ne touche pas le
  tour de cockpit, le bras part de ce tour ; visibilité de la piste inchangée (même hauteur).

Second critique indépendant (`work/reviews/second-test-review.md`) : symétrie exacte, B est
la correction discrète, **C crée des recouvrements** (rétroviseur contre le tour de cockpit en
vue de face, liseré du bloc de moyeu en vue cockpit) et ne doit pas être retenue. Ses réserves
sur B, non traitées et laissées au jugement du joueur :

- C-2 : en vue cockpit le coin du bloc de moyeu de la roue avant ressort juste au coin coupé
  du rétroviseur, gris clair contre gris clair ; un essai à 39 cm (5 mm de plus) ne change pas
  cette rencontre de façon visible ;
- C-4 : en vue de face il reste 1 à 5 px entre le rétroviseur et le tour de cockpit (5 à 9
  en A) ;
- C-3 (la vue arrière de la planche ne montrait pas les rétroviseurs) : corrigé.

## 2 ter. Troisième essai : « toujours trop éloignés » — quatre propositions plus rapprochées

Au troisième essai le joueur a jugé les rétroviseurs (39,5 cm de l'axe) encore trop éloignés.
**La position du jeu n'a pas été changée** : quatre propositions plus rapprochées sont
préparées, et c'est au joueur de choisir sur image, puis en jeu. Aucune n'est la position par
défaut.

Elles ne reprennent pas la variante C écartée plus haut (37 cm avec la même géométrie, qui
laissait un liseré du bloc de moyeu au-dessus du rétroviseur et frôlait le flanc du cockpit).
Ce qui a été adapté, en plus de la distance à l'axe :

- **le boîtier est 1,2 cm plus haut** : vu du cockpit il recouvre alors franchement le moyeu de
  la roue avant, au lieu d'en laisser dépasser un liseré clair au-dessus de son bord ;
- **le support** : plus près que ne le permet le flanc du cockpit, le boîtier n'est plus à côté
  de la coque au bout d'un bras, mais **au-dessus de son épaulement, sur une tige** dont le pied
  est posé sur cet épaulement (4 cm au moins entre le dessous du boîtier et la coque) ;
- **le boîtier de la plus rapprochée** est plus petit (11 × 6,6 cm au lieu de 14 × 7,5 cm), pour
  rester à l'écart du volant et des mains.

| Proposition | Centre du rétroviseur | Boîtier | Déplacement à l'image (vue cockpit, 1280×720) | Remarques |
|---|---|---|---|---|
| **B — position actuelle (dans le jeu)** | 39,5 cm de l'axe | 14 × 7,5 cm, centre à 67,5 cm du sol | — | bras latéral ; le bloc de moyeu se voit à son bord intérieur |
| D | 37,0 cm (−2,5 cm de chaque côté) | 14 × 7,5 cm, à 68,7 cm | 30 px vers le centre (2,3 % de la largeur) | sur tige ; couvre le moyeu |
| E | 35,0 cm (−4,5 cm) | 14 × 7,5 cm, à 68,7 cm | 53 px (4,2 %) | sur tige ; couvre le moyeu et le départ des triangles |
| F | 33,0 cm (−6,5 cm) | 14 × 7,5 cm, à 68,7 cm | 77 px (6,0 %) | sur tige ; la position la plus rapprochée possible avec ce boîtier |
| G | 31,0 cm (−8,5 cm) | 11 × 6,6 cm, à 68,7 cm | 101 px (7,9 %) | sur tige, boîtier réduit : miroir un cinquième moins large |

**À regarder** : `work/renders/comparison/mirror-proposals.jpg` — même scène et mêmes caméras
pour les cinq montages : vue cockpit, coin inférieur gauche agrandi, le même coin volant braqué
à fond (là où le bras du pilote passe au plus près), vue de face, vue de trois quarts arrière.
La vue cockpit de chaque montage est aussi fournie en pleine taille :
`work/renders/comparison/mirror-proposal-{b,d,e,f,g}-cockpit.jpg`.

**À essayer en jeu** : chaque proposition s'ouvre avec une option de lancement, sans rien
changer au jeu normal (option de développement, comme le banc d'essai) :

```bash
chromium --enable-features=Vulkan "file://$PWD/index.html#mirrors=d"
```

(`d`, `e`, `f` ou `g` ; sans l'option, ou avec un nom inconnu, la position actuelle.)

Source géométrique commune : les cinq montages sont des entrées de `MIRROR_PRESETS` dans
`src/art/vehicles/car-model.js` ; le modèle de la voiture (vues extérieures) et le dessin du
cockpit (projection depuis l'œil du pilote) sont tous deux tirés du montage choisi. La planche
est faite en ouvrant le vrai jeu avec chaque option
(`node work/scripts/compare-mirror-proposals.mjs`).

Vérifications :

- **symétrie** : pour D, E, F et G, les colonnes de l'image qui changent par rapport à la
  position actuelle sont exactement le reflet l'une de l'autre à gauche et à droite (0 px
  d'écart) ;
- **cohérence cockpit / extérieur** : le même rapprochement se voit en vue de face et en vue de
  trois quarts arrière (repère en pointillé au bord du rétroviseur actuel) ;
- **pas de pièce dans une autre** (test « mirror proposals… ») : boîtier au-dessus de la coque,
  pied de la tige posé sur la coque, boîtier à l'intérieur de la roue avant, bord intérieur du
  boîtier à plus de 25 cm de l'axe ;
- **mains** : volant droit, il reste 93, 69, 46 et 40 px entre le miroir et le gant (ou la
  bande rouge de la carrosserie juste derrière) pour D, E, F et G, contre 123 px aujourd'hui ;
  volant braqué à fond, le bras passe en dessous du rétroviseur sans le toucher dans les
  quatre cas (troisième ligne de la planche).

Ce qu'il faut savoir avant de choisir :

- plus le rétroviseur est près de l'axe, plus il cache le moyeu et les triangles de suspension
  — et moins il cache le pneu, dont l'animation est mieux visible ;
- en vue de face, le boîtier de D affleure l'épaule du pilote ; ceux de E, F et G passent
  franchement devant (ils sont plus de 30 cm en avant des épaules : c'est une superposition
  de perspective, pas un contact) ;
- ces propositions n'ont été vues par aucun critique indépendant ni essayées au volant.

## 3. Séquences comparatives

| Fichier | Contenu |
|---|---|
| `work/renders/comparison/wheels-mirrors-before-after.mp4` | Le bas de la vue cockpit à 8, 40, 120 et 250 km/h, puis pendant une accélération de 4 à 30 km/h (1,6 s chacun, 60 images par seconde) : état précédent en haut, état actuel en bas |
| `work/renders/comparison/wheels-before-after.jpg` | La roue avant gauche, huit images consécutives par vitesse, avant et après |
| `work/renders/comparison/mirrors-before-after.jpg` | La même situation vue du cockpit, de derrière et de face, avant et après ; les autres voitures sont tenues aux mêmes places dans les deux états (une derrière à droite, une devant à gauche) |

Pour le lot « roues à très haute vitesse, rétroviseurs rapprochés » :

| Fichier | Contenu |
|---|---|
| `work/renders/comparison/wheels-high-speed-before-after.mp4` | Le bas de la vue cockpit à 40, 120, 200, 250, 300 et 322 km/h (1,6 s chacun), puis une accélération continue de 0 à 322 km/h en 8 s, à 60 images par seconde : état de la PR précédente en haut, état actuel en bas, tel qu'en jeu (vibrations du cockpit comprises) |
| `work/renders/comparison/mirror-variants.jpg` | Les trois positions des rétroviseurs (§ 2 bis) |
| `work/renders/comparison/mirror-proposals.jpg`, `mirror-proposal-*-cockpit.jpg` | La position actuelle et les quatre propositions plus rapprochées (§ 2 ter) |

Reproduire : `node work/scripts/compare-wheels-video.mjs <avant.html> index.html <sortie.mp4>`
(options `--speeds`, `--ramp de:à:secondes`, `--fps`, `--only after`, `--steady` pour couper la
vibration du cockpit, `--reuse-before`) et `node work/scripts/compare-mirror-proposals.mjs`
(la planche des trois premières positions A, B, C avait été faite par une version antérieure de
ce script).

Pour le lot précédent (il faut un build de l'état précédent, par exemple celui du commit « Lot 2 ») :
`node work/scripts/compare-wheels-mirrors.mjs <avant.html> index.html` et
`node work/scripts/compare-wheels-video.mjs <avant.html> index.html`.
