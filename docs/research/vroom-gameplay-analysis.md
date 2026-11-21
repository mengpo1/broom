# Analyse d'une vidéo de gameplay de référence (collisions, décollages, perspective)

Ce document décrit ce qui est **observable** dans une vidéo de gameplay du jeu de 1991 cité
comme référence de genre, pour guider l'évolution des collisions et de la mise en scène des
accidents dans Virage GP. Aucune ligne de code n'a été modifiée pour cette analyse.

> **Portée.** On relève des *comportements* (durées, pertes de vitesse, mouvements de la vue).
> Virage GP reste un jeu original : aucun dessin, écran, nom de circuit ou sprite de la vidéo
> n'a vocation à être repris. Les images de `work/reference-frames/` sont des extraits d'une
> vidéo tierce conservés pour l'analyse ; elles ne sont ni utilisées ni embarquées par le jeu.

## 0. Source, méthode, limites

| | |
|---|---|
| Fichier analysé | `Vroom_by_Lankhor_atari_st_360p_25fps_H264-128kbit_AAC.mp4` (fourni par l'utilisateur, désigné `vroom-gameplay.mp4` dans la demande ; **non copié dans le dépôt**) |
| SHA-256 | `3c902ecf391aea6b52b49c2cef136f1637db0f6e579029c8ff5d73eb5ce0b186` |
| Format | H.264, 576×360, **25 images/s**, 8 409 images, 336,43 s ; AAC 44,1 kHz stéréo |
| Contenu | Mode arcade (« Score », « Stage », « Lap »). 0:00–3:04 : circuit désertique, « Stage 6 », tours 2 à 4. 3:04–3:10 : fondu. 3:10–5:36 : autre session, circuit verdoyant, « Stage 1 », tours 3 à 5, fin sur le texte « NEXT CIRCUIT » |

**Méthode.** FFmpeg a extrait les 8 409 images. Trois signaux ont été calculés sur toutes les
images pour ne manquer aucun événement : la ligne d'horizon (dernière ligne de la vue 3D
majoritairement « ciel »), la part de ciel dans la vue, et la présence de couleurs de feu. Les
vitesses sont lues **à l'œil** sur l'afficheur du volant, image par image, sur des planches
agrandies (un décodage automatique des chiffres a été tenté et abandonné : trop d'erreurs sur
une image 360p compressée). Les relevés bruts sont dans
`work/reference-frames/measurements.json`.

**Limites à garder en tête.**

- **60 images/s impossible** : la source est à 25 images/s. Les séquences de collision sont
  donc extraites à la cadence native, image par image (une image toutes les 40 ms).
- Le jeu lui-même ne produit qu'environ **18 images distinctes par seconde** (27 % des images
  vidéo sont des doublons de la précédente) : toute durée est connue à ± 1 image de jeu, soit
  ± 0,06 s environ.
- Les commandes du joueur (accélérateur, frein, volant) ne sont pas visibles : on ne peut pas
  toujours distinguer un freinage du joueur d'un ralentissement imposé par le jeu.
- L'afficheur de vitesse est souvent masqué par le gant quand le volant est tourné (chiffre
  des unités, parfois tout l'afficheur).
- **Un seul exemple** de chaque type d'accident aérien : les seuils de déclenchement ne
  peuvent pas être déduits, seulement encadrés.
- La vidéo montre l'édition d'origine en mode arcade (d'après le nom du fichier et l'écran) ;
  rien ne prouve que l'édition multijoueur de 1993 se comporte à l'identique.

**Convention.** Images numérotées à partir de 1 ; `t = (n − 1) / 25`. Positions verticales en
pixels de la vidéo (576×360) ; la vue 3D occupe les lignes 122 à 360 (238 lignes), le bas
étant recouvert par le cockpit. « Horizon à 299 » = ciel jusqu'au cockpit ; « 123 » = plus
aucune ligne de ciel.

## 1. Chronologie

