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
| `#lab=hop` (ou `saut`) | **Saut récupérable** | la voiture arrive décalée de 1,7 m, sa roue avant droite derrière la roue arrière gauche de l'autre ; choc à 200 km/h sur une voiture à 150 : le compteur tombe à environ 125 km/h, court envol, retombée sur les roues derrière l'autre voiture à environ 100 km/h, direction qui se dandine une fois, puis la course continue |
| `#lab=crash` (ou `e3`, `accident`) | **Accident violent** (E3) | envol à 262 km/h, atterrissage, explosion, arrêt 3,2 s, redémarrage sur place |
| `#lab=board` (ou `e5`, `panneau`) | **Panneau de bord de piste** (E5) | envol à 242 km/h, retombée sans explosion, glissade jusqu'à l'arrêt dans l'herbe |
| `#lab=bump` (ou `e4`, `tamponnage`) | Tamponnage arrière (E4) | 146 → environ 59 km/h derrière une voiture à 105 km/h |

## Pendant l'essai

Un bandeau en haut de l'écran rappelle le cas en cours et les touches.

| Touche | Effet |
|---|---|
| `1` `2` `3` `4` `5` | choisir un cas (roue contre roue, saut, accident, panneau, tamponnages) |
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
la voiture retombe à environ 100 km/h derrière l'autre, le volant part d'un côté puis revient
en 0,7 s ; on peut déboîter et repartir. `Entrée` pour recommencer.

À savoir : le classement affiché (position, message de dépassement) n'a pas de sens dans le
banc — il suit la distance cumulée depuis le départ, et les voitures y sont posées à la main.

À savoir aussi : l'autre voiture roule toujours à 150 km/h. Laissée droite, la voiture est
écartée d'un demi-mètre par la perturbation de la direction et repasse à côté de l'autre sans
la toucher. Si l'on revient dans la même voie à pleine charge, on la heurte de nouveau au bout
de deux à trois secondes : ce n'est plus un saut (pas deux fois de suite sur la même voiture)
mais un tamponnage ou un contact de roues, avec leur perte de vitesse habituelle.

## Provoquer un saut soi-même, en course

Conditions du saut récupérable (toutes nécessaires ; valeurs dans
`src/physics/collision-tuning.js`). Il est volontairement **occasionnel** :

- les deux voitures roulent dans le même sens (à moins de 20° près) ;
- la voiture de derrière roule à **150 km/h au moins** ;
- elle arrive **au moins 45 km/h plus vite** que l'autre ;
- **une roue avant derrière une roue arrière** : les voitures décalées d'environ une voie
  (1,5 à 1,86 m entre leurs axes), de sorte que le nez passe à l'extérieur de la roue arrière et
  que la roue avant arrive dans son alignement ; ou, par le côté, le nez à peine engagé le long
  de la queue de l'autre voiture (0,65 m au plus) ;
- elle n'a pas déjà sauté sur cette même voiture depuis moins de 8 s.

Sinon : tamponnage (en ligne, ou nez sur la roue) ou contact de roues (roues côte à côte),
comme avant. Par l'arrière avec un demi-décalage, plus de 54 km/h d'écart et 180 km/h au
moins : accident violent. Le tableau de ce qui déclenche quoi selon le décalage est dans
`collisions.md` (§ 2 bis).

## Vérification automatique du banc

```bash
node work/scripts/lab-check.mjs
```

Le script ouvre le jeu avec l'option, attend le saut produit par les règles, vérifie que le
clavier reprend la main (volant, accélérateur), rejoue l'accident E3, essaie chaque touche, puis
vérifie que sans l'option rien du banc n'existe, ni dans les menus ni en course. Les vidéos de
`work/renders/collisions/` sont enregistrées par ce même banc
(`work/scripts/collision-sequences.mjs`).

Pour lire un cas sans image (une ligne de télémétrie tous les dixièmes de seconde : vitesses,
position latérale, distance à l'autre voiture, commande du pilote, perturbation de la
direction, événements) :

```bash
node work/scripts/lab-trace.mjs hop 8
```

Dans les enregistrements, le banc continue de conduire après l'événement au lieu de rendre la
main : après un saut il garde sa ligne 0,8 s, puis déboîte en 1,2 s et dépasse.
