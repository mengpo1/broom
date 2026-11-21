# Contrôles visuels

Les vérifications d'image automatisées se trouvent dans `tests/rendering/smoke.browser.mjs`
(ordre des plans sur pixels, absence de scintillement, redimensionnement, écran partagé).

Les captures de référence soumises au critique artistique indépendant sont produites par
`node work/scripts/capture-stills.mjs` (8 situations imposées + variantes, 2560×1440, plus une
séquence de 6 images consécutives) ; les comptes rendus sont dans `work/reviews/`.
