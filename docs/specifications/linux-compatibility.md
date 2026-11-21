# Rapport de compatibilité Linux

Détection effectuée par `node work/scripts/system-report.mjs` (lecture seule : aucune
configuration du système n'est modifiée). Date : 2026-11-21T17:46:06.817Z.

## Machine de développement et de test

| Élément | Valeur détectée |
|---|---|
| Distribution | Ubuntu 24.04.5 LTS |
| Noyau | 6.18.44-fc-v726 (x86_64) |
| Processeur | Intel(R) Xeon(R) Processor @ 2.10GHz — 4 cœurs logiques |
| Mémoire | 15,7 Go |
| Carte graphique (PCI) | no PCI display device reported |
| Pilotes noyau graphiques | aucun (pas de GPU) |
| OpenGL | glxinfo indisponible |
| Vulkan | vulkaninfo indisponible |
| Serveur d'affichage | none (a virtual X server, Xvfb, is started for the tests) |
| Navigateur | Chromium 153.0.8010.12 (Playwright) |
| Agent utilisateur | `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36` |
| WebGPU | disponible — adaptateur : vendor « google », architecture « swiftshader », **adaptateur logiciel (repli)** |
| Format du canvas | rgba8unorm |
| Fonctions WebGPU | 21 dont timestamp-query : oui |
| Limites | texture 2D max 8192, couches max 256 |
| Résolution de l'écran (virtuel) | 1280×720, densité 1 |
| Rafraîchissement mesuré | 59,9 Hz (cadence de `requestAnimationFrame`) |
| Temps de dessin au chargement | voitures 19,3 s, dessins communs 1,8 s |

**Conséquence** : cette machine n'a pas de carte graphique. WebGPU y fonctionne grâce à
SwiftShader (rendu par le processeur) ; le jeu s'y exécute correctement mais très lentement.
Tout ce qui est fonctionnel a été vérifié ici ; rien de ce qui est performance sur GPU ne l'a été.

## Exigences pour jouer

| Exigence | Détail |
|---|---|
| Navigateur | Chrome ou Chromium 113+ (WebGPU). Firefox : WebGPU selon version et réglages, non testé. |
| Linux | Pilotes Vulkan fonctionnels (Mesa RADV/ANV récents ou NVIDIA propriétaire). Sur certaines configurations, lancer avec `--enable-features=Vulkan` ; `chrome://gpu` indique l'état de WebGPU. |
| Wayland / X11 | Aucun code spécifique : le jeu n'utilise que les API web. X11 (Xvfb) testé ; Wayland non testé. |
| Résolution | Toute taille ; cible 2560×1440. Le découpage s'adapte (plein écran, bandes, moitiés). |
| Mémoire vidéo | environ 390 Mo de textures générées au chargement. |
| Hors ligne | Oui : `index.html` (982,054 octets) ne charge aucune ressource externe (vérifié par test). Les sauvegardes utilisent `localStorage`. |
| Périphériques | Clavier, souris, jusqu'à deux manettes (Gamepad API, disposition standard). |

## Vérifications effectuées sous Linux

- Ouverture de `index.html` depuis le disque (`file://`), sans réseau : ✅
- Création du périphérique WebGPU, rendu d'une et deux vues, redimensionnement : ✅ (adaptateur logiciel)
- Déroulement complet des modes au clavier simulé : ✅
- Détection sans modification du système : ✅

Si WebGPU est absent, le jeu affiche un message explicite au lieu de démarrer.
