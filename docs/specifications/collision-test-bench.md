# Banc d'essai des collisions — tester les décollages à la main

Les décollages sont rares dans une course normale. Le banc d'essai les provoque à la demande,
**avec les vraies règles du jeu** : il se contente de placer deux vraies voitures et de les
conduire avec des commandes ordinaires (volant, accélérateur) jusqu'à ce qu'elles se touchent.
Le contact, le vol, l'atterrissage et leur mise en scène sont produits par la simulation,
exactement comme en course. Aucune animation n'est jouée « à vide ».

C'est un **outil de développement**. Il n'existe que si le jeu est lancé avec l'option `#lab=…` ;
aucun menu n'y mène et ses touches ne font rien dans une course normale
(vérifié par `work/scripts/lab-check.mjs`).

## Lancer

Depuis le dossier du dépôt, avec le même navigateur que pour jouer (adresse complète en
`file://`, pour que l'option après `#` soit bien transmise) :

```bash
chromium --enable-features=Vulkan "file://$PWD/index.html#lab=hop"
```

Selon le nom du navigateur installé, la même adresse convient à `google-chrome`,
`chromium-browser`, etc. On peut aussi ouvrir le jeu normalement, ajouter `#lab=hop` à la fin de
l'adresse et recharger la page.

| Option | Cas rejoué | Ce qui doit se passer |
|---|---|---|
| `#lab=wheel` (ou `e2`, `roue`) | Roue contre roue, **sans décollage** (E2) | 146 → environ 50 km/h, étoile sur la roue, cap inchangé |
| `#lab=hop` (ou `saut`) | **Saut récupérable, roue contre roue** | la voiture arrive à 215 km/h, 1,95 m à gauche d'une voiture à 150 : sa roue avant droite entre par l'arrière dans la roue arrière gauche de l'autre (étoile sur la roue, « HOP ! »), elle décolle sans être ralentie, **survole l'autre voiture et retombe devant elle** 0,6 s plus tard, à environ 185 km/h ; la direction se dandine une fois, puis la course continue |
| `#lab=crash` (ou `e3`, `accident`) | **Accident violent** (E3) | envol à 262 km/h, la voiture **passe au-dessus de l'autre et retombe devant elle, sur le côté de sa trajectoire** ; explosion, arrêt 3,2 s (l'autre voiture longe l'épave), redémarrage sur place |
| `#lab=board` (ou `e5`, `panneau`) | **Panneau de bord de piste** (E5) | envol à 242 km/h, retombée sans explosion, glissade jusqu'à l'arrêt dans l'herbe |
| `#lab=bump` (ou `e4`, `tamponnage`) | Tamponnage arrière (E4) | 146 → environ 59 km/h derrière une voiture à 105 km/h |
| `#lab=under` (ou `dessous`, `attente`) | **Saut, une troisième voiture reste sous la voiture en vol** (cas extrême) | le saut du cas 2, avec une voiture à côté de la vôtre, à votre vitesse. Dès le décollage elle se rabat sous votre voiture et freine comme elle ralentit pour y rester : la place où vous deviez retomber est prise. L'atterrissage attend (0,6 s), votre voiture ralentit plus qu'elle (215 → 93 km/h) pour la laisser partir, et se pose sur une place libre, derrière elle. Avant la sécurisation de la PR #8, votre voiture restait en l'air jusqu'à l'arrêt complet des deux (4,3 s) |
| `#lab=body` (ou `nez`, `carrosserie`) | **Nez contre roue arrière : pas de saut** | 165 km/h sur une voiture à 100, décalée d'une demi-largeur : plus d'écart et de vitesse qu'il n'en faut pour un saut, mais ce sont les carrosseries qui se touchent. Tamponnage (165 → environ 54 km/h), la voiture ne quitte pas le sol. Jusqu'à la PR #4 ce contact donnait un saut |

## Pendant l'essai

Un bandeau en haut de l'écran rappelle le cas en cours et les touches.

| Touche | Effet |
|---|---|
| `1` `2` `3` `4` `5` `6` `7` | choisir un cas (roue contre roue sans saut, saut, accident, panneau, tamponnages, nez contre roue, saut avec une voiture qui reste dessous) |
| `Entrée` | rejouer le cas en cours |
| `C` | changer de caméra (cockpit, poursuite, face, bord de piste), comme en course |
| `Échap` | pause, comme en course |

Déroulement de chaque cas :

1. **« pilote automatique jusqu'au contact »** : la voiture est amenée sur l'autre à la vitesse
   voulue. Le clavier n'agit pas encore.
2. Le contact se produit (événement réel de la simulation).
3. **« À VOUS DE CONDUIRE »** : dès que la voiture roule à nouveau, elle est rendue au joueur —
   tout de suite après un saut récupérable ou un contact au sol, après le redémarrage pour
   l'accident violent, à la fin de la glissade pour le panneau. Les commandes sont celles de la
   course (flèches, etc.).

Pour sentir un saut récupérable : `2`, laisser faire jusqu'au « HOP ! », puis conduire —
la voiture retombe à environ 185 km/h devant l'autre, le volant part d'un côté (à l'opposé de
la voiture touchée) puis revient en 0,7 s. `Entrée` pour recommencer. Pour voir le contact
lui-même : `C` passe en vue de derrière ; la vidéo `work/renders/collisions/wheel-contact.mp4`
le montre quatre fois plus lentement, à côté d'un schéma vu de dessus.

Tant que le bandeau dit « pilote automatique », **les touches de direction sont lues mais
sans effet** : c'est le banc qui tient le volant (vérifié pas par pas,
`steering-diagnosis.md`). Durée avant que la voiture soit rendue : environ 1 s pour les cas
1, 5 et 6, 2,2 s pour le saut, 3,5 s pour le panneau (la glissade), 6,6 s pour l'accident
(l'épave reste immobile 3,2 s).

À savoir : le classement affiché (position, message de dépassement) n'a pas de sens dans le
banc — il suit la distance cumulée depuis le départ, et les voitures y sont posées à la main.

À savoir aussi : après le saut l'autre voiture est derrière, à 150 km/h, un peu sur la droite.
En freinant ou en se rabattant devant elle, on se fait tamponner : ce sont les règles de la
course, qui s'appliquent aussi à elle.

## Provoquer un saut soi-même, en course

Conditions du saut récupérable (toutes nécessaires ; valeurs dans
`src/physics/collision-tuning.js`, règle complète dans `collisions.md`, § 2 ter) :

- les deux voitures roulent dans le même sens (à moins de 20° près) ;
- la voiture de derrière roule à **119 km/h au moins** ;
- elle arrive **environ 58 km/h plus vite** que l'autre (il lui faut assez d'écart pour passer
  devant pendant le vol) ;
