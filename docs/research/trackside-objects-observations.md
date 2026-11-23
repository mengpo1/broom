<!-- Relevé d'observation de l'enregistrement de 1991 (seul disponible). Les six séquences prioritaires du lot
« collisions et objets de bord de piste » appartiennent à un enregistrement de 1993 de 13 min 38 s qui n'a pas été reçu :
elles ne sont PAS couvertes ici. Relevé fait par un agent d'analyse, puis vérifié par sondage (voir trackside-objects.md § 1). -->

# Objets de bord de piste visibles dans la vidéo de référence — relevé d'observation

Source : `2a63284c-Vroom_by_Lankhor_atari_st_360p_25fps_H264-128kbit_AAC.mp4` (576×360, 25 images/s, 8409 images). Vue 3D = lignes 122 à 360 ; toutes les coordonnées sont dans cette vue (576×238). Image N ↔ t = (N − 1)/25.
Images : `work/reference-frames/T-trackside-objects/` (40 images isolées + 9 planches `sheet-*.jpg`).

Deux sortes d'énoncés seulement, toujours étiquetés :
- **OBSERVATION DIRECTE** — visible dans les images citées, ou mesuré sur leurs pixels ;
- **INFÉRENCE** — interprétation, avec sa justification.

Aucune proposition de conception ou de jouabilité.

## 0. Méthode, unités, limites

- Parcours complet à 1 image/s (9 planches), puis 14 planches de zoom (336 images), une planche de détails ×4, et des relevés chiffrés sur les pixels (classes de couleur par ligne).
- **lc** = largeur de chaussée locale : largeur d'asphalte entre les bordures, sur la ligne d'écran où l'objet touche le sol.
- **ho** = hauteur d'œil : distance verticale à l'écran entre la ligne de fuite (ligne 115,5 de la vue sur le plat, cf. analyse existante § 8) et le pied de l'objet.
- Ces rapports supposent un sol plat ; ils sont donnés à ± 25 %, moins sûrs en côte.
- Repère « voiture » : une voiture adverse occupe ≈ 0,30 lc (analyse existante, image 2949).
- OBSERVATION DIRECTE : la largeur de chaussée **n'est pas constante**. Sur le premier circuit, l'asphalte fait 6 à 7 px par ligne sous la ligne de fuite (images 16, 1569, 994), mais ≈ 3,6 px par ligne dans la section des portiques de 0:25 à 0:35 (image 763). Sur le second circuit, deux à trois voies sont tracées (≥ 550 px à la ligne 168, image 5038). Les rapports en lc sont donc locaux.
- Les comptages « par tour » sont des ordres de grandeur ; les petits objets lointains sont sous-comptés.

## 1. Circuits de l'enregistrement

OBSERVATION DIRECTE (bandeau lu à t = 10, 100, 180, 200, 300, 334 s ; chiffre du tour suivi image par image) :

| Circuit (texte du bandeau) | Plage | Images | Compteur de tours | Durée d'un tour |
|---|---|---|---|---|
| « Grand Prix of The USA — Watkins Glen », 6.405 Km, Stage 6 — sable, ciel cyan | 0:00 – 3:04 | 1 – ≈4607 | « 2 » jusqu'à 0:03,24 (image 82), « 3 » jusqu'à 1:38,12 (image 2454), puis « 4 » | ≈ 95 s (mêmes repères aux images 85 et 2460) |
| Fondu | 3:04,0 – 3:13,3 | ≈4602 – 4834 | noir complet 3:07,08–3:07,60 (4678–4691) | — |
| « Grand Prix of Japan — Fuji Yama », 4.359 Km, Stage 1 — herbe, ciel bleu | 3:07,6 – 5:36 (pleine lumière vers 3:13,3) | ≈4692 – 8409 | « 3 », puis « 4 » à 4:13,68 (image 6343), « 5 » à 5:19,72 (image 7994) | 66,0 s |

- Le compteur change ≈ 0,2 s après le passage sous le portique « START » (images 76 → 82 ; 6338 → 6343).
- 5:28,5 – 5:36 : lettres « NEXT CIRCUIT » en surimpression.
- Dans la suite, **C1** = premier circuit, **C2** = second.
- L'enregistrement de 1993 annoncé n'est pas disponible : rien n'en est dit.
- Écart avec `docs/research/vroom-gameplay-analysis.md` § 8 : le tunnel est traversé à 3:30,2–3:31,4 et 4:35,5–4:36,7 (§ 6) ; à 3:32,8 il s'agit d'un passage sous un pont.

## 2. Flèches de direction / chevrons

Planche `sheet-chevrons.jpg` ; images `f00425…`, `f02138…`, `f02840…`, `f05038…_chevrons.jpg`.

OBSERVATION DIRECTE

- **Forme** : panneau rectangulaire **noir à trois chevrons blancs**, le même dessin en miroir pour les deux sens, sur **deux pieds très courts**. Identique sur C1 et C2.
- **Taille** : ≈ 0,21–0,25 lc de large, 0,07–0,08 lc de haut, pieds 0,02–0,05 lc (images 425, 2840), soit ≈ ¾ de largeur de voiture. Le bord supérieur reste **sous la ligne de fuite** : le panneau est plus bas que l'œil du pilote. Sur C2, route plus large, le même panneau vaut ≈ 0,10 lc (image 5038).
- **Position** : sur le sable ou l'herbe, à 0,02–0,10 lc à l'extérieur de la bordure (25 px image 425, 6 px image 2840, 12 px image 5038).

