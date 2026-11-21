# Revue artistique indépendante

## Méthode

À chaque itération, un **critique distinct** (un sous-agent neuf, sans mémoire des itérations
précédentes) reçoit uniquement :

- le brief `work/reviews/critic-brief.md` (rôle, 13 critères, échelle Grave / Moyen / Mineur) ;
- deux textes de référence : `docs/research/comic-art-reference.md` (propriétés générales de
  la BD automobile franco-belge contemporaine) et `docs/research/reference-notes-for-critic.md`
  (description textuelle de l'écran de course du jeu de 1993 cité comme référence de genre) ;
- les captures réelles du jeu en 2560×1440 : 14 vues fixes (grille, ligne droite, virage,
  dépassement, vues extérieures, collision, écrans partagés, menus, trois autres thèmes) et
  six images consécutives à 1/60 s pour l'animation.

Il n'a accès **ni au code, ni à la charte interne, ni aux explications du développeur**, et ne
lance pas le jeu. Il peut recadrer et agrandir les images. Les rapports bruts sont conservés
tels quels dans `work/reviews/review-N.md`, les recadrages de preuve dans
`work/reviews/crops/review-N/`, les captures dans `work/renders/review-N/`.

Limites de la méthode, à garder en tête : les critiques jugent des **images fixes** (et une
courte séquence), pas le jeu en mouvement sur un écran ; aucune image de bande dessinée réelle
ne leur est fournie (références textuelles seulement) ; ce sont des modèles, pas des
directeurs artistiques humains.

## Itération 1

Rapport : `work/reviews/review-1.md` — **5 graves, 15 moyens, 9 mineurs**.
Notes : dessin 3 ; précision mécanique 2 ; encrage 3 ; colorisation 3,5 ; perspective 3,5 ;
cohérence 2,5 ; lisibilité 4 ; vitesse 3 ; animation 3,5 ; continuité des formes 2,5 ;
scintillement 3,5 ; déformations 2,5 ; arrière-plans 4.

| N° | Gravité | Défaut relevé | Suite donnée |
|---|---|---|---|
| 1 | Grave | Voitures concurrentes « modelées » plus que dessinées : contour filiforme, arêtes molles ou en escalier | Trait de silhouette doublé (même poids que le cockpit), jantes dessinées en rotation, fond plat qui ne traverse plus les roues arrière (cause des escaliers), contour raffermi quand un dessin est agrandi, teinte d'ambiance du lieu |
| 2 | Grave | Collision : mur de pneus et spectateurs grossis jusqu'au flou | Barrières dessinées à définition double ; un objet affiché à plus de 2,2 fois sa taille d'encrage s'efface au lieu d'être grossi ; contour raffermi à l'agrandissement. Un dessin bitmap vu de très près reste moins net qu'un dessin vectoriel : atténué, pas supprimé |
| 3 | Grave | Crépuscule : masse grise géante et floue devant une voiture | C'était une bouffée de fumée de pneu : taille à l'écran plafonnée, estompée près de la caméra, émise seulement lors d'une vraie glissade, dessin plus clair et plus net |
| 4 | Grave | Rétroviseurs : même vignette fixe partout | Rétroviseurs dynamiques : ciel, relief, bas-côté et route aux couleurs du lieu, et voitures qui suivent réellement (position, écart, livrée) |
| 5 | Grave | Masse noire sur deux boutons de la page circuit | Défaut de **capture**, pas du jeu : l'image avait été prise pendant le volet de transition entre deux pages (0,3 s). Le script attend désormais la fin de la transition |
| 6 | Moyen | Triangles de suspension arrêtés dans le vide, aileron avant en bandes plates | Points d'ancrage ramenés sur la coque. Aileron avant inchangé (vu presque par la tranche depuis le poste de pilotage) |
| 7 | Moyen | Jantes avant lisses | Face intérieure des roues : porte-moyeu, disque de frein à fentes (elles tournent, puis se fondent en arcs à haute vitesse), étrier |
| 8 | Moyen | Gants-moufles, bras en planches | Mains redessinées : quatre doigts séparés et inégaux, plis d'articulation, manchette et sangle ; manches galbées avec couture et plis |
| 9 | Moyen | Roues des concurrentes figées à haute vitesse | Jantes dessinées comme des disques en rotation (arcs concentriques) sur toutes les voitures en course |
| 10 | Moyen | Cockpit aux couleurs de plein jour au crépuscule | Teinte d'ambiance par thème appliquée au cockpit et aux voitures |
| 11 | Moyen | Traits de vitesse aléatoires dans le ciel ; pas d'onomatopée de moteur | Traits longs, au sol uniquement, de part et d'autre de la route, durant une bonne fraction de seconde ; onomatopée du moteur à pleine charge |
| 12 | Moyen | Chaussée coupée en deux gris par un bord rectiligne | Bande de gomme aux bords effilochés en traits de plume |
| 13 | Moyen | Mur des stands : panneaux répétés, pied en escalier, mécaniciens peu définis | Pied du mur corrigé (le test d'occultation par les crêtes rognait le bas de chaque tronçon — valable pour toutes les barrières), définition doublée. La **répétition** des panneaux demeure (tuile unique) |
| 14 | Moyen | Écran partagé haut/bas : cockpit sectionné | Champ élargi et cockpit réduit : poste de pilotage entier (roues, volant, mains, compte-tours, rétroviseurs) dans chaque case |
| 15 | Moyen | Écran partagé gauche/droite : demi-rétroviseurs accolés, haut de case vide | Cockpit contenu dans chaque case, horizon remonté, gouttière blanche et cadre encré entre les cases |
| 16 | Moyen | Sous-titre mangé par l'ombre du titre | Sous-titre descendu |
| 17 | Moyen | Page de circuit sans dessin | Plan illustré (panorama du lieu, bois, tribune et stands) et vue du site dans la case inférieure |
| 18 | Moyen | Vue extérieure : trait fin et uniforme sur la voiture du joueur | Même correction que le n° 1 (mêmes dessins). Rétroviseurs et détails de suspension de la voiture inchangés |
| 19 | Moyen | Tribunes sans épaisseur à leur extrémité | Pignon encré à l'extrémité des tribunes, stands et façades |
| 20 | Moyen | Bac à gravier en semis de rectangles | Sillons de ratissage fins et interrompus, cailloux ronds de tailles variées |
| 21 | Mineur | Tiges de rétroviseurs filiformes | Non traité |
| 22 | Mineur | Tremblement d'un pixel du cockpit | Vibration nulle à vitesse moyenne, franche près de la vitesse maximale |
| 23 | Mineur | Bord de piste crénelé à l'horizon, raccords de rails | Raccords de rails : même correction que le pied du mur (n° 13). Crénelage lointain non traité |
| 24 | Mineur | Buisson tranché par le rail | Non traité |
| 25 | Mineur | Onomatopée loin du point d'impact | Mot rapproché de l'éclat |
| 26 | Mineur | Chiffres de vitesse aux contours soudés | Non traité |
| 27 | Mineur | Écrans partagés séparés par un simple filet | Gouttière et cadres (voir n° 15) |
| 28 | Mineur | Seconde case du menu redondante | Non traité |
| 29 | Mineur | Bandeaux publicitaires en alternance stricte | Non traité |

## Itération 2

Captures : `work/renders/review-2/` (après les corrections de l'itération 1).
Rapport : `work/reviews/review-2.md` — **2 graves, 15 moyens, 7 mineurs**.
Notes : dessin 3,5 ; précision mécanique 3 ; encrage 3 ; colorisation 4 ; perspective 3,5 ;
cohérence 3 ; lisibilité 4 ; vitesse 2,5 ; animation 3,5 ; continuité des formes 2,5 ;
scintillement 3 ; déformations 3 ; arrière-plans 4.

Ce deuxième critique ne connaissait pas le premier rapport. Il ne relève plus les défauts
graves 1, 3, 4 et 5 de l'itération 1 ; il confirme le n° 2 (collision) et en trouve un nouveau,
**introduit par une correction de l'itération 1** (la bande de gomme « effilochée »).

| N° | Gravité | Défaut relevé | Suite donnée |
|---|---|---|---|
| 1 | Grave | Traces de gomme en rectangles empilés au centre de l'écran, changeant d'une image à l'autre | Régression de l'itération 1, retirée : bande de gomme au bord sinueux à deux échelles, avec frange plus claire ; plus aucune découpe par voies |
| 2 | Grave | Collision : premier plan flou, agrandi et translucide, spectateurs fantômes | Plus rien n'est dessiné à demi transparent : un objet trop grossi est omis (et non estompé), le voile blanc de l'impact est réduit à un bref éclaircissement, les barrières basses ne sont plus dessinées au-delà de trois fois leur taille d'encrage contre la caméra |
| 3 | Moyen | Étoile d'impact floue à côté de l'éclat net | Étincelles plafonnées en taille et jamais contre l'objectif ; éclats opaques qui sortent en rétrécissant |
| 4 | Moyen | Forme translucide illisible (fumée) sur une voiture | Fumée toujours opaque : elle gonfle, rétrécit, n'est pas dessinée contre la caméra |
| 5 | Moyen | Deux régimes d'encrage (voiture du joueur fine, autres voitures empâtées) | Trait des voitures en course ramené de 2,1 à 1,7 cm. L'écart de netteté entre le cockpit (dessiné à sa taille) et les voitures proches (dessins agrandis) demeure |
| 6 | Moyen | Voitures proches : grands aplats vides, aucun numéro ni marquage | **Non traité** : les dessins de voitures sont partagés par toutes les écuries ; les numéros n'apparaissent que sur les illustrations |
| 7 | Moyen | Cockpit : moyeu en « boîte », triangles sans rotules, entailles sur les tubes | Tubes sans entailles (recouvrement des tronçons), rotules aux extrémités, étrier de frein rouge plus petit |
| 8 | Moyen | Vue extérieure : bras de suspension non raccordés | Rotules aux extrémités des bras (mêmes dessins) ; raccord à la coque inchangé |
| 9 | Moyen | Pilote réduit à un casque sur une collerette | Épaules agrandies. Ni bras ni volant sur les vues extérieures |
| 10 | Moyen | Illustrations de menu en retrait par rapport au jeu | **Non traité** |
| 11 | Moyen | Onomatopée de moteur petite, sans source, chevauchant un panneau | Plus grande, placée bas à gauche près de la voiture, entrée et sortie par changement de taille. Lettrage identique à chaque fois |
| 12 | Moyen | Vitesse peu lisible en image fixe | Traits de vitesse au sol plus nombreux et plus proches de la route à haute vitesse. Les décors restent nets (pas de flou de mouvement, par choix de style) |
| 13 | Moyen | Rétroviseurs sur de longs piquets, reflets sans décor | Supports passés derrière les roues (seul un court tronçon dépasse) ; reflets avec barrières et voitures plus grandes |
| 14 | Moyen | Buisson qui tranche la glissière | **Non traité** |
| 15 | Moyen | Masse d'arbres coupée à la verticale, grillage qui se dissout | **Non traité** (fin de bande de forêt sans transition) |
| 16 | Moyen | Ombres de l'herbe en bandes horizontales | Bandes de tonte désormais parallèles à la piste (elles fuient avec elle) |
| 17 | Moyen | Volumes gris vides (pignons, panneaux) | Pignons avec fenêtres et porte |
| 18 | Mineur | Compte-tours : lettrage flou, aiguille sur un chiffre | Non traité |
| 19 | Mineur | Mur de pneus presque figé d'une image à l'autre | Non traité (motif répété dont le pas est proche de l'avance par image à cette vitesse) |
| 20 | Mineur | Liserés lointains hachés | Non traité |
| 21 | Mineur | Écran partagé : compte-tours minuscule | Non traité |
| 22 | Mineur | Voitures lointaines pixellisées | Non traité |
| 23 | Mineur | Pouce du gant détaché | Non traité |
| 24 | Mineur | Désert : arrière-plan clairsemé | Non traité |

## Itération 3

Captures : `work/renders/review-3/` (après les corrections de l'itération 2).
Rapport : `work/reviews/review-3.md` — **2 graves, 16 moyens, 10 mineurs**.
Notes : dessin 3,5 ; précision mécanique 2,5 ; encrage 3 ; colorisation 4 ; perspective 3,5 ;
cohérence 3 ; lisibilité 4 ; vitesse 3 ; animation 4 ; continuité des formes 2,5 ;
scintillement 3,5 ; déformations 3,5 ; arrière-plans 4.

Ce troisième critique ne relève plus les défauts graves de l'itération 2 (marques au sol,
translucidités). Ses deux défauts graves sont de nouveau liés à des corrections précédentes :
la coupe du mur de pneus vient de la règle « ne pas dessiner une barrière trop grossie »
(itération 2), le bandeau d'horizon vient de la page de circuit illustrée (itération 1).

| N° | Gravité | Défaut relevé | Suite donnée |
|---|---|---|---|
| 1 | Grave | Mur de pneus au contact : coupe verticale, pneus étirés et flous | La coupe est supprimée. À la place, l'œil du pilote garde 2,3 m de distance latérale avec une barrière (la voiture, elle, la touche toujours) et les barrières sont dessinées à définition triple |
| 2 | Grave | Bandeau d'horizon du plan de circuit : rectangle collé, coutures, coupe nette | Panorama peint à sa taille d'origine, juxtaposé sur toute la largeur, sans la brume située sous l'horizon ; la vue du site et le plan sont deux registres séparés par une gouttière |
| 3 | Moyen | Vibreurs coupés à l'horizontale | Les vibreurs s'effilent en pointe à leurs extrémités. Les bandes restent perpendiculaires à la piste |
| 4 | Moyen | Poignets tranchés par deux verticales | Avant-bras redessinés à l'intérieur de la largeur du dessin (c'était son bord qui les coupait) |
| 5 | Moyen | Rétroviseurs sur des tiges derrière les roues, différents de la vue extérieure | **Non traité** : la position des rétroviseurs dans la vue cockpit est une convention de lisibilité, pas la géométrie de la voiture |
| 6 | Moyen | Étriers en brique rouge, intérieur de roue griffonné | Étrier réduit, en métal ; fentes du disque moins nombreuses et plus courtes |
| 7 | Moyen | Voiture vedette (vue extérieure, menu) : aspect de maquette 3D filtrée | **Non traité** (casque sphérique, buste sans bras, contour du capot au menu) |
| 8 | Moyen | Concurrents simplifiés : jantes pleines, aucun marquage | Jantes en rotation avec moyeu, voile et rebord distincts. Toujours **ni numéro ni marquage** sur les voitures en course |
| 9 | Moyen | Décors proches, voitures à mi-distance et reflets plus mous que le cockpit | **Non traité** : limite de la technique (dessins stockés en images, agrandis ou réduits) |
| 10 | Moyen | Bords de piste lointains en escalier, changeant d'une image à l'autre | **Non traité** : la route est calculée ligne par ligne, sans lissage vertical |
| 11 | Moyen | Buisson dessiné par-dessus le rail | Chaque objet est désormais dessiné juste avant la première bande située plus près de la route que lui |
| 12 | Moyen | Bâtiment frontal collé à une tribune en perspective | Pignons moins profonds, fenêtres réservées aux bâtiments ; ils restent des aplats vus de face |
| 13 | Moyen | Lettres de l'interface qui se chevauchent | Approches élargies, davantage pour I, L, T et 1 |
| 14 | Moyen | Onomatopée unique posée comme une étiquette | Trois graphies et couleurs, côté gauche ou droit, placée hors des rétroviseurs selon la forme de la vue, entrée en grossissant |
| 15 | Moyen | Vitesse peu marquée en image fixe | **Non traité** au-delà des traits au sol (pas de flou des décors, par choix de style) |
| 16 | Moyen | Cases du menu : fonds vides, même dessin répété | **Non traité** |
| 17 | Moyen | Plan de circuit : arbres en billes brillantes, plan et élévation mêlés | Bosquets en aplats encrés vus du dessus ; deux registres séparés (voir n° 2) |
| 18 | Moyen | Forêt et grillage terminés par une verticale | **Non traité** |
| 19–28 | Mineur | Panneaux au texte inversé, cartouche de vitesse, reflets simplifiés, raccord rail/pneus, zone claire de l'asphalte, rectangle pâle en écran partagé, stries des tubes, apparition de l'onomatopée, spectateurs sans visage, sapin répété | Apparition de l'onomatopée traitée (n° 14) ; le reste non traité |

## Itération 4

Captures : `work/renders/review-4/` (après les corrections de l'itération 3 ; copies JPEG
versionnées dans `work/renders/final/`).
Rapport : `work/reviews/review-4.md` — **1 grave, 9 moyens, 13 mineurs**.
Notes : dessin 3,5 ; précision mécanique 3,5 ; encrage 3 ; colorisation 4 ; perspective 4 ;
cohérence 3 ; lisibilité 4 ; vitesse 3 ; animation 3,5 ; continuité des formes 3 ;
scintillement 4 ; déformations 4 ; arrière-plans 4.

Ce quatrième critique ne relève plus les deux défauts graves de l'itération 3 (mur de pneus au
contact, bandeau d'horizon du menu). Son exécution a été interrompue deux fois par la limite
d'utilisation du service puis reprise ; le rapport est complet.

| N° | Gravité | Défaut relevé | Suite donnée |
|---|---|---|---|
| 1 | Grave | Massif forestier tranché par une verticale parfaite | Corrigé après ce rapport : un arbre est dessiné aux extrémités des bandes de forêt **et** là où la bande se replie derrière elle-même dans un virage (c'était le cas relevé). Vérifié par le développeur sur une capture du même endroit, **pas par un critique** |
| 2 | Moyen | Rai translucide (trait de vitesse) passant sur deux voitures | Traits de vitesse amincis et opaques. Ils passent toujours devant les voitures |
| 3 | Moyen | Changement d'angle d'un adversaire en une seule image | Non traité (25 dessins par demi-tour, soit un pas de 7,5°) |
| 4 | Moyen | Adversaires proches mous et empâtés à côté d'un cockpit net | Non traité (dessins stockés en images, agrandis de près) |
| 5 | Moyen | Pilotes sans bras, mains ni volant en vue extérieure et au menu | Non traité |
| 6 | Moyen | Avant-bras du pilote en planche rigide | Non traité |
| 7 | Moyen | Onomatopées typographiées, non intégrées à l'image | Non traité |
| 8 | Moyen | Figurants en pictogrammes, sans visage, clonés | Non traité |
| 9 | Moyen | Trace sombre ondulante au milieu de la piste (bande de gomme) | Non traité |
| 10 | Moyen | Vitesse peu traduite hors de la chaussée | Non traité |
| 11–23 | Mineur | Gravier en semis de pois, raccord mer/relief, fin de grillage, rectangle pâle en écran partagé, voitures des rétroviseurs en écran partagé, cartouche de vitesse, répétitions de la ligne des stands, jantes en disques, moyeu et compte-tours, tremblement d'un pixel du cockpit, lettrages des menus, bas des murs de pneus, voiture noire en masse | Non traités |

## Bilan

| Itération | Graves | Moyens | Mineurs | Notes les plus basses |
|---|---|---|---|---|
| 1 | 5 | 15 | 9 | précision mécanique 2 ; cohérence, continuité, déformations 2,5 |
| 2 | 2 | 15 | 7 | vitesse 2,5 ; continuité 2,5 |
| 3 | 2 | 16 | 10 | précision mécanique 2,5 ; continuité 2,5 |
| 4 | 1 | 9 | 13 | encrage, cohérence, vitesse, continuité 3 |

- **L'objectif fixé (plus aucun défaut au-dessus de « mineur ») n'est pas atteint** : le dernier
  rapport compte encore un défaut grave (corrigé ensuite, sans nouvelle contre-expertise) et
  neuf défauts moyens, dont huit ne sont pas traités.
- La tendance est à l'amélioration (5 → 1 grave, 15 → 9 moyens, aucune note sous 3 au dernier
  rapport), mais chaque critique neuf, qui ne connaît pas les rapports précédents, a trouvé des
  défauts que les autres n'avaient pas relevés ; trois défauts graves sur dix étaient des effets
  de bord de corrections précédentes.
- Ce que les quatre critiques jugent solide, de façon constante : les arrière-plans et les
  palettes par circuit (4), la lisibilité (4), l'interface en cartouches, le cockpit et son
  animation, la stabilité de l'image d'une image à l'autre.
- Ce qui revient dans tous les rapports et n'est pas résolu : les voitures concurrentes vues
  de près (dessins agrandis, sans numéro ni marquage), l'écart de netteté entre le cockpit et
  le reste, la vitesse peu lisible sur image fixe, les pilotes sans bras en vue extérieure,
  les répétitions des décors en bandes.
