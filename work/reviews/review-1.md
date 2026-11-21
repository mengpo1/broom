# Revue artistique n° 1 — « Virage GP — édition bande dessinée »

Critique indépendant, d'après les 20 captures 2560×1440 du dossier `work/renders/review-1/`
(14 vues fixes + 6 images consécutives), examinées à 100 % et 200–400 % par recadrage.
Les recadrages cités sont dans `work/reviews/crops/review-1/`. Toutes les coordonnées sont
données en pixels dans l'image d'origine 2560×1440, sous la forme (x gauche–x droite, y haut–y bas).

## 1. Verdict global

Les décors et l'interface parlent déjà la langue de la bande dessinée : trait encré, aplats,
lointains atténués, cartouches de récitatif, et la séquence de six images est stable. Mais le
« deuxième héros » manque à l'appel : les voitures concurrentes sont des volumes à facettes presque
sans encrage, étrangères au dessin du cockpit et des décors, et la mécanique visible du poste de
pilotage (triangles flottants, aileron en bandes plates, jantes lisses, rétroviseurs à image fixe)
ne résiste pas au regard d'un passionné. S'y ajoutent des accidents immédiatement visibles —
éléments de bord de piste grossis jusqu'au flou, masse grise géante au crépuscule, boutons de menu
recouverts — qui interdisent en l'état de parler d'une BD automobile contemporaine « qui prend vie ».

## 2. Tableau des 13 critères

| # | Critère | Appréciation | Note /5 |
|---|---------|--------------|---------|
| 1 | Qualité du dessin | Décors soignés ; cockpit propre mais schématique (gants-moufles, bras en planches) ; concurrentes non dessinées, seulement modelées | 3 |
| 2 | Précision mécanique | Point le plus faible : triangles de suspension qui s'arrêtent dans le vide, aileron avant en bandes plates, jantes en disque lisse, jantes des rivales figées | 2 |
| 3 | Qualité de l'encrage | Trait net et modulé sur le cockpit, les arbres, les tribunes ; filiforme, mou ou absent sur les concurrentes ; fin et uniforme sur la voiture du joueur en vue extérieure | 3 |
| 4 | Colorisation | Aplats et ombres franches, lointains bien atténués, belles palettes jour/désert/docks ; cockpit et rétroviseurs gardent les couleurs de plein jour au crépuscule | 3,5 |
| 5 | Perspective | Fuite de la piste, des tribunes et des stands convaincante ; aileron avant et rétroviseurs sans perspective, tribunes sans épaisseur à leur extrémité | 3,5 |
| 6 | Cohérence graphique | Trois écritures cohabitent : cockpit au trait épais, décors illustrés, concurrentes en volumes facettés ; interface cohérente avec les décors | 2,5 |
| 7 | Lisibilité | Trajectoire, concurrents (livrées distinctes) et instruments se lisent bien, y compris à 289 km/h ; rétroviseurs inutilisables, cockpit tronqué en écran partagé | 4 |
| 8 | Sensation de vitesse | Hachures de pneus et traits sur l'asphalte efficaces ; traits aléatoires dans le ciel, roues rivales immobiles, aucune onomatopée de moteur | 3 |
| 9 | Animation | Défilement continu et régulier sur les six images, volant et mains articulés ; jantes sans rotation, micro-tremblement d'un pixel | 3,5 |
| 10 | Continuité des formes | Triangles coupés net, cockpit sectionné en écran partagé, rétroviseurs accolés sur la couture verticale, raccords de rails, buisson tranché | 2,5 |
| 11 | Absence de scintillement | Décors et interface stables ; traits de vitesse du ciel qui naissent et meurent en 2 à 4 images, bord de piste crénelé à l'horizon | 3,5 |
| 12 | Absence de déformation involontaire | Éléments de bord de piste grossis jusqu'au flou (collision, crépuscule) | 2,5 |
| 13 | Qualité des arrière-plans | Meilleur poste : tribunes peuplées, stands, collines étagées, skyline des docks, montagnes ; quelques répétitions mécaniques | 4 |

## 3. Défauts

### Graves

