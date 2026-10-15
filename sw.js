const root=new URL(self.registration.scope),prefix=`${root.pathname}deck/`,encoder=new TextEncoder();
let currentKey=null,catalog=null,build=null,restorePromise=null,restoreResolve=null,unlockEpoch=0;
const cache=new Map(),pending=new Map();let cacheBytes=0;const MAX_CACHE=64*1024*1024;
const decode64=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
function clear(){restoreResolve?.(false);currentKey=null;catalog=null;build=null;cache.clear();pending.clear();cacheBytes=0;unlockEpoch++;}
async function decryptBlob(entry,key,aad){const response=await fetch(new URL(entry.blob,root),{cache:'no-store'});if(!response.ok)throw new Error('Encrypted file unavailable.');return crypto.subtle.decrypt({name:'AES-GCM',iv:decode64(entry.iv),additionalData:encoder.encode(aad),tagLength:128},key,await response.arrayBuffer());}
async function unlock(key,manifest){
 const epoch=unlockEpoch;
 if(manifest?.version!==1||manifest?.cipher!=='AES-GCM'||!/^blobs\/[a-f0-9]+\.bin$/.test(manifest.catalog?.blob||''))throw new Error('Invalid package.');
 let parsed;try{parsed=JSON.parse(new TextDecoder().decode(await decryptBlob(manifest.catalog,key,'rbb-share-catalog-v1')));}catch{throw new Error('Incorrect password.');}
 if(epoch!==unlockEpoch)throw new Error('Presentation locked.');
 if(parsed.version!==1||!parsed.entries?.['index.html'])throw new Error('Invalid encrypted catalog.');
 if(build!==manifest.build){cache.clear();pending.clear();cacheBytes=0;unlockEpoch++;}
 currentKey=key;catalog=parsed.entries;build=manifest.build;restoreResolve?.(true);
}
self.addEventListener('message',event=>{
 let source;try{source=new URL(event.source?.url);}catch{return;}
 if(source.origin!==root.origin||![root.pathname,`${root.pathname}index.html`].includes(source.pathname))return;
 const data=event.data||{},port=event.ports[0];
 if(data.type==='RBB_LOCK'){clear();port?.postMessage({ok:true});return;}
 if(data.type==='RBB_UNLOCK'||data.type==='RBB_RESTORE_KEY')event.waitUntil(unlock(data.key,data.manifest).then(()=>port?.postMessage({ok:true})).catch(error=>port?.postMessage({ok:false,error:error.message})));
});
async function recoverKey(){
 if(currentKey&&catalog)return true;
 if(!restorePromise)restorePromise=new Promise(resolve=>{let finished=false;const done=value=>{if(finished)return;finished=true;clearTimeout(timer);restoreResolve=null;resolve(value);};const timer=setTimeout(()=>done(false),1800);restoreResolve=done;self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>{for(const client of clients)if(new URL(client.url).pathname===root.pathname||new URL(client.url).pathname===`${root.pathname}index.html`){const epoch=unlockEpoch,channel=new MessageChannel();channel.port1.onmessage=event=>{channel.port1.close();if(epoch!==unlockEpoch)return;const data=event.data||{};if(data.type==='RBB_RESTORE_KEY')unlock(data.key,data.manifest).catch(()=>{});};client.postMessage({type:'RBB_KEY_REQUEST'},[channel.port2]);setTimeout(()=>channel.port1.close(),1800);}});}).finally(()=>{restorePromise=null;});
 return restorePromise;
}
async function bytesFor(path,entry){
 if(cache.has(path)){const value=cache.get(path);cache.delete(path);cache.set(path,value);return value;}
 if(pending.has(path))return pending.get(path);
 const epoch=unlockEpoch,key=currentKey;
 const promise=decryptBlob(entry,key,path).then(bytes=>{if(epoch!==unlockEpoch||!currentKey)throw new Error('Presentation locked.');if(bytes.byteLength<=MAX_CACHE){while(cacheBytes+bytes.byteLength>MAX_CACHE&&cache.size){const first=cache.keys().next().value;cacheBytes-=cache.get(first).byteLength;cache.delete(first);}cache.set(path,bytes);cacheBytes+=bytes.byteLength;}return bytes;}).finally(()=>pending.delete(path));
 pending.set(path,promise);return promise;
}
function rangeFor(value,size){
 const match=/^bytes=(\d*)-(\d*)$/.exec(value||'');if(!match||(!match[1]&&!match[2]))return null;
 let start,end;
 if(!match[1]){const suffix=Number(match[2]);if(!suffix)return null;start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),size-1):size-1;}
 return Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start>=0&&start<size&&end>=start?[start,end]:null;
}
async function protectedResponse(request){
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 if(!await recoverKey())return new Response('Presentation locked. Open the presentation link and enter the password.',{status:401,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
 let path;try{path=decodeURIComponent(new URL(request.url).pathname.slice(prefix.length))||'index.html';}catch{return new Response('Not found',{status:404});}
 if(path.split('/').includes('..'))return new Response('Not found',{status:404});
 const entry=catalog?.[path];if(!entry)return new Response('Not found',{status:404});
 const headers=new Headers({'Content-Type':entry.type,'Content-Length':String(entry.size),'Cache-Control':'no-store','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
 if(request.method==='HEAD')return new Response(null,{status:200,headers});
 try{const bytes=await bytesFor(path,entry),range=request.headers.get('Range');if(range){const bounds=rangeFor(range,bytes.byteLength);if(!bounds){headers.set('Content-Range',`bytes */${bytes.byteLength}`);headers.delete('Content-Length');return new Response(null,{status:416,headers});}const[start,end]=bounds;headers.set('Content-Range',`bytes ${start}-${end}/${bytes.byteLength}`);headers.set('Content-Length',String(end-start+1));return new Response(bytes.slice(start,end+1),{status:206,headers});}return new Response(bytes,{status:200,headers});}
 catch{return new Response('Unable to open encrypted file.',{status:503,headers:{'Cache-Control':'no-store'}});}
}
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(url.origin===root.origin&&url.pathname.startsWith(prefix))event.respondWith(protectedResponse(event.request));});
