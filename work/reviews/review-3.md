# Revue artistique n° 3 — « Virage GP — édition bande dessinée »

Critique indépendant, d'après les 20 captures de `work/renders/review-3/` (2560×1440) et les deux textes de
référence. Toutes les coordonnées sont en pixels dans l'image d'origine 2560×1440 (x depuis la gauche,
y depuis le haut). Les recadrages cités sont dans `work/reviews/crops/review-3/`.
Aucun code, aucune autre documentation, aucun rapport antérieur n'a été consulté ; le jeu n'a pas été lancé.

## 1. Verdict global

À l'échelle normale, les vues cockpit en course donnent bien l'illusion d'une case de BD automobile
contemporaine : cockpit encré avec soin, ligne de départ richement décorée, palettes justes par circuit,
interface en cartouches de bande dessinée. Mais l'illusion se rompt dès qu'on sort de ce cas nominal :
découpes et coutures visibles (mur de pneus en sortie de piste, bande d'horizon du menu circuit, vibreurs,
poignets du pilote), voiture du joueur en vue extérieure et au menu qui évoque une maquette 3D filtrée, décors
et concurrents à mi-distance en image molle et crénelée face à un cockpit au trait net. C'est une bonne base,
pas encore au niveau « aucune approximation visible » qu'exige le genre : 2 défauts graves, 16 moyens,
10 mineurs.

## 2. Tableau des 13 critères