| Repère | Horodatage | Images | Nature |
|---|---|---|---|
| — | 0:00–0:26 | 1–650 | Conduite normale, 240–310 km/h, dépassements sans contact |
| **E1** | 0:26,4–0:33,3 | 660–833 | Freinage fort derrière une voiture lente, puis suivi à 45–65 km/h — **sans contact** |
| **E2** | 0:35,96 | 900–903 | **Contact roue contre roue** côte à côte : étincelle, perte de vitesse instantanée |
| — | 0:37,4–0:38,6 | 936–966 | Passage sous une structure couverte (voir § 8) |
| — | 0:38–1:57 | 966–2936 | Conduite normale, pointes à 310–318 km/h |
| **E3** | 1:57,92–2:04,0 | 2949–3101 | **Roue sur roue par l'arrière → décollage, atterrissage en piqué, explosion, arrêt, redémarrage** |
| **E4** | 2:07,5–2:19,5 | 3189–3493 | **Six tamponnages par l'arrière** de la même voiture, sans décollage |
| — | 2:20–3:00 | 3500–4500 | Conduite normale |
| **E5** | 3:01,4–3:04,2 | 4536–4606 | Sortie de piste, **choc contre un panneau à chevrons → décollage**, glissade dans le sable, arrêt |
| — | 3:04–3:10 | 4606–4760 | Fondu au noir (montage) |
| — | 3:10–5:36 | 4760–8409 | Autre circuit ; aucun contact, aucun décollage ; tunnel, ponts, portiques (voir § 8) |

Contrôle d'exhaustivité : sur toute la vidéo, seules deux plages montrent une vue entièrement
dans le ciel (2952–2963 et 4546–4553) et une seule montre des couleurs de feu (2973–3004).

**Ce que la vidéo ne montre pas**, malgré une recherche spécifique : aucune **perte de roue**
(après l'explosion d'E3, les deux roues avant sont toujours dessinées, voir
`E3-…/cockpit-after-crash-zoom.jpg`), aucune collision avec un rail ou un mur (le circuit
désertique n'a pas de barrières), aucun accident entre adversaires, aucun tête-à-queue sur la
piste, aucun dégât visible sur les voitures.

## 2. E1 — Freinage derrière une voiture (0:26,4–0:33,3)

Images : `work/reference-frames/E1-braking-behind-car_0m26s/`.

1. **Horodatage** : freinage de 0:26,6 à 0:28,5 (images 666–713) ; suivi jusqu'à 0:33,3.
2. **Visible** : le joueur rattrape une voiture verte sur une ligne droite jalonnée de
   portiques. La voiture grossit, reste devant ; aucun éclat, aucune secousse brusque.
3. **Phases** : (a) approche à 256 km/h (image 660) ; (b) décélération régulière
   207 → 196 → 184 → 172 → 160 → 147 → 134 → 123 → 112 → 100 → 89 (images 682 à 704, une
   valeur toutes les deux images) ; (c) décélération plus douce 89 → 78 → 73 → 68 → 64 → 60
   (704 à 713) ; (d) suivi à 45–65 km/h pendant 4,5 s ; (e) ré-accélération à partir de 0:33,3.
4. **Paramètres estimés** : phase (b) = −11,5 à −12 km/h par image de jeu, soit
   **≈ −150 km/h par seconde (≈ 42 m/s²)**, constante de 207 à 89 km/h. Phase (c) ≈
   −60 km/h/s. Pendant le freinage l'horizon monte de 8 à 12 px (de 218 à 206–211), soit
   3,4 à 5 % de la hauteur de la vue : la vue **pique du nez**, puis revient dès que la
   décélération cesse.
5. **Faits / hypothèses** : la courbe de vitesse et le piqué sont des faits. Que la phase (b)
   soit un freinage du joueur est une **hypothèse** (commandes invisibles), renforcée par E5
   où l'on retrouve le même taux (312 → 249 km/h en 0,4 s, soit −157 km/h/s) avant le choc.
6. **Virage GP aujourd'hui** : freinage arcade 300 → 0 en 2,91 s et 100 → 0 en 1,30 s (soit
   29 et 21 m/s² en moyenne, `work/benchmarks/driving-report.json`), contre environ 2,0 s et
   0,67 s à taux constant dans la vidéo. Le piqué de la vue existe (`RaceView`, décalage de
   1,2 % de la hauteur au maximum).
7. **Écarts et corrections** : le piqué au freinage est 3 à 4 fois plus marqué dans la
   référence → proposition C5. Le freinage y est plus violent et indépendant de la vitesse →
   proposition C9 (optionnelle : c'est un choix de conduite, pas un défaut).

## 3. E2 — Contact roue contre roue, côte à côte (0:35,96)

Images : `work/reference-frames/E2-wheel-to-wheel-contact_0m36s/` (`contact-large.jpg`).

1. **Horodatage** : contact à l'image 900 (0:35,96) ; étincelle visible images 900–903.
2. **Visible** : le joueur double une voiture verte par la gauche, très près. Un disque rouge
   à cœur jaune d'environ 12 px apparaît exactement entre sa roue avant droite et la roue
   arrière gauche de la voiture verte. L'afficheur passe de « 14x » à « 5x » (unités masquées
   par le gant). Les deux voitures restent côte à côte, sans changement de cap visible.
