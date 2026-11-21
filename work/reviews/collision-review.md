# Revue critique indépendante — collisions arcade, roues avant, rétroviseurs

Jeu : *Virage GP — édition bande dessinée*. Date de la revue : 2026-11-21.
Matériel jugé : `work/renders/collisions/` (E2, E3, E3x, E4, E5 : vidéo, planche, télémétrie) et
`work/renders/comparison/` (roues et rétroviseurs avant/après).
Référence de mécaniques : `docs/research/vroom-gameplay-analysis.md` et `work/reference-frames/`.

Rappel de cadre : aucune différence d'aspect avec la référence n'est reprochée. Ne sont comparés
que le déroulement, les durées, les pertes de vitesse, la lisibilité et la cohérence de la mise
en scène, plus la qualité du dessin dans le style propre du jeu.

## 0. Méthode et conventions

- Toutes les images des six vidéos ont été extraites avec FFmpeg (`-start_number 0`), soit
  192 + 570 + 252 + 390 + 390 + 384 images. Les **numéros d'image sont ceux du champ `frame`
  de la télémétrie** (à partir de 0) ; `t = image / 60`.
- Planches denses et recadrages agrandis refaits par mes soins (image par image autour des
  contacts, des décollages, des atterrissages, du redémarrage). Les planches fournies n'ont
  servi que de vue d'ensemble.
- Mesures sur l'image : ligne d'horizon (dernière ligne majoritairement « ciel »), ligne du
  bord herbe/asphalte, part de pixels « feu », différences image à image sur les pneus,
  kymographes (une bande de pneu en fonction du temps).
- Télémétrie : le champ `pitch` vaut une fraction de hauteur d'écran (vérifié sur E3 :
  265 px d'horizon pour 0,488 de `pitch`, soit 543 px par unité pour 540 px de haut) ;
  `contactDive` de même (0,065 ↔ 37 px mesurés).
- Vidéo de comparaison (1280×840) : moitié haute (lignes 0–419) = AVANT, moitié basse
  (420–839) = APRÈS ; images 0–95 = 8 km/h, 96–191 = 40, 192–287 = 120, 288–383 = 250.
- Les mesures de la référence sont approximatives (± 0,06 s, vitesses lues à l'œil) : un écart
  n'est retenu comme défaut que s'il dépasse nettement cette marge ou s'il se voit à l'image.
- Je n'ai lu ni les spécifications de l'auteur, ni les tests, ni le code. Aucun build lancé.
- Mes recadrages de travail sont dans un dossier temporaire (non conservé) ; chaque preuve
  ci-dessous est donc donnée sous la forme « fichier livré + numéro d'image + horodatage »,
  reproductible avec FFmpeg.

## 1. Séquences

### 1.1 E2 — contact roue contre roue (`E2.mp4`, 192 images, 3,2 s)

**Ce qu'on voit.**

| Phase | Images | Temps | Description |
|---|---|---|---|
| Approche | 0–61 | 0–1,02 s | 148,8 km/h stabilisés ; le joueur double par la gauche une voiture rouge et jaune (119,9 km/h) en se rabattant vers elle |
| Contact | 62 | 1,033 s | Roue avant droite du joueur contre l'arrière gauche de l'autre voiture. Compteur 148 → 53 dans la même image. Une étoile blanche et jaune naît sur le flanc extérieur de la roue avant droite |
| Étoile | 62–69 | 0,13 s | L'étoile reste accrochée à la roue du joueur ; « TCHAK ! » grandit au-dessus de l'autre voiture, visible jusque vers l'image 110 (≈ 0,8 s) |
| Piqué de la vue | 62–86 | 0,40 s | Horizon 205 → 168 (image 71) → 211 ; bord de l'herbe 301 → 265 → 300 |
| Suite | 63–191 | — | L'autre voiture, non ralentie, s'échappe devant ; aucune embardée du joueur ; ré-accélération avec deux temps morts de changement de rapport (images 113–117 et 160–164) |

**Conformité.**

| Grandeur | Référence | Observé | Écart |
|---|---|---|---|
| Vitesse avant contact | 140–149 km/h | 148,8 km/h | conforme |
| Perte de vitesse | ≈ −90 km/h en une image de jeu | −96,0 km/h en une image (62) | +6 km/h, dans la marge |
| Vitesse après | 50–59 puis 40–49 km/h | 52,8 km/h | conforme |
| Étincelle au point de contact | oui, 0,16 s | oui, 0,13 s (images 62–69) | −0,03 s, dans la marge |
| Piqué de la vue | 5,5–7 % de la vue, 0,44 s | 6,9 % (37 px sur 540), 0,40 s | conforme |
| Embardée | aucune | aucune (`d` −1,44 → −1,43 au contact) | conforme |
| Voiture heurtée | non ralentie | 119,9 km/h constants | conforme |
| Ré-accélération | ≈ 60 km/h/s, 117 km/h à 1,2 s | 56 km/h/s, 117 km/h à 1,32 s | conforme |

**Défauts.** Un seul, mineur (E2-1) : l'étoile recouvre entièrement le rétroviseur droit pendant
toute sa durée. La séquence est la plus fidèle du lot.

### 1.2 E3 — décollage sur une voiture, vue cockpit (`E3.mp4`, 570 images, 9,5 s)

**Ce qu'on voit.**

| Phase | Images | Temps | Description |
|---|---|---|---|
| Approche | 0–99 | 0–1,65 s | 261,6 km/h ; voiture rouge devant, légèrement à droite (188,4 km/h) |
| Contact, décollage | 100 | 1,667 s | Recouvrement roue avant droite / roue arrière gauche ; petit « BANG ! » (≈ 30 px) ; pas d'éclat au point de contact |
| Cabré | 101–103 | 0,05 s | La voiture rouge glisse sous le cockpit ; l'horizon descend de 215 à plus de 380 |
| Ciel seul | 104–128 | 0,42 s | Ciel jusqu'au cockpit (horizon mesuré 404–410) ; « BANG ! » en grand dans le ciel |
| Bascule | 124–151 | 0,45 s | `pitch` −0,60 → +0,50 à vitesse constante ; l'horizon traverse l'écran des images 130 à 147 ; la voiture survolée apparaît dans les rétroviseurs dès l'image 128 |
| Atterrissage | 152 | 2,533 s | 219,1 → 32,5 km/h en une image ; « BOUM ! », étoile blanche, première flamme sur la roue avant droite |
| Piqué, sol seul | 148–182 | 0,57 s | Asphalte plein écran ; la voiture rouge surgit en haut à droite à l'image 166 et s'éloigne |
| Rebond | 181–190 | 0,17 s | L'horizon revient (176 à l'image 190, contre 210–215 au repos) |
| Second piqué | 190–242 | 0,87 s | Redescente en 0,30 s, sol seul tenu 0,57 s (images 208–242) ; 0 km/h à l'image 203 |
| Redressement | 243–260 | 0,28 s | Retour de la vue normale |
| Arrêt | 203–394 | 3,20 s | Image fixe à partir de 260 ; roues immobiles (aucun pixel du pneu ne change, images 263–394) |
| Redémarrage | 395 → | 6,583 s | Sur place, en 1ʳᵉ ; 100 km/h atteints à 8,48 s |

