// One place to make any playable character. New friends get added here later.
import { buildBellyButton } from './bellybutton.js';
import { buildLiev } from './liev.js';
import { buildLiev3D, preloadLievModel, lievModelReady } from './liev3d.js';

// Liev's new 3D model (made in Blender) loads once at the start; until it's ready, or if it
// can't load, the classic Liev is used, so the game never gets stuck.
export const charactersReady = preloadLievModel();

export const CHARACTERS = {
  liev: { label: 'Liev', build: (choice) => (lievModelReady() && !choice.classicLiev ? buildLiev3D(choice) : buildLiev(choice)) },
  bellybutton: { label: 'Belly Button', build: () => buildBellyButton() },
};
export function buildCharacter(kind, choice) { return (CHARACTERS[kind] || CHARACTERS.liev).build(choice); }
export function friendOf(kind) { return kind === 'liev' ? 'bellybutton' : 'liev'; }