| # | Critère | Appréciation | Note /5 |
|---|---------|--------------|---------|
| 1 | Qualité du dessin | Cockpit, gants, tribunes et stands convaincants ; voiture du joueur en vue extérieure/menu et concurrents nettement en dessous. | 3,5 |
| 2 | Précision mécanique | Triangles, poussoirs et pneus crédibles ; étrier en « brique », rétroviseurs plantés sur des tiges, jantes en disque plein, pilote en boule : un passionné tique. | 2,5 |
| 3 | Qualité de l'encrage | Beaux déliés sur les stries des pneus et les gants ; ailleurs contour d'épaisseur presque constante, bords de piste en escalier, contour déchiqueté sur la voiture du menu, décors proches flous. | 3 |
| 4 | Colorisation | Point fort : aplats, ombres en formes franches, lointains atténués, thème crépuscule très réussi (la teinte gagne aussi le cockpit). Dégradés mous parasites sur l'asphalte. | 4 |
| 5 | Perspective | Ligne droite des stands très solide ; bâtiment frontal sans fuite, vibreurs en bandes horizontales, panneaux au texte inversé. | 3,5 |
| 6 | Cohérence graphique | Deux « mains » visibles : trait net (cockpit, interface) contre image molle (décors proches, voitures à mi-distance, reflets des rétroviseurs) ; arbres-billes du plan de circuit hors style. | 3 |
| 7 | Lisibilité | Trajectoire, concurrents et compte-tours se lisent d'un coup d'œil, même à 289 km/h ; lettrage de l'interface qui se chevauche, onomatopée qui mord sur le rétroviseur en écran partagé. | 4 |
| 8 | Sensation de vitesse | Traits de vitesse et stries présents mais timides : l'image à 289 km/h diffère peu de l'image à l'arrêt. La vue extérieure est plus convaincante. | 3 |
| 9 | Animation (séquence) | Défilement régulier et monotone d'une image à l'autre, vibration du cockpit de ±1 px cohérente sur toutes ses pièces, stries des pneus qui évoluent ; apparition sèche de l'onomatopée. | 4 |
| 10 | Continuité des formes | Critère le plus faible : coupes verticales et horizontales nettes en six endroits (mur de pneus, bande d'horizon, vibreurs, poignets, forêt, grillage), buisson qui traverse le rail. | 2,5 |
| 11 | Absence de scintillement | Ciel et interface parfaitement stables ; les bords de piste lointains en escalier et les trames fines (grillage, mur de pneus) changent de motif à chaque image. | 3,5 |
| 12 | Absence de déformation involontaire | Rien à signaler en course normale ; pneus du mur étirés en hauteur lors de la collision, textes publicitaires en miroir. | 3,5 |
| 13 | Qualité des arrière-plans | Hazelbrook (tribunes, stands, portique) et les trois autres thèmes sont riches et lisibles ; bâtiments plats, sapin unique répété, fonds vides du menu. | 4 |

## 3. Défauts

### Graves

**1. Mur de pneus au contact : coupe verticale, pneus étirés et flous** — Grave
- Image : `06-collision.png`. Zone : x 0–480, y 520–1280 (coupe à x ≈ 80).
- Ce qu'on voit : le mur de pneus contre lequel la voiture s'écrase s'arrête sur une ligne verticale parfaite à
  x ≈ 80 ; à gauche de cette ligne, un aplat vert uni remplace le mur et tranche aussi le paysage lointain. Les
  pneus rouges et blancs sont agrandis jusqu'à devenir de hauts cylindres flous, sans trait d'encre net, et les
  lisses du rail les traversent en lignes sombres hérissées de petits traits. C'est la première chose qu'on
  voit dans l'image, juste à côté de l'onomatopée. Recadrages : `06-left.png`, `06-leftedge.png`, `06-tyres-200.png`.
- Résultat attendu : un mur de pneus continu jusqu'au bord de l'écran, dessiné au trait net avec des
  proportions de pneus normales, même quand la caméra le touche presque.

**2. Bande d'horizon du plan de circuit : rectangle collé, coutures et coupe nette** — Grave
- Image : `08b-menu-circuit.png`. Zone : x 45–1355, y 200–260 (coupe à x ≈ 1351, couture à x ≈ 1250).
- Ce qu'on voit : sous le titre « HAZELBROOK », la bande de collines s'arrête sur une verticale nette à
  x ≈ 1351, une centaine de pixels avant le bord droit de la case ; au-delà, il ne reste que le ciel et le vert
  unis. Sous les collines, des rectangles translucides de teintes différentes, séparés par des verticales,
  débordent sur le sol. Les silhouettes de collines sont crénelées à 100 %. Recadrages : `08b-topright-100.png`,
  `08b-hills-right-end.png`, `08b-hills-zoom.png`.
- Résultat attendu : un horizon continu d'un bord à l'autre de la case, sans rectangle ni couture apparents,
  au même niveau de finition que les horizons en course.

### Moyens

**3. Vibreurs coupés à l'horizontale** — Moyen
- Images : `05b-chase.png` (x 1580–2010, y 700–835) ; `10-dusk.png` (x 0–750, y 695–980).
- Ce qu'on voit : dans 05b, le vibreur intérieur du virage se termine par une coupe horizontale nette à
  y ≈ 832 (x 1713–1873), prolongée par une fine couture claire dans l'herbe jusqu'à x ≈ 2010. Dans 10, le
  vibreur de gauche commence par la même coupe horizontale à y ≈ 698 (x 613–747). Les bandes rouges et blanches
  restent strictement horizontales à l'écran alors que le vibreur suit la courbe. Recadrages : `05b-kerb-cut.png`,
  `10-kerb-top.png`.
- Résultat attendu : des vibreurs dont le début et la fin s'effilent ou se terminent en biseau dans le sens de
  la piste, avec des bandes qui accompagnent la courbe.

**4. Poignets du pilote tranchés par deux verticales** — Moyen
- Images : `01-grid.png`, `02-straight.png`, `09-desert.png`, `11-docks.png`, `seq-straight-0.png`.
  Zone : x 876–884 et x 1676–1684, y 1355–1440.
- Ce qu'on voit : en ligne droite, les manchettes rouges à bande blanche sont coupées par une verticale sans
  trait d'encre à x ≈ 880 (gauche) et x ≈ 1680 (droite) ; au-delà, on retrouve directement la carrosserie
  blanche. Les avant-bras n'existent pas : les gants semblent posés sur deux moignons rectangulaires.
  Recadrages : `01-cuff-left-200.png`, `01-cuff-right-200.png`, `01-cockpit-center.png`.
- Résultat attendu : des avant-bras qui se prolongent naturellement jusqu'au bord de l'image, comme dans la
  vue en virage (`03-corner.png`), où la manche est entière.

**5. Rétroviseurs plantés sur des tiges derrière les roues avant** — Moyen
- Image : `01-grid.png` (toutes les vues cockpit). Zone : x 120–420, y 735–960 et x 2140–2440, y 735–960.
- Ce qu'on voit : chaque rétroviseur flotte au-dessus d'un pneu avant, au bout d'une fine tige verticale qui
  disparaît derrière le pneu (x ≈ 245–275 et x ≈ 2285–2315), sans attache visible à la coque. Dans la vue
  extérieure et au menu, les rétroviseurs de la même voiture sont de petits boîtiers fixés de part et d'autre
  du cockpit. Les deux représentations ne décrivent pas la même machine. Recadrages : `01-mirrors-100-L.png`,
  `01-mirrors-100-R.png`, `08-car-cockpit.png`.
- Résultat attendu : des rétroviseurs dont on comprend la fixation à la coque, identiques entre vue cockpit et
  vue extérieure.

**6. Étriers de frein en brique rouge, intérieur de roue griffonné** — Moyen
- Image : `01-grid.png` (toutes les vues cockpit). Zone : x 488–558, y 1130–1310 et x 2002–2072, y 1130–1310.
- Ce qu'on voit : au centre de chaque roue avant, un parallélépipède rouge uni, sans forme d'étrier, sans
  disque ni porte-moyeu lisible ; autour, de fins traits gris rayonnants évoquent une roue à rayons. Ces deux
  blocs sont présents en permanence au premier plan. Recadrages : `01-wheel-left.png`, `01-caliper-left.png`.
- Résultat attendu : un ensemble disque, étrier et porte-moyeu reconnaissable par un amateur, au même niveau
  de soin que les triangles de suspension voisins.

**7. Voiture du joueur en vue extérieure et au menu : aspect de maquette 3D filtrée** — Moyen
- Images : `05-exterior.png` (x 1120–1380, y 560–720) ; `08-menu.png` (x 380–800, y 250–420 ; numéro x 858–960,
  y 480–506).
- Ce qu'on voit : le casque est une sphère parfaite barrée d'une bande sombre, le buste une masse rouge sans
  bras ni épaules, les rétroviseurs deux boîtes grises sur bâtonnets, le saute-vent un rectangle bleu pâle.
  Au menu, le contour du capot moteur est déchiqueté, semé de petits éclats blancs, et le numéro sur le nez est
  une tache illisible alors que le « 27 » de l'aileron arrière se lit. C'est la voiture vedette de l'écran
  titre. Recadrages : `05-helmet-200.png`, `08-edge-airbox.png`, `08-edge-nose.png`, `08-car-cockpit.png`.
- Résultat attendu : un pilote et une voiture vedette dessinés avec la même finesse que le cockpit en course
  (casque et épaules crédibles, contour continu, numéro lisible).

**8. Concurrents simplifiés jusqu'au jouet** — Moyen
- Images : `03-corner.png` (x 640–1100, y 610–830) ; `01-grid.png` (x 0–420, y 600–880).
- Ce qu'on voit : de près, les voitures adverses ont des jantes en disque blanc uni à point noir, y compris à
  l'arrêt sur la grille, des dérives d'aileron arrière en grandes plaques unies aussi hautes que la voiture,
  aucun numéro ni marquage, un casque réduit à une forme arrondie. La bande blanche de la voiture bleue de la
  grille a un bord en pointillé crénelé. Recadrages : `03-car-white-200.png`, `01-car-blue-left.png`.
- Résultat attendu : des concurrents proches dotés de jantes dessinées, de numéros et de marquages fictifs, et
  de proportions d'aileron plausibles.

**9. Image molle et crénelée des décors proches, des voitures à mi-distance et des reflets** — Moyen
- Images : `seq-straight-4.png` (grillage et panneaux, x 100–520, y 360–660) ; `06-collision.png` (voitures,
  x 1860–2560, y 560–720) ; `01-grid.png` (reflet, x 135–405, y 755–870) ; `07b-split-vertical.png` (reflet,
  x 2350–2540, y 1060–1160).
- Ce qu'on voit : le grillage, les panneaux publicitaires et les rails proches de la caméra sont flous ; les
  voitures à mi-distance perdent leur trait d'encre et deviennent des formes molles aux bords en escalier ; les
  voitures vues dans les rétroviseurs ont l'aspect de petites images crénelées. Tout cela voisine avec un
  cockpit et une interface au trait parfaitement net : on voit deux techniques, pas une seule main.
  Recadrages : `seq4-fence-fade.png`, `06-right-cars.png`, `01-mirror-left.png`, `07b-mirror-right.png`.
- Résultat attendu : une netteté de trait homogène à toutes les distances, sans aspect pixelisé ni flou
  d'agrandissement.

**10. Bords de piste lointains en escalier et en pointillé** — Moyen
- Images : `seq-straight-0.png` (x 1960–2200, y 650–710) ; `07b-split-vertical.png` (x 1100–1270, y 550–575) ;
  `05b-chase.png` (x 1620–1900, y 760–900) ; `10-dusk.png` (x 300–900, y 660–800).
- Ce qu'on voit : à distance, la ligne blanche et son contour noir se brisent en marches et en tirets, visibles
  à 100 % ; l'herbe voisine porte des rangées de tirets sombres. Sur les six images de la séquence, le motif
  des marches change à chaque image. Recadrages : `seqB-edge-right-4x.png`, `07b-mid-left.png`, `05b-kerb-cut.png`.
- Résultat attendu : un bord de piste tracé d'un trait continu et lisse jusqu'à l'horizon, stable d'une image
  à la suivante.

**11. Buisson dessiné par-dessus le rail de sécurité** — Moyen
- Image : `05-exterior.png`. Zone : x 495–540, y 580–665.
- Ce qu'on voit : le bas du feuillage d'un arbre passe devant les deux lisses du rail et les interrompt, comme
  si l'arbre poussait au travers de la glissière, côté piste. Recadrage : `05-rail-tree.png`.
- Résultat attendu : la végétation derrière le rail, le rail continu devant elle.

**12. Bâtiment plat vu de face collé à une tribune en perspective** — Moyen
- Image : `05-exterior.png`. Zone : x 1930–2350, y 350–615.
- Ce qu'on voit : au bout de la tribune, un bloc gris à six fenêtres bleues est dessiné strictement de face
  (rectangle sans aucune fuyante) alors que la tribune voisine fuit fortement. La jonction est une simple
  verticale. Recadrage : `05-right-bg.png`.
- Résultat attendu : un bâtiment construit dans la même perspective que la tribune, avec un minimum de détail
  d'architecture.

**13. Lettrage de l'interface : lettres qui se chevauchent** — Moyen
- Images : toutes les vues de course (exemple `02-straight.png`). Zones : « POSITION » x 45–135, y 34–54 ;
  « DERNIER » x 2220–2327, y 70–92 ; « MEILLEUR » x 2220–2342, y 100–124.
- Ce qu'on voit : le T et le I de « POSITION » se touchent, le I de « DERNIER » se confond avec le N et le E,
  le I et le premier L de « MEILLEUR » fusionnent. On lit « DERNER » et « MEⅡLEUR » sans zoom.
  Recadrages : `07b-hud-tr.png`, `02-hud-tr-100.png`, `02-hud-tl.png`.
- Résultat attendu : un lettrage d'interface aux approches régulières, chaque lettre détachée de ses voisines.

**14. Onomatopée unique, posée comme une étiquette** — Moyen
- Images : `02-straight.png` (x 370–922, y 768–960) ; `05-exterior.png` (x 365–910, y 790–940) ;
  `07-split.png` (x 429–851, y 371–486 et y 1088–1216) ; `07b-split-vertical.png` (deux vues).
- Ce qu'on voit : le même « RRRRRRAAAH », même graphie, même taille, même inclinaison, à peu près au même
  endroit dans toutes les situations et pour les deux joueurs. Il n'est rattaché à aucune source sonore et ne
  suit aucune trajectoire. En écran partagé, il recouvre le bas du rétroviseur gauche et sa tige dans les deux
  vues. Recadrages : `02-onoma.png`, `07-mirrorL-top.png`, `07-mirrorL-bot.png`.
- Résultat attendu : des onomatopées variées (graphie, taille, couleur), intégrées au dessin et placées sans
  masquer rétroviseurs ni instruments.

**15. Vitesse peu marquée dans l'image fixe** — Moyen
- Images : `02-straight.png` (289 km/h) comparée à `01-grid.png` (0 km/h) ; `09-desert.png` (204 km/h).
  Zone : x 0–2560, y 620–1100.
- Ce qu'on voit : à 289 km/h, tribunes, stands et panneaux sont aussi figés et détaillés qu'à l'arrêt. La
  vitesse ne repose que sur quelques filets clairs et sombres au ras de l'asphalte, dans les coins bas, et sur
  l'onomatopée. La vue extérieure `05-exterior.png`, avec ses longs filets rayonnants, est plus parlante.
- Résultat attendu : une vitesse lisible d'emblée dans une image fixe, par des moyens graphiques qui touchent
  aussi les bords de piste et le décor proche, sans gêner la lecture de la trajectoire.

**16. Cases du menu : fonds vides et même dessin répété** — Moyen
- Image : `08-menu.png`. Zones : case 1 x 45–1491, y 45–979 ; case 2 x 563–1408, y 1011–1395.
- Ce qu'on voit : derrière la voiture vedette, le décor se réduit à quelques bandes unies (trois bleus, un
  vert, un gris) et à un vibreur en rectangles rouges. La seconde case reprend la même voiture en plus gros sur
  un fond gris uni. L'écart avec la richesse des décors en course est frappant. Recadrages : `08-car-rear.png`, `08-panel2.png`.
