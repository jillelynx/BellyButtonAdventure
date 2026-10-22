// One place to make any playable character. New friends get added here later.
import { buildBellyButton } from './bellybutton.js';
import { buildLiev } from './liev.js';

export const CHARACTERS = {
  liev: { label: 'Liev', build: (choice) => buildLiev(choice) },
  bellybutton: { label: 'Belly Button', build: () => buildBellyButton() },
};
export function buildCharacter(kind, choice) { return (CHARACTERS[kind] || CHARACTERS.liev).build(choice); }
export function friendOf(kind) { return kind === 'liev' ? 'bellybutton' : 'liev'; }
