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
| `#lab=hop` (ou `saut`) | **Saut récupérable** | court envol à 200 km/h, retombée sur les roues derrière l'autre voiture, direction qui se dandine une fois, puis la course continue |
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

## Provoquer un saut soi-même, en course

Conditions du saut récupérable (toutes nécessaires ; valeurs dans
`src/physics/collision-tuning.js`) :

- les deux voitures roulent dans le même sens (à moins de 20° près) ;
- la voiture de derrière roule à **120 km/h au moins** ;
- elle arrive **au moins 36 km/h plus vite** que l'autre ;
- **roue sur roue** : par l'arrière avec un demi-décalage (20 à 80 % de la largeur en
  recouvrement), ou côte à côte quand seule sa roue avant est à hauteur de la roue arrière de
  l'autre (les voitures se chevauchent sur moins de la moitié de leur longueur).

En dessous : tamponnage ou contact de roues habituels. Au-dessus, par l'arrière (plus de
54 km/h d'écart et 180 km/h au moins) : accident violent.

## Vérification automatique du banc

```bash
node work/scripts/lab-check.mjs
```

Le script ouvre le jeu avec l'option, attend le saut produit par les règles, vérifie que le
clavier reprend la main (volant, accélérateur), rejoue l'accident E3, essaie chaque touche, puis
vérifie que sans l'option rien du banc n'existe, ni dans les menus ni en course. Les vidéos de
`work/renders/collisions/` sont enregistrées par ce même banc
(`work/scripts/collision-sequences.mjs`).
