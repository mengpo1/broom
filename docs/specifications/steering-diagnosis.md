# Braquage — diagnostic chiffré (lot 5)

Après les essais de la PR #4 le joueur signale qu'il **ne parvient pas à tourner
correctement** et soupçonne **l'absence d'un niveau de braquage**. Il n'était pas établi que
le défaut soit physique. Ce document sépare les trois étages — commandes, simulation, dessin —
et classe le défaut.

**Rien n'a été modifié dans la conduite** : ni direction, ni adhérence, ni aide, ni dessins
des roues. `car-spec.js` est inchangé. Les mesures ont été faites deux fois : sur les sources
de la PR #4 (celles que le joueur a essayées) et sur cette branche.

| Mesure | Commande | Résultat |
|---|---|---|
| Simulation seule, 120 Hz | `node work/scripts/steering-diagnosis.mjs` | `work/benchmarks/steering-diagnosis.json` (cette branche), `steering-diagnosis-pr4.json` (PR #4) |
| Vrai jeu, temps réel, vraies touches | `node work/scripts/steering-handover-check.mjs` | `work/benchmarks/steering-handover.json` |
| Banc d'essai sans navigateur | `tests/gameplay/lab.test.mjs` (« steering after the hand-over ») | dans `npm test` |

## Conclusion, d'abord

| Catégorie | Verdict | Sur quoi il repose |
|---|---|---|
| Problème de commande | **Non** | touche gauche → demande −1, touche droite → +1, à chaque pas de simulation, dans le banc et en course normale ; les deux ensemble → 0 (§ A) |
| Problème de restitution du contrôle après le saut | **Non** | après « À VOUS DE CONDUIRE » le banc n'écrit plus aucune commande ; aucun pilote automatique ne tient la voiture ; elle tourne des deux côtés (§ A). Avant ce message, en revanche, **les touches sont sans effet, par construction** : 1 à 6,6 s selon le cas |
| Problème de braquage physique | **Non, pas d'anomalie** | gauche et droite identiques à 10⁻¹⁵ près ; même réponse après un saut qu'en course normale à la même vitesse, à moins de 1° de cap sur deux secondes (§ B) |
| Problème d'animation des roues | **Pas un manque de positions, mais un dessin qui ne dit pas la vérité à haute vitesse** | les cinq dessins sont tous montrés, à toute vitesse, et le dernier est atteint en 0,15 à 0,22 s ; à 250 km/h il montre 11,8° pour un angle réel de 1,5° (§ C) |
| **Comportement normal à vitesse élevée** | **Oui : c'est la cause** | la butée est réduite avec la vitesse pour ne demander que l'adhérence disponible : à 150 km/h et au-delà la voiture ne tourne plus qu'à 30 à 35° par seconde, sur un cercle de 69 à 155 m de rayon, alors que la plupart des virages sont plus serrés (§ B.3) |

Autrement dit : la voiture obéit, elle fait ce que la simulation prévoit, et ce que la
simulation prévoit à grande vitesse est un virage très large — pendant que le volant et les
roues dessinées montrent un braquage complet. **C'est le fonctionnement validé de la conduite
(aide à la direction du profil arcade), pas un défaut reproductible.** Aucune correction n'a
donc été faite ; le changer est une décision de conduite, soumise à l'arbitrage du joueur
(§ D).

## A. Les commandes

Chaîne : touche → `InputManager.apply()` → `Race.setPlayerInput()` → `car.inSteer` →
simulation. Dans le banc d'essai, `CollisionLab.beforeStep()` est appelé **après** la lecture
du clavier, à chaque pas, et réécrit les commandes tant que la voiture n'est pas rendue.

`steering-handover-check.mjs` ouvre le vrai jeu, enveloppe `setPlayerInput` pour noter qui
l'appelle à chaque pas (le clavier ou le banc), et appuie sur de vraies touches. Pour chacun
des cas du banc (37 contrôles sur la PR #4, 44 sur cette branche où un sixième cas s'ajoute,
tous réussis) :

| Question | Constat (identique pour les cinq cas de la PR #4 et pour les six de cette branche) |
|---|---|
| Les touches gauche et droite sont-elles reçues ? | Oui. Flèche gauche tenue : le clavier demande −1 à chaque pas ; flèche droite : +1 ; les deux : 0 |
| Avant la restitution, qui commande ? | Le banc. Le clavier est lu (−1) mais le banc écrit sa propre demande juste après, à chaque pas : la voiture ne voit jamais la touche. C'est voulu (« pilote automatique jusqu'au contact ») et annoncé par le bandeau |
| Le banc rend-il réellement le contrôle ? | Oui : dès que le bandeau passe à « À VOUS DE CONDUIRE », plus aucun appel du banc à `setPlayerInput` (0 sur tous les pas suivants) |
| Un pilote automatique reste-t-il actif ? | Non : `pitAuto` et `autoDrive` sont faux ; mains lâchées, la voiture reçoit 0 / 0 |
| Les commandes transmises correspondent-elles aux touches ? | Oui, valeur pour valeur, à chaque pas |
| La voiture tourne-t-elle ? | Oui, dans le sens de la touche : position de la direction en butée, lacet et cap du bon signe |

Délai avant restitution, pendant lequel les touches de direction n'ont aucun effet :

| Cas | Voiture rendue après | À quelle vitesse |
|---|---|---|
| 1 roue contre roue | 1,0 s | 52 km/h |
| 2 saut récupérable | 2,1 s (PR #4), 2,2 s (cette branche) | 103 km/h (PR #4, derrière l'autre voiture), environ 185 km/h (cette branche, devant) |
| 3 accident violent | 6,6 s | 0 km/h (redémarrage) |
| 4 panneau | 3,5 s | 0 km/h (fin de la glissade) |
| 5 tamponnages | 1,0 s | 59 km/h |
| 6 nez contre roue (nouveau) | 1,2 s | 64 km/h |

Seule piste de ce côté pour une impression de « ne pas pouvoir tourner » au banc : appuyer
avant le message. Pour l'accident violent cela dure 6,6 s, dont 4 s d'épave immobile.

Braquage après restitution, banc joué sans navigateur (touche tenue 1,3 s, plein gaz) :

| Cas | À gauche | À droite |
|---|---|---|
| 1 roue contre roue | −58,9° en 1,28 s (53 → 96 km/h) | +58,1° en 1,29 s |
| 2 saut (cette branche) | −25,9° en 1,09 s (186 → 220 km/h) | +29,0° en 1,17 s |
| 3 accident | −71,5° en 1,31 s (0 → 70 km/h) | +75,4° en 1,31 s |
| 4 panneau | −46,3° en 1,07 s (0 → 37 km/h) | +46,3° en 1,07 s |
| 5 tamponnages | −55,8° en 1,32 s (59 → 104 km/h) | +53,7° en 1,27 s |
| 6 nez contre roue | −53,3° en 1,28 s (64 → 104 km/h) | +54,5° en 1,31 s |

(Les écarts gauche / droite de quelques degrés viennent de ce que la voiture n'est pas au même
endroit de la route dans les deux essais — bord, mur des stands — et, pour le saut, de la
perturbation de 0,7 s décrite en B.2. La mesure propre de la symétrie est en B.1.) La ligne du
saut dit déjà l'essentiel : **à 186 km/h, une seconde de plein braquage ne fait tourner la
voiture que de 26 à 29°.**

## B. La simulation

### B.1 Gauche contre droite, course normale

Plein braquage tenu deux secondes, plein gaz, sur une copie d'un circuit élargie à 900 m
(asphalte partout : la voiture ne sort jamais de la route). Profil arcade, celui du banc.
Valeurs identiques sur la PR #4 et sur cette branche.

| Vitesse de départ | Butée de la simulation | Butée atteinte après | Lacet à 0,5 s (gauche / droite) | Cap après 1 s | Cap après 2 s |
|---|---|---|---|---|---|
| 60 km/h | 13,8° | 0,225 s | −51,2 / +51,2 °/s | ∓43,5° | ∓81,2° |
| 100 km/h | 5,5° | 0,225 s | −38,2 / +38,2 °/s | ∓32,6° | ∓65,3° |
| 150 km/h | 2,9° | 0,225 s | −32,4 / +32,4 °/s | ∓27,8° | ∓58,7° |
| 200 km/h | 1,9° | 0,225 s | −30,7 / +30,7 °/s | ∓26,2° | ∓56,6° |
| 250 km/h | 1,5° | 0,225 s | −30,3 / +30,3 °/s | ∓25,9° | ∓56,3° |

Demande (`inSteer`) : −1 ou +1 dès le premier pas. Position de la direction (`steer`) : rampe
de 4,6 par seconde, butée en 0,225 s. État de la voiture : en course tout du long. Écart entre
l'essai à gauche et le reflet de l'essai à droite, sur toutes les grandeurs et tous les pas :
**10⁻¹⁵** (bruit d'arrondi), dans les trois profils de conduite. Il n'y a aucune dissymétrie.

### B.2 Après un saut récupérable, contre une course normale à la même vitesse

Le vrai contact est provoqué, la voiture retombe, et dès l'atterrissage la même demande lui est
appliquée pendant deux secondes ; une voiture qui n'a pas sauté, lancée à la vitesse de
l'atterrissage, reçoit la même demande. Écarts (voiture qui a sauté − voiture normale) :

| Demande | Gaz | PR #4 (retombée à 103 km/h) : cap à 2 s | Cette branche (retombée à 183 km/h) : cap à 2 s | Position de la direction identique à partir de |
|---|---|---|---|---|
| Plein gauche | plein | −1,0° | +0,2° | 0,70 s |
| Plein gauche | coupés | +1,4° | +0,5° | 0,70 s |
| Plein droite | plein | +1,1° | −0,1° | 0,35 s |
| Plein droite | coupés | −0,9° | −0,3° | 0,35 s |
| Mains lâchées | plein | −0,2° (0,64 m de côté) | 0,0° (0,53 m de côté) | 0,70 s |

Sur un virage de 56 à 65° en deux secondes, l'écart ne dépasse pas 1,4°. Deux effets
mesurables, tous deux voulus et bornés :

- **la perturbation de la direction après l'atterrissage** (0,7 s, jusqu'à 30 % de la course) :
  pendant sa seconde moitié, la demande d'un côté est réduite de 23 % au plus (la position de
  la direction vaut −0,77 au lieu de −1 à 0,5 s). Les commandes ne sont jamais bloquées : tenir
  le volant d'un côté pendant la perturbation fait tourner de ce côté (test) ;
- **la boîte de vitesses** : plein gaz, la voiture qui vient de sauter accélère d'abord un peu
  moins (7 km/h de retard dans la PR #4, 3 km/h sur cette branche) parce qu'elle a gardé en
  l'air le rapport de sa vitesse d'arrivée et doit rétrograder. Sans effet sur la direction.

La direction répond donc de la même façon après un saut. Ce qui a changé entre la PR #4 et
cette branche est la **vitesse** à laquelle la voiture est rendue au banc (103 → 185 km/h) :
à 185 km/h elle tourne moins vite qu'à 103, comme n'importe quelle voiture à cette vitesse.

### B.3 Ce que la voiture peut tourner, et ce que demandent les circuits

L'aide à la direction du profil arcade réduit la butée avec la vitesse pour que le plein
braquage ne demande que 1,22 fois l'adhérence disponible ; le lacet est alors plafonné à
l'adhérence. Plus petit cercle que la voiture peut suivre, touche tenue :

| Vitesse | Rayon | Lacet | Accélération latérale | Temps pour un quart de tour |
|---|---|---|---|---|
| 60 km/h | 14 m | 68 °/s | 2,0 g | 1,3 s |
| 100 km/h | 36 m | 45 °/s | 2,2 g | 2,0 s |
| 150 km/h | 69 m | 35 °/s | 2,6 g | 2,6 s |
| 200 km/h | 102 m | 31 °/s | 3,1 g | 2,9 s |
| 250 km/h | 131 m | 30 °/s | 3,8 g | 3,0 s |
| 300 km/h | 155 m | 31 °/s | 4,6 g | 2,9 s |

Au-delà de 150 km/h le lacet ne dépasse plus 30 à 35° par seconde, **quelle que soit la
vitesse** : la voiture met près de trois secondes à faire un quart de tour, et le volant n'y
peut rien de plus. Or les virages sont plus serrés que cela :

| Circuit | Virages | Le plus serré (ligne de course) | Vitesse maximale pour le suivre, braquage à fond | Virages impossibles à 150 / 200 / 250 km/h |
|---|---|---|---|---|
| kestrel-fields (celui du banc) | 10 | 38,5 m | 105 km/h | 8 / 10 / 10 |
| hazelbrook | 8 | 91 m | 183 km/h | 0 / 3 / 6 |
| sablon | 8 | 104 m | 203 km/h | 0 / 0 / 4 |
| porto-sereno | 9 | 44 m | 114 km/h | 5 / 8 / 9 |
| meridian-docks | 10 | 32 m | 94 km/h | 10 / 10 / 10 |
| grand-zenith | 15 | 48 m | 120 km/h | 2 / 6 / 10 |
| nova-belvedere | 13 | 35 m | 98 km/h | 12 / 12 / 13 |

(Les 18 circuits sont dans le fichier de résultats.) Sur le circuit du banc d'essai, **huit
virages sur dix ne peuvent pas être pris à 150 km/h et aucun à 200 km/h, même en braquant à
fond** : il faut freiner. Une voiture rendue au joueur à 185 km/h en pleine ligne droite, qui
accélère jusqu'au virage suivant, sortira large — ce que le joueur décrit. Ce n'est pas le
banc ni le saut : c'est la règle de la conduite, la même pour les voitures de l'ordinateur,
qui freinent pour ces virages (leur vitesse limite dans le virage le plus serré de
kestrel-fields est 97 km/h).

## C. La représentation

Le cockpit a cinq dessins de la roue avant (`STEER_FRAMES = 5`) : le centre et deux crans de
chaque côté, couvrant ±14,9°. Le dessin est choisi d'après la position de la direction et une
butée **d'affichage**, qui décroît bien moins vite avec la vitesse que celle de la simulation.

| Vitesse | Angle de la simulation à fond | Angle dessiné à fond | Premier cran | Second cran |
|---|---|---|---|---|
| 30 km/h | 19,5° | 14,9° | 0,05 s après l'appui (23 % de la course) | 0,15 s (69 %) |
| 60 km/h | 13,8° | 14,9° | 0,06 s (27 %) | 0,16 s (73 %) |
| 100 km/h | 5,5° | 14,1° | 0,06 s (27 %) | 0,18 s (80 %) |
| 150 km/h | 2,9° | 13,1° | 0,07 s (31 %) | 0,19 s (88 %) |
| 200 km/h | 1,9° | 12,4° | 0,07 s (31 %) | 0,20 s (92 %) |
| 250 km/h | 1,5° | 11,8° | 0,08 s (34 %) | 0,21 s (96 %) |
| 300 km/h | 1,3° | 11,5° | 0,08 s (34 %) | 0,22 s (100 %) |

Le volant, lui, tourne de 54° à pleine demande, quelle que soit la vitesse.

Les cinq positions représentent-elles suffisamment les niveaux de braquage produits par la
simulation ? **Pour le nombre de niveaux, oui** : au clavier la simulation n'a que trois
demandes (−1, 0, +1) et une rampe de 0,225 s entre elles ; les deux crans de chaque côté sont
tous les deux affichés pendant cette rampe, à toute vitesse, et le dernier cran correspond bien
à la butée. Il n'existe pas, dans la simulation, de niveau de braquage que le dessin ne
montrerait pas : **il n'y a pas de « troisième niveau » caché**. Ajouter des dessins
n'ajouterait pas de braquage.

**Pour la vérité de l'angle, non, et c'est sans doute ce qui trompe** : à 250 km/h le dessin
montre des roues braquées de 11,8° et un volant tourné de 54° quand les roues de la simulation
sont à 1,5°. L'image dit « braqué à fond » alors que la voiture décrit un cercle de 131 m. Ce
choix était voulu (un angle de 1,5° ne se verrait pas) ; il donne exactement l'impression
rapportée : une voiture qui refuse de tourner davantage alors que tout est en butée.

## D. Ce qui peut être proposé — rien n'est fait sans arbitrage

1. **Ne rien changer à la conduite, et le dire à l'écran** (dessin seulement, sans effet sur la
   simulation) : faire dépendre l'angle dessiné des roues, et éventuellement la rotation du
   volant, de la part de braquage réellement utile à la vitesse courante — par exemple le
   second cran seulement en dessous de 100 km/h, le premier au-delà. Le joueur verrait que la
   direction est limitée par la vitesse. À l'inverse cela montre moins de mouvement à haute
   vitesse.
2. **Davantage de dessins ou une interpolation** (fondu entre deux dessins voisins, comme pour
   les marques des pneus) : adoucit les 0,2 s de rampe, utile surtout à la manette ou à la
   souris, où la demande est progressive. Ne change rien à ce que la voiture tourne.
3. **Changer la conduite à haute vitesse** — c'est la seule réponse à « je ne peux pas
   tourner davantage », et elle touche aux paramètres validés (`overSteerAllowance`,
   `steerAssist`, plafond du lacet, frottement des pneus) : par exemple laisser le braquage
   prolongé dépasser l'adhérence, les pneus frottant et ralentissant la voiture, qui resserre
   alors sa trajectoire. Un prototype de ce genre existe, en option et hors de la conduite
   validée, dans le brouillon [mengpo1/broom#6](https://github.com/mengpo1/broom/pull/6)
   (variantes B1 à B3 du braquage tenu, banc de direction). **À arbitrer avant toute mise en
   œuvre** ; rien n'en est repris ici.
4. **Au banc d'essai** : rendre la voiture plus tôt, ou afficher plus visiblement que les
   touches sont inactives pendant le pilote automatique. Non fait : le déroulement du banc
   n'était pas en cause dans les mesures.

## E. Limites de ce diagnostic

- Les mesures portent sur le clavier par défaut (flèches). Les réglages enregistrés par le
  joueur (touches personnalisées, souris, manette) ne sont pas connus et n'ont pas été testés ;
  le clavier ne peut pas donner de demande intermédiaire, la manette et la souris le peuvent.
- Un clavier qui n'enregistre pas trois touches à la fois (accélérateur, direction, surpuissance)
  produirait un vrai « je ne tourne pas » : c'est matériel, invisible depuis le jeu.
- Le profil mesuré en détail est l'arcade (celui du banc). En compétition et en turbo l'aide
  est partielle : le plein braquage demande plus que l'adhérence et freine la voiture (jusqu'à
  10,5 m/s²), sans la faire tourner beaucoup plus.
- Le diagnostic dit ce que fait le jeu ; il ne dit pas si cette conduite est agréable. C'est au
  joueur d'en juger.