| Temps | Image | Circuit | Côté | Sens | Situation |
|---|---|---|---|---|---|
| 0:09,20 / 0:09,48 | 231 / 238 | C1 | gauche | → droite | entrée d'une courbe à droite |
| 0:15,96 → 0:17,48 | 400, 425, 438 | C1 | gauche | → droite | courbe à droite en côte ; visible avant et pendant |
| 0:18,48 → 0:20,56 | 463, 479, 482, 500, 515 | C1 | droite | → gauche | courbe à gauche qui suit ; 3 panneaux successifs |
| 0:23,96 | 600 | C1 | gauche | → droite | avec un panneau haut rouge |
| 0:50,84 / 0:52,80 | 1272 / 1321 | C1 | gauche | → droite | sur une crête, à côté d'un cactus |
| 0:58,48 → 0:59,76 | 1463, 1482, 1495 | C1 | droite | → gauche | courbe à gauche, 3 panneaux |
| 1:05,48 → 1:06,48 | 1638, 1650, 1663 | C1 | gauche | → droite | 3 panneaux à ≈ 0,5 s d'intervalle |
| 1:16,48 → 1:18,96 | 1913, 1922, 1945–1975 | C1 | gauche puis face | → droite | courbe à droite (celle d'E5 au tour suivant) |
| 1:22,48 → 1:25,48 | 2063, 2131, 2138 | C1 | droite | → gauche | courbe à gauche |
| 1:53,16 → 1:54,48 | 2830, 2840, 2846, 2863 | C1 | droite | → gauche | mêmes qu'à 0:18–0:20, tour suivant |
| 2:52,48 / 2:53,48 | 4313 / 4338 | C1 | gauche | → droite | mêmes qu'à 1:05, tour suivant |
| 3:20,48 → 3:23,48 | 5013, 5038, 5063, 5069, 5088 | C2 | gauche | → droite | longue courbe à droite, 4–5 panneaux |
| 3:25,72 → 3:28,64 | 5144, 5163, 5202, 5217 | C2 | droite | → gauche | courbe à gauche |
| 3:35,48 → 3:38,48 | 5388, 5413, 5441, 5463 | C2 | gauche | → droite | montée en courbe |
| 3:57,40 → 4:02,40 | 5936, 5968, 6013, 6023, 6061 | C2 | gauche | → droite | longue courbe, ≥ 5 panneaux |
| 4:46,48 | 7163 | C2 | droite | → gauche | 2 panneaux visibles |
| 4:57,48 | 7438 | C2 | les deux | chacun vers l'intérieur | S serré en côte |

- **Emploi** : toujours sur le **côté extérieur** de la courbe, chevrons pointant dans le sens du virage ; jamais vus en ligne droite. Seuls ou en **file de 2 à 5**, à intervalle régulier (≈ 0,3–0,5 s à 220–300 km/h). Le premier apparaît avant l'entrée, les suivants jalonnent la courbe.
- **Par tour** : ≈ 9–10 groupes sur C1, ≈ 8 sur C2.

INFÉRENCE

- Les chevrons indiquent le sens du virage et en jalonnent l'extérieur : la corrélation côté / sens / courbe est systématique dans le tableau, sans contre-exemple.

## 3. Panneaux avant les virages

Planche `sheet-bend-signs.jpg` ; images `f00472…`, `f01900…`, `f05922…_bend-signs.jpg`.

OBSERVATION DIRECTE

Tous sont des **carrés rouges à liseré blanc portant un pictogramme blanc**, sans texte ni chiffre. Deux montages.

**a) Sur un poteau unique au bord de la piste.** Plaque ≈ 0,12 lc de côté, bas de plaque à ≈ 0,10 lc du sol, hauteur totale ≈ 0,22 lc, poteau à 0,13–0,18 lc de la bordure (image 472).

| Temps | Image | Circuit | Côté | Pictogramme | Situation |
|---|---|---|---|---|---|
| 0:17,96 → 0:18,84 | 450, 463, 472 | C1 | droite | flèche montant puis tournant à gauche | entrée de la courbe à gauche, juste avant la file de chevrons |
| 1:15,96 | 1900 | C1 | gauche | flèche vers la droite | entrée de la courbe à droite (celle d'E5) |
| 1:29,56 | 2240 | C1 | droite | flèche coudée vers la gauche | 0,2 s après la structure couverte n° 2 |
| 1:33,48 | 2338 | C1 | gauche | non lisible | ligne droite |
| 1:52,48 → 1:53,16 | 2813, 2823, 2830 | C1 | droite | flèche tournant à gauche | même panneau qu'à 0:18, tour suivant |
| 3:24,80 / 3:25,12 | 5121 / 5129 | C2 | droite | flèche coudée vers la gauche | avant une courbe à gauche |
| 3:39,48 / 3:39,88 | 5488 / 5498 | C2 | droite | flèche coudée vers la gauche | entrée de courbe à gauche |
| 3:41,48 | 5538 | C2 | droite | non lisible | — |

**b) Sur la traverse d'un portique** (une ou deux plaques, même taille).

