# Charte graphique — Virage GP, édition bande dessinée

Cette charte définit le langage visuel **original** du jeu. Elle s'inspire des propriétés
générales de la bande dessinée automobile franco-belge contemporaine (précision mécanique,
encrage net, aplats, vitesse dessinée — voir `docs/research/comic-art-reference.md`) sans
reproduire le trait d'un auteur ni aucune image existante. Tout ce qui est visible est un
dessin vectoriel produit par le code (`src/art/`), jamais une image 3D filtrée.

## 1. Principes

1. **Tout est dessiné** : formes pleines + contours encrés. Aucun dégradé photographique,
   aucune texture bitmap, aucun flou de mouvement réaliste.
2. **Crédibilité mécanique** : proportions réelles (mètres), pas de caricature. Une monoplace
   mesure 4,4 m, une glissière 1 m, un arbre 9 à 13 m.
3. **Lisibilité à haute vitesse** : le centre de l'image (trajectoire) reste dégagé ; les
   détails fins s'effacent avec la distance ; les effets occupent la périphérie.
4. **Cohérence** : mêmes règles d'encre, de tons et de palette pour voitures, décors,
   cockpit, interface et effets.

## 2. Encrage (`src/art/styles/ink.js`)

| Usage | Constante | Épaisseur à 1440p, taille nominale |
|---|---|---|
| Silhouette d'un objet | `LINE.silhouette` | 3,4 px |
| Forme interne, volume | `LINE.form` | 2,2 px |
| Détail mécanique, joint, rivet | `LINE.detail` | 1,3 px |
| Hachure, trait fin | `LINE.hair` | 0,8 px |

- L'encre n'est jamais noire pure : `#16161f` (bleu nuit). Au crépuscule : `#191527`.
- **Variation d'épaisseur obligatoire** : silhouette plus lourde que les détails ; contour
  plus épais du côté de l'ombre (dessous, côté opposé à la lumière) ; les traits libres
  (`brushStroke`) s'effilent aux extrémités. Jamais de filet uniforme sur tout un objet.
- Les contours suivent la silhouette de l'**union** des formes (technique « trait sous
  l'aplat »), pas chaque forme séparément.
- Avec la distance, le trait s'affine puis disparaît (les objets lointains sont des aplats
  aux contours discrets) : c'est le niveau de détail.
- Les limites de couleur (bandes de livrée, zones peintes) reçoivent un trait de détail.

## 3. Couleur et ombrage (`src/art/palettes/palettes.js`)

- **Aplats** : trois valeurs par matière — *clair / base / ombre* — plus un *reflet* (éclat
  presque blanc) réservé aux carrosseries et visières.
- L'ombre d'une couleur est plus sombre **et tirée vers le bleu-violet de l'encre**
  (`shadeHex`), jamais grisée ; le clair est légèrement chaud (`lightHex`).
- Ombres **franches** : la frontière entre deux tons est une courbe nette. Les ombres
  portées au sol sont des aplats translucides (encre à 30–50 %).
- Dégradés : uniquement le ciel (bandes douces) et la brume de distance.
- **Perspective atmosphérique** : les arrière-plans sont moins saturés et plus clairs
  (`farRelief*`, `haze`) ; les voitures et la piste portent les couleurs les plus vives.
- Lumière : zénithale légèrement frontale pour les voitures (dessus clairs, flancs en ton
  de base, dessous dans l'ombre — indispensable pour que les vues miroir restent
  cohérentes) ; haut-gauche pour les décors.
- Une palette de base et une variante par thème de circuit (`forest`, `coast`, `alpine`,
  `desert`, `dusk`…) ; toutes les couleurs sont nommées, aucune n'est codée en dur dans un
  dessin (sauf matériaux fixes de la voiture).
- **Lumière du lieu** : chaque palette porte une teinte `ambient` multipliée sur ce qui n'est
  pas repeint par thème — voitures et cockpit — pour qu'ils appartiennent à la scène (blancs
  réchauffés au crépuscule).

## 4. Matières

| Matière | Traitement |
|---|---|
| Carrosserie peinte | 4 tons, bande de reflet le long des arêtes hautes, joints de panneaux fins |
| Voitures en course | trait de silhouette de 2,1 cm à l'échelle de la voiture (le même poids que le cockpit), arêtes et jonctions à 45 % ; jantes en disques tournants (arcs concentriques) |
| Pneu | 3 gris bleutés, bande claire sur le haut de la bande de roulement, filet clair sur le flanc |
| Jante, métal | 3 gris froids, rayons sombres, écrou central |
| Carbone, fond plat | sombre, peu de détail, sert de « noir » |
| Vitre, visière | bleu, reflet clair en bande |
| Asphalte | gris moyen bleuté, trace de gomme plus sombre sur la trajectoire, traits de plume longitudinaux |
| Herbe | 2 verts en larges bandes aux bords irréguliers, taches sombres, touffes encrées près du joueur |
| Gravier | beige, lignes de ratissage, pointillés |
| Feuillage | masses lobées en 3 tons décalées vers la lumière, marques de feuilles en arcs |
| Béton, bâtiment | aplats clairs, joints fins, ombre sous les débords |
| Foule | taches de couleurs vives (palette `crowd`) cernées, têtes en demi-cercles |

