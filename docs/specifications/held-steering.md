# Braquage prolongé — analyse de la vidéo, instrumentation, prototype expérimental

Suite de `steering-study.md` (diagnostic du jeu, sans modification). Le joueur a signalé qu'en
maintenant longtemps une touche de direction le volant « devrait pouvoir tourner davantage »,
ce mouvement supplémentaire pouvant donner un virage plus prononcé et éventuellement un
dérapage.

**État : rien n'est adopté.** La conduite par défaut est strictement celle de la PR #4
(165 valeurs du rapport de conduite identiques, scénarios E2 à E5 identiques, § 8). Tout ce
qui change la conduite est une **variante expérimentale**, absente tant qu'une option de
lancement ne la demande pas. Le choix revient au joueur (§ 9).

| Étape | Livré | Où |
|---|---|---|
| A | Analyse du volant et des mains sur la vidéo, vidéo comparative | § 1, § 2 |
| B | Instrumentation du braquage maintenu, à plusieurs vitesses et courbures | § 3 |
| C | Représentation graphique : diagnostic et propositions | § 4 |
| D | Prototype en deux phases, trois variantes paramétrables | § 5 |
| E | Banc de direction A/B, vidéos, télémétrie, différences attendues | § 6 |
| F | Sauts récupérables et rétroviseurs : déjà livrés dans la PR #5 | § 7 |

## 1. Source, et ce qui n'a pas été reçu

Le lot annonce une vidéo de **13 min 38 s de la version multijoueur (1993)**, une **planche de
six images** et un **extrait** préparés à partir de cet enregistrement. **Aucun de ces trois
fichiers n'est parvenu dans la session** (ni dans les envois, ni dans le dépôt).

L'analyse a donc été faite sur le seul enregistrement disponible : celui de 1991 déjà utilisé
pour les collisions (576×360, 25 images/s, 5 min 36 s, SHA-256 `3c902ecf…`, décrit dans
`work/reference-frames/README.md`). Par coïncidence, son passage de **1:47 à 1:56** contient
exactement ce que décrit le lot — deux virages prolongés, à droite puis à gauche, pendant
lesquels les mains changent de position — et l'intervalle prioritaire **1:51 à 1:56** y tombe
sur le troisième cran à droite, le changement de côté et le troisième cran à gauche.

À confirmer par le joueur : si la vidéo de 1993 montre autre chose (autres dessins, autres
délais), les relevés du § 2 sont à refaire dessus ; la méthode est dans le dépôt
(`work/reference-frames/S-steering-hold_1m47s-1m56s/method/`).

## 2. Étape A — ce que montre la vidéo

### 2.1 Méthode

