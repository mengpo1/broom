# Revue artistique n° 4 — « Virage GP — édition bande dessinée »

Critique indépendant. Matériel examiné : les 14 captures 2560×1440 et la séquence de six images
consécutives du dossier `work/renders/review-4/`, plus les deux textes de référence. Toutes les
coordonnées sont données en pixels dans l'image 2560×1440 d'origine (x gauche→droite, y haut→bas).
Les recadrages cités sont dans `work/reviews/crops/review-4/`.

## 1. Verdict global

L'écran de course se lit d'emblée comme un dessin encré et mis en couleur, pas comme un rendu 3D
filtré ni comme du pixel art : cockpit, tribunes, stands et interface forment une image de bande
dessinée crédible, avec des ambiances de circuit réellement différenciées. Mais le niveau n'est pas
homogène : le cockpit et l'interface sont d'une netteté et d'une précision que n'atteignent ni les
voitures adverses vues de près, ni les personnages, ni certains raccords de décor, et une découpe
verticale franche dans un massif d'arbres saute aux yeux sur deux circuits. La vitesse et le son sont
encore plus « posés sur » l'image que dessinés dedans (onomatopées typographiées qui flottent, décor
latéral intact à 289 km/h), ce qui laisse le jeu un cran en dessous d'une planche de BD automobile
contemporaine.

## 2. Les 13 critères

| # | Critère | Appréciation | Note /5 |
|---|---------|--------------|---------|
| 1 | Qualité du dessin | Cockpit, tribunes et stands solides ; voitures adverses proches empâtées, personnages schématiques, avant-bras raides. | 3,5 |
| 2 | Précision mécanique | Triangles, biellettes, aileron avant et pneus convaincants depuis le cockpit ; pilotes sans bras ni volant en vue extérieure, jantes adverses réduites à des disques, moyeu en « brique ». | 3,5 |
| 3 | Qualité de l'encrage | Pleins et déliés réels sur le cockpit ; contour uniforme et mou sur les adversaires et le décor ; filets intérieurs trop maigres par rapport aux contours. | 3 |
| 4 | Colorisation | Palettes par circuit réussies (crépuscule, docks, désert), ombres en formes franches, lointains atténués ; quelques dégradés flous et voiles translucides étrangers aux aplats. | 4 |
| 5 | Perspective | Fuyantes, échelles et horizon cohérents ; les adversaires changent d'angle par à-coups. | 4 |
| 6 | Cohérence graphique | Deux qualités de trait cohabitent (cockpit/interface très nets, voitures et décors plus flous) ; trois familles de lettrage ; figurants d'un autre registre. | 3 |
| 7 | Lisibilité | Trajectoire, concurrents et compte-tours se lisent bien, y compris à 289 km/h ; onomatopées et rétroviseurs recouvrent parfois des éléments utiles. | 4 |
| 8 | Sensation de vitesse | Hachures de roulement sur les pneus et filets sur la piste efficaces ; le décor latéral reste figé et net, les filets sont rares et se lisent parfois comme des taches. | 3 |
| 9 | Animation | Défilement régulier (arbres proches : environ 8 px par image, constant sur les six images) ; saut d'angle d'un adversaire en une image ; tremblement d'un pixel du cockpit. | 3,5 |
| 10 | Continuité des formes | Forêt tranchée à la verticale, raccord mer/relief, grillage qui s'efface, rai translucide passant sur des voitures. | 3 |
| 11 | Absence de scintillement | Aucun clignotement d'aplat ni de contour constaté ; seuls les motifs fins (grillage, foule) et le cockpit décalé d'un pixel sont à surveiller. | 4 |
| 12 | Absence de déformation involontaire | Peu de cas : rangées basses des murs de pneus écrasées, voitures très proches boursouflées, numéro de nez illisible. | 4 |
| 13 | Qualité des arrière-plans | Tribunes, ligne des stands, ville portuaire et forêt du crépuscule riches et bien étagés ; répétitions visibles, bac à gravier mécanique, désert clairsemé. | 4 |

## 3. Défauts

### Grave

