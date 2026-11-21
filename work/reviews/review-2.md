# Revue artistique indépendante n° 2 — « Virage GP — édition bande dessinée »

Matériel examiné : les 20 captures 2560×1440 du dossier `work/renders/review-2/` (14 situations + séquence
`seq-straight-0…5`), et les deux textes de référence. Aucun code, aucune autre documentation, aucun rapport
antérieur n'a été consulté. Toutes les coordonnées sont données en pixels dans l'image 2560×1440, sous la forme
(x gauche–x droite, y haut–y bas). Les recadrages cités sont dans `work/reviews/crops/review-2/`.

Méthode : lecture de chaque image entière, puis recadrages à 100 %, 200 % et 300 % (agrandissement « au plus
proche voisin », donc sans lissage ajouté) ; pour la séquence, planches de comparaison image par image et
mesures de déplacement et de différence entre images consécutives.

---

## 1. Verdict global

Vu en entier, le jeu ressemble bien à une bande dessinée automobile : cockpit généreux, aplats et ombres en
formes franches, décors de circuit fouillés, interface en cartouches de BD — l'intention est tenue et le style
est propre au projet. Mais dès qu'on regarde à 100 %, trois familles de défauts cassent l'illusion du dessin :
un sol découpé en escaliers et en bandes horizontales au centre de l'écran, des objets proches rendus flous,
agrandis ou en « fantômes » translucides (collision, crépuscule), et deux régimes d'encrage qui ne semblent pas
de la même main (cockpit en traits fins et nets, voitures et décors en contours épais et adoucis). La vitesse
reste le point le plus faible : une image fixe à 310 km/h se distingue à peine de la grille de départ, et les
onomatopées sont des étiquettes posées sur l'image plutôt que du dessin.

---

## 2. Tableau des 13 critères

| # | Critère | Appréciation | Note /5 |
|---|---------|--------------|---------|
| 1 | Qualité du dessin | Solide à l'échelle de l'écran ; se dégrade de près (voitures proches empâtées, menu plus pauvre que le jeu, pilote schématique). | 3,5 |
| 2 | Précision mécanique | Voitures adverses crédibles à mi-distance (ailerons, triangles, feu de pluie, fond plat) ; cockpit approximatif de près (moyeu en « boîte », bras coupés net, rétroviseurs sur piquets) ; aucune inscription sur les carrosseries. | 3 |
| 3 | Qualité de l'encrage | Net, mais deux régimes incompatibles : filets de 1–2 px sur la voiture du joueur, contours de 3 à 10 px sur les autres voitures selon la distance ; peu de pleins et déliés hors des gants. | 3 |
| 4 | Colorisation | Point fort : aplats, ombres en formes franches, palettes par circuit, lointains atténués. Entaché par des effets translucides hors charte. | 4 |
| 5 | Perspective | Convaincante pour la piste, les tribunes, les stands ; contredite par les marques au sol et les ombres d'herbe alignées sur l'horizontale de l'écran. | 3,5 |
| 6 | Cohérence graphique | Interface, lettrage et menus cohérents entre eux ; cockpit, voitures, effets et onomatopées ne relèvent pas du même traitement (netteté, épaisseur, opacité). | 3 |
| 7 | Lisibilité | Trajectoire, concurrents et rapport engagé se lisent d'un coup d'œil ; compte-tours trop petit en écran partagé, aiguille qui masque un chiffre. | 4 |
| 8 | Sensation de vitesse | Faible en image fixe : décors parfaitement nets, peu de lignes de vitesse, sol presque identique à l'arrêt ; mur de pneus quasi figé d'une image à l'autre. | 2,5 |
| 9 | Animation | Défilement des décors régulier, volant, mains et roues avant animés ; marques au sol qui changent de forme à chaque image, onomatopée qui surgit d'un coup. | 3,5 |
| 10 | Continuité des formes | Escaliers dans l'asphalte, buisson qui tranche la glissière, masse d'arbres coupée à la verticale, bras de suspension non raccordés. | 2,5 |
| 11 | Absence de scintillement | Cockpit et interface stables (vibration de 1 px) ; le sol (blocs qui se recomposent), les liserés lointains hachés et le mur de pneus posent problème. | 3 |
| 12 | Absence de déformation involontaire | Correct en course ; la collision montre des pneus géants, flous et translucides, et les voitures proches semblent des petits dessins agrandis. | 3 |
| 13 | Qualité des arrière-plans | Tribunes, stands, foule, silhouette urbaine, collines atténuées : riche et bien hiérarchisé ; quelques volumes gris vides, désert un peu nu, détail légèrement adouci. | 4 |