- **roue contre roue, et rien d'autre** : sa roue avant arrive dans le dos de la roue arrière de
  l'autre voiture, les deux carrosseries ne se touchant pas. Cela demande d'être décalé de
  1,87 à 2,03 m de l'axe de l'autre voiture : les pneus se recouvrent, les carrosseries sont à
  quelques centimètres. C'est une bande de 17 cm de chaque côté.

Plus à l'intérieur, ce sont les carrosseries qui se touchent : tamponnage (cas `6`), ou
accident violent si l'on arrive à 180 km/h au moins avec 58 km/h d'écart et 20 à 80 % de la
largeur en recouvrement (cas `3`). Côte à côte, des roues qui se rejoignent par le flanc
frottent (cas `1`) et ne font pas décoller. Le tableau de ce qui déclenche quoi selon le
décalage est dans `collisions.md` (§ 2 ter).

## Vérification automatique du banc

```bash
node work/scripts/lab-check.mjs
```

Le script ouvre le jeu avec l'option, attend le saut produit par les règles, vérifie que la
voiture est rendue **devant** celle qu'elle a survolée et que le clavier reprend la main
(volant, accélérateur), rejoue l'accident E3, essaie chaque touche, vérifie que le cas 6 donne
un tamponnage sans que la voiture quitte le sol, puis que sans l'option rien du banc n'existe,
ni dans les menus ni en course (23 contrôles).

Les sept cas sont aussi joués sans navigateur, par le vrai module du banc et la vraie
simulation, dans `tests/gameplay/lab.test.mjs` : ce que donne chaque cas, où la voiture
retombe, et la direction après restitution (gauche et droite). Et la chaîne clavier → jeu →
voiture est suivie pas par pas dans le vrai jeu par :

```bash
node work/scripts/steering-handover-check.mjs
``` Les vidéos de
`work/renders/collisions/` sont enregistrées par ce même banc
(`work/scripts/collision-sequences.mjs`).

Pour lire un cas sans image (une ligne de télémétrie tous les dixièmes de seconde : vitesses,
position latérale, distance à l'autre voiture, commande du pilote, perturbation de la
direction, événements) :

```bash
node work/scripts/lab-trace.mjs hop 8
```

Dans les enregistrements, le banc continue de conduire après l'événement au lieu de rendre la
main : après un saut il garde sa ligne 0,8 s, puis s'écarte un peu plus de l'autre voiture en
1,2 s et s'en va.
