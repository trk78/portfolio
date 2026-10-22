import { projets } from './contenu';

// Calculated numbering: hiding the Projects section leaves no gap in the sequence.
export const sections = [
  { id: 'services', titre: 'Services' },
  { id: 'methode', titre: 'Méthode' },
  ...(projets.length ? [{ id: 'projets', titre: 'Projets' }] : []),
  { id: 'contact', titre: 'Contact' },
].map((s, i) => ({ ...s, num: String(i + 1).padStart(2, '0') }));

export const num = (id: string) => sections.find((s) => s.id === id)?.num;