| Temps | Image | Circuit | Pictogramme | Situation |
|---|---|---|---|---|
| 0:15,48 (passage 0:15,96) | 388 / 400 | C1 | deux plaques à flèche coudée | juste avant le S en côte |
| 0:55,96 (passage 0:56,48) | 1400 / 1413 | C1 | deux plaques, non lisibles | avant la courbe de 0:58 |
| 3:56,84 | 5922 | C2 | deux plaques à flèche coudée vers la droite | avant la longue courbe à droite de 3:57–4:02 |
| 1:07,96 | 1700 | C1 | traits verticaux pleins et pointillés (schéma de voies) | avant une courbe à droite |
| 3:53,40 / 3:53,72 | 5836 / 5844 | C2 | traits verticaux, dont un courbe | série de portiques |
| 4:03,48 | 6088 | C2 | traits pleins convergents + pointillés | sommet de côte avant la descente vers un pont |
| 4:48,48 | 7213 | C2 | un trait plein, deux pointillés, un trait plein | passage sous le portique |
| 4:12,48 ; 5:18,48 | 6313 ; 7963 | C2 | traits (dont courbes) | portique précédant le portique START |
| 0:43,48 | 1088 | C1 | outil (clé plate) | 1–2 s avant le bâtiment rouge à piliers |
| 3:10,48 ; 5:22,48 | 4763 ; 8063 | C2 | outil (clé plate) | 2–3 s avant le bâtiment rouge |

- Panneaux de distance ou panneaux chiffrés : **non observé**.

INFÉRENCE

- Les plaques à flèche annoncent le sens du virage suivant : elles précèdent chaque fois une courbe du sens indiqué, et à 0:18 la plaque devance d'environ 0,3 s le premier chevron.
- Les plaques à traits verticaux ressemblent à un schéma de voies. Elles pourraient annoncer un changement de nombre de voies ou de largeur (la largeur varie réellement, § 0), mais aucune image ne le vérifie.
- La plaque « outil » précède chaque fois le bâtiment rouge à piliers : probablement l'annonce des stands. Non vérifiable, la voiture n'y entre jamais.

## 4. Panneaux publicitaires

Planche `sheet-ad-boards.jpg` ; neuf images `…_ad-boards.jpg`. Les inscriptions ne sont pas transcrites.

OBSERVATION DIRECTE — trois familles.

**a) Grand panneau bas (C1 seulement).** Rectangle rouge sombre avec un dessin multicolore de type logo (jaune, orange, noir, blanc). ≈ 0,85–1,0 lc de large × 0,4–0,5 lc de haut (≈ 3 largeurs de voiture), posé au sol sur deux pieds très courts, à 0,25–0,9 lc du bord.

| Temps | Image | Côté | Situation |
|---|---|---|---|
| 0:05,36 / 0:05,56 | 135 / 140 | gauche | ligne droite après le départ |
| 0:16,48 | 413 | droite | en côte, avant le S |
| 0:17,96 / 0:18,48 | 450 / 463 | gauche | extérieur du S, passe très près |
| 1:50,48 / 1:50,96 | 2763 / 2775 | gauche et droite | mêmes panneaux, tour suivant |

**b) Panneau carré sur deux poteaux bas.** Carré de ≈ 0,3 lc de côté (≈ 1 largeur de voiture ; 0,29–0,35 mesuré, un cas à 0,47 moins sûr), poteaux ≈ 0,05 lc. Le haut dépasse nettement la ligne de fuite. Distance au bord très variable : 0 à 0,4 lc.

| Temps | Image | Circuit | Côté | Aspect | Distance au bord |
|---|---|---|---|---|---|
| 0:09,20 ; 0:10,72 | 231 ; 269 | C1 | droite | bleu foncé, silhouette bleu clair | — |
| 0:39,36 | 985 | C1 | gauche | bleu-violet, lettrage rouge | ≈ 0,24 lc |
| 0:39,72 | 994 | C1 | gauche | vert, ovale et lettrage blancs (type logo) | ≈ 0,04 lc |
| 0:59,24 / 0:59,44 | 1482 / 1487 | C1 | gauche (+ un à droite) | bleu à cercle rouge, puis vert ; violet en face | très près |
| 1:02,76 | 1570 | C1 | gauche | blanc cassé, silhouette gris foncé | ≈ 0,02 lc |
| 1:10,48 | 1763 | C1 | gauche | blanc cassé, dessin jaune | — |
| 1:44,60 / 1:44,88 | 2616 / 2623 | C1 | droite | bleu à silhouette claire, puis blanc cassé à dessin jaune | ≈ 0,37 lc |
| 2:43,48 / 2:43,76 | 4088 / 4095 | C1 | gauche (+ droite) | violet, vert | — |
| 3:20,48 / 3:20,68 | 5013 / 5018 | C2 | paire gauche + droite | image verte et blanche dans un cadre blanc | — |
| 3:29,76 → 3:30,12 | 5245–5254 | C2 | droite | même image, devant le mur du tunnel | — |
| 3:54,20 ; 5:00,60 | 5856 ; 7516 | C2 | gauche | noir, lettrage cursif orange | — |
| 3:56,24 ; 3:58,68 | 5907 ; 5968 | C2 | gauche ; droite | bleu-violet, lettrage cursif rouge | — |
| 5:04,52 | 7614 | C2 | droite | noir, lettrage cursif orange, ≈ 0,35 lc | bord du panneau à l'aplomb de la bordure |

