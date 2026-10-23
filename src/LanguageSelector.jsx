import { LANGUAGES, setLanguage, t as translate } from "./i18n.js";
import useLanguage from "./useLanguage.js";
function Flag({
  code
}) {
  if (code === "ar") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="#ed2338" /><circle cx="12" cy="12" r="7" fill="white" /><circle cx="11" cy="12" r="4.5" fill="#ed2338" /><circle cx="12.7" cy="11" r="3.6" fill="white" /><path d="m14 9 .8 1.7 1.9.2-1.4 1.3.3 1.8-1.6-.9-1.6.9.3-1.8-1.3-1.3 1.8-.2Z" fill="#ed2338" /></svg>;
  if (code === "en") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="white" /><path d="M10 0h4v24h-4zM0 10h24v4H0z" fill="#ed2946" /></svg>;
  if (code === "zh") return <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="24" height="24" fill="#ed2338" /><path d="m8 4 1.2 3.2 3.4.1-2.7 2.1.9 3.3L8 10.8l-2.8 1.9.9-3.3-2.7-2.1 3.4-.1Z" fill="#ffe362" /><circle cx="15" cy="5" r="1" fill="#ffe362" /><circle cx="18" cy="8" r="1" fill="#ffe362" /><circle cx="18" cy="12" r="1" fill="#ffe362" /><circle cx="15" cy="15" r="1" fill="#ffe362" /></svg>;
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect width="8" height="24" fill={code === "it" ? "#10a272" : "#4958ea"} /><rect x="8" width="8" height="24" fill="white" /><rect x="16" width="8" height="24" fill="#ed3f59" /></svg>;
}
export default function LanguageSelector() {
  const language = useLanguage();
  return <div className="language-picker" role="group" aria-label={translate("Traduction")}>
    <span className="language-caption">{translate("Traduction")}</span>
    <div className="language-options">{LANGUAGES.map(item => <button type="button" key={item.code} lang={item.code} aria-label={`${item.name} (${item.short})`} aria-pressed={language === item.code} onClick={() => setLanguage(item.code)}>
      <span className="language-flag"><Flag code={item.code} /></span><span><strong>{item.short}</strong><small>{item.name}</small></span>
    </button>)}</div>
  </div>;
}