- Résultat attendu : des cases de menu dotées d'un vrai décor de circuit et de deux dessins distincts.

**17. Plan de circuit : arbres en billes brillantes, plan et élévation mêlés** — Moyen
- Image : `08b-menu-circuit.png`. Zone : x 45–1440, y 260–980.
- Ce qu'on voit : les arbres sont des sphères vertes à reflet, toutes identiques, d'un rendu luisant étranger
  aux aplats encrés du reste du jeu. Le tracé est un plan vu du dessus, mais il est coiffé d'un ciel et d'un
  horizon vus de côté : deux projections dans la même case. Recadrages : `08b-trees.png`, `08b-left.png`.
- Résultat attendu : un plan de circuit dans le style encré du jeu, avec une seule projection assumée.

**18. Forêt et grillage terminés par une verticale nette** — Moyen
- Images : `seq-straight-4.png` (forêt x ≈ 132, y 466–622 ; grillage x ≈ 395, y 520–625) ; `10-dusk.png`
  (forêt x ≈ 695, y 486–602).
- Ce qu'on voit : le massif forestier se termine comme une dalle, par une arête verticale droite ; le grillage
  s'arrête sur une verticale, au-delà de son dernier poteau, la maille devenant pâle et translucide juste avant.
  Recadrages : `seq4-fence-fade.png`, `seq3-forest-100.png`, `10-bg.png`.