**c) Panneau haut et étroit (« totem »).**

- **C1** : sur **deux poteaux**, ≈ 0,13–0,15 lc de large, hauteur totale ≈ 0,31–0,33 lc dont ≈ 0,05 de poteaux (≈ ½ largeur de voiture de large, 1 de haut), à 0,10–0,25 lc de la bordure. Trois capitales en blocs empilées. Trois livrées : bleu foncé à lettres bleu clair, rouge à lettres bleues, crème à lettres jaunes.
- **C2** : sur **un poteau central**, ≈ 0,19 lc de large, hauteur totale ≈ 0,5 lc dont 0,15 de poteau, à 0,2–0,3 lc de la bordure. Deux idéogrammes empilés. Trois livrées : crème à signes orange, noir à signes orange, rouge à signes roses.

| Temps | Image | Circuit | Côté | Livrée | Situation |
|---|---|---|---|---|---|
| 0:03,36 ; 0:04,64 | 85 ; 117 | C1 | paire gauche + droite | crème | juste après le portique START, symétriques |
| 0:19,12 → 0:19,48 | 479, 482, 486, 488 | C1 | droite | bleu → rouge → crème | extérieur de la courbe à gauche, 3 à la file |
| 0:23,96 / 0:24,48 | 600 / 613 | C1 | gauche | rouge puis crème | ligne droite |
| 0:35,48 / 0:35,96 | 888 / 900 | C1 | gauche | rouge puis bleu | avant la structure couverte |
| 1:02,76 / 1:03,20 | 1570 / 1581 | C1 | droite | crème puis bleu | — |
| 1:53,40 → 1:53,80 | 2836, 2840, 2846 | C1 | droite | bleu → rouge → crème | mêmes qu'à 0:19, tour suivant |
| 3:21,48 → 3:22,72 | 5038, 5058, 5069 | C2 | gauche | crème, rouge, noir | dans la longue courbe à droite |
| 3:44,84 → 3:46,80 | 5622, 5663, 5671 | C2 | gauche | crème, puis noir → rouge (→ crème) | ligne droite des tribunes |
| 4:05,00 / 4:05,52 | 6126 / 6139 | C2 | gauche | crème ×3 | extérieur d'une courbe à droite, espacement régulier |
| 4:08,88 → 4:13,12 | 6223, 6233, 6285, 6313, 6329 | C2 | droite | crème, rouge, noir, rouge, rouge, crème | longue ligne droite avant START, un toutes les ≈ 0,5–1 s |
| 5:11,48 / 5:11,72 | 7788 / 7794 | C2 | gauche | crème ×2 | — |

- **Emploi** : les trois familles se voient en ligne droite comme à l'extérieur des courbes, des deux côtés. Souvent **groupées par 2 ou 3** de types différents (0:39 : violet + cactus + vert ; 0:19 : trois totems + chevrons + plaque à flèche). Les totems reviennent en séquence de trois livrées.
- **Par tour** : C1 ≈ 5–6 grands panneaux bas, ≈ 10–12 carrés, ≈ 12–14 totems ; C2 ≈ 10 carrés, ≈ 15–18 totems, aucun grand panneau bas.

INFÉRENCE

- Les panneaux sont des images plates mises à l'échelle, toujours vues de face : aucune vue de biais ou de dos, y compris en courbe.

## 5. Portiques, portails de départ, ponts

Planche `sheet-gantries.jpg` ; sept images `…_gantries.jpg`.

OBSERVATION DIRECTE

**Portiques.** Cadre plat : deux poteaux carrés et une traverse, bleu-vert foncé sur C1, bleu-violet sur C2, en aplats à deux tons.

- **C1** : entre-poteaux ≈ 1,5–1,8 lc ; poteaux à 0,15–0,3 lc à l'extérieur des bordures, épais de ≈ 0,07–0,10 lc ; dessous de traverse à ≈ 2,0–2,4 ho (images 363, 763). Le portique **START** est beaucoup plus large (≈ 2,7 lc, estimation grossière, image 70).
- **C2** : entre-poteaux ≈ 1,2 lc, poteaux à ≈ 0,1 lc des bordures (image 6338).