Explosion (en parallèle) : croissance sur la roue avant droite, images 152–186 (0,57 s) ; boule
pleine 186–207 (0,35 s) ; rouge sombre 208–218 (0,18 s) ; deux panaches sombres au-dessus des
deux roues avant, 214–248 (0,57 s). Les quatre temps de la référence sont présents, dans l'ordre.

**Conformité.**

| Grandeur | Référence | Observé | Écart |
|---|---|---|---|
| Vitesse au contact | 262 → 260 km/h | 261,6 km/h | conforme |
| Cabré, ciel seul | 0,40 s | 0,42 s à l'image (plateau `pitch` 0,33 s) | conforme |
| Bascule | 0,44 s, vitesse constante | 0,45 s, linéaire | conforme |
| Durée du vol | ≈ 0,85 s | 0,867 s (images 100–152) | conforme |
| Décélération en vol | −50 km/h/s | −50 km/h/s (261,6 → 219,1) | conforme |
| Vitesse à l'atterrissage | × 0,15 (228 → 35) | × 0,148 (219,1 → 32,5) | conforme |
| Arrêt après atterrissage | 0,84 s | 0,85 s | conforme |
| Piqué, sol seul | 0,48 s | 0,48 s en télémétrie, 0,57 s à l'image | +0,09 s, limite |
| Rebond | 0,16 s, retour quasi complet (223 pour 226) | 0,17 s, retour partiel (176 pour 210–215) | amplitude ≈ 84 % |
| Second piqué | 0,96 s dont 0,60 s tenu | 0,87 s dont 0,57 s tenu | −0,09 s, limite |
| Redressement | 0,20 s | 0,28 s | +0,08 s, limite |
| Immobilisation à 0 km/h | 3,2 s | 3,20 s | conforme |
| Contact → redémarrage | 4,9 s | 4,92 s | conforme |
| Feu de l'explosion | ≈ 1,25 s | ≈ 1,10 s | −0,15 s, limite |
| Panaches | 0,6 s, de part et d'autre du cockpit | 0,57 s, de part et d'autre | conforme |
| Côté de l'explosion | côté du contact | côté du contact (avant droit) | conforme |
| Position à l'atterrissage | derrière les voitures heurtées, qui repartent devant | **devant** la voiture heurtée, qui arrive par l'arrière | divergence (voir E3x-1) |
| Redémarrage 0 → 99 km/h | 1,04 s | 1,9 s | presque deux fois plus lent |
| Rapport au redémarrage | 1ʳᵉ | 1ʳᵉ à l'image 396, mais « 6 » affiché pendant tout l'arrêt | voir E3-2 |