**1. Les voitures concurrentes ne sont pas dessinées dans le style du reste de l'image.** — Grave
- Images : `03-corner` (voiture jaune 1460–2560, 580–1060 ; rouge et blanche 640–1120, 600–840 ; noire 1120–1640, 600–800), `10-dusk` (bleue 1500–2560, 560–960), `11-docks` (bleue 260–1060, 560–900), `04-overtake` (orange 0–420, 780–1080), `seq-straight-0` (bleue 1460–1800, 580–740).
- Ce qu'on voit : des volumes à facettes remplis de deux ou trois tons, bordés d'un liseré sombre filiforme, irrégulier et mou, parfois absent ; à 100 % les arêtes sont crénelées et légèrement floues. Juste à côté, le pneu et le rétroviseur du joueur ont un contour noir net de plusieurs pixels, modulé (recadrages `r03-contrast-1x`, `z03-yellow-edge-4x` contre `z03-cockpit-edge-4x`). Les arbres et tribunes du même plan ont eux aussi un contour encré : la voiture, censée être le « deuxième héros », est l'élément le moins dessiné de l'image.
- Résultat attendu : des concurrentes qui semblent de la même main que le cockpit et les décors — contour encré net et modulé (plus fort sur la silhouette, plus fin sur les détails), ombres en formes dessinées, arêtes propres à toutes les distances.

**2. Collision : le bord de piste grossi devient une bouillie floue.** — Grave
- Image : `06-collision`, zone 0–700, 420–1240 (triangle jaune flou 0–110, 530–610 ; tache brune floue 660–760, 890–960).
- Ce qu'on voit : le mur de pneus rouge et blanc et les spectateurs occupent un quart de l'écran, grossis au point d'être flous, baveux, avec des contours gris épais et mous ; par-dessus, l'éclat d'impact et le rétroviseur sont parfaitement nets (recadrage `k06-left`). Le contraste net/flou dans la même case est immédiat.
- Résultat attendu : un mur de pneus et des personnages qui restent dessinés au trait net quand on est contre eux, avec la même finesse d'encrage que l'éclat d'impact.

**3. Crépuscule : masse grise géante et floue devant la voiture bleue.** — Grave
- Image : `10-dusk`, zone 2040–2560, 380–820 (copie fantôme translucide 2050–2130, 620–720 ; sapin en escalier 2380–2560, 300–410).
- Ce qu'on voit : une forme grise bosselée (fumée ou rocher), haute de plus de 400 px, cernée d'un trait sombre mou trois fois plus épais que partout ailleurs, qui masque le haut de la concurrente bleue ; son bord gauche se dédouble en voile translucide. Au-dessus, un sapin aux bords en marches d'escalier (recadrage `z10-right-1x`).
- Résultat attendu : aucun élément grossi hors d'échelle au premier plan ; si c'est de la fumée ou de la poussière, des volutes dessinées au même trait que le reste, qui laissent lire la voiture.

