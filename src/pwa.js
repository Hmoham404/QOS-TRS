let state={installPrompt:null,installed:false,offline:!navigator.onLine,waiting:null,ready:false,error:''};
const subscribers=new Set();
function patch(next){state={...state,...next};for(const fn of subscribers)fn();}
export const subscribe=fn=>{subscribers.add(fn);return()=>subscribers.delete(fn);};
export const getSnapshot=()=>state;
let registration,applying=false,started=false;
export function startPwa(){
  if(started)return;started=true;
  const display=matchMedia('(display-mode: standalone)');
  patch({installed:display.matches||navigator.standalone===true});
  display.addEventListener('change',e=>patch({installed:e.matches||navigator.standalone===true}));
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();patch({installPrompt:e});});
  window.addEventListener('appinstalled',()=>patch({installed:true,installPrompt:null}));
  window.addEventListener('offline',()=>patch({offline:true}));
  window.addEventListener('online',()=>{patch({offline:false});registration?.update().catch(()=>{});});
  if(!import.meta.env.PROD||!('serviceWorker' in navigator))return;
  navigator.serviceWorker.addEventListener('controllerchange',()=>{
    if(applying)location.reload();
  });
  const register=async()=>{
    try{
      registration=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
      const waiting=()=>{if(registration.waiting&&navigator.serviceWorker.controller)patch({waiting:registration.waiting});};
      waiting();
      registration.addEventListener('updatefound',()=>{
        const worker=registration.installing;
        worker?.addEventListener('statechange',()=>{if(worker.state==='installed')waiting();});
      });
      navigator.serviceWorker.ready.then(()=>patch({ready:true}));
      document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')registration.update().catch(()=>{});});
      setInterval(()=>{if(navigator.onLine&&document.visibilityState==='visible')registration.update().catch(()=>{});},60000);
    }catch{patch({error:'L’accès hors connexion n’a pas pu être préparé. Réessayez avec une connexion active.'});}
  };
  if(document.readyState==='complete')register();else window.addEventListener('load',register,{once:true});
}
export async function install(){
  const prompt=state.installPrompt;if(!prompt)return false;
  try{await prompt.prompt();await prompt.userChoice;}finally{patch({installPrompt:null});}
  return true;
}
export function applyUpdate(){
  if(!state.waiting)return;
  // Inputs persist drafts synchronously. A failed write can veto this reload.
  const request=new Event('qos-before-update',{cancelable:true});
  if(!window.dispatchEvent(request))return;
  applying=true;
  state.waiting.postMessage({type:'APPLY_UPDATE'});
}
