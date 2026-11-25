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

**Dernière sécurisation avant essais (§ 5)** : l'attente d'une voiture en vol au-dessus d'une
autre est maintenant bornée, sans atterrissage forcé ; une voiture retirée de la course n'est
plus un obstacle invisible. Les réglages de conduite, les 165 valeurs de référence, les
collisions sans vol et l'animation des roues ne sont pas touchés ; la bande de 17 cm, le seuil
de 58 km/h et l'écart latéral de l'accident non plus.

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
| `6` | Nez contre roue arrière (165 km/h sur 100) | plus d'écart qu'il n'en faut pour un saut, mais les carrosseries se touchent : tamponnage, la voiture reste au sol |
| `7` | **Cas extrême** : le saut du cas 2, avec une troisième voiture qui fait ce qu'elle peut pour rester sous la vôtre | une voiture bleue roule à côté de vous ; au décollage elle se rabat sous votre voiture et freine avec elle. L'atterrissage attend un peu plus d'une demi-seconde, votre voiture ralentit davantage qu'elle (215 → 93 km/h) et se pose derrière elle, sur une place libre. En vue de derrière (`C`) on voit la voiture dessous |
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
de plus jeté de 0,4 m à côté de la trajectoire de l'autre voiture. Le lieu d'atterrissage est
choisi libre de toute voiture du peloton (sinon la voiture ne décolle pas) ; si une voiture
vient quand même dessous pendant le vol, l'atterrissage attend. Rien n'est jamais déplacé à la
main.

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

Sur le build final (1 085 255 octets). « Identique » veut dire identique valeur pour valeur.

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
| Courses complètes de l'ordinateur | 21 courses de 16 voitures, avant / après | toutes terminées ; somme des temps des vainqueurs identique (4 268,55 s) ; tamponnages 184 → 219, frottements 1 090 → 1 110 (les anciens sauts redeviennent des contacts au sol), accidents 10 → 5, remises en piste 17 → 25, voitures à l'arrivée 279 → 293 |
| Coût de la simulation | trois courses, médiane de cinq passes | 21 à 23 µs par pas avant comme après |

Suite `npm test` : 109 / 109, dont 76 tests de la PR #4 inchangés, 15 réécrits ou adaptés aux
règles demandées (devenus 14) et 19 nouveaux, dont 6 écrits pour les défauts trouvés par la
relecture indépendante du code (`tests.md` § 1 ter).

### Relecture indépendante du code

Après la première livraison de cette branche, le code des collisions a été relu par un
relecteur indépendant. Il a confirmé que tout contact sans vol est identique à la PR #4
(17 640 arrivées comparées pas à pas) et a reproduit **sept défauts**, dont un grave : dans un
peloton, un saut pouvait finir par se poser dans une troisième voiture. Les sept sont corrigés,
six tests ont été ajoutés (chacun échoue sur le code d'avant correction), et les mesures, les
courses et les dix séquences du banc ont été refaites ensuite : la télémétrie des séquences est
identique octet pour octet à celle de la première livraison, sauf pour le cas 6, dont les
vitesses ont changé (seule vidéo remplacée). Liste et corrections : `collisions.md` § 2 ter,
« Relecture indépendante du code, et suites ».

Relevé à cette occasion et **non corrigé** (antérieur à ce lot, hors de son objet) : une
voiture de l'ordinateur retirée de la course après un abandon reste un obstacle solide alors
qu'elle n'est plus dessinée.

Non couvert : aucun essai au volant ; aucun critique indépendant de l'image sur ce lot (la
relecture a porté sur le code) ; performances graphiques non remesurées (aucun changement de
rendu hormis la hauteur des rétroviseurs).

## 5. Sécurisation de la PR #8 : l'attente en vol est bornée

Détail, raisonnement et mesures : `collisions.md` § 2 quater.

**Le défaut.** Quand une voiture occupait la place d'atterrissage, la voiture en vol attendait
tant qu'elle y était ; une voiture qui freinait au même rythme qu'elle la gardait en l'air
jusqu'à l'arrêt des deux (4 à 5 s), après quoi elle était posée, dans l'autre si elle était
encore là.

