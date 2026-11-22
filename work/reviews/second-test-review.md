# Virage GP — édition bande dessinée : critique indépendante du second essai

Sujets examinés : (A) le saut récupérable et l'accident violent E3, (B) le régime visuel des roues avant à très haute vitesse, (C) les trois positions de rétroviseurs.

## Résumé

| Sujet | Verdict court | Grave | Moyen | Mineur |
|---|---|---|---|---|
| A. Saut récupérable | Les sept critères sont visibles à l'écran, le saut se distingue nettement de l'accident, aucune voiture n'est traversée. Deux réserves sérieuses sur l'après-atterrissage. E3 est resté l'accident violent attendu. | 0 | 2 | 6 |
| B. Roues à haute vitesse | Vrai nouveau régime (lignes circulaires continues), progressif de ~185 à ~300 km/h, basses et moyennes vitesses inchangées. Rien ne bouge plus entre 300 et 322 km/h. | 0 | 0 | 4 |
| C. Rétroviseurs | Déplacement exactement symétrique, taille, hauteur et forme conservées. B est la correction discrète. C crée de nouveaux recouvrements. | 0 | 1 (variante C seulement) | 3 |

Aucun défaut grave. Les trois défauts moyens :

- **A-1** : à l'atterrissage du saut, la vitesse passe de 180 à 103 km/h en une seule image.
- **A-2** : embardée de 3,7 m après l'atterrissage, et la trajectoire louvoie encore quand l'enregistrement s'arrête. Le « retour au contrôle » n'est donc pas montré jusqu'au bout.
- **C-1** : la variante C fait toucher le rétroviseur et le tour de cockpit en vue de face, et laisse un liseré du bloc de moyeu en vue cockpit. Ne concerne pas B.

## Méthode

- Extraction image par image avec ffmpeg des cinq vidéos de collision (HOP 390 images, HOPx 252, E3 570, E3x 252, hop-vs-accident échantillonné) et de la vidéo des roues (1056 images, deux moitiés). Environ 40 planches et recadrages agrandis regardés, soit à peu près 350 images.
- Télémétrie : lecture directe des `.json` (60 images/s). Les numéros d'image ci-dessous sont ceux des `.json` et des `.mp4` (image 0 = première image).
- Roues : mesures sur le pneu avant gauche, dans un masque de 11 900 pixels (zone x 95–215, y 150–283 de chaque moitié, limitée aux pixels du pneu). Les chiffres de cadence et de scintillement viennent des versions **sans vibration** (`work/renders/sequence/cmp-video-60-steady/`, 1056 images AVANT et 1056 APRÈS, puis `cmp-video-30-steady/`, 408 images APRÈS). La vidéo de comparaison avec vibration a servi pour l'aspect et pour le contrôle croisé. La version à 144 images/s n'était enregistrée qu'à 589 images (40, 120 et début de 200 km/h) : elle ne couvre pas les hautes vitesses.
- Rétroviseurs : mesures en pixels sur les neuf captures 1280×720, par la couleur du biseau du boîtier et par différence d'images entre variantes.
- Je n'ai lu ni `docs/`, ni `tests/`, ni `src/`, ni les scripts, ni les autres revues du dossier `work/reviews/`. Aucun build ni jeu lancé.
- Les planches que j'ai fabriquées sont dans mon dossier de travail temporaire (liste en fin de rapport). Ce dossier peut être effacé ; chaque preuve est donc aussi donnée par fichier source et numéro d'image.

---

## 1. Saut récupérable

### 1.1 Ce qu'on voit, phase par phase (HOP.mp4, HOPx.mp4, HOP.json)

La télémétrie de HOPx est identique à celle de HOP, sauf le tangage de la vue (0 en vue arrière). C'est donc bien la même simulation vue sous deux angles.