---

## 3. Défauts

### Graves

**1. Marques au sol en escalier et en blocs rectangulaires, au centre de l'écran — Grave**
- Images : `seq-straight-0` à `-5` (1280–1420, 640–1000) ; `02-straight` (1130–1300, 640–900) et
  (860–1000, 900–1010) ; `01-grid` (950–1120, 710–800) et (660–700, 970–985) ; `04-overtake`
  (1200–1245, 675–710) ; `05b-chase` (1290–1400, 760–815).
- Recadrages : `seq0-center-100.png`, `seq-road-centre-2x.png`, `02-center-100.png`, `02-road-near-100.png`,
  `01-center-100.png`, `05b-far-2x.png`.
- Ce qu'on voit : les traces de gomme et les bandes claires de l'asphalte ne fuient pas vers le point de
  fuite ; elles sont faites de rectangles empilés aux bords strictement horizontaux et verticaux, qui forment
  des marches d'escalier d'environ 40 px de haut (jusqu'à cinq marches dans `seq-straight-0`). Les bandes
  claires se terminent par un bout carré parallèle au bas de l'écran. Dans la séquence, l'escalier change de
  forme à chaque image (les marches glissent et s'allongent), ce qui produit un clignotement de blocs
  exactement là où le joueur regarde. Aucun dessinateur ne tracerait cela : c'est la zone la plus regardée de
  l'écran et elle ne paraît pas dessinée.
- Résultat attendu : des traces de gomme et des reflets d'asphalte aux bords obliques et effilés, qui
  convergent vers le point de fuite, sans aucune arête horizontale ou verticale, et dont la forme reste stable
  d'une image à la suivante (elles avancent, elles ne se recomposent pas).

**2. Collision : premier plan flou, agrandi et translucide — Grave**
- Image : `06-collision` — pile de pneus (0–560, 440–1000) ; silhouettes fantômes (320–550, 455–540) ;
  arbre délavé, comme en surimpression (90–320, 440–600).
- Recadrages : `06-left-100.png`, `06-tyres-2x.png`, `06-bottomleft-100.png`.
- Ce qu'on voit : tout le quart gauche de l'image est occupé par des pneus géants au contour baveux et
  griffé, à demi transparents (le fond transparaît au travers), avec des silhouettes de spectateurs et un
  arbre en surimpression pâle. Le reste de l'image (pneu avant, rétroviseur, « CRAC ! »)
  est net et opaque : deux rendus incompatibles dans la même case, au moment précis où le joueur regarde ce
  qu'il vient de heurter.
- Résultat attendu : un obstacle heurté dessiné comme le reste — contour net, aplats opaques, taille
  crédible — et aucun élément en transparence ; si un élément doit sortir du champ, il doit le faire sans
  passer par un état fantôme.

### Moyens

**3. Étoile d'impact floue à côté d'un éclat net — Moyen**
- Image : `06-collision` (170–450, 460–730). Recadrage : `06-tyres-2x.png`.
- Ce qu'on voit : une étoile jaune à quatre branches, aux bords estompés et au contour brun diffus,
  semi-transparente, collée contre l'éclat d'impact blanc et jaune qui, lui, est encré net. On dirait un petit
  motif agrandi.
- Résultat attendu : des éclats secondaires du même encrage que l'éclat principal (contour noir franc, aplat
  opaque), ou pas d'éclat secondaire.

**4. Forme translucide illisible sur la voiture de droite — Moyen**
- Image : `10-dusk` (2220–2560, 560–800). Recadrages : `10-right-ghost-100.png`, `10-right-ghost-2x.png`.
- Ce qu'on voit : un voile blanchâtre à contours internes, à environ un tiers d'opacité, recouvre le capot
  moteur de la voiture bleue, le mur de pneus et le pied de l'arbre. Impossible de dire s'il s'agit de fumée,
  de poussière ou d'un élément de décor en train de disparaître : il se lit comme un accident de rendu.
- Résultat attendu : si c'est de la fumée ou de la poussière, un nuage dessiné (contour encré, aplat opaque,
  ombre en forme franche) ; sinon, rien.