3. **Phases** : (a) approche, 130–149 km/h (images 890–899) ; (b) contact : étincelle
   pendant 4 images vidéo (0,16 s, soit 3 images de jeu), vitesse tombée à 50–59 puis 40–49
   km/h ; (c) piqué de la vue : horizon à 227 à l'image du contact, puis 221 → 216 → **210**
   (images 906–907), retour à 227 à l'image 911 — 0,44 s au total (la ligne de base monte
   déjà de 216 à 223 dans les 0,25 s qui précèdent, d'où l'incertitude sur l'amplitude) ;
   (d) ré-accélération lente : +10 km/h toutes les 4 images, 117 km/h à l'image 930.
4. **Paramètres estimés** : perte **≈ 90 km/h en une image de jeu** (140–149 → 50–59) ;
   durée de l'étincelle 0,16 s ; piqué de 13 à 17 px, soit 5,5 à 7 % de la hauteur de vue ;
   ré-accélération ≈ 60 km/h/s.
5. **Faits / hypothèses** : faits = étincelle au point de contact, chute de vitesse dans la
   même image, tangage, absence d'embardée. Hypothèses = la voiture verte n'est pas
   pénalisée (elle ne ralentit pas visiblement) ; la ré-accélération lente tient au rapport
   engagé (un indicateur de grille de vitesses est visible au tableau de bord).
6. **Virage GP aujourd'hui** (`src/physics/collisions.js`) : boîtes orientées, impulsion à
   masses égales (restitution 0,35 en arcade), frottement de 12 % au plus, impulsion en
   lacet, tête-à-queue au-delà de 19 m/s de vitesse relative. Un frôlement latéral à faible
   vitesse relative ne coûte presque rien et écarte les deux voitures. Effets : éclat et
   onomatopée en surimpression d'écran, pas d'étincelle au point de contact.
7. **Écarts et corrections** : la référence punit le contact par une **perte de vitesse fixe
   et forte**, sans déviation ; Virage GP par une physique d'impulsion presque gratuite →
   propositions C3 et C4.

## 4. E3 — Roue sur roue par l'arrière : décollage, explosion, arrêt (1:57,92–2:04)

Images : `work/reference-frames/E3-launch-over-car-and-explosion_1m58s/`
(`phases-large-a.jpg`, `phases-large-b.jpg`, toutes les images de 1:57,40 à 2:04,36).

1. **Horodatage** : contact entre les images 2951 et 2952 (1:58,00–1:58,04).
2. **Visible** : à 262 km/h, sous un portique, le joueur arrive sur deux voitures : une
   bleu foncé droit devant, légèrement à gauche (centre vers 43 % de la largeur), une verte
   à droite. Une image plus tard la vue ne montre plus que le ciel. Elle bascule ensuite vers
   le sol ; les deux voitures réapparaissent juste devant, vues de près ; une boule de feu
   naît sur l'avant gauche du cockpit ; la voiture s'immobilise ; les adversaires s'éloignent.
3. **Phases** (horizon relevé image par image) :

   | Phase | Images | Durée | Vue | Vitesse affichée |
   |---|---|---|---|---|
   | a. Approche | 2948–2951 | — | horizon 226–227 puis 221 | 265 → 262 → 260 |
   | b. Cabré, ciel seul | 2952–2961 | 0,40 s | horizon hors champ en bas (299) | 258 → 240 (−2 par image vidéo) |
   | c. Bascule vers l'avant | 2962–2972 | 0,44 s | 290 → 259 → 227 → 194 → 164 → 128 | 238 → 228 |
   | d. **Atterrissage** | 2973 | 1 image | plus de ciel (123) | **228 → 35** |
   | e. Piqué, sol seul | 2973–2984 | 0,48 s | 123 | 35, 34, 27, 26, 25 |
   | f. Rebond | 2985–2988 | 0,16 s | 173 → 223 | 24 → 17 |
   | g. Second piqué | 2989–3012 | 0,96 s | 185 → 158 → 137 → 123 (tenu 0,60 s) → 128 | 10 → 2 → **0** (image 2994) |
   | h. Redressement | 3013–3017 | 0,20 s | 145 → 171 → 205 → 226 | 0 |
   | i. Arrêt, vue stable | 3018–3074 | 2,28 s | 221–223, image fixe | 0 |
   | j. Redémarrage | 3075 → | — | normale | 6, 13, 20, 27, 34, 42, 49, 55… |

   Explosion (en parallèle) : point rouge à l'atterrissage (2973) → croissance jusqu'à pleine
   taille (2985) → boule orange et jaune d'environ 60 px, 10 % de la largeur (2985–2996) →
   rouge sombre (2996–3001) → fumée noire (3002–3004) → deux panaches sombres de part et
   d'autre du cockpit (3001–3015). Durée totale **≈ 1,25 s** pour le feu, 0,6 s pour les
   panaches.
