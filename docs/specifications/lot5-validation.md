# Lot 5 — corrections après validation humaine de la PR #4

Base : PR #4, commit `97252a5`. Décisions du joueur après ses essais :

| Sujet | Verdict du joueur | Ce qui est fait ici | État |
|---|---|---|---|
| Rotation des roues à vitesse maximale | validée | rien, inchangé | — |
| Sauts récupérables | à corriger | ils ne viennent plus que d'un contact roue avant contre roue arrière ; la voiture franchit celle qui l'a fait décoller | **à valider par le joueur** |
| Accident violent | (règle 2) | la voiture franchit celle qu'elle a heurtée et retombe devant, sur le côté | **à valider** |
| Rétroviseurs | à corriger | remontés de 2,5 cm (variante B) ; A et C disponibles | **à valider**, variante à choisir |
| Braquage | à diagnostiquer | diagnostic chiffré ; **aucune correction** (pas de défaut reproductible) | arbitrage à rendre |

Aucune de ces corrections n'est déclarée validée : les tests automatiques montrent que le jeu
fait ce qui est décrit, pas que cela convient.

## 1. Commandes pour les essais

Depuis le dossier du dépôt, avec le navigateur qui sert à jouer (l'adresse complète en
`file://` est nécessaire pour que l'option après `#` soit transmise). Selon l'installation,
remplacer `chromium` par `google-chrome` ou `chromium-browser`.

### Sauts, franchissement, contacts — banc d'essai

```bash
chromium --enable-features=Vulkan "file://$PWD/index.html#lab=hop"
```

Une fois le banc ouvert, les touches `1` à `6` changent de cas, `Entrée` rejoue, `C` change
de caméra. Le bandeau annonce « pilote automatique » puis « À VOUS DE CONDUIRE » : avant ce
message les touches de direction n'ont pas d'effet.

| Touche | Cas | Ce qu'il faut regarder |
|---|---|---|
| `2` | Saut récupérable, roue contre roue (215 km/h sur 150) | l'étoile est sur votre roue avant droite, contre la roue arrière gauche de l'autre ; la voiture décolle sans être ralentie, passe l'autre voiture et retombe **devant** elle (elle est dans le rétroviseur droit) vers 185 km/h ; le volant se dandine une fois ; vous conduisez |
| `3` | Accident violent E3 (262 km/h sur 188) | la voiture passe au-dessus de l'autre, retombe devant elle et sur le côté ; explosion, arrêt ; l'autre voiture longe l'épave sans la toucher ; redémarrage |
| `4` | Panneau E5 | inchangé : envol sur le panneau, retombée 35 m plus loin, glissade |
| `6` | Nez contre roue arrière (175 km/h sur 110) | plus d'écart qu'il n'en faut pour un saut, mais les carrosseries se touchent : tamponnage, la voiture reste au sol |
| `1` | Roue contre roue côte à côte (E2) | inchangé : frottement, pas de décollage |
| `5` | Tamponnages (E4) | inchangé |

Chaque cas peut aussi s'ouvrir directement :

```bash
chromium --enable-features=Vulkan "file://$PWD/index.html#lab=crash"
```

```bash
chromium --enable-features=Vulkan "file://$PWD/index.html#lab=body"
```

Pour voir le contact entre les roues : touche `C` (vue de derrière), ou les vidéos du § 2.

### Rétroviseurs — trois hauteurs

```bash
chromium --enable-features=Vulkan "file://$PWD/index.html#mirrors=a"
```

```bash
chromium --enable-features=Vulkan "file://$PWD/index.html#mirrors=b"
```

```bash
chromium --enable-features=Vulkan "file://$PWD/index.html#mirrors=c"
```

`a` : hauteur de la PR #4 ; `b` : +2,5 cm (c'est aussi le jeu sans option) ; `c` : +5 cm.
L'option se combine avec le banc : `index.html#lab=hop&mirrors=c`.

### Braquage

Rien à activer : la conduite est celle de la PR #4. Pour vérifier par vous-même ce que dit le
diagnostic, sur le banc (`#lab=bump`, la voiture vous est rendue à 60 km/h en ligne droite) :
tenir une flèche à 60 km/h, puis accélérer jusqu'à 200 km/h et la tenir de nouveau — la
voiture tourne deux fois moins vite, volant et roues dessinés pareillement en butée.

## 2. Vidéos et planches

Toutes enregistrées dans le vrai jeu par le banc d'essai (`work/scripts/collision-sequences.mjs`),
960×540. Dossier `work/renders/collisions/`.

| Demande | Fichier | Contenu |
|---|---|---|
| Contact précis entre les roues | `wheel-contact.mp4` | le saut quatre fois plus lentement, vue cockpit, à côté d'un schéma vu de dessus tracé d'après les positions de la simulation : pneus, carrosseries, écart entre carrosseries (9 cm), gomme en contact (12,5 cm), instant du décollage |
| | `HOPslow.mp4`, `HOPslowx.mp4` | le même ralenti seul, vue cockpit et vue de derrière |
| Saut récupérable franchissant une voiture | `HOP.mp4`, `HOPx.mp4` | vue cockpit et vue de derrière, 8 s, 60 images par seconde |
| Accident violent franchissant une voiture | `E3.mp4`, `E3x.mp4` | vue cockpit (9,5 s, jusqu'au redémarrage) et vue de derrière |
| Les deux côte à côte | `hop-vs-accident.mp4` | saut à gauche, accident à droite, synchronisés |
| Franchissement d'un panneau | `E5.mp4` | identique à la PR #4, image par image |
| Contact de carrosseries sans saut | `BODY.mp4` | le cas 6 |
| Contacts inchangés | `E2.mp4`, `E4.mp4` | identiques à la PR #4, image par image |
| Images clés | `stills/HOP-*.jpg`, `HOPx-*.jpg`, `E3-*.jpg`, `E3x-*.jpg` | dont `E3x-6-other-car-passes-beside-the-wreck.jpg` et `HOP-6-race-goes-on-other-car-in-the-mirror.jpg` |
| Trois hauteurs de rétroviseurs | `work/renders/comparison/mirror-heights.jpg` | A, B, C dans la même scène : cockpit, face, trois quarts arrière |

Chaque vidéo a sa télémétrie (`.json`, toutes les grandeurs de chaque image, dont la position
des deux voitures) et sa planche (`-sheet.jpg`).

## 3. Ce qui a changé, en bref

Détail dans `collisions.md` § 2 ter, `wheels-and-mirrors.md` § 2 ter, `steering-diagnosis.md`.

**Saut récupérable.** Les roues sont entrées dans le modèle de collision, aux cotes du dessin
de la voiture. Un saut part quand une roue avant de la voiture de derrière entre par l'arrière
dans une roue arrière de celle de devant, sans que les carrosseries se touchent, à 119 km/h au
moins et avec assez d'écart pour passer devant (58 km/h). Nez contre arrière, nez ou aileron
contre roue, roues qui se rejoignent par le flanc : jamais de saut.

**Franchissement.** `keepHopClear()` et `holdFlightBehind()` sont supprimées. Le vol est
libre : la voiture suit sa vitesse et perd 50 km/h par seconde, comme avant. Ce qui est choisi
au décollage est la durée du vol, allongée quand il le faut pour retomber 0,5 m devant l'autre
voiture ; si sa vitesse ne peut pas la faire passer, la voiture ne décolle pas. L'accident est
de plus jeté de 0,4 m à côté de la trajectoire de l'autre voiture. L'atterrissage attend si une
voiture est dessous. Rien n'est jamais déplacé à la main.

**Ce que cela coûte**, à savoir avant d'essayer :

- il faut maintenant **58 km/h d'écart** pour décoller (36 km/h pour le saut et 54 pour
  l'accident dans la PR #4) : avec la perte de vitesse en vol validée, aucune durée de vol ne
  fait passer une voiture plus lente que cela. Trois autres mécanismes sont chiffrés dans
  `collisions.md` ;
- le saut ne ralentit plus la voiture au choc : il coûte le temps passé en l'air (22 à
  41 km/h), et elle est devant. C'est devenu un dépassement, étroit à viser (17 cm de chaque
  côté) ;