- Résultat attendu : des lisières irrégulières et un grillage qui se termine sur un poteau.

### Mineurs

**19. Panneaux publicitaires au texte inversé** — Mineur
- Image : `05b-chase.png`. Zone : x 2115–2330, y 610–655.
- Ce qu'on voit : « NITRAL », « FREINOR » et « PISTONA » se lisent en miroir. Recadrage : `05b-boards-mirror.png`.
- Résultat attendu : des textes à l'endroit quel que soit le côté de la piste.

**20. Cartouche de vitesse : chiffres qui débordent, rapport qui touche « KM/H »** — Mineur
- Image : `05b-chase.png`. Zone : x 20–245, y 155–265.
- Ce qu'on voit : le contour épais des chiffres dépasse le bord gauche du cartouche, et le « 4 » du rapport
  chevauche le H de « KM/H » en mordant sur l'angle du cadre. Le débordement à gauche se retrouve en vue cockpit
  (`02-straight.png`, x 20–40, y 165–230). Recadrages : `05b-hud-speed.png`, `check-speed-notch.png`.
- Résultat attendu : chiffres, unité et rapport séparés, contenus dans le cartouche ou débordant de façon
  clairement voulue.

**21. Reflets des rétroviseurs sans rapport avec la scène** — Mineur
- Images : `06-collision.png` (x 125–395, y 755–870 et x 2145–2415, y 755–870) ; `01-grid.png` (x 135–405,
  y 755–870).