**1. Massif forestier tranché par une verticale parfaite.**
- Images : `10-dusk.png` ; `seq-straight-0.png` à `seq-straight-5.png`.
- Zones : `10-dusk` x ≈ 690–700, y ≈ 495–595 ; `seq-straight-0` x ≈ 240, y ≈ 470–625 (sous le
  cartouche du plan du circuit), la même arête se retrouve à x ≈ 162 dans `seq-straight-3`.
- Ce qu'on voit : le rideau d'arbres bordant la piste s'arrête sur une arête rectiligne et verticale
  qui coupe les houppiers et les troncs en plein milieu, comme un décor de théâtre vu par la tranche.
  Dans `10-dusk` la coupe se trouve à gauche du point de fuite, là où porte le regard ; dans la
  séquence elle glisse d'une image à l'autre derrière le grillage. Recadrages : `g10_forestend.png`,
  `s0_fenceL.png`, `s3_fenceL.png`.
- Résultat attendu : une lisière dessinée, avec la silhouette irrégulière des derniers arbres et un
  étagement vers le lointain, sans aucune arête droite visible.

### Moyen

**2. Rai translucide passant par-dessus deux voitures.**
- Image : `10-dusk.png`. Zone : x 1660–2120, y 730–830.
- Ce qu'on voit : un faisceau clair et semi-transparent traverse en biais la roue arrière de la
  voiture noire, ses bras de suspension puis le ponton de la voiture bleue. Il se lit comme un
  accident de superposition, pas comme un trait de vitesse. Recadrage : `g10_streak.png`.
- Résultat attendu : les traits de vitesse restent sur la piste ou derrière les voitures, et sont
  des traits opaques dessinés, jamais un voile posé sur la carrosserie.

**3. Changement d'angle d'un adversaire en une seule image.**
- Images : `seq-straight-3.png` → `seq-straight-4.png`. Zone : x 1460–1790, y 590–760.
- Ce qu'on voit : la voiture bleue est montrée de trois quarts arrière (flanc gauche et roue avant
  gauche visibles) sur les images 0 à 3, puis strictement de dos et symétrique à l'image 4, sans
  étape intermédiaire et sans avoir changé de place à l'écran. Recadrage : `seq_opp2x.png`.
- Résultat attendu : une rotation perçue comme continue, sans saut de pose.

**4. Voitures adverses proches molles et empâtées à côté d'un cockpit au trait net.**
- Images et zones : `10-dusk.png` x 2060–2560, y 560–1040 ; `11-docks.png` x 290–1010, y 580–910 ;
  `05-exterior.png` x 640–1680, y 520–1040 ; `01-grid.png` x 1100–1460, y 580–780.
- Ce qu'on voit : dès qu'une voiture occupe une grande surface, ses contours deviennent flous et
  tremblés, d'épaisseur uniforme, et les volumes se fondent en masses (capot moteur, appuie-tête et
  casque de la voiture bleue de `10-dusk`), alors que le cockpit du joueur, juste à côté, est tracé
  au cordeau. Recadrages : `g10_blob.png`, `g05_helmet.png`, `g01_car.png`.
- Résultat attendu : le même tranchant de trait et la même modulation d'épaisseur sur les voitures
  adverses que sur le cockpit, quelle que soit leur taille à l'écran.

**5. Pilotes réduits à un casque posé sur une forme d'épaules, sans bras, ni mains, ni volant.**
- Images et zones : `05-exterior.png` x 1120–1310, y 580–720 ; `08-menu.png` x 490–650, y 295–415
  (grande case) et x 825–1000, y 1065–1235 (case du bas).
- Ce qu'on voit : le pilote est un ovale bleu barré d'une visière plate, posé sur un dôme rouge
  saumon ; rien n'entre dans l'habitacle, qui est un aplat noir. Le défaut est le plus sensible dans
  le gros plan de la page de titre. Recadrages : `g05_helmet.png`, `g08_panel2.png`.
- Résultat attendu : un pilote crédible en vue extérieure (épaules, bras plongeant vers un volant,
  casque avec visière et reflets dessinés), du niveau des mains gantées de la vue cockpit.

