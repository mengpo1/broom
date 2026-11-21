#!/usr/bin/env python3
"""Generate docs/specifications/performance.md and linux-compatibility.md from the JSON files
written by tests/performance/benchmark.mjs and work/scripts/system-report.mjs."""
import json, os, sys
root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
def load(path):
    p = os.path.join(root, path)
    return json.load(open(p)) if os.path.exists(p) else None
def f(v, n=2):
    return 'n/d' if v is None else f'{v:.{n}f}'.replace('.', ',')

sysrep = load('work/benchmarks/system-report.json')
bench = load('work/benchmarks/benchmark-2560x1440.json')
small = load('work/benchmarks/benchmark-1280x720.json')
size = os.path.getsize(os.path.join(root, 'index.html'))

if sysrep:
    s, b = sysrep['system'], sysrep['browser']
    ad = b.get('adapter') or {}
    doc = f"""# Rapport de compatibilité Linux

Détection effectuée par `node work/scripts/system-report.mjs` (lecture seule : aucune
configuration du système n'est modifiée). Date : {sysrep['date']}.

## Machine de développement et de test

| Élément | Valeur détectée |
|---|---|
| Distribution | {s['distribution']} |
| Noyau | {s['kernel']} ({s['architecture']}) |
| Processeur | {s['cpu']['model'] or 'non communiqué'} — {s['cpu']['logicalCores']} cœurs logiques |
| Mémoire | {f(s['memoryGB'], 1)} Go |
| Carte graphique (PCI) | {s['gpuDevices']} |
| Pilotes noyau graphiques | {', '.join(s['kernelDrivers']) or 'aucun (pas de GPU)'} |
| OpenGL | {s['glRenderer'] or 'glxinfo indisponible'} |
| Vulkan | {s['vulkan'] or 'vulkaninfo indisponible'} |
| Serveur d'affichage | {s['displayServer']} |
| Navigateur | Chromium {b.get('browserVersion', '')} (Playwright) |
| Agent utilisateur | `{b['userAgent']}` |
| WebGPU | {'disponible' if b['webgpu'] else 'indisponible'} — adaptateur : vendor « {ad.get('vendor', '')} », architecture « {ad.get('architecture', '')} »{', **adaptateur logiciel (repli)**' if ad.get('isFallback') else ''} |
| Format du canvas | {b.get('canvasFormat')} |
| Fonctions WebGPU | {len(b.get('features', []))} dont timestamp-query : {'oui' if 'timestamp-query' in b.get('features', []) else 'non'} |
| Limites | texture 2D max {b['limits']['maxTextureDimension2D'] if b.get('limits') else 'n/d'}, couches max {b['limits'].get('maxTextureArrayLayers') if b.get('limits') else 'n/d'} |
| Résolution de l'écran (virtuel) | {b['screen']['width']}×{b['screen']['height']}, densité {b['screen']['pixelRatio']} |
| Rafraîchissement mesuré | {f(b.get('refreshRateHz'), 1)} Hz (cadence de `requestAnimationFrame`) |
| Temps de dessin au chargement | voitures {f((b.get('artTimings') or {}).get('cars', 0) / 1000, 1)} s, dessins communs {f((b.get('artTimings') or {}).get('static', 0) / 1000, 1)} s |

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
| Hors ligne | Oui : `index.html` ({size:,} octets) ne charge aucune ressource externe (vérifié par test). Les sauvegardes utilisent `localStorage`. |
| Périphériques | Clavier, souris, jusqu'à deux manettes (Gamepad API, disposition standard). |

## Vérifications effectuées sous Linux

- Ouverture de `index.html` depuis le disque (`file://`), sans réseau : ✅
- Création du périphérique WebGPU, rendu d'une et deux vues, redimensionnement : ✅ (adaptateur logiciel)
- Déroulement complet des modes au clavier simulé : ✅
- Détection sans modification du système : ✅

Si WebGPU est absent, le jeu affiche un message explicite au lieu de démarrer.
""".replace(',', ',')
    open(os.path.join(root, 'docs/specifications/linux-compatibility.md'), 'w').write(doc)
    print('linux-compatibility.md written')

