import React,{useRef,useState,useSyncExternalStore} from 'react';
import {Download,Smartphone,WifiOff,RefreshCw,X} from 'lucide-react';
import {subscribe,getSnapshot,install,applyUpdate} from './pwa';
export default function PwaControls({shared,cachedAt}){
  const pwa=useSyncExternalStore(subscribe,getSnapshot);
  const dialog=useRef(null),[error,setError]=useState('');
  const apple=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const native=/QOSAndroid\//.test(navigator.userAgent);
  async function requestInstall(){
    try{if(await install())return;}catch{setError('La demande a été fermée. Vous pouvez aussi utiliser le menu du navigateur.');}
    dialog.current?.showModal();
  }
  return <>
    {!native&&<section className="mobile-install" aria-label="Installer QOS sur mobile"><div><span className="mobile-install-title"><Smartphone size={21}/>Votre atelier sur mobile</span><p>{apple?'Installez QOS sur votre écran d’accueil depuis Safari.':'Téléchargez l’application Android ou installez QOS depuis votre navigateur.'}</p></div><div className="mobile-install-actions">{!apple&&<a className="btn primary" href="/downloads/qos-injection.apk" download="QOS-Injection.apk"><Download size={17}/>Télécharger l’APK Android</a>}{!pwa.installed&&<button className="btn" type="button" onClick={requestInstall}><Smartphone size={17}/>{apple?'Installer sur iPhone':'Installer depuis le navigateur'}</button>}</div>{!apple&&<small>Android : après le téléchargement, ouvrez le fichier APK et confirmez l’installation. iPhone : installation depuis Safari.</small>}</section>}
    {(pwa.offline||cachedAt)&&<div className="pwa-notice"><WifiOff size={20}/><div><strong>{pwa.offline?'Hors connexion':'Dernière copie disponible'}</strong><p>{shared?'Les brouillons restent sur cet appareil. Reconnectez-vous puis enregistrez-les pour les partager.':'Les relevés restent enregistrables sur cet appareil. Ils ne sont pas partagés avec les autres appareils.'}{cachedAt&&` Données consultées le ${new Date(cachedAt).toLocaleString('fr-FR')}.`}</p></div></div>}
    {pwa.waiting&&<div className="pwa-notice"><RefreshCw size={20}/><div><strong>Une nouvelle version est prête</strong><p>Vos brouillons conservés seront disponibles après la mise à jour.</p></div><button className="btn primary" type="button" onClick={applyUpdate}>Mettre à jour</button></div>}
    {pwa.error&&<p className="error">{pwa.error}</p>}
    <dialog ref={dialog} className="install-dialog" aria-labelledby="install-title"><div className="panel-heading"><h2 id="install-title">Installer QOS Injection</h2><button className="icon-button" aria-label="Fermer les instructions" onClick={()=>dialog.current.close()}><X/></button></div><div className="dialog-body">{apple?<><p>Sur iPhone ou iPad :</p><ol><li>Ouvrez l’adresse de l’atelier dans Safari.</li><li>Ouvrez le menu de partage.</li><li>Choisissez <strong>Sur l’écran d’accueil</strong>, puis <strong>Ajouter</strong>. Activez « Ouvrir comme app » si cette option est proposée.</li></ol></>:<><p>Sur Android, ouvrez ce site dans Chrome ou Edge :</p><ol><li>Ouvrez le menu du navigateur.</li><li>Choisissez <strong>Installer l’application</strong> ou <strong>Ajouter à l’écran d’accueil</strong>.</li><li>Confirmez l’installation si le navigateur la propose.</li></ol><p>Sur ordinateur, utilisez l’icône d’installation dans la barre d’adresse ou le menu du navigateur.</p></>}<p>Si l’option n’apparaît pas, vérifiez que vous utilisez l’adresse HTTPS publiée et que l’application n’est pas déjà installée. Le navigateur décide si la confirmation native est disponible.</p><p>{shared?'Utilisez la même adresse sur tous les appareils pour retrouver la base commune.':'Mode local : installer QOS ne partage pas les données. La connexion à Supabase est nécessaire pour travailler à plusieurs appareils.'}</p>{error&&<p className="error">{error}</p>}</div></dialog>
  </>;
}