4. **Paramètres estimés** :
   - temps de vol (contact → atterrissage, repéré par le saut de vitesse) : **≈ 0,85 s** ;
   - décélération en l'air : −2 km/h par image vidéo, soit **−50 km/h/s**, linéaire ;
   - bascule de la vue : ≈ 33 px par image de jeu, soit **≈ 400 px/s** (1,7 hauteur de vue
     par seconde) ; amplitude : l'horizon traverse toute la vue, de sous le cockpit à
     au-dessus du bord supérieur ;
   - à l'atterrissage : vitesse **multipliée par ≈ 0,15** (228 → 35) en une image, puis
     35 → 0 en 0,84 s ;
   - immobilisation à 0 km/h : **3,2 s** (1:59,72 → 2:02,92) ; du contact au redémarrage :
     **4,9 s** ;
   - redémarrage : **0 → 99 km/h en 1,04 s**, 168 km/h à 2,0 s, 196 à 2,6 s, 209 à 3,0 s,
     221 à 3,4 s.
5. **Faits / hypothèses** : tout le tableau est factuel. Hypothèses : (H1) le déclencheur est
   un **chevauchement partiel par l'arrière** — roue avant gauche du joueur sur roue arrière
   droite de la voiture bleue —, ce que suggèrent la position des voitures une image avant et
   le côté de l'explosion ; (H2) la **vitesse relative élevée** distingue ce cas des
   tamponnages d'E4 ; (H3) la voiture heurtée n'est pas affectée (elle repart devant) ; (H4)
   l'explosion et l'arrêt tiennent soit à la nature de l'objet heurté (une voiture), soit à
   la violence de l'envol, puisque E5 (obstacle, paliers plus courts) n'en a pas ; (H5) les panaches sont de la fumée, pas des roues.
6. **Virage GP aujourd'hui** : un tel choc (vitesse relative supérieure à 19 m/s en arcade)
   déclenche un **tête-à-queue au sol** (`startSpin` : 1,1 à 2 s, décélération 12 m/s²),
   puis une remise en piste automatique après 0,7 s, avec voiture « fantôme ». Il n'existe ni
   état aérien, ni animation de tangage de la vue, ni explosion, ni arrêt complet sur place.
   Durée totale de pénalité comparable (2 à 3 s contre 4,9 s).
7. **Écarts et corrections** : c'est l'écart principal. Il manque un état « en l'air » et sa
   mise en scène → propositions C1, C2 et C7.

## 5. E4 — Tamponnages par l'arrière (2:07,5–2:19,5)

Images : `work/reference-frames/E4-rear-end-bumps_2m07s-2m20s/`.

1. **Horodatage** : six contacts aux images 3189, 3303–3305, 3357, 3393, 3447 et 3487
   (2:07,52 ; 2:12,08 ; 2:14,24 ; 2:15,68 ; 2:17,84 ; 2:19,44).
2. **Visible** : reparti de l'accident E3, le joueur reste collé derrière la voiture bleu
   foncé, dans l'axe, entre des portiques. À chaque contact la vitesse tombe d'un coup, la vue
   pique brièvement, un petit éclat rouge et jaune apparaît entre son nez et l'arrière de la
   voiture ; la voiture de devant ne bouge pas. Aucun décollage.
3. **Phases** d'un tamponnage : (a) rattrapage à +2 ou +3 km/h par image de jeu ; (b)
   contact : chute de vitesse en une image de jeu, parfois deux ; (c) piqué de la vue sur
   0,16 s puis retour en 0,24 s ; (d) retour à (a).