**5. Deux régimes d'encrage et de netteté qui ne semblent pas de la même main — Moyen**
- Images : `02-straight` — pneu du joueur (130–430, 880–1080) en filets de 1–2 px parfaitement nets, contre
  la voiture rouge (780–1160, 590–770) en contours de 3–4 px adoucis, et les gants (860–1160, 1240–1440) en
  contour de 5 px ; `03-corner` — voiture jaune (1450–2560, 560–1060) en contours de 8–10 px ;
  `05b-chase` — voiture du joueur nette (880–1740, 960–1440) contre voiture voisine adoucie
  (0–520, 1080–1440) ; `11-docks` — foule et pneus (380–700, 480–660).
- Recadrages : `02-tire-outline-3x.png`, `02-car-red.png`, `03-yellowcar-100.png`, `05b-car-100.png`,
  `05b-leftcar-100.png`, `11-tyres-crowd-3x.png`.
- Ce qu'on voit : la voiture du joueur est tracée d'un filet fin, régulier, très net ; les autres voitures et
  le décor ont un contour dont l'épaisseur grossit avec la proximité et dont les bords sont légèrement flous.
  Les gants ont un troisième traitement (gros contour souple). Les trois cohabitent dans la même image.
- Résultat attendu : une même logique de trait partout — épaisseur liée à l'importance du contour (silhouette
  plus forte, détails plus fins), netteté identique pour le cockpit, les voitures et le décor.

**6. Voitures proches : trait empâté, grandes masses vides, aucune inscription — Moyen**
- Images : `03-corner` (1450–2560, 560–1060) ; `10-dusk` (1500–2560, 560–960) ; `11-docks`
  (280–1060, 560–920).
- Recadrages : `03-yellowcar-100.png`, `03-yellow-wing-2x.png`, `10-right-ghost-100.png`,
  `11-bluecar-100.png`.
- Ce qu'on voit : de près, la voiture adverse ressemble à un petit dessin agrandi — contours épais et
  tremblés, capot moteur et aileron réduits à deux ou trois grands aplats, aucun détail supplémentaire
  n'apparaît quand elle grossit. Aucune voiture adverse ne porte de numéro ni de marquage, alors que les
  panneaux du circuit en sont couverts.
- Résultat attendu : plus la voiture est proche, plus le dessin est fin et riche (numéro de course, marquages
  fictifs, rivets, arêtes de carrosserie), avec un contour qui reste d'une épaisseur de BD et non d'un
  agrandissement.

**7. Cockpit : mécanique approximative de près — Moyen**
- Images : `02-straight` — moyeux (480–720, 1000–1400) et (1850–2100, 1000–1400) ; extrémités des triangles
  (1045–1067, 1162–1185) et (1495–1510, 1165–1187) ; bras (660–1100, 1060–1320) ; `06-collision`
  (470–600, 1100–1350).
- Recadrages : `02-hub-left-2x.png`, `02-susp-left-end-2x.png`, `02-susp-right-end-2x.png`,
  `02-wing-left-2x.png`, `06-bottomleft-100.png`.
- Ce qu'on voit : au centre de chaque roue avant, un parallélépipède gris avec un cercle griffonné tient lieu
  de porte-moyeu — ni disque, ni étrier, ni écrou ; la jante est un simple anneau blanc. Les bras de
  suspension sont des tubes coupés net : côté châssis ils s'arrêtent en bout carré juste avant le nez, côté
  roue ils se posent sur la jante. De petites entailles régulières rythment chaque tube, comme des raccords
  de segments.
- Résultat attendu : un train avant qui convainc un passionné — porte-moyeu, disque et étrier suggérés,
  rotules et chapes aux deux bouts des triangles, tubes lisses d'un seul tenant.

**8. Vue extérieure : bras de suspension non raccordés au nez — Moyen**
- Image : `05-exterior` (1040–1260, 800–900). Recadrage : `05-car-front-2x.png`.
- Ce qu'on voit : à gauche du nez, les bras se terminent en bout carré posé sur le contour de la coque ; à
  droite, ils démarrent au milieu de la surface du nez, toujours en bout carré, sans point d'ancrage. Les
  deux côtés ne sont pas symétriques.
- Résultat attendu : des bras qui entrent dans la coque à des points d'ancrage dessinés, identiques des deux
  côtés.

**9. Pilote réduit à un casque sphérique posé sur une collerette — Moyen**
- Images : `05-exterior` (1135–1295, 585–715) ; `08-menu` case 1 (505–640, 295–410) et case 2
  (842–1000, 1065–1212) ; rétroviseurs en blocs gris sans glace, `08-menu` (965–1010, 1200–1240) et
  (1155–1200, 1147–1182).