**4. Les rétroviseurs montrent partout la même vignette, sans rapport avec la scène.** — Grave
- Images : toutes les vues cockpit ; rétroviseur gauche 118–420, 740–880, droit 2140–2440, 740–880. Flagrant dans `10-dusk` (ciel bleu clair et herbe verte au milieu d'une scène orange et violette), `09-desert` (herbe verte dans le désert), `11-docks` (herbe verte en zone portuaire), `01-grid` (position 8/16 : route vide alors que huit voitures sont derrière), `06-collision` (ligne droite alors que la voiture est dans le gravier).
- Ce qu'on voit : un pictogramme identique au pixel près (ciel bleu, herbe, route, ligne blanche, reflet), même teinte mesurée dans quatre thèmes. Au crépuscule ce sont deux rectangles bleu ciel qui sautent aux yeux.
- Résultat attendu : des rétroviseurs dont le contenu correspond au lieu, à la lumière et à ce qui se trouve derrière — ou, à défaut, une surface neutre qui ne contredit pas la scène.

**5. Page de choix de circuit : une masse noire recouvre deux boutons.** — Grave
- Image : `08b-menu-circuit`, polygone noir 1410–2560, 760–1440 ; boutons « DÉPART ! » et « RETOUR » recouverts en 2380–2520, 770–940.
- Ce qu'on voit : la grande forme noire du coin inférieur droit monte plus haut que sur le menu principal et cache l'extrémité droite et le cadre de deux boutons (recadrage `m08b-half`).
- Résultat attendu : une forme décorative qui ne chevauche aucun élément interactif, à la même place d'une page à l'autre.

### Moyens

**6. Triangles de suspension flottants et aileron avant en bandes plates (cockpit).** — Moyen
- Images : toutes les vues cockpit, par exemple `02-straight` : bras 580–1120 et 1440–1980, 1060–1400 ; extrémités intérieures coupées en 1070–1120 et 1440–1490, 1060–1180 ; aileron 700–1860, 1090–1320.
- Ce qu'on voit : les barres sombres s'arrêtent net dans le vide à plus de 100 px du nez, sans ancrage ni rotule ; elles sont segmentées par de petits traits de jointure. L'aileron est un empilement de bandes horizontales rouge, grise, rouge sans fuite ni épaisseur, flanqué de deux plaques bleues plates (recadrages `u10-steer`, `c02-susp-L`).
- Résultat attendu : des bras qui rejoignent visiblement la coque et le porte-moyeu, un aileron lu comme un volume en perspective, avec dérives et plan principal.

**7. Jantes avant réduites à un disque gris percé d'un ovale noir.** — Moyen
- Images : toutes les vues cockpit, par exemple `02-straight` : 490–640, 1020–1400 et 1930–2080, 1020–1400.
- Ce qu'on voit : aucune branche, aucun écrou central, aucun disque ou étrier ; deux grandes surfaces grises vides au premier plan, identiques à l'arrêt et à 289 km/h (recadrage `cmp-tyreL-grid-corner-straight`).
- Résultat attendu : une roue crédible pour un passionné (écrou, voile de jante, frein suggéré) dont le traitement change avec la vitesse.

**8. Gants et bras du pilote en style cartoon simplifié.** — Moyen
- Images : `02-straight` (gants 900–1060 et 1500–1660, 1260–1400), `03-corner` (bras 840–1160, 1160–1440), `07b-split-vertical` (bras 380–900, 1000–1440).
- Ce qu'on voit : des moufles rouges à quatre pastilles claires et trois traits, un pouce ovale ; des bras en planches blanches rectilignes à bande grise, sans pli, sans coude, sans combinaison (recadrages `r03-steer`, `v07b-left-cockpit`). Ce registre humoristique jure avec les tribunes et les arbres, dessinés plus sérieusement.
- Résultat attendu : des mains gantées et des avant-bras au dessin réaliste (doigts articulés, coutures, plis de la manche), du même niveau que les décors.

**9. Roues des concurrentes figées à haute vitesse.** — Moyen
- Images : `07-split` (volet bas, voiture blanche à 291 km/h, roue 1800–1880, 1120–1200), `05b-chase` (voiture de gauche 280–460, 1130–1340 à 181 km/h), `10-dusk` (2090–2150, 800–870).
- Ce qu'on voit : cinq branches de jante parfaitement nettes, comme à l'arrêt ; aucun signe de rotation, alors que les pneus du joueur reçoivent des hachures de vitesse. Les voitures paraissent posées sur la piste.
- Résultat attendu : une rotation suggérée graphiquement sur toutes les voitures (jante fondue en disque, traits concentriques, hachures), cohérente avec le traitement des pneus du joueur.

**10. Le cockpit garde ses couleurs de plein jour quel que soit le circuit.** — Moyen
- Images : `10-dusk` (cockpit 0–2560, 880–1440), comparé à `02-straight`, `09-desert`, `11-docks`.
- Ce qu'on voit : pneu, nez blanc et gants ont exactement la même teinte dans les quatre thèmes ; au crépuscule, le nez reste blanc froid et le rouge reste vif sur un asphalte violacé et sous un ciel orange.
- Résultat attendu : une voiture du joueur colorisée dans l'ambiance de la scène (blancs réchauffés, ombres teintées au crépuscule), comme le sont la piste et les décors.

**11. Grammaire de la vitesse incomplète : traits aléatoires dans le ciel, pas d'onomatopée.** — Moyen
- Images : `seq-straight-0` à `5` (ciel 560–2560, 0–330), `05-exterior` (trait blanc 360–760, 80–280 qui traverse le grand sapin), `02-straight` (1900–2560, 0–240, et absence de tout lettrage sonore à 289 km/h).
- Ce qu'on voit : des aiguilles blanches et bleu sombre posées sur le ciel, les arbres et derrière l'interface, sans lien avec un objet en mouvement ; d'une image à l'autre elles apparaissent, glissent et disparaissent en 2 à 4 images (recadrages `seq-sky-R`, `seq-sky-L`, `t05-pine-1x`). Elles évoquent des rayures ou de la pluie plus que la vitesse. Aucune onomatopée de moteur n'accompagne la pleine vitesse.
- Résultat attendu : des lignes de vitesse fonctionnelles, attachées aux voitures et au sol, qui guident la lecture des trajectoires, et un bruitage dessiné original intégré à l'image à haute vitesse.

**12. Chaussée coupée en deux tons par une frontière rectiligne.** — Moyen
- Images : `seq-straight-0` (frontière 1290–1400, 640–1060), `02-straight` (bande 900–1600, 640–1060), `05-exterior` (1150–1260, 1000–1440).
- Ce qu'on voit : la moitié gauche de la piste est gris clair, la moitié droite gris foncé, séparées par un bord droit et dur qui file jusqu'à l'horizon, doublé d'un mince coin sombre (recadrage `q-seq0-road-b`). On le lit comme une couture, pas comme une ombre portée ni comme une trace de gomme.
- Résultat attendu : un asphalte dont les variations se lisent pour ce qu'elles sont (trajectoire gommée aux bords irréguliers, ombres portées d'objets identifiables, rapiéçages dessinés).