4. **Paramètres estimés** :

   | Contact | Avant → après (km/h) | Perte | Piqué de l'horizon |
   |---|---|---|---|
   | 1 (3189) | 145 → 60 | −85 | −13 px environ |
   | 2 (3303–3305) | 146 → 108 → 52 | −94 en deux images de jeu | −18 px |
   | 3 (3357) | 115 → 67 | **−48** | −13 px |
   | 4 (3393) | 104 → 56 | **−48** | −2 px |
   | 5 (3447) | 11x → 6x | ≈ −48 | −11 px |
   | 6 (3487) | 10x → 5x | ≈ −48 | −12 px |

   La perte unitaire est de **48 km/h** (deux mesures nettes) ; les contacts 1 et 2 valent à
   peu près le double. Piqué : 5 à 8 % de la hauteur de vue. Ré-accélération après contact :
   ≈ 25 à 35 km/h/s, bien plus lente qu'un départ arrêté.
5. **Faits / hypothèses** : faits = les six chutes, leur valeur, le piqué, l'absence de
   décollage. Hypothèses : la pénalité est un **décrément fixe par image de contact**
   (appliqué deux fois quand le chevauchement dure deux images) ; elle ne s'applique qu'au
   joueur ; la ré-accélération lente vient du rapport resté engagé.
6. **Virage GP aujourd'hui** : un contact dans l'axe à faible vitesse relative échange une
   impulsion : le joueur perd à peu près la moitié de l'écart de vitesse, la voiture de devant
   est poussée. Pas de pénalité fixe, pas de piqué spécifique (seulement une secousse d'écran).
7. **Écarts et corrections** : la référence rend le tamponnage **coûteux et lisible** (on
   perd 48 km/h, on le voit et on le sent) → proposition C3 ; piqué de la vue → C5.

## 6. E5 — Choc contre un panneau de bord de piste (3:01,4–3:04,2)

Images : `work/reference-frames/E5-launch-on-roadside-board_3m01s/` (`phases-large.jpg`).

1. **Horodatage** : contact entre les images 4545 et 4546 (3:01,76–3:01,80).
2. **Visible** : à la sortie d'une courbe à droite, le joueur élargit à gauche en freinant,
   franchit le vibreur et arrive droit sur un panneau à chevrons posé dans le sable (17 % de
   la largeur de vue une image avant). La vue passe au ciel, redescend sur un cactus, puis
   montre le sable, la piste restant à droite. La voiture glisse dans le sable en tournant
   sur elle-même, tremble, s'arrête. Pas d'explosion. Les gants ne sont plus visibles sur le
   volant de 3:02,4 à l'arrêt.
3. **Phases** :

   | Phase | Images | Durée | Vue | Vitesse |
   |---|---|---|---|---|
   | a. Freinage en sortie large | 4534–4545 | 0,44 s | horizon 229 → 211 (piqué) | 312 → 298 → 268 → 249 |
   | b. Cabré, ciel seul | 4546–4552 | 0,28 s | 299 | 240 → 230 |
   | c. Bascule | 4553–4560 | 0,32 s | 290 → 260 → 196 → 163 → 129 | 227 → 219 |
   | d. Piqué, sol seul | 4561–4567 | 0,28 s | 123 | 216 → 212 |
   | e. Rebond | 4568–4569 | 0,08 s | 171 → 222 | 210 |
   | f. Second piqué, partiel | 4570–4586 | 0,68 s | 194 → 159 → **143** (tenu 0,24 s) → 196 | 194 → 146 |
   | g. Tremblement | 4589–4601 | 0,52 s | alternance 214 / 221 à chaque image | 116 → 43 |
   | h. Arrêt | 4606 | — | 212, fixe | 0 |

   Pendant f à h, le décor lointain défile vers la gauche d'environ 0,87 largeur d'écran en
   0,84 s : la voiture pivote vers la droite.
4. **Paramètres estimés** : cabré de 0,28 s (0,40 s pour E3) ; l'instant d'atterrissage
   n'est pas repérable directement, faute de saut de vitesse — par analogie avec E3, où il
   coïncide avec la fin de la bascule, le vol durerait **≈ 0,6 s** ; en l'air −54 km/h/s
   (comme E3) ; **aucune chute de vitesse à l'atterrissage** ; ensuite ≈ −30 km/h/s pendant
   0,6 s, puis de plus en plus fort, jusqu'à **≈ −180 km/h/s** constants de 146 à 0 km/h
   (0,8 s) ; second piqué
   limité à −80 px (34 % de la hauteur) ; tremblement de ± 3,5 px à 12,5 Hz.
5. **Faits / hypothèses** : faits = le déroulé, l'absence d'explosion, la disparition des
   gants. Hypothèses : le panneau est l'objet heurté (le vibreur ou le bord du sable ne sont
   pas exclus) ; la forte décélération finale vient du sable ou d'un freinage ; la
   disparition des gants signale un état « perte de contrôle » ; le pivotement est subi.