| Garniture sur la traverse | Exemples (temps / image / circuit) |
|---|---|
| Panneau rouge « START » en lettres blanches, centré | 0:02,48–0:03,00 / 63, 70, 76 / C1 ; 4:13,48 / 6338 / C2 ; 5:19,48 / 7988 / C2 |
| Deux panneaux lettrés côte à côte (fond bleu lettres rouges, ou l'inverse) | 0:11,40 / 286 ; 0:14,48 / 363 ; 0:48,48 / 1213 ; 0:50,84 / 1272 ; 0:54,48 / 1363 — C1 |
| Un panneau jaune à lettres blanches, centré | 0:26,52 / 664 ; 0:30,48 / 763 ; 0:34,84 / 872 — C1 |
| Un panneau crème à signes orange, ou rouge à signes roses | 3:14,52 / 4864 ; 3:14,92 / 4874 ; 3:52,48 / 5813 ; 4:20,48 / 6513 — C2 |
| Nu, ou avec une ou deux petites plaques rouges (§ 3 b) | 0:27,00 / 676 ; 0:32,76 / 820 ; 3:49,96 / 5750 ; 4:06,48 / 6163 |

- **Emploi** : rarement isolés, le plus souvent **en séries rapprochées**, en ligne droite, en courbe et en côte.
  - C1 : 0:11–0:15 (4–5) ; 0:25–0:35 (≈ 8, section étroite, souvent flanqués de deux cactus) ; 0:47–0:51 (5, dans un S) ; 0:54–0:57,5 (4).
  - C2 : 3:14–3:16,5 (4–5) ; 3:52,5–3:53,7 (4–5 emboîtés, image 5813) ; 4:19,9–4:21,7 (3) ; 4:58,5–5:00.
- **Par tour** : ≈ 25 (± 5) sur C1, ≈ 20 (± 4) sur C2.
- Le portique START marque le changement du compteur de tours (§ 1).

**Ponts (C2 seulement).** Tablier beige à dessous brun, posé sur deux talus verts à flancs gris, avec 2–3 piliers bleus de chaque côté de la route. Trois par tour.

| Approche (temps / image) | Passage dessous (temps / images) |
|---|---|
| 3:17,48 / 4938 | 3:17,64–3:17,68 / 4942–4943 |
| 3:32,48 / 5313 | 3:32,80–3:32,84 / 5321–5322 |
| 4:03,68 / 6093 (vu du haut d'une côte) | 4:04,40–4:04,52 / 6111–6114 |
| 4:22,48 / 6563 | 4:22,96 / 6575 |
| 4:37,52 / 6939 | 4:38,20–4:38,24 / 6956–6957 |
| 5:09,48 / 7738 | 5:10,36–5:10,40 / 7760–7761 |

- Passerelles piétonnes, arches, banderoles tendues : **non observé**.

INFÉRENCE

- Portiques et ponts sont dessinés en polygones pleins : bords nets à toutes les distances, sans pixellisation en gros plan, contrairement aux panneaux et à la végétation. Cohérent avec l'analyse existante § 8.

## 6. Structure couverte (C1) et tunnel (C2)

Planche `sheet-tunnel-covered.jpg` ; images `f00941…`, `f00953…`, `f05250…`, `f05263…`, `f05287…`.

OBSERVATION DIRECTE — **structure couverte (C1), deux par tour**

| N° | Approche | Dessous (images où la chaussée est assombrie) | Sortie |
|---|---|---|---|
| 1 (deux panneaux lettrés sur le bord avant du toit) | 0:35,5 → 0:37,8 (888–946) | 0:37,84–0:38,68 (947–968), 0,88 s | 0:38,76 (970) |
| 1, tour suivant | 2:17,5 → 2:21,3 (3438–3535) | 2:21,40–2:22,64 (3536–3567), 1,28 s | 2:22,7 |
| 2 (toit nu) | 1:27,96 → 1:28,7 (2200–2219) | 1:28,76–1:29,32 (2220–2234), 0,60 s | 1:29,40 (2236) |

- **Forme** : dalle de toit plate **rouge**, dessous bordeaux foncé, large de ≈ 1,8 lc, portée par deux files de piliers bleu foncé (≥ 5 par côté) à ≈ 0,25 lc à l'extérieur des bordures. De loin : un trapèze rouge mince au-dessus de traits verticaux (images 925, 2213).
- **Dessous** : le plafond occupe le tiers supérieur de la vue ; ciel et sable restent visibles entre les piliers, qui défilent des deux côtés.
- **Toute l'image s'assombrit d'un cran** pendant le passage : chaussée (95,95,95) → (65,65,65), sable (161,127,63) → (129,95,31), ciel (129,224,226) → (98,193,191). Retour en une image à la sortie. L'assombrissement commence à l'image où le toit couvre le haut de la vue.

OBSERVATION DIRECTE — **tunnel (C2), un par tour** (deux traversées)

| Phase | 1re traversée | 2e traversée | Ce que montre l'image |
|---|---|---|---|
| Portail visible | 3:29,1 → 3:30,1 (5228–5254) | 4:34,3 → 4:35,4 (6858–6886) | mur plat bleu-violet (61,65,128), ≈ 3 lc de large et ≈ 2,6 ho de haut ; ouverture rectangulaire bleu nuit (1,31,65) de ≈ 1,25 lc × 2,1 ho, points lumineux déjà visibles ; un panneau illustré devant la partie droite du mur ; arbres à proximité |
| Seuil | 3:30,16–3:30,20 (5255–5256) | 4:35,44–4:35,48 (6887–6888) | le mur remplit le haut de la vue ; chaussée encore claire |
| Intérieur | 3:30,24–3:31,40 (5257–5286), 1,2 s à ≈ 300 km/h | 4:35,52–4:36,72 (6889–6919), 1,2 s | voir ci-dessous |
| Sortie | 3:31,44 (5287), puis extérieur | 4:36,76 (6920) | une image où un cadre bleu nuit (0,32,64) entoure la sortie, chaussée déjà revenue à 128 ; ensuite extérieur normal |

Intérieur :
- parois et plafond d'une **seule couleur presque noire** (0,32,32), sans arête entre mur et voûte ;
- **une file de petits traits lumineux blanc chaud de chaque côté**, en haut des parois, convergeant vers le point de fuite (5–6 visibles par côté) ;
- chaussée assombrie (128 → 96) ; bordures rouge/blanc et **mince bande d'herbe assombrie** entre bordure et paroi toujours visibles ;
- la sortie est visible dès l'entrée : rectangle clair montrant le décor extérieur à sa luminosité normale, qui grandit ;
- les adversaires restent visibles.

Entrée ou sortie en courbe, pente dans le tunnel, éclairage clignotant : **non observé** (tunnel droit et plat dans les deux traversées).

INFÉRENCE

- L'assombrissement sous le toit, sous les ponts (§ 12) et dans le tunnel a la même amplitude (≈ −32 par composante, un cran de palette). Cela ressemble à un seul mécanisme de changement de palette déclenché par « être sous un ouvrage ». Les portiques ne le déclenchent pas.
- Le tunnel paraît fait d'un portail d'entrée, d'un habillage intérieur uniforme et d'un portail de sortie, sans géométrie de paroi détaillée : aucun relief ni joint visible.

## 7. Arbres et végétation

Planche `sheet-vegetation.jpg` ; images `f00664…`, `f01971…`, `f05129…`, `f05788…_vegetation.jpg`.

OBSERVATION DIRECTE

**C1 : cactus uniquement.** Colonne verte à un ou deux bras, en deux verts. Hauteur 0,34 lc (≈ 2,1 ho, image 1922) à ≥ 0,5 lc pour les plus grands (image 664) ; de très petits au loin. Les proches sont à ≈ 0,2–0,25 lc de la bordure ; d'autres sont semés loin dans le sable.

| Temps | Image | Côté | Situation |
|---|---|---|---|
| 0:04,48 | 113 | gauche | après le départ |
| 0:20,56 | 515 | gauche | intérieur de courbe, très près |
| 0:22,48 | 563 | droite | ligne droite |
| 0:26,52 | 664 | paire gauche + droite | encadrent un portique, devant ses poteaux |
| 0:36,96 → 0:37,60 | 925–941 | les deux | 4–5 autour de la structure couverte |
| 0:39,60 ; 0:40,48 | 991 ; 1013 | gauche | à côté de panneaux carrés |
| 0:52,80 | 1321 | gauche | sur une crête, avec un chevron |
| 1:16,84 ; 1:18,80 | 1922 ; 1971 | gauche | intérieur de la courbe à droite ; le second passe très près |
| 2:10,48 | 3263 | gauche | avec un rocher |
| 3:01,48 | 4538 | gauche | juste avant E5 |

**C2 : arbres uniquement.** Couronne aplatie en ombrelle (plusieurs verts), tronc brun mince. Hauteur ≈ 2,9 ho, couronne ≈ 2,5 ho de large, tronc à ≈ 1,8 ho (≈ 0,2 lc) de la bordure (image 5120). Deux gabarits : grand (isolé ou par deux) et petit (en rangs sur les pentes).

| Temps | Image | Côté | Situation |
|---|---|---|---|
| 3:14,52 ; 3:14,92 | 4864 ; 4874 | droite | collé à un poteau de portique |
| 3:24,80 / 3:25,12 | 5121 / 5129 | gauche | ligne droite, très près |
| 3:36,48 | 5413 | les deux | ≥ 8 petits arbres en deux rangs sur la pente d'une courbe |
| 3:37,60 | 5441 | droite | extérieur de courbe |
| 3:43,48 | 5588 | gauche | deux arbres sur une crête |
| 3:48,44 | 5712 | droite | deux grands arbres jumeaux |
| 3:51,48 | 5788 | gauche | groupe de trois dans un S |
| 4:13,48 | 6338 | gauche | au pied du portique START |
| 4:19,24 | 6482 | droite | grand arbre à long tronc |

- **Emploi** : isolés ou en petits groupes, sans espacement régulier, en ligne droite comme en courbe ; fréquemment **associés à un autre objet** (poteau de portique, panneau, rocher).
- **Par tour** : ≈ 20 cactus proches sur C1, ≥ 30 arbres sur C2.
- Buissons, touffes d'herbe, fleurs, haies : **non observé**. La ligne d'arbres sombre de C2 appartient à la bande de décor lointain.

INFÉRENCE

- Cactus et arbres sont des images mises à l'échelle : contours pixellisés en gros plan (images 1971, 5129), comme l'indique déjà l'analyse existante § 8.

## 8. Rochers et objets naturels

Planche `sheet-rocks.jpg` ; images `f00738…`, `f03263…_rocks.jpg`.

OBSERVATION DIRECTE

- **C1 seulement**, un seul modèle : rocher beige clair à ombres brunes, plus haut que large (forme de piton). ≈ 1,0 ho de haut pour ≈ 0,8 ho de large (image 738 : 56 × 46 px, pied à la ligne 171), à ≈ 1,5 ho de la bordure.

| Temps | Image | Côté | Situation |
|---|---|---|---|
| 0:23,96 | 600 | droite | ligne droite, en face de panneaux |
| 0:28,56 / 0:29,48 | 715 / 738 | droite | section étroite des portiques |
| 0:43,96 | 1100 | gauche | en côte |
| 0:58,48 / 0:58,88 | 1463 / 1473 | gauche | avec un cactus, entrée de courbe |
| 1:05,48 | 1638 | droite | en face des chevrons |
| 1:52,88 | 2823 | gauche | intérieur du S |
| 2:10,48 | 3263 | gauche | avec un cactus |

- Toujours isolé, ou couplé à un cactus ; jamais en rangée ; ≈ 6 par tour.
- Sur C2 : aucun rocher, **non observé**.
- La butte rocheuse et les collines de C1, la montagne enneigée de C2 sont dans la bande de décor lointain : elles glissent avec le cap et ne grossissent pas. Ce ne sont pas des objets de bord de piste (image `f00536…_other.jpg`).

## 9. Bas-côtés, terrain, bordures

Planche `sheet-verges-terrain.jpg` ; image `f00438…_verges-terrain.jpg`.

OBSERVATION DIRECTE

- **Sol** : sur C1, sable d'une seule couleur unie (≈ 161,127,63) jusqu'à l'horizon, sans texture, dégradé ni trace. Sur C2, herbe d'un seul vert uni (≈ 1,161,32), avec des aplats plus sombres seulement autour des talus de pont (image 6083).
- **Bordure** : longues bandes alternées rouges et blanches, continue des deux côtés, en ligne droite comme en courbe, sur les deux circuits. Largeur ≈ 0,07–0,10 lc (≈ 0,14 lc dans la section étroite de C1, images 715, 763). Même dessin à l'intérieur et à l'extérieur des courbes.
- **Chaussée** : gris uni (95 sur C1, 128 sur C2) ; tirets blancs centraux sur C1 ; deux à trois voies séparées par des tirets blancs sur C2.
- **Relief** : la route monte et plonge réellement. En côte, le sol passe au-dessus de la ligne d'horizon et montre la suite du tracé (0:16–0:18 image 438 ; 0:41–0:47 ; 3:36,48 image 5413 ; 3:50,48 image 5763 ; 4:03,28 image 6083). Les crêtes masquent la suite (0:52,8 ; 2:38,0 ; 4:00,8 ; 5:06,8). Le terrain à côté de la route suit la même pente : ni fossé ni talus propre à la route, les seuls talus sont ceux des ponts.
- Bac à gravier, bande de couleur différente, bas-côté en deux zones : **non observé**.

## 10. Barrières, clôtures, tribunes, bâtiments, poteaux

Planche `sheet-stands-buildings-poles.jpg` ; images `f00036…`, `f01145…`, `f05638…`, `f06452…`.

OBSERVATION DIRECTE

- **Barrières continues, rails, murets, grillages, piles de pneus : non observé**, sur les deux circuits (cohérent avec l'analyse existante § 3). Les seules parois sont les murs du tunnel et les culées des ponts.
- **Tribunes** : long volume à toit gris en pente débordant vers la piste, mur beige, soubassement brun ou vert foncé, en retrait de ≈ 1–1,5 lc, sans texture de public.
  - C1 : 0:00–0:04 des deux côtés du départ (images 16, 36, 85, 95) ; 1:11,5–1:12,6 à gauche (1788–1810).
  - C2 : 3:44,8–3:46 à droite (5622–5651) ; 4:13–4:14,8 à gauche (6338–6372).
- **Bâtiment rouge à piliers** : toit rouge en pente, bandeau beige, mur rouge sombre, piliers bleu foncé côté piste (C1), à ≈ 0,3 lc du bord, toujours à droite.
  - C1 : 0:44,5–0:46,2 (1113–1150) ; 2:30 (3763–3775).
  - C2 : 3:12 (4813–4821) ; 4:17–4:18,6 (6428–6463) ; 5:25–5:36 (8138–8409).
- **Lampadaires** : mât mince bleu foncé (bleu-violet sur C2) à courte potence en tête, en file de 4–5 à intervalle régulier, au ras de la bordure (0–0,14 lc), hauteur ≈ 2,7 ho (image 16). Toujours dans les zones de tribunes ou de bâtiment.
  - C1 : 0:00–0:02 à gauche (16, 36, 52) ; 1:11,9–1:12,6 à droite (1799–1817).
  - C2 : 3:45,2–3:46,2 à gauche (5631–5655) ; 4:14,2–4:14,8 à gauche ; 4:17–4:19,3 à gauche (6428–6483) ; 5:20–5:36.
- **Mâts à drapeau** : mât bleu foncé, petit drapeau (bleu, rouge, blanc). Trois à la file à gauche, en face du bâtiment rouge de C1 (0:45,48 image 1138 ; 2:30,48 image 3763) ; deux autres de part et d'autre de la piste après le départ (0:03,76 image 95).

## 11. Autres éléments

OBSERVATION DIRECTE

- **Dirigeable à banderole lettrée** dans le ciel de C1 (images 16, 36, 536…) ; il glisse avec le cap, comme déjà noté dans l'analyse existante. Sur C2 : **non observé**.
- **Bande de décor lointain** : collines bleu/ocre et butte sur C1 ; montagne enneigée, ligne d'arbres, petits immeubles blancs et nuages sur C2.
- Petites formes sombres au pied du bâtiment rouge (images 1138, 4813, 6452) : non identifiées.
- Un objet rouge haut coupé par le bord droit à 0:05,36 (image 135), et un petit objet blanc et vert à droite à 0:08,48 (image 213) : non identifiés.
- Structure à double traverse à 3:49,48 (image 5738), deux cadres très rapprochés : nature exacte non déterminée.

## 12. Interactions observées

OBSERVATION DIRECTE

| Interaction | Temps / images | Ce que montre l'image |
|---|---|---|
| **Choc contre un panneau de bord de piste** | 3:01,4–3:04,2 (4536–4606) | Déjà analysé : événement E5, `E5-launch-on-roadside-board_3m01s/` et § 6 de l'analyse. Seul contact avec un objet de décor de tout l'enregistrement. |
| Autre contact avec un objet (panneau, poteau, pilier, cactus, arbre, rocher, mur) | — | **non observé** |
| Passage sous un portique | ex. 0:03,00 (76), 0:15,96 (400), 0:23,40 (586), 0:30,84 (772), 0:34,84 (872), 0:48,5–0:49,0 (1213–1225), 0:55,48 (1388), 0:56,48 (1413), 3:19,96 (5000), 3:34,68 (5368), 4:20,48 (6513), 4:48,48 (7213) | les poteaux sortent par les bords gauche et droit, la traverse et son panneau par le haut ; **aucun assombrissement** (chaussée toujours à 95 / 128) ; aucun contact avec un poteau |
| Passage sous un pont (C2) | six passages, § 5 | tablier brun en haut de la vue, piliers et culées grises sur les côtés ; **image assombrie d'un cran pendant 1 à 4 images vidéo** (0,04–0,16 s) |
| Passage sous la structure couverte (C1) | 0:37,84–0:38,68 ; 1:28,76–1:29,32 ; 2:21,40–2:22,64 | plafond bordeaux, piliers ; **toute l'image assombrie d'un cran** pendant 0,6–1,3 s ; retour en une image (§ 6) |
| Entrée, traversée, sortie du tunnel (C2) | 3:30,16–3:31,44 ; 4:35,44–4:36,76 | § 6 : mur, intérieur presque noir à points lumineux, chaussée assombrie, sortie visible en clair |
| Roues sur la bordure | 0:19,0–0:20,6 (477–517) ; 1:17,2–1:19,3 (1930–1984) ; 1:25,2–1:26,2 (2132–2157) ; 1:44,4–1:44,9 (2612–2623) ; 1:53,4–1:53,9 (2836–2848) | voir ci-dessous |
| Roulage franchement hors piste | 3:02,1–3:04,6 (4554–4616) uniquement (E5) | voir ci-dessous |
| Roulage hors piste sur l'herbe (C2) | — | **non observé** |

Roues sur la bordure :
- la bordure rouge/blanc passe sous une roue avant ; le centre de l'écran est à 11–55 px du bord d'asphalte (ligne 172) ;
- aux images 1940, 2616 et 2838–2846, il n'en est plus qu'à 11–18 px : la roue extérieure est au bord externe de la bordure, au plus à quelques centièmes de lc dans le sable ;
- aucun décollage, aucun arrêt ; à 1:53,56 (image 2840) la voiture passe ainsi à ≈ 0,1 lc d'un panneau à chevrons sans effet visible ;
- pendant ces passages (2612–2623 ; 2836–2850 ; 1930–1950) la ligne d'horizon saute de 3 à 6 px d'une image de jeu à l'autre (ex. 106, 100, 106, 106, 100, 102…), alors qu'elle reste fixe en ligne droite (2285–2310 : 103 constant).

Hors piste (E5) :
- le sable occupe toute la largeur sous le nez ; la surface est identique au reste du sable (même couleur unie, ni trace ni poussière) ;
- à l'arrêt (3:03,56, image 4590) le bord de piste et un panneau à chevrons sont visibles au bord droit de la vue ;
- rien d'autre que la décélération décrite en E5 n'arrête la voiture (pas de mur) ;
- la distance exacte à la piste n'est pas mesurable.

INFÉRENCE

- Le tremblement de l'horizon pendant les passages sur bordure peut venir de la bordure elle-même, mais ces passages ont lieu en courbe, parfois au freinage : la cause ne peut pas être isolée.
- Les objets autres que le panneau d'E5 sont peut-être solides, peut-être pas : l'enregistrement ne contient qu'un seul contact, et le § 6 de l'analyse n'exclut pas la bordure ou le sable comme cause du décollage.

## 13. Ce qui n'a pas pu être déterminé

1. Le contenu de l'enregistrement de 1993 (non disponible).
2. Si les panneaux, poteaux, piliers, arbres, cactus, rochers et murs sont des obstacles : un seul contact dans toute la vidéo (E5), dont la cause exacte reste ouverte.
3. Ce que devient un objet heurté : le panneau d'E5 n'est plus identifiable après le choc.
4. Le sens exact des plaques à traits verticaux et de la plaque « outil » (§ 3).
5. Les dimensions absolues : seuls des rapports à la chaussée et à la hauteur d'œil sont donnés, et la chaussée change de largeur.
6. Les comptages exacts par tour : repérage à 1 image/s, un seul tour complet vu sur chaque circuit.
7. L'effet propre des bordures (tremblement ou non) et l'effet de l'herbe de C2 sur la voiture.
8. L'aspect des objets vus de dos ou de biais, et ce qu'il y a derrière la voiture.
9. Si l'assombrissement dépend de la position exacte sous l'ouvrage ou de l'image où celui-ci couvre le haut de la vue : les deux coïncident à 1–3 images près.
10. Les objets de 0:05,36 (image 135) et 0:08,48 (image 213), les formes au pied du bâtiment rouge, la structure à double traverse de 3:49,48.
11. Le son n'a pas été examiné.