**6. Avant-bras du pilote en planche rigide.**
- Images et zones : `03-corner.png` x 880–1020, y 1245–1440 ; `10-dusk.png` x 1550–1690, y 1300–1440.
- Ce qu'on voit : quand le volant tourne, la manche apparaît comme un parallélépipède à deux tons
  plats, aux bords rectilignes, dont un côté n'a pas de contour, avec quelques filets de pli très
  maigres ; le poignet se raccorde au gant par une cassure. Le contraste avec le gant, bien modelé,
  est fort. Recadrages : `g03_arm.png`, `g10_cockpit.png`.
- Résultat attendu : une manche de combinaison souple, avec plis encrés du même poids que le gant et
  un contour complet.

**7. Onomatopées typographiées, non intégrées à l'image.**
- Images et zones : `02-straight.png` x 1590–2100, y 800–960 ; `05-exterior.png` x 450–960,
  y 850–945 ; `07-split.png` x 1700–1990, y 165–215 et x 575–860, y 890–945 ;
  `07b-split-vertical.png` x 225–490, y 695–745 et x 1535–1755, y 695–745.
- Ce qu'on voit : « RRRRRRAAAH » et « VRRAAOOUM » sont composés dans un caractère géométrique dont
  toutes les lettres identiques sont des copies exactes, avec un contour noir en escalier. Dans
  l'écran partagé, elles flottent dans le ciel ou sur les panneaux publicitaires, loin de toute
  voiture ; dans `05-exterior` le mot recouvre la roue et l'aileron avant de la voiture principale ;
  dans `02-straight` il glisse derrière le pneu avant droit. Recadrages : `g02_onoma.png`,
  `g05_nose.png`, `g07_full.png`.
- Résultat attendu : des onomatopées dessinées à la main (lettres de taille et d'inclinaison
  variables), accrochées à la voiture qui émet le son et placées pour suivre le mouvement sans
  masquer la mécanique.

**8. Figurants en pictogrammes, sans visage, et clonés.**
- Images et zones : `07-split.png` x 0–420, y 880–1020 ; `01-grid.png` x 2200–2350, y 480–575, avec
  la même paire répétée en x 1740–1785, y 550–600 et x 1585–1610, y 580–605 ; `seq-straight-0.png`
  x 2260–2560, y 470–640.
- Ce qu'on voit : les spectateurs proches et les mécaniciens du muret sont des silhouettes en
  haricot à tête ovale vide, bras raides ; au muret, le même duo en chemise bleue est reproduit à
  chaque poste. Recadrages : `g07_crowd.png`, `g01_crew.png`, `seq_meshR.png`.
- Résultat attendu : des personnages de premier plan esquissés dans le même registre réaliste que
  les voitures (traits du visage suggérés, poses variées), sans répétition visible côte à côte.

**9. Trace sombre ondulante aux bords flous au milieu de la piste.**
- Images et zones : `02-straight.png` x 1230–1330, y 660–1020 ; `04-overtake.png` x 1170–1475,
  y 680–1020 ; `seq-straight-0.png` à `-5` x 1250–1420, y 700–1000.
- Ce qu'on voit : une bande plus sombre, au tracé sinueux et aux bords estompés, occupe l'axe de la
  piste juste devant le nez de la voiture ; sa forme change d'une image à l'autre. Elle se lit comme
  une flaque ou une tache, et son estompage tranche avec les aplats du reste. Recadrages :
  `g02_stain.png`, `g04_stain.png`, `seq_roadmark.png`.
- Résultat attendu : une gomme de trajectoire dessinée en formes franches, stable, qui suit
  lisiblement la ligne de course.

**10. Vitesse peu traduite hors de la chaussée.**
- Image : `02-straight.png` (289 km/h). Zones : x 0–1100, y 200–760 et x 1400–2560, y 150–800.
- Ce qu'on voit : tribunes, stands et panneaux sont rendus exactement comme à l'arrêt
  (`01-grid.png`) ; la vitesse ne tient qu'aux hachures des pneus, à quelques filets gris sur le
  bitume et à l'onomatopée. À 289 km/h l'image est à peine plus dynamique qu'à 136 km/h
  (`03-corner.png`). Recadrage : `g02_speed.png`.