La zone du volant, des mains et des avant-bras (190×76 points) est extraite de **chacune des
8409 images**. Seuls les points du dessin du poste de pilotage sont comparés (ceux qui ne
changent jamais quand le volant est droit ; l'afficheur de vitesse est exclu), ce qui écarte
la route. Les images se regroupent alors d'elles-mêmes en **sept dessins**, sans seuil choisi
à la main sur les positions. Résultat image par image : `timeline.json` du même dossier.

### 2.2 Ce qui est directement visible

**Sept dessins du volant et des mains** : le centre et trois crans de chaque côté — léger,
marqué, bras croisé par-dessus le volant (`hand-positions.jpg`). Il n'y a pas de rotation
continue : l'image saute d'un dessin au suivant.

**Les crans se suivent dans l'ordre.** On ne passe jamais du centre au cran 2 ou 3 sans
passer par le précédent, à la montée comme au retour.

**Fréquence** : sur 145 mouvements de direction relevés, 81 s'arrêtent au cran 1, 46 au
cran 2 et **18 seulement atteignent le cran 3**.

**Délais** (25 images/s, donc à 0,04 s près ; le jeu filmé ne produit qu'environ 18 images
distinctes par seconde) :

| Relevé | Valeur |
|---|---|
| Du premier mouvement au cran 2 | 0,20 s en général |
| Du premier mouvement au cran 3 | 0,48 s au plus tôt, **1,0 s en médiane** |
| Temps passé au cran 2 juste avant le cran 3 | 0,32 s au moins, 0,68 s en médiane |
| Durée du cran 3 | 0,16 à 3,08 s, 1,4 s en médiane |
| Retour du cran 3 au centre | par les crans 2 puis 1, en 0,1 à 0,5 s |
| Cran 2 tenu **sans** jamais atteindre le cran 3 | jusqu'à 3,36 s |

**Le passage étudié** (`passage-strip.jpg`, une image toutes les 0,16 s ; `passage-views.jpg`,
six vues entières). Temps de la vidéo, D = droite, G = gauche :

| De | Durée | Position | |
|---|---|---|---|
| 1:47,76 | 0,20 s | D1 | début du virage à droite |
| 1:47,96 | 2,16 s | D2 | |
| 1:50,12 | 0,36 s | D1 | |
| 1:50,48 | 0,24 s | D2 | |
| 1:50,72 | 0,20 s | D1 | |
| 1:50,92 | 0,68 s | D2 | |
| 1:51,60 | 0,96 s | **D3** | bras croisé (avec un retour d'une image ou deux à D2) |
| 1:52,56 | 0,48 s | D2, D1, centre | retour |
| 1:53,04 | 0,16 s | G1 | début du virage à gauche |
| 1:53,20 | 0,44 s | G2 | |
| 1:53,64 | 1,60 s | **G3** | bras croisé |
| 1:55,24 | 0,64 s | G2, G1 | retour |
| 1:55,92 | 0,20 s | D1 | petite correction |

**Vitesse** (`speed-readout.png` : l'afficheur du volant agrandi, lu à l'œil ; le dernier
chiffre est souvent incertain ; le bras le cache pendant les crans 3) :

| Moment | Position des mains | Vitesse lue |
|---|---|---|
| 1:47,2 à 1:48,2 | centre, D1, début de D2 | 316 à 319 km/h |
| 1:48,3 à 1:49,4 | D2 | **317 → 260 km/h** en 1,1 s |
| 1:49,4 à 1:50,0 | D2 | 260 km/h, stable |
| 1:50,1 à 1:50,9 | D1, D2, D1 | 271 → 277 km/h |
| 1:51,0 à 1:51,6 | D2 | 274 → 264 km/h |
| 1:51,6 à 1:52,6 | **D3** | caché ; **264 km/h avant, 264 km/h après** |
| 1:52,8 à 1:53,6 | D2, D1, centre, G1, G2 | **262 → 215 km/h** en 0,7 s |
| 1:53,6 à 1:55,2 | **G3** | caché ; **215 km/h avant, 215 km/h après** |
| 1:55,5 à 1:56,6 | G2, G1, centre | 216 → 244 km/h |

Deux constats. **Pendant les deux crans 3, la vitesse lue avant et après est la même** : la
position extrême ne s'accompagne d'aucune perte de vitesse visible. **Les grandes pertes de
vitesse ont lieu avant**, pendant le cran 2 du début de chaque virage (57 km/h, puis 47 km/h).

**Roues avant** : dans cette vue, elles ne sont pas dessinées braquées ; tout le braquage est
montré par le volant et les mains.

### 2.3 Ce qui demande une hypothèse

- **Les commandes ne sont pas visibles** (ni le périphérique, ni les appuis). On ne peut donc
  pas affirmer qu'« une touche tenue assez longtemps fait passer au cran 3 ». Deux faits vont
  même dans des sens différents : le cran 3 n'apparaît jamais avant 0,48 s de mouvement (ce qui
  ressemble à un délai de maintien), mais le cran 2 peut durer 3,36 s sans cran 3 (ce qui
  suppose alors une commande dosée, relâchée ou réappuyée par à-coups). **Hypothèse retenue
  pour la comparaison** : une touche est enfoncée tant que les mains sont au cran 2 ou au-delà
  sans revenir ; elle est relâchée quand elles reviennent.
- **Freinage ou coût du braquage ?** Les deux ralentissements (317 → 260, 262 → 215 km/h)
  peuvent être un freinage à l'entrée du virage — c'est l'hypothèse retenue pour la
  comparaison, les pédales suivant la vitesse lue. Mais deux fois la vitesse lue **remonte
  d'environ 10 km/h en trois images** au moment précis où le braquage diminue (1:50,00 →
  1:50,12, de D2 à D1 ; 1:56,12 → 1:56,24, de D1 au centre), plus vite qu'un moteur ne peut
  accélérer. Il est donc possible que, dans le jeu filmé, braquer coûte directement de la
  vitesse, rendue dès qu'on redresse. La vidéo ne permet pas de trancher.