**13. Mur des stands : panneaux répétés, base en escalier, mécaniciens en basse définition.** — Moyen
- Images : `01-grid` et `02-straight`, mur 1380–2560, 600–800 ; base en dents 1740–1940, 690–760 (`01-grid`) ; personnages 2000–2560, 200–620 (`01-grid`) et 2140–2300, 500–590 (`02-straight`).
- Ce qu'on voit : la suite « P 17 », « P 18 », « P3 +0.4 » revient à l'identique tout le long du mur, tous les stands portent la même enseigne et le même « BOX 08 » ; le pied du mur avance en marches contre l'asphalte ; les mécaniciens sont des bustes sommaires aux bords mous (recadrages `g01-pitwall-base-2x`, `g01-pit-people-2x`).
- Résultat attendu : des panneaux et des stands variés, un pied de mur continu, des personnages au niveau de ceux des tribunes.

**14. Écran partagé horizontal : cockpit sectionné, on ne pilote plus de l'intérieur.** — Moyen
- Image : `07-split`, bandes 0–2560, 560–720 et 0–2560, 1280–1440 ; pointe d'antenne orpheline 1270–1290, 690–720.
- Ce qu'on voit : de chaque voiture ne restent que le sommet des deux pneus et les rétroviseurs sur leurs tiges, tranchés par le bord du volet ; ni nez, ni volant, ni mains, ni compte-tours (recadrage `s07-half`).
- Résultat attendu : une composition pensée pour le format bas — un poste de pilotage reconnaissable et entier dans chaque volet, instruments compris.

**15. Écran partagé vertical : demi-rétroviseurs accolés sur la couture, haut de case vide.** — Moyen
- Image : `07b-split-vertical`, couture 1170–1400, 690–790 ; ciel vide 0–2560, 230–500.
- Ce qu'on voit : le rétroviseur droit du joueur 1 et le gauche du joueur 2, coupés par le bord, se rejoignent et forment un seul rétroviseur bicolore à cheval sur le trait ; les pneus intérieurs se touchent de la même façon (recadrage `v07b-center-seam-2x`). Les deux cinquièmes supérieurs de chaque volet sont un ciel sans contenu.
- Résultat attendu : deux cases étanches, chaque cockpit contenu dans la sienne, et un cadrage qui emploie la hauteur disponible.

