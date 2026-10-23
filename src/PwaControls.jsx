import { getLocale, t as translate } from "./i18n.js";
import React, { useRef, useState, useSyncExternalStore } from "react";
import { Download, Smartphone, WifiOff, RefreshCw, X } from "lucide-react";
import { subscribe, getSnapshot, install, applyUpdate } from "./pwa";
export default function PwaControls({
  shared,
  cachedAt
}) {
  const pwa = useSyncExternalStore(subscribe, getSnapshot);
  const dialog = useRef(null),
    [error, setError] = useState("");
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent) || navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
  const native = /QOSAndroid\//.test(navigator.userAgent);
  async function requestInstall() {
    try {
      if (await install()) return;
    } catch {
      setError("La demande a été fermée. Vous pouvez aussi utiliser le menu du navigateur.");
    }
    dialog.current?.showModal();
  }
  return <>
    {!native && <section className="mobile-install" aria-label={translate("Installer QOS sur mobile")}><div><span className="mobile-install-title"><Smartphone size={21} />{translate("Votre atelier sur mobile")}</span><p>{apple ? translate("Installez QOS sur votre écran d’accueil depuis Safari.") : translate("Téléchargez l’application Android ou installez QOS depuis votre navigateur.")}</p></div><div className="mobile-install-actions">{!apple && <a className="btn primary" href="/downloads/qos-injection.apk" download="QOS-Injection.apk"><Download size={17} />{translate("Télécharger l’APK Android")}</a>}{!pwa.installed && <button className="btn" type="button" onClick={requestInstall}><Smartphone size={17} />{apple ? translate("Installer sur iPhone") : translate("Installer depuis le navigateur")}</button>}</div>{!apple && <small>{translate("Android : après le téléchargement, ouvrez le fichier APK et confirmez l’installation. iPhone : installation depuis Safari.")}</small>}</section>}
    {(pwa.offline || cachedAt) && <div className="pwa-notice"><WifiOff size={20} /><div><strong>{pwa.offline ? translate("Hors connexion") : translate("Dernière copie disponible")}</strong><p>{shared ? translate("Les brouillons restent sur cet appareil. Reconnectez-vous puis enregistrez-les pour les partager.") : translate("Les relevés restent enregistrables sur cet appareil. Ils ne sont pas partagés avec les autres appareils.")}{cachedAt && translate(" Données consultées le {0}.", [new Date(cachedAt).toLocaleString(getLocale())])}</p></div></div>}
    {pwa.waiting && <div className="pwa-notice"><RefreshCw size={20} /><div><strong>{translate("Une nouvelle version est prête")}</strong><p>{translate("Vos brouillons conservés seront disponibles après la mise à jour.")}</p></div><button className="btn primary" type="button" onClick={applyUpdate}>{translate("Mettre à jour")}</button></div>}
    {pwa.error && <p className="error">{translate(pwa.error)}</p>}
    <dialog ref={dialog} className="install-dialog" aria-labelledby="install-title"><div className="panel-heading"><h2 id="install-title">{translate("Installer QOS Injection")}</h2><button className="icon-button" aria-label={translate("Fermer les instructions")} onClick={() => dialog.current.close()}><X /></button></div><div className="dialog-body">{apple ? <><p>{translate("Sur iPhone ou iPad :")}</p><ol><li>{translate("Ouvrez l’adresse de l’atelier dans Safari.")}</li><li>{translate("Ouvrez le menu de partage.")}</li><li>{translate("Choisissez ")}<strong>{translate("Sur l’écran d’accueil")}</strong>{translate(", puis ")}<strong>{translate("Ajouter")}</strong>{translate(". Activez « Ouvrir comme app » si cette option est proposée.")}</li></ol></> : <><p>{translate("Sur Android, ouvrez ce site dans Chrome ou Edge :")}</p><ol><li>{translate("Ouvrez le menu du navigateur.")}</li><li>{translate("Choisissez ")}<strong>{translate("Installer l’application")}</strong>{translate(" ou ")}<strong>{translate("Ajouter à l’écran d’accueil")}</strong>.</li><li>{translate("Confirmez l’installation si le navigateur la propose.")}</li></ol><p>{translate("Sur ordinateur, utilisez l’icône d’installation dans la barre d’adresse ou le menu du navigateur.")}</p></>}<p>{translate("Si l’option n’apparaît pas, vérifiez que vous utilisez l’adresse HTTPS publiée et que l’application n’est pas déjà installée. Le navigateur décide si la confirmation native est disponible.")}</p><p>{shared ? translate("Utilisez la même adresse sur tous les appareils pour retrouver la base commune.") : translate("Mode local : installer QOS ne partage pas les données. La connexion à Supabase est nécessaire pour travailler à plusieurs appareils.")}</p>{error && <p className="error">{translate(error)}</p>}</div></dialog>
  </>;
}
