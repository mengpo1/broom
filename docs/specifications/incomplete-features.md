# Fonctionnalités incomplètes, limites et points non vérifiés

Ce document liste honnêtement ce qui n'est pas fait, ce qui est fait différemment de la
demande, et ce qui n'a pas pu être vérifié dans l'environnement de développement (conteneur
Linux sans carte graphique ni périphériques, Chromium piloté par Playwright, WebGPU exécuté
par le rasteriseur logiciel SwiftShader).

## 1. Écarts volontaires par rapport à la demande

| Demande | Ce qui a été fait | Raison |
|---|---|---|
| Recréer *Vroom Multiplayer* (nom, 18 circuits historiques, cockpit « rappelant immédiatement » l'original) | Jeu **original** du même genre : nom, 18 circuits fictifs en 3 saisons, cockpit, dessins, textes et sons propres | Pas de recréation d'un jeu existant ; les mécaniques génériques du genre sont reprises et documentées |
| Mode Turbo « historique » | Mode à puissance accrue avec suralimentation et surchauffe | Dans la référence, « turbo » est un affichage en fenêtre réduite pour gagner en fluidité : sans objet aujourd'hui |
| Dossier racine `vroom-comic-racer/` | Projet à la racine du dépôt existant, sous le nom Virage GP | Continuité avec le dépôt ; structure interne conforme |
| Références visuelles BD fournies au critique | Références **textuelles** uniquement (`docs/research/comic-art-reference.md`) ; `references/` est vide | Aucune image tierce n'a été téléchargée ni embarquée |

## 2. Non vérifié

| Point | État |
|---|---|
| **Performances sur matériel réel** (60 i/s à 2560×1440, GPU ≤ 11 ms, aucun pic > 16,7 ms) | **Non vérifié.** Aucun GPU dans le conteneur : les benchmarks ont tourné sur SwiftShader (processeur) et ne disent rien d'une carte graphique. L'outil est fourni : `index.html#benchmark=all` ou `npm run benchmark`. |
| **Comparaison de conduite avec le jeu de 1993** | **Non réalisée** : le jeu d'origine n'a pas été exécuté et les sources ne donnent aucune mesure. Les valeurs de conduite sont des estimations (voir `gameplay.md`). |
| **Son** | Vérifié par mesures automatiques (80 contrôles : niveaux, spectre, absence d'écrêtage, réponse aux événements) mais **jamais écouté** par une personne. |
| **Manettes** | Code écrit pour la disposition « standard » de la Gamepad API (deux manettes) ; **non testé** avec un matériel réel. |
| **Souris** | Direction relative avec verrouillage du pointeur ; **non testée** hors automatisation. |
| **Clavier** | Navigation des menus et flux complets testés par automatisation (touches synthétiques) ; pas par un joueur. |
| **Navigateurs** | Testé sous Chromium (Playwright) uniquement ; Firefox et Chrome de bureau non testés. Wayland natif non testé (serveur X virtuel). |
| **Sensations de pilotage** | Évaluées par mesures et par l'IA ; aucun essai humain au volant dans cet environnement. |
| Scintillement, continuité des animations | Contrôlés par tests (images identiques à l'arrêt, variation bornée des effets d'une image à l'autre) et par un critique sur séquences d'images ; pas par visionnage temps réel sur écran. |

## 3. Incomplet ou simplifié

- **Rétroviseurs** : reflet dessiné fixe (route et ciel stylisés) ; ils ne montrent pas les
  concurrents qui suivent.
- **Monoplaces** : un seul modèle de carrosserie pour toutes les écuries (les livrées changent
  par trois couleurs et cinq schémas) ; les numéros de course n'apparaissent que sur les
  grandes illustrations (menus, planches d'introduction et de résultats), pas sur les voitures
  en course ; pas de lettrages de commanditaires sur les carrosseries ; pilotes sans visage.
- **Vues de voitures** : 25 dessins entre 0° et 180° (pas de 7,5°), miroir pour l'autre côté ;
  l'éclairage est donc symétrique (zénithal). Une seule élévation de point de vue.
- **Animations narratives** : planche d'introduction en trois cases et planche de résultats ;
  pas de personnages animés (pilote ajustant son casque : non réalisé), pas de recadrage
  dynamique en course au-delà des cartouches, éclats et onomatopées.
- **Qualifications** : le joueur roule son tour ; les temps des adversaires sont estimés par
  calcul (profil de vitesse) et non roulés.
- **Projection** : limites classiques de la perspective simulée — sol horizontal dans le sens
  latéral, pas de tunnels ni de ponts au-dessus de la piste autres que des portiques, pas de
  dévers ; au-delà de 100° de travers la vue se retourne d'un coup.
- **Décors** : les éléments répétés le long de la piste (tribunes, stands, palissades) sont des
  tuiles : numéros de travée et panneaux se répètent ; les poteaux de grillage penchent dans le
  mauvais sens d'un côté de la piste.
- **Qualité graphique** : le changement d'anti-crénelage (MSAA) demande un rechargement de la
  page ; le niveau de détail et les distances s'appliquent immédiatement.
- **Météo, nuit, dégâts visibles sur les voitures** : absents.
- **Mémoire vidéo** : environ 390 Mo de textures (atlas 10 × 2048², 50 couches de voitures
  1024×512, 3 panoramas 4096×768, mipmaps).
- **Temps de chargement** : tous les dessins sont produits au lancement, avec un pourcentage
  d'avancement. Mesuré dans le conteneur (4 cœurs virtuels, tout en logiciel) : environ 25 s,
  dont 22 s pour tracer les 50 calques de voitures (0,43 s par calque, temps de tracé du
  canvas 2D, pas d'envoi au GPU) ; le temps sur une machine de bureau n'a **pas** été mesuré.
  Ensuite environ une seconde par changement de circuit.
- **Allocations par image** : le code du jeu n'alloue pas dans la boucle de rendu, mais l'API
  WebGPU crée elle-même quelques objets par image (texture courante, vue, encodeur, passe).
- **Vidéo de démonstration** : produite image par image (rejeu déterministe, rendu logiciel),
  et non par capture d'écran en temps réel ; la bande-son est rendue hors ligne par le moteur
  audio du jeu.

## 4. Revue artistique

Voir `docs/art-direction/independent-review.md` pour les défauts relevés par les critiques
indépendants, ceux qui ont été corrigés et ceux qui subsistent.