**16. Sous-titre du jeu recouvert par l'ombre du titre.** — Moyen
- Images : `08-menu` et `08b-menu-circuit`, zone 1540–2010, 200–245.
- Ce qu'on voit : « ÉDITION BANDE DESSINÉE » passe sous l'ombre portée noire de « VIRAGE GP » ; le haut des lettres est mangé (recadrage `m08-title-2x`).
- Résultat attendu : un sous-titre entièrement lisible, détaché du titre.

**17. Page de circuit sans dessin.** — Moyen
- Image : `08b-menu-circuit`, carte 40–1490, 40–980 ; case inférieure 40–1410, 1000–1400.
- Ce qu'on voit : un aplat vert uni traversé d'un filet gris pour le tracé, puis une grande case presque vide (deux lignes de texte). Aucun élément dessiné ne présente le lieu, alors que les décors en course sont le point fort du jeu.
- Résultat attendu : une présentation du circuit au niveau d'une case de BD (plan illustré ou vue du site), sans grand vide.

**18. Vue extérieure : voiture du joueur au trait fin et uniforme, détails approximatifs.** — Moyen
- Image : `05-exterior`, voiture 660–1640, 540–1040 ; bras posés sur la coque 820–1055, 810–880 et 1195–1430, 810–850 ; rétroviseurs 1000–1055 et 1320–1380, 680–710.
- Ce qu'on voit : un contour d'épaisseur constante, bien plus fin que celui du cockpit et des arbres voisins ; des bras de suspension à bout carré posés sur la carrosserie ; des rétroviseurs en rectangles gris pleins ; un pilote sans épaules (recadrage `x05-player-1x`).
- Résultat attendu : le même encrage modulé que la vue cockpit et un niveau de détail mécanique cohérent entre les deux vues.

**19. Tribunes sans épaisseur à leur extrémité.** — Moyen
- Images : `05-exterior` (1900–1940, 355–610), `04-overtake` (880–930, 470–600).
- Ce qu'on voit : la tribune se termine par une arête verticale nette, sans pignon ni retour, comme un décor de carton planté le long de la piste (recadrages `e05-tribune-end-3x`, `o04-tribune-end-2x`).
- Résultat attendu : un bâtiment lu en volume, avec une face latérale dessinée.

**20. Bac à gravier : semis de rectangles.** — Moyen
- Image : `06-collision`, zone 700–2560, 640–1060.
- Ce qu'on voit : sur l'aplat beige, des rectangles gris-beige de tailles diverses et des bandes concentriques régulières ; l'ensemble ressemble à un motif appliqué, pas à du gravier dessiné (recadrage `k06-sand-1x`).
- Résultat attendu : un gravier suggéré par le dessin (grains, sillons, traces de roues) dans la même écriture que l'herbe et l'asphalte.

### Mineurs

**21. Tiges de rétroviseurs filiformes barrant les pneus.** — Mineur
- Images : vues cockpit, par exemple `02-straight` : 225–275 et 2285–2335, 880–1440.
- Ce qu'on voit : deux tiges verticales sans embase ni carénage, hautes de 560 px, qui coupent chaque pneu de haut en bas.
- Résultat attendu : un support de rétroviseur crédible et moins envahissant.

**22. Tremblement d'un pixel de tout le cockpit.** — Mineur
- Images : `seq-straight-0` à `5` (décalage vertical de 1 px entre 0→1, 1→2 et 3→4, nul entre 2→3 et 4→5 ; recadrage `seq-diff-01` contre `seq-diff-23`).
- Ce qu'on voit : trop faible pour se lire comme une vibration, assez pour faire vibrer les traits fins du compte-tours.
- Résultat attendu : une vibration franchement lisible ou une image stable.

**23. Horizon : bord de piste crénelé et raccords de rails visibles.** — Mineur
- Images : `seq-straight-0` (bord 900–1300, 640–700 ; raccord de rail 1700–1760, 610–650).
- Ce qu'on voit : le filet noir qui borde la ligne blanche avance en marches d'escalier ; le rail lointain, mince et simple, se raccorde par un décrochement au rail proche, double et plus haut (recadrages `seq-horizon-edge-L-4x`, `j-seq0-rail-join-4x`).
- Résultat attendu : des lignes de fuite lisses et des barrières continues jusqu'à l'horizon.

