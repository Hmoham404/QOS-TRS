export function resolveSupabaseConfig(env, requireCloud=false) {
  const url=(env.VITE_SUPABASE_URL||'').trim().replace(/\/rest\/v1\/?$/,'').replace(/\/$/,'');
  const key=(env.VITE_SUPABASE_PUBLISHABLE_KEY||'').trim()||(env.VITE_SUPABASE_ANON_KEY||'').trim();
  let error=null;
  if(requireCloud||url||key){
    const missing=[];
    if(!url)missing.push('VITE_SUPABASE_URL');
    if(!key)missing.push('VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY)');
    if(missing.length)error=`Configuration Supabase incomplète : ${missing.join(' et ')}. Sur Vercel, ajoutez ces variables dans Settings → Environment Variables pour Production, puis redéployez. En local, renseignez .env et relancez Vite.`;
    else if(!/^https:\/\/[^\s/]+$/.test(url))error='VITE_SUPABASE_URL doit contenir l’adresse HTTPS du projet Supabase, sans chemin.';
    else if(key.startsWith('sb_secret_'))error='Utilisez une clé publique Supabase (publishable ou anon), jamais une clé secrète.';
    else if(key.startsWith('eyJ')){
      try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));if(payload.role!=='anon')error='La clé JWT Supabase doit avoir le rôle anon. Une clé service_role ne doit jamais être utilisée dans le navigateur.';}
      catch{error='La clé publique Supabase est invalide. Copiez la clé publishable ou anon du projet.';}
    }
  }
  return {url,key,error,configured:Boolean(url&&key&&!error)};
}