def table(data):
    rows = []
    for r in data['runs']:
        g = r.get('gpuPass')
        rows.append(f"| {r['scenario']} | {r['frames']} | {f(r['fps'], 1)} | {f(r['frameInterval']['mean'])} | {f(r['frameInterval']['p99'])} | {f(r['frameInterval']['max'])} | {r['framesOver16_7ms']} / {r['frames']} | "
                    f"{f(g['mean']) if g else 'n/d'} | {f(g['p99']) if g else 'n/d'} | {f(g['max']) if g else 'n/d'} | {f(r['cpuFrame']['mean'])} | {f(r['cpuFrame']['max'])} | {f(r.get('jsHeapMB'), 1)} | {f(r.get('jsHeapGrowthKB'), 0)} | {r['meanQuads']:.0f} |")
    return ("| Scénario | Images | i/s moy. | Intervalle moy. (ms) | P99 (ms) | Max (ms) | Images > 16,7 ms | GPU moy. (ms) | GPU P99 | GPU max | CPU moy. (ms) | CPU max | Tas JS (Mo) | Croissance du tas (Ko) | Quadrilatères |\n"
            "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n" + "\n".join(rows))

if bench:
    ad = bench['environment'].get('adapter') or {}
    software = any(r.get('softwareAdapter') for r in bench['runs'])
    doc = f"""# Rapport de performances

Benchmarks de référence : trois scénarios de 60 s en temps réel dans Chromium, sur le fichier
`index.html` réel (`npm run benchmark`, ou `index.html#benchmark=all` sur la machine du joueur).
Scénarios : **solo** (le joueur seul en piste), **grid** (16 adversaires), **split** (écran
partagé, 2 joueurs + 14 adversaires). Le joueur est conduit par l'ordinateur.

Trois grandeurs sont mesurées séparément :

- **intervalle entre images** : écart entre deux `requestAnimationFrame` (ce que voit le joueur) ;
- **temps CPU** par image : simulation + construction de la scène + encodage des commandes ;
- **temps GPU** de la passe de rendu : requêtes d'horodatage WebGPU (`timestamp-query`), quand
  l'adaptateur les fournit.

## ⚠ Portée de ces mesures

Adaptateur utilisé : vendor « {ad.get('vendor', '')} », architecture « {ad.get('architecture', '')} »{' — **rasteriseur logiciel**' if software else ''}.

{'La machine de test ne possède **aucune carte graphique** : WebGPU est exécuté par SwiftShader, sur le processeur (' + str(bench['environment'].get('cores')) + ' cœurs). Les chiffres ci-dessous mesurent donc un rendu logiciel et **ne permettent pas de conclure** sur les objectifs fixés pour un vrai GPU (60 i/s à 2560×1440, GPU moyen ≤ 11 ms, aucun pic > 16,7 ms). **Ces objectifs ne sont ni atteints ni réfutés : ils sont non vérifiés.** Le « temps GPU » rapporté est ici le temps du rasteriseur logiciel.' if software else ''}

## Résultats à 2560×1440 (qualité « {bench.get('quality')} », {bench['date'][:10]})

{table(bench)}

Rafraîchissement mesuré de l'affichage : {f(bench.get('refreshRateHz'), 1)} Hz.
"""
    if small:
        doc += f"""
## Résultats à 1280×720 (même machine, qualité « {small.get('quality')} »)

{table(small)}
"""
    doc += """
## Lecture

- Le **temps CPU** du jeu (simulation à 120 Hz de 17 voitures, construction de 1 000 à 2 500
  quadrilatères, écriture des tampons) est indépendant du rasteriseur : c'est la part qui se
  transpose telle quelle sur une machine réelle. Il laisse l'essentiel du budget de 16,7 ms au GPU.
- La charge GPU par image est faible par construction : une passe, 4 à 5 appels de dessin par
  vue, un shader plein écran pour le sol, des quadrilatères texturés, MSAA 4× en qualité haute.
- **Allocations** : la croissance du tas JS pendant 60 s est rapportée ci-dessus ; le code du
  jeu n'alloue pas dans la boucle de rendu, la croissance résiduelle vient des objets créés par
  l'API WebGPU à chaque image et de la mesure elle-même (promesses de lecture des horodatages).

## Reproduire sur une machine réelle

```bash
npm run benchmark
```

ou ouvrir `index.html#benchmark=all&seconds=60` dans Chrome : les trois scénarios s'enchaînent
et le résultat s'affiche (et reste dans `window.virageBenchmark`).
"""
    open(os.path.join(root, 'docs/specifications/performance.md'), 'w').write(doc)
    print('performance.md written')