**24. Buisson tranché par le rail.** — Mineur
- Image : `05-exterior`, zone 495–520, 615–665.
- Ce qu'on voit : le feuillage est coupé net à la verticale au contact du rail (recadrage `e05-bush-rail-3x`).
- Résultat attendu : un recouvrement naturel entre végétation et barrière.

**25. Onomatopée « CRAC ! » dans la police de l'interface.** — Mineur
- Image : `06-collision`, zone 760–1400, 260–470.
- Ce qu'on voit : un lettrage géométrique arrondi, identique en esprit aux cartouches, posé dans le ciel au-dessus des arbres, à distance du point d'impact (340–800, 500–1000).
- Résultat attendu : une onomatopée dessinée, propre au jeu, qui jaillit du choc.

**26. Chiffres de vitesse aux contours fusionnés.** — Mineur
- Images : `02-straight` (30–220, 165–235), séquence (recadrage `seq-speed-all`).
- Ce qu'on voit : les contours noirs épais des trois chiffres se soudent en une seule masse.
- Résultat attendu : des chiffres détachés les uns des autres.

**27. Séparation des écrans partagés par un simple filet.** — Mineur
- Images : `07-split` (0–2560, 716–724), `07b-split-vertical` (1276–1284, 0–1440).
- Ce qu'on voit : un trait noir fin, sans gouttière ni cadre de case, alors que l'interface emploie partout le vocabulaire de la planche.
- Résultat attendu : deux cases de bande dessinée séparées par une vraie gouttière.

**28. Menu principal : seconde case redondante et à moitié vide.** — Mineur
- Image : `08-menu`, zone 40–1410, 1000–1400.
- Ce qu'on voit : un recadrage de la même voiture que la case du dessus, et une moitié gauche crème occupée par un seul cartouche.
- Résultat attendu : une seconde case qui apporte une autre image (autre angle, autre instant).

**29. Bandeaux publicitaires alternés mécaniquement.** — Mineur
- Image : `04-overtake`, zone 1580–2370, 540–620.
- Ce qu'on voit : « ORVANE » et « GOMMEX » se succèdent en alternance stricte sur toute la longueur.
- Résultat attendu : une suite d'annonceurs moins régulière.

## 4. Ce qui fonctionne bien (à préserver)

- **Les arrière-plans.** Tribunes peuplées et lisibles (`03-corner`, 0–900, 120–660), bâtiment des stands en perspective (`02-straight`), collines étagées dont la saturation baisse avec la distance, skyline des docks en silhouettes gris-bleu (`11-docks`), montagnes enneigées (`05b-chase`), nuages en aplats à deux tons.
- **L'encrage des décors.** Arbres et sapins au contour épais et modulé, trois tons d'aplat, nets à 100 % (`t05-pine-1x`).
- **L'interface.** Cartouches crème inclinés à filet noir et ombre portée, cartouche jaune des temps façon récitatif, bandeaux « DÉPASSEMENT ! P10 » : vocabulaire de planche cohérent, lisible et parfaitement stable d'une image à l'autre.
- **Les pneus du joueur.** Lisses à l'arrêt, hachurés en roulant, hachures qui changent d'une image à l'autre : la rotation est rendue par un moyen graphique.
- **Le compte-tours et le rapport.** Lisibles en un coup d'œil ; le volant et les mains accompagnent le virage (`03-corner`).
- **L'éclat d'impact** (`06-collision`, 340–800, 500–1000) : net, encré, bien dans le ton.
- **La continuité de l'animation.** Sur les six images, arbres, spectateurs, glissières et concurrentes progressent régulièrement, sans saute ni apparition brusque.
- **Les palettes par thème** et le dégradé du ciel au crépuscule ; les livrées bien différenciées des concurrentes et leurs ombres portées sur la piste.
- **Le principe du menu en planche** (cases, titre lettré, cartouche de récitatif).

## 5. Décompte

- **Graves : 5** (n° 1 à 5)
- **Moyens : 15** (n° 6 à 20)
- **Mineurs : 9** (n° 21 à 29)
