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