## 5. Perspective et plans

L'image est composée de neuf plans, du fond vers l'avant :

1. ciel (bandes) et nuages (dérivent lentement) ;
2. relief lointain (panorama pâle, défile avec le cap) ;
3. relief proche / ligne d'arbres / ville (défile un peu plus vite) ;
4. objets de bord de piste (panneaux dressés, bandes le long de la route) ;
5. sol : route, vibreurs, bas-côtés (projection 2D par lignes) ;
6. voitures concurrentes (vues dessinées sous 48 angles, 25 dessins + miroir) ;
7. effets (poussière, fumée, traits de vitesse, impacts, onomatopées) ;
8. cockpit (éléments animables) ;
9. interface (cartouches, instruments).

La route est projetée par une division de perspective unique (pas de caméra 3D). La
perspective peut être **dramatisée** : champ de vision qui s'ouvre avec la vitesse, qui se
resserre au freinage ; l'horizon suit partiellement la pente.

## 6. Niveaux de détail

- Un dessin n'est jamais affiché très au-dessus de sa taille d'encrage : au-delà de 2,2 fois,
  un objet de bord de piste s'efface ; les barrières, vues de très près, sont dessinées à
  définition double ; le contour d'un dessin agrandi est raffermi.
- Les bâtiments en bande (tribunes, stands, façades) montrent un pignon à l'extrémité.
- Objets : draw-distance propre à chaque famille (buissons 450 m, panneaux 600 m, arbres
  et tribunes 1 300 m), fondu sur les 60 derniers mètres.
- Bandes de décor : fusionnées par 2 puis 4 segments au-delà de 320 m et 700 m.
- Sol : touffes, hachures et pointillés s'éteignent progressivement jusqu'à 420 m.
- Sprites : mipmaps (le trait s'affine naturellement).

## 7. Animation

- Voitures : 25 dessins de 0° (arrière) à 180° (avant) par pas de 7,5°, miroir pour
  l'autre côté ; la vue choisie dépend de l'angle réel entre la voiture et la ligne de
  visée, ce qui donne du volume sans rotation d'image plate.
- Cockpit : volant et mains tournent ; roues avant dessinées sous plusieurs angles de
  braquage ; marques de roulement et fentes des disques de frein synchronisées avec la
  vitesse ; vibrations franches près de la vitesse maximale seulement ; rétroviseurs montrant
  le lieu et les voitures qui suivent.
- Interface : apparition des cartouches par glissement court (≤ 0,25 s), jamais de
  clignotement rapide.

## 8. Vitesse et effets (tous désactivables un par un)

| Effet | Règle |
|---|---|
| Traits de vitesse | longs traits qui filent du point de fuite **le long du sol**, de part et d'autre de la route (jamais dans le ciel), durée d'une bonne fraction de seconde, intensité liée à la vitesse |
| Étirement de perspective | champ de vision +9° à vitesse maximale, −3° en freinage fort |
| Vibrations du cockpit | amplitude liée à la vitesse, aux vibreurs, à l'herbe |
| Impacts | secousse, éclair bref, éclats en étoile, traits d'impact |
| Onomatopées | réservées aux chocs importants (le mot jaillit de l'éclat), au départ et au moteur à pleine charge ; lettrage « impact » |
| Poussière, fumée | bouffées en aplats 2 tons cernées, de taille plafonnée à l'écran, jamais au contact de la caméra |
| Traces de dérapage | traits sombres sur l'asphalte |
| Cartouches d'incrustation | récitatifs jaunes pour dépassements, meilleur tour |

## 9. Lettrage et interface

- Lettrage procédural « à la main » en capitales (`src/art/styles/lettering.js`) : style
  *caption* pour les textes, *bold* pour les valeurs, *impact* pour titres et onomatopées.
- Cartouches : fond papier `#f4efe2` ou jaune récitatif `#f6e27a`, filet d'encre, ombre
  portée décalée en aplat. Pas d'éléments futuristes, pas de néon, pas de transparence
  « verre ».
- Menus : planche de BD (cases, gouttières blanches, illustration de monoplace ; plan illustré
  du circuit sous le panorama du lieu).
- Écran partagé : deux cases séparées par une gouttière, chacune cernée d'un filet d'encre et
  contenant un poste de pilotage entier.

## 10. À proscrire

Pixel art, basse résolution, low-poly visible, photoréalisme, textures photographiques,
cel-shading 3D générique, esthétique manga, proportions caricaturales, contour noir uniforme,
flou excessif, sprites simplistes, scintillement.