6. **Virage GP aujourd'hui** : les objets de bord de piste sont **purement décoratifs**
   (`scenery-layout`, aucune collision). Seules existent des barrières continues
   (`wallBounce` : glissement le long du rail, perte de 2,2 % de vitesse par m/s de vitesse
   normale, tête-à-queue au-delà de 14 m/s). Hors piste, l'adhérence et la traînée changent,
   sans animation particulière.
7. **Écarts et corrections** : la référence a des **obstacles ponctuels solides** qui font
   décoller, et une glissade mise en scène (tangage, tremblement, volant lâché) → C6, C2, C8.

## 7. Synthèse des comportements observés

| Situation | Effet sur la vitesse | Effet sur la vue | Effet graphique | Suite |
|---|---|---|---|---|
| Freinage fort | −150 km/h/s | piqué de 3,4 à 5 % | — | — |
| Roue contre roue, de côté (E2) | ≈ −90 km/h instantané | piqué de 5,5 à 7 %, 0,44 s | étincelle 0,16 s au point de contact | on continue |
| Tamponnage dans l'axe (E4) | −48 km/h par contact (parfois ×2) | piqué de 5 à 8 %, 0,4 s | petit éclat entre les voitures | on continue |
| Roue sur roue par l'arrière, vite (E3) | −50 km/h/s en vol, ×0,15 à l'atterrissage, puis arrêt | cabré 0,4 s, bascule, piqué, rebond, second piqué, 2,6 s | explosion 1,25 s, panaches 0,6 s | arrêt 3,2 s, redémarrage sur place |
| Obstacle de bord de piste (E5) | −50 km/h/s en vol, rien à l'atterrissage, sable ensuite | même enchaînement, paliers plus courts, 1,7 s | tremblement, gants absents | arrêt dans le sable |