- Recadrages : `05-helmet-2x.png`, `08-car-100.png`, `08-panel2-driver-2x.png`.
- Ce qu'on voit : une sphère bleue avec une bande de visière, posée sur une forme saumon ; ni épaules, ni
  bras, ni volant, ni harnais. En vue cockpit les gants et les avant-bras sont dessinés avec soin : le pilote
  vu de l'extérieur n'est pas au même niveau.
- Résultat attendu : un pilote dessiné — casque avec volume et décoration, épaules, bras vers le volant —
  cohérent avec les mains de la vue cockpit.

**10. Menus : illustrations en retrait par rapport au jeu — Moyen**
- Images : `08-menu` — décor de la case 1 fait de quatre bandes horizontales unies (60–1440, 220–800), moitié
  gauche de la case 2 vide (60–600, 1190–1390) ; `08b-menu-circuit` — vignette du circuit sans circuit
  (740–1400, 1010–1400), grande zone vide sous la liste (1480–2560, 980–1440).
- Recadrages : `08-car-100.png`, `08-panel2-100.png`, `08b-panel2-100.png`, `08b-right-100.png`.
- Ce qu'on voit : la monoplace du titre est correctement construite mais posée devant un fond de bandes
  plates (ciel, herbe, vibreur, piste) sans le moindre élément de circuit, alors que le jeu lui-même montre
  tribunes, stands et foule. La page de choix du circuit illustre « Forêt de Hazel » par des collines et un
  aplat vert : ni tracé, ni piste, ni repère.
