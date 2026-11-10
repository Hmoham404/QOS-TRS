import { EXTRA_LOSS_FIELDS, stopTypesFor } from './losses.js';
import { departmentConfig } from './departments.js';

export function exportColumns(department = 'injection') {
  const types = stopTypesFor(department);
  const primaryBreakdown = department === 'metallization' ? 'mold_breakdown_min' : 'breakdown_min';
  const extras = EXTRA_LOSS_FIELDS.filter(field => department === 'injection' || (field !== primaryBreakdown && Object.values(types).some(type => type.field === field)));
  const headers = ['Date', 'Poste', department === 'injection' ? 'Presse' : 'Équipement', department === 'injection' ? 'Code moule' : 'Référence', 'Article', 'Ouverture (min)', 'Arrêts planifiés (min)', 'Temps requis (min)', department === 'metallization' ? 'Panne Vaccum (min)' : 'Panne machine (min)', 'Démarrage/arrêt (min)', department === 'injection' ? 'Changement moule (min)' : 'Changement de référence (min)', 'Temps machine (min)', 'Quantité totale', 'Conformes', 'Rebuts démarrage', 'Rebuts production', 'Cycle (s/pièce)', 'Disponibilité (%)', 'Performance (%)', 'Qualité (%)', 'OEE (%)', 'Standard (s)', 'Heures dépensées', 'Recette (h)', 'DLE (%)', 'Commentaire', 'Début du relevé', 'Journal complet', 'Arrêts horodatés (JSON)', 'Quantité planifiée', ...extras.map(field => Object.values(types).find(type => type.field === field).source + ' (min)')];
  if (department !== 'injection') headers.push('Effectif standard', 'Objectif OEE', 'Objectif DLE');
  return { headers, extras, primaryBreakdown };
}
export const exportDepartmentName = data => departmentConfig(data.department).name;