- **dans 21 courses de 16 voitures de l'ordinateur, plus aucun saut ne se produit** (42 avec
  les règles de la PR #4) ;
- sur ce point le jeu s'écarte de la vidéo de référence, où les voitures heurtées sont devant
  après le vol.

**Rétroviseurs.** Boîtiers remontés de 2,5 cm, le bras suit ; entraxe, dimensions et symétrie
inchangés.

**Braquage.** Pas de défaut de commande, de restitution du contrôle ni de physique. Au-delà de
150 km/h la voiture ne tourne qu'à 30 à 35° par seconde parce que la butée est limitée par
l'adhérence ; huit virages sur dix du circuit du banc sont alors impossibles sans freiner. Le
dessin montre pourtant un braquage complet (11,8° dessinés pour 1,5° réels à 250 km/h).

## 4. Rapport de non-régression

Sur le build final (1 081 435 octets). « Identique » veut dire identique valeur pour valeur.

| Ce qui devait être préservé | Contrôle | Résultat |
|---|---|---|
| Accélération, freinage, adhérence, direction | `driving-report.mjs` : 165 valeurs | **identiques** à la PR #4 ; `car-spec.js` non modifié |
| Rotation des roues à vitesse maximale | tests d'animation des roues | inchangés, réussis ; le dessin et le choix des dessins de roues ne sont pas modifiés |
| Tamponnages arrière (E4) | séquence du banc, 600 images × 16 grandeurs ; 31 mesures | **identiques** |
| Roue contre roue sans saut (E2) | séquence, 192 images ; 13 mesures | **identiques** |
| Panneaux (E5) | séquence, 390 images ; 14 mesures | **identiques** : le panneau était déjà franchi (35,5 m) |
| Freinage (E1) | 2 mesures | identiques |
| Accident violent (E3) | séquence, 570 images ; 17 mesures | **changé volontairement** : identique jusqu'au décollage ; ensuite identique pour l'état, la hauteur, la mise en scène, les événements et leurs instants ; différent pour la position (retombe devant et sur le côté). 13 mesures sur 17 identiques |
| Saut récupérable | — | **changé volontairement** : autre déclenchement, autre trajectoire. Pas de non-régression à déclarer |
| Seuil de l'accident | balayage | **changé par conséquence** : 58 km/h d'écart au lieu de 54 |
| Modes de jeu | `flow-check.mjs` | 5 parcours réussis |
| Graphismes, pages, audio | `smoke.browser.mjs`, `pages-check.mjs`, `audio-check.mjs` | 13 / 13, 14 / 14, 80 / 80 |
| Déterminisme à 120 Hz | `npm test` | réussi |
| Courses complètes de l'ordinateur | 21 courses de 16 voitures, avant / après | toutes terminées ; somme des temps des vainqueurs identique (4 268,55 s) ; tamponnages 184 → 212, frottements 1 090 → 1 103 (les anciens sauts redeviennent des contacts au sol), accidents 10 → 5, remises en piste 17 → 27, voitures à l'arrivée 279 → 289 |
| Coût de la simulation | trois courses, médiane de cinq passes | 21 à 23 µs par pas avant comme après |