- Résultat attendu : des cases de menu au niveau des décors du jeu (ou tirées d'eux), et une vignette de
  circuit qui montre le tracé et un lieu reconnaissable du circuit choisi.

**11. Onomatopées : une étiquette identique posée sur l'image — Moyen**
- Images : `02-straight` (1885–2215, 665–775), où elle chevauche le panneau « P3 +0.4 »
  (2190–2270, 610–740) ; `05-exterior` (1885–2215, 675–775) ; `07-split` (1920–2180, 330–390) et
  (1870–2170, 1050–1120) ; `07b-split-vertical` (940–1100, 695–745) ; `seq-straight-5` (1960–2140, 694–744).
- Recadrages : `02-onomat-100.png`, `05-onomat-2x.png`, `07b-onomat-2x.png`, `seq-onomat.png`.
- Ce qu'on voit : le même « RRRRRRAAAH » blanc à ombre noire, même inclinaison, même graisse, de petite
  taille, placé sur la piste ou le mur des stands sans rapport avec une voiture. Dans la séquence il est
  absent des images 0 à 4 et présent, entier, à l'image 5. En écran partagé vertical ses bords sont flous.
  Par contraste, le « CRAC ! » de la collision est un vrai lettrage de BD.
- Résultat attendu : des bruitages qui naissent d'une source (échappement, pneus), dont la taille, la forme
  et la direction varient avec le régime et la distance, qui apparaissent et disparaissent en plusieurs
  images, et qui ne recouvrent pas une information lisible du décor.

**12. Vitesse peu lisible dans une image fixe — Moyen**
- Images : `02-straight` (310 km/h) comparée à `01-grid` (0 km/h) — sol (560–1960, 780–1100) dans les deux ;
  tribune (0–900, 300–640) et stands (1500–2560, 150–820) dans `02-straight`.
- Recadrages : `02-road-near-100.png`, `01-road-near-100.png`, `02-center-100.png`.
- Ce qu'on voit : à l'arrêt comme à 310 km/h, l'asphalte porte les mêmes bandes obliques grises ; seuls
  quelques filets blancs très fins s'ajoutent à pleine vitesse. Tribune, banderoles et stands restent d'une
  netteté absolue jusqu'au bord de l'écran. Sans le compteur, rien ne dit que la voiture roule.
- Résultat attendu : une grammaire de la vitesse visible dans chaque image — lignes de vitesse franches qui
  guident l'œil vers le point de fuite, bords de champ traités différemment du centre, sol nettement
  différent entre l'arrêt et la pleine vitesse.

**13. Rétroviseurs : piquets invraisemblables et reflets sans décor — Moyen**
- Images : `01-grid` et `02-straight` — tiges (235–285, 880–1440) et (2280–2325, 880–1440) ; glace droite
  de `02-straight` (2160–2423, 753–858), voiture reflétée (2212–2245, 790–808).
- Recadrages : `02-mirror-right-3x.png`, `03-mirror-right-2x.png`, `02-wheel-right-100.png`.
- Ce qu'on voit : chaque rétroviseur est porté par une longue tige verticale qui monte du bas de l'écran en
  passant devant le pneu avant, comme une sucette. Le reflet se réduit à trois bandes (ciel, herbe, piste) :
  ni tribune ni stands alors que la voiture est en pleine ligne des stands, et la voiture qui suit n'est
  qu'un amas de quelques pixels.
- Résultat attendu : des rétroviseurs fixés au flanc du cockpit par un bras court et crédible, et un reflet
  qui reprend, simplifié mais dessiné, le décor réellement traversé.

**14. Buisson qui tranche la glissière — Moyen**
- Image : `05-exterior` (495–540, 610–668). Recadrage : `05-bush-rail-2x.png`.
- Ce qu'on voit : la glissière métallique s'interrompt sur une arête verticale et un lobe de feuillage
  descend par-dessus jusqu'au sol, comme si le buisson, pourtant planté derrière, passait devant le rail.
- Résultat attendu : une glissière continue devant la végétation, sans rupture.

**15. Masse d'arbres coupée à la verticale et grillage qui se dissout — Moyen**
- Images : `seq-straight-0` — arête verticale à x≈240 (y 450–630), grillage estompé (430–500, 520–625) ;
  la même arête se retrouve à x≈213, 190, 161, 133 et 101 dans les images 1 à 5.
- Recadrages : `seq-left-bg.png`, `seq-left-fence-2x.png`.
- Ce qu'on voit : derrière le grillage, le massif d'arbres sombre s'arrête sur une droite parfaitement
  verticale, puis on passe sans transition au ciel. À l'extrémité, le dernier panneau du grillage et sa
  banderole sont à demi effacés, en transparence.
- Résultat attendu : une lisière d'arbres à silhouette découpée, et un grillage qui se termine par un poteau
  dessiné, opaque.

**16. Ombres de l'herbe en bandes strictement horizontales — Moyen**
- Images : `05b-chase` (1750–2560, 730–900) ; `seq-straight-0` (400–1100, 660–760).
- Recadrages : `05b-kerb-right-100.png`, `seq0-edge-left-2x.png`, `seq-edge-far-4x.png`.
- Ce qu'on voit : les verts clairs et foncés du terre-plein se séparent selon des droites parallèles au bas
  de l'écran, quelle que soit la pente ou la courbe du terrain. Le sol paraît empilé en tranches.
- Résultat attendu : des formes d'ombre qui épousent le relief et la perspective, à bords courbes ou obliques.

**17. Volumes gris vides dans le décor — Moyen**
- Images : `05-exterior` (1930–2340, 350–615) ; `06-collision` (840–1110, 520–630) ; `04-overtake`
  (1065–1125, 602–622) et (1397–1467, 597–620) ; `seq-straight-0` (1550–1640, 588–620).
- Recadrages : `05-right-100.png`, `06-mid-100.png`, `04-centre-100.png`, `seq0-center-100.png`.
- Ce qu'on voit : des rectangles gris unis — un grand bâtiment sans porte ni fenêtre derrière le grillage,
  des panneaux sans inscription — au milieu d'un décor par ailleurs très renseigné.
- Résultat attendu : chaque volume du décor identifiable (bâtiment avec ouvertures, panneau avec message) ou
  supprimé.

### Mineurs

**18. Compte-tours : lettrage flou et aiguille qui masque un chiffre — Mineur**
- Image : `02-straight` (1150–1410, 1200–1440). Recadrage : `02-gauge-2x.png`.
- Ce qu'on voit : « RPM X1000 » et les graduations sont légèrement baveux, l'aiguille a un bord crénelé et
  recouvre le « 12 ».
- Résultat attendu : un cadran aussi net que le volant, des chiffres jamais masqués.

**19. Mur de pneus presque figé d'une image à l'autre — Mineur**
- Images : `seq-straight-0` à `-5` (300–1300, 600–670). Recadrage : `seq-tyrewall-3x.png`.
- Ce qu'on voit : le bout du mur recule de 22 à 29 px par image, soit à peu près l'écart entre deux pneus
  rouges (18 à 26 px) ; les pneus rouges retombent donc presque au même endroit (520/538/556 à l'image 0,
  517/536/554 à l'image 1). Le motif paraît immobile alors que le mur défile.
- Résultat attendu : un motif répétitif qui défile visiblement dans le bon sens à toutes les vitesses.

**20. Liserés lointains hachés et crénelés — Mineur**
- Images : `seq-straight-0` à `-5` (960–1260, 625–675) ; `05-exterior` (1870–2240, 690–705).
- Recadrages : `seq-edge-far-4x.png`, `05-onomat-2x.png`.
- Ce qu'on voit : au loin, le trait noir qui borde l'herbe et la ligne blanche de bord de piste deviennent
  des pointillés en marches d'un pixel, dont la position change à chaque image.
- Résultat attendu : des bords de piste continus et lisses jusqu'à l'horizon.

**21. Écran partagé : compte-tours minuscule, cockpit tronqué — Mineur**
- Image : `07-split` (1225–1335, 595–705) et (1225–1335, 1320–1430).
- Recadrages : `07-top-cockpit-100.png`, `07-overview-50.png`.
- Ce qu'on voit : le cadran ne fait plus qu'une centaine de pixels, ses chiffres une douzaine ; les mains et
  le bas du volant sont coupés par le bord de la fenêtre.
- Résultat attendu : un instrument lisible à cette taille (chiffres plus gros ou cadran simplifié) et un
  cadrage qui garde les mains entières.

**22. Voitures lointaines pixellisées — Mineur**
- Images : `04-overtake` (1080–1400, 600–700) ; `06-collision` (1880–2560, 590–700).
- Recadrages : `04-farcars-3x.png`, `06-cars-2x.png`.
- Ce qu'on voit : à l'agrandissement, les voitures de 90 à 150 px de large n'ont plus de trait d'encre, mais
  des pavés de couleur aux bords adoucis.
- Résultat attendu : des silhouettes simplifiées mais encrées, même petites.

**23. Pouce du gant en ovale détaché — Mineur**
- Image : `02-straight` (993–1057, 1277–1367). Recadrage : `02-hand-left-2x.png`.
- Ce qu'on voit : le pouce est un ovale plein posé à côté de la main, sans articulation ni raccord à la paume.
- Résultat attendu : un pouce articulé, rattaché à la paume, qui serre la jante.

**24. Désert : arrière-plan clairsemé — Mineur**
- Image : `09-desert` (0–2560, 480–640). Recadrages : `09-bg-left-100.png`, `09-bg-right-100.png`.
- Ce qu'on voit : dunes, quelques palmiers et un groupe de spectateurs ; aucune construction, peu de repères
  par rapport aux autres circuits.
- Résultat attendu : quelques repères dessinés propres au lieu, à la densité des autres thèmes.

---

## 4. Ce qui fonctionne bien (à préserver)

- **La composition du cockpit** : gros pneus avant, triangles, nez, volant et gants occupent le bas de
  l'image avec autorité (`01-grid`, `02-straight`). Le volant tourne, les mains suivent, les roues avant
  braquent (`03-corner`, `10-dusk`, `02-vs-03-frontwheels-50.png`).
- **Les voitures à mi-distance** : aileron arrière à dérives, triangles, fond plat, feu de pluie, pneus en
  deux tons d'ombre franche, livrées variées et fictives (`03-cars-100.png`, `04-greencar-2x.png`).
- **La couleur** : aplats et ombres en formes franches, palettes distinctes par circuit (le crépuscule de
  `10-dusk` est la plus réussie), collines et lointains atténués en bleus pâles.
- **Les décors de circuit** : tribune pleine de spectateurs, mur des stands avec panneaux, portique
  « Grand Prix Virage GP », feux de départ, grillages, foule avec drapeaux et parasols, silhouette urbaine
  et grues de `11-docks` ; sponsors inventés (Solgane, Kortex, Orvane, Gommex, Reinor, Nitral, Pistona).
- **L'interface** : cartouches inclinés à ombre portée, lettrage de BD, position en gros chiffre jaune,
  tracé du circuit, rapport engagé en jaune sur noir ; le « CRAC ! » de la collision ; la page de titre
  composée comme une planche.
- **La stabilité** : dans la séquence, l'interface ne bouge pas, le cockpit vibre d'un pixel, les décors
  défilent régulièrement et les personnages de la foule restent identiques d'une image à l'autre
  (`seq-right-crowd.png`).
- **L'originalité** : rien n'évoque une voiture, une livrée, un personnage ou une onomatopée reconnaissables
  d'une série existante.

---

## 5. Décompte

- **Graves : 2** (n° 1, 2)
- **Moyens : 15** (n° 3 à 17)
- **Mineurs : 7** (n° 18 à 24)