- Ce qu'on voit : dans le bac à graviers, les deux rétroviseurs montrent un aplat vert sous une bande de ciel.
  Sur la grille, entre tribune et stands, le reflet montre un horizon dégagé sans aucun bâtiment.
  Recadrages : `06-left.png`, `01-car-blue-left.png`.
- Résultat attendu : un reflet qui reprend, même simplifié, le décor réellement situé derrière la voiture.

**22. Rail visible par-dessus le mur de pneus à leur jonction** — Mineur
- Image : `seq-straight-4.png`. Zone : x 410–526, y 618–660.
- Ce qu'on voit : une bande grise horizontale, prolongement de la lisse du rail, traverse toute la rangée de
  pneus. Recadrage : `seq4-rail-tyres.png`.
- Résultat attendu : une jonction franche, le rail s'arrêtant là où commence le mur de pneus.

**23. Zone claire en dégradé mou sur l'asphalte** — Mineur
- Image : `02-straight.png`. Zone : x 1480–1620, y 700–1100.
- Ce qu'on voit : une frontière presque verticale, en dégradé doux, sépare deux gris de la chaussée sans suivre
  les fuyantes de la piste. Elle ressort surtout en accentuant le contraste. Recadrage :
  `02-straight-road-contrast.png` (contraste accentué).
