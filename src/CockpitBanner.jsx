import React from 'react';
import {Layers3,ArrowDownRight} from 'lucide-react';
import PressScene from './PressScene';
export default function CockpitBanner({presses,total,rows}){
 return <section className="cockpit-banner"><div className="cockpit-copy"><span className="cockpit-tag"><span/>PILOTAGE INDUSTRIEL / INJECTION</span><h2>Votre atelier.<br/><em>Une nouvelle perspective.</em></h2><p>Suivez la production, comprenez les arrêts<br/>et identifiez vos leviers de performance.</p><div className="cockpit-scope"><Layers3 size={17}/><strong>{presses} / {total}</strong><span>presses renseignées</span><i/><strong>{rows}</strong><span>relevés sur la période</span></div></div><div className="cockpit-middle"><span className="technical-label">QOS / 01</span><div className="cockpit-orbits"><span/><span/><span/><ArrowDownRight size={29}/></div><span className="technical-label">MESURER. COMPRENDRE. AGIR.</span></div><PressScene/></section>;
}
