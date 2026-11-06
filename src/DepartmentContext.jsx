import { createContext, useContext } from 'react';
import { t } from './i18n.js';

export const DepartmentContext = createContext('injection');
// Keep Injection wording; production lines use the same established interface.
const labels = {
  'Presses & moules': 'Équipements & articles', 'Presses ': 'Équipements ',
  'Moules & articles ': 'Articles ', 'Presse': 'Équipement',
  'Toutes les presses': 'Tous les équipements', 'Filtrer par presse': 'Filtrer par équipement',
  'Ajouter une presse': 'Ajouter un équipement', 'une presse': 'un équipement',
  'Nom de la presse': 'Nom de l’équipement', 'Presse enregistrée.': 'Équipement enregistré.',
  'PRESSE À INJECTER': 'LIGNE DE PRODUCTION', 'Code moule / article': 'Référence article',
  'Code moule': 'Référence', 'Cycle moule': 'Temps de cycle', 'Cycle moule (s)': 'Temps de cycle (s / pièce)',
  'Presse du bilan journalier': 'Équipement du bilan journalier',
  'CHRONOLOGIE DE LA PRESSE': 'CHRONOLOGIE DE L’ÉQUIPEMENT',
  'Les presses, poste par poste.': 'Les équipements, poste par poste.',
  'Une presse. Une chronologie.': 'Un équipement. Une chronologie.',
  'Presses ayant travaillé': 'Équipements ayant travaillé',
  ' presses renseignées · ': ' équipements renseignés · ', ' presses renseignées': ' équipements renseignés',
  ' presses renseignées / ': ' équipements renseignés / ',
  ' presses avec relevés': ' équipements avec relevés',
  'La veille, presse par presse.': 'La veille, équipement par équipement.',
  'TRS de la presse': 'TRS de l’équipement', 'DLE de la presse': 'DLE de l’équipement',
  'COMPARAISON DES PRESSES': 'COMPARAISON DES ÉQUIPEMENTS',
  'Presse du graphique TRS par machine': 'Équipement du graphique TRS par machine',
  'Aucun relevé pour cette presse': 'Aucun relevé pour cet équipement',
  'Choisissez une autre presse ou modifiez la période et le poste.': 'Choisissez un autre équipement ou modifiez la période et le poste.',
  '{0} presse{1} travaillé. {2} poste{3} avec de la marche déclarée.': '{0} équipement{1} travaillé. {2} poste{3} avec de la marche déclarée.',
};
export function departmentText(source, department = 'injection', values = []) {
  return t(department === 'injection' ? source : labels[source] ?? source, values);
}
export function useDepartmentText() {
  const department = useContext(DepartmentContext);
  return (source, values) => departmentText(source, department, values);
}