- Résultat attendu : des variations de gris en formes franches, orientées selon la perspective de la piste.

**24. Petit rectangle pâle collé en haut de chaque vue en écran partagé** — Mineur
- Image : `07-split.png`. Zone : x 1107–1300, y 5–11 et y 727–740.
- Ce qu'on voit : une fine barre gris-bleu, sans fonction lisible, dépasse du bord supérieur de chaque fenêtre.
  Recadrage : `07-topnotch.png`.
- Résultat attendu : rien à cet endroit, ou un élément complet et identifiable.

**25. Fines stries régulières sur les bras de suspension** — Mineur
- Image : `01-grid.png`. Zone : x 590–1100, y 1080–1200.
- Ce qu'on voit : à 300 %, de petits traits transversaux reviennent à intervalle régulier le long des tubes.
  Recadrage : `01-tube-ticks.png`.
- Résultat attendu : des tubes lisses, ou des détails mécaniques identifiables (rotules, bagues).

**26. Onomatopée qui apparaît d'un bloc** — Mineur
- Images : `seq-straight-4.png` puis `seq-straight-5.png`. Zone : x 400–690, y 790–880.
- Ce qu'on voit : absente des images 0 à 4, l'onomatopée est entièrement présente, à sa taille finale, à
  l'image 5. Recadrage : `seqA-onoma.png`.
- Résultat attendu : une entrée progressive sur quelques images.

**27. Spectateurs proches sans visage** — Mineur
- Image : `07-split.png`. Zone : x 0–380, y 900–1000.
- Ce qu'on voit : au bord de la piste, des spectateurs dont la partie visible fait environ 60 px de haut ont
  des têtes unies, sans aucun trait de visage. Recadrage : `07-bottom-left.png`.
- Résultat attendu : quelques traits de visage dès que les personnages dépassent une certaine taille.

**28. Sapin unique répété** — Mineur
- Image : `05b-chase.png`. Zone : x 920–2500, y 260–700.
- Ce qu'on voit : six sapins de silhouette identique, seulement mis à des tailles différentes.
- Résultat attendu : deux ou trois variantes de silhouette.

## 4. Ce qui fonctionne bien (à préserver)

- **Le cockpit en course** : pneus avant aux stries encrées en déliés, gants rouges bien construits, volant et
  compte-tours lisibles avec rapport engagé au centre, triangles et poussoirs crédibles. La manche entière en
  virage (`03-corner.png`) est le bon modèle.
- **La ligne droite de Hazelbrook** (`01-grid.png`, `02-straight.png`) : tribune peuplée, portique « Grand Prix
  Virage GP », voie des stands avec panneaux de box, drapeaux, mâts d'éclairage. Perspective solide,
  profondeur atténuée par plans, noms de marques fictifs.
- **Les palettes par circuit** : crépuscule rose et orangé qui teinte aussi la voiture et les reflets
  (`10-dusk.png`), désert sobre, ville portuaire aux silhouettes de tours pâles (`11-docks.png`), montagnes
  enneigées (`05b-chase.png`).
- **L'interface en cartouches de BD** : panneaux inclinés à ombre portée, récitatif jaune pour les temps,
  bandeau « DÉPASSEMENT ! P10 », plan du circuit lisible, jauges simples. Elle ne tremble pas avec le cockpit.
- **L'impact « CRAC ! »** (`06-collision.png`) : étoile jaune et blanche et lettrage épais, bien dans le genre.
- **La mise en page du menu** en planche (cases en biais, logo rouge à ombre noire, trame de points discrète).
- **L'animation** : sur les six images consécutives, le bord de piste se déplace régulièrement, sans saut ni
  retour ; ciel, nuages et interface restent strictement fixes.
- **L'écran partagé** : chaque joueur garde son cockpit complet, sa livrée et ses instruments, dans les deux
  dispositions.
- **Originalité** : aucune voiture, livrée, logo ou onomatopée ne m'a paru reprendre une série existante.

## 5. Décompte

- **Graves : 2** (n° 1 et 2)
- **Moyens : 16** (n° 3 à 18)
- **Mineurs : 10** (n° 19 à 28)

Limites de cette revue : les critères 9 et 11 reposent sur six images consécutives d'une seule ligne droite ;
le scintillement n'a pu être jugé que par comparaison d'images fixes, pas en mouvement.
