// Text lookup. Every user-facing string lives in a dictionary (fr.js, en.js); code only uses keys.

import { FR } from './fr.js';
import { EN } from './en.js';

export const LANGUAGES = { fr: FR, en: EN };
export const LANGUAGE_ORDER = ['fr', 'en'];
let current = FR;
let currentId = 'fr';

export function setLanguage(id) {
  if (!LANGUAGES[id]) return;
  current = LANGUAGES[id]; currentId = id;
}

export function getLanguage() { return currentId; }

/** Translated text for a key; `{name}` placeholders are replaced from `params`. Falls back to French, then to the key. */
export function t(key, params) {
  let text = current[key] ?? FR[key] ?? key;
  if (params) for (const name in params) text = text.replace(`{${name}}`, params[name]);
  return text;
}
