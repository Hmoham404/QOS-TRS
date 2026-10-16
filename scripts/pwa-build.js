import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const publicFiles=['manifest.webmanifest','favicon.svg','icons/icon-192.png','icons/icon-512.png','icons/maskable-512.png','icons/apple-touch-icon.png'];
export function pwaBuild(){
  return {name:'qos-pwa',apply:'build',enforce:'post',generateBundle(_,bundle){
    const template=readFileSync(new URL('./sw-template.js',import.meta.url),'utf8');
    const hash=createHash('sha256').update(template);
    const files=Object.keys(bundle).sort();
    for(const name of files){const item=bundle[name];hash.update(name).update(item.type==='chunk'?item.code:item.source);}
    for(const name of publicFiles)hash.update(name).update(readFileSync(new URL('../public/'+name,import.meta.url)));
    const version=hash.digest('hex').slice(0,16);
    const urls=[...files,...publicFiles].map(name=>'/'+name);
    this.emitFile({type:'asset',fileName:'sw.js',source:template.replace('__CACHE_NAME__',JSON.stringify('qos-shell-'+version)).replace('__PRECACHE__',JSON.stringify(urls))});
  }};
}