| Phase | Images | Temps (s) | Ce qu'on voit et ce qu'on mesure |
|---|---|---|---|
| Approche | 0–97 | 0–1,617 | Joueur à 201,7 km/h, voiture rouge à 151,4 km/h (écart 50,3 km/h), `d` = −0,33 m. La rouge est devant, décalée d'environ 0,9–1,0 m vers la droite (mesure à l'image 96 des deux vues). |
| Contact | 98 | 1,633 | Événements `launch`, `hop`, `contact` (13,99 m/s). Étoile blanche et jaune sur la roue avant droite du joueur, visible des images 98 à 106 (0,15 s). L'étiquette « HOP ! » apparaît, petite. État 6 (en vol). |
| Montée | 99–111 | 1,650–1,850 | Hauteur 0,08 → 0,55 m. Vue cockpit : le nez se cabre (tangage −0,20 des images 102 à 110), l'horizon descend d'environ 90–100 px sur 540, la rouge disparaît sous le nez. Vue arrière : la voiture se soulève, penche (côté droit plus haut), une ombre ovale se détache sur la piste, quelques étincelles. Vitesse 200,9 → 190,9 km/h. |
| Sommet | 111–112 | 1,850–1,867 | Hauteur maximale 0,55 m. En vue arrière, l'aileron est monté de 63 px (y 412 → 349) et incliné d'environ 5°. |
| Descente | 113–124 | 1,883–2,067 | Hauteur 0,54 → 0,08 m, le nez replonge (tangage → +0,107). Vitesse 189,2 → 180,0 km/h. La rouge réapparaît devant, à droite. |
| Atterrissage | 125 | 2,083 | Événement `landing`. Retour immédiat à l'état 1 (en course). **Vitesse 180,0 → 103,4 km/h en une image.** Tangage +0,13 tenu jusqu'à l'image 128. En vue arrière, petits nuages de poussière aux roues (images 125–130). La voiture est sur ses quatre roues, droite. |
| Rebond | 129–146 | 2,15–2,43 | Le tangage revient vers 0 (0,011 aux images 134–135), second petit plongeon à +0,045 (images 139–140), puis 0 à l'image 146. |
| Direction perturbée | 130–~148 | 2,17–2,47 | Le volant part franchement à gauche (main droite en haut, main gauche en bas, environ 60–80° de rotation), sans que le pilote l'ait demandé jusque-là. `d` passe de −0,33 à −1,12 m (image 150). |
| Embardée et correction | 150–198 | 2,50–3,30 | La voiture part à gauche jusqu'à `d` = −4,02 m (image 198), vitesse latérale maximale 5,4 m/s. Le pilote contre-braque à droite (images 165–205). À l'image 198 les roues gauches sont à environ 0,9 m de la ligne blanche : la voiture reste sur l'asphalte. Vitesse 121 → 165 km/h. |
| Reprise | 198–260 | 3,30–4,33 | Retour vers la droite jusqu'à −1,96 m. Vitesse de la rouge retrouvée à l'image 185 (1,0 s après l'atterrissage), vitesse initiale 201,7 km/h retrouvée à l'image 249 (2,07 s après). Le joueur redouble la rouge par la gauche aux images 244–258, sans contact. |
| Fin de séquence | 260–389 | 4,33–6,48 | La trajectoire continue d'osciller : −3,44 m (image 310), −2,30 m (image 362), −2,82 m à la dernière image, encore en mouvement à −1,8 m/s. Vitesse finale 266 km/h. Les mains bougent encore sur le volant. |

Vitesse minimale de toute la séquence : 102,9 km/h (images 131–132). Aucun événement après l'atterrissage : ni second contact, ni `crash`, ni `restart`. Aucun état 7 (accidentée) ni 2 (glissade).

L'étiquette « HOP ! » grandit des images 98 à ~111, reste grande jusqu'à ~135 et a disparu vers l'image 147.

### 1.2 Critère par critère

| Critère | Verdict | Preuve |
|---|---|---|
| 1. Un contact roue contre roue assez énergique soulève légèrement la monoplace | **Oui, avec une réserve** | Contact à 50,3 km/h d'écart, étoile sur la roue avant droite (HOP image 98), décollage de 0,55 m. Réserve : dans la scène, les deux voitures se recouvrent d'environ la moitié de leur largeur (décalage ~0,9–1,0 m, image 96 des deux vues). Ce n'est pas un alignement roue contre roue strict (défaut A-7). |
| 2. Saut court et visible | **Oui** | 27 images en vol (0,45 s). Visible dans les deux vues : horizon qui descend de ~90–100 px en cockpit, voiture soulevée de 63 px avec ombre détachée en vue arrière. |
| 3. Elle garde une partie de sa vitesse | **Oui à la lettre, réserve sur la manière** | 103,4 km/h à l'atterrissage, soit 51 % de la vitesse d'avant contact. Mais la perte de 76,6 km/h tombe en une seule image (défaut A-1). |
| 4. Elle retombe sur ses roues | **Oui** | HOPx images 123–126 : voiture à plat, ombre recollée, poussière aux roues. Pas de tonneau, pas de glissade (état 1 dès l'image 125). |
| 5. La direction est temporairement perturbée | **Oui** | Volant projeté à gauche aux images 130–146 (recadrage des mains), `d` de −0,33 à −4,02 m. |
| 6. Le pilote retrouve le contrôle | **Partiellement démontré** | Pas de tête-à-queue, pas de sortie de piste, vitesse retrouvée en 2,07 s, dépassement propre à 4,2 s. Mais la trajectoire oscille encore à la fin de l'enregistrement (défaut A-2). |
| 7. La course continue sans immobilisation, explosion ni remise en piste automatique | **Oui** | Vitesse minimale 102,9 km/h, état 1 de l'image 125 à la fin, aucun événement `crash` ou `restart`, aucune flamme ni fumée dans les deux vues. |
| Distinguable du grand accident | **Oui, nettement** | Voir le tableau comparatif ci-dessous et hop-vs-accident.mp4 images 112, 126, 152, 200. |
| Aucune voiture traversée à l'atterrissage | **Oui** | HOP images 124–128 : la rouge est une longueur devant, de l'asphalte libre entre elle et la roue avant droite. HOPx images 123–126 : pas de superposition autre que le masquage normal par la voiture du premier plan. Redépassement aux images 244–258 sans recouvrement. Réserve : ce résultat est obtenu parce que le joueur ne se rapproche pas de la rouge pendant le vol (défaut A-3). |

Saut et accident côte à côte :

| | Saut récupérable | Accident violent E3 |
|---|---|---|
| Écart de vitesse au contact | 50,3 km/h | 73,2 km/h |
| Durée du vol | 0,45 s (27 images) | 0,87 s (52 images) |
| Hauteur maximale | 0,55 m | 1,30 m |
| Tangage de la vue cockpit | −0,20 puis +0,13 | −0,60 puis +0,50 (l'écran est tout en ciel) |
| Montée à l'écran en vue arrière | 63 px, inclinaison ~5° | 131 px, inclinaison ~15–20° |
| Onomatopée | « HOP ! » blanc | « BANG ! » orange puis « BOUM ! » rouge |
| Vitesse à l'atterrissage | 180 → 103 km/h | 219 → 32,5 km/h puis 0 |
| Effets à l'atterrissage | Petits nuages de poussière | Étoile, flammes, fumée noire |
| État après | En course | Accidentée 4,05 s, dont 3,20 s à l'arrêt |
| Reprise | Continue | Redémarrage sur place |

Les deux séquences commencent de la même façon (même étoile sur la roue). La différence se lit après environ 0,1 s, par l'onomatopée et par l'ampleur du cabrage.

### 1.3 E3 est-il resté l'accident violent attendu ?

Oui. Mesures sur E3.json, E3.mp4 et E3x.mp4 :

| Attendu | Mesuré |
|---|---|
| Envol long | Contact à l'image 100 (1,667 s). Vol des images 100 à 151 : 0,867 s. Sommet 1,30 m (images 124–127). Le joueur passe au-dessus de l'arrière gauche de la rouge (E3x images 110–140). |
| Atterrissage violent | Image 152 (2,533 s) : événements `landing` et `crash`, vitesse 219,1 → 32,5 km/h en une image, tangage +0,50. |
| Explosion | Étoile et flammes dès l'image 152, « BOUM ! », boule de feu jusque vers l'image 215, fumée noire aux images 220–240, écran dégagé à l'image 251 (E3x). |
| Arrêt d'environ 3,2 s | Vitesse nulle de l'image 203 (3,383 s) à l'image 394. Événement `restart` à l'image 395 (6,583 s). Arrêt : **3,20 s**. État 7 de l'image 152 à 394 : 4,05 s. |
| Redémarrage sur place | `d` = −0,33 m du début à la fin. Reprise depuis 0 km/h : 4,5 km/h à l'image 400, 78 km/h à l'image 480, 157 km/h à la dernière image. |

Comparaison avec l'état antérieur : les 15 images fixes du 21 novembre (`collisions/stills/E3-*.jpg` et `E3x-*.jpg`, antérieures au travail sur le saut) retrouvent chacune une image de la vidéo actuelle. Pour les phases sans particules, la correspondance est au niveau du bruit de compression (écart moyen 2,6 à 4,9 sur 255), avec le même temps et la même vitesse à l'affichage sur les six paires que j'ai comparées à l'œil. Le déroulé et le cadrage d'E3 n'ont donc pas changé.

Une différence de détail, non expliquée (défaut A-8) : à l'image 170 de E3.mp4 (affichage 0:06.858, 20 km/h), l'étoile blanche d'impact est à gauche du « BOUM ! ». Sur l'image fixe `E3-5-explosion-growing.jpg`, au même temps et à la même vitesse affichés, elle était à droite. Je ne peux pas dire si c'est un effet aléatoire ou une modification.

---

## 2. Roues avant vues du cockpit

### 2.1 Ce que fait le nouveau régime

AVANT, à toutes les vitesses : trois dessins de petites hachures (une paire sombre et claire par marque) qui se succèdent, toujours dans le même ordre. Le rythme monte très peu avec la vitesse : 23 changements par seconde à 40 km/h, 30 à 322 km/h.

APRÈS, jusqu'à environ 180 km/h : exactement la même chose. Au-delà, un second dessin se superpose progressivement : de longues lignes d'encre qui suivent la courbure du pneu sur toute la bande de roulement, accompagnées de traînées claires. Les hachures s'estompent et s'allongent en même temps. À partir d'environ 300 km/h il ne reste que les lignes continues et les traînées. Le rythme de changement n'est pas modifié.

Ce n'est donc pas « les mêmes dessins plus vite » : la cadence est la même qu'avant, ce sont les dessins qui changent.

### 2.2 Mesures par vitesse (versions sans vibration, 60 images/s)

Définitions : « part couverte » = part des pixels du pneu appartenant à un trait fin. « Écart entre dessins » = différence moyenne de luminance entre deux dessins successifs (sur 255). « Scintillement » = variation temporelle efficace par pixel (sur 255). « Traits fixes » = part des pixels de trait sombre qui restent en place d'une image à l'autre.

| Vitesse | Changements par seconde (AVANT / APRÈS) | Plus longue suite d'images identiques | Part couverte (AVANT / APRÈS) | Écart entre dessins (AVANT / APRÈS) | Scintillement (AVANT / APRÈS) | Traits fixes APRÈS | AVANT et APRÈS identiques ? |
|---|---|---|---|---|---|---|---|
| 40 km/h | 23 / 23 | 3 / 3 | 7,3 % / 7,2 % | 4,78 / 4,81 | 7,53 / 7,65 | 2 % | Oui (écart 0,49, soit le bruit JPEG) |
| 120 km/h | 27 / 27 | 3 / 3 | 7,4 % / 7,3 % | 4,78 / 4,81 | 7,55 / 7,66 | 2 % | Oui (0,49) |
| 200 km/h | 29 / 29 | 3 / 3 | 7,3 % / 7,4 % | 4,78 / 4,41 | 7,53 / 6,80 | 2 % | Presque (0,96) : voile de lignes à peine visible |
| 250 km/h | 29 / 29 | 3 / 3 | 7,4 % / 15,5 % | 4,78 / 3,38 | 7,55 / 4,78 | 44 % | Non : hachures et lignes mêlées |
| 300 km/h | 30 / 30 | 3 / 3 | 7,4 % / 17,6 % | 4,82 / 2,40 | 7,72 / 3,25 | 60 % | Non : lignes continues |
| 322 km/h | 30 / 30 | 3 / 3 | 7,6 % / 18,0 % | 4,78 / 2,34 | 7,58 / 3,17 | 63 % | Non : lignes continues |

Sens de rotation : dans tous les segments, AVANT comme APRÈS, les trois dessins se suivent toujours dans le même ordre (aucun pas en arrière sur 37 à 47 pas par segment). Aux basses vitesses, cet ordre fait monter les marques vers le haut de l'écran, par pas d'un tiers de l'intervalle : c'est le sens d'une roue qui avance. Le nouveau régime garde le même ordre.

À 30 images/s (APRÈS seul) : 23, 27, 29, 29, 29 et 29 changements par seconde de 40 à 322 km/h, toujours dans le même ordre, deux images identiques de suite au maximum. La cadence est donc réglée sur le temps et non sur le nombre d'images.

Avec la vibration du cockpit (vidéo de comparaison, ±1 px à partir de 300 km/h) : le scintillement à 322 km/h passe de 7,96 à 4,92, soit −38 % au lieu de −58 % sans vibration. Les lignes fines sont plus sensibles au tremblement que les hachures.

La roue droite se comporte comme la gauche, en miroir (mêmes écarts image à image à ±0,1).

### 2.3 Accélération continue de 0 à 322 km/h (images 576 à 1055)

- Jusqu'à 180 km/h : AVANT et APRÈS identiques (écart moyen 0,47, maximum 0,71, c'est le bruit de compression).
- Le nouveau dessin commence entre 180 et 190 km/h, puis monte de façon régulière : écart AVANT/APRÈS de 0,82 à 190–200 km/h, 1,71 à 220–230, 2,56 à 250–260, 3,47 à 280–290, 3,77 à 290–300.
- Il atteint 95 % de sa force finale à 292 km/h, puis ne change plus : 3,88 à 300–310, 3,84 à 310–320, 3,86 à 322.
- Aucun saut : entre 185 et 300 km/h, la hausse sur 0,1 s est de 0,11 en moyenne et de 0,23 au maximum, pour une montée totale de 3,3 étalée sur 171 images (2,85 s).
- Part couverte par les traits : 7,3 % jusqu'à 200 km/h, 9,8 % à 215, 13,5 % à 235, 16,0 % à 255, 17,0 % à 285, 17,6 % à partir de 300.
- Ordre des dessins : 210 pas en avant. Un seul pas en arrière, vers 9 km/h, identique AVANT et APRÈS (démarrage, sans rapport avec la modification).

### 2.4 Verdict point par point

| Attendu | Verdict | Preuve |
|---|---|---|
| Marques individuelles moins discernables | **Oui** | À 300 et 322 km/h les rangées de hachures ont disparu au profit de lignes longues (images 424–431 et 520–527 de la vidéo, moitié basse). À 250 km/h elles se lisent encore, atténuées. |
| Impression de défilement continu | **Oui** | Lignes continues sur toute la bande de roulement, 60 à 63 % de traits fixes : le pneu se lit comme une surface qui file. |
| Traits ou ombrages circulaires compatibles avec le style BD | **Oui** | Traits d'encre d'épaisseur variable qui suivent la courbure du pneu, traînées claires fines. Pas d'aplat d'ombre : uniquement du trait. Cohérent avec le reste du dessin. |
| Pas de roue figée | **Oui** | 30 changements par seconde à 300 et 322 km/h, 3 images identiques de suite au plus (50 ms). |
| Pas de rotation inversée apparente | **Oui pour ce qui se mesure** | Ordre des dessins constant à 60 et 30 images/s. Ce que l'œil perçoit en mouvement ne se juge pas sur des images arrêtées (section 5). |
| Scintillement limité | **Oui** | −58 % à 322 km/h sans vibration, −38 % avec. Il reste un battement à 10 Hz des traînées claires (défaut B-2). |
| Ne pas se contenter d'augmenter la fréquence des mêmes dessins | **Oui** | Cadence inchangée (30/s avant et après), dessins différents. |
| Évolution entre vitesse élevée et vitesse maximale | **Oui de 250 à 300, non de 300 à 322** | 250 → 300 : part couverte 15,5 → 17,6 %, écart entre dessins 3,38 → 2,40. 300 → 322 : 17,6 → 18,0 % et 2,40 → 2,34, soit rien de visible (défaut B-1). |
| Transitions progressives | **Oui** | Montée régulière de ~185 à ~300 km/h, sans saut. |
| Basses et moyennes vitesses conservées | **Oui** | Identiques à 40 et 120 km/h et sur toute la rampe jusqu'à 180 km/h. À 200 km/h, différence à peine perceptible (lignes à ~15 % de leur force, hachures atténuées de ~8 %). |

---

## 3. Rétroviseurs

### 3.1 Mesures en vue cockpit (1280×720)

Positions des biseaux latéraux du boîtier (colonnes de pixels) :

| Variante | Rétroviseur gauche | Rétroviseur droit | Centre gauche / centre droit ramené en miroir | Écart de symétrie | Espace libre entre les deux |
|---|---|---|---|---|---|
| A (précédente) | x 55–227 | x 1052–1224 | 141,0 / 141,0 | 0,0 px | 824 px |
| B (légèrement rapprochés) | x 85–257 | x 1022–1194 | 171,0 / 171,0 | 0,0 px | 764 px |
| C (un peu plus) | x 114–286 | x 993–1165 | 200,0 / 200,0 | 0,0 px | 706 px |

- Déplacement : A → B = 30 px de chaque côté, B → C = 29 px de chaque côté, strictement symétrique. 30 px représentent 2,3 % de la largeur d'écran et un sixième de la largeur du rétroviseur.
- Taille : 173 px entre biseaux (environ 181 px contour compris) dans les trois variantes et des deux côtés.
- Hauteur : contour haut à y = 583, contour bas à y = 684 dans les trois variantes et des deux côtés (profils de luminance identiques).
- Forme et orientation : même rectangle à coins coupés. Le reflet se déplace avec le boîtier et montre la même scène (voiture jaune et voiture rouge aux mêmes places dans la glace, à ±2 px).

### 3.2 Cohérence avec les vues extérieures

- Vue de face : les deux rétroviseurs du joueur se rapprochent de 5 px chacun à chaque pas (face côté gauche de l'écran : x 676–700, 681–704, 686–710 ; côté droit : 842–866, 838–860, 832–856). Écart entre centres : 154,5 → 147,0 → 139,5 px, soit −4,9 % puis −5,1 %. En vue cockpit : 997 → 937 → 879 px, soit −6,0 % puis −6,2 %. Les deux vues bougent dans le même sens, symétriquement et dans des proportions voisines. Taille des faces conservée (25×11 px, à 1–2 px près).
- Les autres voitures suivent aussi : la rouge en vue de face (x 380–452) et la bleue en vues cockpit et arrière. Le changement s'applique donc au modèle de voiture et pas seulement à la vue du pilote.
- Vue arrière : **elle ne montre rien**. Aucun pixel de la voiture du joueur ne change entre A, B et C (ses rétroviseurs sont cachés par les roues arrière sous cet angle). Les seuls pixels modifiés (18 à 22) sont sur la voiture bleue au loin. La troisième ligne de la planche ne permet donc pas de vérifier la cohérence (défaut C-3).

### 3.3 Superpositions

| | A | B | C |
|---|---|---|---|
| Bord extérieur, vue cockpit | Dépasse du pneu de 13 à 21 px et cache environ 1 270 px de piste par côté | À l'intérieur du pneu (7 à 16 px en retrait) : ne cache plus de piste (40 px) | À l'intérieur du pneu |
| Bord intérieur, vue cockpit | Environ 10 px avant le bloc gris du moyeu : pas de recouvrement | Recouvre la partie gauche du bloc gris. Le coin haut du bloc ressort juste au coin coupé du rétroviseur | Recouvre presque tout le bloc et la moitié de la jante. Il reste un liseré clair d'environ 35×8 px au-dessus du rétroviseur |
| Vue de face, rétroviseur proche du tour de cockpit rouge | 5 à 9 px libres | 1 à 5 px libres : presque tangent | Les contours se touchent, la pointe du tour de cockpit est masquée |
| Ordre d'affichage | Correct | Correct | Correct |

La visibilité de la piste n'est réduite dans aucune variante. Elle est très légèrement meilleure en B et C, puisque le rétroviseur ne déborde plus sur l'asphalte.

### 3.4 Laquelle est la correction « discrète » ?

**B.** Le joueur a dit « bien placés mais légèrement trop écartés » : 30 px par côté se remarquent en comparaison directe sans changer la composition, et B supprime le débord sur la piste. C déplace le rétroviseur d'un tiers de sa propre largeur, masque la jante et crée deux recouvrements nouveaux.

B n'est pas sans défaut : la rencontre entre le coin du rétroviseur et le bloc de moyeu est maladroite (défaut C-2).

---

## 4. Défauts classés

### A. Saut récupérable

**A-1 — Moyen. La perte de vitesse à l'atterrissage tombe en une seule image.**
Preuve : HOP.json, image 124 = 180,0 km/h, image 125 = 103,4 km/h. À l'écran, le compteur passe de 180 à 103 entre deux images consécutives de HOP.mp4 (2,067 s et 2,083 s), sans fumée ni trace de pneus, seulement de petits nuages de poussière. La voiture perd 43 % de sa vitesse en 1/60 s pour un saut de 0,55 m, et met ensuite 2,07 s à la retrouver.
À changer : étaler la perte sur 0,2 à 0,4 s, ou la réduire. Si une perte aussi forte est voulue, la justifier à l'image (crissement, fumée de pneus).

**A-2 — Moyen. Embardée de 3,7 m, et retour au calme non montré.**
Preuve : HOP.json, `d` = −0,33 m (image 130) → −4,02 m (image 198), puis −1,96, −3,44, −2,30 et −2,82 m à la dernière image, avec encore −1,8 m/s de vitesse latérale. HOPx image 198 : roues gauches à environ 0,9 m de la ligne blanche. Le même écart, parti 1 m plus à gauche, sortait de la piste. Recadrages des mains : le volant bouge encore aux images 360–389.
Incertitude : la télémétrie ne contient ni l'angle de volant ni la durée de la perturbation imposée. Je ne peux pas séparer ce que le jeu impose de ce que le pilote de démonstration fait ensuite (il semble viser une nouvelle ligne à gauche pour redoubler).
À changer : réduire l'amplitude du coup de volant ou l'amortir plus vite ; enregistrer une séquence plus longue qui montre la trajectoire stabilisée ; ajouter à la télémétrie la commande de direction et l'indicateur de perturbation.

**A-3 — Mineur. Pendant le vol, la vitesse affichée ne correspond pas à ce que montre l'image.**
Preuve : HOPx, largeur de la bande jaune de l'aileron de la rouge : 46 px (image 60), 77–78 px (images 96–97), puis 72–74 px pendant tout le vol (images 108–120), 81 px (images 122–124), puis décroissance normale après l'atterrissage (79, 73, 65, 56 px aux images 126, 130, 136, 148). La distance à la rouge reste donc constante à ±0,8 m pendant le vol. Or le compteur indique 201 → 180 km/h contre 151 km/h pour la rouge : le joueur aurait dû gagner environ 4,9 m, soit à peu près une longueur de voiture.
Conséquence : c'est ce qui garantit qu'aucune voiture n'est traversée ici. Je n'ai pas pu vérifier ce que cela donne dans d'autres configurations.
À changer : faire baisser la vitesse affichée dès le contact, ou assumer le blocage et le documenter.

**A-4 — Mineur. Saute de dessin de la voiture rouge au décollage et à l'atterrissage (vue cockpit).**
Preuve : HOP.mp4, images 97 → 98 (la rouge passe d'une vue arrière à une vue de trois quarts) et 125 → 126 (retour brutal à la vue arrière). Une image chacune. La vue arrière ne montre pas ce changement.
À changer : interpoler l'angle ou garder le même dessin pendant le vol.

**A-5 — Mineur. L'étiquette « HOP ! » recouvre la voiture rouge au moment de l'atterrissage.**
Preuve : HOP.mp4, images 124 à 140 : le mot est posé sur la rouge, au moment précis où le pilote doit la voir.
À changer : décaler l'étiquette vers le haut ou la faire disparaître avant l'atterrissage.

**A-6 — Mineur. Attitude différente selon la vue.**
Preuve : HOPx images 104–118, voiture inclinée d'environ 5° (côté droit plus haut). HOP images 104–111, horizon horizontal (4 px d'écart entre x = 150 et x = 800) : la vue cockpit se cabre sans rouler.
À changer : ajouter un léger roulis à la vue cockpit, ou le retirer de la vue extérieure.

**A-7 — Mineur. La scène de démonstration n'est pas un alignement roue contre roue strict.**
Preuve : image 96, vue arrière : pneus arrière du joueur à x 343–395 et 550–603, pneus arrière de la rouge à x 460–510 et 608–638. Les axes des deux voitures sont décalés d'environ 0,9 m ; même résultat en vue cockpit (~1,0 m). La roue arrière gauche de la rouge est donc devant le nez du joueur, et l'étoile est dessinée sur la roue avant droite.
Conséquence : le matériel ne prouve pas que le saut exige un contact de roue à roue.
À changer : enregistrer un cas avec un décalage d'environ 1,6 m, et un cas nez dans la boîte, pour montrer ce qui déclenche quoi.

**A-8 — Mineur. E3 : étoile d'impact placée différemment de l'image de référence.**
Preuve : E3.mp4 image 170 contre `stills/E3-5-explosion-growing.jpg` (même temps 0:06.858, même vitesse 20 km/h) : étoile blanche à gauche du « BOUM ! » aujourd'hui, à droite le 21 novembre. Les images E3x d'explosion ne se recalent pas non plus au pixel (écart 9 à 12 contre 2,6 à 4,5 pour les autres phases).
À changer : rien si c'est un tirage aléatoire ; sinon le signaler, puisque E3 devait rester tel quel.

### B. Roues

**B-1 — Mineur. Plus aucune évolution entre 300 et 322 km/h.**
Preuve : part couverte 17,6 % contre 18,0 %, écart entre dessins 2,40 contre 2,34, traits fixes 60 % contre 63 % ; sur la rampe, 95 % de la force finale à 292 km/h. Les images 424–431 (300 km/h) et 520–527 (322 km/h) sont indiscernables.
À changer : étirer la transition jusqu'à la vitesse maximale, ou réserver un dernier degré (traînées plus longues, hachures claires totalement fondues) aux 20 derniers km/h.

**B-2 — Mineur. Battement résiduel à 10 Hz des traînées claires.**
Preuve : à 322 km/h le cycle de trois dessins tenus deux images chacun subsiste. Écart entre dessins 2,34, composante 4–15 Hz du scintillement 2,74 (contre 6,55 avant). Visible en comparant les images 520, 522 et 524.
À changer : réduire encore la différence entre les trois jeux de traînées, ou passer à six phases plus proches.

**B-3 — Mineur. Entre 220 et 270 km/h, deux systèmes de dessin se superposent.**
Preuve : images 328–335 (250 km/h) : rangées de hachures encore lisibles par-dessus les lignes longues. C'est la zone la plus chargée (part couverte 15,5 %, écart entre dessins 3,38).
À changer : allonger davantage les hachures avant de faire apparaître les lignes, pour que la transition se lise comme un étirement.

**B-4 — Mineur. Le gain sur le scintillement est en partie repris par la vibration du cockpit.**
Preuve : à 322 km/h, 7,96 → 4,92 avec vibration (−38 %) contre 7,58 → 3,17 sans (−58 %). La bande 25–30 Hz est même légèrement plus forte après (1,47 contre 1,38).
À changer : épaissir un peu les lignes ou les adoucir aux bords, pour qu'un décalage d'un pixel se voie moins.

### C. Rétroviseurs

**C-1 — Moyen, variante C seulement. Nouveaux recouvrements.**
Preuve : `mirror-C-FRONT.png`, lignes y 345–355 : le contour du rétroviseur (x jusqu'à 713) touche le tour de cockpit rouge, dont la pointe gauche recule de x 709–713 à x 714. `mirror-C-COCKPIT.png` : liseré clair du bloc de moyeu au-dessus du rétroviseur (x ~255–290, y ~573–583), jante à moitié cachée.
À changer : ne pas retenir C.

**C-2 — Mineur, variante B. Rencontre maladroite avec le bloc de moyeu.**
Preuve : `mirror-B-COCKPIT.png`, autour de x 255–290, y 575–600 (et en miroir à droite) : le coin haut du bloc gris ressort exactement au coin coupé du rétroviseur, gris clair contre gris clair, séparés par 2 px de contour. Le bloc se lit comme une patte du rétroviseur.
À changer : décaler de 3 à 5 px d'un côté ou de l'autre, ou assombrir le bloc derrière le rétroviseur.

**C-3 — Mineur, matériel. La ligne « vue arrière » de la planche ne montre pas les rétroviseurs.**
Preuve : zéro pixel modifié sur la voiture du joueur entre `mirror-A-CHASE.png`, `mirror-B-CHASE.png` et `mirror-C-CHASE.png`.
À changer : prendre la vue arrière légèrement de côté, comme dans HOPx où un rétroviseur dépasse.

**C-4 — Mineur, variante B. Presque tangent au tour de cockpit en vue de face.**
Preuve : `mirror-B-FRONT.png`, y 348–355 : 1 à 5 px libres entre le contour du rétroviseur et le tour de cockpit rouge, contre 5 à 9 px en A.
À changer : rien d'obligatoire ; à surveiller sous d'autres angles de caméra.

---

## 5. Ce que le matériel ne permet pas de juger

- **Les sensations au volant** : si le coup de volant après le saut se rattrape à la main, s'il est juste ou punitif. Le pilote est scripté.
- **Le son** : aucun fichier audio pour le saut, l'atterrissage ou les roues.
- **Les seuils** : un seul cas de saut (50 km/h d'écart) et un seul accident (73 km/h). Rien ne montre où passe la limite entre contact sans décollage, saut et accident, ni si le saut exige vraiment un contact de roue.
- **La fréquence d'apparition en course**, et les autres configurations : en virage, près d'un bord de piste, avec une troisième voiture à côté, par l'autre côté, en contact latéral.
- **L'absence de traversée dans ces autres configurations.** Elle n'est établie que pour cette scène.
- **La fluidité réelle** : les vidéos sont rendues image par image. Rien sur les chutes de cadence ; sous 30 images/s le cycle de trois dessins peut se comporter autrement.
- **144 images/s** : l'enregistrement n'allait que jusqu'au début du segment 200 km/h. Sur cette partie, la cadence est la même qu'à 60 et 30 (23, 26 et 28 changements par seconde, toujours dans le même ordre).
- **Le sens de rotation perçu en mouvement** : seul l'ordre des dessins est mesurable.
- **Les roues en vue extérieure**, et celles des autres voitures : seule la vue cockpit est fournie.
- **Les roues braquées, au freinage, roues bloquées**, ou pendant le saut.
- **Les rétroviseurs en mouvement** : volant braqué, vibration, cabrage du saut, autres circuits et éclairages. Une seule scène fixe.
- **L'utilité des rétroviseurs en jeu** : si une voiture qui double reste visible aussi longtemps dans la glace en B qu'en A.

---

## 6. Tableau final et avis

| Sujet | Grave | Moyen | Mineur |
|---|---|---|---|
| A. Saut récupérable (et contrôle d'E3) | 0 | 2 (A-1, A-2) | 6 (A-3 à A-8) |
| B. Roues à haute vitesse | 0 | 0 | 4 (B-1 à B-4) |
| C. Rétroviseurs | 0 | 1 (C-1, variante C seulement) | 3 (C-2 à C-4) |
| Total | 0 | 3 | 13 |

**Avis global.** Le travail répond à ce qui était demandé sur les trois points. Les roues sont le sujet le plus abouti : un vrai changement de dessin, propre, progressif, qui ne touche pas à ce que le joueur aimait ; seule la toute fin de la plage de vitesse manque de relief. Pour les rétroviseurs, B est la bonne réponse et C est à écarter. Le saut est lisible, bien mis en scène et ne peut pas être confondu avec l'accident, qui lui n'a pas bougé. Sa faiblesse est après l'atterrissage : la vitesse tombe d'un bloc, et l'enregistrement s'arrête avant que la voiture ait retrouvé une ligne stable. Avant de considérer ce point comme acquis, il faut une séquence plus longue avec la commande de direction dans la télémétrie, et au moins deux autres configurations de contact.

---

## Planches de travail

Dossier temporaire `/tmp/claude-0/-home-user-broom/92e87f35-7b37-5f95-8b1d-e11609b34d93/scratchpad/critic-second/` :

- Saut : `hop_r1.jpg`, `hopx_r1.jpg`, `hop_pop.jpg`, `hop_label.jpg`, `hop_hands_r.jpg`, `hop_hands3.jpg`, `hopx_edge.jpg`, `hop_geom.jpg`, `hop_repass.jpg`, `hopx_repass.jpg`, `vs_sheet.jpg`
- E3 : `e3_s3.jpg`, `e3x_s1.jpg`, `e3x_s2.jpg`, `e3_old_vs_new.jpg`, `e3_old_vs_new2.jpg`
- Roues : `wheels/steady_poses.jpg`, `wheels/ramp_strip.jpg`, `wheels/tyre520_2x.png`, `wheels/right520.jpg`, `wheels/kymo_const.png`, `wheels/BA_040.jpg` à `wheels/BA_322.jpg`, `wheels/A250_big.jpg`, `wheels/A300_big.jpg`, `wheels/A322_big.jpg`
- Rétroviseurs : `mir/cockpit_zoom.jpg`, `mir/cockpit_inner_outer.png`, `mir/front_zoom8.png`, `mir/chase_zoom.png`