**Défauts.** E3-2 (rapport « 6 » affiché à l'arrêt), E3-3 (contact déclencheur sans éclat),
E3-4 (redémarrage lent) : tous mineurs. La traversée de l'épave par la voiture heurtée se
devine ici (elle surgit plein cadre à l'image 166) mais se constate en vue arrière : elle est
comptée une seule fois, sous E3x-1.

### 1.3 E3x — le même accident en vue arrière (`E3x.mp4`, 252 images, 4,2 s)

**Ce qu'on voit.** Télémétrie identique à E3 (mêmes images clés), `pitch` nul en permanence.

| Phase | Images | Description |
|---|---|---|
| Approche | 0–99 | Le joueur (blanc, aileron rouge) rattrape la voiture rouge, décalé à gauche |
| Contact | 100–104 | Les deux voitures se recouvrent ; petites étincelles jaunes sur l'arrière du joueur ; « BANG ! » |
| Vol | 104–151 | La voiture du joueur monte à l'écran d'environ 150 px pour 1,30 m (image 124), puis redescend ; la voiture rouge passe dessous, puis sort par le bas du cadre (image 124) |
| Atterrissage | 152 | Étoile blanche au-dessus de la voiture, flamme à l'avant droit, petits nuages aux roues |
| Explosion | 152–215 | « BOUM ! », nuages de fumée blancs anguleux, flammes à droite, puis boule rouge sombre (image 210) |
| Traversée | 160–164 | La voiture rouge arrive par l'arrière et **traverse la moitié droite de l'épave** avant de s'éloigner |
| Arrêt | 203 → | Voiture immobile, fumée qui se dissipe, voiture rouge au loin |

**Conformité.** Les grandeurs chiffrées sont celles d'E3 (même simulation). La référence n'a
pas de vue arrière : seule la cohérence avec la vue cockpit et la lisibilité se jugent ici.

| Grandeur | Vue cockpit (E3) | Vue arrière (E3x) | Écart |
|---|---|---|---|
| Hauteur de vol | — (`airHeight` 1,30 m) | ≈ 150 px de montée, sans ombre lisible | hauteur peu lisible |
| Tangage | −60 % puis +50 % de l'écran | aucun : voiture à plat du début à la fin | incohérence entre caméras |
| Atterrissage | piqué violent, sol plein écran | la voiture se pose à plat, puis explose | « violence » non montrée |
| Voiture heurtée après l'atterrissage | surgit devant à l'image 166 | traverse l'épave, images 160–164 | interpénétration |

**Défauts.** Trois moyens : E3x-1 (interpénétration), E3x-2 (aucune assiette en vol),
E3x-3 (pas d'ombre portée lisible). C'est la séquence la plus faible.

### 1.4 E4 — tamponnages répétés (`E4.mp4`, 390 images, 6,5 s)

**Ce qu'on voit.**

| Phase | Images | Temps | Description |
|---|---|---|---|
| Rattrapage | 0–42 | 0–0,70 s | Le joueur accélère de 147 à 183,1 km/h derrière une voiture rouge à 88,4 km/h |
| Contact 1 | 43 | 0,717 s | 183,1 → 86,6 km/h (−96,5) ; étoile entre le nez et l'arrière de la voiture (images 43–51) ; « BANG ! » ; piqué de 37 px sur 0,40 s |
| Contact prolongé | 62–106 | 0,75 s | Collé à la voiture ; vitesse en dents de scie 87 ↔ 91 km/h toutes les 5 images ; rien à l'image, sauf le compteur qui oscille |
| Contact 2 | 107 | 1,783 s | 90,9 → 43,4 km/h (−47,5) ; même étoile, même « BANG ! », même piqué |
| Rattrapage | 111–213 | 1,7 s | 43 → 135,6 km/h |
| Contact 3 | 214 | 3,567 s | 135,6 → 86,5 km/h (−49,1) |
| Contact prolongé | 230–274 | 0,75 s | Mêmes dents de scie (86,6 ↔ 90,5) |
| Contact 4 | 275 | 4,583 s | 90,5 → 43,4 km/h (−47,1) |
| Contact 5 | 382 | 6,367 s | 135,6 → 86,6 km/h (−49,0) |

**Conformité.**

| Grandeur | Référence | Observé | Écart |
|---|---|---|---|
| Perte unitaire | −48 km/h | −47,5 ; −49,1 ; −47,1 ; −49,0 | conforme |
| Contact « double » | −85 ; −94 en deux images de jeu | −96,5 en une image (contact 1) | conforme |
| Chute en une image | oui | oui | conforme |
| Piqué de la vue | 5–8 %, 0,16 s puis 0,24 s | 6,9 %, 0,15 s puis 0,25 s | conforme |
| Éclat entre les voitures | oui, petit | oui, 0,15 s, ≈ 95 px de large | conforme (taille : choix de style) |
| Décollage | aucun | aucun | conforme |
| Voiture de devant | ne bouge pas | +2,8 km/h à chaque contact, résorbés en 0,3 s | écart faible |
| Ré-accélération après contact | 25–35 km/h/s | 56–63 km/h/s | environ deux fois plus rapide |
| Intervalle entre contacts | 1,4 à 4,6 s | 1,07 ; 1,78 ; 1,02 ; 1,78 s | plus serré, et rythme périodique |
| Conditions du premier contact | 145 km/h, rattrapage lent | 183,1 km/h, 95 km/h d'écart | séquence non représentative |
| Contacts sans signal | aucun relevé | 16 chutes de ≈ −3,9 km/h et 2 de ≈ −9,5 km/h sans événement | propre au jeu |

**Défauts.** E4-1 (moyen) : le contact prolongé silencieux suivi d'une pénalité complète.
E4-2, E4-3, E4-4 (mineurs).

### 1.5 E5 — panneau de bord de piste (`E5.mp4`, 390 images, 6,5 s)

**Ce qu'on voit.**

| Phase | Images | Temps | Description |
|---|---|---|---|
| Sortie de piste | 0–58 | 0–0,97 s | Le joueur roule dans l'herbe à gauche, le long du rail, vers un panneau « 300 » qui grossit |
| Choc | 59–60 | 1,000 s | Le panneau disparaît (59) ; étoile sur la roue avant gauche et « CRAC ! » (60) ; 241,7 km/h |
| Cabré | 60–64 | 0,07 s | La vue se lève |
| Ciel | 64–77 | 0,23 s | Ciel, avec grillage, sapins et pylône encore visibles à gauche |
| Bascule | 77–96 | 0,32 s | Retour du rail, de l'herbe |
| Atterrissage | 96 | 1,600 s | 206,7 km/h, aucune chute de vitesse ; **les gants quittent le volant** |
| Piqué, sol seul | 96–112 | 0,28 s | Herbe plein écran, traits de vitesse |
| Rebond | 113–117 | 0,08 s | Horizon revenu ; un second panneau « 200 » est visible droit devant (images 118–126) |
| Second piqué partiel | 118–162 | 0,73 s | `pitch` 0,33–0,35 tenu images 128–144 |
| Glissade | 120–194 | 1,25 s | La vue pivote d'environ 80–90° vers la droite : la piste finit en bande horizontale ; tremblement vertical de ± 1,4 % à 12 Hz |
| Second choc | 171 | 2,850 s | 125,1 → 72,8 km/h en une image ; seul un « CRAC ! » apparaît, rien de heurté n'est visible |
| Arrêt | 195 | 3,250 s | 0 km/h ; gants revenus à l'image 197 ; rapport « 5 » affiché |
| Remise en piste | 237 | 3,950 s | Coupe franche : la voiture est au centre de la piste, dans l'axe, en 1ʳᵉ |
| Redémarrage | 238 → | — | 100 km/h vers 6,05 s |

**Conformité.**

| Grandeur | Référence | Observé | Écart |
|---|---|---|---|
| Vitesse au choc | 249 → 240 km/h | 241,7 km/h | conforme |
| Cabré tenu | 0,28 s | 0,23 s (+ 0,07 s de montée) | conforme |
| Bascule | 0,32 s | 0,32 s | conforme |
| Durée du vol | ≈ 0,6 s | 0,60 s (images 60–96) | conforme |
| Décélération en vol | −54 km/h/s | −50 km/h/s, plus un à-coup de −5,9 km/h (image 69) | voir E5-3 |
| Chute à l'atterrissage | aucune | aucune (207,4 → 206,7) | conforme |
| Explosion | aucune | aucune | conforme |
| Piqué, sol seul | 0,28 s | 0,28 s | conforme |
| Rebond | 0,08 s | 0,08 s | conforme |
| Second piqué | 34 %, tenu 0,24 s, 0,68 s au total | 33–35 %, tenu 0,27 s, 0,73 s | conforme |
| Décélération au sol | −30 km/h/s pendant 0,6 s, puis jusqu'à −180 | −30 pendant 0,6 s, −65, −133, puis −180 | conforme hors second choc |
| Chute instantanée pendant la glissade | aucune | −52,3 km/h à l'image 171 | divergence (E5-1) |
| Tremblement | ± 1,5 % à 12,5 Hz, 0,52 s, en fin de glissade | ± 1,4 % à 12 Hz, de l'atterrissage à l'image 189 (1,55 s) | amplitude conforme, durée triple |
| Pivotement | vers la droite, ≈ 0,87 largeur d'écran | vers la droite, ≈ 80–90° | conforme |
| Gants | absents pendant la glissade | absents images 96–194 | conforme |
| Choc → arrêt | ≈ 2,4 s | 2,25 s | conforme |
| Après l'arrêt | inconnu (fondu de montage) | téléportation au centre de la piste après 0,70 s | non comparable ; voir E5-2 |

**Défauts.** E5-1 et E5-2 (moyens), E5-3, E5-4, E5-5 (mineurs).

## 2. Roues avant

Mesures sur la roue avant gauche de `wheels-mirrors-before-after.mp4`, zone de pneu
x 95–215, y 150–283 de chaque moitié, images 4 à 91 de chaque palier (87 transitions). Une
« image changée » est une transition où plus de 0,25 % des pixels de la zone varient nettement.
La roue droite donne les mêmes cadences (contrôlé sur x 1040–1190).

| Vitesse | AVANT | APRÈS |
|---|---|---|
| 8 km/h | 44 changements, un toutes les 2 images ; 0,22 % des pixels : quelques tirets clairs très peu contrastés. Rotation à peine perceptible | 44 changements, un toutes les 2 images ; 1,04 % des pixels : tirets sombres et clairs. **Rotation lisible, sens correct** (les marques montent sur la face arrière du pneu puis fuient vers l'avant ; kymographe bande x 112–124, images 6–41) |
| 40 km/h | 45 changements, **même cadence qu'à 8 km/h** (kymographes identiques) : la roue ne dit rien de la vitesse | 20 changements, un toutes les 4 à 5 images (12 à 15 par seconde) ; dessin hachuré à trois phases. Animée, mais **saccadée**, et plus lente qu'à 8 km/h |
| 120 km/h | **0 changement sur 87 : roue figée** (stries fixes) | 29 changements, un toutes les 3 images ; trois phases. Animée |
| 250 km/h | 5 changements, dont un palier de 48 images : **quasi figée** | 39 changements, un toutes les 2 à 3 images, cadence un peu irrégulière. Animée |

Constats.

- **Le défaut d'origine est corrigé** : la roue n'est plus figée à 120 et 250 km/h, et à basse
  vitesse les marques sont cinq fois plus présentes. Aucune vitesse testée n'est moins lisible
  qu'avant.
- **Deux régimes de dessin, avec une rupture vers 17–20 km/h** (R-1). Mesuré sur le
  redémarrage d'`E3.mp4` : pneu lisse à tirets jusqu'à l'image 412 (15,3 km/h), pneu hachuré à
  partir de l'image 414 (17,1 km/h). La cadence passe d'un changement par image (15–20 km/h)
  à un toutes les 5 images (20–40 km/h), puis 4 (40–90), 3 (90–160) et 2 à 3 (250). La roue
  paraît donc **ralentir au moment où la voiture accélère**, et le dessin change d'un coup.
- **Au-dessus de 20 km/h, le sens de rotation ne se lit pas** (R-2). Le cycle de trois images
  n'est pas une translation cohérente : dans la moitié APRÈS, la bande x 112–124 se lit vers
  le haut (sens correct), la bande x 150–162 vers le bas (sens inverse), aux trois vitesses
  40, 120 et 250 km/h. On perçoit un scintillement de hachures, pas un pneu qui roule. Je ne
  peux pas affirmer que la roue « tourne à l'envers » : le sens est ambigu.
- **La jante ne tourne pas à 8 km/h** (R-3) : zone x 196–242, y 196–330 de la moitié APRÈS
  (y 616–750 dans l'image entière), 0 changement sur 87 alors que la bande de roulement défile. À 40 et 120 km/h elle change (13 et 19 fois).
- À l'arrêt (E3, images 263–394), la roue est immobile : correct.
- Régression indirecte : le rétroviseur APRÈS recouvre le tiers bas et extérieur du pneu
  (voir § 3), ce qui réduit la surface où la rotation se lit.

## 3. Rétroviseurs

Sources : `mirrors-before-after.jpg` et `frames/{before,after}-mirror-{COCKPIT,CHASE,FRONT}.png`.

| Caméra | AVANT | APRÈS |
|---|---|---|
| Cockpit | Deux rétroviseurs d'environ 150×70 px au-dessus des roues avant (y 370–440 sur 720), portés par une tige qui passe **derrière** le pneu. Ils masquent une partie des voitures voisines | Deux rétroviseurs d'environ 180×100 px, bas et à l'extérieur (x 52–232 et 1048–1228, y 585–685), dessinés **devant** le pneu, avec une amorce de tige vers la coque |
| Poursuite | Voiture du joueur sans rétroviseur visible | **Identique** : aucun pixel de la voiture du joueur ne change |
| Face | Rétroviseurs petits, collés aux flancs du cockpit, à hauteur d'épaules, en dedans des roues avant | **Identique** : 0 % de pixels différents sur toute l'image |

Cohérence.

- AVANT, la vue cockpit contredisait la vue de face : une tige cachée par le pneu place le
  rétroviseur plus loin que la roue avant, alors que la vue de face le fixe au cockpit, donc
  plus près du pilote que la roue.
- APRÈS, la vue cockpit devient cohérente avec la vue de face et avec les voitures adverses
  (rétroviseurs bleus sur tige au flanc du cockpit) : un objet fixé à la coque, plus proche que
  la roue, apparaît bien plus bas et plus à l'extérieur qu'elle. La correction ne touche que la
  vue cockpit, ce qui est le bon choix puisque c'était elle qui était fausse.
- Les reflets fonctionnent : dans `E3.mp4`, la voiture survolée apparaît dans les rétroviseurs
  des images 128 à 158, y compris en grand juste avant qu'elle ne rattrape le joueur (158).

Effets indésirables.

- Chaque rétroviseur couvre désormais environ le tiers bas et extérieur du pneu avant (M-1).
- Dans `E2.mp4`, l'étoile de contact tombe exactement sur le rétroviseur droit et le masque
  pendant toute sa durée (images 62–69, défaut E2-1).
- Gain net : les rétroviseurs ne masquent plus les voitures voisines ni la zone d'horizon.

Réserve sur la preuve : les deux captures « même instant » ne le sont pas tout à fait. La
voiture bleue n'est pas au même endroit dans les deux états (différences en vue poursuite
limitées à la zone x 640–880, y 320–480 ; en cockpit elle est bord à bord AVANT, une longueur
devant APRÈS). La comparaison de ce que les rétroviseurs masquent en est faussée.

## 4. Défauts classés

Aucun défaut **Grave** : aucune séquence ne contredit le déroulement décrit par l'analyse, et
aucune ne trompe gravement le joueur.

### Moyens

| N° | Défaut | Preuve | Correction suggérée |
|---|---|---|---|
| E3x-1 | La voiture heurtée traverse l'épave du joueur. Le joueur atterrit **devant** elle, d'environ 8 m d'après les vitesses (la référence le laisse derrière) ; elle arrive à 188 km/h avec 0,93 m de décalage latéral et passe au travers de la moitié droite de la voiture, sans événement de contact | `E3x.mp4` images 160, 162, 164 (2,667–2,733 s) ; `E3.mp4` 164 → 166 (surgissement plein cadre) ; `E3.json` : aucun événement entre 152 et 395 | Faire éviter l'épave par l'adversaire, ou le freiner derrière, ou régler le vol pour atterrir derrière la voiture heurtée comme dans la référence |
| E3x-2 | En vue arrière, la voiture reste parfaitement à plat pendant tout le vol et à l'atterrissage, alors que la vue cockpit bascule de −60 % à +50 % de l'écran. L'« atterrissage violent » n'est pas montré : la voiture se pose à plat, puis explose | `E3x.mp4` images 104, 112, 124, 140, 150, 152 : même dessin arrière, même largeur (≈ 255–260 px) | Donner une assiette au dessin (nez levé, puis nez piqué, écrasement à l'impact) cohérente avec le `pitch` de la vue cockpit |
| E3x-3 | Pas d'ombre portée lisible sous la voiture en vol : la hauteur ne se lit que par le déplacement vers le haut de l'écran. Sous la voiture, la chaussée n'est plus sombre que de 8 à 11 niveaux sur 255 par rapport aux côtés | `E3x.mp4` images 132 et 140, zone x 360–580 sous la voiture comparée aux zones voisines | Ombre nette au sol, qui se détache et rétrécit avec la hauteur |
| E4-1 | Après un tamponnage qui ramène le joueur à la vitesse de la voiture de devant, le contact persiste environ 1 s sans aucun signal (dents de scie 87 ↔ 91 km/h toutes les 5 images, compteur qui scintille), puis une pénalité complète de 48 km/h tombe alors que l'écart de vitesse n'est que de 2,5 km/h. Un contact à 135 km/h coûte donc 96 km/h en deux fois, la seconde arbitraire à l'écran | `E4.json` images 62–107 et 230–275 (deux séries de 8 chutes de ≈ −3,9 km/h sans événement, puis `bump` 90,9 → 43,4 et 90,5 → 43,4) ; `E4.mp4` compteur, images 60–106 | Après une pénalité, écarter franchement les deux voitures (ou plafonner la vitesse sous celle de la voiture de devant avec une vraie marge) ; ne pas réappliquer la pénalité tant que le joueur n'a pas décollé puis rattrapé |
| E5-1 | Second choc invisible pendant la glissade : 125,1 → 72,8 km/h en une image, avec pour seul indice un « CRAC ! ». La voiture, en travers, heurte très probablement de flanc le panneau « 200 » vu droit devant aux images 118–126 ; il est hors champ au moment du choc | `E5.json` image 171 (événement `obstacle`, 34,37 m/s) ; `E5.mp4` images 170–173 (2,833–2,883 s) et 118–126 | Retirer le second panneau du scénario pour isoler le cas de référence ; en jeu, donner un retour côté impact (éclat au bord de l'écran, secousse) |
| E5-2 | Remise en piste par coupe franche, 0,70 s après l'arrêt : d'une image à l'autre la vue passe de « en travers dans l'herbe, rapport 5 » à « au centre de la piste, dans l'axe, rapport 1 », sans fondu ni signal | `E5.mp4` images 236 → 238 (3,933–3,967 s) ; `E5.json` image 237 : `d` −14,82 → 0, événement `reset` | Laisser le joueur repartir de l'herbe (comme l'arrêt sur place d'E3), ou habiller la remise en piste (fondu, vignette) et allonger le délai |
| R-1 | Rupture d'animation des roues vers 17–20 km/h : le dessin du pneu change d'un coup (lisse à tirets → hachuré) et la cadence chute d'un changement par image à un toutes les 5 images. La roue semble ralentir quand on accélère ; à 40 km/h elle reste saccadée (12–15 changements par seconde), plus lente qu'à 8 km/h | `E3.mp4` images 412 → 414 (6,87–6,90 s) ; cadences mesurées images 396–569 ; vidéo de comparaison, moitié basse, images 0–95 contre 96–191 | Fondu entre les deux dessins sur une plage de vitesse ; cadence du dessin hachuré continue avec celle du régime lent à la vitesse de bascule |

### Mineurs

| N° | Défaut | Preuve | Correction suggérée |
|---|---|---|---|
| E2-1 | L'étoile de contact (≈ 100 px, 10 % de la largeur) est dessinée par-dessus le rétroviseur droit, qu'elle masque pendant toute sa durée | `E2.mp4` images 62–69 (1,033–1,150 s), zone x 780–880, y 410–500 | Étoile plus petite, ou placée entre les deux roues, sous le rétroviseur dans l'ordre de dessin |
| E3-2 | L'indicateur de rapport affiche « 6 » pendant les 3,2 s d'arrêt à 0 km/h, et ne passe à « 1 » qu'au redémarrage. Même chose dans E5 (« 5 » à l'arrêt, images 195–236) | `E3.mp4` images 204–394, cadran au centre du volant ; image 396 | Afficher le point mort ou la 1ʳᵉ dès l'immobilisation |
| E3-3 | En vue cockpit, le contact qui déclenche le décollage n'a pas d'éclat au point de contact, contrairement à E2 et E4 : seulement un « BANG ! » d'environ 30 px à l'image du choc. La vue arrière, elle, montre des étincelles | `E3.mp4` images 100–101 ; `E3x.mp4` image 104 | Même étoile de contact que pour E2 et E4, sur la roue concernée |
| E3-4 | Redémarrage presque deux fois plus lent que la référence (0 → 100 km/h en 1,9 s contre 1,04 s). L'analyse classe ce point en option | `E3.json` images 395–509 | Décision de conception à trancher explicitement |
| E4-2 | La voiture de devant est poussée à chaque contact (+2,8 km/h, résorbés en 0,3 s), alors que la référence la laisse inchangée | `E4.json`, champ `other` aux images 43, 107, 214, 275, 382 : 88,4 → 91,1–91,2 | Supprimer l'impulsion sur la voiture heurtée dans ce cas |
| E4-3 | Ré-accélération après contact environ deux fois plus rapide que la référence (56–63 km/h/s contre 25–35) : le tamponnage coûte moins de temps | `E4.json` images 111–160 et 180–210 | À trancher avec E3-4 (profil d'accélération) |
| E4-4 | La séquence ne montre pas le cas de référence : son premier contact a lieu à 183,1 km/h avec 95 km/h d'écart (l'en-tête annonce 146 km/h), pas en rattrapage lent. Rien ne distingue à l'image ce choc d'un tamponnage simple (même étoile, même piqué de 0,065) | `E4.json` images 0–43 | Maintenir la vitesse d'approche du scénario ; montrer un contact à faible écart |
| E5-3 | En plein vol, la position latérale se bloque net (`d` = −14,82 dès l'image 68, jusqu'à l'arrêt) et la vitesse perd 5,9 km/h en une image sans événement : la voiture en l'air bute sur la limite latérale. Invisible à l'image | `E5.json` images 67–69 | Pas d'interaction avec le rail pendant le vol, ou la signaler |
| E5-4 | Le panneau « 300 » disparaît purement et simplement au choc, une image avant l'éclat ; aucun débris, aucun panneau couché | `E5.mp4` images 58, 59, 60 | Débris ou panneau renversé pendant quelques images |
| E5-5 | Un élément de décor est rendu en aplat gris presque uni, sans dessin (134×89 px), à gauche de la piste. À vérifier : ce peut être un dos de panneau volontaire | `E5.mp4` image 238, x 197–331, y 124–213 ; aussi images 118–126 | Lui donner un dessin (structure, tubes, ombres) |
| R-2 | Au-dessus de 20 km/h, le sens de rotation est illisible : deux bandes du même pneu se lisent en sens opposés | Vidéo de comparaison, moitié basse, images 96–383, bandes x 112–124 et x 150–162, lignes 568–712 | Faire glisser un seul motif de hachures dans le sens de roulage, au lieu de trois dessins indépendants |
| R-3 | À 8 km/h, les rayons de la jante restent fixes alors que la bande de roulement défile | Vidéo de comparaison, moitié basse, images 4–91, zone x 196–242, y 616–750 : 0 changement sur 87 | Animer les rayons au même rythme que le pneu en régime lent |
| M-1 | Chaque rétroviseur recouvre environ le tiers bas et extérieur du pneu avant, dont la zone de contact avec le sol | `frames/after-mirror-COCKPIT.png`, x 52–232 et 1048–1228, y 585–685 | Réduire un peu la taille ou décaler vers l'extérieur de l'écran |

## 5. Ce que le matériel ne permet pas de juger

- **Le son** : aucune piste audio. Impacts, explosion, moteur à l'arrêt et au redémarrage sont
  hors de portée.
- **Les sensations au volant** : les séquences sont scriptées, sans commandes de joueur. On ne
  sait pas si le joueur peut braquer en vol, éviter le second tamponnage en levant le pied, ou
  reprendre la main pendant la glissade.
- **La fluidité réelle** : les vidéos sont rendues image par image à 60 i/s. Rien ne renseigne
  sur la cadence dans un navigateur, ni sur le coût des effets.
- **Les seuils de déclenchement** : un seul exemple par cas. Rien ne montre à partir de quelle
  vitesse relative ou de quel recouvrement on décolle, ni ce qui se passe juste en dessous.
- **Le freinage (E1)** : aucune séquence fournie ; le piqué de la vue au freinage n'est pas
  jugeable.
- **L'authenticité de l'état AVANT** : il vient d'un autre build, que je n'ai pas vérifié. Les
  captures de rétroviseurs ne placent pas la voiture bleue au même endroit dans les deux états.
- **Les rétroviseurs en mouvement** : la comparaison est une image fixe. Leur comportement
  dynamique n'est observé qu'incidemment dans E2, E3 et E5.
- **Les autres cas** : collisions entre adversaires, écran partagé, autres circuits, pluie,
  option de désactivation des effets, comportement de l'IA autour des obstacles.
- **Le sens de rotation avant correction** à 8 et 40 km/h : marques trop rares et trop pâles
  pour conclure.
- **Les couleurs exactes** : vidéos H.264 compressées ; les mesures de teinte sont indicatives.
- **La suite d'E5 dans la référence** : la vidéo d'origine coupe au fondu après l'arrêt ; la
  remise en piste du jeu n'a donc pas de terme de comparaison.

## 6. Bilan

| Séquence | Grave | Moyen | Mineur |
|---|---|---|---|
| E2 | 0 | 0 | 1 |
| E3 | 0 | 0 | 3 |
| E3x | 0 | 3 | 0 |
| E4 | 0 | 1 | 3 |
| E5 | 0 | 2 | 3 |
| Roues avant | 0 | 1 | 2 |
| Rétroviseurs | 0 | 0 | 1 |
| **Total** | **0** | **7** | **13** |

**Avis global.** Oui, les séquences montrent les comportements décrits par l'analyse, et avec
une précision chiffrée remarquable : perte de 48 km/h par tamponnage, environ 96 km/h au
contact roue contre roue, piqué de 6,9 % sur 0,40 s, vol de 0,87 s puis vitesse multipliée par
0,15, arrêt de 3,20 s, vol de 0,60 s sans perte de vitesse sur l'obstacle, volant lâché et
tremblement en glissade. E2 et E3 en vue cockpit sont fidèles et lisibles ; l'explosion en
quatre temps est bien dessinée dans le style du jeu.

Les faiblesses ne sont pas dans les chiffres mais autour : la vue arrière d'E3 ne raconte pas
l'accident (voiture à plat, sans ombre, traversée par l'adversaire) ; E4 montre un contact
collant d'une seconde suivi d'une seconde pénalité que rien n'annonce ; E5 contient un second
choc invisible et se termine par une téléportation sèche. Les roues ne sont plus figées, mais
leur animation casse vers 20 km/h et ne donne pas de sens de rotation au-delà. Les rétroviseurs
sont mieux placés et désormais cohérents avec la vue de face.

Priorités, dans l'ordre : E3x-1 et E4-1 (comportement), E5-1 et E5-2 (lisibilité du scénario),
E3x-2 et E3x-3 (mise en scène de la vue arrière), R-1 (roues).
