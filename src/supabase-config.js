export function resolveSupabaseConfig(env) {
  const url=(env.VITE_SUPABASE_URL||'').trim().replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
  const key=(env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()||env.VITE_SUPABASE_ANON_KEY?.trim()||'');
  let error=null;
  if(Boolean(url)!==Boolean(key))error='La configuration du site est incomplète : renseignez VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) dans Vercel, puis redéployez.';
  else if(url&&!/^https:\/\/[^\s/]+$/.test(url))error='L’URL Supabase doit être une adresse HTTPS valide.';
  else if(/votre[-_]projet|your[-_]project/i.test(url)||/votre[_-]cle|your[_-]key/i.test(key))error='Le site utilise une configuration d’exemple. Remplacez-la dans Vercel par l’URL et la clé publique de votre projet Supabase, puis redéployez.';
  else if(key){
    let publicKey=key.startsWith('sb_publishable_');
    if(key.startsWith('eyJ'))try{publicKey=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role==='anon';}catch{}
    if(!publicKey)error='Utilisez la clé publique Supabase (publishable ou anon), jamais une clé secrète ou service_role.';
  }
  return {url,key,error};
}