- **Le lien entre les dessins et la trajectoire n'est pas mesurable.** L'estimation
  automatique du lacet d'après le décor a échoué (trop peu de repères) ; on voit seulement que
  la route tourne du côté des mains et que le cran 3 correspond aux portions les plus
  serrées. On ne sait pas si le cran 3 fait tourner plus que le cran 2, ni s'il s'accompagne
  d'une glissade. **La vidéo n'établit donc pas l'existence d'un dérapage** ; elle établit un
  troisième dessin, qui n'arrive qu'après un certain temps.

### 2.4 Comparaison avec Virage GP (conduite validée)

| | Vidéo de référence | Virage GP, conduite validée |
|---|---|---|
| Volant et mains | 3 dessins par côté, par sauts | rotation continue, jusqu'à 54° |
| Premier mouvement visible | cran 1 dès la première image | continu dès l'appui |
| Position extrême | cran 3 : 0,48 s au plus tôt, 1,0 s en médiane, et pas toujours | butée en **0,225 s**, toujours |
| Touche tenue au-delà | le cran 3 peut encore arriver | **plus rien ne change** |
| Retour | par les crans 2 et 1, 0,1 à 0,5 s | continu, 0,133 s |
| Roues avant | non braquées à l'image | 5 dessins (2 crans par côté), le dernier dès 0,14 à 0,21 s |
| Vitesse pendant la position extrême | aucune perte visible | −1,5 m/s² (frottement à 1,22 fois l'adhérence) |
| Vitesse au début du virage | forte perte au cran 2 (317 → 260 km/h en 1,1 s) : freinage, ou coût du braquage | celle que le pilote choisit ; le braquage seul coûte 1,5 m/s² |

La différence que le joueur a perçue est réelle et tient au **temps** : dans la référence
la position extrême est rare et tardive ; dans Virage GP elle est atteinte à chaque appui, en
un quart de seconde, et le maintien n'ajoute rien — ni à l'image, ni à la conduite.

### 2.5 Vidéo comparative

`work/renders/steering/reference-vs-a.mp4` : à gauche le passage de la vidéo (vue 3D seule),
avec la position des mains relevée image par image, la vitesse lue et l'appui supposé ; à
droite Virage GP (conduite validée), **mêmes appuis supposés aux mêmes instants, même vitesse**
(entrée à 318 km/h ; l'accélérateur et le frein suivent la vitesse lue sur la vidéo).

Pour que les virages soient aussi proches que possible, la route de droite est une piste de
développement **ajustée sur ce passage** (`banc-reference`) : comme la vidéo ne donne ni les
commandes ni le tracé, ses deux virages sont le chemin que suit la voiture validée avec ces
appuis et cette vitesse (un virage à droite de 128°, puis un virage à gauche de 67°) ; elle y
reste à moins de 3 m de l'axe (`node work/scripts/reference-passage-track.mjs`). La
ressemblance des deux routes est donc **une construction**, pas une mesure : ce que la vidéo
permet de comparer, ce sont les positions du volant et des mains dans le temps, et la vitesse.

`compare-passage.mp4` montre les quatre conduites (A, B1, B2, B3) sur ce même passage, avec
les mêmes appuis. **Cette comparaison-là favorise A par construction** : la route a été
ajustée sur le chemin de A. Elle montre de combien les variantes s'écartent de la conduite
validée à commandes égales, pas laquelle ressemble le plus à la vidéo.

## 3. Étape B — instrumentation du braquage maintenu

`node work/scripts/held-steering.mjs` → `work/benchmarks/held-steering.json`. Simulation
seule, 120 pas par seconde, donc reproductible au bit près. La manœuvre est la même pour
toutes les conduites : la voiture arrive en ligne droite à vitesse tenue, puis **la demande
passe à fond d'un côté et y reste** (ce que donne une touche), gaz figés là où ils tenaient la
vitesse.

- **Asphalte libre** (copie d'un circuit élargie à 900 m) : 100, 150, 200 et 250 km/h, 4 s.
- **Six virages du banc de direction**, rayons de 72 à 259 m : entrée à 85 %, 100 % et 115 %
  de la vitesse que l'adhérence permet dans le virage (300 km/h au plus), 3 s à partir de
  l'entrée. La mesure se fait sur une copie du banc élargie à 90 m, pour ne mesurer que la
  direction ; l'instant où la voiture aurait quitté la route de 14 m est noté.

Relevés, 60 fois par seconde : durée de maintien, demande, position de la direction,
progression de la phase 2, braquage appliqué (en multiple de la butée validée), angle des
roues, vitesse de lacet, vitesse, accélération latérale, **adhérence disponible, adhérence
demandée**, glissement des pneus, angle de glissade, position latérale, état ; et l'instant de
chaque premier événement (butée, crissement, traces, fumée, tête-à-queue, sortie de route).

### 3.1 Conduite validée : quand la butée est atteinte, et ce qui suit

Asphalte libre, profil arcade :

| Vitesse | Butée | Lacet établi | Lacet | Adhérence demandée | Glissement | Glissade | Crissement | Traces, fumée | Vitesse après 4 s |
|---|---|---|---|---|---|---|---|---|---|
| 100 km/h | 0,225 s | 0,30 s | 43°/s | 1,22 | 0,24 | 0,4° | 0,43 s | jamais | 113 km/h |
| 150 km/h | 0,225 s | 0,30 s | 35°/s | 1,22 | 0,25 | 0,3° | 0,43 s | jamais | 144 km/h |
| 200 km/h | 0,225 s | 0,31 s | 31°/s | 1,22 | 0,25 | 0,3° | 0,42 s | jamais | 156 km/h |
| 250 km/h | 0,225 s | 0,30 s | 30°/s | 1,22 | 0,26 | 0,3° | 0,40 s | jamais | 239 km/h |

**La butée est atteinte 0,225 s après l'appui, à toute vitesse ; le lacet est établi à 0,30 s.**
Ensuite la voiture décrit un cercle à la limite d'adhérence : elle demande 1,22 fois
l'adhérence, en obtient 1,03, et le reste ne fait que la freiner un peu et faire crisser les
pneus. Rien ne se construit avec le temps.

Dans les virages du banc, la même butée donne trois résultats selon la vitesse d'entrée :

| Entrée | Ce que fait la voiture, touche tenue 3 s |
|---|---|
| 85 % de la vitesse limite | tourne plus que le virage : sort **à l'intérieur** après 1,8 à 2,6 s (il faut relâcher par moments) |
| 100 % | suit le virage, à la limite, dans les virages 1, 4 et 5 (virage 4 : reste sur la route pendant les 3 s) ; sort à l'extérieur à 1,7 s dans le virage 2 |
| 115 % | ne tourne pas assez : sort **à l'extérieur** après 1,0 à 1,4 s, quoi qu'on fasse du volant |

Au-delà de 50 km/h environ, la butée validée **est** la limite d'adhérence, à 22 % près. Il
n'existe donc aucune réserve de braquage : un cran de plus ne peut que **(a)** être pris sur
ce qui est donné aujourd'hui au premier appui, ou **(b)** dépasser l'adhérence, et alors il
freine ou fait glisser. C'est ce qui sépare les variantes du § 5.

(Profils compétition et turbo : l'aide au braquage n'y est que partielle, et le plein braquage
de la conduite validée y demande déjà 3,8 et 2,3 fois l'adhérence à 200 km/h — crissement,
traces et fumée dès 0,2 s. Le surbraquage y existe donc déjà ; les tableaux de ce document
sont ceux du profil arcade, celui du banc.)

## 4. Étape C — représentation graphique

### 4.1 Diagnostic

Des trois explications envisagées dans `steering-study.md` :

- **Manque de positions** : oui pour le volant vu comme une suite de crans (la référence en a
  trois par côté), mais Virage GP ne dessine pas par crans : son volant tourne de façon
  continue. Pour les roues avant, il y a deux crans par côté, et la référence n'en montre
  aucun. Ce n'est pas la cause principale.
- **Manque de progression dans le temps** : **oui, c'est le constat principal.** Tout est
  joué en 0,225 s ; après, l'image est figée tant que la touche est tenue.
- **Phase de surbraquage ayant des effets sur la conduite** : absente du jeu. La vidéo ne
  permet ni de l'établir ni de l'écarter (§ 2.3).

### 4.2 Règle suivie

**L'image ne montre jamais plus de braquage que la simulation n'en applique.** Ajouter à la
conduite validée un volant qui continuerait de tourner pendant que la voiture ne tourne pas
davantage ferait croire à une réaction qui n'existe pas : cela n'a pas été fait, et la
conduite validée garde exactement son affichage. La progression visuelle n'existe que dans
les variantes, où elle est celle de la simulation :

- **Volant** : jusqu'à la butée validée, la rotation est celle d'aujourd'hui (54°). En
  phase 2 il continue de tourner de façon continue, à raison de 45 % du braquage ajouté :
  environ 70° pour B2, 80° pour B3 (`heldSteeringWheelTurn`). Les mains suivent le volant et
  ne dépassent jamais la verticale.
- **Roues avant** : les cinq dessins validés sont conservés, répartis sur toute la course de
  la variante ; le dernier cran n'est montré qu'au plein braquage de la phase 2
  (`heldSteeringSpan`).
- **À basse vitesse**, où la butée est mécanique et où aucune variante n'ajoute de braquage,
  rien de plus n'est montré (test « the cockpit shows the lock that is simulated, never more »).

La planche `work/renders/steering/steering-phases.jpg` montre le poste de pilotage à la butée
de la phase 1 et au plein braquage de la phase 2, pour chaque conduite.

### 4.3 Positions supplémentaires des roues : étude, non réalisée

Passer de cinq à sept dessins par roue (trois crans par côté, comme les mains de la
référence) donnerait un cran propre à la phase 2. Coût : deux angles de plus pour chacune des
variantes de roulement, soit deux à quatre couches d'atlas, et les seuils de `steerFrame` à
redéfinir. Cela **touche l'animation des roues, validée définitivement pour ce lot** : la
modification n'a donc pas été faite. Elle n'a de sens que si une variante est retenue, et
serait alors à valider à part.

## 5. Étape D — prototype expérimental en deux phases

`src/vehicles/steering-variants.js` (réglages), `src/physics/car-physics.js`
(`heldSteeringLock`, `heldSteeringDrift`). Le code expérimental n'est exécuté que si la
voiture porte une variante ; sinon la ligne validée est exécutée telle quelle.

### 5.1 Mécanisme

1. **Phase 1** : la direction va à sa butée comme aujourd'hui (0,225 s). À vitesse élevée,
   la butée est l'angle où les roues demandent `phase1Allowance` fois l'adhérence.
2. **Phase 2** : tant que la demande reste en bout de course (`holdThreshold`) et que la
   direction a rejoint la position demandée, après `phase2Delay` secondes les roues braquent
   davantage, jusqu'à `phase2Allowance` fois l'adhérence, à `phase2Rate` par seconde.
   Relâchée, la phase 2 est rendue à `phase2Return` par seconde.

Prise en compte demandée :

- **Vitesse et adhérence disponible** : par construction. Le braquage ajouté est une part de
  l'angle que l'adhérence autorise à cette vitesse ; il s'annule à basse vitesse (butée
  mécanique) et diminue sur surface glissante, pneus usés ou voiture abîmée.
- **Courbure** : avec `curvatureGain`, la phase 2 monte plus vite dans un virage qui demande
  plus que la voiture ne peut donner (v² × courbure / adhérence).
- **Effets** : le mécanisme de glissement existant, inchangé (lacet plafonné par l'adhérence,
  l'excès freine la voiture et fait crisser, marquer puis fumer les pneus) ; avec `driftGain`,
  une **glissade de l'arrière** : la voiture pivote plus vite que sa trajectoire, le nez vers
  l'intérieur, et la glissade est reprise plus lentement (`driftRecovery`). Avec `spinAngle`,
  une glissade au-delà de cet angle finit en tête-à-queue.

Douze réglages, tous dans `STEERING_VARIANTS`, bornés par `STEERING_PARAMETER_RANGES`, et
modifiables sans toucher au code (§ 6.1).

### 5.2 Trois variantes

| | A (validée) | B1 | B2 | B3 |
|---|---|---|---|---|
| Idée | — | deux temps, **jamais plus qu'aujourd'hui** | **surbraquage** : les pneus frottent | surbraquage **et glissade** |
| Phase 1 (× adhérence) | 1,22 | 0,85 | 1,22 | 1,22 |
| Phase 2 (× adhérence) | — | 1,22 | 2,0 | 2,5 |
| Début, fin de la phase 2 | — | 0,37 s, 1,17 s | 0,52 s, 1,52 s | 0,52 s, 1,76 s (plus tôt en virage) |
| Glissade de l'arrière | non | non | non | oui |
| Tête-à-queue | non | non | non | au-delà de 17° de glissade |

D'où viennent ces valeurs (aucune n'est imposée ; toutes sont des points de départ) :

- **Délais** : calés sur la vidéo. Le cran 3 y apparaît 0,48 s au plus tôt et 1,0 s en
  médiane après le premier mouvement : la phase 2 de B2 commence à 0,52 s et s'achève à
  1,52 s. B1 commence plus tôt (0,37 s), parce que sa phase 1 donne moins qu'aujourd'hui et
  qu'un virage pris à la limite a besoin du reste.
- **B1, 0,85** : la part de l'adhérence à laquelle les pneus ne crissent pas du tout ; le
  plein braquage d'aujourd'hui (1,22) n'arrive qu'en phase 2.
- **B2, 2,0** : un glissement d'environ 1, qui fait franchir dans l'ordre les trois seuils
  déjà mis en scène par le jeu (crissement 0,22, traces 0,55, fumée 0,85).
- **B3, 2,5** : un glissement de 1,5, valeur à laquelle le freinage par glissement existant
  est plafonné — braquer davantage ne changerait plus rien. Angle de tête-à-queue : 0,3 rad.

### 5.3 Propriétés vérifiées

- **Déterministe, indépendant de la cadence d'affichage** : tout est calculé dans le pas fixe
  de la simulation (120 par seconde), sans tirage au sort ; la même manœuvre donne le même
  résultat au bit près (test).
- **Périphériques** : la phase 2 ne regarde que la demande finale, quel que soit le
  périphérique. Clavier et croix directionnelle : demande à fond, donc phase 2 au maintien.
  Manette et souris : il faut pousser en bout de course (95 %) ; en deçà, B2 et B3 sont
  exactement la conduite validée (test), B1 reste en phase 1.
- **Réservé aux voitures conduites par un joueur** : les voitures de l'ordinateur, et celle
  d'un joueur confiée à l'ordinateur, gardent la conduite validée.
- **Rien à basse vitesse** : à 40 km/h les trois variantes sont la conduite validée au bit près.
- **B2 et B3 sont la conduite validée jusqu'au début de la phase 2** (au bit près, test) : un
  appui bref ne change rien.

## 6. Étape E — comparaison A/B

### 6.1 Banc de direction

| Lancement | Effet |
|---|---|
| `index.html#steerlab=a` (ou `b1`, `b2`, `b3`) | banc de direction, avec la conduite demandée |
| `index.html#steering=b2` | la variante dans le jeu normal (menus, tous les circuits), pour les voitures des joueurs |
| `…&phase2Delay=0.5&phase2Allowance=1.8` | un réglage modifié à la main (les douze noms du § 5.1) |
| sans option, `a`, ou nom inconnu | conduite validée, rien du prototype n'existe |

Le banc (`src/core/steering-bench.js`) est un outil de développement, absent des menus. On y
roule seul sur une piste d'essai (`banc-direction`) : une longue ligne droite puis sept
virages de 72, 135, 208, 100, 158, 259 et 311 m de rayon (le quatrième à gauche, les autres
à droite).

| Touche | Effet |
|---|---|
| 1, 2, 3, 4 | conduite A, B1, B2, B3 — **immédiatement, sans repartir** |
| 5 | démonstration : la manœuvre mesurée (plein braquage tenu 3 s dans un virage), puis la voiture est rendue |
| 6 | le passage de la vidéo de référence, sur sa piste, avec les appuis supposés et la vitesse lue |
| Entrée | repartir avant le premier virage |
| C | caméra |

Une ligne de chiffres suit la direction en permanence : durée de maintien, braquage (en
multiple de la butée validée), phase 2, glissade, frottement des pneus, vitesse.

Contrôle dans le vrai jeu, au clavier : `node work/scripts/steerlab-check.mjs`.

### 6.2 Vidéos et télémétrie

`node work/scripts/steering-sequences.mjs`, dans `work/renders/steering/` — vue du poste de
pilotage, 60 images/s, avec la conduite, la manœuvre, la touche et les chiffres incrustés.

| Fichier | Contenu |
|---|---|
| `variant-a.mp4`, `variant-b1.mp4`, `variant-b2.mp4`, `variant-b3.mp4` | une vidéo par conduite : virage 4, virage 1, passage de référence |
| `compare-bend4.mp4` | les quatre conduites côte à côte : virage 4 (gauche, 100 m), entrée à la vitesse limite (193 km/h), 3 s |
| `compare-bend1.mp4` | idem : virage 1 (droite, 72 m), entrée à 85 % de la limite (129 km/h), 3 s |
| `compare-passage.mp4` | idem : le passage de la vidéo de référence (appuis supposés, vitesse de la vidéo) |
| `reference-vs-a.mp4` | la vidéo de référence à côté de la conduite validée (§ 2.5) |
| `telemetry-a.json` … `telemetry-b3.json` | la télémétrie de chaque enregistrement (60 relevés par seconde) |
| `steering-phases.jpg` | le poste de pilotage en phase 1 et en phase 2 |

Mesures complètes (toutes vitesses, tous virages, route élargie) :
`work/benchmarks/held-steering.json`.

### 6.3 Ce que donnent les variantes

Asphalte libre, 200 km/h, touche tenue 4 s :

| | A | B1 | B2 | B3 |
|---|---|---|---|---|
| Lacet à 0,5 s | 31°/s | 27°/s | 31°/s | 31°/s |
| Braquage maximal (× butée validée) | 1 | 1 | 1,64 | 2,04 |
| Glissement maximal | 0,25 | 0,25 | 1,13 | 2,45 |
| Crissement, traces, fumée | 0,42 s, —, — | 1,22 s, —, — | 0,42 s, 0,95 s, 1,28 s | 0,42 s, 0,86 s, 1,09 s |
| Glissade maximale | 0,3° | 0,3° | 1,8° | 17° |
| Vitesse après 4 s | 156 km/h | 159 km/h | 110 km/h | tête-à-queue à 3,8 s |
| Rayon le plus serré | 73 m | 75 m | 41 m | 29 m |

Virage 4 du banc (gauche, 100 m), entrée à la vitesse limite, touche tenue 3 s :

| | A | B1 | B2 | B3 |
|---|---|---|---|---|
| Vitesse à la fin | 180 km/h | 183 km/h | 147 km/h | 125 km/h |
| Route de 14 m | reste dessus | sort à l'extérieur à 1,7 s | reste dessus | sort à l'intérieur à 2,8 s |

Passage de la vidéo de référence (`banc-reference`), mêmes appuis supposés pour les quatre
— dont un premier appui de 2,4 s et un dernier de 2,2 s — et même vitesse :

| | A | B1 | B2 | B3 |
|---|---|---|---|---|
| Route de 14 m | reste dessus (2,6 m de l'axe au plus) | sort à l'extérieur à 1,6 s | sort à l'intérieur à 5,3 s | sort à l'intérieur à 2,5 s, tête-à-queue à 2,8 s |

(La route est ajustée sur A : voir la réserve du § 2.5. Ce tableau dit seulement qu'avec B1 il
faudrait braquer plus tôt, et qu'avec B2 ou B3 il faudrait relâcher par moments au lieu de
tenir la touche.)

Tête-à-queue de B3, touche tenue sans relâcher : 2,4 s à 100 km/h, 3,3 s à 150 km/h, 3,8 s à
200 km/h, aucun en 4 s à 250 km/h ; 2,0 à 2,5 s dans les virages lents abordés sous la
limite. Relâchée à 1,6 s, la glissade s'éteint et la voiture repart droite (test).

### 6.4 Différences de sensation attendues

Ce sont des attentes déduites des mesures, **pas un jugement** : les sensations restent à
valider par le joueur.

- **A — conduite validée.** Réponse immédiate et constante : l'appui donne tout de suite tout
  ce que la voiture peut tourner. Tenir la touche n'apporte rien de plus.
- **B1 — deux temps, sans surbraquage.** Le premier quart de seconde tourne un peu moins
  (85 % de l'adhérence, sans crissement) ; en tenant la touche, le reste arrive entre 0,4 et
  1,2 s, volant qui continue de tourner. On retrouve le « cran de plus » de la vidéo sans
  rien demander de plus aux pneus. **Contrepartie mesurée** : un virage abordé à sa vitesse
  limite ne passe plus avec un appui tardif (sortie à l'extérieur) ; il faut braquer plus tôt
  ou entrer moins vite. C'est la variante qui change le plus la conduite de tous les jours.
- **B2 — surbraquage.** Rien ne change pour un appui bref ou dosé. En tenant la touche plus
  d'une demi-seconde, le volant tourne davantage, les pneus crissent, marquent puis fument, la
  voiture **perd beaucoup de vitesse** (environ 1 g) et sa trajectoire se resserre parce
  qu'elle ralentit. Elle ne tourne pas plus fort à vitesse égale — l'adhérence reste la
  limite — et l'arrière ne décroche pas. Tenir la touche devient un moyen de sauver un virage
  abordé trop vite, payé en vitesse.
- **B3 — surbraquage et glissade.** Comme B2, plus fort, et l'arrière glisse : le nez pointe
  vers l'intérieur, l'horizon défile plus vite que la trajectoire ne tourne. Il faut relâcher
  à temps ; en insistant 2 à 4 s, tête-à-queue. C'est la seule variante qui produit le
  « dérapage » évoqué, et la seule où tenir la touche peut faire perdre la voiture.

## 7. Étape F — autres corrections du troisième essai

Déjà livrées dans la PR #5, sur laquelle cette branche est empilée, et non retouchées ici :

- **Sauts récupérables** : conditions de contact resserrées (vrai chevauchement de roues,
  plus d'énergie) — 205 sauts → 32 sur les mêmes 108 courses.
- **Rétroviseurs** : quatre propositions plus rapprochées avec supports corrigés
  (`#mirrors=d|e|f|g`), le réglage du jeu restant à 39,5 cm en attendant le choix.

La rotation des roues à grande vitesse, les collisions au sol, les panneaux et les accidents
violents ne sont pas modifiés.

## 8. Non-régression

| Contrôle | Résultat |
|---|---|
| `npm test` | 108 tests sur 108 (96 existants inchangés, 12 nouveaux) |
| Empreinte de quatre courses complètes (`driving-trace.mjs`) | identique pour les sources de la PR #4, de la PR #5 et de cette branche |
| Rapport de conduite, 165 valeurs | identiques à la référence des collisions validées et à la PR #4 |
| Scénarios E2, E3, E3x, E4, E5 rejoués dans le navigateur | télémétrie identique à la référence, image par image |
| Course complète, variante absente, `a` ou nom inconnu | identique au bit près (test) |
| Navigateur : rendu 13 / 13, pages 14 / 14, audio 80 / 80, banc des collisions 19 / 19, cinq parcours de modes | réussis |
| Banc de direction dans le vrai jeu (`steerlab-check.mjs`) | 31 / 31 |

Détail et commandes : `tests.md` § 0 et § 5 ter.

Les mesures des variantes sont dans des fichiers séparés (`held-steering.json`,
`telemetry-*.json`) ; aucune référence validée n'a été remplacée.

## 9. Limites, et ce qui reste à décider

- La vidéo de 1993, la planche de six images et l'extrait n'ont pas été reçus (§ 1).
- Les commandes de la vidéo sont inconnues ; les appuis de la comparaison sont une hypothèse,
  et la piste du passage est construite à partir d'elle (§ 2.3, § 2.5).
- La vidéo ne montre ni dérapage ni perte de vitesse au troisième cran : **B2 et B3 vont
  au-delà de ce qu'elle établit**. B1 est la lecture la plus littérale (un cran de plus,
  tardif, sans autre effet). Si braquer coûte de la vitesse dans le jeu filmé (§ 2.3), c'est
  dès le cran 2, pas au troisième.
- Au-delà de 54° de volant, le dessin actuel de l'avant-bras, qui tourne avec le volant, sort
  de l'habitacle par le côté (`steering-phases.jpg`, B2 et B3) : il serait à redessiner si
  une variante était retenue.
- Les variantes sont réglées pour le profil arcade ; en compétition et en turbo, où le plein
  braquage dépasse déjà l'adhérence, elles s'ajoutent à un surbraquage existant et seraient à
  régler à part.
- Le banc n'a qu'un virage à gauche. La conduite est symétrique, mais un banc en miroir
  serait facile à ajouter.
- Sept dessins de roues au lieu de cinq : étudié, non réalisé (§ 4.3).

**Au joueur de dire** : si l'une des variantes mérite d'être poursuivie, laquelle, avec quels
réglages — ou si la conduite validée doit rester telle quelle.