Les deux séquences aériennes suivent **le même scénario de tangage** (cabré tenu → bascule à
vitesse constante → sol tenu → rebond d'une image de jeu → second piqué → redressement) ; seule
la durée de chaque palier change. Cela ressemble à une animation paramétrée plus qu'à une
simulation de corps rigide — c'est une interprétation, cohérente avec les deux cas.

## 8. Perspective, écran, animations

Images : `work/reference-frames/P-perspective-and-layout/frames/`, `00-overview/`.

**Écran (faits).** Bandeau supérieur d'un tiers de la hauteur : plan du circuit avec sa
longueur, trois feux, score, étape, tour, deux rangées de pictogrammes de voitures, jauge
verticale. La vue 3D n'occupe que les deux tiers inférieurs, au format très large (≈ 2,4:1).
Le cockpit recouvre le quart inférieur de cette vue : sommet des roues avant, rétroviseurs
rouges, volant avec gants, afficheur de vitesse, indicateur de rapport en grille, bande de
couleur (compte-tours).

**Projection (mesures).**

- Ligne de fuite de la route à la ligne 237,5, soit **48,5 % de la hauteur de la vue** ; le
  sommet du relief lointain est 10 à 14 px plus haut.
- Sur terrain plat, la largeur de la chaussée vaut **5,9 px par ligne** sous la ligne de fuite
  (trois mesures : 5,86 à 5,89) : c'est le rapport *largeur de route / hauteur de l'œil*. Sur
  le second circuit : 8,2 à 10,7 (route plus large).
- **Estimation** : en supposant une monoplace large de 2,0 à 2,15 m, la voiture occupe 30 %
  de la largeur de chaussée à sa profondeur (image 2949) → chaussée de 6,7 à 7,2 m, œil à
  **1,1–1,2 m** du sol.
- Le champ de vision ne peut pas être déduit de façon fiable (aucune longueur connue le long
  de la piste). Une estimation grossière à partir de l'image 2951 donne 80 à 90° ; à traiter
  comme une hypothèse.
- Le relief est réel : la route monte au-dessus de la ligne d'horizon dans les côtes
  (0:16–0:18, 0:44–0:47), les crêtes masquent la suite.
- Décor lointain en une seule bande qui défile avec le cap ; un dirigeable à banderole défile
  de même. Il suit l'horizon dans les mouvements de tangage.
- Objets de bord de piste en images mises à l'échelle (cactus, panneaux, rochers) ; grandes
  structures en polygones pleins (portiques, tribunes, toit sur piliers de 0:37, tunnel sombre
  à plots lumineux de 3:32 et 4:36, ponts).
- Cadence : environ 18 images de jeu par seconde.

**Animations (faits).** Volant et gants à plusieurs positions, bras croisés à fond de
braquage ; gants absents pendant la glissade d'E5. Étincelle : disque rouge à cœur jaune.
Explosion en quatre temps (§ 4). Tremblement vertical en glissade. Voitures adverses : une
vue arrière mise à l'échelle, déclinée en couleurs ; aucun feu de frein visible.

**Conduite (mesures).** Vitesse maximale lue : **318 km/h** (310 à 318 sur les lignes
droites). Départ arrêté : 0 → 100 km/h en 1,0 s, 0 → 200 en 2,8 s environ.

**Virage GP aujourd'hui.** Vue plein écran 16:9, horizon à 43 % (36 % en écran partagé),
œil à 0,95 m, chaussée de 13 m (rapport 13,7 contre 5,9 : route deux fois plus large à
hauteur d'œil égale), champ de 72° qui s'ouvre avec la vitesse, cockpit sur un peu plus d'un
tiers de la hauteur. Arcade : 0 → 100 en 1,89 s, 0 → 200 en 3,85 s, 322 km/h.

## 9. Corrections proposées (aucune n'est commencée)

Par ordre de priorité. Les valeurs sont des **points de départ** tirés des mesures ; tout doit
rester paramétrable (`vehicles/car-spec.js`, `core/config.js`) et dessiné avec les moyens
graphiques propres à Virage GP.

| N° | Proposition | Valeurs de départ tirées de la vidéo | Modules concernés |
|---|---|---|---|
| **C1** | **État « en l'air »** de la voiture (`AIRBORNE`), suivi d'un atterrissage « dur » (arrêt sur place, immobilisation, redémarrage en 1ʳᵉ) ou « léger » (on continue). Remplace le tête-à-queue pour les chocs violents en profil arcade | vol 0,6 à 0,85 s ; −50 km/h/s en vol ; dur : vitesse ×0,15 puis arrêt en 0,85 s, immobilisation 3,2 s ; léger : vitesse conservée | `physics/car-physics.js`, `physics/collisions.js`, `gameplay/race.js`, IA |
| **C2** | **Animation de tangage de la vue** pilotée par l'état de la voiture : cabré tenu, bascule à vitesse constante, sol tenu, rebond, second piqué, redressement | cabré 0,3–0,4 s ; bascule 1,7 hauteur de vue par seconde ; sol 0,3–0,5 s ; rebond 0,1–0,15 s ; second piqué 0,7–0,95 s (complet si dur, 34 % si léger) | `rendering/compositing/race-view.js`, cockpit |
| **C3** | **Pénalité de contact à faible vitesse relative** : perte fixe au lieu de l'impulsion, sans embardée, pour la voiture qui arrive | −48 km/h (13,3 m/s) par contact, au plus une fois toutes les 0,08 s ; jamais sous la vitesse de l'autre voiture moins une marge | `physics/collisions.js`, profils de conduite |
| **C4** | **Étincelle au point de contact** (dans le monde, pas en surimpression), en plus des éclats existants | 0,16 s ; taille ≈ 2 % de la largeur de vue à 3 m | `rendering/effects/effects-layer.js` |
| **C5** | **Piqué de la vue** plus franc au freinage et aux contacts | 3,5 à 5 % de la hauteur à plein freinage ; 5 à 8 % pendant 0,4 s à un contact | `race-view.js` (`dive`) |
| **C6** | **Obstacles ponctuels solides** en bord de piste (panneaux, bornes) avec boîte de collision, et thèmes ouverts sans barrière continue | choc au-delà d'un seuil de vitesse → C1 « léger » ; en dessous → rebond | `tracks/scenery-layout.js`, `physics/car-physics.js` |
| **C7** | **Explosion dessinée** en quatre temps, liée à l'atterrissage dur | croissance 0,48 s, pleine 0,44 s, assombrissement 0,2 s, fumée 0,12 s, panaches 0,6 s | `effects-layer.js`, `art/` |
| **C8** | **Perte de contrôle visible** : volant lâché, tremblement vertical en glissade hors piste | ± 1,5 % de la hauteur à 12 Hz tant que la voiture glisse | cockpit, `race-view.js` |
| **C9** | *(Optionnel, choix de conception)* **Profil arcade plus nerveux** | 0 → 100 en ≈ 1,0–1,2 s ; freinage ≈ 40 m/s² constant ; vitesse maximale inchangée | `vehicles/car-spec.js` ; recalage de l'IA et des tests de conduite |
| **C10** | *(Optionnel)* Cadrage : horizon plus bas et route plus étroite à l'écran | horizon 48 % ; rapport largeur/hauteur d'œil 6 à 10 | `core/config.js`, circuits |

**Seuils de déclenchement de C1 : inconnus.** La vidéo ne donne que deux bornes — décollage
à 262 km/h sur une voiture plus lente avec chevauchement partiel (E3) ; pas de décollage pour
des contacts dans l'axe à 104–146 km/h et faible vitesse relative (E4) ni pour un contact
latéral à 140 km/h (E2). Proposition : décoller si la vitesse relative dépasse un seuil
réglable (valeur initiale 15 m/s) **et** si le recouvrement latéral est partiel (entre 20 et
80 % de la largeur) ; atterrissage dur après un choc contre une voiture, léger après un choc
contre un obstacle (la règle la plus simple compatible avec les deux cas observés). Ces
règles sont des choix de conception à valider en jeu, pas des mesures.

**Pertes de roues.** Rien dans cette vidéo ne permet de les décrire ; aucune proposition n'est
fondée sur elles. S'il faut les implémenter, il faudra une autre source.

## 10. Tests à écrire avec ces corrections

Tous déterministes, sous Node, sur le modèle des tests existants (`tests/unit`, `tests/gameplay`).

1. **Tamponnage** : voiture A à 115 km/h, dans l'axe, derrière B à 90 km/h → après contact A
   roule à 67 km/h ± 2, B est inchangée, aucun changement de cap, un seul événement `contact`.
2. **Double contact** : chevauchement maintenu deux pas de pénalité → perte de 96 km/h ± 4.
3. **Contact latéral roue contre roue** à 140 km/h → perte de 80 à 95 km/h, écart latéral
   rétabli, événement `spark` positionné entre les deux roues, durée de vie 0,16 s ± 0,03.
4. **Décollage** : A à 262 km/h sur B à 180 km/h, recouvrement de 50 % → état `AIRBORNE` au
   pas suivant ; vitesse en vol décroissante de 50 km/h/s ± 10 % ; durée de vol dans
   [0,6 ; 0,9] s.
5. **Atterrissage dur** : vitesse après atterrissage ≤ 20 % de la vitesse avant ; arrêt
   complet en moins de 1 s ; immobilisation de 3,2 s ± 0,2 ; redémarrage en 1ʳᵉ, au même
   endroit de la piste, sans téléportation.
6. **Pas de décollage** dans les cas E2 et E4 (borne inférieure).
7. **Obstacle** : choc à 240 km/h contre un panneau → `AIRBORNE` de 0,5 à 0,7 s, vitesse à
   l'atterrissage ≥ 90 % de la vitesse en fin de vol, pas d'explosion ; l'IA évite ces objets.
8. **Tangage de la vue** : sur la séquence E3, l'horizon sort par le bas, traverse la vue de
   façon monotone, sort par le haut, revient, replonge, se stabilise à ± 1 % en moins de
   2,8 s ; sur E5, le second piqué ne dépasse pas 40 % de la hauteur. Continuité : aucun saut
   supérieur à 15 % de la hauteur entre deux images à 60 i/s, sauf le rebond.
9. **Piqué au freinage** : à plein freinage, décalage de l'horizon compris entre 3 et 5,5 %
   de la hauteur de vue, nul à vitesse constante.
10. **Explosion** : quatre phases dans l'ordre, durée totale 1,25 s ± 0,15, désactivable par
    l'option d'effets correspondante ; aucune allocation par image.
11. **Régression** : une course complète de 16 voitures se termine toujours, sur les 18
    circuits, avec le nouvel état ; même graine, même course.
12. **Écran partagé** : l'animation de tangage d'un joueur n'affecte pas la vue de l'autre.
