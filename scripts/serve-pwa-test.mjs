// Test server bound to loopback only; simulates a second deployment without
// changing dist or production files. Not used for hosting the application.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const root=resolve('dist');let version=1;
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.png':'image/png','.svg':'image/svg+xml','.woff':'font/woff','.woff2':'font/woff2'};
createServer(async(req,res)=>{
  const url=new URL(req.url,'http://127.0.0.1:4173');
  if(url.pathname==='/__test/version'&&req.method==='POST'){version++;res.writeHead(200);res.end(String(version));return;}
  const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  try{
    let body=await readFile(path);
    if(url.pathname==='/sw.js')body=Buffer.from(body.toString().replace(/qos-shell-([a-f0-9]+)/g,`qos-shell-$1-test${version}`));
    res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(body);
  }catch{res.writeHead(404);res.end('Not found');}
}).listen(4173,'127.0.0.1',()=>console.log('PWA test server: http://127.0.0.1:4173'));