**La correction.** Tant qu'une voiture est dessous, la voiture en vol **se dégage** : sa
vitesse est tenue à au moins 29 km/h de celle de toute voiture qui est dessous — elle la
dépasse, ou la laisse partir ; une fois qu'elle en a laissé partir une, elle laisse partir
toutes les autres jusqu'à la fin du vol (sauf si elle les a toutes passées en moins de 0,4 s
en continuant simplement son vol). Une voiture seule est ainsi quittée en une à trois secondes
(3,2 s au pire dans des recherches faites pour cela, touche de remise en piste comprise : la
limite de 3,5 s n'a pas été atteinte par une voiture seule, avec 0,3 s de marge). Rien n'est déplacé à la main, les autres voitures ne sont pas touchées, un vol sans
conflit est inchangé. Un vol ne dure jamais plus de 3,5 s au-delà de sa durée prévue. Sa
vitesse change progressivement (4 km/h par pas au plus) ; si elle reculait en se posant, elle
est posée à l'arrêt.

**L'exception, à arbitrer.** Si des voitures se relaient sous elle pendant ces 3,5 s, la
voiture est **remise en piste sur une place libre**, comme une voiture sortie de la route :
c'est une téléportation, la seule, assumée parce que les deux autres issues étaient exclues
(rester en l'air sans limite ; être posée dans une voiture). Il faut plusieurs voitures pour
la produire ; les alternatives et leurs conséquences sont dans `collisions.md`.

**Aussi corrigé** : la place d'atterrissage était regardée une fraction de pas trop tôt
(jusqu'à un demi-mètre d'erreur) ; deux voitures jetées en l'air presque en même temps
pouvaient être envoyées au même endroit.

**À part** (commit distinct, `collisions.md` § 2 quater n'en dépend pas) : une voiture de
l'ordinateur retirée de la course après un abandon n'est plus un obstacle. Une voiture
abandonnée encore sur la piste reste un obstacle ; une voiture de joueur abandonnée n'est
jamais retirée ; une épave après un accident est traitée comme avant.

| Contrôle | Avant (`dc8b823`) | Maintenant |
|---|---|---|
| Les scénarios demandés (`tests/gameplay/flight-wait.test.mjs`, 17 tests) : troisième voiture qui s'arrête dessous, voiture qui arrive pendant le vol, peloton sur toutes les places, voiture franchie qui accélère, barrière, deux décollages presque simultanés | tous échouent : vols de 4,3 à 5,3 s, voiture posée jusqu'à 1,6 m dans une autre | tous réussis : attente de 0,5 à 1,6 s, jamais dans une voiture |
| 1 000 pelotons hostiles (`flight-wait-stress.mjs`) : voitures posées dans une autre | 34 | 0 |
| — vol le plus long ; dernier recours | 6,0 s ; — | 4,35 s ; 1 fois sur 1 573 vols |
| 54 courses à 20 voitures (`dense-pack-races.mjs`) : attente la plus longue ; dernier recours | 1,6 s ; — | 1,1 s ; 0 |
| Une voiture seule cherchant à rester dessous (1 458 vols au hasard ; 20 000 et 30 000 essais de l'adversaire du premier relecteur, sans et avec la touche de remise en piste ; 28 200 essais de la recherche du second) | — | 1,6 s ; 2,2 s ; 2,8 s ; 3,2 s au plus ; jamais de dernier recours, mais 0,3 s de marge seulement |
| Contacts validés E1, E2, E4, E5 ; 165 valeurs de conduite ; 19 des 21 courses à 16 voitures | — | identiques (les deux autres courses sont celles où un atterrissage attend) |

Vidéos du cas extrême (une troisième voiture reste sous la voiture en vol), dans
`work/renders/collisions/` : `HOLDx.mp4` (vue de derrière, la plus lisible), `HOLD.mp4`
(cockpit), `HOLDslowx.mp4` (quatre fois plus lentement).

**Relecture indépendante.** Quatre passes, par deux relecteurs, chacune sur le code et les
exigences, sans mes conclusions ; détail dans `collisions.md` § 2 quater, « Seconde relecture indépendante, et
suites ».

- *Première passe* (deux premiers commits). Confirmé : contacts au sol, conduite et vols sans
  conflit identiques à `dc8b823` (18 000 scénarios et 98 courses comparés pas à pas) ; correctif
  de la voiture retirée. Trouvé : un défaut grave (deux vols en attente l'un sur l'autre, dont
  les vitesses s'emballaient — corrigé entre-temps), deux moyens (voiture posée en marche
  arrière ; distance parcourue non reculée au dernier recours), un point de jugement (la
  vitesse pendant l'attente changeait par à-coups de plusieurs dizaines de km/h) et des points
  mineurs. Tous traités.
- *Seconde passe* (sur ces suites). Confirmé : le défaut grave est clos, l'identité hors
  conflit tient toujours. Trouvé : trois défauts moyens — l'attente recommençait jusqu'à 36
  fois derrière une voiture qui freine devant le lieu d'atterrissage ; une file dans la voie
  des stands annulait un décollage le long du muret ; une voiture seule atteignait le dernier
  recours avec la touche de remise en piste (52 fois sur 30 000) — et des points mineurs. Tous
  traités, chacun avec un test qui échoue sur le commit relu ; une réserve de 2 cm est
  documentée et non corrigée (`collisions.md`, « Ce qui reste »).
- *Troisième passe* (autre relecteur, sur les corrections de la seconde). Confirmé : identité
  hors conflit, durée bornée, déterminisme. Trouvé : **un défaut grave, régression de ma
  correction du muret** — une voiture qui décolle dans l'entrée des stands et retombe dans la
  voie des stands était posée dans la file qui s'y trouve (36 fois sur 36) — et deux moyens :
  une voiture seule tenait un vol 3,54 s pour une limite de 3,5 s ; davantage de vols arrêtés
  en l'air puis en recul. Corrigés, deux tests qui échouent sur le commit relu.
- *Quatrième passe* (sur les corrections de la troisième). Confirmé : pelotons hostiles,
  identité hors conflit, déterminisme. Trouvé : dans une voie des stands pleine de voitures
  sur quatre files (100 voitures : aucune course n'en a autant), le dernier recours remettait
  la voiture du mauvais côté du muret, qui la renvoyait dans une voiture — corrigé, testé ;
  face à deux voitures adverses, un recul inutile au-dessus d'une voiture arrêtée — corrigé ;
  et une limite étroite laissée en l'état et signalée (un décollage annulé dans les 60 m avant
  le muret si une voiture des stands longe le muret à quelques centimètres).
- **Les corrections de la quatrième passe n'ont pas été relues** par un relecteur indépendant :
  vérifiées avec ses scripts de reproduction et toutes les mesures, refaites sur le commit
  final.

## 6. À valider ou à arbitrer

1. **Le saut par contact de roues** : la bande de 17 cm, le seuil de 58 km/h, la durée et la
   hauteur du vol, le coût (22 à 41 km/h).
2. **Sa fréquence en course** : nulle dans 21 courses à 16 voitures, 6 sauts dans 54 courses à
   20 voitures. Convient-il qu'il soit un geste de pilotage rare, ou faut-il l'élargir
   (freinage en vol allégé pour le saut ; arrivées en biais) ?
3. **Le seuil de l'accident** passé de 54 à 58 km/h, et le vol plus long près du seuil (jusqu'à
   1,1 s et 2,2 m).
4. **L'écart latéral de l'accident** (la voiture est jetée de côté pour ne pas retomber dans la
   trajectoire de l'autre) et l'épave toujours traversable par les autres voitures.
5. **L'écart avec la vidéo de référence** sur la position après le vol.
6. **La hauteur des rétroviseurs** : A, B ou C.
7. **Le braquage** : accepter le diagnostic (comportement normal à vitesse élevée) ; puis
   choisir entre ne rien changer, corriger seulement le dessin, ou ouvrir la conduite à haute
   vitesse (`steering-diagnosis.md` § D). Rien n'est modifié à ce stade : ni la physique de la
   direction, ni le nombre de positions dessinées ; l'écart entre l'angle réel et l'angle
   affiché reste documenté.
8. **Les vols qui ne retombent pas devant la voiture heurtée** : ce n'est pas conforme à la
   règle générale, et c'est fréquent en peloton (20 vols sur 34 dans 54 courses à 20 voitures,
   2 sur 5 dans 21 courses à 16 voitures : en courbe, ou quand la voiture heurtée accélère). À arbitrer :
   accepter l'exception, ou resserrer les conditions du décollage (`collisions.md` § 2 quater).
9. **Le dernier recours de l'attente en vol** (remise en piste après 3,5 s) : seule
   téléportation du jeu en vol. À accepter, ou à remplacer par l'une des autres issues
   décrites, chacune avec son coût. Deux voitures suffisent à le provoquer ; une voiture seule
   ne l'a pas atteint dans les recherches faites pour cela, mais avec 0,3 s de marge seulement
   (3,2 s pour 3,5 s). Élargir la marge demande de toucher à un réglage visible (écart de
   vitesse de 29 à 36 km/h, ou limite à 4 s).
10. **Le comportement pendant l'attente** : la voiture en vol ralentit ou garde son élan
    vivement (29 km/h en 0,07 s), peut reculer au-dessus d'une voiture presque arrêtée (elle
    est alors posée à l'arrêt), et reste dessinée au-dessus d'une autre pendant une à trois
    secondes. À juger à l'écran (cas `7` du banc).
11. **La marge latérale à l'atterrissage** : aucune aujourd'hui, pour qu'un saut puisse retomber
    tout contre la voiture qu'il a touchée. Prix mesuré par la relecture : 2 atterrissages sur
    72 050, en peloton hostile, posés 0,1 et 2,3 cm dans une voiture voisine. À accepter, ou à
    échanger contre des attentes plus fréquentes en peloton.