- Résultat attendu : une grammaire de vitesse lisible dans une image fixe (traits de fuite dessinés
  sur les bords du champ, simplification graphique des éléments proches), graduée selon l'allure.

### Mineur

**11. Bac à gravier en semis de pois.** `06-collision.png`, x 700–1900, y 640–1040. Ovales bruns
quasi identiques répartis régulièrement sur un beige uni : on lit un tissu à pois plus qu'un gravier.
Recadrage : `g06_sand.png`. Attendu : une matière dessinée (amas, sillons, taille et densité
irrégulières).

**12. Raccord mer / relief à arête verticale.** `03-corner.png`, x 1955–1970, y 575–608. La bande de
mer s'arrête net sur une verticale où commence une silhouette de colline bleutée. Recadrages :
`g03_seam2.png`, `g03_seamwide.png`. Attendu : une ligne de côte continue.

**13. Extrémité du grillage qui s'efface en transparence.** `seq-straight-0.png`, x 430–500,
y 500–625 ; `seq-straight-3.png`, x 365–425. Les derniers poteaux et le treillis deviennent
fantomatiques et la bâche publicitaire s'arrête au carré. Recadrages : `s0_fenceL.png`,
`s3_fenceL.png`. Attendu : une fin de clôture dessinée (poteau d'angle, retour).

**14. Petit rectangle pâle rogné sous la séparation de l'écran partagé.** `07-split.png`,
x 1100–1255, y 722–732. Un cartouche bleu-gris dépasse de quelques pixels en haut de la fenêtre du
bas. Recadrage : `g07_toplightbar.png`. Attendu : rien de coupé au bord d'une fenêtre.

**15. Voitures en mosaïque dans les rétroviseurs de l'écran partagé.** `07b-split-vertical.png`,
x 1320–1470, y 1080–1140 et x 2380–2510, y 1080–1140. Les voitures reflétées sont faites de gros
carrés visibles. Recadrages : `g07b_mirrors.png`, `g07b_mirrorR2.png`. Attendu : un reflet simplifié
mais dessiné.

**16. Chiffres de vitesse à contour flou, qui débordent du cartouche ; rapport collé à « KM/H ».**
`05b-chase.png`, x 25–245, y 160–260 ; `07-split.png`, x 15–200, y 1365–1420. Le contour noir des
chiffres est estompé alors que le cartouche est net, le premier chiffre sort du cadre à gauche, et en
vue extérieure le « 4 » jaune mord sur le « H ». Recadrages : `g05b_gear.png`, `g07_speedbot.png`.
Attendu : chiffres au contour franc, tenus dans le cartouche, sans chevauchement.

**17. Répétitions dans la ligne des stands.** `01-grid.png` : tous les garages portent « 08 »
(x 2445–2485, y 460–505 ; x 2045–2070, y 520–545 ; x 1850–1870, y 545–565) et les panneaux alternent
« 17 » et « 18 » (x 2023–2115, y 658–748 ; x 1812–1857, y 647–707 ; x 1693–1722, y 640–688 ;
x 1619–1637, y 637–674). Recadrage : `g01_right.png`. Attendu : une numérotation qui progresse.

**18. Jantes des adversaires en disques concentriques.** `05b-chase.png`, x 372–442, y 1177–1310,
à comparer à la jante à cinq branches de `08-menu.png`, x 607–698, y 520–673. Recadrages :
`g05b_leftcar.png`, `g08_wheel.png`. Attendu : le même dessin de roue en course et au menu.

**19. Moyeu en bloc rectangulaire fermé et libellé du compte-tours chevauché.** `01-grid.png`,
x 485–543, y 1158–1307 (bloc gris sans ouverture ni raccord sur la face interne de la roue) et
x 1255–1295, y 1288–1312 (« RPM ×1000 » minuscule, touché par l'axe et l'aiguille). Recadrages :
`g01_hubL.png`, `g01_cockpit.png`. Attendu : une écope de frein identifiable ; un libellé dégagé.

**20. Tremblement d'un pixel de tout le cockpit.** `seq-straight-0.png` à `-5`, x 130–2430,
y 740–1440. Roues, rétroviseurs, nez et compte-tours se décalent ensemble de +1, −1, 0, +1, 0 pixel
en hauteur d'une image à la suivante (la roue gauche de 2 px entre les images 3 et 4), l'interface
restant fixe. Recadrage : `seq_cockpit.png`. Attendu : une vibration assez ample pour se lire comme
telle, ou aucune ; à un pixel, les filets fins risquent de frémir.

**21. Menus : lettrages hétérogènes, zones vides, numéro illisible.** `08-menu.png` : liste en
capitales maigres et cadres filiformes (x 1480–2560, y 480–1100), sans rapport avec le titre épais
ni avec l'écriture de l'interface de course ; grands vides en x 1500–2560, y 1000–1440 et x 60–560,
y 1080–1420 ; numéro du nez écrasé en x 860–960, y 485–505. `08b-menu-circuit.png` : vignette du bas
(x 750–1300, y 1010–1390) sans sujet. Recadrages : `g08_car.png`, `g08_list.png`, `g08_carhero.png`,
`g08b_left.png`. Attendu : une seule famille de lettrage, des cases toutes habitées.

**22. Rangées basses des murs de pneus écrasées et brouillées.** `06-collision.png`, x 0–500,
y 700–960 ; `seq-straight-0.png`, x 520–940, y 630–660. Sous la première rangée, les pneus se tassent
en bandes sombres indistinctes. Recadrages : `g06_tyres.png`, `seq_tyrewall.png`. Attendu : des
rangées empilées lisibles jusqu'au sol.

**23. Voiture noire en masse bouchée.** `07-split.png`, x 2050–2560, y 960–1200 ; `10-dusk.png`,
x 1500–2020, y 580–940. Carrosserie noire sur pneus presque noirs, presque sans tracé intérieur.
Recadrages : `g07_blackcar.png`, `g10_blackcar.png`. Attendu : des volumes détachés par des reflets
dessinés et des arêtes éclaircies.

## 4. Ce qui fonctionne bien (à préserver)

- **Le cockpit** : nez, triangles de suspension, biellettes, aileron avant, gants et compte-tours
  sont dessinés avec autorité, en contours épais et filets intérieurs, ombres en formes franches
  (`g01_cockpit.png`).
- **Les pneus avant** : flanc lisse à l'arrêt, bande de roulement hachurée à haute vitesse, hachures
  renouvelées d'une image à l'autre — un vrai moyen graphique de dire la vitesse
  (`tyre_compare_0_289_272.png`).
- **Les ambiances** : le crépuscule teinte aussi le cockpit et les rétroviseurs, les docks ont une
  ville noyée dans la brume, le désert sa lumière blanche ; les palettes de lointain sont bien
  atténuées.
- **Les décors du circuit principal** : tribunes, portique de départ, ligne des stands vitrée et
  panneaux publicitaires fictifs composent un cadre dense et crédible.
- **L'étoile d'impact et « CRAC ! »** de `06-collision.png` : c'est le seul moment où le lettrage
  fait corps avec l'action.
- **L'interface en cartouches inclinés** (position, tour, temps, jauges) : lisible, discrète et
  cohérente avec l'idée de récitatif de bande dessinée ; elle ne bouge pas quand le cockpit vibre.
- **La page de titre découpée en cases** obliques, avec gouttières et trame de points.
- **La régularité du défilement** : les éléments de décor avancent d'un pas constant sur les six
  images, sans à-coup ni clignotement d'aplat.
- **Les rétroviseurs fonctionnels** en solo, qui montrent les poursuivants de façon lisible.

## 5. Décompte

- **Graves : 1** (n° 1)
- **Moyens : 9** (n° 2 à 10)
- **Mineurs : 13** (n° 11 à 23)