Suite `npm test` : 103 / 103, dont 76 tests de la PR #4 inchangés, 15 réécrits ou adaptés aux
règles demandées (devenus 14) et 13 nouveaux (`tests.md` § 1 ter).

Non couvert : aucun essai au volant ; aucun critique indépendant sur ce lot ; performances
graphiques non remesurées (aucun changement de rendu hormis la hauteur des rétroviseurs).

## 5. À valider ou à arbitrer

1. **Le saut par contact de roues** : la bande de 17 cm, le seuil de 58 km/h, la durée et la
   hauteur du vol, le coût (22 à 41 km/h).
2. **Sa fréquence en course** : nulle dans les courses de l'ordinateur. Convient-il qu'il soit
   un geste de pilotage rare, ou faut-il l'élargir (freinage en vol allégé pour le saut ;
   arrivées en biais) ?
3. **Le seuil de l'accident** passé de 54 à 58 km/h, et le vol plus long près du seuil (jusqu'à
   1,1 s et 2,2 m).
4. **L'écart latéral de l'accident** (la voiture est jetée de côté pour ne pas retomber dans la
   trajectoire de l'autre) et l'épave toujours traversable par les autres voitures.
5. **L'écart avec la vidéo de référence** sur la position après le vol.
6. **La hauteur des rétroviseurs** : A, B ou C.
7. **Le braquage** : accepter le diagnostic (comportement normal à vitesse élevée) ; puis
   choisir entre ne rien changer, corriger seulement le dessin, ou ouvrir la conduite à haute
   vitesse (`steering-diagnosis.md` § D).
