# Images de référence — analyse d'une vidéo de gameplay

Extraits de la vidéo analysée dans `docs/research/vroom-gameplay-analysis.md`.

- **Origine** : vidéo tierce fournie par l'utilisateur (576×360, 25 images/s, SHA-256
  `3c902ecf391aea6b52b49c2cef136f1637db0f6e579029c8ff5d73eb5ce0b186`). La vidéo elle-même
  n'est pas dans le dépôt.
- **Usage** : matériel d'analyse uniquement. Rien de ce dossier n'est utilisé, chargé ou
  embarqué par le jeu ; aucun de ces dessins n'a vocation à y être reproduit.
- **Cadence** : la source est à 25 images/s (pas de 60 images/s possible). Dans chaque
  dossier d'événement, `frames/` contient **toutes** les images de la séquence, à la cadence
  native. Le jeu filmé ne produit qu'environ 18 images distinctes par seconde : une image sur
  quatre environ répète la précédente.
- **Nommage** : `fNNNNN_MmSSsmmm.jpg` — numéro d'image dans la vidéo (à partir de 1) et
  horodatage `t = (N − 1) / 25`.

| Dossier | Contenu |
|---|---|
| `00-overview/` | Vue d'ensemble : une image toutes les 2 s, vue 3D seule toutes les 0,4 s, bandeau supérieur |
| `E1-braking-behind-car_0m26s/` | Freinage derrière une voiture, sans contact |
| `E2-wheel-to-wheel-contact_0m36s/` | Contact roue contre roue, étincelle |
| `E3-launch-over-car-and-explosion_1m58s/` | Décollage sur une voiture, atterrissage, explosion, arrêt, redémarrage |
| `E4-rear-end-bumps_2m07s-2m20s/` | Six tamponnages par l'arrière |
| `E5-launch-on-roadside-board_3m01s/` | Choc contre un panneau, décollage, glissade dans le sable |
| `S-steering-hold_1m47s-1m56s/` | Braquage prolongé : les sept dessins du volant et des mains (`hand-positions.jpg`), le passage image par image (`passage-strip.jpg`, `passage-views.jpg`), l'afficheur de vitesse agrandi (`speed-readout.png`), le relevé complet (`timeline.json`) et les scripts du relevé (`method/`) |
| `P-perspective-and-layout/` | Images isolées agrandies ×2 : lignes droites, côtes, portiques, structure couverte, tunnel, second circuit |
| `measurements.json` | Relevés bruts : vitesses lues à l'œil, ligne d'horizon image par image, largeur de route |

La vidéo comparative `work/renders/steering/reference-vs-a.mp4` reprend, au même titre
(analyse uniquement), 9,7 s de la vue 3D de cette vidéo à côté de Virage GP.

Les planches `sheet-*.jpg` ne montrent que la vue 3D (lignes 122 à 360) ; les planches
`speed-readout*.png` agrandissent l'afficheur de vitesse du volant.
